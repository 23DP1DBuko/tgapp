import { describe, it, expect, vi } from 'vitest'

// Mock firebase-admin so importing giveaways.ts / checkin.ts / helpers.ts
// (which call getFirestore at module scope) does not bootstrap a real app.
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

import {
  createDrawSeed,
  seededRandomUnit,
  runWeightedDraw,
  type DrawCandidate,
} from '../src/giveaways.js'
import {
  generateShortId,
  generateRandomSuffix,
  generateReferralPromoCode,
} from '../src/helpers.js'
import { generatePromoCode } from '../src/checkin.js'

describe('CSPRNG code generation (L2)', () => {
  it('generateShortId returns 8 lowercase-alphanumeric chars', () => {
    for (let i = 0; i < 100; i++) {
      expect(generateShortId()).toMatch(/^[a-z0-9]{8}$/)
    }
  })

  it('generateRandomSuffix returns 4 uppercase-alphanumeric chars', () => {
    for (let i = 0; i < 100; i++) {
      expect(generateRandomSuffix()).toMatch(/^[A-Z0-9]{4}$/)
    }
  })

  it('generated suffixes are unique across many draws', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 1000; i++) seen.add(generateRandomSuffix())
    expect(seen.size).toBeGreaterThan(900)
  })

  it('check-in codes keep the DAILY format', () => {
    for (let i = 0; i < 50; i++) {
      expect(generatePromoCode(1234567, 5)).toMatch(/^DAILY05_\d{4}_[A-Z0-9]{4}$/)
    }
  })

  it('referral codes keep the REF format', () => {
    const tier = { threshold: 3, discountPercent: 5, codeSuffix: '05', label: '5% OFF' }
    for (let i = 0; i < 50; i++) {
      expect(generateReferralPromoCode(1234567, tier)).toMatch(/^REF05_\d{4}_[A-Z0-9]{4}$/)
    }
  })
})

describe('seededRandomUnit (L2)', () => {
  it('is deterministic for the same seed + index and bounded in [0, 1)', () => {
    const a = seededRandomUnit('abc', 0)
    const b = seededRandomUnit('abc', 0)
    expect(a).toBe(b)
    expect(a).toBeGreaterThanOrEqual(0)
    expect(a).toBeLessThan(1)
  })

  it('varies across indices and seeds', () => {
    const values = new Set<number>()
    for (let i = 0; i < 20; i++) values.add(seededRandomUnit('seed1', i))
    for (let i = 0; i < 20; i++) values.add(seededRandomUnit('seed2', i))
    expect(values.size).toBeGreaterThan(30)
  })
})

describe('runWeightedDraw (L2)', () => {
  const candidates: DrawCandidate[] = [
    { id: '111', telegramUserId: 111, telegramUsername: 'a', totalTickets: 1 },
    { id: '222', telegramUserId: 222, telegramUsername: 'b', totalTickets: 1 },
    { id: '333', telegramUserId: 333, telegramUsername: 'c', totalTickets: 1 },
  ]
  const prizes = [
    { place: 1, productId: 'p1' },
    { place: 2, productId: 'p2' },
  ]

  it('reproduces the same winners for the same seed + candidates', () => {
    const first = runWeightedDraw(candidates, prizes, 'seedA')
    const second = runWeightedDraw(candidates, prizes, 'seedA')
    expect(second).toEqual(first)
  })

  it('never draws the same user twice', () => {
    const winners = runWeightedDraw(candidates, prizes, 'seedB')
    expect(winners).toHaveLength(2)
    expect(new Set(winners.map((w) => w.telegramUserId)).size).toBe(2)
  })

  it('stops when the pool is exhausted', () => {
    const single: DrawCandidate[] = [candidates[0]]
    const winners = runWeightedDraw(
      single,
      [prizes[0], prizes[1], { place: 3, productId: 'p3' }],
      'seedC',
    )
    expect(winners).toHaveLength(1)
    expect(winners[0].telegramUserId).toBe(111)
  })

  it('weights by tickets at a coarse level (99-ticket entry beats 1-ticket entry)', () => {
    const weighted: DrawCandidate[] = [
      { id: 'small', telegramUserId: 1, telegramUsername: null, totalTickets: 1 },
      { id: 'big', telegramUserId: 2, telegramUsername: null, totalTickets: 99 },
    ]
    let bigWins = 0
    for (let i = 0; i < 2000; i++) {
      const winners = runWeightedDraw(weighted, [prizes[0]], `seed-w${i}`)
      if (winners[0].telegramUserId === 2) bigWins++
    }
    expect(bigWins).toBeGreaterThan(1900)
  })
})

describe('createDrawSeed (L2)', () => {
  it('returns a fresh 256-bit hex CSPRNG seed', () => {
    const seed = createDrawSeed()
    expect(seed).toMatch(/^[0-9a-f]{64}$/)
    expect(createDrawSeed()).not.toBe(seed)
  })
})
