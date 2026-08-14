import { useEffect, useRef, useState } from 'react'

import {
  createPromoCode,
  deleteInactivePromoCodes,
  deletePromoCode,
  listPromoCodes,
  updatePromoCode,
} from '../../lib/firebase/promoCodes'
import {
  PROMO_DISCOUNT_TYPES,
  type PromoCode,
  type PromoDiscountType,
} from '../../types/promo'
import { triggerHapticFeedback } from '../../lib/telegram/webApp'
import { AdminFeedbackBanner } from '../ui/AdminFeedbackBanner'
import { CustomSelect } from '../ui/CustomSelect'
import { Input } from '../ui/Input'

type PromoAdminPanelProps = {
  isEnabled: boolean
  initData: string
}

type ViewMode = 'list' | 'form'

type PromoFormState = {
  code: string
  discountType: PromoDiscountType
  discountValue: string
  isActive: boolean
  expiresAt: string
  usageLimit: string
}

const initialFormState: PromoFormState = {
  code: '',
  discountType: 'percentage',
  discountValue: '',
  isActive: true,
  expiresAt: '',
  usageLimit: '',
}

function formatDiscount(promo: PromoCode): string {
  if (promo.discountType === 'percentage') {
    return `${promo.discountValue}% OFF`
  }

  return `€${promo.discountValue.toFixed(2)} OFF`
}

export function PromoAdminPanel({ initData, isEnabled }: PromoAdminPanelProps) {
  const [promos, setPromos] = useState<PromoCode[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [selectedPromoId, setSelectedPromoId] = useState<string>('new')
  const [form, setForm] = useState<PromoFormState>(initialFormState)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const [feedbackTone, setFeedbackTone] = useState<'success' | 'error'>('success')
  const [feedbackRetryable, setFeedbackRetryable] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  // Track the auto-dismiss timer so newer feedback cancels older pending
  // dismissals (otherwise an old timer could hide a retryable error early).
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedPromo =
    selectedPromoId === 'new'
      ? null
      : promos.find((promo) => promo.id === selectedPromoId) ?? null
  const inactivePromos = promos.filter((promo) => !promo.isActive)

  useEffect(() => {
    if (!isEnabled) {
      return
    }

    void reloadPromos()
  }, [isEnabled])

  async function reloadPromos() {
    setIsLoading(true)

    try {
      const nextPromos = await listPromoCodes(initData)
      setPromos(nextPromos)
    } finally {
      setIsLoading(false)
    }
  }

  const showFeedback = (
    tone: 'success' | 'error',
    message: string,
    retryable = false,
  ) => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current)
      dismissTimerRef.current = null
    }
    setFeedbackTone(tone)
    setFeedbackMessage(message)
    setFeedbackRetryable(retryable)
    if (!retryable) {
      dismissTimerRef.current = setTimeout(() => {
        dismissTimerRef.current = null
        setFeedbackMessage(null)
      }, 3000)
    }
  }

  function resetForm() {
    setSelectedPromoId('new')
    setForm(initialFormState)
  }

  function applyPromoToForm(promo: PromoCode) {
    setForm({
      code: promo.code,
      discountType: promo.discountType,
      discountValue: String(promo.discountValue),
      isActive: promo.isActive,
      expiresAt: promo.expiresAt ? promo.expiresAt.toISOString().slice(0, 10) : '',
      usageLimit: promo.usageLimit === null ? '' : String(promo.usageLimit),
    })
  }

  function startCreate() {
    triggerHapticFeedback('light')
    resetForm()
    setFeedbackMessage(null)
    setFeedbackRetryable(false)
    setViewMode('form')
  }

  function startEdit(promo: PromoCode) {
    triggerHapticFeedback('light')
    setSelectedPromoId(promo.id)
    applyPromoToForm(promo)
    setFeedbackMessage(null)
    setFeedbackRetryable(false)
    setViewMode('form')
  }

  function cancelForm() {
    resetForm()
    setViewMode('list')
    setFeedbackMessage(null)
    setFeedbackRetryable(false)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedCode = form.code.trim().toUpperCase()
    const discountValue = Number(form.discountValue)
    const usageLimit =
      form.usageLimit.trim() === '' ? null : Number(form.usageLimit.trim())
    const expiresAt = form.expiresAt ? new Date(`${form.expiresAt}T23:59:59`) : null

    if (!normalizedCode || Number.isNaN(discountValue) || discountValue <= 0) {
      showFeedback('error', 'Code and a valid discount value are required.')
      return
    }

    if (usageLimit !== null && (Number.isNaN(usageLimit) || usageLimit < 0)) {
      showFeedback('error', 'Usage limit must be empty or a valid positive number.')
      return
    }

    setIsSubmitting(true)
    setFeedbackMessage(null)

    try {
      const payload = {
        code: normalizedCode,
        discountType: form.discountType,
        discountValue,
        isActive: form.isActive,
        expiresAt,
        usageLimit,
      }

      if (selectedPromo) {
        await updatePromoCode(initData, selectedPromo.id, payload)
        showFeedback('success', 'Promo code updated.')
      } else {
        await createPromoCode(initData, payload)
        showFeedback('success', 'Promo code created.')
      }

      triggerHapticFeedback('light')
      resetForm()
      setViewMode('list')
      await reloadPromos()
    } catch (error) {
      showFeedback(
        'error',
        error instanceof Error ? error.message : 'Failed to save promo code.',
        true,
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeletePromo(promo: PromoCode) {
    setIsSubmitting(true)
    setFeedbackMessage(null)

    try {
      await deletePromoCode(initData, promo.id)
      setDeleteConfirmId(null)
      triggerHapticFeedback('light')
      showFeedback('success', 'Promo code deleted.')
      if (selectedPromoId === promo.id) {
        resetForm()
        setViewMode('list')
      }
      await reloadPromos()
    } catch (error) {
      showFeedback(
        'error',
        error instanceof Error ? error.message : 'Failed to delete promo code.',
        true,
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeleteInactivePromos() {
    if (inactivePromos.length === 0) {
      return
    }

    const shouldDelete = window.confirm(
      `Delete all inactive promo codes (${inactivePromos.length})?`,
    )

    if (!shouldDelete) {
      return
    }

    setIsSubmitting(true)
    setFeedbackMessage(null)

    try {
      await deleteInactivePromoCodes(initData, promos)
      showFeedback('success', 'Inactive promo codes deleted.')
      resetForm()
      setViewMode('list')
      await reloadPromos()
    } catch (error) {
      showFeedback(
        'error',
        error instanceof Error ? error.message : 'Failed to delete inactive promo codes.',
        true,
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <article className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(28,14,34,0.94),rgba(18,10,22,0.96))] p-5 shadow-[0_25px_70px_rgba(0,0,0,0.35)]">
      {/* ── Header: title + destructive actions ── */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
          Promo Codes
        </p>
        <div className="flex items-center gap-2">
          {viewMode === 'list' && inactivePromos.length > 0 ? (
            <button
              type="button"
              onClick={handleDeleteInactivePromos}
              disabled={isSubmitting}
              className="rounded-full border border-[var(--shop-red)]/30 bg-[var(--shop-red)]/12 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)] transition-opacity disabled:opacity-50"
            >
              Clear Inactive ({inactivePromos.length})
            </button>
          ) : null}
          <span className="rounded-full bg-[var(--shop-purple)]/22 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]">
            {viewMode === 'form' ? (selectedPromo ? 'Edit' : 'New') : `${promos.length} Promos`}
          </span>
        </div>
      </div>

      {/* ── Feedback ── */}
      {feedbackMessage ? (
        <AdminFeedbackBanner
          tone={feedbackTone}
          message={feedbackMessage}
          className="mt-3"
          onRetry={
            feedbackRetryable && viewMode === 'form'
              ? () => formRef.current?.requestSubmit()
              : undefined
          }
        />
      ) : null}

      {/* ── List view ── */}
      {viewMode === 'list' ? (
        <>
          {/* "+ Add New Promo Code" action card */}
          <button
            type="button"
            onClick={startCreate}
            className="mt-4 flex w-full items-center gap-4 rounded-2xl border-2 border-dashed border-white/12 bg-[var(--shop-panel-solid)] px-5 py-6 text-left transition-all hover:border-white/25"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/8">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 shrink-0 text-[var(--shop-purple)]" aria-hidden="true">
                <g transform="translate(2, 2)">
                  <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                </g>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold tracking-[-0.02em] text-[var(--shop-cream)]">
                Add New Promo Code
              </p>
              <p className="mt-0.5 text-xs text-[var(--shop-muted)]">
                code · discount · usage limit
              </p>
            </div>
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="ml-auto h-5 w-5 shrink-0 text-[var(--shop-muted)]"
              aria-hidden="true"
            >
              <g transform="translate(2, 2)">
                <path
                  fillRule="evenodd"
                  d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                  clipRule="evenodd"
                />
              </g>
            </svg>
          </button>

          {/* Promo rows */}
          <div className="mt-4 space-y-3">
            {isLoading ? (
              <div className="rounded-2xl bg-white/8 px-4 py-4 text-center text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                Loading promo codes...
              </div>
            ) : null}

            {!isLoading && promos.length === 0 ? (
              <div className="rounded-2xl bg-white/8 px-4 py-8 text-center text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                No promo codes yet. Tap above to create your first one.
              </div>
            ) : null}

            {!isLoading
              ? promos.map((promo) => {
                  const usedCount = promo.usageCount ?? 0

                  return (
                    <div
                      key={promo.id}
                      className={`flex flex-wrap items-center gap-2 rounded-2xl border bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-3 transition-all ${
                        promo.isActive ? 'border-white/10' : 'border-white/6 opacity-55'
                      }`}
                    >
                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 font-mono text-sm font-bold tracking-[-0.02em] text-[var(--shop-cream)]">
                            {promo.code}
                          </span>
                          {promo.isActive ? (
                            <span className="shrink-0 rounded-full bg-emerald-300/18 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-emerald-100">
                              Active
                            </span>
                          ) : (
                            <span className="shrink-0 rounded-full bg-white/8 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-[var(--shop-muted)]">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="mt-1 truncate text-xs text-[var(--shop-muted)]/70">
                          {formatDiscount(promo)}
                          {promo.expiresAt
                            ? ` · Expires ${promo.expiresAt.toLocaleDateString()}`
                            : ' · No expiry'}
                        </p>
                        <p className="mt-0.5 text-[9px] text-[var(--shop-muted)]/50">
                          {promo.usageLimit !== null
                            ? `${usedCount}/${promo.usageLimit} used`
                            : `${usedCount} used`}
                        </p>
                      </div>

                      {/* Action buttons group — ml-auto keeps them right-aligned;
                          on narrow screens the wrap moves them to their own line
                          instead of overflowing the card. */}
                      <div className="ml-auto flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => startEdit(promo)}
                          className="rounded-lg border border-white/12 bg-white/8 px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)] transition-colors hover:bg-white/14"
                        >
                          Edit
                        </button>

                        {deleteConfirmId === promo.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => void handleDeletePromo(promo)}
                              disabled={isSubmitting}
                              className="rounded-lg bg-[var(--shop-red)] px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(null)}
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
                              setDeleteConfirmId(promo.id)
                            }}
                            className="rounded-lg border border-white/12 bg-white/8 px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)] transition-colors hover:border-[var(--shop-red)]/30 hover:bg-[var(--shop-red)]/12 hover:text-[var(--shop-red)]"
                            aria-label="Delete promo code"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
                              <g transform="translate(4, 4)">
                                <path d="M5.5 2a.5.5 0 01.5-.5h4a.5.5 0 01.5.5v1H5.5V2zM4 3.5V2a2 2 0 012-2h4a2 2 0 012 2v1.5h2.5a.5.5 0 010 1h-1.05l-.89 8.89A2 2 0 0110.59 14H5.41a2 2 0 01-1.97-1.61L2.55 4.5H1.5a.5.5 0 010-1H4zm1.05 1l.88 8.44a1 1 0 00.98.81h4.18a1 1 0 00.98-.81L12.95 4.5H5.05z" />
                              </g>
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              : null}
          </div>
        </>
      ) : (
        /* ── Form view (create / edit) ── */
        <form ref={formRef} className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--shop-cream)]">
              {selectedPromo ? 'Edit Promo Code' : 'New Promo Code'}
            </p>
            <button
              type="button"
              onClick={cancelForm}
              disabled={isSubmitting}
              className="rounded-full border border-white/10 bg-white/8 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-500">
                Code
              </span>
              <Input
                size="md"
                focusColor="red"
                value={form.code}
                onChange={(event) =>
                  setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))
                }
                placeholder="DROP10"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-500">
                Discount Value
              </span>
              <Input
                size="md"
                focusColor="red"
                value={form.discountValue}
                onChange={(event) =>
                  setForm((current) => ({ ...current, discountValue: event.target.value }))
                }
                inputMode="decimal"
                placeholder="10"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-500">
                Discount Type
              </span>
              <CustomSelect
                value={form.discountType}
                options={PROMO_DISCOUNT_TYPES.map((type) => ({
                  value: type,
                  label: type,
                }))}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    discountType: value as PromoDiscountType,
                  }))
                }
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-500">
                Usage Limit
              </span>
              <Input
                value={form.usageLimit}
                onChange={(event) =>
                  setForm((current) => ({ ...current, usageLimit: event.target.value }))
                }
                inputMode="numeric"
                size="md"
                focusColor="red"
                placeholder="Unlimited"
              />
            </label>
          </div>

          {selectedPromo ? (
            <div className="rounded-2xl border border-white/10 bg-white/6 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                Current Usage
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--shop-cream)]">
                {selectedPromo.usageCount ?? 0}
                {selectedPromo.usageLimit !== null
                  ? ` / ${selectedPromo.usageLimit}`
                  : ''}
              </p>
              {selectedPromo.usageLimit !== null ? (
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all ${
                      (selectedPromo.usageCount ?? 0) >= selectedPromo.usageLimit
                        ? 'bg-[var(--shop-red)]'
                        : (selectedPromo.usageCount ?? 0) >= selectedPromo.usageLimit * 0.8
                          ? 'bg-amber-400'
                          : 'bg-emerald-400/70'
                    }`}
                    style={{
                      width: `${Math.min(100, ((selectedPromo.usageCount ?? 0) / selectedPromo.usageLimit) * 100)}%`,
                    }}
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/6 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                Current Usage
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--shop-muted)]">
                —
              </p>
            </div>
          )}

          <label className="block">
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-500">
              Expires At
            </span>
            <Input
              size="md"
              focusColor="red"
              type="date"
              value={form.expiresAt}
              onChange={(event) =>
                setForm((current) => ({ ...current, expiresAt: event.target.value }))
              }
            />
          </label>

          <label className="flex cursor-pointer items-center justify-between rounded-2xl bg-white/8 px-4 py-3">
            <span className="text-sm text-[var(--shop-cream)]">Promo code is active</span>
            <button
              type="button"
              role="switch"
              aria-checked={form.isActive}
              aria-label="Toggle promo code active status"
              onClick={() =>
                setForm((current) => ({ ...current, isActive: !current.isActive }))
              }
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
                form.isActive ? 'bg-[var(--shop-purple)]' : 'bg-white/15'
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-all duration-200 ${
                  form.isActive ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </label>

          {/* Save & Cancel buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={cancelForm}
              disabled={isSubmitting}
              className="flex-1 rounded-xl border border-white/10 bg-white/8 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)] transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex-1 rounded-xl px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white transition-all ${
                isSubmitting
                  ? 'bg-white/15 text-[var(--shop-muted)]'
                  : selectedPromo
                    ? 'border border-[var(--shop-purple)] bg-[var(--shop-purple)]/40'
                    : 'bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] shadow-[0_4px_16px_rgba(139,61,255,0.3)]'
              }`}
            >
              {isSubmitting
                ? 'Saving...'
                : selectedPromo
                  ? 'Save Changes'
                  : 'Create Promo'}
            </button>
          </div>
        </form>
      )}
    </article>
  )
}
