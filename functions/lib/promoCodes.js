// ── Promo Codes Module ──
import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { telegramBotToken, readAdminIdsFromEnv, verifyTelegramInitData, isValidPromoInput, } from './helpers.js';
export const upsertPromoCodeAdmin = onRequest({
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).json({
            ok: false,
            promoId: null,
            reason: 'invalid_method',
        });
        return;
    }
    const botToken = telegramBotToken.value();
    if (!botToken) {
        response.status(500).json({
            ok: false,
            promoId: null,
            reason: 'missing_bot_token',
        });
        return;
    }
    const body = request.body;
    const initData = typeof body?.initData === 'string' ? body.initData : '';
    const promoId = typeof body?.promoId === 'string' ? body.promoId.trim() : '';
    const promo = body?.promo;
    if (!isValidPromoInput(promo)) {
        response.status(400).json({
            ok: false,
            promoId: promoId || null,
            reason: 'invalid_payload',
        });
        return;
    }
    const verificationResult = verifyTelegramInitData(initData, botToken);
    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
        response.status(401).json({
            ok: false,
            promoId: promoId || null,
            reason: verificationResult.reason === 'expired_init_data'
                ? 'expired_init_data'
                : 'invalid_init_data',
        });
        return;
    }
    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
        response.status(403).json({
            ok: false,
            promoId: promoId || null,
            reason: 'forbidden',
        });
        return;
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
        };
        if (promoId) {
            await getFirestore().collection('promoCodes').doc(promoId).set(payload, { merge: true });
        }
        else {
            const createdPromo = await getFirestore().collection('promoCodes').add(payload);
            response.status(200).json({
                ok: true,
                promoId: createdPromo.id,
                reason: 'saved',
            });
            return;
        }
        response.status(200).json({
            ok: true,
            promoId,
            reason: 'saved',
        });
    }
    catch (error) {
        response.status(500).json({
            ok: false,
            promoId: promoId || null,
            reason: 'internal_error',
            detail: error instanceof Error ? error.message : 'Unknown backend error.',
        });
    }
});
export const deletePromoCodesAdmin = onRequest({
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).json({
            ok: false,
            promoId: null,
            reason: 'invalid_method',
        });
        return;
    }
    const botToken = telegramBotToken.value();
    if (!botToken) {
        response.status(500).json({
            ok: false,
            promoId: null,
            reason: 'missing_bot_token',
        });
        return;
    }
    const body = request.body;
    const initData = typeof body?.initData === 'string' ? body.initData : '';
    const promoIds = body?.promoIds?.filter((promoId) => typeof promoId === 'string' && promoId.trim().length > 0) ?? [];
    if (promoIds.length === 0) {
        response.status(400).json({
            ok: false,
            promoId: null,
            reason: 'invalid_payload',
        });
        return;
    }
    const verificationResult = verifyTelegramInitData(initData, botToken);
    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
        response.status(401).json({
            ok: false,
            promoId: null,
            reason: verificationResult.reason === 'expired_init_data'
                ? 'expired_init_data'
                : 'invalid_init_data',
        });
        return;
    }
    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
        response.status(403).json({
            ok: false,
            promoId: null,
            reason: 'forbidden',
        });
        return;
    }
    try {
        const batch = getFirestore().batch();
        promoIds.forEach((promoId) => {
            batch.delete(getFirestore().collection('promoCodes').doc(promoId));
        });
        await batch.commit();
        response.status(200).json({
            ok: true,
            promoId: promoIds[0] ?? null,
            reason: 'deleted',
        });
    }
    catch (error) {
        response.status(500).json({
            ok: false,
            promoId: promoIds[0] ?? null,
            reason: 'internal_error',
            detail: error instanceof Error ? error.message : 'Unknown backend error.',
        });
    }
});
