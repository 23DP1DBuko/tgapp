import {
  formatBuyerMeetupLocation,
  formatBuyerMeetupTime,
  formatOrderStatus,
  getBuyerOrderProgressSteps,
  getBuyerOrderStatusHint,
  getOrderStatusBadgeClassName,
} from '../../lib/orderStatus'
import type { Order } from '../../types/order'

type BuyerOrderDrawerProps = {
  order: Order
  onClose: () => void
}

import { useEffect, useState } from 'react'

export function BuyerOrderDrawer({ order, onClose }: BuyerOrderDrawerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  // Trigger open animation on mount
  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsOpen(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  function handleClose() {
    setIsClosing(true)
    setTimeout(() => {
      onClose()
    }, 300)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end p-4">
      {/* Backdrop */}
      <button
        type="button"
        onClick={handleClose}
        className={`absolute inset-0 cursor-default transition-opacity duration-300 ease-out ${
          isOpen && !isClosing ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}
        aria-label="Close order detail"
      />
      {/* Sheet panel */}
      <article
        className={`relative max-h-[85vh] w-full overflow-y-auto rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(35,16,37,0.98),rgba(18,10,24,0.98))] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.42)] transition-transform duration-300 ease-out ${
          isOpen && !isClosing ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
              Order Detail
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--shop-cream)]">
              {order.items.map((item) => item.name).join(', ')}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full border border-white/10 bg-white/8 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]"
          >
            Close
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${getOrderStatusBadgeClassName(order.status)}`}
          >
            {formatOrderStatus(order.status)}
          </span>
          <span className="rounded-full bg-white/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
            {order.fulfillmentType === 'delivery' ? 'Delivery' : 'Meetup'}
          </span>
          <span className="rounded-full bg-white/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
            {order.paymentMethod === 'usdt' ? 'USDT' : 'Meetup Cash'}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-[20px] border border-white/10 bg-white/6 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)]">
              Total
            </p>
            <p className="mt-2 text-lg font-semibold text-[var(--shop-cream)]">
              {order.total} EUR
            </p>
          </div>
          <div className="rounded-[20px] border border-white/10 bg-white/6 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)]">
              Created
            </p>
            <p className="mt-2 text-sm font-semibold text-[var(--shop-cream)]">
              {order.createdAt ? order.createdAt.toLocaleString() : 'Pending server timestamp'}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-[24px] border border-white/10 bg-white/6 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">
            Progress
          </p>
          <div className="mt-4 grid grid-cols-4 gap-3">
            {getBuyerOrderProgressSteps(order).map((step) => (
              <div key={step.key} className="space-y-2">
                <div
                  className={`h-1.5 rounded-full ${
                    step.isComplete
                      ? step.isCurrent
                        ? 'bg-[var(--shop-red)]'
                        : 'bg-[var(--shop-cream)]'
                      : 'bg-white/10'
                  }`}
                />
                <p
                  className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${
                    step.isComplete ? 'text-[var(--shop-cream)]' : 'text-[var(--shop-muted)]'
                  }`}
                >
                  {step.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-[24px] border border-white/10 bg-white/6 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">
            Status Note
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--shop-cream)]">
            {getBuyerOrderStatusHint(order)}
          </p>
        </div>

        <div className="mt-4 rounded-[24px] border border-white/10 bg-white/6 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">
            Order Snapshot
          </p>
          <div className="mt-3 space-y-2 text-sm text-[var(--shop-muted)]">
            <p>
              <span className="font-semibold text-[var(--shop-cream)]">Order ID:</span>{' '}
              {order.id}
            </p>
            <p>
              <span className="font-semibold text-[var(--shop-cream)]">Buyer:</span>{' '}
              {order.fullName}
            </p>
            <p>
              <span className="font-semibold text-[var(--shop-cream)]">Telegram:</span>{' '}
              {order.telegramHandle}
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
            {order.note ? (
              <p>
                <span className="font-semibold text-[var(--shop-cream)]">Buyer Note:</span>{' '}
                {order.note}
              </p>
            ) : null}
            {order.cancelReason ? (
              <p>
                <span className="font-semibold text-[var(--shop-cream)]">Cancel Reason:</span>{' '}
                {order.cancelReason}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 rounded-[24px] border border-white/10 bg-white/6 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">
            Fulfillment Detail
          </p>
          <div className="mt-3 space-y-2 text-sm text-[var(--shop-muted)]">
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
                  <span className="font-semibold text-[var(--shop-cream)]">
                    Delivery Notes:
                  </span>{' '}
                  {order.deliveryNotes || 'No delivery notes'}
                </p>
              </>
            ) : (
              <>
                <p>
                  <span className="font-semibold text-[var(--shop-cream)]">
                    Meetup Location:
                  </span>{' '}
                  {formatBuyerMeetupLocation(order.meetupLocation)}
                </p>
                <p>
                  <span className="font-semibold text-[var(--shop-cream)]">Meetup Time:</span>{' '}
                  {formatBuyerMeetupTime(order.meetupTimeOption)}
                </p>
                <p>
                  <span className="font-semibold text-[var(--shop-cream)]">Meetup Notes:</span>{' '}
                  {order.meetupNotes || 'No meetup notes'}
                </p>
              </>
            )}
          </div>
        </div>
      </article>
    </div>
  )
}
