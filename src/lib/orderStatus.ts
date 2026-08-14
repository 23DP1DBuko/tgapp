import type { Order } from '../types/order'
import type { TranslateFn, TranslationKey } from './i18n/translations'

export type BuyerOrderProgressStep = {
  key: string
  label: string
  isComplete: boolean
  isCurrent: boolean
}

export type BuyerOrderFilter = 'all' | 'active' | 'completed' | 'cancelled'

export type BuyerOrderSummary = {
  activeCount: number
  completedCount: number
  cancelledCount: number
  paymentPendingCount: number
}

export type BuyerOrderGroup = {
  key: 'today' | 'this_week' | 'earlier' | 'pending'
  label: string
  orders: Order[]
}

export function formatOrderStatus(status: Order['status']) {
  switch (status) {
    case 'waiting_for_payment':
      return 'Waiting For Payment'
    case 'ready_for_meetup':
      return 'Ready For Meetup'
    case 'paid':
      return 'Paid'
    case 'completed':
      return 'Completed'
    case 'cancelled':
      return 'Cancelled'
    default:
      return 'New'
  }
}

/** Translation key for a status — used by buyer-facing components. */
export function getOrderStatusTranslationKey(
  status: Order['status'],
): TranslationKey {
  switch (status) {
    case 'waiting_for_payment':
      return 'status.waitingForPayment'
    case 'ready_for_meetup':
      return 'status.readyForMeetup'
    case 'paid':
      return 'status.paid'
    case 'completed':
      return 'status.completed'
    case 'cancelled':
      return 'status.cancelled'
    default:
      return 'status.new'
  }
}

export function getOrderStatusBadgeClassName(status: Order['status']) {
  switch (status) {
    case 'paid':
      return 'bg-[var(--shop-purple)]/18 text-[var(--shop-cream)]'
    case 'ready_for_meetup':
      return 'bg-white/10 text-[var(--shop-cream)]'
    case 'completed':
      return 'bg-emerald-300/18 text-emerald-100'
    case 'cancelled':
      return 'bg-[var(--shop-red)]/16 text-[var(--shop-cream)]'
    case 'waiting_for_payment':
      return 'bg-amber-300/18 text-amber-100'
    default:
      return 'bg-white/8 text-[var(--shop-cream)]'
  }
}

export function getBuyerOrderStatusHint(order: Order, t: TranslateFn) {
  switch (order.status) {
    case 'waiting_for_payment':
      return t('hint.waiting')
    case 'paid':
      return order.fulfillmentType === 'delivery'
        ? t('hint.paidDelivery')
        : t('hint.paidMeetup')
    case 'ready_for_meetup':
      return t('hint.ready')
    case 'completed':
      return t('hint.completed')
    case 'cancelled':
      return t('hint.cancelled')
    default:
      return t('hint.new')
  }
}

export function formatBuyerMeetupLocation(value: string, t: TranslateFn) {
  switch (value) {
    case 'origo_center':
      return t('loc.origoCenter')
    case 'old_town':
      return t('loc.oldTown')
    case 'akropole':
      return t('loc.akropole')
    default:
      // Custom locations are stored verbatim on the order doc.
      return value ? value : t('co.meetupNotSelected')
  }
}

export function formatBuyerMeetupTime(value: string, t: TranslateFn) {
  switch (value) {
    case 'today_evening':
      return t('time.todayEvening')
    case 'tomorrow_afternoon':
      return t('time.tomorrowAfternoon')
    case 'this_weekend':
      return t('time.thisWeekend')
    default:
      // Custom times are stored verbatim on the order doc.
      return value ? value : t('co.timeNotSelected')
  }
}

export function getBuyerOrderProgressSteps(
  order: Order,
  t: TranslateFn,
): BuyerOrderProgressStep[] {
  if (order.status === 'cancelled') {
    return [
      {
        key: 'new',
        label: t('prog.request'),
        isComplete: true,
        isCurrent: false,
      },
      {
        key: 'cancelled',
        label: t('prog.cancelled'),
        isComplete: true,
        isCurrent: true,
      },
    ]
  }

  const steps = [
    {
      key: 'new',
      label: t('prog.request'),
      match: (status: Order['status']) => status === 'new',
      isReached: () => true,
    },
    {
      key: 'paid',
      label: order.paymentMethod === 'usdt' ? t('prog.payment') : t('prog.confirmed'),
      match: (status: Order['status']) => status === 'waiting_for_payment' || status === 'paid',
      isReached: (status: Order['status']) =>
        status === 'waiting_for_payment' ||
        status === 'paid' ||
        status === 'ready_for_meetup' ||
        status === 'completed',
    },
    {
      key: 'fulfillment',
      label: order.fulfillmentType === 'delivery' ? t('prog.delivery') : t('prog.meetup'),
      match: (status: Order['status']) => status === 'ready_for_meetup',
      isReached: (status: Order['status']) =>
        status === 'ready_for_meetup' || status === 'completed',
    },
    {
      key: 'completed',
      label: t('prog.done'),
      match: (status: Order['status']) => status === 'completed',
      isReached: (status: Order['status']) => status === 'completed',
    },
  ]

  return steps.map((step) => ({
    key: step.key,
    label: step.label,
    isComplete: step.isReached(order.status),
    isCurrent: step.match(order.status),
  }))
}

export function doesOrderMatchBuyerFilter(
  order: Order,
  filter: BuyerOrderFilter,
) {
  switch (filter) {
    case 'active':
      return order.status !== 'completed' && order.status !== 'cancelled'
    case 'completed':
      return order.status === 'completed'
    case 'cancelled':
      return order.status === 'cancelled'
    default:
      return true
  }
}

export function summarizeBuyerOrders(orders: Order[]): BuyerOrderSummary {
  return orders.reduce<BuyerOrderSummary>(
    (summary, order) => {
      if (doesOrderMatchBuyerFilter(order, 'active')) {
        summary.activeCount += 1
      }

      if (order.status === 'completed') {
        summary.completedCount += 1
      }

      if (order.status === 'cancelled') {
        summary.cancelledCount += 1
      }

      if (order.status === 'waiting_for_payment') {
        summary.paymentPendingCount += 1
      }

      return summary
    },
    {
      activeCount: 0,
      completedCount: 0,
      cancelledCount: 0,
      paymentPendingCount: 0,
    },
  )
}

export function groupBuyerOrdersByRecency(
  orders: Order[],
  t: TranslateFn,
): BuyerOrderGroup[] {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfWeek = new Date(startOfToday)
  const dayOfWeek = startOfWeek.getDay()
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1

  startOfWeek.setDate(startOfWeek.getDate() - mondayOffset)

  const groups: BuyerOrderGroup[] = [
    { key: 'today', label: t('groups.today'), orders: [] },
    { key: 'this_week', label: t('groups.thisWeek'), orders: [] },
    { key: 'earlier', label: t('groups.earlier'), orders: [] },
    { key: 'pending', label: t('groups.pending'), orders: [] },
  ]

  orders.forEach((order) => {
    if (!order.createdAt) {
      groups[3].orders.push(order)
      return
    }

    if (order.createdAt >= startOfToday) {
      groups[0].orders.push(order)
      return
    }

    if (order.createdAt >= startOfWeek) {
      groups[1].orders.push(order)
      return
    }

    groups[2].orders.push(order)
  })

  return groups.filter((group) => group.orders.length > 0)
}
