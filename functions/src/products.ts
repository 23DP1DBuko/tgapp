// ── Products Module ──
import crypto from 'node:crypto'
import { onRequest } from 'firebase-functions/v2/https'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import {
  telegramBotToken,
  PRODUCT_CATEGORIES,
  RESERVATION_DURATION_MS,
  readAdminIdsFromEnv,
  verifyTelegramInitData,
  isValidProductInput,
  isProductSignal,
  isSignalDelta,
  isValidUploadImagePayload,
  sanitizeStorageFileName,
  buildFirebaseDownloadUrl,
  parseStoragePathFromImageUrl,
  notifyProductSubscribers,
} from './helpers.js'

export type ProductAdminInput = {
  name: string
  description: string
  category: (typeof PRODUCT_CATEGORIES)[number]
  brandNames: string[]
  price: number
  isAvailable: boolean
  images: string[]
  isLimitedLabel?: string
  upcoming?: boolean
  earlyAccessAt?: string | null
  publicAt?: string | null
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


export type UpdateProductSignalRequest = {
  initData: string
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
    | 'invalid_init_data'
    | 'expired_init_data'
    | 'missing_bot_token'
    | 'product_not_found'
    | 'internal_error'
}

export type ReserveProductRequest = {
  initData: string
  productId: string
}

export type ReserveProductResponse = {
  ok: boolean
  reservedUntil: string | null
  detail?: string
  reason:
    | 'reserved'
    | 'already_reserved'
    | 'already_yours'
    | 'product_unavailable'
    | 'invalid_method'
    | 'invalid_payload'
    | 'invalid_init_data'
    | 'expired_init_data'
    | 'missing_bot_token'
    | 'internal_error'
}

export type ReleaseReservationRequest = {
  initData: string
  productId: string
}

export type ReleaseReservationResponse = {
  ok: boolean
  detail?: string
  reason:
    | 'released'
    | 'not_reserved_or_not_yours'
    | 'invalid_method'
    | 'invalid_payload'
    | 'invalid_init_data'
    | 'expired_init_data'
    | 'missing_bot_token'
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
        upcoming: product.upcoming ?? false,
        earlyAccessAt: product.earlyAccessAt ?? null,
        publicAt: product.publicAt ?? null,
      }

      if (productId) {
        // Read old data to detect availability transition
        const oldSnapshot = await getFirestore().collection('products').doc(productId).get()
        const oldData = oldSnapshot.data() as { isAvailable?: boolean } | undefined
        const wasPreviouslyAvailable = oldData?.isAvailable ?? false

        await getFirestore().collection('products').doc(productId).set(payload, { merge: true })

        // If product was unavailable and is now available, notify subscribers
        if (!wasPreviouslyAvailable && product.isAvailable) {
          await notifyProductSubscribers(productId)
        }

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


export const updateProductSignal = onRequest(
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
        signal: null,
        reason: 'invalid_method',
      } satisfies UpdateProductSignalResponse)
      return
    }

    const botToken = telegramBotToken.value()

    if (!botToken) {
      response.status(500).json({
        ok: false,
        productId: null,
        signal: null,
        reason: 'missing_bot_token',
      } satisfies UpdateProductSignalResponse)
      return
    }

    const body = request.body as Partial<UpdateProductSignalRequest> | undefined
    const initData = typeof body?.initData === 'string' ? body.initData : ''
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

    const verificationResult = verifyTelegramInitData(initData, botToken)

    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
      response.status(401).json({
        ok: false,
        productId,
        signal,
        reason:
          verificationResult.reason === 'expired_init_data'
            ? 'expired_init_data'
            : 'invalid_init_data',
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

export const reserveProduct = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({
        ok: false,
        reservedUntil: null,
        reason: 'invalid_method',
      } satisfies ReserveProductResponse)
      return
    }

    const botToken = telegramBotToken.value()

    if (!botToken) {
      response.status(500).json({
        ok: false,
        reservedUntil: null,
        reason: 'missing_bot_token',
      } satisfies ReserveProductResponse)
      return
    }

    const body = request.body as Partial<ReserveProductRequest> | undefined
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const productId = typeof body?.productId === 'string' ? body.productId.trim() : ''

    if (!productId) {
      response.status(400).json({
        ok: false,
        reservedUntil: null,
        reason: 'invalid_payload',
      } satisfies ReserveProductResponse)
      return
    }

    const verificationResult = verifyTelegramInitData(initData, botToken)

    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
      response.status(401).json({
        ok: false,
        reservedUntil: null,
        reason:
          verificationResult.reason === 'expired_init_data'
            ? 'expired_init_data'
            : 'invalid_init_data',
      } satisfies ReserveProductResponse)
      return
    }

    const telegramUserId = verificationResult.user.id
    const now = Date.now()

    try {
      const db = getFirestore()
      const productRef = db.collection('products').doc(productId)

      const result = await db.runTransaction(async (transaction) => {
        const productSnapshot = await transaction.get(productRef)

        if (!productSnapshot.exists) {
          return { status: 'not_found' as const }
        }

        const productData = productSnapshot.data() as
          | { isAvailable?: boolean; reservedBy?: number | null; reservedUntil?: FirebaseFirestore.Timestamp | null }
          | undefined

        if (!productData?.isAvailable) {
          return { status: 'unavailable' as const }
        }

        // Check existing reservation
        const existingReservedBy = productData.reservedBy ?? null
        const existingReservedUntil = productData.reservedUntil?.toMillis() ?? null

        if (existingReservedBy !== null && existingReservedUntil !== null) {
          // If reserved by the same user and still valid, extend the reservation
          if (existingReservedBy === telegramUserId && existingReservedUntil > now) {
            // Extend the reservation from now
            const newReservedUntil = new Date(now + RESERVATION_DURATION_MS)
            transaction.update(productRef, {
              reservedUntil: newReservedUntil,
            })
            return { status: 'extended' as const, reservedUntil: newReservedUntil.toISOString() }
          }

          // If reservation is still valid and belongs to someone else, reject
          if (existingReservedUntil > now) {
            return { status: 'already_reserved' as const, reservedUntil: new Date(existingReservedUntil).toISOString() }
          }
          // Reservation expired — fall through to reserve
        }

        // Reserve the product
        const reservedUntil = new Date(now + RESERVATION_DURATION_MS)
        transaction.update(productRef, {
          reservedBy: telegramUserId,
          reservedUntil: reservedUntil,
        })

        return { status: 'reserved' as const, reservedUntil: reservedUntil.toISOString() }
      })

      switch (result.status) {
        case 'not_found':
          response.status(404).json({
            ok: false,
            reservedUntil: null,
            reason: 'product_unavailable',
          } satisfies ReserveProductResponse)
          return

        case 'unavailable':
          response.status(409).json({
            ok: false,
            reservedUntil: null,
            reason: 'product_unavailable',
          } satisfies ReserveProductResponse)
          return

        case 'already_reserved':
          response.status(409).json({
            ok: false,
            reservedUntil: result.reservedUntil,
            reason: 'already_reserved',
            detail: 'This item is currently reserved by another buyer.',
          } satisfies ReserveProductResponse)
          return

        case 'extended':
          response.status(200).json({
            ok: true,
            reservedUntil: result.reservedUntil,
            reason: 'already_yours',
          } satisfies ReserveProductResponse)
          return

        case 'reserved':
          response.status(200).json({
            ok: true,
            reservedUntil: result.reservedUntil,
            reason: 'reserved',
          } satisfies ReserveProductResponse)
          return
      }
    } catch (error) {
      response.status(500).json({
        ok: false,
        reservedUntil: null,
        reason: 'internal_error',
        detail: error instanceof Error ? error.message : 'Unknown backend error.',
      } satisfies ReserveProductResponse)
    }
  },
)

export const releaseReservation = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({
        ok: false,
        reason: 'invalid_method',
      } satisfies ReleaseReservationResponse)
      return
    }

    const botToken = telegramBotToken.value()

    if (!botToken) {
      response.status(500).json({
        ok: false,
        reason: 'missing_bot_token',
      } satisfies ReleaseReservationResponse)
      return
    }

    const body = request.body as Partial<ReleaseReservationRequest> | undefined
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const productId = typeof body?.productId === 'string' ? body.productId.trim() : ''

    if (!productId) {
      response.status(400).json({
        ok: false,
        reason: 'invalid_payload',
      } satisfies ReleaseReservationResponse)
      return
    }

    const verificationResult = verifyTelegramInitData(initData, botToken)

    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
      response.status(401).json({
        ok: false,
        reason:
          verificationResult.reason === 'expired_init_data'
            ? 'expired_init_data'
            : 'invalid_init_data',
      } satisfies ReleaseReservationResponse)
      return
    }

    const telegramUserId = verificationResult.user.id

    try {
      const db = getFirestore()
      const productRef = db.collection('products').doc(productId)

      await db.runTransaction(async (transaction) => {
        const productSnapshot = await transaction.get(productRef)

        if (!productSnapshot.exists) {
          return // Silently succeed for non-existent products
        }

        const productData = productSnapshot.data() as
          | { reservedBy?: number | null }
          | undefined

        // Only clear if reserved by this user (or not reserved at all)
        const currentReservedBy = productData?.reservedBy ?? null

        if (currentReservedBy === null || currentReservedBy === telegramUserId) {
          transaction.update(productRef, {
            reservedBy: FieldValue.delete(),
            reservedUntil: FieldValue.delete(),
          })
        }
      })

      response.status(200).json({
        ok: true,
        reason: 'released',
      } satisfies ReleaseReservationResponse)
    } catch (error) {
      response.status(500).json({
        ok: false,
        reason: 'internal_error',
        detail: error instanceof Error ? error.message : 'Unknown backend error.',
      } satisfies ReleaseReservationResponse)
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

