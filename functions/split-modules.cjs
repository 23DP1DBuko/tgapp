const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, 'src', 'index.ts'), 'utf8');
const lines = content.split('\n');

// ============ Line map (from grep output) ============
// Lines 1-46: Imports + constants + firebase init
// Lines 47-688: All types
// Lines 690-4190: Cloud Functions (~50 lines of types scattered)
// Lines 4196-5425: Helper functions 
// ===================================================

// Extract section by line range (1-indexed)
function extract(start, end) {
  return lines.slice(start - 1, end).join('\n');
}

// ============ SECTION 1: helpers.ts ============
// Imports + constants + init + all helper functions
const helpersContent = `// ── Shared imports, constants, and helper functions ──
// Auto-generated from index.ts refactoring

import crypto from 'node:crypto'

import { getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { onRequest } from 'firebase-functions/v2/https'
import { defineInt, defineSecret, defineString } from 'firebase-functions/params'

// ── Constants ──

export const DEFAULT_INIT_DATA_MAX_AGE_SECONDS = 60 * 60
export const telegramBotToken = defineSecret('TELEGRAM_BOT_TOKEN')
export const telegramAdminIds = defineString('TELEGRAM_ADMIN_IDS')
export const telegramInitDataMaxAgeSeconds = defineInt('TELEGRAM_INIT_DATA_MAX_AGE_SECONDS')
export const telegramMiniAppUrl = defineString('TELEGRAM_MINI_APP_URL')
export const telegramWebhookSecret = defineSecret('TELEGRAM_WEBHOOK_SECRET')
export const ORDER_STATUSES = [
  'new',
  'waiting_for_payment',
  'paid',
  'ready_for_meetup',
  'completed',
  'cancelled',
] as const
export const PROMO_DISCOUNT_TYPES = ['percentage', 'fixed_amount'] as const
export const RESERVATION_DURATION_MS = (() => {
  try {
    const envValue = Number(process.env.RESERVATION_DURATION_MS)
    if (Number.isFinite(envValue) && envValue >= 60_000 && envValue <= 3_600_000) {
      return envValue
    }
  } catch {
    // Use default
  }
  return 15 * 60 * 1000 // 15 minutes default
})()
export const PRODUCT_CATEGORIES = [
  'hoodies',
  'tshirts',
  'outerwear',
  'accessories',
  'other',
] as const

if (getApps().length === 0) {
  initializeApp()
}

// ── Type helpers (imported by modules) ──

export type TelegramInitDataUser = {
  id?: number
  [key: string]: unknown
}

export type TelegramWebhookRequest = {
  message?: {
    chat?: {
      id?: number
      type?: string
    }
    from?: {
      id?: number
      username?: string
      first_name?: string
    }
    text?: string
  }
}

// ── Helper functions ──

${extract(4273, 4280)}

${extract(4308, 4543)}

${extract(4566, 5425)}
`;

fs.writeFileSync(path.join(__dirname, 'src', 'helpers.ts'), helpersContent);
console.log('Created helpers.ts');

// ============ Create domain module files ============
// Each one imports from helpers and exports its types + functions

console.log('Done');
console.log('helpers.ts written - now create domain modules');
