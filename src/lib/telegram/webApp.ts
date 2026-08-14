export type TelegramUser = {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
}

export type TelegramThemeParams = {
  bg_color?: string
  text_color?: string
  hint_color?: string
  link_color?: string
  button_color?: string
  button_text_color?: string
  secondary_bg_color?: string
}

export type TelegramWebAppState = {
  isTelegram: boolean
  initData: string
  user?: TelegramUser
  theme: TelegramThemeParams
}

const fallbackTheme: Required<TelegramThemeParams> = {
  bg_color: '#f5f1ea',
  text_color: '#18181b',
  hint_color: '#6b7280',
  link_color: '#8b5e3c',
  button_color: '#111827',
  button_text_color: '#f9fafb',
  secondary_bg_color: '#ebe4d8',
}

// Augment the global Telegram types to include the HapticFeedback API
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready(): void
        initData?: string
        initDataUnsafe?: {
          user?: TelegramUser
        }
        colorScheme?: 'light' | 'dark'
        themeParams?: TelegramThemeParams
        HapticFeedback?: {
          impactOccurred(
            style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft',
          ): void
          notificationOccurred(type: 'error' | 'success' | 'warning'): void
          selectionChanged(): void
        }
        disableVerticalSwipes(): void
        enableVerticalSwipes(): void
        onEvent(eventType: string, callback: (event?: Record<string, unknown>) => void): void
        offEvent(eventType: string, callback: (event?: Record<string, unknown>) => void): void
        BackButton?: {
          isVisible: boolean
          show(): void
          hide(): void
          onClick(callback: () => void): void
          offClick(callback: () => void): void
        }
        openTelegramLink?: (url: string) => void
        MainButton?: {
          isVisible: boolean
          isActive: boolean
          isProgressVisible: boolean
          text: string
          color: string
          textColor: string
          show(): void
          hide(): void
          enable(): void
          disable(): void
          showProgress(): void
          hideProgress(): void
          setText(text: string): void
          onClick(callback: () => void): void
          offClick(callback: () => void): void
        }
      }
    }
  }
}

export function isDevMockEnabled(): boolean {
  return (
    import.meta.env.DEV &&
    import.meta.env.VITE_ENABLE_ADMIN_IN_BROWSER === 'true' &&
    !!import.meta.env.VITE_DEV_TELEGRAM_USER_ID
  )
}

function getDevMockState(): TelegramWebAppState {
  const userId = Number(import.meta.env.VITE_DEV_TELEGRAM_USER_ID) || 12345
  const username = import.meta.env.VITE_DEV_TELEGRAM_USERNAME?.trim() || 'dev_user'
  const firstName = import.meta.env.VITE_DEV_TELEGRAM_FIRST_NAME?.trim() || 'Dev'
  const languageCode =
    import.meta.env.VITE_DEV_TELEGRAM_LANGUAGE_CODE?.trim() || undefined

  return {
    isTelegram: true,
    initData: `dev_mock_user=${userId}`,
    user: {
      id: userId,
      first_name: firstName,
      username,
      ...(languageCode ? { language_code: languageCode } : {}),
    },
    theme: fallbackTheme,
  }
}

export function getTelegramWebAppState(): TelegramWebAppState {
  // Dev mode: return mock Telegram data from env vars
  if (isDevMockEnabled()) {
    return getDevMockState()
  }

  const webApp = window.Telegram?.WebApp

  webApp?.ready()

  return {
    isTelegram: Boolean(webApp),
    initData: webApp?.initData ?? '',
    user: webApp?.initDataUnsafe?.user,
    theme: {
      ...fallbackTheme,
      ...webApp?.themeParams,
    },
  }
}

export function triggerHapticFeedback(
  style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'light',
) {
  try {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(style)
  } catch {
    // Haptics are a progressive enhancement — ignore in dev/unsupported env
  }
}

export function triggerHapticNotification(
  type: 'error' | 'success' | 'warning',
) {
  try {
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred(type)
  } catch {
    // Haptics are a progressive enhancement
  }
}

export function triggerHapticSelection() {
  try {
    window.Telegram?.WebApp?.HapticFeedback?.selectionChanged()
  } catch {
    // Haptics are a progressive enhancement
  }
}

export function disableVerticalSwipes() {
  try {
    window.Telegram?.WebApp?.disableVerticalSwipes()
  } catch {
    // Progressive enhancement
  }
}

export function enableVerticalSwipes() {
  try {
    window.Telegram?.WebApp?.enableVerticalSwipes()
  } catch {
    // Progressive enhancement
  }
}

/**
 * Open an external link (giveaway task link/channel) Telegram-natively when
 * available, falling back to a new browser tab. `@channel` and bare names
 * become t.me links; full http(s) URLs open directly.
 *
 * Returns false when nothing could be opened (empty value or a blocked
 * popup), so callers can fall back to verifying immediately.
 */
export function openExternalLink(raw: string): boolean {
  const value = raw.trim()
  if (!value) return false
  const url = /^https?:\/\//i.test(value)
    ? value
    : value.startsWith('@')
      ? `https://t.me/${value.slice(1)}`
      : `https://t.me/${value}`
  try {
    const webApp = window.Telegram?.WebApp
    if (typeof webApp?.openTelegramLink === 'function') {
      webApp.openTelegramLink(url)
      return true
    }
  } catch {
    // Fall through to window.open
  }
  const win = window.open(url, '_blank', 'noopener')
  return win !== null
}
