type TelegramTheme = {
  bg_color?: string
  text_color?: string
  button_color?: string
  link_color?: string
}

type TelegramUser = {
  id?: number
  username?: string
  first_name?: string
  last_name?: string
}

type AdminStatusPanelProps = {
  isTelegram: boolean
  user: TelegramUser | undefined
  theme: TelegramTheme
  firebaseReady: boolean
  firebaseInitialized: boolean
  firestoreReady: boolean
}

export function AdminStatusPanel({
  isTelegram,
  user,
  theme,
  firebaseReady,
  firebaseInitialized,
  firestoreReady,
}: AdminStatusPanelProps) {
  return (
    <>
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
            {user?.id ?? 'Open the Mini App in Telegram to see it'}
          </p>
          <div className="grid grid-cols-2 gap-3 pt-2 text-sm">
            <ThemeChip label="bg" value={theme.bg_color} />
            <ThemeChip label="text" value={theme.text_color} />
            <ThemeChip label="button" value={theme.button_color} />
            <ThemeChip label="link" value={theme.link_color} />
          </div>
        </div>
      </article>

      <article className="rounded-[32px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
          Firebase
        </p>
        <div className="mt-4 space-y-3 text-sm text-[var(--shop-muted)]">
          <p>
            <span className="font-semibold text-[var(--shop-cream)]">Status:</span>{' '}
            {firebaseReady ? 'Environment variables found' : 'Environment variables missing'}
          </p>
          <p>
            <span className="font-semibold text-[var(--shop-cream)]">App:</span>{' '}
            {firebaseInitialized ? 'Firebase initialized' : 'Waiting for configuration'}
          </p>
          <p>
            <span className="font-semibold text-[var(--shop-cream)]">Firestore:</span>{' '}
            {firestoreReady ? 'Ready for product reads' : 'Waiting for Firebase config'}
          </p>
          <p className="text-[var(--shop-muted)]">
            Copy <code>.env.example</code> to <code>.env.local</code> and fill in your Firebase project values.
          </p>
        </div>
      </article>
    </>
  )
}

type ThemeChipProps = {
  label: string
  value?: string
}

function ThemeChip({ label, value }: ThemeChipProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/6 p-3 backdrop-blur">
      <p className="text-xs uppercase tracking-[0.24em] text-white/60">{label}</p>
      <div className="mt-2 flex items-center gap-3">
        <span
          className="h-5 w-5 rounded-full border border-white/15"
          style={{ backgroundColor: value ?? '#ffffff' }}
        />
        <span className="font-medium text-[var(--shop-cream)]">{value ?? 'n/a'}</span>
      </div>
    </div>
  )
}
