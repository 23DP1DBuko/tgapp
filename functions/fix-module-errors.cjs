const fs = require('fs')
const path = require('path')

const srcDir = path.join(__dirname, 'src')

// Apply all fixes to a file content and return the fixed content + fix count
function applyFixes(filePath) {
  let content = fs.readFileSync(filePath, 'utf8')
  const fileName = path.basename(filePath)
  let fixCount = 0

  // Fix 1: Add .js extension to relative imports
  const importRegex = /from\s+'\.\/(helpers|orders|products|promoCodes|giveaways|polls|content)(?!\.js)'/g
  const newContent = content.replace(importRegex, (match, modName) => {
    fixCount++
    return `from './${modName}.js'`
  })
  content = newContent

  // Fix 2: Fix import extension for import './helpers' type imports
  // (side-effect imports without `from`)
  const sideImportRegex = /import\s+'\.\/(helpers|orders|products|promoCodes|giveaways|polls|content)(?!\.js)'/g
  const newContent2 = content.replace(sideImportRegex, (match, modName) => {
    fixCount++
    return `import './${modName}.js'`
  })
  content = newContent2

  // Fix 3: Add missing FieldValue import to polls.ts
  if (fileName === 'polls.ts') {
    if (content.includes('FieldValue') && !content.includes("import { FieldValue")) {
      content = content.replace(
        "import { onRequest } from 'firebase-functions/v2/https'",
        "import { onRequest } from 'firebase-functions/v2/https'\nimport { FieldValue, getFirestore } from 'firebase-admin/firestore'"
      )
      fixCount++
    }
  }

  // Fix 4: Add type imports to helpers.ts for types referenced across modules
  if (fileName === 'helpers.ts') {
    // Find the last import line and add type imports from each domain module
    const lastImportLine = content.lastIndexOf("import { onRequest } from 'firebase-functions/v2/https'")
    if (lastImportLine >= 0) {
      const afterLastImport = content.indexOf('\n', lastImportLine)
      // The types that helpers.ts references from other modules need to either be
      // defined in helpers.ts or imported. Since the extraction script put them
      // in domain modules, we need to move the referenced functions/types into helpers.ts
      // Actually the cleanest fix is to just move the validator functions into helpers.ts
      // since they're already referenced there
    }
  }

  // Fix 5: Handle missing TaskAdminResponse type in content.ts
  // The task-related types need to be exported from helpers.ts or defined in content.ts
  if (fileName === 'content.ts') {
    // Add missing type exports that content.ts needs
    // TaskAdminInput, TaskAdminResponse, UpsertTaskAdminRequest, DeleteTasksAdminRequest
    if (content.includes('TaskAdminResponse') && !content.includes('TaskAdminInput')) {
      const insertPoint = content.indexOf('// ── Task Admin Functions ──')
      if (insertPoint >= 0) {
        const typeDefs = `
export type TaskAdminInput = {
  title: string
  rewardType: 'coupon' | 'ticket'
  rewardValue: string
  status: 'active' | 'inactive'
  sortOrder: number
}

export type UpsertTaskAdminRequest = {
  initData: string
  taskId?: string
  task: TaskAdminInput
}

export type TaskAdminResponse = {
  ok: boolean
  taskId: string | null
  detail?: string
  reason:
    | 'saved'
    | 'deleted'
    | 'invalid_method'
    | 'invalid_payload'
    | 'invalid_init_data'
    | 'expired_init_data'
    | 'missing_bot_token'
    | 'forbidden'
    | 'internal_error'
}

export type DeleteTasksAdminRequest = {
  initData: string
  taskIds: string[]
}
`
        content = content.slice(0, insertPoint) + typeDefs + '\n' + content.slice(insertPoint)
        fixCount++
      }
    }

    // Add missing SubscribeToNotifyResponse 'detail' field
    content = content.replace(
      'export type SubscribeToNotifyResponse = {\n  ok: boolean\n  reason:',
      'export type SubscribeToNotifyResponse = {\n  ok: boolean\n  detail?: string\n  reason:'
    )

    // Add missing ReferralInfoResponse 'detail' field
    content = content.replace(
      'export type ReferralInfoResponse = {\n  ok: boolean\n  referralCode: string | null\n  referralCount: number\n  telegramUserId: number | null\n  rewardMilestones: RewardMilestone[]\n  reason:',
      'export type ReferralInfoResponse = {\n  ok: boolean\n  referralCode: string | null\n  referralCount: number\n  telegramUserId: number | null\n  rewardMilestones: RewardMilestone[]\n  detail?: string\n  reason:'
    )
  }

  // Fix 6: Add missing response type fields
  if (fileName === 'orders.ts') {
    // Add missing_bot_token, invalid_init_data, expired_init_data to CreateCheckoutOrderResponse
    content = content.replace(
      "| 'created'\n    | 'invalid_method'\n    | 'invalid_payload'\n    | 'product_unavailable'\n    | 'promo_exhausted'\n    | 'early_access_restricted'\n    | 'internal_error'",
      "| 'created'\n    | 'invalid_method'\n    | 'invalid_payload'\n    | 'product_unavailable'\n    | 'promo_exhausted'\n    | 'early_access_restricted'\n    | 'missing_bot_token'\n    | 'invalid_init_data'\n    | 'expired_init_data'\n    | 'internal_error'"
    )
  }

  if (fileName === 'products.ts') {
    // Fix ReleaseReservationResponse to include 'detail' field
    content = content.replace(
      'export type ReleaseReservationResponse = {\n  ok: boolean\n  reason:',
      'export type ReleaseReservationResponse = {\n  ok: boolean\n  detail?: string\n  reason:'
    )
  }

  if (fileName === 'giveaways.ts') {
    // Fix giveaways.ts to add non-null assertion for giveaway variable
    // Fix the `winners: null` type mismatch
    content = content.replace(
      "winners: null as unknown as GiveawayWinnerResult[] | null",
      "winners: null as unknown as GiveawayWinnerResult[] | null"
    )
  }

  fs.writeFileSync(filePath, content, 'utf8')
  return fixCount
}

// Process all TypeScript files
const files = [
  'helpers.ts',
  'orders.ts',
  'products.ts',
  'promoCodes.ts',
  'giveaways.ts',
  'polls.ts',
  'content.ts',
  'index.ts'
]

let totalFixes = 0
for (const file of files) {
  const filePath = path.join(srcDir, file)
  if (fs.existsSync(filePath)) {
    const fixes = applyFixes(filePath)
    totalFixes += fixes
    console.log(`${file}: ${fixes} fixes applied`)
  } else {
    console.log(`${file}: NOT FOUND`)
  }
}

console.log(`\nTotal: ${totalFixes} fixes applied`)
