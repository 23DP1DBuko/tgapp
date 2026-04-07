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

type PromoAdminPanelProps = {
  isEnabled: boolean
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

export function PromoAdminPanel({ isEnabled }: PromoAdminPanelProps) {
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
        await updatePromoCode(selectedPromo.id, payload)
      } else {
        await createPromoCode(payload)
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
      await deletePromoCode(selectedPromo.id)
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
      await deleteInactivePromoCodes(promos)
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
            Promo Codes
          </p>
          <p className="mt-3 text-sm leading-6 text-[var(--shop-muted)]">
            Create and edit checkout discount codes directly from the admin view.
          </p>
        </div>
        <span className="rounded-full bg-[var(--shop-purple)]/22 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--shop-cream)]">
          Admin
        </span>
      </div>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
            Mode
          </span>
          <select
            value={selectedPromoId}
            onChange={(event) => handlePromoSelection(event.target.value)}
            className={inputClassName}
          >
            <option value="new">Create new promo code</option>
            {promos.map((promo) => (
              <option key={promo.id} value={promo.id}>
                Edit: {promo.code}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
              Code
            </span>
            <input
              value={form.code}
              onChange={(event) =>
                setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))
              }
              className={inputClassName}
              placeholder="DROP10"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
              Discount Value
            </span>
            <input
              value={form.discountValue}
              onChange={(event) =>
                setForm((current) => ({ ...current, discountValue: event.target.value }))
              }
              className={inputClassName}
              inputMode="decimal"
              placeholder="10"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
              Discount Type
            </span>
            <select
              value={form.discountType}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  discountType: event.target.value as PromoDiscountType,
                }))
              }
              className={inputClassName}
            >
              {PROMO_DISCOUNT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
              Usage Limit
            </span>
            <input
              value={form.usageLimit}
              onChange={(event) =>
                setForm((current) => ({ ...current, usageLimit: event.target.value }))
              }
              className={inputClassName}
              inputMode="numeric"
              placeholder="Leave empty for unlimited"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
            Expires At
          </span>
          <input
            type="date"
            value={form.expiresAt}
            onChange={(event) =>
              setForm((current) => ({ ...current, expiresAt: event.target.value }))
            }
            className={inputClassName}
          />
        </label>

        <label className="flex items-center gap-3 rounded-2xl bg-white/8 px-4 py-3 text-sm text-[var(--shop-cream)]">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) =>
              setForm((current) => ({ ...current, isActive: event.target.checked }))
            }
            className="h-4 w-4 accent-zinc-900"
          />
          Promo code is active
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
          className="w-full rounded-2xl bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] px-4 py-3 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting
            ? 'Saving Promo Code...'
            : selectedPromo
              ? 'Save Promo Code Changes'
              : 'Create Promo Code'}
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

        <button
          type="button"
          onClick={handleDeleteInactivePromos}
          disabled={isSubmitting || inactivePromos.length === 0}
          className="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm font-semibold text-[var(--shop-cream)] transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
        >
          Delete Inactive Promos ({inactivePromos.length})
        </button>
      </form>
    </article>
  )
}

const inputClassName =
  'w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-[var(--shop-cream)] outline-none transition placeholder:text-[var(--shop-muted)]/70 focus:border-[var(--shop-red)]'
