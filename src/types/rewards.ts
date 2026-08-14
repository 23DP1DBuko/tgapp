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
  | 'client_claim'
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
  /** Admin toggle: when true, prize products are sellable in the store again
   *  (e.g. after the draw when the winner declined). The storefront skips
   *  this giveaway when computing prize/given-away locks. Default false. */
  prizesForSale: boolean
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
  /** Admin toggle: when true, prize products are sellable in the store again. */
  prizesForSale: boolean
}

// ── Giveaway Entry Types ──

export interface GiveawayEntry {
  telegramUserId: number
  telegramUsername: string | null
  joinedAt: string
  completedTaskIds: string[]
  totalTickets: number
}

/**
 * Public leaderboard row from `getGiveawayEntries` (L1) — never contains
 * participant ids or internal task state; `isMe` is computed server-side.
 */
export interface GiveawayLeaderboardEntry {
  telegramUsername: string | null
  joinedAt: string
  totalTickets: number
  isMe: boolean
}

// ── Task Types (keep existing) ──

export type TaskType = 'custom' | 'join_channel' | 'invite_friend' | 'like_product'

export interface Task {
  id: string
  title: string
  status: 'active' | 'inactive'
  sortOrder: number
  /** Link/channel for `custom` (external URL) and `join_channel` (channel id) tasks. */
  actionUrl?: string
  /** How the task is verified when attached to a giveaway (default 'custom' → manual/honor-system). */
  taskType?: TaskType
  /** Required count for `invite_friend` (referrals) and `like_product` (likes) tasks. */
  requiredCount?: number
  createdAt: string | null
  updatedAt: string | null
}

export type TaskInput = {
  title: string
  status: 'active' | 'inactive'
  sortOrder: number
  actionUrl?: string
  taskType?: TaskType
  requiredCount?: number
}

export type RewardTab = 'giveaways' | 'tasks'
