import type { AppliedPromo } from '../../types/promo'
import type { CartItem, CheckoutForm } from '../../types/cart'

type CheckoutPanelProps = {
  items: CartItem[]
  form: CheckoutForm
  errorMessage: string | null
  isSubmitted: boolean
  orderId: string | null
  promoFeedback: string | null
  appliedPromo: AppliedPromo | null
  isApplyingPromo: boolean
  hasPendingPromoCode: boolean
  onChangeForm: (field: keyof CheckoutForm, value: string) => void
  onApplyPromo: () => void
  onSubmit: () => void
}

export function CheckoutPanel({
  items,
  form,
  errorMessage,
  isSubmitted,
  orderId,
  promoFeedback,
  appliedPromo,
  isApplyingPromo,
  hasPendingPromoCode,
  onChangeForm,
  onApplyPromo,
  onSubmit,
}: CheckoutPanelProps) {
  const subtotal = items.reduce((sum, item) => sum + item.price, 0)
  const discountAmount = appliedPromo?.discountAmount ?? 0
  const total = Math.max(0, subtotal - discountAmount)
  const successSummary = getCheckoutSuccessSummary(form)

  if (isSubmitted) {
    return (
      <article className="rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(139,61,255,0.24),rgba(255,77,90,0.2))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <p className="text-xs font-medium uppercase tracking-[0.28em] text-white/70">
          Order Request Sent
        </p>
        <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[var(--shop-cream)]">
          Mock checkout successful
        </h3>
        <p className="mt-3 text-sm leading-6 text-[var(--shop-cream)]/85">
          {successSummary.description}
        </p>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/75">
          Fulfillment: {form.fulfillmentType === 'delivery' ? 'Delivery' : 'Meetup'}
        </p>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/75">
          Payment: {form.paymentMethod === 'usdt' ? 'USDT' : 'Meetup Cash'}
        </p>
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
        {orderId ? (
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/75">
            Order ID: {orderId}
          </p>
        ) : null}
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
          <p className="mt-3 text-sm leading-6 text-[var(--shop-muted)]">
            Phase 1 uses a mock success flow so we can finish the storefront steps before adding real payment logic.
          </p>
        </div>
        <span className="rounded-full bg-white/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-cream)]">
          Mock Payment
        </span>
      </div>

      <div className="mt-5 space-y-4">
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

        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
            Telegram Handle
          </span>
          <input
            value={form.telegramHandle}
            onChange={(event) => onChangeForm('telegramHandle', event.target.value)}
            className={inputClassName}
            placeholder="@telegram_username"
          />
        </label>

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

        <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
            Fulfillment
          </p>
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
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
            Payment Method
          </p>
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
              disabled={isApplyingPromo}
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

        <div className="rounded-[24px] border border-white/10 bg-white/6 px-4 py-3">
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

        <button
          type="button"
          onClick={onSubmit}
          disabled={hasPendingPromoCode}
          className="w-full rounded-[24px] bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] px-4 py-4 text-sm font-semibold uppercase tracking-[0.16em] text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
        >
          Confirm Mock Checkout
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
