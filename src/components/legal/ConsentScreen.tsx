import { useCallback, useState } from 'react'

import { acceptTerms } from '../../lib/firebase/consent'
import { triggerHapticNotification } from '../../lib/telegram/webApp'
import { Button } from '../ui/Button'

type ConsentScreenProps = {
  initData: string
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
  onAccepted,
  onOpenPrivacy,
  onOpenTerms,
}: ConsentScreenProps) {
  const [isAccepted, setIsAccepted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        setError(result.reason ?? 'Failed to save consent. Please try again.')
        triggerHapticNotification('error')
      }
    } catch {
      setError('Something went wrong. Please try again.')
      triggerHapticNotification('error')
    } finally {
      setIsSubmitting(false)
    }
  }, [isAccepted, isSubmitting, initData, onAccepted])

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md animate-[fade-slide-in_0.4s_ease-out] rounded-t-[32px] border-t border-white/10 bg-[linear-gradient(180deg,rgba(28,14,34,0.98),rgba(18,10,24,0.98))] px-5 pb-8 pt-6 shadow-[0_-18px_60px_rgba(0,0,0,0.5)]">
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
          Welcome to YungWear
        </h2>
        <p className="mt-2 text-center text-sm leading-6 text-zinc-400">
          Before you start browsing, we need your consent to process your data in
          accordance with our policies.
        </p>

        {/* Consent text */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm leading-6 text-zinc-300">
            By continuing, you agree to the processing of your personal data as described
            in our{' '}
            <button
              type="button"
              onClick={onOpenPrivacy}
              className="font-semibold underline decoration-[var(--shop-purple)]/50 hover:decoration-[var(--shop-purple)] text-[var(--shop-cream)]"
            >
              Privacy Policy
            </button>{' '}
            and you accept our{' '}
            <button
              type="button"
              onClick={onOpenTerms}
              className="font-semibold underline decoration-[var(--shop-purple)]/50 hover:decoration-[var(--shop-purple)] text-[var(--shop-cream)]"
            >
              Terms of Service
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
              aria-label="I accept the Privacy Policy and Terms of Service"
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
              I accept the Privacy Policy and Terms of Service
            </p>
            <p className="mt-1 text-[10px] leading-4 text-zinc-500">
              Required to use the app. You can withdraw consent at any time via the app
              settings.
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
          {isSubmitting ? 'Saving...' : 'Continue'}
        </Button>
      </div>
    </div>
  )
}
