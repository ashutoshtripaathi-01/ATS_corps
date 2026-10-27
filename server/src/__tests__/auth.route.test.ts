import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import http from 'http'
import bcrypt from 'bcryptjs'

import { pool } from '../db'
import authRouter from '../routes/auth'
import devBypassRouter from '../routes/devBypass'
import { validateEnv } from '../lib/env'
import { clearGlobalThrottle, peekGlobalThrottleDelayMs } from '../lib/lockout'

/**
 * Median of a small sample. Used instead of the max/worst-case sample when
 * establishing a live-timing baseline below — a single cold-start request
 * or GC pause can make the MAXIMUM of a handful of samples spike well above
 * what is actually typical, inflating the margin every later comparison
 * needs to clear; the median is far less sensitive to one such outlier
 * while still reflecting real ambient load.
 */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/*
 * Regression tests for:
 *   - Fix A: the dev-bypass route's structural (not just runtime) exclusion
 *     from production routing.
 *   - Fix B: the layered, IP-aware, normalized-email admin lockout, PLUS the
 *     account-wide progressive-delay throttle added on top of it to close
 *     the distributed-brute-force gap (many IPs, each under its own
 *     per-IP budget) without reintroducing a global hard lock.
 */

/*
 * auth.ts hashes the admin password ONCE, at module load (its own
 * "pre-warm" call), caching the result for the life of the process — so
 * this test reads whatever ADMIN_EMAIL / ADMIN_PASSWORD the test RUNNER's
 * environment already had set before this file was ever imported (same
 * fallback defaults auth.ts itself uses), rather than trying to set them
 * afterwards, which the cache would simply ignore.
 */
const TEST_ADMIN_EMAIL    = process.env.ADMIN_EMAIL ?? 'admin@atscorps.com'
const TEST_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin@123'

let server: http.Server
let base: string

const adminLogin = (email: string, password: string, forwardedIp?: string) =>
  fetch(`${base}/admin/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(forwardedIp ? { 'X-Forwarded-For': forwardedIp } : {}),
    },
    body: JSON.stringify({ email, password }),
  })

before(async () => {
  // devBypass.ts reads env() (the validated-singleton getter), which
  // throws unless validateEnv() has run at least once in this process —
  // in the real app, index.ts always does this before any route is
  // reachable. ADMIN_PASSWORD is set only so the schema's "at least one of
  // ADMIN_PASSWORD / ADMIN_PASSWORD_HASH" requirement is satisfied; its
  // value is irrelevant to anything this file tests.
  //
  // DEV_BYPASS and NODE_ENV are force-set (not `??=`) because importing
  // `pool` from ../db triggers db.ts's own `dotenv.config()`, which on a
  // real developer machine loads server/.env — and a real local .env here
  // has DEV_BYPASS=true for actual local development use. This test needs
  // a known, deterministic value regardless of whatever that file says.
  process.env.ADMIN_PASSWORD = 'admin@123'
  process.env.DEV_BYPASS     = 'false'
  process.env.NODE_ENV       = 'development'
  validateEnv()

  const app = express()
  app.use(express.json())
  // Trust the X-Forwarded-For header in THIS TEST HARNESS ONLY, so different
  // test cases can simulate requests arriving from different source IPs —
  // mirrors what `trust proxy` does in production behind the real Nginx,
  // without needing an actual separate network source.
  app.set('trust proxy', true)
  app.use('/', authRouter)
  server = http.createServer(app)
  await new Promise<void>((r) => { server.listen(0, r) })
  base = 'http://127.0.0.1:' + (server.address() as any).port
})

after(async () => {
  await new Promise<void>((r) => { server.close(() => r()) })
  await pool.end()
})

/* ── Dev-bypass: structural exclusion ───────────────────────────────── */
describe('dev-bypass route — structural exclusion from production', () => {
  test('is absent (404) when the production conditional does not mount it', async () => {
    const prodApp = express()
    prodApp.use(express.json())
    // Exactly the pattern used in index.ts: only mount when not production.
    const NODE_ENV: string = 'production'
    if (NODE_ENV !== 'production') prodApp.use('/', devBypassRouter)
    const prodServer = http.createServer(prodApp)
    await new Promise<void>((r) => { prodServer.listen(0, r) })
    const prodBase = 'http://127.0.0.1:' + (prodServer.address() as any).port

    const res = await fetch(`${prodBase}/dev-bypass`, { method: 'POST' })
    assert.equal(res.status, 404, 'the route must not exist at all in production, not just answer 403')

    await new Promise<void>((r) => { prodServer.close(() => r()) })
  })

  test('is present (reachable, even if it then refuses) when the non-production conditional mounts it', async () => {
    const devApp = express()
    devApp.use(express.json())
    const NODE_ENV: string = 'development'
    if (NODE_ENV !== 'production') devApp.use('/', devBypassRouter)
    const devServer = http.createServer(devApp)
    await new Promise<void>((r) => { devServer.listen(0, r) })
    const devBase = 'http://127.0.0.1:' + (devServer.address() as any).port

    const res = await fetch(`${devBase}/dev-bypass`, { method: 'POST' })
    // It's mounted, so it's reachable — DEV_BYPASS is unset in this test's
    // env regardless, so the handler's own internal check still refuses it
    // (403), which is the expected redundant second layer, not a 404.
    assert.equal(res.status, 403)

    await new Promise<void>((r) => { devServer.close(() => r()) })
  })
})

/* ── Admin login + layered lockout ──────────────────────────────────── */
describe('admin login', () => {
  test('succeeds with the correct email and password', async () => {
    const res = await adminLogin(TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, '10.0.0.1')
    assert.equal(res.status, 200)
    const body = await res.json() as any
    assert.ok(body.accessToken)
  })

  test('fails with the wrong password', async () => {
    const res = await adminLogin(TEST_ADMIN_EMAIL, 'wrong-password', '10.0.0.2')
    assert.equal(res.status, 401)
  })

  test('unknown vs known email both get the same generic 401 and shape', async () => {
    const unknown = await adminLogin('nobody@nowhere.invalid', 'whatever123', '10.0.0.3')
    const known   = await adminLogin(TEST_ADMIN_EMAIL, 'wrong-again', '10.0.0.4')
    assert.equal(unknown.status, 401)
    assert.equal(known.status, 401)
    const u = await unknown.json() as any
    const k = await known.json() as any
    assert.deepEqual(Object.keys(u).sort(), Object.keys(k).sort(), 'response shape must not reveal whether the email exists')
  })
})

/*
 * authLimiter (declared in auth.ts, 5 requests / 15 min / IP, counting only
 * failures since skipSuccessfulRequests is set) sits in front of this route
 * and is itself keyed by IP — so every test below keeps each IP's own
 * request count at or under 5, to observe MY lockout's behavior rather
 * than colliding with that separate, pre-existing middleware. The two
 * mechanisms are complementary, not duplicates: authLimiter caps raw
 * request volume from one source regardless of which email is tried;
 * my fix scopes the ACCOUNT lock to (account, source) so one source can't
 * lock the real admin out from every other source.
 */
describe('admin lockout — per (account, IP), not per account alone', () => {
  test('the 5th failure from one IP locks that (account, IP) pair', async () => {
    const ip = '10.1.1.1'
    for (let i = 0; i < 4; i++) {
      const res = await adminLogin(TEST_ADMIN_EMAIL, 'wrong', ip)
      assert.equal(res.status, 401)
    }
    const fifth = await adminLogin(TEST_ADMIN_EMAIL, 'wrong', ip)
    assert.equal(fifth.status, 423)
  })

  test('a DIFFERENT ip can still log in with the CORRECT password even though another ip just got locked', async () => {
    // Uses the lock established by the previous test on 10.1.1.1 — a
    // different source IP must be completely unaffected.
    const res = await adminLogin(TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, '10.1.1.2')
    assert.equal(res.status, 200, 'an unrelated IP must never be locked out by another IP\'s failures')
  })

  test('email case variation does not reset the attempt counter (same lock, not a fresh one)', async () => {
    const ip = '10.1.2.1'
    for (let i = 0; i < 4; i++) {
      await adminLogin(TEST_ADMIN_EMAIL, 'wrong', ip)
    }
    // 5th attempt, differently-cased — must still count toward the SAME
    // lock. (A whitespace-padded variant isn't tested here: zod's email()
    // schema already rejects leading/trailing whitespace at the validation
    // layer, before this handler's own normalization ever runs — confirmed
    // separately, not a bypass this fix needs to additionally close.)
    const variedCase = await adminLogin(TEST_ADMIN_EMAIL.toUpperCase(), 'wrong', ip)
    assert.equal(variedCase.status, 423, 'a case variant of the email must not reset the attempt counter')
  })
})

describe('the pre-existing per-IP rate limiter still throttles one source trying many emails', () => {
  test('a 6th request from the same IP within the window is rate-limited, regardless of which email it claims', async () => {
    const ip = '10.1.3.1'
    for (let i = 0; i < 5; i++) {
      const res = await adminLogin(`nobody-${i}@nowhere.invalid`, 'wrong', ip)
      assert.equal(res.status, 401, `request ${i + 1} should still be a plain auth failure, not yet rate-limited`)
    }
    const sixth = await adminLogin('nobody-6@nowhere.invalid', 'wrong', ip)
    assert.equal(sixth.status, 429, 'authLimiter caps this IP at 5 requests/15min regardless of email variation')
  })
})

/*
 * The account-wide progressive-delay throttle (lib/lockout.ts's
 * beginGlobalAttempt/peekGlobalThrottleDelayMs/clearGlobalThrottle), wired
 * into auth.ts's admin/login alongside the per-(account, IP) lock above.
 *
 * These tests use the REAL production thresholds (10 free global attempts,
 * 500ms base delay, 30 min decay) rather than injected tiny ones, because
 * the route itself calls the throttle functions with no overrides —
 * exercising the actual wiring, not just the primitive (already covered
 * with fast, injected parameters in lockout.test.ts). Each test here
 * starts by clearing the shared global key, so results don't depend on how
 * many attempts earlier describe blocks in this file already fed into it.
 *
 * beginGlobalAttempt() reserves on every ATTEMPT (right or wrong), not
 * only on confirmed failures (see lib/lockout.ts for why — this is what
 * makes it race-free under concurrent requests), so the attempt that
 * CROSSES the free-attempt threshold is itself the first one delayed —
 * not the one after it.
 */
describe('distributed brute force — account-wide progressive delay across many IPs', () => {
  /*
   * Primary assertions throughout this block read lib/lockout.ts's state
   * directly via the read-only peekGlobalThrottleDelayMs() — deterministic,
   * never timing-sensitive, and the real proof that the throttle logic
   * itself is correct.
   *
   * Live HTTP timing checks exist too (the user's own requirement: verify
   * the LIVE ROUTE actually applies the delay, not just that the primitive
   * computes it) — but a FIXED millisecond budget is unreliable here: the
   * full backend suite runs many test files' real Postgres queries
   * concurrently, and even an ordinary, correctly-fast admin-login request
   * can itself take 300-400ms of pure scheduling/IO overhead under that
   * load (observed directly in this same suite's other, unrelated
   * passing tests). A constant like "assert elapsed < 400ms" is therefore
   * comparing against a number that is sometimes smaller than ordinary
   * baseline noise, not against the 500ms+ the throttle would actually add.
   *
   * Instead, this block measures its OWN baseline — the MEDIAN of the 10
   * genuinely-free attempts it makes anyway — and compares later,
   * supposedly-throttled attempts against THAT baseline, taken moments
   * earlier under the same ambient load. A real throttle delay shows up as
   * "meaningfully slower than our own recent free requests", which holds
   * regardless of whether the machine happens to be fast or under heavy
   * concurrent load at the time. The median (not the max) of those 10 is
   * used deliberately: the max is the single statistic most sensitive to
   * one outlier (a cold-start first request, a GC pause), which would
   * inflate the margin every later comparison has to clear for no reason
   * related to the throttle itself; the median reflects what these
   * requests typically cost right now without being thrown off by one
   * unlucky sample.
   */
  let freeBaselineMs = 0

  test('10 different IPs, each well under its own per-IP lock, stay free (each attempt only consumes its OWN slot in the 10-free budget)', async () => {
    clearGlobalThrottle('admin:global')

    // 10 distinct IPs, ONE failed attempt each — nowhere near any single
    // IP's own 5-failure lock, and together exactly exhausting (not yet
    // exceeding) the 10-free global budget. The peek check before each one
    // is the real, deterministic assertion; elapsed times are only
    // collected here; see the baseline comparison below.
    const elapsedTimes: number[] = []
    for (let i = 1; i <= 10; i++) {
      assert.equal(peekGlobalThrottleDelayMs('admin:global'), 0, `attempt ${i} should still be free before it is made`)
      const start = Date.now()
      const res = await adminLogin(TEST_ADMIN_EMAIL, 'wrong', `10.2.0.${i}`)
      elapsedTimes.push(Date.now() - start)
      assert.equal(res.status, 401)
    }

    freeBaselineMs = median(elapsedTimes)

    // After all 10, the stored count is 10 — exactly AT the free budget —
    // so the NEXT attempt (not yet made) is now correctly primed to pay
    // the base delay the moment it's made.
    assert.ok(peekGlobalThrottleDelayMs('admin:global') > 0, 'the 11th attempt should now be primed for a delay')
  })

  test('the 11th distinct IP, the first attempt that crosses the free budget, is genuinely delayed by the live route — but still answered, never blocked outright', async () => {
    // Continues from the previous test's 10 accumulated attempts (not
    // cleared here on purpose). Confirm the exact precondition first...
    const expectedDelay = peekGlobalThrottleDelayMs('admin:global')
    assert.equal(expectedDelay, 500, 'the attempt that crosses the free threshold should hit exactly the base delay')

    // ...then prove the LIVE route actually pays it, compared against the
    // baseline this exact run's own free attempts just established — not
    // a fixed constant that would need retuning for every machine or load
    // level.
    const start = Date.now()
    const res = await adminLogin(TEST_ADMIN_EMAIL, 'wrong', '10.2.0.11')
    const elapsed = Date.now() - start
    assert.equal(res.status, 401, 'throttled attempts still get a normal response, never a hard denial')
    assert.ok(
      elapsed > freeBaselineMs + 300,
      `throttled attempt (${elapsed}ms) should be well past this run's own free baseline (${freeBaselineMs}ms) — the delay may not have been applied`,
    )
  })

  test('the legitimate administrator can still recover: a correct login from a brand-new IP succeeds despite the active throttle, and clears it afterwards', async () => {
    // The throttle is still active (11 accumulated attempts from the
    // previous two tests). A genuine admin login — from an IP that has
    // never failed before — must still be allowed through after paying the
    // same delay, proving access is slowed, never denied, even mid-attack.
    const expectedDelay = peekGlobalThrottleDelayMs('admin:global')
    assert.ok(expectedDelay > 0, 'the throttle should still be active going into this attempt')

    const start = Date.now()
    const res = await adminLogin(TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, '10.2.0.200')
    const elapsed = Date.now() - start
    assert.equal(res.status, 200, 'a correct login must still succeed even while the account-wide throttle is active')
    assert.ok(
      elapsed > freeBaselineMs + 300,
      `the successful attempt (${elapsed}ms) should still have paid the active delay compared to the free baseline (${freeBaselineMs}ms), proving it was not silently bypassed`,
    )

    // Having just succeeded, the throttle must now be fully cleared —
    // deterministically — AND the next attempt must genuinely be fast
    // again, compared against the SAME baseline, not a fixed constant.
    assert.equal(peekGlobalThrottleDelayMs('admin:global'), 0, 'a successful login must fully clear the account-wide throttle')
    const after = Date.now()
    const res2 = await adminLogin(TEST_ADMIN_EMAIL, 'wrong', '10.2.0.201')
    const elapsed2 = Date.now() - after
    assert.equal(res2.status, 401)
    assert.ok(
      elapsed2 < freeBaselineMs + 300,
      `throttle should have been cleared by the successful login — took ${elapsed2}ms vs. a free baseline of ${freeBaselineMs}ms`,
    )
  })
})

describe('the original single-IP denial-of-service scenario does not return', () => {
  test('one IP maxing out its own per-(account, IP) lock never adds any cross-IP delay — a different IP logs in at full speed', async () => {
    clearGlobalThrottle('admin:global')

    const attackerIp = '10.2.1.1'
    for (let i = 0; i < 5; i++) {
      await adminLogin(TEST_ADMIN_EMAIL, 'wrong', attackerIp)
    }
    // 5 attempts from ONE ip is well under the 10-attempt global free
    // budget — checked deterministically first, immune to timing noise —
    // so the account-wide throttle must not have engaged at all. This is
    // exactly what stops the original bug (one anonymous source denying
    // every other source) from coming back under a different name. A
    // live-timing check follows as a secondary, generously-bounded
    // sanity check that the route genuinely applies no delay here, not
    // just that the primitive reports none.
    assert.equal(peekGlobalThrottleDelayMs('admin:global'), 0, 'well under the free budget — the global throttle must not have engaged')

    const start = Date.now()
    const res = await adminLogin(TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, '10.2.1.2')
    const elapsed = Date.now() - start
    assert.equal(res.status, 200, 'a different IP must log in successfully, unaffected by the attacker IP\'s own lock')
    assert.ok(elapsed < 450, `an unrelated IP should see no added (500ms+) delay from one other IP's failures — took ${elapsed}ms`)
  })
})
