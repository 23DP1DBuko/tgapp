import { describe, it, expect, vi, beforeEach } from 'vitest'

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

// Route getFirestore() to a per-test FakeFirestore so the write-time guard in
// upsertTelegramSubscriberFromUpdate can be exercised directly.
const fakeDbHolder = vi.hoisted(() => ({ current: null as never }))

vi.mock('firebase-admin/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase-admin/firestore')>()
  return {
    ...actual,
    FieldValue: {
      serverTimestamp: () => ({ __fakeTimestamp: true }),
    },
    getFirestore: () => fakeDbHolder.current,
  }
})

import {
  extractReferralUserId,
  isSelfReferralCode,
  isSelfReferralSubscriberDoc,
  parseReferralCode,
  countReferralsExcludingSelf,
  upsertTelegramSubscriberFromUpdate,
} from '../src/helpers.js'
import { FakeFirestore } from './fakeFirestore.js'

function makeWebhookBody(telegramUserId: number) {
  return {
    message: {
      from: { id: telegramUserId, username: 'user', first_name: 'User' },
      chat: { id: 9999 },
      text: '/start',
    },
  } as never
}

describe('extractReferralUserId', () => {
  it('parses a numeric referral code', () => {
    expect(extractReferralUserId('ref_123456789')).toBe(123456789)
  })

  it('rejects garbage, non-numeric, or oversized codes', () => {
    expect(extractReferralUserId('ref_abc')).toBeNull()
    expect(extractReferralUserId('ref_')).toBeNull()
    expect(extractReferralUserId('hello')).toBeNull()
    expect(extractReferralUserId('ref_12345678901234567890')).toBeNull() // > 15 digits
  })
})

describe('parseReferralCode', () => {
  it('accepts /start ref_<id> and rejects everything else', () => {
    expect(parseReferralCode('/start ref_123')).toBe('ref_123')
    expect(parseReferralCode('/start')).toBeNull()
    expect(parseReferralCode('/start ref_abc')).toBeNull()
    expect(parseReferralCode('/start notareferral')).toBeNull()
  })
})

describe('isSelfReferralCode (H4)', () => {
  it('flags a code that points at the same user', () => {
    expect(isSelfReferralCode('ref_123', 123)).toBe(true)
  })

  it('allows codes pointing at other users', () => {
    expect(isSelfReferralCode('ref_456', 123)).toBe(false)
  })

  it('is false for missing or unparseable codes', () => {
    expect(isSelfReferralCode(null, 123)).toBe(false)
    expect(isSelfReferralCode(undefined, 123)).toBe(false)
    expect(isSelfReferralCode('ref_abc', 123)).toBe(false)
    expect(isSelfReferralCode('garbage', 123)).toBe(false)
  })
})

describe('isSelfReferralSubscriberDoc', () => {
  it('flags a subscriber doc whose telegramUserId equals the referrer', () => {
    expect(
      isSelfReferralSubscriberDoc({ telegramUserId: 123, referredBy: 'ref_123' }),
    ).toBe(true)
  })

  it('allows a doc referring someone else', () => {
    expect(
      isSelfReferralSubscriberDoc({ telegramUserId: 456, referredBy: 'ref_123' }),
    ).toBe(false)
  })

  it('allows docs without a telegramUserId or a valid code', () => {
    expect(isSelfReferralSubscriberDoc({ referredBy: 'ref_123' })).toBe(false)
    expect(isSelfReferralSubscriberDoc({ telegramUserId: 123, referredBy: 'ref_abc' })).toBe(false)
    expect(isSelfReferralSubscriberDoc({ telegramUserId: 123 })).toBe(false)
  })
})

describe('upsertTelegramSubscriberFromUpdate (write-time guard, H4)', () => {
  let db: FakeFirestore

  beforeEach(() => {
    db = new FakeFirestore()
    fakeDbHolder.current = db as never
  })

  it('never stores the user\u2019s own referral code', async () => {
    await upsertTelegramSubscriberFromUpdate(makeWebhookBody(123), 'ref_123')

    const docs = db.readAll('telegramSubscribers')
    expect(docs).toHaveLength(1)
    expect(docs[0].data.referredBy).toBeUndefined()
  })

  it('stores a referral code from another user', async () => {
    await upsertTelegramSubscriberFromUpdate(makeWebhookBody(123), 'ref_456')

    const docs = db.readAll('telegramSubscribers')
    expect(docs).toHaveLength(1)
    expect(docs[0].data.referredBy).toBe('ref_456')
  })

  it('ignores malformed codes entirely', async () => {
    await upsertTelegramSubscriberFromUpdate(makeWebhookBody(123), 'garbage')

    const docs = db.readAll('telegramSubscribers')
    expect(docs[0].data.referredBy).toBeUndefined()
  })
})

describe('countReferralsExcludingSelf', () => {
  let db: FakeFirestore

  beforeEach(() => {
    db = new FakeFirestore()
  })

  it('counts real referrals but never the referrer\u2019s own self-referral doc (H4)', async () => {
    // 3 friends referred by user 10
    db.seed('telegramSubscribers', 'f1', { telegramUserId: 101, referredBy: 'ref_10' })
    db.seed('telegramSubscribers', 'f2', { telegramUserId: 102, referredBy: 'ref_10' })
    db.seed('telegramSubscribers', 'f3', { telegramUserId: 103, referredBy: 'ref_10' })
    // The self-referral doc: user 10 has referredBy = ref_10 (the exploit)
    db.seed('telegramSubscribers', 'self', { telegramUserId: 10, referredBy: 'ref_10' })

    const count = await countReferralsExcludingSelf(db as never, 'ref_10')

    expect(count).toBe(3)
  })

  it('returns 0 when the only match is a self-referral', async () => {
    db.seed('telegramSubscribers', 'self', { telegramUserId: 10, referredBy: 'ref_10' })

    const count = await countReferralsExcludingSelf(db as never, 'ref_10')

    expect(count).toBe(0)
  })

  it('counts referrals that happen to share an id with another referrer\u2019s self-doc', async () => {
    // User 20 self-referred, but also legitimately referred user 10.
    db.seed('telegramSubscribers', 'self20', { telegramUserId: 20, referredBy: 'ref_20' })
    db.seed('telegramSubscribers', 'r10', { telegramUserId: 10, referredBy: 'ref_20' })

    const count = await countReferralsExcludingSelf(db as never, 'ref_20')

    expect(count).toBe(1)
  })
})
