import { pickPlural } from './i18n/translate'
import type { Product } from '../types/product'

export type ProductAccessLevel = 'private' | 'early_access' | 'public'

/** Determine the access level of a product based on earlyAccessAt / publicAt timestamps */
export function getProductAccessLevel(product: Product, now = Date.now()): ProductAccessLevel {
  const earlyAccessMs = getTimestampMs(product.earlyAccessAt)
  const publicMs = getTimestampMs(product.publicAt)

  // No scheduling fields — behaves normally based on isAvailable
  if (earlyAccessMs === null && publicMs === null) {
    return product.isAvailable ? 'public' : 'private'
  }

  // Only publicAt set — product becomes public after that time
  if (earlyAccessMs === null && publicMs !== null) {
    return now >= publicMs ? 'public' : 'private'
  }

  // Only earlyAccessAt set — product enters early access at that time, never goes public
  if (earlyAccessMs !== null && publicMs === null) {
    if (now < earlyAccessMs) return 'private'
    return 'early_access'
  }

  // Both set
  if (earlyAccessMs !== null && publicMs !== null) {
    if (now < earlyAccessMs) return 'private'
    if (now >= earlyAccessMs && now < publicMs) return 'early_access'
    return 'public'
  }

  return 'private'
}

/** Number of referrals required to unlock early-access purchases. */
export const EARLY_ACCESS_REFERRAL_THRESHOLD = 1

/**
 * Localized "friend(s)" word for the early-access threshold — the single
 * source of truth for the plural used across CTA, note, and error copy.
 */
export function referralFriendsWord(): string {
  return pickPlural(
    EARLY_ACCESS_REFERRAL_THRESHOLD,
    'coError.friendOne',
    'coError.friendFew',
    'coError.friendMany',
  )
}

/** Check if a user is eligible for early access (referralCount >= threshold). */
export function isEligibleForEarlyAccess(referralCount: number): boolean {
  return referralCount >= EARLY_ACCESS_REFERRAL_THRESHOLD
}

/** Get an ISO timestamp string from a Firestore Timestamp or a string */
function getTimestampMs(
  value: { toMillis?: () => number } | string | null | undefined,
): number | null {
  if (!value) return null
  if (typeof value === 'object' && typeof value.toMillis === 'function') {
    return value.toMillis()
  }
  if (typeof value === 'string') {
    const parsed = new Date(value).getTime()
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}
