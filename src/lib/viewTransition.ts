import { getReducedMotion } from './motionPrefs'

/**
 * Wraps a state-changing callback with the View Transitions API.
 *
 * - Skips entirely when reduced motion is active (OS preference or manual override)
 * - Uses `document.startViewTransition()` when available
 * - Falls back to a simple `requestAnimationFrame` callback
 * - Designed for catalog → product detail navigation
 *
 * Usage:
 * ```ts
 * withViewTransition(() => setStoreScreen('product'))
 * ```
 */
export function withViewTransition(callback: () => void): void {
  // Respect reduced motion — skip view transition entirely
  if (typeof window !== 'undefined' && getReducedMotion()) {
    callback()
    return
  }

  if (typeof document !== 'undefined' && 'startViewTransition' in document) {
    try {
      void (document as Document & { startViewTransition: (cb: () => void) => { finished: Promise<void> } })
        .startViewTransition(callback)
      return
    } catch {
      // View transition failed — fall through to RAF
    }
  }

  // Fallback for unsupported browsers
  requestAnimationFrame(callback)
}
