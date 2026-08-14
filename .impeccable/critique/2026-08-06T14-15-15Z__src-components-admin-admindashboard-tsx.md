---
target: Admin dashboard (AdminDashboard, status/analytics, product CRUD, orders, promo, broadcast, campaign, rewards admin)
total_score: 30
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
timestamp: 2026-08-06T14-15-15Z
slug: src-components-admin-admindashboard-tsx
---
# Impeccable Critique — Admin Dashboard (YungWear)

Method: dual-agent (A: design review · B: browser-use detector + live browser at localhost:5173)
First run on the admin target. Previous targets: storefront 26 → 34 → 36/40.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Loading states exist, but admin failures are thinner than the storefront — no shared toast/banner; some ops can fail silently. |
| 2 | Match System / Real World | 4 | Domain language mirrors the buyer-facing mechanic: "Early Access date / Public date", order statuses map 1:1 to the storefront. |
| 3 | User Control and Freedom | 3 | High-stakes actions (broadcast, status change, delete) need confirm/undo; cancel-and-back from a long product form is unguarded. |
| 4 | Consistency and Standards | 4 | One token system, same card/button language as storefront; focus-ring and transition fixes made the interaction layer coherent. |
| 5 | Error Prevention | 3 | Required-field/price validation exists, but no guard that earlyAccessAt < publicAt; no hint that the schedule is inert while isAvailable is OFF. |
| 6 | Recognition Rather Than Recall | 3 | Status pills and section labels visible; raw codes (waiting_for_payment) still appear in some list UIs instead of human labels. |
| 7 | Flexibility and Efficiency | 3 | Order/product lists have status filters and search; no batch ops; editing N products is strictly sequential. |
| 8 | Aesthetic and Minimalist Design | 3 | Brand shell is strong and now calm; recharts analytics and dense tables read as stock dashboard interior. |
| 9 | Error Recovery | 2 | Weakest area — failed saves show no retry or draft recovery; a ~760-line product form can be lost on a mis-tap. |
| 10 | Help and Documentation | 2 | Big form lacks helper text (publicAt semantics, image aspect); broadcast send shows no recipient-count summary. |
| **Total** | | **30/40** | **Good (75%)** |

## Design Specificity Verdict

Authored shell, stock interior. The admin unmistakably belongs to the same product — shared tokens, card language, the early-access scheduler mirrors the buyer mechanic, and the focus-ring/transition fixes show real craft. But the data-dense interiors (recharts analytics, status tables) are the most generic parts of the app: they'd render identically in any SaaS dashboard.

## Prioritized Findings

P0 — Verify destructive-action confirmation. If delete product/promo/campaign lacks a confirm step, that's a P0 (irreversible data loss, no undo). Recommend confirm modal or the storefront's HoldToCancelButton pattern.

P1-1 — Silent save failures. Product/order/promo saves lack retry affordances on network failure; reuse the storefront's banner/toast pattern.
P1-2 — No draft preservation on the big product form. A mis-tap loses ~760 lines of edits; checkout got whitelisted draft persistence, the product form should too (localStorage keyed by product id).
P1-3 — Scheduling validation gap. earlyAccessAt can be set after publicAt with no guard; the hidden-while-OFF scheduler makes the constraint undiscoverable.

P2-1 — Order status mis-click is destructive; confirm transitions off the happy path.
P2-2 — Broadcast needs a pre-send summary (recipient count + plain-language recap).
P2-3 — Brand the recharts analytics (tooltip, grid, ticks) with the magenta/purple tokens.

P3-1 — Map raw status codes to human labels + pill colors in admin lists (reuse orderStatus.ts).
P3-2 — One-line helper text on the product form (publicAt semantics, 1:1 images).

## Deterministic Scan

9 admin files — exit 0, findings [] (clean). No false positives.

## Visual Evidence

Storefront renders first (catalog with items/search/filters). Triple-click on the YUNGWEAR wordmark opens the admin dashboard at #/admin/dashboard. Admin bottom nav shows: Dashboard, Catalog, Growth, Orders, Rewards. No horizontal overflow. Console: one benign 404 for a missing asset (favicon-class), no app errors.

## Overall Impression

The admin inherits the storefront's brand strength (consistency 4, match 4) but the deep UX pass this session was storefront-only — the admin-specific fundamentals (error recovery 2, help 2) are the genuine gaps. The single highest-value fix is draft preservation on the product form + a shared admin feedback banner; those two close the P1s.
