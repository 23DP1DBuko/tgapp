export interface Task {
  id: string
  title: string
  rewardType: 'coupon' | 'ticket'
  rewardValue: string
  status: 'active' | 'inactive'
  sortOrder: number
  createdAt: string | null
  updatedAt: string | null
}

export type TaskInput = {
  title: string
  rewardType: 'coupon' | 'ticket'
  rewardValue: string
  status: 'active' | 'inactive'
  sortOrder: number
}

export interface Giveaway {
  id: string
  productId: string
  productName: string
  productImage: string
  totalTickets: number
  enteredCount: number
  endsAt: string | null
  isActive: boolean
  winnerUsername: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type GiveawayInput = {
  productId: string
  productName: string
  productImage: string
  totalTickets: number
  enteredCount: number
  endsAt: string | null
  isActive: boolean
  winnerUsername: string | null
}

export type RewardTab = 'giveaways' | 'tasks'
