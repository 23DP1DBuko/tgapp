import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

type BottomSheetProps = {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  /** Optional max height as percentage of viewport (default 85) */
  maxHeightPct?: number
}

export function BottomSheet({
  isOpen,
  onClose,
  children,
  maxHeightPct = 85,
}: BottomSheetProps) {
  const [visible, setVisible] = useState(false)
  const [animating, setAnimating] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Drag-to-dismiss state
  const dragStartYRef = useRef<number | null>(null)
  const dragOffsetRef = useRef(0)
  const [dragTranslate, setDragTranslate] = useState(0)

  const duration = reducedMotion ? 0 : 300

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true)
      // Trigger enter animation on next frame
      const frame = requestAnimationFrame(() => {
        setAnimating(true)
      })
      return () => cancelAnimationFrame(frame)
    } else {
      setAnimating(false)
      const timer = setTimeout(() => {
        setVisible(false)
        setDragTranslate(0)
        dragOffsetRef.current = 0
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [isOpen, duration])

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handlePointerDown = useCallback(
    (clientY: number) => {
      dragStartYRef.current = clientY
    },
    [],
  )

  const handlePointerMove = useCallback(
    (clientY: number) => {
      if (dragStartYRef.current === null) return
      const delta = clientY - dragStartYRef.current
      if (delta < 0) {
        // Resist upward drag — add friction
        setDragTranslate(delta * 0.3)
        dragOffsetRef.current = delta * 0.3
      } else {
        setDragTranslate(delta)
        dragOffsetRef.current = delta
      }
    },
    [],
  )

  const handlePointerEnd = useCallback(() => {
    dragStartYRef.current = null
    if (dragOffsetRef.current > 120) {
      onClose()
    } else {
      setDragTranslate(0)
      dragOffsetRef.current = 0
    }
  }, [onClose])

  if (!visible && !isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      style={{ touchAction: 'none' }}
    >
      {/* Backdrop */}
      <div
        ref={backdropRef}
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity ${
          animating ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ transitionDuration: `${duration}ms` }}
      />

      {/* Sheet panel */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        className={`relative z-10 w-full max-w-md rounded-t-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(28,14,30,0.98),rgba(18,8,18,0.98))] shadow-[0_-12px_48px_rgba(0,0,0,0.4)] backdrop-blur-xl transition-transform ${
          animating ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{
          maxHeight: `${maxHeightPct}vh`,
          transform: animating
            ? `translateY(${dragTranslate}px)`
            : 'translateY(100%)',
          transitionDuration: reducedMotion ? '0ms' : '300ms',
          transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)',
        }}
        onPointerDown={(e) => {
          const target = e.target as HTMLElement
          // Only initiate drag from the drag handle or backdrop area
          if (target.closest('[data-sheet-drag-handle]')) {
            e.currentTarget.setPointerCapture(e.pointerId)
            handlePointerDown(e.clientY)
          }
        }}
        onPointerMove={(e) => {
          if (dragStartYRef.current === null) return
          handlePointerMove(e.clientY)
        }}
        onPointerUp={(e) => {
          if (dragStartYRef.current !== null) {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              e.currentTarget.releasePointerCapture(e.pointerId)
            }
            handlePointerEnd()
          }
        }}
        onPointerCancel={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId)
          }
          dragStartYRef.current = null
          setDragTranslate(0)
          dragOffsetRef.current = 0
        }}
      >
        {/* Drag handle */}
        <div
          data-sheet-drag-handle
          className="flex cursor-grab justify-center pt-3 pb-2 active:cursor-grabbing"
        >
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        {/* Scrollable content */}
        <div
          className="overflow-y-auto px-5 pb-6"
          style={{ maxHeight: `calc(${maxHeightPct}vh - 48px)` }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
