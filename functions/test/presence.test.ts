import { describe, it, expect, vi } from 'vitest'

// Mock firebase-admin so importing presence.ts (and its helpers.ts import)
// does not bootstrap a real Firebase app at module load.
vi.mock('firebase-admin/app', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase-admin/app')>()
  return {
    ...actual,
    getApps: () => [{ name: '[DEFAULT]' } as never],
    initializeApp: vi.fn(() => ({}) as never),
  }
})

// Route getFirestore() to a per-test FakeFirestore so the heartbeat write can
// be exercised directly against the in-memory store.
const fakeDbHolder = vi.hoisted(() => ({ current: null as never }))

vi.mock('firebase-admin/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase-admin/firestore')>()
  return {
    ...actual,
    getFirestore: () => fakeDbHolder.current,
  }
})

import { writePresenceHeartbeat } from '../src/presence.js'
import { FakeFirestore } from './fakeFirestore.js'

describe('writePresenceHeartbeat (M6)', () => {
  it('writes presence/{userId} with a lastSeen timestamp', async () => {
    const db = new FakeFirestore()

    await writePresenceHeartbeat(db as never, 123)

    const docs = db.readAll('presence')
    expect(docs).toHaveLength(1)
    expect(docs[0].id).toBe('123') // doc id = user id — user can only touch their own
    expect(docs[0].data.lastSeen).toBeDefined()
  })

  it('merges into an existing doc without dropping other fields', async () => {
    const db = new FakeFirestore()
    db.seed('presence', '123', { lastSeen: 'stale', extra: 'keep-me' })

    await writePresenceHeartbeat(db as never, 123)

    const docs = db.readAll('presence')
    expect(docs).toHaveLength(1)
    expect(docs[0].data.extra).toBe('keep-me')
    expect(docs[0].data.lastSeen).toBeDefined()
  })

  it('keeps each user in their own doc (no cross-user writes)', async () => {
    const db = new FakeFirestore()

    await writePresenceHeartbeat(db as never, 123)
    await writePresenceHeartbeat(db as never, 456)

    const docs = db.readAll('presence')
    expect(docs.map((d) => d.id).sort()).toEqual(['123', '456'])
  })
})
