import { useCallback, useEffect, useRef, useState } from 'react'

type SwipeAxis = 'y' | 'x'

type SwipeToDismissConfig = {
  /** Swipe axis: 'y' = downward dismiss (panels), 'x' = leftward dismiss (rows) */
  axis?: SwipeAxis
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
 * Hook for swipe-to-dismiss gestures.
 *
 * - `axis: 'y'` — downward swipe (panels): tracks vertical progress with resistance
 *   (1:1 up to threshold, then slower), calls `onDismiss` when the threshold is
 *   reached on release. The pointer is claimed lazily — only after the gesture
 *   is confirmed as a downward drag — so nested horizontal gestures (e.g. cart
 *   rows inside the panel) are never hijacked.
 * - `axis: 'x'` — leftward swipe (list rows, e.g. cart items): tracks horizontal
 *   progress, ignores gestures that are more vertical than horizontal so native
 *   scrolling still works. Expects `touch-action: pan-y` on the target element and
 *   does not capture the pointer, so a window-level `pointerup` finishes the gesture.
 *
 * In both modes the item stays put unless the swipe passes the threshold.
 * Returns `swipeDistance` for visual transforms/opacity and `reset()` to snap back.
 */

/** Minimum downward movement before the y-axis claims the pointer. */
const Y_AXIS_CLAIM_DELTA = 6

export function useSwipeToDismiss(config: SwipeToDismissConfig): SwipeToDismissResult {
  const { axis = 'y', threshold = 120, enabled = true, onDismiss } = config
  const [swipeDistance, setSwipeDistance] = useState(0)
  const startXRef = useRef<number | null>(null)
  const startYRef = useRef<number | null>(null)
  const activePointerRef = useRef<number | null>(null)
  const capturedRef = useRef(false)
  const distanceRef = useRef(0)

  const finish = useCallback(() => {
    if (activePointerRef.current === null) return
    activePointerRef.current = null
    startXRef.current = null
    startYRef.current = null
    capturedRef.current = false

    const distance = distanceRef.current
    distanceRef.current = 0

    if (distance >= threshold) {
      setSwipeDistance(threshold)
      onDismiss()
    } else {
      setSwipeDistance(0)
    }
  }, [threshold, onDismiss])

  const cancel = useCallback(() => {
    activePointerRef.current = null
    startXRef.current = null
    startYRef.current = null
    capturedRef.current = false
    distanceRef.current = 0
    setSwipeDistance(0)
  }, [])

  const reset = useCallback(() => {
    distanceRef.current = 0
    setSwipeDistance(0)
  }, [])

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!enabled) return
      // No pointer capture here — it would steal every gesture from child
      // elements (e.g. horizontal cart-row swipes). Capture happens lazily in
      // onPointerMove once the drag is confirmed to match this axis.
      activePointerRef.current = event.pointerId
      startXRef.current = event.clientX
      startYRef.current = event.clientY
    },
    [enabled],
  )

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!enabled || activePointerRef.current !== event.pointerId) return
      if (startXRef.current === null || startYRef.current === null) return

      if (axis === 'y') {
        const deltaY = event.clientY - startYRef.current
        const absDeltaX = Math.abs(event.clientX - startXRef.current)

        // Only claim clearly downward gestures. A horizontal or still-ambiguous
        // move must stay with its own handlers (e.g. a cart row inside the panel).
        if (deltaY <= Y_AXIS_CLAIM_DELTA || deltaY <= absDeltaX) {
          distanceRef.current = 0
          setSwipeDistance(0)
          return
        }

        // Claim the pointer on the first confirmed downward move so the drag
        // keeps tracking even when the finger leaves the panel.
        if (!capturedRef.current) {
          event.currentTarget.setPointerCapture(event.pointerId)
          capturedRef.current = true
        }

        // Apply resistance: 1:1 up to threshold, then slower beyond
        const progress =
          deltaY <= threshold
            ? deltaY
            : threshold + (deltaY - threshold) * 0.3

        distanceRef.current = progress
        setSwipeDistance(progress)
        return
      }

      // 'x' axis: only track leftward swipes that are more horizontal than vertical
      const deltaX = startXRef.current - event.clientX // positive = swiping left
      const absDeltaY = Math.abs(event.clientY - startYRef.current)

      if (deltaX <= 0 || deltaX < absDeltaY) {
        distanceRef.current = 0
        setSwipeDistance(0)
        return
      }

      const progress =
        deltaX <= threshold
          ? deltaX
          : threshold + (deltaX - threshold) * 0.3

      distanceRef.current = progress
      setSwipeDistance(progress)
    },
    [enabled, axis, threshold],
  )

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!enabled || activePointerRef.current !== event.pointerId) return
      if (axis === 'y' && capturedRef.current && event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      finish()
    },
    [enabled, axis, finish],
  )

  const onPointerCancel = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!enabled) return
      if (axis === 'y' && capturedRef.current && event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      cancel()
    },
    [enabled, axis, cancel],
  )

  // For the x-axis the pointer is not captured, so also end the gesture when the
  // pointer is released anywhere on the window (it may leave the element mid-swipe).
  useEffect(() => {
    if (axis !== 'x' || !enabled) return

    function handleWindowUp() {
      finish()
    }

    function handleWindowCancel() {
      cancel()
    }

    window.addEventListener('pointerup', handleWindowUp)
    window.addEventListener('pointercancel', handleWindowCancel)
    return () => {
      window.removeEventListener('pointerup', handleWindowUp)
      window.removeEventListener('pointercancel', handleWindowCancel)
    }
  }, [axis, enabled, finish, cancel])

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
