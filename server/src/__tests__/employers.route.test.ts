import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import http from 'http'
import bcrypt from 'bcryptjs'

import { pool } from '../db'
import employersRouter from '../routes/employers'
import { signAccessToken } from '../lib/tokens'

/*
 * Regression tests for the GST-upsert account-takeover fix (POST /register).
 *
 * Exercises the real route against a real Postgres connection — the same
 * pattern used by documents.route.test.ts / reports.route.test.ts — so the
 * actual SQL (ON CONFLICT (gst) DO NOTHING, the constraint-name check in the
 * catch block) is what's under test, not a mocked approximation of it.
 */

const TAG = 'emptest'

let server: http.Server
let base: string

interface Fixture { id: number; gst: string; email: string; passwordHash: string }

async function mkEmployer(overrides: Partial<{ gst: string; email: string; passwordHash: string | null }> = {}): Promise<Fixture> {
  const n    = Date.now() + Math.floor(Math.random() * 100000)
  const gst  = overrides.gst  ?? `18AAAAA${String(n).slice(-4)}A1Z5`.slice(0, 15)
  const email = overrides.email ?? `${TAG}-${n}@test.invalid`
  const passwordHash = overrides.passwordHash === undefined
    ? await bcrypt.hash('OriginalPassw0rd!', 12)
    : overrides.passwordHash

  const r = await pool.query(
    `INSERT INTO employers (company_name, gst, pan, email, password_hash, mobile, state, district, address, pincode)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id, gst, email, password_hash`,
    [`${TAG} Original Co`, gst, 'ABCDE1234F', email, passwordHash, '9123456789', 'Assam', 'Kamrup', '1 Test Road', '781001'],
  )
  return { id: r.rows[0].id, gst: r.rows[0].gst, email: r.rows[0].email, passwordHash: r.rows[0].password_hash }
}

/** A syntactically-valid, unique GST number for a fresh registration. */
function freshGst(): string {
  const n = Date.now() + Math.floor(Math.random() * 100000)
  return `27BBBBB${String(n).slice(-4)}B1Z${(n % 10)}`.slice(0, 15)
}

const post = (path: string, body: unknown) =>
  fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

before(async () => {
  const app = express()
  app.use(express.json())
  app.use('/', employersRouter)
  server = http.createServer(app)
  await new Promise<void>((r) => { server.listen(0, r) })
  base = 'http://127.0.0.1:' + (server.address() as any).port
})

after(async () => {
  await new Promise<void>((r) => { server.close(() => r()) })
  await pool.query(`DELETE FROM employers WHERE email LIKE '${TAG}-%'`)
  await pool.end()
})

/* ── Test A1: new employer registration ─────────────────────────────── */
describe('new employer registration', () => {
  test('succeeds with a previously unused GST, hashes the password, returns a working session', async () => {
    const gst = freshGst()
    const email = `${TAG}-${Date.now()}-new@test.invalid`
    const res = await post('/register', {
      companyName: `${TAG} New Co`, gst, pan: 'ABCDE1234F', email,
      password: 'BrandNewPassw0rd!', mobile: '9876543210',
      state: 'Assam', district: 'Kamrup', address: '2 Test Road', pincode: '781002',
    })
    assert.equal(res.status, 201)
    const body = await res.json() as any
    assert.equal(body.success, true)
    assert.equal(body.employer.gst, gst)
    assert.ok(body.accessToken, 'a working access token must be issued')

    const row = await pool.query('SELECT password_hash FROM employers WHERE gst=$1', [gst])
    assert.notEqual(row.rows[0].password_hash, 'BrandNewPassw0rd!', 'password must be hashed, not stored in plain text')
    assert.ok(await bcrypt.compare('BrandNewPassw0rd!', row.rows[0].password_hash))
  })
})

/* ── Test A2: duplicate GST, no password supplied ───────────────────── */
describe('duplicate GST registration — no password', () => {
  test('is rejected, issues no session, and leaves the original account untouched', async () => {
    const original = await mkEmployer()

    const res = await post('/register', {
      companyName: 'Attacker Renamed Co',
      gst: original.gst,
      pan: 'ZZZZZ9999Z',
      email: `${TAG}-attacker-noPass@test.invalid`,
      mobile: '9000000001',
      state: 'Delhi', district: 'New Delhi', address: 'Attacker Address', pincode: '110001',
    })

    assert.equal(res.status, 409)
    const body = await res.json() as any
    assert.ok(!body.accessToken, 'no session must be issued for a rejected duplicate')

    const row = await pool.query('SELECT company_name, email, password_hash FROM employers WHERE id=$1', [original.id])
    assert.equal(row.rows[0].company_name, `${TAG} Original Co`)
    assert.equal(row.rows[0].email, original.email)
    assert.equal(row.rows[0].password_hash, original.passwordHash)
  })
})

/* ── Test A3: duplicate GST WITH an attacker-controlled password ───── */
describe('duplicate GST registration — attacker supplies a password', () => {
  test('does not overwrite the password hash, and the attacker cannot then log in as the original account', async () => {
    const original = await mkEmployer()

    const res = await post('/register', {
      companyName: 'Attacker Renamed Co 2',
      gst: original.gst,
      pan: 'ZZZZZ9999Z',
      email: `${TAG}-attacker-withPass@test.invalid`,
      password: 'AttackerChosenPassw0rd!',
      mobile: '9000000002',
      state: 'Delhi', district: 'New Delhi', address: 'Attacker Address', pincode: '110001',
    })

    assert.equal(res.status, 409)
    const body = await res.json() as any
    assert.ok(!body.accessToken)

    const row = await pool.query('SELECT password_hash, email FROM employers WHERE id=$1', [original.id])
    assert.equal(row.rows[0].password_hash, original.passwordHash, 'original password hash must be unchanged')
    assert.equal(row.rows[0].email, original.email, 'original email must be unchanged')

    // The attacker's chosen password must NOT work against the real account.
    const loginRes = await post('/login', { email: original.email, password: 'AttackerChosenPassw0rd!' })
    assert.equal(loginRes.status, 401)
  })
})

/* ── Test A4: duplicate email, fresh GST ─────────────────────────────── */
describe('duplicate email registration', () => {
  test('is rejected safely, with no raw database error exposed, and makes no account changes', async () => {
    const original = await mkEmployer()
    const newGst = freshGst()

    const res = await post('/register', {
      companyName: 'Someone Else Co',
      gst: newGst,
      pan: 'ABCDE1234F',
      email: original.email, // already used by `original`, but GST is fresh
      password: 'SomePassw0rd!',
      mobile: '9000000003',
      state: 'Assam', district: 'Kamrup', address: 'Some Address', pincode: '781003',
    })

    assert.equal(res.status, 409)
    const body = await res.json() as any
    assert.ok(!('detail' in body), 'no raw DB error detail should be returned')
    assert.ok(!/constraint|duplicate key|violates/i.test(body.error ?? ''), 'message must not leak raw Postgres wording')

    // The fresh GST must not have been left behind as a partial/orphaned row.
    const orphan = await pool.query('SELECT 1 FROM employers WHERE gst=$1', [newGst])
    assert.equal(orphan.rows.length, 0)
  })
})

/* ── Test A6: legitimate login and profile update still work ────────── */
describe('legitimate employer workflows remain intact', () => {
  test('an employer can still log in with their real password', async () => {
    const plain = 'RealLoginPassw0rd!'
    const original = await mkEmployer({ passwordHash: await bcrypt.hash(plain, 12) })

    const res = await post('/login', { email: original.email, password: plain })
    assert.equal(res.status, 200)
    const body = await res.json() as any
    assert.ok(body.accessToken)
  })

  test('PATCH /:id still requires ownership and still allows a legitimate self-edit', async () => {
    const owner = await mkEmployer()
    const other = await mkEmployer()

    const ownerTok = signAccessToken({ id: String(owner.id), role: 'employer' })
    const otherTok = signAccessToken({ id: String(other.id), role: 'employer' })

    const denied = await fetch(`${base}/${owner.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${otherTok}` },
      body: JSON.stringify({ companyName: 'Hijacked Name' }),
    })
    assert.equal(denied.status, 403)

    const allowed = await fetch(`${base}/${owner.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerTok}` },
      body: JSON.stringify({ companyName: 'Legitimately Renamed Co' }),
    })
    assert.equal(allowed.status, 200)
  })
})
