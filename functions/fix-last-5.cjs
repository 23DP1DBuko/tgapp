const fs = require('fs');
const path = require('path');
const dir = p => path.join(__dirname, 'src', p);

// 1. orders.ts: remove local toApiOrder function
let o = fs.readFileSync(dir('orders.ts'), 'utf8');
let start = o.indexOf('export function toApiOrder(');
let end = o.indexOf('export const updateOrderStatusAdmin', start);
if (start >= 0 && end > start) {
  o = o.slice(0, start) + '\n' + o.slice(end);
  fs.writeFileSync(dir('orders.ts'), o, 'utf8');
  console.log('orders.ts: removed local toApiOrder');
}

// 2. orders.ts: fix response type unions
o = fs.readFileSync(dir('orders.ts'), 'utf8');
o = o.replace(
  'early_access_restricted\n    | \'internal_error\'',
  'early_access_restricted\n    | \'missing_bot_token\'\n    | \'invalid_init_data\'\n    | \'expired_init_data\'\n    | \'internal_error\''
);
fs.writeFileSync(dir('orders.ts'), o, 'utf8');
console.log('orders.ts: fixed response type union');

// 3. giveaways.ts: fix winners type
let g = fs.readFileSync(dir('giveaways.ts'), 'utf8');
g = g.replace(
  'payload.winners = existingData?.winners ?? null',
  'payload.winners = (existingData?.winners as unknown as GiveawayWinnerResult[] | null | undefined) ?? null'
);
fs.writeFileSync(dir('giveaways.ts'), g, 'utf8');
console.log('giveaways.ts: fixed winners type');

// 4. helpers.ts: fix unknown string type
let h = fs.readFileSync(dir('helpers.ts'), 'utf8');
h = h.replace(
  '(typeof t.metadata === "string" && t.metadata.length <= 200)',
  '(typeof t.metadata === "string" && (t.metadata as string).length <= 200)'
);
fs.writeFileSync(dir('helpers.ts'), h, 'utf8');
console.log('helpers.ts: fixed unknown string type');

console.log('\nDone!');
