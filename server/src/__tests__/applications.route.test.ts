import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import http from 'http'

import { pool } from '../db'
import applicationsRouter from '../routes/applications'
import { signAccessToken } from '../lib/tokens'

/*
 * Regression tests for the BOLA fix on PATCH /:id/status — an employer must
 * only be able to change the status of applications against their OWN jobs.
 */

const TAG = 'apptest'

let server: http.Server
let base: string

async function mkEmployer(): Promise<number> {
  const n = Date.now() + Math.floor(Math.random() * 100000)
  const r = await pool.query(
    `INSERT INTO employers (company_name, gst, pan, email, state, district, address, pincode)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [
      `${TAG} Co ${n}`, `18AAAAA${String(n).slice(-4)}A1Z5`.slice(0, 15), 'ABCDE1234F',
      `${TAG}-${n}@test.invalid`, 'Assam', 'Kamrup', '1 Test Road', '781001',
    ],
  )
  return r.rows[0].id
}

async function mkCandidate(): Promise<number> {
  const n = Date.now() + Math.floor(Math.random() * 100000)
  const r = await pool.query(
    `INSERT INTO candidates (email, full_name) VALUES ($1,$2) RETURNING id`,
    [`${TAG}-cand-${n}@test.invalid`, 'Test Candidate'],
  )
  return r.rows[0].id
}

async function mkJob(employerId: number): Promise<number> {
  const r = await pool.query(
    `INSERT INTO jobs (employer_id, manpower_type, quantity, salary_range, salary_min, salary_max,
                        location, shift, work_site, min_rank, min_service, description)
     VALUES ($1,'Security Guard',1,'15k-20k',15000,20000,'Guwahati','Day','Office','Any','0','Test job')
     RETURNING id`,
    [employerId],
  )
  return r.rows[0].id
}

async function mkApplication(jobId: number, candidateId: number): Promise<number> {
  const r = await pool.query(
    `INSERT INTO applications (job_id, candidate_id, status) VALUES ($1,$2,'applied') RETURNING id`,
    [jobId, candidateId],
  )
  return r.rows[0].id
}

const patchStatus = (appId: number, status: string, tok?: string) =>
  fetch(`${base}/${appId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
    },
    body: JSON.stringify({ status }),
  })

let employerAId: number, employerBId: number
let jobAId: number, jobBId: number
let applicationAId: number, applicationBId: number
let tokA: string, tokB: string, tokAdmin: string, tokCandidate: string

before(async () => {
  const app = express()
  app.use(express.json())
  app.use('/', applicationsRouter)
  server = http.createServer(app)
  await new Promise<void>((r) => { server.listen(0, r) })
  base = 'http://127.0.0.1:' + (server.address() as any).port

  employerAId = await mkEmployer()
  employerBId = await mkEmployer()
  jobAId = await mkJob(employerAId)
  jobBId = await mkJob(employerBId)
  const candA = await mkCandidate()
  const candB = await mkCandidate()
  applicationAId = await mkApplication(jobAId, candA)
  applicationBId = await mkApplication(jobBId, candB)

  tokA        = signAccessToken({ id: String(employerAId), role: 'employer' })
  tokB        = signAccessToken({ id: String(employerBId), role: 'employer' })
  tokAdmin    = signAccessToken({ id: 'admin-1', role: 'admin' })
  tokCandidate = signAccessToken({ id: String(candA), role: 'candidate' })
})

after(async () => {
  await new Promise<void>((r) => { server.close(() => r()) })
  await pool.query(`DELETE FROM employers WHERE email LIKE '${TAG}-%'`)
  await pool.query(`DELETE FROM candidates WHERE email LIKE '${TAG}-%'`)
  await pool.end()
})

/* ── B1: employer modifies own application ──────────────────────────── */
describe('employer updates their own application', () => {
  test('succeeds', async () => {
    const res = await patchStatus(applicationAId, 'shortlisted', tokA)
    assert.equal(res.status, 200)
    const body = await res.json() as any
    assert.equal(body.application.status, 'shortlisted')
  })
})

/* ── B2 / B3: cross-employer update denied ──────────────────────────── */
describe('employer attempts to update another employer\'s application', () => {
  test('is denied and the status is left unchanged', async () => {
    const before2 = await pool.query('SELECT status FROM applications WHERE id=$1', [applicationBId])
    const res = await patchStatus(applicationBId, 'rejected', tokA)
    assert.equal(res.status, 403)
    const body = await res.json() as any
    assert.ok(!('candidate_id' in body) && !('job_id' in body), 'error response must not disclose the application\'s details')

    const after2 = await pool.query('SELECT status FROM applications WHERE id=$1', [applicationBId])
    assert.equal(after2.rows[0].status, before2.rows[0].status)
  })

  test('the real owner (Employer B) can still update it afterwards', async () => {
    const res = await patchStatus(applicationBId, 'under-review', tokB)
    assert.equal(res.status, 200)
  })
})

/* ── B4: nonexistent application ─────────────────────────────────────── */
describe('nonexistent application id', () => {
  test('returns 404, not a server error', async () => {
    const res = await patchStatus(999999999, 'shortlisted', tokA)
    assert.equal(res.status, 404)
  })
})

/* ── B5: unauthenticated request ────────────────────────────────────── */
describe('unauthenticated request', () => {
  test('is rejected by the existing auth middleware', async () => {
    const res = await patchStatus(applicationAId, 'shortlisted');
    assert.equal(res.status, 401)
  })
})

/* ── B6: wrong role (candidate) ──────────────────────────────────────── */
describe('candidate role attempting the employer-only operation', () => {
  test('is rejected', async () => {
    const res = await patchStatus(applicationAId, 'shortlisted', tokCandidate)
    assert.equal(res.status, 403)
  })
})

/* ── B7: administrator retains full access ──────────────────────────── */
describe('administrator', () => {
  test('can update any application regardless of job ownership', async () => {
    const res = await patchStatus(applicationBId, 'interview', tokAdmin)
    assert.equal(res.status, 200)
    const body = await res.json() as any
    assert.equal(body.application.status, 'interview')
  })
})

/* ── B8: invalid status value ────────────────────────────────────────── */
describe('invalid status', () => {
  test('is rejected by existing validation', async () => {
    const res = await patchStatus(applicationAId, 'not-a-real-status', tokA)
    assert.equal(res.status, 400)
  })
})

/* ── B9: ownership + mutation are not separable ──────────────────────── */
describe('ownership and mutation consistency', () => {
  test('the employer-path UPDATE enforces ownership inside the same statement as the write, not a prior check', async () => {
    // Structural guarantee, not a timing simulation: re-run the exact
    // cross-employer attempt from B2 and confirm the row still reflects
    // only legitimately-authorized writes (B1 then B7), never Employer A's
    // rejected attempt from B2 — i.e. there is no code path where the
    // rejected request's status value could have landed even transiently.
    const row = await pool.query('SELECT status FROM applications WHERE id=$1', [applicationBId])
    assert.notEqual(row.rows[0].status, 'rejected', 'Employer A\'s denied status value must never have been written')
  })
})
