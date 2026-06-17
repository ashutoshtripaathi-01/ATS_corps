/**
 * In-memory account lockout store.
 * Survives only in-process (resets on server restart — acceptable for this project).
 * For multi-instance deployments, replace with Redis or a DB-backed store.
 */

const MAX_FAILURES = 5
const LOCK_MS      = 15 * 60 * 1000 // 15 minutes

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

/** Record a failed login attempt. Returns whether the account just became locked. */
export function recordFailure(key: string): { lockedNow: boolean; attemptsLeft: number } {
  const s = _store.get(key) ?? { failures: 0, lockedUntil: null }
  s.failures += 1

  if (s.failures >= MAX_FAILURES) {
    s.lockedUntil = Date.now() + LOCK_MS
    _store.set(key, s)
    return { lockedNow: true, attemptsLeft: 0 }
  }

  _store.set(key, s)
  return { lockedNow: false, attemptsLeft: MAX_FAILURES - s.failures }
}

/** Clear lockout state after a successful login. */
export function recordSuccess(key: string): void {
  _store.delete(key)
}
