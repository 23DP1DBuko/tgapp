/**
 * Per-user client state (M3 — shared-device isolation).
 *
 * On a shared device the previous Telegram user's cart, likes, consent,
 * language, and motion preferences must never bleed into the next user's
 * session. Every per-user key is namespaced by the Telegram user id:
 *
 *   `yungwear-cart-items`        → `yungwear-cart-items-<telegramUserId>`
 *   `yungwear-consent-accepted`  → `yungwear-consent-accepted-<telegramUserId>`
 *   ...
 *
 * Legacy (un-namespaced) values from before this fix are migrated once to the
 * first user who reads them, then the global key is removed — so a second
 * user on the same device can never inherit them.
 */
import { getTelegramWebAppState } from './telegram/webApp'
import {
  hasStoredValue,
  readStoredRawValue,
  removeStoredValue,
  writeStoredRawValue,
} from './storage'

/**
 * The current Telegram user id. The identity never changes within a page
 * load (a Telegram Mini App webview is per-user), so it is resolved once at
 * module load. Returns null when unavailable (e.g. plain browser dev).
 */
const currentTelegramUserId: number | null = (() => {
  try {
    const id = getTelegramWebAppState().user?.id
    return typeof id === 'number' && Number.isFinite(id) ? id : null
  } catch {
    return null
  }
})()

/** Namespace a base key by the current user; falls back to the base key when no user is known. */
function userScopedStorageKey(baseKey: string): string {
  return currentTelegramUserId === null ? baseKey : `${baseKey}-${currentTelegramUserId}`
}

/**
 * Read a raw per-user value. When the namespaced key is absent but a legacy
 * (global) value exists, the legacy value is migrated to this user's key and
 * the global key is removed — it can never leak to another user afterwards.
 */
export function readUserStateRaw(baseKey: string): string | null {
  const scopedKey = userScopedStorageKey(baseKey)

  if (hasStoredValue(scopedKey)) {
    return readStoredRawValue(scopedKey)
  }

  const legacy = readStoredRawValue(baseKey)
  if (legacy !== null) {
    writeStoredRawValue(scopedKey, legacy)
    removeStoredValue(baseKey)
    return legacy
  }

  return null
}

/** Write a raw per-user value to the namespaced key. */
export function writeUserStateRaw(baseKey: string, value: string) {
  writeStoredRawValue(userScopedStorageKey(baseKey), value)
}

/** Read a JSON per-user value (see readUserStateRaw for migration semantics). */
export function readUserStateJson<T>(baseKey: string, fallback: T): T {
  const raw = readUserStateRaw(baseKey)
  if (raw === null) {
    return fallback
  }

  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/** Write a JSON per-user value to the namespaced key. */
export function writeUserStateJson<T>(baseKey: string, value: T) {
  writeUserStateRaw(baseKey, JSON.stringify(value))
}

/** Remove the current user's namespaced value (leaves other users' untouched). */
export function removeUserStateValue(baseKey: string) {
  removeStoredValue(userScopedStorageKey(baseKey))
}
