import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import path from 'path'
import dotenv from 'dotenv'
import { validateEnv } from './lib/env'
import { initDb } from './db'
import { startTokenCleanupJob } from './jobs/tokenCleanup'
import authRoutes from './routes/auth'
import candidateRoutes from './routes/candidates'
import employerRoutes from './routes/employers'
import jobRoutes from './routes/jobs'
import applicationRoutes from './routes/applications'
import paymentRoutes from './routes/payments'

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

/* ── Static file serving ─────────────────────────────────────────────── */
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')))

/* ── API routes ──────────────────────────────────────────────────────── */
app.use('/api/auth',         authRoutes)
app.use('/api/candidates',   candidateRoutes)
app.use('/api/employers',    employerRoutes)
app.use('/api/jobs',         jobRoutes)
app.use('/api/applications', applicationRoutes)
app.use('/api/payments',     paymentRoutes)

app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', service: 'Ex-Serviceman Jobs API', env: _env.NODE_ENV }),
)

/* ── Start ───────────────────────────────────────────────────────────── */
async function start() {
  await initDb()
  startTokenCleanupJob()
  app.listen(PORT, () => console.log(`✅ Ex-Serviceman Jobs API → http://localhost:${PORT}`))
}
start().catch(console.error)
