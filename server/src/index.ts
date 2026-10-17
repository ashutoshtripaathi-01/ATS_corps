import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import { validateEnv } from './lib/env'
import { paymentsEnabled } from './lib/applicationStatus'
import { initDb, dbTarget } from './db'
import { startTokenCleanupJob } from './jobs/tokenCleanup'
import authRoutes from './routes/auth'
import candidateRoutes from './routes/candidates'
import employerRoutes from './routes/employers'
import jobRoutes from './routes/jobs'
import applicationRoutes from './routes/applications'
import paymentRoutes from './routes/payments'
import documentRoutes from './routes/documents'
import adminRoutes from './routes/admin'
import reportsRoutes from './routes/reports'

// Load .env first, then validate — exits with a clear message if anything is wrong
dotenv.config()
const _env = validateEnv()

const app  = express()
const PORT = Number(_env.PORT) || 4000

// Render (and most PaaS) put the app behind a reverse proxy. Trusting the first
// proxy hop lets Express read the real client IP from X-Forwarded-For (for the
// rate limiter) and correctly treat X-Forwarded-Proto=https as a secure conn.
if (_env.NODE_ENV === 'production') app.set('trust proxy', 1)

/* ── Security headers ────────────────────────────────────────────────── */
app.use(
  helmet({
    // Relax CORP so browsers can render uploaded images/PDFs cross-origin
    crossOriginResourcePolicy: { policy: 'cross-origin' },

    contentSecurityPolicy: {
      directives: {
        defaultSrc:  ["'self'"],
        scriptSrc:   ["'none'"],    // API server serves no scripts
        styleSrc:    ["'none'"],
        imgSrc:      ["'self'", "data:"],
        fontSrc:     ["'none'"],
        frameSrc:    ["'none'"],
        objectSrc:   ["'none'"],
        baseUri:     ["'none'"],
        formAction:  ["'none'"],
        // Upgrade HTTP → HTTPS in production
        upgradeInsecureRequests: _env.NODE_ENV === 'production' ? [] : null,
      },
    },

    // HSTS — only enable in production (dev uses http)
    strictTransportSecurity: _env.NODE_ENV === 'production'
      ? { maxAge: 31536000, includeSubDomains: true }
      : false,
  }),
)

/* ── CORS — must allow credentials for the httpOnly refresh-token cookie */
// FRONTEND_URL may list several origins (comma-separated). Normalise each by
// trimming whitespace and any trailing slash, since browsers send the Origin
// header WITHOUT a trailing slash — a mismatch there is the #1 cause of CORS
// failures behind Netlify/Render.
const allowedOrigins = _env.FRONTEND_URL
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean)

// For any allowed *.netlify.app site, also permit its deploy-preview and
// branch-deploy subdomains (e.g. deploy-preview-3--atscorps.netlify.app).
const netlifyPreviewPatterns = allowedOrigins
  .map((o) => /^https:\/\/([a-z0-9-]+)\.netlify\.app$/.exec(o)?.[1])
  .filter((site): site is string => Boolean(site))
  .map((site) => new RegExp(`^https://[a-z0-9-]+--${site}\\.netlify\\.app$`))

// localhost / 127.0.0.1 on any port — allowed in every environment so a local
// frontend can be pointed at the live backend for testing. Tighten this (drop
// the prod case) once you no longer need local-against-production testing.
const LOCALHOST_RE = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

const isOriginAllowed = (origin: string): boolean => {
  const clean = origin.replace(/\/+$/, '')
  if (LOCALHOST_RE.test(clean)) return true
  if (allowedOrigins.includes(clean)) return true
  if (netlifyPreviewPatterns.some((re) => re.test(clean))) return true
  return false
}

const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    // No Origin header → same-origin, curl, or server-to-server. Allow it.
    if (!origin) return callback(null, true)
    if (isOriginAllowed(origin)) return callback(null, true)
    return callback(new Error(`CORS: origin not allowed — ${origin}`))
  },
  credentials: true,
}
// Handle preflight (OPTIONS) for every route — must come before route handlers
app.options('*', cors(corsOptions))
app.use(cors(corsOptions))

/* ── Body parsing ────────────────────────────────────────────────────── */
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))
app.use(cookieParser())

/* ── Global rate limit — 300 requests / 15 min / IP ─────────────────── */
app.use(
  rateLimit({
    windowMs:        15 * 60 * 1000,
    max:             300,
    standardHeaders: true,
    legacyHeaders:   false,
    message:         { error: 'Too many requests. Please try again later.' },
  }),
)

/* ── Uploaded documents are NOT served statically ────────────────────
   Candidate documents (Aadhaar, PAN, service records) are private. They are
   streamed only through GET /api/documents/:id/file, which checks that the
   caller owns the document or is an admin. Serving /uploads with
   express.static would hand every file to anyone who guessed a filename.   */

/* ── API routes ──────────────────────────────────────────────────────── */
app.use('/api/auth',         authRoutes)
app.use('/api/candidates',   candidateRoutes)
app.use('/api/employers',    employerRoutes)
app.use('/api/jobs',         jobRoutes)
app.use('/api/applications', applicationRoutes)
app.use('/api/payments',     paymentRoutes)
app.use('/api/documents',    documentRoutes)
// Mounted before the more general /api/admin prefix so a future catch-all
// route added there can never shadow these.
app.use('/api/admin/reports', reportsRoutes)
app.use('/api/admin',        adminRoutes)

/* DB connectivity state, surfaced through /api/health */
let dbReady = false
let dbError: string | null = null

app.get('/api/health', (_req, res) =>
  res.status(dbReady ? 200 : 503).json({
    status:  dbReady ? 'ok' : 'degraded',
    service: 'Ex-Serviceman Jobs API',
    env:     _env.NODE_ENV,
    db:      dbReady ? 'connected' : 'unavailable',
    dbTarget: dbTarget(),
    dbError: dbReady ? undefined : dbError,
  }),
)

/* ── GET /api/config ── public runtime configuration ─────────────────── */
/*
 * Values the browser legitimately needs and which are public by design: an
 * OAuth client id and a Razorpay key id both ship in the bundle anyway.
 *
 * Serving them at runtime rather than baking them in at build time means the
 * server is the single source of truth. Vite freezes import.meta.env at build
 * time, so a value set on the box after the build simply is not there — which
 * is exactly how the Google button ended up reporting itself unconfigured
 * while the backend was correctly set up all along. Read at runtime, changing
 * the id needs a restart, not a rebuild and redeploy.
 *
 * Only ever expose public identifiers here. Secrets — RAZORPAY_KEY_SECRET,
 * JWT_SECRET, database credentials — must never appear in this response.
 */
app.get('/api/config', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300')
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || null,
    // Withheld while registration is free, even though the key id itself is
    // not secret — there is no reason to hand it out for a flow that is off.
    razorpayKeyId:  paymentsEnabled() ? (process.env.RAZORPAY_KEY_ID || null) : null,
    paymentsEnabled: paymentsEnabled(),
  })
})

/* ── Error handling ──────────────────────────────────────────────────── */
/*
 * Catches anything a route forwards via next(err) — including rejections from
 * async handlers wrapped with ah(). Without this an async failure became an
 * unhandled rejection, which on Node 15+ kills the process: one bad query took
 * the whole API down and the browser saw a bare 502 with an empty body.
 */
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const isDbDown = ['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN'].includes(err?.code)
  console.error('[unhandled route error]', err?.code ?? '', err?.message ?? err)

  if (res.headersSent) return

  res.status(isDbDown ? 503 : 500).json({
    error: isDbDown
      ? 'The service is temporarily unavailable. Please try again in a moment.'
      : 'Something went wrong. Please try again.',
  })
})

/* Last-resort guards: log and keep serving rather than letting one failed
   promise terminate the process and take every other user down with it. */
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason instanceof Error ? reason.message : reason)
})
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err.message)
})

/* ── Start ───────────────────────────────────────────────────────────── */
/*
 * The HTTP listener opens BEFORE the database is touched.
 *
 * Previously initDb() ran first, so an unreachable database meant app.listen()
 * was never reached: the process exited, Render restarted it, and the service
 * sat in a crash loop answering nothing at all — no health endpoint, no error
 * page, just hung connections. A database problem was indistinguishable from a
 * dead host. Now the server always answers, and /api/health says exactly which
 * host it failed to reach.
 */
async function connectDb(attempt = 1): Promise<void> {
  try {
    await initDb()
    dbReady = true
    dbError = null
    console.log(`✅ Database connected → ${dbTarget()}`)
  } catch (e: any) {
    dbReady = false
    dbError = e.message
    console.error(`❌ Database unreachable (attempt ${attempt}) → ${dbTarget()}`)
    console.error(`   ${e.code ?? ''} ${e.message}`)
    if (e.code === 'ENOTFOUND') {
      console.error('   That hostname does not resolve. Usual causes:')
      console.error('   • the database is in a different region than this service')
      console.error('   • the database is in a different Render workspace/environment')
      console.error('   • the database is still provisioning')
      console.error('   • an internal dpg-xxxx-a host was used from outside its region')
      console.error('     (cross-region needs the EXTERNAL host + SSL)')
    }
    // Keep retrying with a cap, so the service recovers on its own once the
    // database comes back instead of needing a manual redeploy.
    const delay = Math.min(30_000, 2_000 * 2 ** (attempt - 1))
    setTimeout(() => void connectDb(attempt + 1), delay)
  }
}

app.listen(PORT, () => {
  console.log(`✅ Ex-Serviceman Jobs API listening on ${PORT}`)
  void connectDb()
  startTokenCleanupJob()
})
