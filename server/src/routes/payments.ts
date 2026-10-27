import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { getRazorpay, verifySignature, verifyWebhookSignature } from '../lib/razorpay'
import { env } from '../lib/env'
import { pool } from '../db'
import { requireAuth } from '../middleware/auth'
import { signAccessToken, issueRefreshToken } from '../lib/tokens'
import { body } from '../lib/validate'
import { audit, A } from '../lib/audit'
import { logActivity, setApplicationStatus, touchActivity, E } from '../lib/activity'
import { S, PAID_STATUSES, paymentsEnabled, REGISTRATION_FEE_PAISE } from '../lib/applicationStatus'

const router = Router()

/*
 * Registration is currently free. Rather than deleting the Razorpay
 * integration, every route in this file is gated behind one flag so it can
 * be brought back later by setting PAYMENTS_ENABLED=true and restarting —
 * no code changes, no redeploy of logic that already works and is tested.
 */
router.use((_req: Request, res: Response, next) => {
  if (!paymentsEnabled()) {
    return res.status(503).json({
      error: 'Registration is currently free — payment is not required.',
    })
  }
  next()
})

/* ── POST /api/payments/create-order ────────────────────────────────── */
router.post('/create-order', requireAuth('candidate'), async (req: Request, res: Response) => {
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = env()
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return res.status(503).json({ error: 'Payment service not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to server/.env' })
  }

  try {
    const candidateId = Number(req.auth!.id)

    // Already-paid protection: never let a second order be raised against an
    // application whose payment has already been verified.
    const cand = await pool.query(
      'SELECT application_status, registration_ref FROM candidates WHERE id = $1',
      [candidateId],
    )
    if (cand.rows.length === 0) return res.status(404).json({ error: 'Application not found' })

    const status = cand.rows[0].application_status as string | null
    if (status && PAID_STATUSES.includes(status as any))
      return res.status(409).json({ error: 'This registration has already been paid for.' })

    const rp    = getRazorpay()
    const order = await rp.orders.create({
      amount:   REGISTRATION_FEE_PAISE,
      currency: 'INR',
      receipt:  `ats_${Date.now()}`,
    })

    // Record the attempt so we can verify it server-side later
    await pool.query(
      `INSERT INTO payment_attempts (candidate_id, razorpay_order_id, amount, currency, status)
       VALUES ($1, $2, $3, 'INR', 'pending')
       ON CONFLICT (razorpay_order_id) DO NOTHING`,
      [candidateId, order.id, REGISTRATION_FEE_PAISE],
    )

    logActivity(candidateId, E.PAYMENT_ATTEMPTED, {
      description: 'Payment started', actorType: 'candidate', actorId: String(candidateId),
      metadata: { orderId: order.id, amount: REGISTRATION_FEE_PAISE },
    })
    touchActivity(candidateId)

    return res.json({ orderId: order.id, amount: REGISTRATION_FEE_PAISE, currency: 'INR' })
  } catch (e: any) {
    console.error('[payments/create-order]', e)
    return res.status(500).json({ error: 'Failed to create payment order' })
  }
})

/* ── POST /api/payments/abandon ─────────────────────────────────────── */
/* The applicant closed or failed the Razorpay dialog. This records what
   happened — it never deletes or downgrades the saved application.        */
const abandonSchema = z.object({
  razorpay_order_id: z.string().min(1).optional(),
  reason:            z.enum(['cancelled', 'failed']),
  detail:            z.string().max(500).optional(),
})

router.post('/abandon', requireAuth('candidate'), body(abandonSchema), async (req: Request, res: Response) => {
  const { razorpay_order_id, reason, detail } = req.body as z.infer<typeof abandonSchema>
  const candidateId = Number(req.auth!.id)

  try {
    const cand = await pool.query(
      'SELECT application_status FROM candidates WHERE id = $1',
      [candidateId],
    )
    const status = cand.rows[0]?.application_status as string | null

    // A verified payment always wins over a late-arriving abandon call.
    if (status && PAID_STATUSES.includes(status as any))
      return res.json({ success: true, ignored: true })

    if (razorpay_order_id) {
      await pool.query(
        `UPDATE payment_attempts SET status = $1
          WHERE razorpay_order_id = $2 AND candidate_id = $3 AND status = 'pending'`,
        [reason, razorpay_order_id, candidateId],
      )
    }

    await setApplicationStatus(
      candidateId,
      reason === 'cancelled' ? S.PAYMENT_CANCELLED : S.PAYMENT_FAILED,
      {
        actorType: 'candidate', actorId: String(candidateId), force: true,
        description: reason === 'cancelled'
          ? 'Payment cancelled by applicant — application saved'
          : 'Payment failed — application saved',
      },
    )

    logActivity(candidateId, reason === 'cancelled' ? E.PAYMENT_CANCELLED : E.PAYMENT_FAILED, {
      description: detail || (reason === 'cancelled' ? 'Applicant closed the payment window' : 'Payment attempt failed'),
      actorType: 'candidate', actorId: String(candidateId),
      metadata: { orderId: razorpay_order_id ?? null },
    })
    touchActivity(candidateId)

    return res.json({ success: true })
  } catch (e: any) {
    console.error('[payments/abandon]', e)
    // Never surface this as a hard failure — the application is safe either way.
    return res.json({ success: false })
  }
})

/* ── POST /api/payments/verify ──────────────────────────────────────── */
const verifySchema = z.object({
  razorpay_order_id:   z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature:  z.string().min(1),
})

router.post('/verify', requireAuth('candidate'), body(verifySchema), async (req: Request, res: Response) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    req.body as z.infer<typeof verifySchema>
  const candidateId = Number(req.auth!.id)
  const { RAZORPAY_KEY_SECRET } = env()

  if (!RAZORPAY_KEY_SECRET)
    return res.status(503).json({ error: 'Payment service not configured on server' })

  // The signature is the only thing that proves payment. Never trust a
  // frontend success flag.
  if (!verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature))
    return res.status(400).json({ error: 'Payment verification failed — invalid signature' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // The order must belong to this candidate — a valid signature for someone
    // else's order must not upgrade this account.
    const attempt = await client.query(
      `SELECT candidate_id, status FROM payment_attempts
        WHERE razorpay_order_id = $1 FOR UPDATE`,
      [razorpay_order_id],
    )
    if (attempt.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Unknown payment order' })
    }
    if (attempt.rows[0].candidate_id !== candidateId) {
      await client.query('ROLLBACK')
      audit(A.LOGIN_FAILED, {
        userId: String(candidateId), req,
        metadata: { reason: 'payment_order_owner_mismatch', orderId: razorpay_order_id },
      })
      return res.status(403).json({ error: 'This payment does not belong to your application' })
    }

    await client.query(
      `UPDATE payment_attempts SET
         razorpay_payment_id = $1,
         razorpay_signature  = $2,
         status              = 'paid',
         paid_at             = COALESCE(paid_at, NOW())
       WHERE razorpay_order_id = $3 AND candidate_id = $4`,
      [razorpay_payment_id, razorpay_signature, razorpay_order_id, candidateId],
    )

    const cur = await client.query(
      'SELECT application_status FROM candidates WHERE id = $1 FOR UPDATE',
      [candidateId],
    )
    const before      = cur.rows[0]?.application_status as string | null
    const alreadyPaid = !!before && PAID_STATUSES.includes(before as any)

    // Idempotent: a refresh or double-submit re-verifies the same order
    // without advancing the application a second time.
    if (!alreadyPaid) {
      await client.query(
        `UPDATE candidates SET payment_status = 'paid', last_activity_at = NOW(), updated_at = NOW()
          WHERE id = $1`,
        [candidateId],
      )
      await setApplicationStatus(candidateId, S.PAYMENT_SUCCESSFUL, {
        client, actorType: 'candidate', actorId: String(candidateId),
        description: 'Payment verified', force: true,
      })
      await setApplicationStatus(candidateId, S.DOCUMENTS_PENDING, {
        client, actorType: 'system',
        description: 'Documents unlocked',
      })
      logActivity(candidateId, E.PAYMENT_SUCCESSFUL, {
        description: 'Payment received and verified',
        actorType: 'candidate', actorId: String(candidateId),
        metadata: { orderId: razorpay_order_id, paymentId: razorpay_payment_id },
        client,
      })
    }

    const result = await client.query('SELECT * FROM candidates WHERE id = $1', [candidateId])
    await client.query('COMMIT')

    const c           = result.rows[0]
    const accessToken = signAccessToken({ id: String(c.id), role: 'candidate' })
    await issueRefreshToken(res, String(c.id), 'candidate')
    audit(A.CANDIDATE_REGISTERED, { userId: String(c.id), req, metadata: { via: 'payment-verify' } })

    return res.json({ success: true, candidate: c, accessToken })
  } catch (e: any) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[payments/verify]', e)
    return res.status(500).json({ error: 'Failed to verify payment' })
  } finally {
    client.release()
  }
})

/* ── POST /api/payments/webhook ── Razorpay server-to-server callback ──
 *
 * /verify above depends on the browser completing a round trip after
 * Razorpay confirms payment — if the connection drops or the tab closes
 * between Razorpay's success and that call reaching us, a genuinely
 * successful payment is never recorded. This route is the safety net:
 * Razorpay calls it directly, independent of the browser, whenever a
 * payment it holds actually captures.
 *
 * No requireAuth() here — Razorpay has no session with this app. Trust
 * comes entirely from the HMAC signature, verified against the RAW request
 * body (see index.ts's `verify` hook) using RAZORPAY_WEBHOOK_SECRET, a
 * secret distinct from RAZORPAY_KEY_SECRET and configured independently in
 * the Razorpay dashboard. Everything else about this handler — which
 * candidate it applies to, what amount was actually ordered — is resolved
 * from this app's own payment_attempts row for the order, never from a
 * claim inside the webhook payload itself.
 */
router.post('/webhook', async (req: Request, res: Response) => {
  const signature = req.headers['x-razorpay-signature']
  if (typeof signature !== 'string' || !req.rawBody) {
    return res.status(400).json({ error: 'Missing signature or body' })
  }
  if (!verifyWebhookSignature(req.rawBody, signature)) {
    console.warn('[payments/webhook] invalid signature')
    return res.status(400).json({ error: 'Invalid signature' })
  }

  let payload: any
  try {
    payload = JSON.parse(req.rawBody.toString('utf8'))
  } catch {
    return res.status(400).json({ error: 'Malformed payload' })
  }

  // Only the event that means money actually moved advances anything.
  // Everything else is acknowledged (so Razorpay stops retrying) but
  // otherwise ignored.
  if (payload?.event !== 'payment.captured') {
    return res.json({ received: true })
  }

  const entity    = payload?.payload?.payment?.entity
  const orderId   = entity?.order_id as string | undefined
  const paymentId = entity?.id as string | undefined
  const amount    = entity?.amount
  const currency  = entity?.currency

  if (!orderId || !paymentId) {
    return res.status(400).json({ error: 'Missing order/payment id in payload' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const attempt = await client.query(
      `SELECT candidate_id, status, amount, currency FROM payment_attempts
        WHERE razorpay_order_id = $1 FOR UPDATE`,
      [orderId],
    )
    if (attempt.rows.length === 0) {
      // Not an order this app created — acknowledge so Razorpay stops
      // retrying, but there is nothing here to mark as paid.
      await client.query('ROLLBACK')
      console.warn('[payments/webhook] unknown order', orderId)
      return res.json({ received: true })
    }

    const row          = attempt.rows[0]
    const candidateId  = row.candidate_id as number

    // The amount/currency Razorpay reports must match what THIS app asked
    // it to charge at order-creation time — never trust the webhook's own
    // claim over the prior server-side record.
    if (Number(amount) !== Number(row.amount) || String(currency) !== String(row.currency)) {
      await client.query('ROLLBACK')
      console.error('[payments/webhook] amount/currency mismatch for order', orderId)
      audit(A.LOGIN_FAILED, { req, metadata: { reason: 'webhook_amount_mismatch', orderId } })
      return res.status(400).json({ error: 'Amount mismatch' })
    }

    // Idempotent by construction — this only ever transitions a row OUT of
    // 'pending'. A duplicate delivery of the same event, or an event that
    // arrives after /verify already marked this order 'paid', matches
    // nothing here and changes nothing.
    if (row.status === 'pending') {
      await client.query(
        `UPDATE payment_attempts SET
           razorpay_payment_id = $1, status = 'paid', paid_at = COALESCE(paid_at, NOW())
         WHERE razorpay_order_id = $2 AND status = 'pending'`,
        [paymentId, orderId],
      )
    }

    const cur = await client.query(
      'SELECT application_status FROM candidates WHERE id = $1 FOR UPDATE',
      [candidateId],
    )
    const before      = cur.rows[0]?.application_status as string | null
    const alreadyPaid = !!before && PAID_STATUSES.includes(before as any)

    if (!alreadyPaid) {
      await client.query(
        `UPDATE candidates SET payment_status = 'paid', last_activity_at = NOW(), updated_at = NOW()
          WHERE id = $1`,
        [candidateId],
      )
      await setApplicationStatus(candidateId, S.PAYMENT_SUCCESSFUL, {
        client, actorType: 'system',
        description: 'Payment confirmed via webhook',
      })
      await setApplicationStatus(candidateId, S.DOCUMENTS_PENDING, {
        client, actorType: 'system',
        description: 'Documents unlocked',
      })
      logActivity(candidateId, E.PAYMENT_SUCCESSFUL, {
        description: 'Payment received and verified via webhook',
        actorType: 'system',
        metadata: { orderId, paymentId },
        client,
      })
    }

    await client.query('COMMIT')
    return res.json({ received: true })
  } catch (e: any) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[payments/webhook]', e?.message ?? e)
    return res.status(500).json({ error: 'Webhook processing failed' })
  } finally {
    client.release()
  }
})

export default router
