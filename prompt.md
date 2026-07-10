The user wants me to do a comprehensive project audit/understanding phase without making any code changes. Let me break this down and start by scanning the codebase thoroughly. I'll spawn multiple agents in parallel to understand different aspects of the project.

Let me start with:
1. File pickers for different areas (Firebase, Telegram, types, UI components)
2. Code searchers for key patterns
3. Reading the main entry files and key docs

Let me spawn these in parallel to be efficient.

I'll start by doing a full repository scan. Let me spawn multiple agents in parallel to understand the different parts of the codebase.

The file-picker agents returned some useful context but also had errors. Let me now read the actual files to build my understanding. I should read the key files directly. Let me start by reading the main entry points, key docs, and important components.

Let me read the actual source files directly to build an accurate understanding.

Let me continue reading the remaining key files to build a complete understanding. I need to read the Firebase functions, Telegram helpers, store route helper, and the key component files.

Let me continue reading the Firebase lib files, Telegram helpers, store route helper, and the key component files.

Now let me read the remaining key component files to complete my understanding.

Let me read the remaining key UI components.

I now have a comprehensive understanding of the entire codebase. Let me compile the full project analysis the user requested. They explicitly asked me NOT to make code changes - only to understand and report. Let me organize my findings.

I've done a full scan of the codebase. Let me now compile the comprehensive analysis.

---

# Full Project Analysis — YungWear Store (tgapp)

---

## 1. High-Level Project Summary

### Product

- **What is this app?** A Telegram Mini App for a small streetwear store ("YungWear") that runs limited drops of one-of-one or small-batch items. Buyers browse a catalog, like and cart products, apply promo codes, and place orders with manual fulfillment (meetup or delivery) and manual payment (cash or USDT).
- **Who is the user?** Two personas: **buyer** — opens the Mini App inside Telegram, browses the current drop, saves liked items, carts products, and submits checkout requests; **admin** — manages products (CRUD, image uploads), promo codes, order status progression, and views broadcast history.
- **Main buyer workflow:** Open app → browse catalog (2-column grid, filter by category/search/sort) → tap product for detail view → like / add to cart → open cart → enter checkout (contact info, meetup/delivery, payment method, promo) → submit order → success screen → track orders.
- **Main admin workflow:** Switch to Admin view → verify Telegram admin identity → navigate Overview/Products/Promos/Orders/Broadcasts tabs → manage products (create/edit/delete, gallery reorder, image upload), promos (create/edit/delete), orders (status updates, copy summaries, message buyers), view broadcast logs.

### Technical Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript 5.9, Vite 7 |
| Styling | Tailwind CSS v4 with custom CSS variables (`--shop-*`) |
| State | React hooks only (`useState`, `useEffect`, `useMemo`, `useRef`, `useCallback`, `lazy`/`Suspense`) — no external state library |
| Backend | Firebase Cloud Functions (v2, Node 22, `firebase-admin`, `firebase-functions`) |
| Database | Firestore (collections: `products`, `orders`, `promoCodes`, `broadcasts`) |
| Storage | Firebase Storage (product images) |
| Auth | Telegram init data verification server-side via HMAC; no Firebase Auth ID tokens |
| Routing | Hash-based (`#/store/catalog`, `#/store/product/<id>`, `#/admin/products`), custom `storeRoute.ts` |
| Tooling | ESLint, `tailwindcss/vite` plugin, `react-router-dom` installed but **not used** (hash routing instead) |

### Telegram Integration Points

- **`src/lib/telegram/webApp.ts`** — reads `window.Telegram.WebApp` for `initData`, user profile, theme params; `getTelegramWebAppState()` is the single entry point.
- **`src/lib/telegram/admin.ts`** — `verifyTelegramAdminAccess()` sends raw `initData` to the backend `/api/verifyTelegramAdmin` endpoint; `canUseBrowserAdminFallback()` allows local dev without Telegram.
- **`functions/src/index.ts`** — `verifyTelegramAdmin` Cloud Function validates HMAC signature, checks `auth_date` expiration, compares user ID against `TELEGRAM_ADMIN_IDS` env var.
- **`telegramBotWebhook`** — handles `/start`, `/store`, `/help` bot commands, sends inline keyboard with Mini App open button.
- **Order status updates** trigger Telegram notification messages to the buyer (`sendTelegramOrderCancelledMessage`, `sendTelegramOrderPaidMessage`, etc.).

### Architecture Notes

| Aspect | Detail |
|---|---|
| State location | **`HomePage.tsx`** is a monolith — ~950 lines containing all state, all derived data, all event handlers, and the full render tree. There are no extracted hooks or provider components beyond `useProducts`. |
| Data flow | Products → `useProducts` hook (Firestore realtime subscription, fresh per reloadToken) → prop-drilled into `StoreCatalogPanel`, `StoreDetailPanel`, `CartPanel`, `CheckoutPanel`, `AdminOverviewPanel`, `ProductAdminPanel`. Cart, likes, checkout form, promo state all live in `HomePage` and are passed as props. |
| Promo/checkout wiring | `handleApplyPromo` in `HomePage` → `getPromoCodeByCode()` (client-side Firestore read) → `validatePromoCode()` (pure function) → sets `appliedPromo`. `handleSubmitCheckout` → `createOrder()` (HTTP POST to Cloud Function `createCheckoutOrder`) → transaction verifies product availability and price, marks products as sold, creates order. |
| Admin views | Lazy-loaded (`lazy(() => import(...))`) panels: `ProductAdminPanel`, `PromoAdminPanel`, `OrderAdminPanel`, `AdminOverviewPanel`, `BroadcastAdminPanel`. Admin navigation is tabs within the HomePage render tree. |
| Admin writes | All admin operations (product upsert/delete, promo upsert/delete, order status update, image upload/delete) go through Cloud Functions, not direct Firestore client writes. Each function verifies `initData` and admin ID. |
| Firebase reads | Products use `onSnapshot` realtime subscription. Promos use direct `getDocs` reads. Broadcasts use direct `getDocs`. Orders are fetched via Cloud Functions. |
| Backend verification | Every privileged endpoint validates Telegram init data with HMAC-SHA256, expiration, and admin allowlist check (`TELEGRAM_ADMIN_IDS`). |

---

## 2. Routing & Screens

### Hash Routing (`src/lib/storeRoute.ts`)

- Pattern: `#/store/<screen>` / `#/store/product/<productId>` / `#/admin/<subView>`
- `readRouteFromHash()` — parses current hash, returns `RouteState`
- `buildRouteHash()` — builds hash from state, synced via `useEffect` + `hashchange` listener
- Route state is owned by `HomePage`; view switching is conditional rendering (e.g. `{storeScreen === 'catalog' ? ...}`)

### Screen Map

| Screen | Component | Description |
|---|---|---|
| `/store/catalog` | `StoreCatalogPanel` | 2-column product grid, search, category/sort/collection filters, like buttons, swipeable images |
| `/store/likes` | `StoreCatalogPanel` | Same panel in "liked" collection mode |
| `/store/product/:id` | `ProductDetailPanel` | Full product detail: image gallery (swipe + thumbnails), price, brand, description, like/add-to-cart, stats |
| `/store/cart` | `CartPanel` | Cart items with images, remove, subtotal, checkout button |
| `/store/checkout` | `CheckoutPanel` | Multi-step form: contact, fulfillment (meetup/delivery), payment method, promo, review, submit |
| `/store/success` | `CheckoutPanel` | Order confirmation screen with next-step summary, order snapshot |
| `/store/orders` | `BuyerOrdersPanel` | Buyer order history with filters, grouping by recency, progress bars, order detail drawer |
| `/admin/overview` | `AdminOverviewPanel` | Stats + nav links to other admin tabs + deployment instructions |
| `/admin/products` | `ProductAdminPanel` | Product CRUD form with image gallery drag-reorder |
| `/admin/promos` | `PromoAdminPanel` | Promo CRUD form with type/value/expiry/limits |
| `/admin/orders` | `OrderAdminPanel` | Order list with search, status filters, action buttons (mark paid/ready/completed/cancel), copy summaries |
| `/admin/broadcasts` | `BroadcastAdminPanel` | Broadcast history list (read-only) |

---

## 3. Feature Implementation Map

### Implemented (fully working)

| Feature | Evidence |
|---|---|
| **Catalog & product list** | `StoreCatalogPanel.tsx` — 2-column grid, server-side sort (latest/trending), category filtering, text search, collection view toggle (all/liked). Realtime Firestore sync via `subscribeToProducts`. |
| **Product detail** | `ProductDetailPanel.tsx` — image gallery (swipe + thumbnail select), price, brand, description, like/add-to-cart buttons, stats cards, drop signal info. |
| **Likes (wishlist)** | `likedProductIds` state + `handleToggleLike` → persisted to localStorage + sent to `updateProductLikesCount` Cloud Function. Liked products section in catalog. |
| **Cart** | `cartItems` state + `handleAddToCart`/`handleRemoveFromCart` → persisted to localStorage + sent to `updateProductCartCount`. `CartPanel`, `StoreStickyCartBar`. |
| **Checkout** | `CheckoutPanel` — full multi-step checkout: contact, fulfillment (meetup/delivery), payment method, promo, review, submit. |
| **Order creation** | `handleSubmitCheckout` → `createOrder()` (POST to `createCheckoutOrder` Cloud Function) → Firestore transaction: verifies product availability/price, marks sold, creates order. Returns `orderId`. |
| **Buyer order history** | `BuyerOrdersPanel` + `BuyerOrderDrawer` — filters (all/active/completed/cancelled), recency grouping, progress steps, status hints, detailed drawer. |
| **Promo codes (read + validate)** | `getPromoCodeByCode()` (Firestore query), `validatePromoCode()` (pure function: checks active, expiry, usage limit, subtotal, caps discount). Both used from `HomePage`. |
| **Admin — products CRUD** | `ProductAdminPanel` — create/edit/delete products, image upload via backend, drag-to-reorder gallery. Backed by `upsertProductAdmin`, `deleteProductsAdmin`, `uploadProductImageAdmin`, `deleteProductImagesAdmin` Cloud Functions. |
| **Admin — promos CRUD** | `PromoAdminPanel` — create/edit/delete promos, delete all inactive. Backed by `upsertPromoCodeAdmin`, `deletePromoCodesAdmin`. |
| **Admin — order management** | `OrderAdminPanel` — list orders with search, status filters, action buttons (mark paid/ready/completed/cancelled), copy order summary/payment note, message buyer link. Backed by `updateOrderStatusAdmin`. |
| **Admin — broadcasts (read)** | `BroadcastAdminPanel` — list broadcast history from Firestore (`listBroadcasts`). |
| **Telegram admin verification** | `verifyTelegramAdminAccess()` + `verifyTelegramAdmin` Cloud Function — HMAC validation, expiration, admin ID check. |
| **Bot commands** | `telegramBotWebhook` — handles `/start`, `/store`, `/help` with inline keyboard buttons. |
| **Firestore + Storage rules** | `firestore.rules` and `storage.rules` files exist (I can inspect them if needed). |
| **Order notifications** | Cloud Functions send Telegram messages to buyer on status changes (cancelled, paid, ready_for_meetup, completed). |

### Partially Implemented

| Feature | Issue |
|---|---|
| **Routing** | `react-router-dom` is installed (`package.json`) but **never imported** — the app uses custom hash routing in `storeRoute.ts`. Dead dependency. |
| **Broadcasts** | Only read-only history view; no UI to **send** broadcasts from the admin panel. The `broadcasts` collection is populated elsewhere (likely bot-side). |
| **Promo usage counting** | `validatePromoCode` checks `usageLimit` but **never decrements it** — the `usageCount` field doesn't exist on the document. Once a promo hits its limit, it stays stuck unless the admin manually resets it. |
| **Likes cross-session** | Liked products persist in `localStorage` but are not synced to Firestore per user — they're device-local. |
| **Cart cross-session** | Cart is `localStorage` only; no server-side cart persistence. |
| **Sold product cleanup** | `deleteSoldProducts` exists but removes products entirely, which also deletes buyer order references to those products (though orders snapshot product data). |
| **Firestore rules** | Files exist but I haven't inspected them — the security plan notes they may need tightening. |
| **Dev mode gating** | `hasTelegramBuyerAccess` gates likes/cart/checkout/orders behind Telegram session. But cart items and likes still persist in localStorage even without Telegram (just not usable). |

### Not Implemented / Placeholder

| Feature | Note |
|---|---|
| **Firebase Auth** | Not used. Auth is entirely via Telegram init data verification. The `firebase/auth` module is not imported in source. |
| **Categories/Brands collections** | Categories are hardcoded as a TypeScript union; brands are `string[]` on products. No separate `categories` or `brands` collections. |
| **Wishlist (user-bound)** | Likes are device-local; no Firestore-backed wishlist per user. |
| **Notify-me / subscriptions** | No `dropSubscriptions` collection or UI for it. |
| **Multi-language** | Not implemented (and explicitly listed as `do not push early`). |
| **Search debounce / auto-complete** | Search is immediate (`onChange`) with no debounce. |
| **Image lazy loading / placeholder** | Images are `<img>` without `loading="lazy"` although they do use fallback content. |
| **Payment integration** | No payment gateway — all payments are manual (meetup cash or manual USDT transfer). |
| **Wallet address for USDT** | Explicitly noted in code: "Wallet address is not wired yet." |
| **Tests** | No test files found anywhere. |
| **CI/CD** | No CI config found. |

---

## 4. UI / UX Notes (no redesign yet)

### Buyer Front

- **Visual design** is polished — dark theme with purple/red gradients, glassmorphism cards, blur effects, consistent border radii, good typography hierarchy. The "streetwear drop" mood is strong.
- **Catalog** is a 2-column grid with "Love" buttons, swipeable images on touch devices, sold overlay, "Hot Now" badge, limited label. Filter bar has search, sort (Latest/Trending), categories, collection toggle (All/Liked).
- **Product detail** has image gallery with thumbnails + touch swipe, stats cards (Attention, Gallery, Drop Date, Availability), like/add-to-cart buttons, urgency copy ("X people already added this piece").
- **Checkout** is a single-page multi-section form with progress indicator, flow steps (Contact → Fulfillment → Payment → Review), promo code section.
- **Buyer orders** has filter tabs, recency groups, progress bar per order, detailed drawer.
- **Debuggish elements that feel "dev-mode":**
  - `getStoreScreenTitle()` and `getStoreScreenDescription()` in `storeRoute.ts` return stylized copy ("Drop Floor", "Piece Focus", "Saved Heat") but these are **never rendered in the UI** (they exist but aren't called anywhere).
  - Console log: `console.log('INIT_DATA', window.Telegram?.WebApp?.initData)` is in `AdminOverviewPanel.tsx`.
  - No-product empty states reference `code` tags and mention Firestore directly ("Add a document to the `products` collection").
  - The "Results" box in the catalog shows technical copy ("Showing X of Y products").
  - `AppShell.tsx` shows a "Telegram" / "Browser" badge that's visible even when not debugging.
  - The `AdminStatusPanel` shows runtime/session debug info (user ID, theme colors, Firebase status, env hints) that's not useful in production.

### Admin Panel

- Admin has a clean tab structure (Overview → Products → Promos → Orders + Broadcasts).
- Overview shows product stats and deployment instructions with command blocks.
- Products panel has a full CRUD form with gallery drag-reorder (pointer events based), image upload, sold cleanup.
- Promos panel is functional but basic — select/create/edit form with validation.
- Orders panel has search, status filters, action buttons, copy-to-clipboard for order summary.
- Broadcasts panel is read-only history with send/fail counts.
- The `AdminStatusPanel` is clearly a debug/onboarding panel that shows Firebase config status, Telegram user info, theme colors — appropriate for development but not for production.

### General Observations

- There's significant **fragmentation** of UI patterns: inline styles in `className` strings, `inputClassName` const at the bottom of files, some buttons use `rounded-2xl`, others `rounded-[24px]` or `rounded-[28px]`.
- The entire app is **mobile-first** with `max-w-md` container, good for Telegram's narrow viewport.
- The `AdminOverviewPanel` emits `console.log('INIT_DATA', ...)` — a leftover debug statement.
- `getStoreScreenTitle`, `getStoreScreenDescription`, `getStoreScreenEyebrow` in `storeRoute.ts` are **defined but never called** anywhere — dead code.

---

## 5. MVP Polish (Near-Term) Roadmap

Small, high-impact tasks that make the store feel more polished without adding major features:

| Task | Files Expected | Type |
|---|---|---|
| 1. **Remove debug `console.log` from `AdminOverviewPanel.tsx`** | `AdminOverviewPanel.tsx` | Pure cleanup (1 line) |
| 2. **Remove unused `getStoreScreenTitle/Description/Eyebrow` from `storeRoute.ts`** (or use them somewhere) | `storeRoute.ts` | Pure logic cleanup |
| 3. **Replace "Add a document to the `products` collection" empty state with user-friendly copy** | `StoreCatalogPanel.tsx` | Pure UI |
| 4. **Add `loading="lazy"` to product images** for better performance | `StoreCatalogPanel.tsx`, `ProductDetailPanel.tsx`, `CartPanel.tsx`, `CheckoutPanel.tsx`, `ProductAdminPanel.tsx` | Pure UI |
| 5. **Tone down the `AdminStatusPanel` debug info** — hide theme color chips, Firebase config tips; keep only session status | `AdminStatusPanel.tsx` | Pure UI |
| 6. **Remove the "Telegram" / "Browser" badge from `AppShell`** or make it invisible unless `import.meta.env.DEV` | `AppShell.tsx` | Pure UI |
| 7. **Remove unused `react-router-dom` dependency** from `package.json` | `package.json` | Pure cleanup |
| 8. **Add promo usage counting** — increment a `usageCount` field when a promo is applied | `functions/src/index.ts`, `executeCreateCheckoutOrder` | Both (backend + schema) |
| 9. **Debounce the catalog search input** for smoother UX | `StoreCatalogPanel.tsx` | Pure UI/logic |

## 6. Admin / Ops Improvements

| Task | Files Expected | Type |
|---|---|---|
| 1. **Add "Send Broadcast" form to admin panel** | `BroadcastAdminPanel.tsx`, possibly a new Cloud Function | Both |
| 2. **Add a way to create/edit the `broadcasts` collection** with text preview and confirmation | `BroadcastAdminPanel.tsx`, `functions/src/index.ts` | Both |
| 3. **Refactor `HomePage.tsx` — extract cart/likes/promo logic into custom hooks** | `HomePage.tsx`, new hooks | Pure logic |
| 4. **Add order filtering by date range in admin orders panel** | `OrderAdminPanel.tsx` | Both |
| 5. **Add Firestore `usageCount` field to promos and increment on checkout** | `functions/src/index.ts`, `promoCodes.ts` types | Logic |
| 6. **Add product image alt text management** | `ProductDetailPanel.tsx`, `ProductAdminPanel.tsx` | UI |

## 7. Future / Nice to Have

| Task | Notes |
|---|---|
| **Server-side wishlist per Telegram user** | Move likes off localStorage into Firestore |
| **Server-side cart persistence** | So cart survives device change |
| **Wishlist notification for drops** | Notify-me when a product becomes available |
| **Payment gateway integration** | Strip/processing for USDT or card payments |
| **Analytics dashboard** | Track views, cart adds, conversions |
| **Multi-brand/brand collection pages** | Expand `brandNames` into a proper collection |
| **Unit / integration tests** | No tests exist anywhere |
| **CI/CD pipeline** | GitHub Actions for lint → build → deploy |

---

## 8. Key Files Reference

| File | Role |
|---|---|
| `src/main.tsx` | Entry point |
| `src/App.tsx` | Renders `HomePage` |
| `src/pages/HomePage.tsx` | **Monolith** — all state, handlers, conditional rendering (~950 lines) |
| `src/index.css` | Tailwind import + design tokens (`--shop-*`) |
| `src/lib/storeRoute.ts` | Custom hash routing |
| `src/lib/telegram/webApp.ts` | Telegram WebApp state reader |
| `src/lib/telegram/admin.ts` | Admin access verification client |
| `src/lib/firebase/config.ts` | Firebase app init |
| `src/lib/firebase/products.ts` | Product read (realtime) + write (HTTP to functions) |
| `src/lib/firebase/orders.ts` | Order CRUD (HTTP to functions) |
| `src/lib/firebase/promoCodes.ts` | Promo read (Firestore) + write (HTTP to functions) + validation |
| `src/lib/firebase/broadcasts.ts` | Broadcast list (Firestore read) |
| `src/lib/firebase/storage.ts` | Image upload/delete (HTTP to functions) |
| `src/hooks/useProducts.ts` | The ONE extracted hook — product subscription |
| `functions/src/index.ts` | All Cloud Functions (admin verify, product CRUD, promo CRUD, order CRUD, checkout, image ops, bot webhook) |
| `FIREBASE_SCHEMA.md` | Accurate schema docs (matches code) |
| `SECURITY_PLAN.md` | Security audit + migration plan (backend admin writes, rule tightening) |
| `AGENTS.md` | Coding agent behavior rules |

---

That's the full picture. No files were modified — this is purely an audit and understanding phase. Ready for your direction on what to tackle next.