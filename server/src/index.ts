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
// In development allow any localhost port (Vite may pick 5173, 5174, etc.)
const corsOptions = {
  origin: _env.NODE_ENV === 'development'
    ? /^http:\/\/localhost(:\d+)?$/
    : _env.FRONTEND_URL,
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
  res.json({ status: 'ok', service: 'ATS Corps API', env: _env.NODE_ENV }),
)

/* ── Start ───────────────────────────────────────────────────────────── */
async function start() {
  await initDb()
  startTokenCleanupJob()
  app.listen(PORT, () => console.log(`✅ ATS Corps API → http://localhost:${PORT}`))
}
start().catch(console.error)
