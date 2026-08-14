/**
 * Reduced-motion preference (manual override).
 *
 * The app already respects the OS `prefers-reduced-motion` media query via
 * `useReducedMotion()` and `withViewTransition()`. This module adds an
 * optional user-level override stored in localStorage so a user can force
 * reduced motion on (or off) from the Preferences page.
 *
 * - `getReducedMotion()` — resolves override first, falls back to the media query
 * - `setReducedMotionPreference(value)` — writes the override and notifies listeners
 * - The `<html data-reduced-motion>` attribute mirrors the resolved value so the
 *   global CSS can collapse animations (see `src/index.css`)
 */
import { readUserStateRaw, writeUserStateRaw } from './userState'

export const REDUCED_MOTION_KEY = 'yungwear-reduced-motion'
export const REDUCED_MOTION_EVENT = 'yungwear:reduced-motion-change'

export type ReducedMotionPreference = 'reduce' | 'no-preference' | null

export function readReducedMotionPreference(): ReducedMotionPreference {
  if (typeof window === 'undefined') return null

  const raw = readUserStateRaw(REDUCED_MOTION_KEY)
  if (raw === 'reduce' || raw === 'no-preference') return raw

  return null
}

/** Resolved preference: manual override wins, otherwise the OS media query. */
export function getReducedMotion(): boolean {
  const preference = readReducedMotionPreference()
  if (preference !== null) {
    return preference === 'reduce'
  }

  if (typeof window === 'undefined') return false

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function setReducedMotionPreference(value: boolean) {
  if (typeof window === 'undefined') return

  writeUserStateRaw(REDUCED_MOTION_KEY, value ? 'reduce' : 'no-preference')

  applyReducedMotionAttribute()
  window.dispatchEvent(new Event(REDUCED_MOTION_EVENT))
}

/** Mirrors the resolved preference onto `<html data-reduced-motion>`. */
export function applyReducedMotionAttribute() {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.reducedMotion = getReducedMotion() ? 'true' : 'false'
}

// Apply once on module load so the attribute is correct before first paint.
applyReducedMotionAttribute()
