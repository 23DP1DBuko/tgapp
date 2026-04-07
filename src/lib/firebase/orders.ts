import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  doc,
  type QueryDocumentSnapshot,
  type Timestamp,
} from 'firebase/firestore'

import { getFirestoreDb } from './firestore'
import type { CreateOrderInput, Order } from '../../types/order'

type OrderDocument = {
  fullName: string
  telegramHandle: string
  telegramUserId?: number | null
  note: string
  fulfillmentType: Order['fulfillmentType']
  paymentMethod: Order['paymentMethod']
  deliveryCity: Order['deliveryCity']
  deliveryAddress: Order['deliveryAddress']
  deliveryNotes: Order['deliveryNotes']
  meetupLocation: Order['meetupLocation']
  meetupTimeOption: Order['meetupTimeOption']
  meetupNotes: Order['meetupNotes']
  items: Order['items']
  subtotal: number
  appliedPromo: Order['appliedPromo']
  total: number
  status: Order['status']
  cancelReason: string
  createdAt?: Timestamp | null
}

function toOrder(snapshot: QueryDocumentSnapshot<OrderDocument>): Order {
  const data = snapshot.data()

  return {
    id: snapshot.id,
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
    createdAt: data.createdAt ? data.createdAt.toDate() : null,
  }
}

export async function createOrder(input: CreateOrderInput): Promise<string> {
  const db = getFirestoreDb()

  if (!db) {
    throw new Error('Firebase is not configured yet.')
  }

  const orderRef = await addDoc(collection(db, 'orders'), {
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
    createdAt: serverTimestamp(),
  })

  return orderRef.id
}

export async function listOrders(): Promise<Order[]> {
  const db = getFirestoreDb()

  if (!db) {
    return []
  }

  const ordersQuery = query(
    collection(db, 'orders'),
    orderBy('createdAt', 'desc'),
    limit(20),
  )

  const snapshot = await getDocs(ordersQuery)

  return snapshot.docs.map((item) => toOrder(item as QueryDocumentSnapshot<OrderDocument>))
}

export async function updateOrderStatus(
  orderId: string,
  status: Order['status'],
  cancelReason = '',
): Promise<void> {
  const db = getFirestoreDb()

  if (!db) {
    throw new Error('Firebase is not configured yet.')
  }

  await updateDoc(doc(db, 'orders', orderId), {
    status,
    cancelReason,
  })
}
