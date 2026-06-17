import { pool } from '../db'
import type { Request } from 'express'

// All auditable actions in the system
export const A = {
  LOGIN_SUCCESS:             'LOGIN_SUCCESS',
  LOGIN_FAILED:              'LOGIN_FAILED',
  ACCOUNT_LOCKED:            'ACCOUNT_LOCKED',
  LOGOUT:                    'LOGOUT',
  REFRESH_TOKEN_ROTATED:     'REFRESH_TOKEN_ROTATED',
  TOKEN_REUSE_DETECTED:      'TOKEN_REUSE_DETECTED',
  CANDIDATE_REGISTERED:      'CANDIDATE_REGISTERED',
  EMPLOYER_REGISTERED:       'EMPLOYER_REGISTERED',
  JOB_POSTED:                'JOB_POSTED',
  JOB_DELETED:               'JOB_DELETED',
  JOB_STATUS_CHANGED:        'JOB_STATUS_CHANGED',
  APPLICATION_SUBMITTED:     'APPLICATION_SUBMITTED',
  APPLICATION_STATUS_CHANGED: 'APPLICATION_STATUS_CHANGED',
} as const

export type AuditAction = typeof A[keyof typeof A]

function extractIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for']
  if (fwd) return (Array.isArray(fwd) ? fwd[0] : fwd).split(',')[0].trim()
  return req.socket?.remoteAddress ?? 'unknown'
}

/**
 * Fire-and-forget audit log writer.
 * Never throws — audit failures must never crash the main request.
 */
export function audit(
  action: AuditAction,
  opts: {
    userId?:  string
    req?:     Request
    metadata?: Record<string, unknown>
  } = {},
): void {
  const ip        = opts.req ? extractIp(opts.req) : null
  const userAgent = opts.req?.headers['user-agent'] ?? null

  pool.query(
    `INSERT INTO audit_logs (user_id, action, ip_address, user_agent, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      opts.userId  ?? null,
      action,
      ip,
      userAgent,
      opts.metadata ? JSON.stringify(opts.metadata) : null,
    ],
  ).catch((e: Error) => console.error('[Audit] Write failed:', e.message))
}
