import multer from 'multer'
import path from 'path'

/* ── Allowed file types ─────────────────────────────────────────────── */
export const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/jpg',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

export const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx'])

// Rejected on extension alone, whatever MIME type is claimed.
export const BLOCKED_EXT = new Set([
  '.exe', '.bat', '.sh', '.cmd', '.com', '.msi', '.dll',
  '.js', '.ts', '.php', '.py', '.rb', '.pl', '.ps1', '.vbs',
  '.wsf', '.jar', '.class', '.scr', '.pif', '.htaccess',
])

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB

/**
 * Legacy upload directory.
 *
 * New documents go to S3, so nothing is written here any more. The path is
 * kept because documents uploaded before the move still live on this disk and
 * must stay downloadable. The directory is no longer created on boot — an
 * instance that never had local uploads should not grow an empty one.
 */
export const uploadDir = path.join(__dirname, '../../../uploads/candidates')

/**
 * Files are buffered in memory and forwarded to S3 rather than written to
 * local disk, which on a replaceable instance is wiped on every deploy. The
 * 10 MB cap bounds what a single request can hold.
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()

    if (BLOCKED_EXT.has(ext)) {
      return cb(new Error(`File type "${ext}" is not permitted`))
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error(`MIME type "${file.mimetype}" is not permitted`))
    }
    if (!ALLOWED_EXT.has(ext)) {
      return cb(new Error(`File extension "${ext}" is not permitted`))
    }
    cb(null, true)
  },
})

/** Translate a multer error into a user-facing message. */
export function uploadErrorMessage(err: unknown): string {
  if (err instanceof multer.MulterError)
    return err.code === 'LIMIT_FILE_SIZE' ? 'File too large — maximum 10 MB' : err.message
  return (err as Error).message
}

/* ── Content sniffing ────────────────────────────────────────────────── */
/**
 * Both the extension and the MIME type are supplied by the client, so a
 * malicious upload can claim whatever it likes. The leading bytes of the file
 * cannot be faked without changing what the file actually is, so they are
 * checked too, and must agree with the claimed extension.
 *
 * This is a consistency check, not a guarantee of safety: a genuine JPEG can
 * still contain hostile data. It pairs with the download headers, which tell
 * the browser never to execute what it receives.
 */
const SIGNATURES: Record<string, number[][]> = {
  '.jpg':  [[0xff, 0xd8, 0xff]],
  '.jpeg': [[0xff, 0xd8, 0xff]],
  '.png':  [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  '.pdf':  [[0x25, 0x50, 0x44, 0x46]],                          // %PDF
  '.docx': [[0x50, 0x4b, 0x03, 0x04], [0x50, 0x4b, 0x05, 0x06]], // zip container
  '.doc':  [
    [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],            // OLE2
    [0x50, 0x4b, 0x03, 0x04],                                    // .doc that is really a docx
  ],
}

function startsWith(buf: Buffer, sig: number[]): boolean {
  if (buf.length < sig.length) return false
  return sig.every((b, i) => buf[i] === b)
}

/**
 * Returns null when the content matches the extension, or a message when it
 * does not. An extension with no known signature is accepted — the allow-list
 * above has already constrained what can reach here.
 */
export function checkFileSignature(buffer: Buffer, originalName: string): string | null {
  const ext = path.extname(originalName).toLowerCase()
  const sigs = SIGNATURES[ext]
  if (!sigs) return null
  if (buffer.length === 0) return 'The uploaded file is empty'
  if (sigs.some((s) => startsWith(buffer, s))) return null
  return `This file does not look like a valid ${ext.slice(1).toUpperCase()} file`
}

/**
 * Resolve a LEGACY local filename to an absolute path, refusing anything that
 * escapes the upload directory. Stored names are UUIDs, but this guards
 * against a tampered or hand-edited database row containing traversal
 * segments. Not used for S3-backed documents.
 */
export function safeResolveUpload(filename: string): string | null {
  if (!filename || filename.includes('\0')) return null
  const resolved = path.resolve(uploadDir, filename)
  const base     = path.resolve(uploadDir)
  if (resolved !== base && !resolved.startsWith(base + path.sep)) return null
  return resolved
}

