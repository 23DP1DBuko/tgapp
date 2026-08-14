// ── Products Module ──
import crypto from 'node:crypto';
import { onRequest } from 'firebase-functions/v2/https';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { telegramBotToken, readAdminIdsFromEnv, verifyTelegramInitData, isValidProductInput, isValidProductDiscountInput, isProductSignal, isSignalDelta, isValidUploadImagePayload, sanitizeStorageFileName, buildFirebaseDownloadUrl, parseStoragePathFromImageUrl, } from './helpers.js';
/**
 * Transactionally apply a like/cart popularity signal with per-user dedupe.
 *
 * Each user contributes **at most 1** per signal per product (binary), tracked
 * in `products/{productId}/signals/{telegramUserId}`. The doc id is the user
 * id, so concurrent calls from the same user serialize on that document and the
 * loser becomes a no-op (idempotent): a repeated `+1` returns
 * `already_applied` without touching the counter, a `-1` with no contribution
 * returns `not_applied`. Spamming can never inflate or drain the shared
 * counters beyond the number of users who actually contributed.
 */
export async function applyProductSignalTransaction(db, input) {
    const { productId, telegramUserId, signal, delta } = input;
    const productRef = db.collection('products').doc(productId);
    const signalRef = productRef.collection('signals').doc(String(telegramUserId));
    const userStatsRef = db.collection('userStats').doc(String(telegramUserId));
    return db.runTransaction(async (transaction) => {
        const productSnapshot = await transaction.get(productRef);
        if (!productSnapshot.exists) {
            return { status: 'product_not_found' };
        }
        const signalSnapshot = await transaction.get(signalRef);
        // Server-tracked per-user like count, used by giveaway `client_claim`
        // tasks ("like N products") so the check is server-authoritative instead
        // of trusting a device-local count. Only touched for like signals; the
        // dedupe on signalRef already serializes concurrent toggles, so this
        // counter can never be inflated by spam or double-application.
        const userStatsSnapshot = await transaction.get(userStatsRef);
        const currentLikedCount = typeof userStatsSnapshot.data()?.likedProductCount === 'number'
            ? userStatsSnapshot.data()?.likedProductCount
            : 0;
        const productData = productSnapshot.data();
        const currentCount = signal === 'likesCount'
            ? productData?.likesCount ?? 0
            : productData?.cartCount ?? 0;
        const signalData = signalSnapshot.data();
        // Clamp to binary: only this function writes these docs (0|1), but a legacy
        // or hand-crafted doc must never be able to over-increment the counter.
        const currentUserValue = (signalData?.[signal] ?? 0) > 0 ? 1 : 0;
        // Race-safety invariant: reading the signal doc (deterministic id = user id)
        // inside the transaction is what serializes concurrent calls from the same
        // user — the loser hits a write conflict, retries, and sees the committed
        // contribution. Do not switch the counter to FieldValue.increment or drop
        // this read, or the dedupe silently breaks.
        if (delta === 1) {
            // Like / add-to-cart
            if (currentUserValue === 1) {
                return { status: 'already_applied' };
            }
            transaction.set(signalRef, {
                likesCount: signal === 'likesCount' ? 1 : (signalData?.likesCount ?? 0),
                cartCount: signal === 'cartCount' ? 1 : (signalData?.cartCount ?? 0),
            });
            transaction.update(productRef, { [signal]: currentCount + 1 });
            if (signal === 'likesCount') {
                transaction.set(userStatsRef, {
                    telegramUserId,
                    likedProductCount: currentLikedCount + 1,
                    updatedAt: new Date().toISOString(),
                });
            }
            return { status: 'updated' };
        }
        // Unlike / remove-from-cart
        if (currentUserValue === 0) {
            return { status: 'not_applied' };
        }
        transaction.set(signalRef, {
            likesCount: signal === 'likesCount' ? 0 : (signalData?.likesCount ?? 0),
            cartCount: signal === 'cartCount' ? 0 : (signalData?.cartCount ?? 0),
        });
        transaction.update(productRef, { [signal]: Math.max(0, currentCount - 1) });
        if (signal === 'likesCount') {
            transaction.set(userStatsRef, {
                telegramUserId,
                likedProductCount: Math.max(0, currentLikedCount - 1),
                updatedAt: new Date().toISOString(),
            });
        }
        return { status: 'updated' };
    });
}
export const upsertProductAdmin = onRequest({
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).json({
            ok: false,
            productId: null,
            reason: 'invalid_method',
        });
        return;
    }
    const botToken = telegramBotToken.value();
    if (!botToken) {
        response.status(500).json({
            ok: false,
            productId: null,
            reason: 'missing_bot_token',
        });
        return;
    }
    const body = request.body;
    const initData = typeof body?.initData === 'string' ? body.initData : '';
    const productId = typeof body?.productId === 'string' ? body.productId.trim() : '';
    const product = body?.product;
    if (!isValidProductInput(product)) {
        response.status(400).json({
            ok: false,
            productId: productId || null,
            reason: 'invalid_payload',
        });
        return;
    }
    const verificationResult = verifyTelegramInitData(initData, botToken);
    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
        response.status(401).json({
            ok: false,
            productId: productId || null,
            reason: verificationResult.reason === 'expired_init_data'
                ? 'expired_init_data'
                : 'invalid_init_data',
        });
        return;
    }
    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
        response.status(403).json({
            ok: false,
            productId: productId || null,
            reason: 'forbidden',
        });
        return;
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
        };
        // Discount fields are persisted only when the client sent them, so the
        // main product form (which doesn't edit discounts) never wipes a
        // discount set from the Discounts admin page (merge semantics).
        if (product.discountType !== undefined) {
            payload.discountType = product.discountType ?? null;
        }
        if (product.discountValue !== undefined) {
            payload.discountValue = product.discountValue ?? null;
        }
        if (productId) {
            await getFirestore().collection('products').doc(productId).set(payload, { merge: true });
            response.status(200).json({
                ok: true,
                productId,
                reason: 'saved',
            });
            return;
        }
        const createdProduct = await getFirestore().collection('products').add({
            ...payload,
            likesCount: 0,
            cartCount: 0,
            createdAt: FieldValue.serverTimestamp(),
        });
        response.status(200).json({
            ok: true,
            productId: createdProduct.id,
            reason: 'saved',
        });
    }
    catch (error) {
        response.status(500).json({
            ok: false,
            productId: productId || null,
            reason: 'internal_error',
            detail: error instanceof Error ? error.message : 'Unknown backend error.',
        });
    }
});
export const setProductDiscountAdmin = onRequest({
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).json({
            ok: false,
            productId: null,
            reason: 'invalid_method',
        });
        return;
    }
    const botToken = telegramBotToken.value();
    if (!botToken) {
        response.status(500).json({
            ok: false,
            productId: null,
            reason: 'missing_bot_token',
        });
        return;
    }
    const body = request.body;
    const initData = typeof body?.initData === 'string' ? body.initData : '';
    const productId = typeof body?.productId === 'string' ? body.productId.trim() : '';
    const discount = body?.discount;
    if (!productId || !isValidProductDiscountInput(discount)) {
        response.status(400).json({
            ok: false,
            productId: productId || null,
            reason: 'invalid_payload',
        });
        return;
    }
    const verificationResult = verifyTelegramInitData(initData, botToken);
    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
        response.status(401).json({
            ok: false,
            productId: productId || null,
            reason: verificationResult.reason === 'expired_init_data'
                ? 'expired_init_data'
                : 'invalid_init_data',
        });
        return;
    }
    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
        response.status(403).json({
            ok: false,
            productId: productId || null,
            reason: 'forbidden',
        });
        return;
    }
    try {
        const db = getFirestore();
        const productRef = db.collection('products').doc(productId);
        const productSnapshot = await productRef.get();
        if (!productSnapshot.exists) {
            response.status(404).json({
                ok: false,
                productId,
                reason: 'product_not_found',
                detail: 'PRODUCT_NOT_FOUND',
            });
            return;
        }
        const productData = productSnapshot.data();
        const price = typeof productData?.price === 'number' ? productData.price : 0;
        // A fixed discount must leave a positive price — never a free or
        // negative item. Percentage discounts are already clamped to ≤ 100 by
        // validation (the effective price math floors at 0 regardless).
        if (discount.discountType === 'fixed') {
            const fixedValue = discount.discountValue ?? 0;
            if (fixedValue <= 0 || fixedValue >= price) {
                response.status(400).json({
                    ok: false,
                    productId,
                    reason: 'invalid_payload',
                    detail: 'Fixed discount must be smaller than the product price.',
                });
                return;
            }
        }
        await productRef.update({
            discountType: discount.discountType,
            discountValue: discount.discountValue,
        });
        response.status(200).json({
            ok: true,
            productId,
            reason: 'saved',
        });
    }
    catch (error) {
        response.status(500).json({
            ok: false,
            productId: productId || null,
            reason: 'internal_error',
            detail: error instanceof Error ? error.message : 'Unknown backend error.',
        });
    }
});
export const deleteProductsAdmin = onRequest({
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).json({
            ok: false,
            productId: null,
            reason: 'invalid_method',
        });
        return;
    }
    const botToken = telegramBotToken.value();
    if (!botToken) {
        response.status(500).json({
            ok: false,
            productId: null,
            reason: 'missing_bot_token',
        });
        return;
    }
    const body = request.body;
    const initData = typeof body?.initData === 'string' ? body.initData : '';
    const productIds = body?.productIds?.filter((productId) => typeof productId === 'string' && productId.trim().length > 0) ?? [];
    if (productIds.length === 0) {
        response.status(400).json({
            ok: false,
            productId: null,
            reason: 'invalid_payload',
        });
        return;
    }
    const verificationResult = verifyTelegramInitData(initData, botToken);
    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
        response.status(401).json({
            ok: false,
            productId: null,
            reason: verificationResult.reason === 'expired_init_data'
                ? 'expired_init_data'
                : 'invalid_init_data',
        });
        return;
    }
    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
        response.status(403).json({
            ok: false,
            productId: null,
            reason: 'forbidden',
        });
        return;
    }
    try {
        const batch = getFirestore().batch();
        productIds.forEach((productId) => {
            batch.delete(getFirestore().collection('products').doc(productId));
        });
        await batch.commit();
        response.status(200).json({
            ok: true,
            productId: productIds[0] ?? null,
            reason: 'deleted',
        });
    }
    catch (error) {
        response.status(500).json({
            ok: false,
            productId: productIds[0] ?? null,
            reason: 'internal_error',
            detail: error instanceof Error ? error.message : 'Unknown backend error.',
        });
    }
});
export const updateProductSignal = onRequest({
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).json({
            ok: false,
            productId: null,
            signal: null,
            reason: 'invalid_method',
        });
        return;
    }
    const botToken = telegramBotToken.value();
    if (!botToken) {
        response.status(500).json({
            ok: false,
            productId: null,
            signal: null,
            reason: 'missing_bot_token',
        });
        return;
    }
    const body = request.body;
    const initData = typeof body?.initData === 'string' ? body.initData : '';
    const productId = typeof body?.productId === 'string' ? body.productId.trim() : '';
    const signal = body?.signal;
    const delta = body?.delta;
    if (!productId || !isProductSignal(signal) || !isSignalDelta(delta)) {
        response.status(400).json({
            ok: false,
            productId: productId || null,
            signal: isProductSignal(signal) ? signal : null,
            reason: 'invalid_payload',
        });
        return;
    }
    const verificationResult = verifyTelegramInitData(initData, botToken);
    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
        response.status(401).json({
            ok: false,
            productId,
            signal,
            reason: verificationResult.reason === 'expired_init_data'
                ? 'expired_init_data'
                : 'invalid_init_data',
        });
        return;
    }
    try {
        const db = getFirestore();
        const result = await applyProductSignalTransaction(db, {
            productId,
            telegramUserId: verificationResult.user.id,
            signal,
            delta,
        });
        if (result.status === 'product_not_found') {
            response.status(404).json({
                ok: false,
                productId,
                signal,
                reason: 'product_not_found',
                detail: 'PRODUCT_NOT_FOUND',
            });
            return;
        }
        response.status(200).json({
            ok: true,
            productId,
            signal,
            reason: result.status,
        });
    }
    catch (error) {
        const detail = error instanceof Error ? error.message : 'Unknown backend error.';
        response.status(500).json({
            ok: false,
            productId,
            signal,
            reason: 'internal_error',
            detail,
        });
    }
});
export const uploadProductImageAdmin = onRequest({
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).json({
            ok: false,
            imageUrl: null,
            storagePath: null,
            reason: 'invalid_method',
        });
        return;
    }
    const botToken = telegramBotToken.value();
    if (!botToken) {
        response.status(500).json({
            ok: false,
            imageUrl: null,
            storagePath: null,
            reason: 'missing_bot_token',
        });
        return;
    }
    const body = request.body;
    const initData = typeof body?.initData === 'string' ? body.initData : '';
    const fileName = typeof body?.fileName === 'string' ? body.fileName.trim() : '';
    const contentType = typeof body?.contentType === 'string' ? body.contentType.trim() : '';
    const base64Data = typeof body?.base64Data === 'string' ? body.base64Data.trim() : '';
    if (!isValidUploadImagePayload({ fileName, contentType, base64Data })) {
        response.status(400).json({
            ok: false,
            imageUrl: null,
            storagePath: null,
            reason: 'invalid_payload',
        });
        return;
    }
    const verificationResult = verifyTelegramInitData(initData, botToken);
    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
        response.status(401).json({
            ok: false,
            imageUrl: null,
            storagePath: null,
            reason: verificationResult.reason === 'expired_init_data'
                ? 'expired_init_data'
                : 'invalid_init_data',
        });
        return;
    }
    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
        response.status(403).json({
            ok: false,
            imageUrl: null,
            storagePath: null,
            reason: 'forbidden',
        });
        return;
    }
    try {
        const safeName = sanitizeStorageFileName(fileName);
        const storagePath = `products/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
        const downloadToken = crypto.randomUUID();
        const buffer = Buffer.from(base64Data, 'base64');
        if (buffer.byteLength === 0 || buffer.byteLength > 5 * 1024 * 1024) {
            response.status(400).json({
                ok: false,
                imageUrl: null,
                storagePath: null,
                reason: 'invalid_payload',
                detail: 'Image must be greater than 0 bytes and smaller than 5 MB.',
            });
            return;
        }
        const bucket = getStorage().bucket();
        const file = bucket.file(storagePath);
        await file.save(buffer, {
            metadata: {
                contentType,
                metadata: {
                    firebaseStorageDownloadTokens: downloadToken,
                },
            },
        });
        response.status(200).json({
            ok: true,
            imageUrl: buildFirebaseDownloadUrl(bucket.name, storagePath, downloadToken),
            storagePath,
            reason: 'uploaded',
        });
    }
    catch (error) {
        response.status(500).json({
            ok: false,
            imageUrl: null,
            storagePath: null,
            reason: 'internal_error',
            detail: error instanceof Error ? error.message : 'Unknown backend error.',
        });
    }
});
export const deleteProductImagesAdmin = onRequest({
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).json({
            ok: false,
            deletedCount: 0,
            reason: 'invalid_method',
        });
        return;
    }
    const botToken = telegramBotToken.value();
    if (!botToken) {
        response.status(500).json({
            ok: false,
            deletedCount: 0,
            reason: 'missing_bot_token',
        });
        return;
    }
    const body = request.body;
    const initData = typeof body?.initData === 'string' ? body.initData : '';
    const imageUrls = body?.imageUrls?.filter((imageUrl) => typeof imageUrl === 'string' && imageUrl.trim().length > 0) ?? [];
    if (imageUrls.length === 0) {
        response.status(400).json({
            ok: false,
            deletedCount: 0,
            reason: 'invalid_payload',
        });
        return;
    }
    const verificationResult = verifyTelegramInitData(initData, botToken);
    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
        response.status(401).json({
            ok: false,
            deletedCount: 0,
            reason: verificationResult.reason === 'expired_init_data'
                ? 'expired_init_data'
                : 'invalid_init_data',
        });
        return;
    }
    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
        response.status(403).json({
            ok: false,
            deletedCount: 0,
            reason: 'forbidden',
        });
        return;
    }
    try {
        const bucket = getStorage().bucket();
        const storagePaths = imageUrls
            .map((imageUrl) => parseStoragePathFromImageUrl(imageUrl, bucket.name))
            .filter((storagePath) => Boolean(storagePath));
        await Promise.all(storagePaths.map((storagePath) => bucket.file(storagePath).delete({ ignoreNotFound: true })));
        response.status(200).json({
            ok: true,
            deletedCount: storagePaths.length,
            reason: 'deleted',
        });
    }
    catch (error) {
        response.status(500).json({
            ok: false,
            deletedCount: 0,
            reason: 'internal_error',
            detail: error instanceof Error ? error.message : 'Unknown backend error.',
        });
    }
});
// ── Campaign Admin Functions ──
