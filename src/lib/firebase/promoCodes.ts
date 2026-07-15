import {
  collection,
  getDocs,
  limit,
  query,
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
import { withRetry, isTransientError, fetchWithTimeout } from '../retry'

const DEFAULT_ADMIN_UPSERT_PROMO_URL = '/api/admin/upsertPromoCode'
const DEFAULT_ADMIN_DELETE_PROMOS_URL = '/api/admin/deletePromoCodes'

type PromoCodeDocument = {
  code: string
  discountType: PromoCode['discountType']
  discountValue: number
  isActive: boolean
  expiresAt?: Timestamp | null
  usageLimit?: number | null
  usageCount?: number
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
    usageCount: typeof data.usageCount === 'number' ? data.usageCount : undefined,
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

function toPromoAdminPayload(input: CreatePromoCodeInput) {
  return {
    code: input.code.trim().toUpperCase(),
    discountType: input.discountType,
    discountValue: input.discountValue,
    isActive: input.isActive,
    expiresAt: input.expiresAt ? input.expiresAt.toISOString() : null,
    usageLimit: input.usageLimit,
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
    // Keep HTTP fallback values.
  }

  return `${reason}${detail ? ` (${detail})` : ''}`
}

export async function createPromoCode(initData: string, input: CreatePromoCodeInput): Promise<void> {
  await withRetry(async () => {
    const response = await fetchWithTimeout(
      import.meta.env.VITE_ADMIN_UPSERT_PROMO_URL || DEFAULT_ADMIN_UPSERT_PROMO_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          initData,
          promo: toPromoAdminPayload(input),
        }),
      },
    )

    if (!response.ok) {
      throw new Error(`${await readErrorReason(response)}`)
    }
  }, { maxRetries: 1, shouldRetry: isTransientError })
}

export async function updatePromoCode(
  initData: string,
  promoId: string,
  input: CreatePromoCodeInput,
): Promise<void> {
  await withRetry(async () => {
    const response = await fetchWithTimeout(
      import.meta.env.VITE_ADMIN_UPSERT_PROMO_URL || DEFAULT_ADMIN_UPSERT_PROMO_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          initData,
          promoId,
          promo: toPromoAdminPayload(input),
        }),
      },
    )

    if (!response.ok) {
      throw new Error(`${await readErrorReason(response)}`)
    }
  }, { maxRetries: 1, shouldRetry: isTransientError })
}

export async function deletePromoCode(initData: string, promoId: string): Promise<void> {
  await withRetry(async () => {
    const response = await fetchWithTimeout(
      import.meta.env.VITE_ADMIN_DELETE_PROMOS_URL || DEFAULT_ADMIN_DELETE_PROMOS_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          initData,
          promoIds: [promoId],
        }),
      },
    )

    if (!response.ok) {
      throw new Error(`${await readErrorReason(response)}`)
    }
  }, { maxRetries: 1, shouldRetry: isTransientError })
}

export async function deleteInactivePromoCodes(
  initData: string,
  promoCodes: PromoCode[],
): Promise<void> {
  const inactivePromos = promoCodes.filter((promo) => !promo.isActive)

  if (inactivePromos.length === 0) {
    return
  }

  await withRetry(async () => {
    const response = await fetchWithTimeout(
      import.meta.env.VITE_ADMIN_DELETE_PROMOS_URL || DEFAULT_ADMIN_DELETE_PROMOS_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          initData,
          promoIds: inactivePromos.map((promo) => promo.id),
        }),
      },
    )

    if (!response.ok) {
      throw new Error(`${await readErrorReason(response)}`)
    }
  }, { maxRetries: 1, shouldRetry: isTransientError })
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

  if (promoCode.usageLimit !== null) {
    const currentUsage = promoCode.usageCount ?? 0

    if (currentUsage >= promoCode.usageLimit) {
      throw new Error('This promo code has no uses left.')
    }
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
