import { useMemo, useRef, useState } from 'react'

import { setProductDiscount } from '../../lib/firebase/products'
import {
  getProductDiscountLabel,
  getProductEffectivePrice,
  hasProductDiscount,
} from '../../lib/productPrice'
import { triggerHapticFeedback } from '../../lib/telegram/webApp'
import type { Product } from '../../types/product'
import { AdminFeedbackBanner } from '../ui/AdminFeedbackBanner'

type DiscountAdminPanelProps = {
  initData: string
  products: Product[]
  onProductsChanged: () => void
}

type DiscountType = 'percentage' | 'fixed'

/** Id of the product whose inline discount editor is open. */
const EMPTY_EDITOR_ID = null as string | null

export function DiscountAdminPanel({
  initData,
  products,
  onProductsChanged,
}: DiscountAdminPanelProps) {
  // Only products that are actually for sale can carry a meaningful discount.
  const sellableProducts = useMemo(() => products.filter((p) => p.isAvailable), [products])
  const discountedCount = useMemo(
    () => sellableProducts.filter((p) => hasProductDiscount(p)).length,
    [sellableProducts],
  )

  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error'
    message: string
  } | null>(null)
  const [feedbackRetryable, setFeedbackRetryable] = useState(false)
  const [editingProductId, setEditingProductId] = useState<string | null>(EMPTY_EDITOR_ID)
  const [discountType, setDiscountType] = useState<DiscountType>('percentage')
  const [discountValue, setDiscountValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null)

  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showFeedback(tone: 'success' | 'error', message: string, retryable = false) {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current)
      dismissTimerRef.current = null
    }
    setFeedback({ tone, message })
    setFeedbackRetryable(retryable)
    if (!retryable) {
      dismissTimerRef.current = setTimeout(() => {
        dismissTimerRef.current = null
        setFeedback(null)
      }, 3000)
    }
  }

  const editingProduct = useMemo(
    () => sellableProducts.find((p) => p.id === editingProductId) ?? null,
    [editingProductId, sellableProducts],
  )

  function openEditor(product: Product) {
    triggerHapticFeedback('light')
    setEditingProductId(product.id)
    setDiscountType(product.discountType === 'fixed' ? 'fixed' : 'percentage')
    setDiscountValue(
      typeof product.discountValue === 'number' ? String(product.discountValue) : '',
    )
    setRemoveConfirmId(null)
    setFeedback(null)
  }

  function closeEditor() {
    setEditingProductId(EMPTY_EDITOR_ID)
    setDiscountType('percentage')
    setDiscountValue('')
  }

  /** Client-side validation of the entered discount. Returns error text or null. */
  function validateDiscount(product: Product): string | null {
    const raw = discountValue.trim()
    if (!raw) {
      return 'Enter a discount value.'
    }
    const value = Number(raw)
    if (!Number.isFinite(value) || value <= 0) {
      return 'Discount must be a positive number.'
    }
    if (discountType === 'percentage') {
      if (value > 100) {
        return 'Percentage discount cannot exceed 100%.'
      }
    } else {
      if (value >= product.price) {
        return `Fixed discount must be smaller than the price (${product.price} ${product.currency}).`
      }
    }
    return null
  }

  async function handleSave() {
    if (!editingProduct) return

    const validationError = validateDiscount(editingProduct)
    if (validationError) {
      showFeedback('error', validationError)
      return
    }

    const value = Math.round(Number(discountValue.trim()) * 100) / 100

    try {
      setSaving(true)
      await setProductDiscount(initData, editingProduct.id, {
        discountType,
        discountValue: value,
      })
      triggerHapticFeedback('light')
      closeEditor()
      showFeedback('success', 'Discount saved.')
      onProductsChanged()
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to save discount.', true)
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(product: Product) {
    try {
      setSaving(true)
      await setProductDiscount(initData, product.id, {
        discountType: null,
        discountValue: null,
      })
      triggerHapticFeedback('light')
      setRemoveConfirmId(null)
      closeEditor()
      showFeedback('success', 'Discount removed.')
      onProductsChanged()
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to remove discount.', true)
    } finally {
      setSaving(false)
    }
  }

  // Live preview of the effective price while editing.
  const previewPrice = (() => {
    if (!editingProduct) return null
    const raw = discountValue.trim()
    if (!raw) return null
    const value = Number(raw)
    if (!Number.isFinite(value) || value <= 0) return null
    if (discountType === 'percentage' && value > 100) return null
    if (discountType === 'fixed' && value >= editingProduct.price) return null
    return getProductEffectivePrice(editingProduct.price, discountType, value)
  })()

  return (
    <article className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(28,14,34,0.94),rgba(18,10,22,0.96))] p-5 shadow-[0_25px_70px_rgba(0,0,0,0.35)]">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
            Discount Manager
          </p>
          <p className="mt-1 text-[10px] text-[var(--shop-muted)]/60">
            Set a percentage or fixed amount off any product.
          </p>
        </div>
        <span className="rounded-full bg-amber-400/15 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-amber-400">
          {discountedCount} Discounted
        </span>
      </div>

      {/* ── Feedback ── */}
      {feedback ? (
        <AdminFeedbackBanner
          tone={feedback.tone}
          message={feedback.message}
          className="mt-3"
          onRetry={
            feedbackRetryable
              ? () => void (editingProduct ? handleSave() : undefined)
              : undefined
          }
        />
      ) : null}

      {/* ── Products List ── */}
      <div className="mt-4 space-y-3">
        {sellableProducts.length === 0 ? (
          <div className="rounded-2xl bg-white/8 px-4 py-8 text-center text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
            No products available to discount.
          </div>
        ) : null}

        {sellableProducts.map((product) => {
          const hasDiscount = hasProductDiscount(product)
          const effectivePrice = getProductEffectivePrice(
            product.price,
            product.discountType,
            product.discountValue,
          )
          const discountLabel = getProductDiscountLabel(product)
          const editorOpen = editingProductId === product.id
          const confirmRemove = removeConfirmId === product.id

          return (
            <div key={product.id}>
              {/* ── Row ── */}
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-3 transition-all">
                {/* Thumbnail */}
                <div className="w-20 shrink-0 overflow-hidden rounded-xl bg-black/30 sm:w-24">
                  <div className="aspect-square w-full">
                    {product.images[0] ? (
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[8px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]">
                        No Img
                      </div>
                    )}
                  </div>
                </div>

                {/* Name + price info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold tracking-[-0.02em] text-[var(--shop-cream)]">
                    {product.name}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] uppercase tracking-[0.16em] text-[var(--shop-muted)]/70">
                    {product.brandNames.join(' - ') || product.category}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {hasDiscount && discountLabel ? (
                      <>
                        <span className="rounded-full bg-amber-400/95 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-black">
                          {discountLabel}
                        </span>
                        <span className="text-[9px] text-[var(--shop-muted)]/50 line-through">
                          {product.price} {product.currency}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-300">
                          {effectivePrice} {product.currency}
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px] font-semibold text-[var(--shop-cream)]">
                        {product.price} {product.currency}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEditor(product)}
                    disabled={saving}
                    className="rounded-lg border border-white/12 bg-white/8 px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)] transition-colors hover:bg-white/14 disabled:opacity-40"
                  >
                    {hasDiscount ? 'Edit' : 'Set Discount'}
                  </button>

                  {hasDiscount ? (
                    confirmRemove ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void handleRemove(product)}
                          disabled={saving}
                          className="rounded-lg bg-[var(--shop-red)] px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white disabled:opacity-40"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setRemoveConfirmId(null)}
                          className="rounded-lg border border-white/10 bg-white/8 px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          triggerHapticFeedback('light')
                          setRemoveConfirmId(product.id)
                        }}
                        disabled={saving}
                        className="rounded-lg border border-white/12 bg-white/8 px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)] transition-colors hover:border-[var(--shop-red)]/30 hover:bg-[var(--shop-red)]/12 hover:text-[var(--shop-red)] disabled:opacity-40"
                        aria-label="Remove discount"
                      >
                        Remove
                      </button>
                    )
                  ) : null}
                </div>
              </div>

              {/* ── Inline Discount Editor ── */}
              {editorOpen && editingProduct ? (
                <div className="mt-2 space-y-4 rounded-2xl border border-white/10 bg-[var(--shop-panel-solid)] p-4">
                  {/* Type toggle */}
                  <div>
                    <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)]">
                      Discount Type
                    </span>
                    <div className="flex gap-1.5 rounded-[16px] border border-white/10 bg-white/6 p-1">
                      {(
                        [
                          { key: 'percentage', label: 'Percent %' },
                          { key: 'fixed', label: `Fixed ${editingProduct.currency}` },
                        ] as const
                      ).map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => {
                            triggerHapticFeedback('light')
                            setDiscountType(option.key)
                          }}
                          className={`flex-1 rounded-[12px] px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors ${
                            discountType === option.key
                              ? 'bg-[var(--shop-purple)] text-white'
                              : 'text-[var(--shop-muted)] hover:text-[var(--shop-cream)]'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Value input */}
                  <label className="block">
                    <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)]">
                      {discountType === 'percentage' ? 'Percent Off' : 'Amount Off'}
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={discountType === 'percentage' ? 100 : editingProduct.price}
                        step={discountType === 'percentage' ? 1 : 0.5}
                        value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value)}
                        placeholder={discountType === 'percentage' ? 'e.g. 20' : 'e.g. 10'}
                        className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-[var(--shop-cream)] outline-none placeholder:text-[var(--shop-muted)]/60 focus:border-[var(--shop-purple)] transition-colors"
                      />
                      <span className="shrink-0 rounded-xl bg-white/8 px-3 py-2.5 text-xs font-semibold text-[var(--shop-muted)]">
                        {discountType === 'percentage' ? '%' : editingProduct.currency}
                      </span>
                    </div>
                  </label>

                  {/* Live price preview */}
                  {previewPrice !== null ? (
                    <p className="rounded-xl bg-emerald-300/12 px-3 py-2 text-xs text-emerald-100">
                      New price:{' '}
                      <span className="font-bold">
                        {previewPrice} {editingProduct.currency}
                      </span>{' '}
                      <span className="text-[var(--shop-muted)]/70 line-through">
                        (was {editingProduct.price} {editingProduct.currency})
                      </span>
                    </p>
                  ) : discountValue.trim() ? (
                    <p className="rounded-xl bg-[var(--shop-red)]/10 px-3 py-2 text-xs text-[var(--shop-red)]">
                      Enter a valid discount value.
                    </p>
                  ) : null}

                  {/* Save / Cancel */}
                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={closeEditor}
                      disabled={saving}
                      className="flex-1 rounded-xl border border-white/10 bg-white/8 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)] transition-colors disabled:opacity-40"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSave()}
                      disabled={saving}
                      className={`flex-1 rounded-xl px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white transition-all ${
                        saving
                          ? 'bg-white/15 text-[var(--shop-muted)]'
                          : 'bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] shadow-[0_4px_16px_rgba(139,61,255,0.3)]'
                      }`}
                    >
                      {saving ? 'Saving...' : 'Save Discount'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </article>
  )
}
