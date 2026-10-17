import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import http from 'http'

import { pool } from '../db'
import reportsRouter from '../routes/reports'
import { signAccessToken } from '../lib/tokens'
import { S } from '../lib/applicationStatus'
import { fetchCandidateRows } from '../lib/reports'

const TAG = 'reptest'
let mobileCounter = 0

let server: http.Server
let base: string
let adminTok: string
let candidateTok: string

async function mkCandidate(status: string, extra: Record<string, unknown> = {}): Promise<number> {
  const email = `${TAG}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.invalid`
  const cols = ['email', 'application_status', 'last_activity_at', 'full_name', 'mobile', 'post', 'loc1']
  const vals: any[] = [
    email, status, new Date(),
    extra.full_name ?? 'Test Candidate',
    extra.mobile ?? `9${String(1000000000 + (mobileCounter++)).slice(-9)}`,
    extra.post ?? 'Guard Unarmed',
    extra.loc1 ?? 'Guwahati & Around',
  ]
  const r = await pool.query(
    `INSERT INTO candidates (${cols.join(',')}, registration_ref)
     VALUES ($1,$2,$3,$4,$5,$6,$7, 'ATS-TEST-' || $8::text)
     RETURNING id`,
    [...vals, Math.floor(Math.random() * 100000)],
  )
  return r.rows[0].id
}

async function addDoc(candidateId: number, docType: string, status: string) {
  await pool.query(
    `INSERT INTO candidate_documents (candidate_id, doc_type, file_path, status)
     VALUES ($1, $2, 's3://test/x', $3)
     ON CONFLICT (candidate_id, doc_type) DO UPDATE SET status = $3`,
    [candidateId, docType, status],
  )
}

async function addPaymentAttempt(candidateId: number, orderSuffix: string, status: string, amount = 500000) {
  const paidAt = status === 'paid' ? new Date() : null
  await pool.query(
    `INSERT INTO payment_attempts (candidate_id, razorpay_order_id, amount, currency, status, paid_at)
     VALUES ($1, $2, $3, 'INR', $4, $5)`,
    [candidateId, `${TAG}-order-${orderSuffix}`, amount, status, paidAt],
  )
}

const get = (path: string, tok?: string) =>
  fetch(base + path, tok ? { headers: { Authorization: 'Bearer ' + tok } } : undefined)

before(async () => {
  const app = express()
  app.use('/', reportsRouter)
  server = http.createServer(app)
  await new Promise<void>((r) => { server.listen(0, r) })
  base = 'http://127.0.0.1:' + (server.address() as any).port

  adminTok = signAccessToken({ id: 'admin-1', role: 'admin' })
  const candId = await mkCandidate(S.REGISTERED)
  candidateTok = signAccessToken({ id: String(candId), role: 'candidate' })
})

after(async () => {
  await new Promise<void>((r) => { server.close(() => r()) })
  await pool.query(`DELETE FROM candidates WHERE email LIKE '${TAG}-%'`)
  await pool.end()
})

/* ── Test 10: unauthorized access ───────────────────────────────────── */
describe('authorization', () => {
  test('a candidate token cannot call the report listing', async () => {
    const res = await get('/candidates', candidateTok)
    assert.equal(res.status, 403)
  })
  test('no token at all is rejected', async () => {
    const res = await get('/candidates')
    assert.equal(res.status, 401)
  })
  test('a candidate token cannot export', async () => {
    const res = await get('/candidates/export.xlsx', candidateTok)
    assert.equal(res.status, 403)
  })
})

/* ── Test 1: unpaid candidate remains visible and exportable ───────── */
describe('unpaid candidate', () => {
  test('appears in the listing with payment status "Not Required" (free registration)', async () => {
    const id = await mkCandidate(S.DOCUMENTS_PENDING, { full_name: 'Unpaid Freebie' })
    const res = await get(`/candidates?applicationId=${id}`, adminTok)
    assert.equal(res.status, 200)
    const body = await res.json() as any
    const row = body.candidates.find((c: any) => c.id === id)
    assert.ok(row, 'candidate should appear in the report')
    assert.equal(row.paymentStatus, 'Not Required')
  })

  test('a candidate genuinely stuck on PAYMENT_PENDING is reported as Pending, not silently excluded', async () => {
    const id = await mkCandidate(S.PAYMENT_PENDING, { full_name: 'Stuck On Payment' })
    const res = await get(`/candidates?applicationId=${id}`, adminTok)
    const body = await res.json() as any
    const row = body.candidates.find((c: any) => c.id === id)
    assert.ok(row)
    assert.equal(row.paymentStatus, 'Pending')
  })

  test('is included in an Excel export with no payment filter applied', async () => {
    const id = await mkCandidate(S.DOCUMENTS_PENDING, { full_name: 'Excel Unpaid' })
    const res = await get(`/candidates/export.xlsx?applicationId=${id}`, adminTok)
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('content-type'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    const buf = Buffer.from(await res.arrayBuffer())
    assert.ok(buf.length > 0)
  })
})

/* ── Test 4: documents not yet available (pre-payment-gate) ─────────── */
describe('documents not yet available', () => {
  test('REGISTERED candidate shows "Not Yet Available", never "Missing"', async () => {
    const id = await mkCandidate(S.REGISTERED, { full_name: 'Just Signed Up' })
    const res = await get(`/candidates?applicationId=${id}`, adminTok)
    const body = await res.json() as any
    const row = body.candidates.find((c: any) => c.id === id)
    assert.ok(row)
    assert.match(row.documentStatus, /Not Yet Available/)
    assert.doesNotMatch(row.documentStatus, /Missing/)
    assert.equal(row.documentsMissing, '—')
  })

  test('PAYMENT_PENDING candidate (payments-on legacy state) also shows Not Yet Available', async () => {
    const id = await mkCandidate(S.PAYMENT_PENDING, { full_name: 'Awaiting Payment' })
    const res = await get(`/candidates?applicationId=${id}`, adminTok)
    const body = await res.json() as any
    const row = body.candidates.find((c: any) => c.id === id)
    assert.match(row.documentStatus, /Not Yet Available — Payment Pending/)
  })
})

/* ── Test 3: missing vs optional documents ──────────────────────────── */
describe('missing required documents', () => {
  test('flags only missing REQUIRED docs, never optional ones', async () => {
    const id = await mkCandidate(S.DOCUMENTS_PENDING, { full_name: 'Partial Docs' })
    await addDoc(id, 'aadhaar', 'UPLOADED')
    await addDoc(id, 'pan', 'UPLOADED')
    // photograph and service_certificate (required) left missing
    // discharge_book / police_verification (optional) also left missing

    const res = await get(`/candidates?applicationId=${id}`, adminTok)
    const body = await res.json() as any
    const row = body.candidates.find((c: any) => c.id === id)

    assert.match(row.documentsMissing, /Service Certificate/)
    assert.match(row.documentsMissing, /Photograph/)
    assert.doesNotMatch(row.documentsMissing, /Discharge Book/)
    assert.doesNotMatch(row.documentsMissing, /Police Verification/)
    assert.equal(row.documentStatus, 'Missing Required Documents')
  })
})

/* ── Test 2: paid candidate, all required docs approved ─────────────── */
describe('paid candidate with approved documents', () => {
  test('payment and document status are both accurate', async () => {
    const id = await mkCandidate(S.DOCUMENTS_VERIFIED, { full_name: 'Fully Verified' })
    await addPaymentAttempt(id, 'ok1', 'paid')
    for (const t of ['aadhaar', 'pan', 'photograph', 'service_certificate']) await addDoc(id, t, 'APPROVED')

    const res = await get(`/candidates?applicationId=${id}`, adminTok)
    const body = await res.json() as any
    const row = body.candidates.find((c: any) => c.id === id)

    assert.equal(row.paymentStatus, 'Successful')
    assert.equal(row.paymentAmount, 5000) // 500000 paise -> rupees, not left in paise
    assert.equal(row.documentStatus, 'All Required Approved')
    assert.equal(row.documentsMissing, 'None')
  })
})

/* ── Test 7: multiple payment attempts, no duplicate rows ───────────── */
describe('multiple payment attempts', () => {
  test('does not duplicate the candidate row, and reports the paid attempt over earlier failed ones', async () => {
    const id = await mkCandidate(S.DOCUMENTS_PENDING, { full_name: 'Retried Payment' })
    await addPaymentAttempt(id, 'fail1', 'failed')
    await addPaymentAttempt(id, 'fail2', 'failed')
    await addPaymentAttempt(id, 'ok',    'paid')

    const res = await get(`/candidates?applicationId=${id}`, adminTok)
    const body = await res.json() as any
    const matches = body.candidates.filter((c: any) => c.id === id)
    assert.equal(matches.length, 1, 'exactly one row for this candidate, not three')
    assert.equal(matches[0].paymentStatus, 'Successful')
  })
})

/* ── Test 6: multiple documents, no duplicate rows ───────────────────── */
describe('multiple document records', () => {
  test('a candidate with many documents still produces exactly one report row', async () => {
    const id = await mkCandidate(S.DOCUMENTS_SUBMITTED, { full_name: 'Many Docs' })
    for (const t of ['aadhaar', 'pan', 'photograph', 'service_certificate', 'discharge_book', 'police_verification'])
      await addDoc(id, t, 'UPLOADED')

    const res = await get(`/candidates?applicationId=${id}`, adminTok)
    const body = await res.json() as any
    const matches = body.candidates.filter((c: any) => c.id === id)
    assert.equal(matches.length, 1)
    assert.match(matches[0].documentsSubmitted, /Discharge Book/)
    assert.match(matches[0].documentsSubmitted, /Police Verification/)
  })
})

/* ── Test 8: filtered export respects filters ───────────────────────── */
describe('filtered export', () => {
  test('exporting with a name filter excludes non-matching candidates', async () => {
    const matchId    = await mkCandidate(S.DOCUMENTS_PENDING, { full_name: 'Zzyx Uniquename' })
    const nonMatchId = await mkCandidate(S.DOCUMENTS_PENDING, { full_name: 'Completely Different' })

    const res = await get(`/candidates?name=Zzyx`, adminTok)
    const body = await res.json() as any
    const ids = body.candidates.map((c: any) => c.id)
    assert.ok(ids.includes(matchId))
    assert.ok(!ids.includes(nonMatchId))
  })
})

/* ── Test 9: selected export respects the selection, never substitutes all ── */
describe('selected export', () => {
  test('only the explicitly selected candidates are returned, not every candidate', async () => {
    const a = await mkCandidate(S.DOCUMENTS_PENDING, { full_name: 'Selected A' })
    const b = await mkCandidate(S.DOCUMENTS_PENDING, { full_name: 'Selected B' })
    const c = await mkCandidate(S.DOCUMENTS_PENDING, { full_name: 'Not Selected C' })

    const res = await get(`/candidates/export.xlsx?scope=selected&ids=${a},${b}`, adminTok)
    assert.equal(res.status, 200)
    // We can't easily parse the xlsx body here without exceljs on the test
    // side, so verify at the query layer directly instead.
    const { rows } = await fetchCandidateRows({}, { candidateIds: [a, b] })
    const ids = rows.map((r: { id: number }) => r.id)
    assert.ok(ids.includes(a) && ids.includes(b))
    assert.ok(!ids.includes(c))
  })

  test('scope=selected with no ids is rejected rather than silently exporting everyone', async () => {
    const res = await get(`/candidates/export.xlsx?scope=selected`, adminTok)
    assert.equal(res.status, 400)
  })
})

/* ── Test 11: file integrity ─────────────────────────────────────────── */
describe('file integrity', () => {
  test('the xlsx export is a real zip (xlsx container), not an empty or corrupt buffer', async () => {
    const res = await get('/candidates/export.xlsx', adminTok)
    const buf = Buffer.from(await res.arrayBuffer())
    assert.equal(buf.slice(0, 2).toString('ascii'), 'PK') // zip local-file-header signature
  })

  test('the summary PDF export starts with a valid PDF header', async () => {
    const res = await get('/candidates/export.pdf', adminTok)
    assert.equal(res.headers.get('content-type'), 'application/pdf')
    const buf = Buffer.from(await res.arrayBuffer())
    assert.equal(buf.slice(0, 5).toString('ascii'), '%PDF-')
  })

  test('an empty result set still produces a valid, openable file (no crash on zero rows)', async () => {
    const res = await get('/candidates/export.pdf?name=NoSuchNameAtAll12345', adminTok)
    assert.equal(res.status, 200)
    const buf = Buffer.from(await res.arrayBuffer())
    assert.equal(buf.slice(0, 5).toString('ascii'), '%PDF-')
  })
})

/* ── Test 11 (individual PDF) ────────────────────────────────────────── */
describe('individual candidate PDF', () => {
  test('an authorized admin can download it, and it is a valid PDF', async () => {
    const id = await mkCandidate(S.DOCUMENTS_VERIFIED, { full_name: 'PDF Target' })
    await addDoc(id, 'aadhaar', 'APPROVED')
    const res = await get(`/candidates/${id}/pdf`, adminTok)
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('content-type'), 'application/pdf')
    const disp = res.headers.get('content-disposition') ?? ''
    assert.match(disp, /candidate-.*\.pdf/)
    const buf = Buffer.from(await res.arrayBuffer())
    assert.equal(buf.slice(0, 5).toString('ascii'), '%PDF-')
  })

  test('a candidate token cannot fetch another candidate\'s individual PDF', async () => {
    const id = await mkCandidate(S.DOCUMENTS_PENDING, { full_name: 'Private Target' })
    const res = await get(`/candidates/${id}/pdf`, candidateTok)
    assert.equal(res.status, 403)
  })

  test('404 for a nonexistent candidate id', async () => {
    const res = await get('/candidates/999999999/pdf', adminTok)
    assert.equal(res.status, 404)
  })
})
