# YungWear Mini App — Modern Mobile Web Roadmap

Give this document directly to the coding agent (opencode / Continue / Qwen). This roadmap covers mobile "feel" — native Telegram integration, gestures, animation, and performance. It complements the feature roadmap; this one is purely about interaction quality and polish.

---

## Rules for the agent

- Do not rewrite unrelated logic — these are UI/interaction layer changes.
- Do not change existing colors, layout structure, or design tokens unless explicitly required by the task.
- Respect `prefers-reduced-motion` for every animation task below.
- Test on both Telegram iOS and Telegram Android WebView if possible — haptics and gestures behave differently between them.
- Each task must be implemented and verified before moving to the next.

---

## PHASE 1 — Native Telegram Feel (do first, cheapest + highest impact)

### 1. Haptic Feedback on Every Meaningful Action

**Task:**
- Add `window.Telegram.WebApp.HapticFeedback.impactOccurred('light')` on: tap product card, add to cart, toggle like, apply filter.
- Add `HapticFeedback.notificationOccurred('success')` on: order placed successfully, promo applied successfully.
- Add `HapticFeedback.notificationOccurred('error')` on: failed checkout validation, promo code invalid, out-of-stock error.
- Add `HapticFeedback.selectionChanged()` on: switching catalog tabs, switching sort mode, switching category filter.

**Complexity:** Low
**Dependencies:** None — Telegram WebApp SDK already available in project.
**Verification:** Every listed action produces the correct haptic type when tested inside real Telegram (not browser fallback).

---

### 2. Disable Accidental Vertical Swipe-to-Close

**Task:**
- Call `window.Telegram.WebApp.disableVerticalSwipes()` on app init.
- Confirm scrolling long product lists/detail pages no longer risks closing the Mini App accidentally.

**Complexity:** Low
**Dependencies:** Task 1 area (Telegram WebApp init code).
**Verification:** Fast vertical scroll/swipe on catalog or product detail does not close the Mini App.

---

### 3. MainButton / BackButton Native Integration

**Task:**
- Replace custom "Back to Catalog" / "Back to Cart" buttons with `Telegram.WebApp.BackButton.show()` and `onClick()` handling.
- Replace primary custom action buttons (Checkout, Place Bid, Apply) with `Telegram.WebApp.MainButton` where appropriate — set `text`, `color`, `show()`, and `onClick()`.
- Ensure MainButton state (enabled/disabled, loading) reflects real form validity (e.g., disabled until required checkout fields are filled).
- Hide BackButton/MainButton when navigating to screens where they don't apply (e.g., root catalog screen has no BackButton).

**Complexity:** Medium
**Dependencies:** Existing routing/screen state (`storeScreen`, `adminSubView`).
**Verification:** Native Telegram back arrow and main button appear/disappear correctly per screen; tapping them triggers correct navigation/action without custom buttons duplicating them.

---

### 4. Viewport-Aware Layout

**Task:**
- Listen to `Telegram.WebApp.onEvent('viewportChanged', ...)`.
- Ensure sticky cart bar, bottom nav, and MainButton reposition or hide correctly when the keyboard opens during checkout form input.
- Ensure no input field is hidden behind the keyboard when focused.

**Complexity:** Medium
**Dependencies:** Task 3 (MainButton), existing sticky cart bar component.
**Verification:** Opening the keyboard on any form (checkout, promo code input) does not visually break the layout or hide the active input.

---

## PHASE 2 — Gestures & Touch Interaction

### 5. Swipeable Product Image Gallery

**Task:**
- Replace static/arrow-button image navigation on product detail with horizontal swipe gesture between images.
- Add small dot indicators showing current image index.
- Support both swipe gesture and tap-on-edge fallback for accessibility.

**Complexity:** Medium
**Dependencies:** Existing product detail image array in product model.
**Verification:** Swiping left/right on product images changes the active image smoothly; dot indicator updates accordingly.

---

### 6. Swipe-to-Dismiss on Modals/Panels

**Task:**
- Add downward swipe-to-close gesture on: Cart panel, Product detail (if presented as overlay/sheet), Checkout success screen.
- Swipe must have a resistance/threshold so accidental small drags don't close the panel.

**Complexity:** Medium
**Dependencies:** Existing modal/panel components (CartPanel, ProductDetailPanel, CheckoutPanel).
**Verification:** Dragging down past threshold closes the panel with animation; small accidental drags do not close it.

---

### 7. Pull-to-Refresh on Catalog

**Task:**
- Add pull-to-refresh gesture at top of catalog list that triggers `reloadProducts()`.
- Show a lightweight loading indicator during refresh, matching app's color scheme (no default browser spinner).

**Complexity:** Medium
**Dependencies:** Existing `useProducts` hook / `reloadProducts` function.
**Verification:** Pulling down at top of catalog list triggers a refresh and shows/hides the custom indicator correctly.

---

### 8. Swipe Actions on Cart Items

**Task:**
- Add swipe-left gesture on each cart line item to reveal a "Remove" action.
- Remove the persistent delete icon/button currently shown on every row (replace with swipe-reveal only, or keep both if space allows).

**Complexity:** Medium
**Dependencies:** Existing CartPanel item rendering and `handleRemoveFromCart`.
**Verification:** Swiping a cart item left reveals remove action; confirming removes the item using existing removal logic.

---

## PHASE 3 — Loading & Motion Polish

### 9. Skeleton Loading for Catalog and Product Detail

**Task:**
- Replace current loading state (spinner/blank) with skeleton placeholders matching final card/layout shape.
- Catalog: skeleton grid of product cards (image block + text lines) shown while `isLoading` is true.
- Product detail: skeleton image + text blocks shown while product data is resolving.
- Use subtle shimmer animation, respecting `prefers-reduced-motion` (static fallback if reduced motion is set).

**Complexity:** Low-Medium
**Dependencies:** Existing `isLoading` state from `useProducts` hook.
**Verification:** Skeletons appear during data fetch and are replaced smoothly once real data loads; shimmer disabled under reduced motion.

---

### 10. Shared Element Transition (Catalog → Product Detail)

**Task:**
- When tapping a product card, animate the card's image growing/morphing into the product detail hero image position, instead of a hard screen cut.
- Use `View Transitions API` if supported, with a graceful fallback (simple fade/slide) where unsupported.

**Complexity:** Medium-High
**Dependencies:** Task 5 (product image gallery), existing catalog → product detail navigation.
**Verification:** Tapping a product card visually transitions the image into the detail view; fallback transition still feels smooth on unsupported browsers/WebViews.

---

### 11. Number Count-Up Animations

**Task:**
- Animate numeric value changes (cart total, referral count, points/rewards balance, likes count) from old value to new value instead of snapping instantly.
- Keep animation duration short (300–500ms) so it doesn't feel sluggish.

**Complexity:** Low
**Dependencies:** Existing state values for cart total, referral count, likes count.
**Verification:** Changing any of these values animates smoothly rather than updating instantly; respects reduced motion (instant update if reduced motion is set).

---

### 12. Add-to-Cart Micro-Animation

**Task:**
- On tapping "Add to Cart," animate a small visual element (product thumbnail or dot) moving from the tapped button toward the cart icon/badge.
- Cart badge count should animate (via Task 11 count-up) immediately after the flying element "lands."

**Complexity:** Medium
**Dependencies:** Task 11 (count-up), existing add-to-cart handler and cart icon position.
**Verification:** Adding an item to cart triggers the fly animation followed by the badge count updating; disabled/simplified under reduced motion.

---

### 13. Staggered List Entrance

**Task:**
- On initial catalog load (after skeleton resolves), animate product cards fading/sliding in with a small stagger delay (e.g., 30–50ms between each card) instead of all appearing simultaneously.
- Limit stagger to first render only — do not restagger on every filter change if it causes perceived lag.

**Complexity:** Low-Medium
**Dependencies:** Task 9 (skeleton loading transition point).
**Verification:** First catalog load shows cards entering with stagger; filter changes update instantly without unnecessary re-stagger delay.

---

## PHASE 4 — Performance & Data Efficiency

### 14. Image Lazy-Loading + WebP/AVIF for Catalog Thumbnails

**Task:**
- Ensure all catalog and product images use `loading="lazy"` and `decoding="async"`.
- Convert/serve product images in WebP or AVIF format where possible (via Firebase Storage processing or upload-time conversion), falling back to original format if unsupported.
- Set explicit `width`/`height` on all image elements to prevent layout shift.

**Complexity:** Medium
**Dependencies:** Existing image upload/storage pipeline.
**Verification:** Network tab shows lazy-loaded images only fetching as they enter viewport; images served in WebP/AVIF where supported; no layout shift (CLS) on image load.

---

### 15. Optimistic UI Updates (Extend Existing Pattern)

**Task:**
- Confirm cart/like actions already behave optimistically (per existing code) — extend the same pattern to: promo code application, reward tier unlock display, referral count increments.
- On failure, roll back the optimistic change and show a clear inline error (already established pattern in `handleAddToCart`/`handleToggleLike`).

**Complexity:** Low-Medium
**Dependencies:** Existing optimistic pattern in cart/likes handlers.
**Verification:** Promo/reward/referral actions update UI immediately, and correctly roll back with an error message if the backend call fails.

---

### 16. Bottom Sheet for Product Quick-View (Instead of Full Page Navigation)

**Task:**
- Add a lightweight bottom sheet component that opens on a secondary "quick view" tap (e.g., long-press or a small icon on the product card), showing key info (image, name, price, add-to-cart) without leaving the catalog scroll position.
- Full product detail page remains available via normal tap for full description/gallery.

**Complexity:** Medium
**Dependencies:** Task 5 (image gallery, reused inside sheet), Task 6 (swipe-to-dismiss, reused for closing the sheet).
**Verification:** Quick view opens as a bottom sheet without losing catalog scroll position; can add to cart directly from the sheet; dismiss via swipe or close button returns to the exact previous scroll state.

---

### 17. Reduced Motion Respect (Global Pass)

**Task:**
- Add a global check for `prefers-reduced-motion: reduce`.
- Disable or simplify: shimmer skeletons (Task 9), shared element transitions (Task 10), count-up animations (Task 11), add-to-cart fly animation (Task 12), staggered entrance (Task 13).
- Under reduced motion, all state changes should apply instantly with at most a simple opacity fade, no movement-based animation.

**Complexity:** Low
**Dependencies:** All animation tasks above (9–13) must already be implemented.
**Verification:** Enabling "Reduce Motion" at the OS level removes all movement-based animation in the app; core functionality remains fully usable.

---

## Sequencing Summary

1. Haptic feedback (Phase 1.1)
2. Disable accidental vertical swipe-to-close (Phase 1.2)
3. MainButton / BackButton integration (Phase 1.3)
4. Viewport-aware layout (Phase 1.4)
5. Swipeable product image gallery (Phase 2.5)
6. Swipe-to-dismiss on modals/panels (Phase 2.6)
7. Pull-to-refresh on catalog (Phase 2.7)
8. Swipe actions on cart items (Phase 2.8)
9. Skeleton loading for catalog and product detail (Phase 3.9)
10. Shared element transition (Phase 3.10)
11. Number count-up animations (Phase 3.11)
12. Add-to-cart micro-animation (Phase 3.12)
13. Staggered list entrance (Phase 3.13)
14. Image lazy-loading + WebP/AVIF (Phase 4.14)
15. Optimistic UI updates extended (Phase 4.15)
16. Bottom sheet for product quick-view (Phase 4.16)
17. Reduced motion respect — global pass (Phase 4.17)

**Core principle for the agent:** Phase 1 tasks are native SDK integrations — cheapest to build and most immediately noticeable as "this feels like a real Telegram app." Phase 2–3 are gesture and motion polish that should only be built once Phase 1 is stable. Phase 4 is performance and accessibility — the reduced motion pass (Task 17) must be done last since it depends on all animation tasks already existing.
