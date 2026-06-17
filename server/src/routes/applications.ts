import { Router, Request, Response } from 'express'
import { pool } from '../db'
import { requireAuth } from '../middleware/auth'

const router = Router()

/* ── POST / — candidate applies ── (candidate only) ─────────────────── */
router.post('/', requireAuth('candidate'), async (req: Request, res: Response) => {
  try {
    const { jobId, coverNote } = req.body
    const candidateId = req.auth!.id

    if (!jobId)
      return res.status(400).json({ error: 'jobId is required' })

    const result = await pool.query(
      `INSERT INTO applications (job_id, candidate_id, cover_note)
       VALUES ($1,$2,$3)
       ON CONFLICT (job_id, candidate_id) DO NOTHING
       RETURNING *`,
      [jobId, candidateId, coverNote || null],
    )
    if (result.rows.length === 0)
      return res.status(409).json({ error: 'You have already applied to this job' })

    return res.status(201).json({ success: true, application: result.rows[0] })
  } catch (e: any) {
    console.error('[Apply]', e)
    return res.status(500).json({ error: 'Failed to apply', detail: e.message })
  }
})

/* ── GET /candidate/:candidateId ── (owner or admin) ────────────────── */
router.get('/candidate/:candidateId', requireAuth('candidate', 'admin'), async (req: Request, res: Response) => {
  const auth = req.auth!
  if (auth.role === 'candidate' && auth.id !== req.params.candidateId)
    return res.status(403).json({ error: 'Access denied' })

  try {
    const result = await pool.query(
      `SELECT a.*, j.manpower_type, j.location, j.salary_range, j.salary_min, j.salary_max,
              j.shift, j.status AS job_status, e.company_name, e.district AS company_district
       FROM applications a
       JOIN jobs j      ON j.id = a.job_id
       LEFT JOIN employers e ON e.id = j.employer_id
       WHERE a.candidate_id = $1
       ORDER BY a.created_at DESC`,
      [req.params.candidateId],
    )
    return res.json(result.rows)
  } catch (e: any) {
    return res.status(500).json({ error: e.message })
  }
})

/* ── GET /job/:jobId ── (employer-owner or admin) ────────────────────── */
router.get('/job/:jobId', requireAuth('employer', 'admin'), async (req: Request, res: Response) => {
  try {
    const auth = req.auth!
    if (auth.role === 'employer') {
      const job = await pool.query('SELECT employer_id FROM jobs WHERE id=$1', [req.params.jobId])
      if (job.rows.length === 0) return res.status(404).json({ error: 'Job not found' })
      if (String(job.rows[0].employer_id) !== auth.id)
        return res.status(403).json({ error: 'Access denied' })
    }

    const result = await pool.query(
      `SELECT a.*, c.full_name, c.force, c.rank, c.unit, c.mobile, c.post, c.loc1
       FROM applications a
       JOIN candidates c ON c.id = a.candidate_id
       WHERE a.job_id = $1
       ORDER BY a.created_at DESC`,
      [req.params.jobId],
    )
    return res.json(result.rows)
  } catch (e: any) {
    return res.status(500).json({ error: e.message })
  }
})

/* ── GET /employer/:employerId ── (employer-owner or admin) ──────────── */
router.get('/employer/:employerId', requireAuth('employer', 'admin'), async (req: Request, res: Response) => {
  const auth = req.auth!
  if (auth.role === 'employer' && auth.id !== req.params.employerId)
    return res.status(403).json({ error: 'Access denied' })

  try {
    const result = await pool.query(
      `SELECT a.*, c.full_name, c.force, c.rank, c.mobile, c.loc1,
              j.manpower_type, j.location, j.id AS job_id
       FROM applications a
       JOIN jobs j       ON j.id = a.job_id
       JOIN candidates c ON c.id = a.candidate_id
       WHERE j.employer_id = $1
       ORDER BY a.created_at DESC`,
      [req.params.employerId],
    )
    return res.json(result.rows)
  } catch (e: any) {
    return res.status(500).json({ error: e.message })
  }
})

/* ── PATCH /:id/status ── (employer or admin) ────────────────────────── */
router.patch('/:id/status', requireAuth('employer', 'admin'), async (req: Request, res: Response) => {
  try {
    const { status } = req.body
    const allowed = ['applied', 'under-review', 'shortlisted', 'interview', 'offer', 'hired', 'rejected']
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' })

    const result = await pool.query(
      'UPDATE applications SET status=$2, updated_at=NOW() WHERE id=$1 RETURNING *',
      [req.params.id, status],
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' })
    return res.json({ success: true, application: result.rows[0] })
  } catch (e: any) {
    return res.status(500).json({ error: e.message })
  }
})

export default router
