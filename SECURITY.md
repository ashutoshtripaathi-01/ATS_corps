# ATS Corps — Security Architecture

This document describes the security architecture of the ATS Corps recruitment platform.

---

## 1. Authentication Architecture

The platform uses a **dual-token** authentication system:

| Token          | Lifetime | Storage           | Transport               |
|----------------|----------|-------------------|-------------------------|
| Access token   | 15 min   | JS memory only    | `Authorization: Bearer` |
| Refresh token  | 7 days   | httpOnly cookie   | Cookie (auto)           |

### Why two tokens?

Access tokens are short-lived and kept in JavaScript memory (never in `localStorage`
or `sessionStorage`). This limits the window of exposure if XSS occurs — the token
expires in 15 minutes and cannot be stolen by reading storage.

Refresh tokens live in `httpOnly` cookies, which JavaScript cannot read at all. An
XSS payload on the page cannot exfiltrate the refresh token.

---

## 2. Access Token Flow

```
Client                         Server
  │  POST /api/auth/admin/login  │
  │ ──────────────────────────►  │  bcrypt.compare(password, hash)
  │  { accessToken }             │  issueRefreshToken → httpOnly cookie
  │ ◄──────────────────────────  │
  │                              │
  │  GET /api/...                │
  │  Authorization: Bearer <AT>  │
  │ ──────────────────────────►  │  verifyAccessToken(AT)
  │  { data }                    │
  │ ◄──────────────────────────  │
```

Access tokens are signed with `HS256` using `JWT_SECRET`. The payload contains
`{ id, role, iat, exp }`. The server validates signature and expiry on every request.

---

## 3. Refresh Token Rotation Flow

```
Client                         Server
  │  POST /api/auth/refresh      │  (cookie ats_rt sent automatically)
  │ ──────────────────────────►  │
  │                              │  1. SHA-256(cookie) → look up in DB
  │                              │  2. Check revoked flag + expiry
  │                              │  3. Mark old token revoked
  │                              │  4. Issue new refresh token (same family)
  │  { accessToken }             │  Set-Cookie: ats_rt=<new token>
  │ ◄──────────────────────────  │
```

Every refresh operation **rotates** the refresh token: the old one is marked revoked
in the database, and a new one is issued. Refresh tokens are stored as **SHA-256
hashes** — the raw value never touches the database.

---

## 4. Token Family Reuse Detection (Theft Detection)

Each refresh token belongs to a **family** (a UUID assigned at first issuance).

```
Normal rotation:
  family-abc / token-1  →  revoked
  family-abc / token-2  →  issued  ← current

Theft scenario:
  Attacker steals token-1 after rotation.
  Attacker presents token-1 (already revoked).
  Server detects reuse → revokes ALL tokens in family-abc.
  Legitimate user's token-2 is also revoked → forced re-login.
```

This ensures that if a refresh token is ever stolen and used, the breach is detected
and all sessions for that user are immediately terminated.

---

## 5. CSRF Protection

**Approach:** `SameSite=Strict` cookies + `Authorization` header (no CSRF tokens needed)

The refresh token cookie uses `SameSite=Strict`. This instructs browsers to **never**
send the cookie in cross-site requests — including form submissions, img/script tags,
fetch from other origins, etc.

Additionally, all API mutation endpoints (other than refresh/logout) require an
`Authorization: Bearer <token>` header. Cross-site requests cannot set custom HTTP
headers, making these endpoints immune to CSRF by design.

**Why no explicit CSRF token?**

An explicit double-submit CSRF cookie is only useful when:
1. Cookies use `SameSite=None` (ours use `Strict`), AND
2. The API accepts form-encoded bodies without a Bearer token

Neither applies here. Implementing a CSRF token would add complexity with no
additional security benefit for this architecture.

---

## 6. Cookie Strategy

| Cookie      | httpOnly | secure (prod) | SameSite | Path       | Lifetime |
|-------------|----------|---------------|----------|------------|----------|
| `ats_rt`    | ✓        | ✓             | Strict   | `/api/auth`| 7 days   |

- `httpOnly: true` — JavaScript cannot access the cookie (prevents XSS exfiltration)
- `secure: true` in production — cookie only sent over HTTPS
- `SameSite: Strict` — cookie not sent in any cross-site request (CSRF protection)
- `path: /api/auth` — cookie only sent to auth endpoints (minimises exposure)

---

## 7. Rate Limiting Strategy

Three layers of rate limiting:

| Layer              | Limit           | Applied to                          |
|--------------------|-----------------|-------------------------------------|
| Global             | 300 req/15 min  | All routes                          |
| OTP endpoints      | 5 req/15 min    | `/send-otp`, `/verify-otp`          |
| Auth/login         | 5 req/15 min    | `/api/auth/admin/login`             |

The auth rate limiter uses `skipSuccessfulRequests: true` — only failed attempts
count against the limit, so a legitimate user is not locked out by their own traffic.

Rate limit responses: **HTTP 429** with `{ error: "..." }`.

---

## 8. Account Lockout

Admin account lockout is enforced in memory (survives only in-process):

- **Threshold:** 5 consecutive failed login attempts
- **Lock duration:** 15 minutes
- **Reset:** automatic after lock expires, or immediately on successful login
- **Response:** HTTP 423 with retry time
- **Audit:** every lockout event is written to `audit_logs`

For multi-instance production deployments, replace the in-memory store
(`server/src/lib/lockout.ts`) with a Redis-backed implementation.

---

## 9. Audit Logging

All security-relevant events are written to the `audit_logs` table:

| Action                    | When                                        |
|---------------------------|---------------------------------------------|
| `LOGIN_SUCCESS`           | Successful admin or candidate login         |
| `LOGIN_FAILED`            | Wrong credentials (with reason)             |
| `ACCOUNT_LOCKED`          | Lockout triggered                           |
| `LOGOUT`                  | Explicit logout                             |
| `REFRESH_TOKEN_ROTATED`   | Successful refresh                          |
| `TOKEN_REUSE_DETECTED`    | Stolen/reused refresh token presented       |
| `CANDIDATE_REGISTERED`    | New or updated candidate registration       |
| `EMPLOYER_REGISTERED`     | New or updated employer registration        |
| `JOB_POSTED`              | New job listing created                     |
| `JOB_DELETED`             | Job listing removed                         |
| `APPLICATION_SUBMITTED`   | Candidate applies to a job                  |
| `APPLICATION_STATUS_CHANGED` | Employer updates application status      |

Each log record includes: `user_id`, `action`, `ip_address`, `user_agent`,
`metadata` (JSON), `created_at`.

Audit writes are **fire-and-forget** — a failure to write a log never crashes
the main request flow.

---

## 10. Password Security

Admin passwords are stored as **bcrypt hashes** (12 rounds).

- Never stored in plaintext
- Never sent to the frontend (the frontend has no `VITE_ADMIN_PASSWORD` variable)
- `bcrypt.compare()` is used for verification (timing-safe)
- On startup, if `ADMIN_PASSWORD_HASH` is not set, the server hashes `ADMIN_PASSWORD`
  once and logs the hash to stdout. The operator should then copy it into `.env` and
  remove `ADMIN_PASSWORD`.

**Recommended production setup:**
```
ADMIN_EMAIL=admin@atscorps.com
ADMIN_PASSWORD_HASH=$2b$12$...     # bcrypt hash, 12 rounds
# ADMIN_PASSWORD should NOT be present in production
```

---

## 11. File Upload Security

Candidate document uploads enforce:

| Control              | Detail                                              |
|----------------------|-----------------------------------------------------|
| Allowed MIME types   | `image/jpeg`, `image/png`, `application/pdf`, DOC, DOCX |
| Allowed extensions   | `.jpg`, `.jpeg`, `.png`, `.pdf`, `.doc`, `.docx`   |
| Blocked extensions   | `.exe`, `.bat`, `.sh`, `.js`, `.php`, `.py`, and 10+ more |
| Max file size        | 10 MB (multer enforced before file is written)      |
| Safe filename        | `crypto.randomUUID() + safeExt` — original name discarded |

File names are generated using `crypto.randomUUID()`, so the original filename
never reaches the filesystem (prevents path traversal and naming attacks).

---

## 12. Authorization Model

### Role-based access control (RBAC)

Three roles exist: `candidate`, `employer`, `admin`.

The `requireAuth(...roles)` middleware:
1. Validates the `Authorization: Bearer <token>` header
2. Verifies JWT signature and expiry
3. Checks the token's `role` is in the allowed list
4. Attaches `req.auth = { id, role }` for downstream handlers

### Ownership checks

Beyond RBAC, every sensitive route performs an **ownership check**:

| Route                                 | Check                                     |
|---------------------------------------|-------------------------------------------|
| `GET /api/candidates/:id`             | Candidate ID must match `req.auth.id`     |
| `GET /api/employers/:id`              | Employer ID must match `req.auth.id`      |
| `PATCH /api/employers/:id`            | Employer ID must match `req.auth.id`      |
| `GET /api/jobs/employer/:id`          | Employer ID must match `req.auth.id`      |
| `PATCH /api/jobs/:id/status`          | `employer_id` on job must match token     |
| `DELETE /api/jobs/:id`                | `employer_id` on job must match token     |
| `GET /api/applications/candidate/:id` | Candidate ID must match `req.auth.id`     |
| `GET /api/applications/employer/:id`  | Employer ID must match `req.auth.id`      |

Ownership violations return **HTTP 403 Forbidden**.
Admins bypass ownership checks for all routes.

---

## 13. SQL Injection Prevention

All database queries use **parameterized queries** (`$1`, `$2`, ...) via the `pg`
library. No user input is ever interpolated into SQL strings.

The only dynamic SQL is the WHERE-clause builder in `GET /api/jobs`:
```typescript
where.push(`j.status = $${params.push(status || 'active')}`)
```
This is safe because:
- The SQL **structure** (column names, operators) is hardcoded
- The SQL **values** go into the `params` array and are passed as `$N` placeholders
- `Array.push()` returns the new length, which is used as the placeholder index

---

## 14. Environment Validation

On startup, `server/src/lib/env.ts` validates all required environment variables
using **Zod**. The server refuses to start if any required variable is missing or
invalid, with a clear error message indicating what to fix.

Required variables: `JWT_SECRET` (≥32 chars), `DB_NAME`,
plus either `ADMIN_PASSWORD` or `ADMIN_PASSWORD_HASH`.

---

## 15. Request Validation

All auth and registration endpoints validate request bodies against **Zod schemas**
before processing. Invalid requests receive a **HTTP 400** response with structured
field-level error details:

```json
{
  "error": "Validation failed",
  "details": [
    { "field": "mobile", "message": "Enter a valid 10-digit Indian mobile number" }
  ]
}
```

Server-side validation is authoritative — frontend validation is UX only.

---

## 16. HTTP Security Headers (Helmet)

| Header                            | Value                     |
|-----------------------------------|---------------------------|
| `Content-Security-Policy`         | `default-src 'self'`; no scripts/styles/frames |
| `X-Content-Type-Options`          | `nosniff`                 |
| `X-Frame-Options`                 | `DENY`                    |
| `X-XSS-Protection`                | `0` (modern browsers use CSP) |
| `Referrer-Policy`                 | `no-referrer`             |
| `Strict-Transport-Security`       | 1 year (production only)  |
| `Cross-Origin-Resource-Policy`    | `cross-origin` (for uploads) |

---

## 17. Refresh Token Cleanup

A background job runs **10 seconds after startup**, then every **24 hours**:

```sql
DELETE FROM refresh_tokens
WHERE expires_at < NOW()
   OR (revoked = TRUE AND created_at < NOW() - INTERVAL '30 days')
```

This prevents unbounded table growth. Revoked tokens are kept for 30 days to
support forensic investigation of `TOKEN_REUSE_DETECTED` events.

---

## 18. Known Limitations & Future Work

| Item                        | Status        | Notes                                          |
|-----------------------------|---------------|------------------------------------------------|
| OTP via real SMS            | Deferred      | Currently hardcoded to `123456`               |
| Razorpay payments           | Deferred      | User explicitly deferred                      |
| Account lockout persistence | In-memory     | Resets on server restart; replace with Redis for HA |
| Multi-instance deployments  | Single-node   | Token cleanup + lockout are not distributed   |
| Employer login page         | Pending       | Currently re-registration (upsert) = login    |
| Admin 2FA                   | Not yet       | Consider TOTP for the admin account           |
