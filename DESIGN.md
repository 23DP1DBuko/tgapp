# YungWear — Design System
> Generated from project source code. Reflects the current visual language.

## Atmosphere
Dark, moody, nocturnal. The UI feels like a nightclub or underground gallery — deep purples, magentas, and near-black backgrounds with soft radial glows. Text is off-white with good contrast against the dark backdrop. The overall character is luxurious but raw, fitting a streetwear brand that trades in limited drops and one-of-one items.

## Color

### Token reference
| Token | Value | Usage |
|---|---|---|
| `--shop-bg` | `#120711` | Page background |
| `--shop-panel` | `rgba(31, 14, 30, 0.78)` | Card/panel backgrounds |
| `--shop-stroke` | `rgba(255, 255, 255, 0.08)` | Borders and separators |
| `--shop-text` | `#fff7fb` | Primary body text |
| `--shop-muted` | `#d4b8cf` | Secondary/muted text |
| `--shop-purple` | `#8b3dff` | Primary accent — CTAs, highlights |
| `--shop-magenta` | `#d91f6f` | Secondary accent — glow, energy |
| `--shop-red` | `#ff4d5a` | Destructive actions, errors, urgency |
| `--shop-cream` | `#fff0f6` | Text on dark surfaces, subtle highlights |
| `--shop-panel-solid` | `#1c1622` | Solid card/panel surfaces (admin rows, chart cards) |
| `--shop-dropdown` | `#1a0e1c` | Dropdown menus, settings sheet |
| `--shop-void` | `#0d050c` | Deepest background (bottom gradients, page backdrop) |
| `--shop-like` | `#e61e26` | Like/bookmark heart, notification badge |
| `--shop-accent-purple` | `#a855f7` | Upload dropzone borders + icons |
| `--shop-emerald` | `#10b981` | Success / revenue green |
| `--shop-overlay` | `#0f0712` | Image overlay gradient shade (carousels, hero) |

### Surfaces
- **Page background:** Deep near-black with two radial-gradient overlays (magenta at top, purple at top-right) on a black-to-deeper-purple linear gradient.
  ```
  radial-gradient(circle at top, rgba(217, 31, 111, 0.24), transparent 30%),
  radial-gradient(circle at 85% 10%, rgba(139, 61, 255, 0.24), transparent 28%),
  linear-gradient(180deg, #190916 0%, #0d050c 100%)
  ```
- **Panel/sheet:** Near-black with subtle purple tint and `backdrop-blur-xl`, bordered with `rgba(255,255,255,0.1)`.

### Button colors
- **Primary:** Linear gradient `135deg` from `--shop-purple` to `--shop-red` with a `rgba(139,61,255,0.3)` drop shadow.
- **Secondary:** `rgba(255,255,255,0.08)` background, `rgba(255,255,255,0.1)` border.
- **Destructive:** `--shop-red` solid background.
- **Ghost:** Same as secondary but with `--shop-muted` text.
- **Success:** `rgba(52,211,153,0.2)` background, emerald-100 text.

### Border treatment
- Default: `rgba(255,255,255,0.08)` (subtle white)
- Input focus: `--shop-purple` or `--shop-red` depending on context
- Input error: `rgba(255,77,90,0.6)` (semi-transparent red)
- Input default: `rgba(255,255,255,0.1)`

---

## Typography

### Font stack
```
"Trebuchet MS", "Segoe UI", sans-serif
```
No custom fonts are loaded (no external font dependencies). The stack is system-native with Trebuchet MS as the preferred face for its character.

### Scale (derived from components)
| Element | Size | Weight | Tracking | Case |
|---|---|---|---|---|
| Body text | `14px` (text-sm) | 400 | normal | normal |
| Button label (sm) | `9px` | 600 (semibold) | `0.16em` | uppercase |
| Button label (md) | `12px` | 700 (bold) | `0.18em` | uppercase |
| Button label (lg) | `14px` | 700 (bold) | `0.2em` | uppercase |
| Input label | `10px` | 600 (semibold) | `0.2em` | uppercase |
| Input value | `14px` | 400 | normal | normal |
| Error text | `11px` | 500 (medium) | normal | normal |

### Buttons
All buttons are uppercase with aggressive tracking. Sizes map to rounded corners:
- **sm:** `rounded-xl` (12px), `3px 1.5px` padding
- **md:** `rounded-2xl` (16px), `4px 3px` padding
- **lg:** `rounded-2xl` (16px), `4px 4px` padding

Interactive feedback: `active:scale-95` (sm) or `active:scale-[0.98]` (md/lg).

### Text inputs
- **sm:** `rounded-xl` (12px), `3px 2.5px` padding
- **md:** `rounded-2xl` (16px), `4px 3px` padding
- Background: `rgba(255,255,255,0.08)`
- Focus: border transitions to accent color (purple or red)
- Placeholder: `rgba(212,184,207,0.7)` (70% muted)

### Bottom Sheet
- Rounded top: `rounded-t-[28px]`
- Background: linear gradient `135deg` from `rgba(28,14,30,0.98)` to `rgba(18,8,18,0.98)`
- Shadow: `0 -12px 48px rgba(0,0,0,0.4)`
- Backdrop: `rgba(0,0,0,0.6)` with `backdrop-blur-sm`
- Max height: 85vh
- Drag handle: `10px` wide, `4px` tall, `rgba(255,255,255,0.2)`
- Transition: `300ms cubic-bezier(0.32, 0.72, 0, 1)` (custom ease-out)
- Closes on drag > 120px or Escape key

### Cards & panels
- Cards use `--shop-panel` (`rgba(31, 14, 30, 0.78)`) background
- Panels may layer backdrop blur effects
- Border radius varies by context (12px-16px common)

---

## Motion

### Timing
All interactive transitions use `300ms` duration. Reduced-motion preference collapses transitions to `0.01ms`.

### Keyframes
| Name | Purpose |
|---|---|
| `fade-slide-in` | Entry: `translateY(18px)` → `0`, opacity `0` → `1` |
| `shimmer` | Skeleton loading: background position sweep |
| `scale-in` | Modal/overlay entry: `scale(0.6)` → `1`, opacity `0` → `1` |
| `float` | Gentle hover: `translateY(0)` → `-6px` loop |
| `shake` | Error feedback: horizontal shake |
| `fly-to-cart` | Add-to-cart animation: scale + translate to cart icon position |

### Reduced motion
The app fully supports `prefers-reduced-motion: reduce` — all animations collapse, skeletons become static, and bounce/ping/spin animations are disabled.

### Easing
- Bottom sheet: custom cubic-bezier `(0.32, 0.72, 0, 1)` — smooth ease-out with slight anticipation
- Interactive elements: `active:scale-95` (press feedback)
- No bounce or elastic easing used

---

## Component inventory

### Shared UI components (`src/components/ui/`)
| Component | Status |
|---|---|
| `Button` | 5 variants, 3 sizes, loading spinner, active scale |
| `Input` | 2 sizes, label, error state, multiline support, 2 focus colors |
| `BottomSheet` | Drag-to-dismiss, backdrop blur, Escape key, 85vh max |
| `SwipeablePanel` | Swipe-to-dismiss panel |
| `CustomSelect` | Dropdown select |
| `PageHeader` | Page title component |
| `SkeletonCard` | Loading skeleton |
| `NotificationBanner` | Notification display |
| `OfflineBanner` | Offline indicator |
| `TaskActionButton` | Task completion action |
| `ErrorBoundary` | React error boundary |
| `CountUp` | Animated number counter |

### Layout
- `AppShell` — Root layout wrapper
- Full viewport, no horizontal scroll
- Content areas use `overflow-y-auto` with hidden scrollbar (`.scrollbar-none`)

---

## Spacing

No formal spacing scale extracted yet. Components use Tailwind utility classes. Common values observed:
- `gap-2` (8px) between related elements
- `px-4` / `px-5` (16-20px) horizontal page padding
- `py-3` / `py-4` (12-16px) vertical padding inside panels
- `pb-6` (24px) bottom padding in sheets

---

## Responsive behavior

- **Primary target:** Mobile (Telegram Mini App viewport)
- **Max width:** `max-w-md` on panels and sheets (448px)
- **Touch targets:** Aim for minimum 44x44px
- **No horizontal scroll:** Explicitly prevented via CSS
- **Safe fallbacks:** The app works outside Telegram during development via `src/lib/telegram/webApp.ts`

---

## Accessibility

- All interactive elements use semantic HTML or proper ARIA
- `aria-modal`, `aria-invalid`, `aria-describedby`, `role="alert"` used where appropriate
- `prefers-reduced-motion` fully supported
- Focus states visible via `outline-none` + border color transitions
- Error states shown with both color and text (never color alone)
- Forms linked to labels via `htmlFor`/`id`
