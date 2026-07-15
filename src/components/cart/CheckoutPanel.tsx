import { useCallback, useEffect, useRef, useState } from 'react'

import { triggerHapticNotification } from '../../lib/telegram/webApp'
import { SwipeablePanel } from '../ui/SwipeablePanel'
import type { AppliedPromo } from '../../types/promo'
import type {
  CartItem,
  CheckoutForm,
  CheckoutSubmitState,
  CheckoutSuccessSnapshot,
} from '../../types/cart'

const MEETUP_LOCATIONS = [
  { value: 'origo_center', label: 'Origo Center' },
  { value: 'old_town', label: 'Old Town' },
  { value: 'akropole', label: 'Akropole' },
  { value: '__other__', label: 'Other Location' },
] as const

const TIME_OPTIONS = [
  { value: 'today_evening', label: 'Today Evening' },
  { value: 'tomorrow_afternoon', label: 'Tomorrow Afternoon' },
  { value: 'this_weekend', label: 'This Weekend' },
] as const

type CheckoutPanelProps = {
  items: CartItem[]
  form: CheckoutForm
  telegramUserLabel: string
  telegramContactHint: string
  errorMessage: string | null
  isSubmitted: boolean
  orderId: string | null
  successSnapshot: CheckoutSuccessSnapshot | null
  promoFeedback: string | null
  appliedPromo: AppliedPromo | null
  isApplyingPromo: boolean
  submitState: CheckoutSubmitState
  hasPendingPromoCode: boolean
  onChangeForm: (field: keyof CheckoutForm, value: string) => void
  onApplyPromo: () => void
  onSubmit: () => void
  onViewOrders: () => void
  onBackToCatalog: () => void
  onOpenPrivacy: () => void
  onOpenTerms: () => void
  checkoutStep: number
  onCheckoutStepChange: (step: number) => void
}

export function CheckoutPanel({
  items,
  form,
  telegramUserLabel,
  telegramContactHint,
  errorMessage,
  isSubmitted,
  orderId,
  successSnapshot,
  promoFeedback,
  appliedPromo,
  isApplyingPromo,
  submitState,
  hasPendingPromoCode,
  onChangeForm,
  onApplyPromo,
  onSubmit,
  onViewOrders,
  onBackToCatalog,
  onOpenPrivacy,
  onOpenTerms,
  checkoutStep,
  onCheckoutStepChange,
}: CheckoutPanelProps) {
  const isSubmitting = submitState === 'submitting'
  const subtotal = items.reduce((sum, item) => sum + item.price, 0)
  const discountAmount = appliedPromo?.discountAmount ?? 0
  const total = Math.max(0, subtotal - discountAmount)
  const successForm = successSnapshot?.form ?? form
  const successItems = successSnapshot?.items ?? items
  const successTotal = successSnapshot?.total ?? total
  const successSummary = getCheckoutSuccessSummary(successForm)
  const successFlow = [
    {
      label: 'Request Sent',
      detail: 'Order saved',
      isActive: true,
    },
    {
      label: successForm.paymentMethod === 'usdt' ? 'Payment Check' : 'Admin Follow-Up',
      detail:
        successForm.paymentMethod === 'usdt'
          ? 'Waiting for payment'
          : successForm.fulfillmentType === 'delivery'
            ? 'Delivery details'
            : 'Meetup details',
      isActive: false,
    },
    {
      label:
        successForm.fulfillmentType === 'delivery'
          ? 'Delivery Handoff'
          : 'Meetup Handoff',
      detail: 'Final confirmation',
      isActive: false,
    },
  ]

  const [meetupDropdownOpen, setMeetupDropdownOpen] = useState(false)
  const [timeDropdownOpen, setTimeDropdownOpen] = useState(false)
  const meetupDropdownRef = useRef<HTMLDivElement>(null)
  const timeDropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (meetupDropdownRef.current && !meetupDropdownRef.current.contains(e.target as Node)) {
        setMeetupDropdownOpen(false)
      }
      if (timeDropdownRef.current && !timeDropdownRef.current.contains(e.target as Node)) {
        setTimeDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close meetup dropdown when an option is selected
  useEffect(() => {
    setMeetupDropdownOpen(false)
  }, [form.meetupLocation])

  // Close time dropdown when an option is selected
  useEffect(() => {
    setTimeDropdownOpen(false)
  }, [form.meetupTimeOption])

  // Trigger success haptic once when order is first submitted
  const prevSubmittedRef = useRef(false)
  useEffect(() => {
    if (isSubmitted && orderId && !prevSubmittedRef.current) {
      prevSubmittedRef.current = true
      triggerHapticNotification('success')
    }
    if (!isSubmitted) {
      prevSubmittedRef.current = false
    }
  }, [isSubmitted, orderId])

  // Trigger error haptic when error message appears
  useEffect(() => {
    if (errorMessage) {
      triggerHapticNotification('error')
    }
  }, [errorMessage])

  // Stepper step definitions
  const steps = [
    {
      label: 'Contact',
      isValid: Boolean(form.fullName.trim()) && Boolean(form.telegramHandle.trim()),
    },
    {
      label: 'Fulfillment',
      isValid:
        form.fulfillmentType === 'delivery'
          ? Boolean(form.deliveryCity.trim() && form.deliveryAddress.trim())
          : Boolean(form.meetupLocation.trim()),
    },
    {
      label: 'Payment',
      isValid: items.length > 0 && !hasPendingPromoCode,
    },
  ] as const

  const handleStepClick = useCallback(
    (stepIndex: number) => {
      // Can only navigate to previous steps (stepIndex + 1 < checkoutStep)
      if (stepIndex + 1 < checkoutStep) {
        onCheckoutStepChange(stepIndex + 1)
      }
    },
    [checkoutStep, onCheckoutStepChange],
  )

  const handleGoToNextStep = useCallback(() => {
    if (checkoutStep < 3) {
      onCheckoutStepChange(checkoutStep + 1)
    }
  }, [checkoutStep, onCheckoutStepChange])

  const handleGoToPrevStep = useCallback(() => {
    if (checkoutStep > 1) {
      onCheckoutStepChange(checkoutStep - 1)
    }
  }, [checkoutStep, onCheckoutStepChange])

  // ── Label helpers ──

  const selectedLocationLabel =
    MEETUP_LOCATIONS.find((loc) => loc.value === form.meetupLocation)?.label ?? ''
  const selectedTimeLabel =
    TIME_OPTIONS.find((opt) => opt.value === form.meetupTimeOption)?.label ?? ''
  const isCustomLocation = form.meetupLocation === '__other__'

  // ── Render success state ──

  if (isSubmitted) {
    return (
      <SwipeablePanel onDismiss={onBackToCatalog} threshold={140}>
        <article className="rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(139,61,255,0.24),rgba(255,77,90,0.2))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-white/70">
                Order Request Sent
              </p>
              <h3 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--shop-cream)]">
                Piece reserved
              </h3>
            </div>
            <span className="w-fit rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]">
              Awaiting follow-up
            </span>
          </div>
        </div>

        <div className="mt-5 rounded-[24px] border border-white/10 bg-black/15 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70">
                Request Status
              </p>
            </div>
            <span className="rounded-full bg-emerald-300/18 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
              Live
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {successFlow.map((step) => (
              <div
                key={step.label}
                className={`rounded-[20px] border p-3 ${
                  step.isActive
                    ? 'border-emerald-300/30 bg-emerald-300/10'
                    : 'border-white/10 bg-black/10'
                }`}
              >
                <p
                  className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${
                    step.isActive ? 'text-emerald-100' : 'text-white/65'
                  }`}
                >
                  {step.label}
                </p>
                <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--shop-cream)]">
                  {step.detail}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-[22px] border border-white/10 bg-black/15 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/65">
              Fulfillment
            </p>
            <p className="mt-2 text-sm font-semibold text-[var(--shop-cream)]">
              {successForm.fulfillmentType === 'delivery' ? 'Delivery' : 'Meetup'}
            </p>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-black/15 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/65">
              Payment
            </p>
            <p className="mt-2 text-sm font-semibold text-[var(--shop-cream)]">
              {successForm.paymentMethod === 'usdt' ? 'USDT' : 'Meetup Cash'}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-[24px] border border-white/10 bg-black/15 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70">
            Next Step
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--shop-cream)]">
            {successSummary.nextStep}
          </p>
          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-white/70">
            {successSummary.detail}
          </p>
        </div>

        <div className="mt-4 rounded-[24px] border border-white/10 bg-black/15 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70">
            Order Snapshot
          </p>
          <div className="mt-3 space-y-2 text-sm text-[var(--shop-cream)]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-white/70">Items</span>
              <span>{successItems.length}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-white/70">Total</span>
              <span>{successTotal} EUR</span>
            </div>
            {orderId ? (
              <div className="flex items-start justify-between gap-3">
                <span className="text-white/70">Order ID</span>
                <span className="max-w-[60%] break-all text-right text-xs uppercase tracking-[0.12em]">
                  {orderId}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 rounded-[24px] border border-white/10 bg-black/15 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70">
              Reserved Pieces
            </p>
            <span className="rounded-full bg-white/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]">
              {successItems.length} total
            </span>
          </div>

          <div className="mt-3 space-y-3">
            {successItems.map((item) => (
              <div
                key={item.productId}
                className="flex items-center gap-3 rounded-[20px] border border-white/10 bg-black/10 p-3"
              >
                <div className="h-14 w-12 shrink-0 overflow-hidden rounded-[14px] bg-black/20">
                  {item.image ? (
                    <img src={item.image} alt={item.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[9px] uppercase tracking-[0.16em] text-white/60">
                      No Img
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--shop-cream)]">
                    {item.name}
                  </p>

                </div>
                <span className="shrink-0 text-sm font-semibold text-[var(--shop-cream)]">
                  {item.price} {item.currency}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onViewOrders}
            className="rounded-[24px] border border-white/10 bg-white/8 px-4 py-4 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)]"
          >
            View My Orders
          </button>
          <button
            type="button"
            onClick={onBackToCatalog}
          className="rounded-[24px] bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-white"
        >
          ← Catalog
          </button>
        </div>
      </article>
      </SwipeablePanel>
    )
  }

  const isNextDisabled1 = !steps[0].isValid
  const isNextDisabled2 = !steps[1].isValid

  return (
    <article className="animate-[fade-slide-in_0.4s_ease-out_backwards] rounded-[32px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      {/* ── Compact Stepper ── */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const stepNum = index + 1
            const isActive = stepNum === checkoutStep
            const isPast = stepNum < checkoutStep
            const isFuture = stepNum > checkoutStep
            return (
              <button
                key={step.label}
                type="button"
                disabled={isFuture}
                onClick={() => handleStepClick(index)}
                className={`flex flex-col items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.18em] transition-colors ${
                  isFuture
                    ? 'cursor-not-allowed text-zinc-600'
                    : isPast
                      ? 'cursor-pointer text-emerald-300 hover:text-emerald-200'
                      : 'text-[var(--shop-cream)]'
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
                    isActive
                      ? 'bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] text-white'
                      : isPast
                        ? 'bg-emerald-300/20 text-emerald-100'
                        : 'bg-white/8 text-zinc-500'
                  }`}
                >
                  {isPast ? '✓' : stepNum}
                </span>
                <span className="whitespace-nowrap">{step.label}</span>
              </button>
            )
          })}
        </div>
        {/* Progress bar */}
        <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,var(--shop-purple),var(--shop-red))] transition-all duration-500 ease-out"
            style={{ width: `${((checkoutStep - 1) / (steps.length - 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* ── STEP 1: Contact Information ── */}
      {checkoutStep === 1 && (
        <div className="space-y-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
              Step 1 — Contact Information
            </p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              How should we reach you about your order?
            </p>
          </div>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
              Full Name <span className="text-[var(--shop-red)]">*</span>
            </span>
            <input
              value={form.fullName}
              onChange={(e) => onChangeForm('fullName', e.target.value)}
              className={inputClassName}
              placeholder="Your name"
              autoComplete="name"
            />
          </label>

          <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3">
            <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
              Telegram Account <span className="text-[var(--shop-red)]">*</span>
            </span>
            <p className="mt-2 text-sm font-semibold text-[var(--shop-cream)]">
              {telegramUserLabel}
            </p>
            <p className="mt-1 text-[10px] leading-4 text-zinc-500">
              {telegramContactHint}
            </p>
          </div>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
              Note
            </span>
            <textarea
              value={form.note}
              onChange={(e) => onChangeForm('note', e.target.value)}
              className={`${inputClassName} min-h-24 resize-y`}
              placeholder="Any extra preferences or wishes for your order..."
            />
          </label>

          <div className="flex gap-3 pt-2">
            {checkoutStep > 1 && (
              <button
                type="button"
                onClick={handleGoToPrevStep}
                className="flex-1 rounded-2xl border border-white/10 bg-white/8 px-4 py-3.5 text-xs font-bold uppercase tracking-[0.18em] text-[var(--shop-cream)] transition-all active:scale-[0.98]"
              >
                ← Back
              </button>
            )}
            <button
              type="button"
              onClick={handleGoToNextStep}
              disabled={isNextDisabled1}
              className="flex-1 rounded-2xl bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] px-4 py-3.5 text-xs font-bold uppercase tracking-[0.18em] text-white shadow-[0_4px_16px_rgba(139,61,255,0.3)] transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Fulfillment Method ── */}
      {checkoutStep === 2 && (
        <div className="space-y-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
              Step 2 — Fulfillment Method
            </p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              Choose how you&apos;d like to receive your order.
            </p>
          </div>

          {/* Tabs: Meetup / Delivery */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onChangeForm('fulfillmentType', 'meetup')}
              className={`rounded-2xl border px-4 py-3.5 text-left text-sm transition-all active:scale-[0.98] ${
                form.fulfillmentType === 'meetup'
                  ? 'border-[var(--shop-red)] bg-[var(--shop-red)]/12 text-[var(--shop-cream)]'
                  : 'border-white/10 bg-white/6 text-[var(--shop-muted)] hover:bg-white/10'
              }`}
            >
              <span className="block text-xs font-bold uppercase tracking-[0.16em]">Meetup</span>
              <span className="mt-1 block text-[10px] text-zinc-500">In-person handoff</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeForm('fulfillmentType', 'delivery')}
              className={`rounded-2xl border px-4 py-3.5 text-left text-sm transition-all active:scale-[0.98] ${
                form.fulfillmentType === 'delivery'
                  ? 'border-[var(--shop-red)] bg-[var(--shop-red)]/12 text-[var(--shop-cream)]'
                  : 'border-white/10 bg-white/6 text-[var(--shop-muted)] hover:bg-white/10'
              }`}
            >
              <span className="block text-xs font-bold uppercase tracking-[0.16em]">Delivery</span>
              <span className="mt-1 block text-[10px] text-zinc-500">Shipped to address</span>
            </button>
          </div>

          {/* ── Delivery Fields ── */}
          {form.fulfillmentType === 'delivery' ? (
            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                  City <span className="text-[var(--shop-red)]">*</span>
                </span>
                <input
                  value={form.deliveryCity}
                  onChange={(e) => onChangeForm('deliveryCity', e.target.value)}
                  className={inputClassName}
                  placeholder="Riga"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                  Address <span className="text-[var(--shop-red)]">*</span>
                </span>
                <input
                  value={form.deliveryAddress}
                  onChange={(e) => onChangeForm('deliveryAddress', e.target.value)}
                  className={inputClassName}
                  placeholder="Street, house, apartment"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                  Delivery Notes
                </span>
                <textarea
                  value={form.deliveryNotes}
                  onChange={(e) => onChangeForm('deliveryNotes', e.target.value)}
                  className={`${inputClassName} min-h-20 resize-y`}
                  placeholder="Please provide entrance code, floor, apartment number, or drop-off details..."
                />
              </label>
            </div>
          ) : (
            /* ── Meetup Fields ── */
            <div className="space-y-4">
              {/* Custom Meetup Location Dropdown */}
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                  Meetup Location <span className="text-[var(--shop-red)]">*</span>
                </span>
                <div className="relative" ref={meetupDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setMeetupDropdownOpen((prev) => !prev)}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm transition-colors ${
                      form.meetupLocation
                        ? 'border-white/10 bg-white/8 text-[var(--shop-cream)]'
                        : 'border-white/10 bg-white/6 text-zinc-500'
                    }`}
                  >
                    <span>
                      {form.meetupLocation
                        ? isCustomLocation && form.deliveryAddress
                          ? form.deliveryAddress
                          : selectedLocationLabel
                        : 'Select a meetup location'}
                    </span>
                    <svg
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className={`h-4 w-4 flex-shrink-0 transition-transform ${meetupDropdownOpen ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    >
          <g transform="translate(2, 2)">

                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                    
          </g>
        </svg>
                  </button>

                  {meetupDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-2xl border border-white/10 bg-[#1a0e1c] shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
                      {MEETUP_LOCATIONS.map((loc) => (
                        <button
                          key={loc.value}
                          type="button"
                          onClick={() => onChangeForm('meetupLocation', loc.value)}
                          className={`flex w-full items-center gap-2 px-4 py-3 text-left text-sm transition-colors hover:bg-white/8 ${
                            form.meetupLocation === loc.value
                              ? 'bg-white/10 text-[var(--shop-cream)]'
                              : 'text-zinc-400'
                          }`}
                        >
                          {form.meetupLocation === loc.value && (
                            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-emerald-300" aria-hidden="true">
          <g transform="translate(2, 2)">

                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            
          </g>
        </svg>
                          )}
                          {loc.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </label>

              {/* Custom location text input (shown when "Other Location" is selected) */}
              {isCustomLocation && (
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                    Specify Location <span className="text-[var(--shop-red)]">*</span>
                  </span>
                  <input
                    value={form.deliveryAddress}
                    onChange={(e) => onChangeForm('deliveryAddress', e.target.value)}
                    className={inputClassName}
                    placeholder="Enter your meetup address..."
                    autoComplete="off"
                  />
                </label>
              )}

              {/* Custom Time Window Dropdown (optional) */}
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                  Time Window
                </span>
                <div className="relative" ref={timeDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setTimeDropdownOpen((prev) => !prev)}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm transition-colors ${
                      form.meetupTimeOption
                        ? 'border-white/10 bg-white/8 text-[var(--shop-cream)]'
                        : 'border-white/10 bg-white/6 text-zinc-500'
                    }`}
                  >
                    <span>
                      {form.meetupTimeOption ? selectedTimeLabel : 'Select a time window (optional)'}
                    </span>
                    <svg
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className={`h-4 w-4 flex-shrink-0 transition-transform ${timeDropdownOpen ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    >
          <g transform="translate(2, 2)">

                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                    
          </g>
        </svg>
                  </button>

                  {timeDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-2xl border border-white/10 bg-[#1a0e1c] shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
                      {TIME_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => onChangeForm('meetupTimeOption', opt.value)}
                          className={`flex w-full items-center gap-2 px-4 py-3 text-left text-sm transition-colors hover:bg-white/8 ${
                            form.meetupTimeOption === opt.value
                              ? 'bg-white/10 text-[var(--shop-cream)]'
                              : 'text-zinc-400'
                          }`}
                        >
                          {form.meetupTimeOption === opt.value && (
                            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-emerald-300" aria-hidden="true">
          <g transform="translate(2, 2)">

                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            
          </g>
        </svg>
                          )}
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {!form.meetupTimeOption && (
                  <p className="mt-1.5 text-[10px] text-zinc-500">
                    You can leave this blank and specify your time preferences in the notes below.
                  </p>
                )}
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                  Meetup Notes
                </span>
                <textarea
                  value={form.meetupNotes}
                  onChange={(e) => onChangeForm('meetupNotes', e.target.value)}
                  className={`${inputClassName} min-h-20 resize-y`}
                  placeholder="Describe land markers or your exact preferred arrival time here..."
                />
              </label>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleGoToPrevStep}
              className="flex-1 rounded-2xl border border-white/10 bg-white/8 px-4 py-3.5 text-xs font-bold uppercase tracking-[0.18em] text-[var(--shop-cream)] transition-all active:scale-[0.98]"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={handleGoToNextStep}
              disabled={isNextDisabled2}
              className="flex-1 rounded-2xl bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] px-4 py-3.5 text-xs font-bold uppercase tracking-[0.18em] text-white shadow-[0_4px_16px_rgba(139,61,255,0.3)] transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Payment, Summary & Final Preview ── */}
      {checkoutStep === 3 && (
        <div className="space-y-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
              Step 3 — Payment & Review
            </p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              Choose payment method and confirm your order.
            </p>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">
              Payment Method
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onChangeForm('paymentMethod', 'meetup_cash')}
                disabled={form.fulfillmentType === 'delivery'}
                className={`rounded-2xl border px-4 py-3.5 text-left text-sm transition-all active:scale-[0.98] ${
                  form.paymentMethod === 'meetup_cash'
                    ? 'border-[var(--shop-red)] bg-[var(--shop-red)]/12 text-[var(--shop-cream)]'
                    : 'border-white/10 bg-white/6 text-[var(--shop-muted)] hover:bg-white/10'
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                <span className="block text-xs font-bold uppercase tracking-[0.16em]">Meetup Cash</span>
                <span className="mt-1 block text-[10px] text-zinc-500">Pay in person</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeForm('paymentMethod', 'usdt')}
                className={`rounded-2xl border px-4 py-3.5 text-left text-sm transition-all active:scale-[0.98] ${
                  form.paymentMethod === 'usdt'
                    ? 'border-[var(--shop-red)] bg-[var(--shop-red)]/12 text-[var(--shop-cream)]'
                    : 'border-white/10 bg-white/6 text-[var(--shop-muted)] hover:bg-white/10'
                }`}
              >
                <span className="block text-xs font-bold uppercase tracking-[0.16em]">USDT (TRC-20)</span>
                <span className="mt-1 block text-[10px] text-zinc-500">Crypto payment</span>
              </button>
            </div>
          </div>

          {/* Promo Code */}
          <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">
              Promo Code
            </p>
            <div className="mt-3 flex items-end gap-3">
              <label className="block min-w-0 flex-1">
                <input
                  value={form.promoCode}
                  onChange={(e) => onChangeForm('promoCode', e.target.value.toUpperCase())}
                  className={inputClassName}
                  placeholder="DROP10"
                />
              </label>
              <button
                type="button"
                onClick={onApplyPromo}
                disabled={isApplyingPromo || isSubmitting}
                className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)] transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isApplyingPromo ? 'Applying...' : 'Apply'}
              </button>
            </div>

            {promoFeedback ? (
              <p className="mt-3 text-sm text-zinc-400">{promoFeedback}</p>
            ) : null}
            {appliedPromo ? (
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">
                Applied {appliedPromo.code} for -{appliedPromo.discountAmount} EUR
              </p>
            ) : null}
            {hasPendingPromoCode ? (
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-red)]">
                Apply this promo code or clear it before checkout.
              </p>
            ) : null}
          </div>

          {/* Order Review - Product Cards */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">
              Order Review
            </p>
            {items.map((item) => (
              <div
                key={item.productId}
                className="flex items-center gap-3 rounded-[20px] border border-white/10 bg-black/15 p-3"
              >
                <div className="h-16 w-14 shrink-0 overflow-hidden rounded-2xl bg-black/20">
                  {item.image ? (
                    <img src={item.image} alt={item.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                      No Img
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--shop-cream)]">{item.name}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-[var(--shop-cream)]">
                  {item.price} {item.currency}
                </span>
              </div>
            ))}
          </div>

          {/* Mini Order Preview Summary */}
          <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Order Summary
            </p>
            <div className="mt-2 space-y-1.5">
              <p className="text-xs text-zinc-400">
                {form.fulfillmentType === 'delivery'
                  ? `Deliver to: ${form.deliveryCity}${form.deliveryAddress ? `, ${form.deliveryAddress}` : ''}`
                  : isCustomLocation && form.deliveryAddress
                    ? `Meetup: ${form.deliveryAddress}`
                    : `Meetup: ${selectedLocationLabel || 'TBD'}`}
                {form.fulfillmentType === 'meetup' && form.meetupTimeOption
                  ? ` — ${selectedTimeLabel}`
                  : ''}
              </p>
              <p className="text-xs text-zinc-400">
                Contact: {form.fullName}
              </p>
              <p className="text-xs text-zinc-400">
                Payment: {form.paymentMethod === 'usdt' ? 'USDT (TRC-20)' : 'Meetup Cash'}
              </p>
            </div>
          </div>

          {/* Final Review - Totals */}
          <div className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(139,61,255,0.14),rgba(255,77,90,0.1))] px-4 py-4">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-sm text-zinc-400">
                <span>Subtotal</span>
                <span>{subtotal} EUR</span>
              </div>
              {appliedPromo ? (
                <div className="flex items-center justify-between text-sm text-zinc-400">
                  <span>Discount</span>
                  <span>-{discountAmount} EUR</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between border-t border-white/10 pt-2.5 text-sm font-semibold text-[var(--shop-cream)]">
                <span>Total</span>
                <span>{total} EUR</span>
              </div>
            </div>
          </div>

          {/* Error message */}
          {errorMessage ? (
            <div className="rounded-2xl bg-[var(--shop-red)]/16 px-4 py-3">
              <p className="text-sm text-[var(--shop-cream)]">{errorMessage}</p>
            </div>
          ) : null}

          {/* Legal disclaimer */}
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/8 px-4 py-3">
            <p className="text-xs leading-5 text-zinc-400">
              By submitting this request, you agree that this is an{' '}
              <strong className="text-zinc-300">order request</strong>, not a final purchase.
              Payment, delivery, returns, and final order confirmation occur on{' '}
              <strong className="text-zinc-300">Depop/Yaga</strong> or by separate agreement
              with the seller. See our{' '}
              <button
                type="button"
                onClick={onOpenPrivacy}
                className="font-semibold underline decoration-[var(--shop-purple)]/50 hover:decoration-[var(--shop-purple)] text-[var(--shop-cream)]"
              >
                Privacy Policy
              </button>
              {' '}and{' '}
              <button
                type="button"
                onClick={onOpenTerms}
                className="font-semibold underline decoration-[var(--shop-purple)]/50 hover:decoration-[var(--shop-purple)] text-[var(--shop-cream)]"
              >
                Terms of Service
              </button>.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleGoToPrevStep}
              className="flex-1 rounded-2xl border border-white/10 bg-white/8 px-4 py-3.5 text-xs font-bold uppercase tracking-[0.18em] text-[var(--shop-cream)] transition-all active:scale-[0.98]"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={hasPendingPromoCode || isSubmitting}
              className="flex-[2] rounded-2xl bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] px-4 py-3.5 text-xs font-bold uppercase tracking-[0.18em] text-white shadow-[0_4px_16px_rgba(139,61,255,0.3)] transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              {isSubmitting ? 'Sending Order Request...' : 'Send Order Request'}
            </button>
          </div>
        </div>
      )}
    </article>
  )
}

const inputClassName =
  'w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-[var(--shop-cream)] outline-none transition placeholder:text-zinc-500/80 focus:border-[var(--shop-red)]'

function getCheckoutSuccessSummary(form: CheckoutForm) {
  if (form.fulfillmentType === 'delivery' && form.paymentMethod === 'usdt') {
    return {
      nextStep:
        'Send the USDT payment, then wait for delivery confirmation in Telegram.',
      detail: `Delivery to ${form.deliveryCity || 'your city'} | ${form.deliveryAddress || 'address pending'}`,
    }
  }

  if (form.fulfillmentType === 'meetup' && form.paymentMethod === 'usdt') {
    return {
      nextStep:
        'Send the USDT payment, then confirm the meetup in Telegram chat.',
      detail: `${formatMeetupLocation(form.meetupLocation)} | ${formatMeetupTime(form.meetupTimeOption)}`,
    }
  }

  return {
    nextStep:
      'Admin will message you in Telegram to confirm the meetup.',
    detail: `${formatMeetupLocation(form.meetupLocation)} | ${formatMeetupTime(form.meetupTimeOption)}`,
  }
}

function formatMeetupLocation(value: string) {
  switch (value) {
    case 'origo_center':
      return 'Origo Center'
    case 'old_town':
      return 'Old Town'
    case 'akropole':
      return 'Akropole'
    default:
      return 'Meetup location not selected'
  }
}

function formatMeetupTime(value: string) {
  switch (value) {
    case 'today_evening':
      return 'Today Evening'
    case 'tomorrow_afternoon':
      return 'Tomorrow Afternoon'
    case 'this_weekend':
      return 'This Weekend'
    default:
      return 'Meetup time not selected'
  }
}
