# Mobile Table Layouts — UX Design

**Date:** 2026-07-17 14:00
**Author:** UX (BMAD)
**Based on:** src/app/horoscopes/[id]/page.tsx (lines 330-468), specs/ux/main-ux-spec.md

---

## Overview

The horoscope detail page's "calculations" tab contains two dense data tables (Houses: 6 columns, Planets: 9 columns) that overflow on mobile. This spec defines a responsive design approach that preserves data density on desktop while providing a comfortable, scannable card-based layout on mobile.

### Design Goals

1. **Zero horizontal scroll** — Primary content never scrolls horizontally
2. **Information hierarchy** — Essential columns always visible, secondary columns accessible via tap-to-expand
3. **Scannability** — Each row/card communicates the most important data at a glance
4. **Bilingual-safe** — Sinhala text is wider; layouts accommodate 20% text overflow

### Breakpoint

| View | Width | Behavior |
|------|-------|----------|
| Desktop/Tablet | >= 640px | Standard `<table>` with horizontal scroll overflow |
| Mobile | < 640px | Stacked card layout with expandable details |

---

## Houses Table

### Column Priority Analysis

| Column | Priority | Rationale |
|--------|----------|-----------|
| `#` (House number) | **Essential** | Primary identifier — always shown |
| `Planets` | **Essential** | Core astrological data — always shown |
| `Start` | **Secondary** | Degree data — shown in expanded view |
| `Mid` | **Secondary** | Degree data — shown in expanded view |
| `End` | **Secondary** | Degree data — shown in expanded view |
| `Aspects` | **Secondary** | Can be lengthy — shown in expanded view |

### Desktop (>= 640px)

No change from current implementation. Standard table with `overflow-x-auto`.

```
┌────┬──────────┬──────────┬──────────┬───────────────────┬──────────────────┐
│ #  │ Start    │ Mid      │ End      │ Planets           │ Aspects          │
├────┼──────────┼──────────┼──────────┼───────────────────┼──────────────────┤
│ 1  │ Ari 0°00'│ Ari 14°45│ Ari 29°30│ Sun (14°32')     │ Mars (+02:15:30) │
│    │          │          │          │ Mercury (8°12')   │                  │
├────┼──────────┼──────────┼──────────┼───────────────────┼──────────────────┤
│ 2  │ Tau 29°30│ Gem 14°15│ Gem 29°00│ —                 │ Venus (-01:30:00)│
└────┴──────────┴──────────┴──────────┴───────────────────┴──────────────────┘
```

### Mobile (< 640px) — Card Layout

Each house row becomes a card. Only House number and Planets are always visible. Start/Mid/End/Aspects are in a collapsible "Details" section.

```
┌─────────────────────────────────┐
│  H1                             │
│  ┌───────┐  ┌───────┐          │
│  │ Sun   │  │Mercury│          │
│  │ 14°32'│  │ 8°12' │          │
│  └───────┘  └───────┘          │
│                                 │
│  ▾ View details                 │
│                                 │
│  ┌───── Detail panel ──────┐    │
│  │ Start  Ari 0°00'        │    │
│  │ Mid    Ari 14°45'       │    │
│  │ End    Ari 29°30'       │    │
│  │ Aspects                 │    │
│  │  Mars +02:15:30         │    │
│  └─────────────────────────┘    │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  H2                             │
│  <span style="color: gray">No planets in house</span>            │
│                                 │
│  ▾ View details                 │
│  (tap to expand)                │
└─────────────────────────────────┘
```

#### Card Anatomy

```
┌──────────────────────────────────┐
│ [House #]                    [▸] │  ← header: house number + expand chevron
│                                  │
│ [Planet chips]                   │  ← always visible: planet names as pills
│                                  │
│ ─ ─ ─ collapsible section ─ ─ ─ │
│                                  │
│ Start   [value]                  │  ← hidden by default
│ Mid     [value]                  │
│ End     [value]                  │
│ Aspects [value]                  │
│                                  │
│ ▴ Collapse                       │  ← when expanded, shows collapse option
└──────────────────────────────────┘
```

#### Planet Chips (Mobile)

Planets are rendered as inline pills with the planet name and degree, wrapping naturally:

```
┌──────┐ ┌─────────┐ ┌─────────┐
│ Sun  │ │ Mercury │ │ Venus   │
│14°32'│ │  8°12'  │ │ 22°45'  │
└──────┘ └─────────┘ └─────────┘
```

- Max width per pill: ~90px
- Background: `--surface-elevated` (`#F8FAFC` light / `#2A2A3C` dark)
- Border radius: `--radius-sm` (6px)
- Font size: 11px for name, 10px for degree
- If no planets: muted text "No planets" / "ග්‍රහයින් නැත"

#### Empty State (No planets in house)

When a house has no planets, show a subtle placeholder instead of an empty card:

```
┌─────────────────────────────────┐
│  H4                             │
│  ── Empty ──                    │
│                                 │
│  ▾ View details                 │
└─────────────────────────────────┘
```

---

## Planets Table

### Column Priority Analysis

| Column | Priority | Rationale |
|--------|----------|-----------|
| `Planet` | **Essential** | Primary identifier — always shown |
| `Sign (Degree)` | **Essential** | Core position data — always shown |
| `House` | **Essential** | Key reference — always shown |
| `Strength` | **Essential** | Important dignitary info — always shown |
| `Nakshatra (Pada)` | **Secondary** | Detailed placement — expandable |
| `Navamsa` | **Secondary** | Derived placement — expandable |
| `Conjunctions` | **Secondary** | Can be lengthy — expandable |
| `Aspects` | **Secondary** | Can be very lengthy — expandable |
| `Other` | **Secondary** | Tags (combust, atmakaraka, etc.) — expandable |

### Desktop (>= 640px)

No change from current implementation. Standard table with `overflow-x-auto`.

```
┌────────┬──────────┬──────────┬────────────┬──────┬────────────┬─────────────┬────────────┬───────┐
│ Planet │ Sign     │Strength  │ Navamsa    │House │ Nakshatra  │Conjunctions │ Aspects    │ Other │
│        │ (Degree) │          │            │      │ (Pada)     │             │            │       │
├────────┼──────────┼──────────┼────────────┼──────┼────────────┼─────────────┼────────────┼───────┤
│ Sun    │ Ari 14°  │ Uchcha   │ Ari (Mars) │  1   │ Ashwini(1) │ Mercury(−)  │ Mars (60°) │ AK    │
│ ☢      │          │          │            │      │            │ Venus(+)    │            │       │
└────────┴──────────┴──────────┴────────────┴──────┴────────────┴─────────────┴────────────┴───────┘
```

### Mobile (< 640px) — Card Layout

Each planet becomes a card with a two-tier layout: always-visible header + expandable details.

```
┌──────────────────────────────────────┐
│  ☿ Mercury  ☢ (retrograde)          │
│  Ari 14°32'        H1               │
│                                      │
│  Exalted        Nakshatra            │
│                 Ashwini (1)          │
│                                      │
│  [Combust] [Atmakaraka]              │  ← tags, only if present
│                                      │
│  ▾ More details                      │
│                                      │
│  ┌───── Detail panel ─────────┐      │
│  │ Navamsa  Ari (Mars)        │      │
│  │ Conjs    Sun (+00:05:30)   │      │
│  │          Venus (+12:00:15) │      │
│  │ Aspects  Mars (60°)        │      │
│  │          Saturn (180°)     │      │
│  └────────────────────────────┘      │
└──────────────────────────────────────┘
```

#### Card Anatomy

```
┌──────────────────────────────────────┐
│ [Icon] [Planet Name] [flags]    [▸] │  ← header: icon + name + retrograde/flags
│                                      │
│ [Sign Degree]            [House #]   │  ← primary row: sign+degree | house
│                                      │
│ [Strength label]     [Nakshatra]     │  ← secondary row: strength | nakshatra(pada)
│                                      │
│ [Tag pills, if any]                  │  ← tag row: combust, atmakaraka, etc.
│                                      │
│ ▾ More details                       │  ← expand trigger
│                                      │
│ ─ ─ ─ collapsible section ─ ─ ─ ─  │
│                                      │
│ Navamsa      [value]                 │
│ Conjunctions [value]                 │
│ Aspects      [value]                 │
│                                      │
│ ▴ Less                               │  ← collapse trigger
└──────────────────────────────────────┘
```

#### Planet Icon + Name Header

On mobile, show a small planet symbol/icon alongside the name:

| Planet | Symbol (use Unicode or component) |
|--------|-----------------------------------|
| Sun | ☉ |
| Moon | ☽ |
| Mars | ♂ |
| Mercury | ☿ |
| Jupiter | ♃ |
| Venus | ♀ |
| Saturn | ♄ |
| Rahu | ☊ |
| Ketu | ☋ |

- Retrograde indicator: `(R)` suffix in muted color, or `(Retrograde)` in Sinhala `(ප‍රත්‍යන්ත)` after the name

#### Tag Pills (Mobile)

When a planet has tags (Combust, Atmakaraka, Drekkana Lord, etc.), render as colored inline pills:

```
┌──────────┐ ┌──────────────┐ ┌──────────────┐
│ Combust  │ │ Atmakaraka   │ │ Maraka       │
└──────────┘ └──────────────┘ └──────────────┘
```

- Combust: warning color background (`--warning` at 15% opacity, `--warning` text)
- Atmakaraka: primary color background (`--primary` at 10% opacity, `--primary` text)
- Others: secondary/default styling

#### Long Values (Conjunctions / Aspects)

When conjunction or aspect lists are long (3+ items), truncate with a count badge:

```
Conjs: Sun (+00:05:30), Venus (+12:00:15), Mars (+23:45:10)
```

Renders on mobile as:

```
Conjs: Sun, Venus, Mars +1
```

Tap the count badge `+1` to reveal the full list inline within the expanded section.

---

## Component Design

### MobileCard (Houses)

| Prop | Type | Description |
|------|------|-------------|
| `houseNumber` | `number` | House number (1-12) |
| `planets` | `Array<{name, degree}>` | Planets in this house |
| `startValue` | `string` | Formatted start degree |
| `midValue` | `string` | Formatted mid degree |
| `endValue` | `string` | Formatted end degree |
| `aspects` | `string[]` | Formatted aspect strings |
| `expanded` | `boolean` | Whether detail panel is open |
| `onToggle` | `() => void` | Expand/collapse handler |

### MobileCard (Planets)

| Prop | Type | Description |
|------|------|-------------|
| `planetName` | `string` | Display name (localized) |
| `planetIcon` | `string` | Unicode symbol |
| `retrograde` | `boolean` | Retrograde flag |
| `signDegree` | `string` | Formatted sign + degree |
| `house` | `number` | House number |
| `strength` | `string` | Strength label (localized) |
| `navamsa` | `string` | Navamsa sign + strength |
| `nakshatra` | `string` | Nakshatra name + pada |
| `conjunctions` | `string[]` | Formatted conjunction strings |
| `aspects` | `string[]` | Formatted aspect strings |
| `tags` | `string[]` | Special tags (Combust, AK, etc.) |
| `expanded` | `boolean` | Whether detail panel is open |
| `onToggle` | `() => void` | Expand/collapse handler |

### Shared: ExpandButton

| Prop | Type | Description |
|------|------|-------------|
| `expanded` | `boolean` | Current state |
| `label` | `{expanded: string, collapsed: string}` | i18n labels |
| `onClick` | `() => void` | Toggle handler |

**Desktop (>= 640px):** This component is not rendered; the `<table>` is used directly.

**Mobile (< 640px):** Each `<tr>` is conditionally replaced by a `<MobileCard>`.

---

## Interaction Patterns

### Tap to Expand

- **Trigger:** Tapping the card header area OR the "View details" / "More details" text
- **Animation:** Height transition `max-height: 0 → auto` with `300ms ease-out`
- **Chevron:** Rotates 180° (▸ → ▾) on expand with `200ms` rotation
- **Touch target:** Minimum 44x44px for the expand trigger area
- **Accessibility:** `aria-expanded="true/false"` on the trigger, `role="region"` on the detail panel, `aria-labelledby` linking header to panel

### Expand All / Collapse All

- A toggle button at the top of each section: "Expand all" / "Collapse all"
- Appears only on mobile (< 640px)
- Positioned below the section heading, right-aligned
- Uses the existing `--text-secondary` color

### Horizontal Scroll (Desktop Fallback)

- On desktop (>= 640px), both tables use `overflow-x-auto` as today
- Subtle shadow indicator on the right edge when content overflows
- No changes needed — this works well for desktop/tablet

---

## Accessibility

- **Keyboard navigation:** Tab through cards, Enter/Space to expand/collapse
- **Screen reader:** Each card is a `<section>` with `aria-label="House 1"` or `aria-label="Mercury planet data"`
- **Expanded state:** `aria-expanded` on trigger, `aria-controls` linking to the collapsible panel
- **Focus management:** After expanding, focus stays on the trigger (no focus jump)
- **Color contrast:** Planet pills use text on light backgrounds — verify 4.5:1 ratio
- **Sinhala labels:** All expand/collapse labels, empty states, and section titles must be i18n-aware

---

## Responsive Behavior

### Mobile (< 640px)

| Element | Behavior |
|---------|----------|
| Tables | Replaced by stacked card layout |
| Section heading | Stays the same (indigo, uppercase) |
| Card spacing | 12px vertical gap between cards |
| Card padding | 16px internal padding |
| Card border | 1px `--border`, `--radius-md` (8px) |
| Expand trigger | Full-width tappable area at card bottom |
| Planet chips | Flex-wrap, max-width 90px per pill |

### Desktop (>= 640px)

| Element | Behavior |
|---------|----------|
| Tables | Standard `<table>` as today |
| Cards | Not rendered |
| Expand controls | Not rendered |
| All columns visible | No change |

---

## Micro-interactions

### Card Expand/Collapse

- **Duration:** 300ms
- **Easing:** `ease-out` for expand, `ease-in` for collapse
- **Property:** `max-height` + `opacity` (detail panel fades in while expanding)
- **Chevron rotation:** 200ms `ease-in-out`

### Planet Chip Hover (Desktop)

- Subtle scale `1.02` on hover
- Cursor: pointer (if chips become tappable in future)

### Empty House Indicator

- Muted text with subtle bottom border
- No expand chevron shown (or shown but grayed out)

---

## Implementation Notes

### Conditional Rendering Strategy

In the page component, use a `useMediaQuery` hook or Tailwind responsive classes to switch between table and card layouts:

```tsx
// Pseudocode for conditional rendering
<div className="hidden sm:block">
  {/* Desktop table — current implementation */}
  <table>...</table>
</div>
<div className="block sm:hidden">
  {/* Mobile card layout — new */}
  {houses.map(h => <HouseMobileCard key={h.houseNumber} ... />)}
</div>
```

Alternatively, use a single component with responsive CSS that transforms table rows into card layouts at the breakpoint, avoiding duplicate JSX.

### State Management

- Expand/collapse state is local to each card (no global state needed)
- Use `useState` per card, keyed by house number or planet name
- Consider `useReducer` if expanding all/collapse all is needed globally

### Sinhala Width Accommodation

- Card headers should use `min-width: 120px` for planet names to prevent layout shift
- Truncate with ellipsis only after 120px; allow wrapping for names between 80-120px
- Use `line-clamp-2` for long aspect/conjunction lists in expanded panels

---

## File Index

| File | Description |
|------|-------------|
| `specs/ux/main-ux-spec.md` | Master UX reference (breakpoints, colors, typography) |
| `specs/ux/20260715-1230-full-app-ux-design.md` | Full app UX design |
| `specs/ux/20260717-1400-mobile-table-layouts.md` | This document |
| `src/app/horoscopes/[id]/page.tsx` | Target implementation file (lines 330-468) |
