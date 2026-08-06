# Product
<!-- impeccable:product-schema 1 -->

## Platform
web

## Users
**Primary user:** A streetwear enthusiast and Telegram user who follows the YungWear brand. They browse limited drops from their phone inside Telegram, enter giveaways, and purchase one-of-one items through a quick checkout flow.

**Operator:** The store admin who manages products, orders, promos, giveaways, and broadcasts through an admin panel inside the same app.

## Product Purpose
YungWear is a small streetwear shop that sells limited-edition and one-of-one items to a close community of followers. The app makes it easy to discover new drops, secure rare items before they sell out, and stay connected through giveaways, polls, and broadcast announcements — all without leaving Telegram.

Success means the community feels first in line for every drop and the admin can run the store manually with minimal overhead.

## Positioning
A Telegram-native streetwear drop app — not a marketplace, not a browser storefront. The selling point is the Telegram integration itself: the community already lives in Telegram, and the store lives there with them. No app to install, no email to enter, no account to create outside the chat.

## Operating Context
- The app runs as a Telegram Mini App inside the Telegram mobile app (iOS and Android).
- During development, it also runs in a browser for quick iteration.
- Users authenticate via Telegram init data. No separate login flow.
- The admin manages products, orders, and content through the same app client-side (with Firebase Functions doing admin verification).
- Checkout is capture-first: users enter shipping details and submit an order, which the admin fulfills manually.
- Payments and shipping are handled outside the app (admin coordinates with the buyer via Telegram DM).

## Capabilities and Constraints

### Confirmed
- Product catalog with category filtering
- Product detail pages with multiple images
- Cart (client-side, persisted to Firestore per user)
- Promo code validation on checkout
- Order creation and buyer order history
- Wishlist (likes/bookmarks per product)
- Daily check-in with streak tracking
- Giveaway system with task-based ticket entries and winner drawing
- Polls for community engagement
- Broadcast messages sent via Telegram bot
- Campaign banners on the home page
- Referral tracking and leaderboard
- Admin panel for product, order, promo, giveaway, poll, broadcast, and campaign management
- Image upload to Firebase Storage (admin)
- Subscribe/notify for drop announcements
- Online user presence tracking
- Consent tracking for legal compliance (GDPR)

### Technical constraints
- Runs as Telegram Mini App (viewport = mobile, needs dev fallback outside Telegram)
- Firebase Firestore for data, Firebase Storage for images, Firebase Functions for admin verification
- No separate backend beyond Firebase Functions
- Cart is client-side; no server-side cart persistence
- No payment gateway integration — admin handles payment separately
- Telegram init data verified server-side via HMAC-SHA256
- Mobile-first, touch-first UI

### Deliberately undecided
- Multi-language support (not needed yet)
- Reviews and comments
- Complex gamification or loyalty system
- Shipping provider integration
- Analytics dashboards

## Brand Commitments
- **Name:** YungWear
- **Voice:** Streetwear-appropriate, minimal, confident, community-first
- **Assets:** The brand name "YungWear" is used in the app; any logo or visual brand assets are managed by the admin externally
- **Personality:** Dark, moody, purple/magenta palette — nightlife and underground streetwear aesthetic

## Evidence on Hand
- The project source code at `src/` contains the full app implementation
- AGENTS.md documents product and architecture guidance
- README.md documents setup, stack, and working principles
- FIREBASE_SCHEMA.md documents Firestore collection shapes
- SECURITY_PLAN.md and SECURITY_REVIEW.md document security architecture
- Roadmap docs exist at `yungwear_*_roadmap.md` and `yungwear_*_structure.md` (may be outdated)

## Product Principles
1. **Telegram-native first** — Every feature should feel like it belongs inside Telegram, not like a website squeezed into a WebView.
2. **Limited drops, limited friction** — The checkout flow should be as fast as possible because items sell out in minutes.
3. **The admin stays in control** — Every product, order, promo, and giveaway is manually managed. No automation replaces the admin's judgment.
4. **Small community, personal touch** — The app serves a close community, not millions. Features should feel personal and direct.
5. **Mobile-only is a feature, not a limitation** — Optimize for the phone-first experience. Desktop support is a bonus, not a requirement.

## Accessibility & Inclusion
- The app respects `prefers-reduced-motion`
- All interactive elements use native `<button>` and `<a>` elements or have proper ARIA attributes
- Forms show clear error states
- Touch targets aim for 44x44px minimum
- Color contrast follows WCAG 2.1 AA where the dark palette allows
