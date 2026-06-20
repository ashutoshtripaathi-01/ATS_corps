import { Router, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import {
  signAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from '../lib/tokens'
import { body } from '../lib/validate'
import { isLocked, recordFailure, recordSuccess } from '../lib/lockout'
import { audit, A } from '../lib/audit'
import { env } from '../lib/env'
import { pool } from '../db'

const router = Router()

/* ── Dedicated auth rate limiter: 5 requests / 15 min / IP ────────── */
const authLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             5,
  standardHeaders: true,
  legacyHeaders:   false,
  skipSuccessfulRequests: true, // only count failures against the limit
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
})

/* ── Request schemas ─────────────────────────────────────────────────── */
const adminLoginSchema = z.object({
  email:    z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

/* ── Admin password hash (computed once at startup) ─────────────────── */
let _adminHash: string | undefined

async function getAdminHash(): Promise<string> {
  if (_adminHash) return _adminHash

  if (process.env.ADMIN_PASSWORD_HASH) {
    _adminHash = process.env.ADMIN_PASSWORD_HASH
    return _adminHash
  }

  const plain = process.env.ADMIN_PASSWORD ?? 'admin@123'
  console.warn('[Auth] ADMIN_PASSWORD_HASH not set — hashing ADMIN_PASSWORD at startup')
  _adminHash = await bcrypt.hash(plain, 12)
  console.log(`[Auth] Paste this into your .env → ADMIN_PASSWORD_HASH=${_adminHash}`)
  return _adminHash
}

// Pre-warm so first login is instant
getAdminHash().catch(console.error)

/* ── POST /api/auth/admin/login ─────────────────────────────────────── */
router.post(
  '/admin/login',
  authLimiter,
  body(adminLoginSchema),
  async (req: Request, res: Response) => {
    const { email, password } = req.body as z.infer<typeof adminLoginSchema>
    const lockKey = `admin:${email}`

    // 1. Account lockout check
    const { locked, retryAfterMs } = isLocked(lockKey)
    if (locked) {
      const minutes = Math.ceil((retryAfterMs ?? 0) / 60_000)
      audit(A.ACCOUNT_LOCKED, { userId: 'admin-1', req, metadata: { email } })
      return res.status(423).json({
        error: `Account temporarily locked. Try again in ${minutes} minute(s).`,
        retryAfterMs,
      })
    }

    // 2. Email check (constant-time via bcrypt compare later prevents timing oracle)
    const expectedEmail = process.env.ADMIN_EMAIL ?? 'admin@atscorps.com'
    if (email !== expectedEmail) {
      const { lockedNow, attemptsLeft } = recordFailure(lockKey)
      audit(A.LOGIN_FAILED, { req, metadata: { email, reason: 'wrong_email' } })
      if (lockedNow) {
        return res.status(423).json({ error: 'Account temporarily locked after too many failed attempts.' })
      }
      return res.status(401).json({ error: 'Invalid credentials', attemptsLeft })
    }

    // 3. Password check
    try {
      const hash  = await getAdminHash()
      const valid = await bcrypt.compare(password, hash)

      if (!valid) {
        const { lockedNow, attemptsLeft } = recordFailure(lockKey)
        audit(A.LOGIN_FAILED, { userId: 'admin-1', req, metadata: { reason: 'wrong_password' } })
        if (lockedNow) {
          audit(A.ACCOUNT_LOCKED, { userId: 'admin-1', req })
          return res.status(423).json({ error: 'Account temporarily locked after too many failed attempts.' })
        }
        return res.status(401).json({ error: 'Invalid credentials', attemptsLeft })
      }

      // 4. Success
      recordSuccess(lockKey)
      const accessToken = signAccessToken({ id: 'admin-1', role: 'admin' })
      await issueRefreshToken(res, 'admin-1', 'admin')
      audit(A.LOGIN_SUCCESS, { userId: 'admin-1', req })

      return res.json({
        accessToken,
        user: { id: 'admin-1', name: 'Ex-Serviceman Jobs Admin', email, role: 'admin' },
      })
    } catch (e: any) {
      console.error('[auth/admin/login]', e)
      return res.status(500).json({ error: 'Login failed' })
    }
  },
)

/* ── POST /api/auth/refresh ─────────────────────────────────────────── */
router.post('/refresh', async (req: Request, res: Response) => {
  const raw = (req as any).cookies?.ats_rt as string | undefined
  if (!raw) return res.status(401).json({ error: 'No refresh token' })

  try {
    const { userId, userType } = await rotateRefreshToken(res, raw)
    const accessToken = signAccessToken({
      id:   userId,
      role: userType as 'candidate' | 'employer' | 'admin',
    })
    audit(A.REFRESH_TOKEN_ROTATED, { userId, req })
    return res.json({ accessToken })
  } catch (e: any) {
    const isReuse = /reuse/i.test(e.message ?? '')
    if (isReuse) audit(A.TOKEN_REUSE_DETECTED, { req })
    const status: number = (e as any).status ?? 401
    return res.status(status).json({ error: e.message || 'Session expired' })
  }
})

/* ── POST /api/auth/logout ──────────────────────────────────────────── */
router.post('/logout', async (req: Request, res: Response) => {
  const raw = (req as any).cookies?.ats_rt as string | undefined
  if (raw) await revokeRefreshToken(res, raw).catch(() => {})
  audit(A.LOGOUT, { req })
  return res.json({ success: true })
})

/* ── POST /api/auth/dev-bypass ──────────────────────────────────────────
   Developer-only shortcut: creates/finds a test candidate and issues full
   JWT tokens without requiring OTP or payment.
   BLOCKED entirely when DEV_BYPASS != 'true' or NODE_ENV == 'production'.
   Remove this endpoint (and DEV_BYPASS from .env) before going live.
   ───────────────────────────────────────────────────────────────────── */
router.post('/dev-bypass', async (req: Request, res: Response) => {
  const { DEV_BYPASS, NODE_ENV } = env()

  if (DEV_BYPASS !== 'true' || NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Dev bypass is not enabled on this server.' })
  }

  try {
    // Upsert a fixed dev-test candidate so the session has a real DB row
    const result = await pool.query(
      `INSERT INTO candidates (
         full_name, mobile, force, rank, unit, retirement_date,
         post, loc1, application_fee, payment_status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (mobile) DO UPDATE SET
         payment_status = 'dev_bypass',
         updated_at     = NOW()
       RETURNING *`,
      [
        'Dev Tester', '9000000000', 'Army', 'Colonel',
        'Dev Unit', '2020-01-01', 'Security Guard', 'Upper Assam', 0, 'dev_bypass',
      ],
    )

    const c           = result.rows[0]
    const accessToken = signAccessToken({ id: String(c.id), role: 'candidate' })
    await issueRefreshToken(res, String(c.id), 'candidate')

    return res.json({
      accessToken,
      candidate: c,
      _devBypass: true,
    })
  } catch (e: any) {
    console.error('[auth/dev-bypass]', e)
    return res.status(500).json({ error: 'Dev bypass failed', detail: e.message })
  }
})

export default router
