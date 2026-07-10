import type { TelegramUser } from './webApp'

const DEFAULT_VERIFY_TELEGRAM_ADMIN_URL = '/api/verifyTelegramAdmin'

export type VerifyTelegramAdminResponse = {
  ok: boolean
  isAdmin: boolean
  telegramUserId: number | null
  reason:
    | 'verified_admin'
    | 'verified_non_admin'
    | 'invalid_init_data'
    | 'expired_init_data'
    | 'missing_bot_token'
    | 'invalid_method'
}

export type AdminAccessDebugState = {
  mode: 'browser_fallback' | 'telegram_verified' | 'telegram_denied' | 'telegram_error' | 'missing_context'
  reason: string
  telegramUserId: number | null
  endpoint: string
}

function isLocalDevBrowser(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  return (
    import.meta.env.DEV &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  )
}

function readVerifyAdminUrl(): string {
  return import.meta.env.VITE_VERIFY_TELEGRAM_ADMIN_URL || DEFAULT_VERIFY_TELEGRAM_ADMIN_URL
}

export function canUseBrowserAdminFallback(): boolean {
  const allowBrowserAdmin = import.meta.env.VITE_ENABLE_ADMIN_IN_BROWSER === 'true'

  return allowBrowserAdmin && isLocalDevBrowser()
}

export async function verifyTelegramAdminAccess(
  initData: string,
  user?: TelegramUser,
): Promise<AdminAccessDebugState> {
  const endpoint = readVerifyAdminUrl()

  if (!user || !initData) {
    return {
      mode: 'missing_context',
      reason: !user ? 'missing_user' : 'missing_init_data',
      telegramUserId: user?.id ?? null,
      endpoint,
    }
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ initData }),
  })

  if (!response.ok) {
    let reason = `http_${response.status}`

    try {
      const result = (await response.json()) as Partial<VerifyTelegramAdminResponse>
      if (typeof result.reason === 'string') {
        reason = result.reason
      }
    } catch {
      // Keep the HTTP status reason fallback.
    }

    return {
      mode: 'telegram_error',
      reason,
      telegramUserId: user.id,
      endpoint,
    }
  }

  const result = (await response.json()) as VerifyTelegramAdminResponse

  if (result.ok && result.isAdmin && result.telegramUserId === user.id) {
    return {
      mode: 'telegram_verified',
      reason: result.reason,
      telegramUserId: result.telegramUserId,
      endpoint,
    }
  }

  return {
    mode: result.ok ? 'telegram_denied' : 'telegram_error',
    reason: result.reason,
    telegramUserId: result.telegramUserId,
    endpoint,
  }
}

