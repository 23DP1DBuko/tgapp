import {
  collection,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'

import { getFirestoreDb } from './firestore'
import type { Giveaway, GiveawayInput } from '../../types/rewards'

type GiveawayDocument = GiveawayInput & {
  createdAt?: string
  updatedAt?: string
}

const COLLECTION = 'giveaways'
const DEFAULT_UPSERT_GIVEAWAY_URL = '/api/admin/upsertGiveaway'
const DEFAULT_DELETE_GIVEAWAYS_URL = '/api/admin/deleteGiveaways'

type UpsertGiveawayResponse = {
  ok: boolean
  giveawayId: string | null
  reason?: string
  detail?: string
}

type DeleteGiveawaysResponse = {
  ok: boolean
  giveawayId: string | null
  reason?: string
  detail?: string
}

function toGiveaway(
  docSnapshot: QueryDocumentSnapshot<GiveawayDocument>,
): Giveaway {
  const data = docSnapshot.data()

  return {
    id: docSnapshot.id,
    productId: data.productId ?? '',
    productName: data.productName ?? '',
    productImage: data.productImage ?? '',
    totalTickets: typeof data.totalTickets === 'number' ? data.totalTickets : 0,
    enteredCount: typeof data.enteredCount === 'number' ? data.enteredCount : 0,
    endsAt: typeof data.endsAt === 'string' ? data.endsAt : null,
    isActive: data.isActive ?? false,
    winnerUsername: typeof data.winnerUsername === 'string' ? data.winnerUsername : null,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : null,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
  }
}

export async function listGiveaways(limitCount = 20): Promise<Giveaway[]> {
  const db = getFirestoreDb()
  if (!db) return []

  const q = query(
    collection(db, COLLECTION),
    orderBy('createdAt', 'desc'),
    fsLimit(limitCount),
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => toGiveaway(doc as QueryDocumentSnapshot<GiveawayDocument>))
}

export async function createGiveaway(
  initData: string,
  input: GiveawayInput,
): Promise<string> {
  const response = await fetch(
    import.meta.env.VITE_UPSERT_GIVEAWAY_URL || DEFAULT_UPSERT_GIVEAWAY_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, giveaway: input }),
    },
  )

  if (!response.ok) {
    let detail = `http_${response.status}`
    try {
      const result = (await response.json()) as UpsertGiveawayResponse
      detail = result.detail || result.reason || detail
    } catch { /* fallback */ }
    throw new Error(`Failed to create giveaway: ${detail}.`)
  }

  const result = (await response.json()) as UpsertGiveawayResponse

  if (!result.ok || !result.giveawayId) {
    throw new Error(`Failed to create giveaway: ${result.reason || 'unknown error'}.`)
  }

  return result.giveawayId
}

export async function updateGiveaway(
  initData: string,
  giveawayId: string,
  input: Partial<GiveawayInput>,
): Promise<void> {
  const response = await fetch(
    import.meta.env.VITE_UPSERT_GIVEAWAY_URL || DEFAULT_UPSERT_GIVEAWAY_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, giveawayId, giveaway: input }),
    },
  )

  if (!response.ok) {
    let detail = `http_${response.status}`
    try {
      const result = (await response.json()) as UpsertGiveawayResponse
      detail = result.detail || result.reason || detail
    } catch { /* fallback */ }
    throw new Error(`Failed to update giveaway: ${detail}.`)
  }

  const result = (await response.json()) as UpsertGiveawayResponse

  if (!result.ok) {
    throw new Error(`Failed to update giveaway: ${result.reason || 'unknown error'}.`)
  }
}

export async function deleteGiveaway(
  initData: string,
  giveawayId: string,
): Promise<void> {
  const response = await fetch(
    import.meta.env.VITE_DELETE_GIVEAWAYS_URL || DEFAULT_DELETE_GIVEAWAYS_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, giveawayIds: [giveawayId] }),
    },
  )

  if (!response.ok) {
    let detail = `http_${response.status}`
    try {
      const result = (await response.json()) as DeleteGiveawaysResponse
      detail = result.detail || result.reason || detail
    } catch { /* fallback */ }
    throw new Error(`Failed to delete giveaway: ${detail}.`)
  }

  const result = (await response.json()) as DeleteGiveawaysResponse

  if (!result.ok) {
    throw new Error(`Failed to delete giveaway: ${result.reason || 'unknown error'}.`)
  }
}
