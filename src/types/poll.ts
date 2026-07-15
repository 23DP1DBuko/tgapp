export interface PollOption {
  label: string
  imageUrl: string
  votes: number
}

export interface Poll {
  id: string
  title: string
  description: string
  options: PollOption[]
  isActive: boolean
  totalVotes: number
  createdAt: string | null
  updatedAt: string | null
}

export type PollInput = {
  title: string
  description: string
  options: Omit<PollOption, 'votes'>[]
  isActive: boolean
}
