// ── Giveaway Types ──

export type GiveawayStatus =
  | 'draft'
  | 'scheduled'
  | 'live'
  | 'finished'
  | 'announced'

export type GiveawayAccessLevel = 'public' | 'early_access_only'

export type EntryTaskType =
  | 'join_channel'
  | 'invite_friend'
  | 'like_product'
  | 'custom'

export type EntryTaskVerifyMethod =
  | 'telegram_api'
  | 'referral_count'
  | 'manual'

export type GiveawayPrizeInput = {
  productId: string
  place: number
}

export type GiveawayPrize = {
  productId: string
  productName: string
  productImage: string
  place: number
}

export type EntryTaskInput = {
  type: EntryTaskType
  label: string
  ticketsGranted: number
  verifyMethod: EntryTaskVerifyMethod
  metadata?: string // e.g., channel username for join_channel, product ID for like_product
}

export type EntryTask = {
  id: string
  type: EntryTaskType
  label: string
  ticketsGranted: number
  verifyMethod: EntryTaskVerifyMethod
  metadata?: string
}

export type GiveawayWinner = {
  place: number
  productId: string
  productName: string
  telegramUserId: number
  telegramUsername: string | null
  ticketsAtWinTime: number
}

export interface Giveaway {
  id: string
  title: string
  description: string
  imageUrl: string
  status: GiveawayStatus
  startAt: string | null
  endAt: string
  prizes: GiveawayPrize[]
  winnersCount: number
  accessLevel: GiveawayAccessLevel
  entryTasks: EntryTask[]
  baseEntryTickets: number
  enteredCount: number
  totalTicketsPool: number
  createdAt: string | null
  updatedAt: string | null
  winners: GiveawayWinner[] | null
  finishedAt: string | null
  taskIds: string[]
  taskTickets: Record<string, number>
}

export type GiveawayInput = {
  title: string
  description: string
  imageUrl: string
  status: GiveawayStatus
  startAt: string | null
  endAt: string
  prizes: GiveawayPrizeInput[]
  accessLevel: GiveawayAccessLevel
  entryTasks: EntryTaskInput[]
  baseEntryTickets: number
  taskIds: string[]
  taskTickets: Record<string, number>
}

// ── Giveaway Entry Types ──

export interface GiveawayEntry {
  telegramUserId: number
  telegramUsername: string | null
  joinedAt: string
  completedTaskIds: string[]
  totalTickets: number
}

// ── Task Types (keep existing) ──

export interface Task {
  id: string
  title: string
  rewardType: 'coupon' | 'ticket'
  rewardValue: string
  status: 'active' | 'inactive'
  sortOrder: number
  actionUrl?: string
  actionLabel?: string
  createdAt: string | null
  updatedAt: string | null
}

export type TaskInput = {
  title: string
  rewardType: 'coupon' | 'ticket'
  rewardValue: string
  status: 'active' | 'inactive'
  sortOrder: number
  actionUrl?: string
  actionLabel?: string
}

export type RewardTab = 'giveaways' | 'tasks'
