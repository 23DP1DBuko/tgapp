import { useCallback, useRef, useState } from 'react'

import { triggerHapticFeedback, triggerHapticNotification } from '../../lib/telegram/webApp'

export type TaskActionState = 'idle' | 'loading' | 'success' | 'error'

type TaskActionButtonProps = {
  /** Text shown in the idle (default) state — e.g. "Join & Verify" */
  idleLabel: string
  /**
   * Optional URL to open in a new tab **before** the verification simulation starts.
   * Use for tasks like "Subscribe to Channel" where the user must visit an external page first.
   */
  actionUrl?: string
  /**
   * Optional custom async verification function.
   * Should return `true` for success or `false` for failure.
   * If omitted, verification auto-succeeds after a 2s delay.
   */
  onVerify?: () => Promise<boolean>
  /** Optional callback fired when the task reaches the 'success' state */
  onSuccess?: () => void
  /** Optional override class for the idle state button */
  className?: string
  /** When true, the button stays permanently in its success/claimed visual */
  isAlreadyClaimed?: boolean
}

/**
 * A compact task-action button that manages a 4-state machine internally:
 *
 *   idle ──click──▶ loading ──verify──▶ success  (✓ CLAIMED)
 *                         └──fail───▶ error ──shake──▶ idle
 */
export function TaskActionButton({
  idleLabel,
  actionUrl,
  onVerify,
  onSuccess,
  className,
  isAlreadyClaimed,
}: TaskActionButtonProps) {
  const [state, setState] = useState<TaskActionState>(
    isAlreadyClaimed ? 'success' : 'idle',
  )
  const [shaking, setShaking] = useState(false)
  const verifyingRef = useRef(false)

  const handleClick = useCallback(async () => {
    // Guard: prevent double-triggers while loading
    if (verifyingRef.current || state === 'success') return
    verifyingRef.current = true

    // ── 1. Instant haptic pulse ──
    triggerHapticFeedback('light')

    // ── 2. Open external URL if provided (e.g. Telegram channel) ──
    if (actionUrl) {
      window.open(actionUrl, '_blank')
    }

    // ── 3. Switch to loading state ──
    setState('loading')

    try {
      // ── 4. Run verification (custom or auto-succeed after 2s) ──
      const ok = onVerify
        ? await onVerify()
        : await new Promise<boolean>((resolve) => {
            setTimeout(() => resolve(true), 2000)
          })

      if (ok) {
        // ── SUCCESS PATH ──
        triggerHapticNotification('success')
        setState('success')
        onSuccess?.()
      } else {
        // ── ERROR PATH ──
        throw new Error('verification_failed')
      }
    } catch {
      // ── ERROR: shake + reset ──
      triggerHapticNotification('error')
      setShaking(true)
      // Let the shake animation play (~500ms) then reset to idle
      await new Promise((resolve) => setTimeout(resolve, 500))
      setShaking(false)
      setState('idle')
    } finally {
      verifyingRef.current = false
    }
  }, [actionUrl, onVerify, onSuccess, state])

  // ── RENDER ──

  if (state === 'success') {
    return (
      <span
        className="shrink-0 rounded-xl bg-zinc-800/70 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400 transition-all duration-300"
        aria-disabled="true"
      >
        CLAIMED
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={state === 'loading'}
      className={`shrink-0 rounded-xl px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white transition-all duration-200 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-70 ${
        shaking ? 'shake' : ''
      } ${
        className ??
        'border border-white/12 bg-white/8 hover:bg-white/12'
      }`}
      aria-label={idleLabel}
    >
      {state === 'loading' ? (
        <span className="flex items-center justify-center gap-2">
          <svg
            className="h-3.5 w-3.5 animate-spin text-white"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="31.4 31.4"
              strokeDashoffset="0"
              className="opacity-30"
            />
            <path
              d="M12 2a10 10 0 019.95 9"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </span>
      ) : (
        idleLabel
      )}
    </button>
  )
}
