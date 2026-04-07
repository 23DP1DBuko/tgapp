import { useEffect, useMemo, useState } from 'react'

import { listOrders, updateOrderStatus } from '../../lib/firebase/orders'
import type { Order } from '../../types/order'

type OrderAdminPanelProps = {
  isEnabled: boolean
}

export function OrderAdminPanel({ isEnabled }: OrderAdminPanelProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isUpdatingOrderId, setIsUpdatingOrderId] = useState<string | null>(null)
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [orderView, setOrderView] = useState<
    'all' | 'with_promo' | 'without_promo' | Order['status']
  >('all')

  useEffect(() => {
    if (!isEnabled) {
      return
    }

    void reloadOrders()
  }, [isEnabled])

  async function reloadOrders() {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const nextOrders = await listOrders()
      setOrders(nextOrders)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to load saved orders.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  const filteredOrders = useMemo(() => {
    if (orderView === 'with_promo') {
      return orders.filter((order) => order.appliedPromo !== null)
    }

    if (orderView === 'without_promo') {
      return orders.filter((order) => order.appliedPromo === null)
    }

    if (orderView !== 'all') {
      return orders.filter((order) => order.status === orderView)
    }

    return orders
  }, [orderView, orders])

  const totalRevenue = useMemo(
    () => orders.reduce((sum, order) => sum + order.total, 0),
    [orders],
  )
  const promoOrdersCount = useMemo(
    () => orders.filter((order) => order.appliedPromo !== null).length,
    [orders],
  )
  const todayOrdersCount = useMemo(() => {
    const today = new Date()

    return orders.filter((order) => {
      if (!order.createdAt) {
        return false
      }

      return (
        order.createdAt.getFullYear() === today.getFullYear()
        && order.createdAt.getMonth() === today.getMonth()
        && order.createdAt.getDate() === today.getDate()
      )
    }).length
  }, [orders])
  const groupedOrders = useMemo(
    () => [
      {
        key: 'active',
        title: 'Active Queue',
        description: 'New, payment, and meetup orders that still need attention.',
        orders: filteredOrders.filter(
          (order) => order.status !== 'completed' && order.status !== 'cancelled',
        ),
      },
      {
        key: 'completed',
        title: 'Completed',
        description: 'Closed orders that already reached handoff or delivery.',
        orders: filteredOrders.filter((order) => order.status === 'completed'),
      },
      {
        key: 'cancelled',
        title: 'Cancelled',
        description: 'Orders that were cancelled and kept for reference.',
        orders: filteredOrders.filter((order) => order.status === 'cancelled'),
      },
    ],
    [filteredOrders],
  )

  async function handleUpdateStatus(order: Order, status: Order['status']) {
    const cancelReason =
      status === 'cancelled'
        ? window.prompt('Optional cancel reason:', order.cancelReason ?? '') ?? ''
        : order.cancelReason

    setIsUpdatingOrderId(order.id)
    setErrorMessage(null)

    try {
      await updateOrderStatus(order.id, status, cancelReason)
      await reloadOrders()
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to update order status.',
      )
    } finally {
      setIsUpdatingOrderId(null)
    }
  }

  async function handleCopyOrderSummary(
    order: Order,
    mode: 'summary' | 'payment' = 'summary',
  ) {
    const summary = buildOrderMessage(order, mode)

    try {
      await navigator.clipboard.writeText(summary)
      setCopiedOrderId(order.id)
      window.setTimeout(() => {
        setCopiedOrderId((currentValue) =>
          currentValue === order.id ? null : currentValue,
        )
      }, 2000)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Failed to copy order summary to clipboard.',
      )
    }
  }

  return (
    <article className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(24,16,31,0.94),rgba(18,10,24,0.96))] p-5 shadow-[0_25px_70px_rgba(0,0,0,0.35)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
            Saved Checkouts
          </p>
          <p className="mt-3 text-sm leading-6 text-[var(--shop-muted)]">
            Review the latest order requests saved from the checkout flow.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reloadOrders()}
          className="rounded-full bg-white/8 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]"
        >
          Refresh
        </button>
      </div>

      {!isLoading && !errorMessage && orders.length > 0 ? (
        <>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <OrderStat label="Orders" value={String(orders.length)} />
            <OrderStat label="With Promo" value={String(promoOrdersCount)} />
            <OrderStat label="Revenue" value={`${totalRevenue} EUR`} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(
              [
                'all',
                'with_promo',
                'without_promo',
                'new',
                'waiting_for_payment',
                'paid',
                'ready_for_meetup',
                'completed',
                'cancelled',
              ] as const
            ).map((view) => (
              <button
                key={view}
                type="button"
                onClick={() => setOrderView(view)}
                className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${
                  orderView === view
                    ? 'bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] text-white'
                    : 'bg-white/8 text-[var(--shop-muted)]'
                }`}
              >
                {view === 'all'
                  ? 'all'
                  : view === 'with_promo'
                    ? 'with promo'
                    : view === 'without_promo'
                      ? 'without promo'
                      : view.replaceAll('_', ' ')}
              </button>
            ))}
            <span className="rounded-full bg-white/6 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)]">
              Today {todayOrdersCount}
            </span>
          </div>
        </>
      ) : null}

      <div className="mt-5 space-y-3">
        {isLoading ? (
          <p className="rounded-2xl bg-white/8 px-4 py-3 text-sm text-[var(--shop-muted)]">
            Loading saved checkouts...
          </p>
        ) : null}

        {errorMessage ? (
          <p className="rounded-2xl bg-[var(--shop-red)]/18 px-4 py-3 text-sm text-[var(--shop-cream)]">
            {errorMessage}
          </p>
        ) : null}

        {!isLoading && !errorMessage && orders.length === 0 ? (
          <p className="rounded-2xl bg-white/8 px-4 py-3 text-sm text-[var(--shop-muted)]">
            No saved checkouts yet.
          </p>
        ) : null}

        {!isLoading && !errorMessage && filteredOrders.length === 0 ? (
          <p className="rounded-2xl bg-white/8 px-4 py-3 text-sm text-[var(--shop-muted)]">
            No saved checkouts match the current filter.
          </p>
        ) : null}

        {!isLoading && !errorMessage
          ? groupedOrders.map((group) =>
              group.orders.length > 0 ? (
                <section key={group.key} className="space-y-3">
                  <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--shop-cream)]">
                          {group.title}
                        </p>
                        <p className="mt-1 text-xs text-[var(--shop-muted)]">
                          {group.description}
                        </p>
                      </div>
                      <span className="rounded-full bg-white/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                        {group.orders.length}
                      </span>
                    </div>
                  </div>

                  {group.orders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      isCopied={copiedOrderId === order.id}
                      isUpdating={isUpdatingOrderId === order.id}
                      onCopySummary={handleCopyOrderSummary}
                      onUpdateStatus={handleUpdateStatus}
                    />
                  ))}
                </section>
              ) : null,
            )
          : null}
      </div>
    </article>
  )
}

type OrderCardProps = {
  order: Order
  isCopied: boolean
  isUpdating: boolean
  onCopySummary: (order: Order, mode?: 'summary' | 'payment') => Promise<void>
  onUpdateStatus: (order: Order, status: Order['status']) => Promise<void>
}

function OrderCard({
  order,
  isCopied,
  isUpdating,
  onCopySummary,
  onUpdateStatus,
}: OrderCardProps) {
  return (
    <article className="rounded-[24px] border border-white/10 bg-white/6 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--shop-cream)]">{order.fullName}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--shop-muted)]">
            {order.telegramHandle}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-[var(--shop-cream)]">{order.total} EUR</p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--shop-muted)]">
            {order.status}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2 text-sm text-[var(--shop-muted)]">
        <p>
          <span className="font-semibold text-[var(--shop-cream)]">Order ID:</span> {order.id}
        </p>
        <p>
          <span className="font-semibold text-[var(--shop-cream)]">Fulfillment:</span>{' '}
          {order.fulfillmentType === 'delivery' ? 'Delivery' : 'Meetup'}
        </p>
        <p>
          <span className="font-semibold text-[var(--shop-cream)]">Payment:</span>{' '}
          {order.paymentMethod === 'usdt' ? 'USDT' : 'Meetup Cash'}
        </p>
        {order.fulfillmentType === 'delivery' ? (
          <>
            <p>
              <span className="font-semibold text-[var(--shop-cream)]">City:</span>{' '}
              {order.deliveryCity || 'Not provided'}
            </p>
            <p>
              <span className="font-semibold text-[var(--shop-cream)]">Address:</span>{' '}
              {order.deliveryAddress || 'Not provided'}
            </p>
            <p>
              <span className="font-semibold text-[var(--shop-cream)]">Delivery Notes:</span>{' '}
              {order.deliveryNotes || 'No delivery notes'}
            </p>
          </>
        ) : (
          <>
            <p>
              <span className="font-semibold text-[var(--shop-cream)]">Meetup Location:</span>{' '}
              {formatMeetupLocation(order.meetupLocation)}
            </p>
            <p>
              <span className="font-semibold text-[var(--shop-cream)]">Meetup Time:</span>{' '}
              {formatMeetupTime(order.meetupTimeOption)}
            </p>
            <p>
              <span className="font-semibold text-[var(--shop-cream)]">Meetup Notes:</span>{' '}
              {order.meetupNotes || 'No meetup notes'}
            </p>
          </>
        )}
        <p>
          <span className="font-semibold text-[var(--shop-cream)]">Items:</span>{' '}
          {order.items.map((item) => item.name).join(', ')}
        </p>
        <p>
          <span className="font-semibold text-[var(--shop-cream)]">Subtotal:</span>{' '}
          {order.subtotal} EUR
        </p>
        <p>
          <span className="font-semibold text-[var(--shop-cream)]">Promo:</span>{' '}
          {order.appliedPromo
            ? `${order.appliedPromo.code} (-${order.appliedPromo.discountAmount} EUR)`
            : 'No promo'}
        </p>
        <p>
          <span className="font-semibold text-[var(--shop-cream)]">Created:</span>{' '}
          {order.createdAt ? order.createdAt.toLocaleString() : 'Pending server timestamp'}
        </p>
        {order.cancelReason ? (
          <p>
            <span className="font-semibold text-[var(--shop-cream)]">Cancel Reason:</span>{' '}
            {order.cancelReason}
          </p>
        ) : null}
        <p>
          <span className="font-semibold text-[var(--shop-cream)]">Note:</span>{' '}
          {order.note || 'No note'}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void onCopySummary(order)}
          className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${
            isCopied
              ? 'border-emerald-300/30 bg-emerald-300/18 text-emerald-100'
              : 'border-white/10 bg-white/8 text-[var(--shop-cream)]'
          }`}
        >
          {isCopied ? 'Copied' : 'Copy Order Summary'}
        </button>

        {order.paymentMethod === 'usdt' ? (
          <button
            type="button"
            onClick={() => void onCopySummary(order, 'payment')}
            className="rounded-full border border-[var(--shop-purple)]/30 bg-[var(--shop-purple)]/14 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)]"
          >
            Copy Payment Note
          </button>
        ) : null}

        {getTelegramProfileUrl(order.telegramHandle) ? (
          <a
            href={getTelegramProfileUrl(order.telegramHandle) ?? '#'}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-white/10 bg-white/8 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)]"
          >
            Message Buyer
          </a>
        ) : (
          <span className="rounded-full border border-white/10 bg-white/6 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]">
            No Telegram Link
          </span>
        )}

        {order.status === 'waiting_for_payment' ? (
          <button
            type="button"
            onClick={() => void onUpdateStatus(order, 'paid')}
            disabled={isUpdating}
            className="rounded-full bg-[var(--shop-purple)]/18 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)] disabled:opacity-50"
          >
            Mark Paid
          </button>
        ) : null}

        {order.fulfillmentType === 'meetup' &&
        (order.status === 'new' || order.status === 'paid') ? (
          <button
            type="button"
            onClick={() => void onUpdateStatus(order, 'ready_for_meetup')}
            disabled={isUpdating}
            className="rounded-full bg-white/8 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)] disabled:opacity-50"
          >
            Ready For Meetup
          </button>
        ) : null}

        {order.status !== 'completed' && order.status !== 'cancelled' ? (
          <button
            type="button"
            onClick={() => void onUpdateStatus(order, 'completed')}
            disabled={isUpdating}
            className="rounded-full bg-emerald-300/18 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100 disabled:opacity-50"
          >
            Mark Completed
          </button>
        ) : null}

        {order.status !== 'cancelled' && order.status !== 'completed' ? (
          <button
            type="button"
            onClick={() => void onUpdateStatus(order, 'cancelled')}
            disabled={isUpdating}
            className="rounded-full bg-[var(--shop-red)]/16 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)] disabled:opacity-50"
          >
            Cancel Order
          </button>
        ) : null}
      </div>

      {order.paymentMethod === 'usdt' ? (
        <div className="mt-4 rounded-[20px] border border-[var(--shop-purple)]/20 bg-[var(--shop-purple)]/10 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">
            USDT Instructions
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--shop-muted)]">
            Ask the buyer to send the payment manually and include the order ID as their payment
            reference. After you verify it, mark the order as paid.
          </p>
          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[var(--shop-cream)]">
            Reference: {order.id}
          </p>
          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--shop-cream)]">
            Amount: {order.total} EUR worth of USDT
          </p>
          <p className="mt-2 text-xs text-[var(--shop-muted)]">
            Wallet address is not wired yet, so this stays as a manual coordination step.
          </p>
        </div>
      ) : null}
    </article>
  )
}

type OrderStatProps = {
  label: string
  value: string
}

function OrderStat({ label, value }: OrderStatProps) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/6 px-3 py-4 backdrop-blur">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[var(--shop-cream)]">
        {value}
      </p>
    </div>
  )
}

function formatMeetupLocation(value: string) {
  switch (value) {
    case 'origo_center':
      return 'Origo Center'
    case 'old_town':
      return 'Old Town'
    case 'akropole':
      return 'Akropole'
    default:
      return 'Not selected'
  }
}

function formatMeetupTime(value: string) {
  switch (value) {
    case 'today_evening':
      return 'Today Evening'
    case 'tomorrow_afternoon':
      return 'Tomorrow Afternoon'
    case 'this_weekend':
      return 'This Weekend'
    default:
      return 'Not selected'
  }
}

function getTelegramProfileUrl(handle: string) {
  const normalizedHandle = handle.trim().replace(/^@/, '')

  if (!normalizedHandle) {
    return null
  }

  return `https://t.me/${normalizedHandle}`
}

function buildOrderMessage(order: Order, mode: 'summary' | 'payment') {
  if (mode === 'payment') {
    return [
      `Order ${order.id}`,
      `Hi ${order.fullName}, your order is waiting for USDT payment confirmation.`,
      `Amount: ${order.total} EUR worth of USDT`,
      'Please send the payment manually and include your order ID as the reference.',
      `Reference: ${order.id}`,
      'Reply in Telegram once payment is sent so it can be confirmed.',
    ].join('\n')
  }

  const lines = [
    `Order ${order.id}`,
    `Buyer: ${order.fullName} (${order.telegramHandle || 'no handle'})`,
    `Status: ${order.status}`,
    `Fulfillment: ${order.fulfillmentType === 'delivery' ? 'Delivery' : 'Meetup'}`,
    `Payment: ${order.paymentMethod === 'usdt' ? 'USDT' : 'Meetup Cash'}`,
    `Items: ${order.items.map((item) => item.name).join(', ')}`,
    `Subtotal: ${order.subtotal} EUR`,
    `Promo: ${
      order.appliedPromo
        ? `${order.appliedPromo.code} (-${order.appliedPromo.discountAmount} EUR)`
        : 'No promo'
    }`,
    `Total: ${order.total} EUR`,
  ]

  if (order.fulfillmentType === 'delivery') {
    lines.push(`City: ${order.deliveryCity || 'Not provided'}`)
    lines.push(`Address: ${order.deliveryAddress || 'Not provided'}`)
    lines.push(`Delivery Notes: ${order.deliveryNotes || 'No delivery notes'}`)
  } else {
    lines.push(`Meetup Location: ${formatMeetupLocation(order.meetupLocation)}`)
    lines.push(`Meetup Time: ${formatMeetupTime(order.meetupTimeOption)}`)
    lines.push(`Meetup Notes: ${order.meetupNotes || 'No meetup notes'}`)
  }

  if (order.note) {
    lines.push(`Buyer Note: ${order.note}`)
  }

  if (order.cancelReason) {
    lines.push(`Cancel Reason: ${order.cancelReason}`)
  }

  return lines.join('\n')
}
