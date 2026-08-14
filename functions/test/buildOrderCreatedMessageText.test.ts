import { describe, it, expect, vi } from 'vitest'

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

import { buildOrderCreatedMessageText } from '../src/helpers.js'

describe('buildOrderCreatedMessageText (M1)', () => {
  const input = {
    orderId: 'ord_123',
    itemsSummary: 'Hoodie, Tee',
    total: 80,
    fulfillmentLabel: 'Meetup',
    statusLabel: 'New',
    miniAppUrl: 'https://t.me/store',
  }

  it('uses real newlines, never the literal backslash-n sequence (M1 regression)', () => {
    const text = buildOrderCreatedMessageText(input)

    expect(text.includes('\n')).toBe(true)
    expect(text.includes('\\n')).toBe(false)
  })

  it('starts with the confirmation header and ends with the follow-up line', () => {
    const text = buildOrderCreatedMessageText(input)

    expect(text.startsWith('✅ Order Confirmed')).toBe(true)
    expect(text.endsWith('We will message you here when the status changes.')).toBe(true)
  })

  it('includes order details, totals and the track link', () => {
    const text = buildOrderCreatedMessageText(input)

    expect(text).toContain('Order: ord_123')
    expect(text).toContain('Items: Hoodie, Tee')
    expect(text).toContain('Total: 80 EUR')
    expect(text).toContain('Fulfillment: Meetup')
    expect(text).toContain('Status: New')
    expect(text).toContain('Track it: https://t.me/store')
  })

  it('omits the track link when no mini app url is available', () => {
    const text = buildOrderCreatedMessageText({ ...input, miniAppUrl: null })

    expect(text).not.toContain('Track it:')
  })

  it('locks the exact message format (golden)', () => {
    expect(
      buildOrderCreatedMessageText({
        orderId: 'ord_123',
        itemsSummary: 'Hoodie, Tee',
        total: 80,
        fulfillmentLabel: 'Meetup',
        statusLabel: 'New',
        miniAppUrl: 'https://t.me/store',
      }),
    ).toBe(
      [
        '✅ Order Confirmed',
        '',
        'Order: ord_123',
        'Items: Hoodie, Tee',
        'Total: 80 EUR',
        'Fulfillment: Meetup',
        'Status: New',
        '',
        'Track it: https://t.me/store',
        '',
        'We will message you here when the status changes.',
      ].join('\n'),
    )
  })
})
