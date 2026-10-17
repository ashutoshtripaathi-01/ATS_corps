import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { pool } from '../db'
import { requireAuth } from '../middleware/auth'
import { query } from '../lib/validate'
import { ah } from '../lib/asyncRoute'
import { audit, A } from '../lib/audit'
import {
  reportFiltersSchema, paginationSchema, fetchCandidateRows,
  paymentLabel, paymentAmountRupees, docStatusDetail,
  documentsSubmittedText, documentsMissingText, preferredLocations,
  jobPosition, applicationIdLabel, type ReportFilters,
} from '../lib/reports'
import { STATUS_LABEL } from '../lib/statusLabels'
import { buildCandidatesWorkbook } from '../lib/excelReport'
import { buildCandidatesSummaryPdf, buildCandidatePdf } from '../lib/pdfReport'

const router = Router()

// Every route in this file is admin-only — candidate reports are never
// exposed to candidates or employers, and there is no public report endpoint.
router.use(requireAuth('admin'))

const exportQuerySchema = reportFiltersSchema.extend({
  scope: z.enum(['all', 'filtered', 'selected']).default('all'),
  ids:   z.string().trim().max(5000).optional(), // comma-separated candidate ids, required for scope=selected
})

function parseIds(ids: string | undefined): number[] {
  if (!ids) return []
  return ids.split(',').map((s) => s.trim()).filter(Boolean).map(Number).filter(Number.isInteger)
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Strips scope/ids out of the exported type, leaving exactly the filter fields. */
function filtersOnly(q: z.infer<typeof exportQuerySchema>): ReportFilters {
  const { scope, ids, ...filters } = q
  return filters
}

/* ── GET /candidates ── on-screen listing (paginated) ───────────────── */
router.get(
  '/candidates',
  query(reportFiltersSchema.merge(paginationSchema)),
  ah(async (req: Request, res: Response) => {
    const q = req.validatedQuery as ReportFilters & { page: number; limit: number }
    const { page, limit, ...filters } = q
    const offset = (page - 1) * limit

    const { rows, total } = await fetchCandidateRows(filters, { limit, offset })

    const shaped = rows.map((r) => ({
      id:                r.id,
      applicationId:     applicationIdLabel(r),
      registrationDate:  r.created_at,
      name:              r.full_name,
      mobile:            r.mobile,
      email:             r.email,
      serviceBackground: r.force,
      rank:              r.rank,
      jobPosition:       jobPosition(r),
      preferredLocation: preferredLocations(r),
      paymentStatus:     paymentLabel(r),
      paymentAmount:     paymentAmountRupees(r),
      applicationStatus: STATUS_LABEL[r.application_status ?? ''] ?? r.application_status,
      applicationStatusKey: r.application_status,
      documentsSubmitted: documentsSubmittedText(r),
      documentsMissing:   documentsMissingText(r),
      documentStatus:     docStatusDetail(r),
      lastUpdated:        r.last_updated,
    }))

    return res.json({ candidates: shaped, total, page, limit })
  }),
)

/* ── GET /candidates/export.xlsx ────────────────────────────────────── */
router.get(
  '/candidates/export.xlsx',
  query(exportQuerySchema),
  ah(async (req: Request, res: Response) => {
    const q = req.validatedQuery as z.infer<typeof exportQuerySchema>

    if (q.scope === 'selected' && parseIds(q.ids).length === 0)
      return res.status(400).json({ error: 'scope=selected requires at least one id in "ids"' })

    const filters = q.scope === 'filtered' ? filtersOnly(q) : {}
    const candidateIds = q.scope === 'selected' ? parseIds(q.ids) : undefined

    const { rows, total } = await fetchCandidateRows(filters, { candidateIds })

    const buffer = await buildCandidatesWorkbook(rows, {
      generatedAt: new Date(),
      generatedBy: req.auth!.id,
      scope: q.scope,
      filters,
      totalRecords: total,
    })

    audit(A.REPORT_GENERATED, {
      userId: req.auth!.id, req,
      metadata: { type: 'excel', scope: q.scope, filters, recordCount: total },
    })

    const scopeTag = q.scope === 'all' ? '' : `-${q.scope}`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="exserviceman-candidates${scopeTag}-${todayStamp()}.xlsx"`)
    return res.send(buffer)
  }),
)

/* ── GET /candidates/export.pdf ──────────────────────────────────────── */
router.get(
  '/candidates/export.pdf',
  query(exportQuerySchema),
  ah(async (req: Request, res: Response) => {
    const q = req.validatedQuery as z.infer<typeof exportQuerySchema>

    if (q.scope === 'selected' && parseIds(q.ids).length === 0)
      return res.status(400).json({ error: 'scope=selected requires at least one id in "ids"' })

    const filters = q.scope === 'filtered' ? filtersOnly(q) : {}
    const candidateIds = q.scope === 'selected' ? parseIds(q.ids) : undefined

    const { rows, total } = await fetchCandidateRows(filters, { candidateIds })

    const buffer = await buildCandidatesSummaryPdf(rows, {
      generatedAt: new Date(),
      generatedBy: req.auth!.id,
      scope: q.scope,
      filters,
      totalRecords: total,
    })

    audit(A.REPORT_GENERATED, {
      userId: req.auth!.id, req,
      metadata: { type: 'pdf-summary', scope: q.scope, filters, recordCount: total },
    })

    const scopeTag = q.scope === 'all' ? '' : `-${q.scope}`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="exserviceman-candidates${scopeTag}-${todayStamp()}.pdf"`)
    return res.send(buffer)
  }),
)

/* ── GET /candidates/:id/pdf ── individual candidate dossier ──────────── */
router.get('/candidates/:id/pdf', ah(async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' })

  // Intentionally no filters — the whole point of this endpoint is "the one
  // candidate whose id is in the URL," not "a candidate who also happens to
  // match whatever filters were last applied on the listing page."
  const { rows } = await fetchCandidateRows({}, { candidateIds: [id] })
  if (rows.length === 0) return res.status(404).json({ error: 'Candidate not found' })
  const candidate = rows[0]

  const [notesResult, visitsResult] = await Promise.all([
    pool.query(
      `SELECT note, admin_id, created_at FROM admin_notes WHERE candidate_id = $1 ORDER BY created_at DESC`,
      [id],
    ),
    pool.query(
      `SELECT visit_date, status, physical_verification_status FROM office_visits
        WHERE candidate_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [id],
    ),
  ])

  const buffer = await buildCandidatePdf({
    candidate,
    notes: notesResult.rows,
    officeVisits: visitsResult.rows,
    generatedBy: req.auth!.id,
    // Admin notes may contain internal commentary not meant for every
    // consumer of this report — opt in explicitly via ?notes=1 rather than
    // including them by default.
    includeAdminNotes: req.query.notes === '1',
  })

  audit(A.REPORT_GENERATED, {
    userId: req.auth!.id, req,
    metadata: { type: 'pdf-individual', candidateId: id },
  })

  const filenameId = applicationIdLabel(candidate).replace(/[^a-zA-Z0-9-]/g, '')
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="candidate-${filenameId}.pdf"`)
  return res.send(buffer)
}))

export default router
