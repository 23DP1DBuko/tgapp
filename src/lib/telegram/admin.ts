import type { TelegramUser } from './webApp'

function readAdminIds(): number[] {
  const rawValue = import.meta.env.VITE_TELEGRAM_ADMIN_IDS ?? ''

  return rawValue
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0)
}

export function canAccessAdminPanel(user?: TelegramUser): boolean {
  const allowBrowserAdmin = import.meta.env.VITE_ENABLE_ADMIN_IN_BROWSER === 'true'

  if (!user) {
    return allowBrowserAdmin
  }

  const adminIds = readAdminIds()

  return adminIds.includes(user.id)
}
