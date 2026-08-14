import { describe, it, expect, vi } from 'vitest'

// Mock firebase-admin so importing promoCodes.ts (which imports helpers.ts)
// does not bootstrap a real Firebase app at module load.
vi.mock('firebase-admin/app', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase-admin/app')>()
  return {
    ...actual,
    getApps: () => [{ name: '[DEFAULT]' } as never],
    initializeApp: vi.fn(() => ({}) as never),
  }
})

import { evaluatePromoCodeForApply } from '../src/promoCodes.js'
import { computePromoDiscount } from '../src/orders.js'

// ── Helpers ──

function timestamp(ms: number) {
  return { toMillis: () => ms } as never
}

function makePromo(overrides: Record<string, unknown> = {}) {
  return {
    code: 'DROP10',
    discountType: 'percentage',
    discountValue: 10,
    isActive: true,
    expiresAt: timestamp(Date.now() + 86_400_000), // +1 day
    usageCount: 0,
    usageLimit: 1,
    ...overrides,
  }
}

const NOW = 1_700_000_000_000

describe('evaluatePromoCodeForApply', () => {
  it('returns a valid promo view with the server-computed discount', () => {
    const result = evaluatePromoCodeForApply(makePromo(), 100, NOW)
    expect(result).toEqual({
      status: 'valid',
      promo: {
        code: 'DROP10',
        discountType: 'percentage',
        discountValue: 10,
        discountAmount: 10,
      },
    })
  })

  it('supports fixed_amount promos', () => {
    const result = evaluatePromoCodeForApply(
      makePromo({ discountType: 'fixed_amount', discountValue: 25 }),
      100,
      NOW,
    )
    expect(result).toEqual({
      status: 'valid',
      promo: {
        code: 'DROP10',
        discountType: 'fixed_amount',
        discountValue: 25,
        discountAmount: 25,
      },
    })
  })

  it('mirrors checkout rounding for percentage discounts', () => {
    const result = evaluatePromoCodeForApply(makePromo({ discountValue: 5 }), 55.5, NOW)
    expect(result).toEqual({
      status: 'valid',
      promo: {
        code: 'DROP10',
        discountType: 'percentage',
        discountValue: 5,
        discountAmount: computePromoDiscount({ discountType: 'percentage', discountValue: 5 }, 55.5),
      },
    })
    expect(
      (result as { status: 'valid'; promo: { discountAmount: number } }).promo.discountAmount,
    ).toBe(2.77)
  })

  it('reports promo_not_found for a missing document', () => {
    expect(evaluatePromoCodeForApply(undefined, 100, NOW)).toEqual({ status: 'promo_not_found' })
  })

  it('reports promo_inactive', () => {
    const result = evaluatePromoCodeForApply(makePromo({ isActive: false }), 100, NOW)
    expect(result.status).toBe('promo_inactive')
  })

  it('reports promo_expired (including at exactly now, matching checkout)', () => {
    expect(evaluatePromoCodeForApply(makePromo({ expiresAt: timestamp(NOW - 1) }), 100, NOW).status).toBe(
      'promo_expired',
    )
    expect(evaluatePromoCodeForApply(makePromo({ expiresAt: timestamp(NOW) }), 100, NOW).status).toBe(
      'promo_expired',
    )
  })

  it('reports promo_exhausted when usageCount meets usageLimit', () => {
    const result = evaluatePromoCodeForApply(makePromo({ usageCount: 1, usageLimit: 1 }), 100, NOW)
    expect(result.status).toBe('promo_exhausted')
  })

  it('allows usage below the limit', () => {
    const result = evaluatePromoCodeForApply(makePromo({ usageCount: 0, usageLimit: 1 }), 100, NOW)
    expect(result.status).toBe('valid')
  })

  it('allows unlimited promos (usageLimit null)', () => {
    const result = evaluatePromoCodeForApply(makePromo({ usageLimit: null }), 100, NOW)
    expect(result.status).toBe('valid')
  })

  it('reports promo_no_discount when the computed discount is zero', () => {
    // Subtototal 0 cannot produce a discount — mirrors the client guard that
    // requires at least one item before applying a promo.
    const result = evaluatePromoCodeForApply(makePromo(), 0, NOW)
    expect(result.status).toBe('promo_no_discount')
  })
})
