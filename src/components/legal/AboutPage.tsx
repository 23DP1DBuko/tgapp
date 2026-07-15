import { Button } from '../ui/Button'

type AboutPageProps = {
  onBack: () => void
  onOpenPrivacy: () => void
  onOpenTerms: () => void
}

export function AboutPage({ onBack, onOpenPrivacy, onOpenTerms }: AboutPageProps) {
  return (
    <div className="overflow-y-auto touch-pan-y max-h-dvh pb-24 [scrollbar-width:none]">
      <article className="rounded-[32px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        {/* Header */}
        <div className="mb-6">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
            About
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[var(--shop-cream)]">
            YungWear
          </h2>
        </div>

        <div className="space-y-5 text-sm leading-6 text-zinc-300">
          {/* Description */}
          <section>
            <p>
              YungWear is a personal streetwear project focused on limited drops, one-of-one
              pieces, and community-driven releases. This Mini App lets you browse items,
              submit order requests, participate in giveaways, and earn rewards.
            </p>
            <p className="mt-3 text-xs leading-5 text-zinc-500">
              Items listed are personal belongings (e.g. used or unworn clothing) offered for
              sale via Depop/Yaga or by direct arrangement. The operator is a private
              individual, not a registered business.
            </p>
          </section>

          {/* Contact */}
          <section className="rounded-2xl border border-white/10 bg-black/15 p-4">
            <h3 className="mb-3 text-base font-semibold text-[var(--shop-cream)]">
              Contact
            </h3>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--shop-purple)]/20">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 shrink-0 text-[var(--shop-purple)]" aria-hidden="true">
                    <g transform="translate(2, 2)">
                      <path
                        fillRule="evenodd"
                        d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
                        clipRule="evenodd"
                      />
                    </g>
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    Telegram Support
                  </p>
                  <p className="text-sm font-semibold text-[var(--shop-cream)]">
                    Contact us via the Telegram bot
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-300/15">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 shrink-0 text-emerald-100" aria-hidden="true">
                    <g transform="translate(2, 2)">
                      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                    </g>
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    Data Requests
                  </p>
                  <p className="text-sm font-semibold text-[var(--shop-cream)]">
                    Reply to any broadcast or message the bot
                  </p>
                </div>
              </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-zinc-500">
              For privacy-related inquiries, data access requests, or deletion requests,
              please contact us via Telegram. We will respond within 30 days.
            </p>
          </section>

          {/* Legal links */}
          <section className="space-y-3">
            <h3 className="text-base font-semibold text-[var(--shop-cream)]">
              Legal
            </h3>
            <button
              type="button"
              onClick={onOpenPrivacy}
              className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-left text-sm text-zinc-300 transition-colors hover:bg-white/10"
            >
              <span>Privacy Policy</span>
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true">
                <g transform="translate(2, 2)">
                  <path
                    fillRule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clipRule="evenodd"
                  />
                </g>
              </svg>
            </button>
            <button
              type="button"
              onClick={onOpenTerms}
              className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-left text-sm text-zinc-300 transition-colors hover:bg-white/10"
            >
              <span>Terms of Service</span>
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true">
                <g transform="translate(2, 2)">
                  <path
                    fillRule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clipRule="evenodd"
                  />
                </g>
              </svg>
            </button>
          </section>

          {/* Operator status */}
          <section className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]">
              Operator
            </p>
            <p className="mt-2 text-xs leading-5 text-zinc-400">
              <strong className="text-zinc-300">Private individual</strong> — Latvia (European Union).
              This is a personal project, not a registered business. Items are sold as personal
              used/unworn goods through Depop, Yaga, or direct messaging.
            </p>
          </section>
        </div>

        {/* Back button */}
        <Button onClick={onBack} variant="primary" size="lg" fullWidth className="mt-6">
          ← Back
        </Button>
      </article>
    </div>
  )
}
