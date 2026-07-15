// ── Shared imports, constants, and helper functions ──
// Auto-generated from index.ts refactoring
import crypto from 'node:crypto';
import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { onRequest } from 'firebase-functions/v2/https';
import { defineInt, defineSecret, defineString } from 'firebase-functions/params';
// ── Constants ──
export const DEFAULT_INIT_DATA_MAX_AGE_SECONDS = 60 * 60;
export const telegramBotToken = defineSecret('TELEGRAM_BOT_TOKEN');
export const telegramAdminIds = defineString('TELEGRAM_ADMIN_IDS');
export const telegramInitDataMaxAgeSeconds = defineInt('TELEGRAM_INIT_DATA_MAX_AGE_SECONDS');
export const telegramMiniAppUrl = defineString('TELEGRAM_MINI_APP_URL');
export const telegramWebhookSecret = defineSecret('TELEGRAM_WEBHOOK_SECRET');
export const ORDER_STATUSES = [
    'new',
    'waiting_for_payment',
    'paid',
    'ready_for_meetup',
    'completed',
    'cancelled',
];
export const PROMO_DISCOUNT_TYPES = ['percentage', 'fixed_amount'];
export const RESERVATION_DURATION_MS = (() => {
    try {
        const envValue = Number(process.env.RESERVATION_DURATION_MS);
        if (Number.isFinite(envValue) && envValue >= 60_000 && envValue <= 3_600_000) {
            return envValue;
        }
    }
    catch {
        // Use default
    }
    return 15 * 60 * 1000; // 15 minutes default
})();
export const PRODUCT_CATEGORIES = [
    'hoodies',
    'tshirts',
    'outerwear',
    'accessories',
    'other',
];
if (getApps().length === 0) {
    initializeApp();
}
// ── Helper functions ──
export function toApiOrder(orderId, rawData) {
    const data = rawData;
    return {
        id: orderId,
        fullName: data.fullName ?? '',
        telegramHandle: data.telegramHandle ?? '',
        telegramUserId: data.telegramUserId ?? null,
        note: data.note ?? '',
        fulfillmentType: data.fulfillmentType ?? 'delivery',
        paymentMethod: data.paymentMethod ?? 'meetup_cash',
        deliveryCity: data.deliveryCity ?? '',
        deliveryAddress: data.deliveryAddress ?? '',
        deliveryNotes: data.deliveryNotes ?? '',
        meetupLocation: data.meetupLocation ?? '',
        meetupTimeOption: data.meetupTimeOption ?? '',
        meetupNotes: data.meetupNotes ?? '',
        items: data.items ?? [],
        subtotal: data.subtotal ?? 0,
        appliedPromo: data.appliedPromo ?? null,
        total: data.total ?? 0,
        status: data.status ?? 'new',
        cancelReason: data.cancelReason ?? '',
        createdAt: typeof data.createdAt === 'object' && data.createdAt !== null && 'toDate' in data.createdAt
            ? data.createdAt.toDate().toISOString()
            : typeof data.createdAt === 'string'
                ? data.createdAt
                : null,
    };
}
export function readAdminIdsFromEnv() {
    const rawValue = telegramAdminIds.value() ?? '';
    return rawValue
        .split(',')
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value) && value > 0);
}
export function isOrderStatus(value) {
    return typeof value === 'string' && ORDER_STATUSES.includes(value);
}
export function isPromoDiscountType(value) {
    return (typeof value === 'string' &&
        PROMO_DISCOUNT_TYPES.includes(value));
}
export function isValidPollInput(value) {
    if (!value || typeof value !== 'object')
        return false;
    const p = value;
    return typeof p.title === 'string' && Array.isArray(p.options) && typeof p.isActive === 'boolean';
}
export function isValidPromoInput(value) {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const promo = value;
    return (typeof promo.code === 'string' &&
        promo.code.trim().length > 0 &&
        promo.code.trim().length <= 40 &&
        isPromoDiscountType(promo.discountType) &&
        typeof promo.discountValue === 'number' &&
        Number.isFinite(promo.discountValue) &&
        promo.discountValue > 0 &&
        promo.discountValue <= 100000 &&
        typeof promo.isActive === 'boolean' &&
        (promo.expiresAt === null || typeof promo.expiresAt === 'string') &&
        (promo.usageLimit === null ||
            (typeof promo.usageLimit === 'number' &&
                Number.isInteger(promo.usageLimit) &&
                promo.usageLimit >= 0)) &&
        (promo.usageCount === undefined ||
            promo.usageCount === null ||
            (typeof promo.usageCount === 'number' &&
                Number.isInteger(promo.usageCount) &&
                promo.usageCount >= 0)));
}
export function isValidProductInput(value) {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const product = value;
    return (typeof product.name === 'string' &&
        product.name.trim().length > 0 &&
        product.name.trim().length <= 120 &&
        typeof product.description === 'string' &&
        product.description.trim().length > 0 &&
        product.description.trim().length <= 2000 &&
        typeof product.category === 'string' &&
        PRODUCT_CATEGORIES.includes(product.category) &&
        Array.isArray(product.brandNames) &&
        product.brandNames.length <= 10 &&
        product.brandNames.every((brand) => typeof brand === 'string' && brand.trim().length > 0 && brand.trim().length <= 60) &&
        typeof product.price === 'number' &&
        Number.isFinite(product.price) &&
        product.price >= 0 &&
        product.price <= 100000 &&
        typeof product.isAvailable === 'boolean' &&
        Array.isArray(product.images) &&
        product.images.length <= 8 &&
        product.images.every((image) => typeof image === 'string' && image.length > 0 && image.length <= 2000) &&
        (product.isLimitedLabel === undefined ||
            (typeof product.isLimitedLabel === 'string' && product.isLimitedLabel.length <= 80)) &&
        (product.upcoming === undefined || typeof product.upcoming === 'boolean') &&
        (product.earlyAccessAt === undefined || product.earlyAccessAt === null || typeof product.earlyAccessAt === 'string') &&
        (product.publicAt === undefined || product.publicAt === null || typeof product.publicAt === 'string'));
}
export function isValidCheckoutCartItem(value) {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const item = value;
    return (typeof item.productId === 'string' &&
        item.productId.trim().length > 0 &&
        typeof item.name === 'string' &&
        item.name.trim().length > 0 &&
        item.name.length <= 120 &&
        typeof item.price === 'number' &&
        Number.isFinite(item.price) &&
        item.price >= 0 &&
        item.price <= 100000 &&
        item.currency === 'EUR' &&
        (item.image === null || typeof item.image === 'string'));
}
export function isValidAppliedPromo(value) {
    if (value === null) {
        return true;
    }
    if (!value || typeof value !== 'object') {
        return false;
    }
    const promo = value;
    return (typeof promo.code === 'string' &&
        promo.code.trim().length > 0 &&
        promo.code.length <= 40 &&
        isPromoDiscountType(promo.discountType) &&
        typeof promo.discountValue === 'number' &&
        Number.isFinite(promo.discountValue) &&
        typeof promo.discountAmount === 'number' &&
        Number.isFinite(promo.discountAmount) &&
        promo.discountAmount >= 0);
}
export function isValidCheckoutOrderPayload(value) {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const order = value;
    return (typeof order.initData === 'string' &&
        order.initData.trim().length > 0 &&
        typeof order.fullName === 'string' &&
        order.fullName.trim().length > 0 &&
        order.fullName.length <= 120 &&
        typeof order.telegramHandle === 'string' &&
        order.telegramHandle.trim().length > 0 &&
        order.telegramHandle.length <= 80 &&
        (order.telegramUserId === undefined ||
            order.telegramUserId === null ||
            Number.isInteger(order.telegramUserId)) &&
        typeof order.note === 'string' &&
        order.note.length <= 1000 &&
        (order.fulfillmentType === 'delivery' || order.fulfillmentType === 'meetup') &&
        (order.paymentMethod === 'meetup_cash' || order.paymentMethod === 'usdt') &&
        typeof order.deliveryCity === 'string' &&
        order.deliveryCity.length <= 120 &&
        typeof order.deliveryAddress === 'string' &&
        order.deliveryAddress.length <= 240 &&
        typeof order.deliveryNotes === 'string' &&
        order.deliveryNotes.length <= 1000 &&
        typeof order.meetupLocation === 'string' &&
        order.meetupLocation.length <= 80 &&
        typeof order.meetupTimeOption === 'string' &&
        order.meetupTimeOption.length <= 80 &&
        typeof order.meetupNotes === 'string' &&
        order.meetupNotes.length <= 1000 &&
        Array.isArray(order.items) &&
        order.items.length > 0 &&
        order.items.length <= 12 &&
        order.items.every((item) => isValidCheckoutCartItem(item)) &&
        typeof order.subtotal === 'number' &&
        Number.isFinite(order.subtotal) &&
        order.subtotal >= 0 &&
        isValidAppliedPromo(order.appliedPromo) &&
        typeof order.total === 'number' &&
        Number.isFinite(order.total) &&
        order.total >= 0 &&
        isOrderStatus(order.status) &&
        typeof order.cancelReason === 'string' &&
        order.cancelReason.length <= 500);
}
export function isProductSignal(value) {
    return value === 'likesCount' || value === 'cartCount';
}
export function isSignalDelta(value) {
    return value === 1 || value === -1;
}
const VALID_ORDER_TRANSITIONS = {
    'new': ['ready_for_meetup', 'completed', 'cancelled'],
    'waiting_for_payment': ['paid', 'cancelled'],
    'paid': ['ready_for_meetup', 'completed', 'cancelled'],
    'ready_for_meetup': ['completed', 'cancelled'],
    'completed': [],
    'cancelled': [],
};
export function isValidOrderTransition(currentStatus, nextStatus) {
    const allowed = VALID_ORDER_TRANSITIONS[currentStatus];
    if (!allowed)
        return false;
    return allowed.includes(nextStatus);
}
export function isValidCampaignInput(value) {
    if (!value || typeof value !== 'object')
        return false;
    const c = value;
    return (typeof c.tag === 'string' && c.tag.trim().length > 0 && c.tag.trim().length <= 80 &&
        typeof c.headingPart1 === 'string' && c.headingPart1.trim().length > 0 && c.headingPart1.trim().length <= 120 &&
        typeof c.headingPart2 === 'string' && c.headingPart2.trim().length <= 120 &&
        typeof c.subtitle === 'string' && c.subtitle.trim().length <= 240 &&
        typeof c.imageUrl === 'string' && c.imageUrl.trim().length <= 2000 &&
        typeof c.isActive === 'boolean' &&
        typeof c.sortOrder === 'number' && Number.isFinite(c.sortOrder) && c.sortOrder >= 0);
}
export function isValidTaskInput(value) {
    if (!value || typeof value !== 'object')
        return false;
    const t = value;
    return (typeof t.title === 'string' && t.title.trim().length > 0 && t.title.trim().length <= 120 &&
        (t.rewardType === 'coupon' || t.rewardType === 'ticket') &&
        typeof t.rewardValue === 'string' && t.rewardValue.trim().length > 0 && t.rewardValue.trim().length <= 60 &&
        (t.status === 'active' || t.status === 'inactive') &&
        typeof t.sortOrder === 'number' && Number.isFinite(t.sortOrder) && t.sortOrder >= 0);
}
export function isValidGiveawayInput(value) {
    if (!value || typeof value !== 'object')
        return false;
    const g = value;
    return (typeof g.title === 'string' && g.title.trim().length > 0 && g.title.trim().length <= 200 &&
        typeof g.description === 'string' && g.description.length <= 2000 &&
        (g.imageUrl === undefined || typeof g.imageUrl === 'string') && typeof g.status === 'string' && ['draft', 'scheduled', 'live', 'finished', 'announced'].includes(g.status) &&
        (g.startAt === null || typeof g.startAt === 'string') &&
        typeof g.endAt === 'string' && g.endAt.length > 0 &&
        Array.isArray(g.prizes) && g.prizes.length >= 1 && (g.accessLevel === 'public' || g.accessLevel === 'early_access_only') && Array.isArray(g.entryTasks) && typeof g.baseEntryTickets === 'number' && Number.isInteger(g.baseEntryTickets) && g.baseEntryTickets >= 0 && g.baseEntryTickets <= 1000);
}
export function isValidGiveawayStatus(value) {
    return typeof value === 'string' && ['draft', 'scheduled', 'live', 'finished', 'announced'].includes(value);
}
export function isValidGiveawayPrize(value) {
    if (!value || typeof value !== "object")
        return false;
    const p = value;
    return typeof p.productId === "string" && p.productId.trim().length > 0 && p.productId.length <= 120 && typeof p.place === "number" && Number.isInteger(p.place) && p.place >= 1;
}
export function isValidEntryTaskInput(value) {
    if (!value || typeof value !== "object")
        return false;
    const t = value;
    return typeof t.type === "string" && ["join_channel", "invite_friend", "like_product", "custom"].includes(t.type) && typeof t.label === "string" && t.label.trim().length > 0 && t.label.length <= 200 && typeof t.ticketsGranted === "number" && Number.isInteger(t.ticketsGranted) && t.ticketsGranted >= 1 && t.ticketsGranted <= 100 && typeof t.verifyMethod === "string" && ["telegram_api", "referral_count", "manual"].includes(t.verifyMethod) && (t.metadata === undefined || t.metadata === null || (typeof t.metadata === "string" && t.metadata.length <= 200));
}
export function generateShortId() {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 8; i++)
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
}
export function isValidUploadImagePayload(value) {
    return (typeof value.fileName === 'string' &&
        value.fileName.trim().length > 0 &&
        value.fileName.trim().length <= 240 &&
        typeof value.contentType === 'string' &&
        value.contentType.startsWith('image/') &&
        value.contentType.length <= 120 &&
        typeof value.base64Data === 'string' &&
        value.base64Data.length > 0);
}
export function sanitizeStorageFileName(fileName) {
    return fileName.replace(/[^a-zA-Z0-9._-]+/g, '-').toLowerCase();
}
export function buildFirebaseDownloadUrl(bucketName, storagePath, downloadToken) {
    return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`;
}
export function parseStoragePathFromImageUrl(imageUrl, bucketName) {
    if (imageUrl.startsWith(`gs://${bucketName}/`)) {
        return imageUrl.replace(`gs://${bucketName}/`, '');
    }
    try {
        const parsedUrl = new URL(imageUrl);
        if (parsedUrl.hostname.includes('firebasestorage.googleapis.com') &&
            parsedUrl.pathname.startsWith(`/v0/b/${bucketName}/o/`)) {
            return decodeURIComponent(parsedUrl.pathname.replace(`/v0/b/${bucketName}/o/`, ''));
        }
        if (parsedUrl.hostname === 'storage.googleapis.com') {
            const normalizedPath = parsedUrl.pathname.replace(/^\/+/, '');
            if (normalizedPath.startsWith(`${bucketName}/`)) {
                return decodeURIComponent(normalizedPath.replace(`${bucketName}/`, ''));
            }
        }
    }
    catch {
        return null;
    }
    return null;
}
export function verifyTelegramInitData(initData, botToken) {
    if (!initData) {
        return { reason: 'invalid_init_data', user: null };
    }
    const parsed = new URLSearchParams(initData);
    const providedHash = parsed.get('hash');
    if (!providedHash) {
        return { reason: 'invalid_init_data', user: null };
    }
    const dataCheckString = Array.from(parsed.entries())
        .filter(([key]) => key !== 'hash')
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
    const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(botToken)
        .digest();
    const computedHash = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');
    if (computedHash.length !== providedHash.length ||
        !crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(providedHash))) {
        return { reason: 'invalid_init_data', user: null };
    }
    const authDate = Number(parsed.get('auth_date'));
    if (!Number.isFinite(authDate)) {
        return { reason: 'invalid_init_data', user: null };
    }
    const maxAgeSeconds = readInitDataMaxAgeSeconds();
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (nowSeconds - authDate > maxAgeSeconds) {
        return { reason: 'expired_init_data', user: null };
    }
    const rawUser = parsed.get('user');
    if (!rawUser) {
        return { reason: 'invalid_init_data', user: null };
    }
    try {
        return {
            reason: 'ok',
            user: JSON.parse(rawUser),
        };
    }
    catch {
        return { reason: 'invalid_init_data', user: null };
    }
}
export function readInitDataMaxAgeSeconds() {
    const rawValue = telegramInitDataMaxAgeSeconds.value();
    if (Number.isInteger(rawValue) && rawValue > 0) {
        return rawValue;
    }
    return DEFAULT_INIT_DATA_MAX_AGE_SECONDS;
}
export async function sendTelegramOrderCancelledMessage(botToken, telegramUserId, orderId, cancelReason) {
    const lines = [
        `Order ${orderId} is cancelled.`,
        cancelReason ? `Reason: ${cancelReason}` : 'Reason: not provided.',
        'If you want help or a different piece, reply here in Telegram.',
    ];
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            chat_id: telegramUserId,
            text: lines.join('\n'),
        }),
    });
    if (!response.ok) {
        const bodyText = await response.text();
        throw new Error(`Telegram sendMessage failed: ${response.status} ${bodyText}`);
    }
}
export async function sendTelegramOrderPaidMessage(botToken, telegramUserId, orderId) {
    const lines = [
        `Order ${orderId} is locked in.`,
        'Payment was confirmed and your piece is moving to the next step.',
        'We will message you here when meetup or delivery is ready.',
    ];
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            chat_id: telegramUserId,
            text: lines.join('\n'),
        }),
    });
    if (!response.ok) {
        const bodyText = await response.text();
        throw new Error(`Telegram sendMessage failed: ${response.status} ${bodyText}`);
    }
}
export async function sendTelegramOrderCompletedMessage(botToken, telegramUserId, orderId) {
    const lines = [
        `Order ${orderId} is complete.`,
        'Thanks for grabbing a piece from the drop.',
        'Stay close to the bot if you want first access to the next release.',
    ];
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            chat_id: telegramUserId,
            text: lines.join('\n'),
        }),
    });
    if (!response.ok) {
        const bodyText = await response.text();
        throw new Error(`Telegram sendMessage failed: ${response.status} ${bodyText}`);
    }
}
export async function sendTelegramOrderReadyForMeetupMessage(botToken, telegramUserId, orderId) {
    const lines = [
        `Order ${orderId} is meetup-ready.`,
        'Your piece is packed and ready for handoff.',
        'Watch this chat for the final place and time confirmation.',
    ];
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            chat_id: telegramUserId,
            text: lines.join('\n'),
        }),
    });
    if (!response.ok) {
        const bodyText = await response.text();
        throw new Error(`Telegram sendMessage failed: ${response.status} ${bodyText}`);
    }
}
export async function sendTelegramOrderCreatedMessage(botToken, miniAppUrl, telegramUserId, orderId, itemsSummary, total, fulfillmentType, status) {
    const statusLabel = status === 'waiting_for_payment' ? 'Waiting for Payment' : 'New';
    const fulfillmentLabel = fulfillmentType === 'delivery' ? 'Delivery' : 'Meetup';
    const lines = [
        '✅ Order Confirmed',
        '',
        `Order: ${orderId}`,
        `Items: ${itemsSummary}`,
        `Total: ${total} EUR`,
        `Fulfillment: ${fulfillmentLabel}`,
        `Status: ${statusLabel}`,
    ];
    if (miniAppUrl) {
        lines.push('', `Track it: ${miniAppUrl}`);
    }
    lines.push('', 'We will message you here when the status changes.');
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            chat_id: telegramUserId,
            text: lines.join('\\n'),
        }),
    });
    if (!response.ok) {
        const bodyText = await response.text();
        throw new Error(`Telegram sendMessage failed: ${response.status} ${bodyText}`);
    }
}
export function isStartCommand(messageText) {
    const normalizedText = messageText.toLowerCase();
    return normalizedText === '/start' || normalizedText.startsWith('/start ');
}
export function isStoreCommand(messageText) {
    const normalizedText = messageText.toLowerCase();
    return normalizedText === '/store';
}
export function isHelpCommand(messageText) {
    const normalizedText = messageText.toLowerCase();
    return normalizedText === '/help';
}
export async function sendTelegramStoreWelcomeMessage(botToken, chatId, firstName) {
    const miniAppUrl = telegramMiniAppUrl.value();
    if (!miniAppUrl) {
        throw new Error('TELEGRAM_MINI_APP_URL is not configured.');
    }
    const greetingLine = firstName ? `Yo ${firstName}, the drop is live.` : 'Yo, the drop is live.';
    const text = [
        greetingLine,
        'Open the store to browse the current pieces, save favorites, and send a real order request inside Telegram.',
    ].join('\n\n');
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: 'Open Store',
                            web_app: {
                                url: miniAppUrl,
                            },
                        },
                    ],
                    [
                        {
                            text: 'Store Link',
                            url: miniAppUrl,
                        },
                    ],
                ],
            },
        }),
    });
    if (!response.ok) {
        const bodyText = await response.text();
        throw new Error(`Telegram sendMessage failed: ${response.status} ${bodyText}`);
    }
}
export async function sendTelegramStoreShortcutMessage(botToken, chatId) {
    const miniAppUrl = telegramMiniAppUrl.value();
    if (!miniAppUrl) {
        throw new Error('TELEGRAM_MINI_APP_URL is not configured.');
    }
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            chat_id: chatId,
            text: 'Store is here. Open the Mini App and move fast if a piece is getting attention.',
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: 'Open Store',
                            web_app: {
                                url: miniAppUrl,
                            },
                        },
                    ],
                ],
            },
        }),
    });
    if (!response.ok) {
        const bodyText = await response.text();
        throw new Error(`Telegram sendMessage failed: ${response.status} ${bodyText}`);
    }
}
export async function sendTelegramHelpMessage(botToken, chatId) {
    const lines = [
        'Commands',
        '/start - get the welcome message and open-store button',
        '/store - open the store entry message again',
        '/help - show this help text',
        '',
        'Tip: use the Open Store button for the cleanest Mini App flow.',
    ];
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            chat_id: chatId,
            text: lines.join('\n'),
        }),
    });
    if (!response.ok) {
        const bodyText = await response.text();
        throw new Error(`Telegram sendMessage failed: ${response.status} ${bodyText}`);
    }
}
export async function sendTelegramBroadcastMessage(botToken, chatId, text) {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            chat_id: chatId,
            text,
        }),
    });
    if (!response.ok) {
        const bodyText = await response.text();
        throw new Error(`Telegram sendMessage failed: ${response.status} ${bodyText}`);
    }
}
export async function upsertTelegramSubscriberFromUpdate(body, referralCode) {
    const message = body?.message;
    const from = message?.from;
    const chat = message?.chat;
    const telegramUserId = typeof from?.id === 'number' ? from.id : null;
    const chatId = typeof chat?.id === 'number' ? chat.id : null;
    const username = typeof from?.username === 'string' ? from.username : null;
    const firstName = typeof from?.first_name === 'string' ? from.first_name : null;
    if (!telegramUserId || !chatId) {
        return;
    }
    const db = getFirestore();
    const docRef = db.collection('telegramSubscribers').doc(String(telegramUserId));
    await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(docRef);
        const now = FieldValue.serverTimestamp();
        if (!snapshot.exists) {
            const subscriberData = {
                telegramUserId,
                chatId,
                username,
                firstName,
                isAdmin: false,
                allowBroadcasts: true,
                createdAt: now,
                lastSeenAt: now,
            };
            // Only store referredBy on first visit, never overwrite
            if (referralCode) {
                subscriberData.referredBy = referralCode;
            }
            transaction.set(docRef, subscriberData);
        }
        else {
            transaction.set(docRef, {
                chatId,
                username,
                firstName,
                lastSeenAt: now,
            }, { merge: true });
        }
    });
}
export function parseReferralCode(messageText) {
    // Expected format: /start ref_123456789
    const parts = messageText.split(' ');
    if (parts.length < 2)
        return null;
    const potentialCode = parts[1].trim();
    // Only accept codes starting with ref_ to avoid matching arbitrary args
    if (potentialCode.startsWith('ref_') && potentialCode.length > 4 && potentialCode.length <= 80) {
        return potentialCode;
    }
    return null;
}
export const uploadBannerImageAdmin = onRequest({
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
        const storagePath = `banners/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
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
export const uploadGiveawayImageAdmin = onRequest({
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
        const storagePath = `giveaways/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
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
export const getAdminAnalytics = onRequest({
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).json({
            ok: false,
            totalUsers: 0,
            itemsSold: 0,
            grossRevenueEur: 0,
            referralCount: 0,
            reason: 'invalid_method',
        });
        return;
    }
    const botToken = telegramBotToken.value();
    if (!botToken) {
        response.status(500).json({
            ok: false,
            totalUsers: 0,
            itemsSold: 0,
            grossRevenueEur: 0,
            referralCount: 0,
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
            totalUsers: 0,
            itemsSold: 0,
            grossRevenueEur: 0,
            referralCount: 0,
            reason: verificationResult.reason === 'expired_init_data'
                ? 'expired_init_data'
                : 'invalid_init_data',
        });
        return;
    }
    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
        response.status(403).json({
            ok: false,
            totalUsers: 0,
            itemsSold: 0,
            grossRevenueEur: 0,
            referralCount: 0,
            reason: 'forbidden',
        });
        return;
    }
    try {
        const db = getFirestore();
        // Count all telegramSubscribers
        const subscribersSnapshot = await db.collection('telegramSubscribers').count().get();
        const totalUsers = subscribersSnapshot.data().count;
        // Aggregate order data — all orders
        const ordersSnapshot = await db.collection('orders').get();
        let itemsSold = 0;
        let grossRevenueEur = 0;
        for (const doc of ordersSnapshot.docs) {
            const data = doc.data();
            // Count items in each order
            if (Array.isArray(data.items)) {
                itemsSold += data.items.length;
            }
            // Sum total for completed/paid/ready_for_meetup orders
            const status = typeof data.status === 'string' ? data.status : '';
            if (status === 'completed' || status === 'paid' || status === 'ready_for_meetup') {
                const total = typeof data.total === 'number' ? data.total : 0;
                grossRevenueEur += total;
            }
        }
        // Count referrals (subscribers with a non-empty referredBy field)
        const referredSnapshot = await db
            .collection('telegramSubscribers')
            .where('referredBy', '>=', '')
            .count()
            .get();
        const referralCount = referredSnapshot.data().count;
        response.status(200).json({
            ok: true,
            totalUsers,
            itemsSold,
            grossRevenueEur: Math.round(grossRevenueEur * 100) / 100,
            referralCount,
            reason: 'listed',
        });
    }
    catch (error) {
        response.status(500).json({
            ok: false,
            totalUsers: 0,
            itemsSold: 0,
            grossRevenueEur: 0,
            referralCount: 0,
            reason: 'internal_error',
            detail: error instanceof Error ? error.message : 'Unknown backend error.',
        });
    }
});
export async function notifyProductSubscribers(productId) {
    const db = getFirestore();
    const botToken = telegramBotToken.value();
    if (!botToken)
        return;
    const productSnapshot = await db.collection('products').doc(productId).get();
    if (!productSnapshot.exists)
        return;
    const productData = productSnapshot.data();
    const productName = productData?.name ?? 'A product';
    const subscriptionsSnapshot = await db
        .collection('productNotifySubscriptions')
        .where('productId', '==', productId)
        .where('notifiedAt', '==', null)
        .get();
    if (subscriptionsSnapshot.empty)
        return;
    const miniAppUrl = telegramMiniAppUrl.value();
    const text = [
        `📢 ${productName} is now available!`,
        '',
        'The piece you were waiting for is ready. Open the store to grab it before it sells out.',
        miniAppUrl ? `👉 Open the store: ${miniAppUrl}` : '',
    ].filter(Boolean).join('\n');
    let sentCount = 0;
    let failedCount = 0;
    const batch = db.batch();
    for (const doc of subscriptionsSnapshot.docs) {
        const subscriptionData = doc.data();
        const telegramUserId = subscriptionData.telegramUserId;
        if (!telegramUserId) {
            failedCount += 1;
            continue;
        }
        try {
            await sendTelegramBroadcastMessage(botToken, telegramUserId, text);
            sentCount += 1;
            batch.update(doc.ref, { notifiedAt: new Date().toISOString() });
        }
        catch {
            failedCount += 1;
        }
    }
    try {
        await batch.commit();
    }
    catch {
        console.error('Failed to mark subscribers as notified', productId);
    }
    console.log(`Notified ${sentCount} subscribers for product ${productId} (${failedCount} failed)`);
}
export async function processAndCheckRewards(_db, _telegramUserId, _referralCount) {
    return [];
}
