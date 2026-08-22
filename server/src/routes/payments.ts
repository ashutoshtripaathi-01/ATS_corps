import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { getRazorpay, verifySignature } from '../lib/razorpay'
import { env } from '../lib/env'
import { pool } from '../db'
import { requireAuth } from '../middleware/auth'
import { signAccessToken, issueRefreshToken } from '../lib/tokens'
import { body } from '../lib/validate'
import { audit, A } from '../lib/audit'

const router = Router()

// ₹1 registration fee for live testing (100 paise — Razorpay minimum)
const REGISTRATION_FEE_PAISE = 100

/* ── POST /api/payments/create-order ────────────────────────────────── */
router.post('/create-order', requireAuth('candidate'), async (req: Request, res: Response) => {
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = env()
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return res.status(503).json({ error: 'Payment service not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to server/.env' })
  }

  try {
    const candidateId = req.auth!.id
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

    return res.json({ orderId: order.id, amount: REGISTRATION_FEE_PAISE, currency: 'INR' })
  } catch (e: any) {
    console.error('[payments/create-order]', e)
    return res.status(500).json({ error: 'Failed to create payment order', detail: e.message })
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
  const candidateId = req.auth!.id
  const { RAZORPAY_KEY_SECRET } = env()

  if (!RAZORPAY_KEY_SECRET)
    return res.status(503).json({ error: 'Payment service not configured on server' })

  if (!verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature))
    return res.status(400).json({ error: 'Payment verification failed — invalid signature' })

  try {
    // Update the attempt record
    await pool.query(
      `UPDATE payment_attempts SET
         razorpay_payment_id = $1,
         razorpay_signature  = $2,
         status              = 'paid',
         paid_at             = NOW()
       WHERE razorpay_order_id = $3 AND candidate_id = $4`,
      [razorpay_payment_id, razorpay_signature, razorpay_order_id, candidateId],
    )

    // Mark candidate as fully registered
    const result = await pool.query(
      `UPDATE candidates SET
         payment_status      = 'paid',
         registration_status = 'active',
         updated_at          = NOW()
       WHERE id = $1
       RETURNING *`,
      [candidateId],
    )

    const c           = result.rows[0]
    const accessToken = signAccessToken({ id: String(c.id), role: 'candidate' })
    await issueRefreshToken(res, String(c.id), 'candidate')
    audit(A.CANDIDATE_REGISTERED, { userId: String(c.id), req, metadata: { via: 'payment-verify' } })

    return res.json({ success: true, candidate: c, accessToken })
  } catch (e: any) {
    console.error('[payments/verify]', e)
    return res.status(500).json({ error: 'Failed to verify payment', detail: e.message })
  }
})

export default router
