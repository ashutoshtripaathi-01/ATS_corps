import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { pool } from '../db'
import { signAccessToken, issueRefreshToken } from '../lib/tokens'
import { requireAuth } from '../middleware/auth'
import { body, email, mobile as mobileSchema, gst, pan, pincode } from '../lib/validate'
import { audit, A } from '../lib/audit'

const router = Router()

/* ── Request schemas ─────────────────────────────────────────────────── */
const registerSchema = z.object({
  companyName: z.string().min(2, 'Company name is required'),
  gst:         gst,
  pan:         pan,
  email:       email,
  mobile:      mobileSchema.optional(),
  state:       z.string().min(2, 'State is required'),
  district:    z.string().min(2, 'District is required'),
  address:     z.string().min(5, 'Address is required'),
  pincode:     pincode,
})

/* ── POST /register ─────────────────────────────────────────────────── */
router.post('/register', body(registerSchema), async (req: Request, res: Response) => {
  const { companyName, gst: gstNo, pan: panNo, email: emailAddr, mobile, state, district, address, pincode: pin } =
    req.body as z.infer<typeof registerSchema>

  try {
    const result = await pool.query(
      `INSERT INTO employers (company_name, gst, pan, email, mobile, state, district, address, pincode)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (gst) DO UPDATE SET
         company_name = EXCLUDED.company_name,
         pan          = EXCLUDED.pan,
         email        = EXCLUDED.email,
         mobile       = EXCLUDED.mobile,
         state        = EXCLUDED.state,
         district     = EXCLUDED.district,
         address      = EXCLUDED.address,
         pincode      = EXCLUDED.pincode,
         updated_at   = NOW()
       RETURNING *`,
      [companyName, gstNo, panNo, emailAddr, mobile ?? null, state, district, address, pin],
    )

    const emp         = result.rows[0]
    const accessToken = signAccessToken({ id: String(emp.id), role: 'employer' })
    await issueRefreshToken(res, String(emp.id), 'employer')
    audit(A.EMPLOYER_REGISTERED, { userId: String(emp.id), req, metadata: { gst: gstNo } })

    return res.status(201).json({ success: true, employer: emp, accessToken })
  } catch (e: any) {
    if (e.code === '23505') return res.status(409).json({ error: 'A company with this email is already registered' })
    console.error('[Employer register]', e)
    return res.status(500).json({ error: 'Registration failed', detail: e.message })
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
    return res.status(500).json({ error: e.message })
  }
})

/* ── GET /:id ── (employer-owner or admin) ──────────────────────────── */
router.get('/:id', requireAuth('employer', 'admin'), async (req: Request, res: Response) => {
  const auth = req.auth!
  if (auth.role === 'employer' && auth.id !== req.params.id)
    return res.status(403).json({ error: 'Access denied' })

  const result = await pool.query('SELECT * FROM employers WHERE id=$1', [req.params.id])
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' })
  return res.json(result.rows[0])
})

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
    return res.status(500).json({ error: e.message })
  }
})

export default router
