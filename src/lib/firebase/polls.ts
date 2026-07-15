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
import type { Poll, PollInput } from '../../types/poll'
import { withRetry, isTransientError, fetchWithTimeout } from '../retry'

const COLLECTION = 'polls'

const DEFAULT_ADMIN_UPSERT_POLL_URL = '/api/admin/upsertPoll'
const DEFAULT_ADMIN_DELETE_POLLS_URL = '/api/admin/deletePolls'
const DEFAULT_CAST_POLL_VOTE_URL = '/api/polls/castVote'
const DEFAULT_GET_POLL_RESULTS_URL = '/api/admin/getPollResults'

type PollDocument = PollInput & {
  totalVotes: number
  options: PollDocumentOption[]
  createdAt?: string
  updatedAt?: string
}

type PollDocumentOption = {
  label: string
  imageUrl: string
  votes: number
}

type UpsertPollResponse = {
  ok: boolean
  pollId: string | null
  reason?: string
  detail?: string
}

type DeletePollsResponse = {
  ok: boolean
  reason?: string
  detail?: string
}

type CastVoteResponse = {
  ok: boolean
  reason?: string
  detail?: string
}

type PollResultsItem = {
  label: string
  votes: number
  percentage: number
}

type GetPollResultsResponse = {
  ok: boolean
  pollId: string | null
  title: string
  totalVotes: number
  results: PollResultsItem[]
  reason?: string
  detail?: string
}

function toPoll(docSnapshot: QueryDocumentSnapshot<PollDocument>): Poll {
  const data = docSnapshot.data()

  return {
    id: docSnapshot.id,
    title: data.title ?? '',
    description: data.description ?? '',
    options: Array.isArray(data.options)
      ? data.options.map((opt: PollDocumentOption) => ({
          label: opt.label ?? '',
          imageUrl: opt.imageUrl ?? '',
          votes: typeof opt.votes === 'number' ? opt.votes : 0,
        }))
      : [],
    isActive: data.isActive ?? false,
    totalVotes: typeof data.totalVotes === 'number' ? data.totalVotes : 0,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : null,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
  }
}

async function readErrorReason(response: Response): Promise<string> {
  let reason = `http_${response.status}`
  let detail = ''
  try {
    const result = (await response.json()) as { reason?: string; detail?: string }
    if (typeof result.reason === 'string') reason = result.reason
    if (typeof result.detail === 'string' && result.detail) detail = result.detail
  } catch {
    // Keep fallback
  }
  return `${reason}${detail ? ` (${detail})` : ''}`
}

export async function listPolls(limitCount = 20): Promise<Poll[]> {
  const db = getFirestoreDb()
  if (!db) return []

  const q = query(
    collection(db, COLLECTION),
    orderBy('createdAt', 'desc'),
    fsLimit(limitCount),
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => toPoll(doc as QueryDocumentSnapshot<PollDocument>))
}

export async function listActivePolls(limitCount = 10): Promise<Poll[]> {
  const db = getFirestoreDb()
  if (!db) return []

  const q = query(
    collection(db, COLLECTION),
    where('isActive', '==', true),
    orderBy('createdAt', 'desc'),
    fsLimit(limitCount),
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => toPoll(doc as QueryDocumentSnapshot<PollDocument>))
}

export async function createPoll(initData: string, input: PollInput): Promise<string> {
  return withRetry(async () => {
    const response = await fetchWithTimeout(
      import.meta.env.VITE_ADMIN_UPSERT_POLL_URL || DEFAULT_ADMIN_UPSERT_POLL_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, poll: input }),
      },
    )

    if (!response.ok) {
      throw new Error(`${await readErrorReason(response)}`)
    }

    const result = (await response.json()) as UpsertPollResponse

    if (!result.ok || !result.pollId) {
      throw new Error(`${result.reason || 'unknown_error'}`)
    }

    return result.pollId
  }, { maxRetries: 1, shouldRetry: isTransientError })
}

export async function updatePoll(
  initData: string,
  pollId: string,
  input: PollInput,
): Promise<void> {
  await withRetry(async () => {
    const response = await fetchWithTimeout(
      import.meta.env.VITE_ADMIN_UPSERT_POLL_URL || DEFAULT_ADMIN_UPSERT_POLL_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, pollId, poll: input }),
      },
    )

    if (!response.ok) {
      throw new Error(`${await readErrorReason(response)}`)
    }

    const result = (await response.json()) as UpsertPollResponse

    if (!result.ok) {
      throw new Error(`${result.reason || 'unknown_error'}`)
    }
  }, { maxRetries: 1, shouldRetry: isTransientError })
}

export async function deletePoll(initData: string, pollId: string): Promise<void> {
  await withRetry(async () => {
    const response = await fetchWithTimeout(
      import.meta.env.VITE_ADMIN_DELETE_POLLS_URL || DEFAULT_ADMIN_DELETE_POLLS_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, pollIds: [pollId] }),
      },
    )

    if (!response.ok) {
      throw new Error(`${await readErrorReason(response)}`)
    }

    const result = (await response.json()) as DeletePollsResponse

    if (!result.ok) {
      throw new Error(`${result.reason || 'unknown_error'}`)
    }
  }, { maxRetries: 1, shouldRetry: isTransientError })
}

export async function castVote(
  initData: string,
  pollId: string,
  optionIndex: number,
): Promise<void> {
  const response = await fetch(
    import.meta.env.VITE_CAST_POLL_VOTE_URL || DEFAULT_CAST_POLL_VOTE_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, pollId, optionIndex }),
    },
  )

  if (!response.ok) {
    throw new Error(`Failed to cast vote: ${await readErrorReason(response)}.`)
  }

  const result = (await response.json()) as CastVoteResponse

  if (!result.ok) {
    throw new Error(`Failed to cast vote: ${result.reason || 'unknown error'}.`)
  }
}

export type PollResults = {
  pollId: string
  title: string
  totalVotes: number
  results: PollResultsItem[]
}

export async function getPollResults(
  initData: string,
  pollId: string,
): Promise<PollResults> {
  const response = await fetch(
    import.meta.env.VITE_GET_POLL_RESULTS_URL || DEFAULT_GET_POLL_RESULTS_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, pollId }),
    },
  )

  if (!response.ok) {
    throw new Error(`Failed to get poll results: ${await readErrorReason(response)}.`)
  }

  const result = (await response.json()) as GetPollResultsResponse

  if (!result.ok || !result.pollId) {
    throw new Error(`Failed to get poll results: ${result.reason || 'unknown error'}.`)
  }

  return {
    pollId: result.pollId,
    title: result.title ?? '',
    totalVotes: result.totalVotes ?? 0,
    results: Array.isArray(result.results) ? result.results : [],
  }
}
