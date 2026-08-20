import { Router, Request, Response } from 'express'
import { getRazorpay } from '../lib/razorpay'
import { env } from '../lib/env'

const router = Router()

// ₹1 registration fee for live testing (100 paise — Razorpay minimum)
const REGISTRATION_FEE_PAISE = 100

/* ── POST /api/payments/create-order ────────────────────────────────── */
router.post('/create-order', async (_req: Request, res: Response) => {
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = env()
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return res.status(503).json({ error: 'Payment service not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to server/.env' })
  }

  try {
    const rp    = getRazorpay()
    const order = await rp.orders.create({
      amount:   REGISTRATION_FEE_PAISE,
      currency: 'INR',
      receipt:  `ats_${Date.now()}`,
    })
    return res.json({ orderId: order.id, amount: REGISTRATION_FEE_PAISE, currency: 'INR' })
  } catch (e: any) {
    console.error('[payments/create-order]', e)
    return res.status(500).json({ error: 'Failed to create payment order', detail: e.message })
  }
})

export default router
