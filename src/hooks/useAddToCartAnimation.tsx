/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { useReducedMotion } from './useReducedMotion'

type FlyingDot = {
  id: number
  startX: number
  startY: number
}

type AddToCartAnimationContextValue = {
  /** Trigger the fly animation from a given client position */
  triggerAddToCartAnimation: (clientX: number, clientY: number) => void
}

const AddToCartAnimationContext = createContext<AddToCartAnimationContextValue>({
  triggerAddToCartAnimation: () => {},
})

export function useAddToCartAnimation() {
  return useContext(AddToCartAnimationContext)
}

let dotIdCounter = 0

/**
 * Provider that renders a portal at the root level for add-to-cart flying dots.
 *
 * Respects `prefers-reduced-motion: reduce` by rendering nothing when active.
 *
 * Usage:
 * ```tsx
 * <AddToCartAnimationProvider>
 *   <App />
 * </AddToCartAnimationProvider>
 * ```
 */
 
export function AddToCartAnimationProvider({ children }: { children: ReactNode }) {
  const reducedMotion = useReducedMotion()
  const [dots, setDots] = useState<FlyingDot[]>([])
  const cartButtonRef = useRef<DOMRect | null>(null)

  const triggerAddToCartAnimation = useCallback((clientX: number, clientY: number) => {
    const id = ++dotIdCounter

    // Get the cart button position (bottom-right area)
    const cartEl = document.querySelector('[aria-label*="Cart"]')
    if (cartEl) {
      cartButtonRef.current = cartEl.getBoundingClientRect()
    }

    setDots((prev) => [...prev, { id, startX: clientX, startY: clientY }])

    // Remove the dot after animation completes (500ms)
    setTimeout(() => {
      setDots((prev) => prev.filter((d) => d.id !== id))
    }, 500)
  }, [])

  return (
    <AddToCartAnimationContext.Provider value={{ triggerAddToCartAnimation }}>
      {children}

      {/* Portal overlay for flying dots — render nothing when reduced motion is active */}
      {!reducedMotion ? (
        <div className="pointer-events-none fixed inset-0 z-[9999]" style={{ touchAction: 'none' }}>
          {dots.map((dot) => {
            const targetX = cartButtonRef.current
              ? cartButtonRef.current.left + cartButtonRef.current.width / 2
              : window.innerWidth - 40
            const targetY = cartButtonRef.current
              ? cartButtonRef.current.top + cartButtonRef.current.height / 2
              : window.innerHeight - 60

            const deltaX = targetX - dot.startX
            const deltaY = targetY - dot.startY

            return (
              <div
                key={dot.id}
                className="absolute h-4 w-4 rounded-full bg-[var(--shop-purple)] shadow-[0_0_12px_rgba(139,61,255,0.6)]"
                style={{
                  left: dot.startX - 8,
                  top: dot.startY - 8,
                  animation: `fly-to-cart 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`,
                  ['--fly-dx' as string]: `${deltaX}px`,
                  ['--fly-dy' as string]: `${deltaY}px`,
                }}
                onAnimationEnd={() => {
                  setDots((prev) => prev.filter((d) => d.id !== dot.id))
                }}
              />
            )
          })}
        </div>
      ) : null}
    </AddToCartAnimationContext.Provider>
  )
}
