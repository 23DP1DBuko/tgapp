// ── Content Module ── (Campaigns, Tasks, Notify, Referral, Broadcast, Admin)
import { onRequest } from 'firebase-functions/v2/https';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { telegramBotToken, telegramWebhookSecret, readAdminIdsFromEnv, verifyTelegramInitData, isValidCampaignInput, isValidTaskInput, sendTelegramBroadcastMessage, upsertTelegramSubscriberFromUpdate, sendTelegramStoreWelcomeMessage, sendTelegramStoreShortcutMessage, sendTelegramHelpMessage, isStartCommand, isStoreCommand, isHelpCommand, parseReferralCode, processAndCheckRewards, sendTelegramRewardMessage, readGrantedRewardThresholds, extractReferralUserId, isSelfReferralSubscriberDoc, countReferralsExcludingSelf, } from './helpers.js';
import { reapplyTaskToReferencingGiveaways } from './giveaways.js';
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
            // For private bot chats, chatId === telegramUserId. Fall back to telegramUserId
            // for docs created by the broadcast toggle before chatId was stored.
            const chatId = typeof data.chatId === 'number'
                ? data.chatId
                : typeof data.telegramUserId === 'number'
                    ? data.telegramUserId
                    : null;
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
            status: task.status,
            sortOrder: task.sortOrder,
            updatedAt: new Date().toISOString(),
        };
        if (task.actionUrl?.trim()) {
            payload.actionUrl = task.actionUrl.trim();
        }
        if (task.taskType) {
            payload.taskType = task.taskType;
        }
        if (task.requiredCount !== undefined && Number.isInteger(task.requiredCount)) {
            payload.requiredCount = task.requiredCount;
        }
        let finalTaskId;
        if (taskId) {
            await getFirestore().collection('tasks').doc(taskId).set(payload, { merge: true });
            finalTaskId = taskId;
        }
        else {
            const createdTask = await getFirestore().collection('tasks').add({
                ...payload,
                createdAt: new Date().toISOString(),
            });
            finalTaskId = createdTask.id;
        }
        // Propagate the change to every giveaway that references this task so the
        // buyer UI (type icon, label) and server enforcement reflect it
        // immediately — no giveaway re-save needed. The task doc is already
        // committed above, so a propagation failure must never fail the save.
        try {
            await reapplyTaskToReferencingGiveaways(getFirestore(), finalTaskId, {
                title: task.title.trim(),
                actionUrl: task.actionUrl?.trim(),
                taskType: task.taskType,
                requiredCount: task.requiredCount,
            });
        }
        catch (error) {
            console.error('Task saved but giveaway propagation failed', {
                taskId: finalTaskId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
        response.status(200).json({
            ok: true,
            taskId: finalTaskId,
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
            // For private bot chats, chatId === telegramUserId, so we store both.
            await docRef.set({
                telegramUserId,
                chatId: telegramUserId,
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
// Pure computation over a Firestore instance — extracted from the handler so it
// can be unit-tested with a mocked Firestore.
export async function computeReferralLeaderboard(db, myReferralCode) {
    // Get all subscribers that have a referredBy field
    const subscribersSnapshot = await db
        .collection('telegramSubscribers')
        .where('referredBy', '>=', '')
        .get();
    // Count referrals per referrer code. Self-referrals are skipped (H4): a
    // subscriber document whose telegramUserId equals the referrer's own id
    // never counts, even if it exists from before the write-time guard.
    const referralCounts = new Map();
    for (const doc of subscribersSnapshot.docs) {
        const data = doc.data();
        const code = typeof data.referredBy === 'string' ? data.referredBy : '';
        if (extractReferralUserId(code) === null)
            continue;
        if (isSelfReferralSubscriberDoc(data))
            continue;
        referralCounts.set(code, (referralCounts.get(code) ?? 0) + 1);
    }
    // Get user ID from referrer codes
    const referrerIds = Array.from(referralCounts.keys()).map((code) => Number(code.replace('ref_', '')));
    // Keep the requesting user's real referral count even if they hid themselves
    const myReferralCount = referralCounts.get(myReferralCode) ?? 0;
    // Drop referrers who opted out of the leaderboard (userSettings.leaderboardShown === false).
    // The userSettings doc ID is String(telegramUserId); a missing doc means visible (default true).
    const hiddenReferrerIds = new Set();
    if (referrerIds.length > 0) {
        const batchSize = 30;
        for (let i = 0; i < referrerIds.length; i += batchSize) {
            const batch = referrerIds.slice(i, i + batchSize);
            const settingsSnapshot = await db.getAll(...batch.map((uid) => db.collection('userSettings').doc(String(uid))));
            for (const doc of settingsSnapshot) {
                if (!doc.exists)
                    continue;
                if (doc.data()?.leaderboardShown === false) {
                    const uid = Number(doc.id);
                    if (Number.isInteger(uid))
                        hiddenReferrerIds.add(uid);
                }
            }
        }
    }
    for (const uid of hiddenReferrerIds) {
        referralCounts.delete(`ref_${uid}`);
    }
    // Recompute referrer IDs from the filtered counts so username docs for
    // hidden users are never fetched
    const visibleReferrerIds = Array.from(referralCounts.keys()).map((code) => Number(code.replace('ref_', '')));
    // Fetch subscriber docs for top referrers to get usernames
    const referrerDocs = new Map();
    if (visibleReferrerIds.length > 0) {
        // Batch fetch in groups of 30 (Firestore 'in' limit)
        const batchSize = 30;
        for (let i = 0; i < visibleReferrerIds.length; i += batchSize) {
            const batch = visibleReferrerIds.slice(i, i + batchSize);
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
    const topReferrers = Array.from(referralCounts.entries())
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
    const allSorted = Array.from(referralCounts.entries())
        .sort(([, a], [, b]) => b - a);
    const myRankIndex = allSorted.findIndex(([code]) => code === myReferralCode);
    const myRank = myRankIndex >= 0 ? myRankIndex + 1 : null;
    return { topReferrers, myRank, myReferralCount };
}
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
        const computation = await computeReferralLeaderboard(db, myReferralCode);
        response.status(200).json({
            ok: true,
            ...computation,
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
        // Count subscribers where referredBy === this user's referral code.
        // Self-referrals are excluded (H4): opening your own link must never
        // count toward your own milestones or the early-access threshold.
        const referralCount = await countReferralsExcludingSelf(db, referralCode);
        // Which milestones already had a code before this call? Only NEWLY
        // granted ones get a bot DM (L5) — the Rewards screen hits this endpoint
        // on every visit, and re-visiting must never re-send a code.
        const alreadyGranted = await readGrantedRewardThresholds(db, telegramUserId);
        // Check and grant rewards
        const rewardMilestones = await processAndCheckRewards(db, telegramUserId, referralCount);
        // Fire-and-forget DM for freshly granted codes (fail-open): a DM failure
        // must never fail the referral-info response. Known edge: two concurrent
        // Rewards-screen opens could both DM the same newly granted code — rare
        // and cosmetic; the grant itself is still transactionally unique.
        for (const milestone of rewardMilestones) {
            if (milestone.granted && !alreadyGranted.has(milestone.threshold)) {
                void sendTelegramRewardMessage(botToken, telegramUserId, {
                    headline: '🎉 Referral reward!',
                    label: `${milestone.discountPercent}% OFF`,
                    code: milestone.promoCode,
                }).catch(() => {
                    // Silently ignore — the code is still shown in-app
                });
            }
        }
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
