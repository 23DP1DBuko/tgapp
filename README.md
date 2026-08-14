# YungWear — Telegram Mini App Storefront

A mobile-first **Telegram Mini App** for **YungWear**, a small streetwear store focused on limited drops, one-of-one items, and community-driven sales. Buyers browse and check out inside Telegram; the admin runs the whole store (products, orders, promos, giveaways, broadcasts) from the same app.

The app is designed to be small, controlled, and community-focused — not a giant marketplace. Firebase (Firestore, Storage, Cloud Functions, Hosting) powers the backend, and Telegram is the platform.

---

## Features

### Storefront (buyers)

- **Preferences page** (settings menu) — broadcast subscription toggle, language selector (English / Русский / Latviešu, full storefront UI translation), reduced-motion override
- **Product catalog** with category filtering, search, sorting, and grid/list collection views
- **Product detail pages** with multiple images, likes, and a pinned Add-to-cart button
- **Quick view sheet** for fast browsing
- **Cart** — client-side, persisted per Telegram user, with unavailable-item detection
- **Promo codes** — percentage or fixed-amount discounts, validated at checkout
- **Checkout** — delivery or meetup fulfillment, payment via meetup cash or USDT; capture-first, admin fulfills manually
- **Order history** for buyers with status tracking (new → paid → completed, etc.)
- **Likes / wishlist** with unread-like badge
- **Daily check-in** with streak tracking
- **Giveaways** — task-based ticket entries, winner drawing
- **Broadcast opt-in** — subscribe to drop announcements via the Telegram bot (Preferences / Rewards)
- **Upcoming / early-access** product windows
- **Referrals** with tracking and leaderboard
- **Campaign hero carousel** on the home page
- **Online presence** indicator (live user count)
- **GDPR consent flow** — consent screen, privacy policy, terms of service, about page, consent withdrawal
- **Offline detection** banner, error boundaries, retry logic

### Admin panel (verified admins only)

Opened via triple-tap from the storefront; protected by server-side Telegram admin verification.

- **Dashboard** — analytics, product stats
- **Catalog** — product CRUD with Firebase Storage image upload, promo code management
- **Growth** — campaign management, broadcast messages (sent via the Telegram bot)
- **Orders** — list, filter, update status, cancel with reason
- **Rewards** — giveaways, reward tasks, winner drawing

---

## Stack

**Frontend**
- React 19 + TypeScript
- Vite (manual chunk splitting for firebase, react, motion, recharts, icons)
- Tailwind CSS v4 (via `@tailwindcss/vite`)
- `motion` (animations), `recharts` (admin analytics charts), `lucide-react` + inline Heroicons SVGs (icons)
- ESLint 9

**Backend / platform**
- Firebase SDK (`firebase` v12) — Firestore, Storage, Hosting
- Cloud Functions (`firebase-functions` v6, `firebase-admin` v13, Node 22) — all privileged operations
- Telegram Mini App / WebApp SDK (client) + Telegram Bot API (server-side webhook)

---

## Project structure

```text
src/
  App.tsx                      # Root: error boundary, add-to-cart animation provider
  main.tsx                     # React entry
  index.css                    # Design tokens, keyframes, global styles
  pages/
    HomePage.tsx               # Single-page app: navigation, consent, checkout, admin mount
  components/
    ui/        # Button, Input, BottomSheet, SwipeablePanel, CustomSelect, PageHeader,
               # SkeletonCard, NotificationBanner, OfflineBanner, TaskActionButton,
               # ErrorBoundary, CountUp
    layout/    # AppShell (bottom nav, online count)
    product/   # StoreCatalogPanel, ProductDetailPanel, QuickViewSheet, ProductAdminPanel,
               # HoldToCancelButton
    cart/      # CartPanel, CheckoutPanel
    order/     # BuyerOrderDrawer, BuyerOrdersPanel, OrderAdminPanel
    promo/     # PromoAdminPanel
    admin/     # AdminDashboard (+5 tabs), AdminDashboardPanel, AdminStatusPanel
    broadcast/ # BroadcastAdminPanel
    campaign/  # CampaignAdminPanel
    rewards/   # RewardsAdminPanel, RewardsTasksPanel, BuyerGiveawayDetailSheet,
               # ProductPickerModal
    store/     # StoreControlsPanel
    legal/     # ConsentScreen, PrivacyPolicy, TermsOfService, AboutPage
  hooks/       # useCart, useCheckout, useLikes, usePromo, useProducts, useDailyCheckin,
               # useReferral, useOnlineUsers, useStoreNavigation, useProductFiltering,
               # useNetworkStatus, useSwipeToDismiss, useTelegramBackButton, useReducedMotion,
               # useAddToCartAnimation, ...
  lib/
    firebase/  # config, products, orders, promoCodes, campaigns, broadcasts,
               # giveaways, tasks, dailyCheckin, referral, consent, presence,
               # analytics, storage, firestore
    telegram/  # webApp.ts (init + dev fallback + haptics), admin.ts (access verification)
    storage.ts # local/session persistence helpers
    storeRoute.ts  # hash-based routing: #/store/... and #/admin/...
    orderStatus.ts, retry.ts, viewTransition.ts, earlyAccess.ts
  types/       # product, cart, order, promo, campaign, broadcast, rewards, legal
functions/
  src/         # Cloud Functions (TS): index, helpers, products, orders, promoCodes,
               # content, giveaways, checkin, consent, presence
```

### Routing

The app is a single page using **hash-based routing**:

- `#/store/catalog`, `#/store/product/<id>`, `#/store/cart`, `#/store/checkout/<step>`, `#/store/orders`, `#/store/likes`, `#/store/rewards`, plus legal screens (`privacy`, `terms`, `about`)
- `#/admin/<dashboard|catalog|growth|orders|rewards>`

Browser back/forward works through a `hashchange` listener that restores view state.

---

## Development

```bash
npm install        # install frontend deps
npm run dev        # start Vite dev server
npm run build      # typecheck (tsc -b) + production build
npm run lint       # ESLint
npm run preview    # preview the production build
```

Cloud Functions live in `functions/`:

```bash
cd functions
npm install
npm run build      # tsc compile to lib/
```

The app works in a regular browser during development via a fallback in `src/lib/telegram/webApp.ts` — no Telegram required. A dev-mock mode (`VITE_ENABLE_ADMIN_IN_BROWSER=true` on localhost) unlocks the admin panel locally.

---

## Environment variables

Copy `.env.example` to `.env` and fill in values. All Firebase credentials are read from `VITE_FIREBASE_*` variables — never hardcoded.

| Variable | Purpose |
|---|---|
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` | Firebase project config |
| `VITE_TELEGRAM_ADMIN_IDS` | Telegram user IDs allowed to manage the store |
| `VITE_TELEGRAM_BOT_USERNAME`, `VITE_TELEGRAM_BOT_START`, `VITE_TELEGRAM_BOT_STARTAPP` | Bot link used to open the Mini App |
| `VITE_ENABLE_ADMIN_IN_BROWSER` | Dev-only browser admin fallback (localhost only) |
| `VITE_VERIFY_TELEGRAM_ADMIN_URL` | Deployed endpoint for admin verification |

Most Cloud Function endpoints have an optional `VITE_*_URL` override (checkout, orders, promos, products, campaigns, giveaways, tasks, broadcasts, notifications, referrals, consent, settings, uploads, analytics). Defaults point to the Firebase Hosting rewrites below.

Keep secrets out of version control — `.env` is gitignored.

---

## Firebase architecture

### Firestore collections

| Collection | Access |
|---|---|
| `products`, `campaigns`, `giveaways`, `tasks`, `bannerSlides`, `broadcasts` | Public read, client write denied (writes via Functions) |
| `orders`, `promoCodes`, `telegramSubscribers`, `userRewards`, `userConsent`, `userSettings`, `presence` | Client read/write denied — Functions only |

Full document shapes live in [`FIREBASE_SCHEMA.md`](./FIREBASE_SCHEMA.md) and `firestore.rules` / `storage.rules`.

### Cloud Functions (exposed via Hosting rewrites)

- **Auth/admin**: `verifyTelegramAdmin`
- **Checkout**: `createCheckoutOrder` (atomic promo usage + status/owner server-enforced)
- **Orders**: `listBuyerOrders`, `listOrdersAdmin`, `updateOrderStatusAdmin`
- **Catalog**: `upsertProductAdmin`, `deleteProductsAdmin`, `uploadProductImageAdmin`, `deleteProductImagesAdmin`, `upsertPromoCodeAdmin`, `deletePromoCodesAdmin`, `updateProductSignal`
- **Engagement**: `broadcastMessageAdmin`, `sendBroadcast` via bot, `upsertCampaignAdmin`, `deleteCampaignsAdmin`, `reorderCampaignsAdmin`, `uploadBannerImageAdmin`, `upsertGiveawayAdmin`, `deleteGiveawaysAdmin`, `drawGiveawayAdmin`, `joinGiveaway`, `completeGiveawayTask`, `getGiveawayEntries`, `getMyGiveawayEntry`, `upsertTaskAdmin`, `deleteTasksAdmin`, `uploadGiveawayImageAdmin`
- **Rewards/retention**: `dailyCheckin`, `getCheckinStatus`, `getReferralInfo`, `getReferralLeaderboard`
- **Notify**: `toggleBroadcastSubscription` (buyer broadcast opt-in)
- **Telegram**: `telegramBotWebhook` (subscriber registry, broadcasts)
- **Legal**: `acceptTermsHandler`, `updateUserSettingsHandler`
- **Admin**: `getAdminAnalytics`

---

## Telegram integration

- `src/lib/telegram/webApp.ts` centralizes `window.Telegram.WebApp` access (init, viewport, theme, haptics) with a safe browser fallback
- Native Telegram back button is wired via `useTelegramBackButton`
- Buyers are identified by Telegram `initData`; privileged actions (admin, checkout) are verified **server-side** via HMAC-SHA256 (`verifyTelegramAdmin`, etc.)
- Vertical swipe-to-close is disabled inside the Mini App; image context menus are suppressed

---

## Documentation

- [`AGENTS.md`](./AGENTS.md) — working rules for coding agents
- [`PRODUCT.md`](./PRODUCT.md) — product context, positioning, principles
- [`DESIGN.md`](./DESIGN.md) — design system (tokens, typography, motion, components)
- [`FIREBASE_SCHEMA.md`](./FIREBASE_SCHEMA.md) — Firestore collection shapes and rules summary
- [`SECURITY_PLAN.md`](./SECURITY_PLAN.md) — architecture and verification model
- [`SECURITY_REVIEW.md`](./SECURITY_REVIEW.md) — pre-release security/a11y checklist
- `yungwear_*_roadmap.md` / `yungwear_*_structure.md` — historical planning docs; **may be outdated** — trust the code

---

## Security & Compliance

Key security practices:

- All Firebase config values are read from environment variables (`VITE_FIREBASE_*`), never hardcoded
- Telegram `initData` is verified server-side via HMAC-SHA256
- All secrets (bot tokens, API keys) are managed via environment variables or Firebase Secrets, never committed
- `.env` is in `.gitignore`
- Sensitive Firestore collections have client read/write denied; admin operations go through Cloud Functions with backend-verified identity
- Promo validation and usage counting happen atomically in a server-side checkout transaction

### Pre-release checklist

Before every public release, run through the checklist in [`SECURITY_REVIEW.md`](./SECURITY_REVIEW.md):
1. Run OWASP ZAP or similar DAST tool on the deployed app
2. Run SonarQube or similar SAST tool on the codebase
3. Run Lighthouse + axe DevTools on all main pages (no critical/serious WCAG violations)
4. Manually test keyboard navigation and screen reader compatibility
5. Verify all secrets are in environment variables, not in source code
6. Review Firestore and Storage rules for any overly permissive access
7. Perform full manual end-to-end test of all critical flows

---

## Assets & Licensing

### Icons
- UI icons are from **Heroicons** (MIT license) and **Lucide** (ISC license)
- SVG icons are inline in the source code — no external icon CDN dependencies

### Fonts
- The app uses a system font stack (Trebuchet MS / Segoe UI / system-ui) — no custom fonts loaded

### Images
- Product images are original photos of the seller's personal items
- Campaign/giveaway images are uploaded by the admin via the admin panel
- No placeholder images from free stock photo services are used in production code

### Text content
- All product descriptions, campaign text, and UI copy are written for this project
- No copy is copied from external brands or websites

### Third-party services
- **Firebase** (Google Cloud) — data processor for user data. See [Google Cloud DPA](https://cloud.google.com/terms/data-processing-addendum)
- **Telegram** — platform provider. The app runs inside the Telegram Mini App environment

---

## Accessibility (a11y)

The app is built mobile-first with accessibility in mind:
- Interactive elements use native `<button>`/`<a>` or proper `role`, `tabIndex`, and keyboard handlers
- Modal panels close on `Escape`; bottom sheets support drag-to-dismiss
- Meaningful images have descriptive `alt` text
- The app respects `prefers-reduced-motion` (all animation collapses)
- Color contrast targets WCAG 2.1 AA; touch targets aim for 44×44px
- Error states use both color and text, never color alone

### Accessibility testing
Before release:
1. Run **Lighthouse** on all main pages — target: no critical/serious violations
2. Run **axe DevTools** browser extension on the same pages
3. Manually test with keyboard navigation (Tab, Enter, Escape)
4. Test with a screen reader (VoiceOver / NVDA)

---

## Working principles

When contributing:
- inspect the existing code first
- make small, understandable changes
- do not rewrite working systems without a clear reason
- verify each change manually (`npm run build`, `npm run lint`)
- prefer clarity over cleverness
- keep the UI consistent with `DESIGN.md`
- keep security-sensitive flows explicit and server-verified
