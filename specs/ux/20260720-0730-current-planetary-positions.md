# Current Planetary Positions — UX Specification

**Date:** 2026-07-20 07:30
**Author:** UX (BMAD)
**Based on:** specs/business-analysis/actors.md, specs/business-analysis/data-model.md, specs/business-analysis/20260720-0658-current-planetary-positions.md, specs/architecture/overview.md, specs/architecture/20260720-0700-current-planetary-positions.md, specs/ux/main-ux-spec.md, specs/ux/20260715-1230-full-app-ux-design.md, specs/ux/20260719-1500-dasha-ux.md

---

## 1. Overview

The Current Planetary Positions overlay feature allows students to compare where the planets are right now (transiting) against where they were at the native's birth (natal), all on the same House (Rasi) chart. When toggled on, current planetary positions are fetched from the server in real-time and rendered as an overlay on top of the birth chart with distinct visual styling.

### Design Goals

1. **Instant visual differentiation** — Birth and current planets must be distinguishable at a glance, without relying on color alone
2. **Minimal cognitive load** — The overlay adds information without cluttering the chart; toggle provides clean on/off control
3. **Bilingual parity** — All labels, tooltips, legends, and states work in both Sinhala and English
4. **Graceful degradation** — Loading, error, and edge cases (merged positions) are all handled cleanly
5. **Keyboard-first accessibility** — Toggle and tooltips are fully keyboard-navigable

### Scope Decision: Per-Chart vs Global Toggle

**Recommendation: Per-chart toggle (not global).**

The toggle is scoped to the House chart only in v1, but the design accommodates future extension to other chart types. A global toggle would apply the overlay to all charts simultaneously, which is undesirable because:

- Different chart types serve different analytical purposes (Navamsa for marriage, Drekkana for siblings, etc.)
- Users may want transits on one chart but not another
- Future chart-specific overlays (e.g., transit aspects on Navamsa) need independent control

Each chart type that supports overlays gets its own toggle within its chart view. The toggle state is persisted per-chart in `FilterConfig.visibleSections` (e.g., `currentPlanetPositions: true` applies to the House chart only).

---

## 2. User Flow

```
User opens Horoscope Detail →
    1. Navigates to Charts tab → House chart is displayed (or user selects House from chart type selector)
    2. Current Planet Toggle is visible below the chart (default: OFF)
    3. User clicks/taps the toggle to enable current planetary positions
    4. Toggle switches to ON → loading spinner appears on the chart
    5. API call: GET /api/horoscope/:id/chart/house?includeCurrentPlanets=true
    6. Server computes current planet positions via Swiss Ephemeris
    7. Response includes currentPlanets[] array
    8. Chart re-renders: birth planets remain as-is, current planets appear in distinct style
    9. Chart legend updates to show "Birth Planet" and "Current Planet" entries
    10. User hovers/taps a current planet → tooltip shows detailed info (sign, degree, nakshatra, etc.)
    11. User clicks/taps a current planet → expanded info panel (same as birth planet pattern)
    12. User toggles OFF → current planets hidden (data kept in memory for instant re-show)
    13. Toggle preference is persisted to FilterConfig for next session
```

### Flow Diagram

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  House Chart │    │  Toggle ON   │    │  Loading     │    │  Overlay     │
│  (birth only)│───>│  (click/tap) │───>│  (spinner)   │───>│  Rendered    │
└──────────────┘    └──────────────┘    └──────────────┘    └──────┬───────┘
                                                                   │
                          ┌──────────────┐    ┌──────────────┐     │
                          │  Toggle OFF  │    │  Birth-only  │<────┘
                          │  (data kept) │───>│  (instant)   │  hover/click
                          └──────────────┘    └──────────────┘  ──> tooltip
```

---

## 3. Visual Design

### Birth Planet Style (Existing)

Birth planets use the existing chart rendering:

| Property | Value |
|----------|-------|
| Symbol | Unicode astrological glyph (☉, ☽, ♂, ☿, ♃, ♀, ♄, ☊, ☋) |
| Fill | Solid fill in planet-specific color (see color table below) |
| Stroke | None (filled symbol) |
| Opacity | 100% |
| Size | 16–20px depending on chart size |

### Current Planet Style (New)

Current (transiting) planets use a distinct visual treatment:

| Property | Value |
|----------|-------|
| Symbol | First letter of the planet name in Sinhala (e.g., ර for රවි/Sun, ස for සඳු/Moon) |
| Fill | Planet-specific color fill (same color as the birth planet but with adjusted styling) |
| Border | 2px solid in a distinct accent color (see below) — the border color differentiates current from birth |
| Opacity | 85% |
| Size | 16–20px (same as birth) |
| Font | Noto Sans Sinhala, bold weight, for Sinhala letter rendering |

**Planet Symbol Map (Sinhala First Letter):**

| Planet | English | Sinhala | Symbol |
|--------|---------|---------|--------|
| Sun | Sun | රවි | ර |
| Moon | Moon | සඳු | ස |
| Mars | Mars | කුජ | ක |
| Mercury | Mercury | බුධ | බ |
| Jupiter | Jupiter | ගුරු | ග |
| Venus | Venus | සිකුරු | ස |
| Saturn | Saturn | ශනි | ශ |
| Rahu | Rahu | රාහු | ර |
| Ketu | Ketu | කේතු | ක |

**Note on duplicates:** Some planets share the same first Sinhala letter (e.g., රවි/රාහු → ර, සඳු/සිකුරු → ස, කුජ/කේතු → ක). These are distinguished by their position in different houses on the chart and by the planet-specific fill color. If disambiguation is needed, the first two Sinhala letters may be used instead (e.g., රව, රා, සඳ, සි, කු, කේ).

### Current Planet Border Color

| Mode | Color | Token |
|------|-------|-------|
| Light mode | `#0EA5E9` (Sky Blue) | `--chart-transit` |
| Dark mode | `#38BDF8` (Sky Blue lighter) | `--chart-transit` |

**Rationale:** Sky blue is distinct from all existing planet colors (red, green, blue, purple, amber, pink, indigo, slate) and evokes the "sky/transit" concept. The border color is the primary visual differentiator — birth planets have no border, while current planets have a distinct sky-blue border.

### Visual Differentiation Summary

| Property | Birth Planet | Current Planet |
|----------|-------------|----------------|
| Symbol | Unicode astrological glyph (☉, ☽, ♂, ...) | First letter of Sinhala name (ර, ස, ක, ...) |
| Fill | Solid (planet color) | Solid (planet color) |
| Border | None | 2px `--chart-transit` (sky blue) |
| Opacity | 100% | 85% |
| Size | 16–20px | 16–20px (same) |

Differentiation is achieved through **symbol type** (glyph vs Sinhala letter), **border color** (none vs sky blue), and **opacity** (100% vs 85%).

### Legend Design

The chart legend expands to show two categories when the overlay is active:

```
┌─── Chart Legend ──────────────────────────────────┐
│                                                    │
│  Birth Planets:                                    │
│  ☉ Sun    ☽ Moon    ♂ Mars    ☿ Mercury           │
│  ♃ Jupiter  ♀ Venus   ♄ Saturn  ☊ Rahu  ☋ Ketu    │
│                                                    │
│  Current Planets (transit):                        │
│  ර Sun    ස Moon    ක Mars    බ Mercury           │
│  ග Jupiter  ස Venus   ශ Saturn  ර Rahu  ක Ketu    │
│                                                    │
└────────────────────────────────────────────────────┘
```

When the overlay is OFF, only the "Birth Planets" section is shown (existing behavior). When ON, both sections appear with a clear visual label differentiating them. Current planet legend items use the Sinhala first-letter symbol and sky-blue border style matching their chart rendering.

### Merged Position Rendering

When a current planet occupies the same house and approximately the same degree as its birth counterpart:

**Case 1: Same house, degree difference < 2°**

Render a **split symbol**:
- Left half: Unicode astrological glyph with solid fill (birth)
- Right half: Sinhala first letter with sky-blue border (current)
- Both share the same position within the house

```
┌─────────┐
│  ☉/ර    │  ← Left: birth glyph / Right: current Sinhala letter
└─────────┘
```

**Case 2: Same house, degree difference >= 2°**

Render both symbols separately at their respective positions within the house. No special merging — they appear as two distinct symbols (one glyph, one Sinhala letter) near each other.

**Case 3: Different houses**

Normal rendering — each planet appears in its own house. This is the most common case.

### Toggle Button Design and Placement

```
┌─── House Chart ─────────────────────────────────────────┐
│                                                          │
│         ┌──────────────────────────────────┐             │
│         │                                  │             │
│         │       House (Rasi) Chart          │             │
│         │                                  │             │
│         │    ┌───┬───┬───┐                 │             │
│         │    │12 │ 1 │ 2 │                 │             │
│         │    ├───┼───┼───┤                 │             │
│         │    │11 │   │ 3 │                 │             │
│         │    ├───┤☉  ├───┤                 │             │
│         │    │10 │   │ 4 │                 │             │
│         │    ├───┼───┼───┤                 │             │
│         │    │ 9 │ 8 │ 5 │                 │             │
│         │    │   │   │ 6 │ 7 │             │             │
│         │    └───┴───┴───┘                 │             │
│         │                                  │             │
│         └──────────────────────────────────┘             │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  ☀ Show Current Planets          [Toggle: ○/●]  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─── Legend ─────────────────────────────────────────┐  │
│  │  Birth: ☉ ☽ ♂ ☿ ♃ ♀ ♄ ☊ ☋                      │  │
│  │  Current: ☉ ☽ ♂ ☿ ♃ ♀ ♄ ☊ ☋ (outline)          │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| Placement | Below the chart, above the legend |
| Style | Toggle switch (pill shape) with label |
| Label (EN) | "Show Current Planets" |
| Label (SI) | "වත්මන් ග්‍රහ පිහිටීම් පෙන්වන්න" |
| Label icon | Small sun/transit icon (optional, decorative) |
| Toggle size | 44x24px touch target (meets 44px minimum) |
| Toggle color (OFF) | `--border` background, white knob |
| Toggle color (ON) | `--chart-transit` background, white knob |

### Loading State for Overlay

When the toggle is ON and data is being fetched:

```
┌─── House Chart ─────────────────────────────────────────┐
│                                                          │
│         ┌──────────────────────────────────┐             │
│         │                                  │             │
│         │       House (Rasi) Chart          │             │
│         │          (birth only)             │             │
│         │                                  │             │
│         │         ┌────────────┐            │             │
│         │         │  ◌ ◌ ◌    │            │             │
│         │         │  Loading   │            │             │
│         │         │  current   │            │             │
│         │         │  planets...│            │             │
│         │         └────────────┘            │             │
│         │                                  │             │
│         └──────────────────────────────────┘             │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  ☀ Show Current Planets   [Toggle: ●] (loading) │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| Indicator | Small spinner (16px) next to the toggle label |
| Label change | "(loading...)" / "(බාරගනිමින්...)" appended to toggle label |
| Chart state | Birth planets remain visible; no overlay shown yet |
| Toggle state | Toggle is ON but temporarily disabled during fetch |
| Duration | Typically 200–500ms (ephemeris calculation) |

### Error State for Overlay

When the current planet calculation fails:

```
┌──────────────────────────────────────────────────────┐
│  ⚠️ Unable to load current planetary positions.      │
│     Please try again.                                │
│                                        [Retry]       │
└──────────────────────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| Style | Inline error banner below the toggle |
| Icon | Warning triangle (⚠️) in `--warning` color |
| Message (EN) | "Unable to load current planetary positions. Please try again." |
| Message (SI) | "වත්මන් ග්‍රහ පිහිටීම් පූරණය කළ නොහැක. නැවත උත්සාහ කරන්න." |
| Action | "Retry" button re-fetches current planets |
| Toggle state | Toggle reverts to OFF |
| Auto-dismiss | Error banner dismisses after 10 seconds or on next successful toggle |

---

## 4. Interaction Patterns

### Toggle Behavior

| Action | Behavior |
|--------|----------|
| Click/tap toggle (OFF → ON) | Toggle moves to ON, spinner appears, API call fires |
| Click/tap toggle (ON → OFF) | Toggle moves to OFF, overlay hidden instantly (no API call), data retained in memory |
| Click/tap toggle while loading | No-op (toggle is temporarily disabled during fetch) |
| Toggle ON with cached data (< 10 min old) | No loading state — overlay appears instantly from memory |
| Toggle ON with stale data (> 10 min) | Silent refresh in background (no loading state shown) |
| Preference saved | Debounced (300ms) save to FilterConfig on toggle change |

### Hover Tooltip for Current Planets

When the user hovers over (desktop) or long-presses (mobile) a current planet symbol:

```
┌─── Current Planet: Sun ────────────────────┐
│                                             │
│  ☉ Sun (Current)                            │
│  Cancer (Kataka) 15° 32'                    │
│  House 7                                    │
│  Nakshatra: Pushya (Pada 3)                 │
│  Strength: Uchcha (Exalted)                 │
│  Status: Direct                             │
│                                             │
└─────────────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| Trigger | Mouse hover (desktop), long-press 500ms (mobile) |
| Content | Planet name (localized), sign + degree, house, nakshatra + pada, retrograde/combustion status, strength |
| Header label | "Sun (Current)" / "රවි (වත්මන්)" — includes "(Current)" suffix to distinguish from birth planet tooltip |
| Position | Follows cursor (desktop), centered above element (mobile) |
| Delay | 200ms hover delay before showing |
| Dismiss | Mouse leaves tooltip area, or tap elsewhere |
| Max width | 280px |
| Z-index | Above chart SVG (z-50) |

### Birth Planet Tooltip (Existing — Updated)

Birth planet tooltips gain a "(Birth)" suffix in their header to distinguish from current planet tooltips:

```
┌─── Birth Planet: Sun ─────────────────────┐
│                                             │
│  ☉ Sun (Birth)                              │
│  Aries (Mesha) 12° 30'                      │
│  House 1                                    │
│  Nakshatra: Ashwini (Pada 2)                │
│  Strength: Uchcha (Exalted)                 │
│  Status: Direct                             │
│                                             │
└─────────────────────────────────────────────┘
```

### Click Interaction

| Platform | Action |
|----------|--------|
| Desktop | Click on planet symbol → expanded info panel (same position as tooltip, but persistent until clicked away) |
| Mobile | Tap on planet symbol → tooltip appears (tap elsewhere to dismiss) |
| Both | Click/tap on merged symbol → shows both birth and current info in a combined tooltip |

### Keyboard Accessibility

| Key | Action |
|-----|--------|
| `Tab` | Moves focus to the toggle switch |
| `Enter` / `Space` | Toggles the switch ON/OFF |
| `Tab` (after toggle ON) | Moves focus into the chart SVG for planet navigation |
| `Arrow keys` (within chart) | Navigate between planet symbols (if chart supports keyboard navigation) |
| `Enter` / `Space` (on planet) | Opens the tooltip for the focused planet |
| `Escape` | Closes any open tooltip |
| `Tab` (from chart) | Moves focus to the legend or next interactive element |

### Screen Reader Announcements

| Action | Announcement |
|--------|--------------|
| Toggle ON | "Current planetary positions enabled. Loading current planet data." / "වත්මන් ග්‍රහ පිහිටීම් සක්‍රිය කරන ලදී. වත්මන් ග්‍රහ දත්ත බාරගනිමින්." |
| Data loaded | "Current planetary positions loaded. 9 planets displayed." / "වත්මන් ග්‍රහ පිහිටීම් බාරගනු ලැබීය. ග්‍රහයින් 9 ක් පෙන්වයි." |
| Toggle OFF | "Current planetary positions hidden." / "වත්මන් ග්‍රහ සැඟවුණි." |
| Error | "Unable to load current planetary positions. Error: [message]. Retry available." / "වත්මන් ග්‍රහ පිහිටීම් පූරණය කළ නොහැක." |
| Planet focused | "Sun, current position, Cancer 15 degrees 32 minutes, House 7" / "රවි, වත්මන් පිහිටීම, කටක 15 අංශ 32 මිනිත්තු, භාව 7" |
| Merged position | "Sun, birth and current position merged, Aries 12 degrees" / "රවි, උපත් සහ වත්මන් පිහිටීම ඒකාබද්ධ, මේෂ 12 අංශ" |

---

## 5. Responsive Behavior

### Desktop (> 1024px)

| Element | Behavior |
|---------|----------|
| Toggle placement | Below chart, left-aligned, above legend |
| Toggle style | Pill toggle with label text |
| Chart size | 400–600px (existing) |
| Tooltip | Follows cursor, positioned dynamically |
| Legend | Below toggle, full-width |

### Tablet (640px – 1024px)

| Element | Behavior |
|---------|----------|
| Toggle placement | Below chart, full-width row |
| Toggle style | Same as desktop |
| Chart size | 320–400px |
| Tooltip | Fixed position above chart (not cursor-following) |
| Legend | Below toggle, 2-column grid |

### Mobile (< 640px)

| Element | Behavior |
|---------|----------|
| Toggle placement | Below chart, full-width, centered |
| Toggle style | Larger touch target (48x28px toggle, 44px min tap area) |
| Toggle label | May abbreviate to "Current Planets" / "වත්මන් ග්‍රහ" on very small screens |
| Chart size | 280–320px (existing) |
| Tooltip | Tap-to-show, centered above chart, dismissible by tapping elsewhere |
| Legend | Collapsible (tap to expand), default collapsed |
| Touch targets | All interactive elements minimum 44x44px |

### Mobile Toggle Detail

```
┌───────────────────────────────────┐
│  ┌─────────────────────────────┐  │
│  │                             │  │
│  │     House (Rasi) Chart      │  │
│  │         (280px)             │  │
│  │                             │  │
│  └─────────────────────────────┘  │
│                                   │
│  ☀ වත්මන් ග්‍රහ     ╭───────╮    │
│                    │ ●   ○ │    │
│                    ╰───────╯    │
│                                   │
│  ▸ Legend (tap to expand)         │
│                                   │
└───────────────────────────────────┘
```

---

## 6. Bilingual Considerations

### Toggle Label

| Language | Label |
|----------|-------|
| English | "Show Current Planets" |
| Sinhala | "වත්මන් ග්‍රහ පිහිටීම් පෙන්වන්න" |

### Legend Labels

| Element | English | Sinhala |
|---------|---------|---------|
| Birth planets section | "Birth Planets" | "උපත් ග්‍රහයින්" |
| Current planets section | "Current Planets (transit)" | "වත්මන් ග්‍රහයින් (ගමන්)" |
| Transit label suffix | "(transit)" | "(ගමන්)" |

### Tooltip Content

| Field | English | Sinhala |
|-------|---------|---------|
| Planet header (current) | "Sun (Current)" | "රවි (වත්මන්)" |
| Planet header (birth) | "Sun (Birth)" | "රවි (උපත්)" |
| Sign label | "Cancer" | "කටක" |
| House label | "House 7" | "භාව 7" |
| Nakshatra label | "Pushya (Pada 3)" | "පුෂ්ය (පාද 3)" |
| Strength label | "Uchcha (Exalted)" | "උච්ච (උත්කෘෂ්ට)" |
| Retrograde label | "Retrograde" | "ප්‍රත්‍යන්ත" |
| Direct label | "Direct" | "සෘජු" |
| Combust label | "Combust" | "දහන" |
| Loading message | "Loading current planets..." | "වත්මන් ග්‍රහ බාරගනිමින්..." |
| Error message | "Unable to load current planetary positions." | "වත්මන් ග්‍රහ පිහිටීම් පූරණය කළ නොහැක." |
| Retry button | "Retry" | "නැවත උත්සාහ කරන්න" |

### Sinhala Width Accommodation

- Toggle label may be up to 30% wider in Sinhala — use `min-width` or allow wrapping
- Tooltip max-width: 320px (slightly wider than English to accommodate Sinhala text)
- Legend labels use `min-width: 120px` to prevent layout shift

---

## 7. States

### State 1: Default (Toggle OFF — Birth Planets Only)

The chart displays only birth planets. No current planet data is loaded. This is the default state for all users.

```
┌─── House Chart ─────────────────────────────┐
│                                              │
│         [Chart with birth planets only]       │
│                                              │
│  ☀ Show Current Planets     [○ OFF]         │
│                                              │
│  Legend: Birth Planets only                   │
│                                              │
└──────────────────────────────────────────────┘
```

### State 2: Loading (Spinner While Fetching)

Toggle is ON, API call is in progress. Birth planets remain visible. A small spinner appears next to the toggle label.

```
┌─── House Chart ─────────────────────────────┐
│                                              │
│         [Chart with birth planets only]       │
│                                              │
│  ☀ Show Current Planets   [● ON] ◌ loading  │
│                                              │
│  Legend: Birth Planets only (waiting)         │
│                                              │
└──────────────────────────────────────────────┘
```

### State 3: Loaded (Current Planets Visible)

Toggle is ON, data received. Birth and current planets both rendered. Legend shows both sections.

```
┌─── House Chart ─────────────────────────────┐
│                                              │
│    [Chart with birth + current planets]       │
│    (birth: solid, current: outline)          │
│                                              │
│  ☀ Show Current Planets     [● ON]          │
│                                              │
│  Legend: Birth + Current Planets              │
│                                              │
└──────────────────────────────────────────────┘
```

### State 4: Error (Calculation Failure)

Toggle attempted ON but API returned error. Toggle reverts to OFF. Error banner shown below toggle.

```
┌─── House Chart ─────────────────────────────┐
│                                              │
│         [Chart with birth planets only]       │
│                                              │
│  ☀ Show Current Planets     [○ OFF]         │
│                                              │
│  ⚠️ Unable to load current planetary         │
│     positions. Please try again.  [Retry]    │
│                                              │
│  Legend: Birth Planets only                   │
│                                              │
└──────────────────────────────────────────────┘
```

### State 5: Merged Position (Edge Case)

All or most current planets occupy the same position as birth planets. The chart shows dual-ring symbols where they overlap, and separate symbols where they differ.

```
┌─── House Chart ─────────────────────────────┐
│                                              │
│    [Chart with merged symbols where           │
│     birth + current overlap]                 │
│                                              │
│  ☀ Show Current Planets     [● ON]          │
│                                              │
│  Legend: Birth + Current Planets              │
│  Note: Some planets at same position         │
│                                              │
└──────────────────────────────────────────────┘
```

No special "empty" state needed — the overlay always has content (9 planets). The merged rendering handles the case where positions coincide.

### State 6: Silent Refresh (Background Update)

Data is cached but older than 10 minutes. The overlay remains visible with current data while a silent background refresh occurs. No loading indicator is shown to the user.

---

## 8. Accessibility

### ARIA Labels for Toggle

| Element | ARIA |
|---------|------|
| Toggle container | `role="switch"` with `aria-checked="true"` or `"false"` |
| Toggle label | `aria-label="Show current planetary positions on House chart"` / "භාව සටහනේ වත්මන් ග්‍රහ පිහිටීම් පෙන්වන්න" |
| Loading state | `aria-busy="true"` on the toggle container |
| Error state | `aria-invalid="true"` on the toggle, error message linked via `aria-describedby` |

### Focus Management When Overlay Appears

| Event | Focus Behavior |
|-------|----------------|
| Toggle ON → data loads | Focus stays on toggle (no focus jump) |
| Toggle ON → error | Focus stays on toggle, error message announced via `aria-live` |
| Toggle OFF | Focus stays on toggle |
| Tooltip opens on hover | No focus change (hover only) |
| Tooltip opens on keyboard | Focus moves to tooltip, Escape returns focus to planet |

### Announcements for Loading/Error States

Use `aria-live="polite"` regions for:

| Event | Region Text |
|-------|-------------|
| Loading starts | "Loading current planetary positions..." |
| Loading complete | "Current planetary positions loaded. 9 planets displayed." |
| Load error | "Unable to load current planetary positions. [Error details]." |
| Toggle off | "Current planetary positions hidden." |

### Distinguishable Visual Styles (Not Just Color)

The overlay uses **three independent visual channels** to differentiate birth from current planets:

1. **Fill vs Outline** — Birth planets are solid-filled; current planets are outline-only (most significant difference)
2. **Color** — Birth planets use planet-specific colors; current planets use sky blue (`--chart-transit`)
3. **Opacity** — Birth planets at 100%; current planets at 85%

Additionally:
- The legend explicitly labels "Birth" and "Current" categories
- Tooltips include "(Birth)" or "(Current)" in their headers
- Screen readers announce the planet type when focused

### Keyboard Navigation for Tooltips

| Key | Action |
|-----|--------|
| `Tab` | Navigate to next focusable element (toggle → chart planets → legend) |
| `Enter` / `Space` (on planet) | Open tooltip for that planet |
| `Escape` | Close open tooltip, return focus to planet |
| `Arrow keys` (when tooltip open) | Navigate between tooltip content items (if applicable) |

---

## 9. Detailed Component Specs

### 9.1 CurrentPlanetToggle

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Current toggle state |
| `loading` | `boolean` | Whether current planet data is being fetched |
| `error` | `string \| null` | Error message if fetch failed |
| `onToggle` | `(enabled: boolean) => void` | Toggle handler |
| `onRetry` | `() => void` | Retry handler (shown when error) |
| `language` | `'si' \| 'en'` | Current UI language |

**Component States:**

| State | Visual |
|-------|--------|
| OFF | Toggle knob left, `--border` background, label "Show Current Planets" |
| ON (idle) | Toggle knob right, `--chart-transit` background, label unchanged |
| ON (loading) | Toggle knob right, `--chart-transit` background, spinner icon, label + "(loading...)" |
| Error | Toggle OFF, error banner below with retry button |
| Disabled (during fetch) | Toggle visually ON but pointer-events: none, reduced opacity |

**Behavior:**
- Click/tap toggles between ON/OFF
- During loading, click is ignored (debounce)
- Error state shows retry button; clicking retry re-fetches
- On language change, label updates immediately

### 9.2 CurrentPlanetOverlay

| Property | Type | Description |
|----------|------|-------------|
| `currentPlanets` | `CurrentPlanetRecord[]` | Array of current planet data |
| `birthPlanets` | `PlanetRecord[]` | Array of birth planet data (for merge detection) |
| `houseData` | `House[]` | House cusp data (for position calculation) |
| `visible` | `boolean` | Whether overlay is rendered |
| `onPlanetHover` | `(planet: CurrentPlanetRecord, x: number, y: number) => void` | Hover handler |
| `onPlanetClick` | `(planet: CurrentPlanetRecord) => void` | Click handler |
| `onPlanetBlur` | `() => void` | Blur/leave handler |
| `language` | `'si' \| 'en'` | Current UI language |

**Rendering Rules:**

1. For each current planet, calculate SVG position based on house + degree
2. Check for merge: if `|currentDegree - birthDegree| < 2°` in same house → render dual-ring
3. Otherwise render outline-only glyph at current position
4. Apply `--chart-transit` color for stroke, transparent fill
5. Add `aria-label` with full planet description (localized)

**SVG Structure:**

```svg
<g class="current-planet-overlay" aria-label="Current planetary positions overlay">
  <!-- For each current planet -->
  <g class="current-planet" data-planet="sun" aria-label="Sun, current position, Cancer 15°32', House 7">
    <!-- Normal rendering: Sinhala first letter with planet fill + sky-blue border -->
    <circle cx="..." cy="..." r="10" fill="planet-color" stroke="#0EA5E9" stroke-width="2" opacity="0.85" />
    <text class="planet-sinhala-letter" font-family="Noto Sans Sinhala" font-weight="bold" ...>ර</text>
    
    <!-- OR merged rendering (when birth planet at same position) -->
    <!-- Left half: birth glyph; Right half: current Sinhala letter -->
    <text class="planet-glyph" x="..." y="..." text-anchor="middle">☉</text>
    <text class="planet-sinhala-letter" x="..." y="..." text-anchor="middle" dx="8" ...>ර</text>
    <circle cx="..." cy="..." r="14" fill="none" stroke="#0EA5E9" stroke-width="2" />
  </g>
</g>
```

### 9.3 PlanetTooltip

| Property | Type | Description |
|----------|------|-------------|
| `planet` | `CurrentPlanetRecord \| PlanetRecord \| null` | Planet data (current or birth) |
| `isCurrentPlanet` | `boolean` | Whether this is a current (transiting) planet |
| `position` | `{ x: number, y: number }` | Tooltip position (screen coordinates) |
| `visible` | `boolean` | Whether tooltip is shown |
| `onClose` | `() => void` | Close handler |
| `language` | `'si' \| 'en'` | Current UI language |

**Content Layout:**

```
┌─── {Planet Name} ({Birth|Current}) ──────────┐
│                                                │
│  {Sign Name} {Degree}° {Minutes}'              │
│  House {Number}                                │
│                                                │
│  Nakshatra: {Name} (Pada {N})                  │
│  Strength: {Label}                             │
│  Status: {Retrograde|Direct|Combust}           │
│                                                │
└────────────────────────────────────────────────┘
```

**Positioning Rules:**

| Context | Position |
|---------|----------|
| Desktop hover | Follows cursor, offset 12px right and 12px down |
| Desktop click | Fixed position near clicked element |
| Mobile tap | Centered horizontally above the chart, offset 8px above |
| Edge detection | Flip to left side if tooltip would overflow right edge; flip below if would overflow bottom |

**Timing:**

| Event | Delay |
|-------|-------|
| Hover show | 200ms |
| Hover hide | 100ms (allows moving to tooltip) |
| Click show | Instant |
| Click dismiss | Click elsewhere or Escape |

### 9.4 ChartLegend Update

The existing `ChartLegend` component gains new entries when the overlay is active.

**When overlay OFF:**

```
┌─── Legend ──────────────────────────────────────────────┐
│                                                         │
│  ☉ Sun  ☽ Moon  ♂ Mars  ☿ Mercury  ♃ Jupiter          │
│  ♀ Venus  ♄ Saturn  ☊ Rahu  ☋ Ketu                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**When overlay ON:**

```
┌─── Legend ──────────────────────────────────────────────┐
│                                                         │
│  Birth Planets:                                         │
│  ☉ Sun  ☽ Moon  ♂ Mars  ☿ Mercury  ♃ Jupiter          │
│  ♀ Venus  ♄ Saturn  ☊ Rahu  ☋ Ketu                     │
│                                                         │
│  Current Planets (transit):                             │
│  ර Sun  ස Moon  ක Mars  බ Mercury  ග Jupiter          │
│  ස Venus  ශ Saturn  ර Rahu  ක Ketu                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Legend Entry Design:**

| Property | Birth Planet | Current Planet |
|----------|-------------|----------------|
| Symbol | Unicode astrological glyph | First letter of Sinhala name |
| Style | Solid fill | Solid fill + 2px sky-blue border |
| Color | Planet-specific color | Planet-specific color |
| Label | Planet name (localized) | Planet name (localized) |
| Category header | "Birth Planets" / "උපත් ග්‍රහයින්" | "Current Planets (transit)" / "වත්මන් ග්‍රහයින් (ගමන්)" |

**Additional Props:**

| Prop | Type | Description |
|------|------|-------------|
| `showCurrentPlanets` | `boolean` | Whether to show current planet legend entries |
| `language` | `'si' \| 'en'` | Current UI language |

---

## 10. Micro-interactions

| Action | Effect |
|--------|--------|
| Toggle ON | Toggle knob slides right (200ms `ease-out`), background transitions to `--chart-transit` |
| Toggle OFF | Toggle knob slides left (200ms `ease-in`), background transitions to `--border` |
| Current planets appear | Each planet fades in with staggered 50ms delay per planet (total ~450ms for 9 planets) |
| Current planets disappear | All fade out simultaneously (150ms) |
| Merged symbol appears | Split symbol fades in with a brief highlight pulse on the divider (300ms) to draw attention |
| Tooltip appears | Fade in (100ms `ease-out`) + slight upward slide (4px) |
| Tooltip disappears | Fade out (80ms `ease-in`) |
| Loading spinner | Continuous rotation (1s linear infinite) |
| Error banner | Slide down from toggle area (200ms `ease-out`) |
| Error retry | Banner slides up (150ms), new spinner appears |
| Legend expand (mobile) | Height transition 0 → auto (200ms `ease-out`) |
| Silent refresh | Subtle pulse on toggle icon (150ms) to indicate data was updated |

---

## 11. i18n Content Map

| Key | English | Sinhala |
|-----|---------|---------|
| `currentPlanets.toggle_label` | Show Current Planets | වත්මන් ග්‍රහ පිහිටීම් පෙන්වන්න |
| `currentPlanets.loading` | Loading current planets... | වත්මන් ග්‍රහ බාරගනිමින්... |
| `currentPlanets.loaded` | Current planetary positions loaded | වත්මන් ග්‍රහ පිහිටීම් බාරගනු ලැබීය |
| `currentPlanets.hidden` | Current planetary positions hidden | වත්මන් ග්‍රහ සැඟවුණි |
| `currentPlanets.error` | Unable to load current planetary positions. | වත්මන් ග්‍රහ පිහිටීම් පූරණය කළ නොහැක. |
| `currentPlanets.retry` | Retry | නැවත උත්සාහ කරන්න |
| `currentPlanets.planets_loaded` | {count} planets displayed | ග්‍රහයින් {count} ක් පෙන්වයි |
| `currentPlanets.legend_birth` | Birth Planets | උපත් ග්‍රහයින් |
| `currentPlanets.legend_current` | Current Planets (transit) | වත්මන් ග්‍රහයින් (ගමන්) |
| `currentPlanets.tooltip_current` | {planet} (Current) | {planet} (වත්මන්) |
| `currentPlanets.tooltip_birth` | {planet} (Birth) | {planet} (උපත්) |
| `currentPlanets.house` | House {n} | භාව {n} |
| `currentPlanets.nakshatra` | Nakshatra: {name} (Pada {n}) | නක්ෂත්‍රය: {name} (පාද {n}) |
| `currentPlanets.strength` | Strength: {label} | බලය: {label} |
| `currentPlanets.retrograde` | Retrograde | ප්‍රත්‍යන්ත |
| `currentPlanets.direct` | Direct | සෘජු |
| `currentPlanets.combust` | Combust | දහන |
| `currentPlanets.merged_note` | Birth and current position merged | උපත් සහ වත්මන් පිහිටීම ඒකාබද්ධ |
| `currentPlanets.sr_toggle_label` | Show current planetary positions on House chart | භාව සටහනේ වත්මන් ග්‍රහ පිහිටීම් පෙන්වන්න |

---

## 12. File Index

| File | Description |
|------|-------------|
| `specs/ux/main-ux-spec.md` | Master UX reference — updated with current planetary positions section, interaction patterns, empty state |
| `specs/ux/20260720-0730-current-planetary-positions.md` | This document — full Current Planetary Positions overlay UX specification |

---

## Appendix A: Component Props Interface

### CurrentPlanetToggle

| Prop | Type | Description |
|------|------|-------------|
| `enabled` | `boolean` | Current toggle state |
| `loading` | `boolean` | Whether fetching current planet data |
| `error` | `string \| null` | Error message if fetch failed |
| `onToggle` | `(enabled: boolean) => void` | Toggle state change handler |
| `onRetry` | `() => void` | Retry handler (shown on error) |
| `language` | `'si' \| 'en'` | Current UI language for label localization |

### CurrentPlanetOverlay

| Prop | Type | Description |
|------|------|-------------|
| `currentPlanets` | `CurrentPlanetRecord[]` | Current planet data from API |
| `birthPlanets` | `PlanetRecord[]` | Birth planet data (for merge detection) |
| `houseData` | `House[]` | House cusp data for position mapping |
| `visible` | `boolean` | Whether overlay is rendered |
| `onPlanetHover` | `(planet: CurrentPlanetRecord, x: number, y: number) => void` | Hover/cursor position handler |
| `onPlanetClick` | `(planet: CurrentPlanetRecord) => void` | Click/tap handler |
| `onPlanetBlur` | `() => void` | Mouse leave / touch end handler |
| `language` | `'si' \| 'en'` | Current UI language |

### PlanetTooltip

| Prop | Type | Description |
|------|------|-------------|
| `planet` | `CurrentPlanetRecord \| PlanetRecord \| null` | Planet data to display |
| `isCurrentPlanet` | `boolean` | Whether this is a current (transiting) planet |
| `position` | `{ x: number, y: number }` | Screen coordinates for tooltip placement |
| `visible` | `boolean` | Whether tooltip is shown |
| `onClose` | `() => void` | Close/dismiss handler |
| `language` | `'si' \| 'en'` | Current UI language |

### ChartLegend (Updated)

| Prop | Type | Description |
|------|------|-------------|
| `planets` | `PlanetRecord[]` | Birth planet data |
| `showCurrentPlanets` | `boolean` | Whether to show current planet legend entries |
| `currentPlanets` | `CurrentPlanetRecord[] \| null` | Current planet data (for legend entries) |
| `language` | `'si' \| 'en'` | Current UI language |

---

## Appendix B: Design Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Per-chart vs global toggle | Per-chart | Different chart types serve different purposes; users may want overlay on one chart but not another |
| Current planet symbol | First letter of Sinhala name (e.g., ර for රවි) | User requirement; leverages the Sinhala-first UI and makes current planets visually distinct at a glance |
| Current planet border | 2px sky-blue border (`#0EA5E9`) | Border color differentiates current from birth without changing the fill color; sky blue is distinct from all planet colors |
| Merged position rendering | Split symbol (glyph + Sinhala letter) | Both birth and current visible simultaneously; no overlap or occlusion |
| Merged position threshold | < 2° degree difference | Balances precision with readability; avoids false merges for planets in same house but different positions |
| Toggle persistence | FilterConfig (existing pattern) | Leverages existing infrastructure; no new collection needed |
| Default state | OFF | Current planets are opt-in; avoids overwhelming new users |
| Tooltip content | Same fields for both birth and current | Consistency; users compare same data points across both sets |
| Loading approach | Show birth chart immediately, overlay after load | Birth data is instant (pre-calculated); current data is ephemeral (real-time) |
| Silent refresh | 10-minute TTL, background fetch | Positions change slowly; 10min is a good balance of freshness vs. API calls |
| Mobile legend | Collapsible | Saves screen space on small viewports; legend is reference material, not primary interaction |
