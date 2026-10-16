import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import path from 'path'
import {
  isS3Path, s3KeyFromPath, toStoredPath, buildObjectKey, S3_SCHEME,
} from '../lib/storage'
import { checkFileSignature, safeResolveUpload, uploadDir } from '../lib/upload'

describe('file_path storage convention', () => {
  test('legacy bare filenames are not treated as S3 objects', () => {
    for (const legacy of [
      '9f3c1b2a-4d5e-6789-abcd-ef0123456789.png',
      'abc.pdf',
      'no-extension',
    ]) {
      assert.equal(isS3Path(legacy), false, legacy)
      assert.equal(s3KeyFromPath(legacy), null, legacy)
    }
  })

  test('s3:// paths round-trip to their key', () => {
    const key = 'candidates/24/aadhaar/8f14e45f.png'
    const stored = toStoredPath(key)
    assert.equal(stored, S3_SCHEME + key)
    assert.equal(isS3Path(stored), true)
    assert.equal(s3KeyFromPath(stored), key)
  })

  test('an empty s3:// path yields no key rather than an empty one', () => {
    assert.equal(s3KeyFromPath('s3://'), null)
  })
})

describe('object keys', () => {
  test('never contain the candidate-supplied filename', () => {
    const key = buildObjectKey(7, 'aadhaar', '.png')
    assert.ok(!key.includes('evil'), key)
    assert.match(key, /^candidates\/7\/aadhaar\/[0-9a-f-]{36}\.png$/)
  })

  test('are unpredictable — no two calls collide', () => {
    const keys = new Set(Array.from({ length: 500 }, () => buildObjectKey(1, 'pan', '.pdf')))
    assert.equal(keys.size, 500)
  })

  test('strip traversal and control characters out of docType and ext', () => {
    const key = buildObjectKey(3, '../../etc/passwd', '.png')
    assert.ok(!key.includes('..'), key)
    assert.ok(!key.includes('/etc/'), key)
    // candidates/3/<sanitised>/<uuid>.png — exactly four segments
    assert.equal(key.split('/').length, 4)
  })

  test('coerce a non-numeric candidate id to a number', () => {
    const key = buildObjectKey('5/../9' as any, 'pan', '.pdf')
    assert.ok(!key.includes('..'), key)
  })
})

describe('file signature validation', () => {
  const png  = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])
  const pdf  = Buffer.from('%PDF-1.7\n...')
  const docx = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0])

  test('accepts content that matches its extension', () => {
    assert.equal(checkFileSignature(png,  'a.png'),  null)
    assert.equal(checkFileSignature(jpeg, 'a.jpg'),  null)
    assert.equal(checkFileSignature(jpeg, 'a.jpeg'), null)
    assert.equal(checkFileSignature(pdf,  'a.pdf'),  null)
    assert.equal(checkFileSignature(docx, 'a.docx'), null)
  })

  test('rejects an executable renamed to an image extension', () => {
    const mz = Buffer.from([0x4d, 0x5a, 0x90, 0x00])  // Windows PE
    assert.ok(checkFileSignature(mz, 'payload.png'))
    assert.ok(checkFileSignature(mz, 'payload.jpg'))
    assert.ok(checkFileSignature(mz, 'payload.pdf'))
  })

  test('rejects a script renamed to .pdf', () => {
    assert.ok(checkFileSignature(Buffer.from('<?php system($_GET[0]); ?>'), 'x.pdf'))
  })

  test('rejects an empty file', () => {
    assert.ok(checkFileSignature(Buffer.alloc(0), 'a.png'))
  })
})

describe('legacy path resolution', () => {
  test('resolves a plain filename inside the upload directory', () => {
    const abs = safeResolveUpload('abc.png')
    assert.ok(abs && abs.startsWith(path.resolve(uploadDir)))
  })

  test('refuses traversal out of the upload directory', () => {
    for (const evil of [
      '../../../etc/passwd',
      '..\..\windows\system32\config\sam',
      '/etc/shadow',
    ]) {
      const abs = safeResolveUpload(evil)
      assert.ok(abs === null || abs.startsWith(path.resolve(uploadDir)), evil)
    }
  })

  test('refuses a null byte', () => {
    assert.equal(safeResolveUpload('a\0.png'), null)
  })
})
