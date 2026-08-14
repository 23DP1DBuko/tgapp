import type { Language } from './translations'

/** Map an app language to the matching Intl locale tag for date formatting. */
export function tLocale(language: Language): string {
  switch (language) {
    case 'ru':
      return 'ru-RU'
    case 'lv':
      return 'lv-LV'
    default:
      return 'en-GB'
  }
}

/** Full date + time in the selected language, e.g. "21 Apr 2026, 14:30". */
export function formatDateTime(language: Language, date: Date): string {
  return new Intl.DateTimeFormat(tLocale(language), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

/**
 * Short drop-date label without the year, e.g. "21 Apr" / "21 апр." / "21. apr.".
 * The trailing period some locales append to the month is stripped for a
 * cleaner inline label.
 */
export function formatDropDate(language: Language, date: Date): string {
  return new Intl.DateTimeFormat(tLocale(language), {
    day: '2-digit',
    month: 'short',
  })
    .format(date)
    .replace(/\./g, '')
}
