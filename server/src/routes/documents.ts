import { Router, Request, Response } from 'express'
import fs from 'fs'
import { pool } from '../db'
import { requireAuth } from '../middleware/auth'
import { upload, uploadErrorMessage, safeResolveUpload } from '../lib/upload'
import { logActivity, setApplicationStatus, touchActivity, E } from '../lib/activity'
import {
  ALL_DOC_TYPES, REQUIRED_DOCS, DOCS_UNLOCKED, DOC_STATUS,
  isDocType, statusFromDocuments,
} from '../lib/applicationStatus'

const router = Router()

/** Shape returned to the candidate: every doc slot, filled or not. */
async function buildDocumentList(candidateId: number) {
  const { rows } = await pool.query(
    `SELECT id, doc_type, original_name, status, rejection_reason, uploaded_at, reviewed_at
       FROM candidate_documents WHERE candidate_id = $1`,
    [candidateId],
  )
  const byType = new Map(rows.map((r) => [r.doc_type, r]))

  return ALL_DOC_TYPES.map((t) => {
    const row = byType.get(t)
    return {
      docType:         t,
      required:        (REQUIRED_DOCS as readonly string[]).includes(t),
      id:              row?.id              ?? null,
      originalName:    row?.original_name   ?? null,
      status:          row?.status          ?? DOC_STATUS.PENDING,
      rejectionReason: row?.rejection_reason ?? null,
      uploadedAt:      row?.uploaded_at     ?? null,
      reviewedAt:      row?.reviewed_at     ?? null,
    }
  })
}

/* ── GET /api/documents/me ── candidate's own document set ──────────── */
router.get('/me', requireAuth('candidate'), async (req: Request, res: Response) => {
  try {
    const candidateId = Number(req.auth!.id)
    const cand = await pool.query(
      'SELECT application_status FROM candidates WHERE id = $1',
      [candidateId],
    )
    if (cand.rows.length === 0) return res.status(404).json({ error: 'Not found' })

    const status   = cand.rows[0].application_status as string | null
    const unlocked = !!status && DOCS_UNLOCKED.includes(status as any)

    return res.json({
      unlocked,
      applicationStatus: status,
      documents: await buildDocumentList(candidateId),
    })
  } catch (e: any) {
    console.error('[documents/me]', e)
    return res.status(500).json({ error: 'Failed to load documents' })
  }
})

/* ── POST /api/documents/me/:docType ── upload or replace ───────────── */
router.post('/me/:docType', requireAuth('candidate'), (req: Request, res: Response) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: uploadErrorMessage(err) })

    const candidateId = Number(req.auth!.id)
    const docType     = req.params.docType

    if (!isDocType(docType))
      return res.status(400).json({ error: `Unknown document type "${docType}"` })
    if (!req.file)
      return res.status(400).json({ error: 'No file received' })

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Documents unlock only after a verified payment.
      const cand = await client.query(
        'SELECT application_status FROM candidates WHERE id = $1 FOR UPDATE',
        [candidateId],
      )
      if (cand.rows.length === 0) {
        await client.query('ROLLBACK')
        return res.status(404).json({ error: 'Application not found' })
      }

      const status = cand.rows[0].application_status as string | null
      if (!status || !DOCS_UNLOCKED.includes(status as any)) {
        await client.query('ROLLBACK')
        return res.status(403).json({
          error: 'Documents unlock after your registration payment is confirmed.',
        })
      }

      // Replacing an existing document: remember the old file so we can bin it
      // only once the transaction has actually committed.
      const prev = await client.query(
        'SELECT file_path FROM candidate_documents WHERE candidate_id = $1 AND doc_type = $2',
        [candidateId, docType],
      )
      const replacing = prev.rows.length > 0

      await client.query(
        `INSERT INTO candidate_documents
           (candidate_id, doc_type, file_path, original_name, status,
            rejection_reason, reviewed_by, reviewed_at, uploaded_at)
         VALUES ($1,$2,$3,$4,$5,NULL,NULL,NULL,NOW())
         ON CONFLICT (candidate_id, doc_type) DO UPDATE SET
           file_path        = EXCLUDED.file_path,
           original_name    = EXCLUDED.original_name,
           status           = EXCLUDED.status,
           rejection_reason = NULL,
           reviewed_by      = NULL,
           reviewed_at      = NULL,
           uploaded_at      = NOW()`,
        [candidateId, docType, req.file.filename, req.file.originalname, DOC_STATUS.UPLOADED],
      )

      // Recompute the application status from the full document set.
      const docs = await client.query(
        'SELECT doc_type, status FROM candidate_documents WHERE candidate_id = $1',
        [candidateId],
      )
      const derived = statusFromDocuments(docs.rows, status)
      if (derived && derived !== status) {
        await setApplicationStatus(candidateId, derived, {
          client, actorType: 'candidate', actorId: String(candidateId),
          description: `Documents ${derived === 'DOCUMENTS_SUBMITTED' ? 'complete' : 'updated'}`,
        })
      }

      logActivity(candidateId, replacing ? E.DOCUMENT_REPLACED : E.DOCUMENT_UPLOADED, {
        description: `${replacing ? 'Replaced' : 'Uploaded'} ${docType.replace(/_/g, ' ')}`,
        actorType: 'candidate', actorId: String(candidateId),
        metadata: { docType }, client,
      })

      await client.query('COMMIT')

      // Safe to delete the superseded file now the new row is durable.
      if (replacing) {
        const old = safeResolveUpload(prev.rows[0].file_path)
        if (old) fs.promises.unlink(old).catch(() => {})
      }

      return res.json({ success: true, documents: await buildDocumentList(candidateId) })
    } catch (e: any) {
      await client.query('ROLLBACK').catch(() => {})
      console.error('[documents/upload]', e)
      return res.status(500).json({ error: 'Failed to save document' })
    } finally {
      client.release()
    }
  })
})

/* ── GET /api/documents/:id/file ── authorised download ─────────────── */
/* Replaces the old public express.static mount. A document is streamed only
   to its owner or to an admin — never to anyone holding the filename.      */
router.get('/:id/file', requireAuth('candidate', 'admin'), async (req: Request, res: Response) => {
  try {
    const auth = req.auth!
    const { rows } = await pool.query(
      `SELECT candidate_id, doc_type, file_path, original_name
         FROM candidate_documents WHERE id = $1`,
      [Number(req.params.id)],
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Document not found' })

    const doc = rows[0]
    if (auth.role === 'candidate' && Number(auth.id) !== doc.candidate_id)
      return res.status(403).json({ error: 'Access denied' })

    const abs = safeResolveUpload(doc.file_path)
    if (!abs || !fs.existsSync(abs))
      return res.status(404).json({ error: 'File is no longer available' })

    // Never let a stored document be interpreted as active content.
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox")
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cache-Control', 'private, no-store')
    return res.sendFile(abs)
  } catch (e: any) {
    console.error('[documents/file]', e)
    return res.status(500).json({ error: 'Failed to read document' })
  }
})

/* ── GET /api/documents/candidate/:id ── admin view of one applicant ── */
router.get('/candidate/:id', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const candidateId = Number(req.params.id)
    if (!Number.isInteger(candidateId)) return res.status(400).json({ error: 'Invalid id' })
    return res.json({ documents: await buildDocumentList(candidateId) })
  } catch (e: any) {
    console.error('[documents/candidate]', e)
    return res.status(500).json({ error: 'Failed to load documents' })
  }
})

/* ── PATCH /api/documents/:id/review ── admin approve / reject ──────── */
router.patch('/:id/review', requireAuth('admin'), async (req: Request, res: Response) => {
  const { action, reason } = req.body as { action?: string; reason?: string }

  if (action !== 'approve' && action !== 'reject')
    return res.status(400).json({ error: 'action must be "approve" or "reject"' })
  if (action === 'reject' && !reason?.trim())
    return res.status(400).json({ error: 'A rejection reason is required' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const found = await client.query(
      'SELECT candidate_id, doc_type FROM candidate_documents WHERE id = $1 FOR UPDATE',
      [Number(req.params.id)],
    )
    if (found.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Document not found' })
    }

    const { candidate_id: candidateId, doc_type: docType } = found.rows[0]
    const adminId  = req.auth!.id
    const approved = action === 'approve'

    await client.query(
      `UPDATE candidate_documents
          SET status = $1, rejection_reason = $2, reviewed_by = $3, reviewed_at = NOW()
        WHERE id = $4`,
      [
        approved ? DOC_STATUS.APPROVED : DOC_STATUS.REJECTED,
        approved ? null : reason!.trim(),
        adminId,
        Number(req.params.id),
      ],
    )

    // A rejection drops the application back so the candidate can re-upload;
    // full approval of every required document moves it to verified.
    const docs = await client.query(
      'SELECT doc_type, status FROM candidate_documents WHERE candidate_id = $1',
      [candidateId],
    )
    const byType = new Map(docs.rows.map((d) => [d.doc_type, d.status]))

    if (!approved) {
      await setApplicationStatus(candidateId, 'DOCUMENTS_REJECTED', {
        client, actorType: 'admin', actorId: adminId, force: true,
        description: `${docType.replace(/_/g, ' ')} rejected`,
      })
    } else if (REQUIRED_DOCS.every((t) => byType.get(t) === DOC_STATUS.APPROVED)) {
      await setApplicationStatus(candidateId, 'DOCUMENTS_VERIFIED', {
        client, actorType: 'admin', actorId: adminId, force: true,
        description: 'All required documents verified',
      })
    }

    logActivity(candidateId, approved ? E.DOCUMENT_APPROVED : E.DOCUMENT_REJECTED, {
      description: `${docType.replace(/_/g, ' ')} ${approved ? 'approved' : `rejected — ${reason!.trim()}`}`,
      actorType: 'admin', actorId: adminId, metadata: { docType }, client,
    })

    await client.query('COMMIT')
    touchActivity(candidateId)

    return res.json({ success: true, documents: await buildDocumentList(candidateId) })
  } catch (e: any) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[documents/review]', e)
    return res.status(500).json({ error: 'Failed to review document' })
  } finally {
    client.release()
  }
})

export default router
