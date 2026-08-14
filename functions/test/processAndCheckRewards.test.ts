import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock firebase-admin so importing helpers.ts does not try to bootstrap a real
// Firebase app at module load. Keep every other export intact.
vi.mock('firebase-admin/app', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase-admin/app')>()
  return {
    ...actual,
    getApps: () => [{ name: '[DEFAULT]' } as never],
    initializeApp: vi.fn(() => ({}) as never),
  }
})

import { processAndCheckRewards } from '../src/helpers.js'
import { FakeFirestore } from './fakeFirestore.js'

// The tier ladder mirrors REFERRAL_MILESTONES in helpers.ts.
const TIERS = [
  { threshold: 3, discountPercent: 5, codeSuffix: '05' },
  { threshold: 5, discountPercent: 10, codeSuffix: '10' },
  { threshold: 10, discountPercent: 15, codeSuffix: '15' },
  { threshold: 15, discountPercent: 25, codeSuffix: '25' },
]

function promoCodeShape(tier: (typeof TIERS)[number], userId: string): RegExp {
  return new RegExp(`^REF${tier.codeSuffix}_${userId.slice(-4)}_[A-Z0-9]{4}$`)
}

describe('processAndCheckRewards', () => {
  let db: FakeFirestore

  beforeEach(() => {
    db = new FakeFirestore()
  })

  it('grants exactly the tiers that were reached and returns the full ladder', async () => {
    const milestones = await processAndCheckRewards(db as never, 123456789, 5)

    expect(milestones).toHaveLength(4)
    expect(milestones[0]).toMatchObject({ threshold: 3, discountPercent: 5, granted: true })
    expect(milestones[1]).toMatchObject({ threshold: 5, discountPercent: 10, granted: true })
    expect(milestones[0].promoCode).toMatch(promoCodeShape(TIERS[0], '123456789'))
    expect(milestones[1].promoCode).toMatch(promoCodeShape(TIERS[1], '123456789'))
    expect(milestones[0].promoCodeId.length).toBeGreaterThan(0)

    // Unreached tiers stay locked
    expect(milestones[2]).toMatchObject({ threshold: 10, granted: false, promoCode: '' })
    expect(milestones[3]).toMatchObject({ threshold: 15, granted: false, promoCode: '' })

    // Promo codes written to the promoCodes collection with the checkout shape
    const promoDocs = db.readAll('promoCodes')
    expect(promoDocs).toHaveLength(2)
    for (const doc of promoDocs) {
      expect(doc.data).toMatchObject({
        discountType: 'percentage',
        isActive: true,
        usageLimit: 1,
        usageCount: 0,
      })
      expect(doc.data.expiresAt).toBeInstanceOf(Date)
    }

    // Grants persisted so they are never re-issued
    const grants = db.readAll('referralRewards')
    expect(grants).toHaveLength(1)
    expect(grants[0].data).toHaveProperty('3')
    expect(grants[0].data).toHaveProperty('5')
  })

  it('returns all tiers locked when the count is below the first threshold', async () => {
    const milestones = await processAndCheckRewards(db as never, 123456789, 2)

    expect(milestones.every((m) => !m.granted && m.promoCode === '')).toBe(true)
    expect(db.readAll('promoCodes')).toHaveLength(0)
    expect(db.readAll('referralRewards')).toHaveLength(0)
  })

  it('is idempotent across sequential calls (same code, no duplicate promoCodes)', async () => {
    const first = await processAndCheckRewards(db as never, 123456789, 5)
    const second = await processAndCheckRewards(db as never, 123456789, 5)

    expect(first[1].promoCode).toBe(second[1].promoCode)
    expect(first[1].promoCodeId).toBe(second[1].promoCodeId)
    expect(db.readAll('promoCodes')).toHaveLength(2)
  })

  it('is idempotent under concurrent calls (transaction conflict resolves to one grant)', async () => {
    const [first, second] = await Promise.all([
      processAndCheckRewards(db as never, 123456789, 5),
      processAndCheckRewards(db as never, 123456789, 5),
    ])

    expect(first[1].granted).toBe(true)
    expect(second[1].granted).toBe(true)
    expect(first[1].promoCode).toBe(second[1].promoCode)

    // Even though both calls raced, only one promo code per tier exists.
    const codes = db.readAll('promoCodes')
    expect(codes).toHaveLength(2)
    const uniqueCodes = new Set(codes.map((doc) => String(doc.data.code)))
    expect(uniqueCodes.size).toBe(2)

    // And exactly one grant record per tier was persisted.
    const grants = db.readAll('referralRewards')
    expect(grants).toHaveLength(1)
    const grant = grants[0].data as Record<string, unknown>
    expect(Object.keys(grant).sort()).toEqual(['3', '5'])
    for (const thresholdKey of ['3', '5']) {
      const record = grant[thresholdKey] as { promoCode?: unknown; promoCodeId?: unknown }
      expect(typeof record.promoCode).toBe('string')
      expect(typeof record.promoCodeId).toBe('string')
    }
  })

  it('does not re-grant tiers that already have a grant (stale promo preserved)', async () => {
    db.seed('referralRewards', '123456789', {
      '3': {
        promoCode: 'REF05_6789_OLD1',
        promoCodeId: 'existing-promo-id',
        grantedAt: '2026-01-01T00:00:00.000Z',
      },
    })

    const milestones = await processAndCheckRewards(db as never, 123456789, 3)

    expect(milestones[0]).toMatchObject({
      threshold: 3,
      granted: true,
      promoCode: 'REF05_6789_OLD1',
      promoCodeId: 'existing-promo-id',
    })
    expect(db.readAll('promoCodes')).toHaveLength(0)
  })
})
