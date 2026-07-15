import { useEffect } from 'react'
import type { ReactNode } from 'react'

import { useSwipeToDismiss } from '../../hooks/useSwipeToDismiss'

type SwipeablePanelProps = {
  children: ReactNode
  onDismiss: () => void
  /** Override dismiss threshold (default 120) */
  threshold?: number
  /** Whether swipe is enabled */
  enabled?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * Wraps any panel with a downward swipe-to-dismiss gesture.
 *
 * - Visual feedback: panel slides down + fades out as you swipe
 * - On dismiss: calls `onDismiss`
 * - Bounces back if you release before the threshold
 * - Respects `reduced-motion` by disabling the gesture
 */
export function SwipeablePanel({
  children,
  onDismiss,
  threshold = 120,
  enabled = true,
  className = '',
}: SwipeablePanelProps) {
  // Close on Escape key
  useEffect(() => {
    if (!enabled) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onDismiss()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [enabled, onDismiss])
  const { swipeDistance, handlers } = useSwipeToDismiss({
    threshold,
    enabled,
    onDismiss,
  })

  // Check for reduced motion preference
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (prefersReducedMotion || !enabled) {
    return <div className={className}>{children}</div>
  }

  const opacity = Math.max(0, 1 - swipeDistance / (threshold * 1.2))
  const translateY = Math.min(swipeDistance, threshold + 40)

  return (
    <div
      className={`touch-none ${className}`}
      style={{
        transform: `translateY(${translateY}px)`,
        opacity,
        transition: swipeDistance === 0
          ? 'transform 0.3s ease-out, opacity 0.3s ease-out'
          : 'none',
      }}
      {...handlers}
    >
      {/* Drag handle indicator at top */}
      <div className="mb-2 flex justify-center">
        <div className="h-1 w-8 rounded-full bg-white/20" />
      </div>
      {children}
    </div>
  )
}
