import { pool } from '../db'

const INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 hours

async function cleanup(): Promise<void> {
  try {
    const result = await pool.query(`
      DELETE FROM refresh_tokens
      WHERE expires_at < NOW()
         OR (revoked = TRUE AND created_at < NOW() - INTERVAL '30 days')
    `)
    const n = result.rowCount ?? 0
    if (n > 0) console.log(`[Cleanup] Removed ${n} stale refresh token(s)`)
  } catch (e) {
    console.error('[Cleanup] Failed:', (e as Error).message)
  }
}

export function startTokenCleanupJob(): void {
  // 10-second delay so DB is fully initialised before first sweep
  const initial = setTimeout(() => {
    void cleanup()
    setInterval(() => void cleanup(), INTERVAL_MS)
  }, 10_000)

  // Don't keep the process alive solely for this timer
  initial.unref()

  console.log('🧹 Refresh-token cleanup scheduled (first run in 10 s, then every 24 h)')
}
