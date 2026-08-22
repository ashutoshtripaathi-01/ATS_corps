import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { pool } from '../db'
import { signAccessToken, issueRefreshToken } from '../lib/tokens'
import { requireAuth } from '../middleware/auth'
import { body, mobile as mobileSchema } from '../lib/validate'
import { audit, A } from '../lib/audit'
import { verifySignature } from '../lib/razorpay'
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

/* ── Auth rate limiter: 10 per 15 min per IP ────────────────────────── */
const authLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
})

const emailPasswordSchema = z.object({
  email:    z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

/* ── POST /create-account ───────────────────────────────────────────── */
router.post('/create-account', authLimiter, body(emailPasswordSchema), async (req: Request, res: Response) => {
  const { email, password } = req.body as z.infer<typeof emailPasswordSchema>
  const normalEmail = email.toLowerCase()

  const existing = await pool.query('SELECT id FROM candidates WHERE email=$1', [normalEmail])
  if (existing.rows.length > 0)
    return res.status(409).json({ error: 'An account with this email already exists' })

  const passwordHash = await bcrypt.hash(password, 12)
  const result = await pool.query(
    'INSERT INTO candidates (email, password_hash) VALUES ($1,$2) RETURNING *',
    [normalEmail, passwordHash],
  )

  const c           = result.rows[0]
  const accessToken = signAccessToken({ id: String(c.id), role: 'candidate' })
  await issueRefreshToken(res, String(c.id), 'candidate')
  audit(A.CANDIDATE_REGISTERED, { userId: String(c.id), req, metadata: { email: normalEmail } })

  return res.status(201).json({ success: true, candidate: c, accessToken })
})

/* ── POST /login ────────────────────────────────────────────────────── */
router.post('/login', authLimiter, body(emailPasswordSchema), async (req: Request, res: Response) => {
  const { email, password } = req.body as z.infer<typeof emailPasswordSchema>
  const normalEmail = email.toLowerCase()

  const result = await pool.query('SELECT * FROM candidates WHERE email=$1', [normalEmail])
  if (result.rows.length === 0 || !result.rows[0].password_hash)
    return res.status(401).json({ error: 'Invalid email or password' })

  const c     = result.rows[0]
  const valid = await bcrypt.compare(password, c.password_hash)
  if (!valid)
    return res.status(401).json({ error: 'Invalid email or password' })

  const accessToken = signAccessToken({ id: String(c.id), role: 'candidate' })
  await issueRefreshToken(res, String(c.id), 'candidate')
  audit(A.LOGIN_SUCCESS, { userId: String(c.id), req, metadata: { via: 'email-password' } })

  return res.json({ success: true, candidate: c, accessToken })
})

/* ── POST /save-profile ─────────────────────────────────────────────── */
const uploadFields = upload.fields([
  { name: 'idCard',             maxCount: 1 },
  { name: 'dischargeBook',      maxCount: 1 },
  { name: 'policeVerification', maxCount: 1 },
])

router.post('/save-profile', requireAuth('candidate'), (req: Request, res: Response) => {
  uploadFields(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File too large — maximum 10 MB' : err.message
      return res.status(400).json({ error: msg })
    }
    if (err) return res.status(400).json({ error: (err as Error).message })

    try {
      const candidateId = req.auth!.id
      const {
        mobile, force, rank, fullName, unit, retirementDate,
        post, otherPost, gunLicense, loc1, loc2, loc3, applicationFee,
      } = req.body as Record<string, string>

      if (!mobile || !force || !rank || !fullName || !unit || !retirementDate || !post || !loc1)
        return res.status(400).json({ error: 'Required fields missing' })
      if (!/^[6-9]\d{9}$/.test(mobile))
        return res.status(400).json({ error: 'Invalid mobile number' })

      // Check for mobile conflict with another candidate
      const conflict = await pool.query(
        'SELECT id FROM candidates WHERE mobile=$1 AND id!=$2',
        [mobile, candidateId],
      )
      if (conflict.rows.length > 0)
        return res.status(409).json({ error: 'This mobile number is already registered with another account' })

      const files             = req.files as Record<string, Express.Multer.File[]>
      const idCardPath        = files?.idCard?.[0]?.filename             ?? null
      const dischargeBookPath = files?.dischargeBook?.[0]?.filename      ?? null
      const policeVerifPath   = files?.policeVerification?.[0]?.filename ?? null

      await pool.query(
        `UPDATE candidates SET
           full_name                = $1,
           mobile                   = $2,
           force                    = $3,
           rank                     = $4,
           unit                     = $5,
           retirement_date          = $6,
           post                     = $7,
           other_post               = $8,
           gun_license              = $9,
           loc1                     = $10,
           loc2                     = $11,
           loc3                     = $12,
           application_fee          = $13,
           id_card_path             = COALESCE($14, id_card_path),
           discharge_book_path      = COALESCE($15, discharge_book_path),
           police_verification_path = COALESCE($16, police_verification_path),
           updated_at               = NOW()
         WHERE id = $17`,
        [
          fullName, mobile, force, rank, unit, retirementDate,
          post, otherPost || null, gunLicense || null,
          loc1, loc2 || null, loc3 || null,
          applicationFee ? Number(applicationFee) : 0,
          idCardPath, dischargeBookPath, policeVerifPath,
          candidateId,
        ],
      )

      return res.json({ success: true, candidateId: Number(candidateId) })
    } catch (e: any) {
      if (e.code === '23505')
        return res.status(409).json({ error: 'Mobile number already registered' })
      console.error('[save-profile]', e)
      return res.status(500).json({ error: 'Failed to save profile', detail: e.message })
    }
  })
})

/* ── POST /register ─────────────────────────────────────────────────── */
const uploadFieldsLegacy = upload.fields([
  { name: 'idCard',             maxCount: 1 },
  { name: 'dischargeBook',      maxCount: 1 },
  { name: 'policeVerification', maxCount: 1 },
])

router.post('/register', requireAuth('candidate'), (req: Request, res: Response) => {
  uploadFieldsLegacy(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File too large — maximum 10 MB' : err.message
      return res.status(400).json({ error: msg })
    }
    if (err) return res.status(400).json({ error: (err as Error).message })

    try {
      const candidateId = req.auth!.id

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
        `UPDATE candidates SET
           full_name                = $1,
           mobile                   = $2,
           force                    = $3,
           rank                     = $4,
           unit                     = $5,
           retirement_date          = $6,
           post                     = $7,
           other_post               = $8,
           gun_license              = $9,
           loc1                     = $10,
           loc2                     = $11,
           loc3                     = $12,
           application_fee          = $13,
           payment_status           = $14,
           registration_status      = CASE WHEN $14 = 'paid' THEN 'active' ELSE registration_status END,
           id_card_path             = COALESCE($15, id_card_path),
           discharge_book_path      = COALESCE($16, discharge_book_path),
           police_verification_path = COALESCE($17, police_verification_path),
           updated_at               = NOW()
         WHERE id = $18
         RETURNING *`,
        [
          fullName, mobile, force, rank, unit, retirementDate,
          post, otherPost || null, gunLicense || null,
          loc1, loc2 || null, loc3 || null,
          applicationFee ? Number(applicationFee) : 0, paymentStatus,
          idCardPath, dischargeBookPath, policeVerifPath,
          candidateId,
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
    const [total, byForce, recent, companies, jobs, pendingPayment, paid] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM candidates'),
      pool.query(`SELECT force, COUNT(*) AS count FROM candidates
                  WHERE force IS NOT NULL GROUP BY force ORDER BY count DESC`),
      pool.query(`SELECT * FROM candidates WHERE full_name IS NOT NULL
                  ORDER BY created_at DESC LIMIT 5`),
      pool.query('SELECT COUNT(*) FROM employers'),
      pool.query('SELECT COUNT(*) FROM jobs'),
      pool.query(`SELECT COUNT(*) FROM candidates
                  WHERE payment_status = 'pending' AND full_name IS NOT NULL`),
      pool.query(`SELECT COUNT(*) FROM candidates WHERE payment_status = 'paid'`),
    ])
    return res.json({
      totalCandidates:  Number(total.rows[0].count),
      totalCompanies:   Number(companies.rows[0].count),
      totalJobs:        Number(jobs.rows[0].count),
      pendingPayment:   Number(pendingPayment.rows[0].count),
      paidCandidates:   Number(paid.rows[0].count),
      byForce:          byForce.rows,
      recentCandidates: recent.rows,
    })
  } catch (e: any) {
    return res.status(500).json({ error: e.message })
  }
})

/* ── GET /admin/registrations ── (admin only) ───────────────────────── */
router.get('/admin/registrations', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const {
      search = '', status = '', page = '1', limit = '20',
    } = req.query as Record<string, string>
    const pageNum  = Math.max(1, parseInt(page) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20))
    const offset   = (pageNum - 1) * limitNum

    const conds:  string[] = []
    const params: any[]    = []
    let   pi               = 1

    if (search) {
      conds.push(`(c.full_name ILIKE $${pi} OR c.email ILIKE $${pi} OR c.mobile ILIKE $${pi} OR c.force ILIKE $${pi})`)
      params.push(`%${search}%`)
      pi++
    }

    if (status === 'pending') conds.push(`c.payment_status = 'pending' AND c.full_name IS NOT NULL`)
    if (status === 'paid')    conds.push(`c.payment_status = 'paid'`)

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''

    const [rows, countRow] = await Promise.all([
      pool.query(
        `SELECT c.id, c.email, c.full_name, c.mobile, c.force, c.rank, c.post,
                c.loc1, c.application_fee, c.payment_status, c.registration_status,
                c.created_at,
                pa.razorpay_order_id, pa.razorpay_payment_id, pa.paid_at
         FROM candidates c
         LEFT JOIN payment_attempts pa ON pa.candidate_id = c.id AND pa.status = 'paid'
         ${where}
         ORDER BY c.created_at DESC
         LIMIT $${pi} OFFSET $${pi + 1}`,
        [...params, limitNum, offset],
      ),
      pool.query(`SELECT COUNT(*) FROM candidates c ${where}`, params),
    ])

    return res.json({
      registrations: rows.rows,
      total:  Number(countRow.rows[0].count),
      page:   pageNum,
      limit:  limitNum,
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
