// ── Giveaways Module ──
import { onRequest } from 'firebase-functions/v2/https'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import {
  telegramBotToken,
  readAdminIdsFromEnv,
  verifyTelegramInitData,
  isValidGiveawayInput,
  generateShortId,
} from './helpers.js'

export type GiveawayPrizeInput = {
  productId: string
  place: number
}

export type GiveawayEntryTaskInput = {
  id?: string
  type: 'join_channel' | 'invite_friend' | 'like_product' | 'custom'
  label: string
  ticketsGranted: number
  verifyMethod: 'telegram_api' | 'referral_count' | 'manual'
  metadata?: string
}

export type GiveawayAdminInput = {
  title: string
  description: string
  imageUrl: string
  status: 'draft' | 'scheduled' | 'live' | 'finished' | 'announced'
  startAt: string | null
  endAt: string
  prizes: GiveawayPrizeInput[]
  accessLevel: 'public' | 'early_access_only'
  entryTasks: GiveawayEntryTaskInput[]
  baseEntryTickets: number
  taskIds?: string[]
  taskTickets?: Record<string, number>
}

export type UpsertGiveawayAdminRequest = {
  initData: string
  giveawayId?: string
  giveaway: GiveawayAdminInput
}

export type GiveawayAdminResponse = {
  ok: boolean
  giveawayId: string | null
  detail?: string
  reason:
    | 'saved'
    | 'deleted'
    | 'invalid_method'
    | 'invalid_payload'
    | 'invalid_init_data'
    | 'expired_init_data'
    | 'missing_bot_token'
    | 'forbidden'
    | 'internal_error'
}

export type DeleteGiveawaysAdminRequest = {
  initData: string
  giveawayIds: string[]
}

// ── Giveaway Player Types ──

export type JoinGiveawayRequest = {
  initData: string
  giveawayId: string
}

export type JoinGiveawayResponse = {
  ok: boolean
  totalTickets: number
  detail?: string
  reason:
    | 'joined'
    | 'already_joined'
    | 'giveaway_not_live'
    | 'access_restricted'
    | 'invalid_method'
    | 'invalid_payload'
    | 'invalid_init_data'
    | 'expired_init_data'
    | 'missing_bot_token'
    | 'internal_error'
}

export type CompleteGiveawayTaskRequest = {
  initData: string
  giveawayId: string
  taskId: string
}

export type CompleteGiveawayTaskResponse = {
  ok: boolean
  totalTickets: number
  taskTicketsGranted: number
  detail?: string
  reason:
    | 'completed'
    | 'already_completed'
    | 'not_joined'
    | 'task_not_found'
    | 'giveaway_not_live'
    | 'verification_failed'
    | 'invalid_method'
    | 'invalid_payload'
    | 'invalid_init_data'
    | 'expired_init_data'
    | 'missing_bot_token'
    | 'internal_error'
}

export type GetGiveawayEntriesRequest = {
  initData: string
  giveawayId: string
}

export type GiveawayEntryData = {
  telegramUserId: number
  telegramUsername: string | null
  joinedAt: string
  completedTaskIds: string[]
  totalTickets: number
}

export type GetGiveawayEntriesResponse = {
  ok: boolean
  entries: GiveawayEntryData[]
  totalParticipants: number
  myEntry: GiveawayEntryData | null
  detail?: string
  reason:
    | 'listed'
    | 'invalid_method'
    | 'invalid_payload'
    | 'invalid_init_data'
    | 'expired_init_data'
    | 'missing_bot_token'
    | 'internal_error'
}

export type GetMyGiveawayEntryRequest = {
  initData: string
  giveawayId: string
}

export type GetMyGiveawayEntryResponse = {
  ok: boolean
  entry: GiveawayEntryData | null
  detail?: string
  reason:
    | 'found'
    | 'not_found'
    | 'invalid_method'
    | 'invalid_payload'
    | 'invalid_init_data'
    | 'expired_init_data'
    | 'missing_bot_token'
    | 'internal_error'
}

export type DrawGiveawayAdminRequest = {
  initData: string
  giveawayId: string
}

export type GiveawayWinnerResult = {
  place: number
  productId: string
  telegramUserId: number
  telegramUsername: string | null
  ticketsAtWinTime: number
}

export type DrawGiveawayAdminResponse = {
  ok: boolean
  winners: GiveawayWinnerResult[]
  detail?: string
  reason:
    | 'drawn'
    | 'not_enough_participants'
    | 'giveaway_not_live'
    | 'already_finished'
    | 'invalid_method'
    | 'invalid_payload'
    | 'invalid_init_data'
    | 'expired_init_data'
    | 'missing_bot_token'
    | 'forbidden'
    | 'internal_error'
}

export const upsertGiveawayAdmin = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({
        ok: false,
        giveawayId: null,
        reason: 'invalid_method',
      } satisfies GiveawayAdminResponse)
      return
    }

    const botToken = telegramBotToken.value()

    if (!botToken) {
      response.status(500).json({
        ok: false,
        giveawayId: null,
        reason: 'missing_bot_token',
      } satisfies GiveawayAdminResponse)
      return
    }

    const body = request.body as Partial<UpsertGiveawayAdminRequest> | undefined
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const giveawayId = typeof body?.giveawayId === 'string' ? body.giveawayId.trim() : ''
    const giveaway = body?.giveaway

    if (!isValidGiveawayInput(giveaway)) {
      response.status(400).json({
        ok: false,
        giveawayId: giveawayId || null,
        reason: 'invalid_payload',
      } satisfies GiveawayAdminResponse)
      return
    }

    const verificationResult = verifyTelegramInitData(initData, botToken)

    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
      response.status(401).json({
        ok: false,
        giveawayId: giveawayId || null,
        reason:
          verificationResult.reason === 'expired_init_data'
            ? 'expired_init_data'
            : 'invalid_init_data',
      } satisfies GiveawayAdminResponse)
      return
    }

    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
      response.status(403).json({
        ok: false,
        giveawayId: giveawayId || null,
        reason: 'forbidden',
      } satisfies GiveawayAdminResponse)
      return
    }

    try {
      const now = new Date().toISOString()
      const db = getFirestore()

      // Fetch full product details from Firestore for each prize
      const prizesWithDetails = await Promise.all(
        giveaway.prizes.map(async (p) => {
          const productDoc = await db.collection('products').doc(p.productId.trim()).get()
          const productData = productDoc.exists
            ? (productDoc.data() as { name?: string; images?: string[] } | undefined)
            : null
          return {
            productId: p.productId.trim(),
            place: p.place,
            productName: productData?.name ?? '',
            productImage: (productData?.images && productData.images[0]) ?? '',
          }
        }),
      )

      // Resolve task IDs to full entry task definitions
      const taskIds = giveaway.taskIds ?? []
      const taskTickets = giveaway.taskTickets ?? {}
      const resolvedTasks: Array<{
        id: string
        type: 'join_channel' | 'invite_friend' | 'like_product' | 'custom'
        label: string
        ticketsGranted: number
        verifyMethod: 'telegram_api' | 'referral_count' | 'manual'
        metadata?: string | null
      }> = []

      if (taskIds.length > 0) {
        for (const taskId of taskIds) {
          const taskDoc = await db.collection('tasks').doc(taskId).get()
          if (taskDoc.exists) {
            const taskData = taskDoc.data() as {
              title?: string
              rewardType?: string
              actionUrl?: string
            }
            resolvedTasks.push({
              id: taskId,
              type: 'custom',
              label: taskData.title?.trim() ?? 'Task',
              ticketsGranted: taskTickets[taskId] ?? 5,
              verifyMethod: 'manual',
              metadata: taskData.actionUrl?.trim() || null,
            })
          }
        }
      }

      // Keep any legacy entry tasks that aren't in the resolved task IDs
      const legacyTasks = (giveaway.entryTasks ?? []).filter(
        (t) => t.id && !taskIds.includes(t.id),
      )
      const entryTasksWithIds = [...resolvedTasks, ...legacyTasks].map((t) => ({
        id: t.id || generateShortId(),
        type: t.type,
        label: t.label,
        ticketsGranted: t.ticketsGranted,
        verifyMethod: t.verifyMethod,
        metadata: t.metadata || null,
      }))

      const payload: Record<string, unknown> = {
        title: giveaway.title.trim(),
        description: giveaway.description.trim(),
        imageUrl: giveaway.imageUrl?.trim() || '',
        status: giveaway.status,
        startAt: giveaway.startAt || null,
        endAt: giveaway.endAt,
        prizes: prizesWithDetails,
        winnersCount: giveaway.prizes.length,
        accessLevel: giveaway.accessLevel,
        entryTasks: entryTasksWithIds,
        taskIds: taskIds,
        taskTickets: taskTickets,
        baseEntryTickets: giveaway.baseEntryTickets,
        enteredCount: 0,
        totalTicketsPool: 0,
        winners: null,
        finishedAt: null,
        updatedAt: now,
      }

      if (giveawayId) {
        // Preserve existing enteredCount, winners, etc. on update
        const existingSnapshot = await getFirestore().collection('giveaways').doc(giveawayId).get()
        if (existingSnapshot.exists) {
          const existingData = existingSnapshot.data() as
            | { enteredCount?: number; totalTicketsPool?: number; winners?: unknown; finishedAt?: string | null }
            | undefined
          payload.enteredCount = existingData?.enteredCount ?? 0
          payload.totalTicketsPool = existingData?.totalTicketsPool ?? 0
          payload.winners = (existingData?.winners as unknown as GiveawayWinnerResult[] | null | undefined) ?? null
          payload.finishedAt = existingData?.finishedAt ?? null
        }

        await getFirestore().collection('giveaways').doc(giveawayId).set(payload, { merge: true })

        response.status(200).json({
          ok: true,
          giveawayId,
          reason: 'saved',
        } satisfies GiveawayAdminResponse)
        return
      }

      const createdGiveaway = await getFirestore().collection('giveaways').add({
        ...payload,
        createdAt: now,
      })

      response.status(200).json({
        ok: true,
        giveawayId: createdGiveaway.id,
        reason: 'saved',
      } satisfies GiveawayAdminResponse)
    } catch (error) {
      response.status(500).json({
        ok: false,
        giveawayId: giveawayId || null,
        reason: 'internal_error',
        detail: error instanceof Error ? error.message : 'Unknown backend error.',
      } satisfies GiveawayAdminResponse)
    }
  },
)

export const deleteGiveawaysAdmin = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({
        ok: false,
        giveawayId: null,
        reason: 'invalid_method',
      } satisfies GiveawayAdminResponse)
      return
    }

    const botToken = telegramBotToken.value()

    if (!botToken) {
      response.status(500).json({
        ok: false,
        giveawayId: null,
        reason: 'missing_bot_token',
      } satisfies GiveawayAdminResponse)
      return
    }

    const body = request.body as Partial<DeleteGiveawaysAdminRequest> | undefined
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const giveawayIds =
      body?.giveawayIds?.filter((id): id is string => typeof id === 'string' && id.trim().length > 0) ?? []

    if (giveawayIds.length === 0) {
      response.status(400).json({
        ok: false,
        giveawayId: null,
        reason: 'invalid_payload',
      } satisfies GiveawayAdminResponse)
      return
    }

    const verificationResult = verifyTelegramInitData(initData, botToken)

    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
      response.status(401).json({
        ok: false,
        giveawayId: null,
        reason:
          verificationResult.reason === 'expired_init_data'
            ? 'expired_init_data'
            : 'invalid_init_data',
      } satisfies GiveawayAdminResponse)
      return
    }

    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
      response.status(403).json({
        ok: false,
        giveawayId: null,
        reason: 'forbidden',
      } satisfies GiveawayAdminResponse)
      return
    }

    try {
      const batch = getFirestore().batch()
      giveawayIds.forEach((id) => {
        batch.delete(getFirestore().collection('giveaways').doc(id))
        // Also delete entries subcollection documents
        // Note: subcollection deletion requires separate iteration
      })
      await batch.commit()

      // Clean up entries subcollections for deleted giveaways
      const entryCleanups = giveawayIds.map(async (giveawayId) => {
        const entriesSnapshot = await getFirestore()
          .collection('giveaways')
          .doc(giveawayId)
          .collection('entries')
          .get()
        if (entriesSnapshot.size > 0) {
          const entryBatch = getFirestore().batch()
          entriesSnapshot.docs.forEach((doc) => entryBatch.delete(doc.ref))
          await entryBatch.commit()
        }
      })
      await Promise.all(entryCleanups)

      response.status(200).json({
        ok: true,
        giveawayId: giveawayIds[0] ?? null,
        reason: 'deleted',
      } satisfies GiveawayAdminResponse)
    } catch (error) {
      response.status(500).json({
        ok: false,
        giveawayId: giveawayIds[0] ?? null,
        reason: 'internal_error',
        detail: error instanceof Error ? error.message : 'Unknown backend error.',
      } satisfies GiveawayAdminResponse)
    }
  },
)


// ── Giveaway Player Functions ──

export const joinGiveaway = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({
        ok: false,
        totalTickets: 0,
        reason: 'invalid_method',
      } satisfies JoinGiveawayResponse)
      return
    }

    const botToken = telegramBotToken.value()

    if (!botToken) {
      response.status(500).json({
        ok: false,
        totalTickets: 0,
        reason: 'missing_bot_token',
      } satisfies JoinGiveawayResponse)
      return
    }

    const body = request.body as Partial<JoinGiveawayRequest> | undefined
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const giveawayId = typeof body?.giveawayId === 'string' ? body.giveawayId.trim() : ''

    if (!giveawayId) {
      response.status(400).json({
        ok: false,
        totalTickets: 0,
        reason: 'invalid_payload',
      } satisfies JoinGiveawayResponse)
      return
    }

    const verificationResult = verifyTelegramInitData(initData, botToken)

    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
      response.status(401).json({
        ok: false,
        totalTickets: 0,
        reason:
          verificationResult.reason === 'expired_init_data'
            ? 'expired_init_data'
            : 'invalid_init_data',
      } satisfies JoinGiveawayResponse)
      return
    }

    const telegramUserId = verificationResult.user.id
    const telegramUsername = verificationResult.user.username ?? null

    try {
      const db = getFirestore()
      const giveawayRef = db.collection('giveaways').doc(giveawayId)

      const result = await db.runTransaction(async (transaction) => {
        const giveawaySnapshot = await transaction.get(giveawayRef)

        if (!giveawaySnapshot.exists) {
          return { status: 'not_found' as const }
        }

        const giveawayData = giveawaySnapshot.data() as
          | {
              status?: string
              accessLevel?: string
              baseEntryTickets?: number
              startAt?: string | null
              endAt?: string
              enteredCount?: number
              totalTicketsPool?: number
            }
          | undefined

        if (!giveawayData || giveawayData.status !== 'live') {
          return { status: 'not_live' as const }
        }

        // Check if already joined
        const existingEntries = await db
          .collection('giveaways')
          .doc(giveawayId)
          .collection('entries')
          .where('telegramUserId', '==', telegramUserId)
          .limit(1)
          .get()

        if (!existingEntries.empty) {
          return { status: 'already_joined' as const }
        }

        // Create entry document
        const baseTickets = giveawayData.baseEntryTickets ?? 1
        const entryRef = db
          .collection('giveaways')
          .doc(giveawayId)
          .collection('entries')
          .doc()

        transaction.set(entryRef, {
          telegramUserId,
          telegramUsername,
          joinedAt: new Date().toISOString(),
          completedTaskIds: [],
          totalTickets: baseTickets,
        })

        // Update giveaway counters
        transaction.update(giveawayRef, {
          enteredCount: FieldValue.increment(1),
          totalTicketsPool: FieldValue.increment(baseTickets),
        })

        return { status: 'joined' as const, totalTickets: baseTickets }
      })

      switch (result.status) {
        case 'not_found':
          response.status(404).json({
            ok: false,
            totalTickets: 0,
            reason: 'invalid_payload',
            detail: 'Giveaway not found.',
          } satisfies JoinGiveawayResponse)
          return

        case 'not_live':
          response.status(409).json({
            ok: false,
            totalTickets: 0,
            reason: 'giveaway_not_live',
          } satisfies JoinGiveawayResponse)
          return

        case 'already_joined':
          response.status(409).json({
            ok: false,
            totalTickets: 0,
            reason: 'already_joined',
          } satisfies JoinGiveawayResponse)
          return

        case 'joined':
          response.status(200).json({
            ok: true,
            totalTickets: result.totalTickets,
            reason: 'joined',
          } satisfies JoinGiveawayResponse)
          return
      }
    } catch (error) {
      response.status(500).json({
        ok: false,
        totalTickets: 0,
        reason: 'internal_error',
        detail: error instanceof Error ? error.message : 'Unknown backend error.',
      } satisfies JoinGiveawayResponse)
    }
  },
)

export const completeGiveawayTask = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({
        ok: false,
        totalTickets: 0,
        taskTicketsGranted: 0,
        reason: 'invalid_method',
      } satisfies CompleteGiveawayTaskResponse)
      return
    }

    const botToken = telegramBotToken.value()

    if (!botToken) {
      response.status(500).json({
        ok: false,
        totalTickets: 0,
        taskTicketsGranted: 0,
        reason: 'missing_bot_token',
      } satisfies CompleteGiveawayTaskResponse)
      return
    }

    const body = request.body as Partial<CompleteGiveawayTaskRequest> | undefined
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const giveawayId = typeof body?.giveawayId === 'string' ? body.giveawayId.trim() : ''
    const taskId = typeof body?.taskId === 'string' ? body.taskId.trim() : ''

    if (!giveawayId || !taskId) {
      response.status(400).json({
        ok: false,
        totalTickets: 0,
        taskTicketsGranted: 0,
        reason: 'invalid_payload',
      } satisfies CompleteGiveawayTaskResponse)
      return
    }

    const verificationResult = verifyTelegramInitData(initData, botToken)

    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
      response.status(401).json({
        ok: false,
        totalTickets: 0,
        taskTicketsGranted: 0,
        reason:
          verificationResult.reason === 'expired_init_data'
            ? 'expired_init_data'
            : 'invalid_init_data',
      } satisfies CompleteGiveawayTaskResponse)
      return
    }

    const telegramUserId = verificationResult.user.id

    try {
      const db = getFirestore()
      const giveawayRef = db.collection('giveaways').doc(giveawayId)

      const result = await db.runTransaction(async (transaction) => {
        const giveawaySnapshot = await transaction.get(giveawayRef)

        if (!giveawaySnapshot.exists) {
          return { status: 'not_found' as const }
        }

        const giveawayData = giveawaySnapshot.data() as
          | {
              status?: string
              entryTasks?: Array<{
                id: string
                type: string
                label: string
                ticketsGranted: number
              }>
              totalTicketsPool?: number
            }
          | undefined

        if (!giveawayData || giveawayData.status !== 'live') {
          return { status: 'not_live' as const }
        }

        // Find the task definition
        const taskDef = giveawayData.entryTasks?.find((t) => t.id === taskId) ?? null
        if (!taskDef) {
          return { status: 'task_not_found' as const }
        }

        // Find the user's entry
        const entriesSnapshot = await db
          .collection('giveaways')
          .doc(giveawayId)
          .collection('entries')
          .where('telegramUserId', '==', telegramUserId)
          .limit(1)
          .get()

        if (entriesSnapshot.empty) {
          return { status: 'not_joined' as const }
        }

        const entryDoc = entriesSnapshot.docs[0]
        const entryData = entryDoc.data() as {
          completedTaskIds?: string[]
          totalTickets?: number
        }

        // Check if already completed
        if (entryData.completedTaskIds?.includes(taskId)) {
          return { status: 'already_completed' as const }
        }

        // Grant tickets
        const ticketsGranted = taskDef.ticketsGranted
        const currentTickets = entryData.totalTickets ?? 0

        transaction.update(entryDoc.ref, {
          completedTaskIds: FieldValue.arrayUnion(taskId),
          totalTickets: currentTickets + ticketsGranted,
        })

        // Update giveaway pool
        transaction.update(giveawayRef, {
          totalTicketsPool: FieldValue.increment(ticketsGranted),
        })

        return { status: 'completed' as const, totalTickets: currentTickets + ticketsGranted, taskTicketsGranted: ticketsGranted }
      })

      switch (result.status) {
        case 'not_found':
          response.status(404).json({
            ok: false,
            totalTickets: 0,
            taskTicketsGranted: 0,
            reason: 'invalid_payload',
            detail: 'Giveaway not found.',
          } satisfies CompleteGiveawayTaskResponse)
          return

        case 'not_live':
          response.status(409).json({
            ok: false,
            totalTickets: 0,
            taskTicketsGranted: 0,
            reason: 'giveaway_not_live',
          } satisfies CompleteGiveawayTaskResponse)
          return

        case 'task_not_found':
          response.status(404).json({
            ok: false,
            totalTickets: 0,
            taskTicketsGranted: 0,
            reason: 'task_not_found',
          } satisfies CompleteGiveawayTaskResponse)
          return

        case 'not_joined':
          response.status(409).json({
            ok: false,
            totalTickets: 0,
            taskTicketsGranted: 0,
            reason: 'not_joined',
          } satisfies CompleteGiveawayTaskResponse)
          return

        case 'already_completed':
          response.status(409).json({
            ok: false,
            totalTickets: 0,
            taskTicketsGranted: 0,
            reason: 'already_completed',
          } satisfies CompleteGiveawayTaskResponse)
          return

        case 'completed':
          response.status(200).json({
            ok: true,
            totalTickets: result.totalTickets,
            taskTicketsGranted: result.taskTicketsGranted,
            reason: 'completed',
          } satisfies CompleteGiveawayTaskResponse)
          return
      }
    } catch (error) {
      response.status(500).json({
        ok: false,
        totalTickets: 0,
        taskTicketsGranted: 0,
        reason: 'internal_error',
        detail: error instanceof Error ? error.message : 'Unknown backend error.',
      } satisfies CompleteGiveawayTaskResponse)
    }
  },
)

export const getGiveawayEntries = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({
        ok: false,
        entries: [],
        totalParticipants: 0,
        myEntry: null,
        reason: 'invalid_method',
      } satisfies GetGiveawayEntriesResponse)
      return
    }

    const botToken = telegramBotToken.value()

    if (!botToken) {
      response.status(500).json({
        ok: false,
        entries: [],
        totalParticipants: 0,
        myEntry: null,
        reason: 'missing_bot_token',
      } satisfies GetGiveawayEntriesResponse)
      return
    }

    const body = request.body as Partial<GetGiveawayEntriesRequest> | undefined
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const giveawayId = typeof body?.giveawayId === 'string' ? body.giveawayId.trim() : ''

    if (!giveawayId) {
      response.status(400).json({
        ok: false,
        entries: [],
        totalParticipants: 0,
        myEntry: null,
        reason: 'invalid_payload',
      } satisfies GetGiveawayEntriesResponse)
      return
    }

    const verificationResult = verifyTelegramInitData(initData, botToken)

    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
      response.status(401).json({
        ok: false,
        entries: [],
        totalParticipants: 0,
        myEntry: null,
        reason:
          verificationResult.reason === 'expired_init_data'
            ? 'expired_init_data'
            : 'invalid_init_data',
      } satisfies GetGiveawayEntriesResponse)
      return
    }

    const telegramUserId = verificationResult.user.id

    try {
      const db = getFirestore()

      // Verify giveaway exists
      const giveawaySnapshot = await db.collection('giveaways').doc(giveawayId).get()
      if (!giveawaySnapshot.exists) {
        response.status(404).json({
          ok: false,
          entries: [],
          totalParticipants: 0,
          myEntry: null,
          reason: 'invalid_payload',
          detail: 'Giveaway not found.',
        } satisfies GetGiveawayEntriesResponse)
        return
      }

      // Fetch all entries
      const entriesSnapshot = await db
        .collection('giveaways')
        .doc(giveawayId)
        .collection('entries')
        .orderBy('totalTickets', 'desc')
        .get()

      const entries: GiveawayEntryData[] = entriesSnapshot.docs.map((doc) => {
        const data = doc.data() as GiveawayEntryData
        return {
          telegramUserId: data.telegramUserId,
          telegramUsername: data.telegramUsername ?? null,
          joinedAt: data.joinedAt,
          completedTaskIds: data.completedTaskIds ?? [],
          totalTickets: data.totalTickets,
        }
      })

      const myEntry = entries.find((e) => e.telegramUserId === telegramUserId) ?? null

      response.status(200).json({
        ok: true,
        entries,
        totalParticipants: entries.length,
        myEntry,
        reason: 'listed',
      } satisfies GetGiveawayEntriesResponse)
    } catch (error) {
      response.status(500).json({
        ok: false,
        entries: [],
        totalParticipants: 0,
        myEntry: null,
        reason: 'internal_error',
        detail: error instanceof Error ? error.message : 'Unknown backend error.',
      } satisfies GetGiveawayEntriesResponse)
    }
  },
)

export const getMyGiveawayEntry = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({
        ok: false,
        entry: null,
        reason: 'invalid_method',
      } satisfies GetMyGiveawayEntryResponse)
      return
    }

    const botToken = telegramBotToken.value()

    if (!botToken) {
      response.status(500).json({
        ok: false,
        entry: null,
        reason: 'missing_bot_token',
      } satisfies GetMyGiveawayEntryResponse)
      return
    }

    const body = request.body as Partial<GetMyGiveawayEntryRequest> | undefined
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const giveawayId = typeof body?.giveawayId === 'string' ? body.giveawayId.trim() : ''

    if (!giveawayId) {
      response.status(400).json({
        ok: false,
        entry: null,
        reason: 'invalid_payload',
      } satisfies GetMyGiveawayEntryResponse)
      return
    }

    const verificationResult = verifyTelegramInitData(initData, botToken)

    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
      response.status(401).json({
        ok: false,
        entry: null,
        reason:
          verificationResult.reason === 'expired_init_data'
            ? 'expired_init_data'
            : 'invalid_init_data',
      } satisfies GetMyGiveawayEntryResponse)
      return
    }

    const telegramUserId = verificationResult.user.id

    try {
      const db = getFirestore()

      // Targeted query — only the current user's entry, limited to 1
      const entriesSnapshot = await db
        .collection('giveaways')
        .doc(giveawayId)
        .collection('entries')
        .where('telegramUserId', '==', telegramUserId)
        .limit(1)
        .get()

      if (entriesSnapshot.empty) {
        response.status(200).json({
          ok: true,
          entry: null,
          reason: 'not_found',
        } satisfies GetMyGiveawayEntryResponse)
        return
      }

      const data = entriesSnapshot.docs[0].data() as GiveawayEntryData
      const entry: GiveawayEntryData = {
        telegramUserId: data.telegramUserId,
        telegramUsername: data.telegramUsername ?? null,
        joinedAt: data.joinedAt,
        completedTaskIds: data.completedTaskIds ?? [],
        totalTickets: data.totalTickets,
      }

      response.status(200).json({
        ok: true,
        entry,
        reason: 'found',
      } satisfies GetMyGiveawayEntryResponse)
    } catch (error) {
      response.status(500).json({
        ok: false,
        entry: null,
        reason: 'internal_error',
        detail: error instanceof Error ? error.message : 'Unknown backend error.',
      } satisfies GetMyGiveawayEntryResponse)
    }
  },
)

export const drawGiveawayAdmin = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({
        ok: false,
        winners: [],
        reason: 'invalid_method',
      } satisfies DrawGiveawayAdminResponse)
      return
    }

    const botToken = telegramBotToken.value()

    if (!botToken) {
      response.status(500).json({
        ok: false,
        winners: [],
        reason: 'missing_bot_token',
      } satisfies DrawGiveawayAdminResponse)
      return
    }

    const body = request.body as Partial<DrawGiveawayAdminRequest> | undefined
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const giveawayId = typeof body?.giveawayId === 'string' ? body.giveawayId.trim() : ''

    if (!giveawayId) {
      response.status(400).json({
        ok: false,
        winners: [],
        reason: 'invalid_payload',
      } satisfies DrawGiveawayAdminResponse)
      return
    }

    const verificationResult = verifyTelegramInitData(initData, botToken)

    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
      response.status(401).json({
        ok: false,
        winners: [],
        reason:
          verificationResult.reason === 'expired_init_data'
            ? 'expired_init_data'
            : 'invalid_init_data',
      } satisfies DrawGiveawayAdminResponse)
      return
    }

    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
      response.status(403).json({
        ok: false,
        winners: [],
        reason: 'forbidden',
      } satisfies DrawGiveawayAdminResponse)
      return
    }

    try {
      const db = getFirestore()
      const giveawayRef = db.collection('giveaways').doc(giveawayId)

      const result = await db.runTransaction(async (transaction) => {
        const giveawaySnapshot = await transaction.get(giveawayRef)

        if (!giveawaySnapshot.exists) {
          return { status: 'not_found' as const }
        }

        const giveawayData = giveawaySnapshot.data() as
          | {
              status?: string
              prizes?: Array<{ productId: string; place: number; productName: string; productImage: string }>
              enteredCount?: number
              totalTicketsPool?: number
              winners?: unknown
            }
          | undefined

        if (!giveawayData || giveawayData.status !== 'live') {
          return { status: 'not_live' as const }
        }

        // Fetch all entries
        const entriesSnapshot = await db
          .collection('giveaways')
          .doc(giveawayId)
          .collection('entries')
          .get()

        if (entriesSnapshot.empty) {
          return { status: 'no_entries' as const }
        }

        const prizes = giveawayData.prizes ?? []
        if (prizes.length === 0) {
          return { status: 'no_prizes' as const }
        }

        // Build weighted list for drawing
        const entries = entriesSnapshot.docs.map((doc) => ({
          id: doc.id,
          data: doc.data() as {
            telegramUserId: number
            telegramUsername: string | null
            totalTickets: number
          },
        }))

        // Weighted random draw for each prize
        const drawnWinners: GiveawayWinnerResult[] = []
        const remainingEntries = [...entries]

        for (const prize of prizes) {
          if (remainingEntries.length === 0) break

          // Calculate total tickets among remaining entries
          const totalTickets = remainingEntries.reduce((sum, e) => sum + Math.max(1, e.data.totalTickets), 0)

          // Random pick weighted by tickets
          let randomPoint = Math.random() * totalTickets
          let selectedIndex = 0
          for (let i = 0; i < remainingEntries.length; i++) {
            randomPoint -= Math.max(1, remainingEntries[i].data.totalTickets)
            if (randomPoint <= 0) {
              selectedIndex = i
              break
            }
          }

          const winner = remainingEntries[selectedIndex]
          drawnWinners.push({
            place: prize.place,
            productId: prize.productId,
            telegramUserId: winner.data.telegramUserId,
            telegramUsername: winner.data.telegramUsername ?? null,
            ticketsAtWinTime: winner.data.totalTickets,
          })

          // Remove winner from pool so they can't win multiple prizes
          remainingEntries.splice(selectedIndex, 1)
        }

        // Update giveaway with winners and mark as finished
        const now = new Date().toISOString()
        transaction.update(giveawayRef, {
          status: 'finished',
          winners: drawnWinners,
          finishedAt: now,
        })

        return { status: 'drawn' as const, winners: drawnWinners }
      })

      switch (result.status) {
        case 'not_found':
          response.status(404).json({
            ok: false,
            winners: [],
            reason: 'invalid_payload',
            detail: 'Giveaway not found.',
          } satisfies DrawGiveawayAdminResponse)
          return

        case 'not_live':
          response.status(409).json({
            ok: false,
            winners: [],
            reason: 'giveaway_not_live',
          } satisfies DrawGiveawayAdminResponse)
          return

        case 'no_entries':
          response.status(409).json({
            ok: false,
            winners: [],
            reason: 'not_enough_participants',
          } satisfies DrawGiveawayAdminResponse)
          return

        case 'no_prizes':
          response.status(409).json({
            ok: false,
            winners: [],
            reason: 'invalid_payload',
            detail: 'Giveaway has no prizes configured.',
          } satisfies DrawGiveawayAdminResponse)
          return

        case 'drawn':
          response.status(200).json({
            ok: true,
            winners: result.winners,
            reason: 'drawn',
          } satisfies DrawGiveawayAdminResponse)
          return
      }
    } catch (error) {
      response.status(500).json({
        ok: false,
        winners: [],
        reason: 'internal_error',
        detail: error instanceof Error ? error.message : 'Unknown backend error.',
      } satisfies DrawGiveawayAdminResponse)
    }
  },
)

