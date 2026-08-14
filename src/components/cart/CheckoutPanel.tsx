import { useCallback, useEffect, useRef, useState } from 'react'

import { triggerHapticNotification } from '../../lib/telegram/webApp'
import { Button } from '../ui/Button'
import { SwipeablePanel } from '../ui/SwipeablePanel'
import { useI18n } from '../../lib/i18n'
import type { TranslateFn } from '../../lib/i18n/translations'
import type { AppliedPromo } from '../../types/promo'
import type {
  CartItem,
  CheckoutForm,
  CheckoutSubmitState,
  CheckoutSuccessSnapshot,
} from '../../types/cart'

const MEETUP_LOCATIONS = [
  { value: 'origo_center', labelKey: 'loc.origoCenter' },
  { value: 'old_town', labelKey: 'loc.oldTown' },
  { value: 'akropole', labelKey: 'loc.akropole' },
  { value: '__other__', labelKey: 'loc.other' },
] as const

const TIME_OPTIONS = [
  { value: 'today_evening', labelKey: 'time.todayEvening' },
  { value: 'tomorrow_afternoon', labelKey: 'time.tomorrowAfternoon' },
  { value: 'this_weekend', labelKey: 'time.thisWeekend' },
  { value: '__other__', labelKey: 'time.other' },
] as const

type CheckoutPanelProps = {
  items: CartItem[]
  form: CheckoutForm
  fieldErrors: Partial<Record<keyof CheckoutForm, string>>
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
  onRemoveItem: (productId: string) => void
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
  fieldErrors = {},
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
  onRemoveItem,
  onViewOrders,
  onBackToCatalog,
  onOpenPrivacy,
  onOpenTerms,
  checkoutStep,
  onCheckoutStepChange,
}: CheckoutPanelProps) {
  const { t } = useI18n()
  const isSubmitting = submitState === 'submitting'
  const subtotal = items.reduce((sum, item) => sum + item.price, 0)
  const discountAmount = appliedPromo?.discountAmount ?? 0
  const total = Math.max(0, subtotal - discountAmount)
  const successForm = successSnapshot?.form ?? form
  const successItems = successSnapshot?.items ?? items
  const successTotal = successSnapshot?.total ?? total
  const successSummary = getCheckoutSuccessSummary(successForm, t)
  const successFlow = [
    {
      label: t('co.successStep1'),
      detail: t('co.successStep1Detail'),
      isActive: true,
    },
    {
      label: successForm.paymentMethod === 'usdt' ? t('co.successStep2Usdt') : t('co.successStep2Admin'),
      detail:
        successForm.paymentMethod === 'usdt'
          ? t('co.successStep2DetailPayment')
          : successForm.fulfillmentType === 'delivery'
            ? t('co.successStep2DetailDelivery')
            : t('co.successStep2DetailMeetup'),
      isActive: false,
    },
    {
      label:
        successForm.fulfillmentType === 'delivery'
          ? t('co.successStep3Delivery')
          : t('co.successStep3Meetup'),
      detail: t('co.successStep3Detail'),
      isActive: false,
    },
  ]

  const [meetupDropdownOpen, setMeetupDropdownOpen] = useState(false)
  const [timeDropdownOpen, setTimeDropdownOpen] = useState(false)
  const meetupDropdownRef = useRef<HTMLDivElement>(null)
  const timeDropdownRef = useRef<HTMLDivElement>(null)
  const meetupTriggerRef = useRef<HTMLButtonElement>(null)
  const timeTriggerRef = useRef<HTMLButtonElement>(null)
  const meetupOptionRefs = useRef<HTMLButtonElement[]>([])
  const timeOptionRefs = useRef<HTMLButtonElement[]>([])

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

  // Auto-focus first option when meetup dropdown opens
  useEffect(() => {
    if (meetupDropdownOpen && meetupOptionRefs.current.length > 0) {
      meetupOptionRefs.current[0]?.focus()
    }
    if (!meetupDropdownOpen) {
      meetupTriggerRef.current?.focus()
    }
  }, [meetupDropdownOpen])

  // Auto-focus first option when time dropdown opens
  useEffect(() => {
    if (timeDropdownOpen && timeOptionRefs.current.length > 0) {
      timeOptionRefs.current[0]?.focus()
    }
    if (!timeDropdownOpen) {
      timeTriggerRef.current?.focus()
    }
  }, [timeDropdownOpen])

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
      label: t('co.stepContact'),
      isValid: Boolean(form.fullName.trim()) && Boolean(form.telegramHandle.trim()),
    },
    {
      label: t('co.stepFulfillment'),
      isValid:
        form.fulfillmentType === 'delivery'
          ? Boolean(form.deliveryCity.trim() && form.deliveryAddress.trim())
          : Boolean(form.meetupLocation.trim()),
    },
    {
      label: t('co.stepPayment'),
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

  // ── Field-level error helpers ──

  function fieldClass(field: keyof CheckoutForm): string {
    const hasError = fieldErrors[field]
    return 'w-full rounded-2xl border bg-white/8 px-4 py-3 text-sm text-[var(--shop-cream)] outline-none transition placeholder:text-zinc-400/80' +
      (hasError ? ' border-[var(--shop-red)]' : ' border-white/10') +
      ' focus:border-[var(--shop-red)]'
  }

  function inlineFieldError(field: keyof CheckoutForm) {
    const message = fieldErrors[field]
    if (!message) return null
    return <p className="mt-1.5 text-[11px] font-medium text-[var(--shop-red)]">{message}</p>
  }

  // ── Label helpers ──

  const selectedLocation = MEETUP_LOCATIONS.find((loc) => loc.value === form.meetupLocation)
  const selectedLocationLabel = selectedLocation ? t(selectedLocation.labelKey) : ''
  const selectedTime = TIME_OPTIONS.find((opt) => opt.value === form.meetupTimeOption)
  const selectedTimeLabel = selectedTime ? t(selectedTime.labelKey) : ''
  const isCustomLocation = form.meetupLocation === '__other__'
  const isCustomTime = form.meetupTimeOption === '__other__'

  // ── Render success state ──

  if (isSubmitted) {
    return (
      <SwipeablePanel onDismiss={onBackToCatalog} threshold={140}>
        <article className="rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(139,61,255,0.24),rgba(255,77,90,0.2))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-white/70">
                {t('co.successKicker')}
              </p>
              <h3 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--shop-cream)]">
                {t('co.successTitle')}
              </h3>
            </div>
            <span className="w-fit rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]">
              {t('co.successAwaiting')}
            </span>
          </div>
        </div>

        <div className="mt-5 rounded-[24px] border border-white/10 bg-black/15 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70">
                {t('co.successRequestStatus')}
              </p>
            </div>
            <span className="rounded-full bg-emerald-300/18 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
              {t('co.successLive')}
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
              {t('co.fulfillment')}
            </p>
            <p className="mt-2 text-sm font-semibold text-[var(--shop-cream)]">
              {successForm.fulfillmentType === 'delivery' ? t('co.delivery') : t('co.meetup')}
            </p>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-black/15 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/65">
              {t('co.payment')}
            </p>
            <p className="mt-2 text-sm font-semibold text-[var(--shop-cream)]">
              {successForm.paymentMethod === 'usdt' ? t('co.usdt') : t('co.meetupCash')}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-[24px] border border-white/10 bg-black/15 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70">
            {t('co.nextStep')}
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
            {t('co.orderSnapshot')}
          </p>
          <div className="mt-3 space-y-2 text-sm text-[var(--shop-cream)]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-white/70">{t('co.items')}</span>
              <span>{successItems.length}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-white/70">{t('co.total')}</span>
              <span>{successTotal} EUR</span>
            </div>
            {orderId ? (
              <div className="flex items-start justify-between gap-3">
                <span className="text-white/70">{t('co.orderId')}</span>
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
              {t('co.orderItems')}
            </p>
            <span className="rounded-full bg-white/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]">
              {t('co.totalCount', { n: successItems.length })}
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
                      {t('co.noImg')}
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
            {t('co.viewOrders')}
          </button>
          <button
            type="button"
            onClick={onBackToCatalog}
          className="rounded-[24px] bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-white"
        >
          {t('co.backCatalog')}
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
                        : 'bg-white/8 text-zinc-400'
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
              {t('co.step1Kicker')}
            </p>
            <p className="mt-1 text-xs leading-5 text-zinc-400">
              {t('co.step1Hint')}
            </p>
          </div>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
              {t('co.fullName')} <span className="text-[var(--shop-red)]">*</span>
            </span>
            <input
              value={form.fullName}
              onChange={(e) => onChangeForm('fullName', e.target.value)}
              className={fieldClass('fullName')}
              placeholder={t('co.namePlaceholder')}
              autoComplete="name"
            />
            {inlineFieldError('fullName')}
          </label>

          <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3">
            <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
              {t('co.telegramAccount')} <span className="text-[var(--shop-red)]">*</span>
            </span>
            <p className="mt-2 text-sm font-semibold text-[var(--shop-cream)]">
              {telegramUserLabel}
            </p>
            <p className="mt-1 text-[10px] leading-4 text-zinc-400">
              {telegramContactHint}
            </p>
          </div>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
              {t('co.note')}
            </span>
            <textarea
              value={form.note}
              onChange={(e) => onChangeForm('note', e.target.value)}
              className={`${inputClassName} min-h-24 resize-y`}
              placeholder={t('co.notePlaceholder')}
            />
          </label>

          <div className="flex gap-3 pt-2">
            {checkoutStep > 1 && (
              <Button variant="secondary" size="md" onClick={handleGoToPrevStep} className="flex-1">
                {t('co.back')}
              </Button>
            )}
            <Button variant="primary" size="md" disabled={isNextDisabled1} onClick={handleGoToNextStep} className="flex-1">
              {t('co.next')}
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Fulfillment Method ── */}
      {checkoutStep === 2 && (
        <div className="space-y-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
              {t('co.step2Kicker')}
            </p>
            <p className="mt-1 text-xs leading-5 text-zinc-400">
              {t('co.step2Hint')}
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
              <span className="block text-xs font-bold uppercase tracking-[0.16em]">{t('co.meetup')}</span>
              <span className="mt-1 block text-[10px] text-zinc-400">{t('co.meetupDesc')}</span>
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
              <span className="block text-xs font-bold uppercase tracking-[0.16em]">{t('co.delivery')}</span>
              <span className="mt-1 block text-[10px] text-zinc-400">{t('co.deliveryDesc')}</span>
            </button>
          </div>

          {/* ── Delivery Fields ── */}
          {form.fulfillmentType === 'delivery' ? (
            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                  {t('co.city')} <span className="text-[var(--shop-red)]">*</span>
                </span>
                <input
                  value={form.deliveryCity}
                  onChange={(e) => onChangeForm('deliveryCity', e.target.value)}
                  className={fieldClass('deliveryCity')}
                  placeholder="Riga"
                />
                {inlineFieldError('deliveryCity')}
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                  {t('co.address')} <span className="text-[var(--shop-red)]">*</span>
                </span>
                <input
                  value={form.deliveryAddress}
                  onChange={(e) => onChangeForm('deliveryAddress', e.target.value)}
                  className={fieldClass('deliveryAddress')}
                  placeholder={t('co.addressPlaceholder')}
                />
                {inlineFieldError('deliveryAddress')}
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                  {t('co.deliveryNotes')}
                </span>
                <textarea
                  value={form.deliveryNotes}
                  onChange={(e) => onChangeForm('deliveryNotes', e.target.value)}
                  className={`${inputClassName} min-h-20 resize-y`}
                  placeholder={t('co.deliveryNotesPlaceholder')}
                />
              </label>
            </div>
          ) : (
            /* ── Meetup Fields ── */
            <div className="space-y-4">
              {/* Custom Meetup Location Dropdown */}
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                  {t('co.meetupLocation')} <span className="text-[var(--shop-red)]">*</span>
                </span>
                <div className="relative" ref={meetupDropdownRef}>
                  <button
                    ref={meetupTriggerRef}
                    type="button"
                    onClick={() => setMeetupDropdownOpen((prev) => !prev)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault()
                        setMeetupDropdownOpen(true)
                      }
                      if (e.key === 'Escape') {
                        setMeetupDropdownOpen(false)
                      }
                      // Enter/Space handled natively by onClick on <button>
                    }}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-[var(--shop-purple)]/40 ${
                      form.meetupLocation
                        ? fieldErrors?.meetupLocation
                          ? 'border-[var(--shop-red)] bg-white/8 text-[var(--shop-cream)]'
                          : 'border-white/10 bg-white/8 text-[var(--shop-cream)]'
                        : fieldErrors?.meetupLocation
                          ? 'border-[var(--shop-red)] bg-white/6 text-zinc-400'
                          : 'border-white/10 bg-white/6 text-zinc-400'
                    }`}
                  >
                    <span>
                      {form.meetupLocation
                        ? isCustomLocation && form.deliveryAddress
                          ? form.deliveryAddress
                          : selectedLocationLabel
                        : t('co.selectLocation')}
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
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-2xl border border-white/10 bg-[var(--shop-dropdown)] shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
                      {MEETUP_LOCATIONS.map((loc, index) => (
                        <button
                          key={loc.value}
                          ref={(el) => {
                            if (el) meetupOptionRefs.current[index] = el
                          }}
                          type="button"
                          onClick={() => {
                            onChangeForm('meetupLocation', loc.value)
                            setMeetupDropdownOpen(false)
                            meetupTriggerRef.current?.focus()
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'ArrowDown') {
                              e.preventDefault()
                              const next = index + 1
                              if (next < MEETUP_LOCATIONS.length) {
                                meetupOptionRefs.current[next]?.focus()
                              } else {
                                meetupOptionRefs.current[0]?.focus()
                              }
                            }
                            if (e.key === 'ArrowUp') {
                              e.preventDefault()
                              const prev = index - 1
                              if (prev >= 0) {
                                meetupOptionRefs.current[prev]?.focus()
                              } else {
                                meetupTriggerRef.current?.focus()
                              }
                            }
                            if (e.key === 'Escape') {
                              e.preventDefault()
                              setMeetupDropdownOpen(false)
                              meetupTriggerRef.current?.focus()
                            }
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              onChangeForm('meetupLocation', loc.value)
                              setMeetupDropdownOpen(false)
                              meetupTriggerRef.current?.focus()
                            }
                          }}
                          className={`flex w-full items-center gap-2 px-4 py-3 text-left text-sm transition-colors hover:bg-white/8 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--shop-purple)]/40 ${
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
                          {t(loc.labelKey)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {inlineFieldError('meetupLocation')}
              </label>

              {/* Custom location text input (shown when "Other Location" is selected) */}
              {isCustomLocation && (
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                    {t('co.specifyLocation')} <span className="text-[var(--shop-red)]">*</span>
                  </span>
                  <input
                    value={form.deliveryAddress}
                    onChange={(e) => onChangeForm('deliveryAddress', e.target.value)}
                    className={fieldClass('deliveryAddress')}
                    placeholder={t('co.meetupAddressPlaceholder')}
                    maxLength={80}
                    autoComplete="off"
                  />
                  {inlineFieldError('deliveryAddress')}
                </label>
              )}

              {/* Custom Time Window Dropdown (optional) */}
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                  {t('co.timeWindow')}
                </span>
                <div className="relative" ref={timeDropdownRef}>
                  <button
                    ref={timeTriggerRef}
                    type="button"
                    onClick={() => setTimeDropdownOpen((prev) => !prev)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault()
                        setTimeDropdownOpen(true)
                      }
                      if (e.key === 'Escape') {
                        setTimeDropdownOpen(false)
                      }
                      // Enter/Space handled natively by onClick on <button>
                    }}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-[var(--shop-purple)]/40 ${
                      form.meetupTimeOption
                        ? 'border-white/10 bg-white/8 text-[var(--shop-cream)]'
                        : 'border-white/10 bg-white/6 text-zinc-400'
                    }`}
                  >
                    <span>
                      {form.meetupTimeOption
                        ? isCustomTime && form.meetupTimeCustom
                          ? form.meetupTimeCustom
                          : selectedTimeLabel
                        : t('co.selectTime')}
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
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-2xl border border-white/10 bg-[var(--shop-dropdown)] shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
                      {TIME_OPTIONS.map((opt, index) => (
                        <button
                          key={opt.value}
                          ref={(el) => {
                            if (el) timeOptionRefs.current[index] = el
                          }}
                          type="button"
                          onClick={() => {
                            onChangeForm('meetupTimeOption', opt.value)
                            setTimeDropdownOpen(false)
                            timeTriggerRef.current?.focus()
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'ArrowDown') {
                              e.preventDefault()
                              const next = index + 1
                              if (next < TIME_OPTIONS.length) {
                                timeOptionRefs.current[next]?.focus()
                              } else {
                                timeOptionRefs.current[0]?.focus()
                              }
                            }
                            if (e.key === 'ArrowUp') {
                              e.preventDefault()
                              const prev = index - 1
                              if (prev >= 0) {
                                timeOptionRefs.current[prev]?.focus()
                              } else {
                                timeTriggerRef.current?.focus()
                              }
                            }
                            if (e.key === 'Escape') {
                              e.preventDefault()
                              setTimeDropdownOpen(false)
                              timeTriggerRef.current?.focus()
                            }
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              onChangeForm('meetupTimeOption', opt.value)
                              setTimeDropdownOpen(false)
                              timeTriggerRef.current?.focus()
                            }
                          }}
                          className={`flex w-full items-center gap-2 px-4 py-3 text-left text-sm transition-colors hover:bg-white/8 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--shop-purple)]/40 ${
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
                          {t(opt.labelKey)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {!form.meetupTimeOption && (
                  <p className="mt-1.5 text-[10px] text-zinc-400">
                    {t('co.timeHint')}
                  </p>
                )}
              </label>

              {/* Custom time text input (shown when "Other Time" is selected) */}
              {isCustomTime && (
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                    {t('co.specifyTime')} <span className="text-[var(--shop-red)]">*</span>
                  </span>
                  <input
                    value={form.meetupTimeCustom}
                    onChange={(e) => onChangeForm('meetupTimeCustom', e.target.value)}
                    className={inputClassName}
                    placeholder={t('co.timePlaceholder')}
                    maxLength={80}
                    autoComplete="off"
                  />
                  {inlineFieldError('meetupTimeCustom')}
                </label>
              )}

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                  {t('co.meetupNotes')}
                </span>
                <textarea
                  value={form.meetupNotes}
                  onChange={(e) => onChangeForm('meetupNotes', e.target.value)}
                  className={`${inputClassName} min-h-20 resize-y`}
                  placeholder={t('co.meetupNotesPlaceholder')}
                />
              </label>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" size="md" onClick={handleGoToPrevStep} className="flex-1">
              {t('co.back')}
            </Button>
            <Button variant="primary" size="md" disabled={isNextDisabled2} onClick={handleGoToNextStep} className="flex-1">
              {t('co.next')}
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Payment, Summary & Final Preview ── */}
      {checkoutStep === 3 && (
        <div className="space-y-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
              {t('co.step3Kicker')}
            </p>
            <p className="mt-1 text-xs leading-5 text-zinc-400">
              {t('co.step3Hint')}
            </p>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">
              {t('co.paymentMethod')}
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
                <span className="block text-xs font-bold uppercase tracking-[0.16em]">{t('co.meetupCash')}</span>
                <span className="mt-1 block text-[10px] text-zinc-400">{t('co.meetupCashDesc')}</span>
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
                <span className="mt-1 block text-[10px] text-zinc-400">{t('co.usdtDesc')}</span>
              </button>
            </div>
          </div>

          {/* Promo Code */}
          <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">
              {t('co.promoCode')}
            </p>
            <div className="mt-3 flex items-end gap-3">
              <label className="block min-w-0 flex-1">
                <input
                  value={form.promoCode}
                  onChange={(e) => onChangeForm('promoCode', e.target.value.toUpperCase())}
                  className={inputClassName}
                  placeholder={t('co.promoPlaceholder')}
                />
              </label>
              <Button
                variant="secondary"
                size="md"
                disabled={isApplyingPromo || isSubmitting}
                onClick={onApplyPromo}
                className="font-semibold tracking-[0.16em]"
              >
                {isApplyingPromo ? t('co.applying') : t('co.apply')}
              </Button>
            </div>

            {promoFeedback ? (
              <p className="mt-3 text-sm text-zinc-400">{promoFeedback}</p>
            ) : null}
            {appliedPromo ? (
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">
                {t('co.appliedPromo', { code: appliedPromo.code, amount: appliedPromo.discountAmount })}
              </p>
            ) : null}
            {hasPendingPromoCode ? (
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-red)]">
                {t('co.pendingPromo')}
              </p>
            ) : null}
          </div>

          {/* Order Review - Product Cards */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">
              {t('co.orderReview')}
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
                    <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.16em] text-zinc-400">
                      {t('co.noImg')}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--shop-cream)]">{item.name}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-[var(--shop-cream)]">
                  {item.price} {item.currency}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveItem(item.productId)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-[var(--shop-red)]/20 hover:text-[var(--shop-red)] active:scale-90"
                  aria-label={t('co.removeAria', { name: item.name })}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                    <g transform="translate(2, 2)">
                      <path fillRule="evenodd" d="M16.5 4.5l-13 13M3.5 4.5l13 13" clipRule="evenodd" />
                    </g>
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* Mini Order Preview Summary */}
          <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
              {t('co.orderSummary')}
            </p>
            <div className="mt-2 space-y-1.5">
              <p className="text-xs text-zinc-400">
                {form.fulfillmentType === 'delivery'
                  ? t('co.deliverTo', {
                      city: form.deliveryCity + (form.deliveryAddress ? `, ${form.deliveryAddress}` : ''),
                    })
                  : isCustomLocation && form.deliveryAddress
                    ? t('co.meetupAt', { location: form.deliveryAddress })
                    : t('co.meetupAt', { location: selectedLocationLabel || t('co.tbd') })}
                {form.fulfillmentType === 'meetup' && form.meetupTimeOption
                  ? ` — ${isCustomTime && form.meetupTimeCustom ? form.meetupTimeCustom : selectedTimeLabel}`
                  : ''}
              </p>
              <p className="text-xs text-zinc-400">
                {t('co.contactLine', { name: form.fullName })}
              </p>
              <p className="text-xs text-zinc-400">
                {t('co.paymentLine', { method: form.paymentMethod === 'usdt' ? 'USDT (TRC-20)' : t('co.meetupCash') })}
              </p>
            </div>
          </div>

          {/* Final Review - Totals */}
          <div className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(139,61,255,0.14),rgba(255,77,90,0.1))] px-4 py-4">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-sm text-zinc-400">
                <span>{t('co.subtotal')}</span>
                <span>{subtotal} EUR</span>
              </div>
              {appliedPromo ? (
                <div className="flex items-center justify-between text-sm text-zinc-400">
                  <span>{t('co.discount')}</span>
                  <span>-{discountAmount} EUR</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between border-t border-white/10 pt-2.5 text-sm font-semibold text-[var(--shop-cream)]">
                <span>{t('co.total')}</span>
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
              {t('co.legalDisclaimer1')}{' '}
              <strong className="text-zinc-300">{t('co.legalRequest')}</strong>
              {t('co.legalDisclaimer2')}{' '}
              <strong className="text-zinc-300">Depop/Yaga</strong> {t('co.legalDisclaimer3')}{' '}
              <button
                type="button"
                onClick={onOpenPrivacy}
                className="font-semibold underline decoration-[var(--shop-purple)]/50 hover:decoration-[var(--shop-purple)] text-[var(--shop-cream)]"
              >
                {t('co.privacy')}
              </button>
              {' '}{t('co.legalAnd')}{' '}
              <button
                type="button"
                onClick={onOpenTerms}
                className="font-semibold underline decoration-[var(--shop-purple)]/50 hover:decoration-[var(--shop-purple)] text-[var(--shop-cream)]"
              >
                {t('co.terms')}
              </button>.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" size="md" onClick={handleGoToPrevStep} className="flex-1">
              {t('co.back')}
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={hasPendingPromoCode || isSubmitting}
              loading={isSubmitting}
              onClick={onSubmit}
              className="flex-[2]"
            >
              {isSubmitting ? t('co.sending') : t('co.send')}
            </Button>
          </div>
        </div>
      )}
    </article>
  )
}

const inputClassName =
  'w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-[var(--shop-cream)] outline-none transition placeholder:text-zinc-400/80 focus:border-[var(--shop-red)]'

function getCheckoutSuccessSummary(form: CheckoutForm, t: TranslateFn) {
  if (form.fulfillmentType === 'delivery' && form.paymentMethod === 'usdt') {
    return {
      nextStep: t('co.summaryUsdtDelivery'),
      detail: t('co.deliveryDetail', {
        city: form.deliveryCity || t('co.yourCity'),
        address: form.deliveryAddress || t('co.addressPending'),
      }),
    }
  }

  if (form.fulfillmentType === 'meetup' && form.paymentMethod === 'usdt') {
    return {
      nextStep: t('co.summaryUsdtMeetup'),
      detail: `${formatMeetupLocation(form.meetupLocation, form.deliveryAddress, t)} | ${formatMeetupTime(form.meetupTimeOption, form.meetupTimeCustom, t)}`,
    }
  }

  return {
    nextStep: t('co.summaryMeetup'),
    detail: `${formatMeetupLocation(form.meetupLocation, form.deliveryAddress, t)} | ${formatMeetupTime(form.meetupTimeOption, form.meetupTimeCustom, t)}`,
  }
}

function formatMeetupLocation(value: string, customLocation: string, t: TranslateFn) {
  switch (value) {
    case 'origo_center':
      return t('loc.origoCenter')
    case 'old_town':
      return t('loc.oldTown')
    case 'akropole':
      return t('loc.akropole')
    case '__other__':
      return customLocation.trim() || t('co.meetupNotSelected')
    default:
      return t('co.meetupNotSelected')
  }
}

function formatMeetupTime(value: string, customTime: string, t: TranslateFn) {
  switch (value) {
    case 'today_evening':
      return t('time.todayEvening')
    case 'tomorrow_afternoon':
      return t('time.tomorrowAfternoon')
    case 'this_weekend':
      return t('time.thisWeekend')
    case '__other__':
      return customTime.trim() || t('co.timeNotSelected')
    default:
      return t('co.timeNotSelected')
  }
}
