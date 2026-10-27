import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import cors from 'cors'
import http from 'http'

import {
  parseAllowedOrigins, buildNetlifyPreviewPatterns, isOriginAllowed, OriginPolicy,
} from '../lib/cors'

/*
 * HTTP-level regression test for the CORS fix. cors.test.ts already covers
 * isOriginAllowed()/parseAllowedOrigins()/buildNetlifyPreviewPatterns() as
 * pure functions — this file instead wires up the REAL `cors` package
 * exactly the way index.ts does (same corsOptions.origin callback, same
 * app.options('*', ...) + app.use(cors(...)) pattern) and sends real HTTP
 * requests, so a regression in how index.ts WIRES that logic together
 * (credentials flag, preflight handling, origin-callback plumbing) would be
 * caught even if the underlying isOriginAllowed() function is still correct.
 *
 * Two servers are started: one with isProd: true (mirrors production) and
 * one with isProd: false (mirrors local development) — index.ts derives
 * this from NODE_ENV, which this test does not touch, so it builds the
 * policy objects directly instead.
 */

const FRONTEND_URL = 'https://exservicemanjobs.com,https://preview-site.netlify.app'

function buildApp(isProd: boolean): express.Express {
  const allowedOrigins         = parseAllowedOrigins(FRONTEND_URL)
  const netlifyPreviewPatterns = buildNetlifyPreviewPatterns(allowedOrigins)
  const originPolicy: OriginPolicy = { allowedOrigins, netlifyPreviewPatterns, isProd }

  // Exact mirror of index.ts's corsOptions and mounting order.
  const corsOptions: cors.CorsOptions = {
    origin(origin, callback) {
      if (!origin) return callback(null, true)
      if (isOriginAllowed(origin, originPolicy)) return callback(null, true)
      return callback(new Error(`CORS: origin not allowed — ${origin}`))
    },
    credentials: true,
  }

  const app = express()
  app.options('*', cors(corsOptions))
  app.use(cors(corsOptions))
  // A minimal error handler, mirroring index.ts's own catch-all, so a
  // rejected origin gets a normal HTTP response instead of hanging.
  app.get('/api/config', (_req, res) => res.json({ ok: true }))
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: 'Something went wrong. Please try again.' })
  })
  return app
}

let prodServer: http.Server
let devServer: http.Server
let prodBase: string
let devBase: string

before(async () => {
  prodServer = http.createServer(buildApp(true))
  devServer  = http.createServer(buildApp(false))
  await Promise.all([
    new Promise<void>((r) => { prodServer.listen(0, r) }),
    new Promise<void>((r) => { devServer.listen(0, r) }),
  ])
  prodBase = 'http://127.0.0.1:' + (prodServer.address() as any).port
  devBase  = 'http://127.0.0.1:' + (devServer.address() as any).port
})

after(async () => {
  await Promise.all([
    new Promise<void>((r) => { prodServer.close(() => r()) }),
    new Promise<void>((r) => { devServer.close(() => r()) }),
  ])
})

describe('production CORS — real HTTP requests against the real cors() middleware', () => {
  test('an untrusted localhost origin receives NO Access-Control-Allow-Origin header in production', async () => {
    const res = await fetch(`${prodBase}/api/config`, {
      headers: { Origin: 'http://localhost:9999' },
    })
    assert.equal(res.headers.get('access-control-allow-origin'), null,
      'a rejected origin must never receive an Access-Control-Allow-Origin header')
  })

  test('an untrusted localhost origin preflight (OPTIONS) is not granted CORS headers in production', async () => {
    const res = await fetch(`${prodBase}/api/config`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:9999',
        'Access-Control-Request-Method': 'GET',
      },
    })
    assert.equal(res.headers.get('access-control-allow-origin'), null)
    assert.equal(res.headers.get('access-control-allow-credentials'), null)
  })

  test('the allowed production origin receives the correct CORS headers, including credentials', async () => {
    const res = await fetch(`${prodBase}/api/config`, {
      headers: { Origin: 'https://exservicemanjobs.com' },
    })
    assert.equal(res.headers.get('access-control-allow-origin'), 'https://exservicemanjobs.com')
    assert.equal(res.headers.get('access-control-allow-credentials'), 'true')
    const body = await res.json() as any
    assert.equal(body.ok, true, 'the request must still actually reach the route, not just pass CORS')
  })

  test('an allowed production origin preflight succeeds with the right headers', async () => {
    const res = await fetch(`${prodBase}/api/config`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://exservicemanjobs.com',
        'Access-Control-Request-Method': 'GET',
      },
    })
    assert.equal(res.status, 204)
    assert.equal(res.headers.get('access-control-allow-origin'), 'https://exservicemanjobs.com')
    assert.equal(res.headers.get('access-control-allow-credentials'), 'true')
  })

  test('an unrelated external origin is rejected in production', async () => {
    const res = await fetch(`${prodBase}/api/config`, {
      headers: { Origin: 'https://evil.example.com' },
    })
    assert.equal(res.headers.get('access-control-allow-origin'), null)
  })

  test('a request with no Origin header (same-origin, curl, server-to-server) is never blocked', async () => {
    const res = await fetch(`${prodBase}/api/config`)
    const body = await res.json() as any
    assert.equal(body.ok, true)
  })
})

describe('development CORS — localhost is allowed only outside production', () => {
  test('an arbitrary localhost origin IS granted CORS headers in development', async () => {
    const res = await fetch(`${devBase}/api/config`, {
      headers: { Origin: 'http://localhost:5173' },
    })
    assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5173')
  })

  test('the same localhost origin is rejected by the production-configured server', async () => {
    const res = await fetch(`${prodBase}/api/config`, {
      headers: { Origin: 'http://localhost:5173' },
    })
    assert.equal(res.headers.get('access-control-allow-origin'), null,
      'the exact same origin must be treated differently purely based on isProd')
  })
})
