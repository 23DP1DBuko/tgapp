# LEGAL TODO — Human / Lawyer Review Checklist

## ⚠️ Important

This document lists items that **must be reviewed, completed, or verified by a human (preferably a qualified lawyer)** before the app can be considered legally compliant for public launch. AI has generated drafts and technical structure, but cannot provide legally binding advice.

---

## 1. Business Identity

| Item | Status | Notes |
|------|--------|-------|
| Legal entity type | ✅ CONFIRMED | **Private individual (not registered business)** — the operator is a private person reselling personal items, not a company (SIA, individual entrepreneur, etc.) |
| Legal business name | ⬜ TODO | If desired, a trading name can be listed (e.g. "YungWear") but this is optional for a private individual |
| Registration number | ❌ Not applicable | Private individual — no company registration |
| Registered address | ⬜ TODO | If desired, a contact city/country can be listed (e.g. "Riga, Latvia") |
| VAT number (PVN) | ❌ Not applicable | Private individual selling personal used items — not a registered business for VAT |

**⚠️ Important:** Do NOT invent or assume a formal company registration or VAT status in any legal text. The operator is a **private individual**.

**Affected files:**
- `src/components/legal/AboutPage.tsx` — Contact section
- `src/components/legal/PrivacyPolicy.tsx` — Controller identity section

---

## 2. Privacy Policy — Final Text

| Item | Status | Notes |
|------|--------|-------|
| Draft text reviewed | ⬜ TODO | Current text in `PrivacyPolicy.tsx` is AI-generated draft |
| Data retention periods confirmed | ⬜ TODO | Draft uses default estimates (2 years for orders, 90 days inactivity for check-ins, etc.) — confirm with real policy |
| Data processor list verified | ⬜ TODO | Verify which processors are actually used (Firebase, Telegram, others) |
| Google Cloud DPA link checked | ⬜ TODO | Confirm link is to the correct, current DPA version |
| Data transfer mechanisms confirmed | ⬜ TODO | EU-US Data Privacy Framework adequacy decision or SCCs |
| Cookie / tracking disclosure | ⬜ TODO | If any analytics or tracking is added in the future |
| Right to lodge complaint info | ⬜ TODO | Latvian DPA (Datu valsts inspekcija) contact info — verify correctness |

**Affected file:** `src/components/legal/PrivacyPolicy.tsx`

---

## 3. Terms of Service — Final Text

| Item | Status | Notes |
|------|--------|-------|
| Draft text reviewed | ⬜ TODO | Current text in `TermsOfService.tsx` is AI-generated draft |
| Depop/Yaga disclaimer wording | ⬜ TODO | Confirm that the legal relationship with Depop/Yaga is accurately described |
| Giveaway rules finalized | ⬜ TODO | Verify: winner selection, response time, prize fulfilment process |
| Promo code rules finalized | ⬜ TODO | Confirm conditions, revocation rights, expiry rules |
| Consumer rights disclaimer | ⬜ TODO | Ensure consistency with Latvian Consumer Rights Protection Law (Patērētāju tiesību aizsardzības likums) |
| Governing law clause | ⬜ TODO | Confirm Latvia is the correct jurisdiction |
| Limitation of liability | ⬜ TODO | Ensure it's enforceable under Latvian law |
| User conduct clause | ⬜ TODO | Verify scope and enforceability |

**Affected file:** `src/components/legal/TermsOfService.tsx`

---

## 4. Consent Mechanism

| Item | Status | Notes |
|------|--------|-------|
| Consent checkbox is NOT pre-checked | ✅ DONE | Implemented in `ConsentScreen.tsx` |
| Consent is stored server-side | ✅ DONE | Cloud Function deployed — writes to `userConsent` collection via `POST /api/user/consent` |
| Consent records retained for 3 years | ⬜ TODO | Ensure retention policy is implemented |
| Easy withdrawal mechanism | ✅ DONE | "Revoke Consent" button in settings dropdown with confirmation dialog — calls `POST /api/user/consent` with `withdraw: true` |
| Consent refreshed periodically | ⬜ TODO | GDPR suggests refreshing consent every 6-12 months |

**Affected file:** `src/components/legal/ConsentScreen.tsx`

---

## 5. Data Subject Rights

| Item | Status | Notes |
|------|--------|-------|
| Right of access mechanism | ⬜ TODO | Need an endpoint to export user data |
| Right to erasure mechanism | ⬜ TODO | Need an endpoint to delete user data |
| Right to rectification mechanism | ⬜ TODO | Currently no UI to edit name/contact info |
| Right to data portability | ⬜ TODO | Need data export in JSON format |
| Response time (30 days) | ⬜ TODO | Internal process for handling requests |

---

## 6. Leaderboard & Referral System — Privacy

| Item | Status | Notes |
|------|--------|-------|
| Leaderboard opt-out toggle | ✅ DONE | Implemented in `RewardsTasksPanel.tsx` |
| Leaderboard opt-out respected server-side | ⬜ PARTIAL | `updateUserSettingsHandler` Cloud Function deployed — stores preference in `userSettings`. Leaderboard query needs filtering by `leaderboardShown`. |
| Default is NOT shown | ⬜ TODO | Currently default is `leaderboardShown: true` — confirm this is acceptable under legitimate interest |
| Leaderboard data minimised | ⬜ TODO | Only show minimal data (username, count) — currently done in UI |

**Affected files:**
- `src/components/rewards/RewardsTasksPanel.tsx`
- Backend leaderboard function needupdate

---

## 7. Broadcast Messaging

| Item | Status | Notes |
|------|--------|-------|
| Explicit opt-in required | ✅ DONE | `toggleBroadcastSubscription` exists with opt-in/opt-out |
| Opt-out available anytime | ✅ DONE | Toggle switch in Rewards panel |
| Withdrawal of consent is as easy as giving it | ✅ DONE | Same toggle switch works both ways |
| Consent recorded in Firestore | ✅ DONE | `allowBroadcasts` field on `telegramSubscribers` |
| Broadcast sending respects opt-out | ✅ DONE | Backend filters by `allowBroadcasts == true` |

**Note:** The existing broadcast system already has proper opt-in/opt-out. This was already implemented before the GDPR task.

---

## 8. Security & Backend

| Item | Status | Notes |
|------|--------|-------|
| Telegram initData HMAC verification | ✅ DONE | Implemented in `functions/src/helpers.ts` — `verifyTelegramInitData()` |
| Admin verification via backend | ⬜ PARTIAL | `verifyTelegramAdmin` endpoint exists. Verify it covers all admin paths. |
| Firestore rules: userConsent (denied) | ✅ DONE | Added to `firestore.rules` — all access via Cloud Functions |
| Firestore rules: userSettings (denied) | ✅ DONE | Added to `firestore.rules` — all access via Cloud Functions |
| Firestore rules: orders (denied) | ✅ DONE | Already denied in existing rules |
| Firestore rules: products (read-only) | ✅ DONE | Already read-only in existing rules |
| Storage rules: product images (denied writes) | ✅ DONE | Already denied in existing rules |
| `.env` in `.gitignore` | ✅ DONE | Already configured |
| Secrets not committed | ✅ DONE | `.env.example` is safe; actual `.env` is gitignored |
| Consent/settings Cloud Functions | ✅ DONE | `acceptTermsHandler` and `updateUserSettingsHandler` deployed — see Section 9 |

---

## 9. Consent / User Settings Cloud Functions (Required)

The following Cloud Functions need to be created or updated:

### `POST /api/user/consent` ✅ DONE
- Accepts `{ initData, accept?: boolean, check?: boolean, withdraw?: boolean }`
- If `accept: true`: sets `hasAcceptedTerms: true`, `acceptedAt` in `userConsent/{telegramUserId}`, creates default `userSettings` doc
- If `check: true`: returns `{ ok: true, hasAcceptedTerms: boolean }`
- If `withdraw: true`: sets `hasAcceptedTerms: false`, `withdrawnAt` in `userConsent/{telegramUserId}`
- **Function:** `acceptTermsHandler` — deployed to `us-central1`

### `POST /api/user/settings` ✅ DONE
- Accepts `{ initData, get?: boolean, leaderboardShown?: boolean }`
- If `get: true`: returns current settings (leaderboard + broadcast + consent status)
- If `leaderboardShown` is provided: updates the setting
- **Function:** `updateUserSettingsHandler` — deployed to `us-central1`

### `getReferralLeaderboard` — Update
- Add filtering: only return users where `leaderboardShown !== false`
- This requires joining with `userSettings` or adding `leaderboardShown` field to `referrals`

**Status:** ⬜ TODO — Leaderboard query still needs filtering by `leaderboardShown`.

---

## 10. Contact & About Page

| Item | Status | Notes |
|------|--------|-------|
| Contact info placeholder | ✅ DONE | Placeholder text in `AboutPage.tsx` |
| Business name and address | ⬜ TODO | Placeholder — needs real data |
| Link to Privacy Policy | ✅ DONE | Button with navigation |
| Link to Terms of Service | ✅ DONE | Button with navigation |
| Data request contact | ⬜ TODO | Currently says "reply to any broadcast or message the bot" — should be more specific |

**Affected file:** `src/components/legal/AboutPage.tsx`

---

## 11. Pre-Launch Verification Checklist

- [ ] Privacy Policy draft reviewed and approved by lawyer
- [ ] Terms of Service draft reviewed and approved by lawyer
- [ ] Business identity data added to About page
- [x] Consent/settings Cloud Functions deployed
- [ ] Consent acceptance tested end-to-end
- [ ] Leaderboard opt-out tested end-to-end
- [ ] Broadcast opt-in/out tested end-to-end
- [ ] Firestore rules tested with security emulator
- [ ] `.env.example` is up to date
- [ ] Data subject request handling process documented internally
- [ ] Data Protection Impact Assessment (DPIA) considered if processing large volumes

---

## Summary of AI-Generated Items

| Component | AI Generated? | Needs Lawyer Review? |
|-----------|--------------|---------------------|
| Privacy Policy text | ✅ Yes | ✅ Yes |
| Terms of Service text | ✅ Yes | ✅ Yes |
| Consent screen UI | ✅ Yes | ✅ No (technical) |
| Leaderboard opt-out UI | ✅ Yes | ✅ No (technical) |
| Broadcast opt-in/out | ⬜ No (pre-existing) | ✅ No (technical) |
| Firestore rules | ✅ Updated | ✅ Yes |
| LEGAL_TODO.md | ✅ Yes | ✅ Yes (human review of this list itself) |

---

**Last updated:** July 15, 2026 (withdraw-consent + Cloud Functions status updated)
