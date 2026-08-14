import { describe, it, expect, vi } from 'vitest'

// Mock firebase-admin so importing orders.ts (which imports helpers.ts) does
// not bootstrap a real Firebase app at module load.
vi.mock('firebase-admin/app', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase-admin/app')>()
  return {
    ...actual,
    getApps: () => [{ name: '[DEFAULT]' } as never],
    initializeApp: vi.fn(() => ({}) as never),
  }
})

import { computePromoDiscount, validateCheckoutPromo } from '../src/orders.js'
import type { CheckoutAppliedPromo } from '../src/orders.js'

// ── Helpers ──

function timestamp(ms: number) {
  return { toMillis: () => ms } as never
}

function makePromo(overrides: Record<string, unknown> = {}) {
  return {
    discountType: 'percentage',
    discountValue: 10,
    isActive: true,
    expiresAt: timestamp(Date.now() + 86_400_000), // +1 day
    usageCount: 0,
    usageLimit: 1,
    ...overrides,
  }
}

function makeSubmitted(overrides: Partial<CheckoutAppliedPromo> = {}): CheckoutAppliedPromo {
  return {
    code: 'DROP10',
    discountType: 'percentage',
    discountValue: 10,
    discountAmount: 10,
    ...overrides,
  }
}

const NOW = 1_700_000_000_000

describe('computePromoDiscount', () => {
  it('computes a percentage discount with 2-decimal rounding (mirrors the client)', () => {
    expect(computePromoDiscount({ discountType: 'percentage', discountValue: 10 }, 100)).toBe(10)
    // 55.5 * 5 / 100 = 2.775 → toFixed(2) rounds the binary double down to 2.77,
    // identical to the client's validatePromoCode math.
    expect(computePromoDiscount({ discountType: 'percentage', discountValue: 5 }, 55.5)).toBe(2.77)
    expect(computePromoDiscount({ discountType: 'percentage', discountValue: 25 }, 99.99)).toBe(25)
  })

  it('caps a fixed-amount discount at the subtotal', () => {
    expect(computePromoDiscount({ discountType: 'fixed_amount', discountValue: 20 }, 100)).toBe(20)
    expect(computePromoDiscount({ discountType: 'fixed_amount', discountValue: 200 }, 100)).toBe(100)
  })

  it('returns 0 for non-positive subtotals', () => {
    expect(computePromoDiscount({ discountType: 'percentage', discountValue: 10 }, 0)).toBe(0)
    expect(computePromoDiscount({ discountType: 'fixed_amount', discountValue: 10 }, -5)).toBe(0)
  })
})

describe('validateCheckoutPromo', () => {
  it('accepts a valid promo and returns the server-computed discount', () => {
    const result = validateCheckoutPromo(makePromo(), makeSubmitted(), 100, NOW)
    expect(result).toEqual({ status: 'valid', discountAmount: 10 })
  })

  it('accepts a fixed_amount promo', () => {
    const result = validateCheckoutPromo(
      makePromo({ discountType: 'fixed_amount', discountValue: 25 }),
      makeSubmitted({ discountType: 'fixed_amount', discountValue: 25, discountAmount: 25 }),
      100,
      NOW,
    )
    expect(result).toEqual({ status: 'valid', discountAmount: 25 })
  })

  it('returns valid with zero discount when no promo is submitted', () => {
    expect(validateCheckoutPromo(undefined, null, 100, NOW)).toEqual({ status: 'valid', discountAmount: 0 })
  })

  it('rejects a missing promo document (promo_invalid)', () => {
    expect(validateCheckoutPromo(undefined, makeSubmitted(), 100, NOW).status).toBe('promo_invalid')
  })

  it('rejects an inactive promo (promo_inactive)', () => {
    const result = validateCheckoutPromo(makePromo({ isActive: false }), makeSubmitted(), 100, NOW)
    expect(result.status).toBe('promo_inactive')
  })

  it('rejects an expired promo (promo_expired)', () => {
    const expired = makePromo({ expiresAt: timestamp(NOW - 1) })
    const result = validateCheckoutPromo(expired, makeSubmitted(), 100, NOW)
    expect(result.status).toBe('promo_expired')
  })

  it('rejects a promo that expires exactly now (server is stricter than the client)', () => {
    // The client's validatePromoCode uses `<` (allows use at exactly-now expiry);
    // the server deliberately uses `<=` so an order can never be created on a
    // promo that is already past its expiry window.
    const atExpiry = makePromo({ expiresAt: timestamp(NOW) })
    const result = validateCheckoutPromo(atExpiry, makeSubmitted(), 100, NOW)
    expect(result.status).toBe('promo_expired')
  })

  it('rejects an exhausted promo (promo_exhausted)', () => {
    const result = validateCheckoutPromo(
      makePromo({ usageCount: 1, usageLimit: 1 }),
      makeSubmitted(),
      100,
      NOW,
    )
    expect(result.status).toBe('promo_exhausted')
  })

  it('allows an unlimited promo (usageLimit null)', () => {
    const result = validateCheckoutPromo(
      makePromo({ usageLimit: null }),
      makeSubmitted(),
      100,
      NOW,
    )
    expect(result.status).toBe('valid')
  })

  it('rejects a mismatched discountType (promo_invalid)', () => {
    const result = validateCheckoutPromo(
      makePromo({ discountType: 'percentage' }),
      makeSubmitted({ discountType: 'fixed_amount', discountValue: 10, discountAmount: 10 }),
      100,
      NOW,
    )
    expect(result.status).toBe('promo_invalid')
  })

  it('rejects a tampered discountValue (promo_invalid)', () => {
    const result = validateCheckoutPromo(
      makePromo({ discountValue: 10 }),
      makeSubmitted({ discountValue: 100, discountAmount: 10 }),
      100,
      NOW,
    )
    expect(result.status).toBe('promo_invalid')
  })

  it('rejects a tampered discountAmount (promo_invalid)', () => {
    const result = validateCheckoutPromo(
      makePromo({ discountValue: 10 }),
      makeSubmitted({ discountAmount: 0 }), // the H1 exploit: total = 0
      100,
      NOW,
    )
    expect(result.status).toBe('promo_invalid')
  })

  it('rejects a percentage discountAmount that does not match server rounding (promo_invalid)', () => {
    const result = validateCheckoutPromo(
      makePromo({ discountValue: 5 }),
      makeSubmitted({ discountValue: 5, discountAmount: 2.78 }), // server computes 2.77
      55.5,
      NOW,
    )
    expect(result.status).toBe('promo_invalid')
  })
})
