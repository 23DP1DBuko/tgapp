import { useCallback, useRef, useState } from 'react'

type SwipeToDismissConfig = {
  /** Distance in px that triggers the dismiss (default 120) */
  threshold?: number
  /** Whether the swipe gesture is enabled */
  enabled?: boolean
  /** Called when the threshold is reached and pointer released */
  onDismiss: () => void
}

type SwipeToDismissResult = {
  /** Current swipe progress in px (0 = closed, >= threshold = dismiss) */
  swipeDistance: number
  /** Handlers to spread onto the target element */
  handlers: {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => void
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => void
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => void
    onPointerCancel: (event: React.PointerEvent<HTMLElement>) => void
  }
  /** Rest distance to 0 manually (e.g. after bounce-back animation) */
  reset: () => void
}

/**
 * Hook for downward swipe-to-dismiss gesture.
 *
 * - Tracks vertical swipe distance with resistance (1:1 up to threshold, then slower)
 * - Calls `onDismiss` when threshold is reached and pointer is released
 * - Returns `swipeDistance` for use in visual transforms/opacity
 * - Call `reset()` to snap the progress back to 0
 */
export function useSwipeToDismiss(config: SwipeToDismissConfig): SwipeToDismissResult {
  const { threshold = 120, enabled = true, onDismiss } = config
  const [swipeDistance, setSwipeDistance] = useState(0)
  const startYRef = useRef<number | null>(null)
  const activePointerRef = useRef<number | null>(null)

  const reset = useCallback(() => {
    setSwipeDistance(0)
  }, [])

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!enabled) return
      event.currentTarget.setPointerCapture(event.pointerId)
      activePointerRef.current = event.pointerId
      startYRef.current = event.clientY
    },
    [enabled],
  )

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!enabled || startYRef.current === null || activePointerRef.current !== event.pointerId) {
        return
      }

      const deltaY = event.clientY - startYRef.current
      if (deltaY <= 0) {
        setSwipeDistance(0)
        return
      }

      // Apply resistance: 1:1 up to threshold, then slower beyond
      const progress =
        deltaY <= threshold
          ? deltaY
          : threshold + (deltaY - threshold) * 0.3

      setSwipeDistance(progress)
    },
    [enabled, threshold],
  )

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!enabled) return
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      activePointerRef.current = null
      startYRef.current = null

      if (swipeDistance >= threshold) {
        setSwipeDistance(threshold)
        onDismiss()
      } else {
        setSwipeDistance(0)
      }
    },
    [enabled, swipeDistance, threshold, onDismiss],
  )

  const onPointerCancel = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      activePointerRef.current = null
      startYRef.current = null
      setSwipeDistance(0)
    },
    [],
  )

  return {
    swipeDistance,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
    reset,
  }
}
