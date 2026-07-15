import { useCallback, useEffect, useRef } from 'react'

/**
 * Manages the Telegram native BackButton.
 *
 * - Shows the BackButton when `isVisible` is true
 * - Calls `onBack` when the user taps the native back button
 * - Hides the BackButton on unmount or when not needed
 * - Only operates inside a real Telegram WebApp (safe fallback outside)
 */
export function useTelegramBackButton(isVisible: boolean, onBack: () => void) {
  const onBackRef = useRef(onBack)

  useEffect(() => {
    onBackRef.current = onBack
  }, [onBack])

  const stableOnBack = useCallback(() => {
    onBackRef.current()
  }, [])

  useEffect(() => {
    const tg = window.Telegram?.WebApp
    if (!tg?.BackButton) return

    if (isVisible) {
      tg.BackButton.show()
      tg.BackButton.onClick(stableOnBack)
    } else {
      tg.BackButton.hide()
      tg.BackButton.offClick(stableOnBack)
    }

    return () => {
      tg.BackButton?.hide()
      tg.BackButton?.offClick(stableOnBack)
    }
  }, [isVisible, stableOnBack])
}
