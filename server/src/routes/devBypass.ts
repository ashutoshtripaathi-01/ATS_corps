import { Router, Request, Response } from 'express'
import { signAccessToken, issueRefreshToken } from '../lib/tokens'
import { env } from '../lib/env'
import { pool } from '../db'

/*
 * Developer-only shortcut: creates/finds a fixed test candidate and issues
 * full JWT tokens without requiring normal authentication, OTP, or payment.
 *
 * This used to live as a route inside auth.ts, reachable at
 * /api/auth/dev-bypass in EVERY environment, protected only by a runtime
 * check inside the handler (`DEV_BYPASS !== 'true' || NODE_ENV ===
 * 'production'`). That meant the route's mere EXISTENCE was discoverable in
 * production (it answered 403, not 404 — confirming to a prober that a
 * bypass mechanism exists at all), and its safety depended entirely on two
 * environment variables always being set correctly together. A single
 * misconfiguration — NODE_ENV left as something other than 'production' on
 * the box, or DEV_BYPASS left on from an earlier debugging session — would
 * have reopened a complete, unauthenticated path to a valid candidate
 * session.
 *
 * This router is now registered in index.ts ONLY when NODE_ENV !==
 * 'production' — structurally absent from the production route table, not
 * just runtime-gated. The runtime check below is kept anyway as a second,
 * redundant layer: if this file is ever imported somewhere it shouldn't be,
 * the handler still refuses to do anything in production.
 */

const router = Router()

router.post('/dev-bypass', async (req: Request, res: Response) => {
  const { DEV_BYPASS, NODE_ENV } = env()

  if (DEV_BYPASS !== 'true' || NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Dev bypass is not enabled on this server.' })
  }

  try {
    // Upsert a fixed dev-test candidate so the session has a real DB row
    const result = await pool.query(
      `INSERT INTO candidates (
         full_name, mobile, force, rank, unit, retirement_date,
         post, loc1, application_fee, payment_status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (mobile) DO UPDATE SET
         payment_status = 'dev_bypass',
         updated_at     = NOW()
       RETURNING *`,
      [
        'Dev Tester', '9000000000', 'Army', 'Colonel',
        'Dev Unit', '2020-01-01', 'Security Guard', 'Upper Assam', 0, 'dev_bypass',
      ],
    )

    const c           = result.rows[0]
    const accessToken = signAccessToken({ id: String(c.id), role: 'candidate' })
    await issueRefreshToken(res, String(c.id), 'candidate')

    return res.json({
      accessToken,
      candidate: c,
      _devBypass: true,
    })
  } catch (e: any) {
    console.error('[auth/dev-bypass]', e)
    return res.status(500).json({ error: 'Dev bypass failed' })
  }
})

export default router
