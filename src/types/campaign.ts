export interface Campaign {
  id: string
  tag: string
  headingPart1: string
  headingPart2: string
  subtitle: string
  isActive: boolean
  sortOrder: number
  createdAt: string | null
  updatedAt: string | null
}

export type CampaignInput = {
  tag: string
  headingPart1: string
  headingPart2: string
  subtitle: string
  isActive: boolean
  sortOrder: number
}
