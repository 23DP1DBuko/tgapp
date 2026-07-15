import { useSyncExternalStore } from 'react'

/**
 * Subscribe to `prefers-reduced-motion: reduce` media query changes.
 * Returns `true` when the user prefers reduced motion.
 *
 * Uses `useSyncExternalStore` for tearing-free, concurrent-safe reads
 * that stay in sync with the latest OS accessibility setting.
 */
function subscribe(onStoreChange: () => void): () => void {
  const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
  mql.addEventListener('change', onStoreChange)
  return () => mql.removeEventListener('change', onStoreChange)
}

function getSnapshot(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function getServerSnapshot(): boolean {
  return false
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
