import { getToken, setToken } from '@/lib/tokenStore'
export const API_BASE = import.meta.env.VITE_API_URL + '/api'
export const FILES_BASE = import.meta.env.VITE_API_URL + '/uploads/candidates'

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

export const devBypass = () =>
  req<{ accessToken: string; candidate: any; _devBypass: true }>(
    `${API_BASE}/auth/dev-bypass`,
    { method: 'POST' },
    false,
  )

/* ── Payments ────────────────────────────────────────────────────────── */
export const createPaymentOrder = () =>
  req<{ orderId: string; amount: number; currency: string }>(
    `${API_BASE}/payments/create-order`,
    { method: 'POST' },
    false,
  )

/* ── Candidate OTP / Auth ────────────────────────────────────────────── */
export const sendOtp = (mobile: string) =>
  req(`${API_BASE}/candidates/send-otp`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ mobile }),
  })

export const verifyOtp = (mobile: string, otp: string) =>
  req<{ success: boolean; exists: boolean; candidate?: any; accessToken?: string }>(
    `${API_BASE}/candidates/verify-otp`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mobile, otp }) },
  )

// Called after MSG91 widget confirms OTP — issues our JWT without re-verifying OTP
export const widgetLogin = (mobile: string) =>
  req<{ success: boolean; exists: boolean; candidate?: any; accessToken?: string }>(
    `${API_BASE}/candidates/widget-login`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mobile }) },
    false,
  )

export const registerCandidate = (formData: FormData) =>
  req<{ success: boolean; candidate: any; accessToken: string }>(
    `${API_BASE}/candidates/register`,
    { method: 'POST', body: formData },
  )

export const getCandidateProfile = (id: string) =>
  req(`${API_BASE}/candidates/${id}`)

/* ── Admin — Candidates ─────────────────────────────────────────────── */
export const getAdminStats = () =>
  req(`${API_BASE}/candidates/admin/stats`)

export const getAdminCandidates = () =>
  req(`${API_BASE}/candidates/admin/all`)

/* ── Employers ──────────────────────────────────────────────────────── */
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
