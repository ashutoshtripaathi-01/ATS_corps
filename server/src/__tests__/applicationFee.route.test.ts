import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import http from 'http'

import { pool } from '../db'
import candidatesRouter from '../routes/candidates'
import { signAccessToken } from '../lib/tokens'

/*
 * Regression test for Fix G: the application_fee a candidate's row ends up
 * with must come from the server's own authoritative source
 * (registrationFeeRupees(), derived from PAYMENTS_ENABLED and the same
 * constant payments.ts actually charges) — never from whatever the client
 * puts in the request body.
 */

const TAG = 'feetest'
let server: http.Server
let base: string
let originalPaymentsEnabled: string | undefined

async function mkCandidate(): Promise<number> {
  const n = Date.now() + Math.floor(Math.random() * 100000)
  const r = await pool.query(
    `INSERT INTO candidates (email) VALUES ($1) RETURNING id`,
    [`${TAG}-${n}@test.invalid`],
  )
  return r.rows[0].id
}

const saveProfile = (tok: string, body: Record<string, unknown>) =>
  fetch(`${base}/save-profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
    body: JSON.stringify(body),
  })

const validProfile = (overrides: Record<string, unknown> = {}) => ({
  mobile: `9${String(Date.now()).slice(-9)}`,
  force: 'Army', rank: 'Colonel', fullName: 'Fee Test Candidate', unit: 'Test Unit',
  retirementDate: '2020-01-01', post: 'Guard Unarmed', loc1: 'Guwahati & Around',
  ...overrides,
})

before(async () => {
  originalPaymentsEnabled = process.env.PAYMENTS_ENABLED
  const app = express()
  app.use(express.json())
  app.use('/', candidatesRouter)
  server = http.createServer(app)
  await new Promise<void>((r) => { server.listen(0, r) })
  base = 'http://127.0.0.1:' + (server.address() as any).port
})

after(async () => {
  await new Promise<void>((r) => { server.close(() => r()) })
  if (originalPaymentsEnabled === undefined) delete process.env.PAYMENTS_ENABLED
  else process.env.PAYMENTS_ENABLED = originalPaymentsEnabled
  await pool.query(`DELETE FROM candidates WHERE email LIKE '${TAG}-%'`)
  await pool.end()
})

describe('application_fee is server-derived, not client-supplied', () => {
  test('with payments OFF, a client claiming a nonzero fee still ends up with 0', async () => {
    process.env.PAYMENTS_ENABLED = 'false'
    const id  = await mkCandidate()
    const tok = signAccessToken({ id: String(id), role: 'candidate' })

    const res = await saveProfile(tok, validProfile({ applicationFee: 999999 }))
    assert.equal(res.status, 200)

    const row = await pool.query('SELECT application_fee FROM candidates WHERE id=$1', [id])
    assert.equal(Number(row.rows[0].application_fee), 0)
  })

  test('with payments ON, a client claiming a DIFFERENT fee is overridden by the real fee', async () => {
    process.env.PAYMENTS_ENABLED = 'true'
    const id  = await mkCandidate()
    const tok = signAccessToken({ id: String(id), role: 'candidate' })

    const res = await saveProfile(tok, validProfile({ applicationFee: 1 }))
    assert.equal(res.status, 200)

    const row = await pool.query('SELECT application_fee FROM candidates WHERE id=$1', [id])
    // 500000 paise / 100 = 5000 rupees — the same fixed amount payments.ts
    // actually tells Razorpay to charge, not the client's claimed value of 1.
    assert.equal(Number(row.rows[0].application_fee), 5000)
  })

  test('omitting applicationFee entirely still produces the correct server-derived value', async () => {
    process.env.PAYMENTS_ENABLED = 'true'
    const id  = await mkCandidate()
    const tok = signAccessToken({ id: String(id), role: 'candidate' })

    const res = await saveProfile(tok, validProfile())
    assert.equal(res.status, 200)
    const row = await pool.query('SELECT application_fee FROM candidates WHERE id=$1', [id])
    assert.equal(Number(row.rows[0].application_fee), 5000)
  })
})
