import { useCallback, useEffect, useRef } from 'react'

type MainButtonConfig = {
  text: string
  isVisible: boolean
  isEnabled: boolean
  isLoading: boolean
  color?: string
  textColor?: string
}

/**
 * Manages the Telegram native MainButton.
 *
 * - Shows/hides the MainButton based on `isVisible`
 * - Sets text, enabled/disabled, and loading/progress state
 * - Calls `onClick` when the user taps the main button
 * - Resets/hides on unmount
 * - Safe fallback outside Telegram
 */
export function useTelegramMainButton(
  config: MainButtonConfig,
  onClick: () => void,
) {
  const { text, isVisible, isEnabled, isLoading, color, textColor } = config
  const onClickRef = useRef(onClick)

  useEffect(() => {
    onClickRef.current = onClick
  }, [onClick])

  const stableOnClick = useCallback(() => {
    onClickRef.current()
  }, [])

  useEffect(() => {
    const tg = window.Telegram?.WebApp
    if (!tg?.MainButton) return

    const mb = tg.MainButton

    // Set text
    if (mb.text !== text) {
      mb.setText(text)
    }

    // Set colors if provided
    if (color && mb.color !== color) {
      mb.color = color
    }
    if (textColor && mb.textColor !== textColor) {
      mb.textColor = textColor
    }

    // Set enabled/disabled
    if (isEnabled) {
      mb.enable()
    } else {
      mb.disable()
    }

    // Set loading state
    if (isLoading) {
      mb.showProgress()
    } else {
      mb.hideProgress()
    }

    // Set visibility + click handler
    if (isVisible) {
      mb.show()
      mb.onClick(stableOnClick)
    } else {
      mb.hide()
      mb.offClick(stableOnClick)
    }

    return () => {
      const cleanup = window.Telegram?.WebApp?.MainButton
      if (!cleanup) return
      cleanup.hide()
      cleanup.offClick(stableOnClick)
      cleanup.hideProgress()
    }
  }, [text, isVisible, isEnabled, isLoading, color, textColor, stableOnClick])
}
