# AGENTS.md

This file gives **Codex in VS Code** strict guidance for working on this repository.

---

## 1. Mission

You are helping maintain and extend a **Telegram Mini App** for a small streetwear store.

The app is **not** a giant marketplace.
It is a **small, controlled, community-focused drop app** for limited items.

Main goals:
- improve the app **step by step**
- keep the code understandable for a beginner/intermediate developer
- prefer **small tasks** over large code dumps
- always explain what changed and how to verify it
- do not hide important logic behind magic abstractions
- respect the existing implementation before proposing rewrites

---

## 2. Current stack

The current frontend stack is:

- **React 19**
- **TypeScript**
- **Vite**
- **Tailwind CSS v4**
- **ESLint**
- **Firebase**

Firebase is already part of the application architecture and may include:

- authentication
- Firestore
- Storage
- server-side verification logic
- optional hosting

Codex must work **with the existing stack**.
Do not silently redesign the project or swap platforms.

If a package is missing for a requested task:
- propose the **smallest necessary addition**
- explain why it is needed
- do not introduce multiple libraries when one simple solution is enough

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

Core product areas that may already exist in the codebase:
- product catalog
- categories
- product detail page
- multiple product images
- cart
- promo code validation
- checkout flow
- order creation
- order status management
- wishlist
- admin panel
- product CRUD
- image upload
- Telegram auth / Telegram init data handling

Not a priority right now:
- AI recommendations
- reviews
- comments
- complex personalization
- gamification
- complex marketplace logic
- shipping provider integrations
- unnecessary third-party services

---

## 4. How Codex must work

### Core rules

Codex must:
- work in **small steps only**
- inspect existing code before suggesting changes
- treat **source code as the source of truth**
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
- assume old planning docs are still accurate without checking code

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

Prefer:
- fix one bug
- improve one flow
- refactor one module
- tighten one security rule
- add one missing route
- document one subsystem

Avoid bundling unrelated work into one step.

### Verification rule

Every task must have verification.

Examples:
- “run `npm run dev` and confirm the page loads without TypeScript errors”
- “run `npm run build` and confirm production build succeeds”
- “create a test product and confirm it appears in the catalog”
- “apply a promo code and confirm totals update correctly”
- “submit checkout and confirm the order document is written to Firestore”
- “log in as admin and confirm protected admin actions are accessible”
- “open outside Telegram and confirm the dev fallback still works”

If there is no verification path, the task is incomplete.

### Audit-first rule

Before changing code, Codex should first determine:
- what already exists
- what is complete
- what is partial
- what is broken
- what is duplicated
- what is outdated in documentation

Do not propose “build X” if X already exists.
Propose:
- extend X
- fix X
- refactor X
- secure X
- document X
only after inspecting it.

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

If tests exist, also use the project’s test command.
When suggesting new packages, always show the exact install command.

---

## 7. Architecture expectations

Codex should guide the app toward a clean and understandable structure.
Use the existing structure if it is already working.
Only refactor structure when there is a clear benefit.

Preferred structure:

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

### Folder principles

- `components/ui` = reusable buttons, inputs, modals, badges
- `components/layout` = shell, navigation, headers, wrappers
- `features/*` = business logic grouped by domain
- `lib/firebase` = Firebase config, queries, wrappers, helpers
- `lib/telegram` = Telegram Mini App helpers and verification-related client utilities
- `types` = shared TypeScript types
- `pages` = route-level screens if routing is used

Do not create random folders without reason.

### Refactor rule

If the current structure is messy:
- do not rewrite it all at once
- identify the worst pain point
- move one slice at a time
- keep imports and verification easy to follow

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
- keep product imagery more prominent than interface chrome

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
- Telegram-friendly
- admin UI should still feel part of the same product

Avoid:
- visual chaos
- too many accent colors
- exaggerated animations
- per-component styling systems that are hard to maintain
- inconsistent admin vs storefront styling

---

## 9. Firebase rules

Firebase is already chosen.
Codex must work **with Firebase**, not against it.

Likely services used in this project:
- **Firebase Auth**
- **Cloud Firestore**
- **Firebase Storage**
- **Cloud Functions** or other Firebase-backed server logic for verification tasks
- **Firebase Hosting** only if the project uses it

When working with Firebase:
- keep collections simple
- inspect current document shapes before changing them
- explain document shape changes before implementing them
- explain security rules conceptually when touching them
- avoid unnecessary schema churn
- keep backward compatibility in mind when changing live data models

Before changing Firestore models, first explain:
- current shape
- proposed shape
- migration impact
- fields needed now vs later

### Security-sensitive Firebase areas

Treat these carefully:
- auth flows
- admin role checks
- Firestore rules
- Storage rules
- promo code validation
- order creation
- Telegram identity linkage
- server-side verification logic

Never casually weaken security rules for convenience.

---

## 10. Telegram Mini App rules

This project must work well inside Telegram.

Codex should account for:
- mobile viewport
- Telegram WebApp initialization
- Telegram theme integration
- Telegram user data access
- safe fallbacks when opened outside Telegram during dev
- separation between client-side Telegram helpers and server-side verification

Codex must not assume the app is always running inside Telegram during development.

When implementing Telegram logic:
- always include a dev fallback
- clearly separate Telegram-specific code into helpers
- avoid scattering `window.Telegram` usage everywhere
- do not trust client-provided Telegram identity for privileged actions without verification

Preferred location:
- `src/lib/telegram/`

### Verification rule for Telegram auth

If the task touches Telegram authentication or identity:
- check whether init data is verified server-side
- check how the verified identity is linked to Firebase auth or user records
- do not replace secure verification with client-only shortcuts

---

## 11. Data model expectations

These are likely data domains.
Codex should respect existing models before proposing changes.

### Products
A product may include:
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
- updatedAt
- isLimitedLabel
- inventory or stock-related fields if used
- sort/order fields if used in admin

### Categories
- id
- name
- slug
- optional image or label metadata

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
- usageCount if tracked
- minimum order conditions if used

### Orders
- customer identity fields
- Telegram-related fields if used
- items snapshot
- subtotal
- discount data
- total
- status
- fulfillment fields
- payment fields
- timestamps

### Wishlist
- userId
- product references or snapshots

### Notify-me / subscriptions
- userId
- isSubscribedToDrops
- optional product-specific subscriptions later

### Admin
- role or claims model
- permission checks
- protected product/order/promo operations

### Cart
Cart may remain client-side if that is the chosen architecture.
Do not overcomplicate persistence unless requested.

---

## 12. Current priority order

Codex must **not** assume the repo is still in setup phase.
Many core features may already be implemented.

Use this order unless the user changes direction.

# Phase 0 — Audit and alignment
1. inspect current repo
2. explain what already exists
3. identify what is complete vs partial vs broken
4. identify outdated docs
5. confirm the next smallest useful task

# Phase 1 — Stabilization
1. fix broken flows
2. reduce duplication
3. improve route structure if needed
4. improve shared UI consistency
5. tighten type safety

# Phase 2 — Security and correctness
1. review Telegram init data verification
2. review Firebase auth flow
3. review Firestore rules
4. review Storage rules
5. review admin permission enforcement
6. review promo and order validation paths

# Phase 3 — Product flow improvements
1. catalog UX improvements
2. filtering/search improvements
3. product detail improvements
4. cart and checkout UX polish
5. order status UX improvements
6. wishlist / notify-me cleanup if needed

# Phase 4 — Admin improvements
1. improve product CRUD UX
2. improve order management
3. improve promo management
4. improve upload flow
5. add missing admin safeguards

# Phase 5 — Architecture cleanup
1. routing improvements
2. folder cleanup
3. extract reusable hooks/services
4. remove dead code
5. improve docs to match real implementation

# Phase 6 — Production readiness
1. env validation
2. error handling
3. loading and empty states
4. test coverage where useful
5. release checklist
6. deployment readiness

Do not restart the project from scratch if the app already works.

---

## 13. Features that must be postponed

Do not push these early:
- auctions
- loyalty system
- dynamic negotiation system
- multi-language support
- currency conversion
- public activity feed
- analytics dashboards unless explicitly requested
- recommendation engine
- advanced role systems beyond what the project actually needs

These can be discussed later, but they are **not MVP / not current priority**.

---

## 14. How to respond to tasks

When the user asks for help, use this format whenever possible.

### A. Task summary
- what the task is
- whether it is a bug fix, feature extension, refactor, security task, or documentation task
- what area it belongs to

### B. Current state
- what already exists
- what is missing or wrong
- what assumptions were verified from code

### C. Plan
- smallest possible steps

### D. Implementation
- files to create/edit
- exact commands if needed

### E. Verification
- how to test manually
- expected result

### F. Risks / notes
- what can go wrong
- what to watch out for
- whether docs may also need updates

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
- blind trust in outdated planning docs

Keep the project educational and maintainable.

---

## 16. Documentation duties

Codex should help maintain:
- `AGENTS.md` — behavior rules for the coding agent
- `TODO.md` — roadmap and task order
- `PROJECT_STRUCTURE.md` — explanation of folders/files
- `FIREBASE_SCHEMA.md` — collections and document shapes
- `UI_GUIDELINES.md` — design tokens, components, shared styles
- `SECURITY_PLAN.md` if security architecture is documented

If one of these is missing and becomes useful, propose creating it.
Do not create all docs at once unless asked.

### Documentation rule

If code and docs disagree:
- trust the code first
- then propose doc updates
- clearly mark which docs are outdated

---

## 17. Example good behavior

Good:
- “First I will inspect the current folder structure.”
- “This feature already exists, so I’ll review the implementation before changing it.”
- “The checkout flow is present, but promo validation should be tightened here.”
- “Let’s fix the routing structure in one small step.”
- “After this, run `npm run build` and confirm there are no TypeScript errors.”

Bad:
- “I rewrote your app into Next.js + Zustand + Supabase.”
- “I added 15 packages.”
- “I replaced the existing auth flow without checking how admin access works.”
- “I assumed the docs were correct.”
- “Trust me, this is standard.”

---

## 18. First-response rule

When starting work in this repository, Codex should first:
1. summarize the current project state
2. identify what already exists
3. identify what is incomplete, risky, or outdated
4. identify the next smallest useful task
5. ask for confirmation if the next task changes architecture

---

## 19. Final rule

If a task feels too big:
- split it
- reduce scope
- keep the code easy to understand
- prefer clarity over speed
- preserve working behavior while refactoring

The user wants to **learn while building**.
That is more important than fast code generation.