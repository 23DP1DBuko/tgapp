import type { CreateOrderInput, Order } from '../../types/order'
import { withRetry, isTransientError } from '../retry'

const DEFAULT_ADMIN_UPDATE_ORDER_STATUS_URL = '/api/admin/updateOrderStatus'
const DEFAULT_CREATE_CHECKOUT_ORDER_URL = '/api/checkout/createOrder'
const DEFAULT_ADMIN_LIST_ORDERS_URL = '/api/admin/listOrders'
const DEFAULT_LIST_BUYER_ORDERS_URL = '/api/orders/listMine'

type ApiOrder = Omit<Order, 'createdAt'> & {
  telegramUserId: number | null
  createdAt: string | null
}

type ListOrdersResponse = {
  ok?: boolean
  orders?: ApiOrder[]
  reason?: string
  detail?: string
}

function toOrder(data: ApiOrder): Order {
  return {
    id: data.id,
    fullName: data.fullName,
    telegramHandle: data.telegramHandle,
    telegramUserId: data.telegramUserId ?? undefined,
    note: data.note,
    fulfillmentType: data.fulfillmentType === 'delivery' ? 'delivery' : 'meetup',
    paymentMethod: data.paymentMethod === 'usdt' ? 'usdt' : 'meetup_cash',
    deliveryCity: data.deliveryCity ?? '',
    deliveryAddress: data.deliveryAddress ?? '',
    deliveryNotes: data.deliveryNotes ?? '',
    meetupLocation: data.meetupLocation ?? '',
    meetupTimeOption: data.meetupTimeOption ?? '',
    meetupNotes: data.meetupNotes ?? '',
    items: Array.isArray(data.items) ? data.items : [],
    subtotal: typeof data.subtotal === 'number' ? data.subtotal : 0,
    appliedPromo: data.appliedPromo ?? null,
    total: typeof data.total === 'number' ? data.total : 0,
    status:
      data.status === 'waiting_for_payment'
        ? 'waiting_for_payment'
        : data.status === 'paid'
          ? 'paid'
          : data.status === 'ready_for_meetup'
            ? 'ready_for_meetup'
            : data.status === 'completed'
              ? 'completed'
              : data.status === 'cancelled'
                ? 'cancelled'
                : 'new',
    cancelReason: data.cancelReason ?? '',
    createdAt: data.createdAt ? new Date(data.createdAt) : null,
  }
}

/**
 * Structured checkout error that carries the backend `reason` code so the
 * client can map it to a localized, actionable message instead of showing
 * the raw English detail string.
 */
export class CreateOrderError extends Error {
  reason: string
  detail: string

  constructor(reason: string, detail = '') {
    super(`Failed to create order: ${reason}${detail ? ` (${detail})` : ''}.`)
    this.name = 'CreateOrderError'
    this.reason = reason
    this.detail = detail
  }
}

async function readErrorReason(response: Response): Promise<string> {
  let reason = `http_${response.status}`
  let detail = ''

  try {
    const result = (await response.json()) as { reason?: string; detail?: string }
    if (typeof result.reason === 'string') {
      reason = result.reason
    }
    if (typeof result.detail === 'string' && result.detail) {
      detail = result.detail
    }
  } catch {
    // Keep the HTTP fallback reason.
  }

  return `${reason}${detail ? ` (${detail})` : ''}`
}

export async function createOrder(input: CreateOrderInput): Promise<string> {
  return withRetry(async () => {
    const response = await fetch(
      import.meta.env.VITE_CREATE_CHECKOUT_ORDER_URL || DEFAULT_CREATE_CHECKOUT_ORDER_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          initData: input.initData,
          clientOrderId: input.clientOrderId,
          fullName: input.fullName,
          telegramHandle: input.telegramHandle,
          telegramUserId: input.telegramUserId ?? null,
          note: input.note,
          fulfillmentType: input.fulfillmentType,
          paymentMethod: input.paymentMethod,
          deliveryCity: input.deliveryCity,
          deliveryAddress: input.deliveryAddress,
          deliveryNotes: input.deliveryNotes,
          meetupLocation: input.meetupLocation,
          meetupTimeOption: input.meetupTimeOption,
          meetupNotes: input.meetupNotes,
          items: input.items,
          subtotal: input.subtotal,
          appliedPromo: input.appliedPromo
            ? {
                code: input.appliedPromo.code,
                discountType: input.appliedPromo.discountType,
                discountValue: input.appliedPromo.discountValue,
                discountAmount: input.appliedPromo.discountAmount,
              }
            : null,
          total: input.total,
          status: input.status,
          cancelReason: input.cancelReason,
        }),
      },
    )

    if (!response.ok) {
      let reason = `http_${response.status}`
      let detail = ''

      try {
        const result = (await response.json()) as { reason?: string; detail?: string }
        if (typeof result.reason === 'string') {
          reason = result.reason
        }
        if (typeof result.detail === 'string' && result.detail) {
          detail = result.detail
        }
      } catch {
        // Keep the HTTP fallback reason.
      }

      throw new CreateOrderError(reason, detail)
    }

    const result = (await response.json()) as { orderId?: string }

    if (!result.orderId) {
      throw new Error('Failed to create order: missing order ID from backend.')
    }

    return result.orderId
  }, { maxRetries: 2, shouldRetry: isTransientError })
}

export async function listOrders(initData: string): Promise<Order[]> {
  const response = await fetch(
    import.meta.env.VITE_ADMIN_LIST_ORDERS_URL || DEFAULT_ADMIN_LIST_ORDERS_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ initData }),
    },
  )

  if (!response.ok) {
    throw new Error(`Failed to load orders: ${await readErrorReason(response)}.`)
  }

  const result = (await response.json()) as ListOrdersResponse

  if (!result.ok || !Array.isArray(result.orders)) {
    throw new Error('Failed to load orders: invalid backend response.')
  }

  return result.orders.map(toOrder)
}

export async function listOrdersByTelegramUserId(
  initData: string,
): Promise<Order[]> {
  const response = await fetch(
    import.meta.env.VITE_LIST_BUYER_ORDERS_URL || DEFAULT_LIST_BUYER_ORDERS_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ initData }),
    },
  )

  if (!response.ok) {
    throw new Error(`Failed to load your orders: ${await readErrorReason(response)}.`)
  }

  const result = (await response.json()) as ListOrdersResponse

  if (!result.ok || !Array.isArray(result.orders)) {
    throw new Error('Failed to load your orders: invalid backend response.')
  }

  return result.orders.map(toOrder)
}

export async function updateOrderStatus(
  initData: string,
  orderId: string,
  status: Order['status'],
  cancelReason = '',
): Promise<void> {
  const response = await fetch(
    import.meta.env.VITE_ADMIN_UPDATE_ORDER_STATUS_URL || DEFAULT_ADMIN_UPDATE_ORDER_STATUS_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        initData,
        orderId,
        status,
        cancelReason,
      }),
    },
  )

  if (!response.ok) {
    let reason = `http_${response.status}`
    let detail = ''

    try {
      const result = (await response.json()) as { reason?: string; detail?: string }
      if (typeof result.reason === 'string') {
        reason = result.reason
      }
      if (typeof result.detail === 'string' && result.detail) {
        detail = result.detail
      }
    } catch {
      // Keep the HTTP fallback reason.
    }

    throw new Error(
      `Failed to update order status: ${reason}${detail ? ` (${detail})` : ''}.`,
    )
  }
}
