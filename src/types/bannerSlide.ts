export interface BannerSlide {
  id: string
  imageUrl: string
  badgeText: string
  headline: string
  subheading: string
  caption: string
  isActive: boolean
  sortOrder: number
  createdAt: string | null
  updatedAt: string | null
}

export type BannerSlideInput = {
  imageUrl: string
  badgeText: string
  headline: string
  subheading: string
  caption: string
  isActive: boolean
  sortOrder: number
}
