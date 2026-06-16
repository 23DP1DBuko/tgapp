import type { Order } from '../types/order'

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

export function getBuyerOrderStatusHint(order: Order) {
  switch (order.status) {
    case 'waiting_for_payment':
      return 'Payment still needs to be sent and confirmed.'
    case 'paid':
      return order.fulfillmentType === 'delivery'
        ? 'Payment is confirmed. Delivery follow-up comes next.'
        : 'Payment is confirmed. Meetup timing will follow in Telegram chat.'
    case 'ready_for_meetup':
      return 'Your piece is ready. Watch Telegram chat for the final meetup details.'
    case 'completed':
      return 'This order is finished.'
    case 'cancelled':
      return 'This order was cancelled.'
    default:
      return 'Your request was saved and is waiting for admin follow-up.'
  }
}

export function formatBuyerMeetupLocation(value: string) {
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

export function formatBuyerMeetupTime(value: string) {
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

export function getBuyerOrderProgressSteps(order: Order): BuyerOrderProgressStep[] {
  if (order.status === 'cancelled') {
    return [
      {
        key: 'new',
        label: 'Request',
        isComplete: true,
        isCurrent: false,
      },
      {
        key: 'cancelled',
        label: 'Cancelled',
        isComplete: true,
        isCurrent: true,
      },
    ]
  }

  const steps = [
    {
      key: 'new',
      label: 'Request',
      match: (status: Order['status']) => status === 'new',
      isReached: () => true,
    },
    {
      key: 'paid',
      label: order.paymentMethod === 'usdt' ? 'Payment' : 'Confirmed',
      match: (status: Order['status']) => status === 'waiting_for_payment' || status === 'paid',
      isReached: (status: Order['status']) =>
        status === 'waiting_for_payment' ||
        status === 'paid' ||
        status === 'ready_for_meetup' ||
        status === 'completed',
    },
    {
      key: 'fulfillment',
      label: order.fulfillmentType === 'delivery' ? 'Delivery' : 'Meetup',
      match: (status: Order['status']) => status === 'ready_for_meetup',
      isReached: (status: Order['status']) =>
        status === 'ready_for_meetup' || status === 'completed',
    },
    {
      key: 'completed',
      label: 'Done',
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

export function groupBuyerOrdersByRecency(orders: Order[]): BuyerOrderGroup[] {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfWeek = new Date(startOfToday)
  const dayOfWeek = startOfWeek.getDay()
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1

  startOfWeek.setDate(startOfWeek.getDate() - mondayOffset)

  const groups: BuyerOrderGroup[] = [
    { key: 'today', label: 'Today', orders: [] },
    { key: 'this_week', label: 'This Week', orders: [] },
    { key: 'earlier', label: 'Earlier', orders: [] },
    { key: 'pending', label: 'Pending Time', orders: [] },
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
