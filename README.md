# Telegram Mini App Storefront

A mobile-first **Telegram Mini App** for a small streetwear store focused on limited drops, one-of-one items, and community-driven sales.

This project is built for a lightweight storefront experience inside Telegram, with Firebase used for application data, auth-related flows, and storage-backed product media.

---

## Product

This app is designed for:
- limited streetwear drops
- small curated catalogs
- Telegram-native browsing and checkout
- manual admin control
- simple and understandable architecture

The goal is not to build a giant marketplace.
The goal is to provide a focused storefront for a small brand or community.

---

## Core capabilities

The app may include the following implemented product areas:

- product catalog
- category filtering
- product detail pages
- multiple product images
- cart state
- promo code validation
- checkout flow
- Firestore order creation
- order status management
- wishlist
- admin panel
- product CRUD
- Firebase Storage image upload
- Telegram WebApp integration
- Telegram init data handling and server-side verification

Project documentation should be kept aligned with the actual codebase.
If code and docs disagree, trust the code first.

---

## Stack

Frontend:
- React 19
- TypeScript
- Vite
- Tailwind CSS v4
- ESLint

Backend and platform:
- Firebase Auth
- Cloud Firestore
- Firebase Storage
- Firebase-backed verification / server-side logic where needed

Integration:
- Telegram Mini App / Telegram WebApp SDK

---

## Development

Install dependencies:

```bash
npm install
```

Run the dev server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Lint the codebase:

```bash
npm run lint
```

---

## Environment

This project uses environment variables for Firebase and related configuration.

Typical setup includes:
- Firebase project credentials
- Telegram-related configuration if required by server-side verification
- any admin or deployment-specific variables used by the current codebase

Keep secrets out of version control.
Use a local `.env` file and provide an `.env.example` when onboarding other developers.

---

## Project structure

The exact structure may evolve, but the project is expected to stay close to this shape:

```text
src/
  app/
    router/
    providers/
  components/
    ui/
    layout/
    product/
    cart/
    admin/
  features/
    auth/
    products/
    cart/
    promo/
    checkout/
    wishlist/
    notifications/
    admin/
  hooks/
  lib/
    firebase/
    telegram/
    utils/
  pages/
  styles/
  types/
```

Guiding principles:
- keep reusable UI isolated
- keep feature logic grouped by domain
- keep Firebase logic inside dedicated modules
- keep Telegram-specific code centralized
- avoid unnecessary abstractions

---

## Firebase data

The project uses Firestore-backed product, promo, and order data.

See:
- `FIREBASE_SCHEMA.md` for collection shapes and examples
- security-related docs for rules and verification details if present

Typical domains include:
- `products`
- `orders`
- `promoCodes`
- optional categories, subscriptions, wishlist, and admin-related data

---

## Telegram integration

This app is intended to work inside Telegram, but development should also support safe browser fallback behavior.

Telegram-related implementation should:
- initialize the Telegram WebApp safely
- avoid scattering `window.Telegram` access everywhere
- separate client helpers from verification logic
- avoid trusting client-side Telegram identity for privileged actions without server-side verification

---

## Admin and operations

The project includes or is expected to include admin-oriented flows such as:
- product creation and editing
- product availability management
- image upload
- order review and status updates
- promo management

Admin behavior should remain simple, explicit, and easy to debug.

---

## Documentation

Important docs in this repository may include:

- `AGENTS.md` — guidance for the coding agent
- `TODO.md` — current roadmap
- `PROJECT_STRUCTURE.md` — folder and architecture notes
- `FIREBASE_SCHEMA.md` — Firestore data shapes
- `UI_GUIDELINES.md` — shared styling and component conventions
- `SECURITY_PLAN.md` — auth, rules, and verification guidance

If documentation becomes outdated, update it to match the current implementation.

---

## Working principles

When contributing:
- inspect the existing code first
- make small, understandable changes
- do not rewrite working systems without a clear reason
- verify each change manually
- prefer clarity over cleverness
- keep the UI consistent
- keep security-sensitive flows explicit

This repository is meant to stay maintainable and educational while the product evolves.