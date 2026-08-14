import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock firebase-admin so importing content.ts (and its helpers.ts import) does
// not bootstrap a real Firebase app at module load.
vi.mock('firebase-admin/app', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase-admin/app')>()
  return {
    ...actual,
    getApps: () => [{ name: '[DEFAULT]' } as never],
    initializeApp: vi.fn(() => ({}) as never),
  }
})

import { computeReferralLeaderboard } from '../src/content.js'
import { FakeFirestore } from './fakeFirestore.js'

// Seed a subscriber doc for the referrer themselves (their own telegramUserId)
// plus `count` subscribers whose referredBy points at them.
function seedReferrer(
  db: FakeFirestore,
  referrerUserId: number,
  username: string | null,
  count: number,
) {
  db.seed('telegramSubscribers', `me${referrerUserId}`, {
    telegramUserId: referrerUserId,
    username,
  })
  const code = `ref_${referrerUserId}`
  for (let n = 0; n < count; n++) {
    db.seed('telegramSubscribers', `${code}_${n}`, {
      telegramUserId: 1000000 + referrerUserId * 100 + n,
      referredBy: code,
      username: `friend${n}`,
    })
  }
}

describe('computeReferralLeaderboard', () => {
  let db: FakeFirestore

  beforeEach(() => {
    db = new FakeFirestore()
  })

  it('filters out referrers who set leaderboardShown=false', async () => {
    // User 10 referred 2 people and stays visible.
    seedReferrer(db, 10, 'alice', 2)
    // User 20 referred 3 people but opted out of the leaderboard.
    seedReferrer(db, 20, 'carol', 3)
    db.seed('userSettings', '20', { telegramUserId: 20, leaderboardShown: false })

    const result = await computeReferralLeaderboard(db as never, 'ref_999')

    // Only user 10 appears; user 20 (higher count) is hidden.
    expect(result.topReferrers).toEqual([
      { rank: 1, telegramUserId: 10, username: 'alice', referralCount: 2 },
    ])
    expect(result.myRank).toBeNull()
    expect(result.myReferralCount).toBe(0)
  })

  it('treats a missing userSettings doc as visible (default true)', async () => {
    seedReferrer(db, 10, 'alice', 2)
    seedReferrer(db, 20, 'carol', 3)
    // No userSettings seeded at all.

    const result = await computeReferralLeaderboard(db as never, 'ref_999')

    expect(result.topReferrers.map((e) => e.telegramUserId)).toEqual([20, 10])
    expect(result.topReferrers[0]).toMatchObject({ rank: 1, referralCount: 3 })
  })

  it('keeps referrers with an explicit leaderboardShown=true', async () => {
    seedReferrer(db, 10, 'alice', 1)
    seedReferrer(db, 20, 'carol', 1)
    db.seed('userSettings', '10', { telegramUserId: 10, leaderboardShown: true })
    db.seed('userSettings', '20', { telegramUserId: 20, leaderboardShown: true })

    const result = await computeReferralLeaderboard(db as never, 'ref_999')

    expect(result.topReferrers.map((e) => e.telegramUserId).sort()).toEqual([10, 20])
  })

  it('still reports the requesting user rank and their own true count', async () => {
    // User 10 referred 2 (visible), user 20 referred 3 (hidden).
    seedReferrer(db, 10, 'alice', 2)
    seedReferrer(db, 20, 'carol', 3)
    db.seed('userSettings', '20', { telegramUserId: 20, leaderboardShown: false })

    // Requesting user 10: visible, so they get a rank.
    const visible = await computeReferralLeaderboard(db as never, 'ref_10')
    expect(visible.myRank).toBe(1)
    expect(visible.myReferralCount).toBe(2)

    // Requesting user 20: hidden from the public leaderboard, so no rank,
    // but their own referral count is still returned truthfully.
    const hidden = await computeReferralLeaderboard(db as never, 'ref_20')
    expect(hidden.myRank).toBeNull()
    expect(hidden.myReferralCount).toBe(3)
  })

  it('orders visible referrers by count desc and caps at 10 entries', async () => {
    // 11 referrers, each with referralCount == index + 1
    for (let referrer = 1; referrer <= 11; referrer++) {
      seedReferrer(db, referrer, `user${referrer}`, referrer)
    }

    const result = await computeReferralLeaderboard(db as never, 'ref_999')

    expect(result.topReferrers).toHaveLength(10)
    expect(result.topReferrers[0]).toMatchObject({ telegramUserId: 11, referralCount: 11 })
    expect(result.topReferrers[9]).toMatchObject({ telegramUserId: 2, referralCount: 2 })
  })

  it('handles referrers with no username', async () => {
    seedReferrer(db, 10, null, 2)

    const result = await computeReferralLeaderboard(db as never, 'ref_999')

    expect(result.topReferrers[0].username).toBeNull()
    expect(result.topReferrers[0].referralCount).toBe(2)
  })

  it('excludes self-referral docs from counts (H4)', async () => {
    // User 10's own subscriber doc carries referredBy = ref_10 (the exploit),
    // plus 2 real referrals.
    db.seed('telegramSubscribers', 'self10', {
      telegramUserId: 10,
      referredBy: 'ref_10',
      username: 'alice',
    })
    seedReferrer(db, 10, 'alice', 2)

    const result = await computeReferralLeaderboard(db as never, 'ref_999')

    expect(result.topReferrers[0]).toMatchObject({
      telegramUserId: 10,
      referralCount: 2,
    })

    // The self-referring user's own count is also truthful.
    const mine = await computeReferralLeaderboard(db as never, 'ref_10')
    expect(mine.myReferralCount).toBe(2)
  })
})
