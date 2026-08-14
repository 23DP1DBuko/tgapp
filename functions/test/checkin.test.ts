import { describe, it, expect, vi } from 'vitest'

// Mock firebase-admin so importing checkin.ts (and its helpers.ts import)
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

import { getCheckinState, processCheckIn } from '../src/checkin.js'
import { FakeFirestore } from './fakeFirestore.js'

/** Create a fresh fake DB and route getFirestore() (used inside the module) to it. */
function makeDb(): FakeFirestore {
  const db = new FakeFirestore()
  fakeDbHolder.current = db as never
  return db
}

/** Local date string in the same YYYY-MM-DD format as the module helpers. */
function dateString(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function seedCheckin(db: FakeFirestore, telegramUserId: number, data: Record<string, unknown>) {
  db.seed('dailyCheckins', String(telegramUserId), data)
}

function checkinDoc(db: FakeFirestore, telegramUserId: number) {
  const docs = db.readAll('dailyCheckins').filter((d) => d.id === String(telegramUserId))
  return docs.length > 0 ? docs[0].data : undefined
}

describe('getCheckinState (L4)', () => {
  it('reports a broken streak as 0 WITHOUT writing to the doc (read path is pure)', async () => {
    const db = makeDb()
    const seeded = {
      telegramUserId: 123,
      currentStreak: 3,
      longestStreak: 5,
      totalCheckIns: 6,
      lastCheckInDate: dateString(-3),
    }
    seedCheckin(db, 123, seeded)

    const state = await getCheckinState(123)

    expect(state.currentStreak).toBe(0)
    expect(state.todayCheckedIn).toBe(false)
    // L4 regression guard: the stored doc must be byte-for-byte unchanged —
    // the old code persisted { currentStreak: 0 } here via a non-transactional
    // set that could race a concurrent check-in.
    expect(checkinDoc(db, 123)).toEqual(seeded)
  })

  it('returns the stored streak when the last check-in was yesterday', async () => {
    const db = makeDb()
    seedCheckin(db, 123, {
      currentStreak: 3,
      longestStreak: 5,
      totalCheckIns: 6,
      lastCheckInDate: dateString(-1),
    })

    const state = await getCheckinState(123)

    expect(state.currentStreak).toBe(3)
    expect(state.todayCheckedIn).toBe(false)
  })

  it('marks today as checked in when the last check-in was today', async () => {
    const db = makeDb()
    seedCheckin(db, 123, {
      currentStreak: 3,
      longestStreak: 5,
      totalCheckIns: 6,
      lastCheckInDate: dateString(0),
    })

    const state = await getCheckinState(123)

    expect(state.todayCheckedIn).toBe(true)
    expect(state.currentStreak).toBe(3)
  })

  it('returns zeros for a user with no check-in doc', async () => {
    const db = makeDb()

    const state = await getCheckinState(999)

    expect(state).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      totalCheckIns: 0,
      lastCheckInDate: '',
      todayCheckedIn: false,
    })
  })
})

describe('processCheckIn (L4)', () => {
  it('resets a broken streak to 1 inside the transaction', async () => {
    const db = makeDb()
    seedCheckin(db, 123, {
      telegramUserId: 123,
      currentStreak: 3,
      longestStreak: 5,
      totalCheckIns: 6,
      lastCheckInDate: dateString(-3),
    })

    const result = await processCheckIn(123, 'alice')

    expect(result).toMatchObject({ status: 'checked_in', currentStreak: 1, totalCheckIns: 7 })
    const doc = checkinDoc(db, 123)
    expect(doc?.currentStreak).toBe(1)
    expect(doc?.lastCheckInDate).toBe(dateString(0))
  })

  it('continues the streak when the last check-in was yesterday', async () => {
    const db = makeDb()
    seedCheckin(db, 123, {
      telegramUserId: 123,
      currentStreak: 3,
      longestStreak: 5,
      totalCheckIns: 6,
      lastCheckInDate: dateString(-1),
    })

    const result = await processCheckIn(123, 'alice')

    expect(result).toMatchObject({ status: 'checked_in', currentStreak: 4, totalCheckIns: 7 })
    expect(checkinDoc(db, 123)?.currentStreak).toBe(4)
  })

  it('is idempotent for the same day: no double check-in or reward', async () => {
    const db = makeDb()
    const seeded = {
      telegramUserId: 123,
      currentStreak: 1,
      longestStreak: 1,
      totalCheckIns: 1,
      lastCheckInDate: dateString(0),
    }
    seedCheckin(db, 123, seeded)

    const result = await processCheckIn(123, 'alice')

    expect(result.status).toBe('already_checked_in')
    expect(result.rewardGranted).toBe(false)
    // No write happened: doc unchanged, no promo code created
    expect(checkinDoc(db, 123)).toEqual(seeded)
    expect(db.readAll('promoCodes')).toHaveLength(0)
  })
})
