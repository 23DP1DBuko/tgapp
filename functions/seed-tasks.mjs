#!/usr/bin/env node

/**
 * Seed reward tasks with real action URLs
 * ==========================================
 * Uses Firebase CLI's stored access token to write directly to the
 * Firestore REST API. No Admin SDK needed.
 *
 * Usage: node functions/seed-tasks.mjs
 * Requires: firebase login (cached credentials)
 */

import { readFileSync, existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

const PROJECT_ID = 'yungwearapp-6f98d'
const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

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

// ── Seed Tasks ──

async function seedTasks(token) {
  console.log('\n📋 Seeding REWARD TASKS...')

  const tasks = [
    {
      title: 'Invite a Friend via Referral Link',
      rewardType: 'coupon',
      rewardValue: '10% OFF COUPON',
      status: 'active',
      sortOrder: 0,
      actionUrl: '',
      actionLabel: 'Share Link',
      createdAt: now(),
      updatedAt: now(),
    },
    {
      title: 'Subscribe to YUNGWEAR Channel',
      rewardType: 'ticket',
      rewardValue: '1 Ticket',
      status: 'active',
      sortOrder: 1,
      actionUrl: 'https://t.me/yungwearstore',
      actionLabel: 'Join & Verify',
      createdAt: now(),
      updatedAt: now(),
    },
    {
      title: 'Follow @yungwear.store on Instagram',
      rewardType: 'ticket',
      rewardValue: '2 Tickets',
      status: 'active',
      sortOrder: 2,
      actionUrl: 'https://www.instagram.com/yungwear.store/',
      actionLabel: 'Follow',
      createdAt: now(),
      updatedAt: now(),
    },
    {
      title: 'Follow @yungwear.store on TikTok',
      rewardType: 'ticket',
      rewardValue: '2 Tickets',
      status: 'active',
      sortOrder: 3,
      actionUrl: 'https://www.tiktok.com/@yungwear.store',
      actionLabel: 'Follow',
      createdAt: now(),
      updatedAt: now(),
    },
    {
      title: 'Like 5 Products in the Store',
      rewardType: 'ticket',
      rewardValue: '1 Ticket',
      status: 'active',
      sortOrder: 4,
      actionUrl: '',
      actionLabel: 'Browse Store',
      createdAt: now(),
      updatedAt: now(),
    },
  ]

  for (const task of tasks) {
    await createDoc('tasks', task, token)
  }
}

// ── Main ──

async function main() {
  console.log('🌱 Seeding reward tasks with links...\n')

  try {
    const token = findFirebaseToken()
    console.log(`  Project: ${PROJECT_ID}`)

    await seedTasks(token)

    console.log('\n✅ Done! Tasks seeded with action URLs to Firestore.')
    console.log(`   View: https://console.firebase.google.com/project/${PROJECT_ID}/firestore/data/tasks`)
  } catch (error) {
    console.error('\n❌ Failed:', error.message)
    process.exit(1)
  }
}

main()
