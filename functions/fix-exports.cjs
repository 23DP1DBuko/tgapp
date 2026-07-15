const fs = require('fs')
const path = require('path')

const helpersPath = path.join(__dirname, 'src', 'helpers.ts')
let content = fs.readFileSync(helpersPath, 'utf8')

let fixCount = 0

// Fix 1: Add `export` to all function declarations that don't have it
// Pattern: line starts with `function ` (not `export function`)
content = content.replace(/^function /gm, (match) => {
  fixCount++
  return 'export function '
})

// Fix 2: Add `export` to const declarations that define utility functions
// like isProductSignal, isSignalDelta, isOrderStatus etc.
// These are single-line function-style consts
content = content.replace(/^const ([a-zA-Z]+ = .*: .* => )/gm, (match) => {
  // Check if already exported
  return match // skip, we'll handle these differently
})

// Fix 3: Add import type for domain types at the top of the file
// After the last import statement
const typeImports = `
// Type-only imports for validation functions (avoids circular runtime deps)
import type { ApiOrder, CheckoutCartItem, CheckoutAppliedPromo, CreateCheckoutOrderRequest } from './orders.js'
import type { PromoAdminInput } from './promoCodes.js'
import type { ProductAdminInput } from './products.js'
import type { GiveawayAdminInput } from './giveaways.js'
import type { CampaignAdminInput, TaskAdminInput, UploadBannerImageAdminRequest, UploadBannerImageAdminResponse, AdminAnalyticsRequest, AdminAnalyticsResponse } from './content.js'
`

// Find the last import line
const lastImportRegex = /^import .+ from ['"].*['"]$/gm
let lastImportMatch
while (lastImportRegex.exec(content) !== null) {
  lastImportMatch = lastImportRegex.lastIndex
}

if (lastImportMatch) {
  const insertPos = content.indexOf('\n', lastImportMatch)
  content = content.slice(0, insertPos + 1) + typeImports + content.slice(insertPos + 1)
  fixCount++
}

// Fix 4: Add export keyword to the `const` arrow functions that are type guards
// Pattern: isOrderStatus, isProductSignal, isSignalDelta, isPromoDiscountType
const constGuardPatterns = [
  'isOrderStatus',
  'isProductSignal',
  'isSignalDelta',
  'isPromoDiscountType',
  'isGiveawayStatus',
  'isValidGiveawayPrize',
  'isValidEntryTaskInput',
]

for (const name of constGuardPatterns) {
  const regex = new RegExp(`^(${name} =)`, 'gm')
  content = content.replace(regex, (match) => {
    fixCount++
    return `export const ${match}`
  })
}

// Also fix: export const patterns that look like arrow functions
// This regex finds "const name = ..." patterns that should be exported
content = content.replace(/^(const [a-zA-Z]+ = .*: .* => )/gm, (match) => {
  if (!match.startsWith('export') && !match.includes('export')) {
    fixCount++
    return `export ${match}`
  }
  return match
})

fs.writeFileSync(helpersPath, content, 'utf8')
console.log(`helpers.ts: ${fixCount} fixes applied`)
