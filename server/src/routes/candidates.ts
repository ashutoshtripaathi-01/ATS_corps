import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { pool } from '../db'
import { signAccessToken, issueRefreshToken } from '../lib/tokens'
import { requireAuth } from '../middleware/auth'
import { body, mobile as mobileSchema, otp as otpSchema } from '../lib/validate'
import { audit, A } from '../lib/audit'
import { verifySignature } from '../lib/razorpay'
import { isSmsEnabled, sendOtpSms } from '../lib/msg91'
import { env } from '../lib/env'

const router = Router()

/* ── Allowed file types ─────────────────────────────────────────────── */
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/jpg',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx'])

// Reject any upload with these extensions regardless of MIME type
const BLOCKED_EXT = new Set([
  '.exe', '.bat', '.sh', '.cmd', '.com', '.msi', '.dll',
  '.js', '.ts', '.php', '.py', '.rb', '.pl', '.ps1', '.vbs',
  '.wsf', '.jar', '.class', '.scr', '.pif', '.htaccess',
])

/* ── Multer storage ─────────────────────────────────────────────────── */
const uploadDir = path.join(__dirname, '../../../uploads/candidates')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    // Use only the extension from the original name — never the name itself
    const rawExt = path.extname(file.originalname).toLowerCase()
    const safeExt = ALLOWED_EXT.has(rawExt) ? rawExt : '.bin'
    cb(null, `${crypto.randomUUID()}${safeExt}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()

    if (BLOCKED_EXT.has(ext)) {
      return cb(new Error(`File type "${ext}" is not permitted`))
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error(`MIME type "${file.mimetype}" is not permitted`))
    }
    if (!ALLOWED_EXT.has(ext)) {
      return cb(new Error(`File extension "${ext}" is not permitted`))
    }
    cb(null, true)
  },
})

/* ── OTP rate limiter: 5 per 15 min per IP ──────────────────────────── */
const otpLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             5,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many OTP requests. Please try again in 15 minutes.' },
})

/* ── GET /get-user ──────────────────────────────────────────────────── */
// MSG91 widget calls this before sending OTP to check if the user exists.
// Identifier arrives with country code prefix (e.g. "919876543210") — strip it.
router.get('/get-user', async (req: Request, res: Response) => {
  const raw = String(req.query.identifier ?? '')
  const mobile = raw.replace(/\D/g, '').slice(-10)
  if (mobile.length !== 10) return res.status(400).json({ message: 'invalid identifier' })

  const result = await pool.query('SELECT id FROM candidates WHERE mobile=$1', [mobile])
  return res.json({
    user_found: result.rows.length > 0,
    identifier: raw,
  })
})

/* ── POST /widget-login ─────────────────────────────────────────────── */
// Called by the frontend after MSG91 widget confirms OTP is verified.
// We trust the widget's verified callback and issue our own JWT.
router.post('/widget-login', async (req: Request, res: Response) => {
  const parse = z.object({ mobile: mobileSchema }).safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: 'Invalid mobile number' })

  const { mobile } = parse.data
  const cand = await pool.query('SELECT * FROM candidates WHERE mobile=$1', [mobile])

  if (cand.rows.length > 0) {
    const c = cand.rows[0]
    const accessToken = signAccessToken({ id: String(c.id), role: 'candidate' })
    await issueRefreshToken(res, String(c.id), 'candidate')
    audit(A.LOGIN_SUCCESS, { userId: String(c.id), req, metadata: { via: 'msg91-widget' } })
    return res.json({ success: true, exists: true, candidate: c, accessToken })
  }

  return res.json({ success: true, exists: false })
})

/* ── Request schemas ─────────────────────────────────────────────────── */
const sendOtpSchema   = z.object({ mobile: mobileSchema })
const verifyOtpSchema = z.object({ mobile: mobileSchema, otp: otpSchema })

/* ── POST /send-otp ─────────────────────────────────────────────────── */
router.post('/send-otp', otpLimiter, body(sendOtpSchema), async (req: Request, res: Response) => {
  const { mobile } = req.body as z.infer<typeof sendOtpSchema>
  // Cryptographically-secure 6-digit code (100000–999999).
  const otp     = String(crypto.randomInt(100_000, 1_000_000))
  const expires = new Date(Date.now() + 10 * 60 * 1000)

  await pool.query(
    'INSERT INTO otps (mobile, otp_code, expires_at) VALUES ($1,$2,$3)',
    [mobile, otp, expires],
  )

  // Deliver via MSG91 when configured; otherwise fall back to demo mode.
  if (isSmsEnabled()) {
    try {
      await sendOtpSms(mobile, otp)
    } catch (e: any) {
      console.error('[OTP] MSG91 send failed:', e.message)
      return res.status(502).json({ error: 'Could not send OTP. Please try again.' })
    }
    return res.json({ success: true })
  }

  // Dev/demo fallback — never leak the OTP once SMS is live.
  console.log(`[OTP] ${mobile} → ${otp} (SMS disabled — demo mode)`)
  return res.json({ success: true, demo_otp: otp })
})

/* ── POST /verify-otp ───────────────────────────────────────────────── */
router.post('/verify-otp', otpLimiter, body(verifyOtpSchema), async (req: Request, res: Response) => {
  const { mobile, otp } = req.body as z.infer<typeof verifyOtpSchema>

  const row = await pool.query(
    `SELECT * FROM otps
     WHERE mobile=$1 AND otp_code=$2 AND used=FALSE AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [mobile, otp],
  )

  if (row.rows.length === 0)
    return res.status(400).json({ error: 'Invalid or expired OTP' })

  await pool.query('UPDATE otps SET used=TRUE WHERE id=$1', [row.rows[0].id])

  const cand = await pool.query('SELECT * FROM candidates WHERE mobile=$1', [mobile])
  if (cand.rows.length > 0) {
    const c           = cand.rows[0]
    const accessToken = signAccessToken({ id: String(c.id), role: 'candidate' })
    await issueRefreshToken(res, String(c.id), 'candidate')
    audit(A.LOGIN_SUCCESS, { userId: String(c.id), req, metadata: { via: 'otp' } })
    return res.json({ success: true, exists: true, candidate: c, accessToken })
  }

  return res.json({ success: true, exists: false })
})

/* ── POST /register ─────────────────────────────────────────────────── */
const uploadFields = upload.fields([
  { name: 'idCard',             maxCount: 1 },
  { name: 'dischargeBook',      maxCount: 1 },
  { name: 'policeVerification', maxCount: 1 },
])

router.post('/register', (req: Request, res: Response) => {
  uploadFields(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File too large — maximum 10 MB' : err.message
      return res.status(400).json({ error: msg })
    }
    if (err) return res.status(400).json({ error: (err as Error).message })

    try {
      const {
        mobile, force, rank, fullName, unit, retirementDate,
        post, otherPost, gunLicense, loc1, loc2, loc3, applicationFee,
        razorpay_order_id, razorpay_payment_id, razorpay_signature,
        devBypass,
      } = req.body as Record<string, string>

      if (!mobile || !force || !rank || !fullName || !unit || !retirementDate || !post || !loc1)
        return res.status(400).json({ error: 'Required fields missing' })

      // Mobile format validation
      if (!/^[6-9]\d{9}$/.test(mobile))
        return res.status(400).json({ error: 'Invalid mobile number' })

      // ── Payment verification ─────────────────────────────────────────
      const { DEV_BYPASS, NODE_ENV, RAZORPAY_KEY_SECRET } = env()
      let paymentStatus: string

      if (razorpay_order_id && razorpay_payment_id && razorpay_signature) {
        // Real Razorpay payment — verify HMAC signature
        if (!RAZORPAY_KEY_SECRET) {
          return res.status(503).json({ error: 'Payment service not configured on server' })
        }
        if (!verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
          return res.status(400).json({ error: 'Payment verification failed — invalid signature' })
        }
        paymentStatus = 'paid'
      } else if (devBypass === 'true' && DEV_BYPASS === 'true' && NODE_ENV !== 'production') {
        paymentStatus = 'dev_bypass'
      } else {
        return res.status(402).json({ error: 'Payment required' })
      }

      const files             = req.files as Record<string, Express.Multer.File[]>
      const idCardPath        = files?.idCard?.[0]?.filename             ?? null
      const dischargeBookPath = files?.dischargeBook?.[0]?.filename      ?? null
      const policeVerifPath   = files?.policeVerification?.[0]?.filename ?? null

      const result = await pool.query(
        `INSERT INTO candidates (
           full_name, mobile, force, rank, unit, retirement_date,
           post, other_post, gun_license, loc1, loc2, loc3,
           application_fee, payment_status,
           id_card_path, discharge_book_path, police_verification_path
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         ON CONFLICT (mobile) DO UPDATE SET
           full_name                = EXCLUDED.full_name,
           force                    = EXCLUDED.force,
           rank                     = EXCLUDED.rank,
           unit                     = EXCLUDED.unit,
           retirement_date          = EXCLUDED.retirement_date,
           post                     = EXCLUDED.post,
           other_post               = EXCLUDED.other_post,
           gun_license              = EXCLUDED.gun_license,
           loc1                     = EXCLUDED.loc1,
           loc2                     = EXCLUDED.loc2,
           loc3                     = EXCLUDED.loc3,
           application_fee          = EXCLUDED.application_fee,
           payment_status           = EXCLUDED.payment_status,
           id_card_path             = COALESCE(EXCLUDED.id_card_path, candidates.id_card_path),
           discharge_book_path      = COALESCE(EXCLUDED.discharge_book_path, candidates.discharge_book_path),
           police_verification_path = COALESCE(EXCLUDED.police_verification_path, candidates.police_verification_path),
           updated_at               = NOW()
         RETURNING *`,
        [
          fullName, mobile, force, rank, unit, retirementDate,
          post, otherPost || null, gunLicense || null,
          loc1, loc2 || null, loc3 || null,
          applicationFee ? Number(applicationFee) : 0, paymentStatus,
          idCardPath, dischargeBookPath, policeVerifPath,
        ],
      )

      const c           = result.rows[0]
      const accessToken = signAccessToken({ id: String(c.id), role: 'candidate' })
      await issueRefreshToken(res, String(c.id), 'candidate')
      audit(A.CANDIDATE_REGISTERED, { userId: String(c.id), req, metadata: { mobile } })

      return res.status(201).json({ success: true, candidate: c, accessToken })
    } catch (e: any) {
      console.error('[Register]', e)
      return res.status(500).json({ error: 'Registration failed', detail: e.message })
    }
  })
})

/* ── GET /admin/stats ── (admin only) ───────────────────────────────── */
router.get('/admin/stats', requireAuth('admin'), async (_req: Request, res: Response) => {
  try {
    const [total, byForce, recent, companies, jobs] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM candidates'),
      pool.query('SELECT force, COUNT(*) AS count FROM candidates GROUP BY force ORDER BY count DESC'),
      pool.query('SELECT * FROM candidates ORDER BY created_at DESC LIMIT 5'),
      pool.query('SELECT COUNT(*) FROM employers'),
      pool.query('SELECT COUNT(*) FROM jobs'),
    ])
    return res.json({
      totalCandidates:  Number(total.rows[0].count),
      totalCompanies:   Number(companies.rows[0].count),
      totalJobs:        Number(jobs.rows[0].count),
      byForce:          byForce.rows,
      recentCandidates: recent.rows,
    })
  } catch (e: any) {
    return res.status(500).json({ error: e.message })
  }
})

/* ── GET /admin/all ── (admin only) ─────────────────────────────────── */
router.get('/admin/all', requireAuth('admin'), async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM candidates ORDER BY created_at DESC')
    return res.json(result.rows)
  } catch (e: any) {
    return res.status(500).json({ error: e.message })
  }
})

/* ── GET /:id ── (owner or admin) ───────────────────────────────────── */
router.get('/:id', requireAuth('candidate', 'admin'), async (req: Request, res: Response) => {
  const auth = req.auth!
  if (auth.role === 'candidate' && auth.id !== req.params.id)
    return res.status(403).json({ error: 'Access denied' })

  const result = await pool.query('SELECT * FROM candidates WHERE id=$1', [req.params.id])
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' })
  return res.json(result.rows[0])
})

export default router
