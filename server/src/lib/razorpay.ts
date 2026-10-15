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
