import { getToken, setToken } from '@/lib/tokenStore'
export const API_BASE = import.meta.env.VITE_API_URL + '/api'
// Uploaded documents are private and are never linked to directly — they are
// fetched through /api/documents/:id/file. See fetchDocumentBlobUrl below.

// Single in-flight refresh promise — prevents concurrent 401s from all trying to refresh
let _refreshing: Promise<string> | null = null

async function doRefresh(): Promise<string> {
  if (_refreshing) return _refreshing

  _refreshing = fetch(`${API_BASE}/auth/refresh`, {
    method:      'POST',
    credentials: 'include',
  })
    .then(async (r) => {
      if (!r.ok) throw new Error('Session expired')
      const d = await r.json() as { accessToken: string }
      setToken(d.accessToken)
      return d.accessToken
    })
    .finally(() => { _refreshing = null })

  return _refreshing
}

async function req<T = any>(url: string, opts?: RequestInit, _retry = true): Promise<T> {
  const token = getToken()

  // Build headers — preserve original headers, inject Bearer token if present
  const headers = new Headers(opts?.headers as HeadersInit | undefined)
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(url, { ...opts, headers, credentials: 'include' })

  // On 401, try one silent refresh then retry the original request
  if (res.status === 401 && _retry) {
    try {
      await doRefresh()
      return req<T>(url, opts, false)
    } catch {
      setToken(null)
      throw new Error('Session expired. Please log in again.')
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error || `Request failed ${res.status}`)
  }
  return res.json() as Promise<T>
}

/* ── Public runtime config ───────────────────────────────────────────── */
/**
 * Public identifiers served by the API rather than frozen into the bundle at
 * build time. Cached as a single in-flight promise so concurrent callers share
 * one request.
 */
export interface PublicConfig {
  googleClientId: string | null
  razorpayKeyId: string | null
}

let _config: Promise<PublicConfig> | null = null

export const getPublicConfig = (): Promise<PublicConfig> => {
  if (!_config) {
    _config = fetch(`${API_BASE}/config`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`config ${r.status}`))))
      .catch((e) => { _config = null; throw e })
  }
  return _config
}

/* ── Auth ────────────────────────────────────────────────────────────── */
export const adminLogin = (email: string, password: string) =>
  req<{ accessToken: string; user: { id: string; name: string; email: string; role: string } }>(
    `${API_BASE}/auth/admin/login`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) },
    false, // never retry a login request on 401
  )

export const refreshToken = () => doRefresh()

export const logoutApi = () =>
  fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {})


/* ── Payments ────────────────────────────────────────────────────────── */
export const createPaymentOrder = () =>
  req<{ orderId: string; amount: number; currency: string }>(
    `${API_BASE}/payments/create-order`,
    { method: 'POST' },
  )

export const verifyPayment = (data: {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}) =>
  req<{ success: boolean; candidate: any; accessToken: string }>(
    `${API_BASE}/payments/verify`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) },
  )

/** Record a cancelled or failed payment. The application is never discarded. */
export const abandonPayment = (data: {
  razorpay_order_id?: string
  reason: 'cancelled' | 'failed'
  detail?: string
}) =>
  req<{ success: boolean }>(
    `${API_BASE}/payments/abandon`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) },
  ).catch(() => ({ success: false }))

/* ── Application record shapes (server row → client) ─────────────────── */
export interface ApplicantRecord {
  id: number
  email: string
  full_name: string | null
  mobile: string | null
  force: string | null
  rank: string | null
  unit: string | null
  retirement_date: string | null
  post: string | null
  other_post: string | null
  gun_license: string | null
  loc1: string | null
  loc2: string | null
  loc3: string | null
  application_fee: number
  payment_status: string
  registration_status: string | null
  application_status: string | null
  registration_ref: string | null
  assigned_admin?: string | null
  created_at: string
  updated_at?: string
  last_activity_at?: string | null
}

export interface DocumentRecord {
  id: number
  doc_type: string
  original_name: string | null
  status: string
  rejection_reason: string | null
  reviewed_by?: string | null
  reviewed_at?: string | null
  uploaded_at: string
}

export interface PaymentRecord {
  razorpay_order_id: string
  razorpay_payment_id: string | null
  amount: number
  currency: string
  status: string
  created_at?: string
  paid_at: string | null
}

export interface CallLogRecord {
  id: number
  call_status: string
  notes: string | null
  next_followup_date: string | null
  admin_id: string | null
  created_at: string
}

export interface AdminNoteRecord {
  id: number
  note: string
  admin_id: string | null
  created_at: string
}

export interface ActivityEventRecord {
  id: number
  event_type: string
  description: string | null
  actor_type: string
  actor_id: string | null
  created_at: string
}

export interface OfficeVisitRecord {
  id: number
  visit_date: string | null
  visit_time: string | null
  assigned_staff: string | null
  status: string
  physical_verification_status: string | null
  notes: string | null
  created_at: string
}

/* ── Documents ───────────────────────────────────────────────────────── */
export interface DocumentSlot {
  docType: string
  required: boolean
  id: number | null
  originalName: string | null
  status: string
  rejectionReason: string | null
  uploadedAt: string | null
  reviewedAt: string | null
}

export const getMyDocuments = () =>
  req<{ unlocked: boolean; applicationStatus: string | null; documents: DocumentSlot[] }>(
    `${API_BASE}/documents/me`,
  )

export const uploadDocument = (docType: string, file: File) => {
  const fd = new FormData()
  fd.append('file', file)
  return req<{ success: boolean; documents: DocumentSlot[] }>(
    `${API_BASE}/documents/me/${docType}`,
    { method: 'POST', body: fd },
  )
}

/**
 * Documents are private — they are fetched with the access token and turned
 * into a blob URL rather than linked to directly. Revoke the URL when done.
 */
export const fetchDocumentBlobUrl = async (docId: number): Promise<string> => {
  const token = getToken()
  const headers = new Headers()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let res = await fetch(`${API_BASE}/documents/${docId}/file`, { headers, credentials: 'include' })
  if (res.status === 401) {
    await doRefresh()
    const retry = new Headers()
    const t = getToken()
    if (t) retry.set('Authorization', `Bearer ${t}`)
    res = await fetch(`${API_BASE}/documents/${docId}/file`, { headers: retry, credentials: 'include' })
  }
  if (!res.ok) throw new Error('Could not open document')
  return URL.createObjectURL(await res.blob())
}

export const getCandidateDocuments = (candidateId: number) =>
  req<{ documents: DocumentSlot[] }>(`${API_BASE}/documents/candidate/${candidateId}`)

export const reviewDocument = (docId: number, action: 'approve' | 'reject', reason?: string) =>
  req<{ success: boolean; documents: DocumentSlot[] }>(
    `${API_BASE}/documents/${docId}/review`,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, reason }) },
  )

/* ── Admin — Applicants ─────────────────────────────────────────────── */
export interface AdminApplicantRow extends ApplicantRecord {
  docs_total: string
  docs_approved: string
  last_call_status: string | null
  next_followup_date: string | null
  last_activity_at: string
}

export interface AdminApplicantDetail {
  applicant: ApplicantRecord
  documents: DocumentRecord[]
  calls: CallLogRecord[]
  notes: AdminNoteRecord[]
  timeline: ActivityEventRecord[]
  officeVisits: OfficeVisitRecord[]
  payments: PaymentRecord[]
  allowedStatuses: string[]
}

export const getAdminApplicants = (params?: Record<string, string>) => {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  return req<{ applicants: AdminApplicantRow[]; total: number; page: number; limit: number }>(
    `${API_BASE}/admin/applicants${qs}`,
  )
}

export const getAdminApplicant = (id: number) =>
  req<AdminApplicantDetail>(`${API_BASE}/admin/applicants/${id}`)

export const getAdminMetrics = () =>
  req<Record<string, number>>(`${API_BASE}/admin/metrics`)

export const updateApplicantStatus = (id: number, status: string, reason?: string) =>
  req<{ success: boolean; from: string; to: string; allowedStatuses: string[] }>(
    `${API_BASE}/admin/applicants/${id}/status`,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, reason }) },
  )

export const logCall = (id: number, data: {
  callStatus: string; notes?: string; nextFollowupDate?: string
}) =>
  req<{ success: boolean; call: CallLogRecord }>(
    `${API_BASE}/admin/applicants/${id}/calls`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) },
  )

export const addAdminNote = (id: number, note: string) =>
  req<{ success: boolean; note: AdminNoteRecord }>(
    `${API_BASE}/admin/applicants/${id}/notes`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note }) },
  )

export const recordOfficeVisit = (id: number, data: {
  visitDate?: string; visitTime?: string; assignedStaff?: string
  status: string; physicalVerificationStatus?: string; notes?: string
}) =>
  req<{ success: boolean; visit: OfficeVisitRecord }>(
    `${API_BASE}/admin/applicants/${id}/office-visit`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) },
  )

/* ── Candidate Auth ──────────────────────────────────────────────────── */
export const candidateCreateAccount = (email: string, password: string) =>
  req<{ success: boolean; candidate: any; accessToken: string }>(
    `${API_BASE}/candidates/create-account`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) },
    false,
  )

export const candidateLogin = (email: string, password: string) =>
  req<{ success: boolean; candidate: any; accessToken: string }>(
    `${API_BASE}/candidates/login`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) },
    false,
  )

/** Sign in or sign up with Google. The server decides which it was. */
export const candidateGoogleAuth = (credential: string) =>
  req<{
    success: boolean
    isNew: boolean
    needsProfile: boolean
    candidate: ApplicantRecord & { avatar_url?: string | null }
    accessToken: string
  }>(
    `${API_BASE}/candidates/google`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential }) },
    false,
  )

export const saveProfile = (data: Record<string, string | number>) =>
  req<{ success: boolean; candidateId: number; registrationRef: string | null }>(
    `${API_BASE}/candidates/save-profile`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) },
  )

/** Full application state for the signed-in candidate. */
export const getMyApplication = () =>
  req<{
    application: ApplicantRecord
    paid: boolean
    progress: {
      profileComplete: boolean
      documentsRequired: number
      documentsUploaded: number
      documentsApproved: number
    }
    documents: DocumentRecord[]
    lastPayment: PaymentRecord | null
  }>(`${API_BASE}/candidates/me`)

export const updateDraft = (data: {
  force?: string; rank?: string; fullName?: string; mobile?: string;
  unit?: string; retirementDate?: string; post?: string; otherPost?: string;
  gunLicense?: string; loc1?: string; loc2?: string; loc3?: string;
}) =>
  req<{ success: boolean }>(
    `${API_BASE}/candidates/update-draft`,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) },
  )

export const getCandidateProfile = (id: string) =>
  req(`${API_BASE}/candidates/${id}`)

/* ── Admin — Candidates ─────────────────────────────────────────────── */
export const getAdminStats = () =>
  req(`${API_BASE}/candidates/admin/stats`)

export const getAdminCandidates = () =>
  req(`${API_BASE}/candidates/admin/all`)

export const getAdminRegistrations = (params?: Record<string, string>) => {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  return req<{
    registrations: any[]
    total: number
    page: number
    limit: number
  }>(`${API_BASE}/candidates/admin/registrations${qs}`)
}

/* ── Employers ──────────────────────────────────────────────────────── */
export const employerCreateAccount = (email: string, password: string) =>
  req<{ success: boolean; employer: any; accessToken: string }>(
    `${API_BASE}/employers/create-account`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) },
    false,
  )

export const employerLogin = (email: string, password: string) =>
  req<{ success: boolean; employer: any; accessToken: string }>(
    `${API_BASE}/employers/login`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) },
    false,
  )

export const registerEmployer = (data: Record<string, string>) =>
  req<{ success: boolean; employer: any; accessToken: string }>(
    `${API_BASE}/employers/register`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) },
  )

export const getEmployer = (id: string) =>
  req(`${API_BASE}/employers/${id}`)

export const updateEmployer = (id: string, data: Record<string, string>) =>
  req(`${API_BASE}/employers/${id}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  })

export const getAdminCompanies = () =>
  req(`${API_BASE}/employers/admin/all`)

/* ── Jobs ────────────────────────────────────────────────────────────── */
export const getJobs = (params?: Record<string, string>) => {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  return req(`${API_BASE}/jobs${qs}`)
}

export const getJob = (id: string) =>
  req(`${API_BASE}/jobs/${id}`)

export const postJob = (data: Record<string, string | number>) =>
  req(`${API_BASE}/jobs`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  })

export const getEmployerJobs = (employerId: string) =>
  req(`${API_BASE}/jobs/employer/${employerId}`)

export const getAdminJobs = () =>
  req(`${API_BASE}/jobs/admin/all`)

export const updateJobStatus = (id: string, status: string) =>
  req(`${API_BASE}/jobs/${id}/status`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ status }),
  })

export const deleteJob = (id: string) =>
  req(`${API_BASE}/jobs/${id}`, { method: 'DELETE' })

/* ── Applications ────────────────────────────────────────────────────── */
export const applyToJob = (jobId: string, coverNote?: string) =>
  req(`${API_BASE}/applications`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ jobId, coverNote }),
  })

export const getCandidateApplications = (candidateId: string) =>
  req(`${API_BASE}/applications/candidate/${candidateId}`)

export const getJobApplications = (jobId: string) =>
  req(`${API_BASE}/applications/job/${jobId}`)

export const getEmployerApplications = (employerId: string) =>
  req(`${API_BASE}/applications/employer/${employerId}`)

export const updateApplicationStatus = (id: string, status: string) =>
  req(`${API_BASE}/applications/${id}/status`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ status }),
  })
