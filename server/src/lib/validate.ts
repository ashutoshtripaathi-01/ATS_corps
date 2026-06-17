import { z } from 'zod'
import type { Request, Response, NextFunction } from 'express'

/**
 * Express middleware that validates req.body against a Zod schema.
 * On failure: responds 400 with structured error details.
 * On success: replaces req.body with the parsed (and potentially transformed) data.
 */
export function body<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: result.error.issues.map((i) => ({
          field:   i.path.join('.') || 'body',
          message: i.message,
        })),
      })
      return
    }
    req.body = result.data as unknown
    next()
  }
}

// ── Reusable field schemas ─────────────────────────────────────────────

export const mobile = z
  .string()
  .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number')

export const otp = z
  .string()
  .regex(/^\d{6}$/, 'OTP must be exactly 6 digits')

export const email = z.string().email('Invalid email address')

export const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')

export const gst = z
  .string()
  .regex(
    /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
    'Invalid GST number format',
  )

export const pan = z
  .string()
  .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN number format')

export const pincode = z
  .string()
  .regex(/^\d{6}$/, 'Pincode must be exactly 6 digits')
