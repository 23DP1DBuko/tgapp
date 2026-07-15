#!/usr/bin/env node

/**
 * Seed the `campaigns` Firestore collection using the Firebase CLI's
 * cached access token (REST API).
 *
 * Usage: node functions/seed-campaigns.mjs
 * Requires: firebase login (already done)
 */

import { readFileSync, existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

const PROJECT_ID = 'yungwearapp-6f98d'
const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

function findFirebaseToken() {
  const paths = [
    join(homedir(), '.config', 'configstore', 'firebase-tools.json'),
    join(process.env.APPDATA || '', 'firebase', 'tools.json'),
  ]
  for (const p of paths) {
    if (existsSync(p)) {
      const config = JSON.parse(readFileSync(p, 'utf-8'))
      const token = config.tokens?.access_token
      if (token) {
        console.log(`  ✓ Token found in ${p}`)
        return token
      }
    }
  }
  throw new Error('Run `firebase login` first — no cached token found.')
}

function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null }
  if (typeof val === 'string') return { stringValue: val }
  if (typeof val === 'number') return { integerValue: String(Math.round(val)) }
  if (typeof val === 'boolean') return { booleanValue: val }
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
  const body = { fields: toFirestoreValue(data).mapValue.fields }
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
    throw new Error(`HTTP ${resp.status}: ${err}`)
  }
  const result = await resp.json()
  const docId = result.name.split('/').pop()
  console.log(`  ✓ campaigns/${docId}`)
  return docId
}

function now() {
  return new Date().toISOString()
}

async function main() {
  console.log('\n🌱 Seeding campaigns collection...\n')
  try {
    const token = findFirebaseToken()
    console.log(`  Project: ${PROJECT_ID}`)

    const campaigns = [
      { tag: 'Live Now', headingPart1: 'DROP 01', headingPart2: 'AVAILABLE NOW', subtitle: 'Limited pieces • First come, first served', isActive: true, sortOrder: 0, createdAt: now(), updatedAt: now() },
      { tag: 'New Arrivals', headingPart1: 'FRESH', headingPart2: 'NEW ARRIVALS', subtitle: 'Latest pieces added to the collection', isActive: true, sortOrder: 1, createdAt: now(), updatedAt: now() },
      { tag: 'Limited Edition', headingPart1: 'EXCLUSIVE', headingPart2: 'ONE-OF-ONE', subtitle: 'Unique pieces you will not find elsewhere', isActive: true, sortOrder: 2, createdAt: now(), updatedAt: now() },
    ]

    for (const c of campaigns) {
      await createDoc('campaigns', c, token)
    }

    console.log('\n✅ Campaigns collection created!')
    console.log(`   View: https://console.firebase.google.com/project/${PROJECT_ID}/firestore/data/campaigns`)
  } catch (error) {
    console.error('\n❌ Failed:', error.message)
    process.exit(1)
  }
}

main()
