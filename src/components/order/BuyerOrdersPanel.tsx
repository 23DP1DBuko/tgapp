import { useEffect, useMemo, useState } from 'react'

import { BuyerOrderDrawer } from './BuyerOrderDrawer'
import { PageHeader } from '../ui/PageHeader'
import { listOrdersByTelegramUserId } from '../../lib/firebase/orders'
import {
  doesOrderMatchBuyerFilter,
  formatOrderStatus,
  type BuyerOrderFilter,
  groupBuyerOrdersByRecency,
  getBuyerOrderProgressSteps,
  getOrderStatusBadgeClassName,
} from '../../lib/orderStatus'
import type { Order } from '../../types/order'

type BuyerOrdersPanelProps = {
  initData: string
  telegramUserId: number
  onBack: () => void
  onOrderModalChange?: (isOpen: boolean) => void
}

export function BuyerOrdersPanel({ initData, telegramUserId, onBack, onOrderModalChange }: BuyerOrdersPanelProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  // Notify parent when order modal opens/closes
  useEffect(() => {
    if (onOrderModalChange) {
      onOrderModalChange(selectedOrder !== null)
    }
  }, [selectedOrder, onOrderModalChange])
  const [selectedFilter, setSelectedFilter] = useState<BuyerOrderFilter>('all')

  useEffect(() => {
    let isCancelled = false

    async function loadOrders() {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const nextOrders = await listOrdersByTelegramUserId(initData)

        if (!isCancelled) {
          setOrders(nextOrders)
        }
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Failed to load your orders.',
          )
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadOrders()

    return () => {
      isCancelled = true
    }
  }, [initData, telegramUserId])

  async function handleRefresh() {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const nextOrders = await listOrdersByTelegramUserId(initData)
      setOrders(nextOrders)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to load your orders.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  const filteredOrders = useMemo(
    () => orders.filter((order) => doesOrderMatchBuyerFilter(order, selectedFilter)),
    [orders, selectedFilter],
  )
  const groupedOrders = useMemo(
    () => groupBuyerOrdersByRecency(filteredOrders),
    [filteredOrders],
  )

  return (
    <div className="animate-[fade-slide-in_0.4s_ease-out_backwards] space-y-4">
      <PageHeader label="Catalog" onClick={onBack} />
      <article className="rounded-[32px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
            My Orders
          </p>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            className="rounded-full bg-white/8 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]"
          >
            Refresh
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {!isLoading && !errorMessage && orders.length > 0 ? (
            <div
              className="flex gap-1 overflow-x-auto pb-1"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {(
                [
                  ['all', `All ${orders.length}`],
                  ['active', 'Active'],
                  ['completed', 'Completed'],
                  ['cancelled', 'Cancelled'],
                ] as const
              ).map(([filter, label]) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setSelectedFilter(filter)}
                  className={`relative shrink-0 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] whitespace-nowrap transition-colors ${
                    selectedFilter === filter
                      ? 'text-white'
                      : 'text-[var(--shop-muted)]'
                  }`}
                >
                  {label}
                  {selectedFilter === filter ? (
                    <span className="absolute bottom-0 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-[var(--shop-purple)]" />
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <SkeletonOrderCard key={i} />
              ))}
            </div>
          ) : null}

          {errorMessage ? (
            <p className="rounded-2xl bg-[var(--shop-red)]/16 px-4 py-3 text-sm text-[var(--shop-cream)]">
              {errorMessage}
            </p>
          ) : null}

          {!isLoading && !errorMessage && orders.length === 0 ? (
            <p className="rounded-2xl bg-white/8 px-4 py-3 text-sm text-[var(--shop-muted)]">
              No orders yet. Once you send a request in Telegram, it will show up here.
            </p>
          ) : null}

          {!isLoading && !errorMessage && orders.length > 0 && filteredOrders.length === 0 ? (
            <p className="rounded-2xl bg-white/8 px-4 py-3 text-sm text-[var(--shop-muted)]">
              No orders match this filter right now.
            </p>
          ) : null}

          {!isLoading && !errorMessage
            ? groupedOrders.map((group) => (
                <div key={group.key} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">
                      {group.label}
                    </p>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>

                  {group.orders.map((order) => {
                    const progressSteps = getBuyerOrderProgressSteps(order)
                    return (
                      <button
                        key={order.id}
                        type="button"
                        onClick={() => setSelectedOrder(order)}
                        className="w-full rounded-[24px] border border-white/10 bg-white/6 p-3 text-left transition-colors hover:border-[var(--shop-purple)]/30"
                      >
                        {/* Row 1: Name + abbreviated ID (left) · Cost + status pill (right) */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-[var(--shop-cream)]">
                              {order.items.map((item) => item.name).join(', ')}
                            </p>
                            <p className="mt-0.5 text-[10px] font-mono tracking-[-0.02em] text-[var(--shop-muted)]/70">
                              #{order.id.substring(0, 6)}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className="text-sm font-semibold tracking-[-0.02em] text-[var(--shop-cream)]">
                              {order.total} EUR
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] ${getOrderStatusBadgeClassName(order.status)}`}
                            >
                              {formatOrderStatus(order.status)}
                            </span>
                          </div>
                        </div>

                        {/* Row 2: Compact horizontal progress timeline */}
                        <div className="mt-3">
                          <div className="flex items-center">
                            {progressSteps.map((step, i) => (
                              <div key={step.key} className="flex items-center flex-1">
                                {/* Dot */}
                                <div
                                  className={`h-2 w-2 shrink-0 rounded-full ${
                                    step.isComplete
                                      ? step.isCurrent
                                        ? 'bg-[var(--shop-purple)]'
                                        : 'bg-[var(--shop-cream)]/70'
                                      : 'bg-white/15'
                                  }`}
                                />
                                {/* Line connector (not after last) */}
                                {i < progressSteps.length - 1 ? (
                                  <div
                                    className={`h-0.5 flex-1 ${progressSteps[i + 1].isComplete ? 'bg-[var(--shop-cream)]/30' : 'bg-white/10'}`}
                                  />
                                ) : null}
                              </div>
                            ))}
                          </div>
                          <div className="mt-1 flex">
                            {progressSteps.map((step) => (
                              <span
                                key={step.key}
                                className={`flex-1 text-center text-[8px] font-semibold uppercase tracking-[0.12em] ${
                                  step.isComplete
                                    ? 'text-[var(--shop-muted)]'
                                    : 'text-[var(--shop-muted)]/40'
                                }`}
                              >
                                {step.label}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Row 3: Cancel reason (only shown if cancelled) */}
                        {order.cancelReason ? (
                          <p className="mt-2 text-[10px] leading-4 italic text-[var(--shop-muted)]/50">
                            {order.cancelReason}
                          </p>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              ))
            : null}
        </div>
      </article>

      {selectedOrder ? (
        <BuyerOrderDrawer order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      ) : null}
    </div>
  )
}

// ── Skeleton order card (matches order card layout) ──

const shimmerBase = 'animate-[shimmer_1.5s_ease-in-out_infinite] bg-[length:200%_100%] bg-[linear-gradient(90deg,transparent_25%,rgba(255,255,255,0.06)_50%,transparent_75%)]'

function SkeletonOrderCard() {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/6 p-3">
      {/* Row 1: Name area (left) · Price area (right) */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2.5">
          {/* Product name block */}
          <div className={`h-4 w-2/3 rounded-md bg-white/8 ${shimmerBase}`} />
          {/* Order ID block */}
          <div className={`h-3 w-1/4 rounded-md bg-white/6 ${shimmerBase}`} />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {/* Price block */}
          <div className={`h-4 w-16 rounded-md bg-white/8 ${shimmerBase}`} />
          {/* Status pill block */}
          <div className={`h-5 w-14 rounded-full bg-white/6 ${shimmerBase}`} />
        </div>
      </div>

      {/* Row 2: Progress timeline skeleton */}
      <div className="mt-4 space-y-2">
        {/* Dots + line track */}
        <div className="flex items-center gap-0">
          {[1, 2, 3, 4].map((dot, i) => (
            <div key={dot} className="flex flex-1 items-center">
              <div className={`h-2 w-2 shrink-0 rounded-full bg-white/15 ${shimmerBase}`} />
              {i < 3 ? (
                <div className={`ml-0 h-0.5 flex-1 rounded-full bg-white/8 ${shimmerBase}`} />
              ) : null}
            </div>
          ))}
        </div>
        {/* Step labels */}
        <div className="flex">
          {['REQUEST', 'CONFIRMED', 'MEETUP', 'DONE'].map((label) => (
            <div key={label} className={`mx-auto h-2 w-10 rounded-md bg-white/6 ${shimmerBase}`} />
          ))}
        </div>
      </div>
    </div>
  )
}

