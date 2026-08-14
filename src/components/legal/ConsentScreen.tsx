import { useCallback, useRef, useState } from 'react'

import { acceptTerms } from '../../lib/firebase/consent'
import { triggerHapticNotification } from '../../lib/telegram/webApp'
import { Button } from '../ui/Button'
import { LegalDocBody } from './LegalDocBody'
import { useI18n } from '../../lib/i18n'

type ConsentScreenProps = {
  initData: string
  /** True when the consent status could not be verified (M5 fail-closed notice). */
  checkFailed?: boolean
  onAccepted: () => void
  onOpenPrivacy: () => void
  onOpenTerms: () => void
}

/**
 * First-login consent screen.
 * Shows GDPR-required consent with a non-prechecked checkbox.
 * Saves `hasAcceptedTerms: true` + `acceptedAt` to Firestore via Cloud Function.
 */
export function ConsentScreen({
  initData,
  checkFailed = false,
  onAccepted,
  onOpenPrivacy,
  onOpenTerms,
}: ConsentScreenProps) {
  const { t } = useI18n()
  const [isAccepted, setIsAccepted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Legal docs open INSIDE the sheet (readable) instead of navigating the
  // blurred background the sheet covers — so users can actually read the
  // terms/privacy text before accepting. Single Back button at the bottom plus
  // a floating down-arrow that jumps to it.
  const [legalView, setLegalView] = useState<'privacy' | 'terms' | null>(null)
  const legalScrollRef = useRef<HTMLDivElement>(null)

  const handleSubmit = useCallback(async () => {
    if (!isAccepted || isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    try {
      const result = await acceptTerms(initData)

      if (result.ok && result.hasAcceptedTerms) {
        triggerHapticNotification('success')
        onAccepted()
      } else {
        setError(result.reason ?? t('consent.failedSave'))
        triggerHapticNotification('error')
      }
    } catch {
      setError(t('consent.error'))
      triggerHapticNotification('error')
    } finally {
      setIsSubmitting(false)
    }
  }, [isAccepted, isSubmitting, initData, onAccepted, t])

  return (
    <div className="fixed inset-0 z-[100] flex h-[100dvh] items-end justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md animate-[fade-slide-in_0.4s_ease-out] rounded-t-[32px] border-t border-white/10 bg-[linear-gradient(180deg,rgba(28,14,34,0.98),rgba(18,10,24,0.98))] shadow-[0_-18px_60px_rgba(0,0,0,0.5)]">
      {legalView ? (
        /* ── Legal reading view (inside the sheet) ── */
        <div
          ref={legalScrollRef}
          className="max-h-[92dvh] overflow-y-auto px-5 pb-8 pt-6 [scrollbar-width:none]"
        >
          <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" />
          <h2 className="mb-4 text-center text-lg font-bold tracking-[-0.03em] text-[var(--shop-cream)]">
            {legalView === 'privacy' ? t('legal.privacyTitle') : t('legal.termsTitle')}
          </h2>
          <div className="space-y-5 text-sm leading-6 text-zinc-300">
            <LegalDocBody doc={legalView} />
          </div>
          <Button
            onClick={() => setLegalView(null)}
            variant="primary"
            size="lg"
            fullWidth
            className="mt-6"
          >
            {t('legal.back')}
          </Button>

          {/* Floating down-arrow: jumps to the bottom, where the Back button lives */}
          <button
            type="button"
            onClick={() =>
              legalScrollRef.current?.scrollTo({
                top: legalScrollRef.current.scrollHeight,
                behavior: 'smooth',
              })
            }
            aria-label="Scroll to bottom"
            className="sticky bottom-4 mt-3 ml-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/60 text-[var(--shop-cream)] shadow-[0_8px_24px_rgba(0,0,0,0.4)] backdrop-blur-sm transition-colors hover:bg-black/80 active:scale-95"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path fillRule="evenodd" d="M12.53 16.28a.75.75 0 01-1.06 0l-5.5-5.5a.75.75 0 011.06-1.06L12 14.69l4.97-4.97a.75.75 0 111.06 1.06l-5.5 5.5z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="px-5 pb-8 pt-6">
        {/* Handle bar */}
        <div className="mx-auto mb-6 h-1 w-10 rounded-full bg-white/20" />

        {/* Icon */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--shop-purple)]/20">
          <svg
            viewBox="0 0 24 24"
            className="h-8 w-8 shrink-0 text-[var(--shop-purple)]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>

        {/* Title */}
        <h2 className="text-center text-xl font-bold tracking-[-0.03em] text-[var(--shop-cream)]">
          {t('consent.welcome')}
        </h2>
        <p className="mt-2 text-center text-sm leading-6 text-zinc-400">
          {t('consent.body')}
        </p>

        {/* Verification-failed notice (fail-closed, M5) */}
        {checkFailed && (
          <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/12 px-4 py-3">
            <p className="text-sm leading-5 text-amber-100">{t('consent.checkError')}</p>
          </div>
        )}

        {/* Consent text */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm leading-6 text-zinc-300">
            {t('consent.agree')}{' '}
            <button
              type="button"
              onClick={() => {
                onOpenPrivacy()
                setLegalView('privacy')
              }}
              className="font-semibold underline decoration-[var(--shop-purple)]/50 hover:decoration-[var(--shop-purple)] text-[var(--shop-cream)]"
            >
              {t('consent.privacy')}
            </button>{' '}
            {t('consent.agreeAnd')}{' '}
            <button
              type="button"
              onClick={() => {
                onOpenTerms()
                setLegalView('terms')
              }}
              className="font-semibold underline decoration-[var(--shop-purple)]/50 hover:decoration-[var(--shop-purple)] text-[var(--shop-cream)]"
            >
              {t('consent.terms')}
            </button>.
          </p>
        </div>

        {/* Checkbox - NOT prechecked */}
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/6 px-4 py-4 transition-colors hover:bg-white/10">
          <div className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
            <input
              type="checkbox"
              checked={isAccepted}
              onChange={(e) => setIsAccepted(e.target.checked)}
              className="peer sr-only"
              aria-label={t('consent.ariaAccept')}
            />
            <div
              className={`h-5 w-5 rounded-md border-2 transition-all duration-200 ${
                isAccepted
                  ? 'border-[var(--shop-purple)] bg-[var(--shop-purple)]'
                  : 'border-white/20 bg-transparent'
              }`}
            >
              {isAccepted && (
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-full w-full text-white"
                  aria-hidden="true"
                >
                  <g transform="translate(2, 2)">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </g>
                </svg>
              )}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--shop-cream)]">
              {t('consent.accept')}
            </p>
            <p className="mt-1 text-[10px] leading-4 text-zinc-500">
              {t('consent.required')}
            </p>
          </div>
        </label>

        {/* Error message */}
        {error && (
          <div className="mt-3 rounded-2xl bg-[var(--shop-red)]/16 px-4 py-3">
            <p className="text-sm text-[var(--shop-cream)]">{error}</p>
          </div>
        )}

        {/* Submit button */}
        <Button
          onClick={handleSubmit}
          disabled={!isAccepted}
          loading={isSubmitting}
          variant="primary"
          size="lg"
          fullWidth
          className="mt-5"
        >
          {isSubmitting ? t('consent.saving') : t('consent.continue')}
        </Button>
        </div>
      )}
      </div>
    </div>
  )
}
