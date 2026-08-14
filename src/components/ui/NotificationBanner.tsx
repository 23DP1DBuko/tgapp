import { useEffect, useState } from 'react'

import { useI18n } from '../../lib/i18n'

type NotificationBannerProps = {
  message: string | null
  onClose: () => void
  durationMs?: number
}

export function NotificationBanner({
  message,
  onClose,
  durationMs = 4000,
}: NotificationBannerProps) {
  const { t } = useI18n()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!message) {
      setVisible(false)
      return
    }

    // Trigger enter animation on next frame
    const enterTimer = requestAnimationFrame(() => {
      setVisible(true)
    })

    let exitTimer: ReturnType<typeof setTimeout> | undefined

    // Schedule auto-dismiss
    const dismissTimer = setTimeout(() => {
      setVisible(false)

      exitTimer = setTimeout(() => {
        onClose()
      }, 300)
    }, durationMs)

    return () => {
      cancelAnimationFrame(enterTimer)
      clearTimeout(dismissTimer)
      clearTimeout(exitTimer)
    }
    // Intentionally omit onClose from deps — the closure captures the latest
    // stable setter (setNotification from useState), so stale closures are safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, durationMs])

  if (!message) {
    return null
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`overflow-hidden rounded-2xl border border-white/10 transition-all duration-300 ease-out ${
        visible
          ? 'max-h-24 translate-y-0 opacity-100'
          : 'max-h-0 -translate-y-2 opacity-0'
      }`}
    >
      <div className="flex items-start gap-3 bg-[linear-gradient(135deg,rgba(217,31,111,0.18),rgba(139,61,255,0.14))] px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.2)] backdrop-blur-xl">
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--shop-magenta)]"
          aria-hidden="true"
        >
          <g transform="translate(2, 2)">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
              clipRule="evenodd"
            />
          </g>
        </svg>
        <p className="flex-1 text-sm leading-5 text-white/90">{message}</p>
        <button
          type="button"
          onClick={() => {
            setVisible(false)
            setTimeout(() => {
              onClose()
            }, 300)
          }}
          className="-mr-1 -mt-1 rounded-full p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white/80"
          aria-label={t('notification.dismissAria')}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 shrink-0">
            <g transform="translate(4, 4)">
              <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z" />
            </g>
          </svg>
        </button>
      </div>
    </div>
  )
}
