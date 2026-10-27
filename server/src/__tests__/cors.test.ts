import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { parseAllowedOrigins, buildNetlifyPreviewPatterns, isOriginAllowed } from '../lib/cors'

/*
 * Regression tests for the CORS fix: production must not accept an
 * arbitrary localhost/127.0.0.1 origin, while legitimate production and
 * development origins keep working.
 */

const allowedOrigins = parseAllowedOrigins('https://exservicemanjobs.com,https://preview-site.netlify.app')
const netlifyPreviewPatterns = buildNetlifyPreviewPatterns(allowedOrigins)

describe('production origin policy', () => {
  const prodPolicy = { allowedOrigins, netlifyPreviewPatterns, isProd: true }

  test('the approved production frontend origin is accepted', () => {
    assert.equal(isOriginAllowed('https://exservicemanjobs.com', prodPolicy), true)
  })

  test('an arbitrary localhost origin is NOT accepted in production', () => {
    assert.equal(isOriginAllowed('http://localhost:9999', prodPolicy), false)
    assert.equal(isOriginAllowed('http://localhost:3000', prodPolicy), false)
    assert.equal(isOriginAllowed('http://localhost', prodPolicy), false)
  })

  test('an arbitrary 127.0.0.1 origin is NOT accepted in production', () => {
    assert.equal(isOriginAllowed('http://127.0.0.1:5173', prodPolicy), false)
  })

  test('an unrelated external origin is rejected', () => {
    assert.equal(isOriginAllowed('https://evil.example.com', prodPolicy), false)
  })

  test('an allowed Netlify deploy-preview subdomain is accepted', () => {
    assert.equal(isOriginAllowed('https://deploy-preview-3--preview-site.netlify.app', prodPolicy), true)
  })

  test('an UNRELATED Netlify site is not accepted merely for being *.netlify.app', () => {
    assert.equal(isOriginAllowed('https://some-other-app.netlify.app', prodPolicy), false)
  })

  test('a trailing slash on the origin does not bypass the check', () => {
    assert.equal(isOriginAllowed('https://exservicemanjobs.com/', prodPolicy), true)
    assert.equal(isOriginAllowed('http://localhost:9999/', prodPolicy), false)
  })
})

describe('development origin policy', () => {
  const devPolicy = { allowedOrigins, netlifyPreviewPatterns, isProd: false }

  test('localhost is accepted only under the development policy', () => {
    assert.equal(isOriginAllowed('http://localhost:5173', devPolicy), true)
    assert.equal(isOriginAllowed('http://127.0.0.1:5173', devPolicy), true)
  })

  test('the production frontend origin still works in development too', () => {
    assert.equal(isOriginAllowed('https://exservicemanjobs.com', devPolicy), true)
  })

  test('an unrelated origin is still rejected in development', () => {
    assert.equal(isOriginAllowed('https://evil.example.com', devPolicy), false)
  })
})
