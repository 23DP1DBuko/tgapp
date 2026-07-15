#!/usr/bin/env node

/**
 * Seed test data for giveaways & polls
 * ======================================
 * Uses Firebase CLI's stored access token to write directly to the
 * Firestore REST API. No Admin SDK needed.
 *
 * Usage: node functions/seed-test-data.mjs
 */

import { readFileSync, existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

const PROJECT_ID = 'yungwearapp-6f98d'
const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

// ── Find Firebase CLI config ──

function findFirebaseToken() {
  const possiblePaths = [
    join(homedir(), '.config', 'configstore', 'firebase-tools.json'),
    join(process.env.APPDATA || '', 'ConfigStore', 'firebase-tools.json'),
    join(process.env.APPDATA || '', 'firebase', 'tools.json'),
    process.env.FIREBASE_TOOLS_JSON || '',
  ]

  for (const p of possiblePaths) {
    if (p && existsSync(p)) {
      const config = JSON.parse(readFileSync(p, 'utf-8'))
      const token = config.tokens?.access_token
      if (token) {
        console.log(`  ✓ Using token from ${p}`)
        return token
      }
    }
  }

  throw new Error(
    'Could not find Firebase CLI access token. Run `firebase login` first.'
  )
}

// ── Firestore REST API helpers ──

function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null }
  if (typeof val === 'string') return { stringValue: val }
  if (typeof val === 'number') return { integerValue: String(Math.round(val)) }
  if (typeof val === 'boolean') return { booleanValue: val }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } }
  }
  if (typeof val === 'object') {
    const fields = {}
    for (const [k, v] of Object.entries(val)) {
      fields[k] = toFirestoreValue(v)
    }
    return { mapValue: { fields } }
  }
  return { stringValue: String(val) }
}

async function createDoc(collection, data, token) {
  const body = {
    fields: toFirestoreValue(data).mapValue.fields,
  }

  const resp = await fetch(`${FIRESTORE_URL}/${collection}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`HTTP ${resp.status} creating ${collection}: ${err}`)
  }

  const result = await resp.json()
  const docId = result.name.split('/').pop()
  console.log(`  ✓ ${collection}/${docId}`)
  return docId
}

function now() {
  return new Date().toISOString()
}

function futureDate(daysFromNow) {
  return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString()
}

// ── Seed Giveaways ──

async function seedGiveaways(token) {
  console.log('\n🎁 Seeding GIVEAWAYS...')

  // 1. Active/live giveaway with entry tasks
  await createDoc('giveaways', {
    title: 'DROP 01 Launch Giveaway',
    description: 'Win the full DROP 01 collection! Complete tasks to boost your tickets.',
    status: 'live',
    endAt: futureDate(14),
    prizes: [
      { productId: '', productName: 'DROP 01 Hoodie', productImage: '', place: 1 },
      { productId: '', productName: 'DROP 01 T-Shirt', productImage: '', place: 2 },
    ],
    winnersCount: 2,
    accessLevel: 'public',
    entryTasks: [
      { id: 'task_join_channel', type: 'join_channel', label: 'Join our Telegram channel', ticketsGranted: 3, verifyMethod: 'manual' },
      { id: 'task_invite', type: 'invite_friend', label: 'Invite 3 friends', ticketsGranted: 5, verifyMethod: 'referral_count' },
    ],
    baseEntryTickets: 1,
    enteredCount: 0,
    totalTicketsPool: 0,
    createdAt: now(),
    updatedAt: now(),
  }, token)

  // 2. Draft giveaway (not yet active)
  await createDoc('giveaways', {
    title: 'Summer Drop Giveaway',
    description: 'Coming soon — stay tuned for the summer collection launch.',
    status: 'draft',
    endAt: futureDate(30),
    prizes: [{ productId: '', productName: 'Summer Hoodie', productImage: '', place: 1 }],
    winnersCount: 1,
    accessLevel: 'public',
    entryTasks: [],
    baseEntryTickets: 1,
    enteredCount: 0,
    totalTicketsPool: 0,
    createdAt: now(),
    updatedAt: now(),
  }, token)

  // 3. Finished giveaway with drawn winners (for Recent Winners section)
  await createDoc('giveaways', {
    title: 'Beta Tester Giveaway',
    description: 'Thanks to all beta testers! Winners have been drawn.',
    status: 'finished',
    endAt: futureDate(-5),
    prizes: [
      { productId: '', productName: 'Exclusive Hoodie', productImage: '', place: 1 },
      { productId: '', productName: 'Exclusive T-Shirt', productImage: '', place: 2 },
      { productId: '', productName: 'Sticker Pack', productImage: '', place: 3 },
    ],
    winnersCount: 3,
    accessLevel: 'public',
    entryTasks: [],
    baseEntryTickets: 1,
    enteredCount: 12,
    totalTicketsPool: 45,
    winners: [
      { place: 1, productId: '', productName: 'Exclusive Hoodie', telegramUserId: 123456789, telegramUsername: 'winner_one', ticketsAtWinTime: 8 },
      { place: 2, productId: '', productName: 'Exclusive T-Shirt', telegramUserId: 234567890, telegramUsername: 'winner_two', ticketsAtWinTime: 5 },
      { place: 3, productId: '', productName: 'Sticker Pack', telegramUserId: 345678901, telegramUsername: 'winner_three', ticketsAtWinTime: 3 },
    ],
    finishedAt: futureDate(-3),
    createdAt: now(),
    updatedAt: now(),
  }, token)
}

// ── Seed Polls ──

async function seedPolls(token) {
  console.log('\n📊 Seeding POLLS...')

  // 1. Active poll with votes
  await createDoc('polls', {
    title: 'What should our next drop focus on?',
    description: 'Help us decide what type of pieces to release next.',
    options: [
      { label: 'Hoodies', imageUrl: '', votes: 3 },
      { label: 'T-Shirts', imageUrl: '', votes: 5 },
      { label: 'Accessories', imageUrl: '', votes: 1 },
      { label: 'Outerwear', imageUrl: '', votes: 2 },
    ],
    totalVotes: 11,
    isActive: true,
    createdAt: now(),
    updatedAt: now(),
  }, token)

  // 2. Active colorway poll
  await createDoc('polls', {
    title: 'Which colorway for the next drop?',
    description: 'Vote for your favorite color palette.',
    options: [
      { label: 'Black / White', imageUrl: '', votes: 7 },
      { label: 'Purple / Magenta', imageUrl: '', votes: 4 },
      { label: 'Earth Tones', imageUrl: '', votes: 2 },
    ],
    totalVotes: 13,
    isActive: true,
    createdAt: now(),
    updatedAt: now(),
  }, token)

  // 3. Inactive/archived poll
  await createDoc('polls', {
    title: 'Preferred payment method?',
    description: 'This poll is now closed.',
    options: [
      { label: 'Cash (Meetup)', imageUrl: '', votes: 6 },
      { label: 'USDT (Crypto)', imageUrl: '', votes: 3 },
      { label: 'Bank Transfer', imageUrl: '', votes: 1 },
    ],
    totalVotes: 10,
    isActive: false,
    createdAt: now(),
    updatedAt: now(),
  }, token)
}

// ── Main ──

async function main() {
  console.log('🌱 Seeding test data for giveaways & polls...\n')

  try {
    const token = findFirebaseToken()
    console.log(`  Project: ${PROJECT_ID}`)

    await seedGiveaways(token)
    await seedPolls(token)

    console.log('\n✅ Done! Open Firebase Console:')
    console.log(`   https://console.firebase.google.com/project/${PROJECT_ID}/firestore/data`)
  } catch (error) {
    console.error('\n❌ Failed:', error.message)
    process.exit(1)
  }
}

main()
