/**
 * Module-level translation helpers (no React).
 *
 * Kept in a separate file from `index.tsx` so the react-refresh lint rule
 * (components-only exports) stays happy. `LanguageProvider` keeps
 * `currentLanguage` in sync via `syncLanguage`, so `translate()` always
 * uses the latest language even outside React (e.g. in plain hooks).
 */
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  dictionaries,
  type Language,
  type TranslateParams,
  type TranslationKey,
} from './translations'
import { getTelegramWebAppState } from '../telegram/webApp'
import { readUserStateRaw } from '../userState'

let currentLanguage: Language = readInitialLanguage()

/**
 * Map a Telegram `language_code` (e.g. "en", "ru", "en-US") to a supported
 * language. Only the base language tag is compared; unsupported codes fall
 * back to the default (English) rather than guessing.
 */
function detectTelegramLanguage(): Language {
  try {
    const code = getTelegramWebAppState().user?.language_code
    if (!code) return DEFAULT_LANGUAGE
    const base = code.toLowerCase().split(/[-_]/)[0]
    if (base === 'ru') return 'ru'
    if (base === 'lv') return 'lv'
    return DEFAULT_LANGUAGE
  } catch {
    // Detection is best-effort — never crash startup over a missing user
    return DEFAULT_LANGUAGE
  }
}

function readInitialLanguage(): Language {
  // 1. An explicit choice in settings always wins (per-user key, M3).
  const stored = readUserStateRaw(LANGUAGE_STORAGE_KEY)
  if (stored === 'en' || stored === 'ru' || stored === 'lv') {
    return stored
  }
  // 2. First visit: auto-detect from the Telegram user's language.
  return detectTelegramLanguage()
}

/** The currently active language (kept in sync by LanguageProvider). */
export function getLanguage(): Language {
  return currentLanguage
}

/** Update the module-level language. Called by LanguageProvider. */
export function syncLanguage(language: Language): void {
  currentLanguage = language
}

/** Replace `{name}` placeholders in a translated template. */
export function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name]
    return value === undefined || value === null ? match : String(value)
  })
}

/** Translate a key in the currently active language (works outside React). */
export function translate(key: TranslationKey, params?: TranslateParams): string {
  const dict = dictionaries[currentLanguage] ?? dictionaries.en
  const template = dict[key] ?? dictionaries.en[key] ?? key
  return interpolate(template, params)
}

/**
 * Pick the grammatically correct plural form for `n` in the active language.
 * Russian uses one/few/many; English and Latvian use one/many.
 */
export function pickPlural(
  n: number,
  oneKey: TranslationKey,
  fewKey: TranslationKey,
  manyKey: TranslationKey,
): string {
  const lang = currentLanguage
  if (lang === 'ru') {
    const mod10 = n % 10
    const mod100 = n % 100
    if (mod10 === 1 && mod100 !== 11) return translate(oneKey)
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
      return translate(fewKey)
    }
    return translate(manyKey)
  }
  if (lang === 'lv') {
    if (n % 10 === 1 && n % 100 !== 11) return translate(oneKey)
    return translate(manyKey)
  }
  return n === 1 ? translate(oneKey) : translate(manyKey)
}
