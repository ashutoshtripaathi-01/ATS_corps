/**
 * Human-readable labels for application_status, for reports generated on
 * the server (Excel/PDF). Mirrors src/constants/applicationStatus.ts's
 * STATUS_LABEL on the frontend — kept as a separate copy rather than a
 * shared package, consistent with how this codebase already duplicates
 * display-only labels between frontend and backend (see the comment at the
 * top of server/src/lib/applicationStatus.ts).
 */
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
