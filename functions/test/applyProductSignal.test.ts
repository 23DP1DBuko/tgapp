import { describe, it, expect, vi } from 'vitest'

// Mock firebase-admin so importing products.ts (and its helpers.ts import)
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

import { applyProductSignalTransaction } from '../src/products.js'
import { FakeFirestore } from './fakeFirestore.js'

function seedProduct(db: FakeFirestore, productId = 'p1') {
  db.seed('products', productId, {
    name: 'Hoodie',
    description: 'A hoodie',
    category: 'hoodies',
    brandNames: [],
    price: 50,
    currency: 'EUR',
    isAvailable: true,
    likesCount: 0,
    cartCount: 0,
    images: [],
    createdAt: null,
  })
}

function productCounts(db: FakeFirestore, productId = 'p1') {
  const doc = db.readAll('products').find((d) => d.id === productId)
  return {
    likesCount: (doc?.data.likesCount as number | undefined) ?? 0,
    cartCount: (doc?.data.cartCount as number | undefined) ?? 0,
  }
}

function signalDocs(db: FakeFirestore, productId = 'p1') {
  return db.readAll(`products/${productId}/signals`)
}

async function apply(
  db: FakeFirestore,
  params: {
    productId?: string
    telegramUserId: number
    signal: 'likesCount' | 'cartCount'
    delta: 1 | -1
  },
) {
  return applyProductSignalTransaction(db as never, {
    productId: params.productId ?? 'p1',
    telegramUserId: params.telegramUserId,
    signal: params.signal,
    delta: params.delta,
  })
}

describe('applyProductSignalTransaction (H7)', () => {
  it('applies a first like (+1) and records the user contribution', async () => {
    const db = new FakeFirestore()
    seedProduct(db)

    const result = await apply(db, {
      telegramUserId: 123,
      signal: 'likesCount',
      delta: 1,
    })

    expect(result).toEqual({ status: 'updated' })
    expect(productCounts(db).likesCount).toBe(1)
    const docs = signalDocs(db)
    expect(docs).toHaveLength(1)
    expect(docs[0].id).toBe('123') // deterministic doc id = user id
    expect(docs[0].data).toMatchObject({ likesCount: 1, cartCount: 0 })
  })

  it('is idempotent: a repeated +1 from the same user is a no-op', async () => {
    const db = new FakeFirestore()
    seedProduct(db)

    await apply(db, { telegramUserId: 123, signal: 'likesCount', delta: 1 })
    const second = await apply(db, {
      telegramUserId: 123,
      signal: 'likesCount',
      delta: 1,
    })

    expect(second).toEqual({ status: 'already_applied' })
    expect(productCounts(db).likesCount).toBe(1)
    expect(signalDocs(db)).toHaveLength(1)
  })

  it('removes a like (-1) and keeps the user contribution at 0', async () => {
    const db = new FakeFirestore()
    seedProduct(db)
    await apply(db, { telegramUserId: 123, signal: 'likesCount', delta: 1 })

    const result = await apply(db, {
      telegramUserId: 123,
      signal: 'likesCount',
      delta: -1,
    })

    expect(result).toEqual({ status: 'updated' })
    expect(productCounts(db).likesCount).toBe(0)
    const docs = signalDocs(db)
    expect(docs).toHaveLength(1)
    expect(docs[0].data).toMatchObject({ likesCount: 0, cartCount: 0 })
  })

  it('a repeated -1 with no contribution is a no-op (spam-safe, never negative)', async () => {
    const db = new FakeFirestore()
    seedProduct(db)

    const result = await apply(db, {
      telegramUserId: 123,
      signal: 'likesCount',
      delta: -1,
    })

    expect(result).toEqual({ status: 'not_applied' })
    expect(productCounts(db).likesCount).toBe(0)
    expect(signalDocs(db)).toHaveLength(0)
  })

  it('a -1 with no remaining contribution is a no-op after a full toggle', async () => {
    const db = new FakeFirestore()
    seedProduct(db)
    await apply(db, { telegramUserId: 123, signal: 'likesCount', delta: 1 })
    await apply(db, { telegramUserId: 123, signal: 'likesCount', delta: -1 })

    // Extra -1 spam now that the user has no contribution
    const result = await apply(db, {
      telegramUserId: 123,
      signal: 'likesCount',
      delta: -1,
    })

    expect(result).toEqual({ status: 'not_applied' })
    expect(productCounts(db).likesCount).toBe(0)
  })

  it('two distinct users each contribute once (counter = distinct users)', async () => {
    const db = new FakeFirestore()
    seedProduct(db)

    await apply(db, { telegramUserId: 123, signal: 'likesCount', delta: 1 })
    await apply(db, { telegramUserId: 456, signal: 'likesCount', delta: 1 })

    expect(productCounts(db).likesCount).toBe(2)
    expect(signalDocs(db)).toHaveLength(2)
  })

  it('concurrent double +1 from the same user yields exactly one contribution', async () => {
    const db = new FakeFirestore()
    seedProduct(db)

    const results = await Promise.all([
      apply(db, { telegramUserId: 123, signal: 'likesCount', delta: 1 }),
      apply(db, { telegramUserId: 123, signal: 'likesCount', delta: 1 }),
    ])

    expect(results.map((r) => r.status).sort()).toEqual(['already_applied', 'updated'])
    expect(productCounts(db).likesCount).toBe(1)
    expect(signalDocs(db)).toHaveLength(1)
  })

  it('concurrent +1 and -1 settle on a binary contribution (no double count)', async () => {
    const db = new FakeFirestore()
    seedProduct(db)
    await apply(db, { telegramUserId: 123, signal: 'likesCount', delta: 1 })

    const results = await Promise.all([
      apply(db, { telegramUserId: 123, signal: 'likesCount', delta: -1 }),
      apply(db, { telegramUserId: 123, signal: 'likesCount', delta: -1 }),
    ])

    expect(results.map((r) => r.status).sort()).toEqual(['not_applied', 'updated'])
    expect(productCounts(db).likesCount).toBe(0)
  })

  it('likes and cartCount are independent signals for the same user', async () => {
    const db = new FakeFirestore()
    seedProduct(db)

    await apply(db, { telegramUserId: 123, signal: 'likesCount', delta: 1 })
    const cartResult = await apply(db, {
      telegramUserId: 123,
      signal: 'cartCount',
      delta: 1,
    })

    expect(cartResult).toEqual({ status: 'updated' })
    expect(productCounts(db)).toEqual({ likesCount: 1, cartCount: 1 })

    // Removing the like leaves the cart contribution untouched
    await apply(db, { telegramUserId: 123, signal: 'likesCount', delta: -1 })
    expect(productCounts(db)).toEqual({ likesCount: 0, cartCount: 1 })
  })

  it('cart counter reflects distinct users and never drains below 0', async () => {
    const db = new FakeFirestore()
    seedProduct(db)

    await apply(db, { telegramUserId: 123, signal: 'cartCount', delta: 1 })
    await apply(db, { telegramUserId: 456, signal: 'cartCount', delta: 1 })
    expect(productCounts(db).cartCount).toBe(2)

    await apply(db, { telegramUserId: 123, signal: 'cartCount', delta: -1 })
    expect(productCounts(db).cartCount).toBe(1)

    await apply(db, { telegramUserId: 456, signal: 'cartCount', delta: -1 })
    expect(productCounts(db).cartCount).toBe(0)

    // Drain attempt from a user who never contributed
    const result = await apply(db, {
      telegramUserId: 789,
      signal: 'cartCount',
      delta: -1,
    })
    expect(result).toEqual({ status: 'not_applied' })
    expect(productCounts(db).cartCount).toBe(0)
  })

  it('returns product_not_found for a missing product', async () => {
    const db = new FakeFirestore()

    const result = await apply(db, {
      telegramUserId: 123,
      signal: 'likesCount',
      delta: 1,
    })

    expect(result).toEqual({ status: 'product_not_found' })
  })
})
