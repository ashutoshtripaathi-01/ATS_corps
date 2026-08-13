import { Pool } from 'pg'
import dotenv from 'dotenv'
dotenv.config()

export const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'atscorps',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
})

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
    console.log('✅ DB tables ready')
  } finally {
    client.release()
  }
}
