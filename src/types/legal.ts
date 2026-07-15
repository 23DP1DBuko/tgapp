/** Data that is collected and its retention period */
export type DataCategory =
  | 'order_request'
  | 'referral_activity'
  | 'giveaway_participation'
  | 'broadcast_consent'
  | 'daily_checkin'
  | 'leaderboard_visibility'

/** User consent record stored in Firestore */
export type UserConsent = {
  telegramUserId: number
  hasAcceptedTerms: boolean
  acceptedAt: string | null // ISO string
  ipAddress?: string
  userAgent?: string
}

/** User privacy/settings preferences stored in Firestore */
export type UserSettings = {
  telegramUserId: number
  /** Whether user appears in referral leaderboard */
  leaderboardShown: boolean
  /** Whether user receives broadcast messages (already exists on telegramSubscribers) */
  allowBroadcasts: boolean
  updatedAt: string | null
}

/** Minimal response from consent/settings API */
export type UserSettingsResponse = {
  ok: boolean
  hasAcceptedTerms?: boolean
  leaderboardShown?: boolean
  allowBroadcasts?: boolean
  reason?: string
  detail?: string
}
