import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { pool } from '../db'
import { requireAuth } from '../middleware/auth'
import { body } from '../lib/validate'
import { logActivity, setApplicationStatus, touchActivity, E } from '../lib/activity'
import { S, isStatus, nextStatuses, PAID_STATUSES } from '../lib/applicationStatus'

const router = Router()

// Every route in this file is admin-only.
router.use(requireAuth('admin'))

/* ── Filter keys → lifecycle statuses ───────────────────────────────── */
const FILTERS: Record<string, string[]> = {
  new:                 [S.REGISTERED, S.APPLICATION_STARTED],
  payment_pending:     [S.PAYMENT_PENDING],
  payment_failed:      [S.PAYMENT_FAILED, S.PAYMENT_CANCELLED],
  payment_successful:  [S.PAYMENT_SUCCESSFUL, S.DOCUMENTS_PENDING],
  documents_pending:   [S.DOCUMENTS_PENDING],
  documents_submitted: [S.DOCUMENTS_SUBMITTED],
  documents_review:    [S.DOCUMENTS_SUBMITTED, S.DOCUMENTS_UNDER_REVIEW],
  documents_rejected:  [S.DOCUMENTS_REJECTED],
  documents_verified:  [S.DOCUMENTS_VERIFIED],
  office_visit:        [S.OFFICE_VISIT_PENDING, S.PHYSICAL_VERIFICATION],
  completed:           [S.COMPLETED],
  on_hold:             [S.APPLICATION_ON_HOLD],
  cancelled:           [S.APPLICATION_CANCELLED],
}

/* ── GET /api/admin/applicants ──────────────────────────────────────── */
/* Every applicant, paid or not. Server-side search, filter and pagination. */
router.get('/applicants', async (req: Request, res: Response) => {
  try {
    const { search = '', filter = '', page = '1', limit = '20' } = req.query as Record<string, string>
    const pageNum  = Math.max(1, parseInt(page) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20))
    const offset   = (pageNum - 1) * limitNum

    const conds: string[] = []
    const params: any[]   = []
    let   pi              = 1

    if (search) {
      conds.push(`(c.full_name ILIKE $${pi} OR c.email ILIKE $${pi} OR c.mobile ILIKE $${pi}
                   OR c.registration_ref ILIKE $${pi} OR c.force ILIKE $${pi})`)
      params.push(`%${search}%`)
      pi++
    }

    if (filter && FILTERS[filter]) {
      conds.push(`c.application_status = ANY($${pi}::text[])`)
      params.push(FILTERS[filter])
      pi++
    }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''

    const [rows, countRow] = await Promise.all([
      pool.query(
        `SELECT c.id, c.email, c.full_name, c.mobile, c.force, c.rank, c.post, c.loc1,
                c.application_fee, c.payment_status, c.application_status,
                c.registration_ref, c.assigned_admin, c.created_at,
                COALESCE(c.last_activity_at, c.updated_at, c.created_at) AS last_activity_at,
                (SELECT COUNT(*) FROM candidate_documents d WHERE d.candidate_id = c.id)               AS docs_total,
                (SELECT COUNT(*) FROM candidate_documents d WHERE d.candidate_id = c.id
                   AND d.status = 'APPROVED')                                                          AS docs_approved,
                (SELECT cl.call_status FROM call_logs cl WHERE cl.candidate_id = c.id
                   ORDER BY cl.created_at DESC LIMIT 1)                                                AS last_call_status,
                (SELECT cl.next_followup_date FROM call_logs cl WHERE cl.candidate_id = c.id
                   ORDER BY cl.created_at DESC LIMIT 1)                                                AS next_followup_date
           FROM candidates c
           ${where}
          ORDER BY COALESCE(c.last_activity_at, c.updated_at, c.created_at) DESC
          LIMIT $${pi} OFFSET $${pi + 1}`,
        [...params, limitNum, offset],
      ),
      pool.query(`SELECT COUNT(*) FROM candidates c ${where}`, params),
    ])

    return res.json({
      applicants: rows.rows,
      total: Number(countRow.rows[0].count),
      page:  pageNum,
      limit: limitNum,
    })
  } catch (e: any) {
    console.error('[admin/applicants]', e)
    return res.status(500).json({ error: 'Failed to load applicants' })
  }
})

/* ── GET /api/admin/metrics ─────────────────────────────────────────── */
router.get('/metrics', async (_req: Request, res: Response) => {
  try {
    const [byStatus, totals, today, followups] = await Promise.all([
      pool.query('SELECT application_status AS status, COUNT(*) FROM candidates GROUP BY 1'),
      pool.query('SELECT COUNT(*) AS total FROM candidates'),
      pool.query(
        `SELECT
           (SELECT COUNT(*) FROM candidates      WHERE created_at::date = CURRENT_DATE) AS registrations_today,
           (SELECT COUNT(*) FROM payment_attempts WHERE status = 'paid'
              AND paid_at::date = CURRENT_DATE)                                          AS payments_today`,
      ),
      pool.query(
        `SELECT COUNT(DISTINCT candidate_id) FROM call_logs
          WHERE next_followup_date IS NOT NULL AND next_followup_date <= CURRENT_DATE`,
      ),
    ])

    const counts: Record<string, number> = {}
    for (const r of byStatus.rows) counts[r.status ?? 'UNKNOWN'] = Number(r.count)
    const sum = (...keys: string[]) => keys.reduce((n, k) => n + (counts[k] ?? 0), 0)

    return res.json({
      totalApplications:   Number(totals.rows[0].total),
      paymentPending:      sum(S.PAYMENT_PENDING, S.PAYMENT_FAILED, S.PAYMENT_CANCELLED),
      paymentSuccessful:   PAID_STATUSES.reduce((n, k) => n + (counts[k] ?? 0), 0),
      documentsPending:    sum(S.DOCUMENTS_PENDING),
      documentsUnderReview: sum(S.DOCUMENTS_SUBMITTED, S.DOCUMENTS_UNDER_REVIEW),
      documentsRejected:   sum(S.DOCUMENTS_REJECTED),
      documentsVerified:   sum(S.DOCUMENTS_VERIFIED),
      officeVisitsPending: sum(S.OFFICE_VISIT_PENDING, S.PHYSICAL_VERIFICATION),
      completed:           sum(S.COMPLETED),
      onHold:              sum(S.APPLICATION_ON_HOLD),
      registrationsToday:  Number(today.rows[0].registrations_today),
      paymentsToday:       Number(today.rows[0].payments_today),
      pendingFollowUps:    Number(followups.rows[0].count),
      byStatus:            counts,
    })
  } catch (e: any) {
    console.error('[admin/metrics]', e)
    return res.status(500).json({ error: 'Failed to load metrics' })
  }
})

/* ── GET /api/admin/applicants/:id ── full applicant dossier ────────── */
router.get('/applicants/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' })

  try {
    const [cand, docs, calls, notes, events, visits, payments] = await Promise.all([
      pool.query(
        `SELECT id, email, full_name, mobile, force, rank, unit, retirement_date,
                post, other_post, gun_license, loc1, loc2, loc3,
                application_fee, payment_status, registration_status, application_status,
                registration_ref, assigned_admin, created_at, updated_at, last_activity_at
           FROM candidates WHERE id = $1`, [id]),
      pool.query(
        `SELECT id, doc_type, original_name, status, rejection_reason,
                reviewed_by, reviewed_at, uploaded_at
           FROM candidate_documents WHERE candidate_id = $1 ORDER BY doc_type`, [id]),
      pool.query(
        `SELECT id, call_status, notes, next_followup_date, admin_id, created_at
           FROM call_logs WHERE candidate_id = $1 ORDER BY created_at DESC`, [id]),
      pool.query(
        `SELECT id, note, admin_id, created_at
           FROM admin_notes WHERE candidate_id = $1 ORDER BY created_at DESC`, [id]),
      pool.query(
        `SELECT id, event_type, description, actor_type, actor_id, created_at
           FROM activity_events WHERE candidate_id = $1
          ORDER BY created_at DESC LIMIT 100`, [id]),
      pool.query(
        `SELECT id, visit_date, visit_time, assigned_staff, status,
                physical_verification_status, notes, created_at
           FROM office_visits WHERE candidate_id = $1 ORDER BY created_at DESC`, [id]),
      pool.query(
        `SELECT razorpay_order_id, razorpay_payment_id, amount, currency, status, created_at, paid_at
           FROM payment_attempts WHERE candidate_id = $1 ORDER BY created_at DESC`, [id]),
    ])

    if (cand.rows.length === 0) return res.status(404).json({ error: 'Applicant not found' })

    return res.json({
      applicant:       cand.rows[0],
      documents:       docs.rows,
      calls:           calls.rows,
      notes:           notes.rows,
      timeline:        events.rows,
      officeVisits:    visits.rows,
      payments:        payments.rows,
      allowedStatuses: nextStatuses(cand.rows[0].application_status),
    })
  } catch (e: any) {
    console.error('[admin/applicant]', e)
    return res.status(500).json({ error: 'Failed to load applicant' })
  }
})

/* ── PATCH /api/admin/applicants/:id/status ─────────────────────────── */
const statusSchema = z.object({
  status: z.string().min(1),
  reason: z.string().max(500).optional(),
})

router.patch('/applicants/:id/status', body(statusSchema), async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const { status, reason } = req.body as z.infer<typeof statusSchema>

  if (!Number.isInteger(id))  return res.status(400).json({ error: 'Invalid id' })
  if (!isStatus(status))      return res.status(400).json({ error: `Unknown status "${status}"` })

  try {
    // Not forced — an admin must still follow a legal transition.
    const result = await setApplicationStatus(id, status, {
      actorType: 'admin', actorId: req.auth!.id,
      description: reason?.trim() || undefined,
    })

    if (!result.ok) return res.status(409).json({ error: result.reason ?? 'Transition not allowed' })

    return res.json({ success: true, from: result.from, to: result.to,
                      allowedStatuses: nextStatuses(status) })
  } catch (e: any) {
    console.error('[admin/status]', e)
    return res.status(500).json({ error: 'Failed to update applicant status' })
  }
})

/* ── POST /api/admin/applicants/:id/calls ───────────────────────────── */
const CALL_STATUSES = [
  'NOT_CALLED', 'CALLED', 'NO_ANSWER', 'INTERESTED', 'WILL_PAY_LATER',
  'NOT_INTERESTED', 'REQUESTED_CALLBACK', 'CONVERTED',
] as const

const callSchema = z.object({
  callStatus:       z.enum(CALL_STATUSES),
  notes:            z.string().max(2000).optional(),
  nextFollowupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
})

router.post('/applicants/:id/calls', body(callSchema), async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const { callStatus, notes, nextFollowupDate } = req.body as z.infer<typeof callSchema>
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' })

  try {
    const { rows } = await pool.query(
      `INSERT INTO call_logs (candidate_id, call_status, notes, next_followup_date, admin_id)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [id, callStatus, notes?.trim() || null, nextFollowupDate || null, req.auth!.id],
    )

    logActivity(id, E.ADMIN_CALL_LOGGED, {
      description: `Call logged — ${callStatus.replace(/_/g, ' ').toLowerCase()}`,
      actorType: 'admin', actorId: req.auth!.id,
      metadata: { callStatus, nextFollowupDate: nextFollowupDate || null },
    })
    touchActivity(id)

    return res.status(201).json({ success: true, call: rows[0] })
  } catch (e: any) {
    console.error('[admin/calls]', e)
    return res.status(500).json({ error: 'Failed to log call' })
  }
})

/* ── POST /api/admin/applicants/:id/notes ───────────────────────────── */
const noteSchema = z.object({ note: z.string().min(1).max(4000) })

router.post('/applicants/:id/notes', body(noteSchema), async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' })

  try {
    const { rows } = await pool.query(
      'INSERT INTO admin_notes (candidate_id, note, admin_id) VALUES ($1,$2,$3) RETURNING *',
      [id, (req.body.note as string).trim(), req.auth!.id],
    )
    logActivity(id, E.ADMIN_NOTE_ADDED, {
      description: 'Admin note added', actorType: 'admin', actorId: req.auth!.id,
    })
    touchActivity(id)
    return res.status(201).json({ success: true, note: rows[0] })
  } catch (e: any) {
    console.error('[admin/notes]', e)
    return res.status(500).json({ error: 'Failed to add note' })
  }
})

/* ── POST /api/admin/applicants/:id/office-visit ────────────────────── */
const visitSchema = z.object({
  visitDate:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  visitTime:      z.string().max(20).optional(),
  assignedStaff:  z.string().max(120).optional(),
  status:         z.enum(['SCHEDULED', 'ATTENDED', 'RESCHEDULED', 'NO_SHOW', 'COMPLETED']),
  physicalVerificationStatus: z.enum(['PENDING', 'IN_PROGRESS', 'VERIFIED', 'FAILED']).optional(),
  notes:          z.string().max(2000).optional(),
})

router.post('/applicants/:id/office-visit', body(visitSchema), async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const v  = req.body as z.infer<typeof visitSchema>
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows } = await client.query(
      `INSERT INTO office_visits
         (candidate_id, visit_date, visit_time, assigned_staff, status,
          physical_verification_status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        id, v.visitDate || null, v.visitTime || null, v.assignedStaff || null,
        v.status, v.physicalVerificationStatus || null, v.notes?.trim() || null,
      ],
    )

    // Keep the application status in step with what the visit records.
    const target =
      v.status === 'COMPLETED'                              ? S.COMPLETED
      : v.status === 'ATTENDED'                             ? S.PHYSICAL_VERIFICATION
      : ['SCHEDULED', 'RESCHEDULED', 'NO_SHOW'].includes(v.status) ? S.OFFICE_VISIT_PENDING
      : null

    if (target) {
      await setApplicationStatus(id, target, {
        client, actorType: 'admin', actorId: req.auth!.id, force: true,
        description: `Office visit ${v.status.toLowerCase().replace(/_/g, ' ')}`,
      })
    }

    logActivity(id, v.status === 'SCHEDULED' ? E.OFFICE_VISIT_SCHEDULED : E.OFFICE_VISIT_UPDATED, {
      description: `Office visit ${v.status.toLowerCase().replace(/_/g, ' ')}`
                   + (v.visitDate ? ` for ${v.visitDate}` : ''),
      actorType: 'admin', actorId: req.auth!.id, metadata: { status: v.status }, client,
    })

    await client.query('COMMIT')
    touchActivity(id)
    return res.status(201).json({ success: true, visit: rows[0] })
  } catch (e: any) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[admin/office-visit]', e)
    return res.status(500).json({ error: 'Failed to record office visit' })
  } finally {
    client.release()
  }
})

/* ── PATCH /api/admin/applicants/:id/assign ─────────────────────────── */
router.patch('/applicants/:id/assign', async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const assignee = typeof req.body?.assignedAdmin === 'string' ? req.body.assignedAdmin.trim() : ''
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' })

  try {
    await pool.query('UPDATE candidates SET assigned_admin = $1, updated_at = NOW() WHERE id = $2',
      [assignee || null, id])
    return res.json({ success: true, assignedAdmin: assignee || null })
  } catch (e: any) {
    console.error('[admin/assign]', e)
    return res.status(500).json({ error: 'Failed to assign applicant' })
  }
})

export default router
