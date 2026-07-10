type TelegramUser = {
  id?: number
  username?: string
  first_name?: string
  last_name?: string
}

type AdminStatusPanelProps = {
  isTelegram: boolean
  user: TelegramUser | undefined
}

export function AdminStatusPanel({
  isTelegram,
  user,
}: AdminStatusPanelProps) {
  return (
    <article className="rounded-[32px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <p className="text-xs font-medium uppercase tracking-[0.32em] text-[var(--shop-muted)]">
        Session
      </p>
      <div className="mt-4 space-y-3 text-sm text-[var(--shop-muted)]">
        <p>
          <span className="font-semibold text-[var(--shop-cream)]">Runtime:</span>{' '}
          {isTelegram ? 'Telegram Mini App session' : 'Browser preview mode'}
        </p>
        <p>
          <span className="font-semibold text-[var(--shop-cream)]">User:</span>{' '}
          {user
            ? `${user.first_name ?? ''}${user.last_name ? ` ${user.last_name}` : ''}`.trim()
            : 'Telegram user data is not available yet'}
        </p>
        <p>
          <span className="font-semibold text-[var(--shop-cream)]">Username:</span>{' '}
          {user?.username ? `@${user.username}` : 'Not provided'}
        </p>
        <p>
          <span className="font-semibold text-[var(--shop-cream)]">Telegram ID:</span>{' '}
          {user?.id ?? 'Not available'}
        </p>
      </div>
    </article>
  )
}
