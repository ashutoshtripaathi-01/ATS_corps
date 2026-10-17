import { Pool, types } from 'pg'
import dotenv from 'dotenv'
import { paymentsEnabled } from './lib/applicationStatus'
dotenv.config()

// Return DATE columns as plain 'YYYY-MM-DD' strings. By default pg builds a
// Date at local midnight, which serialises to the previous day in JSON for any
// timezone ahead of UTC — that silently shifted follow-up and retirement dates.
types.setTypeParser(types.builtins.DATE, (v: string) => v)

/**
 * Connection config.
 *
 * DATABASE_URL wins when present — it is what Render hands you, and wiring it
 * through a Blueprint means the host can never drift out of sync with the
 * database the way five hand-copied DB_* vars can. The individual vars stay
 * as a fallback for local development.
 *
 * SSL is required on Render's EXTERNAL hostname and refused on the internal
 * dpg-xxxx-a form, so it follows the host instead of being hardcoded.
 */
const connectionString = process.env.DATABASE_URL

function targetHost(): string {
  if (!connectionString) return process.env.DB_HOST || 'localhost'
  try { return new URL(connectionString).hostname } catch { return 'unparseable' }
}

const needsSsl = /.render.com$/.test(targetHost())

export const pool = new Pool(
  connectionString
    ? {
        connectionString,
        ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
        connectionTimeoutMillis: 10_000,
      }
    : {
        host:     process.env.DB_HOST     || 'localhost',
        port:     Number(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME     || 'atscorps',
        user:     process.env.DB_USER     || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
        connectionTimeoutMillis: 10_000,
      },
)

/** Where we are trying to connect, with no credentials — safe to log. */
export function dbTarget(): string {
  let port = process.env.DB_PORT || '5432'
  let name = process.env.DB_NAME || 'atscorps'
  if (connectionString) {
    try {
      const u = new URL(connectionString)
      port = u.port || '5432'
      name = u.pathname.slice(1)
    } catch { port = '?'; name = '?' }
  }
  return targetHost() + ':' + port + '/' + name + (needsSsl ? ' (ssl)' : '')
}

export async function initDb() {
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS candidates (
        id                       SERIAL PRIMARY KEY,
        email                    VARCHAR(255)  UNIQUE,
        password_hash            TEXT,
        full_name                VARCHAR(255),
        mobile                   VARCHAR(15)   UNIQUE,
        force                    VARCHAR(50),
        rank                     VARCHAR(100),
        unit                     VARCHAR(255),
        retirement_date          DATE,
        post                     VARCHAR(100),
        other_post               VARCHAR(255),
        gun_license              VARCHAR(100),
        loc1                     VARCHAR(100),
        loc2                     VARCHAR(100),
        loc3                     VARCHAR(100),
        application_fee          INTEGER       DEFAULT 0,
        payment_status           VARCHAR(20)   DEFAULT 'pending',
        verification_status      VARCHAR(20)   DEFAULT 'pending',
        id_card_path             TEXT,
        discharge_book_path      TEXT,
        police_verification_path TEXT,
        created_at               TIMESTAMPTZ   DEFAULT NOW(),
        updated_at               TIMESTAMPTZ   DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS otps (
        id          SERIAL PRIMARY KEY,
        mobile      VARCHAR(15)  NOT NULL,
        otp_code    VARCHAR(10)  NOT NULL,
        expires_at  TIMESTAMPTZ  NOT NULL,
        used        BOOLEAN      DEFAULT FALSE,
        created_at  TIMESTAMPTZ  DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS employers (
        id            SERIAL PRIMARY KEY,
        company_name  VARCHAR(255) NOT NULL,
        gst           VARCHAR(20)  NOT NULL UNIQUE,
        pan           VARCHAR(15)  NOT NULL,
        email         VARCHAR(255) NOT NULL UNIQUE,
        mobile        VARCHAR(15),
        state         VARCHAR(100) NOT NULL,
        district      VARCHAR(100) NOT NULL,
        address       TEXT         NOT NULL,
        pincode       VARCHAR(10)  NOT NULL,
        status        VARCHAR(20)  DEFAULT 'active',
        created_at    TIMESTAMPTZ  DEFAULT NOW(),
        updated_at    TIMESTAMPTZ  DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS jobs (
        id            SERIAL PRIMARY KEY,
        employer_id   INTEGER REFERENCES employers(id) ON DELETE CASCADE,
        ref_no        VARCHAR(40)  UNIQUE,
        manpower_type VARCHAR(100) NOT NULL,
        quantity      INTEGER      NOT NULL DEFAULT 1,
        salary_range  VARCHAR(20)  NOT NULL,
        salary_min    INTEGER      DEFAULT 0,
        salary_max    INTEGER      DEFAULT 0,
        location      VARCHAR(100) NOT NULL,
        shift         VARCHAR(50)  NOT NULL,
        work_site     VARCHAR(100) NOT NULL,
        min_rank      VARCHAR(100) NOT NULL,
        min_service   VARCHAR(50)  NOT NULL,
        description   TEXT         NOT NULL,
        status        VARCHAR(20)  DEFAULT 'active',
        created_at    TIMESTAMPTZ  DEFAULT NOW(),
        updated_at    TIMESTAMPTZ  DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS applications (
        id            SERIAL PRIMARY KEY,
        job_id        INTEGER REFERENCES jobs(id)       ON DELETE CASCADE,
        candidate_id  INTEGER REFERENCES candidates(id) ON DELETE CASCADE,
        status        VARCHAR(20)  DEFAULT 'applied',
        cover_note    TEXT,
        created_at    TIMESTAMPTZ  DEFAULT NOW(),
        updated_at    TIMESTAMPTZ  DEFAULT NOW(),
        UNIQUE (job_id, candidate_id)
      );

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id          SERIAL PRIMARY KEY,
        token_hash  VARCHAR(64)   NOT NULL UNIQUE,
        user_id     VARCHAR(50)   NOT NULL,
        user_type   VARCHAR(20)   NOT NULL,
        family_id   UUID          NOT NULL,
        expires_at  TIMESTAMPTZ   NOT NULL,
        revoked     BOOLEAN       DEFAULT FALSE,
        created_at  TIMESTAMPTZ   DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id          SERIAL PRIMARY KEY,
        user_id     VARCHAR(50),
        action      VARCHAR(60)   NOT NULL,
        ip_address  VARCHAR(45),
        user_agent  TEXT,
        metadata    TEXT,
        created_at  TIMESTAMPTZ   DEFAULT NOW()
      );

      -- Phase 2 migration: email/password auth for employers
      ALTER TABLE employers ADD COLUMN IF NOT EXISTS password_hash TEXT;

      -- Phase 2 migration: email/password auth for candidates
      ALTER TABLE candidates ADD COLUMN IF NOT EXISTS email         VARCHAR(255);
      ALTER TABLE candidates ADD COLUMN IF NOT EXISTS password_hash TEXT;
      ALTER TABLE candidates ALTER COLUMN mobile          DROP NOT NULL;
      ALTER TABLE candidates ALTER COLUMN full_name       DROP NOT NULL;
      ALTER TABLE candidates ALTER COLUMN force           DROP NOT NULL;
      ALTER TABLE candidates ALTER COLUMN rank            DROP NOT NULL;
      ALTER TABLE candidates ALTER COLUMN unit            DROP NOT NULL;
      ALTER TABLE candidates ALTER COLUMN retirement_date DROP NOT NULL;
      ALTER TABLE candidates ALTER COLUMN post            DROP NOT NULL;
      ALTER TABLE candidates ALTER COLUMN loc1            DROP NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS candidates_email_key ON candidates(email) WHERE email IS NOT NULL;

      -- Phase 3 migration: pre-payment registration tracking
      ALTER TABLE candidates ADD COLUMN IF NOT EXISTS registration_status VARCHAR(30);
      UPDATE candidates SET registration_status = 'active'
        WHERE payment_status IN ('paid', 'dev_bypass') AND registration_status IS NULL;
      UPDATE candidates SET registration_status = 'pending_payment'
        WHERE registration_status IS NULL;

      CREATE TABLE IF NOT EXISTS payment_attempts (
        id                  SERIAL PRIMARY KEY,
        candidate_id        INTEGER REFERENCES candidates(id) ON DELETE CASCADE,
        razorpay_order_id   VARCHAR(100) UNIQUE NOT NULL,
        razorpay_payment_id VARCHAR(100),
        razorpay_signature  TEXT,
        amount              INTEGER NOT NULL,
        currency            VARCHAR(10)  DEFAULT 'INR',
        status              VARCHAR(20)  DEFAULT 'pending',
        created_at          TIMESTAMPTZ  DEFAULT NOW(),
        paid_at             TIMESTAMPTZ
      );

      CREATE INDEX IF NOT EXISTS idx_pay_attempts_candidate ON payment_attempts(candidate_id);
      CREATE INDEX IF NOT EXISTS idx_pay_attempts_order     ON payment_attempts(razorpay_order_id);

      -- Phase 4 migration: stable registration reference number
      ALTER TABLE candidates ADD COLUMN IF NOT EXISTS registration_ref VARCHAR(30);

      /* ═══════════════════════════════════════════════════════════════════
         Phase 5 migration — application lifecycle workflow
         The candidates row IS the registration application (1:1 with the
         user account). The tables below hang off candidate_id and carry the
         post-payment workflow: documents, calls, notes, timeline, visits.
         ═══════════════════════════════════════════════════════════════════ */

      ALTER TABLE candidates ADD COLUMN IF NOT EXISTS application_status VARCHAR(40);
      ALTER TABLE candidates ADD COLUMN IF NOT EXISTS assigned_admin     VARCHAR(120);
      ALTER TABLE candidates ADD COLUMN IF NOT EXISTS last_activity_at   TIMESTAMPTZ;

      -- Backfill lifecycle status from the existing payment/profile columns so
      -- no pre-existing registration is stranded without a status.
      UPDATE candidates SET application_status =
        CASE
          WHEN payment_status IN ('paid','dev_bypass')
               AND (id_card_path IS NOT NULL OR discharge_book_path IS NOT NULL)
                                                    THEN 'DOCUMENTS_SUBMITTED'
          WHEN payment_status IN ('paid','dev_bypass') THEN 'DOCUMENTS_PENDING'
          WHEN full_name IS NOT NULL AND loc1 IS NOT NULL THEN 'PAYMENT_PENDING'
          WHEN full_name IS NOT NULL OR force IS NOT NULL THEN 'APPLICATION_STARTED'
          ELSE 'REGISTERED'
        END
      WHERE application_status IS NULL;

      UPDATE candidates SET last_activity_at = COALESCE(updated_at, created_at)
        WHERE last_activity_at IS NULL;

      CREATE TABLE IF NOT EXISTS candidate_documents (
        id               SERIAL PRIMARY KEY,
        candidate_id     INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
        doc_type         VARCHAR(40)  NOT NULL,
        file_path        TEXT         NOT NULL,
        original_name    VARCHAR(255),
        status           VARCHAR(20)  NOT NULL DEFAULT 'UPLOADED',
        rejection_reason TEXT,
        reviewed_by      VARCHAR(120),
        reviewed_at      TIMESTAMPTZ,
        uploaded_at      TIMESTAMPTZ  DEFAULT NOW(),
        UNIQUE (candidate_id, doc_type)
      );

      CREATE TABLE IF NOT EXISTS call_logs (
        id                 SERIAL PRIMARY KEY,
        candidate_id       INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
        call_status        VARCHAR(30) NOT NULL,
        notes              TEXT,
        next_followup_date DATE,
        admin_id           VARCHAR(120),
        created_at         TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS admin_notes (
        id           SERIAL PRIMARY KEY,
        candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
        note         TEXT NOT NULL,
        admin_id     VARCHAR(120),
        created_at   TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS activity_events (
        id           SERIAL PRIMARY KEY,
        candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
        event_type   VARCHAR(60) NOT NULL,
        description  TEXT,
        actor_type   VARCHAR(20) DEFAULT 'system',
        actor_id     VARCHAR(120),
        metadata     TEXT,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS office_visits (
        id                           SERIAL PRIMARY KEY,
        candidate_id                 INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
        visit_date                   DATE,
        visit_time                   VARCHAR(20),
        assigned_staff               VARCHAR(120),
        status                       VARCHAR(20) DEFAULT 'SCHEDULED',
        physical_verification_status VARCHAR(20),
        notes                        TEXT,
        created_at                   TIMESTAMPTZ DEFAULT NOW(),
        updated_at                   TIMESTAMPTZ DEFAULT NOW()
      );

      -- Carry the three legacy document columns into candidate_documents so
      -- historical uploads remain visible under the new document workflow.
      INSERT INTO candidate_documents (candidate_id, doc_type, file_path, status)
      SELECT id, 'service_certificate', id_card_path, 'UPLOADED'
        FROM candidates WHERE id_card_path IS NOT NULL
      ON CONFLICT (candidate_id, doc_type) DO NOTHING;

      INSERT INTO candidate_documents (candidate_id, doc_type, file_path, status)
      SELECT id, 'discharge_book', discharge_book_path, 'UPLOADED'
        FROM candidates WHERE discharge_book_path IS NOT NULL
      ON CONFLICT (candidate_id, doc_type) DO NOTHING;

      INSERT INTO candidate_documents (candidate_id, doc_type, file_path, status)
      SELECT id, 'police_verification', police_verification_path, 'UPLOADED'
        FROM candidates WHERE police_verification_path IS NOT NULL
      ON CONFLICT (candidate_id, doc_type) DO NOTHING;

      /* ═══════════════════════════════════════════════════════════════════
         Phase 6 migration — Google sign-in
         password_hash was already nullable, so an account created through
         Google simply has no password. google_sub is Google's stable subject
         id: it never changes for a user, whereas an email address can be
         reassigned, so it is the field we match on first.
         ═══════════════════════════════════════════════════════════════════ */
      ALTER TABLE candidates ADD COLUMN IF NOT EXISTS google_sub    VARCHAR(64);
      ALTER TABLE candidates ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20);
      ALTER TABLE candidates ADD COLUMN IF NOT EXISTS avatar_url    TEXT;

      UPDATE candidates SET auth_provider = 'password'
        WHERE auth_provider IS NULL AND password_hash IS NOT NULL;

      CREATE UNIQUE INDEX IF NOT EXISTS candidates_google_sub_key
        ON candidates(google_sub) WHERE google_sub IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_cand_app_status   ON candidates(application_status);
      CREATE INDEX IF NOT EXISTS idx_cand_last_act     ON candidates(last_activity_at DESC);
      CREATE INDEX IF NOT EXISTS idx_cand_reg_ref      ON candidates(registration_ref);
      CREATE INDEX IF NOT EXISTS idx_docs_candidate    ON candidate_documents(candidate_id);
      CREATE INDEX IF NOT EXISTS idx_docs_status       ON candidate_documents(status);
      CREATE INDEX IF NOT EXISTS idx_calls_candidate   ON call_logs(candidate_id);
      CREATE INDEX IF NOT EXISTS idx_calls_followup    ON call_logs(next_followup_date);
      CREATE INDEX IF NOT EXISTS idx_notes_candidate   ON admin_notes(candidate_id);
      CREATE INDEX IF NOT EXISTS idx_events_candidate  ON activity_events(candidate_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_visits_candidate  ON office_visits(candidate_id);

      CREATE INDEX IF NOT EXISTS idx_jobs_employer      ON jobs(employer_id);
      CREATE INDEX IF NOT EXISTS idx_jobs_status        ON jobs(status);
      CREATE INDEX IF NOT EXISTS idx_apps_candidate     ON applications(candidate_id);
      CREATE INDEX IF NOT EXISTS idx_apps_job           ON applications(job_id);
      CREATE INDEX IF NOT EXISTS idx_rt_hash            ON refresh_tokens(token_hash);
      CREATE INDEX IF NOT EXISTS idx_rt_family          ON refresh_tokens(family_id);
      CREATE INDEX IF NOT EXISTS idx_audit_user         ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_action       ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_created      ON audit_logs(created_at DESC);
    `)

    /*
     * Phase 7 migration — registration made free.
     *
     * Any application still waiting on a payment it will now never be asked
     * for is moved straight to DOCUMENTS_PENDING, so it shows correctly in
     * the admin list and the candidate can upload immediately rather than
     * being stuck behind a step that no longer applies.
     *
     * Gated on the PAYMENTS_ENABLED flag rather than running unconditionally:
     * if payments are ever switched back on, a freshly created PAYMENT_PENDING
     * row must stay PAYMENT_PENDING, not be swept into DOCUMENTS_PENDING by
     * this migration on the next restart. The WHERE clause makes the whole
     * statement a no-op whenever payments are enabled, and running it again
     * once the backlog is cleared is harmless — there is nothing left to move.
     */
    await client.query(
      `UPDATE candidates
          SET application_status = 'DOCUMENTS_PENDING',
              last_activity_at   = NOW(),
              updated_at         = NOW()
        WHERE $1 = false
          AND application_status IN ('PAYMENT_PENDING', 'PAYMENT_FAILED', 'PAYMENT_CANCELLED')`,
      [paymentsEnabled()],
    )

    console.log('✅ DB tables ready')
  } finally {
    client.release()
  }
}
