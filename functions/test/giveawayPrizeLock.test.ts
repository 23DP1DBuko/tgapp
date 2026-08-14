import { describe, it, expect } from 'vitest'

import { buildGiveawayLockedProductIds } from '../src/orders.js'

/** Build a fake snapshot-shaped object for the pure helper. */
function giveawaySnapshot(data: Record<string, unknown> | undefined, exists = true) {
  return {
    exists,
    data: () => data,
  }
}

const LIVE_GIVEAWAY = {
  status: 'live',
  prizes: [
    { productId: 'p1', place: 1, productName: 'Tee', productImage: 'img' },
    { productId: 'p2', place: 2, productName: 'Hoodie', productImage: 'img' },
  ],
}

describe('buildGiveawayLockedProductIds', () => {
  it('locks every prize of a live giveaway', () => {
    const locked = buildGiveawayLockedProductIds([giveawaySnapshot(LIVE_GIVEAWAY)])
    expect(Array.from(locked).sort()).toEqual(['p1', 'p2'])
  })

  it('locks prizes of finished and announced giveaways (drawn)', () => {
    const locked = buildGiveawayLockedProductIds([
      giveawaySnapshot({ status: 'finished', prizes: [{ productId: 'p3' }] }),
      giveawaySnapshot({ status: 'announced', prizes: [{ productId: 'p4' }] }),
    ])
    expect(Array.from(locked).sort()).toEqual(['p3', 'p4'])
  })

  it('does not lock prizes of draft giveaways (still being edited)', () => {
    const locked = buildGiveawayLockedProductIds([
      giveawaySnapshot({ status: 'draft', prizes: [{ productId: 'p1' }] }),
    ])
    expect(locked.size).toBe(0)
  })

  it('does not lock prizes when the admin enabled "prizes for sale"', () => {
    const locked = buildGiveawayLockedProductIds([
      giveawaySnapshot({ status: 'finished', prizesForSale: true, prizes: [{ productId: 'p1' }] }),
    ])
    expect(locked.size).toBe(0)
  })

  it('treats legacy giveaways without prizesForSale as locked', () => {
    // Old documents predate the flag — the field is undefined, not false.
    const locked = buildGiveawayLockedProductIds([
      giveawaySnapshot({ status: 'finished', prizes: [{ productId: 'p1' }] }),
    ])
    expect(locked.has('p1')).toBe(true)
  })

  it('ignores giveaways without a prizes array', () => {
    const locked = buildGiveawayLockedProductIds([
      giveawaySnapshot({ status: 'live' }),
      giveawaySnapshot({ status: 'live', prizes: null }),
    ])
    expect(locked.size).toBe(0)
  })

  it('ignores prize entries without a productId', () => {
    const locked = buildGiveawayLockedProductIds([
      giveawaySnapshot({ status: 'live', prizes: [{ place: 1 }, { productId: '' }] }),
    ])
    expect(locked.size).toBe(0)
  })

  it('skips nonexistent giveaway snapshots', () => {
    const locked = buildGiveawayLockedProductIds([
      giveawaySnapshot(undefined, false),
      giveawaySnapshot(LIVE_GIVEAWAY),
    ])
    expect(Array.from(locked).sort()).toEqual(['p1', 'p2'])
  })

  it('dedupes a product referenced by multiple giveaways', () => {
    const locked = buildGiveawayLockedProductIds([
      giveawaySnapshot({ status: 'live', prizes: [{ productId: 'p1' }] }),
      giveawaySnapshot({ status: 'finished', prizes: [{ productId: 'p1' }] }),
    ])
    expect(Array.from(locked)).toEqual(['p1'])
  })
})
