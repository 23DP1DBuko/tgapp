import {
  formatBuyerMeetupLocation,
  formatBuyerMeetupTime,
  getOrderStatusTranslationKey,
  getBuyerOrderProgressSteps,
  getBuyerOrderStatusHint,
  getOrderStatusBadgeClassName,
} from '../../lib/orderStatus'
import { useI18n } from '../../lib/i18n'
import { formatDateTime } from '../../lib/i18n/locale'
import type { Order } from '../../types/order'

type BuyerOrderDrawerProps = {
  order: Order
  onClose: () => void
}

import { useEffect, useState } from 'react'

export function BuyerOrderDrawer({ order, onClose }: BuyerOrderDrawerProps) {
  const { t, language } = useI18n()
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
        aria-label={t('od.closeAria')}
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
              {t('od.title')}
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--shop-cream)]">
              {order.items.map((item) => item.name).join(', ')}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full border border-white/10 bg-white/8 px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]"
          >
            {t('od.close')}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${getOrderStatusBadgeClassName(order.status)}`}
          >
            {t(getOrderStatusTranslationKey(order.status))}
          </span>
          <span className="rounded-full bg-white/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
            {order.fulfillmentType === 'delivery' ? t('co.delivery') : t('co.meetup')}
          </span>
          <span className="rounded-full bg-white/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
            {order.paymentMethod === 'usdt' ? t('co.usdt') : t('co.meetupCash')}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-[20px] border border-white/10 bg-white/6 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)]">
              {t('od.total')}
            </p>
            <p className="mt-2 text-lg font-semibold text-[var(--shop-cream)]">
              {order.total} EUR
            </p>
          </div>
          <div className="rounded-[20px] border border-white/10 bg-white/6 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)]">
              {t('od.created')}
            </p>
            <p className="mt-2 text-sm font-semibold text-[var(--shop-cream)]">
              {order.createdAt ? formatDateTime(language, order.createdAt) : t('od.pendingTimestamp')}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-[24px] border border-white/10 bg-white/6 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">
            {t('od.progress')}
          </p>
          <div className="mt-4 grid grid-cols-4 gap-3">
            {getBuyerOrderProgressSteps(order, t).map((step) => (
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
            {t('od.statusNote')}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--shop-cream)]">
            {getBuyerOrderStatusHint(order, t)}
          </p>
        </div>

        <div className="mt-4 rounded-[24px] border border-white/10 bg-white/6 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">
            {t('od.orderSnapshot')}
          </p>
          <div className="mt-3 space-y-2 text-sm text-[var(--shop-muted)]">
            <p>
              <span className="font-semibold text-[var(--shop-cream)]">{t('od.orderId')}</span>{' '}
              {order.id}
            </p>
            <p>
              <span className="font-semibold text-[var(--shop-cream)]">{t('od.buyer')}</span>{' '}
              {order.fullName}
            </p>
            <p>
              <span className="font-semibold text-[var(--shop-cream)]">{t('od.telegram')}</span>{' '}
              {order.telegramHandle}
            </p>
            <p>
              <span className="font-semibold text-[var(--shop-cream)]">{t('od.subtotal')}</span>{' '}
              {order.subtotal} EUR
            </p>
            <p>
              <span className="font-semibold text-[var(--shop-cream)]">{t('od.promo')}</span>{' '}
              {order.appliedPromo
                ? `${order.appliedPromo.code} (-${order.appliedPromo.discountAmount} EUR)`
                : t('od.noPromo')}
            </p>
            {order.note ? (
              <p>
                <span className="font-semibold text-[var(--shop-cream)]">{t('od.buyerNote')}</span>{' '}
                {order.note}
              </p>
            ) : null}
            {order.cancelReason ? (
              <p>
                <span className="font-semibold text-[var(--shop-cream)]">{t('od.cancelReason')}</span>{' '}
                {order.cancelReason}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 rounded-[24px] border border-white/10 bg-white/6 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">
            {t('od.fulfillmentDetail')}
          </p>
          <div className="mt-3 space-y-2 text-sm text-[var(--shop-muted)]">
            {order.fulfillmentType === 'delivery' ? (
              <>
                <p>
                  <span className="font-semibold text-[var(--shop-cream)]">{t('od.city')}</span>{' '}
                  {order.deliveryCity || t('od.notProvided')}
                </p>
                <p>
                  <span className="font-semibold text-[var(--shop-cream)]">{t('od.address')}</span>{' '}
                  {order.deliveryAddress || t('od.notProvided')}
                </p>
                <p>
                  <span className="font-semibold text-[var(--shop-cream)]">
                    {t('od.deliveryNotes')}
                  </span>{' '}
                  {order.deliveryNotes || t('od.noDeliveryNotes')}
                </p>
              </>
            ) : (
              <>
                <p>
                  <span className="font-semibold text-[var(--shop-cream)]">
                    {t('od.meetupLocation')}
                  </span>{' '}
                  {formatBuyerMeetupLocation(order.meetupLocation, t)}
                </p>
                <p>
                  <span className="font-semibold text-[var(--shop-cream)]">{t('od.meetupTime')}</span>{' '}
                  {formatBuyerMeetupTime(order.meetupTimeOption, t)}
                </p>
                <p>
                  <span className="font-semibold text-[var(--shop-cream)]">{t('od.meetupNotes')}</span>{' '}
                  {order.meetupNotes || t('od.noMeetupNotes')}
                </p>
              </>
            )}
          </div>
        </div>
      </article>
    </div>
  )
}
