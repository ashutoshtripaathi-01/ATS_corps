import crypto from 'crypto'
import Razorpay from 'razorpay'
import { env } from './env'

// Singleton — reset by restarting the server (env vars are read once at startup)
let _rp: Razorpay | null = null

export function getRazorpay(): Razorpay {
  if (_rp) return _rp
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = env()
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in .env')
  }
  _rp = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET })
  return _rp
}

export function verifySignature(orderId: string, paymentId: string, signature: string): boolean {
  const { RAZORPAY_KEY_SECRET } = env()
  if (!RAZORPAY_KEY_SECRET) return false

  const expected = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex')

  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(signature ?? '', 'utf8')

  // timingSafeEqual throws RangeError on a length mismatch, which would take
  // the whole process down on a malformed signature. Compare lengths first —
  // the length of an HMAC digest is not a secret, so this leaks nothing.
  if (a.length !== b.length) return false

  return crypto.timingSafeEqual(a, b)
}

/**
 * Webhook signatures use a SEPARATE secret from the checkout-callback one
 * above (configured independently in the Razorpay dashboard), and are
 * computed over the exact raw request body bytes — not the parsed-then-
 * re-serialized object, which can differ in key order or whitespace and
 * would make the HMAC not match even for a genuine event.
 */
export function verifyWebhookSignature(rawBody: Buffer | string, signature: string): boolean {
  const { RAZORPAY_WEBHOOK_SECRET } = env()
  if (!RAZORPAY_WEBHOOK_SECRET) return false

  const expected = crypto
    .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex')

  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(signature ?? '', 'utf8')
  if (a.length !== b.length) return false

  return crypto.timingSafeEqual(a, b)
}
