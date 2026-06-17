import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { pool } from '../db'
import type { Response } from 'express'

export interface TokenPayload {
  id: string
  role: 'candidate' | 'employer' | 'admin'
}

const ACCESS_TTL_SECS = 15 * 60                  // 15 min
const REFRESH_TTL_MS  = 7 * 24 * 60 * 60 * 1000 // 7 days

function secret(): string {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET is not configured')
  return s
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, secret(), { expiresIn: ACCESS_TTL_SECS, algorithm: 'HS256' })
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, secret(), { algorithms: ['HS256'] }) as TokenPayload
}

function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

// In production the frontend (Netlify) and API (Render) are on different
// sites, so the refresh cookie must be SameSite=None — and None *requires*
// Secure. In development everything is same-site on localhost over http, where
// Lax works and Secure must stay off (browsers reject Secure cookies on http).
const isProd = process.env.NODE_ENV === 'production'

function setRefreshCookie(res: Response, raw: string): void {
  res.cookie('ats_rt', raw, {
    httpOnly: true,
    secure:   isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge:   REFRESH_TTL_MS,
    path:     '/api/auth',
  })
}

export function clearRefreshCookie(res: Response): void {
  // Attributes (sameSite/secure/path) must match the set cookie or the browser
  // won't clear it.
  res.clearCookie('ats_rt', {
    httpOnly: true,
    secure:   isProd,
    sameSite: isProd ? 'none' : 'lax',
    path:     '/api/auth',
  })
}

export async function issueRefreshToken(
  res: Response,
  userId: string,
  userType: string,
  familyId?: string,
): Promise<void> {
  const raw    = crypto.randomBytes(40).toString('hex')
  const hash   = sha256(raw)
  const family = familyId ?? crypto.randomUUID()
  const expiry = new Date(Date.now() + REFRESH_TTL_MS)

  await pool.query(
    `INSERT INTO refresh_tokens (token_hash, user_id, user_type, family_id, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [hash, userId, userType, family, expiry],
  )

  setRefreshCookie(res, raw)
}

export async function rotateRefreshToken(
  res: Response,
  raw: string,
): Promise<{ userId: string; userType: string }> {
  const hash = sha256(raw)
  const { rows } = await pool.query(
    'SELECT * FROM refresh_tokens WHERE token_hash = $1',
    [hash],
  )

  if (rows.length === 0) {
    clearRefreshCookie(res)
    const err = Object.assign(new Error('Refresh token not found'), { status: 401 })
    throw err
  }

  const stored = rows[0]

  if (stored.revoked) {
    await pool.query(
      'UPDATE refresh_tokens SET revoked = TRUE WHERE family_id = $1',
      [stored.family_id],
    )
    clearRefreshCookie(res)
    const err = Object.assign(
      new Error('Token reuse detected — all sessions have been revoked'),
      { status: 401 },
    )
    throw err
  }

  if (new Date(stored.expires_at) < new Date()) {
    clearRefreshCookie(res)
    const err = Object.assign(new Error('Refresh token expired'), { status: 401 })
    throw err
  }

  await pool.query('UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1', [stored.id])

  await issueRefreshToken(res, stored.user_id as string, stored.user_type as string, stored.family_id as string)

  return { userId: stored.user_id as string, userType: stored.user_type as string }
}

export async function revokeRefreshToken(res: Response, raw: string): Promise<void> {
  const hash = sha256(raw)
  await pool.query('UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1', [hash])
  clearRefreshCookie(res)
}
