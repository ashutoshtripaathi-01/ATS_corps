import { Router, Request, Response } from 'express'
import { pool } from '../db'
import { requireAuth } from '../middleware/auth'

const router = Router()

const SALARY_MAP: Record<string, [number, number]> = {
  '15k-20k': [15000, 20000],
  '20k-30k': [20000, 30000],
  '30k-50k': [30000, 50000],
  '50k+':    [50000, 0],
}

function refNo(id: number, location: string) {
  const code = location.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'JOB'
  const year = new Date().getFullYear()
  return `ATS-${code}-${year}-${String(id).padStart(4, '0')}`
}

/* ── POST / ── (employer only) ──────────────────────────────────────── */
router.post('/', requireAuth('employer'), async (req: Request, res: Response) => {
  try {
    const {
      manpowerType, quantity, salaryRange, location,
      shift, workSite, minRank, minService, description,
    } = req.body

    if (!manpowerType || !quantity || !salaryRange || !location || !shift || !workSite || !minRank || !minService || !description)
      return res.status(400).json({ error: 'Required fields missing' })

    const employerId              = req.auth!.id
    const [salaryMin, salaryMax]  = SALARY_MAP[salaryRange] ?? [0, 0]

    const inserted = await pool.query(
      `INSERT INTO jobs
         (employer_id, manpower_type, quantity, salary_range, salary_min, salary_max,
          location, shift, work_site, min_rank, min_service, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        employerId, manpowerType, Number(quantity), salaryRange, salaryMin, salaryMax,
        location, shift, workSite, minRank, minService, description,
      ],
    )
    const job = inserted.rows[0]

    const withRef = await pool.query(
      'UPDATE jobs SET ref_no=$2 WHERE id=$1 RETURNING *',
      [job.id, refNo(job.id as number, location as string)],
    )
    return res.status(201).json({ success: true, job: withRef.rows[0] })
  } catch (e: any) {
    console.error('[Job create]', e)
    return res.status(500).json({ error: 'Failed to post job', detail: e.message })
  }
})

/* ── GET / — public listing with optional filters ───────────────────── */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { location, manpowerType, search, status } = req.query
    const where: string[] = []
    const params: any[]   = []

    where.push(`j.status = $${params.push(status || 'active')}`)
    if (location)     where.push(`j.location = $${params.push(location)}`)
    if (manpowerType) where.push(`j.manpower_type = $${params.push(manpowerType)}`)
    if (search) {
      params.push(`%${search}%`)
      where.push(`(j.manpower_type ILIKE $${params.length} OR j.description ILIKE $${params.length} OR e.company_name ILIKE $${params.length})`)
    }

    const result = await pool.query(
      `SELECT j.*, e.company_name, e.district AS company_district, e.state AS company_state,
              COALESCE(a.app_count, 0) AS app_count
       FROM jobs j
       LEFT JOIN employers e ON e.id = j.employer_id
       LEFT JOIN (SELECT job_id, COUNT(*) AS app_count FROM applications GROUP BY job_id) a ON a.job_id = j.id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY j.created_at DESC`,
      params,
    )
    return res.json(result.rows)
  } catch (e: any) {
    return res.status(500).json({ error: e.message })
  }
})

/* ── GET /employer/:employerId ── (employer-owner or admin) ─────────── */
router.get('/employer/:employerId', requireAuth('employer', 'admin'), async (req: Request, res: Response) => {
  const auth = req.auth!
  if (auth.role === 'employer' && auth.id !== req.params.employerId)
    return res.status(403).json({ error: 'Access denied' })

  try {
    const result = await pool.query(
      `SELECT j.*, COALESCE(a.app_count, 0) AS app_count
       FROM jobs j
       LEFT JOIN (SELECT job_id, COUNT(*) AS app_count FROM applications GROUP BY job_id) a ON a.job_id = j.id
       WHERE j.employer_id = $1
       ORDER BY j.created_at DESC`,
      [req.params.employerId],
    )
    return res.json(result.rows)
  } catch (e: any) {
    return res.status(500).json({ error: e.message })
  }
})

/* ── GET /admin/all ── (admin only) ─────────────────────────────────── */
router.get('/admin/all', requireAuth('admin'), async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT j.*, e.company_name, e.district AS company_district,
              COALESCE(a.app_count, 0) AS app_count
       FROM jobs j
       LEFT JOIN employers e ON e.id = j.employer_id
       LEFT JOIN (SELECT job_id, COUNT(*) AS app_count FROM applications GROUP BY job_id) a ON a.job_id = j.id
       ORDER BY j.created_at DESC`,
    )
    return res.json(result.rows)
  } catch (e: any) {
    return res.status(500).json({ error: e.message })
  }
})

/* ── GET /:id — public ──────────────────────────────────────────────── */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT j.*, e.company_name, e.district AS company_district, e.state AS company_state, e.email AS company_email,
              COALESCE(a.app_count, 0) AS app_count
       FROM jobs j
       LEFT JOIN employers e ON e.id = j.employer_id
       LEFT JOIN (SELECT job_id, COUNT(*) AS app_count FROM applications GROUP BY job_id) a ON a.job_id = j.id
       WHERE j.id = $1`,
      [req.params.id],
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'Job not found' })
    return res.json(result.rows[0])
  } catch (e: any) {
    return res.status(500).json({ error: e.message })
  }
})

/* ── PATCH /:id/status ── (employer-owner or admin) ─────────────────── */
router.patch('/:id/status', requireAuth('employer', 'admin'), async (req: Request, res: Response) => {
  try {
    const { status } = req.body
    if (!['active', 'closed', 'draft'].includes(status))
      return res.status(400).json({ error: 'Invalid status' })

    const auth = req.auth!
    if (auth.role === 'employer') {
      const job = await pool.query('SELECT employer_id FROM jobs WHERE id=$1', [req.params.id])
      if (job.rows.length === 0) return res.status(404).json({ error: 'Not found' })
      if (String(job.rows[0].employer_id) !== auth.id)
        return res.status(403).json({ error: 'Access denied' })
    }

    const result = await pool.query(
      'UPDATE jobs SET status=$2, updated_at=NOW() WHERE id=$1 RETURNING *',
      [req.params.id, status],
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' })
    return res.json({ success: true, job: result.rows[0] })
  } catch (e: any) {
    return res.status(500).json({ error: e.message })
  }
})

/* ── DELETE /:id ── (employer-owner or admin) ───────────────────────── */
router.delete('/:id', requireAuth('employer', 'admin'), async (req: Request, res: Response) => {
  try {
    const auth = req.auth!
    if (auth.role === 'employer') {
      const job = await pool.query('SELECT employer_id FROM jobs WHERE id=$1', [req.params.id])
      if (job.rows.length === 0) return res.status(404).json({ error: 'Not found' })
      if (String(job.rows[0].employer_id) !== auth.id)
        return res.status(403).json({ error: 'Access denied' })
    }

    await pool.query('DELETE FROM jobs WHERE id=$1', [req.params.id])
    return res.json({ success: true })
  } catch (e: any) {
    return res.status(500).json({ error: e.message })
  }
})

export default router
