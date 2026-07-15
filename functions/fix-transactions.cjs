const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'src', 'giveaways.ts');
let c = fs.readFileSync(filePath, 'utf8');

// Fix 1: joinGiveaway - move entry query before transaction
// Find the transaction inside joinGiveaway
const joinTransactionStart = `      const result = await db.runTransaction(async (transaction) => {
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
        }`;

const joinTransactionFixed = `      // Check if already joined (must happen before transaction)
      const existingEntries = await db
        .collection('giveaways')
        .doc(giveawayId)
        .collection('entries')
        .where('telegramUserId', '==', telegramUserId)
        .limit(1)
        .get()

      if (!existingEntries.empty) {
        response.status(409).json({
          ok: false,
          totalTickets: 0,
          reason: 'already_joined',
        } satisfies JoinGiveawayResponse)
        return
      }

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
        }`;

c = c.replace(joinTransactionStart, joinTransactionFixed);

// Fix 2: completeGiveawayTask - move entry query before transaction, use increment
const completeTaskStart = `      const result = await db.runTransaction(async (transaction) => {
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
      })`;

const completeTaskFixed = `      // Find the task definition from the giveaway document
      const giveawayDoc = await giveawayRef.get()
      if (!giveawayDoc.exists) {
        response.status(404).json({
          ok: false,
          totalTickets: 0,
          taskTicketsGranted: 0,
          reason: 'invalid_payload',
          detail: 'Giveaway not found.',
        } satisfies CompleteGiveawayTaskResponse)
        return
      }

      const giveawayDataTask = giveawayDoc.data() as {
        status?: string
        entryTasks?: Array<{
          id: string
          type: string
          label: string
          ticketsGranted: number
        }>
      } | undefined

      if (!giveawayDataTask || giveawayDataTask.status !== 'live') {
        response.status(409).json({
          ok: false,
          totalTickets: 0,
          taskTicketsGranted: 0,
          reason: 'giveaway_not_live',
        } satisfies CompleteGiveawayTaskResponse)
        return
      }

      const taskDef = giveawayDataTask.entryTasks?.find((t) => t.id === taskId) ?? null
      if (!taskDef) {
        response.status(404).json({
          ok: false,
          totalTickets: 0,
          taskTicketsGranted: 0,
          reason: 'task_not_found',
        } satisfies CompleteGiveawayTaskResponse)
        return
      }

      const ticketsGranted = taskDef.ticketsGranted

      // Find the user's entry (must happen before transaction)
      const targetEntries = await db
        .collection('giveaways')
        .doc(giveawayId)
        .collection('entries')
        .where('telegramUserId', '==', telegramUserId)
        .limit(1)
        .get()

      if (targetEntries.empty) {
        response.status(409).json({
          ok: false,
          totalTickets: 0,
          taskTicketsGranted: 0,
          reason: 'not_joined',
        } satisfies CompleteGiveawayTaskResponse)
        return
      }

      const entryDoc = targetEntries.docs[0]
      const entryData = entryDoc.data() as {
        completedTaskIds?: string[]
        totalTickets?: number
      }

      if (entryData.completedTaskIds?.includes(taskId)) {
        response.status(409).json({
          ok: false,
          totalTickets: 0,
          taskTicketsGranted: 0,
          reason: 'already_completed',
        } satisfies CompleteGiveawayTaskResponse)
        return
      }

      const result = await db.runTransaction(async (transaction) => {
        // Re-read entry atomically in the transaction
        const freshEntrySnapshot = await transaction.get(entryDoc.ref)

        if (!freshEntrySnapshot.exists) {
          return { status: 'not_found' as const }
        }

        const freshEntryData = freshEntrySnapshot.data() as {
          completedTaskIds?: string[]
          totalTickets?: number
        }

        // Double-check not already completed (atomic)
        if (freshEntryData.completedTaskIds?.includes(taskId)) {
          return { status: 'already_completed' as const }
        }

        const currentTickets = freshEntryData.totalTickets ?? 0

        transaction.update(entryDoc.ref, {
          completedTaskIds: FieldValue.arrayUnion(taskId),
          totalTickets: currentTickets + ticketsGranted,
        })

        transaction.update(giveawayRef, {
          totalTicketsPool: FieldValue.increment(ticketsGranted),
        })

        return { status: 'completed' as const, totalTickets: currentTickets + ticketsGranted, taskTicketsGranted: ticketsGranted }
      })`;

c = c.replace(completeTaskStart, completeTaskFixed);

// Fix 3: drawGiveawayAdmin - move entries query before transaction
const drawTransactionStart = `      const result = await db.runTransaction(async (transaction) => {
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
        }`;

const drawTransactionFixed = `      // Fetch all entries before the transaction
      const entriesSnapshot = await db
        .collection('giveaways')
        .doc(giveawayId)
        .collection('entries')
        .get()

      if (entriesSnapshot.empty) {
        response.status(409).json({
          ok: false,
          winners: [],
          reason: 'not_enough_participants',
        } satisfies DrawGiveawayAdminResponse)
        return
      }

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

        const prizes = giveawayData.prizes ?? []
        if (prizes.length === 0) {
          return { status: 'no_prizes' as const }
        }`;

c = c.replace(drawTransactionStart, drawTransactionFixed);

fs.writeFileSync(filePath, c, 'utf8');
console.log('Transaction fixes applied to giveaways.ts');
