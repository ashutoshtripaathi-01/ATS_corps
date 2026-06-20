import { env } from './env'

/**
 * MSG91 SMS-OTP integration.
 *
 * We generate and store the OTP ourselves (see routes/candidates.ts) and only
 * use MSG91 to *deliver* it over SMS, then verify against our own DB. This
 * keeps full control of expiry, reuse, and rate limiting on our side.
 *
 * Required DLT setup (India): an approved OTP template on MSG91 whose body
 * contains a `##OTP##` variable, e.g. "Your Ex-Serviceman Jobs verification code is
 * ##OTP##. Valid for 10 minutes." MSG91 maps our `otp` value into that slot.
 *
 * Docs: https://docs.msg91.com/otp  (POST /api/v5/otp)
 */

const MSG91_OTP_URL = 'https://control.msg91.com/api/v5/otp'

/** True only when both the auth key and a DLT template id are configured. */
export function isSmsEnabled(): boolean {
  const { MSG91_AUTH_KEY, MSG91_OTP_TEMPLATE_ID } = env()
  return Boolean(MSG91_AUTH_KEY && MSG91_OTP_TEMPLATE_ID)
}

/**
 * Send a pre-generated OTP to an Indian 10-digit mobile via MSG91.
 * Throws on any delivery failure so the caller can surface a 502.
 */
export async function sendOtpSms(mobile: string, otp: string): Promise<void> {
  const { MSG91_AUTH_KEY, MSG91_OTP_TEMPLATE_ID, MSG91_SENDER_ID } = env()

  if (!MSG91_AUTH_KEY || !MSG91_OTP_TEMPLATE_ID) {
    throw new Error('MSG91 is not configured')
  }

  // MSG91 expects the number with country code and no leading +.
  const recipient = mobile.startsWith('91') ? mobile : `91${mobile}`

  const payload: Record<string, string> = {
    template_id: MSG91_OTP_TEMPLATE_ID,
    mobile:      recipient,
    otp,
    // 10-minute validity to match our DB expiry window.
    otp_expiry:  '10',
  }
  if (MSG91_SENDER_ID) payload.sender = MSG91_SENDER_ID

  let res: globalThis.Response
  try {
    res = await fetch(MSG91_OTP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authkey:        MSG91_AUTH_KEY,
      },
      body: JSON.stringify(payload),
      // Don't let a slow provider hang the request forever.
      signal: AbortSignal.timeout(10_000),
    })
  } catch (e) {
    throw new Error(`MSG91 request failed: ${(e as Error).message}`)
  }

  // MSG91 returns 200 with { type: 'success' | 'error', message }.
  const data = (await res.json().catch(() => ({}))) as { type?: string; message?: string }

  if (!res.ok || data.type !== 'success') {
    throw new Error(`MSG91 rejected OTP send: ${data.message ?? `HTTP ${res.status}`}`)
  }
}
