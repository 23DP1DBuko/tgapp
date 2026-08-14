import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import {
  LANGUAGE_STORAGE_KEY,
  dictionaries,
  type Language,
  type TranslateFn,
} from './translations'
import { getLanguage, interpolate, syncLanguage } from './translate'
import { writeUserStateRaw } from '../userState'

// ── React context ──

type I18nContextValue = {
  language: Language
  setLanguage: (language: Language) => void
  t: TranslateFn
}

const I18nContext = createContext<I18nContextValue | null>(null)

type LanguageProviderProps = {
  children: ReactNode
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>(getLanguage())

  const setLanguage = useCallback((next: Language) => {
    syncLanguage(next)
    writeUserStateRaw(LANGUAGE_STORAGE_KEY, next)
    setLanguageState(next)
  }, [])

  // Keep <html lang="..."> in sync for accessibility
  useEffect(() => {
    try {
      document.documentElement.lang = language
    } catch {
      // Ignore
    }
  }, [language])

  const t = useCallback<TranslateFn>(
    (key, params) => {
      const dict = dictionaries[language] ?? dictionaries.en
      const template = dict[key] ?? dictionaries.en[key] ?? key
      return interpolate(template, params)
    },
    [language],
  )

  const value = useMemo(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

/** Use inside any buyer-facing component to get the current language + t(). */
// The provider and hook intentionally live together; react-refresh's hook
// detection is not configured to allow custom hooks in this project.
// eslint-disable-next-line react-refresh/only-export-components
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error('useI18n must be used within a LanguageProvider')
  }
  return ctx
}
