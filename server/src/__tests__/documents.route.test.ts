import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import http from 'http'
import { Readable } from 'stream'
import fs from 'fs'
import path from 'path'

import { pool } from '../db'
import documentsRouter from '../routes/documents'
import { signAccessToken } from '../lib/tokens'
import { __setS3ClientForTests } from '../lib/storage'
import { uploadDir } from '../lib/upload'

/* ── In-memory stand-in for S3 ───────────────────────────────────────────
   Exercises the real route code without touching the production bucket or
   needing AWS credentials. Faults can be injected to test failure paths. */
const objects = new Map<string, { body: Buffer; contentType: string }>()
let failNextPut = false

const notFound = () => Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey' })

const fakeS3 = {
  async send(cmd: any) {
    const kind = cmd.constructor.name
    const Key = cmd.input.Key

    if (kind === 'PutObjectCommand') {
      if (failNextPut) { failNextPut = false; throw new Error('simulated S3 outage') }
      objects.set(Key, { body: Buffer.from(cmd.input.Body), contentType: cmd.input.ContentType })
      return {}
    }
    if (kind === 'GetObjectCommand') {
      const o = objects.get(Key)
      if (!o) throw notFound()
      return { Body: Readable.from(o.body), ContentType: o.contentType, ContentLength: o.body.length }
    }
    if (kind === 'HeadObjectCommand') {
      if (!objects.has(Key)) throw notFound()
      return {}
    }
    if (kind === 'DeleteObjectCommand') { objects.delete(Key); return {} }
    throw new Error('unexpected command ' + kind)
  },
}

/* ── Fixtures ────────────────────────────────────────────────────────── */
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4])
const TAG = 's3test'

let server: http.Server
let base: string
let ownerId: number
let otherId: number
let ownerTok: string
let otherTok: string
let adminTok: string
let legacyFile: string | null = null

async function mkCandidate(status: string): Promise<number> {
  const email = TAG + '-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '@test.invalid'
  const r = await pool.query(
    'INSERT INTO candidates (email, application_status, payment_status, last_activity_at)' +
    " VALUES ($1,$2,'paid',NOW()) RETURNING id",
    [email, status],
  )
  return r.rows[0].id
}

async function upload(tok: string, docType: string, buf: Buffer, name: string, type: string) {
  const fd = new FormData()
  // Uint8Array view: Buffer is not a valid BlobPart under exactOptionalPropertyTypes
  fd.append('file', new Blob([new Uint8Array(buf)], { type }), name)
  return fetch(base + '/me/' + docType, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tok },
    body: fd,
  })
}

const dl = (id: number, tok?: string) =>
  fetch(base + '/' + id + '/file', tok ? { headers: { Authorization: 'Bearer ' + tok } } : undefined)

before(async () => {
  __setS3ClientForTests(fakeS3 as any)

  const app = express()
  app.use('/', documentsRouter)
  server = http.createServer(app)
  await new Promise<void>((r) => { server.listen(0, r) })
  base = 'http://127.0.0.1:' + (server.address() as any).port

  ownerId = await mkCandidate('DOCUMENTS_PENDING')
  otherId = await mkCandidate('DOCUMENTS_PENDING')
  ownerTok = signAccessToken({ id: String(ownerId), role: 'candidate' })
  otherTok = signAccessToken({ id: String(otherId), role: 'candidate' })
  adminTok = signAccessToken({ id: 'admin-1', role: 'admin' })
})

after(async () => {
  await new Promise<void>((r) => { server.close(() => r()) })
  await pool.query("DELETE FROM candidates WHERE email LIKE '" + TAG + "-%'")
  if (legacyFile) await fs.promises.unlink(legacyFile).catch(() => {})
  __setS3ClientForTests(null)
  await pool.end()
})

/* ── Upload ──────────────────────────────────────────────────────────── */
describe('upload to S3', () => {
  test('stores the object and records an s3:// path, not a local filename', async () => {
    const res = await upload(ownerTok, 'aadhaar', PNG, 'my aadhaar.png', 'image/png')
    assert.equal(res.status, 200)

    const row = await pool.query(
      'SELECT file_path, original_name FROM candidate_documents WHERE candidate_id=$1 AND doc_type=$2',
      [ownerId, 'aadhaar'],
    )
    const stored = row.rows[0].file_path as string
    assert.ok(stored.startsWith('s3://'), stored)
    assert.match(stored, new RegExp('^s3://candidates/' + ownerId + '/aadhaar/[0-9a-f-]{36}\\.png$'))
    // the candidate filename is kept for display but never used as the key
    assert.equal(row.rows[0].original_name, 'my aadhaar.png')
    assert.ok(!stored.includes('my aadhaar'))
    assert.ok(objects.size >= 1)
  })

  test('rejects a disallowed extension', async () => {
    const r = await upload(ownerTok, 'pan', Buffer.from('MZ'), 'x.exe', 'application/pdf')
    assert.equal(r.status, 400)
  })

  test('rejects a disallowed MIME type', async () => {
    const r = await upload(ownerTok, 'pan', PNG, 'x.png', 'application/x-msdownload')
    assert.equal(r.status, 400)
  })

  test('rejects content that contradicts its extension', async () => {
    const r = await upload(ownerTok, 'pan', Buffer.from([0x4d, 0x5a, 0x90, 0x00]), 'x.png', 'image/png')
    assert.equal(r.status, 400)
    const body = await r.json() as any
    assert.match(body.error, /does not look like a valid PNG/i)
  })

  test('rejects a file over 10 MB', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(11 * 1024 * 1024)])
    const r = await upload(ownerTok, 'pan', big, 'big.png', 'image/png')
    assert.equal(r.status, 400)
    const body = await r.json() as any
    assert.match(body.error, /too large/i)
  })

  test('refuses an upload before payment unlocks documents', async () => {
    const lockedId = await mkCandidate('PAYMENT_PENDING')
    const lockedTok = signAccessToken({ id: String(lockedId), role: 'candidate' })
    const r = await upload(lockedTok, 'aadhaar', PNG, 'a.png', 'image/png')
    assert.equal(r.status, 403)
  })
})

/* ── Download authorisation ──────────────────────────────────────────── */
describe('download authorisation', () => {
  let docId: number

  before(async () => {
    const r = await pool.query(
      'SELECT id FROM candidate_documents WHERE candidate_id=$1 AND doc_type=$2',
      [ownerId, 'aadhaar'],
    )
    docId = r.rows[0].id
  })

  test('rejects an unauthenticated request', async () => {
    assert.equal((await dl(docId)).status, 401)
  })

  test('rejects a different candidate', async () => {
    assert.equal((await dl(docId, otherTok)).status, 403)
  })

  test('serves the owner the exact bytes, with hardening headers', async () => {
    const r = await dl(docId, ownerTok)
    assert.equal(r.status, 200)
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff')
    assert.match(r.headers.get('content-security-policy') ?? '', /sandbox/)
    assert.match(r.headers.get('cache-control') ?? '', /private/)
    assert.deepEqual(Buffer.from(await r.arrayBuffer()), PNG)
  })

  test('serves an admin', async () => {
    const r = await dl(docId, adminTok)
    assert.equal(r.status, 200)
    assert.deepEqual(Buffer.from(await r.arrayBuffer()), PNG)
  })

  test('404s when the object has vanished from the bucket', async () => {
    const row = await pool.query('SELECT file_path FROM candidate_documents WHERE id=$1', [docId])
    const key = (row.rows[0].file_path as string).slice('s3://'.length)
    const saved = objects.get(key)!
    objects.delete(key)

    assert.equal((await dl(docId, ownerTok)).status, 404)

    objects.set(key, saved)
  })
})

/* ── Legacy local files ──────────────────────────────────────────────── */
describe('legacy documents on local disk', () => {
  test('a pre-S3 row still downloads from the instance disk', async () => {
    fs.mkdirSync(uploadDir, { recursive: true })
    const name = TAG + '-legacy.png'
    legacyFile = path.join(uploadDir, name)
    fs.writeFileSync(legacyFile, PNG)

    const ins = await pool.query(
      'INSERT INTO candidate_documents (candidate_id, doc_type, file_path, original_name, status)' +
      " VALUES ($1,'discharge_book',$2,'old.png','UPLOADED') RETURNING id",
      [ownerId, name],   // bare filename, exactly as rows looked before S3
    )
    const legacyId = ins.rows[0].id

    const r = await dl(legacyId, ownerTok)
    assert.equal(r.status, 200, 'legacy local file must still be served')
    assert.deepEqual(Buffer.from(await r.arrayBuffer()), PNG)

    // and it is still protected by the same ownership check
    assert.equal((await dl(legacyId, otherTok)).status, 403)
  })
})

/* ── Replacement ─────────────────────────────────────────────────────── */
describe('replacing a document', () => {
  test('writes the new object and removes only the superseded one', async () => {
    const before = await pool.query(
      'SELECT file_path FROM candidate_documents WHERE candidate_id=$1 AND doc_type=$2',
      [ownerId, 'aadhaar'],
    )
    const oldKey = (before.rows[0].file_path as string).slice('s3://'.length)

    // an unrelated object that must survive
    const unrelated = 'candidates/999/pan/unrelated.png'
    objects.set(unrelated, { body: PNG, contentType: 'image/png' })

    const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 9, 9])
    const r = await upload(ownerTok, 'aadhaar', JPEG, 'new.jpg', 'image/jpeg')
    assert.equal(r.status, 200)

    const after = await pool.query(
      'SELECT file_path FROM candidate_documents WHERE candidate_id=$1 AND doc_type=$2',
      [ownerId, 'aadhaar'],
    )
    const newKey = (after.rows[0].file_path as string).slice('s3://'.length)

    assert.notEqual(newKey, oldKey)
    await new Promise((r2) => setTimeout(r2, 150))   // delete is fire-and-forget
    assert.equal(objects.has(oldKey), false, 'superseded object should be gone')
    assert.equal(objects.has(newKey), true, 'replacement object should exist')
    assert.equal(objects.has(unrelated), true, 'unrelated object must survive')
  })

  test('a failed S3 write leaves the previous document intact', async () => {
    const before = await pool.query(
      'SELECT id, file_path, original_name FROM candidate_documents WHERE candidate_id=$1 AND doc_type=$2',
      [ownerId, 'aadhaar'],
    )

    failNextPut = true
    const r = await upload(ownerTok, 'aadhaar', PNG, 'doomed.png', 'image/png')
    assert.equal(r.status, 500)

    const after = await pool.query(
      'SELECT file_path, original_name FROM candidate_documents WHERE candidate_id=$1 AND doc_type=$2',
      [ownerId, 'aadhaar'],
    )
    assert.equal(after.rows[0].file_path, before.rows[0].file_path, 'row must not change')
    assert.equal(after.rows[0].original_name, before.rows[0].original_name)

    // and the previous document is still downloadable
    assert.equal((await dl(before.rows[0].id, ownerTok)).status, 200)
  })
})

/* ── Concurrency ─────────────────────────────────────────────────────── */
describe('concurrent replacement', () => {
  test('two simultaneous uploads leave exactly one live object and a matching row', async () => {
    const docType = 'photograph'
    await upload(ownerTok, docType, PNG, 'first.png', 'image/png')

    const start = await pool.query(
      'SELECT file_path FROM candidate_documents WHERE candidate_id=$1 AND doc_type=$2',
      [ownerId, docType],
    )
    const startKey = (start.rows[0].file_path as string).slice('s3://'.length)

    const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 7, 7])
    const PNG2 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 8, 8])

    // Fired together: the row lock taken by the gate check must serialise them.
    const [a, b] = await Promise.all([
      upload(ownerTok, docType, JPEG, 'race-a.jpg', 'image/jpeg'),
      upload(ownerTok, docType, PNG2, 'race-b.png', 'image/png'),
    ])
    assert.equal(a.status, 200)
    assert.equal(b.status, 200)

    await new Promise((r) => setTimeout(r, 250))   // deletes are fire-and-forget

    const end = await pool.query(
      'SELECT id, file_path FROM candidate_documents WHERE candidate_id=$1 AND doc_type=$2',
      [ownerId, docType],
    )
    assert.equal(end.rows.length, 1, 'the unique constraint must keep this to one row')

    const liveKey = (end.rows[0].file_path as string).slice('s3://'.length)

    // The row must point at an object that actually exists — the failure this
    // whole ordering exists to prevent.
    assert.equal(objects.has(liveKey), true, 'row must reference a live object')
    assert.equal(objects.has(startKey), false, 'the original object should be gone')

    // And the surviving document is downloadable.
    const r = await dl(end.rows[0].id, ownerTok)
    assert.equal(r.status, 200)

    // Exactly one object for this candidate+docType — no leaked duplicates.
    const mine = [...objects.keys()].filter((k) => k.startsWith(`candidates/${ownerId}/${docType}/`))
    assert.equal(mine.length, 1, `expected 1 live object, found ${mine.length}: ${mine.join(', ')}`)
  })
})
