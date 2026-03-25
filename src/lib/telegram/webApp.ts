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

export function getTelegramWebAppState(): TelegramWebAppState {
  const webApp = window.Telegram?.WebApp

  webApp?.ready()

  return {
    isTelegram: Boolean(webApp),
    user: webApp?.initDataUnsafe?.user,
    theme: {
      ...fallbackTheme,
      ...webApp?.themeParams,
    },
  }
}
