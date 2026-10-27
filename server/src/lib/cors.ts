/**
 * Origin allow-list logic for the production API's CORS policy, pulled out
 * of index.ts so it can be unit-tested directly rather than only through a
 * full server boot. Pure, no Express/env-singleton dependency beyond what's
 * passed in — see index.ts for how this is wired to `cors()`.
 */

export interface OriginPolicy {
  allowedOrigins: string[]
  netlifyPreviewPatterns: RegExp[]
  isProd: boolean
}

const LOCALHOST_RE = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

/** FRONTEND_URL may list several origins, comma-separated. */
export function parseAllowedOrigins(frontendUrl: string): string[] {
  return frontendUrl
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean)
}

/** For any allowed *.netlify.app site, also permit its deploy-preview subdomains. */
export function buildNetlifyPreviewPatterns(allowedOrigins: string[]): RegExp[] {
  return allowedOrigins
    .map((o) => /^https:\/\/([a-z0-9-]+)\.netlify\.app$/.exec(o)?.[1])
    .filter((site): site is string => Boolean(site))
    .map((site) => new RegExp(`^https://[a-z0-9-]+--${site}\\.netlify\\.app$`))
}

/**
 * localhost / 127.0.0.1 on any port is only ever allowed when `isProd` is
 * false. A production API has no legitimate reason to trust an arbitrary
 * local port with a credentialed request — this used to be allowed
 * unconditionally, which a live check confirmed: an OPTIONS preflight with
 * Origin: http://localhost:9999 against the real production API returned
 * Access-Control-Allow-Origin: http://localhost:9999 with
 * Access-Control-Allow-Credentials: true.
 */
export function isOriginAllowed(origin: string, policy: OriginPolicy): boolean {
  const clean = origin.replace(/\/+$/, '')
  if (!policy.isProd && LOCALHOST_RE.test(clean)) return true
  if (policy.allowedOrigins.includes(clean)) return true
  if (policy.netlifyPreviewPatterns.some((re) => re.test(clean))) return true
  return false
}
