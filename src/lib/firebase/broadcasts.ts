import {
  collection,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
  type Timestamp,
} from 'firebase/firestore'

import { getFirestoreDb } from './firestore'
import type { Broadcast } from '../../types/broadcast'
import { withRetry, isTransientError, fetchWithTimeout } from '../retry'

const DEFAULT_SEND_BROADCAST_URL = '/api/admin/sendBroadcast'
const DEFAULT_DELETE_BROADCAST_URL = '/api/admin/deleteBroadcast'

type BroadcastDocument = {
  createdAt?: Timestamp
  createdBy?: number
  sentCount?: number
  failedCount?: number
  reason?: string
  text?: string
}

type SendBroadcastResponse = {
  ok?: boolean
  broadcastId?: string
  sentCount?: number
  failedCount?: number
  reason?: string
  detail?: string
}

type DeleteBroadcastResponse = {
  ok?: boolean
  reason?: string
  detail?: string
}

function toBroadcast(
  doc: QueryDocumentSnapshot<BroadcastDocument>,
): Broadcast {
  const data = doc.data()
  const createdAt =
    data.createdAt && typeof data.createdAt.toDate === 'function'
      ? data.createdAt.toDate().toISOString()
      : null

  return {
    id: doc.id,
    createdAt,
    createdBy:
      typeof data.createdBy === 'number' ? data.createdBy : null,
    sentCount: typeof data.sentCount === 'number' ? data.sentCount : 0,
    failedCount:
      typeof data.failedCount === 'number' ? data.failedCount : 0,
    reason: typeof data.reason === 'string' ? data.reason : '',
    text: typeof data.text === 'string' ? data.text : '',
  }
}

export async function listBroadcasts(
  limitCount = 20,
): Promise<Broadcast[]> {
  const db = getFirestoreDb()
  if (!db) return []

  const broadcastsQuery = query(
    collection(db, 'broadcasts'),
    orderBy('createdAt', 'desc'),
    fsLimit(limitCount),
  )

  const snapshot = await getDocs(
    broadcastsQuery,
  )

  return (snapshot as QuerySnapshot<BroadcastDocument>).docs.map(
    (doc) => toBroadcast(doc as QueryDocumentSnapshot<BroadcastDocument>),
  )
}

export async function sendBroadcast(
  initData: string,
  text: string,
): Promise<{
  broadcastId: string
  sentCount: number
  failedCount: number
}> {
  return withRetry(async () => {
    const response = await fetchWithTimeout(
      import.meta.env.VITE_SEND_BROADCAST_URL || DEFAULT_SEND_BROADCAST_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, text }),
      },
    )

    if (!response.ok) {
      let detail = `http_${response.status}`
      try {
        const result = (await response.json()) as SendBroadcastResponse
        if (typeof result.detail === 'string' && result.detail) {
          detail = result.detail
        } else if (typeof result.reason === 'string') {
          detail = result.reason
        }
      } catch {
        // Keep HTTP fallback.
      }
      throw new Error(`${detail}`)
    }

    const result = (await response.json()) as SendBroadcastResponse

    if (!result.ok || !result.broadcastId) {
      throw new Error(
        `${result.reason || 'unknown_error'}`,
      )
    }

    return {
      broadcastId: result.broadcastId,
      sentCount: result.sentCount ?? 0,
      failedCount: result.failedCount ?? 0,
    }
  }, { maxRetries: 1, shouldRetry: isTransientError })
}

export async function deleteBroadcast(
  initData: string,
  broadcastId: string,
): Promise<void> {
  await withRetry(async () => {
    const response = await fetchWithTimeout(
      import.meta.env.VITE_DELETE_BROADCAST_URL || DEFAULT_DELETE_BROADCAST_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, broadcastId }),
      },
    )

    if (!response.ok) {
      let detail = `http_${response.status}`
      try {
        const result = (await response.json()) as DeleteBroadcastResponse
        if (typeof result.detail === 'string' && result.detail) {
          detail = result.detail
        } else if (typeof result.reason === 'string') {
          detail = result.reason
        }
      } catch {
        // Keep HTTP fallback.
      }
      throw new Error(`${detail}`)
    }

    const result = (await response.json()) as DeleteBroadcastResponse

    if (!result.ok) {
      throw new Error(
        `${result.reason || 'unknown_error'}`,
      )
    }
  }, { maxRetries: 1, shouldRetry: isTransientError })
}