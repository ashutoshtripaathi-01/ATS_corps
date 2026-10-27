import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import http from 'http'
import crypto from 'crypto'

import { pool } from '../db'
import paymentsRouter from '../routes/payments'
import { S } from '../lib/applicationStatus'
import { validateEnv } from '../lib/env'

/*
 * Regression tests for Fix H (webhook readiness) and Fix G (server-side
 * application fee). Payments must be turned on for payments.ts's own gate
 * to let any of these routes run at all — toggled here, restored after.
 */

const TAG = 'webhooktest'
const WEBHOOK_SECRET = 'test-webhook-secret-not-real'

let server: http.Server
let base: string
let originalPaymentsEnabled: string | undefined
let originalWebhookSecret: string | undefined

async function mkCandidate(status: string): Promise<number> {
  const n = Date.now() + Math.floor(Math.random() * 100000)
  const r = await pool.query(
    `INSERT INTO candidates (email, application_status, last_activity_at)
     VALUES ($1,$2,NOW()) RETURNING id`,
    [`${TAG}-${n}@test.invalid`, status],
  )
  return r.rows[0].id
}

async function mkPaymentAttempt(candidateId: number, orderId: string, amount: number): Promise<void> {
  await pool.query(
    `INSERT INTO payment_attempts (candidate_id, razorpay_order_id, amount, currency, status)
     VALUES ($1,$2,$3,'INR','pending')`,
    [candidateId, orderId, amount],
  )
}

function sign(body: string): string {
  return crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex')
}

function postWebhook(rawBody: string, signature?: string) {
  return fetch(`${base}/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(signature !== undefined ? { 'X-Razorpay-Signature': signature } : {}),
    },
    body: rawBody,
  })
}

function capturedEventBody(orderId: string, paymentId: string, amount: number, currency = 'INR'): string {
  return JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: { id: paymentId, order_id: orderId, amount, currency } } },
  })
}

before(async () => {
  originalPaymentsEnabled = process.env.PAYMENTS_ENABLED
  originalWebhookSecret   = process.env.RAZORPAY_WEBHOOK_SECRET
  process.env.PAYMENTS_ENABLED        = 'true'
  process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET
  // verifyWebhookSignature() reads env() (the validated-singleton getter),
  // which throws synchronously unless validateEnv() has run at least once
  // in this process — in the real app, index.ts always does this before any
  // route is reachable. ADMIN_PASSWORD only satisfies the schema's "at least
  // one of ADMIN_PASSWORD / ADMIN_PASSWORD_HASH" requirement.
  process.env.ADMIN_PASSWORD = 'admin@123'
  validateEnv()

  const app = express()
  // Mirrors index.ts's own json() verify hook — the webhook needs the raw
  // bytes, not a re-serialization of the parsed object.
  app.use(express.json({ verify: (req: any, _res, buf) => { req.rawBody = buf } }))
  app.use('/', paymentsRouter)
  server = http.createServer(app)
  await new Promise<void>((r) => { server.listen(0, r) })
  base = 'http://127.0.0.1:' + (server.address() as any).port
})

after(async () => {
  await new Promise<void>((r) => { server.close(() => r()) })
  if (originalPaymentsEnabled === undefined) delete process.env.PAYMENTS_ENABLED
  else process.env.PAYMENTS_ENABLED = originalPaymentsEnabled
  if (originalWebhookSecret === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET
  else process.env.RAZORPAY_WEBHOOK_SECRET = originalWebhookSecret
  await pool.query(`DELETE FROM candidates WHERE email LIKE '${TAG}-%'`)
  await pool.end()
})

describe('webhook signature verification', () => {
  test('rejects a request with an invalid signature', async () => {
    const body = capturedEventBody('order_fake', 'pay_fake', 500000)
    const res = await postWebhook(body, 'not-a-real-signature')
    assert.equal(res.status, 400)
  })

  test('rejects a request with no signature header at all', async () => {
    const body = capturedEventBody('order_fake2', 'pay_fake2', 500000)
    const res = await postWebhook(body)
    assert.equal(res.status, 400)
  })
})

describe('webhook processing — happy path', () => {
  test('a genuine payment.captured event for a known order marks it paid and advances the candidate', async () => {
    const candId = await mkCandidate(S.PAYMENT_PENDING)
    const orderId = `${TAG}_order_${candId}`
    await mkPaymentAttempt(candId, orderId, 500000)

    const body = capturedEventBody(orderId, `${TAG}_pay_${candId}`, 500000)
    const res = await postWebhook(body, sign(body))
    assert.equal(res.status, 200)

    const attempt = await pool.query('SELECT status FROM payment_attempts WHERE razorpay_order_id=$1', [orderId])
    assert.equal(attempt.rows[0].status, 'paid')

    const cand = await pool.query('SELECT application_status, payment_status FROM candidates WHERE id=$1', [candId])
    assert.equal(cand.rows[0].payment_status, 'paid')
    assert.equal(cand.rows[0].application_status, S.DOCUMENTS_PENDING)
  })
})

describe('webhook idempotency — duplicate delivery', () => {
  test('processing the same captured event twice does not double-process or error', async () => {
    const candId = await mkCandidate(S.PAYMENT_PENDING)
    const orderId = `${TAG}_order_dup_${candId}`
    await mkPaymentAttempt(candId, orderId, 500000)

    const body = capturedEventBody(orderId, `${TAG}_pay_dup_${candId}`, 500000)
    const first  = await postWebhook(body, sign(body))
    const second = await postWebhook(body, sign(body))

    assert.equal(first.status, 200)
    assert.equal(second.status, 200, 'a duplicate delivery must not be treated as an error')

    const attempt = await pool.query('SELECT status FROM payment_attempts WHERE razorpay_order_id=$1', [orderId])
    assert.equal(attempt.rows.length, 1, 'no duplicate payment_attempts row was created')
    assert.equal(attempt.rows[0].status, 'paid')
  })
})

describe('webhook amount verification', () => {
  test('rejects an event whose amount does not match the order that was actually created', async () => {
    const candId = await mkCandidate(S.PAYMENT_PENDING)
    const orderId = `${TAG}_order_mismatch_${candId}`
    await mkPaymentAttempt(candId, orderId, 500000) // real order was for 500000 paise

    const body = capturedEventBody(orderId, `${TAG}_pay_mismatch_${candId}`, 100) // webhook claims 1 paisa
    const res = await postWebhook(body, sign(body))
    assert.equal(res.status, 400)

    const attempt = await pool.query('SELECT status FROM payment_attempts WHERE razorpay_order_id=$1', [orderId])
    assert.equal(attempt.rows[0].status, 'pending', 'must not be marked paid on an amount mismatch')
  })
})

describe('webhook order ownership', () => {
  test('an event for an order this server never created is acknowledged but changes nothing', async () => {
    const body = capturedEventBody('order_never_existed_xyz', 'pay_never_existed', 500000)
    const res = await postWebhook(body, sign(body))
    assert.equal(res.status, 200, 'acknowledged so Razorpay stops retrying')
    const body2 = await res.json() as any
    assert.equal(body2.received, true)
  })

  test('an event cannot mark a DIFFERENT candidate\'s order as paid', async () => {
    const candA = await mkCandidate(S.PAYMENT_PENDING)
    const candB = await mkCandidate(S.PAYMENT_PENDING)
    const orderA = `${TAG}_order_ownerA_${candA}`
    await mkPaymentAttempt(candA, orderA, 500000)

    const body = capturedEventBody(orderA, `${TAG}_pay_ownerA_${candA}`, 500000)
    await postWebhook(body, sign(body))

    const candBRow = await pool.query('SELECT payment_status FROM candidates WHERE id=$1', [candB])
    assert.notEqual(candBRow.rows[0].payment_status, 'paid', 'only the order\'s actual owner (candidate A) may be affected')
  })
})

describe('webhook ignores irrelevant events', () => {
  test('an event type other than payment.captured is acknowledged but does not advance anything', async () => {
    const candId = await mkCandidate(S.PAYMENT_PENDING)
    const orderId = `${TAG}_order_other_${candId}`
    await mkPaymentAttempt(candId, orderId, 500000)

    const body = JSON.stringify({
      event: 'payment.failed',
      payload: { payment: { entity: { id: 'pay_x', order_id: orderId, amount: 500000, currency: 'INR' } } },
    })
    const res = await postWebhook(body, sign(body))
    assert.equal(res.status, 200)

    const attempt = await pool.query('SELECT status FROM payment_attempts WHERE razorpay_order_id=$1', [orderId])
    assert.equal(attempt.rows[0].status, 'pending')
  })
})
