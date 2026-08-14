import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock firebase-admin so importing giveaways.ts (and its helpers.ts import)
// does not bootstrap a real Firebase app at module load.
vi.mock('firebase-admin/app', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase-admin/app')>()
  return {
    ...actual,
    getApps: () => [{ name: '[DEFAULT]' } as never],
    initializeApp: vi.fn(() => ({}) as never),
  }
})

// Route getFirestore() to a per-test FakeFirestore so the transaction logic
// can be exercised directly against the in-memory store.
const fakeDbHolder = vi.hoisted(() => ({ current: null as never }))

vi.mock('firebase-admin/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase-admin/firestore')>()
  return {
    ...actual,
    getFirestore: () => fakeDbHolder.current,
  }
})

import {
  joinGiveawayTransaction,
  completeGiveawayTaskTransaction,
  isGiveawayEnded,
} from '../src/giveaways.js'
import { FakeFirestore } from './fakeFirestore.js'

function seedLiveGiveaway(db: FakeFirestore, baseEntryTickets = 1) {
  db.seed('giveaways', 'g1', {
    status: 'live',
    accessLevel: 'public',
    baseEntryTickets,
    startAt: null,
    endAt: '2099-01-01T00:00:00.000Z',
    enteredCount: 0,
    totalTicketsPool: 0,
    entryTasks: [
      { id: 't1', type: 'join_channel', label: 'Join channel', ticketsGranted: 5 },
      { id: 't2', type: 'like_product', label: 'Like product', ticketsGranted: 3 },
    ],
  })
}

function seedEntry(
  db: FakeFirestore,
  docId: string,
  telegramUserId: number,
  extra: Partial<{ totalTickets: number; completedTaskIds: string[] }> = {},
) {
  db.seed(`giveaways/g1/entries`, docId, {
    telegramUserId,
    telegramUsername: 'alice',
    joinedAt: '2026-01-01T00:00:00.000Z',
    completedTaskIds: [],
    totalTickets: 1,
    ...extra,
  })
}

function entryPath() {
  return 'giveaways/g1/entries'
}

describe('joinGiveawayTransaction (H5)', () => {
  it('allows one join per user (sequential)', async () => {
    const db = new FakeFirestore()
    seedLiveGiveaway(db)

    const first = await joinGiveawayTransaction(db as never, {
      giveawayId: 'g1',
      telegramUserId: 123,
      telegramUsername: 'alice',
    })
    expect(first).toEqual({ status: 'joined', totalTickets: 1 })

    const second = await joinGiveawayTransaction(db as never, {
      giveawayId: 'g1',
      telegramUserId: 123,
      telegramUsername: 'alice',
    })
    expect(second).toEqual({ status: 'already_joined' })

    expect(db.readAll(entryPath())).toHaveLength(1)
    const giveaway = db.readAll('giveaways')[0].data
    expect(giveaway.enteredCount).toBe(1)
    expect(giveaway.totalTicketsPool).toBe(1)
  })

  it('never creates a duplicate entry under concurrent double-join (H5 race)', async () => {
    const db = new FakeFirestore()
    seedLiveGiveaway(db)

    const results = await Promise.all([
      joinGiveawayTransaction(db as never, {
        giveawayId: 'g1',
        telegramUserId: 123,
        telegramUsername: 'alice',
      }),
      joinGiveawayTransaction(db as never, {
        giveawayId: 'g1',
        telegramUserId: 123,
        telegramUsername: 'alice',
      }),
    ])

    expect(results.map((r) => r.status).sort()).toEqual(['already_joined', 'joined'])

    const entries = db.readAll(entryPath())
    expect(entries).toHaveLength(1)
    expect(entries[0].id).toBe('123') // deterministic doc id
    expect(entries[0].data.enteredCount).toBeUndefined()

    const giveaway = db.readAll('giveaways')[0].data
    expect(giveaway.enteredCount).toBe(1)
    expect(giveaway.totalTicketsPool).toBe(1)
  })

  it('still allows two different users to join concurrently', async () => {
    const db = new FakeFirestore()
    seedLiveGiveaway(db)

    const results = await Promise.all([
      joinGiveawayTransaction(db as never, {
        giveawayId: 'g1',
        telegramUserId: 123,
        telegramUsername: 'alice',
      }),
      joinGiveawayTransaction(db as never, {
        giveawayId: 'g1',
        telegramUserId: 456,
        telegramUsername: 'bob',
      }),
    ])

    expect(results.map((r) => r.status).sort()).toEqual(['joined', 'joined'])
    expect(db.readAll(entryPath())).toHaveLength(2)
    expect(db.readAll('giveaways')[0].data.enteredCount).toBe(2)
  })

  it('treats a pre-H5 legacy entry (random doc id) as already joined', async () => {
    const db = new FakeFirestore()
    seedLiveGiveaway(db)
    seedEntry(db, 'legacy_random_id', 123)

    const result = await joinGiveawayTransaction(db as never, {
      giveawayId: 'g1',
      telegramUserId: 123,
      telegramUsername: 'alice',
    })
    expect(result).toEqual({ status: 'already_joined' })

    const entries = db.readAll(entryPath())
    expect(entries).toHaveLength(1)
    expect(entries[0].id).toBe('legacy_random_id') // no deterministic doc created
  })

  it('rejects joins for a giveaway that is not live', async () => {
    const db = new FakeFirestore()
    db.seed('giveaways', 'g1', { status: 'finished', baseEntryTickets: 1 })

    const result = await joinGiveawayTransaction(db as never, {
      giveawayId: 'g1',
      telegramUserId: 123,
      telegramUsername: 'alice',
    })
    expect(result).toEqual({ status: 'not_live' })
  })

  it('rejects joins once the giveaway endAt has passed (GW-5)', async () => {
    const db = new FakeFirestore()
    db.seed('giveaways', 'g1', {
      status: 'live',
      accessLevel: 'public',
      baseEntryTickets: 1,
      startAt: null,
      endAt: '2000-01-01T00:00:00.000Z', // long past
      enteredCount: 0,
      totalTicketsPool: 0,
    })

    const result = await joinGiveawayTransaction(db as never, {
      giveawayId: 'g1',
      telegramUserId: 123,
      telegramUsername: 'alice',
    })
    expect(result).toEqual({ status: 'ended' })
    expect(db.readAll('giveaways/g1/entries')).toHaveLength(0)
    expect(db.readAll('giveaways')[0].data.enteredCount).toBe(0)
  })

  it('blocks non-eligible users from early_access_only giveaways (GW-6)', async () => {
    const db = new FakeFirestore()
    db.seed('giveaways', 'g1', {
      status: 'live',
      accessLevel: 'early_access_only',
      baseEntryTickets: 1,
      startAt: null,
      endAt: '2099-01-01T00:00:00.000Z',
      enteredCount: 0,
      totalTicketsPool: 0,
    })

    const result = await joinGiveawayTransaction(db as never, {
      giveawayId: 'g1',
      telegramUserId: 123,
      telegramUsername: 'alice',
    })
    expect(result).toEqual({ status: 'access_restricted' })
    expect(db.readAll('giveaways/g1/entries')).toHaveLength(0)
  })

  it('allows early_access_only joins for users with a real referral (GW-6)', async () => {
    const db = new FakeFirestore()
    db.seed('giveaways', 'g1', {
      status: 'live',
      accessLevel: 'early_access_only',
      baseEntryTickets: 1,
      startAt: null,
      endAt: '2099-01-01T00:00:00.000Z',
      enteredCount: 0,
      totalTicketsPool: 0,
    })
    db.seed('telegramSubscribers', 'f1', {
      telegramUserId: 11,
      referredBy: 'ref_123',
    })

    const result = await joinGiveawayTransaction(db as never, {
      giveawayId: 'g1',
      telegramUserId: 123,
      telegramUsername: 'alice',
    })
    expect(result).toEqual({ status: 'joined', totalTickets: 1 })
    expect(db.readAll('giveaways/g1/entries')).toHaveLength(1)
  })

  it('does not count a self-referral toward early access (GW-6 + H4)', async () => {
    const db = new FakeFirestore()
    db.seed('giveaways', 'g1', {
      status: 'live',
      accessLevel: 'early_access_only',
      baseEntryTickets: 1,
      startAt: null,
      endAt: '2099-01-01T00:00:00.000Z',
      enteredCount: 0,
      totalTicketsPool: 0,
    })
    db.seed('telegramSubscribers', 'self', {
      telegramUserId: 123,
      referredBy: 'ref_123',
    })

    const result = await joinGiveawayTransaction(db as never, {
      giveawayId: 'g1',
      telegramUserId: 123,
      telegramUsername: 'alice',
    })
    expect(result).toEqual({ status: 'access_restricted' })
  })
})

describe('completeGiveawayTaskTransaction (H5)', () => {
  it('grants tickets for a task exactly once (sequential)', async () => {
    const db = new FakeFirestore()
    seedLiveGiveaway(db)
    seedEntry(db, '123', 123)

    const first = await completeGiveawayTaskTransaction(db as never, {
      giveawayId: 'g1',
      taskId: 't1',
      telegramUserId: 123,
    })
    expect(first).toEqual({ status: 'completed', totalTickets: 6, taskTicketsGranted: 5 })

    const second = await completeGiveawayTaskTransaction(db as never, {
      giveawayId: 'g1',
      taskId: 't1',
      telegramUserId: 123,
    })
    expect(second).toEqual({ status: 'already_completed' })

    const entry = db.readAll(entryPath())[0].data
    expect(entry.totalTickets).toBe(6)
    expect(entry.completedTaskIds).toEqual(['t1'])
    expect(db.readAll('giveaways')[0].data.totalTicketsPool).toBe(5)
  })

  it('never grants task tickets twice under concurrent completion (H5 race)', async () => {
    const db = new FakeFirestore()
    seedLiveGiveaway(db)
    seedEntry(db, '123', 123)

    const results = await Promise.all([
      completeGiveawayTaskTransaction(db as never, {
        giveawayId: 'g1',
        taskId: 't1',
        telegramUserId: 123,
      }),
      completeGiveawayTaskTransaction(db as never, {
        giveawayId: 'g1',
        taskId: 't1',
        telegramUserId: 123,
      }),
    ])

    expect(results.map((r) => r.status).sort()).toEqual(['already_completed', 'completed'])

    const entry = db.readAll(entryPath())[0].data
    expect(entry.totalTickets).toBe(6)
    expect(entry.completedTaskIds).toEqual(['t1'])
    expect(db.readAll('giveaways')[0].data.totalTicketsPool).toBe(5)
  })

  it('allows two different tasks to complete concurrently without lost updates', async () => {
    const db = new FakeFirestore()
    seedLiveGiveaway(db)
    seedEntry(db, '123', 123)

    const results = await Promise.all([
      completeGiveawayTaskTransaction(db as never, {
        giveawayId: 'g1',
        taskId: 't1',
        telegramUserId: 123,
      }),
      completeGiveawayTaskTransaction(db as never, {
        giveawayId: 'g1',
        taskId: 't2',
        telegramUserId: 123,
      }),
    ])

    expect(results.map((r) => r.status).sort()).toEqual(['completed', 'completed'])

    const entry = db.readAll(entryPath())[0].data
    expect(entry.totalTickets).toBe(9) // 1 base + 5 (t1) + 3 (t2)
    expect(entry.completedTaskIds.slice().sort()).toEqual(['t1', 't2'])
    expect(db.readAll('giveaways')[0].data.totalTicketsPool).toBe(8)
  })

  it('supports task completion on a legacy entry and dedupes concurrently', async () => {
    const db = new FakeFirestore()
    seedLiveGiveaway(db)
    seedEntry(db, 'legacy_x', 123)

    const results = await Promise.all([
      completeGiveawayTaskTransaction(db as never, {
        giveawayId: 'g1',
        taskId: 't1',
        telegramUserId: 123,
      }),
      completeGiveawayTaskTransaction(db as never, {
        giveawayId: 'g1',
        taskId: 't1',
        telegramUserId: 123,
      }),
    ])

    expect(results.map((r) => r.status).sort()).toEqual(['already_completed', 'completed'])

    const entries = db.readAll(entryPath())
    expect(entries).toHaveLength(1)
    expect(entries[0].id).toBe('legacy_x') // stays on the legacy doc
    expect(entries[0].data.totalTickets).toBe(6)
  })

  it('returns not_joined when the user has no entry', async () => {
    const db = new FakeFirestore()
    seedLiveGiveaway(db)

    const result = await completeGiveawayTaskTransaction(db as never, {
      giveawayId: 'g1',
      taskId: 't1',
      telegramUserId: 123,
    })
    expect(result).toEqual({ status: 'not_joined' })
  })

  it('rejects task completion once the giveaway endAt has passed (GW-5)', async () => {
    const db = new FakeFirestore()
    db.seed('giveaways', 'g1', {
      status: 'live',
      baseEntryTickets: 1,
      endAt: '2000-01-01T00:00:00.000Z', // long past
      enteredCount: 0,
      totalTicketsPool: 0,
      entryTasks: [{ id: 't1', type: 'join_channel', label: 'Join', ticketsGranted: 5 }],
    })
    seedEntry(db, '123', 123)

    const result = await completeGiveawayTaskTransaction(db as never, {
      giveawayId: 'g1',
      taskId: 't1',
      telegramUserId: 123,
    })
    expect(result).toEqual({ status: 'ended' })
    const entry = db.readAll('giveaways/g1/entries')[0].data
    expect(entry.totalTickets).toBe(1) // unchanged
    expect(db.readAll('giveaways')[0].data.totalTicketsPool).toBe(0)
  })
})

describe('isGiveawayEnded (GW-5)', () => {
  it('is false when endAt is missing or empty', () => {
    expect(isGiveawayEnded(null)).toBe(false)
    expect(isGiveawayEnded(undefined)).toBe(false)
    expect(isGiveawayEnded('')).toBe(false)
  })

  it('is false for an invalid date string', () => {
    expect(isGiveawayEnded('not-a-date')).toBe(false)
  })

  it('is true when now is at or after endAt', () => {
    const endAt = '2000-01-01T00:00:00.000Z'
    expect(isGiveawayEnded(endAt, Date.parse('2001-01-01T00:00:00.000Z'))).toBe(true)
    expect(isGiveawayEnded(endAt, Date.parse(endAt))).toBe(true)
  })

  it('is false when now is before endAt', () => {
    expect(
      isGiveawayEnded('2099-01-01T00:00:00.000Z', Date.parse('2001-01-01T00:00:00.000Z')),
    ).toBe(false)
  })
})
