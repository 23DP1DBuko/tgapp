/**
 * Wraps a state-changing callback with the View Transitions API.
 *
 * - Skips entirely when `prefers-reduced-motion: reduce` is active
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
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
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
