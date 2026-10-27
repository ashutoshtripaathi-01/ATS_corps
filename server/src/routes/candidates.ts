import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { pool } from '../db'
import { signAccessToken, issueRefreshToken } from '../lib/tokens'
import { requireAuth } from '../middleware/auth'
import { ah } from '../lib/asyncRoute'
import { verifyGoogleIdToken, GoogleAuthError } from '../lib/googleAuth'
import { body } from '../lib/validate'
import { audit, A } from '../lib/audit'
import { logActivity, setApplicationStatus, E } from '../lib/activity'
import {
  S, PAID_STATUSES, REQUIRED_DOCS, DOC_STATUS, statusAfterProfileSaved, registrationFeeRupees,
} from '../lib/applicationStatus'

const router = Router()

/* ── Auth rate limiter: 10 per 15 min per IP ────────────────────────── */
const authLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
})

const emailPasswordSchema = z.object({
  email:    z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

/* ── POST /create-account ───────────────────────────────────────────── */
router.post('/create-account', authLimiter, body(emailPasswordSchema), ah(async (req: Request, res: Response) => {
  const { email, password } = req.body as z.infer<typeof emailPasswordSchema>
  const normalEmail = email.toLowerCase()

  const existing = await pool.query('SELECT id FROM candidates WHERE email=$1', [normalEmail])
  if (existing.rows.length > 0)
    return res.status(409).json({ error: 'An account with this email already exists' })

  const passwordHash = await bcrypt.hash(password, 12)
  // The application record is created together with the account — an applicant
  // exists in the system from this moment on, whether or not they ever pay.
  const result = await pool.query(
    `INSERT INTO candidates (email, password_hash, application_status, last_activity_at)
     VALUES ($1,$2,$3,NOW()) RETURNING *`,
    [normalEmail, passwordHash, S.REGISTERED],
  )

  const c           = result.rows[0]
  const accessToken = signAccessToken({ id: String(c.id), role: 'candidate' })
  await issueRefreshToken(res, String(c.id), 'candidate')
  audit(A.CANDIDATE_REGISTERED, { userId: String(c.id), req, metadata: { email: normalEmail } })
  logActivity(c.id, E.ACCOUNT_CREATED, {
    description: 'Account created', actorType: 'candidate', actorId: String(c.id),
  })

  return res.status(201).json({ success: true, candidate: c, accessToken })
}))

/* ── POST /login ────────────────────────────────────────────────────── */
router.post('/login', authLimiter, body(emailPasswordSchema), ah(async (req: Request, res: Response) => {
  const { email, password } = req.body as z.infer<typeof emailPasswordSchema>
  const normalEmail = email.toLowerCase()

  const result = await pool.query('SELECT * FROM candidates WHERE email=$1', [normalEmail])
  if (result.rows.length === 0 || !result.rows[0].password_hash)
    return res.status(401).json({ error: 'Invalid email or password' })

  const c     = result.rows[0]
  const valid = await bcrypt.compare(password, c.password_hash)
  if (!valid)
    return res.status(401).json({ error: 'Invalid email or password' })

  const accessToken = signAccessToken({ id: String(c.id), role: 'candidate' })
  await issueRefreshToken(res, String(c.id), 'candidate')
  audit(A.LOGIN_SUCCESS, { userId: String(c.id), req, metadata: { via: 'email-password' } })

  return res.json({ success: true, candidate: c, accessToken })
}))

/* ── POST /google ── sign in or sign up with a Google account ───────── */
/*
 * One endpoint serves both login and registration: whether this is a new
 * applicant or a returning one is a fact about our database, not something
 * the client should assert. The response tells the frontend which it was so
 * it can route to the dashboard or into the registration form.
 */
router.post('/google', authLimiter, ah(async (req: Request, res: Response) => {
  const { credential } = req.body as { credential?: string }

  let identity
  try {
    identity = await verifyGoogleIdToken(credential ?? '')
  } catch (e: any) {
    if (e instanceof GoogleAuthError) {
      audit(A.LOGIN_FAILED, { req, metadata: { via: 'google', reason: e.message } })
      return res.status(401).json({ error: e.message })
    }
    throw e
  }

  // Match on Google's subject id first. An email address can be reassigned by
  // a workspace admin, but sub is stable for the life of the account, so it is
  // the stronger identifier.
  let result = await pool.query('SELECT * FROM candidates WHERE google_sub = $1', [identity.sub])
  let isNew = false

  if (result.rows.length === 0) {
    // No Google match — link to an existing password account with the same
    // address. Safe only because Google asserted email_verified, which the
    // verifier refuses to proceed without.
    const byEmail = await pool.query('SELECT * FROM candidates WHERE email = $1', [identity.email])

    if (byEmail.rows.length > 0) {
      result = await pool.query(
        `UPDATE candidates SET
           google_sub       = $1,
           avatar_url       = COALESCE($2, avatar_url),
           full_name        = COALESCE(full_name, $3),
           auth_provider    = CASE WHEN password_hash IS NULL THEN 'google' ELSE 'both' END,
           last_activity_at = NOW(),
           updated_at       = NOW()
         WHERE id = $4
         RETURNING *`,
        [identity.sub, identity.picture ?? null, identity.name ?? null, byEmail.rows[0].id],
      )
      logActivity(result.rows[0].id, E.ACCOUNT_CREATED, {
        description: 'Google account linked to existing registration',
        actorType: 'candidate', actorId: String(result.rows[0].id),
      })
    } else {
      isNew = true
      result = await pool.query(
        `INSERT INTO candidates
           (email, google_sub, full_name, avatar_url, auth_provider,
            application_status, last_activity_at)
         VALUES ($1,$2,$3,$4,'google',$5,NOW())
         RETURNING *`,
        [identity.email, identity.sub, identity.name ?? null, identity.picture ?? null, S.REGISTERED],
      )
      audit(A.CANDIDATE_REGISTERED, {
        userId: String(result.rows[0].id), req, metadata: { via: 'google' },
      })
      logActivity(result.rows[0].id, E.ACCOUNT_CREATED, {
        description: 'Account created with Google',
        actorType: 'candidate', actorId: String(result.rows[0].id),
      })
    }
  } else {
    // Returning Google user — refresh the profile picture, which rotates.
    result = await pool.query(
      `UPDATE candidates SET
         avatar_url = COALESCE($1, avatar_url), last_activity_at = NOW()
       WHERE id = $2 RETURNING *`,
      [identity.picture ?? null, result.rows[0].id],
    )
  }

  const c           = result.rows[0]
  const accessToken = signAccessToken({ id: String(c.id), role: 'candidate' })
  await issueRefreshToken(res, String(c.id), 'candidate')
  audit(A.LOGIN_SUCCESS, { userId: String(c.id), req, metadata: { via: 'google' } })

  // Never let a password hash leave the server, even though it is null here.
  delete c.password_hash

  return res.status(isNew ? 201 : 200).json({
    success:     true,
    isNew,
    needsProfile: !c.mobile || !c.force || !c.loc1,
    candidate:   c,
    accessToken,
  })
}))

/* ── POST /save-profile ─────────────────────────────────────────────── */
/* Saves the full application and moves it to PAYMENT_PENDING. No payment is
   required to reach this point — the applicant is now durably in the system
   and visible to admins whether or not they go on to pay.                  */
router.post('/save-profile', requireAuth('candidate'), async (req: Request, res: Response) => {
  try {
    const candidateId = Number(req.auth!.id)
    const {
      mobile, force, rank, fullName, unit, retirementDate,
      post, otherPost, gunLicense, loc1, loc2, loc3,
      // applicationFee from the client is intentionally never read here —
      // see the UPDATE below, which derives the fee itself.
    } = req.body as Record<string, string>

    if (!mobile || !force || !rank || !fullName || !unit || !retirementDate || !post || !loc1)
      return res.status(400).json({ error: 'Required fields missing' })
    if (!/^[6-9]\d{9}$/.test(mobile))
      return res.status(400).json({ error: 'Invalid mobile number' })

    // Check for mobile conflict with another candidate
    const conflict = await pool.query(
      'SELECT id FROM candidates WHERE mobile=$1 AND id!=$2',
      [mobile, candidateId],
    )
    if (conflict.rows.length > 0)
      return res.status(409).json({ error: 'This mobile number is already registered with another account' })

    // The fee is derived from the server's own PAYMENTS_ENABLED flag and the
    // fixed amount payments.ts actually charges — never from whatever the
    // client's request body claims. A client sending applicationFee: 0 (or
    // any other value) while payments are on cannot change what gets
    // recorded here, and it has no effect on what Razorpay is told to
    // charge either way, since that was already independent of this field.
    const applicationFee = registrationFeeRupees()

    const result = await pool.query(
      `UPDATE candidates SET
         full_name        = $1,
         mobile           = $2,
         force            = $3,
         rank             = $4,
         unit             = $5,
         retirement_date  = $6,
         post             = $7,
         other_post       = $8,
         gun_license      = $9,
         loc1             = $10,
         loc2             = $11,
         loc3             = $12,
         application_fee  = $13,
         registration_ref = COALESCE(registration_ref,
                              'ATS-' || to_char(NOW(),'YYYY') || '-' || LPAD(id::text,5,'0')),
         last_activity_at = NOW(),
         updated_at       = NOW()
       WHERE id = $14
       RETURNING registration_ref, application_status`,
      [
        fullName, mobile, force, rank, unit, retirementDate,
        post, otherPost || null, gunLicense || null,
        loc1, loc2 || null, loc3 || null,
        applicationFee,
        candidateId,
      ],
    )
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Application not found' })

    const current = result.rows[0].application_status as string | null

    // Only advance while the application is still pre-payment — re-saving
    // after payment must never knock it back a step. With payments off,
    // statusAfterProfileSaved() sends the application straight to
    // DOCUMENTS_PENDING instead of waiting on a step that is switched off.
    if (!current || current === S.REGISTERED || current === S.APPLICATION_STARTED) {
      const next = statusAfterProfileSaved()
      await setApplicationStatus(candidateId, next, {
        actorType: 'candidate', actorId: String(candidateId),
        description: next === S.DOCUMENTS_PENDING
          ? 'Application details submitted — registration free, documents unlocked'
          : 'Application details submitted — awaiting payment',
        force: true,
      })
    }

    logActivity(candidateId, E.APPLICATION_SUBMITTED, {
      description: 'Application details saved',
      actorType: 'candidate', actorId: String(candidateId),
    })

    return res.json({
      success:         true,
      candidateId,
      registrationRef: result.rows[0].registration_ref,
    })
  } catch (e: any) {
    if (e.code === '23505')
      return res.status(409).json({ error: 'Mobile number already registered' })
    console.error('[save-profile]', e)
    return res.status(500).json({ error: 'Failed to save profile' })
  }
})

/* ── PATCH /update-draft ── text-only autosave (no files) ──────────── */
router.patch('/update-draft', requireAuth('candidate'), async (req: Request, res: Response) => {
  try {
    const candidateId = req.auth!.id
    const {
      force, rank, fullName, mobile, unit, retirementDate,
      post, otherPost, gunLicense, loc1, loc2, loc3,
    } = req.body as Record<string, string | undefined>

    await pool.query(
      `UPDATE candidates SET
         full_name       = CASE WHEN length(COALESCE($1 ,'')) > 0 THEN $1  ELSE full_name       END,
         force           = CASE WHEN length(COALESCE($2 ,'')) > 0 THEN $2  ELSE force           END,
         rank            = CASE WHEN length(COALESCE($3 ,'')) > 0 THEN $3  ELSE rank            END,
         mobile          = CASE WHEN $4 ~ '^[6-9][0-9]{9}$'       THEN $4  ELSE mobile          END,
         unit            = CASE WHEN length(COALESCE($5 ,'')) > 0 THEN $5  ELSE unit            END,
         retirement_date = CASE WHEN $6 ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN $6::DATE
                                ELSE retirement_date END,
         post            = CASE WHEN length(COALESCE($7 ,'')) > 0 THEN $7  ELSE post            END,
         other_post      = NULLIF($8 ,''),
         gun_license     = NULLIF($9 ,''),
         loc1            = CASE WHEN length(COALESCE($10,'')) > 0 THEN $10 ELSE loc1            END,
         loc2            = NULLIF($11,''),
         loc3            = NULLIF($12,''),
         last_activity_at = NOW(),
         updated_at      = NOW()
       WHERE id = $13`,
      [
        fullName ?? '', force ?? '', rank ?? '', mobile ?? '',
        unit     ?? '', retirementDate ?? '', post ?? '',
        otherPost  ?? '', gunLicense ?? '',
        loc1 ?? '', loc2 ?? '', loc3 ?? '',
        candidateId,
      ],
    )

    // First meaningful keystroke moves a bare account into an in-progress
    // application, so a half-filled form is already visible to admins. Only
    // REGISTERED advances here — autosaving later must never drag a paid
    // application backwards.
    const cur = await pool.query(
      'SELECT application_status FROM candidates WHERE id = $1',
      [candidateId],
    )
    const status = cur.rows[0]?.application_status as string | null
    if (!status || status === S.REGISTERED) {
      // A failed transition must not break autosave, but it must be visible.
      await setApplicationStatus(candidateId, S.APPLICATION_STARTED, {
        actorType: 'candidate', actorId: String(candidateId),
        description: 'Application started',
      }).catch((e: Error) => console.error('[update-draft] status transition failed:', e.message))
    }

    return res.json({ success: true })
  } catch (e: any) {
    // Autosave errors should not crash the UI — log the real cause server-
    // side, but never hand the client a raw DB/driver message.
    console.error('[update-draft]', e.message)
    return res.status(400).json({ error: 'Could not save your changes. Please try again.' })
  }
})

/* ── GET /me ── the signed-in applicant's full application state ────── */
/* Single source of truth for the candidate dashboard: profile, lifecycle
   status, payment, documents and where to resume.                        */
router.get('/me', requireAuth('candidate'), async (req: Request, res: Response) => {
  try {
    const candidateId = Number(req.auth!.id)

    const [candRes, docsRes, payRes] = await Promise.all([
      pool.query(
        `SELECT id, email, full_name, mobile, force, rank, unit, retirement_date,
                post, other_post, gun_license, loc1, loc2, loc3,
                application_fee, payment_status, registration_status,
                application_status, registration_ref, created_at, updated_at
           FROM candidates WHERE id = $1`,
        [candidateId],
      ),
      pool.query(
        `SELECT id, doc_type, original_name, status, rejection_reason, uploaded_at
           FROM candidate_documents WHERE candidate_id = $1`,
        [candidateId],
      ),
      pool.query(
        `SELECT razorpay_order_id, razorpay_payment_id, amount, currency, status, paid_at
           FROM payment_attempts WHERE candidate_id = $1
          ORDER BY created_at DESC LIMIT 1`,
        [candidateId],
      ),
    ])

    if (candRes.rows.length === 0) return res.status(404).json({ error: 'Not found' })

    const c      = candRes.rows[0]
    const status = c.application_status as string | null
    const paid   = !!status && PAID_STATUSES.includes(status as any)

    const byType     = new Map(docsRes.rows.map((d) => [d.doc_type, d]))
    const docsDone   = REQUIRED_DOCS.filter((t) => byType.has(t)).length
    const docsOk     = REQUIRED_DOCS.filter((t) => byType.get(t)?.status === DOC_STATUS.APPROVED).length
    const profileDone = !!(c.full_name && c.mobile && c.force && c.rank && c.loc1)

    return res.json({
      application: c,
      paid,
      progress: {
        profileComplete:   profileDone,
        documentsRequired: REQUIRED_DOCS.length,
        documentsUploaded: docsDone,
        documentsApproved: docsOk,
      },
      documents:   docsRes.rows,
      lastPayment: payRes.rows[0] ?? null,
    })
  } catch (e: any) {
    console.error('[candidates/me]', e)
    return res.status(500).json({ error: 'Failed to load application' })
  }
})

/* ── GET /admin/stats ── (admin only) ───────────────────────────────── */
router.get('/admin/stats', requireAuth('admin'), async (_req: Request, res: Response) => {
  try {
    const [total, byForce, recent, companies, jobs, pendingPayment, paid] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM candidates'),
      pool.query(`SELECT force, COUNT(*) AS count FROM candidates
                  WHERE force IS NOT NULL GROUP BY force ORDER BY count DESC`),
      pool.query(`SELECT * FROM candidates WHERE full_name IS NOT NULL
                  ORDER BY created_at DESC LIMIT 5`),
      pool.query('SELECT COUNT(*) FROM employers'),
      pool.query('SELECT COUNT(*) FROM jobs'),
      pool.query(`SELECT COUNT(*) FROM candidates
                  WHERE payment_status = 'pending' AND full_name IS NOT NULL`),
      pool.query(`SELECT COUNT(*) FROM candidates WHERE payment_status = 'paid'`),
    ])
    return res.json({
      totalCandidates:  Number(total.rows[0].count),
      totalCompanies:   Number(companies.rows[0].count),
      totalJobs:        Number(jobs.rows[0].count),
      pendingPayment:   Number(pendingPayment.rows[0].count),
      paidCandidates:   Number(paid.rows[0].count),
      byForce:          byForce.rows,
      recentCandidates: recent.rows,
    })
  } catch (e: any) {
    console.error('[candidates/admin-stats]', e)
    return res.status(500).json({ error: 'Failed to load dashboard stats' })
  }
})

/* ── GET /admin/registrations ── (admin only) ───────────────────────── */
router.get('/admin/registrations', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const {
      search = '', status = '', page = '1', limit = '20',
    } = req.query as Record<string, string>
    const pageNum  = Math.max(1, parseInt(page) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20))
    const offset   = (pageNum - 1) * limitNum

    const conds:  string[] = []
    const params: any[]    = []
    let   pi               = 1

    if (search) {
      conds.push(`(c.full_name ILIKE $${pi} OR c.email ILIKE $${pi} OR c.mobile ILIKE $${pi} OR c.force ILIKE $${pi})`)
      params.push(`%${search}%`)
      pi++
    }

    if (status === 'pending') conds.push(`c.payment_status = 'pending' AND c.full_name IS NOT NULL`)
    if (status === 'paid')    conds.push(`c.payment_status = 'paid'`)

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''

    const [rows, countRow] = await Promise.all([
      pool.query(
        `SELECT c.id, c.email, c.full_name, c.mobile, c.force, c.rank, c.post,
                c.loc1, c.application_fee, c.payment_status, c.registration_status,
                c.created_at,
                pa.razorpay_order_id, pa.razorpay_payment_id, pa.paid_at
         FROM candidates c
         LEFT JOIN payment_attempts pa ON pa.candidate_id = c.id AND pa.status = 'paid'
         ${where}
         ORDER BY c.created_at DESC
         LIMIT $${pi} OFFSET $${pi + 1}`,
        [...params, limitNum, offset],
      ),
      pool.query(`SELECT COUNT(*) FROM candidates c ${where}`, params),
    ])

    return res.json({
      registrations: rows.rows,
      total:  Number(countRow.rows[0].count),
      page:   pageNum,
      limit:  limitNum,
    })
  } catch (e: any) {
    console.error('[candidates/admin-registrations]', e)
    return res.status(500).json({ error: 'Failed to load registrations' })
  }
})

/* ── GET /admin/all ── (admin only) ─────────────────────────────────── */
router.get('/admin/all', requireAuth('admin'), async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM candidates ORDER BY created_at DESC')
    return res.json(result.rows)
  } catch (e: any) {
    console.error('[candidates/admin-all]', e)
    return res.status(500).json({ error: 'Failed to load candidates' })
  }
})

/* ── GET /:id ── (owner or admin) ───────────────────────────────────── */
router.get('/:id', requireAuth('candidate', 'admin'), ah(async (req: Request, res: Response) => {
  const auth = req.auth!
  if (auth.role === 'candidate' && auth.id !== req.params.id)
    return res.status(403).json({ error: 'Access denied' })

  const result = await pool.query('SELECT * FROM candidates WHERE id=$1', [req.params.id])
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' })
  return res.json(result.rows[0])
}))

export default router
