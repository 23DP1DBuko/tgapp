import { useSyncExternalStore } from 'react'

import {
  getReducedMotion,
  REDUCED_MOTION_EVENT,
} from '../lib/motionPrefs'

/**
 * Resolved `prefers-reduced-motion` state.
 * Returns `true` when the user prefers reduced motion.
 *
 * The value is the manual override from the Preferences page (localStorage)
 * when set, otherwise the OS media query. Reactively updates on either change.
 */
function subscribe(onStoreChange: () => void): () => void {
  const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
  mql.addEventListener('change', onStoreChange)
  window.addEventListener(REDUCED_MOTION_EVENT, onStoreChange)
  return () => {
    mql.removeEventListener('change', onStoreChange)
    window.removeEventListener(REDUCED_MOTION_EVENT, onStoreChange)
  }
}

function getSnapshot(): boolean {
  return getReducedMotion()
}

function getServerSnapshot(): boolean {
  return false
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
