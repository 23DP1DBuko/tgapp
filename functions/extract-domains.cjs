const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, 'src', 'index.ts'), 'utf8');
const lines = content.split('\n');

// Extract section by line range (1-indexed)
function extract(start, end) {
  return lines.slice(start - 1, Math.min(end, lines.length)).join('\n');
}

// ========================================
// Module script: outputs each domain file
// ========================================

console.log('helpers.ts' + extract(4273, 5425).length + ' chars (already written)');

// ── ORDERS MODULE ──
const ordersTypes = extract(64, 88) + '\n\n' + extract(167, 273);
const ordersFunctions = extract(990, 1157) + '\n\n' + extract(1158, 1232) + '\n\n' + extract(1641, 1879) + '\n\n' + extract(1880, 1946);
const ordersContent = `// ── Orders Module ──
import { onRequest } from 'firebase-functions/v2/https'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import {
  telegramBotToken,
  telegramAdminIds,
  telegramMiniAppUrl,
  ORDER_STATUSES,
  readAdminIdsFromEnv,
  verifyTelegramInitData,
  toApiOrder,
  isValidCheckoutOrderPayload,
  isValidOrderTransition,
  sendTelegramOrderCancelledMessage,
  sendTelegramOrderPaidMessage,
  sendTelegramOrderReadyForMeetupMessage,
  sendTelegramOrderCompletedMessage,
  sendTelegramOrderCreatedMessage,
  type TelegramInitDataUser,
} from './helpers'

${ordersTypes}

${ordersFunctions}
`;

fs.writeFileSync(path.join(__dirname, 'src', 'orders.ts'), ordersContent);
console.log('Created orders.ts (' + ordersContent.length + ' chars)');

// ── PRODUCTS MODULE ──
const productsTypes = extract(126, 166) + '\n\n' + extract(274, 336) + '\n\n' + extract(337, 402);
const productsFunctions = extract(1425, 1640) + '\n\n' + extract(1947, 2304) + '\n\n' + extract(2305, 2421) + '\n\n' + extract(2422, 2518);
const productsContent = `// ── Products Module ──
import crypto from 'node:crypto'
import { onRequest } from 'firebase-functions/v2/https'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import {
  telegramBotToken,
  telegramAdminIds,
  PRODUCT_CATEGORIES,
  RESERVATION_DURATION_MS,
  readAdminIdsFromEnv,
  verifyTelegramInitData,
  isValidProductInput,
  isProductSignal,
  isSignalDelta,
  isValidUploadImagePayload,
  sanitizeStorageFileName,
  buildFirebaseDownloadUrl,
  parseStoragePathFromImageUrl,
  notifyProductSubscribers,
  type TelegramInitDataUser,
} from './helpers'

${productsTypes}

${productsFunctions}
`;

fs.writeFileSync(path.join(__dirname, 'src', 'products.ts'), productsContent);
console.log('Created products.ts (' + productsContent.length + ' chars)');

// ── PROMO CODES MODULE ──
const promoCodesTypes = extract(89, 125);
const promoCodesFunctions = extract(1233, 1424);
const promoCodesContent = `// ── Promo Codes Module ──
import { onRequest } from 'firebase-functions/v2/https'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import {
  telegramBotToken,
  telegramAdminIds,
  PROMO_DISCOUNT_TYPES,
  readAdminIdsFromEnv,
  verifyTelegramInitData,
  isValidPromoInput,
  type TelegramInitDataUser,
} from './helpers'

${promoCodesTypes}

${promoCodesFunctions}
`;

fs.writeFileSync(path.join(__dirname, 'src', 'promoCodes.ts'), promoCodesContent);
console.log('Created promoCodes.ts (' + promoCodesContent.length + ' chars)');

// ── GIVEAWAYS MODULE ──
const giveawaysTypes = extract(508, 688);
const giveawaysFunctions = extract(3001, 3249);
const giveawaysContent = `// ── Giveaways Module ──
import { onRequest } from 'firebase-functions/v2/https'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import {
  telegramBotToken,
  telegramAdminIds,
  readAdminIdsFromEnv,
  verifyTelegramInitData,
  isValidGiveawayInput,
  isValidGiveawayPrize,
  isValidEntryTaskInput,
  generateShortId,
  type TelegramInitDataUser,
} from './helpers'

${giveawaysTypes}

${giveawaysFunctions}
`;

fs.writeFileSync(path.join(__dirname, 'src', 'giveaways.ts'), giveawaysContent);
console.log('Created giveaways.ts (' + giveawaysContent.length + ' chars)');

// ── POLLS MODULE ──
const pollsTypes = extract(3463, 3552);
const pollsFunctions = extract(3553, 4069);
const pollsContent = `// ── Polls Module ──
import { onRequest } from 'firebase-functions/v2/https'
import { getFirestore } from 'firebase-admin/firestore'
import {
  telegramBotToken,
  telegramAdminIds,
  readAdminIdsFromEnv,
  verifyTelegramInitData,
  isValidPollInput,
  type TelegramInitDataUser,
} from './helpers'

${pollsTypes}

${pollsFunctions}
`;

fs.writeFileSync(path.join(__dirname, 'src', 'polls.ts'), pollsContent);
console.log('Created polls.ts (' + pollsContent.length + ' chars)');

// ── CONTENT MODULE ── (campaigns, tasks, notify, referral, broadcast, admin analytics, admin verify, image uploads)
const contentTypes = extract(47, 63) + '\n\n' + extract(403, 425) + '\n\n' + extract(426, 470) + '\n\n' + extract(833, 854) + '\n\n' + extract(3250, 3267) + '\n\n' + extract(4070, 4103);
const contentFunctions = extract(690, 831) + '\n\n' + extract(855, 989) + '\n\n' + extract(2519, 2805) + '\n\n' + extract(2806, 3000) + '\n\n' + extract(3268, 3462) + '\n\n' + extract(4104, 4192);
const contentContent = `// ── Content Module ── (Campaigns, Tasks, Notify, Referral, Broadcast, Admin)
import crypto from 'node:crypto'
import { onRequest } from 'firebase-functions/v2/https'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import {
  telegramBotToken,
  telegramAdminIds,
  telegramMiniAppUrl,
  telegramWebhookSecret,
  readAdminIdsFromEnv,
  verifyTelegramInitData,
  isValidCampaignInput,
  isValidTaskInput,
  sendTelegramBroadcastMessage,
  upsertTelegramSubscriberFromUpdate,
  sendTelegramStoreWelcomeMessage,
  sendTelegramStoreShortcutMessage,
  sendTelegramHelpMessage,
  isStartCommand,
  isStoreCommand,
  isHelpCommand,
  parseReferralCode,
  processAndCheckRewards,
  isValidUploadImagePayload,
  sanitizeStorageFileName,
  buildFirebaseDownloadUrl,
  parseStoragePathFromImageUrl,
  type TelegramInitDataUser,
  type TelegramWebhookRequest,
} from './helpers'

${contentTypes}

${contentFunctions}
`;

fs.writeFileSync(path.join(__dirname, 'src', 'content.ts'), contentContent);
console.log('Created content.ts (' + contentContent.length + ' chars)');

console.log('\\nAll domain modules created!');
