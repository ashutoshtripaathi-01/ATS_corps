import { Router, Request, Response } from 'express'
import fs from 'fs'
import path from 'path'
import { pool } from '../db'
import { requireAuth } from '../middleware/auth'
import { upload, uploadErrorMessage, safeResolveUpload, checkFileSignature } from '../lib/upload'
import {
  isS3Path, s3KeyFromPath, toStoredPath, buildObjectKey,
  putObject, getObjectStream, deleteObject, isNotFound,
} from '../lib/storage'
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

    // The extension and MIME type both come from the client. The leading
    // bytes do not, so they are checked against the claimed extension.
    const mismatch = checkFileSignature(req.file.buffer, req.file.originalname)
    if (mismatch) return res.status(400).json({ error: mismatch })

    // Set once the object is in S3, so a later failure can bin the orphan.
    let uploadedKey: string | null = null

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

      /*
       * The object is written to S3 before the row is committed, deliberately.
       * Committing first and uploading after would leave a row pointing at an
       * object that does not exist if the upload failed. This way the only
       * failure mode is an orphaned object, which costs a little storage and
       * is cleaned up below — never a broken download for the candidate.
       */
      const ext = path.extname(req.file.originalname).toLowerCase()
      const key = buildObjectKey(candidateId, docType, ext)
      await putObject(key, req.file.buffer, req.file.mimetype)
      uploadedKey = key

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
        [candidateId, docType, toStoredPath(key), req.file.originalname, DOC_STATUS.UPLOADED],
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

      /*
       * Only now that the new row is durable is the superseded file removed,
       * and only ever the exact path that was stored on this candidate's own
       * row. Failure to delete is logged and ignored: a leftover object is
       * harmless, whereas failing the request after a successful commit would
       * tell the candidate their upload failed when it did not.
       */
      if (replacing) {
        const oldPath = prev.rows[0].file_path as string
        if (isS3Path(oldPath)) {
          const oldKey = s3KeyFromPath(oldPath)
          if (oldKey && oldKey !== key) {
            deleteObject(oldKey).catch((e: Error) =>
              console.error('[documents] could not remove superseded object:', e.message))
          }
        } else {
          const old = safeResolveUpload(oldPath)
          if (old) fs.promises.unlink(old).catch(() => {})
        }
      }

      return res.json({ success: true, documents: await buildDocumentList(candidateId) })
    } catch (e: any) {
      await client.query('ROLLBACK').catch(() => {})
      // The row never committed, so the object just written is unreferenced.
      if (uploadedKey) {
        deleteObject(uploadedKey).catch((err: Error) =>
          console.error('[documents] could not clean up orphaned object:', err.message))
      }
      // Log the failure, never the file contents or the candidate's data.
      console.error('[documents/upload] failed for candidate', candidateId, '-', e?.message ?? e)
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

    /*
     * Two storage backends, one route. The caller cannot tell them apart and
     * does not need to: the frontend fetches this URL with its access token
     * and turns the response into a blob either way.
     *
     * The bytes are streamed through this server rather than handing out a
     * presigned S3 URL. A redirect to S3 would be cheaper on bandwidth, but
     * the response would carry S3's headers instead of these: the sandbox CSP
     * and nosniff below are what stop a stored file being interpreted as
     * active content if it is ever opened directly. Keeping the download
     * behind our own response also means access ends the moment the token
     * does, rather than lasting as long as a signed URL.
     */
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox")
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cache-Control', 'private, no-store')

    const s3Key = s3KeyFromPath(doc.file_path)

    if (s3Key) {
      try {
        const obj = await getObjectStream(s3Key)
        if (obj.contentType)   res.setHeader('Content-Type', obj.contentType)
        if (obj.contentLength) res.setHeader('Content-Length', String(obj.contentLength))
        if (doc.original_name) {
          // Keep only characters that are safe in a header value, rather than
          // stripping dangerous ones: an allow-list cannot be slipped past.
          const safeName = String(doc.original_name).replace(/[^A-Za-z0-9._ -]+/g, '_').slice(0, 120)
          res.setHeader('Content-Disposition', `inline; filename="${safeName}"`)
        }

        obj.body.on('error', (e: Error) => {
          console.error('[documents] stream failed for document', req.params.id, '-', e.message)
          if (!res.headersSent) res.status(502).json({ error: 'Could not read the document' })
          else res.destroy()
        })

        return obj.body.pipe(res)
      } catch (e: any) {
        if (isNotFound(e)) {
          console.error('[documents] object missing for document', req.params.id)
          return res.status(404).json({ error: 'File is no longer available' })
        }
        throw e
      }
    }

    // Legacy document written to this instance's disk before the move to S3.
    // These rows are never rewritten, so they keep working untouched.
    const abs = safeResolveUpload(doc.file_path)
    if (!abs || !fs.existsSync(abs))
      return res.status(404).json({ error: 'File is no longer available' })

    return res.sendFile(abs)
  } catch (e: any) {
    console.error('[documents/file] document', req.params.id, '-', e?.message ?? e)
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
