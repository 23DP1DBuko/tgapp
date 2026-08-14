import { describe, it, expect, vi } from 'vitest'

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

const fakeDbHolder = vi.hoisted(() => ({ current: null as never }))

vi.mock('firebase-admin/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase-admin/firestore')>()
  return {
    ...actual,
    getFirestore: () => fakeDbHolder.current,
  }
})

import {
  buildGiveawayEntryPublic,
  toGiveawayEntryData,
  type GiveawayEntryData,
} from '../src/giveaways.js'

const sampleEntry: GiveawayEntryData = {
  telegramUserId: 123,
  telegramUsername: 'alice',
  joinedAt: '2026-01-01T00:00:00.000Z',
  completedTaskIds: ['t1', 't2'],
  totalTickets: 7,
}

describe('buildGiveawayEntryPublic (L1)', () => {
  it('omits telegramUserId and completedTaskIds from the public shape', () => {
    const publicEntry = buildGiveawayEntryPublic(sampleEntry, 999)

    expect(publicEntry).toEqual({
      telegramUsername: 'alice',
      joinedAt: '2026-01-01T00:00:00.000Z',
      totalTickets: 7,
      isMe: false,
    })
    expect('telegramUserId' in publicEntry).toBe(false)
    expect('completedTaskIds' in publicEntry).toBe(false)
  })

  it('marks only the requester row as isMe', () => {
    expect(buildGiveawayEntryPublic(sampleEntry, 123).isMe).toBe(true)
    expect(buildGiveawayEntryPublic(sampleEntry, 456).isMe).toBe(false)
  })

  it('carries the display fields (username, joinedAt, totalTickets)', () => {
    const publicEntry = buildGiveawayEntryPublic(sampleEntry, 123)
    expect(publicEntry.telegramUsername).toBe('alice')
    expect(publicEntry.joinedAt).toBe('2026-01-01T00:00:00.000Z')
    expect(publicEntry.totalTickets).toBe(7)
  })

  it('normalizes missing username and task list to null/[]', () => {
    const sparse = {
      telegramUserId: 456,
      joinedAt: '2026-02-02T00:00:00.000Z',
      totalTickets: 3,
    } as unknown as GiveawayEntryData

    const publicEntry = buildGiveawayEntryPublic(sparse, 456)
    expect(publicEntry.telegramUsername).toBeNull()
    expect(publicEntry.totalTickets).toBe(3)

    const own = toGiveawayEntryData(sparse)
    expect(own.telegramUsername).toBeNull()
    expect(own.completedTaskIds).toEqual([])
  })
})

describe('toGiveawayEntryData (own-entry only, L1)', () => {
  it('keeps the requester own id and task list in myEntry', () => {
    const own = toGiveawayEntryData(sampleEntry)

    expect(own.telegramUserId).toBe(123)
    expect(own.completedTaskIds).toEqual(['t1', 't2'])
    expect(own.telegramUsername).toBe('alice')
    expect(own.totalTickets).toBe(7)
  })
})
