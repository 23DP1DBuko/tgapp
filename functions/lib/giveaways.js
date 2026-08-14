// ── Giveaways Module ──
import crypto, { createHash } from 'node:crypto';
import { onRequest } from 'firebase-functions/v2/https';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { telegramBotToken, readAdminIdsFromEnv, verifyTelegramInitData, isValidGiveawayInput, generateShortId, extractReferralUserId, countReferralsExcludingSelf, } from './helpers.js';
/**
 * Map a `tasks` collection doc to its entry-task verification definition.
 * Shared by `upsertGiveawayAdmin` (save-time resolution) and
 * `completeGiveawayTaskWithVerification` (completion-time re-resolution, so
 * giveaway docs saved before `taskType` existed self-heal — a stale `manual`
 * entry can never keep a now-verified task passing).
 */
export function resolveEntryTaskFromTaskDoc(taskData) {
    const taskType = ['join_channel', 'invite_friend', 'like_product'].includes(taskData.taskType ?? '')
        ? taskData.taskType
        : 'custom';
    const requiredCount = typeof taskData.requiredCount === 'number' &&
        Number.isInteger(taskData.requiredCount) &&
        taskData.requiredCount >= 1
        ? taskData.requiredCount
        : null;
    if (taskType === 'join_channel') {
        return {
            type: 'join_channel',
            verifyMethod: 'telegram_api',
            metadata: taskData.actionUrl?.trim() || null,
        };
    }
    if (taskType === 'invite_friend') {
        return {
            type: 'invite_friend',
            verifyMethod: 'referral_count',
            metadata: requiredCount !== null ? String(requiredCount) : null,
        };
    }
    if (taskType === 'like_product') {
        return {
            type: 'like_product',
            verifyMethod: 'client_claim',
            metadata: requiredCount !== null ? String(requiredCount) : '1',
        };
    }
    return {
        type: 'custom',
        verifyMethod: 'manual',
        metadata: taskData.actionUrl?.trim() || null,
    };
}
/**
 * Re-resolve one task inside every giveaway that references it (`taskIds`
 * array-contains) so edits to a task's type/label/link immediately update the
 * giveaway's `entryTasks` — the buyer UI (icon, label, Open button) and server
 * enforcement both reflect the change without a giveaway re-save. Called by
 * `upsertTaskAdmin` after every task save.
 */
export async function reapplyTaskToReferencingGiveaways(db, taskId, taskData) {
    const snapshot = await db
        .collection('giveaways')
        .where('taskIds', 'array-contains', taskId)
        .get();
    if (snapshot.empty)
        return 0;
    const resolved = resolveEntryTaskFromTaskDoc(taskData);
    const label = taskData.title?.trim() || 'Task';
    const batch = db.batch();
    let updated = 0;
    for (const doc of snapshot.docs) {
        const data = doc.data();
        const entryTasks = Array.isArray(data?.entryTasks) ? [...data.entryTasks] : [];
        const index = entryTasks.findIndex((t) => t.id === taskId);
        const entryTask = {
            id: taskId,
            type: resolved.type,
            label,
            ticketsGranted: data?.taskTickets?.[taskId] ?? 5,
            verifyMethod: resolved.verifyMethod,
            metadata: resolved.metadata,
        };
        if (index >= 0) {
            entryTasks[index] = entryTask;
        }
        else {
            entryTasks.push(entryTask);
        }
        batch.update(doc.ref, { entryTasks });
        updated += 1;
    }
    await batch.commit();
    return updated;
}
export function toGiveawayEntryData(data) {
    return {
        telegramUserId: data.telegramUserId,
        telegramUsername: data.telegramUsername ?? null,
        joinedAt: data.joinedAt,
        completedTaskIds: data.completedTaskIds ?? [],
        totalTickets: data.totalTickets,
    };
}
export function buildGiveawayEntryPublic(data, requesterTelegramUserId) {
    return {
        telegramUsername: data.telegramUsername ?? null,
        joinedAt: data.joinedAt,
        totalTickets: data.totalTickets,
        isMe: data.telegramUserId === requesterTelegramUserId,
    };
}
/**
 * CSPRNG draw seed (L2) — 256 bits of crypto entropy. Stored on the giveaway
 * doc so every draw is auditable after the fact.
 */
export function createDrawSeed() {
    return crypto.randomBytes(32).toString('hex');
}
/**
 * Deterministic PRNG unit value in [0, 1) derived from a seed + draw index:
 * SHA-256(`seed:index`) → first 8 hex chars → uint32 / 2^32. The same seed and
 * candidate order always reproduce the same winners, so anyone can re-verify a
 * draw using the stored seed (L2 — no Math.random).
 */
export function seededRandomUnit(seedHex, index) {
    const digest = createHash('sha256')
        .update(`${seedHex}:${index}`)
        .digest('hex');
    return parseInt(digest.slice(0, 8), 16) / 0x100000000;
}
/**
 * Weighted ticket draw, deterministic for a given seed + candidate order.
 * `candidates` must be sorted deterministically (by id) by the caller.
 */
export function runWeightedDraw(candidates, prizes, seedHex) {
    const drawnWinners = [];
    const remaining = [...candidates];
    let drawIndex = 0;
    for (const prize of prizes) {
        if (remaining.length === 0)
            break;
        const totalTickets = remaining.reduce((sum, e) => sum + Math.max(1, e.totalTickets), 0);
        const randomPoint = seededRandomUnit(seedHex, drawIndex) * totalTickets;
        drawIndex++;
        let selectedIndex = 0;
        let cursor = randomPoint;
        for (let i = 0; i < remaining.length; i++) {
            cursor -= Math.max(1, remaining[i].totalTickets);
            if (cursor <= 0) {
                selectedIndex = i;
                break;
            }
        }
        const winner = remaining[selectedIndex];
        drawnWinners.push({
            place: prize.place,
            productId: prize.productId,
            telegramUserId: winner.telegramUserId,
            telegramUsername: winner.telegramUsername ?? null,
            ticketsAtWinTime: winner.totalTickets,
        });
        remaining.splice(selectedIndex, 1);
    }
    return drawnWinners;
}
export const upsertGiveawayAdmin = onRequest({
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).json({
            ok: false,
            giveawayId: null,
            reason: 'invalid_method',
        });
        return;
    }
    const botToken = telegramBotToken.value();
    if (!botToken) {
        response.status(500).json({
            ok: false,
            giveawayId: null,
            reason: 'missing_bot_token',
        });
        return;
    }
    const body = request.body;
    const initData = typeof body?.initData === 'string' ? body.initData : '';
    const giveawayId = typeof body?.giveawayId === 'string' ? body.giveawayId.trim() : '';
    const giveaway = body?.giveaway;
    if (!isValidGiveawayInput(giveaway)) {
        response.status(400).json({
            ok: false,
            giveawayId: giveawayId || null,
            reason: 'invalid_payload',
        });
        return;
    }
    const verificationResult = verifyTelegramInitData(initData, botToken);
    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
        response.status(401).json({
            ok: false,
            giveawayId: giveawayId || null,
            reason: verificationResult.reason === 'expired_init_data'
                ? 'expired_init_data'
                : 'invalid_init_data',
        });
        return;
    }
    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
        response.status(403).json({
            ok: false,
            giveawayId: giveawayId || null,
            reason: 'forbidden',
        });
        return;
    }
    try {
        const now = new Date().toISOString();
        const db = getFirestore();
        // Fetch full product details from Firestore for each prize
        const prizesWithDetails = await Promise.all(giveaway.prizes.map(async (p) => {
            const productDoc = await db.collection('products').doc(p.productId.trim()).get();
            const productData = productDoc.exists
                ? productDoc.data()
                : null;
            return {
                productId: p.productId.trim(),
                place: p.place,
                productName: productData?.name ?? '',
                productImage: (productData?.images && productData.images[0]) ?? '',
            };
        }));
        // Resolve task IDs to full entry task definitions
        const taskIds = giveaway.taskIds ?? [];
        const taskTickets = giveaway.taskTickets ?? {};
        const resolvedTasks = [];
        if (taskIds.length > 0) {
            for (const taskId of taskIds) {
                const taskDoc = await db.collection('tasks').doc(taskId).get();
                if (taskDoc.exists) {
                    const taskData = taskDoc.data();
                    const resolved = resolveEntryTaskFromTaskDoc(taskData);
                    resolvedTasks.push({
                        id: taskId,
                        type: resolved.type,
                        label: taskData.title?.trim() ?? 'Task',
                        ticketsGranted: taskTickets[taskId] ?? 5,
                        verifyMethod: resolved.verifyMethod,
                        metadata: resolved.metadata,
                    });
                }
            }
        }
        // Keep any legacy entry tasks that aren't in the resolved task IDs
        const legacyTasks = (giveaway.entryTasks ?? []).filter((t) => t.id && !taskIds.includes(t.id));
        const entryTasksWithIds = [...resolvedTasks, ...legacyTasks].map((t) => ({
            id: t.id || generateShortId(),
            type: t.type,
            label: t.label,
            ticketsGranted: t.ticketsGranted,
            verifyMethod: t.verifyMethod,
            metadata: t.metadata || null,
        }));
        const payload = {
            title: giveaway.title.trim(),
            description: giveaway.description.trim(),
            imageUrl: giveaway.imageUrl?.trim() || '',
            status: giveaway.status,
            startAt: giveaway.startAt || null,
            endAt: giveaway.endAt,
            prizes: prizesWithDetails,
            winnersCount: giveaway.prizes.length,
            accessLevel: giveaway.accessLevel,
            entryTasks: entryTasksWithIds,
            taskIds: taskIds,
            taskTickets: taskTickets,
            baseEntryTickets: giveaway.baseEntryTickets,
            prizesForSale: giveaway.prizesForSale === true,
            enteredCount: 0,
            totalTicketsPool: 0,
            winners: null,
            finishedAt: null,
            updatedAt: now,
        };
        if (giveawayId) {
            // Preserve existing enteredCount, winners, etc. on update
            const existingSnapshot = await getFirestore().collection('giveaways').doc(giveawayId).get();
            if (existingSnapshot.exists) {
                const existingData = existingSnapshot.data();
                payload.enteredCount = existingData?.enteredCount ?? 0;
                payload.totalTicketsPool = existingData?.totalTicketsPool ?? 0;
                payload.winners = existingData?.winners ?? null;
                payload.finishedAt = existingData?.finishedAt ?? null;
            }
            await getFirestore().collection('giveaways').doc(giveawayId).set(payload, { merge: true });
            response.status(200).json({
                ok: true,
                giveawayId,
                reason: 'saved',
            });
            return;
        }
        const createdGiveaway = await getFirestore().collection('giveaways').add({
            ...payload,
            createdAt: now,
        });
        response.status(200).json({
            ok: true,
            giveawayId: createdGiveaway.id,
            reason: 'saved',
        });
    }
    catch (error) {
        response.status(500).json({
            ok: false,
            giveawayId: giveawayId || null,
            reason: 'internal_error',
            detail: error instanceof Error ? error.message : 'Unknown backend error.',
        });
    }
});
export const deleteGiveawaysAdmin = onRequest({
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).json({
            ok: false,
            giveawayId: null,
            reason: 'invalid_method',
        });
        return;
    }
    const botToken = telegramBotToken.value();
    if (!botToken) {
        response.status(500).json({
            ok: false,
            giveawayId: null,
            reason: 'missing_bot_token',
        });
        return;
    }
    const body = request.body;
    const initData = typeof body?.initData === 'string' ? body.initData : '';
    const giveawayIds = body?.giveawayIds?.filter((id) => typeof id === 'string' && id.trim().length > 0) ?? [];
    if (giveawayIds.length === 0) {
        response.status(400).json({
            ok: false,
            giveawayId: null,
            reason: 'invalid_payload',
        });
        return;
    }
    const verificationResult = verifyTelegramInitData(initData, botToken);
    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
        response.status(401).json({
            ok: false,
            giveawayId: null,
            reason: verificationResult.reason === 'expired_init_data'
                ? 'expired_init_data'
                : 'invalid_init_data',
        });
        return;
    }
    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
        response.status(403).json({
            ok: false,
            giveawayId: null,
            reason: 'forbidden',
        });
        return;
    }
    try {
        const batch = getFirestore().batch();
        giveawayIds.forEach((id) => {
            batch.delete(getFirestore().collection('giveaways').doc(id));
            // Also delete entries subcollection documents
            // Note: subcollection deletion requires separate iteration
        });
        await batch.commit();
        // Clean up entries subcollections for deleted giveaways
        const entryCleanups = giveawayIds.map(async (giveawayId) => {
            const entriesSnapshot = await getFirestore()
                .collection('giveaways')
                .doc(giveawayId)
                .collection('entries')
                .get();
            if (entriesSnapshot.size > 0) {
                const entryBatch = getFirestore().batch();
                entriesSnapshot.docs.forEach((doc) => entryBatch.delete(doc.ref));
                await entryBatch.commit();
            }
        });
        await Promise.all(entryCleanups);
        response.status(200).json({
            ok: true,
            giveawayId: giveawayIds[0] ?? null,
            reason: 'deleted',
        });
    }
    catch (error) {
        response.status(500).json({
            ok: false,
            giveawayId: giveawayIds[0] ?? null,
            reason: 'internal_error',
            detail: error instanceof Error ? error.message : 'Unknown backend error.',
        });
    }
});
/** True when the giveaway's endAt is set and has passed (GW-5). */
export function isGiveawayEnded(endAt, now = Date.now()) {
    if (typeof endAt !== 'string' || !endAt)
        return false;
    const ms = Date.parse(endAt);
    return Number.isFinite(ms) && now >= ms;
}
/**
 * Transactional giveaway join (H5).
 *
 * Entries are written to a deterministic document id `entries/{telegramUserId}`,
 * so the transaction read of that document serializes concurrent joins: two
 * simultaneous requests both read the (missing) doc, the first commit wins,
 * the second hits a write conflict, retries, and sees the entry ->
 * 'already_joined'. A legacy fallback query (pre-H5 entries used random ids)
 * guards against duplicate entries for users who joined before this fix.
 */
export async function joinGiveawayTransaction(db, input) {
    const { giveawayId, telegramUserId, telegramUsername } = input;
    const giveawayRef = db.collection('giveaways').doc(giveawayId);
    const entries = db.collection('giveaways').doc(giveawayId).collection('entries');
    const entryRef = entries.doc(String(telegramUserId));
    return db.runTransaction(async (transaction) => {
        const giveawaySnapshot = await transaction.get(giveawayRef);
        if (!giveawaySnapshot.exists) {
            return { status: 'not_found' };
        }
        const giveawayData = giveawaySnapshot.data();
        if (!giveawayData || giveawayData.status !== 'live') {
            return { status: 'not_live' };
        }
        // GW-5: a giveaway that is past its endAt is closed to new entries.
        if (isGiveawayEnded(giveawayData.endAt)) {
            return { status: 'ended' };
        }
        // Deterministic dedupe first: an already-joined member is told they are
        // already in, regardless of current eligibility (GW-6 check below).
        const entrySnapshot = await transaction.get(entryRef);
        if (entrySnapshot.exists) {
            return { status: 'already_joined' };
        }
        // Legacy fallback: entries created before H5 used random document ids.
        const legacyEntries = await entries
            .where('telegramUserId', '==', telegramUserId)
            .limit(1)
            .get();
        if (!legacyEntries.empty) {
            return { status: 'already_joined' };
        }
        // GW-6: early-access-only giveaways require at least one real referral
        // (self-referrals excluded via countReferralsExcludingSelf, H4).
        if (giveawayData.accessLevel === 'early_access_only') {
            const referralCount = await countReferralsExcludingSelf(db, `ref_${telegramUserId}`);
            if (referralCount < 1) {
                return { status: 'access_restricted' };
            }
        }
        const baseTickets = giveawayData.baseEntryTickets ?? 1;
        transaction.set(entryRef, {
            telegramUserId,
            telegramUsername,
            joinedAt: new Date().toISOString(),
            completedTaskIds: [],
            totalTickets: baseTickets,
        });
        transaction.update(giveawayRef, {
            enteredCount: FieldValue.increment(1),
            totalTicketsPool: FieldValue.increment(baseTickets),
        });
        return { status: 'joined', totalTickets: baseTickets };
    });
}
/**
 * Transactional task completion (H5).
 *
 * The user's entry doc (deterministic id, with legacy fallback) is read inside
 * the transaction, so concurrent completions of the same task serialize on it:
 * the loser retries, sees the task in completedTaskIds, and gets
 * 'already_completed' — tickets are granted exactly once.
 */
export async function completeGiveawayTaskTransaction(db, input) {
    const { giveawayId, taskId, telegramUserId } = input;
    const giveawayRef = db.collection('giveaways').doc(giveawayId);
    const entries = db.collection('giveaways').doc(giveawayId).collection('entries');
    const entryRef = entries.doc(String(telegramUserId));
    return db.runTransaction(async (transaction) => {
        const giveawaySnapshot = await transaction.get(giveawayRef);
        if (!giveawaySnapshot.exists) {
            return { status: 'not_found' };
        }
        const giveawayData = giveawaySnapshot.data();
        if (!giveawayData || giveawayData.status !== 'live') {
            return { status: 'not_live' };
        }
        // GW-5: a giveaway that is past its endAt no longer grants task tickets.
        if (isGiveawayEnded(giveawayData.endAt)) {
            return { status: 'ended' };
        }
        // Find the task definition
        const taskDef = giveawayData.entryTasks?.find((t) => t.id === taskId) ?? null;
        if (!taskDef) {
            return { status: 'task_not_found' };
        }
        // Deterministic lookup first, then legacy fallback for pre-H5 entries.
        let entrySnapshot = await transaction.get(entryRef);
        let entryRefToUse = entryRef;
        if (!entrySnapshot.exists) {
            const legacyEntries = await entries
                .where('telegramUserId', '==', telegramUserId)
                .limit(1)
                .get();
            if (legacyEntries.empty) {
                return { status: 'not_joined' };
            }
            // Re-read the legacy doc inside the transaction so concurrent completions
            // serialize on it too.
            const legacyRef = entries.doc(legacyEntries.docs[0].id);
            entrySnapshot = await transaction.get(legacyRef);
            entryRefToUse = legacyRef;
        }
        const entryData = entrySnapshot.data();
        // Check if already completed
        if (entryData.completedTaskIds?.includes(taskId)) {
            return { status: 'already_completed' };
        }
        // Grant tickets
        const ticketsGranted = taskDef.ticketsGranted;
        const currentTickets = entryData.totalTickets ?? 0;
        transaction.update(entryRefToUse, {
            completedTaskIds: FieldValue.arrayUnion(taskId),
            totalTickets: currentTickets + ticketsGranted,
        });
        // Update giveaway pool
        transaction.update(giveawayRef, {
            totalTicketsPool: FieldValue.increment(ticketsGranted),
        });
        return {
            status: 'completed',
            totalTickets: currentTickets + ticketsGranted,
            taskTicketsGranted: ticketsGranted,
        };
    });
}
/**
 * Bot-side membership check via the Telegram Bot API `getChatMember` method.
 * A user passes when their status in the chat is creator, administrator, or an
 * active member (left/kicked/restricted users fail).
 */
export async function defaultTelegramMemberCheck(botToken, chatId, telegramUserId) {
    const params = new URLSearchParams({
        chat_id: chatId,
        user_id: String(telegramUserId),
    });
    let response;
    try {
        response = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember?${params.toString()}`);
    }
    catch {
        // Network failure — we can't tell whether the user is a member.
        return { ok: false, detail: 'chat_unreachable' };
    }
    if (!response.ok) {
        // A 400 usually means the chat id is wrong or the bot isn't in the chat —
        // an admin-config issue, not the user's membership.
        return { ok: false, detail: 'chat_unreachable' };
    }
    const payload = (await response.json());
    if (payload.ok !== true || !payload.result?.status) {
        return { ok: false, detail: 'chat_unreachable' };
    }
    if (['creator', 'administrator', 'member'].includes(payload.result.status)) {
        return { ok: true };
    }
    return { ok: false, detail: 'not_member' };
}
/**
 * Enforce a task's verifyMethod before tickets are granted (H6).
 *
 * - `manual` — honor-system, always passes (admin-visible in the entry list).
 * - `referral_count` — when `metadata` is a positive integer N, the user must
 *   have referred at least N people (self-referrals excluded, H4); otherwise
 *   the user must themselves have been referred (`referredBy` set).
 * - `telegram_api` — bot-side membership check via getChatMember on the chat
 *   id in `metadata`. A missing chat id fails closed.
 * - `client_claim` — like-product tasks: the required count in `metadata`
 *   (default 1) is compared against the user's **server-tracked** like count
 *   in `userStats/{telegramUserId}.likedProductCount`, maintained
 *   transactionally by `updateProductSignal` on every like/unlike. A missing
 *   userStats doc fails closed (count 0) — the device can never self-verify.
 */
export async function verifyGiveawayTaskEligibility(db, taskDef, telegramUserId, botToken, deps = {}) {
    switch (taskDef.verifyMethod) {
        case 'manual':
            return { ok: true };
        case 'client_claim': {
            const rawThreshold = taskDef.metadata?.trim() ?? '';
            const threshold = /^\d+$/.test(rawThreshold) ? Number(rawThreshold) : 1;
            const statsSnapshot = await db
                .collection('userStats')
                .doc(String(telegramUserId))
                .get();
            const likedCount = statsSnapshot.data()?.likedProductCount;
            const count = typeof likedCount === 'number' && Number.isFinite(likedCount) ? likedCount : 0;
            return { ok: count >= threshold };
        }
        case 'referral_count': {
            const rawThreshold = taskDef.metadata?.trim() ?? '';
            const threshold = /^\d+$/.test(rawThreshold) ? Number(rawThreshold) : null;
            if (threshold !== null && threshold >= 1) {
                const referralCount = await countReferralsExcludingSelf(db, `ref_${telegramUserId}`);
                return { ok: referralCount >= threshold };
            }
            // No threshold configured: the user must have been referred by someone.
            const subscribers = await db
                .collection('telegramSubscribers')
                .where('telegramUserId', '==', telegramUserId)
                .limit(1)
                .get();
            if (subscribers.empty)
                return { ok: false };
            const referredBy = subscribers.docs[0].data()?.referredBy;
            const isReferred = typeof referredBy === 'string' && extractReferralUserId(referredBy) !== null;
            return { ok: isReferred };
        }
        case 'telegram_api': {
            const chatId = taskDef.metadata?.trim() ?? '';
            if (!chatId)
                return { ok: false, detail: 'chat_missing' };
            const memberCheck = deps.telegramMemberCheck ?? defaultTelegramMemberCheck;
            try {
                const check = await memberCheck(botToken, chatId, telegramUserId);
                return check.ok ? { ok: true } : { ok: false, detail: check.detail ?? 'not_member' };
            }
            catch {
                return { ok: false, detail: 'chat_unreachable' };
            }
        }
        default:
            // Unknown/legacy verifyMethod values are treated as manual (honor-system),
            // matching the client-side normalization.
            return { ok: true };
    }
}
/**
 * Complete a giveaway task with server-side verifyMethod enforcement (H6).
 *
 * The eligibility check runs BEFORE the grant transaction — the Telegram Bot
 * API call cannot live inside a Firestore transaction. The grant itself stays
 * transactional (H5: deterministic entry doc, race-proof dedupe).
 */
export async function completeGiveawayTaskWithVerification(db, input, deps = {}) {
    const { giveawayId, taskId, telegramUserId, botToken } = input;
    // Pre-read the task definition so verification can run before the grant.
    const giveawaySnapshot = await db.collection('giveaways').doc(giveawayId).get();
    if (!giveawaySnapshot.exists) {
        return { status: 'not_found' };
    }
    const giveawayData = giveawaySnapshot.data();
    const taskDef = giveawayData?.entryTasks?.find((t) => t.id === taskId) ?? null;
    if (!taskDef) {
        return { status: 'task_not_found' };
    }
    // Normalize unknown/legacy verifyMethod values to 'manual' so a hand-crafted
    // doc can never fall through the eligibility switch (H6 robustness).
    let verifyMethod = taskDef.verifyMethod === 'telegram_api' ||
        taskDef.verifyMethod === 'referral_count' ||
        taskDef.verifyMethod === 'client_claim'
        ? taskDef.verifyMethod
        : 'manual';
    let taskMetadata = taskDef.metadata ?? null;
    // Defense-in-depth: when the task is referenced by the giveaway's taskIds,
    // re-resolve its verification from the `tasks` collection (same mapping as
    // save-time). Giveaway docs saved before `taskType` existed self-heal here —
    // a stale `manual` entry task can never keep a now-verified task passing.
    if (giveawayData?.taskIds?.includes(taskId)) {
        const taskDoc = await db.collection('tasks').doc(taskId).get();
        if (taskDoc.exists) {
            const resolved = resolveEntryTaskFromTaskDoc(taskDoc.data());
            verifyMethod = resolved.verifyMethod;
            taskMetadata = resolved.metadata;
        }
    }
    const verification = await verifyGiveawayTaskEligibility(db, {
        verifyMethod,
        metadata: taskMetadata,
    }, telegramUserId, botToken, deps);
    if (!verification.ok) {
        // Tell the client WHY it failed for like-product tasks, so the specific
        // "need N likes" message shows even when the client's view of the giveaway
        // doc is stale (verifyMethod still says 'manual' pre-refresh).
        if (verifyMethod === 'client_claim') {
            const rawThreshold = taskMetadata?.trim() ?? '';
            const threshold = /^\d+$/.test(rawThreshold) ? Number(rawThreshold) : 1;
            return {
                status: 'verification_failed',
                detail: 'need_more_likes',
                requiredCount: threshold,
            };
        }
        return { status: 'verification_failed', detail: verification.detail };
    }
    return completeGiveawayTaskTransaction(db, { giveawayId, taskId, telegramUserId });
}
export const joinGiveaway = onRequest({
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).json({
            ok: false,
            totalTickets: 0,
            reason: 'invalid_method',
        });
        return;
    }
    const botToken = telegramBotToken.value();
    if (!botToken) {
        response.status(500).json({
            ok: false,
            totalTickets: 0,
            reason: 'missing_bot_token',
        });
        return;
    }
    const body = request.body;
    const initData = typeof body?.initData === 'string' ? body.initData : '';
    const giveawayId = typeof body?.giveawayId === 'string' ? body.giveawayId.trim() : '';
    if (!giveawayId) {
        response.status(400).json({
            ok: false,
            totalTickets: 0,
            reason: 'invalid_payload',
        });
        return;
    }
    const verificationResult = verifyTelegramInitData(initData, botToken);
    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
        response.status(401).json({
            ok: false,
            totalTickets: 0,
            reason: verificationResult.reason === 'expired_init_data'
                ? 'expired_init_data'
                : 'invalid_init_data',
        });
        return;
    }
    const telegramUserId = verificationResult.user.id;
    const telegramUsername = typeof verificationResult.user.username === 'string'
        ? verificationResult.user.username
        : null;
    try {
        const db = getFirestore();
        const result = await joinGiveawayTransaction(db, {
            giveawayId,
            telegramUserId,
            telegramUsername,
        });
        switch (result.status) {
            case 'not_found':
                response.status(404).json({
                    ok: false,
                    totalTickets: 0,
                    reason: 'invalid_payload',
                    detail: 'Giveaway not found.',
                });
                return;
            case 'not_live':
                response.status(409).json({
                    ok: false,
                    totalTickets: 0,
                    reason: 'giveaway_not_live',
                });
                return;
            case 'ended':
                response.status(409).json({
                    ok: false,
                    totalTickets: 0,
                    reason: 'giveaway_ended',
                });
                return;
            case 'access_restricted':
                response.status(409).json({
                    ok: false,
                    totalTickets: 0,
                    reason: 'access_restricted',
                });
                return;
            case 'already_joined':
                response.status(409).json({
                    ok: false,
                    totalTickets: 0,
                    reason: 'already_joined',
                });
                return;
            case 'joined':
                response.status(200).json({
                    ok: true,
                    totalTickets: result.totalTickets,
                    reason: 'joined',
                });
                return;
        }
    }
    catch (error) {
        response.status(500).json({
            ok: false,
            totalTickets: 0,
            reason: 'internal_error',
            detail: error instanceof Error ? error.message : 'Unknown backend error.',
        });
    }
});
export const completeGiveawayTask = onRequest({
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).json({
            ok: false,
            totalTickets: 0,
            taskTicketsGranted: 0,
            reason: 'invalid_method',
        });
        return;
    }
    const botToken = telegramBotToken.value();
    if (!botToken) {
        response.status(500).json({
            ok: false,
            totalTickets: 0,
            taskTicketsGranted: 0,
            reason: 'missing_bot_token',
        });
        return;
    }
    const body = request.body;
    const initData = typeof body?.initData === 'string' ? body.initData : '';
    const giveawayId = typeof body?.giveawayId === 'string' ? body.giveawayId.trim() : '';
    const taskId = typeof body?.taskId === 'string' ? body.taskId.trim() : '';
    if (!giveawayId || !taskId) {
        response.status(400).json({
            ok: false,
            totalTickets: 0,
            taskTicketsGranted: 0,
            reason: 'invalid_payload',
        });
        return;
    }
    const verificationResult = verifyTelegramInitData(initData, botToken);
    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
        response.status(401).json({
            ok: false,
            totalTickets: 0,
            taskTicketsGranted: 0,
            reason: verificationResult.reason === 'expired_init_data'
                ? 'expired_init_data'
                : 'invalid_init_data',
        });
        return;
    }
    const telegramUserId = verificationResult.user.id;
    try {
        const db = getFirestore();
        const result = await completeGiveawayTaskWithVerification(db, {
            giveawayId,
            taskId,
            telegramUserId,
            botToken,
        });
        switch (result.status) {
            case 'not_found':
                response.status(404).json({
                    ok: false,
                    totalTickets: 0,
                    taskTicketsGranted: 0,
                    reason: 'invalid_payload',
                    detail: 'Giveaway not found.',
                });
                return;
            case 'not_live':
                response.status(409).json({
                    ok: false,
                    totalTickets: 0,
                    taskTicketsGranted: 0,
                    reason: 'giveaway_not_live',
                });
                return;
            case 'ended':
                response.status(409).json({
                    ok: false,
                    totalTickets: 0,
                    taskTicketsGranted: 0,
                    reason: 'giveaway_ended',
                });
                return;
            case 'task_not_found':
                response.status(404).json({
                    ok: false,
                    totalTickets: 0,
                    taskTicketsGranted: 0,
                    reason: 'task_not_found',
                });
                return;
            case 'not_joined':
                response.status(409).json({
                    ok: false,
                    totalTickets: 0,
                    taskTicketsGranted: 0,
                    reason: 'not_joined',
                });
                return;
            case 'already_completed':
                response.status(409).json({
                    ok: false,
                    totalTickets: 0,
                    taskTicketsGranted: 0,
                    reason: 'already_completed',
                });
                return;
            case 'completed':
                response.status(200).json({
                    ok: true,
                    totalTickets: result.totalTickets,
                    taskTicketsGranted: result.taskTicketsGranted,
                    reason: 'completed',
                });
                return;
            case 'verification_failed':
                response.status(409).json({
                    ok: false,
                    totalTickets: 0,
                    taskTicketsGranted: 0,
                    reason: 'verification_failed',
                    detail: result.detail,
                    requiredCount: result.requiredCount,
                });
                return;
        }
    }
    catch (error) {
        response.status(500).json({
            ok: false,
            totalTickets: 0,
            taskTicketsGranted: 0,
            reason: 'internal_error',
            detail: error instanceof Error ? error.message : 'Unknown backend error.',
        });
    }
});
export const getGiveawayEntries = onRequest({
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).json({
            ok: false,
            entries: [],
            totalParticipants: 0,
            myEntry: null,
            reason: 'invalid_method',
        });
        return;
    }
    const botToken = telegramBotToken.value();
    if (!botToken) {
        response.status(500).json({
            ok: false,
            entries: [],
            totalParticipants: 0,
            myEntry: null,
            reason: 'missing_bot_token',
        });
        return;
    }
    const body = request.body;
    const initData = typeof body?.initData === 'string' ? body.initData : '';
    const giveawayId = typeof body?.giveawayId === 'string' ? body.giveawayId.trim() : '';
    if (!giveawayId) {
        response.status(400).json({
            ok: false,
            entries: [],
            totalParticipants: 0,
            myEntry: null,
            reason: 'invalid_payload',
        });
        return;
    }
    const verificationResult = verifyTelegramInitData(initData, botToken);
    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
        response.status(401).json({
            ok: false,
            entries: [],
            totalParticipants: 0,
            myEntry: null,
            reason: verificationResult.reason === 'expired_init_data'
                ? 'expired_init_data'
                : 'invalid_init_data',
        });
        return;
    }
    const telegramUserId = verificationResult.user.id;
    try {
        const db = getFirestore();
        // Verify giveaway exists
        const giveawaySnapshot = await db.collection('giveaways').doc(giveawayId).get();
        if (!giveawaySnapshot.exists) {
            response.status(404).json({
                ok: false,
                entries: [],
                totalParticipants: 0,
                myEntry: null,
                reason: 'invalid_payload',
                detail: 'Giveaway not found.',
            });
            return;
        }
        // Fetch all entries
        const entriesSnapshot = await db
            .collection('giveaways')
            .doc(giveawayId)
            .collection('entries')
            .orderBy('totalTickets', 'desc')
            .get();
        const entryDocs = entriesSnapshot.docs;
        // Public leaderboard rows — no participant ids or internal task state (L1)
        const entries = entryDocs.map((doc) => buildGiveawayEntryPublic(doc.data(), telegramUserId));
        // The requester's own full entry — only their own data
        const myEntryDoc = entryDocs.find((doc) => doc.data().telegramUserId === telegramUserId);
        const myEntry = myEntryDoc
            ? toGiveawayEntryData(myEntryDoc.data())
            : null;
        response.status(200).json({
            ok: true,
            entries,
            totalParticipants: entries.length,
            myEntry,
            reason: 'listed',
        });
    }
    catch (error) {
        response.status(500).json({
            ok: false,
            entries: [],
            totalParticipants: 0,
            myEntry: null,
            reason: 'internal_error',
            detail: error instanceof Error ? error.message : 'Unknown backend error.',
        });
    }
});
export const getMyGiveawayEntry = onRequest({
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).json({
            ok: false,
            entry: null,
            reason: 'invalid_method',
        });
        return;
    }
    const botToken = telegramBotToken.value();
    if (!botToken) {
        response.status(500).json({
            ok: false,
            entry: null,
            reason: 'missing_bot_token',
        });
        return;
    }
    const body = request.body;
    const initData = typeof body?.initData === 'string' ? body.initData : '';
    const giveawayId = typeof body?.giveawayId === 'string' ? body.giveawayId.trim() : '';
    if (!giveawayId) {
        response.status(400).json({
            ok: false,
            entry: null,
            reason: 'invalid_payload',
        });
        return;
    }
    const verificationResult = verifyTelegramInitData(initData, botToken);
    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
        response.status(401).json({
            ok: false,
            entry: null,
            reason: verificationResult.reason === 'expired_init_data'
                ? 'expired_init_data'
                : 'invalid_init_data',
        });
        return;
    }
    const telegramUserId = verificationResult.user.id;
    try {
        const db = getFirestore();
        // Targeted query — only the current user's entry, limited to 1
        const entriesSnapshot = await db
            .collection('giveaways')
            .doc(giveawayId)
            .collection('entries')
            .where('telegramUserId', '==', telegramUserId)
            .limit(1)
            .get();
        if (entriesSnapshot.empty) {
            response.status(200).json({
                ok: true,
                entry: null,
                reason: 'not_found',
            });
            return;
        }
        const entry = toGiveawayEntryData(entriesSnapshot.docs[0].data());
        response.status(200).json({
            ok: true,
            entry,
            reason: 'found',
        });
    }
    catch (error) {
        response.status(500).json({
            ok: false,
            entry: null,
            reason: 'internal_error',
            detail: error instanceof Error ? error.message : 'Unknown backend error.',
        });
    }
});
export const drawGiveawayAdmin = onRequest({
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).json({
            ok: false,
            winners: [],
            reason: 'invalid_method',
        });
        return;
    }
    const botToken = telegramBotToken.value();
    if (!botToken) {
        response.status(500).json({
            ok: false,
            winners: [],
            reason: 'missing_bot_token',
        });
        return;
    }
    const body = request.body;
    const initData = typeof body?.initData === 'string' ? body.initData : '';
    const giveawayId = typeof body?.giveawayId === 'string' ? body.giveawayId.trim() : '';
    if (!giveawayId) {
        response.status(400).json({
            ok: false,
            winners: [],
            reason: 'invalid_payload',
        });
        return;
    }
    const verificationResult = verifyTelegramInitData(initData, botToken);
    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
        response.status(401).json({
            ok: false,
            winners: [],
            reason: verificationResult.reason === 'expired_init_data'
                ? 'expired_init_data'
                : 'invalid_init_data',
        });
        return;
    }
    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
        response.status(403).json({
            ok: false,
            winners: [],
            reason: 'forbidden',
        });
        return;
    }
    try {
        const db = getFirestore();
        const giveawayRef = db.collection('giveaways').doc(giveawayId);
        // CSPRNG draw seed — stored on the giveaway doc for auditability (L2)
        const drawSeed = createDrawSeed();
        const result = await db.runTransaction(async (transaction) => {
            const giveawaySnapshot = await transaction.get(giveawayRef);
            if (!giveawaySnapshot.exists) {
                return { status: 'not_found' };
            }
            const giveawayData = giveawaySnapshot.data();
            if (!giveawayData || giveawayData.status !== 'live') {
                return { status: 'not_live' };
            }
            // Fetch all entries
            const entriesSnapshot = await db
                .collection('giveaways')
                .doc(giveawayId)
                .collection('entries')
                .get();
            if (entriesSnapshot.empty) {
                return { status: 'no_entries' };
            }
            const prizes = giveawayData.prizes ?? [];
            if (prizes.length === 0) {
                return { status: 'no_prizes' };
            }
            // Build the weighted candidate list, sorted deterministically by doc id
            // so a stored seed always reproduces the exact same draw (L2)
            const candidates = entriesSnapshot.docs
                .map((doc) => {
                const data = doc.data();
                return {
                    id: doc.id,
                    telegramUserId: data.telegramUserId,
                    telegramUsername: data.telegramUsername ?? null,
                    totalTickets: data.totalTickets,
                };
            })
                .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
            // Deterministic weighted draw driven by the CSPRNG seed (L2)
            const drawnWinners = runWeightedDraw(candidates, prizes, drawSeed);
            // Update giveaway with winners + draw metadata and mark as finished
            const now = new Date().toISOString();
            transaction.update(giveawayRef, {
                status: 'finished',
                winners: drawnWinners,
                drawSeed,
                drawMethod: 'seeded_weighted_ticket',
                drawAlgorithmVersion: 1,
                finishedAt: now,
            });
            return { status: 'drawn', winners: drawnWinners };
        });
        switch (result.status) {
            case 'not_found':
                response.status(404).json({
                    ok: false,
                    winners: [],
                    reason: 'invalid_payload',
                    detail: 'Giveaway not found.',
                });
                return;
            case 'not_live':
                response.status(409).json({
                    ok: false,
                    winners: [],
                    reason: 'giveaway_not_live',
                });
                return;
            case 'no_entries':
                response.status(409).json({
                    ok: false,
                    winners: [],
                    reason: 'not_enough_participants',
                });
                return;
            case 'no_prizes':
                response.status(409).json({
                    ok: false,
                    winners: [],
                    reason: 'invalid_payload',
                    detail: 'Giveaway has no prizes configured.',
                });
                return;
            case 'drawn':
                response.status(200).json({
                    ok: true,
                    winners: result.winners,
                    reason: 'drawn',
                });
                return;
        }
    }
    catch (error) {
        response.status(500).json({
            ok: false,
            winners: [],
            reason: 'internal_error',
            detail: error instanceof Error ? error.message : 'Unknown backend error.',
        });
    }
});
