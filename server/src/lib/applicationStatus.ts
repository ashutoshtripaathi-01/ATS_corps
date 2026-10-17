/**
 * Central application-lifecycle definition.
 *
 * The candidates row IS the registration application, and `application_status`
 * is the single source of truth for where that application sits in the
 * business workflow. Every status change must go through `canTransition` so
 * the lifecycle stays coherent no matter which route drives it.
 */

export const S = {
  REGISTERED:             'REGISTERED',
  APPLICATION_STARTED:    'APPLICATION_STARTED',
  PAYMENT_PENDING:        'PAYMENT_PENDING',
  PAYMENT_FAILED:         'PAYMENT_FAILED',
  PAYMENT_CANCELLED:      'PAYMENT_CANCELLED',
  PAYMENT_SUCCESSFUL:     'PAYMENT_SUCCESSFUL',
  DOCUMENTS_PENDING:      'DOCUMENTS_PENDING',
  DOCUMENTS_SUBMITTED:    'DOCUMENTS_SUBMITTED',
  DOCUMENTS_UNDER_REVIEW: 'DOCUMENTS_UNDER_REVIEW',
  DOCUMENTS_REJECTED:     'DOCUMENTS_REJECTED',
  DOCUMENTS_VERIFIED:     'DOCUMENTS_VERIFIED',
  OFFICE_VISIT_PENDING:   'OFFICE_VISIT_PENDING',
  PHYSICAL_VERIFICATION:  'PHYSICAL_VERIFICATION',
  COMPLETED:              'COMPLETED',
  APPLICATION_ON_HOLD:    'APPLICATION_ON_HOLD',
  APPLICATION_CANCELLED:  'APPLICATION_CANCELLED',
} as const

export type AppStatus = typeof S[keyof typeof S]

/** Ordered happy path — drives the progress indicator on the dashboard. */
export const HAPPY_PATH: AppStatus[] = [
  S.REGISTERED,
  S.APPLICATION_STARTED,
  S.PAYMENT_PENDING,
  S.PAYMENT_SUCCESSFUL,
  S.DOCUMENTS_PENDING,
  S.DOCUMENTS_SUBMITTED,
  S.DOCUMENTS_UNDER_REVIEW,
  S.DOCUMENTS_VERIFIED,
  S.OFFICE_VISIT_PENDING,
  S.PHYSICAL_VERIFICATION,
  S.COMPLETED,
]

/**
 * Allowed transitions. Anything not listed here is rejected — an admin cannot
 * jump an application straight from PAYMENT_PENDING to COMPLETED.
 */
const TRANSITIONS: Record<AppStatus, AppStatus[]> = {
  [S.REGISTERED]:          [S.APPLICATION_STARTED, S.APPLICATION_CANCELLED],
  [S.APPLICATION_STARTED]: [S.PAYMENT_PENDING, S.APPLICATION_ON_HOLD, S.APPLICATION_CANCELLED],

  [S.PAYMENT_PENDING]: [
    S.PAYMENT_SUCCESSFUL, S.PAYMENT_FAILED, S.PAYMENT_CANCELLED,
    S.APPLICATION_STARTED, S.APPLICATION_ON_HOLD, S.APPLICATION_CANCELLED,
  ],
  // A failed or cancelled payment must always be able to return to pending so
  // the applicant can retry — this is the core of the "never lose an
  // application" requirement.
  [S.PAYMENT_FAILED]:     [S.PAYMENT_PENDING, S.APPLICATION_ON_HOLD, S.APPLICATION_CANCELLED],
  [S.PAYMENT_CANCELLED]:  [S.PAYMENT_PENDING, S.APPLICATION_ON_HOLD, S.APPLICATION_CANCELLED],
  [S.PAYMENT_SUCCESSFUL]: [S.DOCUMENTS_PENDING],

  [S.DOCUMENTS_PENDING]:      [S.DOCUMENTS_SUBMITTED, S.APPLICATION_ON_HOLD, S.APPLICATION_CANCELLED],
  [S.DOCUMENTS_SUBMITTED]:    [S.DOCUMENTS_UNDER_REVIEW, S.DOCUMENTS_PENDING, S.APPLICATION_ON_HOLD],
  [S.DOCUMENTS_UNDER_REVIEW]: [S.DOCUMENTS_VERIFIED, S.DOCUMENTS_REJECTED, S.APPLICATION_ON_HOLD],
  [S.DOCUMENTS_REJECTED]:     [S.DOCUMENTS_SUBMITTED, S.DOCUMENTS_PENDING, S.APPLICATION_ON_HOLD],
  [S.DOCUMENTS_VERIFIED]:     [S.OFFICE_VISIT_PENDING, S.DOCUMENTS_UNDER_REVIEW, S.APPLICATION_ON_HOLD],

  [S.OFFICE_VISIT_PENDING]:  [S.PHYSICAL_VERIFICATION, S.APPLICATION_ON_HOLD, S.APPLICATION_CANCELLED],
  [S.PHYSICAL_VERIFICATION]: [S.COMPLETED, S.OFFICE_VISIT_PENDING, S.APPLICATION_ON_HOLD],

  [S.COMPLETED]: [],

  // On-hold returns to wherever the admin needs it; cancelled is terminal
  // unless an admin explicitly revives it back to payment pending.
  [S.APPLICATION_ON_HOLD]: [
    S.APPLICATION_STARTED, S.PAYMENT_PENDING, S.DOCUMENTS_PENDING,
    S.DOCUMENTS_UNDER_REVIEW, S.OFFICE_VISIT_PENDING, S.APPLICATION_CANCELLED,
  ],
  [S.APPLICATION_CANCELLED]: [S.PAYMENT_PENDING, S.APPLICATION_STARTED],
}

export function isStatus(v: unknown): v is AppStatus {
  return typeof v === 'string' && v in TRANSITIONS
}

export function canTransition(from: string | null, to: string): boolean {
  if (!isStatus(to)) return false
  if (!from || !isStatus(from)) return true // unset status — allow initialisation
  if (from === to) return true              // idempotent re-set is harmless
  return TRANSITIONS[from].includes(to)
}

export function nextStatuses(from: string | null): AppStatus[] {
  return from && isStatus(from) ? TRANSITIONS[from] : []
}

/* ── Payment toggle ──────────────────────────────────────────────────── */
/**
 * Registration is free: the Razorpay flow is switched off rather than
 * removed, so it can be brought back by setting PAYMENTS_ENABLED=true and
 * restarting.
 *
 * Read at call time rather than captured once at import, so a restart (or a
 * test) picks up the change without the module needing to be reloaded.
 */
export function paymentsEnabled(): boolean {
  return String(process.env.PAYMENTS_ENABLED ?? '').toLowerCase() === 'true'
}

/** Statuses an application sits in while it is waiting to be paid for. */
export const AWAITING_PAYMENT: AppStatus[] = [
  S.PAYMENT_PENDING, S.PAYMENT_FAILED, S.PAYMENT_CANCELLED,
]

/**
 * Where save-profile should leave a completed application. With payments off
 * it goes straight to documents, so nobody waits on a step that no longer
 * exists.
 */
export function statusAfterProfileSaved(): AppStatus {
  return paymentsEnabled() ? S.PAYMENT_PENDING : S.DOCUMENTS_PENDING
}

/**
 * Statuses that mean the application has cleared the payment gate — either
 * because money was verifiably received, or because payments are switched
 * off and statusAfterProfileSaved() sent it straight here.
 */
export const PAID_STATUSES: AppStatus[] = [
  S.PAYMENT_SUCCESSFUL, S.DOCUMENTS_PENDING, S.DOCUMENTS_SUBMITTED,
  S.DOCUMENTS_UNDER_REVIEW, S.DOCUMENTS_REJECTED, S.DOCUMENTS_VERIFIED,
  S.OFFICE_VISIT_PENDING, S.PHYSICAL_VERIFICATION, S.COMPLETED,
]

/** Documents are writable by the candidate only in these states. */
export const DOCS_UNLOCKED: AppStatus[] = [
  S.DOCUMENTS_PENDING, S.DOCUMENTS_SUBMITTED,
  S.DOCUMENTS_UNDER_REVIEW, S.DOCUMENTS_REJECTED,
]

/* ── Document types ──────────────────────────────────────────────────── */
export const REQUIRED_DOCS = ['aadhaar', 'pan', 'photograph', 'service_certificate'] as const
export const OPTIONAL_DOCS = ['discharge_book', 'police_verification', 'other'] as const
export const ALL_DOC_TYPES = [...REQUIRED_DOCS, ...OPTIONAL_DOCS] as const
export type DocType = typeof ALL_DOC_TYPES[number]

export function isDocType(v: unknown): v is DocType {
  return typeof v === 'string' && (ALL_DOC_TYPES as readonly string[]).includes(v)
}

export const DOC_STATUS = {
  PENDING:      'PENDING',
  UPLOADED:     'UPLOADED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED:     'APPROVED',
  REJECTED:     'REJECTED',
} as const

/**
 * Derive the application status implied by the current document set.
 * Returns null when documents should not drive the status at all.
 */
export function statusFromDocuments(
  docs: Array<{ doc_type: string; status: string }>,
  current: string | null,
): AppStatus | null {
  if (!current || !DOCS_UNLOCKED.includes(current as AppStatus)) return null

  const byType = new Map(docs.map((d) => [d.doc_type, d.status]))
  const required = REQUIRED_DOCS.map((t) => byType.get(t))

  if (required.some((s) => s === DOC_STATUS.REJECTED)) return S.DOCUMENTS_REJECTED
  if (required.some((s) => !s)) return S.DOCUMENTS_PENDING
  return S.DOCUMENTS_SUBMITTED
}
