/**
 * One-shot schema bootstrap for environments that need the database ready
 * without starting the full HTTP server — specifically CI, where the test
 * suite (src/__tests__/*.test.ts) assumes `candidates`, `candidate_documents`
 * and friends already exist. initDb() is also run automatically by the real
 * server on every boot (server/src/index.ts), using `CREATE TABLE IF NOT
 * EXISTS` throughout, so running it here ahead of time is idempotent and
 * never touches an existing production database's data.
 *
 * Usage: tsx src/scripts/initDb.ts   (see package.json "db:bootstrap")
 */
import { initDb } from '../db'

initDb()
  .then(() => {
    console.log('✅ Schema ready')
    process.exit(0)
  })
  .catch((e) => {
    console.error('❌ Schema bootstrap failed:', e.message)
    process.exit(1)
  })
