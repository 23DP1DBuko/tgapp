import type { AppliedPromo } from '../../types/promo'
import type {
  CartItem,
  CheckoutForm,
  CheckoutSubmitState,
  CheckoutSuccessSnapshot,
} from '../../types/cart'

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
  const checkoutFlow = [
    {
      label: 'Contact',
      hint: form.fullName.trim() ? 'Buyer set' : 'Needs name',
      isComplete: Boolean(form.fullName.trim()),
    },
    {
      label: 'Fulfillment',
      hint: form.fulfillmentType === 'delivery' ? 'Delivery route' : 'Meetup route',
      isComplete:
        form.fulfillmentType === 'delivery'
          ? Boolean(form.deliveryCity.trim() && form.deliveryAddress.trim())
          : Boolean(form.meetupLocation && form.meetupTimeOption),
    },
    {
      label: 'Payment',
      hint: form.paymentMethod === 'usdt' ? 'USDT' : 'Cash meetup',
      isComplete: form.paymentMethod === 'usdt' || form.fulfillmentType === 'meetup',
    },
    {
      label: 'Review',
      hint: `${items.length} piece${items.length === 1 ? '' : 's'}`,
      isComplete: items.length > 0 && !hasPendingPromoCode,
    },
  ]

  if (isSubmitted) {
    return (
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

          <div className="rounded-[24px] border border-white/10 bg-black/10 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-white/70">
              Success Mode
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--shop-cream)]/85">
              This piece is off the market now. The next update happens in Telegram follow-up, not in checkout.
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-[var(--shop-cream)]/85">
          {successSummary.description}
        </p>

        <div className="mt-5 rounded-[24px] border border-white/10 bg-black/15 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70">
                Request Status
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--shop-cream)]">
                Your order is locked in and now moves through the follow-up flow inside Telegram.
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
                    <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
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
                  <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/60">
                    Reserved in this order
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
            className="rounded-[24px] bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] px-4 py-4 text-sm font-semibold uppercase tracking-[0.16em] text-white"
          >
            Back To Catalog
          </button>
        </div>
      </article>
    )
  }

  return (
    <article className="rounded-[32px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
            Checkout
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--shop-cream)]">
            Finalize your order
          </h3>
          <p className="mt-3 text-sm leading-6 text-[var(--shop-muted)]">
            Keep it tight: confirm contact, choose fulfillment, choose payment, then send the order request.
          </p>
        </div>
        <span className="rounded-full bg-white/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-cream)]">
          Manual Payment
        </span>
      </div>

      <div className="mt-5 space-y-4">
        <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(139,61,255,0.12),rgba(255,77,90,0.08))] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                Checkout Flow
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--shop-muted)]">
                Keep the last step tight: confirm the path, then send the order request once the review looks clean.
              </p>
            </div>
            <span className="rounded-full bg-white/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]">
              {checkoutFlow.filter((step) => step.isComplete).length}/4 ready
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {checkoutFlow.map((step) => (
              <div key={step.label} className="rounded-[20px] border border-white/10 bg-black/15 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                    {step.label}
                  </p>
                  <span
                    className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] ${
                      step.isComplete
                        ? 'bg-emerald-300/18 text-emerald-100'
                        : 'bg-white/8 text-[var(--shop-muted)]'
                    }`}
                  >
                    {step.isComplete ? 'Ready' : 'Open'}
                  </span>
                </div>
                <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--shop-cream)]">
                  {step.hint}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                Step 1
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--shop-cream)]">
                Contact
              </p>
            </div>
            <span className="rounded-full bg-white/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
              Buyer
            </span>
          </div>

          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                Full Name
              </span>
              <input
                value={form.fullName}
                onChange={(event) => onChangeForm('fullName', event.target.value)}
                className={inputClassName}
                placeholder="Your name"
              />
            </label>

            <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3">
              <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                Telegram Account
              </span>
              <p className="mt-2 text-sm font-semibold text-[var(--shop-cream)]">
                {telegramUserLabel}
              </p>
              <p className="mt-2 text-xs leading-5 text-[var(--shop-muted)]">
                {telegramContactHint}
              </p>
            </div>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                Note
              </span>
              <textarea
                value={form.note}
                onChange={(event) => onChangeForm('note', event.target.value)}
                className={`${inputClassName} min-h-24 resize-y`}
                placeholder="Optional delivery or sizing note"
              />
            </label>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                Step 2
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--shop-cream)]">
                Fulfillment
              </p>
            </div>
            <span className="rounded-full bg-white/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
              {form.fulfillmentType === 'delivery' ? 'Delivery' : 'Meetup'}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onChangeForm('fulfillmentType', 'meetup')}
              className={`rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
                form.fulfillmentType === 'meetup'
                  ? 'border-[var(--shop-red)] bg-[var(--shop-red)]/12 text-[var(--shop-cream)]'
                  : 'border-white/10 bg-white/6 text-[var(--shop-muted)]'
              }`}
            >
              <span className="block font-semibold uppercase tracking-[0.14em]">Meetup</span>
              <span className="mt-2 block text-xs leading-5">
                Pick a meetup location and rough time window.
              </span>
            </button>
            <button
              type="button"
              onClick={() => onChangeForm('fulfillmentType', 'delivery')}
              className={`rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
                form.fulfillmentType === 'delivery'
                  ? 'border-[var(--shop-red)] bg-[var(--shop-red)]/12 text-[var(--shop-cream)]'
                  : 'border-white/10 bg-white/6 text-[var(--shop-muted)]'
              }`}
            >
              <span className="block font-semibold uppercase tracking-[0.14em]">Delivery</span>
              <span className="mt-2 block text-xs leading-5">
                Enter city and address for manual delivery coordination.
              </span>
            </button>
          </div>
        </div>

        {form.fulfillmentType === 'delivery' ? (
          <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
              Delivery Details
            </p>
            <div className="mt-3 space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                  City
                </span>
                <input
                  value={form.deliveryCity}
                  onChange={(event) => onChangeForm('deliveryCity', event.target.value)}
                  className={inputClassName}
                  placeholder="Riga"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                  Address
                </span>
                <input
                  value={form.deliveryAddress}
                  onChange={(event) => onChangeForm('deliveryAddress', event.target.value)}
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
                  onChange={(event) => onChangeForm('deliveryNotes', event.target.value)}
                  className={`${inputClassName} min-h-20 resize-y`}
                  placeholder="Entrance code, floor, extra notes"
                />
              </label>
            </div>
          </div>
        ) : (
          <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
              Meetup Details
            </p>
            <div className="mt-3 space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                  Meetup Location
                </span>
                <select
                  value={form.meetupLocation}
                  onChange={(event) => onChangeForm('meetupLocation', event.target.value)}
                  className={inputClassName}
                >
                  <option value="">Select location</option>
                  <option value="origo_center">Origo Center</option>
                  <option value="old_town">Old Town</option>
                  <option value="akropole">Akropole</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                  Time Window
                </span>
                <select
                  value={form.meetupTimeOption}
                  onChange={(event) => onChangeForm('meetupTimeOption', event.target.value)}
                  className={inputClassName}
                >
                  <option value="">Select time option</option>
                  <option value="today_evening">Today Evening</option>
                  <option value="tomorrow_afternoon">Tomorrow Afternoon</option>
                  <option value="this_weekend">This Weekend</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                  Meetup Notes
                </span>
                <textarea
                  value={form.meetupNotes}
                  onChange={(event) => onChangeForm('meetupNotes', event.target.value)}
                  className={`${inputClassName} min-h-20 resize-y`}
                  placeholder="Extra context for the meetup"
                />
              </label>
            </div>
          </div>
        )}

        <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                Step 3
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--shop-cream)]">
                Payment Method
              </p>
            </div>
            <span className="rounded-full bg-white/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
              {form.paymentMethod === 'usdt' ? 'USDT' : 'Cash'}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onChangeForm('paymentMethod', 'meetup_cash')}
              disabled={form.fulfillmentType === 'delivery'}
              className={`rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
                form.paymentMethod === 'meetup_cash'
                  ? 'border-[var(--shop-red)] bg-[var(--shop-red)]/12 text-[var(--shop-cream)]'
                  : 'border-white/10 bg-white/6 text-[var(--shop-muted)]'
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <span className="block font-semibold uppercase tracking-[0.14em]">
                Meetup Cash
              </span>
              <span className="mt-2 block text-xs leading-5">
                Buyer pays hand to hand when meeting up.
              </span>
            </button>
            <button
              type="button"
              onClick={() => onChangeForm('paymentMethod', 'usdt')}
              className={`rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
                form.paymentMethod === 'usdt'
                  ? 'border-[var(--shop-red)] bg-[var(--shop-red)]/12 text-[var(--shop-cream)]'
                  : 'border-white/10 bg-white/6 text-[var(--shop-muted)]'
              }`}
            >
              <span className="block font-semibold uppercase tracking-[0.14em]">USDT</span>
              <span className="mt-2 block text-xs leading-5">
                Buyer will send crypto manually after checkout.
              </span>
            </button>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                Order Review
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--shop-cream)]">
                Items in this request
              </p>
            </div>
            <span className="rounded-full bg-white/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
              {items.length} pieces
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {items.map((item) => (
              <div
                key={item.productId}
                className="flex items-center gap-3 rounded-[20px] border border-white/10 bg-black/15 p-3"
              >
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-[14px] bg-black/20">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.16em] text-[var(--shop-muted)]">
                      No Img
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--shop-cream)]">
                    {item.name}
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                    Ready for checkout
                  </p>
                </div>
                <span className="text-sm font-semibold text-[var(--shop-cream)]">
                  {item.price} {item.currency}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                Promo
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--shop-cream)]">
                Discount code
              </p>
            </div>
            <span className="rounded-full bg-white/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
              Optional
            </span>
          </div>

          <div className="flex items-end gap-3">
            <label className="block min-w-0 flex-1">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                Promo Code
              </span>
              <input
                value={form.promoCode}
                onChange={(event) =>
                  onChangeForm('promoCode', event.target.value.toUpperCase())
                }
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
            <p className="mt-3 text-sm text-[var(--shop-muted)]">{promoFeedback}</p>
          ) : null}

          {appliedPromo ? (
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]">
              Applied {appliedPromo.code} for -{appliedPromo.discountAmount} EUR
            </p>
          ) : null}

          {hasPendingPromoCode ? (
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-red)]">
              Apply this promo code or clear it before checkout.
            </p>
          ) : null}
        </div>

        <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(139,61,255,0.14),rgba(255,77,90,0.1))] px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
            Final Review
          </p>
          <p className="mt-2 text-xs leading-5 text-[var(--shop-muted)]">
            This request stays tied to your Telegram identity and moves into manual follow-up once submitted.
          </p>
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
            <span>Items</span>
            <span>{items.length}</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm text-[var(--shop-muted)]">
            <span>Subtotal</span>
            <span>{subtotal} EUR</span>
          </div>
          {appliedPromo ? (
            <div className="mt-2 flex items-center justify-between text-sm text-[var(--shop-muted)]">
              <span>Promo</span>
              <span>-{discountAmount} EUR</span>
            </div>
          ) : null}
          <div className="mt-3 flex items-center justify-between text-sm font-semibold text-[var(--shop-cream)]">
            <span>Total</span>
            <span>{total} EUR</span>
          </div>
        </div>

        {errorMessage ? (
          <p className="rounded-2xl bg-[var(--shop-red)]/16 px-4 py-3 text-sm text-[var(--shop-cream)]">
            {errorMessage}
          </p>
        ) : null}

        {isSubmitting ? (
          <div className="rounded-[24px] border border-white/10 bg-white/8 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                  Sending Request
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--shop-cream)]">
                  Locking the piece, saving the order, and moving you into the success screen.
                </p>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]">
                Hold tight
              </span>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onSubmit}
          disabled={hasPendingPromoCode || isSubmitting}
          className="w-full rounded-[24px] bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] px-4 py-4 text-sm font-semibold uppercase tracking-[0.16em] text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Sending Order Request...' : 'Send Order Request'}
        </button>
      </div>
    </article>
  )
}

const inputClassName =
  'w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-[var(--shop-cream)] outline-none transition placeholder:text-[var(--shop-muted)]/70 focus:border-[var(--shop-red)]'

function getCheckoutSuccessSummary(form: CheckoutForm) {
  if (form.fulfillmentType === 'delivery' && form.paymentMethod === 'usdt') {
    return {
      description:
        'Your order was saved and the item was marked as sold. This delivery order is now waiting for payment confirmation.',
      nextStep:
        'Send the USDT payment and wait for delivery confirmation in Telegram chat.',
      detail: `Delivery to ${form.deliveryCity || 'your city'} | ${form.deliveryAddress || 'address pending'}`,
    }
  }

  if (form.fulfillmentType === 'meetup' && form.paymentMethod === 'usdt') {
    return {
      description:
        'Your meetup order was saved and the item was marked as sold. Payment still needs to be confirmed before the meetup is finalized.',
      nextStep:
        'Send the USDT payment first, then confirm the meetup details in Telegram chat.',
      detail: `${formatMeetupLocation(form.meetupLocation)} | ${formatMeetupTime(form.meetupTimeOption)}`,
    }
  }

  return {
    description:
      'Your meetup order was saved and the item was marked as sold. The admin can now coordinate the handoff with you in Telegram chat.',
    nextStep:
      'Wait for the admin to message you and confirm the meetup place and time.',
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
