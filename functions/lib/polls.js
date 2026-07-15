// ── Polls Module ──
import { onRequest } from 'firebase-functions/v2/https';
import { FieldValue, getFirestore as gf } from 'firebase-admin/firestore';
import { telegramBotToken, readAdminIdsFromEnv, verifyTelegramInitData, isValidPollInput, } from './helpers.js';
// ── Poll Functions ──
export const upsertPollAdmin = onRequest({
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).json({
            ok: false,
            pollId: null,
            reason: 'invalid_method',
        });
        return;
    }
    const botToken = telegramBotToken.value();
    if (!botToken) {
        response.status(500).json({
            ok: false,
            pollId: null,
            reason: 'missing_bot_token',
        });
        return;
    }
    const body = request.body;
    const initData = typeof body?.initData === 'string' ? body.initData : '';
    const pollId = typeof body?.pollId === 'string' ? body.pollId.trim() : '';
    const poll = body?.poll;
    if (!isValidPollInput(poll)) {
        response.status(400).json({
            ok: false,
            pollId: pollId || null,
            reason: 'invalid_payload',
        });
        return;
    }
    const verificationResult = verifyTelegramInitData(initData, botToken);
    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
        response.status(401).json({
            ok: false,
            pollId: pollId || null,
            reason: verificationResult.reason === 'expired_init_data'
                ? 'expired_init_data'
                : 'invalid_init_data',
        });
        return;
    }
    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
        response.status(403).json({
            ok: false,
            pollId: pollId || null,
            reason: 'forbidden',
        });
        return;
    }
    try {
        const now = new Date().toISOString();
        const optionsWithVotes = poll.options.map((opt) => ({
            label: opt.label.trim(),
            imageUrl: opt.imageUrl.trim(),
            votes: 0,
        }));
        const payload = {
            title: poll.title.trim(),
            description: poll.description.trim(),
            options: optionsWithVotes,
            totalVotes: 0,
            isActive: poll.isActive,
            updatedAt: now,
        };
        if (pollId) {
            // For updates, preserve existing vote counts in options
            const existingSnapshot = await gf().collection('polls').doc(pollId).get();
            if (existingSnapshot.exists) {
                const existingData = existingSnapshot.data();
                const existingOptions = existingData?.options ?? [];
                const existingVotesByLabel = new Map();
                for (const opt of existingOptions) {
                    existingVotesByLabel.set(opt.label, opt.votes);
                }
                const mergedOptions = optionsWithVotes.map((opt) => ({
                    ...opt,
                    votes: existingVotesByLabel.get(opt.label) ?? 0,
                }));
                payload.options = mergedOptions;
                payload.totalVotes = existingData?.totalVotes ?? 0;
            }
            await gf().collection('polls').doc(pollId).set(payload, { merge: true });
            response.status(200).json({
                ok: true,
                pollId,
                reason: 'saved',
            });
            return;
        }
        const createdPoll = await gf().collection('polls').add({
            ...payload,
            createdAt: now,
        });
        response.status(200).json({
            ok: true,
            pollId: createdPoll.id,
            reason: 'saved',
        });
    }
    catch (error) {
        response.status(500).json({
            ok: false,
            pollId: pollId || null,
            reason: 'internal_error',
            detail: error instanceof Error ? error.message : 'Unknown backend error.',
        });
    }
});
export const deletePollsAdmin = onRequest({
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).json({
            ok: false,
            pollId: null,
            reason: 'invalid_method',
        });
        return;
    }
    const botToken = telegramBotToken.value();
    if (!botToken) {
        response.status(500).json({
            ok: false,
            pollId: null,
            reason: 'missing_bot_token',
        });
        return;
    }
    const body = request.body;
    const initData = typeof body?.initData === 'string' ? body.initData : '';
    const pollIds = body?.pollIds?.filter((id) => typeof id === 'string' && id.trim().length > 0) ?? [];
    if (pollIds.length === 0) {
        response.status(400).json({
            ok: false,
            pollId: null,
            reason: 'invalid_payload',
        });
        return;
    }
    const verificationResult = verifyTelegramInitData(initData, botToken);
    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
        response.status(401).json({
            ok: false,
            pollId: null,
            reason: verificationResult.reason === 'expired_init_data'
                ? 'expired_init_data'
                : 'invalid_init_data',
        });
        return;
    }
    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
        response.status(403).json({
            ok: false,
            pollId: null,
            reason: 'forbidden',
        });
        return;
    }
    try {
        const batch = gf().batch();
        pollIds.forEach((id) => {
            batch.delete(gf().collection('polls').doc(id));
        });
        await batch.commit();
        // Also clean up poll votes for deleted polls
        const voteCleanups = pollIds.map(async (pollId) => {
            const votesSnapshot = await gf()
                .collection('pollVotes')
                .where('pollId', '==', pollId)
                .get();
            if (votesSnapshot.size > 0) {
                const voteBatch = gf().batch();
                votesSnapshot.docs.forEach((doc) => voteBatch.delete(doc.ref));
                await voteBatch.commit();
            }
        });
        await Promise.all(voteCleanups);
        response.status(200).json({
            ok: true,
            pollId: pollIds[0] ?? null,
            reason: 'deleted',
        });
    }
    catch (error) {
        response.status(500).json({
            ok: false,
            pollId: pollIds[0] ?? null,
            reason: 'internal_error',
            detail: error instanceof Error ? error.message : 'Unknown backend error.',
        });
    }
});
export const castPollVote = onRequest({
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
    const pollId = typeof body?.pollId === 'string' ? body.pollId.trim() : '';
    const optionIndex = body?.optionIndex;
    if (!pollId || typeof optionIndex !== 'number' || optionIndex < 0) {
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
        const db = gf();
        const pollRef = db.collection('polls').doc(pollId);
        await db.runTransaction(async (transaction) => {
            const pollSnapshot = await transaction.get(pollRef);
            if (!pollSnapshot.exists) {
                throw new Error('POLL_NOT_FOUND');
            }
            const pollData = pollSnapshot.data();
            if (!pollData?.isActive) {
                throw new Error('POLL_INACTIVE');
            }
            if (!pollData.options || optionIndex >= pollData.options.length) {
                throw new Error('INVALID_OPTION');
            }
            // Check if user already voted via pollVotes subcollection
            const existingVoteSnapshot = await db
                .collection('pollVotes')
                .where('pollId', '==', pollId)
                .where('telegramUserId', '==', telegramUserId)
                .limit(1)
                .get();
            if (!existingVoteSnapshot.empty) {
                throw new Error('ALREADY_VOTED');
            }
            // Record the vote
            const voteRef = db.collection('pollVotes').doc();
            transaction.set(voteRef, {
                pollId,
                telegramUserId,
                optionIndex,
                votedAt: new Date().toISOString(),
            });
            // Increment the option's vote count and totalVotes
            const options = [...pollData.options];
            options[optionIndex] = {
                ...options[optionIndex],
                votes: (options[optionIndex].votes ?? 0) + 1,
            };
            transaction.update(pollRef, {
                options,
                totalVotes: FieldValue.increment(1),
                updatedAt: new Date().toISOString(),
            });
        });
        response.status(200).json({
            ok: true,
            reason: 'voted',
        });
    }
    catch (error) {
        const detail = error instanceof Error ? error.message : 'Unknown backend error.';
        let status = 500;
        let reason = 'internal_error';
        if (detail === 'POLL_NOT_FOUND') {
            status = 404;
            reason = 'invalid_payload';
        }
        else if (detail === 'POLL_INACTIVE') {
            status = 409;
            reason = 'poll_inactive';
        }
        else if (detail === 'INVALID_OPTION') {
            status = 400;
            reason = 'invalid_option';
        }
        else if (detail === 'ALREADY_VOTED') {
            status = 409;
            reason = 'already_voted';
        }
        response.status(status).json({
            ok: false,
            reason,
            detail,
        });
    }
});
export const getPollResultsAdmin = onRequest({
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).json({
            ok: false,
            pollId: null,
            title: '',
            totalVotes: 0,
            results: [],
            reason: 'invalid_method',
        });
        return;
    }
    const botToken = telegramBotToken.value();
    if (!botToken) {
        response.status(500).json({
            ok: false,
            pollId: null,
            title: '',
            totalVotes: 0,
            results: [],
            reason: 'missing_bot_token',
        });
        return;
    }
    const body = request.body;
    const initData = typeof body?.initData === 'string' ? body.initData : '';
    const pollId = typeof body?.pollId === 'string' ? body.pollId.trim() : '';
    if (!pollId) {
        response.status(400).json({
            ok: false,
            pollId: null,
            title: '',
            totalVotes: 0,
            results: [],
            reason: 'invalid_payload',
        });
        return;
    }
    const verificationResult = verifyTelegramInitData(initData, botToken);
    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
        response.status(401).json({
            ok: false,
            pollId,
            title: '',
            totalVotes: 0,
            results: [],
            reason: verificationResult.reason === 'expired_init_data'
                ? 'expired_init_data'
                : 'invalid_init_data',
        });
        return;
    }
    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
        response.status(403).json({
            ok: false,
            pollId,
            title: '',
            totalVotes: 0,
            results: [],
            reason: 'forbidden',
        });
        return;
    }
    try {
        const pollSnapshot = await gf().collection('polls').doc(pollId).get();
        if (!pollSnapshot.exists) {
            response.status(404).json({
                ok: false,
                pollId,
                title: '',
                totalVotes: 0,
                results: [],
                reason: 'invalid_payload',
            });
            return;
        }
        const pollData = pollSnapshot.data();
        const title = pollData?.title ?? '';
        const totalVotes = pollData?.totalVotes ?? 0;
        const options = pollData?.options ?? [];
        const results = options.map((opt) => ({
            label: opt.label,
            votes: opt.votes,
            percentage: totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0,
        }));
        response.status(200).json({
            ok: true,
            pollId,
            title,
            totalVotes,
            results,
            reason: 'listed',
        });
    }
    catch (error) {
        response.status(500).json({
            ok: false,
            pollId,
            title: '',
            totalVotes: 0,
            results: [],
            reason: 'internal_error',
            detail: error instanceof Error ? error.message : 'Unknown backend error.',
        });
    }
});
