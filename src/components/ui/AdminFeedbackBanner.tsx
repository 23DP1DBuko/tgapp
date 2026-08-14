type AdminFeedbackBannerProps = {
  tone: 'success' | 'error'
  message: string
  onRetry?: () => void
  className?: string
}

/**
 * Shared feedback banner for admin panels. Unifies the success/error surface
 * that used to be hand-rolled in every panel (Product, Promo, Campaign,
 * Rewards, Broadcast, Orders). Optional `onRetry` re-runs the failed action.
 */
export function AdminFeedbackBanner({
  tone,
  message,
  onRetry,
  className = '',
}: AdminFeedbackBannerProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-2xl px-4 py-3 text-sm ${
        tone === 'success'
          ? 'bg-emerald-300/18 text-emerald-100'
          : 'bg-[var(--shop-red)]/18 text-[var(--shop-cream)]'
      } ${className}`}
    >
      <p>{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition-colors hover:bg-white/18"
        >
          Try Again
        </button>
      ) : null}
    </div>
  )
}
