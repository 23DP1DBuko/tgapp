type PageHeaderProps = {
  label: string
  onClick: () => void
}

export function PageHeader({ label, onClick }: PageHeaderProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[24px] border border-white/10 bg-white/6 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)]"
    >
      ← {label}
    </button>
  )
}
