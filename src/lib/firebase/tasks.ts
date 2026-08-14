import {
  collection,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'

import { getFirestoreDb } from './firestore'
import type { Task, TaskInput } from '../../types/rewards'
import { withRetry, isTransientError, fetchWithTimeout } from '../retry'

type TaskDocument = TaskInput & {
  createdAt?: string
  updatedAt?: string
}

const COLLECTION = 'tasks'
const DEFAULT_UPSERT_TASK_URL = '/api/admin/upsertTask'
const DEFAULT_DELETE_TASKS_URL = '/api/admin/deleteTasks'

type UpsertTaskResponse = {
  ok: boolean
  taskId: string | null
  reason?: string
  detail?: string
}

type DeleteTasksResponse = {
  ok: boolean
  taskId: string | null
  reason?: string
  detail?: string
}

function toTask(
  docSnapshot: QueryDocumentSnapshot<TaskDocument>,
): Task {
  const data = docSnapshot.data()

  return {
    id: docSnapshot.id,
    title: data.title ?? '',
    status: data.status === 'inactive' ? 'inactive' : 'active',
    sortOrder: data.sortOrder ?? 0,
    actionUrl: typeof data.actionUrl === 'string' && data.actionUrl.trim().length > 0
      ? data.actionUrl.trim()
      : undefined,
    taskType: (['join_channel', 'invite_friend', 'like_product'].includes(data.taskType ?? '')
      ? data.taskType
      : 'custom') as Task['taskType'],
    requiredCount: typeof data.requiredCount === 'number' && data.requiredCount >= 1
      ? data.requiredCount
      : undefined,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : null,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
  }
}

export async function listTasks(limitCount = 20): Promise<Task[]> {
  const db = getFirestoreDb()
  if (!db) return []

  const q = query(
    collection(db, COLLECTION),
    orderBy('sortOrder', 'asc'),
    fsLimit(limitCount),
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => toTask(doc as QueryDocumentSnapshot<TaskDocument>))
}

export async function createTask(
  initData: string,
  input: TaskInput,
): Promise<string> {
  return withRetry(async () => {
    const response = await fetchWithTimeout(
      import.meta.env.VITE_UPSERT_TASK_URL || DEFAULT_UPSERT_TASK_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, task: input }),
      },
    )

    if (!response.ok) {
      let detail = `http_${response.status}`
      try {
        const result = (await response.json()) as UpsertTaskResponse
        detail = result.detail || result.reason || detail
      } catch { /* fallback */ }
      throw new Error(`${detail}`)
    }

    const result = (await response.json()) as UpsertTaskResponse

    if (!result.ok || !result.taskId) {
      throw new Error(`${result.reason || 'unknown_error'}`)
    }

    return result.taskId
  }, { maxRetries: 1, shouldRetry: isTransientError })
}

export async function updateTask(
  initData: string,
  taskId: string,
  input: Partial<TaskInput>,
): Promise<void> {
  await withRetry(async () => {
    const response = await fetchWithTimeout(
      import.meta.env.VITE_UPSERT_TASK_URL || DEFAULT_UPSERT_TASK_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, taskId, task: input }),
      },
    )

    if (!response.ok) {
      let detail = `http_${response.status}`
      try {
        const result = (await response.json()) as UpsertTaskResponse
        detail = result.detail || result.reason || detail
      } catch { /* fallback */ }
      throw new Error(`${detail}`)
    }

    const result = (await response.json()) as UpsertTaskResponse

    if (!result.ok) {
      throw new Error(`${result.reason || 'unknown_error'}`)
    }
  }, { maxRetries: 1, shouldRetry: isTransientError })
}

export async function deleteTask(
  initData: string,
  taskId: string,
): Promise<void> {
  await withRetry(async () => {
    const response = await fetchWithTimeout(
      import.meta.env.VITE_DELETE_TASKS_URL || DEFAULT_DELETE_TASKS_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, taskIds: [taskId] }),
      },
    )

    if (!response.ok) {
      let detail = `http_${response.status}`
      try {
        const result = (await response.json()) as DeleteTasksResponse
        detail = result.detail || result.reason || detail
      } catch { /* fallback */ }
      throw new Error(`${detail}`)
    }

    const result = (await response.json()) as DeleteTasksResponse

    if (!result.ok) {
      throw new Error(`${result.reason || 'unknown_error'}`)
    }
  }, { maxRetries: 1, shouldRetry: isTransientError })
}
