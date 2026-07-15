import {
  collection,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'

import { getFirestoreDb } from './firestore'
import type {
  Giveaway,
  GiveawayInput,
  GiveawayEntry,
} from '../../types/rewards'
import type { EntryTaskType } from '../../types/rewards'
import { withRetry, isTransientError, fetchWithTimeout } from '../retry'

const COLLECTION = 'giveaways'

const DEFAULT_UPSERT_GIVEAWAY_URL = '/api/admin/upsertGiveaway'
const DEFAULT_DELETE_GIVEAWAYS_URL = '/api/admin/deleteGiveaways'
const DEFAULT_JOIN_GIVEAWAY_URL = '/api/giveaways/join'
const DEFAULT_COMPLETE_TASK_URL = '/api/giveaways/completeTask'
const DEFAULT_GET_ENTRIES_URL = '/api/giveaways/entries'
const DEFAULT_GET_MY_ENTRY_URL = '/api/giveaways/myEntry'
const DEFAULT_DRAW_GIVEAWAY_URL = '/api/admin/drawGiveaway'

type GiveawayDocument = {
  title: string
  description: string
  imageUrl: string
  status: string
  startAt: string | null
  endAt: string
  prizes: Array<{
    productId: string
    productName: string
    productImage: string
    place: number
  }>
  winnersCount: number
  accessLevel: string
  entryTasks: Array<{
    id: string
    type: string
    label: string
    ticketsGranted: number
    verifyMethod: string
    metadata?: string | null
  }>
  baseEntryTickets: number
  enteredCount: number
  totalTicketsPool: number
  winners: Array<{
    place: number
    productId: string
    productName: string
    telegramUserId: number
    telegramUsername: string | null
    ticketsAtWinTime: number
  }> | null
  finishedAt: string | null
  createdAt?: string
  updatedAt?: string
  taskIds: string[]
  taskTickets: Record<string, number>
}

type ApiResponse = {
  ok: boolean
  reason?: string
  detail?: string
}

type UpsertResponse = ApiResponse & {
  giveawayId: string | null
}

type JoinResponse = ApiResponse & {
  totalTickets?: number
}

type CompleteTaskResponse = ApiResponse & {
  totalTickets?: number
  taskTicketsGranted?: number
}

type GetEntriesResponse = ApiResponse & {
  entries?: GiveawayEntry[]
  totalParticipants?: number
  myEntry?: GiveawayEntry | null
}

type DrawResponse = ApiResponse & {
  winners?: Array<{
    place: number
    productId: string
    telegramUserId: number
    telegramUsername: string | null
    ticketsAtWinTime: number
  }>
}

async function readErrorReason(response: Response): Promise<string> {
  let reason = `http_${response.status}`
  let detail = ''
  try {
    const result = (await response.json()) as { reason?: string; detail?: string }
    if (typeof result.reason === 'string') reason = result.reason
    if (typeof result.detail === 'string' && result.detail) detail = result.detail
  } catch {
    // Keep HTTP fallback
  }
  return `${reason}${detail ? ` (${detail})` : ''}`
}

function toGiveaway(docSnapshot: QueryDocumentSnapshot<GiveawayDocument>): Giveaway {
  const data = docSnapshot.data()

  return {
    id: docSnapshot.id,
    title: data.title ?? '',
    description: data.description ?? '',
    status: (['draft', 'scheduled', 'live', 'finished', 'announced'].includes(data.status)
      ? data.status
      : 'draft') as Giveaway['status'],
    startAt: typeof data.startAt === 'string' ? data.startAt : null,
    endAt: data.endAt ?? '',
    imageUrl: data.imageUrl ?? '',
    prizes: Array.isArray(data.prizes)
      ? data.prizes.map((p) => ({
          productId: p.productId ?? '',
          productName: p.productName ?? '',
          productImage: p.productImage ?? '',
          place: typeof p.place === 'number' ? p.place : 1,
        }))
      : [],
    winnersCount: typeof data.winnersCount === 'number' ? data.winnersCount : 0,
    accessLevel: data.accessLevel === 'early_access_only' ? 'early_access_only' : 'public',
    entryTasks: Array.isArray(data.entryTasks)
      ? data.entryTasks.map((t) => ({
          id: t.id ?? '',
          type: (['join_channel', 'invite_friend', 'like_product', 'custom'].includes(t.type) ? t.type : 'custom') as EntryTaskType,
          label: t.label ?? '',
          ticketsGranted: typeof t.ticketsGranted === 'number' ? t.ticketsGranted : 1,
          verifyMethod: (['telegram_api', 'referral_count', 'manual'].includes(t.verifyMethod) ? t.verifyMethod : 'manual') as 'telegram_api' | 'referral_count' | 'manual',
          metadata: t.metadata || undefined,
        }))
      : [],
    baseEntryTickets: typeof data.baseEntryTickets === 'number' ? data.baseEntryTickets : 1,
    enteredCount: typeof data.enteredCount === 'number' ? data.enteredCount : 0,
    totalTicketsPool: typeof data.totalTicketsPool === 'number' ? data.totalTicketsPool : 0,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : null,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
    winners: Array.isArray(data.winners)
      ? data.winners.map((w) => ({
          place: w.place ?? 0,
          productId: w.productId ?? '',
          productName: w.productName ?? '',
          telegramUserId: w.telegramUserId ?? 0,
          telegramUsername: w.telegramUsername ?? null,
          ticketsAtWinTime: w.ticketsAtWinTime ?? 0,
        }))
      : null,
    finishedAt: typeof data.finishedAt === 'string' ? data.finishedAt : null,
    taskIds: Array.isArray(data.taskIds) ? data.taskIds : [],
    taskTickets: typeof data.taskTickets === 'object' && data.taskTickets !== null
      ? data.taskTickets as Record<string, number>
      : {},
  }
}

// ── Public read functions ──

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

export async function listActiveGiveaways(limitCount = 10): Promise<Giveaway[]> {
  const db = getFirestoreDb()
  if (!db) return []

  const q = query(
    collection(db, COLLECTION),
    where('status', '==', 'live'),
    orderBy('createdAt', 'desc'),
    fsLimit(limitCount),
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => toGiveaway(doc as QueryDocumentSnapshot<GiveawayDocument>))
}

// ── Admin CRUD ──

export async function createGiveaway(initData: string, input: GiveawayInput): Promise<string> {
  return withRetry(async () => {
    const response = await fetchWithTimeout(
      import.meta.env.VITE_UPSERT_GIVEAWAY_URL || DEFAULT_UPSERT_GIVEAWAY_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, giveaway: input }),
      },
    )

    if (!response.ok) {
      throw new Error(`${await readErrorReason(response)}`)
    }

    const result = (await response.json()) as UpsertResponse

    if (!result.ok || !result.giveawayId) {
      throw new Error(`${result.reason || 'unknown_error'}`)
    }

    return result.giveawayId
  }, { maxRetries: 1, shouldRetry: isTransientError })
}

export async function updateGiveaway(
  initData: string,
  giveawayId: string,
  input: GiveawayInput,
): Promise<void> {
  await withRetry(async () => {
    const response = await fetchWithTimeout(
      import.meta.env.VITE_UPSERT_GIVEAWAY_URL || DEFAULT_UPSERT_GIVEAWAY_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, giveawayId, giveaway: input }),
      },
    )

    if (!response.ok) {
      throw new Error(`${await readErrorReason(response)}`)
    }

    const result = (await response.json()) as UpsertResponse

    if (!result.ok) {
      throw new Error(`${result.reason || 'unknown_error'}`)
    }
  }, { maxRetries: 1, shouldRetry: isTransientError })
}

export async function deleteGiveaway(initData: string, giveawayId: string): Promise<void> {
  await withRetry(async () => {
    const response = await fetchWithTimeout(
      import.meta.env.VITE_DELETE_GIVEAWAYS_URL || DEFAULT_DELETE_GIVEAWAYS_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, giveawayIds: [giveawayId] }),
      },
    )

    if (!response.ok) {
      throw new Error(`${await readErrorReason(response)}`)
    }

    const result = (await response.json()) as UpsertResponse

    if (!result.ok) {
      throw new Error(`${result.reason || 'unknown_error'}`)
    }
  }, { maxRetries: 1, shouldRetry: isTransientError })
}

// ── Player actions ──

export async function joinGiveaway(
  initData: string,
  giveawayId: string,
): Promise<{ joined: boolean; totalTickets: number; reason: string }> {
  return withRetry(async () => {
    const response = await fetchWithTimeout(
      import.meta.env.VITE_JOIN_GIVEAWAY_URL || DEFAULT_JOIN_GIVEAWAY_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, giveawayId }),
      },
    )

    if (!response.ok) {
      const result = (await response.json().catch(() => ({}))) as Partial<JoinResponse>
      return { joined: false, totalTickets: 0, reason: result.reason ?? `http_${response.status}` }
    }

    const result = (await response.json()) as JoinResponse

    return {
      joined: result.ok === true,
      totalTickets: result.totalTickets ?? 0,
      reason: result.reason ?? 'joined',
    }
  }, { maxRetries: 1, shouldRetry: isTransientError })
}

export async function completeGiveawayTask(
  initData: string,
  giveawayId: string,
  taskId: string,
): Promise<{ completed: boolean; totalTickets: number; taskTicketsGranted: number; reason: string }> {
  return withRetry(async () => {
    const response = await fetchWithTimeout(
      import.meta.env.VITE_COMPLETE_TASK_URL || DEFAULT_COMPLETE_TASK_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, giveawayId, taskId }),
      },
    )

    if (!response.ok) {
      const result = (await response.json().catch(() => ({}))) as Partial<CompleteTaskResponse>
      return {
        completed: false,
        totalTickets: 0,
        taskTicketsGranted: 0,
        reason: result.reason ?? `http_${response.status}`,
      }
    }

    const result = (await response.json()) as CompleteTaskResponse

    return {
      completed: result.ok === true,
      totalTickets: result.totalTickets ?? 0,
      taskTicketsGranted: result.taskTicketsGranted ?? 0,
      reason: result.reason ?? 'completed',
    }
  }, { maxRetries: 1, shouldRetry: isTransientError })
}

export async function getGiveawayEntries(
  initData: string,
  giveawayId: string,
): Promise<{ entries: GiveawayEntry[]; myEntry: GiveawayEntry | null; totalParticipants: number }> {
  return withRetry(async () => {
    const response = await fetchWithTimeout(
      import.meta.env.VITE_GET_ENTRIES_URL || DEFAULT_GET_ENTRIES_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, giveawayId }),
      },
    )

    if (!response.ok) {
      return { entries: [], myEntry: null, totalParticipants: 0 }
    }

    const result = (await response.json()) as GetEntriesResponse

    return {
      entries: Array.isArray(result.entries) ? result.entries : [],
      myEntry: result.myEntry ?? null,
      totalParticipants: result.totalParticipants ?? 0,
    }
  }, { maxRetries: 1, shouldRetry: isTransientError })
}

export async function getMyGiveawayEntry(
  initData: string,
  giveawayId: string,
): Promise<{ entry: GiveawayEntry | null }> {
  return withRetry(async () => {
    const response = await fetchWithTimeout(
      import.meta.env.VITE_GET_MY_ENTRY_URL || DEFAULT_GET_MY_ENTRY_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, giveawayId }),
      },
    )

    if (!response.ok) {
      return { entry: null }
    }

    const result = (await response.json()) as {
      ok: boolean
      entry: GiveawayEntry | null
    }

    return { entry: result.entry ?? null }
  }, { maxRetries: 1, shouldRetry: isTransientError })
}

export async function drawGiveaway(
  initData: string,
  giveawayId: string,
): Promise<{ ok: boolean; winners: Giveaway['winners']; reason: string }> {
  return withRetry(async () => {
    const response = await fetchWithTimeout(
      import.meta.env.VITE_DRAW_GIVEAWAY_URL || DEFAULT_DRAW_GIVEAWAY_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, giveawayId }),
      },
    )

    if (!response.ok) {
      const result = (await response.json().catch(() => ({}))) as Partial<DrawResponse>
      return { ok: false, winners: [], reason: result.reason ?? `http_${response.status}` }
    }

    const result = (await response.json()) as DrawResponse

    if (!result.winners) {
      return { ok: false, winners: [], reason: result.reason ?? 'no_winners' }
    }

    return {
      ok: true,
      winners: result.winners.map((w) => ({
        place: w.place ?? 0,
        productId: w.productId ?? '',
        productName: '',
        telegramUserId: w.telegramUserId ?? 0,
        telegramUsername: w.telegramUsername ?? null,
        ticketsAtWinTime: w.ticketsAtWinTime ?? 0,
      })),
      reason: result.reason ?? 'drawn',
    }
  }, { maxRetries: 1, shouldRetry: isTransientError })
}
