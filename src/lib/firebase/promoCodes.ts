import { withRetry, isTransientError, fetchWithTimeout } from '../retry'
import type { AppliedPromo, PromoCode } from '../../types/promo'

const DEFAULT_ADMIN_UPSERT_PROMO_URL = '/api/admin/upsertPromoCode'
const DEFAULT_ADMIN_DELETE_PROMOS_URL = '/api/admin/deletePromoCodes'
const DEFAULT_ADMIN_LIST_PROMOS_URL = '/api/admin/listPromoCodes'
const DEFAULT_VALIDATE_PROMO_URL = '/api/promos/validate'

export type ApplyPromoRejectionReason =
  | 'promo_not_found'
  | 'promo_inactive'
  | 'promo_expired'
  | 'promo_exhausted'
  | 'promo_no_discount'

export type ApplyPromoResult =
  | { ok: true; promo: AppliedPromo }
  | { ok: false; reason: ApplyPromoRejectionReason }

/**
 * Validates a promo code through the server endpoint (/api/promos/validate).
 * The promoCodes collection is no longer readable from the client (L9), so
 * both the apply-preview and the checkout submit are backed by Cloud
 * Functions. Expected rejections return { ok: false, reason }; transport or
 * unexpected server failures throw.
 */
export async function applyPromoCode(
  initData: string,
  rawCode: string,
  subtotal: number,
): Promise<ApplyPromoResult> {
  const normalizedCode = rawCode.trim().toUpperCase()

  if (!normalizedCode) {
    return { ok: false, reason: 'promo_not_found' }
  }

  const response = await fetchWithTimeout(
    import.meta.env.VITE_VALIDATE_PROMO_URL || DEFAULT_VALIDATE_PROMO_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ initData, code: normalizedCode, subtotal }),
    },
  )

  const result = (await response.json().catch(() => null)) as
    | { ok?: boolean; promo?: AppliedPromo; reason?: string }
    | null

  if (response.ok && result?.ok && result.promo) {
    return { ok: true, promo: result.promo }
  }

  const reason = result?.reason
  if (
    reason === 'promo_not_found' ||
    reason === 'promo_inactive' ||
    reason === 'promo_expired' ||
    reason === 'promo_exhausted' ||
    reason === 'promo_no_discount'
  ) {
    return { ok: false, reason }
  }

  throw new Error(`${reason ?? `http_${response.status}`}`)
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

type PromoAdminListItem = {
  id: string
  code: string
  discountType: PromoCode['discountType']
  discountValue: number
  isActive: boolean
  expiresAt: string | null
  usageLimit: number | null
  usageCount: number
}

/**
 * Lists promo codes for the admin panel via the admin-only endpoint
 * (/api/admin/listPromoCodes). The collection is not client-readable (L9).
 */
export async function listPromoCodes(initData: string): Promise<PromoCode[]> {
  const response = await fetchWithTimeout(
    import.meta.env.VITE_ADMIN_LIST_PROMOS_URL || DEFAULT_ADMIN_LIST_PROMOS_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ initData }),
    },
  )

  if (!response.ok) {
    throw new Error(`${await readErrorReason(response)}`)
  }

  const result = (await response.json()) as { promos?: PromoAdminListItem[] }

  return (result.promos ?? []).map((promo) => ({
    id: promo.id,
    code: promo.code,
    discountType: promo.discountType,
    discountValue: promo.discountValue,
    isActive: promo.isActive,
    expiresAt: promo.expiresAt ? new Date(promo.expiresAt) : null,
    usageLimit: promo.usageLimit,
    usageCount: promo.usageCount,
  }))
}

/**
 * Pure discount math shared by promo application and checkout submission.
 * Mirrors the server-side `computePromoDiscount` in functions/src/orders.ts
 * exactly (same rounding), so a legit checkout always matches what the server
 * recomputes from the promo document.
 */
export function computePromoDiscountAmount(
  promo: Pick<AppliedPromo, 'discountType' | 'discountValue'>,
  subtotal: number,
): number {
  if (!Number.isFinite(subtotal) || subtotal <= 0) return 0

  const rawDiscount =
    promo.discountType === 'percentage'
      ? Number(((subtotal * promo.discountValue) / 100).toFixed(2))
      : promo.discountValue

  return Math.min(subtotal, Math.max(0, rawDiscount))
}
