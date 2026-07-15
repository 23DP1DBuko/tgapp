import { useEffect, useRef, useState } from 'react'

type CountUpProps = {
  /** The target value to animate to */
  value: number
  /** Duration in milliseconds (default 400) */
  duration?: number
  /** CSS classes for the span */
  className?: string
  /** Formatter function (default: toString) */
  format?: (value: number) => string
}

/**
 * Animates a numeric value from its previous value to a new value.
 *
 * - Uses `requestAnimationFrame` for smooth animation
 * - Skips animation if `prefers-reduced-motion: reduce` is set
 * - Only animates on mount if the value changed
 */
export function CountUp({
  value,
  duration = 400,
  className = '',
  format,
}: CountUpProps) {
  const [displayValue, setDisplayValue] = useState(value)
  const prevValueRef = useRef(value)
  const rafRef = useRef<number | null>(null)

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    const prevValue = prevValueRef.current
    if (prevValue === value || prefersReducedMotion) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplayValue(value)
      prevValueRef.current = value
      return
    }

    const startTime = performance.now()
    const delta = value - prevValue

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = prevValue + delta * eased

      setDisplayValue(Math.round(current))

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        setDisplayValue(value)
        prevValueRef.current = value
      }
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [value, duration, prefersReducedMotion])

  const formatted = format ? format(displayValue) : String(displayValue)

  return <span className={className}>{formatted}</span>
}
