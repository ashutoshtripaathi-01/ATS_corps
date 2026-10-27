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
import {
  isLocked, recordFailure, recordSuccess,
  beginGlobalAttempt, clearGlobalThrottle,
} from '../lib/lockout'
import { audit, A } from '../lib/audit'

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

/*
 * The lockout key used to be `admin:${email}`, with no IP component at all.
 * Since there is exactly one admin account, that meant ANY unauthenticated
 * source — from anywhere — could lock the real admin out of their own
 * account for 15 minutes by submitting 5 wrong passwords, repeatable
 * indefinitely. It also keyed on the raw, unnormalized email, so
 * `Admin@X.com` vs `admin@x.com` each got a fresh attempt budget — a
 * trivial lockout-counting bypass (zod's email() schema already rejects
 * leading/trailing whitespace before this handler ever sees it, so that
 * specific variant was never actually reachable).
 *
 * The key is now per-(account + IP): what actually protects THIS account
 * is now scoped to THIS source, so one IP's failures can never lock out a
 * different IP's legitimate login. A single source trying many different
 * email values against this route doesn't need a second, separate lockout
 * layer here — `authLimiter` above already caps any one IP to 5 requests
 * per 15 minutes on this exact route, regardless of which email each
 * request claims, which is at least as strict as anything a second lock
 * keyed only on IP could add on top.
 *
 * IP comes from Express's own req.ip, which already respects this app's
 * `trust proxy` setting (index.ts sets it to the literal hop count `1` in
 * production, not `true`/unbounded) — never read directly from a raw
 * X-Forwarded-For header, which a client can freely set. If this app were
 * ever deployed without exactly one trusted reverse proxy in front of it
 * (or with Node's port directly reachable from outside Nginx), `req.ip`
 * would no longer be trustworthy and this entire per-IP scheme — this lock
 * and the global throttle below — would need re-evaluating; that is an
 * infrastructure precondition, not something this file can enforce.
 *
 * On top of the per-(account, IP) lock, a second, account-wide signal (see
 * lib/lockout.ts's beginGlobalAttempt) adds a capped, self-decaying DELAY
 * once enough attempts pile up against the admin account from ANY
 * combination of IPs — closing the distributed-brute-force gap the per-IP
 * lock alone leaves open, without reintroducing a global hard lock an
 * anonymous caller could trigger. That reservation is made in a single
 * synchronous call specifically so concurrent requests can't race each
 * other past it — see lockout.ts for the full trade-off and race writeup.
 */
function clientIp(req: Request): string {
  return req.ip ?? 'unknown'
}

/** One global key for the one admin account — not derived from client input. */
const GLOBAL_THROTTLE_KEY = 'admin:global'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/* ── POST /api/auth/admin/login ─────────────────────────────────────── */
router.post(
  '/admin/login',
  authLimiter,
  body(adminLoginSchema),
  async (req: Request, res: Response) => {
    const { email, password } = req.body as z.infer<typeof adminLoginSchema>
    const normalizedEmail = email.trim().toLowerCase()
    const ip      = clientIp(req)
    const acctKey = `admin:${normalizedEmail}:${ip}`

    // 1. Lockout check
    const { locked, retryAfterMs } = isLocked(acctKey)
    if (locked) {
      const minutes = Math.ceil((retryAfterMs ?? 0) / 60_000)
      audit(A.ACCOUNT_LOCKED, { userId: 'admin-1', req })
      return res.status(423).json({
        error: `Account temporarily locked. Try again in ${minutes} minute(s).`,
        retryAfterMs,
      })
    }

    const recordAttemptFailure = () => recordFailure(acctKey)

    // 2. Account-wide progressive delay. beginGlobalAttempt() atomically
    // reserves this attempt's slot and returns the delay it owes, in one
    // synchronous call with no `await` inside — required so two requests
    // arriving close together (an attacker firing several in parallel,
    // not one-at-a-time) can't both read the same stale, pre-increment
    // count before either has recorded theirs. See lib/lockout.ts for the
    // full race explanation. Capped and self-decaying — never an outright
    // denial.
    const throttleDelay = beginGlobalAttempt(GLOBAL_THROTTLE_KEY)
    if (throttleDelay > 0) await sleep(throttleDelay)

    // 3. Email check (constant-time via bcrypt compare later prevents timing oracle)
    const expectedEmail = (process.env.ADMIN_EMAIL ?? 'admin@atscorps.com').trim().toLowerCase()
    if (normalizedEmail !== expectedEmail) {
      const { lockedNow, attemptsLeft } = recordAttemptFailure()
      audit(A.LOGIN_FAILED, { req, metadata: { reason: 'wrong_email' } })
      if (lockedNow) {
        return res.status(423).json({ error: 'Account temporarily locked after too many failed attempts.' })
      }
      return res.status(401).json({ error: 'Invalid credentials', attemptsLeft })
    }

    // 4. Password check
    try {
      const hash  = await getAdminHash()
      const valid = await bcrypt.compare(password, hash)

      if (!valid) {
        const { lockedNow, attemptsLeft } = recordAttemptFailure()
        audit(A.LOGIN_FAILED, { userId: 'admin-1', req, metadata: { reason: 'wrong_password' } })
        if (lockedNow) {
          audit(A.ACCOUNT_LOCKED, { userId: 'admin-1', req })
          return res.status(423).json({ error: 'Account temporarily locked after too many failed attempts.' })
        }
        return res.status(401).json({ error: 'Invalid credentials', attemptsLeft })
      }

      // 5. Success — clear this (account, IP) pair's lockout state AND the
      // account-wide throttle. A genuine admin login is conclusive proof
      // the account is back under its owner's control; there is no reason
      // to keep slowing down the next login after that.
      recordSuccess(acctKey)
      clearGlobalThrottle(GLOBAL_THROTTLE_KEY)
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
    // rotateRefreshToken only ever throws its own deliberately-worded,
    // pre-authentication errors (each carrying an explicit `.status`) — a
    // genuine DB/driver failure has no `.status` and must never be echoed
    // back verbatim here.
    const status: number = (e as any).status
    if (!status) {
      console.error('[auth/refresh]', e)
      return res.status(401).json({ error: 'Session expired' })
    }
    const isReuse = /reuse/i.test(e.message ?? '')
    if (isReuse) audit(A.TOKEN_REUSE_DETECTED, { req })
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

// The /dev-bypass route used to live here, reachable in every environment
// behind only a runtime check. It now lives in ./devBypass.ts, registered
// in index.ts ONLY when NODE_ENV !== 'production' — see that file for why.

export default router
