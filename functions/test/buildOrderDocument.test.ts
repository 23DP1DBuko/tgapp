import { describe, it, expect, vi } from 'vitest'

// Mock firebase-admin so importing orders.ts (which imports helpers.ts) does
// not bootstrap a real Firebase app at module load.
vi.mock('firebase-admin/app', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase-admin/app')>()
  return {
    ...actual,
    getApps: () => [{ name: '[DEFAULT]' } as never],
    initializeApp: vi.fn(() => ({}) as never),
  }
})

import { buildOrderDocument, getInitialOrderStatus } from '../src/orders.js'
import type { CreateCheckoutOrderRequest } from '../src/orders.js'

const VERIFIED_USER_ID = 123456789

function makeBody(overrides: Partial<CreateCheckoutOrderRequest> = {}): CreateCheckoutOrderRequest {
  return {
    initData: 'query_id=1&user={"id":123456789}&auth_date=1&hash=abc',
    clientOrderId: '9f2c3f4a-1b2c-4d5e-8f90-1234567890ab',
    fullName: '  Test  Buyer  ',
    telegramHandle: '@testbuyer',
    telegramUserId: 999999999, // H3: a spoofed, client-supplied owner id
    note: 'note',
    fulfillmentType: 'meetup',
    paymentMethod: 'meetup_cash',
    deliveryCity: '',
    deliveryAddress: '',
    deliveryNotes: '',
    meetupLocation: 'origo_center',
    meetupTimeOption: '',
    meetupNotes: '',
    items: [
      { productId: 'p1', name: 'Hoodie', price: 50, currency: 'EUR', image: null },
      { productId: 'p2', name: 'Tee', price: 30, currency: 'EUR', image: null },
    ],
    subtotal: 80,
    appliedPromo: null,
    total: 80,
    status: 'completed', // H2: a client-supplied status that must be ignored
    cancelReason: '',
    ...overrides,
  }
}

describe('getInitialOrderStatus', () => {
  it('maps USDT to waiting_for_payment', () => {
    expect(getInitialOrderStatus('usdt')).toBe('waiting_for_payment')
  })

  it('maps meetup_cash to new', () => {
    expect(getInitialOrderStatus('meetup_cash')).toBe('new')
  })
})

describe('buildOrderDocument', () => {
  it('never trusts the client-supplied status (H2)', () => {
    const body = makeBody({ status: 'completed' })
    const doc = buildOrderDocument(body, VERIFIED_USER_ID, 80, 80)

    expect(doc.status).toBe('new')
  })

  it('derives waiting_for_payment for USDT orders regardless of submitted status', () => {
    const body = makeBody({ paymentMethod: 'usdt', status: 'cancelled' })
    const doc = buildOrderDocument(body, VERIFIED_USER_ID, 80, 80)

    expect(doc.status).toBe('waiting_for_payment')
  })

  it('always stores the verified buyer id, ignoring the client-supplied one (H3)', () => {
    const body = makeBody({ telegramUserId: 999999999 }) // spoofed
    const doc = buildOrderDocument(body, VERIFIED_USER_ID, 80, 80)

    expect(doc.telegramUserId).toBe(VERIFIED_USER_ID)
    expect(doc.telegramUserId).not.toBe(body.telegramUserId)
  })

  it('stores the server-computed subtotal and total', () => {
    const doc = buildOrderDocument(makeBody(), VERIFIED_USER_ID, 80, 72)

    expect(doc.subtotal).toBe(80)
    expect(doc.total).toBe(72)
  })

  it('passes through the validated order fields and trims name/handle', () => {
    const doc = buildOrderDocument(makeBody(), VERIFIED_USER_ID, 80, 80)

    expect(doc.fullName).toBe('Test  Buyer')
    expect(doc.telegramHandle).toBe('@testbuyer')
    expect(doc.fulfillmentType).toBe('meetup')
    expect(doc.paymentMethod).toBe('meetup_cash')
    expect(doc.meetupLocation).toBe('origo_center')
    expect(doc.items).toHaveLength(2)
    expect(doc.appliedPromo).toBeNull()
    expect(doc.cancelReason).toBe('')
    expect(doc.createdAt).toBeDefined()
  })

  it('stores the client idempotency key (M4)', () => {
    const body = makeBody({ clientOrderId: 'checkout-key-0001' })
    const doc = buildOrderDocument(body, VERIFIED_USER_ID, 80, 80)

    expect(doc.clientOrderId).toBe('checkout-key-0001')
  })
})
