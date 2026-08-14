import { useEffect, useRef, useState } from 'react'

export type CustomSelectOption = {
  value: string
  label: string
}

type CustomSelectProps = {
  value: string
  options: CustomSelectOption[]
  onChange: (value: string) => void
  placeholder?: string
}

export function CustomSelect({
  value,
  options,
  onChange,
  placeholder = 'Select an option',
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedLabel = options.find((o) => o.value === value)?.label ?? ''

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm transition-colors ${
          value
            ? 'border-white/10 bg-white/8 text-[var(--shop-cream)]'
            : 'border-white/10 bg-white/6 text-zinc-500'
        }`}
      >
        <span className="truncate">
          {value ? selectedLabel : placeholder}
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className={`h-4 w-4 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <g transform="translate(2, 2)">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </g>
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-2xl border border-white/10 bg-[var(--shop-dropdown)] shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value)
                setIsOpen(false)
              }}
              className={`flex w-full items-center gap-2 px-4 py-3 text-left text-sm transition-colors hover:bg-white/8 ${
                value === opt.value
                  ? 'bg-white/10 text-[var(--shop-cream)]'
                  : 'text-zinc-400'
              }`}
            >
              {value === opt.value && (
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-emerald-300" aria-hidden="true">
                  <g transform="translate(2, 2)">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </g>
                </svg>
              )}
              <span className="truncate">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
