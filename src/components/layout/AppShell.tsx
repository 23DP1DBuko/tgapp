import type { ReactNode } from 'react'

type AppShellProps = {
  children: ReactNode
  title: string
  isTelegram: boolean
}

export function AppShell({ children, title, isTelegram }: AppShellProps) {
  return (
    <div className="min-h-screen text-[var(--shop-text)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-10%] top-12 h-56 w-56 rounded-full bg-[var(--shop-purple)]/20 blur-3xl" />
        <div className="absolute right-[-18%] top-40 h-72 w-72 rounded-full bg-[var(--shop-red)]/15 blur-3xl" />
        <div className="absolute bottom-24 left-1/3 h-44 w-44 rounded-full bg-[var(--shop-magenta)]/20 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-4">
        <header className="mb-4 flex items-center justify-between px-1">
          <h1 className="text-xl font-bold tracking-[-0.03em] text-[var(--shop-cream)]">
            {title}
          </h1>
          {import.meta.env.DEV ? (
            <span
              className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${
                isTelegram
                  ? 'bg-emerald-300/15 text-emerald-100'
                  : 'bg-white/8 text-[var(--shop-muted)]'
              }`}
            >
              {isTelegram ? 'Telegram' : 'Browser'}
            </span>
          ) : null}
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}