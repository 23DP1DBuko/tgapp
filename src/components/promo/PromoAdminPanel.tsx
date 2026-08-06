import { useEffect, useState } from 'react'

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
import { CustomSelect } from '../ui/CustomSelect'
import { Input } from '../ui/Input'

type PromoAdminPanelProps = {
  isEnabled: boolean
  initData: string
}

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

export function PromoAdminPanel({ initData, isEnabled }: PromoAdminPanelProps) {
  const [promos, setPromos] = useState<PromoCode[]>([])
  const [selectedPromoId, setSelectedPromoId] = useState<string>('new')
  const [form, setForm] = useState<PromoFormState>(initialFormState)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const [feedbackTone, setFeedbackTone] = useState<'success' | 'error'>('success')

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
      const nextPromos = await listPromoCodes()
      setPromos(nextPromos)
    } finally {
      setIsLoading(false)
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

  function handlePromoSelection(promoId: string) {
    setSelectedPromoId(promoId)
    setFeedbackMessage(null)

    if (promoId === 'new') {
      resetForm()
      return
    }

    const promo = promos.find((item) => item.id === promoId)

    if (promo) {
      applyPromoToForm(promo)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedCode = form.code.trim().toUpperCase()
    const discountValue = Number(form.discountValue)
    const usageLimit =
      form.usageLimit.trim() === '' ? null : Number(form.usageLimit.trim())
    const expiresAt = form.expiresAt ? new Date(`${form.expiresAt}T23:59:59`) : null

    if (!normalizedCode || Number.isNaN(discountValue) || discountValue <= 0) {
      setFeedbackTone('error')
      setFeedbackMessage('Code and a valid discount value are required.')
      return
    }

    if (usageLimit !== null && (Number.isNaN(usageLimit) || usageLimit < 0)) {
      setFeedbackTone('error')
      setFeedbackMessage('Usage limit must be empty or a valid positive number.')
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
      } else {
        await createPromoCode(initData, payload)
      }

      setFeedbackTone('success')
      setFeedbackMessage(
        selectedPromo ? 'Promo code updated.' : 'Promo code created.',
      )
      resetForm()
      await reloadPromos()
    } catch (error) {
      setFeedbackTone('error')
      setFeedbackMessage(
        error instanceof Error ? error.message : 'Failed to save promo code.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeletePromo() {
    if (!selectedPromo) {
      return
    }

    const shouldDelete = window.confirm(`Delete promo code "${selectedPromo.code}"?`)

    if (!shouldDelete) {
      return
    }

    setIsSubmitting(true)
    setFeedbackMessage(null)

    try {
      await deletePromoCode(initData, selectedPromo.id)
      setFeedbackTone('success')
      setFeedbackMessage('Promo code deleted.')
      resetForm()
      await reloadPromos()
    } catch (error) {
      setFeedbackTone('error')
      setFeedbackMessage(
        error instanceof Error ? error.message : 'Failed to delete promo code.',
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
      setFeedbackTone('success')
      setFeedbackMessage('Inactive promo codes deleted.')
      resetForm()
      await reloadPromos()
    } catch (error) {
      setFeedbackTone('error')
      setFeedbackMessage(
        error instanceof Error ? error.message : 'Failed to delete inactive promo codes.',
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
          {inactivePromos.length > 0 ? (
            <button
              type="button"
              onClick={handleDeleteInactivePromos}
              disabled={isSubmitting}
              className="rounded-full border border-[var(--shop-red)]/30 bg-[var(--shop-red)]/12 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)] transition-opacity disabled:opacity-50"
            >
              Clear Inactive ({inactivePromos.length})
            </button>
          ) : null}
          <span className="rounded-full bg-[var(--shop-purple)]/22 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]">
            Admin
          </span>
        </div>
      </div>

      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-500">
            Mode
          </span>
          <CustomSelect
            value={selectedPromoId}
            options={[
              { value: 'new', label: 'Create new promo code' },
              ...promos.map((promo) => {
                const usedCount = promo.usageCount ?? 0
                const usageLabel =
                  promo.usageLimit !== null
                    ? `${usedCount}/${promo.usageLimit}`
                    : `${usedCount} used`

                return {
                  value: promo.id,
                  label: `Edit: ${promo.code} · ${usageLabel}`,
                }
              }),
            ]}
            onChange={handlePromoSelection}
          />
        </label>

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

        <div className="grid grid-cols-2 gap-3">
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
              placeholder="Leave empty for unlimited"
            />
          </label>

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
        </div>
        </div>

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

        {feedbackMessage ? (
          <p
            className={`rounded-2xl px-4 py-3 text-sm ${
              feedbackTone === 'success'
                ? 'bg-emerald-300/18 text-emerald-100'
                : 'bg-[var(--shop-red)]/18 text-[var(--shop-cream)]'
            }`}
          >
            {feedbackMessage}
          </p>
        ) : null}

        {isLoading ? (
          <p className="rounded-2xl bg-white/8 px-4 py-3 text-sm text-[var(--shop-muted)]">
            Loading promo codes...
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full rounded-2xl px-4 py-3 text-sm font-bold uppercase tracking-[0.2em] transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
            selectedPromo
              ? 'border-2 border-[var(--shop-purple)] bg-[var(--shop-purple)]/12 text-[var(--shop-purple)]'
              : 'bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] text-white shadow-[0_8px_24px_rgba(139,61,255,0.3)]'
          }`}
        >
          {isSubmitting
            ? 'Saving...'
            : selectedPromo
              ? 'SAVE CHANGES'
              : 'CREATE PROMO'}
        </button>

        {selectedPromo ? (
          <button
            type="button"
            onClick={handleDeletePromo}
            disabled={isSubmitting}
            className="w-full rounded-2xl border border-[var(--shop-red)]/30 bg-[var(--shop-red)]/12 px-4 py-3 text-sm font-semibold text-[var(--shop-cream)] transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
          >
            Delete Promo Code
          </button>
        ) : null}
      </form>
    </article>
  )
}

