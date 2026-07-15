const fs = require('fs');
let content = fs.readFileSync('src/index.ts', 'utf8');

// Fix 1: Add missing_bot_token and invalid_init_data to CreateCheckoutOrderResponse
const oldReason1 = "| 'created'\n    | 'invalid_method'\n    | 'invalid_payload'\n    | 'product_unavailable'\n    | 'promo_exhausted'\n    | 'early_access_restricted'\n    | 'internal_error'";
const newReason1 = "| 'created'\n    | 'invalid_method'\n    | 'invalid_payload'\n    | 'product_unavailable'\n    | 'promo_exhausted'\n    | 'early_access_restricted'\n    | 'missing_bot_token'\n    | 'invalid_init_data'\n    | 'expired_init_data'\n    | 'internal_error'";
content = content.replace(oldReason1, newReason1);

// Fix 2: Add detail to SubscribeToNotifyResponse
const oldSub = "export type SubscribeToNotifyResponse = {\n  ok: boolean\n  reason:";
const newSub = "export type SubscribeToNotifyResponse = {\n  ok: boolean\n  detail?: string\n  reason:";
content = content.replace(oldSub, newSub);

// Fix 3: Add detail to ReleaseReservationResponse - only if not already there
if (!content.includes('detail?: string') || content.indexOf('detail') > content.indexOf('ReleaseReservationResponse')) {
  const oldRel = "export type ReleaseReservationResponse = {\n  ok: boolean\n  reason:";
  const newRel = "export type ReleaseReservationResponse = {\n  ok: boolean\n  detail?: string\n  reason:";
  content = content.replace(oldRel, newRel);
}

// Fix 4: Fix ReferralInfoResponse by adding detail
const oldRef = "export type ReferralInfoResponse = {\n  ok: boolean\n  referralCode: string | null\n  referralCount: number\n  telegramUserId: number | null\n  rewardMilestones: RewardMilestone[]\n  reason:";
const newRef = "export type ReferralInfoResponse = {\n  ok: boolean\n  detail?: string\n  referralCode: string | null\n  referralCount: number\n  telegramUserId: number | null\n  rewardMilestones: RewardMilestone[]\n  reason:";
content = content.replace(oldRef, newRef);

// Fix 5: Fix the winners/finishedAt null issue
content = content.replace(/winners: null,/g, 'winners: null as unknown as GiveawayWinnerResult[] | null,');
content = content.replace(/finishedAt: null,/g, 'finishedAt: null as unknown as string | null,');

fs.writeFileSync('src/index.ts', content, 'utf8');
console.log('Functions fix applied successfully');
