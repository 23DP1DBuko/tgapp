import { describe, it, expect, vi } from 'vitest'

// Mock firebase-admin so importing helpers.ts does not bootstrap a real
// Firebase app at module load.
vi.mock('firebase-admin/app', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase-admin/app')>()
  return {
    ...actual,
    getApps: () => [{ name: '[DEFAULT]' } as never],
    initializeApp: vi.fn(() => ({}) as never),
  }
})

import { isValidClientOrderId } from '../src/helpers.js'

describe('isValidClientOrderId (M4 idempotency key)', () => {
  it('accepts a UUID v4 key', () => {
    expect(isValidClientOrderId('9f2c3f4a-1b2c-4d5e-8f90-1234567890ab')).toBe(true)
  })

  it('accepts the client fallback slug-style key', () => {
    expect(isValidClientOrderId('lxyz4k1a-2m7p0q3r9s')).toBe(true)
  })

  it('rejects missing, empty, or non-string values', () => {
    expect(isValidClientOrderId(undefined)).toBe(false)
    expect(isValidClientOrderId(null)).toBe(false)
    expect(isValidClientOrderId('')).toBe(false)
    expect(isValidClientOrderId(42)).toBe(false)
  })

  it('rejects keys that are too short or too long', () => {
    expect(isValidClientOrderId('short')).toBe(false) // < 8 chars
    expect(isValidClientOrderId('a'.repeat(81))).toBe(false) // > 80 chars
  })

  it('rejects characters that are unsafe in document ids / URLs', () => {
    expect(isValidClientOrderId('key/with/slash')).toBe(false)
    expect(isValidClientOrderId('key with spaces')).toBe(false)
    expect(isValidClientOrderId('key"quote')).toBe(false)
    expect(isValidClientOrderId('key<script>')).toBe(false)
  })
})
