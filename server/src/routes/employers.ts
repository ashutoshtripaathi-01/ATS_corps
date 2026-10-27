import { Router, Request, Response } from 'express'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import { pool } from '../db'
import { signAccessToken, issueRefreshToken } from '../lib/tokens'
import { requireAuth } from '../middleware/auth'
import { ah } from '../lib/asyncRoute'
import { body, email, mobile as mobileSchema, gst, pan, pincode } from '../lib/validate'
import { audit, A } from '../lib/audit'

const router = Router()

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false })

/* ── Request schemas ─────────────────────────────────────────────────── */
const emailPasswordSchema = z.object({
  email:    email,
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

const registerSchema = z.object({
  companyName: z.string().min(2, 'Company name is required'),
  gst:         gst,
  pan:         pan,
  email:       email,
  password:    z.string().min(8).optional(),
  mobile:      mobileSchema.optional(),
  state:       z.string().min(2, 'State is required'),
  district:    z.string().min(2, 'District is required'),
  address:     z.string().min(5, 'Address is required'),
  pincode:     pincode,
})

/* ── POST /create-account ───────────────────────────────────────────── */
router.post('/create-account', authLimiter, body(emailPasswordSchema), async (req: Request, res: Response) => {
  const { email: emailAddr, password } = req.body as z.infer<typeof emailPasswordSchema>
  const normalEmail = emailAddr.toLowerCase().trim()

  try {
    const existing = await pool.query('SELECT id FROM employers WHERE email=$1', [normalEmail])
    if (existing.rows.length > 0)
      return res.status(409).json({ error: 'An employer account with this email already exists' })

    const passwordHash = await bcrypt.hash(password, 12)
    const result = await pool.query(
      `INSERT INTO employers (company_name, gst, pan, email, password_hash, state, district, address, pincode)
       VALUES ('', '', '', $1, $2, '', '', '', '')
       RETURNING *`,
      [normalEmail, passwordHash],
    )

    const emp = result.rows[0]
    const accessToken = signAccessToken({ id: String(emp.id), role: 'employer' })
    await issueRefreshToken(res, String(emp.id), 'employer')

    return res.status(201).json({ success: true, employer: emp, accessToken })
  } catch (e: any) {
    if (e.code === '23505') return res.status(409).json({ error: 'An employer account with this email already exists' })
    console.error('[Employer create-account]', e)
    return res.status(500).json({ error: 'Account creation failed' })
  }
})

/* ── POST /login ─────────────────────────────────────────────────────── */
router.post('/login', authLimiter, body(emailPasswordSchema), async (req: Request, res: Response) => {
  const { email: emailAddr, password } = req.body as z.infer<typeof emailPasswordSchema>
  const normalEmail = emailAddr.toLowerCase().trim()

  try {
    const result = await pool.query('SELECT * FROM employers WHERE email=$1', [normalEmail])
    if (result.rows.length === 0 || !result.rows[0].password_hash)
      return res.status(401).json({ error: 'Invalid email or password' })

    const emp = result.rows[0]
    const valid = await bcrypt.compare(password, emp.password_hash)
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' })

    const accessToken = signAccessToken({ id: String(emp.id), role: 'employer' })
    await issueRefreshToken(res, String(emp.id), 'employer')
    audit(A.LOGIN_SUCCESS, { userId: String(emp.id), req, metadata: { via: 'email-password', role: 'employer' } })

    return res.json({ success: true, employer: emp, accessToken })
  } catch (e: any) {
    console.error('[Employer login]', e)
    return res.status(500).json({ error: 'Login failed' })
  }
})

/* ── POST /register ─────────────────────────────────────────────────── */
/*
 * INSERT-only. This endpoint is unauthenticated by design — any new company
 * needs to be able to register without an account yet — which previously
 * made an `ON CONFLICT (gst) DO UPDATE` a full account-takeover primitive:
 * GST numbers are not secret (they're printed on invoices and listed on
 * India's public GST-verification portal), so anyone who knew an existing
 * employer's GST could silently overwrite its email and, by supplying a
 * password, its password hash too — walking away with a valid session for
 * someone else's account.
 *
 * `ON CONFLICT (gst) DO NOTHING` makes a GST collision a true no-op: zero
 * rows come back, nothing about the existing row is read or written, and
 * the request is rejected before any token is ever issued. A later
 * genuine profile edit still goes through the authenticated, ownership-
 * checked PATCH /:id below — this route only ever creates.
 */
router.post('/register', body(registerSchema), async (req: Request, res: Response) => {
  const { companyName, gst: gstNo, pan: panNo, email: emailAddr, password, mobile, state, district, address, pincode: pin } =
    req.body as z.infer<typeof registerSchema>

  try {
    const passwordHash = password ? await bcrypt.hash(password, 12) : null

    const result = await pool.query(
      `INSERT INTO employers (company_name, gst, pan, email, password_hash, mobile, state, district, address, pincode)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (gst) DO NOTHING
       RETURNING *`,
      [companyName, gstNo, panNo, emailAddr, passwordHash, mobile ?? null, state, district, address, pin],
    )

    if (result.rows.length === 0) {
      // GST already belongs to someone — existing row untouched, no session issued.
      return res.status(409).json({ error: 'This GST number is already registered' })
    }

    const emp         = result.rows[0]
    const accessToken = signAccessToken({ id: String(emp.id), role: 'employer' })
    await issueRefreshToken(res, String(emp.id), 'employer')
    audit(A.EMPLOYER_REGISTERED, { userId: String(emp.id), req, metadata: { gst: gstNo } })

    return res.status(201).json({ success: true, employer: emp, accessToken })
  } catch (e: any) {
    // The GST path above never throws 23505 any more (ON CONFLICT DO NOTHING
    // absorbs it) — a unique-constraint violation reaching here means some
    // OTHER unique column collided (currently: email). Checked by constraint
    // name rather than assumed, so an unrelated DB error is never mislabelled
    // as "already registered".
    if (e.code === '23505' && String(e.constraint ?? '').includes('email')) {
      return res.status(409).json({ error: 'A company with this email is already registered' })
    }
    console.error('[Employer register]', e)
    return res.status(500).json({ error: 'Registration failed' })
  }
})

/* ── GET /admin/all ── (admin only) ─────────────────────────────────── */
router.get('/admin/all', requireAuth('admin'), async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT e.*, COUNT(j.id) AS job_count
       FROM employers e
       LEFT JOIN jobs j ON j.employer_id = e.id
       GROUP BY e.id
       ORDER BY e.created_at DESC`,
    )
    return res.json(result.rows)
  } catch (e: any) {
    console.error('[employers/admin-all]', e)
    return res.status(500).json({ error: 'Failed to load employers' })
  }
})

/* ── GET /:id ── (employer-owner or admin) ──────────────────────────── */
router.get('/:id', requireAuth('employer', 'admin'), ah(async (req: Request, res: Response) => {
  const auth = req.auth!
  if (auth.role === 'employer' && auth.id !== req.params.id)
    return res.status(403).json({ error: 'Access denied' })

  const result = await pool.query('SELECT * FROM employers WHERE id=$1', [req.params.id])
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' })
  return res.json(result.rows[0])
}))

/* ── PATCH /:id ── (employer-owner or admin) ─────────────────────────── */
router.patch('/:id', requireAuth('employer', 'admin'), async (req: Request, res: Response) => {
  const auth = req.auth!
  if (auth.role === 'employer' && auth.id !== req.params.id)
    return res.status(403).json({ error: 'Access denied' })

  try {
    const { companyName, email: emailAddr, mobile, state, district, address, pincode: pin } =
      req.body as Partial<z.infer<typeof registerSchema>>

    const result = await pool.query(
      `UPDATE employers SET
         company_name = COALESCE($2, company_name),
         email        = COALESCE($3, email),
         mobile       = COALESCE($4, mobile),
         state        = COALESCE($5, state),
         district     = COALESCE($6, district),
         address      = COALESCE($7, address),
         pincode      = COALESCE($8, pincode),
         updated_at   = NOW()
       WHERE id=$1 RETURNING *`,
      [req.params.id, companyName, emailAddr, mobile, state, district, address, pin],
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' })
    return res.json({ success: true, employer: result.rows[0] })
  } catch (e: any) {
    if (e.code === '23505' && String(e.constraint ?? '').includes('email')) {
      return res.status(409).json({ error: 'Another account already uses this email' })
    }
    console.error('[employers/patch]', e)
    return res.status(500).json({ error: 'Failed to update employer' })
  }
})

export default router
