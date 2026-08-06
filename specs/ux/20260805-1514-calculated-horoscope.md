# Calculated Horoscope (Manual Entry) — UX Design

**Date:** 2026-08-05 15:14
**Author:** UX
**Based on:** `specs/business-analysis/20260805-1514-calculated-horoscope.md`, `specs/business-analysis/actors.md`, `specs/business-analysis/data-model.md`, `specs/architecture/20260805-1514-calculated-horoscope.md`, `specs/ux/main-ux-spec.md`, `specs/ux/20260730-1200-planet-cards.md`, `specs/ux/20260804-1000-dual-charts-birth-navamsa.md`, `src/app/horoscopes/new/page.tsx`, `src/app/horoscopes/[id]/page.tsx`

---

## Overview

Astrology students receive already-calculated horoscopes (printed charts) without birth details and want to enter them for study. This feature adds a **"Calculated Chart" mode** to the Add Horoscope flow: the student enters a name + Lagna, places the 9 planets in the derived 12-house table (and optionally a Navamsa Lagna + Navamsa house table), and the system derives aspects, conjunctions, validation, a planets table, and probable birth ranges (time, month, date, age).

**UX goals:**

1. **Entry-first, not form-first** — two dedicated entry points on the Horoscopes list ("Add Birth Details" / "Add Calculated Chart") lead to two separate pages; the birth-details form is never shown on the manual page
2. **House table as the canvas** — the 12-house table is the primary editing surface; all derived output (planets table, validation, ranges) is secondary, read-only, and updates live
3. **Zero-surprise feedback** — validation badges, live-recomputed tables, and clear "not enough data" states for ephemeris-dependent sections
4. **Bilingual parity** — every element works in Sinhala and English (following the repo's numeric-enum + i18n conventions)
5. **Study-first progressive disclosure** — derived tables collapse/expand, never forcing all data on screen at once

---

## Entry points (Horoscopes list)

```
┌──────────────────────────────────────────────────────────────┐
│  Horoscopes / කේන්දර                                          │
│  [ + Add Birth Details ]  [ + Add Calculated Chart ]         │
│  උපන් විස්තර එක් කරන්න       ගණනය කළ කේන්දරය එක් කරන්න        │
└──────────────────────────────────────────────────────────────┘
```

- Two buttons replace the single "Add Horoscope" button on the Horoscopes list page.
- **Add Birth Details** → `/horoscopes/new` (existing birth-details form, unchanged, `max-w-2xl`).
- **Add Calculated Chart** → `/horoscopes/new/manual` (dedicated full-width manual page).

| Element | Spec |
|---------|------|
| Primary button | "Add Birth Details" (filled, indigo) |
| Secondary button | "Add Calculated Chart" (outlined, indigo) |
| Routes | `/horoscopes/new` (birth), `/horoscopes/new/manual` (calculated) |
| Both pages | `role="main"` content, same header pattern as the rest of the app |
| Back | Browser back / breadcrumb; no in-page toggle between modes |

---

## Calculated Chart Form

```
┌──────────────────────────────────────────────────────────────┐
│  Name (නම)   [__________________________________________]    │
│                                                              │
│  Birth date (උපන් දිනය)   [date ▼]  — optional               │
│  ↳ Auto-fills the 9 planetary houses (+ navamsa houses) from  │
│    the birth date (12:00, Colombo); deviations validated       │
│    against the computed positions are flagged amber.           │
│                                                              │
│  Lagna (ලග්නය) [රාශිය: select ▼]   Degree (අංශ) [___]      │
│  ↳ Degree optional (0–29.99). When set, the Navamsa Lagna     │
│    select + Navamsa house signs auto-populate from it.        │
│                                                              │
│  ┌─ House Table (භාව සටහන) ──────────────────────────────┐   │
│  │  House │ Sign │ Planets (Graha)                           │   │
│  │  1     │ ♈    │ [☉ රවි ×] [☿ බුධ ×] [+ Add]              │   │
│  │  2     │ ♉    │ [+ Add]                                    │   │
│  │  …     │ …    │ …                                          │   │
│  │  Validation: Budha ✓  Sikuru ✗  Rahu-Ketu ⏳               │   │
│  │  ↳ Planets Table + Derived Ranges shown on detail page    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─ Navamsa House Table (නවාංශක භාව සටහන) ─ optional ─────┐  │
│  │  [Collapse ▾]  (12 rows, same planet picker)            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                              │
│  [Save]  [Cancel]                                            │
└──────────────────────────────────────────────────────────────┘
```

**Layout rules:**
- **Desktop (`lg`+) two-column:** Name is full width at top, then the Ascendant (Lagna + House Table + validation) and Navamsa (Navamsa Lagna + Navamsa house table) sit **side by side**.
- **Mobile/tablet:** Members single column, stacked (name → Ascendant → Navamsa), `max-w-2xl` matches the New Horoscope page.
- The Navamsa Lagna select sits in the top form row beside the Lagna select (disabled until Lagna is chosen); the Navamsa house table lives in the right column.
- Gender/ayanamsha/privacy are NOT shown in manual mode (defaults applied server-side per architecture) — the manual form is deliberately lean
- House Table and Navamsa (Table) stack vertically on small screens.
- **The Add form does NOT render the Planets Table, Derived Relations/Conclusion, or the house Aspects column — those are computed and shown on the horoscope detail page after submission.**

**Save behavior:**
- `POST /api/horoscope/manual { name, lagna, houses, navamsaLagna, navamsaHouses }` on Save
- Success → redirect to the horoscope detail page (same as existing flow)
- Client also keeps an in-memory "live preview" via the shared `manualChart.ts` module — Save persists, not preview
- **No Save & Continue** button in v1 (form is on the create page; detail-page editor covers editing later)

---

## Ascendant Degree → Navamsa Autofill

- Some students' charts record an **ascendant degree** (0–29.99); many don't. The field is **optional**.
- Input: number field under Lagna, `step 0.01`, `min 0`, `max 30`, placeholder "0–29.99 (optional)"; stored as `lagnaDegree`.
- Behaviour: while a valid degree is set, the **Navamsa Lagna select is auto-derived** — the degree falls in one of the birth sign's 9 navamsa wedges (each 3°20', `deriveNavamsaLagnaFromDegree`). Because Navamsa house signs derive from the Navamsa Lagna, the **Navamsa table signs populate automatically** too.
- The auto-derived value always respects the existing "Navamsa Lagna must be one of the 9 navamsa signs of the Lagna" rule, so it never triggers the invalid-Lagna reset.
- The user may still manually change the Navamsa Lagna select afterwards; it is only overridden again when the degree value itself changes (not on manual navamsa edits).

---

## Birth Date Autofill

- Many students know a **birth date** but not the exact time. A `date` input (optional) sits in the left form column under Lagna.
- When a valid date (and a selected Lagna) is present, the client debounced-calls `POST /api/horoscope/manual/positions { date, lagna, navamsaLagna? }`. The server runs the Swiss Ephemeris for the **9 planets at 12:00** on that date, pinned to the **Colombo** timezone (a fixed reference until it becomes a user setting), using Ayanamsha **Lahiri**.
- It returns each planet's **sign + degree + whole-sign birth house** (derived from the user's Lagna) and **navamsa house** (derived from the planet's exact degree and the user's Navamsa Lagna). The editor then auto-fills the **House Table** and, when a Navamsa Lagna is present, the **Navamsa House Table**.
- **User keeps control**: the Lagna and Navamsa Lagna are the user's own inputs (the system does NOT overwrite Lagna). The user may still add/remove/move planets; every change is editable.
- **Validation**: the client remembers the computed position per planet. Any planet the user moves to a house that differs from the computed value is flagged amber (amber border + •) with a tooltip "Differs from computed House {n}". A summary message shows fill status (calculating / filled / failed). Failures keep the current manual entries.
- Birth date storage: the `date` (and the derived values) are persisted via `manualHousePlacements` on save; edit mode restores the date so subsequent edits remain consistent.

---

## House Table Editor

### Column Layout

| Column | Header (EN) | Header (SI) | Content |
|--------|-------------|-------------|---------|
| House | House | භාවය | Number 1–12 |
| Sign | Sign | රාශිය | Sign glyph + short name, derived from Lagna (whole-sign, mod-12) |
| Planets | Planets | ග්‍රහයෝ | Planet chips + [+ Add] |

> The **Aspects** column was removed from the house editor (v-next). Aspects remain visible in the Planets Table on the detail page.

### Planet Chips

- Each placed planet renders as a chip: `☉ රවි` (glyph + localized name) with an `×` remove button
- Chip colors use `PLANET_COLORS` (from `src/lib/astrology.ts`) for the glyph; chip background `bg-slate-50 border`
- Remove: click `×` → planet removed immediately → derived tables update live
- **Retrograde/combustion**: not applicable in manual entry (no degree data) — chips show only glyph + name

### Add Planet

```
[+ Add] ── click ──> dropdown menu
┌─────────────────────────────┐
│  Select planet (ග්‍රහයා තෝරන්න)  │
│  ☉ රවි / Sun                │
│  ☽ සඳු / Moon               │
│  ♂ කුජ / Mars               │
│  ☿ බුධ / Mercury            │
│  ♃ ගුරු / Jupiter           │
│  ♀ සිකුරු / Venus           │
│  ♄ ශනි / Saturn             │
│  ☊ රාහු / Rahu              │
│  ☋ කේතු / Ketu              │
└─────────────────────────────┘
```

| Element | Spec |
|---------|------|
| Trigger | `[+ Add]` text button in each row's Planets cell |
| Menu | Popover/dropdown listing all **unplaced** planets (both languages shown, glyph + EN + SI name) |
| Unplaced only | Already-placed planets are hidden; when all 9 are placed, `[+ Add]` becomes disabled |
| Select | Click planet → placed in that house → chip appears → dropdown closes → derived tables update |
| Keyboard | Tab to `[+ Add]`, Enter opens, arrow keys navigate, Enter selects, Escape closes |
| Empty row | Rows with no planets show just `[+ Add]` |
| Duplicate prevention | A planet can only exist in one house; moving = remove from old house, add to new |

### Row Interaction

- Rows are not individually expandable (planets are chips, not nested data)
- Zodiac color accent: sign glyph colored by element (`--chart-fire/earth/air/water` tokens from main-ux-spec)

---

## Validation Badges

Rendered in a slim bar directly **below the House Table**:

```
│  Validation:  Budha ✓ · Sikuru ✗ · Rahu–Ketu ⏳             │
```

| Badge | State | Style | Text (EN) | Text (SI) |
|-------|-------|-------|-----------|-----------|
| Budha | valid | green check | "Budha ✓" | "බුධ ✓" |
| Budha | invalid | red × + tooltip | "Budha ✗ (must be ±1 of Sun)" | "බුධ ✗ (රවිගෙන් ±1 විය යුතුයි)" |
| Budha | skipped | gray, muted | "Budha — place Sun first" | "බුධ — මුලින් රවි තබන්න" |
| Sikuru | valid | green check | "Sikuru ✓" | "සිකුරු ✓" |
| Sikuru | invalid | red × + tooltip | "Sikuru ✗ (must be ±2 of Sun)" | "සිකුරු ✗ (රවිගෙන් ±2 විය යුතුයි)" |
| Rahu–Ketu | valid | green check | "Rahu–Ketu ✓" | "රාහු–කේතු ✓" |
| Rahu–Ketu | incomplete | amber ⏳ | "Rahu–Ketu ⏳ (both not placed)" | "රාහු–කේතු ⏳ (දෙකම නැත)" |
| Rahu–Ketu | invalid | red × + tooltip | "Rahu–Ketu ✗ (must be opposite houses, 6 apart)" | "රාහු–කේතු ✗ (විරුද්ධ භාව, 6 ක් වෙන් විය යුතුයි)" |

**Behavior:**
- Badges recompute live on every placement change
- Invalid badges show a tooltip on hover/tap explaining the expected range (see tooltips below)
- Validation is **advisory** — Save is not blocked; the student may save with violations (per US-CH-004)
- `role="status"` + `aria-live="polite"` on the badge bar so screen readers announce validation changes

---

## Navamsa House Table Editor

- Collapsed by default (`<details>`-style, or `useState` + chevron)
- Header: "නවාංශක භාව සටහන / Navamsa House Table" + `(optional)` tag + chevron
- **Navamsa Lagna (D9) select** at the top (optional, 12 signs). Selecting it renders the 12-row house table below; clearing it hides the table (no lagna → no navamsa input)
- Expanded: 12 rows, **House | Sign | Planets** only (Sign derives whole-sign from the Navamsa Lagna; **no aspects column** in navamsa per feature doc)
- Uses the **same planet picker** component as the birth house table
- **Same planet uniqueness rule within the navamsa chart** (a planet once across navamsa houses)
- Enrichment: when navamsa placements exist, the Planets Table gains Navamsa columns (Navamsa, Navamsa Str, Degree range, Nakshatra/Pada) — see Planets Table
- Empty state: "Optional — select a Navamsa Lagna to enter navamsa placements" / "විකල්ප — නවාංශක භාව එකතු කරන්න"

---

## Planets Table (Read-Only, Live)

Derived automatically from house placements. Read-only table — students do not edit it.

### Columns

| # | Column (EN) | Column (SI) | Source |
|---|-------------|-------------|--------|
| 1 | Planet | ග්‍රහයා | glyph + name |
| 2 | Sign | රාශිය | from house (sign = Lagna + house − 1, mod 12) |
| 3 | Str | බලය | strength label (default "Sama" until derived) |
| 4 | House | භාවය | house number |
| 5 | Conjunctions | යුති | chips of co-located planets |
| 6 | Aspects | දෘෂ්ටි | houses/planets aspected |
| 7 | Other | වෙනත් | 22nd Drekkana Lord, 64th Navamsa Lord, Atmakaraka |

### Navamsa Enrichment (when navamsa placements entered)

| # | Column (EN) | Column (SI) | Source |
|---|-------------|-------------|--------|
| 8 | Navamsa | නවාංශක | navamsa sign |
| 9 | Navamsa Str | නවාංශක බලය | navamsa strength |
| 10 | Degree range | අංශක පරාසය | inferred from navamsa segment (e.g. "00°00'–03°20'") |
| 11 | Nakshatra (Pada) | නැකත (පාදය) | derived from midpoint |

### States

| State | Behavior |
|-------|----------|
| No planets placed | Empty state: "Place planets in the house table to see the planets table." / "ග්‍රහ සටහන බැලීමට භාව සටහනේ ග්‍රහයන් තබන්න." |
| No navamsa data | Columns 8–11 show `—` (em dash), strength column shows "—" |
| Retrograde not applicable | No retrograde column (no degree input) |

**Layout:** mobile-friendly responsive table (reuses the patterns from `specs/ux/20260717-1400-mobile-table-layouts.md`): below 640px, cards or stacked rows per planet; ≥640px, the table.

---

## Derived Ranges Section

Read-only card summarizing the probable birth ranges (advisory estimates per US-CH-009..012).

```
┌─ Derived Ranges (නිගමන) ──────────────────────────────┐
│  ⏱ Birth time:  05:00 – 07:00                        │
│  📅 Birth month: April 15 – May 15                    │
│  📆 Birth dates: 12, 21                               │
│  🎂 Ages:        1st ≈4y · 2nd ≈34y · 3rd ≈64y        │
│  ℹ These are probable ranges, not exact values.       │
└───────────────────────────────────────────────────────┘
```

| Range | Derived from | Displayed when |
|-------|--------------|----------------|
| Birth time | Ravi's house | Ravi placed |
| Birth month | Ravi's sign | Ravi placed |
| Birth dates | Ravi's navamsa/degree | Ravi placed + degree/navamsa derivable |
| Ages | Shani birth + current position | Shani placed + current Shani data derivable |

**Empty/hint states:**
- Ravi not placed → row shows "Place Ravi first" hint (muted) instead of the range
- Shani data missing → "Ages" row shows hint

**Estimate disclaimer:** a small info line below the card: EN "These are probable ranges based on the entered chart, not exact birth details." / SI "මේවා ඇතුළත් කළ ලග්නය අනුව ඇස්තමේන්තුගත පරාසයන් වන අතර නියම උපන් තොරතුරු නොවේ."

---

## Horoscope Detail Page (Manual Horoscope)

For a horoscope with `source: "manual"`, the detail page (`src/app/horoscopes/[id]/page.tsx`) adapts:

### Header
- "Calculated Chart" badge next to the name: `[ගණනය කළ ලග්නය / Calculated Chart]` (indigo pill, `text-xs`)
- **Edit entry point**: an "Edit Chart" button (pencil icon + "Edit Chart" / "සටහන සංස්කරණය") in the header action area → opens the manual-chart editor

### Charts Tab
- Birth chart + Navamsa chart render (derivable from sign data) — **reuse the existing dual-chart pair** from `specs/ux/20260804-1000-dual-charts-birth-navamsa.md`
- House chart, chandra/surya lagna, D3/D10/vargas: show the existing "not available" empty state (no ephemeris data)

### Calculations Tab
- Ascendant/Nakshatra card: show Lagna + house-derived data where available; degree-dependent values show `—`
- Houses table: renders the manual house signs (derived)
- Planets table: renders the manual planets table (birth + navamsa columns)
- **Dashas section**: not applicable → show the existing "Dasha data not available" / "දශා දත්ත නොමැත." empty state (already in main-ux-spec)

### Dashas Tab
- Show the "not available" empty state (no ephemeris dasha calculation without birth details)

### Metadata / Privacy / Share
- Unchanged — work identically for manual horoscopes

---

## Manual Chart Editor (Edit Mode)

Opened from the detail page "Edit Chart" button. Reuses the **exact same components** as the create form (House Table Editor, Navamsa Table Editor, Validation Badges — no live Planets Table / Derived Ranges, which appear only on the detail page) in a page or modal:

```
[Edit Chart] → navigates to the same editor component (mode="edit", pre-loaded from stored manualHousePlacements)
  → edits update live preview →
  → [Save] → PUT /api/horoscope/[id]/manual-chart { lagna, houses, navamsaLagna, navamsaHouses } →
  → success toast → returns to detail page (tables refreshed)
```

- **Save** button label: "Save Changes" / "වෙනස්කම් සුරකින්න"
- Loading state: button spinner, "Saving..." / "සුරකිනවා..."
- Error state: inline error banner + Retry (reuse main-ux-spec error patterns)
- Save disabled while no valid Lagna

---

## Responsive Behavior

| Breakpoint | Mode toggle | House table | Planets table | Derived ranges |
|------------|-------------|-------------|---------------|----------------|
| Desktop (> 1024px) | Segmented control inline | Full table, all columns | Full table | 2×2 grid of range cards |
| Tablet (640–1024px) | Segmented control inline | Full table, wrap chips | Table with horizontal scroll | 1×4 stacked rows |
| Mobile (< 640px) | Full-width segmented | Rows stack: House+Sign on one line, Planets chips below, Aspects below | Card-per-planet (from planet-cards pattern) | Stacked rows |

**Mobile specifics:**
- `[+ Add]` touch target ≥ 44×44px
- Planet chips wrap (`flex flex-wrap gap-1`)
- Validation badges wrap to 2 lines
- Aspects column text truncates with ellipsis; full list in tooltip

---

## Interaction Patterns & States

### Toast / Feedback

| Event | Type | Message (EN) | Message (SI) |
|-------|------|--------------|--------------|
| Manual horoscope created | Success | "Calculated chart saved" | "ගණනය කළ ලග්නය සුරැකුවා" |
| Chart updated | Success | "Chart updated" | "සටහන යාවත්කාලීන කළා" |
| Duplicate planet attempt | Error (inline) | "This planet is already placed in house X" | "මෙම ග්‍රහයා භාව X හි දැනටමත් ඇත" |
| Save failed | Error | "Failed to save. Please try again." | "සුරැකීමට අසමත් විය. නැවත උත්සාහ කරන්න." |
| Validation violation | Warning (inline badges) | (badge tooltip, non-blocking) | — |

### Loading States

| State | Pattern |
|-------|---------|
| House table derivation | Instant (client-side, synchronous) — no spinner |
| Save | Button spinner + disabled |
| Detail page load | Skeleton (existing) |
| Derived ranges | Instant with tables |

### Error States

| State | Pattern |
|-------|---------|
| API create/update fails | Inline error banner above Save + Retry |
| Invalid Lagna | Field-level error: "Select a valid Lagna" / "වලංගු ලග්නයක් තෝරන්න" |
| Server validation (400) | Inline banner with the server error message |

---

## Accessibility

| Element | ARIA / Treatment |
|---------|------------------|
| Mode toggle | `role="tablist"`, tabs `role="tab"` + `aria-selected`, form `role="tabpanel"` |
| House table | Native `<table>` with `<th scope="col">` headers; each planet chip a button with `aria-label="Remove {planet}"` |
| Add planet | `aria-haspopup="menu"`, menu `role="menu"`, items `role="menuitem"` with `aria-label="{planet} ({language names})"` |
| Validation badges | Container `role="status"` `aria-live="polite"`; each badge has `title`/`aria-describedby` for the rule text |
| Planets table | Native `<table>`, `aria-label="Planets table"` / "ග්‍රහ සටහන" |
| Derived ranges | `role="region"` `aria-label="Derived ranges"`; values plain text |
| Edit Chart button | Native button with accessible label |
| Color | Sign glyphs + chips use color + text (not color alone); badges use icon + text + color |
| Keyboard | Full tab order: name → lagna → house table (per-row Add, chips) → navamsa → Save (Planets Table / Derived Ranges not on the form — they render on the detail page) |

**Focus management:**
- Mode switch → focus moves to first field of the active form
- Add planet menu opens → focus on first unplaced planet
- Save success → redirect (focus on page header after nav)
- Validation badge becomes invalid → `aria-live` announces; no focus steal

---

## Component Map

| Component | File | Notes |
|-----------|------|-------|
| `ManualChartEditor` | `src/components/ManualChart/ManualChartEditor.tsx` | Orchestrates create + edit modes |
| `HouseTableEditor` | `src/components/ManualChart/HouseTableEditor.tsx` | 12-row editable table (birth) |
| `NavamsaHouseTableEditor` | `src/components/ManualChart/NavamsaHouseTableEditor.tsx` | Optional navamsa table (House + Sign + Planets), signs derived from the Navamsa Lagna |
| `PlanetPicker` | `src/components/ManualChart/PlanetPicker.tsx` | Popover of unplaced planets (shared by both tables) |
| `ValidationBadges` | `src/components/ManualChart/ValidationBadges.tsx` | Budha/Sikuru/Rahu-Ketu status bar |
| `PlanetsTable` | `src/components/ManualChart/PlanetsTable.tsx` | Read-only derived table (birth + navamsa columns) |
| `DerivedRanges` | `src/components/ManualChart/DerivedRanges.tsx` | Birth time/month/date/age range card |
| `CalculatedChartBadge` | `src/components/CalculatedChartBadge.tsx` | "Calculated Chart" pill on detail header |
| `ManualChartDetailPanel` | `src/components/ManualChart/ManualChartDetailPanel.tsx` | Detail-page read-only rendering of manual tables |

**Create-form integration:** `/horoscopes/new/manual/page.tsx` renders `ManualChartEditor mode="create"` full-width; `/horoscopes/new/page.tsx` remains the unchanged Birth Details form. The Horoscopes list (`src/app/horoscopes/page.tsx`) has two entry buttons.

**Detail-page integration:** `src/app/horoscopes/[id]/page.tsx` renders the `CalculatedChartBadge`, "Edit Chart" button, and swaps empty-state logic for manual horoscopes.

---

## i18n Keys (add to BOTH `src/messages/en.json` AND `src/messages/si.json`)

All strings above reference the following new keys under a `manualChart` namespace:

```
"manualChart": {
  "lagna": "Lagna",
  "name": "Name",
  "houseTableTitle": "House Table",
  "navamsaTableTitle": "Navamsa House Table",
  "navamsaOptional": "optional",
  "planetsTableTitle": "Planets Table",
  "addPlanet": "Add",
  "selectPlanet": "Select planet",
  "validation": "Validation",
  "budhaValid": "Budha ✓",
  "sikuruValid": "Sikuru ✓",
  "rahuKetuValid": "Rahu–Ketu ✓",
  "derivedRangesTitle": "Derived Ranges",
  "birthTime": "Birth time",
  "birthMonth": "Birth month",
  "birthDates": "Birth dates",
  "ages": "Ages",
  "estimateDisclaimer": "These are probable ranges based on the entered chart, not exact birth details.",
  "save": "Save",
  "saveChanges": "Save Changes",
  "cancel": "Cancel",
  "editChart": "Edit Chart",
  "calculatedChartBadge": "Calculated Chart",
  "savedToast": "Calculated chart saved",
  "updatedToast": "Chart updated",
  "duplicatePlanet": "This planet is already placed",
  "saveFailed": "Failed to save. Please try again.",
  "invalidLagna": "Select a valid Lagna"
}
```

Sinhala equivalents (matching the strings shown throughout this spec): උපන් විස්තර එක් කරන්න / ගණනය කළ කේන්දරය එක් කරන්න / ලග්නය / භාව සටහන / නවාංශක භාව සටහන / ග්‍රහ සටහන / එකතු කරන්න / වලංගු ලග්නයක් තෝරන්න / නිගමන / සුරකින්න / වෙනස්කම් සුරකින්න / අවලංගු කරන්න / සටහන සංස්කරණය.

The two entry buttons use `horoscope.addBirth` ("Add Birth Details" / උපන් විස්තර එක් කරන්න) and `horoscope.addCalculated` ("Add Calculated Chart" / ගණනය කළ කේන්දරය එක් කරන්න).

Both message files MUST stay in sync (same structure, same key order) per repo convention.

---

## Edge Cases

| Case | Behavior |
|------|----------|
| Lagna changed after placements | House signs re-derive; planet chips stay but re-validate against new layout |
| All 9 planets placed | All `[+ Add]` buttons disable; picker shows empty |
| Ravi not placed | Budha/Sikuru badges show "place Sun first"; birth-time/month rows show hints |
| Rahu or Ketu missing | Axis badge shows "incomplete" (amber) |
| House wrap (Ravi in house 12, +1 → house 1) | mod-12 derived signs correct |
| No navamsa data | Planets table shows `—` in navamsa columns |
| Manual horoscope opened in old browser | Works — no WebGL/experimental APIs |
| Narrow viewport (< 640px) | Rows stack; existing app-wide narrow-content limitation applies |
| Save with validation violations | Allowed; badges remain visible on the detail page |
| Legacy `source: "auto"` horoscope | Never shows manual UI; detail page unchanged |

---

## Future Considerations

- **Save & Continue editing** on the create form (currently redirects to detail after save)
- **Degree entry** — letting students enter actual degrees (not just navamsa segments) would unlock exact nakshatra, retrograde, and Atmakaraka computation; currently degree ranges are inferred from navamsa segments
- **Search parity** — search result cards could show a manual-chart marker and its derived ranges
- **Navamsa sign derivation** — the Navamsa Lagna is now a first-class input; navamsa house signs derive whole-sign from it. A future *degree/segment* input could offer per-planet navamsa exactness.
