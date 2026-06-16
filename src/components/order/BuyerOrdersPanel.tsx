import { useEffect, useMemo, useState } from 'react'

import { BuyerOrderDrawer } from './BuyerOrderDrawer'
import { listOrdersByTelegramUserId } from '../../lib/firebase/orders'
import {
  doesOrderMatchBuyerFilter,
  formatOrderStatus,
  type BuyerOrderFilter,
  groupBuyerOrdersByRecency,
  getBuyerOrderProgressSteps,
  getBuyerOrderStatusHint,
  getOrderStatusBadgeClassName,
  summarizeBuyerOrders,
} from '../../lib/orderStatus'
import type { Order } from '../../types/order'

type BuyerOrdersPanelProps = {
  initData: string
  telegramUserId: number
  onBack: () => void
}

export function BuyerOrdersPanel({ initData, telegramUserId, onBack }: BuyerOrdersPanelProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
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
  const orderSummary = useMemo(() => summarizeBuyerOrders(orders), [orders])
  const groupedOrders = useMemo(
    () => groupBuyerOrdersByRecency(filteredOrders),
    [filteredOrders],
  )

  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="rounded-[24px] border border-white/10 bg-white/6 px-4 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)]"
      >
        Back To Catalog
      </button>
      <article className="rounded-[32px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
              My Orders
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--shop-cream)]">
              Your order flow
            </h3>
            <p className="mt-3 text-sm leading-6 text-[var(--shop-muted)]">
              Track your recent requests by Telegram account and see what stage each piece is in.
            </p>
          </div>
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryCard label="Active" value={orderSummary.activeCount} />
              <SummaryCard label="Completed" value={orderSummary.completedCount} />
              <SummaryCard label="Cancelled" value={orderSummary.cancelledCount} />
              <SummaryCard label="Payment Due" value={orderSummary.paymentPendingCount} />
            </div>
          ) : null}

          {!isLoading && !errorMessage && orders.length > 0 ? (
            <div className="flex flex-wrap gap-2">
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
                  className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition-colors ${
                    selectedFilter === filter
                      ? 'bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] text-white'
                      : 'bg-white/8 text-[var(--shop-muted)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          {isLoading ? (
            <p className="rounded-2xl bg-white/8 px-4 py-3 text-sm text-[var(--shop-muted)]">
              Loading your orders...
            </p>
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

                  {group.orders.map((order) => (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => setSelectedOrder(order)}
                      className="w-full rounded-[24px] border border-white/10 bg-white/6 p-4 text-left transition-colors hover:border-[var(--shop-red)]/30"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[var(--shop-cream)]">
                            {order.items.map((item) => item.name).join(', ')}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--shop-muted)]">
                            {order.createdAt
                              ? order.createdAt.toLocaleString()
                              : 'Pending server timestamp'}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${getOrderStatusBadgeClassName(order.status)}`}
                        >
                          {formatOrderStatus(order.status)}
                        </span>
                      </div>

                      <div className="mt-4 space-y-2 text-sm text-[var(--shop-muted)]">
                        <p>
                          <span className="font-semibold text-[var(--shop-cream)]">
                            Order ID:
                          </span>{' '}
                          {order.id}
                        </p>
                        <p>
                          <span className="font-semibold text-[var(--shop-cream)]">
                            Fulfillment:
                          </span>{' '}
                          {order.fulfillmentType === 'delivery' ? 'Delivery' : 'Meetup'}
                        </p>
                        <p>
                          <span className="font-semibold text-[var(--shop-cream)]">
                            Payment:
                          </span>{' '}
                          {order.paymentMethod === 'usdt' ? 'USDT' : 'Meetup Cash'}
                        </p>
                        <p>
                          <span className="font-semibold text-[var(--shop-cream)]">Total:</span>{' '}
                          {order.total} EUR
                        </p>
                        <p className="pt-1 text-xs uppercase tracking-[0.16em] text-[var(--shop-cream)]/85">
                          {getBuyerOrderStatusHint(order)}
                        </p>
                        <div className="grid grid-cols-4 gap-2 pt-2">
                          {getBuyerOrderProgressSteps(order).map((step) => (
                            <div key={step.key} className="space-y-2">
                              <div
                                className={`h-1 rounded-full ${
                                  step.isComplete
                                    ? step.isCurrent
                                      ? 'bg-[var(--shop-red)]'
                                      : 'bg-[var(--shop-cream)]'
                                    : 'bg-white/10'
                                }`}
                              />
                              <p
                                className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${
                                  step.isComplete
                                    ? 'text-[var(--shop-cream)]'
                                    : 'text-[var(--shop-muted)]'
                                }`}
                              >
                                {step.label}
                              </p>
                            </div>
                          ))}
                        </div>
                        {order.cancelReason ? (
                          <p>
                            <span className="font-semibold text-[var(--shop-cream)]">
                              Cancel Reason:
                            </span>{' '}
                            {order.cancelReason}
                          </p>
                        ) : null}
                      </div>
                    </button>
                  ))}
                </div>
              ))
            : null}
        </div>
      </article>

      {selectedOrder ? (
        <BuyerOrderDrawer order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      ) : null}
    </>
  )
}

type SummaryCardProps = {
  label: string
  value: number
}

function SummaryCard({ label, value }: SummaryCardProps) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/6 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-[var(--shop-cream)]">{value}</p>
    </div>
  )
}
