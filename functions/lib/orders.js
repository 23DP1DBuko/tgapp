// ── Orders Module ──
import { onRequest } from 'firebase-functions/v2/https';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { telegramBotToken, telegramMiniAppUrl, isOrderStatus, readAdminIdsFromEnv, verifyTelegramInitData, toApiOrder, isValidCheckoutOrderPayload, isValidOrderTransition, sendTelegramOrderCancelledMessage, sendTelegramOrderPaidMessage, sendTelegramOrderReadyForMeetupMessage, sendTelegramOrderCompletedMessage, sendTelegramOrderCreatedMessage, countReferralsExcludingSelf, applyProductDiscount, } from './helpers.js';
/**
 * Thrown when a checkout is submitted with a clientOrderId that already has an
 * order — the retry / double-tap / lost-response path. The caller returns the
 * existing order id instead of creating a duplicate (M4 idempotency).
 */
export class DuplicateCheckoutError extends Error {
    existingOrderId;
    existingOwnerId;
    constructor(existingOrderId, existingOwnerId) {
        super(`Duplicate checkout: order ${existingOrderId} already exists.`);
        this.name = 'DuplicateCheckoutError';
        this.existingOrderId = existingOrderId;
        this.existingOwnerId = existingOwnerId;
    }
}
export function computePromoDiscount(promo, subtotal) {
    if (!Number.isFinite(subtotal) || subtotal <= 0)
        return 0;
    const rawDiscount = promo.discountType === 'percentage'
        ? Number(((subtotal * promo.discountValue) / 100).toFixed(2))
        : promo.discountValue;
    return Math.min(subtotal, Math.max(0, rawDiscount));
}
export function validateCheckoutPromo(promo, submitted, subtotal, nowMs) {
    if (!submitted) {
        return { status: 'valid', discountAmount: 0 };
    }
    if (!promo) {
        return { status: 'promo_invalid' };
    }
    if (promo.isActive !== true) {
        return { status: 'promo_inactive' };
    }
    const expiresMs = promo.expiresAt
        ? typeof promo.expiresAt === 'object' && 'toMillis' in promo.expiresAt
            ? promo.expiresAt.toMillis()
            : promo.expiresAt.getTime()
        : null;
    if (expiresMs !== null && expiresMs <= nowMs) {
        return { status: 'promo_expired' };
    }
    const usageLimit = promo.usageLimit ?? null;
    const usageCount = promo.usageCount ?? 0;
    if (typeof usageLimit === 'number' && usageCount >= usageLimit) {
        return { status: 'promo_exhausted' };
    }
    if (promo.discountType !== submitted.discountType ||
        promo.discountValue !== submitted.discountValue) {
        return { status: 'promo_invalid' };
    }
    const discountAmount = computePromoDiscount({ discountType: submitted.discountType, discountValue: submitted.discountValue }, subtotal);
    if (submitted.discountAmount !== discountAmount) {
        return { status: 'promo_invalid' };
    }
    return { status: 'valid', discountAmount };
}
/**
 * Compute the set of product ids locked as giveaway prizes.
 *
 * A prize product is locked when its giveaway is not a `draft` (still being
 * edited) and the admin has not enabled `prizesForSale` (e.g. the winner
 * declined after the draw). This mirrors the storefront's badge logic, but
 * enforced server-side at checkout so a crafted or stale cart can never
 * purchase a prize.
 */
export function buildGiveawayLockedProductIds(giveawaySnapshots) {
    const lockedProductIds = new Set();
    for (const giveawaySnapshot of giveawaySnapshots) {
        const giveawayData = giveawaySnapshot.data();
        if (!giveawaySnapshot.exists || !giveawayData)
            continue;
        if (giveawayData.status === 'draft' || giveawayData.prizesForSale === true)
            continue;
        for (const prize of giveawayData.prizes ?? []) {
            if (typeof prize?.productId === 'string' && prize.productId) {
                lockedProductIds.add(prize.productId);
            }
        }
    }
    return lockedProductIds;
}
/**
 * Initial order status derived server-side (H2): the client-supplied status is
 * never trusted at creation. USDT orders start `waiting_for_payment`, every
 * other payment method starts `new`.
 */
export function getInitialOrderStatus(paymentMethod) {
    return paymentMethod === 'usdt' ? 'waiting_for_payment' : 'new';
}
/**
 * Builds the stored order document, enforcing server-side invariants:
 * - `status` is always derived from the payment method (never taken from the request)
 * - `telegramUserId` is always the verified buyer id (never client-supplied)
 */
export function buildOrderDocument(body, verifiedTelegramUserId, serverSubtotal, serverTotal) {
    return {
        clientOrderId: body.clientOrderId,
        fullName: body.fullName.trim(),
        telegramHandle: body.telegramHandle.trim(),
        telegramUserId: verifiedTelegramUserId,
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
        subtotal: serverSubtotal,
        appliedPromo: body.appliedPromo,
        total: serverTotal,
        status: getInitialOrderStatus(body.paymentMethod),
        cancelReason: body.cancelReason,
        createdAt: FieldValue.serverTimestamp(),
    };
}
export const updateOrderStatusAdmin = onRequest({
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).json({
            ok: false,
            orderId: null,
            status: null,
            reason: 'invalid_method',
        });
        return;
    }
    const botToken = telegramBotToken.value();
    if (!botToken) {
        response.status(500).json({
            ok: false,
            orderId: null,
            status: null,
            reason: 'missing_bot_token',
        });
        return;
    }
    const body = request.body;
    const initData = typeof body?.initData === 'string' ? body.initData : '';
    const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : '';
    const status = body?.status;
    const cancelReason = typeof body?.cancelReason === 'string' ? body.cancelReason : '';
    if (!orderId ||
        !isOrderStatus(status) ||
        cancelReason.length > 500) {
        response.status(400).json({
            ok: false,
            orderId: orderId || null,
            status: isOrderStatus(status) ? status : null,
            reason: 'invalid_payload',
        });
        return;
    }
    const verificationResult = verifyTelegramInitData(initData, botToken);
    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
        response.status(401).json({
            ok: false,
            orderId,
            status,
            reason: verificationResult.reason === 'expired_init_data'
                ? 'expired_init_data'
                : 'invalid_init_data',
        });
        return;
    }
    const adminIds = readAdminIdsFromEnv();
    if (!adminIds.includes(verificationResult.user.id)) {
        response.status(403).json({
            ok: false,
            orderId,
            status,
            reason: 'forbidden',
        });
        return;
    }
    try {
        const orderRef = getFirestore().collection('orders').doc(orderId);
        const orderSnapshot = await orderRef.get();
        if (!orderSnapshot.exists) {
            response.status(404).json({
                ok: false,
                orderId,
                status,
                reason: 'order_not_found',
            });
            return;
        }
        const orderData = orderSnapshot.data();
        const currentStatus = orderData?.status ?? '';
        // Validate status transition
        if (!isValidOrderTransition(currentStatus, status)) {
            response.status(409).json({
                ok: false,
                orderId,
                status,
                reason: 'invalid_transition',
                detail: `Cannot transition from "${currentStatus}" to "${status}".`,
            });
            return;
        }
        await orderRef.update({
            status,
            cancelReason,
        });
        if (orderData?.telegramUserId) {
            if (status === 'cancelled') {
                await sendTelegramOrderCancelledMessage(botToken, orderData.telegramUserId, orderId, cancelReason);
            }
            if (status === 'paid') {
                await sendTelegramOrderPaidMessage(botToken, orderData.telegramUserId, orderId);
            }
            if (status === 'ready_for_meetup') {
                await sendTelegramOrderReadyForMeetupMessage(botToken, orderData.telegramUserId, orderId);
            }
            if (status === 'completed') {
                await sendTelegramOrderCompletedMessage(botToken, orderData.telegramUserId, orderId);
            }
        }
        response.status(200).json({
            ok: true,
            orderId,
            status,
            reason: 'updated',
        });
    }
    catch (error) {
        response.status(500).json({
            ok: false,
            orderId,
            status,
            reason: 'internal_error',
            detail: error instanceof Error ? error.message : 'Unknown backend error.',
        });
    }
});
export const listOrdersAdmin = onRequest({
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).json({
            ok: false,
            orders: [],
            reason: 'invalid_method',
        });
        return;
    }
    const botToken = telegramBotToken.value();
    if (!botToken) {
        response.status(500).json({
            ok: false,
            orders: [],
            reason: 'missing_bot_token',
        });
        return;
    }
    const body = request.body;
    const initData = typeof body?.initData === 'string' ? body.initData : '';
    const verificationResult = verifyTelegramInitData(initData, botToken);
    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
        response.status(401).json({
            ok: false,
            orders: [],
            reason: verificationResult.reason === 'expired_init_data'
                ? 'expired_init_data'
                : 'invalid_init_data',
        });
        return;
    }
    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
        response.status(403).json({
            ok: false,
            orders: [],
            reason: 'forbidden',
        });
        return;
    }
    try {
        const snapshot = await getFirestore()
            .collection('orders')
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();
        response.status(200).json({
            ok: true,
            orders: snapshot.docs.map((documentSnapshot) => toApiOrder(documentSnapshot.id, documentSnapshot.data())),
            reason: 'listed',
        });
    }
    catch (error) {
        response.status(500).json({
            ok: false,
            orders: [],
            reason: 'internal_error',
            detail: error instanceof Error ? error.message : 'Unknown backend error.',
        });
    }
});
export const createCheckoutOrder = onRequest({
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).json({
            ok: false,
            orderId: null,
            reason: 'invalid_method',
        });
        return;
    }
    const body = request.body;
    if (!isValidCheckoutOrderPayload(body)) {
        response.status(400).json({
            ok: false,
            orderId: null,
            reason: 'invalid_payload',
        });
        return;
    }
    const botToken = telegramBotToken.value();
    if (!botToken) {
        response.status(500).json({
            ok: false,
            orderId: null,
            reason: 'missing_bot_token',
        });
        return;
    }
    const initData = typeof body?.initData === 'string' ? body.initData : '';
    const verificationResult = verifyTelegramInitData(initData, botToken);
    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
        response.status(401).json({
            ok: false,
            orderId: null,
            reason: verificationResult.reason === 'expired_init_data'
                ? 'expired_init_data'
                : 'invalid_init_data',
        });
        return;
    }
    const verifiedTelegramUserId = verificationResult.user.id;
    try {
        const db = getFirestore();
        const productIds = body.items.map((item) => item.productId);
        // Deterministic order id = the client idempotency key, so a retried
        // submission maps to the same document and can never create a duplicate.
        const orderRef = db.collection('orders').doc(body.clientOrderId);
        // Look up the promo code document reference if a promo was applied
        const promoCode = body.appliedPromo?.code ?? '';
        let promoDocRef = null;
        if (promoCode) {
            const promoSnapshot = await db
                .collection('promoCodes')
                .where('code', '==', promoCode)
                .limit(1)
                .get();
            if (!promoSnapshot.empty) {
                promoDocRef = promoSnapshot.docs[0].ref;
            }
        }
        // Count referrals for the early-access eligibility check. Self-referrals
        // are excluded (H4): opening your own /start link must never unlock
        // early access.
        const referralCode = `ref_${verifiedTelegramUserId}`;
        const referralCount = await countReferralsExcludingSelf(db, referralCode);
        // Prize products of non-draft giveaways (unless the admin enabled
        // "prizes for sale") can never be bought — the storefront only hides
        // them, so the checkout enforces the same lock authoritatively.
        const giveawayRefs = (await db.collection('giveaways').get()).docs.map((documentSnapshot) => documentSnapshot.ref);
        const now = Date.now();
        await db.runTransaction(async (transaction) => {
            // Idempotency: if an order for this clientOrderId already exists, return
            // it instead of charging the promo / selling the products again. The
            // whole transaction aborts, so no duplicate side effects ever occur.
            const existingOrderSnapshot = await transaction.get(orderRef);
            if (existingOrderSnapshot.exists) {
                const existingOwnerId = existingOrderSnapshot.data()?.telegramUserId ?? null;
                if (existingOwnerId !== verifiedTelegramUserId) {
                    throw new Error('Checkout key belongs to another user');
                }
                throw new DuplicateCheckoutError(orderRef.id, existingOwnerId);
            }
            const productRefs = productIds.map((productId) => db.collection('products').doc(productId));
            const productSnapshots = await Promise.all(productRefs.map((productRef) => transaction.get(productRef)));
            // Re-read the giveaways inside the transaction so the lock set is
            // consistent with the product reads (same pattern as the promo ref).
            const giveawaySnapshots = await Promise.all(giveawayRefs.map((giveawayRef) => transaction.get(giveawayRef)));
            const giveawayLockedProductIds = buildGiveawayLockedProductIds(giveawaySnapshots);
            productSnapshots.forEach((productSnapshot, index) => {
                const productData = productSnapshot.data();
                if (!productSnapshot.exists || !productData?.isAvailable) {
                    throw new Error(`Product unavailable: ${productIds[index]}`);
                }
                // Giveaway prize lock: a product tied to a non-draft giveaway
                // (unless "prizes for sale" is on) is never purchasable, even via a
                // crafted or stale cart.
                if (giveawayLockedProductIds.has(productIds[index])) {
                    throw new Error(`Giveaway prize not for sale: ${productIds[index]}`);
                }
                // Admin "upcoming" flag: marked not-for-sale-yet, regardless of dates
                if (productData.upcoming === true) {
                    throw new Error(`Drop not started: ${productIds[index]}`);
                }
                // Scheduled drop check: before the earliest scheduled time, no one can buy
                const earlyAccessMs = productData.earlyAccessAt
                    ? new Date(productData.earlyAccessAt).getTime()
                    : null;
                const publicMs = productData.publicAt
                    ? new Date(productData.publicAt).getTime()
                    : null;
                const scheduledMs = earlyAccessMs !== null
                    ? publicMs !== null
                        ? Math.min(earlyAccessMs, publicMs)
                        : earlyAccessMs
                    : publicMs;
                if (scheduledMs !== null && now < scheduledMs) {
                    throw new Error(`Drop not started: ${productIds[index]}`);
                }
                if (earlyAccessMs !== null && now >= earlyAccessMs) {
                    const isPublic = publicMs !== null && now >= publicMs;
                    if (!isPublic && referralCount < 1) {
                        throw new Error(`Early access restricted: ${productIds[index]}`);
                    }
                }
                const requestedItem = body.items[index];
                // The client pays the discounted (effective) price, so the submitted
                // item price is validated against it — never the raw base price.
                const effectivePrice = applyProductDiscount(productData.price ?? 0, productData.discountType, productData.discountValue);
                if (effectivePrice !== requestedItem.price ||
                    productData.currency !== requestedItem.currency) {
                    throw new Error(`Product mismatch: ${productIds[index]}`);
                }
            });
            // Recompute the subtotal from verified (discounted) product prices
            // (never trust the client for money math) and enforce totals + promo
            // validity in-transaction.
            let serverSubtotal = 0;
            for (let i = 0; i < productSnapshots.length; i++) {
                const product = productSnapshots[i].data();
                serverSubtotal += applyProductDiscount(typeof product?.price === 'number' ? product.price : 0, product?.discountType, product?.discountValue);
            }
            let promoSnapshot = null;
            if (promoDocRef) {
                promoSnapshot = await transaction.get(promoDocRef);
            }
            const promoValidation = validateCheckoutPromo(promoSnapshot?.data(), body.appliedPromo, serverSubtotal, now);
            if (promoValidation.status !== 'valid') {
                throw new Error(`Promo rejected: ${promoValidation.status}`);
            }
            const serverTotal = Math.max(0, serverSubtotal - promoValidation.discountAmount);
            if (body.subtotal !== serverSubtotal || body.total !== serverTotal) {
                throw new Error('Checkout totals mismatch');
            }
            // Increment promo usage count only after the promo was validated
            if (promoDocRef) {
                transaction.update(promoDocRef, {
                    usageCount: FieldValue.increment(1),
                });
            }
            transaction.set(orderRef, buildOrderDocument(body, verifiedTelegramUserId, serverSubtotal, serverTotal));
            productRefs.forEach((productRef) => {
                transaction.update(productRef, {
                    isAvailable: false,
                    cartCount: FieldValue.increment(-1),
                });
            });
        });
        // Send order confirmation via Telegram (fire-and-forget)
        sendTelegramOrderCreatedMessage(botToken, telegramMiniAppUrl.value(), verifiedTelegramUserId, orderRef.id, body.items.map((i) => i.name).join(', '), body.total, body.fulfillmentType, getInitialOrderStatus(body.paymentMethod)).catch(() => {
            // Notification is best-effort; don't block the checkout response
        });
        response.status(200).json({
            ok: true,
            orderId: orderRef.id,
            reason: 'created',
        });
    }
    catch (error) {
        // Idempotent success: the order for this clientOrderId already exists
        // (retry / double-tap / lost response). Return the existing order id and
        // skip the confirmation message — it was sent on the first submission.
        if (error instanceof DuplicateCheckoutError) {
            response.status(200).json({
                ok: true,
                orderId: error.existingOrderId,
                reason: 'already_exists',
            });
            return;
        }
        const detail = error instanceof Error ? error.message : 'Unknown backend error.';
        let status = 500;
        let reason = 'internal_error';
        if (detail.startsWith('Checkout key belongs to another user')) {
            status = 400;
            reason = 'invalid_payload';
        }
        else if (detail.startsWith('Product unavailable:')) {
            status = 409;
            reason = 'product_unavailable';
        }
        else if (detail.startsWith('Product mismatch:')) {
            // Price changed server-side since the item was added to the cart (e.g.
            // the admin edited the price or set a discount) — refresh the catalog.
            status = 409;
            reason = 'product_unavailable';
        }
        else if (detail.startsWith('Giveaway prize not for sale:')) {
            status = 409;
            reason = 'giveaway_prize';
        }
        else if (detail.startsWith('Promo rejected: promo_exhausted')) {
            status = 409;
            reason = 'promo_exhausted';
        }
        else if (detail.startsWith('Promo rejected: promo_inactive')) {
            status = 409;
            reason = 'promo_inactive';
        }
        else if (detail.startsWith('Promo rejected: promo_expired')) {
            status = 409;
            reason = 'promo_expired';
        }
        else if (detail.startsWith('Promo rejected: promo_invalid')) {
            status = 400;
            reason = 'promo_invalid';
        }
        else if (detail.startsWith('Checkout totals mismatch')) {
            status = 400;
            reason = 'invalid_payload';
        }
        else if (detail.startsWith('Early access restricted:')) {
            status = 403;
            reason = 'early_access_restricted';
        }
        else if (detail.startsWith('Drop not started:')) {
            status = 403;
            reason = 'drop_not_started';
        }
        else if (detail.startsWith('Product reserved by another buyer:')) {
            status = 409;
            reason = 'product_unavailable';
        }
        response.status(status).json({
            ok: false,
            orderId: null,
            reason,
            detail,
        });
    }
});
export const listBuyerOrders = onRequest({
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).json({
            ok: false,
            orders: [],
            reason: 'invalid_method',
        });
        return;
    }
    const botToken = telegramBotToken.value();
    if (!botToken) {
        response.status(500).json({
            ok: false,
            orders: [],
            reason: 'missing_bot_token',
        });
        return;
    }
    const body = request.body;
    const initData = typeof body?.initData === 'string' ? body.initData : '';
    const verificationResult = verifyTelegramInitData(initData, botToken);
    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
        response.status(401).json({
            ok: false,
            orders: [],
            reason: verificationResult.reason === 'expired_init_data'
                ? 'expired_init_data'
                : 'invalid_init_data',
        });
        return;
    }
    try {
        const snapshot = await getFirestore()
            .collection('orders')
            .where('telegramUserId', '==', verificationResult.user.id)
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();
        response.status(200).json({
            ok: true,
            orders: snapshot.docs.map((documentSnapshot) => toApiOrder(documentSnapshot.id, documentSnapshot.data())),
            reason: 'listed',
        });
    }
    catch (error) {
        response.status(500).json({
            ok: false,
            orders: [],
            reason: 'internal_error',
            detail: error instanceof Error ? error.message : 'Unknown backend error.',
        });
    }
});
