import { useCallback, useEffect, useMemo, useState } from 'react'

import { listOrders, updateOrderStatus } from '../../lib/firebase/orders'
import { triggerHapticFeedback } from '../../lib/telegram/webApp'
import type { Order } from '../../types/order'

// ── Display type ──

type DisplayStatus = 'NEW' | 'PAID' | 'WAITING' | 'READY_MEETUP' | 'COMPLETED' | 'CANCELLED'

type MeetupLocationLabel = 'Origo Center' | 'Old Town' | 'Akropole' | 'Not selected'
type MeetupTimeLabel = 'Today Evening' | 'Tomorrow Afternoon' | 'This Weekend' | 'Not selected'

type OrderCardItem = {
  id: string
  shortId: string
  itemName: string
  buyerName: string
  buyerHandle: string
  totalCost: number
  status: DisplayStatus
  fulfillmentType: 'delivery' | 'meetup'
  paymentMethod: 'meetup_cash' | 'usdt'
  meetupLocation: MeetupLocationLabel
  meetupTime: MeetupTimeLabel
  meetupNotes: string
  itemsDescription: string
  subtotal: number
  promoCode: string | null
  promoDiscount: number
  createdAt: string
  systemNote: string
  cancelReason: string
  raw: Order
}

// ── Helpers ──

function toDisplayStatus(s: Order['status']): DisplayStatus {
  switch (s) {
    case 'new': return 'NEW'
    case 'paid': return 'PAID'
    case 'waiting_for_payment': return 'WAITING'
    case 'ready_for_meetup': return 'READY_MEETUP'
    case 'completed': return 'COMPLETED'
    case 'cancelled': return 'CANCELLED'
  }
}

function fmtMeetupLocation(v: string): MeetupLocationLabel {
  switch (v) {
    case 'origo_center': return 'Origo Center'
    case 'old_town': return 'Old Town'
    case 'akropole': return 'Akropole'
    default: return 'Not selected'
  }
}

function fmtMeetupTime(v: string): MeetupTimeLabel {
  switch (v) {
    case 'today_evening': return 'Today Evening'
    case 'tomorrow_afternoon': return 'Tomorrow Afternoon'
    case 'this_weekend': return 'This Weekend'
    default: return 'Not selected'
  }
}

function telegramUrl(handle: string): string | null {
  const c = handle.trim().replace(/^@/, '')
  return c ? `https://t.me/${c}` : null
}

function toCardItem(o: Order): OrderCardItem {
  return {
    id: o.id,
    shortId: o.id.slice(0, 6),
    itemName: o.items[0]?.name ?? '—',
    buyerName: o.fullName,
    buyerHandle: o.telegramHandle,
    totalCost: o.total,
    status: toDisplayStatus(o.status),
    fulfillmentType: o.fulfillmentType,
    paymentMethod: o.paymentMethod,
    meetupLocation: fmtMeetupLocation(o.meetupLocation),
    meetupTime: fmtMeetupTime(o.meetupTimeOption),
    meetupNotes: o.meetupNotes || '',
    itemsDescription: o.items.map((i) => i.name).join(', '),
    subtotal: o.subtotal,
    promoCode: o.appliedPromo?.code ?? null,
    promoDiscount: o.appliedPromo?.discountAmount ?? 0,
    createdAt: o.createdAt ? o.createdAt.toLocaleString() : '—',
    systemNote: o.note || '',
    cancelReason: o.cancelReason || '',
    raw: o,
  }
}

const STATUS_STYLE: Record<DisplayStatus, { chip: string; text: string }> = {
  NEW: { chip: 'bg-white/8 text-white/80', text: 'text-white/80' },
  PAID: { chip: 'bg-[#A855F7]/18 text-[#A855F7]', text: 'text-[#A855F7]' },
  WAITING: { chip: 'bg-amber-300/15 text-amber-200', text: 'text-amber-200' },
  READY_MEETUP: { chip: 'bg-[#A855F7]/12 text-[#A855F7]', text: 'text-[#A855F7]' },
  COMPLETED: { chip: 'bg-emerald-400/15 text-emerald-200', text: 'text-emerald-200' },
  CANCELLED: { chip: 'bg-[#E61E26]/15 text-[#E61E26]', text: 'text-[#E61E26]' },
}

// ── Filter types ──

type PrimaryFilter = 'all' | 'with_promo' | 'without_promo' | 'new' | 'last_24h'
type StatusFilter = 'all' | Order['status']

const PRIMARY_FILTERS: { key: PrimaryFilter; label: string }[] = [
  { key: 'all', label: 'ALL' },
  { key: 'with_promo', label: 'WITH PROMO' },
  { key: 'without_promo', label: 'WITHOUT PROMO' },
  { key: 'new', label: 'NEW' },
  { key: 'last_24h', label: 'LAST 24H' },
]

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'waiting_for_payment', label: 'WAITING FOR PAYMENT' },
  { key: 'paid', label: 'PAID' },
  { key: 'ready_for_meetup', label: 'READY FOR MEETUP' },
  { key: 'completed', label: 'COMPLETED' },
  { key: 'cancelled', label: 'CANCELLED' },
]

// ── Component ──

type OrderAdminPanelProps = {
  isEnabled: boolean
  initData: string
}

export function OrderAdminPanel({ initData, isEnabled }: OrderAdminPanelProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null)
  const [copiedSummaryId, setCopiedSummaryId] = useState<string | null>(null)
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')

  // Debounce search query — only update filter after 300ms of no typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Derived: true while user has typed but debounce hasn't fired yet
  const isFilterPending = searchQuery.trim() !== '' && searchQuery !== debouncedSearchQuery

  // Dual filter state
  const [primaryFilter, setPrimaryFilter] = useState<PrimaryFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  // Accordion state
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // ── Load ──

  const load = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const next = await listOrders(initData)
      setOrders(next)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load orders.')
    } finally {
      setIsLoading(false)
    }
  }, [initData])

  useEffect(() => {
    if (isEnabled) void load()
  }, [isEnabled, load])

  // ── Filter logic ──

  const filteredOrders = useMemo(() => {
    let result = orders

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter((o) => o.status === statusFilter)
    }

    // Apply primary filter
    switch (primaryFilter) {
      case 'with_promo':
        result = result.filter((o) => o.appliedPromo !== null)
        break
      case 'without_promo':
        result = result.filter((o) => o.appliedPromo === null)
        break
      case 'new':
        result = result.filter((o) => o.status === 'new')
        break
      case 'last_24h': {
        const cutoff = Date.now() - 24 * 60 * 60 * 1000
        result = result.filter((o) => o.createdAt && o.createdAt.getTime() >= cutoff)
        break
      }
      // 'all' — no additional filter
    }

    // Apply search (debounced)
    const q = debouncedSearchQuery.trim().toLowerCase()
    if (q) {
      result = result.filter((o) => {
        const searchable = [
          o.fullName,
          o.telegramHandle,
          o.id,
          ...o.items.map((i) => i.name),
        ]
        return searchable.some((s) => s.toLowerCase().includes(q))
      })
    }

    return result
  }, [orders, statusFilter, primaryFilter, debouncedSearchQuery])

  const cards = useMemo(() => filteredOrders.map(toCardItem), [filteredOrders])

  // ── Actions ──

  async function handleUpdateStatus(order: Order, status: Order['status']) {
    const cancelReason =
      status === 'cancelled'
        ? window.prompt('Optional cancel reason:', order.cancelReason ?? '') ?? ''
        : order.cancelReason

    setIsUpdatingId(order.id)
    setErrorMessage(null)
    try {
      await updateOrderStatus(initData, order.id, status, cancelReason)
      void load()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update.')
    } finally {
      setIsUpdatingId(null)
    }
  }

  async function handleCopySummary(card: OrderCardItem) {
    const summary = buildSummaryText(card)
    try {
      await navigator.clipboard.writeText(summary)
      setCopiedSummaryId(card.id)
      setTimeout(() => setCopiedSummaryId((v) => (v === card.id ? null : v)), 2000)
    } catch {
      setErrorMessage('Failed to copy to clipboard.')
    }
  }

  async function handleCopyId(cardId: string) {
    try {
      await navigator.clipboard.writeText(cardId)
      triggerHapticFeedback('light')
      setCopiedOrderId(cardId)
      setTimeout(() => setCopiedOrderId((v) => (v === cardId ? null : v)), 2000)
    } catch {
      /* silent */
    }
  }

  function handleToggleCard(id: string) {
    setExpandedId((prev) => {
      const expanding = prev !== id
      if (expanding) triggerHapticFeedback('light')
      return expanding ? id : null
    })
  }

  // ── Render ──

  return (
    <article className="rounded-[32px] border border-white/10 bg-[#0D0B0E] p-5 shadow-[0_25px_70px_rgba(0,0,0,0.45)]">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
          Saved Checkouts
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-full bg-white/8 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]"
        >
          Refresh
        </button>
      </div>

      {/* ── Search bar with embedded ALL button ── */}
      <div className="relative mt-4">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search buyer, @handle, order ID, item..."
          className="w-full rounded-2xl border border-white/10 bg-[#1C1622] px-4 py-3 pr-20 text-sm text-[var(--shop-cream)] outline-none transition placeholder:text-[var(--shop-muted)]/60 focus:border-[#E61E26]/50"
        />
        {/* Filter-pending pulse dot */}
        {isFilterPending ? (
          <span className="absolute right-[4.5rem] top-1/2 -translate-y-1/2">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#A855F7]/40" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-[#A855F7]" />
            </span>
          </span>
        ) : null}

        <button
          type="button"
          onClick={() => {
            setPrimaryFilter('all')
            setStatusFilter('all')
            setSearchQuery('')
            setDebouncedSearchQuery('')
          }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-xl bg-[#E61E26] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-white shadow-[0_2px_8px_rgba(230,30,38,0.25)]"
        >
          ALL
        </button>
      </div>

      {/* ── Filter Carousel Row 1 (Core Filters) ── */}
      <div className="mt-3 overflow-x-auto scrollbar-none">
        <div className="flex gap-2 whitespace-nowrap">
          {PRIMARY_FILTERS.map((f) => {
            const isActive = primaryFilter === f.key
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => {
                  triggerHapticFeedback('light')
                  setPrimaryFilter(f.key)
                  if (f.key === 'new' && statusFilter !== 'all') setStatusFilter('all')
                }}
                className={`rounded-full px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] transition-all ${
                  isActive
                    ? 'bg-[linear-gradient(135deg,#A855F7,#E61E26)] text-white shadow-[0_4px_14px_rgba(168,85,247,0.25)]'
                    : 'bg-[#1C1622] text-[var(--shop-muted)]/60 hover:text-[var(--shop-muted)]'
                }`}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Filter Carousel Row 2 (Fulfillment States) ── */}
      <div className="mt-2 overflow-x-auto scrollbar-none">
        <div className="flex gap-2 whitespace-nowrap">
          {STATUS_FILTERS.map((f) => {
            const isActive = statusFilter === f.key
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => {
                  triggerHapticFeedback('light')
                  setStatusFilter(isActive ? 'all' : f.key)
                  if (primaryFilter === 'new') setPrimaryFilter('all')
                }}
                className={`rounded-full px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] transition-all ${
                  isActive
                    ? 'bg-[#A855F7]/20 text-[#A855F7] shadow-[0_0_0_1px_rgba(168,85,247,0.3)]'
                    : 'bg-[#1C1622] text-[var(--shop-muted)]/50 hover:text-[var(--shop-muted)]'
                }`}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Error / Empty / Loading states ── */}
      {errorMessage ? (
        <div className="mt-4 rounded-2xl bg-[#E61E26]/15 px-4 py-3 text-sm text-[var(--shop-cream)]">
          {errorMessage}
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-4 rounded-2xl bg-[#1C1622] px-4 py-3 text-sm text-[var(--shop-muted)]">
          Loading saved checkouts...
        </div>
      ) : null}

      {!isLoading && !errorMessage && orders.length === 0 ? (
        <div className="mt-4 rounded-2xl bg-[#1C1622] px-4 py-8 text-center text-sm text-[var(--shop-muted)]">
          No saved checkouts yet.
        </div>
      ) : null}

      {!isLoading && !errorMessage && orders.length > 0 && cards.length === 0 ? (
        <div className="mt-4 rounded-2xl bg-[#1C1622] px-4 py-3 text-sm text-[var(--shop-muted)]">
          No orders match the current filter.
        </div>
      ) : null}

      {/* ── Order Cards ── */}
      {!isLoading && !errorMessage && cards.length > 0 ? (
        <div className="mt-4 space-y-3">
          {cards.map((card) => {
            const isExpanded = expandedId === card.id
            const isUpdating = isUpdatingId === card.id
            const isSummaryCopied = copiedSummaryId === card.id
            const isOrderIdCopied = copiedOrderId === card.id
            const ss = STATUS_STYLE[card.status]
            const tgUrl = telegramUrl(card.buyerHandle)
            const showMeetup =
              card.fulfillmentType === 'meetup' &&
              card.meetupLocation !== 'Not selected'

            return (
              <div
                key={card.id}
                className="overflow-hidden rounded-[20px] border border-white/10 bg-[#1C1622] transition-all duration-200"
              >
                {/* ── 3-Column Header (always visible, clickable) ── */}
                <button
                  type="button"
                  onClick={() => handleToggleCard(card.id)}
                  className="flex w-full items-stretch text-left outline-none"
                >
                  {/* Left: item name, order ID, handle */}
                  <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-4 py-3.5">
                    <p className="truncate text-sm font-bold text-white">
                      {card.itemName}
                    </p>
                    <div className="flex items-center gap-2 text-[10px]">
                      {/* Short order ID with copy */}
                      <span className="flex items-center gap-1 text-[var(--shop-muted)]/70">
                        <span className="font-mono">#{card.shortId}...</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleCopyId(card.id)
                          }}
                          className="rounded-md bg-white/8 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-[var(--shop-muted)] transition-colors hover:text-white"
                        >
                          {isOrderIdCopied ? 'Copied' : 'Copy'}
                        </button>
                      </span>
                    </div>
                    {/* Telegram handle link */}
                    <div className="mt-0.5">
                      {tgUrl ? (
                        <a
                          href={tgUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 rounded-md bg-white/6 px-2 py-0.5 text-[10px] font-semibold text-[#A855F7] transition-colors hover:bg-[#A855F7]/15"
                        >
                          <svg viewBox="0 0 20 20" className="h-3 w-3" fill="currentColor" aria-hidden="true">
                            <path d="M10 1C5.06 1 1 5.06 1 10s4.06 9 9 9 9-4.06 9-9-4.06-9-9-9zm4.24 6.16l-1.44 6.78c-.1.48-.4.6-.8.37l-2.23-1.64-1.07 1.04c-.12.12-.22.22-.44.22l.15-2.23 4.07-3.68c.18-.16-.04-.25-.28-.09l-5.03 3.17-2.17-.7c-.47-.15-.48-.47.1-.7l8.5-3.27c.39-.14.73.08.6.66z" />
                          </svg>
                          @{card.buyerHandle.replace(/^@/, '')}
                        </a>
                      ) : (
                        <span className="text-[10px] text-[var(--shop-muted)]/50">
                          No handle
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Center: Meetup / Cash badges */}
                  <div className="flex shrink-0 flex-col justify-center gap-1 px-2">
                    {card.fulfillmentType === 'meetup' ? (
                      <>
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#A855F7]/12 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.14em] text-[#A855F7]">
                          🤝 MEETUP
                        </span>
                        {showMeetup ? (
                          <span className="text-center text-[8px] uppercase tracking-[0.12em] text-[var(--shop-muted)]/60">
                            {card.meetupLocation}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/6 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.14em] text-[var(--shop-muted)]/70">
                        📦 DELIVERY
                      </span>
                    )}
                    {card.paymentMethod === 'meetup_cash' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/12 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.14em] text-emerald-200">
                        💵 CASH
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#A855F7]/10 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.14em] text-[#A855F7]/80">
                        ₮ USDT
                      </span>
                    )}
                  </div>

                  {/* Right: price + status pill */}
                  <div className="flex shrink-0 flex-col items-end justify-center gap-1.5 px-4 py-3.5">
                    <p className="text-base font-extrabold tracking-[-0.02em] text-white">
                      {card.totalCost}€
                    </p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] ${ss.chip}`}
                    >
                      {card.status}
                    </span>
                  </div>
                </button>

                {/* ── Expanded Details (accordion) ── */}
                <div
                  className={`overflow-hidden transition-all duration-250 ease-out ${
                    isExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  {/* Details block */}
                  <div className="border-t border-white/10 px-4 py-4 text-sm leading-6 text-[var(--shop-muted)]">
                    {card.fulfillmentType === 'meetup' ? (
                      <>
                        <DetailRow label="Meetup Location" value={card.meetupLocation} />
                        <DetailRow label="Meetup Time" value={card.meetupTime} />
                        {card.meetupNotes ? (
                          <DetailRow label="Meetup Notes" value={card.meetupNotes} />
                        ) : null}
                      </>
                    ) : (
                      <>
                        <DetailRow
                          label="Delivery"
                          value={`${card.raw.deliveryCity || '—'} › ${card.raw.deliveryAddress || '—'}`}
                        />
                        {card.raw.deliveryNotes ? (
                          <DetailRow label="Delivery Notes" value={card.raw.deliveryNotes} />
                        ) : null}
                      </>
                    )}

                    <DetailRow label="Items" value={card.itemsDescription} />
                    <DetailRow label="Subtotal" value={`${card.subtotal} EUR`} />

                    {card.promoCode ? (
                      <DetailRow
                        label="Promo"
                        value={`${card.promoCode} (-${card.promoDiscount} EUR)`}
                      />
                    ) : null}

                    <DetailRow label="Created" value={card.createdAt} />

                    {card.cancelReason ? (
                      <DetailRow label="Cancel Reason" value={card.cancelReason} />
                    ) : null}

                    {card.systemNote ? (
                      <DetailRow label="Note" value={card.systemNote} />
                    ) : null}
                  </div>

                  {/* ── Action buttons ── */}
                  <div className="border-t border-white/10 px-4 pb-4 pt-3 space-y-2">
                    {/* Row 1 */}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleCopySummary(card)}
                        disabled={isUpdating}
                        className={`flex-1 rounded-xl border px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.16em] transition-all ${
                          isSummaryCopied
                            ? 'border-emerald-400/30 bg-emerald-400/15 text-emerald-200'
                            : 'border-white/10 bg-white/6 text-[var(--shop-muted)] hover:bg-white/10'
                        } disabled:opacity-50`}
                      >
                        {isSummaryCopied ? '✓ Copied' : 'Copy Order Summary'}
                      </button>

                      {tgUrl ? (
                        <a
                          href={tgUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 rounded-xl border border-[#A855F7]/20 bg-[#A855F7]/10 px-3 py-2.5 text-center text-[9px] font-bold uppercase tracking-[0.16em] text-[#A855F7] transition-colors hover:bg-[#A855F7]/20"
                        >
                          Message Buyer
                        </a>
                      ) : (
                        <span className="flex flex-1 items-center justify-center rounded-xl border border-white/10 bg-white/6 px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--shop-muted)]/50">
                          No Telegram
                        </span>
                      )}
                    </div>

                    {/* Row 2: Workflow status modifiers */}
                    <div className="flex gap-2">
                      {/* Ready for Meetup — only for meetup orders in new/paid state */}
                      {card.fulfillmentType === 'meetup' &&
                      (card.raw.status === 'new' || card.raw.status === 'paid') ? (
                        <button
                          type="button"
                          onClick={() => void handleUpdateStatus(card.raw, 'ready_for_meetup')}
                          disabled={isUpdating}
                          className="flex-1 rounded-xl bg-[#A855F7]/15 px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.16em] text-[#A855F7] transition-colors hover:bg-[#A855F7]/25 disabled:opacity-50"
                        >
                          Ready For Meetup
                        </button>
                      ) : null}

                      {/* Mark Paid — only for waiting_for_payment */}
                      {card.raw.status === 'waiting_for_payment' ? (
                        <button
                          type="button"
                          onClick={() => void handleUpdateStatus(card.raw, 'paid')}
                          disabled={isUpdating}
                          className="flex-1 rounded-xl bg-[#A855F7]/20 px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.16em] text-[#A855F7] transition-colors hover:bg-[#A855F7]/30 disabled:opacity-50"
                        >
                          Mark Paid
                        </button>
                      ) : null}

                      {/* Mark Completed — unless already completed/cancelled */}
                      {card.raw.status !== 'completed' && card.raw.status !== 'cancelled' ? (
                        <button
                          type="button"
                          onClick={() => void handleUpdateStatus(card.raw, 'completed')}
                          disabled={isUpdating}
                          className="flex-1 rounded-xl bg-emerald-400/15 px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-200 transition-colors hover:bg-emerald-400/25 disabled:opacity-50"
                        >
                          Mark Completed
                        </button>
                      ) : null}

                      {/* Cancel Order — unless already cancelled/completed */}
                      {card.raw.status !== 'cancelled' && card.raw.status !== 'completed' ? (
                        <button
                          type="button"
                          onClick={() => void handleUpdateStatus(card.raw, 'cancelled')}
                          disabled={isUpdating}
                          className="flex-1 rounded-xl bg-[#E61E26]/12 px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.16em] text-[#E61E26] transition-colors hover:bg-[#E61E26]/25 disabled:opacity-50"
                        >
                          Cancel Order
                        </button>
                      ) : null}
                    </div>

                    {/* USDT Instructions — only for usdt payments */}
                    {card.paymentMethod === 'usdt' ? (
                      <div className="mt-2 rounded-2xl border border-[#A855F7]/15 bg-[#A855F7]/8 px-4 py-3">
                        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#A855F7]/70">
                          ₮ USDT Payment
                        </p>
                        <p className="mt-1.5 text-[11px] leading-5 text-[var(--shop-muted)]/80">
                          Ask buyer to send {card.totalCost} EUR worth of USDT with order ID as
                          reference. After verification, mark as paid.
                        </p>
                        <p className="mt-2 text-[10px] font-mono text-white/60">
                          Reference: {card.id}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
    </article>
  )
}

// ── Sub-components ──

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 py-1">
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)]/50 w-24">
        {label}
      </span>
      <span className="text-[11px] leading-5 text-[var(--shop-muted)]/90">
        {value}
      </span>
    </div>
  )
}

function buildSummaryText(card: OrderCardItem): string {
  const lines = [
    `Order ${card.id}`,
    `Buyer: ${card.buyerName} (${card.buyerHandle || 'no handle'})`,
    `Status: ${card.status}`,
    `Fulfillment: ${card.fulfillmentType === 'delivery' ? 'Delivery' : 'Meetup'}`,
    `Payment: ${card.paymentMethod === 'usdt' ? 'USDT' : 'Meetup Cash'}`,
    `Items: ${card.itemsDescription}`,
    `Subtotal: ${card.subtotal} EUR`,
    card.promoCode ? `Promo: ${card.promoCode} (-${card.promoDiscount} EUR)` : 'Promo: None',
    `Total: ${card.totalCost} EUR`,
  ]

  if (card.fulfillmentType === 'meetup') {
    lines.push(`Meetup: ${card.meetupLocation} @ ${card.meetupTime}`)
    if (card.meetupNotes) lines.push(`Meetup Notes: ${card.meetupNotes}`)
  } else {
    lines.push(`Delivery: ${card.raw.deliveryCity || '—'} › ${card.raw.deliveryAddress || '—'}`)
  }

  if (card.systemNote) lines.push(`Note: ${card.systemNote}`)
  if (card.cancelReason) lines.push(`Cancel Reason: ${card.cancelReason}`)

  return lines.join('\n')
}
