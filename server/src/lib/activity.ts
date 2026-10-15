import { pool } from '../db'
import type { PoolClient } from 'pg'
import { canTransition } from './applicationStatus'

export const E = {
  ACCOUNT_CREATED:     'ACCOUNT_CREATED',
  APPLICATION_STARTED: 'APPLICATION_STARTED',
  APPLICATION_UPDATED: 'APPLICATION_UPDATED',
  APPLICATION_SUBMITTED: 'APPLICATION_SUBMITTED',
  PAYMENT_ATTEMPTED:   'PAYMENT_ATTEMPTED',
  PAYMENT_SUCCESSFUL:  'PAYMENT_SUCCESSFUL',
  PAYMENT_FAILED:      'PAYMENT_FAILED',
  PAYMENT_CANCELLED:   'PAYMENT_CANCELLED',
  DOCUMENT_UPLOADED:   'DOCUMENT_UPLOADED',
  DOCUMENT_REPLACED:   'DOCUMENT_REPLACED',
  DOCUMENT_APPROVED:   'DOCUMENT_APPROVED',
  DOCUMENT_REJECTED:   'DOCUMENT_REJECTED',
  STATUS_CHANGED:      'STATUS_CHANGED',
  ADMIN_CALL_LOGGED:   'ADMIN_CALL_LOGGED',
  ADMIN_NOTE_ADDED:    'ADMIN_NOTE_ADDED',
  OFFICE_VISIT_SCHEDULED: 'OFFICE_VISIT_SCHEDULED',
  OFFICE_VISIT_UPDATED:   'OFFICE_VISIT_UPDATED',
} as const

export type ActivityEvent = typeof E[keyof typeof E]

interface ActivityOpts {
  description?: string
  actorType?:   'candidate' | 'admin' | 'system'
  actorId?:     string
  metadata?:    Record<string, unknown>
  /** Run inside an existing transaction. */
  client?:      PoolClient
}

/**
 * Fire-and-forget activity writer. Mirrors lib/audit.ts: a timeline write must
 * never crash the request that triggered it. Pass `client` to make the write
 * part of a surrounding transaction instead.
 */
export function logActivity(
  candidateId: number | string,
  eventType: ActivityEvent,
  opts: ActivityOpts = {},
): void {
  const runner = opts.client ?? pool
  const p = runner.query(
    `INSERT INTO activity_events
       (candidate_id, event_type, description, actor_type, actor_id, metadata)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      Number(candidateId),
      eventType,
      opts.description ?? null,
      opts.actorType   ?? 'system',
      opts.actorId     ?? null,
      opts.metadata ? JSON.stringify(opts.metadata) : null,
    ],
  )
  // Only swallow errors for standalone writes — inside a transaction the
  // caller owns the failure and must be allowed to roll back.
  if (!opts.client) p.catch((e: Error) => console.error('[Activity] Write failed:', e.message))
}

/** Touch last_activity_at so the admin list can sort by real recency. */
export function touchActivity(candidateId: number | string): void {
  pool.query('UPDATE candidates SET last_activity_at = NOW() WHERE id = $1', [Number(candidateId)])
    .catch((e: Error) => console.error('[Activity] Touch failed:', e.message))
}

export interface TransitionResult {
  ok: boolean
  from: string | null
  to: string
  reason?: string
}

/**
 * Guarded status change. Reads the current status, checks the transition is
 * legal, writes it, and records a timeline entry — all inside one transaction
 * when a client is supplied.
 */
export async function setApplicationStatus(
  candidateId: number | string,
  to: string,
  opts: Omit<ActivityOpts, 'description'> & { description?: string; force?: boolean } = {},
): Promise<TransitionResult> {
  const runner = opts.client ?? pool
  const id = Number(candidateId)

  const cur = await runner.query(
    'SELECT application_status FROM candidates WHERE id = $1 FOR UPDATE',
    [id],
  )
  if (cur.rows.length === 0) return { ok: false, from: null, to, reason: 'Candidate not found' }

  const from = cur.rows[0].application_status as string | null
  if (from === to) return { ok: true, from, to }

  if (!opts.force && !canTransition(from, to))
    return { ok: false, from, to, reason: `Cannot move from ${from ?? 'unset'} to ${to}` }

  // $1 is cast explicitly — it is both assigned to a varchar column and
  // compared as text, and Postgres refuses to deduce two types for one param.
  await runner.query(
    `UPDATE candidates
        SET application_status = $1::text,
            registration_status = CASE
              WHEN $1::text = 'COMPLETED' THEN 'active'
              ELSE registration_status END,
            last_activity_at   = NOW(),
            updated_at         = NOW()
      WHERE id = $2`,
    [to, id],
  )

  logActivity(id, E.STATUS_CHANGED, {
    description: opts.description ?? `Status changed from ${from ?? 'unset'} to ${to}`,
    actorType:   opts.actorType,
    actorId:     opts.actorId,
    metadata:    { from, to, ...(opts.metadata ?? {}) },
    client:      opts.client,
  })

  return { ok: true, from, to }
}
