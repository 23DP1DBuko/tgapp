import type { ReactNode } from 'react'

type AppShellProps = {
  children: ReactNode
  title: string
  subtitle: string
  isTelegram: boolean
}

export function AppShell({
  children,
  title,
  subtitle,
  isTelegram,
}: AppShellProps) {
  return (
    <div className="min-h-screen text-[var(--shop-text)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-10%] top-12 h-56 w-56 rounded-full bg-[var(--shop-purple)]/20 blur-3xl" />
        <div className="absolute right-[-18%] top-40 h-72 w-72 rounded-full bg-[var(--shop-red)]/15 blur-3xl" />
        <div className="absolute bottom-24 left-1/3 h-44 w-44 rounded-full bg-[var(--shop-magenta)]/20 blur-3xl" />
      </div>
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-6">
        <header className="mb-6 overflow-hidden rounded-[32px] border border-[var(--shop-stroke)] bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] px-5 py-5 shadow-[0_25px_80px_rgba(5,0,10,0.45)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.42em] text-[var(--shop-muted)]">
              YungWear Drop
            </p>
            <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--shop-cream)]">
              Limited
            </span>
          </div>
          <div className="mt-5 flex items-start justify-between gap-4">
            <div className="max-w-[16rem]">
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
                Streetwear Drop App
              </p>
              <h1 className="mt-3 text-4xl font-semibold leading-none tracking-[-0.04em] text-[var(--shop-cream)]">
                {title}
              </h1>
              <p className="mt-3 text-sm leading-6 text-[var(--shop-muted)]">{subtitle}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span
                className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] ${
                  isTelegram
                    ? 'bg-emerald-300/18 text-emerald-100'
                    : 'bg-white/10 text-[var(--shop-muted)]'
                }`}
              >
                {isTelegram ? 'Telegram' : 'Browser'}
              </span>
              <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(139,61,255,0.35),rgba(217,31,111,0.16))] px-4 py-3 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-white/70">
                  Brand Mark
                </p>
                <p className="mt-1 text-3xl leading-none text-[var(--shop-cream)]">Heart</p>
              </div>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-2 overflow-x-auto pb-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--shop-cream)]/80">
            <span className="rounded-full bg-[var(--shop-purple)]/22 px-3 py-2">Purple Box</span>
            <span className="rounded-full bg-[var(--shop-magenta)]/22 px-3 py-2">Drop Ready</span>
            <span className="rounded-full bg-[var(--shop-red)]/22 px-3 py-2">Streetwear</span>
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
