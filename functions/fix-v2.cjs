const fs = require('fs');
const path = require('path');
const base = path.join(__dirname, 'src');

function read(name) { return fs.readFileSync(path.join(base, name), 'utf8'); }
function write(name, content) { fs.writeFileSync(path.join(base, name), content, 'utf8'); }

let totalFixes = 0;

// === 1. helpers.ts: fix toApiOrder export + implicit any ===
let h = read('helpers.ts');
if (h.includes('function toApiOrder(') && !h.includes('export function toApiOrder(')) {
  h = h.split('function toApiOrder(').join('export function toApiOrder(');
  totalFixes++;
}
// Fix implicit any for value parameters
h = h.replace(
  'function isValidPollInput(value)',
  'function isValidPollInput(value: unknown)'
);
h = h.replace(
  ', isValidPollInput as never,\n',
  ',\n  isValidPollInput,\n'
);
totalFixes++;
write('helpers.ts', h);
console.log('helpers.ts: OK');

// === 2. content.ts: add detail field to types ===
let c = read('content.ts');
// Fix SubscribeToNotifyResponse
let idx = c.indexOf('export type SubscribeToNotifyResponse =');
if (idx >= 0) {
  let endIdx = c.indexOf('}', idx) + 1;
  let typeBlock = c.substring(idx, endIdx);
  if (!typeBlock.includes('detail?')) {
    typeBlock = typeBlock.replace('ok: boolean\n  reason:', 'ok: boolean\n  detail?: string\n  reason:');
    c = c.substring(0, idx) + typeBlock + c.substring(endIdx);
    totalFixes++;
  }
}
// Fix ReferralInfoResponse
idx = c.indexOf('export type ReferralInfoResponse =');
if (idx >= 0) {
  let endIdx = c.indexOf('}', idx) + 1;
  let typeBlock = c.substring(idx, endIdx);
  if (!typeBlock.includes('detail?')) {
    typeBlock = typeBlock.replace('ok: boolean\n  referralCode', 'ok: boolean\n  detail?: string\n  referralCode');
    c = c.substring(0, idx) + typeBlock + c.substring(endIdx);
    totalFixes++;
  }
}
write('content.ts', c);
console.log('content.ts: OK');

// === 3. giveaways.ts: fix winners type ===
let g = read('giveaways.ts');
g = g.replace(
  'winners: existingData?.winners ?? null',
  'winners: (existingData?.winners as GiveawayWinnerResult[] | null | undefined) ?? null'
);
totalFixes++;
write('giveaways.ts', g);
console.log('giveaways.ts: OK');

// === 4. orders.ts: fix imports + response type + instanceof ===
let o = read('orders.ts');
// Check what helpers.js imports are actually present
let helperImportEnd = o.indexOf("} from './helpers.js'");
if (helperImportEnd >= 0) {
  let importBlock = o.substring(0, helperImportEnd);
  if (!importBlock.includes('toApiOrder')) {
    o = o.replace("} from './helpers.js'", "  toApiOrder,\n} from './helpers.js'");
    totalFixes++;
  }
  if (!importBlock.includes('PROMO_DISCOUNT_TYPES')) {
    o = o.replace("} from './helpers.js'", "  PROMO_DISCOUNT_TYPES,\n} from './helpers.js'");
    totalFixes++;
  }
}
// Fix CreateCheckoutOrderResponse.reason
o = o.replace(
  "| 'created'\n    | 'invalid_method'\n    | 'invalid_payload'\n    | 'product_unavailable'\n    | 'promo_exhausted'\n    | 'early_access_restricted'\n    | 'internal_error'",
  "| 'created'\n    | 'invalid_method'\n    | 'invalid_payload'\n    | 'product_unavailable'\n    | 'promo_exhausted'\n    | 'early_access_restricted'\n    | 'missing_bot_token'\n    | 'invalid_init_data'\n    | 'expired_init_data'\n    | 'internal_error'"
);
totalFixes++;

// Fix instanceof issue - toApiOrder uses raw Data
// Read line 180 context
const lines = o.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('instanceof')) {
    lines[i] = '    createdAt: typeof data.createdAt === "object" && data.createdAt !== null && "toDate" in data.createdAt ? (data.createdAt as any).toDate().toISOString() : (typeof data.createdAt === "string" ? data.createdAt : null),';
    totalFixes++;
    break;
  }
}
o = lines.join('\n');
write('orders.ts', o);
console.log('orders.ts: OK');

// === 5. polls.ts: fix duplicate getFirestore ===
let po = read('polls.ts');
po = po.replace(
  "import { onRequest } from 'firebase-functions/v2/https'\nimport { FieldValue, getFirestore } from 'firebase-admin/firestore'",
  "import { onRequest } from 'firebase-functions/v2/https'\nimport { FieldValue, getFirestore as gf } from 'firebase-admin/firestore'"
);
po = po.replace(/\bgetFirestore\(\)/g, 'gf()');
totalFixes++;
write('polls.ts', po);
console.log('polls.ts: OK');

// === 6. products.ts: fix response types ===
let pr = read('products.ts');
pr = pr.replace(
  'export type ReleaseReservationResponse = {\n  ok: boolean\n  reason:',
  'export type ReleaseReservationResponse = {\n  ok: boolean\n  detail?: string\n  reason:'
);
pr = pr.replace(
  "export type UpdateProductSignalResponse = {\n  ok: boolean\n  productId: string | null\n  signal: 'likesCount' | 'cartCount' | null",
  "export type UpdateProductSignalResponse = {\n  ok: boolean\n  productId: string | null\n  signal: 'likesCount' | 'cartCount' | null | undefined"
);
totalFixes += 2;
write('products.ts', pr);
console.log('products.ts: OK');

console.log(`\nTotal: ${totalFixes} fixes applied`);
