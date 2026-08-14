// ── Promo Codes Module ──
import { onRequest } from 'firebase-functions/v2/https'
import { getFirestore } from 'firebase-admin/firestore'
import {
  telegramBotToken,
  PROMO_DISCOUNT_TYPES,
  readAdminIdsFromEnv,
  verifyTelegramInitData,
  isValidPromoInput,
} from './helpers.js'
import { computePromoDiscount, type CheckoutAppliedPromo } from './orders.js'

export type PromoAdminInput = {
  code: string
  discountType: (typeof PROMO_DISCOUNT_TYPES)[number]
  discountValue: number
  isActive: boolean
  expiresAt: string | null
  usageLimit: number | null
  usageCount?: number | null
}

export type UpsertPromoCodeAdminRequest = {
  initData: string
  promoId?: string
  promo: PromoAdminInput
}

export type DeletePromoCodesAdminRequest = {
  initData: string
  promoIds: string[]
}

export type UploadProductImageAdminRequest = {
  initData: string
  fileName: string
  contentType: string
  base64Data: string
}

export type PromoAdminResponse = {
  ok: boolean
  promoId: string | null
  detail?: string
  reason:
    | 'saved'
    | 'deleted'
    | 'invalid_method'
    | 'invalid_payload'
    | 'invalid_init_data'
    | 'expired_init_data'
    | 'missing_bot_token'
    | 'forbidden'
    | 'internal_error'
}


export const upsertPromoCodeAdmin = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({
        ok: false,
        promoId: null,
        reason: 'invalid_method',
      } satisfies PromoAdminResponse)
      return
    }

    const botToken = telegramBotToken.value()

    if (!botToken) {
      response.status(500).json({
        ok: false,
        promoId: null,
        reason: 'missing_bot_token',
      } satisfies PromoAdminResponse)
      return
    }

    const body = request.body as Partial<UpsertPromoCodeAdminRequest> | undefined
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const promoId = typeof body?.promoId === 'string' ? body.promoId.trim() : ''
    const promo = body?.promo

    if (!isValidPromoInput(promo)) {
      response.status(400).json({
        ok: false,
        promoId: promoId || null,
        reason: 'invalid_payload',
      } satisfies PromoAdminResponse)
      return
    }

    const verificationResult = verifyTelegramInitData(initData, botToken)

    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
      response.status(401).json({
        ok: false,
        promoId: promoId || null,
        reason:
          verificationResult.reason === 'expired_init_data'
            ? 'expired_init_data'
            : 'invalid_init_data',
      } satisfies PromoAdminResponse)
      return
    }

    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
      response.status(403).json({
        ok: false,
        promoId: promoId || null,
        reason: 'forbidden',
      } satisfies PromoAdminResponse)
      return
    }

    try {
      const payload = {
        code: promo.code.trim().toUpperCase(),
        discountType: promo.discountType,
        discountValue: promo.discountValue,
        isActive: promo.isActive,
        expiresAt: promo.expiresAt ? new Date(promo.expiresAt) : null,
        usageLimit: promo.usageLimit,
        ...(typeof promo.usageCount === 'number' ? { usageCount: promo.usageCount } : {}),
      }

      if (promoId) {
        await getFirestore().collection('promoCodes').doc(promoId).set(payload, { merge: true })
      } else {
        const createdPromo = await getFirestore().collection('promoCodes').add(payload)
        response.status(200).json({
          ok: true,
          promoId: createdPromo.id,
          reason: 'saved',
        } satisfies PromoAdminResponse)
        return
      }

      response.status(200).json({
        ok: true,
        promoId,
        reason: 'saved',
      } satisfies PromoAdminResponse)
    } catch (error) {
      response.status(500).json({
        ok: false,
        promoId: promoId || null,
        reason: 'internal_error',
        detail: error instanceof Error ? error.message : 'Unknown backend error.',
      } satisfies PromoAdminResponse)
    }
  },
)

export const deletePromoCodesAdmin = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({
        ok: false,
        promoId: null,
        reason: 'invalid_method',
      } satisfies PromoAdminResponse)
      return
    }

    const botToken = telegramBotToken.value()

    if (!botToken) {
      response.status(500).json({
        ok: false,
        promoId: null,
        reason: 'missing_bot_token',
      } satisfies PromoAdminResponse)
      return
    }

    const body = request.body as Partial<DeletePromoCodesAdminRequest> | undefined
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const promoIds =
      body?.promoIds?.filter((promoId): promoId is string => typeof promoId === 'string' && promoId.trim().length > 0) ?? []

    if (promoIds.length === 0) {
      response.status(400).json({
        ok: false,
        promoId: null,
        reason: 'invalid_payload',
      } satisfies PromoAdminResponse)
      return
    }

    const verificationResult = verifyTelegramInitData(initData, botToken)

    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
      response.status(401).json({
        ok: false,
        promoId: null,
        reason:
          verificationResult.reason === 'expired_init_data'
            ? 'expired_init_data'
            : 'invalid_init_data',
      } satisfies PromoAdminResponse)
      return
    }

    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
      response.status(403).json({
        ok: false,
        promoId: null,
        reason: 'forbidden',
      } satisfies PromoAdminResponse)
      return
    }

    try {
      const batch = getFirestore().batch()

      promoIds.forEach((promoId) => {
        batch.delete(getFirestore().collection('promoCodes').doc(promoId))
      })

      await batch.commit()

      response.status(200).json({
        ok: true,
        promoId: promoIds[0] ?? null,
        reason: 'deleted',
      } satisfies PromoAdminResponse)
    } catch (error) {
      response.status(500).json({
        ok: false,
        promoId: promoIds[0] ?? null,
        reason: 'internal_error',
        detail: error instanceof Error ? error.message : 'Unknown backend error.',
      } satisfies PromoAdminResponse)
    }
  },
)

export type PromoApplyEvaluation =
  | { status: 'valid'; promo: CheckoutAppliedPromo }
  | {
      status:
        | 'promo_not_found'
        | 'promo_inactive'
        | 'promo_expired'
        | 'promo_exhausted'
        | 'promo_no_discount'
    }

/**
 * Pure buyer-facing promo evaluation used by the /api/promos/validate
 * endpoint. Mirrors the in-transaction checks in validateCheckoutPromo
 * (orders.ts) — inactive, expired, exhausted — and computes the exact
 * discount the checkout would apply, so the apply-preview can never
 * disagree with order creation.
 */
export function evaluatePromoCodeForApply(
  promo: {
    code?: string | null
    discountType?: string | null
    discountValue?: number | null
    isActive?: boolean | null
    expiresAt?: FirebaseFirestore.Timestamp | Date | null
    usageCount?: number | null
    usageLimit?: number | null
  } | undefined,
  subtotal: number,
  nowMs: number,
): PromoApplyEvaluation {
  if (!promo) {
    return { status: 'promo_not_found' }
  }

  if (promo.isActive !== true) {
    return { status: 'promo_inactive' }
  }

  const expiresMs = promo.expiresAt
    ? typeof promo.expiresAt === 'object' && 'toMillis' in promo.expiresAt
      ? promo.expiresAt.toMillis()
      : (promo.expiresAt as Date).getTime()
    : null

  if (expiresMs !== null && expiresMs <= nowMs) {
    return { status: 'promo_expired' }
  }

  const usageLimit = promo.usageLimit ?? null
  const usageCount = promo.usageCount ?? 0

  if (typeof usageLimit === 'number' && usageCount >= usageLimit) {
    return { status: 'promo_exhausted' }
  }

  const discountType = promo.discountType === 'fixed_amount' ? 'fixed_amount' : 'percentage'
  const discountValue = typeof promo.discountValue === 'number' ? promo.discountValue : 0
  const discountAmount = computePromoDiscount({ discountType, discountValue }, subtotal)

  if (discountAmount <= 0) {
    return { status: 'promo_no_discount' }
  }

  return {
    status: 'valid',
    promo: {
      code: typeof promo.code === 'string' ? promo.code : '',
      discountType,
      discountValue,
      discountAmount,
    },
  }
}

export type ValidatePromoCodeRequest = {
  initData: string
  code: string
  subtotal: number
}

export type ValidatePromoCodeResponse = {
  ok: boolean
  promo: CheckoutAppliedPromo | null
  detail?: string
  reason:
    | 'valid'
    | 'invalid_method'
    | 'invalid_payload'
    | 'promo_not_found'
    | 'promo_inactive'
    | 'promo_expired'
    | 'promo_exhausted'
    | 'promo_no_discount'
    | 'invalid_init_data'
    | 'expired_init_data'
    | 'missing_bot_token'
    | 'internal_error'
}

export const validatePromoCode = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({
        ok: false,
        promo: null,
        reason: 'invalid_method',
      } satisfies ValidatePromoCodeResponse)
      return
    }

    const botToken = telegramBotToken.value()

    if (!botToken) {
      response.status(500).json({
        ok: false,
        promo: null,
        reason: 'missing_bot_token',
      } satisfies ValidatePromoCodeResponse)
      return
    }

    const body = request.body as Partial<ValidatePromoCodeRequest> | undefined
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : ''
    const subtotal = body?.subtotal

    if (
      !code ||
      typeof subtotal !== 'number' ||
      !Number.isFinite(subtotal) ||
      subtotal < 0
    ) {
      response.status(400).json({
        ok: false,
        promo: null,
        reason: 'invalid_payload',
      } satisfies ValidatePromoCodeResponse)
      return
    }

    const verificationResult = verifyTelegramInitData(initData, botToken)

    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
      response.status(401).json({
        ok: false,
        promo: null,
        reason:
          verificationResult.reason === 'expired_init_data'
            ? 'expired_init_data'
            : 'invalid_init_data',
      } satisfies ValidatePromoCodeResponse)
      return
    }

    try {
      const promoSnapshot = await getFirestore()
        .collection('promoCodes')
        .where('code', '==', code)
        .limit(1)
        .get()

      const evaluation = evaluatePromoCodeForApply(
        promoSnapshot.docs[0]?.data(),
        subtotal,
        Date.now(),
      )

      if (evaluation.status !== 'valid') {
        response.status(evaluation.status === 'promo_not_found' ? 404 : 409).json({
          ok: false,
          promo: null,
          reason: evaluation.status,
        } satisfies ValidatePromoCodeResponse)
        return
      }

      response.status(200).json({
        ok: true,
        promo: evaluation.promo,
        reason: 'valid',
      } satisfies ValidatePromoCodeResponse)
    } catch (error) {
      response.status(500).json({
        ok: false,
        promo: null,
        reason: 'internal_error',
        detail: error instanceof Error ? error.message : 'Unknown backend error.',
      } satisfies ValidatePromoCodeResponse)
    }
  },
)

export type PromoAdminListItem = {
  id: string
  code: string
  discountType: (typeof PROMO_DISCOUNT_TYPES)[number]
  discountValue: number
  isActive: boolean
  expiresAt: string | null
  usageLimit: number | null
  usageCount: number
}

export type ListPromoCodesAdminResponse = {
  ok: boolean
  promos: PromoAdminListItem[]
  detail?: string
  reason:
    | 'listed'
    | 'invalid_method'
    | 'invalid_init_data'
    | 'expired_init_data'
    | 'missing_bot_token'
    | 'forbidden'
    | 'internal_error'
}

export const listPromoCodesAdmin = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({
        ok: false,
        promos: [],
        reason: 'invalid_method',
      } satisfies ListPromoCodesAdminResponse)
      return
    }

    const botToken = telegramBotToken.value()

    if (!botToken) {
      response.status(500).json({
        ok: false,
        promos: [],
        reason: 'missing_bot_token',
      } satisfies ListPromoCodesAdminResponse)
      return
    }

    const body = request.body as Partial<{ initData: string }> | undefined
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const verificationResult = verifyTelegramInitData(initData, botToken)

    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
      response.status(401).json({
        ok: false,
        promos: [],
        reason:
          verificationResult.reason === 'expired_init_data'
            ? 'expired_init_data'
            : 'invalid_init_data',
      } satisfies ListPromoCodesAdminResponse)
      return
    }

    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
      response.status(403).json({
        ok: false,
        promos: [],
        reason: 'forbidden',
      } satisfies ListPromoCodesAdminResponse)
      return
    }

    try {
      const snapshot = await getFirestore().collection('promoCodes').get()

      const promos: PromoAdminListItem[] = snapshot.docs.map((documentSnapshot) => {
        const data = documentSnapshot.data()
        const expiresAt = data.expiresAt

        return {
          id: documentSnapshot.id,
          code: typeof data.code === 'string' ? data.code : '',
          discountType: PROMO_DISCOUNT_TYPES.includes(data.discountType)
            ? data.discountType
            : 'percentage',
          discountValue: typeof data.discountValue === 'number' ? data.discountValue : 0,
          isActive: data.isActive === true,
          expiresAt:
            expiresAt instanceof Date
              ? expiresAt.toISOString()
              : expiresAt && typeof expiresAt.toDate === 'function'
                ? expiresAt.toDate().toISOString()
                : null,
          usageLimit: typeof data.usageLimit === 'number' ? data.usageLimit : null,
          usageCount: typeof data.usageCount === 'number' ? data.usageCount : 0,
        }
      })

      response.status(200).json({
        ok: true,
        promos,
        reason: 'listed',
      } satisfies ListPromoCodesAdminResponse)
    } catch (error) {
      response.status(500).json({
        ok: false,
        promos: [],
        reason: 'internal_error',
        detail: error instanceof Error ? error.message : 'Unknown backend error.',
      } satisfies ListPromoCodesAdminResponse)
    }
  },
)


