import { Fragment } from 'react'

import { useI18n } from '../../lib/i18n'
import { legalDocs } from '../../lib/i18n/legalDocs'
import type { LegalBlock, LegalDocId } from '../../types/legal'

/**
 * Render inline markers in legal document text:
 *   **bold**     → <strong>
 *   [label](url) → <a href="url" target="_blank">
 * Everything else is rendered as plain text.
 */
function renderInline(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g)
  return parts.map((part, index) => {
    if (!part) return null

    const bold = part.match(/^\*\*(.+)\*\*$/)
    if (bold) {
      return <strong key={`${keyPrefix}-b-${index}`}>{bold[1]}</strong>
    }

    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (link) {
      return (
        <a
          key={`${keyPrefix}-a-${index}`}
          href={link[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-1 underline decoration-[var(--shop-purple)]/50 hover:decoration-[var(--shop-purple)]"
        >
          {link[1]}
        </a>
      )
    }

    return <Fragment key={`${keyPrefix}-t-${index}`}>{part}</Fragment>
  })
}

function LegalBlockView({ block, index }: { block: LegalBlock; index: number }) {
  if (block.kind === 'p') {
    return <p>{renderInline(block.text, `p${index}`)}</p>
  }

  if (block.kind === 'list') {
    return (
      <ul className="list-disc space-y-1.5 pl-5">
        {block.items.map((item, i) => (
          <li key={i}>{renderInline(item, `l${index}-${i}`)}</li>
        ))}
      </ul>
    )
  }

  return (
    <div>
      <p className="font-semibold text-[var(--shop-cream)]">{block.title}</p>
      <p className="text-zinc-400">{renderInline(block.text, `t${index}`)}</p>
    </div>
  )
}

/** Renders a localized legal document body (Privacy Policy / Terms). */
export function LegalDocBody({ doc }: { doc: LegalDocId }) {
  const { language } = useI18n()
  const sections = legalDocs[doc][language]

  return (
    <div className="space-y-5">
      {sections.map((section) => (
        <section key={section.heading}>
          <h3 className="mb-2 text-base font-semibold text-[var(--shop-cream)]">
            {section.heading}
          </h3>
          <div className="mt-2 space-y-3">
            {section.blocks.map((block, i) => (
              <LegalBlockView key={i} block={block} index={i} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
