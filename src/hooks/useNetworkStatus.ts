import { useCallback, useEffect, useRef, useState } from 'react'

export type NetworkStatus = {
  isOnline: boolean
  wasOffline: boolean
  clearWasOffline: () => void
}

/**
 * Tracks navigator.onLine state and provides a `wasOffline` flag
 * that stays true for a brief moment after coming back online.
 */
export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )
  const [wasOffline, setWasOffline] = useState(false)
  const wasOfflineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearWasOffline = useCallback(() => {
    setWasOffline(false)
  }, [])

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true)
      setWasOffline(true)

      // Auto-clear the "was offline" flag after 3 seconds
      if (wasOfflineTimerRef.current) {
        clearTimeout(wasOfflineTimerRef.current)
      }
      wasOfflineTimerRef.current = setTimeout(() => {
        setWasOffline(false)
        wasOfflineTimerRef.current = null
      }, 3000)
    }

    function handleOffline() {
      setIsOnline(false)
      // Cancel any pending "wasOffline" auto-clear timer
      if (wasOfflineTimerRef.current) {
        clearTimeout(wasOfflineTimerRef.current)
        wasOfflineTimerRef.current = null
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (wasOfflineTimerRef.current) {
        clearTimeout(wasOfflineTimerRef.current)
      }
    }
  }, [])

  return { isOnline, wasOffline, clearWasOffline }
}
