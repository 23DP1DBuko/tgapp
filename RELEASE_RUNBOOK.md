# Release-Day Manual Telegram Runbook

**Source of truth:** [`RELEASE_QA_AUDIT.md`](./RELEASE_QA_AUDIT.md) §8 — this runbook mirrors it 1:1 as ordered checkboxes for the release-day pass.

**When to run:** on the deploy you intend to ship, after `firebase deploy` succeeds. Requires a **real Telegram client**, the deployed backend (or emulator with a **real** bot token — browser mock mode cannot pass HMAC, so it is unusable here), and the production webhook configured.

**Rules**
- Run every row **in order**. Any ✘ blocks the final "Ready" stamp — revisit the linked finding and re-run the row.
- Mark each checkbox `[x]` on pass; leave `[ ]` and add a note on fail.
- Record the final tallies in the Results section at the bottom and save this file back into the repo.

---

## 0. Pre-flight checklist

> The first four items are deploy prerequisites documented in `functions/.env.example` (L7).

- [ ] **Functions deployed** — `firebase deploy --only functions` succeeded; every function exported from `functions/src/index.ts` is live (or the emulator runs with a real bot token).
- [ ] **Secrets set** — `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` created via `firebase functions:secrets:set`.
- [ ] **Params set** — `TELEGRAM_ADMIN_IDS` (includes your test admin id), `TELEGRAM_MINI_APP_URL` (deployed Mini App URL), optional `TELEGRAM_INIT_DATA_MAX_AGE_SECONDS`, in `functions/.env`.
- [x] **Webhook configured** — bot webhook points at `https://yungwearapp-6f98d.web.app/api/telegram/webhook` ✔ (getWebhookInfo 2026-08-09: `ok:true`, `pending_update_count:0`). The secret-token match can only be proven by a live `/start` (TM-1).
- [ ] **Admin test data ready** — ≥ 1 product with images (TM-7), a promo code (TM-27/28), a live giveaway with a `telegram_api` task (channel you can join/leave) and a `referral_count` task, an `endAt`-past giveaway, an `early_access_only` giveaway (TM-11–18, TM-20), a saved broadcast (TM-5).
- [ ] **Two Telegram accounts** — admin account + a second "buyer/friend" account (TM-2/3, TM-25, TM-33, TM-34); one opted-in and one opted-out broadcast subscriber (TM-5).
- [ ] **Negative-config rows staged** — TM-6 (missing bot token) runs **last** against an environment where the secret is genuinely absent. NOTE (verified 2026-08-09): even the local Functions emulator resolves `TELEGRAM_BOT_TOKEN` from Secret Manager when the CLI is logged in, so TM-6 requires removing/denying the secret (or a separate project without it) — the emulator alone is not enough. TM-35 (wrong webhook secret) is safe live — wrong header, expect 403 (✔ verified 2026-08-09).

---

## A. Bot webhook & subscriber registry (real bot)

- [x] **TM-1 — `/start` welcome** — Open the bot, send `/start`. **Expect:** store welcome message arrives; `telegramSubscribers` doc created with `telegramUserId`. **✔ PASSED 2026-08-09**
- [x] **TM-2 — `/start ref_<id>`** — Send `/start ref_<friendId>`. **Expect:** welcome arrives; subscriber stores `referredBy: ref_<friendId>`. **✔ PASSED 2026-08-09**
- [x] **TM-3 — Self-referral dropped (H4)** — Send `/start ref_<ownId>` from your own account. **Expect:** no `referredBy` stored; your referral count unaffected. **✔ PASSED 2026-08-09** (tapping your own referral link does nothing — no count, no grant).
- [x] **TM-4 — `/store` / `/help`** — Send both commands. **Expect:** store shortcut + help messages arrive. **✔ PASSED 2026-08-09**
- [x] **TM-5 — Broadcast delivery** — Admin sends a broadcast; check an opted-in and an opted-out user. **Expect:** message arrives for opted-in users only; `allowBroadcasts: false` users get nothing. **✔ PASSED 2026-08-09**
- [ ] **TM-6 — Bot token missing** — Trigger a bot action with no token configured. **Expect:** clean `missing_bot_token` error; no crash. *(Run last, in emulator.)*
- [x] **TM-35 — Webhook secret mismatch** — `curl -X POST <webhook-url> -H "X-Telegram-Bot-Api-Secret-Token: wrong"`. **Expect:** 403 `Forbidden`; no side effects (no subscriber writes, no bot messages). **✔ PASSED 2026-08-09** against production (`https://yungwearapp-6f98d.web.app/api/telegram/webhook` → 403 with wrong header and with no header).

## B. Order lifecycle bot messages (M1)

- [x] **TM-7 — Order created** — Place a real checkout order. **Expect:** "Order confirmed" message with **real newlines** (no literal `\n`), correct items/totals, track link when present. **✔ PASSED 2026-08-09** (message is fine). **Also verify (2026-08-09):** meetup time/place dropdowns now offer an **Other** option that reveals a text input — a custom time/place must appear verbatim on the order (buyer drawer + admin panel), stored in `meetupTimeOption`/`meetupLocation` (≤80 chars) — **Other time/place shipped 2026-08-09; quick re-check on the next order.**
- [x] **TM-8 — Order paid** — Admin marks the order paid. **Expect:** paid message arrives exactly once. **✔ PASSED 2026-08-09**
- [x] **TM-9 — Ready/completed/cancelled** — Admin transitions status each way. **Expect:** correct message per status; each transition sends once. **✔ PASSED 2026-08-09**
- [x] **TM-10 — Totals sanity (H1)** — Compare bot-message totals vs the Firestore order doc. **Expect:** `subtotal - discount = total`, matching server-computed values. **✔ PASSED 2026-08-09** (matches order doc).
- [x] **TM-34 — Reward-code DM (L5)** — Hit a check-in milestone (day 3/7/14/30) and a referral milestone (3/5/10/15 friends). **Expect:** a DM arrives once with the code + label + validity note; re-opening the Rewards screen does **not** re-send; code shown in-app matches the DM. **✔ PASSED 2026-08-09**

## C. Giveaway verification & gates + winner visibility (H6, H5, GW-5, GW-6)

- [ ] **TM-11 — `telegram_api` task pass** — Join the task's channel, tap the task. **Expect:** bot `getChatMember` confirms membership → tickets granted.
- [ ] **TM-12 — `telegram_api` task fail** — Leave the channel, tap the task again. **Expect:** 409 `verification_failed` with the localized message; no tickets.
- [ ] **TM-13 — `telegram_api` misconfigured** — Task with no chat id in `metadata`. **Expect:** always fails closed — never grants.
- [ ] **TM-14 — `referral_count` task pass** — Task without threshold; user has a real referral. **Expect:** tickets granted.
- [ ] **TM-15 — `referral_count` task fail** — User has no referral. **Expect:** `verification_failed`; no tickets.
- [ ] **TM-16 — `referral_count` threshold** — Task with `metadata: "3"`; user has 1 referral. **Expect:** blocked until 3 real referrals; self-referrals don't count.
- [ ] **TM-17 — Ended giveaway (GW-5)** — Set `endAt` in the past (status still `live`), try to join / complete a task. **Expect:** 409 `giveaway_ended`; no entry created, no tickets.
- [ ] **TM-18 — Early-access giveaway (GW-6)** — Join an `early_access_only` giveaway with 0 referrals, then with ≥ 1. **Expect:** first blocked (409 `access_restricted`); with a referral → joins.
- [ ] **TM-19 — Double-join / double-task (H5)** — Rapid double-tap on join and on a task. **Expect:** exactly one entry; task tickets granted exactly once.
- [ ] **TM-20 — Draw** — Admin draws with entries, then draws again. **Expect:** one winner per prize; second draw rejected (`not_live`).
- [ ] **TM-36 — Buyer sees announced winners** — After the draw (TM-20), open the finished giveaway from a **winner's** account, then from a non-winner's. **Expect:** "Winners" section lists each winner as `@username` (or `User #<id>`) with prize + place chip; visible to everyone; status shows finished/announced. No DM is sent — intentional (manual fulfillment, per L1 residual note).

## D. Consent (M5/M3) & identity

- [x] **TM-21 — First launch** — Open the Mini App for a fresh user. **Expect:** consent screen shows; checkbox starts **unchecked**; store blocked until accept. **✔ PASSED 2026-08-09** (incl. in-sheet legal read)
- [ ] **TM-22 — Accept** — Check the box + Continue. **Expect:** `hasAcceptedTerms` recorded server-side; store unlocks; relaunch → no screen (fast-path). **2026-08-09:** accept → **catalog** confirmed ✔ (the fix). **Open finding:** tapping Privacy/Terms inside the sheet opens the doc **in-sheet** (Back button) — fix shipped 2026-08-09 (removed duplicate top buttons, added in-sheet reading + scroll-to-bottom) — **re-test pending.**
- [x] **TM-23 — Withdraw** — Preferences → withdraw consent. **Expect:** consent screen returns on next load. **✔ PASSED 2026-08-09.**
- [x] **TM-24 — API down at launch (M5)** — Turn off network, open the app for a non-consented user. **Expect:** consent screen still shows **with the amber notice**; store stays locked; accepting shows an error, does not unlock. **✔ PASSED 2026-08-09.**
- [x] **TM-25 — Shared device (M3)** — Use as user A (cart, likes, language), then open as user B. **Expect:** B sees their own empty state — no inherited cart/likes/consent. **✔ PASSED 2026-08-09.**
- [x] **TM-26 — Admin access** — Triple-tap with a non-admin and an admin id. **Expect:** server-side verification gates admin-only actions. **✔ PASSED 2026-08-09** (admin id unlocks via triple-tap, non-admin does not).

## E. Checkout integrity (H1–H3, M4)

- [x] **TM-27 — Promo checkout** — Apply a promo and place the order. **Expect:** discount recomputed server-side; totals enforced; promo usage incremented once. **✔ PASSED 2026-08-09** (+1 usage).
- [x] **TM-28 — Promo expires between add and order** — Add an expiring promo to the cart, order after expiry. **Expect:** order rejected; promo not burned. **✔ PASSED 2026-08-09** (expired rejected).
- [x] **TM-29 — Refresh/retry checkout (M4)** — Submit, kill the app before the response, resubmit. **Expect:** same order (`already_exists`); no duplicate order, no double promo burn, no double bot message. **✔ PASSED 2026-08-09.**
- [x] **TM-30 — Status & owner (H2/H3)** — Inspect the created order doc. **Expect:** status starts `new`/`waiting_for_payment`; `telegramUserId` is the **verified** user's id. **✔ PASSED 2026-08-09.**

## F. Daily check-in & referrals

- [x] **TM-31 — Check-in once per day** — Check in twice the same day (incl. refresh). **Expect:** second attempt rejected; exactly one reward. **✔ PASSED 2026-08-09** (same-day button is disabled after check-in; server-side rejection covered by the 163 unit tests).
- [x] **TM-32 — Check-in streak** — Check in on consecutive days. **Expect:** streak increments; the milestone reward (day 3/7/14/30) is created exactly once. **✔ PASSED 2026-08-09** (promo single-use confirmed)
- [x] **TM-33 — Referral end-to-end** — A friend opens `/start ref_<id>` and joins the store. **Expect:** count increments; milestone code granted once at 3/5/10/15. **✔ PASSED 2026-08-09** (Firestore confirmed `referredBy` set). **Note (first-visit lock):** `referredBy` is only written on a subscriber's FIRST contact — a prior plain `/start` permanently blocks later attribution by design (anti re-attribution farming).

---

## Ordering dependencies (why the order above)

- **TM-26** (admin gating) before any admin-triggered row (TM-5, TM-8/9, TM-20).
- **TM-5** needs opted-in/opted-out subscribers created first (Pre-flight).
- **TM-20 → TM-36**: draw before checking buyer-visible winners.
- **TM-33 → TM-34**: referral milestones before the reward-DM check; check-in half of TM-34 needs a fresh-ish account to hit day 3/7/14/30.
- **TM-6** intentionally breaks config — run **last**, in the emulator/copy.

---

## G. Firestore snapshot checklists

> Verify these after the linked rows by opening the collection in the Firestore console (or emulator UI). All client writes to these collections are denied by rules — every doc below is written by a Cloud Function, so any unexpected field or extra doc is a red flag.

### G1. `orders/{clientOrderId}` — after TM-27–30

| Field | Expected | Linked rows |
|---|---|---|
| `clientOrderId` | equals the idempotency key sent by the client | TM-29 |
| `telegramUserId` | the **HMAC-verified** buyer id — never the client-supplied one | TM-30 |
| `status` | `new` (meetup_cash) or `waiting_for_payment` (usdt) — server-derived | TM-30 |
| `subtotal` / `total` | server-computed; `subtotal − discount = total` | TM-27, TM-10 |
| `appliedPromo` | snapshot with `code`, `discountType`, `discountValue`, `discountAmount` | TM-27/28 |
| `createdAt` | server timestamp | — |
| duplicate doc | **none** — same `clientOrderId` reuses this doc (`already_exists`) | TM-29 |

### G2. `promoCodes/{id}` — after TM-27/28 (checkout) and TM-33/34 (milestone grants)

| Field | Expected | Linked rows |
|---|---|---|
| `code` | matches the code shown in-app / DMed; `DAILYxx_<last4>_<rand>` or `REFxx_<last4>_<rand>` | TM-34 |
| `discountType` / `discountValue` | `percentage` + tier value (5/10/15/25) | TM-27, TM-34 |
| `isActive` | `true` | TM-27 |
| `expiresAt` | ≈ 30 days after grant | TM-34 |
| `usageLimit` / `usageCount` | `1` / incremented by exactly 1 after checkout | TM-27/29 |
| duplicate doc per milestone | **none** — each tier granted once, ever | TM-33/34 |

### G3. `giveaways/{id}` + `giveaways/{id}/entries/{telegramUserId}` — after TM-11–20

| Doc / field | Expected | Linked rows |
|---|---|---|
| giveaway `status` | `live` before draw, `finished` after | TM-17/20 |
| giveaway `endAt` | past end date still blocks join/task (409 `giveaway_ended`) | TM-17 |
| giveaway `accessLevel` | `early_access_only` blocks zero-referral joins (409 `access_restricted`) | TM-18 |
| giveaway `entryTasks[]` | each task has `id`, `type`, `label`, `ticketsGranted`, `verifyMethod`, `metadata` (chat id / threshold) | TM-11–16 |
| giveaway `winners[]` | after draw: `telegramUserId`, `telegramUsername`, `productName`, `place` — **exactly one winner per prize** | TM-20 |
| giveaway `drawSeed` / `drawMethod` | `seeded_weighted_ticket` + version 1 (auditable draw) | TM-20 |
| entry doc `{telegramUserId}` | deterministic id; `totalTickets` = base + granted tickets | TM-11–19 |
| entry `completedTaskIds` | each task id present at most once | TM-19 |
| duplicate entry | **none** — double-join returns `already_joined` | TM-19 |

### G4. `userConsent/{telegramUserId}` — after TM-21–24

| Field | Expected | Linked rows |
|---|---|---|
| `hasAcceptedTerms` | `true` after accept, `false` after withdraw | TM-22/23 |
| `acceptedAt` | ISO string, set once on accept | TM-22 |
| `withdrawnAt` | ISO string present after withdraw | TM-23 |
| missing doc | fresh user → `check` returns not-accepted; consent screen shows | TM-21 |

### G5. `telegramSubscribers/{telegramUserId}` — after TM-1–3, TM-33

| Field | Expected | Linked rows |
|---|---|---|
| `telegramUserId` / `chatId` | set after `/start` | TM-1 |
| `referredBy` | `ref_<referrerId>` after `/start ref_<id>`; **absent** for self-referral (`/start ref_<ownId>`) | TM-2/3 |
| `allowBroadcasts` | per user settings (broadcast delivery) | TM-5 |
| `referredBy` not overwritten | stays the original referrer on later visits | TM-33 |

### G6. `referralRewards/{telegramUserId}` — after TM-33/34

| Field | Expected | Linked rows |
|---|---|---|
| key `"3"`, `"5"`, `"10"`, `"15"` | each granted threshold key exists exactly once | TM-33/34 |
| per-key value | `{ promoCode, promoCodeId, grantedAt }` | TM-33/34 |
| `promoCode` | matches the `promoCodes` doc it points to | TM-34 |

---

## Results

> **Status:** live manual pass in progress (production backend, real Telegram accounts). Rows marked ✔ PASSED 2026-08-09 were **verified on device**; unchecked rows are source-code-verified only. **Remaining:** C — giveaway gates (**0/11**, needs the 4 test giveaways), **TM-22**'s in-sheet legal read (**re-test pending** — fix shipped 2026-08-09), and A **TM-6** (token-missing, emulator-only/optional). **2026-08-09 UX note:** giveaway task rows now use a **single button** (first click opens the channel/link; verification runs on return — bot `getChatMember` for channels, honor-grant for social links) — this is the flow to exercise in TM-11/12. Section G (Firestore snapshot checklists) is part of the pass but not tallied below.

| Group | Passed | Failed | Notes |
|-------|--------|--------|-------|
| A. Bot webhook & registry | 6 / 7 | | TM-35/1/2/3/4/5 ✔ (curl 403, /start, /start ref, self-ref dropped, /store, /help, broadcast opt-in/out); TM-6 optional (token-missing, emulator-only) — 2026-08-09 |
| B. Order messages (M1) | 5 / 5 | | TM-7/8/9/10/34 ✔ (order created/paid/status transitions, totals sanity, reward-DM) — 2026-08-09 |
| C. Giveaway gates + winners | 0 / 11 | | needs the 4 test giveaways (channel task, referral task, ended, early-access) |
| D. Consent & identity | 5 / 6 | | TM-21/23/24/25/26 ✔; TM-22 accept→catalog ✔, in-sheet legal read re-test pending (fix shipped) — 2026-08-09 |
| E. Checkout integrity | 4 / 4 | | TM-27/28/29/30 ✔ |
| F. Check-in & referrals | 3 / 3 | | TM-31/32/33 ✔ (same-day blocked, streak via Firestore tweak, referral e2e, promo single-use) — 2026-08-09 |
| **Total** | **23 / 36** | | |

**Tester:** ____________________  **Date:** ____________________  **Backend:** ☐ production  ☐ emulator

**Any ✘ blocks the final "Ready" stamp.** On failure: record the failure, revisit the linked finding (IDs above), re-run the row, and update this file + `RELEASE_QA_AUDIT.md` §8. On completion: all ✔ → update `RELEASE_QA_AUDIT.md` §9 to **READY FOR PUBLIC RELEASE** and save this file back into the repo with the tallies filled in.
