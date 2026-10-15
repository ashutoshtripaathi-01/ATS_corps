import { OAuth2Client } from 'google-auth-library'

/**
 * Google ID token verification.
 *
 * The browser hands us a JWT issued by Google. It is untrusted input: anyone
 * can POST this endpoint with an arbitrary string, so the token's signature,
 * issuer, audience and expiry are all checked against Google's published keys
 * server-side before we believe a single claim inside it. We never trust an
 * email address the client simply tells us.
 *
 * This is the ID-token flow, not the authorization-code flow, so there is no
 * client secret involved — only the public client id, which is safe to ship
 * in the frontend bundle.
 */

let _client: OAuth2Client | null = null

function client(): OAuth2Client {
  if (!_client) _client = new OAuth2Client()
  return _client
}

export function googleClientId(): string | undefined {
  return process.env.GOOGLE_CLIENT_ID
}

export interface GoogleIdentity {
  sub: string
  email: string
  emailVerified: boolean
  name?: string
  picture?: string
}

export class GoogleAuthError extends Error {}

export async function verifyGoogleIdToken(credential: string): Promise<GoogleIdentity> {
  const audience = googleClientId()
  if (!audience) throw new GoogleAuthError('Google sign-in is not configured on the server')
  if (!credential || typeof credential !== 'string')
    throw new GoogleAuthError('Missing Google credential')

  let payload
  try {
    // Checks the RS256 signature against Google's rotating public keys, and
    // that aud === our client id, iss is Google, and the token is unexpired.
    const ticket = await client().verifyIdToken({ idToken: credential, audience })
    payload = ticket.getPayload()
  } catch (e: any) {
    throw new GoogleAuthError(`Google token rejected: ${e.message}`)
  }

  if (!payload) throw new GoogleAuthError('Google token carried no payload')

  // verifyIdToken checks iss, but being explicit keeps the guarantee visible.
  if (payload.iss !== 'accounts.google.com' && payload.iss !== 'https://accounts.google.com')
    throw new GoogleAuthError('Unexpected token issuer')

  if (!payload.sub)   throw new GoogleAuthError('Google token carried no subject')
  if (!payload.email) throw new GoogleAuthError('This Google account exposes no email address')

  // An unverified address could belong to someone else entirely — accepting it
  // would let an attacker claim another person's account by signing up to
  // Google with their email.
  if (!payload.email_verified)
    throw new GoogleAuthError('This Google account has an unverified email address')

  return {
    sub:           payload.sub,
    email:         payload.email.toLowerCase(),
    emailVerified: true,
    name:          payload.name    ?? undefined,
    picture:       payload.picture ?? undefined,
  }
}
