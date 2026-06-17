// Access token lives in JS memory only — never persisted to localStorage.
// XSS cannot steal what's not in the DOM or storage.
// Refresh token is in an httpOnly cookie (server-managed).

let _accessToken: string | null = null

export function getToken(): string | null {
  return _accessToken
}

export function setToken(token: string | null): void {
  _accessToken = token
}
