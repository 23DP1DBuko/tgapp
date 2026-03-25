# AGENTS.md

This file gives **Codex in VS Code** strict guidance for working on this repository.

---

## 1. Mission

You are helping build a **Telegram Mini App** for a small streetwear store.

The app is **not** a giant marketplace.
It is a **small, controlled, community-focused drop app** for limited items.

Main goals:
- build the app **step by step**
- keep the code understandable for a beginner/intermediate developer
- prefer **small tasks** over large code dumps
- always explain what changed and how to verify it
- do not hide important logic behind magic abstractions

---

## 2. Current stack

The current frontend stack is:
- **React 19**
- **TypeScript**
- **Vite**
- **Tailwind CSS v4**
- **ESLint**
- **Firebase** (already chosen for backend services)

Package baseline:
- React + React DOM
- TypeScript
- Vite
- Tailwind
- ESLint

Assume this is a **frontend-first** project using Firebase for:
- authentication
- database / data storage
- optional file storage
- optional hosting later

If Firebase packages are missing, do **not** silently redesign the stack.
Instead, propose the minimal required Firebase additions and explain why.

---

## 3. Product context

This project is a **Telegram Mini App** for limited streetwear drops.

Expected product characteristics:
- small drops
- often one-of-one items
- small community
- manual admin control
- minimal UI
- mobile-first
- Telegram-native feeling

Planned core features:
- product list
- categories
- product page
- multiple product images
- cart
- promo code input
- checkout flow
- notify-me / drop notification system
- wishlist later
- admin-controlled broadcasts later

Not a priority right now:
- AI recommendations
- reviews
- comments
- complex personalization
- gamification
- complex marketplace logic
- shipping provider integrations

---

## 4. How Codex must work

### Core rules

Codex must:
- work in **small steps only**
- explain each change before or after making it
- keep the project easy to debug
- prefer explicit code over clever code
- ask for confirmation before major architecture changes
- always provide a way to verify the result

Codex must **not**:
- rewrite the whole project at once
- dump massive files without explanation
- introduce many libraries unless truly necessary
- change the stack away from React + TypeScript + Firebase
- invent backend infrastructure outside Firebase unless asked
- add features that were not requested
- overengineer the app

### After every coding task, always provide:
1. what was changed
2. which files were touched
3. why it was done this way
4. how to run it
5. how to verify it manually
6. common failure points

---

## 5. Required working style

### Small-task rule

Break all work into:
- phases
- tasks
- micro-tasks

Example:
- Phase 1: foundation
  - Task 1.1: project structure
  - Task 1.2: Firebase initialization
  - Task 1.3: Telegram SDK bootstrap
- Phase 2: catalog
  - Task 2.1: product type definition
  - Task 2.2: Firestore collection design
  - Task 2.3: product list UI

Never jump several phases ahead.

### Verification rule

Every task must have verification.
Examples:
- “run `npm run dev` and confirm the page loads without TypeScript errors”
- “open browser console and confirm Telegram user object is logged”
- “add a test product to Firestore and confirm it appears in the UI”

If there is no verification path, the task is incomplete.

---

## 6. Commands

Use these commands by default unless changed deliberately.

### Install dependencies
```bash
npm install
```

### Run dev server
```bash
npm run dev
```

### Build project
```bash
npm run build
```

### Lint project
```bash
npm run lint
```

When suggesting new packages, always show the exact install command.

---

## 7. Architecture expectations

Codex should guide the app toward this structure, unless the user explicitly changes direction.

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
  features/
    auth/
    products/
    cart/
    promo/
    checkout/
    notifications/
  hooks/
  lib/
    firebase/
    telegram/
    utils/
  pages/
  styles/
  types/
```

### Folder principles
- `components/ui` = reusable buttons, inputs, modals, badges
- `features/*` = business logic grouped by domain
- `lib/firebase` = Firebase config and wrappers
- `lib/telegram` = Telegram Mini App helpers
- `types` = shared TypeScript types

Do not create random folders without reason.

---

## 8. Design rules

The UI must stay **visually homogeneous**.

Rules:
- use shared button styles
- use shared input styles
- use shared card styles
- use consistent border radius
- use consistent spacing scale
- do not hardcode random colors in every component
- prefer tokens / shared classes / reusable variants

Before making major visual decisions, discuss with the user:
- color palette
- typography direction
- card style
- button shape

### Styling principles
- mobile-first
- clean
- minimal
- calm
- fashion/streetwear appropriate
- product images should stand out more than interface chrome

Avoid:
- visual chaos
- too many accent colors
- exaggerated animations
- per-component styling systems that are hard to maintain

---

## 9. Firebase rules

Firebase is already chosen.
Codex must work **with Firebase**, not against it.

Likely Firebase services to use:
- **Firebase Auth** for user auth
- **Cloud Firestore** for products, promos, orders, notify-me flags
- **Firebase Storage** for product images if needed
- **Firebase Hosting** only later if requested

When designing Firebase usage:
- keep collections simple
- explain document shape before implementing
- explain security rules conceptually
- do not write complex rules too early
- do not use Firebase features just because they exist

Before implementing Firestore models, first propose:
- collections
- document shape
- relation strategy
- fields needed now vs later

---

## 10. Telegram Mini App rules

This project must work well inside Telegram.

Codex should account for:
- mobile viewport
- Telegram WebApp initialization
- Telegram theme integration later
- optional access to Telegram user data
- safe fallbacks when opened outside Telegram during dev

Codex must not assume the app is always running inside Telegram during development.

When implementing Telegram logic:
- always include a dev fallback
- clearly separate Telegram-specific code into helpers
- avoid scattering `window.Telegram` usage everywhere

Preferred location:
- `src/lib/telegram/`

---

## 11. Data model expectations

These are likely data domains.
Codex should not implement all at once, but should respect them when planning.

### Products
A product may need:
- id
- name
- description
- category
- brand(s)
- price
- currency
- isAvailable
- images[]
- createdAt
- isLimitedLabel (manual display label if needed)

### Categories
- id
- name
- slug

### Brands
- id
- name
- slug

### Promo codes
- code
- discountType
- discountValue
- isActive
- expiresAt
- usageLimit

### Notify-me / subscriptions
- userId
- isSubscribedToDrops
- optional product-specific interests later

### Cart
At MVP stage, cart can stay client-side first.
Do not overcomplicate cart persistence unless requested.

---

## 12. What to build first

Codex must prioritize in this order unless the user changes it.

# Phase 0 — Setup and alignment
1. inspect current repo
2. explain what already exists
3. identify missing Firebase packages if any
4. confirm desired architecture
5. create or improve folder structure carefully

# Phase 1 — Foundation
1. Firebase initialization
2. environment variable setup
3. Telegram Mini App bootstrap helper
4. app shell / layout
5. shared UI primitives

# Phase 2 — Product data foundation
1. TypeScript product types
2. Firestore schema proposal
3. seed / manual test data plan
4. product fetching hook
5. product list screen

# Phase 3 — Product experience
1. category filtering
2. product detail page
3. image gallery
4. availability handling

# Phase 4 — Cart and promo flow
1. cart state
2. add/remove from cart
3. cart drawer/modal/page
4. promo code field UI
5. promo validation strategy

# Phase 5 — Checkout MVP
1. checkout page structure
2. buyer info capture if needed
3. order creation in Firestore
4. mock payment / manual payment flow
5. order success screen

# Phase 6 — Telegram-centric growth features
1. notify-me subscriptions
2. admin-triggered announcement design
3. optional secret promo delivery later

# Phase 7 — Admin tools
1. lightweight admin access plan
2. product create/edit/delete
3. promo create/edit
4. notification sending plan

Do not skip to advanced features before foundation is stable.

---

## 13. Features that must be postponed

Do not push these early:
- auctions
- loyalty system
- dynamic negotiation system
- multi-language support
- currency conversion
- public activity feed
- analytics dashboards
- recommendation engine
- advanced role systems

These can be discussed later, but they are **not MVP**.

---

## 14. How to respond to tasks

When the user asks for help, use this format whenever possible:

### A. Task summary
- what the task is
- what phase it belongs to

### B. Plan
- smallest possible steps

### C. Implementation
- files to create/edit
- exact commands if needed

### D. Verification
- how to test manually
- expected result

### E. Risks / notes
- what can go wrong
- what to watch out for

This keeps the project understandable.

---

## 15. What the user explicitly does not want

The user does **not** want:
- giant “I built everything for you” steps
- unexplained abstractions
- losing understanding of the codebase
- hard-to-debug architecture
- feature creep
- random visual decisions without discussion
- every button styled differently
- overdesigned components that fight the product

Keep the project educational and maintainable.

---

## 16. Documentation duties

Codex should help maintain:
- `AGENTS.md` — behavior rules for the coding agent
- `TODO.md` — roadmap and task order
- `PROJECT_STRUCTURE.md` — explanation of folders/files
- `FIREBASE_SCHEMA.md` — collections and document shapes
- `UI_GUIDELINES.md` — design tokens, components, shared styles

If one of these is missing and becomes useful, propose creating it.
Do not create all docs at once unless asked.

---

## 17. Example good behavior

Good:
- “First I will inspect the current folder structure.”
- “We need Firebase packages. Install them with this command.”
- “Let’s create `src/lib/firebase/config.ts` first.”
- “After this, run `npm run dev` and confirm there are no TypeScript errors.”

Bad:
- “I rewrote your app into Next.js + Zustand + Supabase.”
- “I added 15 packages.”
- “I created the full admin dashboard in one step.”
- “Trust me, this is standard.”

---

## 18. First-response rule

When starting work in this repository, Codex should first:
1. summarize the current project state
2. identify what already exists
3. identify the next smallest useful task
4. ask for confirmation if the next task changes architecture

---

## 19. Final rule

If a task feels too big:
- split it
- reduce scope
- keep the code easy to understand
- prefer clarity over speed

The user wants to **learn while building**.
That is more important than fast code generation.
