import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  updateDoc,
  where,
  type QueryDocumentSnapshot,
  type Timestamp,
} from 'firebase/firestore'

import { getFirestoreDb } from './firestore'
import {
  PROMO_DISCOUNT_TYPES,
  type AppliedPromo,
  type PromoCode,
} from '../../types/promo'

type PromoCodeDocument = {
  code: string
  discountType: PromoCode['discountType']
  discountValue: number
  isActive: boolean
  expiresAt?: Timestamp | null
  usageLimit?: number | null
}

function toPromoCode(snapshot: QueryDocumentSnapshot<PromoCodeDocument>): PromoCode {
  const data = snapshot.data()

  return {
    id: snapshot.id,
    code: data.code,
    discountType: PROMO_DISCOUNT_TYPES.includes(data.discountType)
      ? data.discountType
      : 'percentage',
    discountValue: typeof data.discountValue === 'number' ? data.discountValue : 0,
    isActive: Boolean(data.isActive),
    expiresAt: data.expiresAt ? data.expiresAt.toDate() : null,
    usageLimit: typeof data.usageLimit === 'number' ? data.usageLimit : null,
  }
}

export async function getPromoCodeByCode(rawCode: string): Promise<PromoCode | null> {
  const db = getFirestoreDb()

  if (!db) {
    throw new Error('Firebase is not configured yet.')
  }

  const normalizedCode = rawCode.trim().toUpperCase()

  if (!normalizedCode) {
    return null
  }

  const promoQuery = query(
    collection(db, 'promoCodes'),
    where('code', '==', normalizedCode),
    limit(1),
  )

  const snapshot = await getDocs(promoQuery)
  const firstPromo = snapshot.docs[0]

  if (!firstPromo) {
    return null
  }

  return toPromoCode(firstPromo as QueryDocumentSnapshot<PromoCodeDocument>)
}

export async function listPromoCodes(): Promise<PromoCode[]> {
  const db = getFirestoreDb()

  if (!db) {
    return []
  }

  const snapshot = await getDocs(collection(db, 'promoCodes'))

  return snapshot.docs.map((item) =>
    toPromoCode(item as QueryDocumentSnapshot<PromoCodeDocument>),
  )
}

export type CreatePromoCodeInput = {
  code: string
  discountType: PromoCode['discountType']
  discountValue: number
  isActive: boolean
  expiresAt: Date | null
  usageLimit: number | null
}

export async function createPromoCode(input: CreatePromoCodeInput): Promise<void> {
  const db = getFirestoreDb()

  if (!db) {
    throw new Error('Firebase is not configured yet.')
  }

  await addDoc(collection(db, 'promoCodes'), {
    code: input.code.trim().toUpperCase(),
    discountType: input.discountType,
    discountValue: input.discountValue,
    isActive: input.isActive,
    expiresAt: input.expiresAt ?? null,
    usageLimit: input.usageLimit,
  })
}

export async function updatePromoCode(
  promoId: string,
  input: CreatePromoCodeInput,
): Promise<void> {
  const db = getFirestoreDb()

  if (!db) {
    throw new Error('Firebase is not configured yet.')
  }

  await updateDoc(doc(db, 'promoCodes', promoId), {
    code: input.code.trim().toUpperCase(),
    discountType: input.discountType,
    discountValue: input.discountValue,
    isActive: input.isActive,
    expiresAt: input.expiresAt ?? null,
    usageLimit: input.usageLimit,
  })
}

export async function deletePromoCode(promoId: string): Promise<void> {
  const db = getFirestoreDb()

  if (!db) {
    throw new Error('Firebase is not configured yet.')
  }

  await deleteDoc(doc(db, 'promoCodes', promoId))
}

export async function deleteInactivePromoCodes(promoCodes: PromoCode[]): Promise<void> {
  const inactivePromos = promoCodes.filter((promo) => !promo.isActive)

  await Promise.all(inactivePromos.map((promo) => deletePromoCode(promo.id)))
}

export function validatePromoCode(
  promoCode: PromoCode,
  subtotal: number,
  now = new Date(),
): AppliedPromo {
  if (!promoCode.isActive) {
    throw new Error('This promo code is not active.')
  }

  if (promoCode.expiresAt && promoCode.expiresAt.getTime() < now.getTime()) {
    throw new Error('This promo code has expired.')
  }

  if (promoCode.usageLimit !== null && promoCode.usageLimit <= 0) {
    throw new Error('This promo code has no uses left.')
  }

  if (subtotal <= 0) {
    throw new Error('Add an item before applying a promo code.')
  }

  const discountAmount =
    promoCode.discountType === 'percentage'
      ? Math.min(subtotal, Number(((subtotal * promoCode.discountValue) / 100).toFixed(2)))
      : Math.min(subtotal, promoCode.discountValue)

  if (discountAmount <= 0) {
    throw new Error('This promo code does not reduce the order total.')
  }

  return {
    code: promoCode.code,
    discountType: promoCode.discountType,
    discountValue: promoCode.discountValue,
    discountAmount,
  }
}
