// ── Orders Module ──
import { onRequest } from 'firebase-functions/v2/https';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { telegramBotToken, telegramMiniAppUrl, isOrderStatus, readAdminIdsFromEnv, verifyTelegramInitData, toApiOrder, isValidCheckoutOrderPayload, isValidOrderTransition, sendTelegramOrderCancelledMessage, sendTelegramOrderPaidMessage, sendTelegramOrderReadyForMeetupMessage, sendTelegramOrderCompletedMessage, sendTelegramOrderCreatedMessage, } from './helpers.js';
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
        const orderRef = db.collection('orders').doc();
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
        // Count referrals for early access eligibility check
        const referralCode = `ref_${verifiedTelegramUserId}`;
        const referredSnapshot = await db
            .collection('telegramSubscribers')
            .where('referredBy', '==', referralCode)
            .count()
            .get();
        const referralCount = referredSnapshot.data().count;
        const now = Date.now();
        await db.runTransaction(async (transaction) => {
            const productRefs = productIds.map((productId) => db.collection('products').doc(productId));
            const productSnapshots = await Promise.all(productRefs.map((productRef) => transaction.get(productRef)));
            productSnapshots.forEach((productSnapshot, index) => {
                const productData = productSnapshot.data();
                if (!productSnapshot.exists || !productData?.isAvailable) {
                    throw new Error(`Product unavailable: ${productIds[index]}`);
                }
                // Reservation check: if product is reserved by someone else, reject
                const reservedBy = productData.reservedBy ?? null;
                const reservedUntilMs = productData.reservedUntil?.toMillis() ?? null;
                if (reservedBy !== null && reservedUntilMs !== null && reservedUntilMs > now) {
                    if (reservedBy !== verifiedTelegramUserId) {
                        throw new Error(`Product reserved by another buyer: ${productIds[index]}`);
                    }
                    // Reserved by this user — allow checkout, reservation will be cleared below
                }
                // Early access window check
                const earlyAccessMs = productData.earlyAccessAt
                    ? new Date(productData.earlyAccessAt).getTime()
                    : null;
                const publicMs = productData.publicAt
                    ? new Date(productData.publicAt).getTime()
                    : null;
                if (earlyAccessMs !== null && now >= earlyAccessMs) {
                    const isPublic = publicMs !== null && now >= publicMs;
                    if (!isPublic && referralCount < 1) {
                        throw new Error(`Early access restricted: ${productIds[index]}`);
                    }
                }
                const requestedItem = body.items[index];
                if (productData.price !== requestedItem.price ||
                    productData.currency !== requestedItem.currency) {
                    throw new Error(`Product mismatch: ${productIds[index]}`);
                }
            });
            // Increment promo usage count inside the transaction
            if (promoDocRef) {
                const promoSnapshot = await transaction.get(promoDocRef);
                const promoData = promoSnapshot.data();
                if (promoData) {
                    const currentUsage = promoData.usageCount ?? 0;
                    const limit = promoData.usageLimit;
                    if (typeof limit === 'number' && currentUsage >= limit) {
                        throw new Error(`Promo usage exhausted: ${promoCode}`);
                    }
                    transaction.update(promoDocRef, {
                        usageCount: FieldValue.increment(1),
                    });
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
            });
            productRefs.forEach((productRef) => {
                transaction.update(productRef, {
                    isAvailable: false,
                    cartCount: FieldValue.increment(-1),
                    reservedBy: FieldValue.delete(),
                    reservedUntil: FieldValue.delete(),
                });
            });
        });
        // Send order confirmation via Telegram (fire-and-forget)
        sendTelegramOrderCreatedMessage(botToken, telegramMiniAppUrl.value(), verifiedTelegramUserId, orderRef.id, body.items.map((i) => i.name).join(', '), body.total, body.fulfillmentType, body.status).catch(() => {
            // Notification is best-effort; don't block the checkout response
        });
        response.status(200).json({
            ok: true,
            orderId: orderRef.id,
            reason: 'created',
        });
    }
    catch (error) {
        const detail = error instanceof Error ? error.message : 'Unknown backend error.';
        let status = 500;
        let reason = 'internal_error';
        if (detail.startsWith('Product unavailable:')) {
            status = 409;
            reason = 'product_unavailable';
        }
        else if (detail.startsWith('Promo usage exhausted:')) {
            status = 409;
            reason = 'promo_exhausted';
        }
        else if (detail.startsWith('Early access restricted:')) {
            status = 403;
            reason = 'early_access_restricted';
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
