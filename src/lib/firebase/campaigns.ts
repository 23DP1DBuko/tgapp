import {
  collection,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'

import { getFirestoreDb } from './firestore'
import type { Campaign, CampaignInput } from '../../types/campaign'

type CampaignDocument = Omit<CampaignInput, 'sortOrder'> & {
  sortOrder: number
  createdAt?: string
  updatedAt?: string
}

function toCampaign(
  docSnapshot: QueryDocumentSnapshot<CampaignDocument>,
): Campaign {
  const data = docSnapshot.data()

  return {
    id: docSnapshot.id,
    tag: data.tag ?? '',
    headingPart1: data.headingPart1 ?? '',
    headingPart2: data.headingPart2 ?? '',
    subtitle: data.subtitle ?? '',
    isActive: data.isActive ?? true,
    sortOrder: data.sortOrder ?? 0,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : null,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
  }
}

const CAMPAIGNS_COLLECTION = 'campaigns'
const DEFAULT_UPSERT_CAMPAIGN_URL = '/api/admin/upsertCampaign'
const DEFAULT_DELETE_CAMPAIGNS_URL = '/api/admin/deleteCampaigns'
const DEFAULT_REORDER_CAMPAIGNS_URL = '/api/admin/reorderCampaigns'

type UpsertCampaignResponse = {
  ok: boolean
  campaignId: string | null
  reason?: string
  detail?: string
}

type DeleteCampaignsResponse = {
  ok: boolean
  campaignId: string | null
  reason?: string
  detail?: string
}

type ReorderCampaignsResponse = {
  ok: boolean
  campaignId: string | null
  reason?: string
  detail?: string
}

export async function listCampaigns(
  limitCount = 20,
): Promise<Campaign[]> {
  const db = getFirestoreDb()
  if (!db) return []

  const campaignsQuery = query(
    collection(db, CAMPAIGNS_COLLECTION),
    orderBy('sortOrder', 'asc'),
    fsLimit(limitCount),
  )

  const snapshot = await getDocs(campaignsQuery)

  return snapshot.docs.map((doc) =>
    toCampaign(doc as QueryDocumentSnapshot<CampaignDocument>),
  )
}

export async function createCampaign(
  initData: string,
  input: CampaignInput,
): Promise<string> {
  const response = await fetch(
    import.meta.env.VITE_UPSERT_CAMPAIGN_URL || DEFAULT_UPSERT_CAMPAIGN_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, campaign: input }),
    },
  )

  if (!response.ok) {
    let detail = `http_${response.status}`
    try {
      const result = (await response.json()) as UpsertCampaignResponse
      detail = result.detail || result.reason || detail
    } catch { /* fallback */ }
    throw new Error(`Failed to create campaign: ${detail}.`)
  }

  const result = (await response.json()) as UpsertCampaignResponse

  if (!result.ok || !result.campaignId) {
    throw new Error(`Failed to create campaign: ${result.reason || 'unknown error'}.`)
  }

  return result.campaignId
}

export async function updateCampaign(
  initData: string,
  campaignId: string,
  input: Partial<CampaignInput>,
): Promise<void> {
  const response = await fetch(
    import.meta.env.VITE_UPSERT_CAMPAIGN_URL || DEFAULT_UPSERT_CAMPAIGN_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, campaignId, campaign: input }),
    },
  )

  if (!response.ok) {
    let detail = `http_${response.status}`
    try {
      const result = (await response.json()) as UpsertCampaignResponse
      detail = result.detail || result.reason || detail
    } catch { /* fallback */ }
    throw new Error(`Failed to update campaign: ${detail}.`)
  }

  const result = (await response.json()) as UpsertCampaignResponse

  if (!result.ok) {
    throw new Error(`Failed to update campaign: ${result.reason || 'unknown error'}.`)
  }
}

export async function deleteCampaign(
  initData: string,
  campaignId: string,
): Promise<void> {
  const response = await fetch(
    import.meta.env.VITE_DELETE_CAMPAIGNS_URL || DEFAULT_DELETE_CAMPAIGNS_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, campaignIds: [campaignId] }),
    },
  )

  if (!response.ok) {
    let detail = `http_${response.status}`
    try {
      const result = (await response.json()) as DeleteCampaignsResponse
      detail = result.detail || result.reason || detail
    } catch { /* fallback */ }
    throw new Error(`Failed to delete campaign: ${detail}.`)
  }

  const result = (await response.json()) as DeleteCampaignsResponse

  if (!result.ok) {
    throw new Error(`Failed to delete campaign: ${result.reason || 'unknown error'}.`)
  }
}

export async function reorderCampaigns(
  initData: string,
  orderedIds: string[],
): Promise<void> {
  const response = await fetch(
    import.meta.env.VITE_REORDER_CAMPAIGNS_URL || DEFAULT_REORDER_CAMPAIGNS_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, orderedIds }),
    },
  )

  if (!response.ok) {
    let detail = `http_${response.status}`
    try {
      const result = (await response.json()) as ReorderCampaignsResponse
      detail = result.detail || result.reason || detail
    } catch { /* fallback */ }
    throw new Error(`Failed to reorder campaigns: ${detail}.`)
  }

  const result = (await response.json()) as ReorderCampaignsResponse

  if (!result.ok) {
    throw new Error(`Failed to reorder campaigns: ${result.reason || 'unknown error'}.`)
  }
}
