# YungWear Mini App — Roadmap for AI Agent

Give this document directly to the coding agent (opencode / Continue / Qwen). It is written as actionable, sequenced tasks. Do not skip order unless explicitly told to.

---

## Rules for the agent

- Do not rewrite unrelated code.
- Do not change visual style/colors unless a task says so.
- Keep existing Firebase/Telegram patterns already used in the repo.
- Each task must be implemented and verified before moving to the next.
- Ask for clarification only if a task is ambiguous — do not silently skip it.

---

## PHASE 1 — MVP Critical (do first)

### 1. Fix Admin Bottom Navigation (grouping)

**Problem:** Bottom nav has 7 top-level destinations (Dashboard, Products, Orders, Promos, Campaigns, Rewards, Broadcasts). Too many for a mobile bottom bar.

**Task:**
- Reduce bottom nav to 5 groups:
  1. Dashboard
  2. Catalog (contains Products + Promos as top tabs inside the page)
  3. Growth (contains Campaigns + Broadcasts as top tabs inside the page)
  4. Orders
  5. Rewards (contains Rewards + Referrals as top tabs inside the page)
- Each grouped page shows a small tab strip at the top (not a dropdown) to switch between its sub-sections.
- Preserve all existing functionality — this is a navigation/layout change only, not a logic change.

**Complexity:** Low-Medium
**Dependencies:** None
**Verification:** Bottom nav shows exactly 5 items; each grouped page correctly renders its sub-tabs and preserves existing CRUD behavior.

---

### 2. Referral System — Make It Real

**Problem:** Dashboard shows "Referrals: 0" but there is no logic behind it.

**Task:**
- Generate a unique referral code/link per Telegram user.
- Track when a new user opens the app via a referral link (store referredBy on user/order record).
- Increment referrer's referral count in Firestore.
- Display referral count and referral link in the Rewards section.

**Complexity:** Medium
**Dependencies:** Existing Telegram user identification, Firestore.
**Verification:** Opening app via referral link correctly increments referrer's count; link is visible and copyable in UI.

---

### 3. Reward Unlock Logic

**Problem:** Rewards section exists visually but has no real unlock mechanism.

**Task:**
- Define reward tiers based on referral count (e.g., 1 referral = 5% discount code, 3 referrals = early drop access flag on user).
- When a tier is reached, automatically generate/apply the correct promo code to that user via existing Promo system (do not create a second reward currency).
- Show progress toward next tier in Rewards UI.

**Complexity:** Medium
**Dependencies:** Task 2 (Referral System), existing Promo code system.
**Verification:** Reaching a referral threshold auto-generates the correct discount/promo tied to that user.

---

### 4. Waitlist / Notify Me for Sold-Out or Upcoming Products

**Problem:** This is the core reason the Mini App should exist instead of just Depop/Yaga — reserving intent before a drop.

**Task:**
- Add a "Notify Me" button on sold-out products.
- Add a "Notify Me" option for upcoming/unreleased products (admin can mark a product as `upcoming: true` before publishing).
- Store subscriber Telegram IDs per product in Firestore (`notifySubscribers` collection or subcollection).
- When admin marks a product `isAvailable: true` (restock) or publishes an upcoming product, trigger a Telegram broadcast to only the subscribed users for that product (not a broadcast to everyone).

**Complexity:** Medium-High
**Dependencies:** Broadcast system, Firestore, Telegram Bot API access from Functions.
**Verification:** Subscribing to a product stores the record; publishing/restocking triggers a targeted notification only to subscribers of that specific product.

---

## PHASE 2 — Important (do after Phase 1 is stable)

### 5. Early Access Window for Drops

**Task:**
- Add a scheduling field to products: `publicAt` (timestamp) and `earlyAccessAt` (timestamp, earlier than publicAt).
- Users who meet a criteria (e.g., referral tier, liked previous drops, or simply "logged in via Telegram") can view/buy the product between `earlyAccessAt` and `publicAt`.
- After `publicAt`, product is visible to everyone (including outside Mini App via channel post).

**Complexity:** Medium-High
**Dependencies:** Task 3 (Reward tiers), product model changes.
**Verification:** Product is only visible/purchasable to qualifying users during the early access window; becomes public after `publicAt`.

---

### 6. Reserve-for-X-Minutes on Drop Release

**Task:**
- When a user opens a product detail page during a live drop, allow a short reservation hold (e.g., 10–15 minutes) that prevents other Mini App users from checking out the same item.
- Reservation expires automatically and releases the item back to available if checkout isn't completed.
- Use a Firestore transaction or Cloud Function with a TTL/expiry check to avoid race conditions.

**Complexity:** High
**Dependencies:** Product/order Firestore model, Cloud Functions.
**Verification:** Two users attempting to buy the same one-off item cannot both succeed; reservation expires correctly if unused.

---

### 7. Community Voting on Next Drop

**Task:**
- Add a simple poll-like feature where admin posts 2–4 upcoming product concepts (images + names).
- Users vote once per poll.
- Show live vote results to admin only (not public) to avoid gaming interest artificially.

**Complexity:** Medium
**Dependencies:** Firestore, existing product/image handling.
**Verification:** Each Telegram user can vote once per poll; admin can view aggregated results.

---

## PHASE 3 — Nice to Have (only after Phase 1 and 2 are solid)

### 8. Auction Mode for 1-of-1 Pieces

**Task:**
- Add `saleType: 'fixed' | 'auction'` to product model.
- For auction products: store current highest bid, bidder, and auction end time.
- Implement anti-snipe rule (extend auction by X minutes if a bid is placed in the final Y minutes).
- Auction winner is automatically routed to checkout with the final bid amount pre-filled.
- Payment must still go through existing checkout/payment flow — do not build a separate payment path.

**Complexity:** High
**Dependencies:** Product model, Cloud Functions for bid validation, existing checkout flow.
**Verification:** Bids update in real time, anti-snipe extension works, only the final winner can checkout at the winning price.

---

### 9. "YungWear Tap" Mini Game (Tap-to-Earn)

**Task:**
- Build a simple tap counter game screen inside the Mini App.
- Taps accumulate into a points balance per Telegram user (stored in Firestore).
- Points are redeemable directly through the existing Promo code system (e.g., 1000 points = 5% discount code) — do NOT create a second currency/economy disconnected from Promos.
- Add daily tap cap to prevent abuse/bot-tapping.

**Complexity:** Medium-High
**Dependencies:** Existing Promo system, Firestore, anti-abuse rate limiting.
**Verification:** Points accumulate correctly, redemption produces a valid promo code, daily cap prevents unlimited farming.

---

### 10. Daily Check-In Streak

**Task:**
- Simple daily check-in button; consecutive days build a streak.
- Small point/discount reward at streak milestones (3, 7, 14 days).
- Streak resets if a day is missed.

**Complexity:** Low
**Dependencies:** Firestore, existing Promo system.
**Verification:** Streak count increments daily, resets correctly on missed day, milestone rewards trigger correctly.

---

### 11. Leaderboard (Top Referrers / Top Buyers)

**Task:**
- Simple ranked list showing top N users by referral count or total spend.
- Display only Telegram first name/username, not sensitive data.
- Optional opt-out toggle for users who don't want to appear publicly.

**Complexity:** Low-Medium
**Dependencies:** Task 2 (Referrals), existing order data.
**Verification:** Leaderboard correctly ranks users; opted-out users never appear.

---

## Sequencing Summary

1. Fix nav grouping (Phase 1.1)
2. Real referral tracking (Phase 1.2)
3. Reward tier unlocks tied to existing promo system (Phase 1.3)
4. Waitlist/notify-me system (Phase 1.4) — this is the strongest reason the app should exist over Depop/Yaga
5. Early access windows (Phase 2.5)
6. Reservation holds during drops (Phase 2.6)
7. Community voting (Phase 2.7)
8. Auction mode (Phase 3.8) — pick this OR tap-to-earn, not both immediately
9. Tap-to-earn game (Phase 3.9)
10. Daily streak (Phase 3.10)
11. Leaderboard (Phase 3.11)

**Core principle for the agent:** every gamification feature (Tasks 3, 6, 9, 10, 11) must resolve into the existing Promo code system as its reward currency. Never build a second, disconnected economy.
