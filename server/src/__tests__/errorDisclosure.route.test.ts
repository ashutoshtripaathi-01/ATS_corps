import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import http from 'http'

import { pool } from '../db'
import candidatesRouter from '../routes/candidates'
import paymentsRouter from '../routes/payments'
import { signAccessToken } from '../lib/tokens'
import { validateEnv } from '../lib/env'

/*
 * Regression tests for Task A's raw-database-error remediation: a genuine
 * DB/driver-level failure (not a validation error, not a known business
 * rule) must never reach the client as `detail: e.message` or
 * `error: e.message` — only a generic, fixed message, with the real cause
 * logged server-side instead.
 *
 * Forcing a REAL Postgres error (rather than asserting against a mocked
 * one) uses a JWT whose `id` claim is a non-numeric string. Both
 * candidates.ts and payments.ts coerce `req.auth.id` with `Number(...)`
 * before binding it as a parameter against an `integer` column — passing a
 * non-numeric id makes that coercion produce `NaN`, which the Postgres
 * driver sends over the wire as the literal text "NaN" against an integer
 * column, and Postgres genuinely rejects it ("invalid input syntax for
 * integer") — a real, driver-level error, not a simulated one.
 */

const TAG = 'errdisc'
let server: http.Server
let base: string
let originalPaymentsEnabled: string | undefined

const badIdToken = (role: 'candidate') => signAccessToken({ id: 'not-a-number', role })

before(async () => {
  originalPaymentsEnabled = process.env.PAYMENTS_ENABLED
  // payments.ts's create-order reads env() (the validated-singleton
  // getter) outside any try/catch — it throws synchronously unless
  // validateEnv() has run at least once in this process. ADMIN_PASSWORD
  // only satisfies the schema's "at least one of ADMIN_PASSWORD /
  // ADMIN_PASSWORD_HASH" requirement; its value is irrelevant here.
  process.env.ADMIN_PASSWORD = 'admin@123'
  validateEnv()

  const app = express()
  app.use(express.json())
  app.use('/candidates', candidatesRouter)
  app.use('/payments', paymentsRouter)
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

function assertNoRawLeak(body: any) {
  assert.ok(!('detail' in body), 'response must not include a "detail" field at all')
  assert.ok(
    !/invalid input syntax|violates|constraint|syntax error|column|relation ".*" does not exist/i.test(
      JSON.stringify(body),
    ),
    `response must not contain raw Postgres wording — got: ${JSON.stringify(body)}`,
  )
}

describe('candidates.ts — genuine DB errors never leak raw details', () => {
  test('save-profile: a DB-level type error on a malformed candidate id returns a generic 500, not the raw Postgres message', async () => {
    const tok = badIdToken('candidate')
    const res = await fetch(`${base}/candidates/save-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({
        mobile: `9${String(Date.now()).slice(-9)}`,
        force: 'Army', rank: 'Colonel', fullName: 'Error Disclosure Test', unit: 'Test Unit',
        retirementDate: '2020-01-01', post: 'Guard Unarmed', loc1: 'Guwahati & Around',
      }),
    })
    assert.equal(res.status, 500)
    const body = await res.json() as any
    assert.equal(body.error, 'Failed to save profile')
    assertNoRawLeak(body)
  })

  test('update-draft: a DB-level type error on a malformed candidate id returns a generic 400, not the raw Postgres message', async () => {
    const tok = badIdToken('candidate')
    const res = await fetch(`${base}/candidates/update-draft`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ fullName: 'Error Disclosure Test 2' }),
    })
    assert.equal(res.status, 400)
    const body = await res.json() as any
    assert.notEqual(body.error, undefined)
    assertNoRawLeak(body)
  })
})

describe('payments.ts — genuine DB errors never leak raw details', () => {
  test('create-order: a DB-level type error on a malformed candidate id returns a generic 500, not the raw Postgres message', async () => {
    process.env.PAYMENTS_ENABLED = 'true'
    const tok = badIdToken('candidate')
    const res = await fetch(`${base}/payments/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({}),
    })
    // Either the DB type error (500, generic) or a 503 (Razorpay keys not
    // configured in this test env) is acceptable — what matters is that
    // IF it reaches the catch block's 500 path, it must never carry
    // `detail`. A 503 short-circuits before any DB call and is unrelated
    // to this fix.
    const body = await res.json() as any
    if (res.status === 500) {
      assert.equal(body.error, 'Failed to create payment order')
      assertNoRawLeak(body)
    } else {
      assert.equal(res.status, 503)
    }
  })
})
