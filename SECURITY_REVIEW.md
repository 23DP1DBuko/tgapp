# Security Review — Pre-Release Human Checklist

This document lists checks a human developer must complete **before each public release** of the YungWear Telegram Mini App.

> **Important:** Automated tools (SAST, DAST, axe DevTools) help find issues but do not replace human review. Each check below should be done manually or run with human verification.

---

## Phase 1 — Authentication & Identity

### 1.1 Telegram initData verification
- [ ] Confirm raw `Telegram.WebApp.initData` (not `initDataUnsafe`) is sent to backend for admin actions
- [ ] Confirm HMAC-SHA256 signature validation is performed on the backend
- [ ] Confirm expired initData is rejected (default max age applies)
- [ ] Confirm failed validation returns `401`/`403` with a clear error reason
- [ ] Confirm no client-side admin grant path exists that bypasses backend verification

### 1.2 Admin identity
- [ ] Review the admin allowlist (`TELEGRAM_ADMIN_IDS`) — is it up to date?
- [ ] Confirm revoked admin IDs have been removed from the allowlist
- [ ] Confirm admin status is never read from a client-controlled document field

---

## Phase 2 — Secrets & Configuration

### 2.1 Environment variables
- [ ] Run a `grep` for hardcoded API keys, tokens, or secrets in `src/` and `functions/src/`
  ```bash
  grep -rn "apiKey\|API_KEY\|secret\|SECRET\|token\|TOKEN\|password\|PASSWORD" src/ functions/src/ --include="*.ts" --include="*.tsx"
  ```
- [ ] Verify `.env` file contains all required variables listed in `.env.example`
- [ ] Verify `.env` is listed in `.gitignore`
- [ ] Verify `.env.example` contains **no real secrets** — only placeholder values

### 2.2 Firebase configuration
- [ ] Verify Firebase config values are read from environment variables, not hardcoded:
  ```ts
  // Expected pattern — all from import.meta.env.VITE_FIREBASE_*
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY
  ```
- [ ] Verify Firebase project ID is not exposed in a way that allows cross-project access

---

## Phase 3 — Firestore & Storage Rules

### 3.1 Firestore rules (`firestore.rules`)
- [ ] Review each `match` block — does it allow only the minimum access needed?
- [ ] Confirm client writes to `orders`, `userRewards`, `pollVotes`, `telegramSubscribers`, `productNotifySubscriptions`, `dailyCheckins`, `userConsent`, `userSettings`, `presence` collections are **denied**
- [ ] Confirm admin-only collections (`promoCodes`, `campaigns`, `giveaways`, `tasks`, `broadcasts`, `polls`) have `allow write: if false` for client access
- [ ] Confirm document validation functions (`isProductDocument`, `isOrderDocument`, etc.) exist and are strict
- [ ] Verify no `allow write: if true` rules exist on any collection

### 3.2 Storage rules (`storage.rules`)
- [ ] Confirm product image upload is restricted (only authenticated admin or backend-controlled)
- [ ] Confirm product image delete/overwrite is restricted
- [ ] Confirm no broad wildcard rule that lets any client write to any path

---

## Phase 4 — Accessibility (WCAG 2.2 / EAA)

### 4.1 Automated scan
- [ ] Run **Lighthouse** on all main pages:
  - Catalog (with products loaded)
  - Product detail (with a product selected)
  - Checkout form
  - Rewards page
  - Admin panel (with allowlisted admin)
- [ ] Target: **no critical or serious** accessibility violations

- [ ] Run **axe DevTools** browser extension on the same pages
- [ ] Target: **0 violations** of any severity level

### 4.2 Keyboard navigation
- [ ] Manually tab through the entire app without using a mouse:
  - Tab order should follow visual order
  - All buttons and links must be reachable
  - Focus must be visible at all times
  - Dropdowns/modals must trap focus while open
  - Pressing `Escape` must close open modals, dropdowns, and panels

### 4.3 Screen reader test
- [ ] Test with **VoiceOver** (macOS) or **NVDA** (Windows):
  - All meaningful images have descriptive `alt` text (or `alt=""` for decorative)
  - Buttons have accessible labels
  - Dynamic content changes are announced
  - Error messages are announced

### 4.4 Manual checks
- [ ] All `div`/`span` elements with `onClick` are replaced with `<button>` or `<a>` — or have correct `role`, `tabIndex`, and `onKeyDown` handlers
- [ ] Toggle switches use `role="switch"` with `aria-checked`
- [ ] Color contrast meets WCAG AA (4.5:1 for normal text, 3:1 for large text)
- [ ] App respects `prefers-reduced-motion` — no auto-playing animations when enabled

---

## Phase 5 — Intellectual Property & Assets

### 5.1 Images
- [ ] Verify all product images are original or properly licensed
- [ ] Verify all UI icons (SVGs, logos) are from a known open-source set (e.g., Heroicons, Lucide) or custom originals
- [ ] Verify no placeholder image URLs from unsplash/picsum/photos are in production code
- [ ] If any brand logos or third-party imagery is used, confirm license allows commercial use

### 5.2 Text content
- [ ] Review all product descriptions, campaign text, and slogans for original authorship
- [ ] If AI was used to generate copy, verify it is not identical to known brand copy
- [ ] Verify admin-facing text (labels, error messages) does not contain any confidential information

### 5.3 Fonts & assets
- [ ] Document where fonts come from: system fonts, Google Fonts, or custom
- [ ] If using a non-system font, confirm the license (e.g., SIL Open Font License) allows web use

---

## Phase 6 — Data Privacy (GDPR)

### 6.1 Consent
- [ ] Verify consent screen appears for first-time users
- [ ] Verify consent is not pre-checked
- [ ] Verify consent state is persisted in Firestore (`hasAcceptedTerms`, `acceptedAt`)
- [ ] Verify user can view Privacy Policy and Terms of Service before accepting

### 6.2 User controls
- [ ] Verify broadcast opt-in is off by default (user must explicitly enable)
- [ ] Verify leaderboard visibility toggle works and is respected in the leaderboard UI
- [ ] Verify user can unsubscribe from broadcasts at any time
- [ ] Verify there is a contact method for data deletion requests (About page)

### 6.3 Data retention
- [ ] Review retention periods documented in Privacy Policy match actual data handling
- [ ] Confirm no PII is stored longer than stated in Privacy Policy

---

## Phase 7 — Manual End-to-End Test

### 7.1 Critical flows
- [ ] **Catalog browsing**: Load catalog, filter by category, search, view product detail
- [ ] **Cart & checkout**: Add item to cart, apply promo, submit order request
- [ ] **Rewards**: View giveaways, complete daily check-in, view referral link and leaderboard
- [ ] **Admin**: Log in as admin, create/edit product, manage giveaways, send broadcast
- [ ] **Consent**: Open app as new user → see consent screen → accept → access app

### 7.2 Error handling
- [ ] Submit checkout with invalid data — verify clear error message
- [ ] Submit checkout with expired promo code — verify clear message
- [ ] Load catalog with no network — verify offline/error state
- [ ] Admin panel with non-admin user — verify access denied

### 7.3 Build verification
- [ ] Run `npm run build` — must succeed with zero errors
- [ ] Run `npm run lint` — must pass without errors
- [ ] Run `npx tsc --noEmit` — must have zero type errors

---

## Pre-Release Sign-off

| Role | Name | Date | Signed |
|------|------|------|--------|
| Security review | | | |
| Accessibility review | | | |
| Legal review (Privacy/Terms) | | | |
| Final production deploy | | | |

---

*Generated by AI — human review required before each release.*
