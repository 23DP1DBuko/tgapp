import { describe, it, expect, vi } from 'vitest'

// Mock firebase-admin so importing giveaways.ts (and its helpers.ts import)
// does not bootstrap a real Firebase app at module load.
vi.mock('firebase-admin/app', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase-admin/app')>()
  return {
    ...actual,
    getApps: () => [{ name: '[DEFAULT]' } as never],
    initializeApp: vi.fn(() => ({}) as never),
  }
})

// Route getFirestore() to a per-test FakeFirestore.
const fakeDbHolder = vi.hoisted(() => ({ current: null as never }))

vi.mock('firebase-admin/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase-admin/firestore')>()
  return {
    ...actual,
    getFirestore: () => fakeDbHolder.current,
  }
})

import {
  verifyGiveawayTaskEligibility,
  completeGiveawayTaskWithVerification,
  reapplyTaskToReferencingGiveaways,
  type TelegramMemberCheck,
} from '../src/giveaways.js'
import { FakeFirestore } from './fakeFirestore.js'

const BOT_TOKEN = '123456:TEST-BOT-TOKEN'

describe('verifyGiveawayTaskEligibility — manual (H6)', () => {
  it('always passes (honor-system)', async () => {
    const result = await verifyGiveawayTaskEligibility(
      {} as never,
      { verifyMethod: 'manual', metadata: null },
      123,
      BOT_TOKEN,
    )
    expect(result).toEqual({ ok: true })
  })
})

describe('verifyGiveawayTaskEligibility — referral_count (H6)', () => {
  it('passes when the user has been referred (referredBy set, no threshold)', async () => {
    const db = new FakeFirestore()
    db.seed('telegramSubscribers', 'u123', {
      telegramUserId: 123,
      referredBy: 'ref_456',
    })

    const result = await verifyGiveawayTaskEligibility(
      db as never,
      { verifyMethod: 'referral_count', metadata: null },
      123,
      BOT_TOKEN,
    )
    expect(result).toEqual({ ok: true })
  })

  it('fails when the user has a subscriber doc but was never referred', async () => {
    const db = new FakeFirestore()
    db.seed('telegramSubscribers', 'u123', { telegramUserId: 123 })

    const result = await verifyGiveawayTaskEligibility(
      db as never,
      { verifyMethod: 'referral_count', metadata: null },
      123,
      BOT_TOKEN,
    )
    expect(result).toEqual({ ok: false })
  })

  it('fails when the user has no subscriber doc at all', async () => {
    const db = new FakeFirestore()

    const result = await verifyGiveawayTaskEligibility(
      db as never,
      { verifyMethod: 'referral_count', metadata: null },
      123,
      BOT_TOKEN,
    )
    expect(result).toEqual({ ok: false })
  })

  it('ignores a malformed referredBy value', async () => {
    const db = new FakeFirestore()
    db.seed('telegramSubscribers', 'u123', {
      telegramUserId: 123,
      referredBy: 'garbage-code',
    })

    const result = await verifyGiveawayTaskEligibility(
      db as never,
      { verifyMethod: 'referral_count', metadata: null },
      123,
      BOT_TOKEN,
    )
    expect(result).toEqual({ ok: false })
  })

  it('passes when the metadata threshold is met by real referrals (H4 self-ref excluded)', async () => {
    const db = new FakeFirestore()
    // 2 real referrals...
    db.seed('telegramSubscribers', 'f1', { telegramUserId: 11, referredBy: 'ref_123' })
    db.seed('telegramSubscribers', 'f2', { telegramUserId: 12, referredBy: 'ref_123' })
    // ...plus the user's own self-referral doc, which must not count (H4).
    db.seed('telegramSubscribers', 'self', {
      telegramUserId: 123,
      referredBy: 'ref_123',
    })

    const result = await verifyGiveawayTaskEligibility(
      db as never,
      { verifyMethod: 'referral_count', metadata: '2' },
      123,
      BOT_TOKEN,
    )
    expect(result).toEqual({ ok: true })
  })

  it('fails when the metadata threshold is not met', async () => {
    const db = new FakeFirestore()
    db.seed('telegramSubscribers', 'f1', { telegramUserId: 11, referredBy: 'ref_123' })

    const result = await verifyGiveawayTaskEligibility(
      db as never,
      { verifyMethod: 'referral_count', metadata: '3' },
      123,
      BOT_TOKEN,
    )
    expect(result).toEqual({ ok: false })
  })
})

describe('verifyGiveawayTaskEligibility — telegram_api (H6)', () => {
  it('passes when the bot confirms membership', async () => {
    const memberCheck: TelegramMemberCheck = async () => ({ ok: true })

    const result = await verifyGiveawayTaskEligibility(
      {} as never,
      { verifyMethod: 'telegram_api', metadata: '-100123456789' },
      123,
      BOT_TOKEN,
      { telegramMemberCheck: memberCheck },
    )
    expect(result).toEqual({ ok: true })
  })

  it('fails with not_member when the bot says the user is not a member', async () => {
    const memberCheck: TelegramMemberCheck = async () => ({ ok: false, detail: 'not_member' })

    const result = await verifyGiveawayTaskEligibility(
      {} as never,
      { verifyMethod: 'telegram_api', metadata: '-100123456789' },
      123,
      BOT_TOKEN,
      { telegramMemberCheck: memberCheck },
    )
    expect(result).toEqual({ ok: false, detail: 'not_member' })
  })

  it('fails closed with chat_missing when the chat id is missing from metadata', async () => {
    let called = false
    const memberCheck: TelegramMemberCheck = async () => {
      called = true
      return { ok: true }
    }

    const result = await verifyGiveawayTaskEligibility(
      {} as never,
      { verifyMethod: 'telegram_api', metadata: null },
      123,
      BOT_TOKEN,
      { telegramMemberCheck: memberCheck },
    )
    expect(result).toEqual({ ok: false, detail: 'chat_missing' })
    expect(called).toBe(false)
  })

  it('fails closed with chat_unreachable when the bot API call throws', async () => {
    const memberCheck: TelegramMemberCheck = async () => {
      throw new Error('network down')
    }

    const result = await verifyGiveawayTaskEligibility(
      {} as never,
      { verifyMethod: 'telegram_api', metadata: '-100123456789' },
      123,
      BOT_TOKEN,
      { telegramMemberCheck: memberCheck },
    )
    expect(result).toEqual({ ok: false, detail: 'chat_unreachable' })
  })

  it('passes a chat_unreachable detail through when the bot cannot reach the chat', async () => {
    const memberCheck: TelegramMemberCheck = async () => ({ ok: false, detail: 'chat_unreachable' })

    const result = await verifyGiveawayTaskEligibility(
      {} as never,
      { verifyMethod: 'telegram_api', metadata: '-100123456789' },
      123,
      BOT_TOKEN,
      { telegramMemberCheck: memberCheck },
    )
    expect(result).toEqual({ ok: false, detail: 'chat_unreachable' })
  })
})

describe('verifyGiveawayTaskEligibility — client_claim (server-tracked likes)', () => {
  it('passes when the server-tracked like count meets the metadata threshold', async () => {
    const db = new FakeFirestore()
    db.seed('userStats', '123', { telegramUserId: 123, likedProductCount: 5 })

    const result = await verifyGiveawayTaskEligibility(
      db as never,
      { verifyMethod: 'client_claim', metadata: '5' },
      123,
      BOT_TOKEN,
    )
    expect(result).toEqual({ ok: true })
  })

  it('passes when the tracked count exceeds the threshold', async () => {
    const db = new FakeFirestore()
    db.seed('userStats', '123', { telegramUserId: 123, likedProductCount: 7 })

    const result = await verifyGiveawayTaskEligibility(
      db as never,
      { verifyMethod: 'client_claim', metadata: '3' },
      123,
      BOT_TOKEN,
    )
    expect(result).toEqual({ ok: true })
  })

  it('fails when the tracked count is below the threshold (3 of 5 likes)', async () => {
    const db = new FakeFirestore()
    db.seed('userStats', '123', { telegramUserId: 123, likedProductCount: 3 })

    const result = await verifyGiveawayTaskEligibility(
      db as never,
      { verifyMethod: 'client_claim', metadata: '5' },
      123,
      BOT_TOKEN,
    )
    expect(result).toEqual({ ok: false })
  })

  it('fails closed when the user has no userStats doc at all (device can never self-verify)', async () => {
    const db = new FakeFirestore()

    const result = await verifyGiveawayTaskEligibility(
      db as never,
      { verifyMethod: 'client_claim', metadata: '5' },
      123,
      BOT_TOKEN,
    )
    expect(result).toEqual({ ok: false })
  })

  it('defaults the threshold to 1 when metadata is missing', async () => {
    const db = new FakeFirestore()
    db.seed('userStats', '123', { telegramUserId: 123, likedProductCount: 1 })

    const result = await verifyGiveawayTaskEligibility(
      db as never,
      { verifyMethod: 'client_claim', metadata: null },
      123,
      BOT_TOKEN,
    )
    expect(result).toEqual({ ok: true })
  })
})

describe('completeGiveawayTaskWithVerification (H6)', () => {
  function seedLiveGiveawayWithTask(
    db: FakeFirestore,
    verifyMethod: 'telegram_api' | 'referral_count' | 'client_claim' | 'manual',
    metadata: string | null,
  ) {
    db.seed('giveaways', 'g1', {
      status: 'live',
      accessLevel: 'public',
      baseEntryTickets: 1,
      startAt: null,
      endAt: '2099-01-01T00:00:00.000Z',
      enteredCount: 0,
      totalTicketsPool: 0,
      entryTasks: [
        {
          id: 't1',
          type: 'custom',
          label: 'Task',
          ticketsGranted: 5,
          verifyMethod,
          metadata,
        },
      ],
    })
  }

  function seedEntry(db: FakeFirestore) {
    db.seed('giveaways/g1/entries', '123', {
      telegramUserId: 123,
      telegramUsername: 'alice',
      joinedAt: '2026-01-01T00:00:00.000Z',
      completedTaskIds: [],
      totalTickets: 1,
    })
  }

  it('blocks the grant when verification fails (no state change)', async () => {
    const db = new FakeFirestore()
    seedLiveGiveawayWithTask(db, 'referral_count', null) // user has no referral
    seedEntry(db)

    const result = await completeGiveawayTaskWithVerification(db as never, {
      giveawayId: 'g1',
      taskId: 't1',
      telegramUserId: 123,
      botToken: BOT_TOKEN,
    })
    expect(result).toEqual({ status: 'verification_failed' })

    const entry = db.readAll('giveaways/g1/entries')[0].data
    expect(entry.totalTickets).toBe(1) // unchanged
    expect(entry.completedTaskIds).toEqual([]) // unchanged
    expect(db.readAll('giveaways')[0].data.totalTicketsPool).toBe(0) // no pool increment
  })

  it('grants tickets when verification passes (manual)', async () => {
    const db = new FakeFirestore()
    seedLiveGiveawayWithTask(db, 'manual', null)
    seedEntry(db)

    const result = await completeGiveawayTaskWithVerification(db as never, {
      giveawayId: 'g1',
      taskId: 't1',
      telegramUserId: 123,
      botToken: BOT_TOKEN,
    })
    expect(result).toEqual({ status: 'completed', totalTickets: 6, taskTicketsGranted: 5 })
  })

  it('grants tickets for a telegram_api task when the bot confirms membership', async () => {
    const db = new FakeFirestore()
    seedLiveGiveawayWithTask(db, 'telegram_api', '-100123456789')
    seedEntry(db)
    const memberCheck: TelegramMemberCheck = async () => ({ ok: true })

    const result = await completeGiveawayTaskWithVerification(
      db as never,
      { giveawayId: 'g1', taskId: 't1', telegramUserId: 123, botToken: BOT_TOKEN },
      { telegramMemberCheck: memberCheck },
    )
    expect(result).toEqual({ status: 'completed', totalTickets: 6, taskTicketsGranted: 5 })
  })

  it('blocks a telegram_api task with not_member when the bot denies membership', async () => {
    const db = new FakeFirestore()
    seedLiveGiveawayWithTask(db, 'telegram_api', '-100123456789')
    seedEntry(db)
    const memberCheck: TelegramMemberCheck = async () => ({ ok: false, detail: 'not_member' })

    const result = await completeGiveawayTaskWithVerification(
      db as never,
      { giveawayId: 'g1', taskId: 't1', telegramUserId: 123, botToken: BOT_TOKEN },
      { telegramMemberCheck: memberCheck },
    )
    expect(result).toEqual({ status: 'verification_failed', detail: 'not_member' })
    expect(db.readAll('giveaways/g1/entries')[0].data.totalTickets).toBe(1)
  })

  it('surfaces chat_unreachable so the admin knows the channel check itself failed', async () => {
    const db = new FakeFirestore()
    seedLiveGiveawayWithTask(db, 'telegram_api', '-100123456789')
    seedEntry(db)
    const memberCheck: TelegramMemberCheck = async () => ({ ok: false, detail: 'chat_unreachable' })

    const result = await completeGiveawayTaskWithVerification(
      db as never,
      { giveawayId: 'g1', taskId: 't1', telegramUserId: 123, botToken: BOT_TOKEN },
      { telegramMemberCheck: memberCheck },
    )
    expect(result).toEqual({ status: 'verification_failed', detail: 'chat_unreachable' })
    expect(db.readAll('giveaways/g1/entries')[0].data.totalTickets).toBe(1)
  })

  it('returns not_joined when the user has no entry even if verification passes', async () => {
    const db = new FakeFirestore()
    seedLiveGiveawayWithTask(db, 'manual', null)

    const result = await completeGiveawayTaskWithVerification(db as never, {
      giveawayId: 'g1',
      taskId: 't1',
      telegramUserId: 123,
      botToken: BOT_TOKEN,
    })
    expect(result).toEqual({ status: 'not_joined' })
  })

  it('grants a client_claim task when the server-tracked like count meets the threshold', async () => {
    const db = new FakeFirestore()
    seedLiveGiveawayWithTask(db, 'client_claim', '5')
    seedEntry(db)
    db.seed('userStats', '123', { telegramUserId: 123, likedProductCount: 5 })

    const result = await completeGiveawayTaskWithVerification(db as never, {
      giveawayId: 'g1',
      taskId: 't1',
      telegramUserId: 123,
      botToken: BOT_TOKEN,
    })
    expect(result).toEqual({ status: 'completed', totalTickets: 6, taskTicketsGranted: 5 })
  })

  it('blocks a client_claim task when the tracked count is below the threshold (no state change)', async () => {
    const db = new FakeFirestore()
    seedLiveGiveawayWithTask(db, 'client_claim', '5')
    seedEntry(db)
    db.seed('userStats', '123', { telegramUserId: 123, likedProductCount: 3 })

    const result = await completeGiveawayTaskWithVerification(db as never, {
      giveawayId: 'g1',
      taskId: 't1',
      telegramUserId: 123,
      botToken: BOT_TOKEN,
    })
    expect(result).toEqual({
      status: 'verification_failed',
      detail: 'need_more_likes',
      requiredCount: 5,
    })
    const entry = db.readAll('giveaways/g1/entries')[0].data
    expect(entry.totalTickets).toBe(1)
    expect(entry.completedTaskIds).toEqual([])
  })

  it('blocks a client_claim task when the user has no userStats doc (fail closed)', async () => {
    const db = new FakeFirestore()
    seedLiveGiveawayWithTask(db, 'client_claim', '1')
    seedEntry(db)

    const result = await completeGiveawayTaskWithVerification(db as never, {
      giveawayId: 'g1',
      taskId: 't1',
      telegramUserId: 123,
      botToken: BOT_TOKEN,
    })
    expect(result).toEqual({
      status: 'verification_failed',
      detail: 'need_more_likes',
      requiredCount: 1,
    })
    expect(db.readAll('giveaways/g1/entries')[0].data.totalTickets).toBe(1)
  })

  it('returns task_not_found for an unknown task', async () => {
    const db = new FakeFirestore()
    seedLiveGiveawayWithTask(db, 'manual', null)
    seedEntry(db)

    const result = await completeGiveawayTaskWithVerification(db as never, {
      giveawayId: 'g1',
      taskId: 'nope',
      telegramUserId: 123,
      botToken: BOT_TOKEN,
    })
    expect(result).toEqual({ status: 'task_not_found' })
  })

  // ── Completion-time self-heal: stale giveaway docs (saved before taskType
  //    existed) are re-resolved from the tasks collection, so a stale
  //    'manual' entry task can never keep a now-verified task passing. ──

  function seedStaleGiveaway(db: FakeFirestore) {
    db.seed('giveaways', 'g1', {
      status: 'live',
      accessLevel: 'public',
      baseEntryTickets: 1,
      startAt: null,
      endAt: '2099-01-01T00:00:00.000Z',
      enteredCount: 0,
      totalTicketsPool: 0,
      taskIds: ['t1'],
      taskTickets: { t1: 5 },
      entryTasks: [
        {
          id: 't1',
          type: 'custom',
          label: 'Task',
          ticketsGranted: 5,
          verifyMethod: 'manual',
          metadata: null,
        },
      ],
    })
    seedEntry(db)
  }

  it('self-heals a stale like task: blocks despite the doc saying manual (3 of 5 tracked likes)', async () => {
    const db = new FakeFirestore()
    seedStaleGiveaway(db)
    db.seed('tasks', 't1', { title: 'Task', taskType: 'like_product', requiredCount: 5 })
    db.seed('userStats', '123', { telegramUserId: 123, likedProductCount: 3 })

    const result = await completeGiveawayTaskWithVerification(db as never, {
      giveawayId: 'g1',
      taskId: 't1',
      telegramUserId: 123,
      botToken: BOT_TOKEN,
    })
    expect(result).toEqual({
      status: 'verification_failed',
      detail: 'need_more_likes',
      requiredCount: 5,
    })
    expect(db.readAll('giveaways/g1/entries')[0].data.totalTickets).toBe(1)
  })

  it('self-heals a stale like task: grants when the tracked count meets the threshold', async () => {
    const db = new FakeFirestore()
    seedStaleGiveaway(db)
    db.seed('tasks', 't1', { title: 'Task', taskType: 'like_product', requiredCount: 5 })
    db.seed('userStats', '123', { telegramUserId: 123, likedProductCount: 5 })

    const result = await completeGiveawayTaskWithVerification(db as never, {
      giveawayId: 'g1',
      taskId: 't1',
      telegramUserId: 123,
      botToken: BOT_TOKEN,
    })
    expect(result).toEqual({ status: 'completed', totalTickets: 6, taskTicketsGranted: 5 })
  })

  it('self-heals a stale referral task: blocks a user with no real referrals', async () => {
    const db = new FakeFirestore()
    seedStaleGiveaway(db)
    db.seed('tasks', 't1', { title: 'Task', taskType: 'invite_friend', requiredCount: 3 })

    const result = await completeGiveawayTaskWithVerification(db as never, {
      giveawayId: 'g1',
      taskId: 't1',
      telegramUserId: 123,
      botToken: BOT_TOKEN,
    })
    expect(result).toEqual({ status: 'verification_failed' })
  })

  it('never re-grants a task completed before the fix (verification runs first)', async () => {
    const db = new FakeFirestore()
    seedLiveGiveawayWithTask(db, 'telegram_api', '-100123456789')
    // Legacy entry that already has the task marked complete with tickets granted.
    db.seed('giveaways/g1/entries', '123', {
      telegramUserId: 123,
      telegramUsername: 'alice',
      joinedAt: '2026-01-01T00:00:00.000Z',
      completedTaskIds: ['t1'],
      totalTickets: 6,
    })
    const memberCheck: TelegramMemberCheck = async () => ({ ok: false, detail: 'not_member' })

    // Verification runs before the grant transaction, so a membership that is
    // now denied surfaces as verification_failed — either way, no re-grant.
    const result = await completeGiveawayTaskWithVerification(
      db as never,
      { giveawayId: 'g1', taskId: 't1', telegramUserId: 123, botToken: BOT_TOKEN },
      { telegramMemberCheck: memberCheck },
    )
    expect(['verification_failed', 'already_completed']).toContain(result.status)
    expect(db.readAll('giveaways/g1/entries')[0].data.totalTickets).toBe(6)
  })
})

describe('reapplyTaskToReferencingGiveaways (task-edit propagation)', () => {
  it('re-resolves the entry task in every giveaway that references it, preserving per-giveaway tickets', async () => {
    const db = new FakeFirestore()
    db.seed('giveaways', 'g1', {
      status: 'live',
      entryTasks: [
        { id: 't1', type: 'custom', label: 'Old', ticketsGranted: 5, verifyMethod: 'manual', metadata: null },
      ],
      taskIds: ['t1'],
      taskTickets: { t1: 5 },
    })
    db.seed('giveaways', 'g2', {
      status: 'live',
      entryTasks: [
        { id: 't1', type: 'custom', label: 'Old', ticketsGranted: 5, verifyMethod: 'manual', metadata: null },
      ],
      taskIds: ['t1'],
      taskTickets: { t1: 7 },
    })
    db.seed('giveaways', 'g3', {
      status: 'live',
      entryTasks: [],
      taskIds: ['t9'],
      taskTickets: {},
    })

    const updated = await reapplyTaskToReferencingGiveaways(db as never, 't1', {
      title: 'Like 5',
      taskType: 'like_product',
      requiredCount: 5,
    })
    expect(updated).toBe(2)

    const byId = new Map(db.readAll('giveaways').map((d) => [d.id, d.data]))
    expect(byId.get('g1')!.entryTasks[0]).toMatchObject({
      id: 't1',
      type: 'like_product',
      label: 'Like 5',
      verifyMethod: 'client_claim',
      metadata: '5',
      ticketsGranted: 5,
    })
    expect(byId.get('g2')!.entryTasks[0].ticketsGranted).toBe(7)
    expect(byId.get('g3')!.entryTasks).toEqual([])
  })

  it('adds the entry task when a giveaway references it but has no entryTasks yet', async () => {
    const db = new FakeFirestore()
    db.seed('giveaways', 'g1', { status: 'live', entryTasks: [], taskIds: ['t1'], taskTickets: {} })

    await reapplyTaskToReferencingGiveaways(db as never, 't1', {
      title: 'Join',
      taskType: 'join_channel',
      actionUrl: '@chan',
    })

    const g1 = db.readAll('giveaways')[0].data
    expect(g1.entryTasks).toEqual([
      { id: 't1', type: 'join_channel', label: 'Join', ticketsGranted: 5, verifyMethod: 'telegram_api', metadata: '@chan' },
    ])
  })
})
