import { z } from 'zod'

const schema = z
  .object({
    JWT_SECRET:           z.string().min(32, 'Must be ≥32 chars — run: openssl rand -hex 32'),
    DB_HOST:              z.string().default('localhost'),
    DB_PORT:              z.string().default('5432'),
    DB_NAME:              z.string().min(1, 'DB_NAME is required'),
    DB_USER:              z.string().default('postgres'),
    DB_PASSWORD:          z.string().default('postgres'),
    PORT:                 z.string().default('4000'),
    // One or more allowed origins, comma-separated (e.g. "https://atscorps.netlify.app,https://www.atscorps.com")
    FRONTEND_URL:         z.string().min(1).default('http://localhost:5173'),
    NODE_ENV:             z.enum(['development', 'production', 'test']).default('development'),
    ADMIN_EMAIL:          z.string().email('Must be a valid email').default('admin@atscorps.com'),
    ADMIN_PASSWORD:       z.string().min(8, 'Must be ≥8 chars').optional(),
    ADMIN_PASSWORD_HASH:  z.string().optional(),
    // Razorpay — required for live payments, optional when DEV_BYPASS=true
    RAZORPAY_KEY_ID:     z.string().optional(),
    RAZORPAY_KEY_SECRET: z.string().optional(),
    // Dev-only bypass — NEVER set to true in production
    DEV_BYPASS:          z.enum(['true', 'false']).default('false'),
  })
  .refine(
    (d) => d.ADMIN_PASSWORD != null || d.ADMIN_PASSWORD_HASH != null,
    { message: 'Either ADMIN_PASSWORD or ADMIN_PASSWORD_HASH must be set in .env' },
  )

export type Env = z.infer<typeof schema>

let _env: Env | undefined

export function validateEnv(): Env {
  if (_env) return _env

  const result = schema.safeParse(process.env)
  if (!result.success) {
    const lines = result.error.issues
      .map((i) => `  • ${i.path.join('.') || 'root'}: ${i.message}`)
      .join('\n')
    console.error(`\n❌  Startup aborted — environment validation failed:\n${lines}\n`)
    process.exit(1)
  }

  _env = result.data
  return _env
}

/** Access validated env after validateEnv() has been called. */
export function env(): Env {
  if (!_env) throw new Error('Call validateEnv() before accessing env()')
  return _env
}
