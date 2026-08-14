import { useI18n } from '../../lib/i18n'

type StoreControlsPanelProps = {
  telegramGateMessage: string | null
  telegramBotLink: string
  onCloseGate: () => void
}

export function StoreControlsPanel({
  telegramGateMessage,
  telegramBotLink,
  onCloseGate,
}: StoreControlsPanelProps) {
  const { t } = useI18n()

  if (!telegramGateMessage) {
    return null
  }

  return (
    <article className="rounded-[28px] border border-[var(--shop-red)]/20 bg-[var(--shop-red)]/12 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.2)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]">
            {t('gate.openInTelegram')}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--shop-muted)]">
            {telegramGateMessage}
          </p>
        </div>
        <button
          type="button"
          onClick={onCloseGate}
          className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]"
        >
          {t('gate.close')}
        </button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={telegramBotLink}
          target="_blank"
          rel="noreferrer"
          className="rounded-[22px] bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white"
        >
          {t('gate.openTelegram')}
        </a>
        <button
          type="button"
          onClick={onCloseGate}
          className="rounded-[22px] border border-white/10 bg-white/8 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)]"
        >
          {t('gate.keepBrowsing')}
        </button>
      </div>
    </article>
  )
}
