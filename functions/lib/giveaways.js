// ── Giveaways Module ──
import { onRequest } from 'firebase-functions/v2/https';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { telegramBotToken, readAdminIdsFromEnv, verifyTelegramInitData, isValidGiveawayInput, generateShortId, } from './helpers.js';
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
        const prizesWithDetails = giveaway.prizes.map((p) => ({
            productId: p.productId.trim(),
            place: p.place,
            productName: '',
            productImage: '',
        }));
        const entryTasksWithIds = giveaway.entryTasks.map((t) => ({
            id: generateShortId(),
            type: t.type,
            label: t.label.trim(),
            ticketsGranted: t.ticketsGranted,
            verifyMethod: t.verifyMethod,
            metadata: t.metadata?.trim() || null,
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
            baseEntryTickets: giveaway.baseEntryTickets,
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
// ── Giveaway Player Functions ──
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
    const telegramUsername = verificationResult.user.username ?? null;
    try {
        const db = getFirestore();
        const giveawayRef = db.collection('giveaways').doc(giveawayId);
        const result = await db.runTransaction(async (transaction) => {
            const giveawaySnapshot = await transaction.get(giveawayRef);
            if (!giveawaySnapshot.exists) {
                return { status: 'not_found' };
            }
            const giveawayData = giveawaySnapshot.data();
            if (!giveawayData || giveawayData.status !== 'live') {
                return { status: 'not_live' };
            }
            // Check if already joined
            const existingEntries = await db
                .collection('giveaways')
                .doc(giveawayId)
                .collection('entries')
                .where('telegramUserId', '==', telegramUserId)
                .limit(1)
                .get();
            if (!existingEntries.empty) {
                return { status: 'already_joined' };
            }
            // Create entry document
            const baseTickets = giveawayData.baseEntryTickets ?? 1;
            const entryRef = db
                .collection('giveaways')
                .doc(giveawayId)
                .collection('entries')
                .doc();
            transaction.set(entryRef, {
                telegramUserId,
                telegramUsername,
                joinedAt: new Date().toISOString(),
                completedTaskIds: [],
                totalTickets: baseTickets,
            });
            // Update giveaway counters
            transaction.update(giveawayRef, {
                enteredCount: FieldValue.increment(1),
                totalTicketsPool: FieldValue.increment(baseTickets),
            });
            return { status: 'joined', totalTickets: baseTickets };
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
        const giveawayRef = db.collection('giveaways').doc(giveawayId);
        const result = await db.runTransaction(async (transaction) => {
            const giveawaySnapshot = await transaction.get(giveawayRef);
            if (!giveawaySnapshot.exists) {
                return { status: 'not_found' };
            }
            const giveawayData = giveawaySnapshot.data();
            if (!giveawayData || giveawayData.status !== 'live') {
                return { status: 'not_live' };
            }
            // Find the task definition
            const taskDef = giveawayData.entryTasks?.find((t) => t.id === taskId) ?? null;
            if (!taskDef) {
                return { status: 'task_not_found' };
            }
            // Find the user's entry
            const entriesSnapshot = await db
                .collection('giveaways')
                .doc(giveawayId)
                .collection('entries')
                .where('telegramUserId', '==', telegramUserId)
                .limit(1)
                .get();
            if (entriesSnapshot.empty) {
                return { status: 'not_joined' };
            }
            const entryDoc = entriesSnapshot.docs[0];
            const entryData = entryDoc.data();
            // Check if already completed
            if (entryData.completedTaskIds?.includes(taskId)) {
                return { status: 'already_completed' };
            }
            // Grant tickets
            const ticketsGranted = taskDef.ticketsGranted;
            const currentTickets = entryData.totalTickets ?? 0;
            transaction.update(entryDoc.ref, {
                completedTaskIds: FieldValue.arrayUnion(taskId),
                totalTickets: currentTickets + ticketsGranted,
            });
            // Update giveaway pool
            transaction.update(giveawayRef, {
                totalTicketsPool: FieldValue.increment(ticketsGranted),
            });
            return { status: 'completed', totalTickets: currentTickets + ticketsGranted, taskTicketsGranted: ticketsGranted };
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
        const entries = entriesSnapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                telegramUserId: data.telegramUserId,
                telegramUsername: data.telegramUsername ?? null,
                joinedAt: data.joinedAt,
                completedTaskIds: data.completedTaskIds ?? [],
                totalTickets: data.totalTickets,
            };
        });
        const myEntry = entries.find((e) => e.telegramUserId === telegramUserId) ?? null;
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
            // Build weighted list for drawing
            const entries = entriesSnapshot.docs.map((doc) => ({
                id: doc.id,
                data: doc.data(),
            }));
            // Weighted random draw for each prize
            const drawnWinners = [];
            const remainingEntries = [...entries];
            for (const prize of prizes) {
                if (remainingEntries.length === 0)
                    break;
                // Calculate total tickets among remaining entries
                const totalTickets = remainingEntries.reduce((sum, e) => sum + Math.max(1, e.data.totalTickets), 0);
                // Random pick weighted by tickets
                let randomPoint = Math.random() * totalTickets;
                let selectedIndex = 0;
                for (let i = 0; i < remainingEntries.length; i++) {
                    randomPoint -= Math.max(1, remainingEntries[i].data.totalTickets);
                    if (randomPoint <= 0) {
                        selectedIndex = i;
                        break;
                    }
                }
                const winner = remainingEntries[selectedIndex];
                drawnWinners.push({
                    place: prize.place,
                    productId: prize.productId,
                    telegramUserId: winner.data.telegramUserId,
                    telegramUsername: winner.data.telegramUsername ?? null,
                    ticketsAtWinTime: winner.data.totalTickets,
                });
                // Remove winner from pool so they can't win multiple prizes
                remainingEntries.splice(selectedIndex, 1);
            }
            // Update giveaway with winners and mark as finished
            const now = new Date().toISOString();
            transaction.update(giveawayRef, {
                status: 'finished',
                winners: drawnWinners,
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
