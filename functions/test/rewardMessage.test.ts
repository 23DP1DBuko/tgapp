import { describe, it, expect, vi } from 'vitest'

// Mock firebase-admin so importing helpers.ts does not bootstrap a real app.
vi.mock('firebase-admin/app', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase-admin/app')>()
  return {
    ...actual,
    getApps: () => [{ name: '[DEFAULT]' } as never],
    initializeApp: vi.fn(() => ({}) as never),
  }
})

const fakeDbHolder = vi.hoisted(() => ({ current: null as never }))

vi.mock('firebase-admin/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase-admin/firestore')>()
  return {
    ...actual,
    getFirestore: () => fakeDbHolder.current,
  }
})

import { buildRewardMessageText, readGrantedRewardThresholds } from '../src/helpers.js'
import { FakeFirestore } from './fakeFirestore.js'

/** Create a fresh fake DB and route getFirestore() (used inside the module) to it. */
function makeDb(): FakeFirestore {
  const db = new FakeFirestore()
  fakeDbHolder.current = db as never
  return db
}

describe('buildRewardMessageText (L5)', () => {
  it('builds the full check-in reward message with real newlines', () => {
    const text = buildRewardMessageText({
      headline: '🎉 Daily check-in reward!',
      label: '5% OFF',
      code: 'DAILY05_4567_ABCD',
    })

    expect(text).toBe(
      [
        '🎉 Daily check-in reward!',
        '',
        'You unlocked a 5% OFF promo code:',
        'Code: DAILY05_4567_ABCD',
        '',
        'Single use · Valid for 30 days · Enter it at checkout.',
      ].join('\n'),
    )
    // M1-style regression guard: the literal backslash-n must never appear.
    expect(text.includes('\\n')).toBe(false)
  })

  it('builds the referral reward message', () => {
    const text = buildRewardMessageText({
      headline: '🎉 Referral reward!',
      label: '10% OFF',
      code: 'REF10_4567_WXYZ',
    })

    expect(text).toContain('🎉 Referral reward!')
    expect(text).toContain('You unlocked a 10% OFF promo code:')
    expect(text).toContain('Code: REF10_4567_WXYZ')
    expect(text.includes('\\n')).toBe(false)
  })
})

describe('readGrantedRewardThresholds (L5)', () => {
  it('returns an empty set when no rewards doc exists', async () => {
    const db = makeDb()

    const granted = await readGrantedRewardThresholds(db as never, 123)

    expect([...granted]).toEqual([])
  })

  it('returns only thresholds that actually hold a promo code', async () => {
    const db = makeDb()
    db.seed('referralRewards', '123', {
      '3': { promoCode: 'REF05_4567_AAAA', promoCodeId: 'p1', grantedAt: '2026-01-01' },
      '5': { promoCode: 'REF10_4567_BBBB', promoCodeId: 'p2', grantedAt: '2026-01-02' },
      '10': { promoCode: '', promoCodeId: '', grantedAt: '' },
      '15': {},
    })

    const granted = await readGrantedRewardThresholds(db as never, 123)

    expect([...granted].sort()).toEqual([3, 5])
  })
})
