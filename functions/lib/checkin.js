// ── Daily Check-In Module ──
import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { telegramBotToken, verifyTelegramInitData, } from './helpers.js';
// ── Milestones ──
const CHECKIN_MILESTONES = [
    { threshold: 3, discountPercent: 5, label: '5% OFF' },
    { threshold: 7, discountPercent: 10, label: '10% OFF' },
    { threshold: 14, discountPercent: 15, label: '15% OFF' },
    { threshold: 30, discountPercent: 25, label: '25% OFF' },
];
function getTodayDateString() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
function getYesterdayDateString() {
    const now = new Date();
    now.setDate(now.getDate() - 1);
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
function generatePromoCode(telegramUserId, streak) {
    const suffix = String(streak).padStart(2, '0');
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `DAILY${suffix}_${telegramUserId.toString().slice(-4)}_${randomSuffix}`;
}
// ── Shared function for fetching (and optionally updating) check-in state ──
async function getCheckinState(telegramUserId) {
    const db = getFirestore();
    const docRef = db.collection('dailyCheckins').doc(String(telegramUserId));
    const snapshot = await docRef.get();
    const today = getTodayDateString();
    if (!snapshot.exists) {
        return {
            currentStreak: 0,
            longestStreak: 0,
            totalCheckIns: 0,
            lastCheckInDate: '',
            todayCheckedIn: false,
        };
    }
    const data = snapshot.data();
    const lastCheckInDate = data?.lastCheckInDate ?? '';
    return {
        currentStreak: data?.currentStreak ?? 0,
        longestStreak: data?.longestStreak ?? 0,
        totalCheckIns: data?.totalCheckIns ?? 0,
        lastCheckInDate,
        todayCheckedIn: lastCheckInDate === today,
    };
}
async function processCheckIn(telegramUserId, telegramUsername) {
    const db = getFirestore();
    const docRef = db.collection('dailyCheckins').doc(String(telegramUserId));
    const today = getTodayDateString();
    const yesterday = getYesterdayDateString();
    const result = await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(docRef);
        let currentStreak = 1;
        let longestStreak = 1;
        let totalCheckIns = 1;
        let rewardGranted = false;
        let rewardCode = null;
        let milestoneLabel = null;
        if (snapshot.exists) {
            const data = snapshot.data();
            const lastDate = data?.lastCheckInDate ?? '';
            totalCheckIns = (data?.totalCheckIns ?? 0) + 1;
            if (lastDate === today) {
                // Already checked in today — return without changes
                return {
                    status: 'already_checked_in',
                    currentStreak: data?.currentStreak ?? 0,
                    longestStreak: data?.longestStreak ?? 0,
                    totalCheckIns: data?.totalCheckIns ?? 0,
                    rewardGranted: false,
                    rewardCode: null,
                    milestoneLabel: null,
                };
            }
            if (lastDate === yesterday) {
                currentStreak = (data?.currentStreak ?? 0) + 1;
            }
            // else: streak resets to 1
            longestStreak = Math.max(currentStreak, data?.longestStreak ?? 0);
            // Check milestone
            const milestone = CHECKIN_MILESTONES.find((m) => m.threshold === currentStreak);
            if (milestone) {
                rewardGranted = true;
                milestoneLabel = milestone.label;
                rewardCode = generatePromoCode(telegramUserId, currentStreak);
                // Write promo code to Firestore
                const promoCodeRef = db.collection('promoCodes').doc();
                const now = new Date();
                const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
                transaction.set(promoCodeRef, {
                    code: rewardCode,
                    discountType: 'percentage',
                    discountValue: milestone.discountPercent,
                    isActive: true,
                    expiresAt: new Date(expiresAt.getTime()),
                    usageLimit: 1,
                    usageCount: 0,
                    createdAt: now.toISOString(),
                });
            }
        }
        // Update check-in document
        transaction.set(docRef, {
            telegramUserId,
            telegramUsername,
            currentStreak,
            longestStreak,
            totalCheckIns,
            lastCheckInDate: today,
            updatedAt: new Date().toISOString(),
        }, { merge: true });
        return {
            status: 'checked_in',
            currentStreak,
            longestStreak,
            totalCheckIns,
            rewardGranted,
            rewardCode,
            milestoneLabel,
        };
    });
    return result;
}
// ── Common handler logic ──
function buildErrorResponse(reason, detail) {
    return {
        ok: false,
        currentStreak: 0,
        longestStreak: 0,
        totalCheckIns: 0,
        todayCheckedIn: false,
        rewardGranted: false,
        rewardCode: null,
        milestoneLabel: null,
        reason,
        detail,
    };
}
// ── Cloud Function: Check in for today ──
export const dailyCheckin = onRequest({
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).json({
            ...buildErrorResponse('invalid_method'),
        });
        return;
    }
    const botToken = telegramBotToken.value();
    if (!botToken) {
        response.status(500).json({
            ...buildErrorResponse('missing_bot_token'),
        });
        return;
    }
    const body = request.body;
    const initData = typeof body?.initData === 'string' ? body.initData : '';
    if (!initData) {
        response.status(400).json({
            ...buildErrorResponse('invalid_init_data'),
        });
        return;
    }
    const verificationResult = verifyTelegramInitData(initData, botToken);
    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
        response.status(401).json({
            ...buildErrorResponse(verificationResult.reason === 'expired_init_data' ? 'expired_init_data' : 'invalid_init_data'),
        });
        return;
    }
    const telegramUserId = verificationResult.user.id;
    const telegramUsername = typeof verificationResult.user.username === 'string'
        ? verificationResult.user.username
        : null;
    try {
        const result = await processCheckIn(telegramUserId, telegramUsername);
        if (result.status === 'already_checked_in') {
            response.status(200).json({
                ok: false,
                currentStreak: result.currentStreak,
                longestStreak: result.longestStreak,
                totalCheckIns: result.totalCheckIns,
                todayCheckedIn: true,
                rewardGranted: false,
                rewardCode: null,
                milestoneLabel: null,
                reason: 'already_checked_in',
            });
            return;
        }
        response.status(200).json({
            ok: true,
            currentStreak: result.currentStreak,
            longestStreak: result.longestStreak,
            totalCheckIns: result.totalCheckIns,
            todayCheckedIn: true,
            rewardGranted: result.rewardGranted,
            rewardCode: result.rewardCode,
            milestoneLabel: result.milestoneLabel,
            reason: 'checked_in',
        });
    }
    catch (error) {
        response.status(500).json({
            ...buildErrorResponse('internal_error', error instanceof Error ? error.message : undefined),
        });
    }
});
// ── Cloud Function: Fetch current check-in status (no write) ──
export const getCheckinStatus = onRequest({
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).json({
            ...buildErrorResponse('invalid_method'),
        });
        return;
    }
    const botToken = telegramBotToken.value();
    if (!botToken) {
        response.status(500).json({
            ...buildErrorResponse('missing_bot_token'),
        });
        return;
    }
    const body = request.body;
    const initData = typeof body?.initData === 'string' ? body.initData : '';
    if (!initData) {
        response.status(400).json({
            ...buildErrorResponse('invalid_init_data'),
        });
        return;
    }
    const verificationResult = verifyTelegramInitData(initData, botToken);
    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
        response.status(401).json({
            ...buildErrorResponse(verificationResult.reason === 'expired_init_data' ? 'expired_init_data' : 'invalid_init_data'),
        });
        return;
    }
    const telegramUserId = verificationResult.user.id;
    try {
        const state = await getCheckinState(telegramUserId);
        response.status(200).json({
            ok: true,
            currentStreak: state.currentStreak,
            longestStreak: state.longestStreak,
            totalCheckIns: state.totalCheckIns,
            todayCheckedIn: state.todayCheckedIn,
            rewardGranted: false,
            rewardCode: null,
            milestoneLabel: null,
            reason: 'fetch_status',
        });
    }
    catch (error) {
        response.status(500).json({
            ...buildErrorResponse('internal_error', error instanceof Error ? error.message : undefined),
        });
    }
});
