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

import {
  applyProductDiscount,
  isProductDiscountType,
  isValidProductDiscountInput,
} from '../src/helpers.js'

describe('applyProductDiscount', () => {
  it('returns the base price when there is no discount', () => {
    expect(applyProductDiscount(40, undefined, undefined)).toBe(40)
    expect(applyProductDiscount(40, null, null)).toBe(40)
    expect(applyProductDiscount(40, 'percentage', null)).toBe(40)
    expect(applyProductDiscount(40, 'fixed', 0)).toBe(40)
    expect(applyProductDiscount(40, 'unknown_type', 10)).toBe(40)
  })

  it('applies a percentage discount with 2-decimal rounding', () => {
    expect(applyProductDiscount(40, 'percentage', 20)).toBe(32)
    expect(applyProductDiscount(39.99, 'percentage', 20)).toBe(31.99)
    expect(applyProductDiscount(100, 'percentage', 10)).toBe(90)
    expect(applyProductDiscount(10, 'percentage', 33)).toBe(6.7)
  })

  it('clamps a percentage discount at 100% (never negative)', () => {
    expect(applyProductDiscount(40, 'percentage', 100)).toBe(0)
    expect(applyProductDiscount(40, 'percentage', 150)).toBe(0)
  })

  it('applies a fixed amount discount with 2-decimal rounding', () => {
    expect(applyProductDiscount(40, 'fixed', 8)).toBe(32)
    expect(applyProductDiscount(40, 'fixed', 5.5)).toBe(34.5)
    expect(applyProductDiscount(40.25, 'fixed', 0.3)).toBe(39.95)
  })

  it('clamps a fixed discount at the full price (never negative)', () => {
    expect(applyProductDiscount(40, 'fixed', 40)).toBe(0)
    expect(applyProductDiscount(40, 'fixed', 60)).toBe(0)
  })
})

describe('isProductDiscountType', () => {
  it('accepts percentage and fixed', () => {
    expect(isProductDiscountType('percentage')).toBe(true)
    expect(isProductDiscountType('fixed')).toBe(true)
  })

  it('rejects everything else', () => {
    expect(isProductDiscountType('percent')).toBe(false)
    expect(isProductDiscountType('fixed_amount')).toBe(false)
    expect(isProductDiscountType(20)).toBe(false)
    expect(isProductDiscountType(null)).toBe(false)
  })
})

describe('isValidProductDiscountInput', () => {
  it('accepts a valid percentage discount', () => {
    expect(isValidProductDiscountInput({ discountType: 'percentage', discountValue: 20 })).toBe(true)
  })

  it('accepts a valid fixed discount', () => {
    expect(isValidProductDiscountInput({ discountType: 'fixed', discountValue: 10.5 })).toBe(true)
  })

  it('accepts a null discount (clears the discount)', () => {
    expect(isValidProductDiscountInput({ discountType: null, discountValue: null })).toBe(true)
    expect(isValidProductDiscountInput({ discountType: null, discountValue: undefined })).toBe(true)
  })

  it('rejects a percentage discount above 100%', () => {
    expect(isValidProductDiscountInput({ discountType: 'percentage', discountValue: 101 })).toBe(false)
  })

  it('rejects zero or negative discount values', () => {
    expect(isValidProductDiscountInput({ discountType: 'percentage', discountValue: 0 })).toBe(false)
    expect(isValidProductDiscountInput({ discountType: 'fixed', discountValue: -5 })).toBe(false)
  })

  it('rejects non-number values and unknown types', () => {
    expect(isValidProductDiscountInput({ discountType: 'percentage', discountValue: '20' })).toBe(false)
    expect(isValidProductDiscountInput({ discountType: 'percent', discountValue: 20 })).toBe(false)
    expect(isValidProductDiscountInput({ discountType: 'fixed' })).toBe(false)
    expect(isValidProductDiscountInput(null)).toBe(false)
    expect(isValidProductDiscountInput({})).toBe(false)
  })

  it('rejects a null discount with a leftover value', () => {
    expect(isValidProductDiscountInput({ discountType: null, discountValue: 20 })).toBe(false)
  })
})
