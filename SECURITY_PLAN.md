# Security Plan

## Current risk

The app is **not production-safe for privileged operations** if admin trust still depends on client behavior.

Current problems:
- the React app may decide admin visibility on the client
- client-visible admin UI is not a security boundary
- Firestore rules may validate document shape without strongly proving admin identity
- Storage rules may still allow overly broad product media writes or deletes
- Telegram client-side user data is useful for UX, but not sufficient for trusted admin authorization

That means a user who bypasses the UI could still attempt privileged Firebase writes directly unless those paths are protected by rules and/or moved behind trusted backend logic.

---

## Goal

Move admin trust out of React and into a backend verification flow.

Production should rely on:
- backend-verified Telegram identity
- explicit admin allowlisting or equivalent trusted role mapping
- backend-controlled privileged writes
- restrictive Firestore and Storage rules for client traffic

---

## Security principles

1. **Source code and deployed rules matter more than UI visibility**
   - Hiding an admin button is not access control.
   - The backend or Firebase rules must enforce authorization.

2. **Telegram client data is not trusted by itself**
   - `initDataUnsafe` is for convenience and UI only.
   - `initData` should be sent to the backend and validated there before being trusted.[page:1]

3. **Privileged writes should move off direct client access**
   - Admin-only operations should go through trusted backend code where possible.
   - Client access should be narrowed over time until privileged collections are no longer directly writable.

4. **Rules should deny broad writes by default**
   - If a client should not directly mutate something, rules should reject it.
   - Backend code using the Firebase Admin SDK can still perform controlled writes.[web:18]

5. **Security migration should be incremental**
   - Do not rewrite the entire app at once.
   - Move one privileged path at a time and verify it.

---

## Target architecture

1. Telegram opens the Mini App and provides raw `initData`.
2. Frontend sends raw `initData` to a backend endpoint.
3. Backend validates Telegram signature and expiration.
4. Backend extracts the Telegram user ID from verified data.
5. Backend checks whether the Telegram user is an approved admin.
6. Backend returns a trusted verification result for admin bootstrap.
7. Privileged operations move to backend-controlled endpoints or callable functions.
8. Firestore and Storage rules are tightened so the client can no longer perform those privileged writes directly.

Telegram’s own documentation says Mini App data should be validated on the bot’s server and warns not to trust `initDataUnsafe`. [page:1] The Telegram Mini Apps server-side package also supports validation, expiration checks, and explicit error handling for invalid signatures and expired data. [page:2]

---

## Recommended Firebase-native path

Use **Firebase Functions** for admin verification and privileged admin operations.

Why this path:
- stays inside the current Firebase stack
- avoids introducing a separate backend too early
- provides a trusted place to validate Telegram data
- centralizes privileged write logic
- works well with tighter Firestore and Storage client rules

Important note:
- callable or HTTP functions are not automatically “safe” just because they are backend endpoints; authorization still must be checked explicitly in function code. [web:10][web:19]
- if Firebase Auth ID tokens are available on the client, they can also be passed to backend endpoints for layered verification. [web:16][web:13]

---

## Verification model

### Telegram verification

Use raw `Telegram.WebApp.initData` from the client, not `initDataUnsafe`, for trust decisions. Telegram explicitly recommends validating `initData` on the backend. [page:1]

Validation requirements:
- parse raw init data
- verify Telegram signature/hash
- verify expiration
- extract Telegram user identity from verified payload
- reject malformed or replayed/expired data

The `@telegram-apps/init-data-node` package supports:
- parsing
- signature validation
- expiration enforcement
- structured error handling for invalid signature or expired init data [page:2]

### Admin verification

After Telegram identity is verified:
- compare `telegramUserId` against a trusted backend-controlled allowlist
- or map verified Telegram users to a trusted admin record
- do **not** trust any client-provided `isAdmin` field
- do **not** store writable admin flags in documents the client can mutate

### Firebase authorization model

Use a layered model:
- frontend can request admin verification
- backend returns trusted result
- backend performs privileged writes
- Firestore/Storage rules reject direct client admin mutations where migrated
- if Firebase Auth is part of the flow, use it consistently in rules and functions

---

## Implementation phases

### Phase 1 — Functions foundation

- scaffold Firebase Functions workspace if not already present
- define secure admin verification contract
- define config/env handling for Telegram secrets
- keep frontend admin panel behavior unchanged for the moment if needed
- document current privileged write paths before migration

Deliverable:
- backend workspace exists
- verification endpoint contract is documented
- secret/config loading is defined

---

### Phase 2 — Telegram admin verification endpoint

Implement Telegram `initData` verification in Functions.

Backend config needed:
- secret: `TELEGRAM_BOT_TOKEN`
- config/param: `TELEGRAM_ADMIN_IDS`
- optional config/param: `TELEGRAM_INIT_DATA_MAX_AGE_SECONDS`

Suggested endpoint:
- `verifyTelegramAdmin`

Method:
- `POST`

Request body:
```json
{
  "initData": "<raw Telegram.WebApp.initData string>"
}
```

Success response:
```json
{
  "ok": true,
  "isAdmin": true,
  "telegramUserId": 123456789,
  "reason": "verified_admin"
}
```

Possible failure reasons:
- `invalid_init_data`
- `expired_init_data`
- `missing_bot_token`
- `invalid_method`
- `not_admin`

Implementation requirements:
- only accept `POST`
- require raw `initData`
- validate signature/hash against bot token
- enforce max age / expiration
- parse verified Telegram user ID
- compare against trusted admin ID list
- return structured result without exposing secrets

The Telegram validation flow is documented by Telegram, including HMAC-based validation of the data-check string derived from `initData`. [page:1] The Mini Apps validation package also supports expiration checks by default and throws specific errors like `SignatureInvalidError` and `ExpiredError`. [page:2]

---

### Phase 3 — Frontend admin bootstrap migration

Use the new verification endpoint from the frontend admin bootstrap.

Frontend flow:
1. read raw `Telegram.WebApp.initData`
2. send it to `verifyTelegramAdmin`
3. receive trusted backend verdict
4. use backend result to enable hosted admin mode
5. stop relying on frontend-only admin checks for hosted builds

Rules:
- local dev fallback may exist temporarily for local development only
- production builds must not rely on browser-only admin logic
- `initDataUnsafe.user` may still be used for UI display, but not as the trust source for admin authorization

Deliverable:
- hosted admin access depends on backend verification
- frontend-only admin trust is removed from production behavior

---

### Phase 4 — Migrate privileged Firestore writes

Move privileged admin writes off direct client Firestore access one path at a time.

#### First migrated path: order status updates

Why first:
- clearly admin-only
- Firestore-only
- no Storage dependency
- small payload
- easy to test

Target state:
- client cannot directly update order status
- backend endpoint/function validates admin and performs write
- Firestore rules reject client-side status mutation

#### Second migrated path: promo create/update/delete

Why next:
- clearly admin-only
- Firestore-only
- low coupling to customer read flow

Target state:
- promo management is backend-controlled
- client reads may remain open as needed
- client writes are denied unless explicitly justified

#### Third migrated path: product create/update/delete

Why after promo:
- broader surface area
- affects storefront inventory and presentation
- likely interacts with images and status

Temporary exception if needed:
- direct product updates may remain open only for narrowly defined fields during migration, but this should be treated as temporary and documented explicitly

#### Fourth migrated path: sold-state / availability updates during checkout

Goal:
- remove direct client `isAvailable` writes
- move one-of-one sell-out logic into backend transaction logic

This matters because inventory state and order creation are closely related and should not depend on a client performing both steps safely.

#### Fifth migrated path: checkout order creation

Goal:
- remove direct client order creation if currently open
- create order and update inventory through backend-controlled logic
- prevent client-crafted privileged order fields

This is a major production-hardening step.

#### Sixth migrated path: product likes/cart counters

Goal:
- close the remaining direct product update path
- move social counters to safe backend mutation paths or carefully constrained alternatives

Note:
- this may or may not be urgent depending on whether these counters are business-critical or merely cosmetic

---

### Phase 5 — Migrate privileged Storage operations

#### Seventh migrated path: product image upload/delete

Goal:
- remove broad client-side Storage write/delete permissions
- route product media changes through backend-verified admin paths or tightly controlled signed workflows
- ensure deletes are never left open to any client with guessed paths

Minimum secure outcome:
- product media deletes are backend-controlled
- uploads are restricted to trusted admin flow
- Storage rules reject broad anonymous or user-driven admin-like access

---

### Phase 6 — Bot-side operational flows

#### Eighth backend path: Telegram bot `/start` and `/store` handling

Goal:
- improve the operational entry flow
- let the bot return a clean welcome message and store-opening path
- reduce user confusion when arriving from chat

This is less urgent than verification and privileged write migration, but it fits the same trusted backend direction.

---

## Firestore and Storage rule direction

### Firestore

Target rule posture:
- storefront reads allowed only where necessary
- client writes limited to the smallest possible set
- admin-only collections or admin-only mutations denied to clients once migrated
- no admin permission based purely on client-controlled fields
- no writable role-escalation fields

For fully migrated privileged collections, the safest model is often to deny client writes entirely and let the backend use the Admin SDK. [web:18]

### Storage

Target rule posture:
- public read only where appropriate for product media
- uploads restricted to trusted flow
- deletes restricted to trusted flow
- no broad wildcard rule that lets clients remove product media directly

---

## Minimum secure end state

At minimum, production should end up with:
- no browser-only admin fallback on hosted builds
- backend-verified Telegram admin identity
- `initData` validated server-side before trust decisions [page:1]
- Firestore admin writes no longer open to arbitrary clients
- Storage deletes no longer open to arbitrary clients
- Storage uploads no longer open to arbitrary clients
- clearly documented privileged write paths
- rules tested against expected allowed and denied cases

---

## Immediate next task

Use the new HTTP verification endpoint from the frontend admin bootstrap:
- send raw `Telegram.WebApp.initData`
- receive backend-trusted admin verdict
- stop relying on frontend-only admin checks for hosted builds

Why this is next:
- it removes the weakest trust boundary first
- it does not require migrating every admin write in one step
- it provides a secure basis for later backend-controlled admin operations

---

## Verification checklist

For every phase, verify:

### Telegram verification
- valid `initData` is accepted
- invalid signature is rejected
- expired `initData` is rejected
- missing bot token fails safely
- verified response includes expected Telegram user ID

### Admin verification
- approved admin ID returns `isAdmin: true`
- non-admin verified Telegram user returns `isAdmin: false`
- frontend cannot grant itself admin mode without backend approval

### Firestore
- direct client admin writes fail after migration
- backend path still succeeds
- non-admin users cannot mutate protected fields
- order status cannot be changed by a normal client

### Storage
- direct client deletes fail after migration
- trusted admin path still succeeds
- unauthorized uploads are denied

---

## Notes

- Telegram recommends validating Mini App data on the backend and warns against trusting `initDataUnsafe`. [page:1]
- The Mini Apps validation package supports signature and expiration checking, which fits this plan well. [page:2]
- Backend endpoints still need explicit authorization checks; being a Cloud Function alone does not make an operation safe. [web:10][web:19]
- Firebase security is strongest when rules and backend logic are combined rather than relying on client behavior alone. [web:16][web:18]