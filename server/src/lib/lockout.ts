/**
 * In-memory lockout store, keyed by an arbitrary caller-chosen string.
 * Survives only in-process (resets on server restart). For multi-instance
 * deployments this would need a shared store (Redis/DB) instead — not added
 * here since this project runs a single instance and the existing CI/CD
 * pipeline already restarts it on every backend deploy; adding a new
 * service just for this would be disproportionate to the actual deployment
 * shape. Documented limitation, not a gap this module can close alone.
 */

const DEFAULT_MAX_FAILURES = 5
const DEFAULT_LOCK_MS      = 15 * 60 * 1000 // 15 minutes

interface State {
  failures:    number
  lockedUntil: number | null
}

const _store = new Map<string, State>()

/** Returns true if the key is currently locked. */
export function isLocked(key: string): { locked: boolean; retryAfterMs?: number } {
  const s = _store.get(key)
  if (!s?.lockedUntil) return { locked: false }

  const remaining = s.lockedUntil - Date.now()
  if (remaining > 0) return { locked: true, retryAfterMs: remaining }

  // Lock has expired
  _store.delete(key)
  return { locked: false }
}

/**
 * Record a failed attempt against `key`. Returns whether this key just
 * became locked. `maxFailures`/`lockMs` let a caller run a looser or
 * tighter policy on a different key for the same event (see auth.ts's
 * admin login, which pairs this per-(account+IP) lock with the account-wide
 * progressive-delay throttle below).
 */
export function recordFailure(
  key: string,
  maxFailures: number = DEFAULT_MAX_FAILURES,
  lockMs: number = DEFAULT_LOCK_MS,
): { lockedNow: boolean; attemptsLeft: number } {
  const s = _store.get(key) ?? { failures: 0, lockedUntil: null }
  s.failures += 1

  if (s.failures >= maxFailures) {
    s.lockedUntil = Date.now() + lockMs
    _store.set(key, s)
    return { lockedNow: true, attemptsLeft: 0 }
  }

  _store.set(key, s)
  return { lockedNow: false, attemptsLeft: maxFailures - s.failures }
}

/** Clear lockout state after a successful login. */
export function recordSuccess(key: string): void {
  _store.delete(key)
}

/*
 * ── Account-wide progressive-delay throttle ──────────────────────────────
 *
 * The per-(account, IP) lock above stops one source from locking the real
 * admin out of their own account — but it hands each IP its own independent
 * failure budget. An attacker who can make requests from many different
 * source addresses (a botnet, a proxy pool) can keep each one just under
 * its own threshold forever, giving them effectively unlimited password
 * guesses against the single admin account.
 *
 * This is deliberately NOT a second hard lock. A lock keyed only on the
 * account (no IP component) is exactly the original vulnerability this
 * engagement fixed: one anonymous, unauthenticated caller could flip it and
 * deny the real admin access from everywhere, indefinitely, by design. Any
 * fix for distributed brute force that reintroduces an account-wide 423
 * reintroduces that same bug under a new name.
 *
 * Instead, this tracks a global failure count per account and turns it into
 * a DELAY — imposed on the attempt against that account once enough global
 * failures have piled up — that:
 *   - is capped (maxDelayMs below): no matter how large the attack, the
 *     real admin is never made to wait longer than this to try again, so
 *     access is slowed, never denied — satisfies "never permanently or
 *     indefinitely deny access";
 *   - decays on its own (decayMs below): a past attack cannot degrade the
 *     login experience forever once it stops, with no manual intervention
 *     needed;
 *   - is cleared immediately on a successful login (see auth.ts), so the
 *     real admin logging in ends the slowdown for everyone, attacker
 *     included, the moment they're back in control.
 *
 * It stacks with bcrypt's own ~100-200ms compare cost (the existing hashing
 * work factor) rather than replacing it — this delay is pure additional
 * cost on top of that, paid once the threshold is crossed, regardless of
 * which IP the attempt comes from.
 *
 * Trade-off accepted: once an attack is large enough to cross the free-
 * attempt threshold, the legitimate admin feels the same capped delay as
 * the attacker on their next login attempt, bounded by maxDelayMs, until
 * either the attack stops (decay) or the admin succeeds (immediate clear).
 * This is judged preferable to either (a) no distributed-attack defense at
 * all, or (b) a hard account-wide lock an anonymous caller can trigger at
 * will.
 */

interface ThrottleState {
  failures:      number
  lastFailureAt: number
}

const _throttle = new Map<string, ThrottleState>()

const GLOBAL_FREE_ATTEMPTS = 10       // no added delay for the first N global failures
const GLOBAL_BASE_DELAY_MS = 500
const GLOBAL_MAX_DELAY_MS  = 30_000   // hard cap — the real admin never waits longer than this
const GLOBAL_DECAY_MS      = 30 * 60 * 1000 // 30 minutes of quiet fully resets the counter

/**
 * Read-only: the delay that the NEXT call to beginGlobalAttempt(key) would
 * return, without changing any state. For tests and diagnostics only — the
 * route itself must use beginGlobalAttempt() instead (see below for why).
 *
 * beginGlobalAttempt() increments BEFORE computing its own delay, so
 * previewing it accurately means mirroring that same decay-then-increment
 * arithmetic here (on a local value, never writing it back) rather than
 * reading today's stored count as-is — the stored count describes the
 * LAST attempt that was made, not the next one that hasn't happened yet.
 */
export function peekGlobalThrottleDelayMs(
  key: string,
  freeAttempts: number = GLOBAL_FREE_ATTEMPTS,
  baseDelayMs: number = GLOBAL_BASE_DELAY_MS,
  maxDelayMs: number = GLOBAL_MAX_DELAY_MS,
  decayMs: number = GLOBAL_DECAY_MS,
): number {
  const s = _throttle.get(key)
  const decayed = !s || Date.now() - s.lastFailureAt > decayMs
  const nextFailures = (decayed ? 0 : s!.failures) + 1
  if (nextFailures <= freeAttempts) return 0
  const n = nextFailures - freeAttempts
  return Math.min(maxDelayMs, baseDelayMs * 2 ** (n - 1))
}

/**
 * Atomically reserve this login attempt against the account-wide throttle
 * and return the delay IT must pay — in one synchronous call with no
 * `await` anywhere inside it.
 *
 * This used to be two separate calls in auth.ts: read the current delay
 * (globalThrottleDelayMs, pre-increment), `await sleep(...)`, then only
 * later — after an async bcrypt compare — record the failure
 * (recordGlobalFailure, post-increment). Node's event loop can interleave
 * other requests at every `await` in between, so two admin-login requests
 * arriving close together (an attacker firing several in parallel rather
 * than waiting for each response, which is exactly how a real attack
 * behaves) could BOTH execute the read before either executed the write —
 * both see the same stale, pre-increment failure count, both compute the
 * same (possibly zero) delay, and both slip through the free-attempt
 * budget that was meant to apply to only one of them.
 *
 * Folding the read and the increment into one function with no `await`
 * closes that window: JavaScript's single-threaded execution model
 * guarantees this entire read-decay-increment-compute sequence runs to
 * completion before the event loop can hand control to any other request,
 * concurrent or not — so the second of two "simultaneous" calls always
 * observes the first one's increment already applied.
 *
 * The one behavioral consequence: the counter now advances on every
 * ATTEMPT against the account (right or wrong), not only on confirmed
 * failures — unavoidable, since the outcome isn't known yet at the point
 * this must run to stay race-free. This cost is small and bounded, not
 * zero: if the admin's own successful login happens to be the one that
 * crosses the free-attempt threshold, THAT login pays the queued delay
 * before succeeding (capped at maxDelayMs, same as any other attempt).
 * It leaves no LASTING trace, though — a genuine admin login still fully
 * clears the throttle on success (see auth.ts), so only that one login
 * can ever be slowed by it, never anything after it.
 */
export function beginGlobalAttempt(
  key: string,
  freeAttempts: number = GLOBAL_FREE_ATTEMPTS,
  baseDelayMs: number = GLOBAL_BASE_DELAY_MS,
  maxDelayMs: number = GLOBAL_MAX_DELAY_MS,
  decayMs: number = GLOBAL_DECAY_MS,
): number {
  const now = Date.now()
  const s   = _throttle.get(key) ?? { failures: 0, lastFailureAt: 0 }
  if (now - s.lastFailureAt > decayMs) s.failures = 0 // a stale run starts fresh
  s.failures += 1
  s.lastFailureAt = now
  _throttle.set(key, s)

  if (s.failures <= freeAttempts) return 0
  const n = s.failures - freeAttempts
  return Math.min(maxDelayMs, baseDelayMs * 2 ** (n - 1))
}

/** Clear the account-wide throttle — called on a successful login. */
export function clearGlobalThrottle(key: string): void {
  _throttle.delete(key)
}
