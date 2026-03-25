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
    <div className="min-h-screen bg-stone-100 text-zinc-900">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-6">
        <header className="mb-6 rounded-[28px] border border-black/10 bg-white px-5 py-4 shadow-[0_18px_50px_rgba(24,24,27,0.08)]">
          <p className="text-xs font-medium uppercase tracking-[0.32em] text-stone-500">
            Streetwear Drop App
          </p>
          <div className="mt-3 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{subtitle}</p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] ${
                isTelegram
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-stone-200 text-stone-600'
              }`}
            >
              {isTelegram ? 'Telegram' : 'Browser'}
            </span>
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
