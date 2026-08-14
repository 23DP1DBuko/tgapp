# PRIVACY_POLICY_AUDIT.md

> Audit of the YungWear Telegram Mini App Privacy Policy and Terms of Service against the **actual source code**.
> Date of audit: 2026-08-09 · Files inspected: `src/lib/i18n/legalDocs.ts`, `src/types/legal.ts`, `src/components/legal/*`, `src/lib/telegram/webApp.ts`, `src/lib/firebase/*`, `src/lib/userState.ts`, `src/lib/storage.ts`, `functions/src/*` (all modules), `firestore.rules`, `LEGAL_TODO.md`, `src/components/settings/PreferencesPanel.tsx`, `src/components/rewards/RewardsTasksPanel.tsx`, `src/hooks/useOnlineUsers.ts`, `src/components/cart/CheckoutPanel.tsx`.

---

## 1. Executive summary

The current Privacy Policy and Terms of Service (all three languages in `src/lib/i18n/legalDocs.ts`) are **structurally reasonable but contain material inaccuracies**. The biggest problems are:

1. **Invented retention periods.** The policy claims orders are kept 1 year, consent records 3 years, giveaway entries 6 months, check-in/presence reset after 90 days, and referral data anonymised within 30 days. **No code implements any of this.** There are no deletion, anonymisation, or reset jobs anywhere in `functions/src/`. The only real time bound in the code is the 30-day expiry written onto reward promo codes.
2. **"Opt-in only" leaderboard is false.** `userSettings.leaderboardShown` defaults to **true** (missing document = visible, set to `true` at consent acceptance). The leaderboard is opt-*out*, not opt-in.
3. **Broadcast "explicit opt-in" is not guaranteed.** Both the bot `/start` handler (`upsertTelegramSubscriberFromUpdate`) and the broadcast toggle's read path (`toggleBroadcastSubscription` with no value) create subscriber records with `allowBroadcasts: true` by default. A user can therefore end up subscribed without making an explicit choice.
4. **"Telegram user IDs of referred users … not publicly displayed" is false.** The referral leaderboard API returns `telegramUserId` for every row, and the UI renders `User #<telegramUserId>` as a visible fallback when a referrer has no username. Giveaway winner records (publicly readable) also contain user IDs.
5. **Depop/Yaga claims are not backed by code.** There is zero Depop/Yaga integration (no API, no links, no checkout integration). The app itself collects full order details (name, address, payment preference) and creates order documents — the legal text's framing that sales happen "outside the App" on third-party platforms is the operator's business claim, repeated in UI copy, but unverifiable and arguably contradicted by the in-app checkout.
6. **Giveaway "winners notified via Telegram message" and "7-day response window" are not implemented.** The draw stores winners on the giveaway document; **no code sends a winner DM** and no re-draw timer exists.
7. **The policy omits real data the code stores:** IP address and user agent at consent acceptance (`userConsent`), publicly readable `presence` docs keyed by Telegram user ID with `lastSeen` timestamps (never deleted), the `createdBy` admin user ID on publicly readable `broadcasts` documents, and the fact that reward promo codes embed the last 4 digits of the user's Telegram ID.
8. **The policy claims rights mechanisms that don't exist** (30-day response guarantee, data portability export, erasure/anonymisation). There is no data-export or deletion endpoint anywhere. The only real self-service control is **Revoke consent** in Settings (which explicitly does *not* delete data).

**Verdict: Needs corrections before public access** (see section 16).

The rewritten documents in sections 11–12 are ready to copy into `src/lib/i18n/legalDocs.ts` (keeping the `**bold**` / `[label](url)` markers that `LegalDocBody.tsx` renders).

---

## 2. Actual data collected according to the code

### 2.1 Telegram data available to the frontend (browser only)

`src/lib/telegram/webApp.ts` reads from `window.Telegram.WebApp.initDataUnsafe.user`:

| Field | Read | Stored server-side? |
|---|---|---|
| `id` (Telegram user ID) | Yes | Yes (many collections, below) |
| `first_name` | Yes | Yes — `telegramSubscribers.firstName` (only when the user starts the bot) |
| `last_name` | Yes (type only) | No — never read in logic, never stored |
| `username` | Yes | Yes — `telegramSubscribers`, `dailyCheckins`, giveaway entries |
| `language_code` | Yes (type only) | **No — never stored anywhere** |
| `is_premium` | Yes (type only) | No |

`initData` (the full HMAC-signed payload) is sent to **every** backend endpoint for identity verification. The verified user ID from it is what all server writes are keyed on.

### 2.2 Data stored in Firestore (server-side, via Cloud Functions only — all client writes denied in `firestore.rules`)

| Collection / doc | Fields | Who writes |
|---|---|---|
| `userConsent/{telegramUserId}` | `telegramUserId`, `hasAcceptedTerms`, `acceptedAt`, `withdrawnAt?`, **`ipAddress`**, **`userAgent`** | `acceptTermsHandler` |
| `userSettings/{telegramUserId}` | `telegramUserId`, `leaderboardShown` (default **true**), `allowBroadcasts` (default false, but see §2.4), `updatedAt` | `acceptTermsHandler`, `updateUserSettingsHandler` |
| `telegramSubscribers/{telegramUserId}` | `telegramUserId`, `chatId`, `username`, `firstName`, `allowBroadcasts` (default **true**), `createdAt`, `lastSeenAt`, `referredBy` (referrer's `ref_<id>` code, only via bot `/start` link) | bot webhook, `toggleBroadcastSubscription` |
| `dailyCheckins/{telegramUserId}` | `telegramUserId`, `telegramUsername`, `currentStreak`, `longestStreak`, `totalCheckIns`, `lastCheckInDate`, `updatedAt` | `dailyCheckin` |
| `presence/{telegramUserId}` | `lastSeen` (server timestamp) | `updatePresence` heartbeat only |
| `orders/{clientOrderId}` | `fullName`, `telegramHandle`, `telegramUserId`, `note`, `fulfillmentType` (delivery/meetup), `paymentMethod` (meetup_cash/usdt), `deliveryCity`, `deliveryAddress`, `deliveryNotes`, `meetupLocation`, `meetupTimeOption`, `meetupNotes`, `items` (product snapshot incl. price/name/image), `subtotal`, `appliedPromo`, `total`, `status`, `cancelReason`, `createdAt` | `createCheckoutOrder` |
| `giveaways/{id}` | admin content + `enteredCount`, `totalTicketsPool`, `winners[]` (**`telegramUserId`, `telegramUsername`, `ticketsAtWinTime`**), `drawSeed`, `finishedAt` | admin + `drawGiveawayAdmin` |
| `giveaways/{id}/entries/{telegramUserId}` | `telegramUserId`, `telegramUsername`, `joinedAt`, `completedTaskIds`, `totalTickets` | `joinGiveaway`, `completeGiveawayTask` |
| `userStats/{telegramUserId}` | `telegramUserId`, `likedProductCount` | `updateProductSignal` (like/unlike) |
| `referralRewards/{telegramUserId}` | `{ "3": {promoCode, promoCodeId, grantedAt}, "5": …, … }` | `processAndCheckRewards` |
| `promoCodes` | reward codes `DAILY*` / `REF*` with 30-day expiry, usageLimit 1 — **the code string embeds the last 4 digits of the user's Telegram ID** | `dailyCheckin`, `processAndCheckRewards`, admin |
| `broadcasts` | `text`, `createdBy` (**admin's Telegram user ID**), `sentCount`, `failedCount`, `reason`, `createdAt` | `broadcastMessageAdmin` |
| `products`, `campaigns`, `tasks`, `bannerSlides` | shop content only (no personal data) | admin |

### 2.3 Data stored only in the browser (never sent to the server)

`src/lib/userState.ts` + `src/lib/storage.ts` (localStorage/sessionStorage, namespaced per user ID):
- cart contents, liked products (device-local mirror), daily-check-in streak cache, consent-accepted flag, language selection, reduced-motion preference, referral-code copy state.

### 2.4 Data sent to the Telegram bot (api.telegram.org)

**Outbound DMs to the user** (`chat_id = telegramUserId`):
- Order status messages: created (with order ID, item summary, total), paid, cancelled (with reason), meetup-ready, completed (`sendTelegramOrder*Message`).
- Reward codes: check-in milestone codes and referral milestone codes (`sendTelegramRewardMessage`).
- Broadcast messages to subscribers with `allowBroadcasts === true`.
- `getChatMember` calls to verify giveaway "join channel" tasks (sends the user's ID to the Telegram API).

**Inbound from the bot webhook** (`telegramBotWebhook`): the full Telegram update for `/start` (including `from.id`, `from.first_name`, `from.username`, `chat.id`, and any `ref_<id>` start parameter), `/store`, `/help`. A `/start ref_<id>` stores `referredBy` on the new subscriber's document.

**Important default**: `allowBroadcasts` is **true** by default on documents created by the bot `/start` handler **and** by the broadcast toggle's read-only status call (Preferences panel mount). `userSettings.allowBroadcasts` (default false) is written by consent but is **not** what the broadcast sender reads. Net effect: the broadcast opt-in is not strictly opt-in in practice.

### 2.5 Data publicly visible (via UI and/or public Firestore reads)

| What | Where | Notes |
|---|---|---|
| Referral leaderboard (top 10) | UI + API | `username` or **`User #<telegramUserId>`** fallback, `referralCount`, rank. `telegramUserId` is in every API row. |
| Giveaway leaderboard (top 5) | UI + API | `username`, `joinedAt`, `totalTickets`, `isMe` — user IDs scrubbed from this API (good). |
| Giveaway winners after draw | Public `giveaways` doc | **`telegramUserId` + username + tickets** readable by anyone with the app. |
| Online user count | UI (number only) | But the whole `presence` collection is publicly readable: **doc IDs are Telegram user IDs** and each doc has a `lastSeen` timestamp; docs are **never deleted**. |
| Broadcast history | Public `broadcasts` doc | `text` + **`createdBy` (admin's Telegram user ID)**. |
| Products/campaigns/tasks/banners | Public | Shop content, no personal data. |

Not public: `orders`, `promoCodes`, `telegramSubscribers`, `userConsent`, `userSettings`, `userStats`, `referralRewards`, `dailyCheckins`, giveaway entries, product signals.

---

## 3. Data claimed by the current legal text but not found in the code

| Claim | Reality in code |
|---|---|
| "language code" is collected | `language_code` is typed in `webApp.ts` but **never read into logic or stored anywhere**. It is only used by Telegram's own `initData`. |
| Leaderboard visibility is "opt-in only" | It is opt-**out**: `leaderboardShown` defaults to `true` (missing doc ⇒ visible; consent flow writes `true`). |
| Broadcasts only if "explicitly opted in" | `allowBroadcasts` defaults to **true** on new subscriber docs (bot `/start`, toggle status read). |
| "Referral data is anonymised within 30 days" on erasure request | No erasure/anonymisation code exists. |
| Order requests retained "up to 1 year… then deleted or anonymised" | No retention/deletion job exists. |
| Consent records retained "up to 3 years" | No such retention exists. |
| Giveaway entries retained "until 6 months after the giveaway ends" | No such retention exists. |
| "Check-in and presence data … reset after 90 days of inactivity" | No reset logic exists (streak *display* resets on read, but the document is never deleted or reset). |
| "We will respond within 30 days as required by GDPR" | No process or SLA exists; nothing in code can enforce this. |
| Right to portability / "structured, machine-readable format" | No export endpoint exists. |
| Winners "notified via Telegram message"; 7-day response window | No winner DM is sent (`giveaways.ts` contains no `sendMessage`); no 7-day re-draw logic exists. |
| "The discount is applied when the seller and buyer finalise the transaction outside the App" (promo codes) | The discount is computed **in the app** at checkout and stored in the order (`subtotal`, `appliedPromo`, `total`). |
| Google/Telegram exact addresses + EU-US Data Privacy Framework certification | Addresses are unverified claims; the DPF adequacy claim is not verified against provider docs. |

## 4. Data found in the code but missing from the legal text

1. **IP address and user agent** are stored in `userConsent` at acceptance (`ipAddress`, `userAgent`).
2. **Presence records are publicly readable and keyed by Telegram user ID**; docs and `lastSeen` timestamps are never deleted (a public, persistent user-ID registry).
3. **Broadcast documents publicly expose the admin's Telegram user ID** (`createdBy`).
4. **Reward promo codes embed the last 4 digits of the user's Telegram ID** and are written to `promoCodes` with a 30-day expiry.
5. **The bot sends order-status DMs** (created/paid/cancelled/meetup-ready/completed) containing order ID, item summary, and total — i.e., order-related data is transmitted to Telegram's servers via the bot.
6. **`userStats` tracks the number of products you have liked** (used to verify giveaway "like N products" tasks).
7. **Giveaway winners' Telegram user IDs are publicly visible** on the giveaway document after the draw.
8. **Daily check-in stores your username**, not just streaks.
9. **Referral links contain the referrer's Telegram user ID** (`ref_<id>` in the shareable URL and in the `/start` parameter), so the ID is visible to anyone who receives the link.
10. **Cart, likes, language, and motion preferences** are kept in device browser storage (worth one honest sentence in the policy).
11. **`withdraw` semantics**: revoking consent only flips `hasAcceptedTerms` to `false`; it does not touch any other data (the in-app dialog already says this — the policy should match).

## 5. Incorrect or risky statements (with file evidence)

| Statement (current legal text) | Problem | Evidence |
|---|---|---|
| "The data controller is a private individual … facilitates order requests via Depop/Yaga or direct messaging" | Depop/Yaga is not integrated anywhere in code; order requests are handled fully in-app. | `functions/src/orders.ts` (`createCheckoutOrder`); no depop/yaga identifiers outside UI/legal copy |
| "Telegram user IDs of referred users (stored securely and not publicly displayed)" | IDs *are* publicly displayed as `User #<id>` fallback in the referral leaderboard. | `functions/src/content.ts` `computeReferralLeaderboard` returns `telegramUserId`; `RewardsTasksPanel.tsx` line ~750–752 |
| "Leaderboard visibility: opt-in only" | Opt-out model. | `functions/src/consent.ts` (defaults `leaderboardShown: true`); `content.ts` (missing doc ⇒ visible) |
| "We only send broadcast messages if you have explicitly opted in" | New subscriber docs default `allowBroadcasts: true`. | `functions/src/helpers.ts` (`upsertTelegramSubscriberFromUpdate`); `functions/src/content.ts` `toggleBroadcastSubscription` |
| All retention-period bullets | No retention logic exists anywhere; periods are invented. | No delete/schedule code in `functions/src`; only `expiresAt` on promo codes (30 days) |
| "We will respond within 30 days" | No mechanism or process guarantees this. | No support tooling beyond the bot |
| "Winners are notified via Telegram message. If a winner does not respond within 7 days…" | No winner DM and no re-draw logic. | `functions/src/giveaways.ts` — draw only writes `winners[]` to the doc |
| "Promo discount is applied … outside the App" | Discount applied in-app and stored on the order. | `functions/src/orders.ts` `buildOrderDocument` / `createCheckoutOrder` |
| "No payments are processed through the App… All financial transactions occur exclusively on Depop, Yaga…" | Partly true (no payment gateway) but the app collects a payment-method preference and the operator tracks `paid` status; framing as "exclusively Depop/Yaga" is unverifiable. | `functions/src/orders.ts` (`paymentMethod: meetup_cash \| usdt`, statuses incl. `waiting_for_payment`/`paid`) |
| "Data may be transferred to the US under the EU-US Data Privacy Framework" | Certification claim unverified; deployments appear to target `us-central1` (default) but region is not confirmed in this repo. | `LEGAL_TODO.md` ("deployed to us-central1"); no region config in repo |
| "Continued use after changes constitutes acceptance" | Exactly the kind of auto-acceptance clause to avoid; the app already has a consent re-prompt flow. | `App.tsx` consent gating |
| "The operator reserves the right to suspend or terminate access" | No blocking/ban mechanism exists in code. | No user-block code anywhere |

## 6. Firebase and Telegram data flow

```
┌────────────────────────────┐         initData (HMAC-signed)         ┌─────────────────────────────┐
│  Telegram Mini App client  │ ─────────────────────────────────────▶ │  Firebase Cloud Functions   │
│  (webApp.ts reads user id, │   every /api/* call carries initData   │  (verifyTelegramInitData)   │
│   first_name, username,    │                                        │                             │
│   language_code)           │ ◀───────────────────────────────────── │  writes to Firestore:      │
└────────────┬───────────────┘      JSON responses                    │  userConsent, userSettings, │
             │                                                         │  telegramSubscribers,       │
             │  direct public reads:                                   │  dailyCheckins, presence,   │
             │  products, campaigns, tasks, broadcasts,                │  orders, giveaways+entries, │
             │  giveaways, presence (all read-only for clients)        │  userStats, referralRewards,│
             │                                                         │  promoCodes, broadcasts     │
             ▼                                                         └──────────────┬──────────────┘
   Firebase SDK (Firestore reads)                                                     │ sendMessage / getChatMember
   presence collection = user IDs + lastSeen (public)                                 ▼
                                                                           ┌─────────────────────────────┐
                                                                           │  Telegram Bot API           │
                                                                           │  DMs: order status, reward   │
                                                                           │  codes, broadcasts;          │
                                                                           │  webhook: /start (ref_<id>), │
                                                                           │  /store, /help               │
                                                                           └─────────────────────────────┘
```

- **Client writes to Firestore are denied for every user-data collection** (`firestore.rules`) — all writes go through Cloud Functions that HMAC-verify `initData`. This is genuinely good.
- **Public reads** exist for: products, campaigns, tasks, broadcasts, giveaways, presence (see §2.5 for the personal-data implications of the last two).
- **No analytics, no cookies, no third-party trackers** exist in the code. `src/lib/firebase/analytics.ts` is a wrapper for the app's own admin dashboard metrics (`getAdminAnalytics`), not Google Analytics.

## 7. Features that must be removed from the legal text

1. All specific retention periods (1 year / 3 years / 6 months / 90 days / 30-day anonymisation) — replace with an honest "no automatic deletion yet" statement.
2. "Respond within 30 days as required by GDPR".
3. Winner "notified via Telegram message" + "7-day response window".
4. "Leaderboard visibility is opt-in only" (change to "visible by default, can be hidden").
5. "Broadcasts only after explicit opt-in" (change to the true current default or fix the code — recommended fix in §13).
6. "Language code" as a collected category.
7. "Referral data is anonymised within 30 days".
8. Exact Google/Telegram addresses and the EU-US Data Privacy Framework certification claim.
9. Depop/Yaga as the defined transaction venue (see §8 / §14).
10. Auto-acceptance "continued use = acceptance" clauses in both documents.

## 8. Features that must be added (or reworded)

1. IP address + user agent stored at consent acceptance.
2. Publicly readable presence data keyed by Telegram user ID (`lastSeen`), never deleted.
3. Referral leaderboard fallback that displays numeric user IDs; giveaway winner user IDs publicly visible.
4. Broadcast default behaviour (currently on-by-default for new subscriber records).
5. Bot DMs: order status, reward codes, broadcast messages.
6. Device-only storage: cart, likes, language, motion preference.
7. Honest user-rights paragraph: no self-service export/erasure yet; requests handled manually via the bot.
8. Honest retention paragraph: promo codes expire after 30 days; everything else retained while the app operates.
9. A short statement that referral links contain a code derived from the user's Telegram ID.
10. Terms: the app is an order-request + fulfilment-coordination tool; the operator fulfils confirmed orders; giveaways are drawn as described in §4 of the Terms.

## 9. Recommended retention wording

> **How long the information is kept.** The app currently has no automatic deletion schedules. Data stays in the database while the app is operated, with these exceptions: reward promo codes expire 30 days after they are issued. If you ask us to delete or anonymise your data, we will do what we can manually, but we may need to keep information tied to open or recent orders (for fulfilment and record-keeping), fraud prevention, or security. You can withdraw consent at any time in Settings — this stops new consent-based processing but does not delete existing data.

## 10. Recommended contact and deletion wording

> **Contact.** Message the Telegram bot (the chat the app opens; send `/help`). This is the only contact channel.
>
> **Deletion and correction requests.** The app has no self-service export or deletion buttons. To request a copy, correction, or deletion of your data, contact the operator through the Telegram bot and describe what you need. The operator will review the request and delete or correct what is not needed for ongoing transactions, reward records, or security. We aim to reply as soon as reasonably possible.

## 11. Final rewritten Privacy Policy

### English

```text
1. Who operates the app
The YungWear Mini App is operated by a private individual (not a company) as a personal
project. The operator is based in Latvia (European Union). If you have questions about your
data, message the Telegram bot (send /help in the chat the app opens).

2. What information the app receives
- From Telegram: when you open the Mini App, Telegram provides your Telegram user ID,
  username, first name, and preferred language. The app sends this data to its own server
  only to verify that the request really comes from you.
- What you enter yourself: when you send an order request you provide your full name,
  Telegram handle, a contact note, delivery or meetup preferences (city, address, meeting
  point and time options), and your chosen payment method (cash on meetup or USDT
  transfer). When you join a giveaway, we record which tasks you completed.
- Automatically at consent: when you accept these documents, we store the technical request
  data (approximate IP address and browser type) to be able to show that acceptance happened.
- Only on your device: your cart, liked products, language choice, and reduced-motion
  preference are kept in your device's browser storage and are not sent to our server.

3. Why the information is used
- To process your order request, calculate the total (including promo codes), and keep you
  informed — including automatic messages from the bot about order status.
- To run giveaways: register your entry, count tickets for completed tasks, draw winners, and
  publish the result.
- To run referrals: credit you when a friend opens the app through your link.
- To run the daily check-in and hand out reward codes.
- To send broadcasts about new drops, only while the broadcast toggle in Settings is on.
- To show an approximate count of users currently online. This is not browsing tracking.
- To prevent abuse: duplicate orders, duplicate giveaway entries, and repeated reward claims.

4. Which services receive or store the information
- Firebase / Google Cloud (Firestore database, file storage, and server functions): order
  requests, referral records, giveaway entries, check-in data, consent records, and settings
  are stored here. Data may be processed in the countries where Google operates its
  infrastructure. See [Google Cloud data processing terms](https://cloud.google.com/terms/data-processing-agreement).
- Telegram: the bot sends you messages (order status, reward codes, broadcasts you are
  subscribed to). It receives the messages you send it and the data Telegram attaches to
  them. This data passes through Telegram's servers.
- No other third parties receive your data. The app does not use analytics or advertising
  networks.

5. How long the information is kept
The app currently has no automatic deletion schedules. Data stays in the database while the
app is operated, except that reward promo codes expire 30 days after they are issued. If you
ask us to delete or anonymise your data, we will do what we can manually, but we may keep
information needed for open or recent orders, record-keeping, fraud prevention, or security.
You can withdraw consent at any time in Settings; this stops new consent-based processing but
does not delete existing data.

6. What is visible to other users
- Referral leaderboard: your username and referral count are shown to other users. You can
  hide yourself in Settings (by default you are visible). If you have no username, your
  numeric Telegram user ID is shown instead.
- Giveaway leaderboard and winners: your username and ticket count are shown while a giveaway
  is live; after the draw, winner usernames (or user IDs when no username exists) are visible
  to everyone.
- Online counter: only the number of currently online users is shown.
- Your order details, contact data, consent records, and settings are private and visible
  only to the operator.

7. How to contact the operator
Message the Telegram bot (send /help). For data requests, reply in that same chat.

8. Your rights and deletion requests
You can ask for a copy of your data, ask to have it corrected or deleted, or object to how it
is used. The app has no self-service buttons for these yet: contact the operator through the
bot, describe what you need, and the request will be handled manually as far as possible. We
aim to reply as soon as reasonably possible. You may also complain to the Latvian data
protection authority (Datu valsts inspekcija).

9. Changes to this policy
If this policy changes, the new version will be shown in the app and you will be asked to
accept it again before continuing to use the app.
```

### Русский

```text
1. Кто управляет приложением
Mini App YungWear управляется частным лицом (не компанией) в рамках личного проекта.
Оператор находится в Латвии (Европейский союз). Если у вас есть вопросы о ваших данных,
напишите Telegram-боту (команда /help в чате, который открывает приложение).

2. Какие данные получает приложение
- От Telegram: при открытии Mini App Telegram передаёт ваш ID, имя пользователя, имя и
  предпочитаемый язык. Приложение отправляет эти данные на свой сервер только для проверки,
  что запрос действительно исходит от вас.
- Что вы вводите сами: при отправке запроса на заказ вы указываете полное имя, контакт в
  Telegram, заметку, предпочтения по доставке или встрече (город, адрес, место и время
  встречи) и выбранный способ оплаты (наличные при встрече или перевод USDT). При участии
  в розыгрыше мы фиксируем, какие задания вы выполнили.
- Автоматически при согласии: при принятии этих документов мы сохраняем технические данные
  запроса (приблизительный IP-адрес и тип браузера), чтобы подтвердить факт согласия.
- Только на вашем устройстве: корзина, отмеченные товары, выбор языка и предпочтение
  уменьшенной анимации хранятся в браузере вашего устройства и не отправляются на сервер.

3. Зачем используются данные
- Для обработки запроса на заказ, расчёта суммы (включая промокоды) и информирования вас —
  в том числе автоматическими сообщениями бота о статусе заказа.
- Для проведения розыгрышей: регистрация участия, подсчёт билетов за выполненные задания,
  определение победителей и публикация результата.
- Для реферальной программы: зачисление приглашения, когда друг открывает приложение по
  вашей ссылке.
- Для ежедневных отметок и выдачи наградных кодов.
- Для рассылок о новых дропах — только пока включён переключатель рассылок в настройках.
- Для показа примерного числа пользователей онлайн. Это не отслеживание ваших действий.
- Для защиты от злоупотреблений: дублирующих заказов, повторного участия в розыгрышах и
  повторного получения наград.

4. Какие сервисы получают или хранят данные
- Firebase / Google Cloud (база данных Firestore, хранилище файлов и серверные функции):
  здесь хранятся заказы, реферальные записи, участия в розыгрышах, отметки, записи о
  согласии и настройки. Данные могут обрабатываться в странах, где работает инфраструктура
  Google. См. [условия обработки данных Google Cloud](https://cloud.google.com/terms/data-processing-agreement).
- Telegram: бот отправляет вам сообщения (статус заказа, наградные коды, рассылки, на
  которые вы подписаны). Он получает сообщения, которые вы ему пишете, и данные, которые
  Telegram прикладывает к ним. Эти данные проходят через серверы Telegram.
- Никакие другие третьи лица данные не получают. Приложение не использует аналитику и
  рекламные сети.

5. Как долго хранятся данные
Сейчас в приложении нет автоматических сроков удаления. Данные остаются в базе, пока
приложение работает, за исключением наградных промокодов — они истекают через 30 дней
после выдачи. Если вы попросите удалить или обезличить данные, мы сделаем это вручную,
насколько возможно, но можем сохранить информацию, необходимую для текущих или недавних
заказов, учёта, защиты от мошенничества или безопасности. Вы можете в любой момент отозвать
согласие в настройках; это останавливает новую обработку на основе согласия, но не удаляет
существующие данные.

6. Что видят другие пользователи
- Реферальный рейтинг: ваше имя пользователя и число приглашений видны другим. Вы можете
  скрыть себя в настройках (по умолчанию вы видны). Если у вас нет имени пользователя,
  вместо него показывается ваш числовой ID в Telegram.
- Таблица лидеров розыгрыша и победители: во время розыгрыша видны ваше имя пользователя и
  число билетов; после розыгрыша имена победителей (или их ID, если имени нет) видны всем.
- Счётчик онлайн: показывается только число пользователей онлайн.
- Ваши заказы, контактные данные, записи о согласии и настройки закрыты и видны только
  оператору.

7. Как связаться с оператором
Напишите Telegram-боту (команда /help). Для запросов о данных отвечайте в этом же чате.

8. Ваши права и запросы на удаление
Вы можете запросить копию данных, их исправление или удаление, а также возразить против
обработки. Готовых кнопок для этого в приложении пока нет: напишите оператору через бота,
опишите запрос — он будет обработан вручную, насколько это возможно. Мы постараемся
ответить как можно скорее. Вы также можете подать жалобу в латвийский орган по защите
данных (Datu valsts inspekcija).

9. Изменения политики
Если политика изменится, новая версия будет показана в приложении, и вам будет предложено
принять её заново перед продолжением использования.
```

### Latviešu

```text
1. Kas pārvalda lietotni
YungWear Mini App pārvalda privātpersona (nevis uzņēmums) kā personīgu projektu. Operators
atrodas Latvijā (Eiropas Savienībā). Ja jums ir jautājumi par saviem datiem, rakstiet
Telegram robotam (komanda /help čatā, ko atver lietotne).

2. Kādus datus lietotne saņem
- No Telegram: atverot Mini App, Telegram nodrošina jūsu Telegram lietotāja ID, lietotājvārdu,
  vārdu un vēlamo valodu. Lietotne šos datus nosūta savam serverim tikai tāpēc, lai
  pārliecinātos, ka pieprasījums patiešām nāk no jums.
- Ko ievadāt pats: nosūtot pasūtījuma pieprasījumu, norādāt pilnu vārdu, Telegram kontaktinformāciju,
  piezīmi, piegādes vai tikšanās vēlmes (pilsēta, adrese, tikšanās vieta un laiks) un izvēlēto
  apmaksas veidu (skaidra nauda tikšanās reizē vai USDT pārskaitījums). Piedaloties izlozē, mēs
  fiksējam, kuri uzdevumi ir izpildīti.
- Automātiski piekrišanas brīdī: pieņemot šos dokumentus, mēs saglabājam tehniskos pieprasījuma
  datus (aptuveno IP adresi un pārlūkprogrammas veidu), lai varētu apliecināt piekrišanas faktu.
- Tikai jūsu ierīcē: grozs, atzīmētās preces, valodas izvēle un samazinātas animācijas vēlme
  tiek glabāti jūsu ierīces pārlūkā un netiek nosūtīti uz mūsu serveri.

3. Kāpēc dati tiek izmantoti
- Lai apstrādātu pasūtījuma pieprasījumu, aprēķinātu summu (tostarp ar akcijas kodiem) un
  informētu jūs — arī ar automātiskiem robota ziņojumiem par pasūtījuma statusu.
- Lai rīkotu izlozes: reģistrētu dalību, skaitītu biļetes par izpildītiem uzdevumiem, izlozētu
  uzvarētājus un publicētu rezultātu.
- Lai darbinātu nosūtījumu sistēmu: ieskaitītu jums uzaicinājumu, kad draugs atver lietotni pa
  jūsu saiti.
- Lai darbinātu ikdienas atzīmēšanos un izsniegtu atlīdzību kodus.
- Lai sūtītu paziņojumus par jauniem dropiem — tikai kamēr ieslēgts paziņojumu slēdzis
  iestatījumos.
- Lai rādītu aptuvenu tiešsaistes lietotāju skaitu. Tā nav jūsu darbību izsekošana.
- Lai novērstu ļaunprātīgu izmantošanu: dublētus pasūtījumus, atkārtotu dalību izlozēs un
  atkārtotu atlīdzību saņemšanu.

4. Kuri pakalpojumi saņem vai glabā datus
- Firebase / Google Cloud (Firestore datubāze, failu krātuve un servera funkcijas): šeit tiek
  glabāti pasūtījumi, nosūtījumu ieraksti, dalības izlozēs, atzīmēšanās, piekrišanas ieraksti un
  iestatījumi. Dati var tikt apstrādāti valstīs, kurās darbojas Google infrastruktūra. Skatīt:
  [Google Cloud datu apstrādes noteikumi](https://cloud.google.com/terms/data-processing-agreement).
- Telegram: robots jums sūta ziņojumus (pasūtījuma statusu, atlīdzību kodus, paziņojumus, kuriem
  esat abonēts). Tas saņem jūsu rakstītos ziņojumus un datus, ko Telegram tiem pievieno. Šie dati
  iziet caur Telegram serveriem.
- Nekādas citas trešās puses datus nesaņem. Lietotne neizmanto analītiku vai reklāmas tīklus.

5. Cik ilgi dati tiek glabāti
Pašlaik lietotnē nav automātisku dzēšanas termiņu. Dati paliek datubāzē, kamēr lietotne darbojas,
izņemot atlīdzību akcijas kodus — tie beidzas 30 dienas pēc izsniegšanas. Ja lūgsiet dzēst vai
anonimizēt datus, mēs to darīsim manuāli, cik vien iespējams, bet varam paturēt informāciju, kas
nepieciešama aktuāliem vai neseniem pasūtījumiem, uzskaitei, krāpšanas novēršanai vai drošībai.
Piekrišanu varat atsaukt jebkurā laikā iestatījumos; tas aptur jaunu apstrādi uz piekrišanas
pamata, bet neizdzēš esošos datus.

6. Kas ir redzams citiem lietotājiem
- Nosūtījumu līderu saraksts: jūsu lietotājvārds un uzaicinājumu skaits ir redzami citiem. Varat
  sevi paslēpt iestatījumos (pēc noklusējuma esat redzams). Ja jums nav lietotājvārda, tā vietā
  tiek rādīts jūsu ciparu Telegram lietotāja ID.
- Izlozes līderu saraksts un uzvarētāji: izlozes laikā redzams jūsu lietotājvārds un biļešu
  skaits; pēc izlozes uzvarētāju lietotājvārdi (vai ID, ja lietotājvārda nav) ir redzami visiem.
- Tiešsaistes skaitītājs: tiek rādīts tikai tiešsaistes lietotāju skaits.
- Jūsu pasūtījumi, kontaktinformācija, piekrišanas ieraksti un iestatījumi ir privāti un redzami
  tikai operatoram.

7. Kā sazināties ar operatoru
Rakstiet Telegram robotam (komanda /help). Datu pieprasījumiem atbildiet tajā pašā čatā.

8. Jūsu tiesības un dzēšanas pieprasījumi
Varat pieprasīt savu datu kopiju, to labošanu vai dzēšanu, kā arī iebilst pret apstrādi.
Gatavu pogu tam lietotnē pagaidām nav: rakstiet operatoram caur robotu, aprakstiet pieprasījumu,
un tas tiks izskatīts manuāli, cik vien iespējams. Mēs centīsimies atbildēt pēc iespējas ātrāk.
Varat arī iesniegt sūdzību Latvijas datu aizsardzības iestādē (Datu valsts inspekcija).

9. Politikas izmaiņas
Ja politika mainīsies, jaunā versija tiks parādīta lietotnē, un jums tiks lūgts to pieņemt no
jauna pirms lietotnes turpmākas lietošanas.
```

## 12. Final rewritten Terms of Service

### English

```text
1. What the app is
The YungWear Mini App is a Telegram Mini App run by a private individual (not a company). It
lets you browse items, save likes, join giveaways, collect check-in and referral rewards, and
send an order request for items you want.

An order request is a proposal, not an automatic sale. It tells the operator which items you
want, your contact details, your fulfilment preference (delivery or meetup), and your preferred
payment method (cash on meetup or USDT transfer). The operator then confirms availability and
arranges the details with you directly, in the app chat or the bot. The app does not process
payments itself; the operator records whether an order is paid or cancelled.

2. Order requests
- You are responsible for the accuracy of the details you submit.
- Submitting a request does not guarantee availability. The order is confirmed only when the
  operator confirms it.
- Keep your contact details reachable; the operator may need them to arrange delivery or meetup.

3. Promo codes
- Promo codes (issued as check-in or referral rewards, or by the operator) give a percentage or
  fixed discount that is applied in the app at checkout.
- Reward codes are single-use and expire 30 days after issue. Promo codes have no cash value
  and cannot be exchanged for money.
- The operator may invalidate a code if it was obtained through abuse.

4. Giveaways
- Eligibility: anyone who has accepted the Terms and the Privacy Policy.
- How winners are drawn: each ticket gives one chance; prizes are drawn one by one from the
  remaining entries, so a user can win at most one prize per giveaway. The draw is computed
  from a stored random seed, so the result can be checked.
- Winners are published in the app, and the operator will try to reach them through the bot.
  If a winner cannot be reached within a reasonable time, another winner may be drawn.
- Prizes are arranged directly between the operator and the winner.

5. Fair use
- Do not use the app for unlawful purposes, spam, or to manipulate referrals, giveaways, or
  check-ins with fake accounts or scripts.
- The operator may block features for users who abuse the system. There is no automatic block;
  this is done manually.

6. Responsibility
- The app is provided "as is". The operator works to keep it working, but is not liable for
  temporary outages or for losses caused by misuse of the app.
- Confirmed orders are fulfilled by the operator directly, and the operator is responsible for
  fulfilling them.

7. Governing law
These Terms are governed by the laws of the Republic of Latvia.

8. Changes to these Terms
If these Terms change materially, the app will show the new version and ask you to accept it
again. Continued use after a change does not by itself count as acceptance.
```

### Русский

```text
1. Что представляет собой приложение
YungWear Mini App — это Telegram Mini App, которым управляет частное лицо (не компания).
Приложение позволяет просматривать товары, отмечать понравившиеся, участвовать в розыгрышах,
получать награды за отметки и приглашения, а также отправлять запрос на заказ.

Запрос на заказ — это предложение, а не автоматическая продажа. Он сообщает оператору, какие
товары вы хотите, ваши контактные данные, предпочтения по исполнению (доставка или встреча) и
желаемый способ оплаты (наличные при встрече или перевод USDT). Оператор подтверждает наличие
и согласовывает детали напрямую с вами — в чате приложения или через бота. Приложение само
платежи не проводит; оператор отмечает заказ как оплаченный или отменённый.

2. Запросы на заказ
- Вы отвечаете за точность введённых данных.
- Отправка запроса не гарантирует наличие товара. Заказ считается подтверждённым только после
  подтверждения оператором.
- Указывайте доступные контакты: оператору может понадобиться связаться с вами для организации
  доставки или встречи.

3. Промокоды
- Промокоды (наградные за отметки и приглашения или выданные оператором) дают процентную или
  фиксированную скидку, которая применяется в приложении при оформлении заказа.
- Наградные коды одноразовые и действуют 30 дней с момента выдачи. Промокоды не имеют
  денежной стоимости и не могут быть обменены на деньги.
- Оператор может аннулировать код, если он был получен путём злоупотребления.

4. Розыгрыши
- Участие: доступно пользователям, принявшим Условия и Политику конфиденциальности.
- Как выбираются победители: каждый билет даёт один шанс; призы разыгрываются по одному из
  оставшихся участников, поэтому один пользователь может выиграть не более одного приза в
  одном розыгрыше. Розыгрыш вычисляется из сохранённого случайного зерна, поэтому результат
  можно проверить.
- Победители публикуются в приложении, оператор также постарается связаться с ними через бота.
  Если с победителем не удаётся связаться в разумный срок, может быть выбран другой победитель.
- Призы вручаются напрямую оператором победителю.

5. Добросовестное использование
- Не используйте приложение в незаконных целях, для спама или манипуляций реферальной
  системой, розыгрышами или отметками с помощью фейковых аккаунтов или скриптов.
- Оператор может ограничить функции для пользователей, злоупотребляющих системой.
  Автоматической блокировки нет — это делается вручную.

6. Ответственность
- Приложение предоставляется «как есть». Оператор старается поддерживать его работу, но не
  несёт ответственности за временные сбои или убытки, вызванные злоупотреблением приложением.
- Подтверждённые заказы выполняются оператором напрямую, и оператор отвечает за их выполнение.

7. Применимое право
Настоящие Условия регулируются законодательством Латвийской Республики.

8. Изменения условий
При существенных изменениях приложение покажет новую версию и предложит принять её заново.
Продолжение использования само по себе не считается принятием изменений.
```

### Latviešu

```text
1. Kas ir lietotne
YungWear Mini App ir Telegram Mini App, ko pārvalda privātpersona (nevis uzņēmums). Lietotne
ļauj apskatīt preces, atzīmēt patikušās, piedalīties izlozēs, saņemt atlīdzības par atzīmēšanos
un uzaicinājumiem, kā arī nosūtīt pasūtījuma pieprasījumu.

Pasūtījuma pieprasījums ir priekšlikums, nevis automātiska pārdošana. Tas informē operatoru par
vēlamajām precēm, jūsu kontaktinformāciju, izpildes vēlmēm (piegāde vai tikšanās) un vēlamo
apmaksas veidu (skaidra nauda tikšanās reizē vai USDT pārskaitījums). Operators apstiprina
pieejamību un saskaņo detaļas tieši ar jums — lietotnes čatā vai caur robotu. Lietotne pati
maksājumus neapstrādā; operators atzīmē pasūtījumu kā apmaksātu vai atceltu.

2. Pasūtījuma pieprasījumi
- Jūs atbildat par iesniegto datu pareizību.
- Pieprasījuma nosūtīšana negarantē preces pieejamību. Pasūtījums tiek apstiprināts tikai pēc
  operatora apstiprinājuma.
- Norādiet sasniedzamu kontaktinformāciju; operatoram tā var būt nepieciešama piegādes vai
  tikšanās organizēšanai.

3. Akcijas kodi
- Akcijas kodi (atlīdzības par atzīmēšanos un uzaicinājumiem vai operatora izsniegti) sniedz
  procentuālu vai fiksētu atlaidi, kas tiek piemērota lietotnē pasūtījuma noformēšanas laikā.
- Atlīdzību kodi ir vienreiz lietojami un derīgi 30 dienas no izsniegšanas. Akcijas kodiem nav
  naudas vērtības, un tos nevar apmainīt pret naudu.
- Operators var anulēt kodu, ja tas iegūts ļaunprātīgi.

4. Izlozes
- Dalības tiesības: izlozēs var piedalīties lietotāji, kuri pieņēmuši Noteikumus un Privātuma
  politiku.
- Kā tiek izvēlēti uzvarētāji: katra biļete dod vienu iespēju; balvas tiek izlozētas pa vienai
  no atlikušajiem dalībniekiem, tāpēc viens lietotājs vienā izlozē var iegūt ne vairāk kā vienu
  balvu. Izloze tiek aprēķināta no saglabātā nejaušības avota (seed), tāpēc rezultātu var
  pārbaudīt.
- Uzvarētāji tiek publicēti lietotnē, un operators centīsies ar viņiem sazināties caur robotu.
  Ja ar uzvarētāju neizdodas sazināties saprātīgā laikā, var tikt izvēlēts cits uzvarētājs.
- Balvas tiek nodotas tieši starp operatoru un uzvarētāju.

5. Godprātīga lietošana
- Neizmantojiet lietotni nelikumīgiem mērķiem, spamam vai nosūtījumu, izložu un atzīmēšanās
  manipulēšanai ar viltus kontiem vai skriptiem.
- Operators var ierobežot funkcijas lietotājiem, kuri ļaunprātīgi izmanto sistēmu. Automātiskas
  bloķēšanas nav — tas tiek darīts manuāli.

6. Atbildība
- Lietotne tiek sniegta "tāda, kāda tā ir". Operators cenšas uzturēt tās darbību, bet neatbild
  par īslaicīgiem pārtraukumiem vai zaudējumiem, ko radījusi ļaunprātīga lietošana.
- Apstiprinātus pasūtījumus operators izpilda tieši, un operators atbild par to izpildi.

7. Piemērojamās tiesības
Šos Noteikumus reglamentē Latvijas Republikas tiesību akti.

8. Noteikumu izmaiņas
Ja Noteikumi būtiski mainīsies, lietotne parādīs jauno versiju un lūgs to pieņemt no jauna.
Turpmāka lietošana pati par sevi netiek uzskatīta par izmaiņu pieņemšanu.
```

## 13. Required translations

- `src/lib/i18n/legalDocs.ts` — replace the **privacy** and **terms** bodies in **all three languages** (en, ru, lv) with sections 11–12 above. All three must say the same things; the translations above are written as natural text (not word-for-word) and keep the `**bold**` / `[label](url)` markers used by `LegalDocBody.tsx`.
- `src/lib/i18n/translations.ts` — update the following UI strings so the visible copy matches the corrected documents:
  - `about.desc2` / `about.operatorBody` (en/ru/lv): currently claim items are sold "via Depop/Yaga" and repeat the Latvia claim. Keep "private individual — Latvia" only if the operator confirms it; replace Depop/Yaga with "or by direct arrangement" unless those platforms are actually used.
  - `withdraw.body` (en/ru/lv): already honest ("existing orders and data are not automatically deleted") — keep, and make sure the policy says the same.
  - Any copy referencing "opt-in only" leaderboard behaviour.
- `LEGAL_TODO.md` — the "Data retention periods confirmed" item is still genuinely TODO; update the note that currently mentions "2 years for orders" (the draft text says 1 year) and mark the retention/deletion question as **not implemented in code**.
- Check that ru/lv documents render fully in `LegalDocBody` (Cyrillic/Latvian chars, quotes «», no stray `[`/`]` markers). The strings above intentionally avoid unbalanced markers.

## 14. Remaining uncertainties

1. **Operator identity/location** ("private individual, Latvia") — stated in UI and legal copy; cannot be verified from code. If the operator is not in the EU, the GDPR framing changes.
2. **Depop/Yaga as real sales channels** — no code integration exists; the checkout collects full fulfilment data and creates orders in-app. The operator must confirm where sales actually happen, then either keep a corrected sentence or remove the platforms.
3. **Firebase data region** — no region config in this repo; `LEGAL_TODO.md` mentions `us-central1` (Firebase default). Confirm in the Firebase console before claiming any location.
4. **EU-US Data Privacy Framework** — not verified against current Google documentation; the rewritten text uses cautious wording instead.
5. **Winner notification** — the draw only stores winners; if the operator wants "winners contacted via bot", that feature must be built (or the Terms must say winners are published in-app only).
6. **Broadcast default** — the rewritten policy assumes the toggle is the source of truth; the code currently defaults new subscriber records to ON. Either fix `toggleBroadcastSubscription` / `upsertTelegramSubscriberFromUpdate` to default OFF (recommended) or keep the current wording "while the toggle is on" together with a fix.
7. **Retention** — no deletion jobs exist; the rewritten text is honest about it. If the operator later adds scheduled cleanup, update the policy.

## 15. Before/after statement table

| # | Current statement | Problem | Recommended replacement |
|---|---|---|---|
| 1 | "The App facilitates order requests via Depop/Yaga or direct messaging." | No Depop/Yaga integration in code; app handles orders itself. | "…lets you send an order request to the operator, who arranges fulfilment directly." |
| 2 | "Telegram user ID, username, first name, and language code" collected. | Language code is never stored or read into logic. | "…your Telegram user ID, username, and first name. Your preferred language is read from Telegram only to display the right language; it is not stored." |
| 3 | "Referral activity… Telegram user IDs of referred users (stored securely and not publicly displayed)." | Leaderboard displays `User #<id>` fallback; API returns user IDs. | "…your referral code (derived from your Telegram user ID), your referral count, and which users you referred. Referrers appear in the public leaderboard by username (or numeric ID if no username)." |
| 4 | "Leaderboard visibility… (opt-in only)." | Default is `true` — opt-out. | "Visible by default; you can hide yourself in Settings." |
| 5 | "We only send broadcast messages if you have explicitly opted in." | New subscriber docs default `allowBroadcasts: true`. | "Broadcasts are sent only while the broadcast toggle in Settings is on. [Recommended code fix: default the subscriber record to OFF.]" |
| 6 | "Orders retained for up to 1 year… then deleted or anonymised." | No retention job exists. | "No automatic deletion schedules exist; data stays while the app operates. Promo codes expire after 30 days." |
| 7 | "Referral data anonymised within 30 days" / "giveaways retained 6 months" / "consent 3 years" / "90-day reset". | Invented. | Replace all with the honest retention paragraph (§9). |
| 8 | "We will respond within 30 days as required by GDPR." | No process guarantees this. | "We aim to reply as soon as reasonably possible." |
| 9 | Right to portability "structured, machine-readable format". | No export endpoint exists. | "You can request a copy of your data; there is no self-service export yet — requests are handled manually via the bot." |
| 10 | "Winners are notified via Telegram message. If a winner does not respond within 7 days…" | No winner DM, no re-draw timer. | "Winners are published in the app, and the operator will try to reach them through the bot. If unreachable within a reasonable time, another winner may be drawn." |
| 11 | "The discount is applied when the seller and buyer finalise the transaction outside the App." | Discount is applied in-app at checkout. | "…a discount that is applied in the app at checkout." |
| 12 | "All financial transactions occur exclusively on Depop, Yaga, or through separate arrangements." | Unverifiable; app records payment preference and tracks `paid`. | "The app does not process payments itself. It records your chosen payment method; the operator arranges payment and marks orders paid/cancelled." |
| 13 | "Data may be transferred to the US under the EU-US Data Privacy Framework." | Certification claim unverified. | "Data may be processed in the countries where Google operates its infrastructure." |
| 14 | Exact addresses for Google and Telegram. | Unverified (esp. Telegram LLP address). | Remove addresses; keep "Firebase/Google Cloud" and "Telegram" as named providers. |
| 15 | "Continued use of the app after changes constitutes acceptance." | Auto-acceptance clause. | "The new version will be shown in the app and you will be asked to accept it again." |
| 16 | "The operator reserves the right to suspend or terminate access." | No block mechanism in code. | "The operator may restrict features for users who abuse the system (done manually)." |
| 17 | "The operator is not responsible for resolving disputes regarding transactions completed outside the App." | Depop/Yaga premise unverified; operator fulfils orders. | "Confirmed orders are fulfilled by the operator directly; the operator is responsible for fulfilling them." |
| 18 | "This is not a real-time tracking system and does not record your behaviour." | True, but omits that presence docs are public, ID-keyed, never deleted. | Keep the sentence, add: "presence records are technically readable by any user of the app and contain user IDs and last-activity timestamps; only the total count is shown in the UI." |
| 19 | (missing) IP address/user agent | Not mentioned anywhere. | Add to §2: stored at consent acceptance. |
| 20 | (missing) bot order-status DMs | Not mentioned. | Add to §4: the bot sends order-status and reward-code messages through Telegram. |
| 21 | "Firebase hosts the application database…" (as data processor). | Correct, keep — but soften transfer claims (row 13). | Keep with cautious wording. |
| 22 | "You can withdraw consent at any time via the app settings." | Correct and implemented. | Keep as-is (matches `withdraw.body` UI copy). |

## 16. Final verdict

**Needs corrections before public access.**

The data-flow fundamentals are sound and clearly implemented (server-verified identity, denied client writes, honest consent screen, real giveaway/referral/check-in/order logic). However, the current legal text contains **invented retention periods, a wrong opt-in/opt-out description for both leaderboard and broadcasts, claims of a 7-day winner process and winner DMs that do not exist, an unverifiable Depop/Yaga transaction model, and an EU-US Data Privacy Framework certification claim**, while omitting real processing (IP/user agent at consent, publicly readable ID-keyed presence data, leaderboard ID fallbacks, bot order messages). Sections 11–12 provide corrected documents ready to deploy after the operator confirms the open items in section 14.
