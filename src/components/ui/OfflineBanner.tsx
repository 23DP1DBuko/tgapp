import { useEffect, useState } from 'react'

import { useI18n } from '../../lib/i18n'

type OfflineBannerProps = {
  isOnline: boolean
  wasOffline: boolean
  onDismiss: () => void
}

export function OfflineBanner({
  isOnline,
  wasOffline,
  onDismiss,
}: OfflineBannerProps) {
  const { t } = useI18n()
  const [visible, setVisible] = useState(false)
  const [mode, setMode] = useState<'offline' | 'reconnected'>('offline')

  // Show offline banner immediately, show reconnected banner briefly
  useEffect(() => {
    if (!isOnline) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode('offline')
       
      setVisible(true)
    } else if (wasOffline) {
       
      setMode('reconnected')
       
      setVisible(true)

      const timer = setTimeout(() => {
        setVisible(false)
      }, 3000)

      return () => clearTimeout(timer)
    } else {
      setVisible(false)
    }
  }, [isOnline, wasOffline])

  if (!visible) return null

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`overflow-hidden rounded-2xl border transition-all duration-300 ease-out ${
        visible
          ? 'max-h-20 translate-y-0 opacity-100'
          : 'max-h-0 -translate-y-2 opacity-0'
      } ${
        mode === 'offline'
          ? 'border-amber-500/20 bg-amber-500/12'
          : 'border-emerald-500/20 bg-emerald-500/12'
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {mode === 'offline' ? (
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-4 w-4 shrink-0 text-amber-400"
            aria-hidden="true"
          >
            <g transform="translate(2, 2)">
              <path
                fillRule="evenodd"
                d="M8.34 1.58A.75.75 0 019 1.25h2a.75.75 0 01.66.33l5.75 8.63a.75.75 0 01-.66 1.17H3.25a.75.75 0 01-.66-1.17l5.75-8.63zM10 5a.75.75 0 01.75.75v3a.75.75 0 01-1.5 0v-3A.75.75 0 0110 5zm0 7.5a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </g>
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-4 w-4 shrink-0 text-emerald-400"
            aria-hidden="true"
          >
            <g transform="translate(2, 2)">
              <path
                fillRule="evenodd"
                d="M16.403 12.652a3 3 0 000-5.304 3 3 0 00-3.75-3.75 3 3 0 00-5.306 0 3 3 0 00-3.75 3.75 3 3 0 000 5.304 3 3 0 003.75 3.75 3 3 0 005.306 0 3 3 0 003.75-3.75zM10 5a1 1 0 011 1v3a1 1 0 11-2 0V6a1 1 0 011-1zm0 7.5a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </g>
          </svg>
        )}
        <p
          className={`flex-1 text-sm font-semibold ${
            mode === 'offline'
              ? 'text-amber-200'
              : 'text-emerald-200'
          }`}
        >
          {mode === 'offline'
            ? t('offline.offline')
            : t('offline.backOnline')}
        </p>
        <button
          type="button"
          onClick={() => {
            setVisible(false)
            onDismiss()
          }}
          className="rounded-full p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white/80"
          aria-label={t('offline.dismissAria')}
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
