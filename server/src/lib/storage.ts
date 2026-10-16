import crypto from 'crypto'
import type { Readable } from 'stream'
import {
  S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand,
} from '@aws-sdk/client-s3'

/**
 * Candidate document storage.
 *
 * New documents live in a private S3 bucket. Documents uploaded before this
 * change live on the EC2 instance's local disk, and must keep working: their
 * rows are never rewritten and their files are never moved or deleted.
 *
 * The two are told apart by the value stored in candidate_documents.file_path:
 *
 *   legacy local file   "9f3c1b2a-....png"            (a bare filename)
 *   S3 object           "s3://candidates/24/pan/....png"
 *
 * The explicit "s3://" scheme is deliberate. Distinguishing them by some
 * incidental property — whether the string contains a slash, say — would be a
 * guess that silently breaks the first time a filename convention changes.
 * The prefix states the storage backend outright, needs no schema migration
 * because file_path is already TEXT, and leaves every existing row untouched.
 *
 * The bucket name is NOT embedded in the stored value: it comes from config,
 * so moving buckets never requires rewriting database rows.
 */

export const S3_SCHEME = 's3://'

export const S3_BUCKET = process.env.S3_BUCKET ?? 'exserviceman-jobs-candidate-documents'
export const AWS_REGION = process.env.AWS_REGION ?? 'ap-southeast-2'

/* ── Client ──────────────────────────────────────────────────────────── */
/*
 * Credentials come from the default AWS provider chain, which on EC2 resolves
 * the instance's IAM role. No access key or secret is read, stored or logged
 * anywhere in this codebase.
 */
let _client: S3Client | null = null

export function s3(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: AWS_REGION,
      /*
       * Timeouts are not optional here. The upload route calls putObject with
       * a PostgreSQL transaction open, holding both a row lock and a pool
       * connection. The SDK's Node handler waits indefinitely by default, so
       * an unreachable S3 — a network partition, a security-group change —
       * would pin one pool connection per request until the pool (ten by
       * default) is exhausted and every endpoint stops responding, not just
       * uploads.
       *
       * Bounded here instead: at worst two attempts of thirty seconds, after
       * which the request fails cleanly, the transaction rolls back and the
       * connection returns to the pool.
       */
      maxAttempts: 2,
      requestHandler: {
        connectionTimeout: 5_000,
        requestTimeout:    30_000,
      },
    })
  }
  return _client
}

/** Swap the client for a stub. Tests only — never called by application code. */
export function __setS3ClientForTests(c: S3Client | null): void {
  _client = c
}

/* ── Path convention ─────────────────────────────────────────────────── */

export function isS3Path(storedPath: string): boolean {
  return typeof storedPath === 'string' && storedPath.startsWith(S3_SCHEME)
}

/** The object key for an s3:// path, or null if this is a legacy local file. */
export function s3KeyFromPath(storedPath: string): string | null {
  if (!isS3Path(storedPath)) return null
  const key = storedPath.slice(S3_SCHEME.length)
  return key.length > 0 ? key : null
}

export function toStoredPath(key: string): string {
  return S3_SCHEME + key
}

/**
 * Build an object key.
 *
 * The candidate's own filename is never used: it is attacker-controlled and
 * could carry traversal segments, control characters or another candidate's
 * identifiers. A random UUID makes the key unguessable, so even if a key
 * leaked it could not be used to enumerate other documents — and every
 * download is authorised regardless.
 *
 * Grouping by candidate and document type keeps the bucket navigable for an
 * operator without revealing anything a signed-in admin cannot already see.
 */
export function buildObjectKey(candidateId: number, docType: string, ext: string): string {
  const safeType = docType.replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'document'
  const safeExt  = ext.replace(/[^a-z0-9.]/gi, '').slice(0, 10) || '.bin'
  return `candidates/${Number(candidateId)}/${safeType}/${crypto.randomUUID()}${safeExt}`
}

/* ── Operations ──────────────────────────────────────────────────────── */

export async function putObject(
  key: string, body: Buffer, contentType: string,
): Promise<void> {
  await s3().send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    // Objects stay private. No ACL is set, so the bucket's own
    // block-public-access settings govern, and nothing is ever world-readable.
    ServerSideEncryption: 'AES256',
  }))
}

export interface ObjectStream {
  body: Readable
  contentType?: string
  contentLength?: number
}

export async function getObjectStream(key: string): Promise<ObjectStream> {
  const out = await s3().send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }))
  return {
    body:          out.Body as Readable,
    contentType:   out.ContentType,
    contentLength: out.ContentLength,
  }
}

export async function deleteObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }))
}

/** True when the error means "that object is not there". */
export function isNotFound(e: any): boolean {
  const code = e?.name ?? e?.Code ?? e?.$metadata?.httpStatusCode
  return code === 'NoSuchKey' || code === 'NotFound' || code === 404
}
