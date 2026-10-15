import multer from 'multer'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

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

// Reject any upload with these extensions regardless of MIME type
export const BLOCKED_EXT = new Set([
  '.exe', '.bat', '.sh', '.cmd', '.com', '.msi', '.dll',
  '.js', '.ts', '.php', '.py', '.rb', '.pl', '.ps1', '.vbs',
  '.wsf', '.jar', '.class', '.scr', '.pif', '.htaccess',
])

export const uploadDir = path.join(__dirname, '../../../uploads/candidates')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    // Use only the extension from the original name — never the name itself
    const rawExt = path.extname(file.originalname).toLowerCase()
    const safeExt = ALLOWED_EXT.has(rawExt) ? rawExt : '.bin'
    cb(null, `${crypto.randomUUID()}${safeExt}`)
  },
})

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
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

/**
 * Resolve a stored filename to an absolute path, refusing anything that
 * escapes the upload directory. Stored names are UUIDs, but this guards
 * against a tampered or legacy database row containing traversal segments.
 */
export function safeResolveUpload(filename: string): string | null {
  const resolved = path.resolve(uploadDir, filename)
  const base     = path.resolve(uploadDir)
  if (resolved !== base && !resolved.startsWith(base + path.sep)) return null
  return resolved
}
