import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  paymentsEnabled, statusAfterProfileSaved, S, PAID_STATUSES, AWAITING_PAYMENT,
} from '../lib/applicationStatus'

/*
 * paymentsEnabled() must read process.env on every call, not once at import
 * time — otherwise flipping the flag would need every module that imported
 * it to be reloaded, which is not how a restart actually behaves.
 */
describe('paymentsEnabled()', () => {
  const original = process.env.PAYMENTS_ENABLED

  test('is false when unset', () => {
    delete process.env.PAYMENTS_ENABLED
    assert.equal(paymentsEnabled(), false)
  })

  test('is false for anything other than the literal string "true"', () => {
    for (const v of ['false', '0', 'TRUE', 'yes', '', 'True']) {
      process.env.PAYMENTS_ENABLED = v
      assert.equal(paymentsEnabled(), v.toLowerCase() === 'true', v)
    }
  })

  test('is true for "true"', () => {
    process.env.PAYMENTS_ENABLED = 'true'
    assert.equal(paymentsEnabled(), true)
  })

  test('flips immediately on the next call — no caching', () => {
    process.env.PAYMENTS_ENABLED = 'true'
    assert.equal(paymentsEnabled(), true)
    process.env.PAYMENTS_ENABLED = 'false'
    assert.equal(paymentsEnabled(), false)
  })

  test.after(() => {
    if (original === undefined) delete process.env.PAYMENTS_ENABLED
    else process.env.PAYMENTS_ENABLED = original
  })
})

describe('statusAfterProfileSaved()', () => {
  test('sends a completed application straight to documents when payments are off', () => {
    process.env.PAYMENTS_ENABLED = 'false'
    assert.equal(statusAfterProfileSaved(), S.DOCUMENTS_PENDING)
  })

  test('routes through payment when payments are on', () => {
    process.env.PAYMENTS_ENABLED = 'true'
    assert.equal(statusAfterProfileSaved(), S.PAYMENT_PENDING)
    process.env.PAYMENTS_ENABLED = 'false'
  })
})

describe('status sets stay internally consistent', () => {
  test('DOCUMENTS_PENDING counts as having cleared payment, whichever path got it there', () => {
    assert.ok(PAID_STATUSES.includes(S.DOCUMENTS_PENDING))
  })

  test('the awaiting-payment states are exactly the ones the free path skips', () => {
    assert.deepEqual(
      [...AWAITING_PAYMENT].sort(),
      [S.PAYMENT_PENDING, S.PAYMENT_FAILED, S.PAYMENT_CANCELLED].sort(),
    )
    for (const s of AWAITING_PAYMENT) assert.ok(!PAID_STATUSES.includes(s), s)
  })
})
