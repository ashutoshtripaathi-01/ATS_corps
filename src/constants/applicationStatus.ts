/**
 * Display-only mirror of the server's application lifecycle.
 * The server (server/src/lib/applicationStatus.ts) owns which transitions are
 * legal; this file owns only how each status is labelled and coloured.
 */

export const APP_STATUS = {
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

export type AppStatus = typeof APP_STATUS[keyof typeof APP_STATUS]

export const STATUS_LABEL: Record<string, string> = {
  REGISTERED:             'Registered',
  APPLICATION_STARTED:    'Application Started',
  PAYMENT_PENDING:        'Payment Pending',
  PAYMENT_FAILED:         'Payment Failed',
  PAYMENT_CANCELLED:      'Payment Cancelled',
  PAYMENT_SUCCESSFUL:     'Payment Successful',
  DOCUMENTS_PENDING:      'Documents Pending',
  DOCUMENTS_SUBMITTED:    'Documents Submitted',
  DOCUMENTS_UNDER_REVIEW: 'Documents Under Review',
  DOCUMENTS_REJECTED:     'Documents Rejected',
  DOCUMENTS_VERIFIED:     'Documents Verified',
  OFFICE_VISIT_PENDING:   'Office Visit Pending',
  PHYSICAL_VERIFICATION:  'Physical Verification',
  COMPLETED:              'Completed',
  APPLICATION_ON_HOLD:    'On Hold',
  APPLICATION_CANCELLED:  'Cancelled',
}

export const STATUS_CHIP: Record<string, string> = {
  REGISTERED:             'bg-gray-100 text-gray-600',
  APPLICATION_STARTED:    'bg-sky-100 text-sky-700',
  PAYMENT_PENDING:        'bg-amber-100 text-amber-700',
  PAYMENT_FAILED:         'bg-red-100 text-red-700',
  PAYMENT_CANCELLED:      'bg-orange-100 text-orange-700',
  PAYMENT_SUCCESSFUL:     'bg-green-100 text-green-700',
  DOCUMENTS_PENDING:      'bg-amber-100 text-amber-700',
  DOCUMENTS_SUBMITTED:    'bg-blue-100 text-blue-700',
  DOCUMENTS_UNDER_REVIEW: 'bg-indigo-100 text-indigo-700',
  DOCUMENTS_REJECTED:     'bg-red-100 text-red-700',
  DOCUMENTS_VERIFIED:     'bg-teal-100 text-teal-700',
  OFFICE_VISIT_PENDING:   'bg-purple-100 text-purple-700',
  PHYSICAL_VERIFICATION:  'bg-violet-100 text-violet-700',
  COMPLETED:              'bg-green-100 text-green-700',
  APPLICATION_ON_HOLD:    'bg-yellow-100 text-yellow-800',
  APPLICATION_CANCELLED:  'bg-gray-200 text-gray-600',
}

/** The seven milestones shown on the candidate dashboard progress tracker. */
export const PROGRESS_STEPS = [
  { key: 'account',   label: 'Account Created',  matches: ['REGISTERED'] },
  { key: 'started',   label: 'Application Started', matches: ['APPLICATION_STARTED'] },
  { key: 'details',   label: 'Application Details', matches: ['PAYMENT_PENDING', 'PAYMENT_FAILED', 'PAYMENT_CANCELLED'] },
  { key: 'payment',   label: 'Payment',          matches: ['PAYMENT_SUCCESSFUL'] },
  { key: 'documents', label: 'Documents',        matches: ['DOCUMENTS_PENDING', 'DOCUMENTS_SUBMITTED', 'DOCUMENTS_REJECTED'] },
  { key: 'verify',    label: 'Verification',     matches: ['DOCUMENTS_UNDER_REVIEW', 'DOCUMENTS_VERIFIED'] },
  { key: 'visit',     label: 'Office Visit',     matches: ['OFFICE_VISIT_PENDING', 'PHYSICAL_VERIFICATION'] },
  { key: 'done',      label: 'Completed',        matches: ['COMPLETED'] },
] as const

/** Index of the milestone a status sits at — drives done/current/upcoming. */
const ORDER: string[] = [
  'REGISTERED', 'APPLICATION_STARTED',
  'PAYMENT_PENDING', 'PAYMENT_FAILED', 'PAYMENT_CANCELLED',
  'PAYMENT_SUCCESSFUL',
  'DOCUMENTS_PENDING', 'DOCUMENTS_SUBMITTED', 'DOCUMENTS_REJECTED',
  'DOCUMENTS_UNDER_REVIEW', 'DOCUMENTS_VERIFIED',
  'OFFICE_VISIT_PENDING', 'PHYSICAL_VERIFICATION',
  'COMPLETED',
]

export function progressIndex(status: string | null | undefined): number {
  if (!status) return 0
  const i = PROGRESS_STEPS.findIndex((s) => (s.matches as readonly string[]).includes(status))
  if (i >= 0) return i
  // On-hold / cancelled keep whatever progress they had — show nothing extra.
  return 0
}

export function statusRank(status: string | null | undefined): number {
  return status ? ORDER.indexOf(status) : -1
}

export const PAID_STATUSES = [
  'PAYMENT_SUCCESSFUL', 'DOCUMENTS_PENDING', 'DOCUMENTS_SUBMITTED',
  'DOCUMENTS_UNDER_REVIEW', 'DOCUMENTS_REJECTED', 'DOCUMENTS_VERIFIED',
  'OFFICE_VISIT_PENDING', 'PHYSICAL_VERIFICATION', 'COMPLETED',
]

export const isPaid = (s: string | null | undefined) => !!s && PAID_STATUSES.includes(s)

/* ── Documents ───────────────────────────────────────────────────────── */
export const DOC_META: Record<string, { label: string; hint: string; required: boolean }> = {
  aadhaar:             { label: 'Aadhaar Card',        hint: 'Front and back, clearly readable', required: true },
  pan:                 { label: 'PAN Card',            hint: 'Clear photo or scan',              required: true },
  photograph:          { label: 'Photograph',          hint: 'Recent passport-size photo',       required: true },
  service_certificate: { label: 'Service Certificate', hint: 'Discharge / service record',       required: true },
  discharge_book:      { label: 'Discharge Book',      hint: 'Optional supporting document',     required: false },
  police_verification: { label: 'Police Verification', hint: 'Optional supporting document',     required: false },
  other:               { label: 'Other Document',      hint: 'Anything else we asked for',       required: false },
}

export const DOC_STATUS_CHIP: Record<string, string> = {
  PENDING:      'bg-gray-100 text-gray-500',
  UPLOADED:     'bg-blue-100 text-blue-700',
  UNDER_REVIEW: 'bg-indigo-100 text-indigo-700',
  APPROVED:     'bg-green-100 text-green-700',
  REJECTED:     'bg-red-100 text-red-700',
}

export const CALL_STATUS_OPTIONS = [
  { value: 'NOT_CALLED',         label: 'Not Called' },
  { value: 'CALLED',             label: 'Called' },
  { value: 'NO_ANSWER',          label: 'No Answer' },
  { value: 'INTERESTED',         label: 'Interested' },
  { value: 'WILL_PAY_LATER',     label: 'Will Pay Later' },
  { value: 'NOT_INTERESTED',     label: 'Not Interested' },
  { value: 'REQUESTED_CALLBACK', label: 'Requested Callback' },
  { value: 'CONVERTED',          label: 'Converted' },
] as const

export const ADMIN_FILTERS = [
  { key: '',                    label: 'All' },
  { key: 'new',                 label: 'New Registrations' },
  { key: 'payment_pending',     label: 'Payment Pending' },
  { key: 'payment_failed',      label: 'Payment Failed' },
  { key: 'payment_successful',  label: 'Payment Successful' },
  { key: 'documents_pending',   label: 'Documents Pending' },
  { key: 'documents_review',    label: 'Documents Under Review' },
  { key: 'documents_rejected',  label: 'Documents Rejected' },
  { key: 'documents_verified',  label: 'Documents Verified' },
  { key: 'office_visit',        label: 'Office Visit Pending' },
  { key: 'completed',           label: 'Completed' },
  { key: 'on_hold',             label: 'On Hold' },
  { key: 'cancelled',           label: 'Cancelled' },
] as const
