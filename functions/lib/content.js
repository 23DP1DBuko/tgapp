// ── Content Module ── (Campaigns, Tasks, Notify, Referral, Broadcast, Admin)
import { onRequest } from 'firebase-functions/v2/https';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { telegramBotToken, telegramWebhookSecret, readAdminIdsFromEnv, verifyTelegramInitData, isValidCampaignInput, isValidTaskInput, sendTelegramBroadcastMessage, upsertTelegramSubscriberFromUpdate, sendTelegramStoreWelcomeMessage, sendTelegramStoreShortcutMessage, sendTelegramHelpMessage, isStartCommand, isStoreCommand, isHelpCommand, parseReferralCode, processAndCheckRewards, } from './helpers.js';
export const verifyTelegramAdmin = onRequest({
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).json({
            ok: false,
            isAdmin: false,
            telegramUserId: null,
            reason: 'invalid_method',
        });
        return;
    }
    const botToken = telegramBotToken.value();
    if (!botToken) {
        response.status(500).json({
            ok: false,
            isAdmin: false,
            telegramUserId: null,
            reason: 'missing_bot_token',
        });
        return;
    }
    const body = request.body;
    const initData = typeof body?.initData === 'string' ? body.initData : '';
    const verificationResult = verifyTelegramInitData(initData, botToken);
    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
        const failureReason = verificationResult.reason === 'ok' ? 'invalid_init_data' : verificationResult.reason;
        response.status(verificationResult.reason === 'expired_init_data' ? 401 : 400).json({
            ok: false,
            isAdmin: false,
            telegramUserId: null,
            reason: failureReason,
        });
        return;
    }
    const adminIds = readAdminIdsFromEnv();
    const isAdmin = adminIds.includes(verificationResult.user.id);
    response.status(200).json({
        ok: true,
        isAdmin,
        telegramUserId: verificationResult.user.id,
        reason: isAdmin ? 'verified_admin' : 'verified_non_admin',
    });
});
export const telegramBotWebhook = onRequest({
    cors: false,
    invoker: 'public',
    secrets: [telegramBotToken, telegramWebhookSecret],
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).send('Method Not Allowed');
        return;
    }
    const botToken = telegramBotToken.value();
    const webhookSecret = telegramWebhookSecret.value();
    if (!botToken || !webhookSecret) {
        response.status(500).send('Webhook is not configured.');
        return;
    }
    const requestSecret = request.header('X-Telegram-Bot-Api-Secret-Token');
    if (requestSecret !== webhookSecret) {
        response.status(403).send('Forbidden');
        return;
    }
    const body = request.body;
    const messageText = body?.message?.text?.trim() ?? '';
    const chatId = body?.message?.chat?.id;
    if (!chatId || !messageText) {
        response.status(200).json({ ok: true, ignored: true });
        return;
    }
    if (isStartCommand(messageText)) {
        const referralCode = parseReferralCode(messageText);
        await upsertTelegramSubscriberFromUpdate(body, referralCode);
        try {
            await sendTelegramStoreWelcomeMessage(botToken, chatId, body?.message?.from?.first_name);
        }
        catch (error) {
            response.status(500).json({
                ok: false,
                reason: 'send_failed',
                detail: error instanceof Error ? error.message : 'Unknown webhook error.',
            });
            return;
        }
    }
    if (isStoreCommand(messageText)) {
        try {
            await sendTelegramStoreShortcutMessage(botToken, chatId);
        }
        catch (error) {
            response.status(500).json({
                ok: false,
                reason: 'send_failed',
                detail: error instanceof Error ? error.message : 'Unknown webhook error.',
            });
            return;
        }
    }
    if (isHelpCommand(messageText)) {
        try {
            await sendTelegramHelpMessage(botToken, chatId);
        }
        catch (error) {
            response.status(500).json({
                ok: false,
                reason: 'send_failed',
                detail: error instanceof Error ? error.message : 'Unknown webhook error.',
            });
            return;
        }
    }
    response.status(200).json({ ok: true });
});
export const broadcastMessageAdmin = onRequest({
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).json({
            ok: false,
            sentCount: 0,
            failedCount: 0,
            reason: 'invalid_method',
        });
        return;
    }
    const botToken = telegramBotToken.value();
    if (!botToken) {
        response.status(500).json({
            ok: false,
            sentCount: 0,
            failedCount: 0,
            reason: 'missing_bot_token',
        });
        return;
    }
    const body = request.body;
    const initData = typeof body?.initData === 'string' ? body.initData : '';
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (!text || text.length > 2000) {
        response.status(400).json({
            ok: false,
            sentCount: 0,
            failedCount: 0,
            reason: 'invalid_payload',
        });
        return;
    }
    const verificationResult = verifyTelegramInitData(initData, botToken);
    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
        response.status(401).json({
            ok: false,
            sentCount: 0,
            failedCount: 0,
            reason: verificationResult.reason === 'expired_init_data'
                ? 'expired_init_data'
                : 'invalid_init_data',
        });
        return;
    }
    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
        response.status(403).json({
            ok: false,
            sentCount: 0,
            failedCount: 0,
            reason: 'forbidden',
        });
        return;
    }
    try {
        const db = getFirestore();
        const snapshot = await db
            .collection('telegramSubscribers')
            .where('allowBroadcasts', '==', true)
            .get();
        let sentCount = 0;
        let failedCount = 0;
        for (const doc of snapshot.docs) {
            const data = doc.data();
            const chatId = typeof data.chatId === 'number' ? data.chatId : null;
            if (!chatId)
                continue;
            try {
                await sendTelegramBroadcastMessage(botToken, chatId, text);
                sentCount += 1;
            }
            catch {
                failedCount += 1;
            }
        }
        const createdBy = typeof verificationResult.user.id === 'number'
            ? verificationResult.user.id
            : null;
        const reason = 'broadcast_sent';
        let broadcastId = null;
        try {
            const broadcastRef = await db.collection('broadcasts').add({
                createdAt: FieldValue.serverTimestamp(),
                createdBy,
                sentCount,
                failedCount,
                reason,
                text,
            });
            broadcastId = broadcastRef.id;
        }
        catch (error) {
            console.error('Failed to log broadcast to Firestore', error);
        }
        response.status(200).json({
            ok: true,
            sentCount,
            failedCount,
            broadcastId: broadcastId ?? undefined,
            reason,
        });
    }
    catch (error) {
        response.status(500).json({
            ok: false,
            sentCount: 0,
            failedCount: 0,
            reason: 'internal_error',
            detail: error instanceof Error ? error.message : 'Unknown backend error.',
        });
    }
});
export const upsertCampaignAdmin = onRequest({
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).json({
            ok: false,
            campaignId: null,
            reason: 'invalid_method',
        });
        return;
    }
    const botToken = telegramBotToken.value();
    if (!botToken) {
        response.status(500).json({
            ok: false,
            campaignId: null,
            reason: 'missing_bot_token',
        });
        return;
    }
    const body = request.body;
    const initData = typeof body?.initData === 'string' ? body.initData : '';
    const campaignId = typeof body?.campaignId === 'string' ? body.campaignId.trim() : '';
    const campaign = body?.campaign;
    if (!isValidCampaignInput(campaign)) {
        response.status(400).json({
            ok: false,
            campaignId: campaignId || null,
            reason: 'invalid_payload',
        });
        return;
    }
    const verificationResult = verifyTelegramInitData(initData, botToken);
    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
        response.status(401).json({
            ok: false,
            campaignId: campaignId || null,
            reason: verificationResult.reason === 'expired_init_data'
                ? 'expired_init_data'
                : 'invalid_init_data',
        });
        return;
    }
    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
        response.status(403).json({
            ok: false,
            campaignId: campaignId || null,
            reason: 'forbidden',
        });
        return;
    }
    try {
        const payload = {
            tag: campaign.tag.trim(),
            headingPart1: campaign.headingPart1.trim(),
            headingPart2: campaign.headingPart2.trim(),
            subtitle: campaign.subtitle.trim(),
            imageUrl: campaign.imageUrl.trim(),
            isActive: campaign.isActive,
            sortOrder: campaign.sortOrder,
            updatedAt: new Date().toISOString(),
        };
        if (campaignId) {
            await getFirestore().collection('campaigns').doc(campaignId).set(payload, { merge: true });
            response.status(200).json({
                ok: true,
                campaignId,
                reason: 'saved',
            });
            return;
        }
        const createdCampaign = await getFirestore().collection('campaigns').add({
            ...payload,
            createdAt: new Date().toISOString(),
        });
        response.status(200).json({
            ok: true,
            campaignId: createdCampaign.id,
            reason: 'saved',
        });
    }
    catch (error) {
        response.status(500).json({
            ok: false,
            campaignId: campaignId || null,
            reason: 'internal_error',
            detail: error instanceof Error ? error.message : 'Unknown backend error.',
        });
    }
});
export const deleteCampaignsAdmin = onRequest({
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).json({
            ok: false,
            campaignId: null,
            reason: 'invalid_method',
        });
        return;
    }
    const botToken = telegramBotToken.value();
    if (!botToken) {
        response.status(500).json({
            ok: false,
            campaignId: null,
            reason: 'missing_bot_token',
        });
        return;
    }
    const body = request.body;
    const initData = typeof body?.initData === 'string' ? body.initData : '';
    const campaignIds = body?.campaignIds?.filter((id) => typeof id === 'string' && id.trim().length > 0) ?? [];
    if (campaignIds.length === 0) {
        response.status(400).json({
            ok: false,
            campaignId: null,
            reason: 'invalid_payload',
        });
        return;
    }
    const verificationResult = verifyTelegramInitData(initData, botToken);
    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
        response.status(401).json({
            ok: false,
            campaignId: null,
            reason: verificationResult.reason === 'expired_init_data'
                ? 'expired_init_data'
                : 'invalid_init_data',
        });
        return;
    }
    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
        response.status(403).json({
            ok: false,
            campaignId: null,
            reason: 'forbidden',
        });
        return;
    }
    try {
        const batch = getFirestore().batch();
        campaignIds.forEach((id) => {
            batch.delete(getFirestore().collection('campaigns').doc(id));
        });
        await batch.commit();
        response.status(200).json({
            ok: true,
            campaignId: campaignIds[0] ?? null,
            reason: 'deleted',
        });
    }
    catch (error) {
        response.status(500).json({
            ok: false,
            campaignId: campaignIds[0] ?? null,
            reason: 'internal_error',
            detail: error instanceof Error ? error.message : 'Unknown backend error.',
        });
    }
});
export const reorderCampaignsAdmin = onRequest({
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).json({
            ok: false,
            campaignId: null,
            reason: 'invalid_method',
        });
        return;
    }
    const botToken = telegramBotToken.value();
    if (!botToken) {
        response.status(500).json({
            ok: false,
            campaignId: null,
            reason: 'missing_bot_token',
        });
        return;
    }
    const body = request.body;
    const initData = typeof body?.initData === 'string' ? body.initData : '';
    const orderedIds = body?.orderedIds?.filter((id) => typeof id === 'string' && id.trim().length > 0) ?? [];
    if (orderedIds.length === 0) {
        response.status(400).json({
            ok: false,
            campaignId: null,
            reason: 'invalid_payload',
        });
        return;
    }
    const verificationResult = verifyTelegramInitData(initData, botToken);
    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
        response.status(401).json({
            ok: false,
            campaignId: null,
            reason: verificationResult.reason === 'expired_init_data'
                ? 'expired_init_data'
                : 'invalid_init_data',
        });
        return;
    }
    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
        response.status(403).json({
            ok: false,
            campaignId: null,
            reason: 'forbidden',
        });
        return;
    }
    try {
        const db = getFirestore();
        const now = new Date().toISOString();
        const updates = orderedIds.map((id, index) => db.collection('campaigns').doc(id).update({
            sortOrder: index,
            updatedAt: now,
        }));
        await Promise.all(updates);
        response.status(200).json({
            ok: true,
            campaignId: orderedIds[0] ?? null,
            reason: 'reordered',
        });
    }
    catch (error) {
        response.status(500).json({
            ok: false,
            campaignId: orderedIds[0] ?? null,
            reason: 'internal_error',
            detail: error instanceof Error ? error.message : 'Unknown backend error.',
        });
    }
});
// ── Task Admin Functions ──
export const upsertTaskAdmin = onRequest({
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).json({
            ok: false,
            taskId: null,
            reason: 'invalid_method',
        });
        return;
    }
    const botToken = telegramBotToken.value();
    if (!botToken) {
        response.status(500).json({
            ok: false,
            taskId: null,
            reason: 'missing_bot_token',
        });
        return;
    }
    const body = request.body;
    const initData = typeof body?.initData === 'string' ? body.initData : '';
    const taskId = typeof body?.taskId === 'string' ? body.taskId.trim() : '';
    const task = body?.task;
    if (!isValidTaskInput(task)) {
        response.status(400).json({
            ok: false,
            taskId: taskId || null,
            reason: 'invalid_payload',
        });
        return;
    }
    const verificationResult = verifyTelegramInitData(initData, botToken);
    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
        response.status(401).json({
            ok: false,
            taskId: taskId || null,
            reason: verificationResult.reason === 'expired_init_data'
                ? 'expired_init_data'
                : 'invalid_init_data',
        });
        return;
    }
    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
        response.status(403).json({
            ok: false,
            taskId: taskId || null,
            reason: 'forbidden',
        });
        return;
    }
    try {
        const payload = {
            title: task.title.trim(),
            rewardType: task.rewardType,
            rewardValue: task.rewardValue.trim(),
            status: task.status,
            sortOrder: task.sortOrder,
            updatedAt: new Date().toISOString(),
        };
        if (task.actionUrl?.trim()) {
            payload.actionUrl = task.actionUrl.trim();
        }
        if (task.actionLabel?.trim()) {
            payload.actionLabel = task.actionLabel.trim();
        }
        if (taskId) {
            await getFirestore().collection('tasks').doc(taskId).set(payload, { merge: true });
            response.status(200).json({
                ok: true,
                taskId,
                reason: 'saved',
            });
            return;
        }
        const createdTask = await getFirestore().collection('tasks').add({
            ...payload,
            createdAt: new Date().toISOString(),
        });
        response.status(200).json({
            ok: true,
            taskId: createdTask.id,
            reason: 'saved',
        });
    }
    catch (error) {
        response.status(500).json({
            ok: false,
            taskId: taskId || null,
            reason: 'internal_error',
            detail: error instanceof Error ? error.message : 'Unknown backend error.',
        });
    }
});
export const deleteTasksAdmin = onRequest({
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).json({
            ok: false,
            taskId: null,
            reason: 'invalid_method',
        });
        return;
    }
    const botToken = telegramBotToken.value();
    if (!botToken) {
        response.status(500).json({
            ok: false,
            taskId: null,
            reason: 'missing_bot_token',
        });
        return;
    }
    const body = request.body;
    const initData = typeof body?.initData === 'string' ? body.initData : '';
    const taskIds = body?.taskIds?.filter((id) => typeof id === 'string' && id.trim().length > 0) ?? [];
    if (taskIds.length === 0) {
        response.status(400).json({
            ok: false,
            taskId: null,
            reason: 'invalid_payload',
        });
        return;
    }
    const verificationResult = verifyTelegramInitData(initData, botToken);
    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
        response.status(401).json({
            ok: false,
            taskId: null,
            reason: verificationResult.reason === 'expired_init_data'
                ? 'expired_init_data'
                : 'invalid_init_data',
        });
        return;
    }
    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
        response.status(403).json({
            ok: false,
            taskId: null,
            reason: 'forbidden',
        });
        return;
    }
    try {
        const batch = getFirestore().batch();
        taskIds.forEach((id) => {
            batch.delete(getFirestore().collection('tasks').doc(id));
        });
        await batch.commit();
        response.status(200).json({
            ok: true,
            taskId: taskIds[0] ?? null,
            reason: 'deleted',
        });
    }
    catch (error) {
        response.status(500).json({
            ok: false,
            taskId: taskIds[0] ?? null,
            reason: 'internal_error',
            detail: error instanceof Error ? error.message : 'Unknown backend error.',
        });
    }
});
// ── Giveaway Admin Functions ──
export const subscribeToNotify = onRequest({
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).json({
            ok: false,
            reason: 'invalid_method',
        });
        return;
    }
    const botToken = telegramBotToken.value();
    if (!botToken) {
        response.status(500).json({
            ok: false,
            reason: 'missing_bot_token',
        });
        return;
    }
    const body = request.body;
    const initData = typeof body?.initData === 'string' ? body.initData : '';
    const productId = typeof body?.productId === 'string' ? body.productId.trim() : '';
    if (!productId) {
        response.status(400).json({
            ok: false,
            reason: 'invalid_payload',
        });
        return;
    }
    const verificationResult = verifyTelegramInitData(initData, botToken);
    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
        response.status(401).json({
            ok: false,
            reason: verificationResult.reason === 'expired_init_data'
                ? 'expired_init_data'
                : 'invalid_init_data',
        });
        return;
    }
    const telegramUserId = verificationResult.user.id;
    try {
        const db = getFirestore();
        // Check if the product exists
        const productSnapshot = await db.collection('products').doc(productId).get();
        if (!productSnapshot.exists) {
            response.status(404).json({
                ok: false,
                reason: 'invalid_payload',
            });
            return;
        }
        // Check if already subscribed
        const existingSnapshot = await db
            .collection('productNotifySubscriptions')
            .where('telegramUserId', '==', telegramUserId)
            .where('productId', '==', productId)
            .limit(1)
            .get();
        if (!existingSnapshot.empty) {
            // Already subscribed — silently succeed
            response.status(200).json({
                ok: true,
                reason: 'subscribed',
            });
            return;
        }
        // Create subscription
        await db.collection('productNotifySubscriptions').add({
            telegramUserId,
            productId,
            subscribedAt: new Date().toISOString(),
            notifiedAt: null,
        });
        response.status(200).json({
            ok: true,
            reason: 'subscribed',
        });
    }
    catch (error) {
        response.status(500).json({
            ok: false,
            reason: 'internal_error',
            detail: error instanceof Error ? error.message : 'Unknown backend error.',
        });
    }
});
export const unsubscribeFromNotify = onRequest({
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).json({
            ok: false,
            reason: 'invalid_method',
        });
        return;
    }
    const botToken = telegramBotToken.value();
    if (!botToken) {
        response.status(500).json({
            ok: false,
            reason: 'missing_bot_token',
        });
        return;
    }
    const body = request.body;
    const initData = typeof body?.initData === 'string' ? body.initData : '';
    const productId = typeof body?.productId === 'string' ? body.productId.trim() : '';
    if (!productId) {
        response.status(400).json({
            ok: false,
            reason: 'invalid_payload',
        });
        return;
    }
    const verificationResult = verifyTelegramInitData(initData, botToken);
    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
        response.status(401).json({
            ok: false,
            reason: verificationResult.reason === 'expired_init_data'
                ? 'expired_init_data'
                : 'invalid_init_data',
        });
        return;
    }
    const telegramUserId = verificationResult.user.id;
    try {
        const db = getFirestore();
        // Find subscription
        const existingSnapshot = await db
            .collection('productNotifySubscriptions')
            .where('telegramUserId', '==', telegramUserId)
            .where('productId', '==', productId)
            .limit(1)
            .get();
        if (existingSnapshot.empty) {
            // Not subscribed — silently succeed
            response.status(200).json({
                ok: true,
                reason: 'unsubscribed',
            });
            return;
        }
        // Delete subscription
        await db.collection('productNotifySubscriptions').doc(existingSnapshot.docs[0].id).delete();
        response.status(200).json({
            ok: true,
            reason: 'unsubscribed',
        });
    }
    catch (error) {
        response.status(500).json({
            ok: false,
            reason: 'internal_error',
            detail: error instanceof Error ? error.message : 'Unknown backend error.',
        });
    }
});
// ── Broadcast Subscription Functions ──
export const toggleBroadcastSubscription = onRequest({
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).json({
            ok: false,
            allowBroadcasts: false,
            reason: 'invalid_method',
        });
        return;
    }
    const botToken = telegramBotToken.value();
    if (!botToken) {
        response.status(500).json({
            ok: false,
            allowBroadcasts: false,
            reason: 'missing_bot_token',
        });
        return;
    }
    const body = request.body;
    const initData = typeof body?.initData === 'string' ? body.initData : '';
    const requestedValue = body?.allowBroadcasts;
    const verificationResult = verifyTelegramInitData(initData, botToken);
    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
        response.status(401).json({
            ok: false,
            allowBroadcasts: false,
            reason: verificationResult.reason === 'expired_init_data'
                ? 'expired_init_data'
                : 'invalid_init_data',
        });
        return;
    }
    const telegramUserId = verificationResult.user.id;
    try {
        const db = getFirestore();
        const docRef = db.collection('telegramSubscribers').doc(String(telegramUserId));
        const snapshot = await docRef.get();
        if (!snapshot.exists) {
            // No subscriber doc yet – create one with the requested value (default true)
            await docRef.set({
                telegramUserId,
                allowBroadcasts: requestedValue === undefined ? true : requestedValue,
                createdAt: FieldValue.serverTimestamp(),
                lastSeenAt: FieldValue.serverTimestamp(),
            });
            response.status(200).json({
                ok: true,
                allowBroadcasts: requestedValue === undefined ? true : requestedValue,
                reason: 'updated',
            });
            return;
        }
        const currentData = snapshot.data();
        const currentValue = typeof currentData.allowBroadcasts === 'boolean'
            ? currentData.allowBroadcasts
            : true;
        if (requestedValue === undefined) {
            // Read-only mode: return current status without modifying
            response.status(200).json({
                ok: true,
                allowBroadcasts: currentValue,
                reason: 'status',
            });
            return;
        }
        // Set mode: update to the requested value
        await docRef.set({ allowBroadcasts: requestedValue, lastSeenAt: FieldValue.serverTimestamp() }, { merge: true });
        response.status(200).json({
            ok: true,
            allowBroadcasts: requestedValue,
            reason: 'updated',
        });
    }
    catch (error) {
        response.status(500).json({
            ok: false,
            allowBroadcasts: false,
            reason: 'internal_error',
            detail: error instanceof Error ? error.message : 'Unknown backend error.',
        });
    }
});
export const getReferralLeaderboard = onRequest({
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).json({
            ok: false,
            topReferrers: [],
            myRank: null,
            myReferralCount: 0,
            reason: 'invalid_method',
        });
        return;
    }
    const botToken = telegramBotToken.value();
    if (!botToken) {
        response.status(500).json({
            ok: false,
            topReferrers: [],
            myRank: null,
            myReferralCount: 0,
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
            topReferrers: [],
            myRank: null,
            myReferralCount: 0,
            reason: verificationResult.reason === 'expired_init_data'
                ? 'expired_init_data'
                : 'invalid_init_data',
        });
        return;
    }
    const telegramUserId = verificationResult.user.id;
    const myReferralCode = `ref_${telegramUserId}`;
    try {
        const db = getFirestore();
        // Get all subscribers that have a referredBy field
        const subscribersSnapshot = await db
            .collection('telegramSubscribers')
            .where('referredBy', '>=', '')
            .get();
        // Count referrals per referrer code
        const referralCounts = new Map();
        for (const doc of subscribersSnapshot.docs) {
            const data = doc.data();
            const code = data.referredBy;
            if (typeof code === 'string' && code.startsWith('ref_')) {
                referralCounts.set(code, (referralCounts.get(code) ?? 0) + 1);
            }
        }
        // Get user ID from referrer codes
        const referrerIds = Array.from(referralCounts.keys()).map((code) => Number(code.replace('ref_', '')));
        // Fetch subscriber docs for top referrers to get usernames
        const referrerDocs = new Map();
        if (referrerIds.length > 0) {
            // Batch fetch in groups of 30 (Firestore 'in' limit)
            const batchSize = 30;
            for (let i = 0; i < referrerIds.length; i += batchSize) {
                const batch = referrerIds.slice(i, i + batchSize);
                const batchSnapshot = await db
                    .collection('telegramSubscribers')
                    .where('telegramUserId', 'in', batch)
                    .get();
                for (const doc of batchSnapshot.docs) {
                    const data = doc.data();
                    const uid = typeof data.telegramUserId === 'number' ? data.telegramUserId : null;
                    if (uid) {
                        referrerDocs.set(uid, {
                            username: typeof data.username === 'string' ? data.username : null,
                        });
                    }
                }
            }
        }
        // Build leaderboard entries sorted by count desc
        const entries = Array.from(referralCounts.entries())
            .map(([code, count]) => {
            const uid = Number(code.replace('ref_', ''));
            const docInfo = referrerDocs.get(uid);
            return {
                rank: 0,
                telegramUserId: uid,
                username: docInfo?.username ?? null,
                referralCount: count,
            };
        })
            .sort((a, b) => b.referralCount - a.referralCount)
            .slice(0, 10)
            .map((entry, index) => ({ ...entry, rank: index + 1 }));
        // Find the requesting user's rank and count
        const myReferralCount = referralCounts.get(myReferralCode) ?? 0;
        const allSorted = Array.from(referralCounts.entries())
            .sort(([, a], [, b]) => b - a);
        const myRankIndex = allSorted.findIndex(([code]) => code === myReferralCode);
        const myRank = myRankIndex >= 0 ? myRankIndex + 1 : null;
        response.status(200).json({
            ok: true,
            topReferrers: entries,
            myRank,
            myReferralCount,
            reason: 'listed',
        });
    }
    catch (error) {
        response.status(500).json({
            ok: false,
            topReferrers: [],
            myRank: null,
            myReferralCount: 0,
            reason: 'internal_error',
            detail: error instanceof Error ? error.message : 'Unknown backend error.',
        });
    }
});
export const getReferralInfo = onRequest({
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).json({
            ok: false,
            referralCode: null,
            referralCount: 0,
            telegramUserId: null,
            rewardMilestones: [],
            reason: 'invalid_method',
        });
        return;
    }
    const botToken = telegramBotToken.value();
    if (!botToken) {
        response.status(500).json({
            ok: false,
            referralCode: null,
            referralCount: 0,
            telegramUserId: null,
            rewardMilestones: [],
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
            referralCode: null,
            referralCount: 0,
            telegramUserId: null,
            rewardMilestones: [],
            reason: verificationResult.reason === 'expired_init_data'
                ? 'expired_init_data'
                : 'invalid_init_data',
        });
        return;
    }
    const telegramUserId = verificationResult.user.id;
    const referralCode = `ref_${telegramUserId}`;
    try {
        const db = getFirestore();
        // Count subscribers where referredBy === this user's referral code
        const referredSnapshot = await db
            .collection('telegramSubscribers')
            .where('referredBy', '==', referralCode)
            .count()
            .get();
        const referralCount = referredSnapshot.data().count;
        // Check and grant rewards
        const rewardMilestones = await processAndCheckRewards(db, telegramUserId, referralCount);
        response.status(200).json({
            ok: true,
            referralCode,
            referralCount,
            telegramUserId,
            rewardMilestones,
            reason: 'listed',
        });
    }
    catch (error) {
        response.status(500).json({
            ok: false,
            referralCode,
            referralCount: 0,
            telegramUserId,
            rewardMilestones: [],
            reason: 'internal_error',
            detail: error instanceof Error ? error.message : 'Unknown backend error.',
        });
    }
});
