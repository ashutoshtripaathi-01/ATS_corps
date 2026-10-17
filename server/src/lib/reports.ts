import { z } from 'zod'
import { pool } from '../db'
import {
  S, PAID_STATUSES, REQUIRED_DOCS, OPTIONAL_DOCS, DOC_STATUS,
} from './applicationStatus'

/**
 * Shared query-building and data-shaping logic for the admin Candidate
 * Reports feature (listing, Excel export, PDF export). Kept separate from
 * the route handlers so the on-screen listing and both export formats stay
 * built from exactly one source of truth for filtering and document/payment
 * derivation — a mismatch between what the table shows and what an export
 * contains would be worse than either being wrong consistently.
 */

/* ── Human labels for document types — backend has no equivalent to the
   frontend's DOC_META, since nothing server-side previously needed one. ── */
export const DOC_LABELS: Record<string, string> = {
  aadhaar:             'Aadhaar Card',
  pan:                 'PAN Card',
  photograph:          'Photograph',
  service_certificate: 'Service Certificate',
  discharge_book:      'Discharge Book',
  police_verification: 'Police Verification',
  other:               'Other Document',
}

/* ── Filters ─────────────────────────────────────────────────────────── */
export const reportFiltersSchema = z.object({
  name:          z.string().trim().max(255).optional(),
  mobile:        z.string().trim().max(15).optional(),
  email:         z.string().trim().max(255).optional(),
  applicationId: z.string().trim().max(50).optional(),
  status:        z.string().trim().max(500).optional(),        // comma-separated application_status values
  paymentStatus: z.enum(['pending', 'successful', 'failed', 'cancelled', 'not_required']).optional(),
  docStatus:     z.enum(['not_available', 'missing_required', 'under_review', 'approved', 'rejected', 'submitted']).optional(),
  post:          z.string().trim().max(100).optional(),
  loc:           z.string().trim().max(100).optional(),
  dateFrom:      z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD').optional(),
  dateTo:        z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD').optional(),
})
export type ReportFilters = z.infer<typeof reportFiltersSchema>

export const paginationSchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
})

/** application_status values that mean documents have at least unlocked once. */
const DOCS_REACHABLE = [...PAID_STATUSES] as string[]

interface WhereResult { innerWhere: string; outerWhere: string; params: unknown[] }

/**
 * Builds the WHERE clauses shared by the listing endpoint and both export
 * endpoints. Every filter is ANDed; an unset filter is simply omitted
 * rather than matched against a wildcard, so "no filter" truly means
 * "no restriction" — never a default that silently narrows the result.
 *
 * Split in two because of where each condition is evaluated: most filters
 * reference `candidates c` directly and must sit INSIDE the CTE that
 * aliases it that way; `docStatus` filters on `doc_status_computed`, a
 * column that only exists once the CTE has materialized, so it has to sit
 * on the OUTER query instead — referencing it inside the CTE's own WHERE
 * would mean filtering on a SELECT-list alias before it exists, which SQL
 * does not allow in the same SELECT.
 */
export function buildWhere(filters: ReportFilters, candidateIds?: number[]): WhereResult {
  const innerConds: string[] = []
  const outerConds: string[] = []
  const params: unknown[] = []
  let pi = 1
  const conds = innerConds

  if (candidateIds && candidateIds.length > 0) {
    conds.push(`c.id = ANY($${pi}::int[])`)
    params.push(candidateIds)
    pi++
  }

  if (filters.name) {
    conds.push(`c.full_name ILIKE $${pi}`)
    params.push(`%${filters.name}%`)
    pi++
  }
  if (filters.mobile) {
    conds.push(`c.mobile ILIKE $${pi}`)
    params.push(`%${filters.mobile}%`)
    pi++
  }
  if (filters.email) {
    conds.push(`c.email ILIKE $${pi}`)
    params.push(`%${filters.email}%`)
    pi++
  }
  if (filters.applicationId) {
    // Matches either the numeric id or the human registration reference —
    // an admin searching "124" or "ATS-2026-00124" both land on the same row.
    conds.push(`(c.registration_ref ILIKE $${pi} OR c.id::text = $${pi + 1})`)
    params.push(`%${filters.applicationId}%`, filters.applicationId.replace(/^#/, ''))
    pi += 2
  }
  if (filters.status) {
    const statuses = filters.status.split(',').map((s) => s.trim()).filter(Boolean)
    if (statuses.length > 0) {
      conds.push(`c.application_status = ANY($${pi}::text[])`)
      params.push(statuses)
      pi++
    }
  }
  if (filters.post) {
    conds.push(`c.post ILIKE $${pi}`)
    params.push(`%${filters.post}%`)
    pi++
  }
  if (filters.loc) {
    conds.push(`(c.loc1 ILIKE $${pi} OR c.loc2 ILIKE $${pi} OR c.loc3 ILIKE $${pi})`)
    params.push(`%${filters.loc}%`)
    pi++
  }
  if (filters.dateFrom) {
    conds.push(`c.created_at >= $${pi}::date`)
    params.push(filters.dateFrom)
    pi++
  }
  if (filters.dateTo) {
    // Inclusive of the whole end day.
    conds.push(`c.created_at < ($${pi}::date + INTERVAL '1 day')`)
    params.push(filters.dateTo)
    pi++
  }
  if (filters.paymentStatus) {
    const map: Record<string, string[]> = {
      pending:     [S.PAYMENT_PENDING],
      failed:      [S.PAYMENT_FAILED],
      cancelled:   [S.PAYMENT_CANCELLED],
      successful:  [...PAID_STATUSES],
      // "Not required" = never reached (or needed to reach) the payment gate
      // at all — REGISTERED / APPLICATION_STARTED with nothing further yet.
      not_required: [S.REGISTERED, S.APPLICATION_STARTED],
    }
    conds.push(`c.application_status = ANY($${pi}::text[])`)
    params.push(map[filters.paymentStatus])
    pi++
  }
  if (filters.docStatus) {
    outerConds.push(`doc_status_computed = $${pi}`)
    params.push(filters.docStatus.toUpperCase())
    pi++
  }

  return {
    innerWhere: innerConds.length ? `WHERE ${innerConds.join(' AND ')}` : '',
    outerWhere: outerConds.length ? `WHERE ${outerConds.join(' AND ')}` : '',
    params,
  }
}

/** Core SELECT — one row per candidate, documents/payment aggregated, never joined-and-multiplied. */
function baseSelect(innerWhere: string, outerWhere: string): string {
  return `
    WITH base AS (
      SELECT
        c.id, c.registration_ref, c.created_at,
        c.full_name, c.mobile, c.email,
        c.force, c.rank, c.post, c.other_post, c.loc1, c.loc2, c.loc3,
        c.application_status, c.assigned_admin,
        COALESCE(c.last_activity_at, c.updated_at, c.created_at) AS last_updated,
        c.payment_status, c.application_fee,
        pa.status               AS pay_attempt_status,
        pa.amount                AS pay_amount_paise,
        pa.currency               AS pay_currency,
        pa.razorpay_order_id     AS pay_order_id,
        pa.razorpay_payment_id   AS pay_payment_id,
        pa.paid_at               AS pay_paid_at,
        COALESCE(docs.doc_list, '[]'::json) AS documents,
        CASE
          WHEN NOT (c.application_status = ANY($1::text[])) OR c.application_status IS NULL
            THEN 'NOT_AVAILABLE'
          WHEN EXISTS (
            SELECT 1 FROM candidate_documents d
             WHERE d.candidate_id = c.id AND d.doc_type = ANY($2::text[]) AND d.status = 'REJECTED'
          ) THEN 'REJECTED'
          WHEN (
            SELECT COUNT(*) FROM candidate_documents d
             WHERE d.candidate_id = c.id AND d.doc_type = ANY($2::text[])
               AND d.status IN ('UPLOADED','UNDER_REVIEW','APPROVED')
          ) < $3 THEN 'MISSING_REQUIRED'
          WHEN EXISTS (
            SELECT 1 FROM candidate_documents d
             WHERE d.candidate_id = c.id AND d.doc_type = ANY($2::text[]) AND d.status = 'UNDER_REVIEW'
          ) THEN 'UNDER_REVIEW'
          WHEN (
            SELECT COUNT(*) FROM candidate_documents d
             WHERE d.candidate_id = c.id AND d.doc_type = ANY($2::text[]) AND d.status = 'APPROVED'
          ) = $3 THEN 'APPROVED'
          ELSE 'SUBMITTED'
        END AS doc_status_computed
      FROM candidates c
      LEFT JOIN LATERAL (
        SELECT status, amount, currency, razorpay_order_id, razorpay_payment_id, paid_at
          FROM payment_attempts
         WHERE candidate_id = c.id
         ORDER BY (status = 'paid') DESC, paid_at DESC NULLS LAST, created_at DESC
         LIMIT 1
      ) pa ON true
      LEFT JOIN LATERAL (
        SELECT json_agg(json_build_object(
                 'doc_type', d.doc_type, 'status', d.status,
                 'rejection_reason', d.rejection_reason,
                 'uploaded_at', d.uploaded_at, 'reviewed_at', d.reviewed_at
               ) ORDER BY d.doc_type) AS doc_list
          FROM candidate_documents d
         WHERE d.candidate_id = c.id
      ) docs ON true
      ${innerWhere}
    )
    SELECT * FROM base
    ${outerWhere}
  `
}

export interface CandidateReportRow {
  id: number
  registration_ref: string | null
  created_at: string
  full_name: string | null
  mobile: string | null
  email: string | null
  force: string | null
  rank: string | null
  post: string | null
  other_post: string | null
  loc1: string | null
  loc2: string | null
  loc3: string | null
  application_status: string | null
  assigned_admin: string | null
  last_updated: string
  payment_status: string | null
  application_fee: number | null
  pay_attempt_status: string | null
  pay_amount_paise: number | null
  pay_currency: string | null
  pay_order_id: string | null
  pay_payment_id: string | null
  pay_paid_at: string | null
  documents: Array<{ doc_type: string; status: string; rejection_reason: string | null; uploaded_at: string | null; reviewed_at: string | null }>
  doc_status_computed: string
}

/**
 * Fetches rows for a given filter set. `candidateIds` (export-selected scope)
 * and pagination are both optional — passing neither returns every row
 * matching the filters, which is exactly "export filtered" / "export all"
 * depending on whether any filter was set.
 */
export async function fetchCandidateRows(
  filters: ReportFilters,
  opts: { candidateIds?: number[]; limit?: number; offset?: number } = {},
): Promise<{ rows: CandidateReportRow[]; total: number }> {
  const { innerWhere, outerWhere, params } = buildWhere(filters, opts.candidateIds)
  // $1/$2/$3 inside baseSelect are reserved for the doc-status CASE — every
  // filter param from buildWhere must be renumbered to start after them.
  const reserved = [[...PAID_STATUSES], [...REQUIRED_DOCS], REQUIRED_DOCS.length]
  const shift = (sql: string) => sql.replace(/\$(\d+)/g, (_m, n) => `$${Number(n) + 3}`)
  const shiftedInner = shift(innerWhere)
  const shiftedOuter = shift(outerWhere)
  const allParams = [...reserved, ...params]

  const countSql = `SELECT COUNT(*) FROM (${baseSelect(shiftedInner, shiftedOuter)}) q`
  const countRow = await pool.query(countSql, allParams)
  const total = Number(countRow.rows[0].count)

  let dataSql = `SELECT * FROM (${baseSelect(shiftedInner, shiftedOuter)}) q ORDER BY q.created_at DESC`
  const dataParams = [...allParams]
  if (opts.limit !== undefined) {
    dataSql += ` LIMIT $${dataParams.length + 1} OFFSET $${dataParams.length + 2}`
    dataParams.push(opts.limit, opts.offset ?? 0)
  }

  const dataRow = await pool.query(dataSql, dataParams)
  return { rows: dataRow.rows, total }
}

/* ── Derived, human-readable fields shared by Excel/PDF/listing ────────── */

/**
 * "Successful" must mean money was actually verified received — reaching a
 * post-payment-gate application_status (PAID_STATUSES) is NOT by itself
 * proof of that: a free-registration candidate reaches DOCUMENTS_PENDING
 * via statusAfterProfileSaved() skipping the gate entirely, with no
 * payment_attempts row at all. Treating that the same as a verified
 * Razorpay payment would be exactly the "frontend callback as proof"
 * mistake this report is required to avoid — so an authoritative paid
 * payment_attempts record is checked first, and PAID_STATUSES only
 * decides what to call it when no such record exists.
 */
export function paymentLabel(row: CandidateReportRow): string {
  if (row.pay_attempt_status === 'paid' || row.payment_status === 'paid') return 'Successful'
  if (row.application_status === S.PAYMENT_PENDING)   return 'Pending'
  if (row.application_status === S.PAYMENT_FAILED)    return 'Failed'
  if (row.application_status === S.PAYMENT_CANCELLED) return 'Cancelled'
  return 'Not Required'
}

/** Rupees, not paise — payment_attempts.amount is stored in paise. */
export function paymentAmountRupees(row: CandidateReportRow): number {
  if (row.pay_amount_paise != null) return row.pay_amount_paise / 100
  return row.application_fee ?? 0
}

export function docStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    NOT_AVAILABLE:    'Not Yet Available',
    MISSING_REQUIRED: 'Missing Required Documents',
    UNDER_REVIEW:     'Under Review',
    APPROVED:         'All Required Approved',
    REJECTED:         'Rejected',
    SUBMITTED:        'Submitted',
  }
  return labels[status] ?? status
}

/**
 * "Not yet available" is further qualified by *why* — a candidate who
 * hasn't even started the form reads very differently from one stuck on an
 * unpaid order, even though both currently show the same doc_status_computed.
 */
export function docStatusDetail(row: CandidateReportRow): string {
  if (row.doc_status_computed !== 'NOT_AVAILABLE') return docStatusLabel(row.doc_status_computed)
  const s = row.application_status
  if (s === S.REGISTERED || s === S.APPLICATION_STARTED || !s) return 'Not Yet Available — Application Incomplete'
  if (s === S.PAYMENT_PENDING || s === S.PAYMENT_FAILED || s === S.PAYMENT_CANCELLED) return 'Not Yet Available — Payment Pending'
  return 'Not Yet Available'
}

export function documentsSubmittedText(row: CandidateReportRow): string {
  if (row.doc_status_computed === 'NOT_AVAILABLE') return '—'
  const byType = new Map(row.documents.map((d) => [d.doc_type, d.status]))
  const submitted = [...REQUIRED_DOCS, ...OPTIONAL_DOCS]
    .filter((t) => byType.has(t))
    .map((t) => `${DOC_LABELS[t] ?? t} (${byType.get(t)})`)
  return submitted.length > 0 ? submitted.join(', ') : 'None'
}

export function documentsMissingText(row: CandidateReportRow): string {
  if (row.doc_status_computed === 'NOT_AVAILABLE') return '—'
  const byType = new Map(row.documents.map((d) => [d.doc_type, d.status]))
  const missing = REQUIRED_DOCS.filter((t) => !byType.has(t)).map((t) => DOC_LABELS[t] ?? t)
  return missing.length > 0 ? missing.join(', ') : 'None'
}

export function preferredLocations(row: CandidateReportRow): string {
  return [row.loc1, row.loc2, row.loc3].filter(Boolean).join(' | ') || '—'
}

export function jobPosition(row: CandidateReportRow): string {
  if (row.post === 'Other' && row.other_post) return row.other_post
  return row.post ?? '—'
}

export function applicationIdLabel(row: CandidateReportRow): string {
  return row.registration_ref ?? `DRAFT-${row.id}`
}
