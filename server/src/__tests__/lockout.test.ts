import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  isLocked, recordFailure, recordSuccess,
  beginGlobalAttempt, peekGlobalThrottleDelayMs, clearGlobalThrottle,
} from '../lib/lockout'

/*
 * Pure unit tests for the two lockout primitives — the layered policy built
 * on top of them (per-(account, IP) hard lock + account-wide progressive
 * delay) is exercised at the route level in auth.route.test.ts. These just
 * confirm each building block behaves correctly in isolation.
 */

describe('lockout primitive', () => {
  test('is not locked before any failures', () => {
    const key = `test-fresh-${Date.now()}`
    assert.equal(isLocked(key).locked, false)
  })

  test('locks after reaching maxFailures, not before', () => {
    const key = `test-threshold-${Date.now()}`
    for (let i = 0; i < 4; i++) {
      const r = recordFailure(key, 5, 1000)
      assert.equal(r.lockedNow, false, `attempt ${i + 1} should not lock yet`)
    }
    const fifth = recordFailure(key, 5, 1000)
    assert.equal(fifth.lockedNow, true)
    assert.equal(isLocked(key).locked, true)
  })

  test('a different key is completely unaffected by another key\'s failures', () => {
    const keyA = `test-iso-a-${Date.now()}`
    const keyB = `test-iso-b-${Date.now()}`
    for (let i = 0; i < 5; i++) recordFailure(keyA, 5, 60_000)
    assert.equal(isLocked(keyA).locked, true)
    assert.equal(isLocked(keyB).locked, false, 'an unrelated key must not be locked')
  })

  test('recordSuccess clears the lock state for that key', () => {
    const key = `test-clear-${Date.now()}`
    for (let i = 0; i < 5; i++) recordFailure(key, 5, 60_000)
    assert.equal(isLocked(key).locked, true)
    recordSuccess(key)
    assert.equal(isLocked(key).locked, false)
  })

  test('the lock expires after lockMs elapses', async () => {
    const key = `test-expire-${Date.now()}`
    for (let i = 0; i < 3; i++) recordFailure(key, 3, 50) // 50ms lock
    assert.equal(isLocked(key).locked, true)
    await new Promise((r) => setTimeout(r, 80))
    assert.equal(isLocked(key).locked, false, 'lock should have expired')
  })

  test('a higher-threshold key tolerates more failures than a lower-threshold one', () => {
    const looseKey = `test-loose-${Date.now()}`
    for (let i = 0; i < 10; i++) {
      const r = recordFailure(looseKey, 20, 60_000)
      assert.equal(r.lockedNow, false)
    }
    assert.equal(isLocked(looseKey).locked, false)
  })
})

describe('global progressive-delay throttle', () => {
  /*
   * beginGlobalAttempt() both reserves the attempt AND returns the delay
   * it owes, in one atomic call — this is the race-free replacement for
   * the old separate read-then-record pair (see lib/lockout.ts's comment
   * for the concurrency bug that pairing had). peekGlobalThrottleDelayMs()
   * is read-only, for inspecting state without consuming an attempt.
   */
  test('no delay for attempts within the free-attempt threshold', () => {
    const key = `test-throttle-free-${Date.now()}`
    for (let i = 1; i <= 3; i++) {
      assert.equal(beginGlobalAttempt(key, 3, 10, 1000, 60_000), 0, `attempt ${i} should be free`)
    }
  })

  test('delay grows (and is capped) once the threshold is crossed', () => {
    const key = `test-throttle-grow-${Date.now()}`
    const free = 3
    for (let i = 0; i < free; i++) beginGlobalAttempt(key, free, 10, 1000, 60_000) // still free

    const d1 = beginGlobalAttempt(key, free, 10, 1000, 60_000) // 1st over threshold
    assert.equal(d1, 10, 'first attempt past the threshold should hit the base delay')

    const d2 = beginGlobalAttempt(key, free, 10, 1000, 60_000) // 2nd over threshold
    assert.equal(d2, 20, 'delay should double on the next attempt past the threshold')

    let dCapped = 0
    for (let i = 0; i < 10; i++) dCapped = beginGlobalAttempt(key, free, 10, 1000, 60_000)
    assert.equal(dCapped, 1000, 'delay must never exceed the configured cap, no matter how many attempts')
  })

  test('the throttle decays back to zero after enough quiet time', async () => {
    const key = `test-throttle-decay-${Date.now()}`
    for (let i = 0; i < 10; i++) beginGlobalAttempt(key, 2, 10, 1000, 50) // 50ms decay window
    assert.ok(peekGlobalThrottleDelayMs(key, 2, 10, 1000, 50) > 0, 'should be throttled immediately after failures')
    await new Promise((r) => setTimeout(r, 80))
    assert.equal(peekGlobalThrottleDelayMs(key, 2, 10, 1000, 50), 0, 'should have decayed back to zero')
  })

  test('clearGlobalThrottle removes all accumulated delay immediately', () => {
    const key = `test-throttle-clear-${Date.now()}`
    for (let i = 0; i < 10; i++) beginGlobalAttempt(key, 2, 10, 1000, 60_000)
    assert.ok(peekGlobalThrottleDelayMs(key, 2, 10, 1000, 60_000) > 0)
    clearGlobalThrottle(key)
    assert.equal(peekGlobalThrottleDelayMs(key, 2, 10, 1000, 60_000), 0)
  })

  test('different keys are throttled independently', () => {
    const keyA = `test-throttle-iso-a-${Date.now()}`
    const keyB = `test-throttle-iso-b-${Date.now()}`
    for (let i = 0; i < 10; i++) beginGlobalAttempt(keyA, 2, 10, 1000, 60_000)
    assert.ok(peekGlobalThrottleDelayMs(keyA, 2, 10, 1000, 60_000) > 0)
    assert.equal(peekGlobalThrottleDelayMs(keyB, 2, 10, 1000, 60_000), 0, 'an unrelated key must not be throttled')
  })

  test('concurrent attempts cannot race past each other and read a stale count', async () => {
    // The bug this whole API shape exists to prevent: in the ORIGINAL
    // design, the vulnerable window was between a read and a later write,
    // with other async work (an `await`) able to run in between — so this
    // test must genuinely create multiple callers that are all PENDING,
    // about to call the shared reservation, at the same moment, rather
    // than computing every value upfront in a synchronous pass (which an
    // earlier version of this test mistakenly did via Array.from's eager
    // mapper — Promise.all around already-computed values proves nothing
    // about concurrent callers, since there is nothing left to race by the
    // time Promise.all even runs).
    //
    // Each simulated caller below yields to the event loop at least once
    // (via setImmediate) BEFORE calling the synchronous reservation. All 6
    // callers are created up front, so all 6 are suspended mid-flight,
    // genuinely racing to reach beginGlobalAttempt() once the event loop
    // resumes them — mirroring the real-world scenario of several async
    // request handlers each paused mid-handler, all about to call the
    // shared throttle.
    async function simulatedCaller(key: string, free: number): Promise<number> {
      await new Promise<void>((resolve) => setImmediate(resolve))
      return beginGlobalAttempt(key, free, 10, 100_000, 60_000)
    }

    const key = `test-throttle-concurrent-${Date.now()}`
    const free = 0 // every attempt is already "over threshold", so delays differ visibly
    const delays = await Promise.all(
      Array.from({ length: 6 }, () => simulatedCaller(key, free)),
    )
    const sorted = [...delays].sort((a, b) => a - b)
    // Node still runs each resumed setImmediate callback to completion
    // one at a time — there is no multi-threading here — but UNLIKE the
    // eager version this test replaces, that serialization is doing real
    // work: all 6 callers were genuinely pending simultaneously when the
    // event loop started resuming them, and beginGlobalAttempt() being
    // fully synchronous (no `await` inside it) is what keeps each one
    // atomic once its turn comes. This test locks in exactly that
    // guarantee: 6 geometrically-escalating, non-colliding values, never
    // two concurrently-pending callers sharing a delay.
    assert.deepEqual(sorted, [10, 20, 40, 80, 160, 320])
    assert.equal(new Set(sorted).size, sorted.length, 'every delay must be distinct — a collision means two concurrently-pending callers read the same stale count')
  })
})
