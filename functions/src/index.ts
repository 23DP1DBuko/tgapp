import crypto from 'node:crypto'

import { getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { onRequest } from 'firebase-functions/v2/https'
import { defineInt, defineSecret, defineString } from 'firebase-functions/params'

const DEFAULT_INIT_DATA_MAX_AGE_SECONDS = 60 * 60
const telegramBotToken = defineSecret('TELEGRAM_BOT_TOKEN')
const telegramAdminIds = defineString('TELEGRAM_ADMIN_IDS')
const telegramInitDataMaxAgeSeconds = defineInt('TELEGRAM_INIT_DATA_MAX_AGE_SECONDS')
const telegramMiniAppUrl = defineString('TELEGRAM_MINI_APP_URL')
const telegramWebhookSecret = defineSecret('TELEGRAM_WEBHOOK_SECRET')
const ORDER_STATUSES = [
  'new',
  'waiting_for_payment',
  'paid',
  'ready_for_meetup',
  'completed',
  'cancelled',
] as const
const PROMO_DISCOUNT_TYPES = ['percentage', 'fixed_amount'] as const
const PRODUCT_CATEGORIES = [
  'hoodies',
  'tshirts',
  'outerwear',
  'accessories',
  'other',
] as const

if (getApps().length === 0) {
  initializeApp()
}

export type VerifyTelegramAdminRequest = {
  initData: string
}

export type VerifyTelegramAdminResponse = {
  ok: boolean
  isAdmin: boolean
  telegramUserId: number | null
  reason:
    | 'verified_admin'
    | 'verified_non_admin'
    | 'invalid_init_data'
    | 'expired_init_data'
    | 'missing_bot_token'
    | 'invalid_method'
}

export type AdminOrderStatusUpdateRequest = {
  initData: string
  orderId: string
  status: (typeof ORDER_STATUSES)[number]
  cancelReason?: string
}

export type AdminOrderStatusUpdateResponse = {
  ok: boolean
  orderId: string | null
  status: (typeof ORDER_STATUSES)[number] | null
  detail?: string
  reason:
    | 'updated'
    | 'order_not_found'
    | 'invalid_method'
    | 'invalid_payload'
    | 'invalid_init_data'
    | 'expired_init_data'
    | 'missing_bot_token'
    | 'forbidden'
    | 'internal_error'
}

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

export type ProductAdminInput = {
  name: string
  description: string
  category: (typeof PRODUCT_CATEGORIES)[number]
  brandNames: string[]
  price: number
  isAvailable: boolean
  images: string[]
  isLimitedLabel?: string
}

export type UpsertProductAdminRequest = {
  initData: string
  productId?: string
  product: ProductAdminInput
}

export type DeleteProductsAdminRequest = {
  initData: string
  productIds: string[]
}

export type ProductAdminResponse = {
  ok: boolean
  productId: string | null
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

export type CheckoutCartItem = {
  productId: string
  name: string
  price: number
  currency: 'EUR'
  image: string | null
}

export type CheckoutAppliedPromo = {
  code: string
  discountType: (typeof PROMO_DISCOUNT_TYPES)[number]
  discountValue: number
  discountAmount: number
}

export type CreateCheckoutOrderRequest = {
  fullName: string
  telegramHandle: string
  telegramUserId?: number | null
  note: string
  fulfillmentType: 'delivery' | 'meetup'
  paymentMethod: 'meetup_cash' | 'usdt'
  deliveryCity: string
  deliveryAddress: string
  deliveryNotes: string
  meetupLocation: string
  meetupTimeOption: string
  meetupNotes: string
  items: CheckoutCartItem[]
  subtotal: number
  appliedPromo: CheckoutAppliedPromo | null
  total: number
  status: (typeof ORDER_STATUSES)[number]
  cancelReason: string
}

export type CreateCheckoutOrderResponse = {
  ok: boolean
  orderId: string | null
  detail?: string
  reason:
    | 'created'
    | 'invalid_method'
    | 'invalid_payload'
    | 'product_unavailable'
    | 'promo_exhausted'
    | 'internal_error'
}

export type ApiOrderItem = {
  productId: string
  name: string
  price: number
  currency: 'EUR'
  image: string | null
}

export type ApiAppliedPromo = {
  code: string
  discountType: (typeof PROMO_DISCOUNT_TYPES)[number]
  discountValue: number
  discountAmount: number
}

export type ApiOrder = {
  id: string
  fullName: string
  telegramHandle: string
  telegramUserId: number | null
  note: string
  fulfillmentType: 'delivery' | 'meetup'
  paymentMethod: 'meetup_cash' | 'usdt'
  deliveryCity: string
  deliveryAddress: string
  deliveryNotes: string
  meetupLocation: string
  meetupTimeOption: string
  meetupNotes: string
  items: ApiOrderItem[]
  subtotal: number
  appliedPromo: ApiAppliedPromo | null
  total: number
  status: (typeof ORDER_STATUSES)[number]
  cancelReason: string
  createdAt: string | null
}

export type ListOrdersRequest = {
  initData: string
}

export type ListOrdersResponse = {
  ok: boolean
  orders: ApiOrder[]
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

export type UpdateProductSignalRequest = {
  productId: string
  signal: 'likesCount' | 'cartCount'
  delta: 1 | -1
}

export type UpdateProductSignalResponse = {
  ok: boolean
  productId: string | null
  signal: 'likesCount' | 'cartCount' | null
  detail?: string
  reason:
    | 'updated'
    | 'invalid_method'
    | 'invalid_payload'
    | 'product_not_found'
    | 'internal_error'
}

export type UploadProductImageAdminRequest = {
  initData: string
  fileName: string
  contentType: string
  base64Data: string
}

export type UploadProductImageAdminResponse = {
  ok: boolean
  imageUrl: string | null
  storagePath: string | null
  detail?: string
  reason:
    | 'uploaded'
    | 'invalid_method'
    | 'invalid_payload'
    | 'invalid_init_data'
    | 'expired_init_data'
    | 'missing_bot_token'
    | 'forbidden'
    | 'internal_error'
}

export type DeleteProductImagesAdminRequest = {
  initData: string
  imageUrls: string[]
}

export type DeleteProductImagesAdminResponse = {
  ok: boolean
  deletedCount: number
  detail?: string
  reason:
    | 'deleted'
    | 'invalid_method'
    | 'invalid_payload'
    | 'invalid_init_data'
    | 'expired_init_data'
    | 'missing_bot_token'
    | 'forbidden'
    | 'internal_error'
}

export type UploadBannerImageAdminRequest = {
  initData: string
  fileName: string
  contentType: string
  base64Data: string
}

export type UploadBannerImageAdminResponse = {
  ok: boolean
  imageUrl: string | null
  storagePath: string | null
  detail?: string
  reason:
    | 'uploaded'
    | 'invalid_method'
    | 'invalid_payload'
    | 'invalid_init_data'
    | 'expired_init_data'
    | 'missing_bot_token'
    | 'forbidden'
    | 'internal_error'
}

export type AdminAnalyticsRequest = {
  initData: string
}

export type AdminAnalyticsResponse = {
  ok: boolean
  totalUsers: number
  itemsSold: number
  grossRevenueEur: number
  referralCount: number
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

// ── Campaign Admin Types ──

export type CampaignAdminInput = {
  tag: string
  headingPart1: string
  headingPart2: string
  subtitle: string
  isActive: boolean
  sortOrder: number
}

export type UpsertCampaignAdminRequest = {
  initData: string
  campaignId?: string
  campaign: CampaignAdminInput
}

// Reorder takes an ordered list of IDs (sortOrder = index)
export type ReorderCampaignsAdminRequest = {
  initData: string
  orderedIds: string[]
}

export type CampaignAdminResponse = {
  ok: boolean
  campaignId: string | null
  detail?: string
  reason:
    | 'saved'
    | 'deleted'
    | 'reordered'
    | 'invalid_method'
    | 'invalid_payload'
    | 'invalid_init_data'
    | 'expired_init_data'
    | 'missing_bot_token'
    | 'forbidden'
    | 'internal_error'
}

export type DeleteCampaignsAdminRequest = {
  initData: string
  campaignIds: string[]
}

// ── Task Admin Types ──

export type TaskAdminInput = {
  title: string
  rewardType: 'coupon' | 'ticket'
  rewardValue: string
  status: 'active' | 'inactive'
  sortOrder: number
}

export type UpsertTaskAdminRequest = {
  initData: string
  taskId?: string
  task: TaskAdminInput
}

export type TaskAdminResponse = {
  ok: boolean
  taskId: string | null
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

export type DeleteTasksAdminRequest = {
  initData: string
  taskIds: string[]
}

// ── Giveaway Admin Types ──

export type GiveawayAdminInput = {
  productId: string
  productName: string
  productImage: string
  totalTickets: number
  enteredCount: number
  endsAt: string | null
  isActive: boolean
  winnerUsername: string | null
}

export type UpsertGiveawayAdminRequest = {
  initData: string
  giveawayId?: string
  giveaway: GiveawayAdminInput
}

export type GiveawayAdminResponse = {
  ok: boolean
  giveawayId: string | null
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

export type DeleteGiveawaysAdminRequest = {
  initData: string
  giveawayIds: string[]
}

type TelegramInitDataUser = {
  id?: number
  [key: string]: unknown
}

type TelegramWebhookRequest = {
  message?: {
    chat?: {
      id?: number
      type?: string
    }
    from?: {
      id?: number
      username?: string
      first_name?: string
    }
    text?: string
  }
}

export const verifyTelegramAdmin = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
  },
  async (request, response) => {
  if (request.method !== 'POST') {
    response.status(405).json({
      ok: false,
      isAdmin: false,
      telegramUserId: null,
      reason: 'invalid_method',
    } satisfies VerifyTelegramAdminResponse)
    return
  }

  const botToken = telegramBotToken.value()

  if (!botToken) {
    response.status(500).json({
      ok: false,
      isAdmin: false,
      telegramUserId: null,
      reason: 'missing_bot_token',
    } satisfies VerifyTelegramAdminResponse)
    return
  }

  const body = request.body as Partial<VerifyTelegramAdminRequest> | undefined
  const initData = typeof body?.initData === 'string' ? body.initData : ''

  const verificationResult = verifyTelegramInitData(initData, botToken)

  if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
    const failureReason =
      verificationResult.reason === 'ok' ? 'invalid_init_data' : verificationResult.reason

    response.status(verificationResult.reason === 'expired_init_data' ? 401 : 400).json({
      ok: false,
      isAdmin: false,
      telegramUserId: null,
      reason: failureReason,
    } satisfies VerifyTelegramAdminResponse)
    return
  }

  const adminIds = readAdminIdsFromEnv()
  const isAdmin = adminIds.includes(verificationResult.user.id)

  response.status(200).json({
    ok: true,
    isAdmin,
    telegramUserId: verificationResult.user.id,
    reason: isAdmin ? 'verified_admin' : 'verified_non_admin',
  } satisfies VerifyTelegramAdminResponse)
})

export const telegramBotWebhook = onRequest(
  {
    cors: false,
    invoker: 'public',
    secrets: [telegramBotToken, telegramWebhookSecret],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).send('Method Not Allowed')
      return
    }

    const botToken = telegramBotToken.value()
    const webhookSecret = telegramWebhookSecret.value()

    if (!botToken || !webhookSecret) {
      response.status(500).send('Webhook is not configured.')
      return
    }

    const requestSecret = request.header('X-Telegram-Bot-Api-Secret-Token')

    if (requestSecret !== webhookSecret) {
      response.status(403).send('Forbidden')
      return
    }

    const body = request.body as TelegramWebhookRequest | undefined
    const messageText = body?.message?.text?.trim() ?? ''
    const chatId = body?.message?.chat?.id

    if (!chatId || !messageText) {
      response.status(200).json({ ok: true, ignored: true })
      return
    }

    if (isStartCommand(messageText)) {
      await upsertTelegramSubscriberFromUpdate(body)
      try {
        await sendTelegramStoreWelcomeMessage(
          botToken,
          chatId,
          body?.message?.from?.first_name,
        )
      } catch (error) {
        response.status(500).json({
          ok: false,
          reason: 'send_failed',
          detail: error instanceof Error ? error.message : 'Unknown webhook error.',
        })
        return
      }
    }

    if (isStoreCommand(messageText)) {
      try {
        await sendTelegramStoreShortcutMessage(botToken, chatId)
      } catch (error) {
        response.status(500).json({
          ok: false,
          reason: 'send_failed',
          detail: error instanceof Error ? error.message : 'Unknown webhook error.',
        })
        return
      }
    }

    if (isHelpCommand(messageText)) {
      try {
        await sendTelegramHelpMessage(botToken, chatId)
      } catch (error) {
        response.status(500).json({
          ok: false,
          reason: 'send_failed',
          detail: error instanceof Error ? error.message : 'Unknown webhook error.',
        })
        return
      }
    }

    response.status(200).json({ ok: true })
  },
)

export type BroadcastAdminRequest = {
  initData: string
  text: string
}

export type BroadcastAdminResponse = {
  ok: boolean
  sentCount: number
  failedCount: number
  broadcastId?: string
  detail?: string
  reason:
    | 'broadcast_sent'
    | 'invalid_method'
    | 'invalid_payload'
    | 'invalid_init_data'
    | 'expired_init_data'
    | 'missing_bot_token'
    | 'forbidden'
    | 'internal_error'
}

export const broadcastMessageAdmin = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({
        ok: false,
        sentCount: 0,
        failedCount: 0,
        reason: 'invalid_method',
      } satisfies BroadcastAdminResponse)
      return
    }

    const botToken = telegramBotToken.value()

    if (!botToken) {
      response.status(500).json({
        ok: false,
        sentCount: 0,
        failedCount: 0,
        reason: 'missing_bot_token',
      } satisfies BroadcastAdminResponse)
      return
    }

    const body = request.body as Partial<BroadcastAdminRequest> | undefined
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const text = typeof body?.text === 'string' ? body.text.trim() : ''

    if (!text || text.length > 2000) {
      response.status(400).json({
        ok: false,
        sentCount: 0,
        failedCount: 0,
        reason: 'invalid_payload',
      } satisfies BroadcastAdminResponse)
      return
    }

    const verificationResult = verifyTelegramInitData(initData, botToken)

    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
      response.status(401).json({
        ok: false,
        sentCount: 0,
        failedCount: 0,
        reason:
          verificationResult.reason === 'expired_init_data'
            ? 'expired_init_data'
            : 'invalid_init_data',
      } satisfies BroadcastAdminResponse)
      return
    }

    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
      response.status(403).json({
        ok: false,
        sentCount: 0,
        failedCount: 0,
        reason: 'forbidden',
      } satisfies BroadcastAdminResponse)
      return
    }

    try {
      const db = getFirestore()

      const snapshot = await db
        .collection('telegramSubscribers')
        .where('allowBroadcasts', '==', true)
        .get()

      let sentCount = 0
      let failedCount = 0

      for (const doc of snapshot.docs) {
        const data = doc.data()
        const chatId = typeof data.chatId === 'number' ? data.chatId : null

        if (!chatId) continue

        try {
          await sendTelegramBroadcastMessage(botToken, chatId, text)
          sentCount += 1
        } catch {
          failedCount += 1
        }
      }

      const createdBy =
        typeof verificationResult.user.id === 'number'
          ? verificationResult.user.id
          : null
      const reason = 'broadcast_sent'

      let broadcastId: string | null = null

      try {
        const broadcastRef = await db.collection('broadcasts').add({
          createdAt: FieldValue.serverTimestamp(),
          createdBy,
          sentCount,
          failedCount,
          reason,
          text,
        })

        broadcastId = broadcastRef.id
      } catch (error) {
        console.error('Failed to log broadcast to Firestore', error)
      }

      response.status(200).json({
        ok: true,
        sentCount,
        failedCount,
        broadcastId: broadcastId ?? undefined,
        reason,
      } satisfies BroadcastAdminResponse)
    } catch (error) {
      response.status(500).json({
        ok: false,
        sentCount: 0,
        failedCount: 0,
        reason: 'internal_error',
        detail: error instanceof Error ? error.message : 'Unknown backend error.',
      } satisfies BroadcastAdminResponse)
    }
  },
)

export const updateOrderStatusAdmin = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({
        ok: false,
        orderId: null,
        status: null,
        reason: 'invalid_method',
      } satisfies AdminOrderStatusUpdateResponse)
      return
    }

    const botToken = telegramBotToken.value()

    if (!botToken) {
      response.status(500).json({
        ok: false,
        orderId: null,
        status: null,
        reason: 'missing_bot_token',
      } satisfies AdminOrderStatusUpdateResponse)
      return
    }

    const body = request.body as Partial<AdminOrderStatusUpdateRequest> | undefined
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : ''
    const status = body?.status
    const cancelReason = typeof body?.cancelReason === 'string' ? body.cancelReason : ''

    if (
      !orderId ||
      !isOrderStatus(status) ||
      cancelReason.length > 500
    ) {
      response.status(400).json({
        ok: false,
        orderId: orderId || null,
        status: isOrderStatus(status) ? status : null,
        reason: 'invalid_payload',
      } satisfies AdminOrderStatusUpdateResponse)
      return
    }

    const verificationResult = verifyTelegramInitData(initData, botToken)

    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
      response.status(401).json({
        ok: false,
        orderId,
        status,
        reason:
          verificationResult.reason === 'expired_init_data'
            ? 'expired_init_data'
            : 'invalid_init_data',
      } satisfies AdminOrderStatusUpdateResponse)
      return
    }

    const adminIds = readAdminIdsFromEnv()

    if (!adminIds.includes(verificationResult.user.id)) {
      response.status(403).json({
        ok: false,
        orderId,
        status,
        reason: 'forbidden',
      } satisfies AdminOrderStatusUpdateResponse)
      return
    }

    try {
      const orderRef = getFirestore().collection('orders').doc(orderId)
      const orderSnapshot = await orderRef.get()

      if (!orderSnapshot.exists) {
        response.status(404).json({
          ok: false,
          orderId,
          status,
          reason: 'order_not_found',
        } satisfies AdminOrderStatusUpdateResponse)
        return
      }

      const orderData = orderSnapshot.data() as
        | {
            telegramUserId?: number | null
          }
        | undefined

      await orderRef.update({
        status,
        cancelReason,
      })

      if (orderData?.telegramUserId) {
        if (status === 'cancelled') {
          await sendTelegramOrderCancelledMessage(
            botToken,
            orderData.telegramUserId,
            orderId,
            cancelReason,
          )
        }

        if (status === 'paid') {
          await sendTelegramOrderPaidMessage(
            botToken,
            orderData.telegramUserId,
            orderId,
          )
        }

        if (status === 'ready_for_meetup') {
          await sendTelegramOrderReadyForMeetupMessage(
            botToken,
            orderData.telegramUserId,
            orderId,
          )
        }

        if (status === 'completed') {
          await sendTelegramOrderCompletedMessage(
            botToken,
            orderData.telegramUserId,
            orderId,
          )
        }
      }

      response.status(200).json({
        ok: true,
        orderId,
        status,
        reason: 'updated',
      } satisfies AdminOrderStatusUpdateResponse)
    } catch (error) {
      response.status(500).json({
        ok: false,
        orderId,
        status,
        reason: 'internal_error',
        detail: error instanceof Error ? error.message : 'Unknown backend error.',
      } satisfies AdminOrderStatusUpdateResponse)
    }
  },
)

export const listOrdersAdmin = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({
        ok: false,
        orders: [],
        reason: 'invalid_method',
      } satisfies ListOrdersResponse)
      return
    }

    const botToken = telegramBotToken.value()

    if (!botToken) {
      response.status(500).json({
        ok: false,
        orders: [],
        reason: 'missing_bot_token',
      } satisfies ListOrdersResponse)
      return
    }

    const body = request.body as Partial<ListOrdersRequest> | undefined
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const verificationResult = verifyTelegramInitData(initData, botToken)

    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
      response.status(401).json({
        ok: false,
        orders: [],
        reason:
          verificationResult.reason === 'expired_init_data'
            ? 'expired_init_data'
            : 'invalid_init_data',
      } satisfies ListOrdersResponse)
      return
    }

    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
      response.status(403).json({
        ok: false,
        orders: [],
        reason: 'forbidden',
      } satisfies ListOrdersResponse)
      return
    }

    try {
      const snapshot = await getFirestore()
        .collection('orders')
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get()

      response.status(200).json({
        ok: true,
        orders: snapshot.docs.map((documentSnapshot) => toApiOrder(documentSnapshot.id, documentSnapshot.data())),
        reason: 'listed',
      } satisfies ListOrdersResponse)
    } catch (error) {
      response.status(500).json({
        ok: false,
        orders: [],
        reason: 'internal_error',
        detail: error instanceof Error ? error.message : 'Unknown backend error.',
      } satisfies ListOrdersResponse)
    }
  },
)

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

export const upsertProductAdmin = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({
        ok: false,
        productId: null,
        reason: 'invalid_method',
      } satisfies ProductAdminResponse)
      return
    }

    const botToken = telegramBotToken.value()

    if (!botToken) {
      response.status(500).json({
        ok: false,
        productId: null,
        reason: 'missing_bot_token',
      } satisfies ProductAdminResponse)
      return
    }

    const body = request.body as Partial<UpsertProductAdminRequest> | undefined
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const productId = typeof body?.productId === 'string' ? body.productId.trim() : ''
    const product = body?.product

    if (!isValidProductInput(product)) {
      response.status(400).json({
        ok: false,
        productId: productId || null,
        reason: 'invalid_payload',
      } satisfies ProductAdminResponse)
      return
    }

    const verificationResult = verifyTelegramInitData(initData, botToken)

    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
      response.status(401).json({
        ok: false,
        productId: productId || null,
        reason:
          verificationResult.reason === 'expired_init_data'
            ? 'expired_init_data'
            : 'invalid_init_data',
      } satisfies ProductAdminResponse)
      return
    }

    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
      response.status(403).json({
        ok: false,
        productId: productId || null,
        reason: 'forbidden',
      } satisfies ProductAdminResponse)
      return
    }

    try {
      const payload = {
        name: product.name.trim(),
        description: product.description.trim(),
        category: product.category,
        brandNames: product.brandNames.map((brand) => brand.trim()).filter(Boolean),
        price: product.price,
        currency: 'EUR',
        isAvailable: product.isAvailable,
        images: product.images,
        isLimitedLabel: product.isLimitedLabel?.trim() || null,
      }

      if (productId) {
        await getFirestore().collection('products').doc(productId).set(payload, { merge: true })

        response.status(200).json({
          ok: true,
          productId,
          reason: 'saved',
        } satisfies ProductAdminResponse)
        return
      }

      const createdProduct = await getFirestore().collection('products').add({
        ...payload,
        likesCount: 0,
        cartCount: 0,
        createdAt: FieldValue.serverTimestamp(),
      })

      response.status(200).json({
        ok: true,
        productId: createdProduct.id,
        reason: 'saved',
      } satisfies ProductAdminResponse)
    } catch (error) {
      response.status(500).json({
        ok: false,
        productId: productId || null,
        reason: 'internal_error',
        detail: error instanceof Error ? error.message : 'Unknown backend error.',
      } satisfies ProductAdminResponse)
    }
  },
)

export const deleteProductsAdmin = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({
        ok: false,
        productId: null,
        reason: 'invalid_method',
      } satisfies ProductAdminResponse)
      return
    }

    const botToken = telegramBotToken.value()

    if (!botToken) {
      response.status(500).json({
        ok: false,
        productId: null,
        reason: 'missing_bot_token',
      } satisfies ProductAdminResponse)
      return
    }

    const body = request.body as Partial<DeleteProductsAdminRequest> | undefined
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const productIds =
      body?.productIds?.filter(
        (productId): productId is string =>
          typeof productId === 'string' && productId.trim().length > 0,
      ) ?? []

    if (productIds.length === 0) {
      response.status(400).json({
        ok: false,
        productId: null,
        reason: 'invalid_payload',
      } satisfies ProductAdminResponse)
      return
    }

    const verificationResult = verifyTelegramInitData(initData, botToken)

    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
      response.status(401).json({
        ok: false,
        productId: null,
        reason:
          verificationResult.reason === 'expired_init_data'
            ? 'expired_init_data'
            : 'invalid_init_data',
      } satisfies ProductAdminResponse)
      return
    }

    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
      response.status(403).json({
        ok: false,
        productId: null,
        reason: 'forbidden',
      } satisfies ProductAdminResponse)
      return
    }

    try {
      const batch = getFirestore().batch()

      productIds.forEach((productId) => {
        batch.delete(getFirestore().collection('products').doc(productId))
      })

      await batch.commit()

      response.status(200).json({
        ok: true,
        productId: productIds[0] ?? null,
        reason: 'deleted',
      } satisfies ProductAdminResponse)
    } catch (error) {
      response.status(500).json({
        ok: false,
        productId: productIds[0] ?? null,
        reason: 'internal_error',
        detail: error instanceof Error ? error.message : 'Unknown backend error.',
      } satisfies ProductAdminResponse)
    }
  },
)

export const createCheckoutOrder = onRequest(
  {
    cors: true,
    invoker: 'public',
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({
        ok: false,
        orderId: null,
        reason: 'invalid_method',
      } satisfies CreateCheckoutOrderResponse)
      return
    }

    const body = request.body as Partial<CreateCheckoutOrderRequest> | undefined

    if (!isValidCheckoutOrderPayload(body)) {
      response.status(400).json({
        ok: false,
        orderId: null,
        reason: 'invalid_payload',
      } satisfies CreateCheckoutOrderResponse)
      return
    }

    try {
      const db = getFirestore()
      const productIds = body.items.map((item) => item.productId)
      const orderRef = db.collection('orders').doc()

      // Look up the promo code document reference if a promo was applied
      const promoCode = body.appliedPromo?.code ?? ''
      let promoDocRef: FirebaseFirestore.DocumentReference | null = null

      if (promoCode) {
        const promoSnapshot = await db
          .collection('promoCodes')
          .where('code', '==', promoCode)
          .limit(1)
          .get()

        if (!promoSnapshot.empty) {
          promoDocRef = promoSnapshot.docs[0].ref
        }
      }

      await db.runTransaction(async (transaction) => {
        const productRefs = productIds.map((productId) => db.collection('products').doc(productId))
        const productSnapshots = await Promise.all(
          productRefs.map((productRef) => transaction.get(productRef)),
        )

        productSnapshots.forEach((productSnapshot, index) => {
          const productData = productSnapshot.data() as
            | { isAvailable?: boolean; price?: number; currency?: string }
            | undefined

          if (!productSnapshot.exists || !productData?.isAvailable) {
            throw new Error(`Product unavailable: ${productIds[index]}`)
          }

          const requestedItem = body.items[index]

          if (
            productData.price !== requestedItem.price ||
            productData.currency !== requestedItem.currency
          ) {
            throw new Error(`Product mismatch: ${productIds[index]}`)
          }
        })

        // Increment promo usage count inside the transaction
        if (promoDocRef) {
          const promoSnapshot = await transaction.get(promoDocRef)
          const promoData = promoSnapshot.data() as
            | { usageCount?: number; usageLimit?: number | null }
            | undefined

          if (promoData) {
            const currentUsage = promoData.usageCount ?? 0
            const limit = promoData.usageLimit

            if (typeof limit === 'number' && currentUsage >= limit) {
              throw new Error(`Promo usage exhausted: ${promoCode}`)
            }

            transaction.update(promoDocRef, {
              usageCount: FieldValue.increment(1),
            })
          }
        }

        transaction.set(orderRef, {
          fullName: body.fullName.trim(),
          telegramHandle: body.telegramHandle.trim(),
          telegramUserId: body.telegramUserId ?? null,
          note: body.note,
          fulfillmentType: body.fulfillmentType,
          paymentMethod: body.paymentMethod,
          deliveryCity: body.deliveryCity,
          deliveryAddress: body.deliveryAddress,
          deliveryNotes: body.deliveryNotes,
          meetupLocation: body.meetupLocation,
          meetupTimeOption: body.meetupTimeOption,
          meetupNotes: body.meetupNotes,
          items: body.items,
          subtotal: body.subtotal,
          appliedPromo: body.appliedPromo,
          total: body.total,
          status: body.status,
          cancelReason: body.cancelReason,
          createdAt: FieldValue.serverTimestamp(),
        })

        productRefs.forEach((productRef) => {
          transaction.update(productRef, {
            isAvailable: false,
            cartCount: FieldValue.increment(-1),
          })
        })
      })

      response.status(200).json({
        ok: true,
        orderId: orderRef.id,
        reason: 'created',
      } satisfies CreateCheckoutOrderResponse)
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown backend error.'

      let status = 500
      let reason: CreateCheckoutOrderResponse['reason'] = 'internal_error'

      if (detail.startsWith('Product unavailable:')) {
        status = 409
        reason = 'product_unavailable'
      } else if (detail.startsWith('Promo usage exhausted:')) {
        status = 409
        reason = 'promo_exhausted'
      }

      response.status(status).json({
        ok: false,
        orderId: null,
        reason,
        detail,
      } satisfies CreateCheckoutOrderResponse)
    }
  },
)

export const listBuyerOrders = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({
        ok: false,
        orders: [],
        reason: 'invalid_method',
      } satisfies ListOrdersResponse)
      return
    }

    const botToken = telegramBotToken.value()

    if (!botToken) {
      response.status(500).json({
        ok: false,
        orders: [],
        reason: 'missing_bot_token',
      } satisfies ListOrdersResponse)
      return
    }

    const body = request.body as Partial<ListOrdersRequest> | undefined
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const verificationResult = verifyTelegramInitData(initData, botToken)

    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
      response.status(401).json({
        ok: false,
        orders: [],
        reason:
          verificationResult.reason === 'expired_init_data'
            ? 'expired_init_data'
            : 'invalid_init_data',
      } satisfies ListOrdersResponse)
      return
    }

    try {
      const snapshot = await getFirestore()
        .collection('orders')
        .where('telegramUserId', '==', verificationResult.user.id)
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get()

      response.status(200).json({
        ok: true,
        orders: snapshot.docs.map((documentSnapshot) => toApiOrder(documentSnapshot.id, documentSnapshot.data())),
        reason: 'listed',
      } satisfies ListOrdersResponse)
    } catch (error) {
      response.status(500).json({
        ok: false,
        orders: [],
        reason: 'internal_error',
        detail: error instanceof Error ? error.message : 'Unknown backend error.',
      } satisfies ListOrdersResponse)
    }
  },
)

export const updateProductSignal = onRequest(
  {
    cors: true,
    invoker: 'public',
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({
        ok: false,
        productId: null,
        signal: null,
        reason: 'invalid_method',
      } satisfies UpdateProductSignalResponse)
      return
    }

    const body = request.body as Partial<UpdateProductSignalRequest> | undefined
    const productId = typeof body?.productId === 'string' ? body.productId.trim() : ''
    const signal = body?.signal
    const delta = body?.delta

    if (!productId || !isProductSignal(signal) || !isSignalDelta(delta)) {
      response.status(400).json({
        ok: false,
        productId: productId || null,
        signal: isProductSignal(signal) ? signal : null,
        reason: 'invalid_payload',
      } satisfies UpdateProductSignalResponse)
      return
    }

    try {
      const db = getFirestore()
      const productRef = db.collection('products').doc(productId)

      await db.runTransaction(async (transaction) => {
        const productSnapshot = await transaction.get(productRef)

        if (!productSnapshot.exists) {
          throw new Error('PRODUCT_NOT_FOUND')
        }

        const productData = productSnapshot.data() as
          | { likesCount?: number; cartCount?: number }
          | undefined
        const currentValue =
          signal === 'likesCount'
            ? productData?.likesCount ?? 0
            : productData?.cartCount ?? 0
        const nextValue = Math.max(0, currentValue + delta)

        transaction.update(productRef, {
          [signal]: nextValue,
        })
      })

      response.status(200).json({
        ok: true,
        productId,
        signal,
        reason: 'updated',
      } satisfies UpdateProductSignalResponse)
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown backend error.'

      response.status(detail === 'PRODUCT_NOT_FOUND' ? 404 : 500).json({
        ok: false,
        productId,
        signal,
        reason: detail === 'PRODUCT_NOT_FOUND' ? 'product_not_found' : 'internal_error',
        detail,
      } satisfies UpdateProductSignalResponse)
    }
  },
)

export const uploadProductImageAdmin = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({
        ok: false,
        imageUrl: null,
        storagePath: null,
        reason: 'invalid_method',
      } satisfies UploadProductImageAdminResponse)
      return
    }

    const botToken = telegramBotToken.value()

    if (!botToken) {
      response.status(500).json({
        ok: false,
        imageUrl: null,
        storagePath: null,
        reason: 'missing_bot_token',
      } satisfies UploadProductImageAdminResponse)
      return
    }

    const body = request.body as Partial<UploadProductImageAdminRequest> | undefined
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const fileName = typeof body?.fileName === 'string' ? body.fileName.trim() : ''
    const contentType = typeof body?.contentType === 'string' ? body.contentType.trim() : ''
    const base64Data = typeof body?.base64Data === 'string' ? body.base64Data.trim() : ''

    if (!isValidUploadImagePayload({ fileName, contentType, base64Data })) {
      response.status(400).json({
        ok: false,
        imageUrl: null,
        storagePath: null,
        reason: 'invalid_payload',
      } satisfies UploadProductImageAdminResponse)
      return
    }

    const verificationResult = verifyTelegramInitData(initData, botToken)

    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
      response.status(401).json({
        ok: false,
        imageUrl: null,
        storagePath: null,
        reason:
          verificationResult.reason === 'expired_init_data'
            ? 'expired_init_data'
            : 'invalid_init_data',
      } satisfies UploadProductImageAdminResponse)
      return
    }

    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
      response.status(403).json({
        ok: false,
        imageUrl: null,
        storagePath: null,
        reason: 'forbidden',
      } satisfies UploadProductImageAdminResponse)
      return
    }

    try {
      const safeName = sanitizeStorageFileName(fileName)
      const storagePath = `products/${Date.now()}-${crypto.randomUUID()}-${safeName}`
      const downloadToken = crypto.randomUUID()
      const buffer = Buffer.from(base64Data, 'base64')

      if (buffer.byteLength === 0 || buffer.byteLength > 5 * 1024 * 1024) {
        response.status(400).json({
          ok: false,
          imageUrl: null,
          storagePath: null,
          reason: 'invalid_payload',
          detail: 'Image must be greater than 0 bytes and smaller than 5 MB.',
        } satisfies UploadProductImageAdminResponse)
        return
      }

      const bucket = getStorage().bucket()
      const file = bucket.file(storagePath)

      await file.save(buffer, {
        metadata: {
          contentType,
          metadata: {
            firebaseStorageDownloadTokens: downloadToken,
          },
        },
      })

      response.status(200).json({
        ok: true,
        imageUrl: buildFirebaseDownloadUrl(bucket.name, storagePath, downloadToken),
        storagePath,
        reason: 'uploaded',
      } satisfies UploadProductImageAdminResponse)
    } catch (error) {
      response.status(500).json({
        ok: false,
        imageUrl: null,
        storagePath: null,
        reason: 'internal_error',
        detail: error instanceof Error ? error.message : 'Unknown backend error.',
      } satisfies UploadProductImageAdminResponse)
    }
  },
)

export const deleteProductImagesAdmin = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({
        ok: false,
        deletedCount: 0,
        reason: 'invalid_method',
      } satisfies DeleteProductImagesAdminResponse)
      return
    }

    const botToken = telegramBotToken.value()

    if (!botToken) {
      response.status(500).json({
        ok: false,
        deletedCount: 0,
        reason: 'missing_bot_token',
      } satisfies DeleteProductImagesAdminResponse)
      return
    }

    const body = request.body as Partial<DeleteProductImagesAdminRequest> | undefined
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const imageUrls =
      body?.imageUrls?.filter(
        (imageUrl): imageUrl is string =>
          typeof imageUrl === 'string' && imageUrl.trim().length > 0,
      ) ?? []

    if (imageUrls.length === 0) {
      response.status(400).json({
        ok: false,
        deletedCount: 0,
        reason: 'invalid_payload',
      } satisfies DeleteProductImagesAdminResponse)
      return
    }

    const verificationResult = verifyTelegramInitData(initData, botToken)

    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
      response.status(401).json({
        ok: false,
        deletedCount: 0,
        reason:
          verificationResult.reason === 'expired_init_data'
            ? 'expired_init_data'
            : 'invalid_init_data',
      } satisfies DeleteProductImagesAdminResponse)
      return
    }

    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
      response.status(403).json({
        ok: false,
        deletedCount: 0,
        reason: 'forbidden',
      } satisfies DeleteProductImagesAdminResponse)
      return
    }

    try {
      const bucket = getStorage().bucket()
      const storagePaths = imageUrls
        .map((imageUrl) => parseStoragePathFromImageUrl(imageUrl, bucket.name))
        .filter((storagePath): storagePath is string => Boolean(storagePath))

      await Promise.all(
        storagePaths.map((storagePath) =>
          bucket.file(storagePath).delete({ ignoreNotFound: true }),
        ),
      )

      response.status(200).json({
        ok: true,
        deletedCount: storagePaths.length,
        reason: 'deleted',
      } satisfies DeleteProductImagesAdminResponse)
    } catch (error) {
      response.status(500).json({
        ok: false,
        deletedCount: 0,
        reason: 'internal_error',
        detail: error instanceof Error ? error.message : 'Unknown backend error.',
      } satisfies DeleteProductImagesAdminResponse)
    }
  },
)

// ── Campaign Admin Functions ──

export const upsertCampaignAdmin = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({
        ok: false,
        campaignId: null,
        reason: 'invalid_method',
      } satisfies CampaignAdminResponse)
      return
    }

    const botToken = telegramBotToken.value()

    if (!botToken) {
      response.status(500).json({
        ok: false,
        campaignId: null,
        reason: 'missing_bot_token',
      } satisfies CampaignAdminResponse)
      return
    }

    const body = request.body as Partial<UpsertCampaignAdminRequest> | undefined
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const campaignId = typeof body?.campaignId === 'string' ? body.campaignId.trim() : ''
    const campaign = body?.campaign

    if (!isValidCampaignInput(campaign)) {
      response.status(400).json({
        ok: false,
        campaignId: campaignId || null,
        reason: 'invalid_payload',
      } satisfies CampaignAdminResponse)
      return
    }

    const verificationResult = verifyTelegramInitData(initData, botToken)

    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
      response.status(401).json({
        ok: false,
        campaignId: campaignId || null,
        reason:
          verificationResult.reason === 'expired_init_data'
            ? 'expired_init_data'
            : 'invalid_init_data',
      } satisfies CampaignAdminResponse)
      return
    }

    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
      response.status(403).json({
        ok: false,
        campaignId: campaignId || null,
        reason: 'forbidden',
      } satisfies CampaignAdminResponse)
      return
    }

    try {
      const payload = {
        tag: campaign.tag.trim(),
        headingPart1: campaign.headingPart1.trim(),
        headingPart2: campaign.headingPart2.trim(),
        subtitle: campaign.subtitle.trim(),
        isActive: campaign.isActive,
        sortOrder: campaign.sortOrder,
        updatedAt: new Date().toISOString(),
      }

      if (campaignId) {
        await getFirestore().collection('campaigns').doc(campaignId).set(payload, { merge: true })

        response.status(200).json({
          ok: true,
          campaignId,
          reason: 'saved',
        } satisfies CampaignAdminResponse)
        return
      }

      const createdCampaign = await getFirestore().collection('campaigns').add({
        ...payload,
        createdAt: new Date().toISOString(),
      })

      response.status(200).json({
        ok: true,
        campaignId: createdCampaign.id,
        reason: 'saved',
      } satisfies CampaignAdminResponse)
    } catch (error) {
      response.status(500).json({
        ok: false,
        campaignId: campaignId || null,
        reason: 'internal_error',
        detail: error instanceof Error ? error.message : 'Unknown backend error.',
      } satisfies CampaignAdminResponse)
    }
  },
)

export const deleteCampaignsAdmin = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({
        ok: false,
        campaignId: null,
        reason: 'invalid_method',
      } satisfies CampaignAdminResponse)
      return
    }

    const botToken = telegramBotToken.value()

    if (!botToken) {
      response.status(500).json({
        ok: false,
        campaignId: null,
        reason: 'missing_bot_token',
      } satisfies CampaignAdminResponse)
      return
    }

    const body = request.body as Partial<DeleteCampaignsAdminRequest> | undefined
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const campaignIds =
      body?.campaignIds?.filter((id): id is string => typeof id === 'string' && id.trim().length > 0) ?? []

    if (campaignIds.length === 0) {
      response.status(400).json({
        ok: false,
        campaignId: null,
        reason: 'invalid_payload',
      } satisfies CampaignAdminResponse)
      return
    }

    const verificationResult = verifyTelegramInitData(initData, botToken)

    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
      response.status(401).json({
        ok: false,
        campaignId: null,
        reason:
          verificationResult.reason === 'expired_init_data'
            ? 'expired_init_data'
            : 'invalid_init_data',
      } satisfies CampaignAdminResponse)
      return
    }

    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
      response.status(403).json({
        ok: false,
        campaignId: null,
        reason: 'forbidden',
      } satisfies CampaignAdminResponse)
      return
    }

    try {
      const batch = getFirestore().batch()
      campaignIds.forEach((id) => {
        batch.delete(getFirestore().collection('campaigns').doc(id))
      })
      await batch.commit()

      response.status(200).json({
        ok: true,
        campaignId: campaignIds[0] ?? null,
        reason: 'deleted',
      } satisfies CampaignAdminResponse)
    } catch (error) {
      response.status(500).json({
        ok: false,
        campaignId: campaignIds[0] ?? null,
        reason: 'internal_error',
        detail: error instanceof Error ? error.message : 'Unknown backend error.',
      } satisfies CampaignAdminResponse)
    }
  },
)

export const reorderCampaignsAdmin = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({
        ok: false,
        campaignId: null,
        reason: 'invalid_method',
      } satisfies CampaignAdminResponse)
      return
    }

    const botToken = telegramBotToken.value()

    if (!botToken) {
      response.status(500).json({
        ok: false,
        campaignId: null,
        reason: 'missing_bot_token',
      } satisfies CampaignAdminResponse)
      return
    }

    const body = request.body as Partial<ReorderCampaignsAdminRequest> | undefined
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const orderedIds =
      body?.orderedIds?.filter((id): id is string => typeof id === 'string' && id.trim().length > 0) ?? []

    if (orderedIds.length === 0) {
      response.status(400).json({
        ok: false,
        campaignId: null,
        reason: 'invalid_payload',
      } satisfies CampaignAdminResponse)
      return
    }

    const verificationResult = verifyTelegramInitData(initData, botToken)

    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
      response.status(401).json({
        ok: false,
        campaignId: null,
        reason:
          verificationResult.reason === 'expired_init_data'
            ? 'expired_init_data'
            : 'invalid_init_data',
      } satisfies CampaignAdminResponse)
      return
    }

    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
      response.status(403).json({
        ok: false,
        campaignId: null,
        reason: 'forbidden',
      } satisfies CampaignAdminResponse)
      return
    }

    try {
      const db = getFirestore()
      const now = new Date().toISOString()
      const updates = orderedIds.map((id, index) =>
        db.collection('campaigns').doc(id).update({
          sortOrder: index,
          updatedAt: now,
        }),
      )
      await Promise.all(updates)

      response.status(200).json({
        ok: true,
        campaignId: orderedIds[0] ?? null,
        reason: 'reordered',
      } satisfies CampaignAdminResponse)
    } catch (error) {
      response.status(500).json({
        ok: false,
        campaignId: orderedIds[0] ?? null,
        reason: 'internal_error',
        detail: error instanceof Error ? error.message : 'Unknown backend error.',
      } satisfies CampaignAdminResponse)
    }
  },
)

// ── Task Admin Functions ──

export const upsertTaskAdmin = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({
        ok: false,
        taskId: null,
        reason: 'invalid_method',
      } satisfies TaskAdminResponse)
      return
    }

    const botToken = telegramBotToken.value()

    if (!botToken) {
      response.status(500).json({
        ok: false,
        taskId: null,
        reason: 'missing_bot_token',
      } satisfies TaskAdminResponse)
      return
    }

    const body = request.body as Partial<UpsertTaskAdminRequest> | undefined
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const taskId = typeof body?.taskId === 'string' ? body.taskId.trim() : ''
    const task = body?.task

    if (!isValidTaskInput(task)) {
      response.status(400).json({
        ok: false,
        taskId: taskId || null,
        reason: 'invalid_payload',
      } satisfies TaskAdminResponse)
      return
    }

    const verificationResult = verifyTelegramInitData(initData, botToken)

    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
      response.status(401).json({
        ok: false,
        taskId: taskId || null,
        reason:
          verificationResult.reason === 'expired_init_data'
            ? 'expired_init_data'
            : 'invalid_init_data',
      } satisfies TaskAdminResponse)
      return
    }

    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
      response.status(403).json({
        ok: false,
        taskId: taskId || null,
        reason: 'forbidden',
      } satisfies TaskAdminResponse)
      return
    }

    try {
      const payload = {
        title: task.title.trim(),
        rewardType: task.rewardType,
        rewardValue: task.rewardValue.trim(),
        status: task.status,
        sortOrder: task.sortOrder,
        updatedAt: new Date().toISOString(),
      }

      if (taskId) {
        await getFirestore().collection('tasks').doc(taskId).set(payload, { merge: true })

        response.status(200).json({
          ok: true,
          taskId,
          reason: 'saved',
        } satisfies TaskAdminResponse)
        return
      }

      const createdTask = await getFirestore().collection('tasks').add({
        ...payload,
        createdAt: new Date().toISOString(),
      })

      response.status(200).json({
        ok: true,
        taskId: createdTask.id,
        reason: 'saved',
      } satisfies TaskAdminResponse)
    } catch (error) {
      response.status(500).json({
        ok: false,
        taskId: taskId || null,
        reason: 'internal_error',
        detail: error instanceof Error ? error.message : 'Unknown backend error.',
      } satisfies TaskAdminResponse)
    }
  },
)

export const deleteTasksAdmin = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({
        ok: false,
        taskId: null,
        reason: 'invalid_method',
      } satisfies TaskAdminResponse)
      return
    }

    const botToken = telegramBotToken.value()

    if (!botToken) {
      response.status(500).json({
        ok: false,
        taskId: null,
        reason: 'missing_bot_token',
      } satisfies TaskAdminResponse)
      return
    }

    const body = request.body as Partial<DeleteTasksAdminRequest> | undefined
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const taskIds =
      body?.taskIds?.filter((id): id is string => typeof id === 'string' && id.trim().length > 0) ?? []

    if (taskIds.length === 0) {
      response.status(400).json({
        ok: false,
        taskId: null,
        reason: 'invalid_payload',
      } satisfies TaskAdminResponse)
      return
    }

    const verificationResult = verifyTelegramInitData(initData, botToken)

    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
      response.status(401).json({
        ok: false,
        taskId: null,
        reason:
          verificationResult.reason === 'expired_init_data'
            ? 'expired_init_data'
            : 'invalid_init_data',
      } satisfies TaskAdminResponse)
      return
    }

    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
      response.status(403).json({
        ok: false,
        taskId: null,
        reason: 'forbidden',
      } satisfies TaskAdminResponse)
      return
    }

    try {
      const batch = getFirestore().batch()
      taskIds.forEach((id) => {
        batch.delete(getFirestore().collection('tasks').doc(id))
      })
      await batch.commit()

      response.status(200).json({
        ok: true,
        taskId: taskIds[0] ?? null,
        reason: 'deleted',
      } satisfies TaskAdminResponse)
    } catch (error) {
      response.status(500).json({
        ok: false,
        taskId: taskIds[0] ?? null,
        reason: 'internal_error',
        detail: error instanceof Error ? error.message : 'Unknown backend error.',
      } satisfies TaskAdminResponse)
    }
  },
)

// ── Giveaway Admin Functions ──

export const upsertGiveawayAdmin = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({
        ok: false,
        giveawayId: null,
        reason: 'invalid_method',
      } satisfies GiveawayAdminResponse)
      return
    }

    const botToken = telegramBotToken.value()

    if (!botToken) {
      response.status(500).json({
        ok: false,
        giveawayId: null,
        reason: 'missing_bot_token',
      } satisfies GiveawayAdminResponse)
      return
    }

    const body = request.body as Partial<UpsertGiveawayAdminRequest> | undefined
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const giveawayId = typeof body?.giveawayId === 'string' ? body.giveawayId.trim() : ''
    const giveaway = body?.giveaway

    if (!isValidGiveawayInput(giveaway)) {
      response.status(400).json({
        ok: false,
        giveawayId: giveawayId || null,
        reason: 'invalid_payload',
      } satisfies GiveawayAdminResponse)
      return
    }

    const verificationResult = verifyTelegramInitData(initData, botToken)

    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
      response.status(401).json({
        ok: false,
        giveawayId: giveawayId || null,
        reason:
          verificationResult.reason === 'expired_init_data'
            ? 'expired_init_data'
            : 'invalid_init_data',
      } satisfies GiveawayAdminResponse)
      return
    }

    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
      response.status(403).json({
        ok: false,
        giveawayId: giveawayId || null,
        reason: 'forbidden',
      } satisfies GiveawayAdminResponse)
      return
    }

    try {
      const payload = {
        productId: giveaway.productId.trim(),
        productName: giveaway.productName.trim(),
        productImage: giveaway.productImage.trim(),
        totalTickets: giveaway.totalTickets,
        enteredCount: giveaway.enteredCount,
        endsAt: giveaway.endsAt || null,
        isActive: giveaway.isActive,
        winnerUsername: giveaway.winnerUsername || null,
        updatedAt: new Date().toISOString(),
      }

      if (giveawayId) {
        await getFirestore().collection('giveaways').doc(giveawayId).set(payload, { merge: true })

        response.status(200).json({
          ok: true,
          giveawayId,
          reason: 'saved',
        } satisfies GiveawayAdminResponse)
        return
      }

      const createdGiveaway = await getFirestore().collection('giveaways').add({
        ...payload,
        createdAt: new Date().toISOString(),
      })

      response.status(200).json({
        ok: true,
        giveawayId: createdGiveaway.id,
        reason: 'saved',
      } satisfies GiveawayAdminResponse)
    } catch (error) {
      response.status(500).json({
        ok: false,
        giveawayId: giveawayId || null,
        reason: 'internal_error',
        detail: error instanceof Error ? error.message : 'Unknown backend error.',
      } satisfies GiveawayAdminResponse)
    }
  },
)

export const deleteGiveawaysAdmin = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({
        ok: false,
        giveawayId: null,
        reason: 'invalid_method',
      } satisfies GiveawayAdminResponse)
      return
    }

    const botToken = telegramBotToken.value()

    if (!botToken) {
      response.status(500).json({
        ok: false,
        giveawayId: null,
        reason: 'missing_bot_token',
      } satisfies GiveawayAdminResponse)
      return
    }

    const body = request.body as Partial<DeleteGiveawaysAdminRequest> | undefined
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const giveawayIds =
      body?.giveawayIds?.filter((id): id is string => typeof id === 'string' && id.trim().length > 0) ?? []

    if (giveawayIds.length === 0) {
      response.status(400).json({
        ok: false,
        giveawayId: null,
        reason: 'invalid_payload',
      } satisfies GiveawayAdminResponse)
      return
    }

    const verificationResult = verifyTelegramInitData(initData, botToken)

    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
      response.status(401).json({
        ok: false,
        giveawayId: null,
        reason:
          verificationResult.reason === 'expired_init_data'
            ? 'expired_init_data'
            : 'invalid_init_data',
      } satisfies GiveawayAdminResponse)
      return
    }

    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
      response.status(403).json({
        ok: false,
        giveawayId: null,
        reason: 'forbidden',
      } satisfies GiveawayAdminResponse)
      return
    }

    try {
      const batch = getFirestore().batch()
      giveawayIds.forEach((id) => {
        batch.delete(getFirestore().collection('giveaways').doc(id))
      })
      await batch.commit()

      response.status(200).json({
        ok: true,
        giveawayId: giveawayIds[0] ?? null,
        reason: 'deleted',
      } satisfies GiveawayAdminResponse)
    } catch (error) {
      response.status(500).json({
        ok: false,
        giveawayId: giveawayIds[0] ?? null,
        reason: 'internal_error',
        detail: error instanceof Error ? error.message : 'Unknown backend error.',
      } satisfies GiveawayAdminResponse)
    }
  },
)

function toApiOrder(orderId: string, rawData: Record<string, unknown>): ApiOrder {
  const data = rawData as Partial<Omit<ApiOrder, 'createdAt'>> & {
    createdAt?: { toDate?: () => Date } | Date | null
  }
  const createdAt =
    data.createdAt instanceof Date
      ? data.createdAt
      : typeof data.createdAt?.toDate === 'function'
        ? data.createdAt.toDate()
        : null

  return {
    id: orderId,
    fullName: typeof data.fullName === 'string' ? data.fullName : '',
    telegramHandle: typeof data.telegramHandle === 'string' ? data.telegramHandle : '',
    telegramUserId: typeof data.telegramUserId === 'number' ? data.telegramUserId : null,
    note: typeof data.note === 'string' ? data.note : '',
    fulfillmentType: data.fulfillmentType === 'delivery' ? 'delivery' : 'meetup',
    paymentMethod: data.paymentMethod === 'usdt' ? 'usdt' : 'meetup_cash',
    deliveryCity: typeof data.deliveryCity === 'string' ? data.deliveryCity : '',
    deliveryAddress: typeof data.deliveryAddress === 'string' ? data.deliveryAddress : '',
    deliveryNotes: typeof data.deliveryNotes === 'string' ? data.deliveryNotes : '',
    meetupLocation: typeof data.meetupLocation === 'string' ? data.meetupLocation : '',
    meetupTimeOption: typeof data.meetupTimeOption === 'string' ? data.meetupTimeOption : '',
    meetupNotes: typeof data.meetupNotes === 'string' ? data.meetupNotes : '',
    items: Array.isArray(data.items) ? data.items.filter(isValidCheckoutCartItem) : [],
    subtotal: typeof data.subtotal === 'number' ? data.subtotal : 0,
    appliedPromo: isValidAppliedPromo(data.appliedPromo) ? data.appliedPromo : null,
    total: typeof data.total === 'number' ? data.total : 0,
    status: isOrderStatus(data.status) ? data.status : 'new',
    cancelReason: typeof data.cancelReason === 'string' ? data.cancelReason : '',
    createdAt: createdAt ? createdAt.toISOString() : null,
  }
}

function readAdminIdsFromEnv(): number[] {
  const rawValue = telegramAdminIds.value() ?? ''

  return rawValue
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0)
}

function isOrderStatus(value: unknown): value is (typeof ORDER_STATUSES)[number] {
  return typeof value === 'string' && ORDER_STATUSES.includes(value as (typeof ORDER_STATUSES)[number])
}

function isPromoDiscountType(
  value: unknown,
): value is (typeof PROMO_DISCOUNT_TYPES)[number] {
  return (
    typeof value === 'string' &&
    PROMO_DISCOUNT_TYPES.includes(value as (typeof PROMO_DISCOUNT_TYPES)[number])
  )
}

function isValidPromoInput(value: unknown): value is PromoAdminInput {
  if (!value || typeof value !== 'object') {
    return false
  }

  const promo = value as Partial<PromoAdminInput>

  return (
    typeof promo.code === 'string' &&
    promo.code.trim().length > 0 &&
    promo.code.trim().length <= 40 &&
    isPromoDiscountType(promo.discountType) &&
    typeof promo.discountValue === 'number' &&
    Number.isFinite(promo.discountValue) &&
    promo.discountValue > 0 &&
    promo.discountValue <= 100000 &&
    typeof promo.isActive === 'boolean' &&
    (promo.expiresAt === null || typeof promo.expiresAt === 'string') &&
    (promo.usageLimit === null ||
      (typeof promo.usageLimit === 'number' &&
        Number.isInteger(promo.usageLimit) &&
        promo.usageLimit >= 0)) &&
    (promo.usageCount === undefined ||
      promo.usageCount === null ||
      (typeof promo.usageCount === 'number' &&
        Number.isInteger(promo.usageCount) &&
        promo.usageCount >= 0))
  )
}

function isValidProductInput(value: unknown): value is ProductAdminInput {
  if (!value || typeof value !== 'object') {
    return false
  }

  const product = value as Partial<ProductAdminInput>

  return (
    typeof product.name === 'string' &&
    product.name.trim().length > 0 &&
    product.name.trim().length <= 120 &&
    typeof product.description === 'string' &&
    product.description.trim().length > 0 &&
    product.description.trim().length <= 2000 &&
    typeof product.category === 'string' &&
    PRODUCT_CATEGORIES.includes(product.category as (typeof PRODUCT_CATEGORIES)[number]) &&
    Array.isArray(product.brandNames) &&
    product.brandNames.length <= 10 &&
    product.brandNames.every((brand) => typeof brand === 'string' && brand.trim().length > 0 && brand.trim().length <= 60) &&
    typeof product.price === 'number' &&
    Number.isFinite(product.price) &&
    product.price >= 0 &&
    product.price <= 100000 &&
    typeof product.isAvailable === 'boolean' &&
    Array.isArray(product.images) &&
    product.images.length <= 8 &&
    product.images.every((image) => typeof image === 'string' && image.length > 0 && image.length <= 2000) &&
    (product.isLimitedLabel === undefined ||
      (typeof product.isLimitedLabel === 'string' && product.isLimitedLabel.length <= 80))
  )
}

function isValidCheckoutCartItem(value: unknown): value is CheckoutCartItem {
  if (!value || typeof value !== 'object') {
    return false
  }

  const item = value as Partial<CheckoutCartItem>

  return (
    typeof item.productId === 'string' &&
    item.productId.trim().length > 0 &&
    typeof item.name === 'string' &&
    item.name.trim().length > 0 &&
    item.name.length <= 120 &&
    typeof item.price === 'number' &&
    Number.isFinite(item.price) &&
    item.price >= 0 &&
    item.price <= 100000 &&
    item.currency === 'EUR' &&
    (item.image === null || typeof item.image === 'string')
  )
}

function isValidAppliedPromo(value: unknown): value is CheckoutAppliedPromo | null {
  if (value === null) {
    return true
  }

  if (!value || typeof value !== 'object') {
    return false
  }

  const promo = value as Partial<CheckoutAppliedPromo>

  return (
    typeof promo.code === 'string' &&
    promo.code.trim().length > 0 &&
    promo.code.length <= 40 &&
    isPromoDiscountType(promo.discountType) &&
    typeof promo.discountValue === 'number' &&
    Number.isFinite(promo.discountValue) &&
    typeof promo.discountAmount === 'number' &&
    Number.isFinite(promo.discountAmount) &&
    promo.discountAmount >= 0
  )
}

function isValidCheckoutOrderPayload(value: unknown): value is CreateCheckoutOrderRequest {
  if (!value || typeof value !== 'object') {
    return false
  }

  const order = value as Partial<CreateCheckoutOrderRequest>

  return (
    typeof order.fullName === 'string' &&
    order.fullName.trim().length > 0 &&
    order.fullName.length <= 120 &&
    typeof order.telegramHandle === 'string' &&
    order.telegramHandle.trim().length > 0 &&
    order.telegramHandle.length <= 80 &&
    (order.telegramUserId === undefined ||
      order.telegramUserId === null ||
      Number.isInteger(order.telegramUserId)) &&
    typeof order.note === 'string' &&
    order.note.length <= 1000 &&
    (order.fulfillmentType === 'delivery' || order.fulfillmentType === 'meetup') &&
    (order.paymentMethod === 'meetup_cash' || order.paymentMethod === 'usdt') &&
    typeof order.deliveryCity === 'string' &&
    order.deliveryCity.length <= 120 &&
    typeof order.deliveryAddress === 'string' &&
    order.deliveryAddress.length <= 240 &&
    typeof order.deliveryNotes === 'string' &&
    order.deliveryNotes.length <= 1000 &&
    typeof order.meetupLocation === 'string' &&
    order.meetupLocation.length <= 80 &&
    typeof order.meetupTimeOption === 'string' &&
    order.meetupTimeOption.length <= 80 &&
    typeof order.meetupNotes === 'string' &&
    order.meetupNotes.length <= 1000 &&
    Array.isArray(order.items) &&
    order.items.length > 0 &&
    order.items.length <= 12 &&
    order.items.every((item) => isValidCheckoutCartItem(item)) &&
    typeof order.subtotal === 'number' &&
    Number.isFinite(order.subtotal) &&
    order.subtotal >= 0 &&
    isValidAppliedPromo(order.appliedPromo) &&
    typeof order.total === 'number' &&
    Number.isFinite(order.total) &&
    order.total >= 0 &&
    isOrderStatus(order.status) &&
    typeof order.cancelReason === 'string' &&
    order.cancelReason.length <= 500
  )
}

function isProductSignal(value: unknown): value is 'likesCount' | 'cartCount' {
  return value === 'likesCount' || value === 'cartCount'
}

function isSignalDelta(value: unknown): value is 1 | -1 {
  return value === 1 || value === -1
}

function isValidCampaignInput(value: unknown): value is CampaignAdminInput {
  if (!value || typeof value !== 'object') return false
  const c = value as Partial<CampaignAdminInput>
  return (
    typeof c.tag === 'string' && c.tag.trim().length > 0 && c.tag.trim().length <= 80 &&
    typeof c.headingPart1 === 'string' && c.headingPart1.trim().length > 0 && c.headingPart1.trim().length <= 120 &&
    typeof c.headingPart2 === 'string' && c.headingPart2.trim().length <= 120 &&
    typeof c.subtitle === 'string' && c.subtitle.trim().length <= 240 &&
    typeof c.isActive === 'boolean' &&
    typeof c.sortOrder === 'number' && Number.isFinite(c.sortOrder) && c.sortOrder >= 0
  )
}

function isValidTaskInput(value: unknown): value is TaskAdminInput {
  if (!value || typeof value !== 'object') return false
  const t = value as Partial<TaskAdminInput>
  return (
    typeof t.title === 'string' && t.title.trim().length > 0 && t.title.trim().length <= 120 &&
    (t.rewardType === 'coupon' || t.rewardType === 'ticket') &&
    typeof t.rewardValue === 'string' && t.rewardValue.trim().length > 0 && t.rewardValue.trim().length <= 60 &&
    (t.status === 'active' || t.status === 'inactive') &&
    typeof t.sortOrder === 'number' && Number.isFinite(t.sortOrder) && t.sortOrder >= 0
  )
}

function isValidGiveawayInput(value: unknown): value is GiveawayAdminInput {
  if (!value || typeof value !== 'object') return false
  const g = value as Partial<GiveawayAdminInput>
  return (
    typeof g.productId === 'string' && g.productId.length <= 120 &&
    typeof g.productName === 'string' && g.productName.trim().length > 0 && g.productName.trim().length <= 120 &&
    typeof g.productImage === 'string' && g.productImage.length <= 2000 &&
    typeof g.totalTickets === 'number' && Number.isInteger(g.totalTickets) && g.totalTickets >= 1 &&
    typeof g.enteredCount === 'number' && Number.isInteger(g.enteredCount) && g.enteredCount >= 0 &&
    (g.endsAt === null || typeof g.endsAt === 'string') &&
    typeof g.isActive === 'boolean' &&
    (g.winnerUsername === null || typeof g.winnerUsername === 'string')
  )
}

function isValidUploadImagePayload(
  value: Partial<Omit<UploadProductImageAdminRequest, 'initData'>>,
): value is Omit<UploadProductImageAdminRequest, 'initData'> {
  return (
    typeof value.fileName === 'string' &&
    value.fileName.trim().length > 0 &&
    value.fileName.trim().length <= 240 &&
    typeof value.contentType === 'string' &&
    value.contentType.startsWith('image/') &&
    value.contentType.length <= 120 &&
    typeof value.base64Data === 'string' &&
    value.base64Data.length > 0
  )
}

function sanitizeStorageFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, '-').toLowerCase()
}

function buildFirebaseDownloadUrl(bucketName: string, storagePath: string, downloadToken: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`
}

function parseStoragePathFromImageUrl(imageUrl: string, bucketName: string): string | null {
  if (imageUrl.startsWith(`gs://${bucketName}/`)) {
    return imageUrl.replace(`gs://${bucketName}/`, '')
  }

  try {
    const parsedUrl = new URL(imageUrl)

    if (
      parsedUrl.hostname.includes('firebasestorage.googleapis.com') &&
      parsedUrl.pathname.startsWith(`/v0/b/${bucketName}/o/`)
    ) {
      return decodeURIComponent(parsedUrl.pathname.replace(`/v0/b/${bucketName}/o/`, ''))
    }

    if (parsedUrl.hostname === 'storage.googleapis.com') {
      const normalizedPath = parsedUrl.pathname.replace(/^\/+/, '')

      if (normalizedPath.startsWith(`${bucketName}/`)) {
        return decodeURIComponent(normalizedPath.replace(`${bucketName}/`, ''))
      }
    }
  } catch {
    return null
  }

  return null
}

function verifyTelegramInitData(
  initData: string,
  botToken: string,
): {
  reason: 'ok' | 'invalid_init_data' | 'expired_init_data'
  user: TelegramInitDataUser | null
} {
  if (!initData) {
    return { reason: 'invalid_init_data', user: null }
  }

  const parsed = new URLSearchParams(initData)
  const providedHash = parsed.get('hash')

  if (!providedHash) {
    return { reason: 'invalid_init_data', user: null }
  }

  const dataCheckString = Array.from(parsed.entries())
    .filter(([key]) => key !== 'hash')
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest()

  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex')

  if (
    computedHash.length !== providedHash.length ||
    !crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(providedHash))
  ) {
    return { reason: 'invalid_init_data', user: null }
  }

  const authDate = Number(parsed.get('auth_date'))

  if (!Number.isFinite(authDate)) {
    return { reason: 'invalid_init_data', user: null }
  }

  const maxAgeSeconds = readInitDataMaxAgeSeconds()
  const nowSeconds = Math.floor(Date.now() / 1000)

  if (nowSeconds - authDate > maxAgeSeconds) {
    return { reason: 'expired_init_data', user: null }
  }

  const rawUser = parsed.get('user')

  if (!rawUser) {
    return { reason: 'invalid_init_data', user: null }
  }

  try {
    return {
      reason: 'ok',
      user: JSON.parse(rawUser) as TelegramInitDataUser,
    }
  } catch {
    return { reason: 'invalid_init_data', user: null }
  }
}

function readInitDataMaxAgeSeconds(): number {
  const rawValue = telegramInitDataMaxAgeSeconds.value()

  if (Number.isInteger(rawValue) && rawValue > 0) {
    return rawValue
  }

  return DEFAULT_INIT_DATA_MAX_AGE_SECONDS
}

async function sendTelegramOrderCancelledMessage(
  botToken: string,
  telegramUserId: number,
  orderId: string,
  cancelReason: string,
) {
  const lines = [
    `Order ${orderId} is cancelled.`,
    cancelReason ? `Reason: ${cancelReason}` : 'Reason: not provided.',
    'If you want help or a different piece, reply here in Telegram.',
  ]

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: telegramUserId,
      text: lines.join('\n'),
    }),
  })

  if (!response.ok) {
    const bodyText = await response.text()
    throw new Error(`Telegram sendMessage failed: ${response.status} ${bodyText}`)
  }
}

async function sendTelegramOrderPaidMessage(
  botToken: string,
  telegramUserId: number,
  orderId: string,
) {
  const lines = [
    `Order ${orderId} is locked in.`,
    'Payment was confirmed and your piece is moving to the next step.',
    'We will message you here when meetup or delivery is ready.',
  ]

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: telegramUserId,
      text: lines.join('\n'),
    }),
  })

  if (!response.ok) {
    const bodyText = await response.text()
    throw new Error(`Telegram sendMessage failed: ${response.status} ${bodyText}`)
  }
}

async function sendTelegramOrderCompletedMessage(
  botToken: string,
  telegramUserId: number,
  orderId: string,
) {
  const lines = [
    `Order ${orderId} is complete.`,
    'Thanks for grabbing a piece from the drop.',
    'Stay close to the bot if you want first access to the next release.',
  ]

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: telegramUserId,
      text: lines.join('\n'),
    }),
  })

  if (!response.ok) {
    const bodyText = await response.text()
    throw new Error(`Telegram sendMessage failed: ${response.status} ${bodyText}`)
  }
}

async function sendTelegramOrderReadyForMeetupMessage(
  botToken: string,
  telegramUserId: number,
  orderId: string,
) {
  const lines = [
    `Order ${orderId} is meetup-ready.`,
    'Your piece is packed and ready for handoff.',
    'Watch this chat for the final place and time confirmation.',
  ]

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: telegramUserId,
      text: lines.join('\n'),
    }),
  })

  if (!response.ok) {
    const bodyText = await response.text()
    throw new Error(`Telegram sendMessage failed: ${response.status} ${bodyText}`)
  }
}

function isStartCommand(messageText: string) {
  const normalizedText = messageText.toLowerCase()

  return normalizedText === '/start' || normalizedText.startsWith('/start ')
}

function isStoreCommand(messageText: string) {
  const normalizedText = messageText.toLowerCase()

  return normalizedText === '/store'
}

function isHelpCommand(messageText: string) {
  const normalizedText = messageText.toLowerCase()

  return normalizedText === '/help'
}

async function sendTelegramStoreWelcomeMessage(
  botToken: string,
  chatId: number,
  firstName?: string,
) {
  const miniAppUrl = telegramMiniAppUrl.value()

  if (!miniAppUrl) {
    throw new Error('TELEGRAM_MINI_APP_URL is not configured.')
  }

  const greetingLine = firstName ? `Yo ${firstName}, the drop is live.` : 'Yo, the drop is live.'
  const text = [
    greetingLine,
    'Open the store to browse the current pieces, save favorites, and send a real order request inside Telegram.',
  ].join('\n\n')

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: 'Open Store',
              web_app: {
                url: miniAppUrl,
              },
            },
          ],
          [
            {
              text: 'Store Link',
              url: miniAppUrl,
            },
          ],
        ],
      },
    }),
  })

  if (!response.ok) {
    const bodyText = await response.text()
    throw new Error(`Telegram sendMessage failed: ${response.status} ${bodyText}`)
  }
}

async function sendTelegramStoreShortcutMessage(
  botToken: string,
  chatId: number,
) {
  const miniAppUrl = telegramMiniAppUrl.value()

  if (!miniAppUrl) {
    throw new Error('TELEGRAM_MINI_APP_URL is not configured.')
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: 'Store is here. Open the Mini App and move fast if a piece is getting attention.',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: 'Open Store',
              web_app: {
                url: miniAppUrl,
              },
            },
          ],
        ],
      },
    }),
  })

  if (!response.ok) {
    const bodyText = await response.text()
    throw new Error(`Telegram sendMessage failed: ${response.status} ${bodyText}`)
  }
}

async function sendTelegramHelpMessage(
  botToken: string,
  chatId: number,
) {
  const lines = [
    'Commands',
    '/start - get the welcome message and open-store button',
    '/store - open the store entry message again',
    '/help - show this help text',
    '',
    'Tip: use the Open Store button for the cleanest Mini App flow.',
  ]

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: lines.join('\n'),
    }),
  })

  if (!response.ok) {
    const bodyText = await response.text()
    throw new Error(`Telegram sendMessage failed: ${response.status} ${bodyText}`)
  }
}

async function sendTelegramBroadcastMessage(
  botToken: string,
  chatId: number,
  text: string,
) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  })

  if (!response.ok) {
    const bodyText = await response.text()
    throw new Error(`Telegram sendMessage failed: ${response.status} ${bodyText}`)
  }
}

async function upsertTelegramSubscriberFromUpdate(body: TelegramWebhookRequest | undefined) {
  const message = body?.message
  const from = message?.from
  const chat = message?.chat

  const telegramUserId = typeof from?.id === 'number' ? from.id : null
  const chatId = typeof chat?.id === 'number' ? chat.id : null
  const username = typeof from?.username === 'string' ? from.username : null
  const firstName = typeof from?.first_name === 'string' ? from.first_name : null

  if (!telegramUserId || !chatId) {
    return
  }

  const db = getFirestore()
  const docRef = db.collection('telegramSubscribers').doc(String(telegramUserId))

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(docRef)
    const now = FieldValue.serverTimestamp()

    if (!snapshot.exists) {
      transaction.set(docRef, {
        telegramUserId,
        chatId,
        username,
        firstName,
        isAdmin: false,
        allowBroadcasts: true,
        createdAt: now,
        lastSeenAt: now,
      })
    } else {
      transaction.set(
        docRef,
        {
          chatId,
          username,
          firstName,
          lastSeenAt: now,
        },
        { merge: true },
      )
    }
  })
}

export const uploadBannerImageAdmin = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({
        ok: false,
        imageUrl: null,
        storagePath: null,
        reason: 'invalid_method',
      } satisfies UploadBannerImageAdminResponse)
      return
    }

    const botToken = telegramBotToken.value()

    if (!botToken) {
      response.status(500).json({
        ok: false,
        imageUrl: null,
        storagePath: null,
        reason: 'missing_bot_token',
      } satisfies UploadBannerImageAdminResponse)
      return
    }

    const body = request.body as Partial<UploadBannerImageAdminRequest> | undefined
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const fileName = typeof body?.fileName === 'string' ? body.fileName.trim() : ''
    const contentType = typeof body?.contentType === 'string' ? body.contentType.trim() : ''
    const base64Data = typeof body?.base64Data === 'string' ? body.base64Data.trim() : ''

    if (!isValidUploadImagePayload({ fileName, contentType, base64Data })) {
      response.status(400).json({
        ok: false,
        imageUrl: null,
        storagePath: null,
        reason: 'invalid_payload',
      } satisfies UploadBannerImageAdminResponse)
      return
    }

    const verificationResult = verifyTelegramInitData(initData, botToken)

    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
      response.status(401).json({
        ok: false,
        imageUrl: null,
        storagePath: null,
        reason:
          verificationResult.reason === 'expired_init_data'
            ? 'expired_init_data'
            : 'invalid_init_data',
      } satisfies UploadBannerImageAdminResponse)
      return
    }

    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
      response.status(403).json({
        ok: false,
        imageUrl: null,
        storagePath: null,
        reason: 'forbidden',
      } satisfies UploadBannerImageAdminResponse)
      return
    }

    try {
      const safeName = sanitizeStorageFileName(fileName)
      const storagePath = `banners/${Date.now()}-${crypto.randomUUID()}-${safeName}`
      const downloadToken = crypto.randomUUID()
      const buffer = Buffer.from(base64Data, 'base64')

      if (buffer.byteLength === 0 || buffer.byteLength > 5 * 1024 * 1024) {
        response.status(400).json({
          ok: false,
          imageUrl: null,
          storagePath: null,
          reason: 'invalid_payload',
          detail: 'Image must be greater than 0 bytes and smaller than 5 MB.',
        } satisfies UploadBannerImageAdminResponse)
        return
      }

      const bucket = getStorage().bucket()
      const file = bucket.file(storagePath)

      await file.save(buffer, {
        metadata: {
          contentType,
          metadata: {
            firebaseStorageDownloadTokens: downloadToken,
          },
        },
      })

      response.status(200).json({
        ok: true,
        imageUrl: buildFirebaseDownloadUrl(bucket.name, storagePath, downloadToken),
        storagePath,
        reason: 'uploaded',
      } satisfies UploadBannerImageAdminResponse)
    } catch (error) {
      response.status(500).json({
        ok: false,
        imageUrl: null,
        storagePath: null,
        reason: 'internal_error',
        detail: error instanceof Error ? error.message : 'Unknown backend error.',
      } satisfies UploadBannerImageAdminResponse)
    }
  },
)

export const getAdminAnalytics = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({
        ok: false,
        totalUsers: 0,
        itemsSold: 0,
        grossRevenueEur: 0,
        referralCount: 0,
        reason: 'invalid_method',
      } satisfies AdminAnalyticsResponse)
      return
    }

    const botToken = telegramBotToken.value()

    if (!botToken) {
      response.status(500).json({
        ok: false,
        totalUsers: 0,
        itemsSold: 0,
        grossRevenueEur: 0,
        referralCount: 0,
        reason: 'missing_bot_token',
      } satisfies AdminAnalyticsResponse)
      return
    }

    const body = request.body as Partial<AdminAnalyticsRequest> | undefined
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const verificationResult = verifyTelegramInitData(initData, botToken)

    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
      response.status(401).json({
        ok: false,
        totalUsers: 0,
        itemsSold: 0,
        grossRevenueEur: 0,
        referralCount: 0,
        reason:
          verificationResult.reason === 'expired_init_data'
            ? 'expired_init_data'
            : 'invalid_init_data',
      } satisfies AdminAnalyticsResponse)
      return
    }

    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
      response.status(403).json({
        ok: false,
        totalUsers: 0,
        itemsSold: 0,
        grossRevenueEur: 0,
        referralCount: 0,
        reason: 'forbidden',
      } satisfies AdminAnalyticsResponse)
      return
    }

    try {
      const db = getFirestore()

      // Count all telegramSubscribers
      const subscribersSnapshot = await db.collection('telegramSubscribers').count().get()
      const totalUsers = subscribersSnapshot.data().count

      // Aggregate order data — all orders
      const ordersSnapshot = await db.collection('orders').get()
      let itemsSold = 0
      let grossRevenueEur = 0

      for (const doc of ordersSnapshot.docs) {
        const data = doc.data()

        // Count items in each order
        if (Array.isArray(data.items)) {
          itemsSold += data.items.length
        }

        // Sum total for completed/paid/ready_for_meetup orders
        const status = typeof data.status === 'string' ? data.status : ''
        if (status === 'completed' || status === 'paid' || status === 'ready_for_meetup') {
          const total = typeof data.total === 'number' ? data.total : 0
          grossRevenueEur += total
        }
      }

      // Count referrals (subscribers with a non-empty referredBy field)
      const referredSnapshot = await db
        .collection('telegramSubscribers')
        .where('referredBy', '>=', '')
        .count()
        .get()
      const referralCount = referredSnapshot.data().count

      response.status(200).json({
        ok: true,
        totalUsers,
        itemsSold,
        grossRevenueEur: Math.round(grossRevenueEur * 100) / 100,
        referralCount,
        reason: 'listed',
      } satisfies AdminAnalyticsResponse)
    } catch (error) {
      response.status(500).json({
        ok: false,
        totalUsers: 0,
        itemsSold: 0,
        grossRevenueEur: 0,
        referralCount: 0,
        reason: 'internal_error',
        detail: error instanceof Error ? error.message : 'Unknown backend error.',
      } satisfies AdminAnalyticsResponse)
    }
  },
)
