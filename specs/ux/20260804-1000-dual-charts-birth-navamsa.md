# Dual Chart View (Birth + Navamsa) — UX Design

**Date:** 2026-08-04 10:00
**Author:** UX (BMAD)
**Based on:** `src/app/horoscopes/[id]/page.tsx` (lines 96, 338-375, 525, 667-759), `src/components/BirthChart.tsx`, `src/lib/chartTypes.ts`, `src/lib/chartDataTransform.ts`, `src/lib/astrology.ts` (`navamsaSign`, `findHouse`), `src/app/layout.tsx`, `src/components/Sidebar.tsx`, `src/messages/en.json`, `src/messages/si.json`, `specs/ux/main-ux-spec.md`, `specs/ux/20260730-1200-planet-cards.md`

---

## Overview

The Charts tab (ජන්ම කේන්ද්රය / නවාංශකය) of the horoscope detail page currently renders **one chart at a time**, behind an 8-button chart-type selector (`birth`, `navamsa-d9`, `house`, `chandra-lagna`, `surya-lagna`, `drekkana-d3`, `dasamsa-d10`, `shodasha-vargas`). A `selectedChart` state drives which single chart renders inside a `flex justify-center bg-white rounded-lg border p-4 overflow-auto` card.

**User pain point:** The two most important charts in Vedic astrology — the birth chart (D1) and the navamsa chart (D9) — are frequently studied *together* (e.g. checking whether a planet's navamsa placement confirms or modifies its D1 placement, comparing D1 lagna vs D9 lagna). Today the user must:

1. Click "birth" → study it → remember the placement
2. Click "navamsa-d9" → study it → mentally cross-reference against the remembered D1

This toggle-and-remember loop is error-prone and breaks the "study-first" design goal of the platform. The data for **both** charts is already available client-side (birth from `calculatedDetails`, navamsa derived via `getNavamsaChartData()`), so this is a purely presentational change — no data fetching, no backend work.

### Design Goals

1. **D1 + D9 always visible together** — the birth and navamsa charts render side-by-side (desktop) or stacked (mobile) with zero interaction cost, as the default "primary" view of the Charts tab
2. **No feature loss** — the remaining chart types (house, chandra-lagna, surya-lagna, drekkana-d3, dasamsa-d10, shodasha-vargas) stay available in a secondary single-chart selector below
3. **Bilingual captions** — each chart card carries a clear localized caption (EN/SI) identifying birth vs navamsa
4. **Reuse, don't redesign** — the `BirthChart` SVG component and `toBirthChartData`/`getNavamsaChartData` data pipeline are untouched; only the layout/presentation around them changes
5. **Consistent design language** — white `rounded-lg border` cards, indigo accent, `uppercase tracking-wide` section headers (same as the Calculations tab)
6. **Responsive by default** — no horizontal page scroll at any breakpoint; charts scale via the existing `max-w-full h-auto` on the SVG

---

## Recommended Approach: Pair on Top, Selector Below

Two options were considered:

| Option | Description | Verdict |
|--------|-------------|---------|
| **A — "Primary pair + secondary selector"** | Birth + navamsa become a permanent, always-visible card pair at the top of the Charts tab. The remaining 6 chart types (house, chandra-lagna, surya-lagna, drekkana-d3, dasamsa-d10, shodasha-vargas) move into a second section with the existing single-chart selector. | **RECOMMENDED** |
| B — "Replace selector entirely" | Birth + navamsa replace the selector; all other chart types are removed from the Charts tab. | Rejected — drops 6 existing features and the House wheel chart used for transits |

**Option A is recommended because:**

1. **Study-first fit** — the D1/D9 pair is the primary analytical surface; making it the zero-interaction default matches how students actually work
2. **Preserves everything** — the other charts (including the `HouseChart` wheel with its current-planets overlay, `currentPlanets` toggle at `HouseChart.tsx:739`) remain reachable with the exact same interaction they have today
3. **Reuses existing state** — `selectedChart` keeps working unchanged, just restricted to the 6 secondary types; no new state machine
4. **Graceful degradation** — the existing "no chart data" empty states and the D3/D10/vargas fallback behavior carry over verbatim
5. **Low risk** — the change is a JSX re-arrangement within the Charts tab block; the render branches for house/chandra/surya/fallback are copy-pasted as-is

---

## Wireframes / Mockups

### Desktop (≥ 1024px viewport)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Charts │ Calculations │ Dashas │ Metadata          (tab bar, unchanged) │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ජන්ම හා නවාංශක  ────────────────────────────────────────────────        │
│  (uppercase tracking-wide section header, indigo-700)                    │
│                                                                          │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐        │
│  │ Birth Chart (D1)            │  │ Navamsa Chart (D9)          │        │
│  │ ─────────────────────────   │  │ ─────────────────────────   │        │
│  │                             │  │                             │        │
│  │      ┌─────┬─────┐          │  │      ┌─────┬─────┐          │        │
│  │      │  2  │  3  │          │  │      │  2  │  3  │          │        │
│  │      ├─────┼─────┤          │  │      ├─────┼─────┤          │        │
│  │      │  1  │ ASC │          │  │      │  1  │ ASC │          │        │
│  │      ├─────┼─────┤          │  │      ├─────┼─────┤          │        │
│  │      │ 12  │ 11  │          │  │      │ 12  │ 11  │          │        │
│  │      └─────┴─────┘          │  │      └─────┴─────┘          │        │
│  │     (BirthChart SVG 420px,  │  │    (BirthChart SVG,         │        │
│  │      showAscendantDegree)   │  │     showAscendantDegree=false)       │
│  └─────────────────────────────┘  └─────────────────────────────┘        │
│                                                                          │
│  වෙනත් සටහන්  ────────────────────────────────────────────────────        │
│  (uppercase tracking-wide section header, indigo-700)                    │
│                                                                          │
│  [ භාව ] [ චන්ද්ර ලග්න ] [ සූර්ය ලග්න ] [ D3 ] [ D10 ] [ වර්ග ]       │
│  ┌──────────────────────────────────────────────────────────────┐        │
│  │   (single chart card — house / chandra / surya / fallback    │        │
│  │    rendered exactly as today, one at a time)                 │        │
│  └──────────────────────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────────────────┘
```

### Mobile (< 1024px viewport)

```
┌──────────────────────────────┐
│  Charts │ Calculations │ …    │
├──────────────────────────────┤
│  ජන්ම හා නවාංශක               │
│                              │
│  ┌────────────────────────┐  │
│  │ Birth Chart (D1)       │  │
│  │  ┌─────┬─────┐         │  │
│  │  │  2  │  3  │         │  │
│  │  ├─────┼─────┤         │  │
│  │  │  1  │ ASC │         │  │
│  │  ├─────┼─────┤         │  │
│  │  │ 12  │ 11  │         │  │
│  │  └─────┴─────┘         │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ Navamsa Chart (D9)     │  │
│  │   (same SVG, stacked)  │  │
│  └────────────────────────┘  │
│                              │
│  වෙනත් සටහන්                  │
│  [ භාව ] [ චන්ද්ර ලග්න ] …   │
│  ┌────────────────────────┐  │
│  │  (single chart)        │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

**Stack, don't swipe.** The user asked for "stack or swipe" on mobile. Stacking is recommended: it keeps both charts simultaneously visible (the whole point of the feature), needs no gesture affordance, and matches the existing "Chart views stack vertically" mobile rule in `specs/ux/main-ux-spec.md` § Responsive Breakpoints. Swiping would re-introduce the "only one visible at a time" problem.

---

## Component Design

### Section 1 — Primary Pair (Birth + Navamsa)

| Item | Spec |
|------|------|
| Container | `<section>` with `aria-labelledby` pointing at its header |
| Section header | `<h3 className="font-semibold text-sm mb-3 text-indigo-700 uppercase tracking-wide">` — matches Calculations tab headers (`page.tsx:766`, `:781`, `:794`) |
| Header text | `t("astrology.chartPairTitle")` |
| Grid | `<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">` — see Responsive Behavior for breakpoint justification |
| Card (birth) | `<figure className="bg-white rounded-lg border p-4 overflow-auto">` → `<figcaption>` → centered `<BirthChart {...toBirthChartData({ planets, houses, ascendant })} />` (default `showAscendantDegree=true`, exactly as current birth branch at `page.tsx:693-705`) |
| Card (navamsa) | Same `<figure>` shell → `<BirthChart {...toBirthChartData(navamsaData)} showAscendantDegree={false} />` (exactly as current navamsa branch at `page.tsx:720-734`) |
| Caption | `<figcaption className="text-sm font-semibold text-gray-700 mb-2">` with `t("astrology.chartCaptions.birth")` / `t("astrology.chartCaptions.navamsa-d9")` |
| Empty state | When `!calculatedDetails`, render the existing single empty-state card (`min-h-[300px]`, `t("astrology.noChartData")`, pattern at `page.tsx:685-691`) in place of the grid |

**Data source for navamsa:** reuse the existing `getNavamsaChartData()` helper (`page.tsx:338-375`) verbatim — no changes. It already returns `{ planets, houses, ascendant }` with each planet's `navamsaSign` and whole-sign houses rotated to the D9 lagna, and already handles the `p.navamsaSign ?? getNavamsaSign(...)` fallback.

### Section 2 — Secondary Single-Chart Selector

| Item | Spec |
|------|------|
| Container | `<section>` with `aria-labelledby` pointing at its header |
| Section header | Same `<h3>` styling, text `t("astrology.otherCharts")` |
| Button row | Existing row at `page.tsx:669-683` unchanged **except**: the map iterates the reduced list (below) and each `<button>` gains `aria-pressed={selectedChart === type}` |
| Reduced list | `ALL_CHART_TYPES.filter((t) => t !== ChartType.BIRTH && t !== ChartType.NAVAMSA_D9)` → house, chandra-lagna, surya-lagna, drekkana-d3, dasamsa-d10, shodasha-vargas |
| Active button | `bg-indigo-600 text-white border-indigo-600` (unchanged from `page.tsx:674-678`) |
| Chart renderer | The existing IIFE at `page.tsx:684-757` with the **BIRTH branch (`693-705`) and NAVAMSA branch (`720-734`) removed** (they now live in Section 1). HOUSE (`707-718`), CHANDRA/SURYA (`736-750`), and the noChartData fallback (`752-756`) stay byte-for-byte identical |
| `selectedChart` state | Keep, but default becomes `ChartType.HOUSE` (first item of the reduced list) instead of `ChartType.BIRTH` |

### Untouched Components

| File | Change |
|------|--------|
| `src/components/BirthChart.tsx` | **None** — SVG internals, house-click highlighting, `max-w-full h-auto` scaling all stay |
| `src/lib/chartDataTransform.ts` | **None** — `toBirthChartData` unchanged |
| `src/lib/chartTypes.ts` | **None required** (optional: could export a `SINGLE_SELECT_CHART_TYPES` helper, but an inline filter at the call site is enough) |
| `src/lib/astrology.ts` | **None** |
| `src/components/HouseChart.tsx` | **None** — House wheel (incl. current-planets overlay) renders in Section 2 exactly as today |

---

## Interaction States

| Element | State | Treatment |
|---------|-------|-----------|
| Pair section headers | Always | Non-interactive `<h3>`, indigo-700 uppercase |
| Chart captions (figcaption) | Always | Non-interactive, `text-sm font-semibold text-gray-700` — **no hover affordance** (cards are not clickable; avoid implying interactivity) |
| Pair cards | Default | `bg-white rounded-lg border p-4 overflow-auto` |
| BirthChart SVG internals | Default / click | **Unchanged** — house click-to-highlight, lord/trine tinting (`BirthChart.tsx:107-132`) work independently in each of the two SVGs; the two charts have fully independent `selectedHouse` state (separate component instances) |
| Secondary chart buttons | Default | `text-xs px-3 py-1.5 border rounded capitalize`, `aria-pressed="false"`, `hover:bg-gray-50` |
| Secondary chart buttons | Active | `bg-indigo-600 text-white border-indigo-600`, `aria-pressed="true"` |
| Secondary chart buttons | Focus | Add visible focus ring: `focus:outline-none focus:ring-2 focus:ring-indigo-500` (matches `HouseChart.tsx:739` pattern) |
| Chart switch | On click | Instant swap of Section 2's single chart (existing behavior, no animation needed — matches current `selectedChart` behavior) |

---

## Responsive Behavior

### Width math (why `lg:` is the pair breakpoint)

The app shell is a **fixed 256px sidebar** (`Sidebar.tsx:29`, `w-64`, no responsive hiding) + `px-6` main padding (`layout.tsx:42`). Content width = **viewport − 304px** at every breakpoint. The `BirthChart` SVG is a fixed `420×420` (UNIT=140) viewBox scaled by `max-w-full h-auto`.

| Viewport | Content width | Pair layout | Each card | Rendered SVG inside card |
|----------|---------------|-------------|-----------|--------------------------|
| < 1024px | < 720px | Stacked (`grid-cols-1`) | Full width | Scales to content; ~304px at 640px viewport, readable |
| 1024–1279px (`lg:`) | 720–975px | Side-by-side (`lg:grid-cols-2`) | ~352–479px | ~320–447px (scaled from 420) |
| ≥ 1280px (`xl:`) | ≥ 976px | Side-by-side | ≥ 480px | Full 420px + breathing room |

**Justification:** `lg:` (1024px) is the *first* breakpoint where two cards hold a readable chart. At `md:` (768px) content is only 464px → cards ~224px → SVG ~192px, which shrinks the 12px chart font below legibility. So `lg:grid-cols-2` is correct; **do not use `md:`**.

**Secondary selector:** unchanged from today — buttons wrap (`flex flex-wrap gap-2`), single chart card is full width at all breakpoints.

**Known app-level constraint (out of scope):** below 640px the fixed 256px sidebar leaves very narrow content (e.g. ~71px at a 375px viewport). This is a pre-existing layout issue affecting the whole page, not introduced by this feature — noted for a future responsive-layout pass.

---

## Comparison: Current Single-Chart Selector vs Proposed Dual View

| Aspect | Current | Proposed |
|--------|---------|----------|
| Birth chart | Hidden behind "birth" button click | **Always visible** (top-left card) |
| Navamsa chart | Hidden behind "navamsa-d9" click | **Always visible** (top-right card) |
| D1 vs D9 comparison | Impossible — toggle back and forth, remember placements | **Simultaneous side-by-side** (or stacked) |
| Interaction cost for primary charts | 2 clicks + mental state per comparison | 0 clicks |
| Secondary charts (house, chandra, surya, D3, D10, vargas) | In the same 8-button row | In a separate "Other Charts" selector below the pair |
| `selectedChart` state | One of 8 types | One of 6 secondary types; pair is static |
| Mobile behavior | One chart at a time | Stacked pair first, then single selector |
| Chart captions | None | Localized `figcaption` on both pair cards |
| Data fetching | None (client-side) | None — same `calculatedDetails` + derived navamsa |
| Empty state | Single shared block | Same block per section, same message |
| Calculations / Dashas / Metadata tabs | Untouched | Untouched |
| BirthChart component | Reused | Reused (no change) |

---

## i18n Keys (add to BOTH `src/messages/en.json` AND `src/messages/si.json`)

**Verified existing keys (reused, not duplicated):** `astrology.chartTypes.birth` ("Birth"/"ජන්ම"), `astrology.chartTypes.navamsa-d9` ("Navamsa"/"නවාංශක") — keep these for the secondary-selector buttons. Reference wording for the captions: `astrology.navamsaka` = "Navamsaka (D9)" / "නවාංශක (D9)".

**New keys** — insert inside the `"astrology"` object, alongside `"chartTypes"`:

```
"chartPairTitle": "Birth & Navamsa",
"otherCharts": "Other Charts",
"chartCaptions": {
    "birth": "Birth Chart (D1)",
    "navamsa-d9": "Navamsa Chart (D9)"
}
```

```
"chartPairTitle": "ජන්ම හා නවාංශක",
"otherCharts": "වෙනත් සටහන්",
"chartCaptions": {
    "birth": "ජන්ම කේන්ද්රය (D1)",
    "navamsa-d9": "නවාංශකය (D9)"
}
```

Notes:

- Sinhala strings use the user-requested full forms: ජන්ම කේන්ද්රය ("birth chart"), නවාංශකය ("navamsa"). The existing short `chartTypes` values (ජන්ම / නවාංශක) remain for the compact buttons.
- The `(D1)` / `(D9)` suffix matches the existing D-number convention (`navamsaka: "Navamsaka (D9)"`, and the D3/D10 chart labels) and is meaningful to the study audience. If the team prefers plainer captions, drop the suffix — but the two files must stay identical in structure.
- "වෙනත් සටහන්" reuses the established word for charts (`horoscope.charts` = "සටහන්").

---

## Accessibility

| Item | Treatment |
|------|-----------|
| Chart caption association | Each pair card is a `<figure>` with a `<figcaption>` — the caption becomes the accessible name of the figure, programmatically linking label to chart |
| Chart SVG | The SVG internals (house `<g onClick>` elements) are pointer-only today — a pre-existing limitation, unchanged. Optional enhancement (non-blocking): add an `aria-label?: string` prop to `BirthChart` and render `role="img" aria-label={ariaLabel}` on the `<svg>` at `BirthChart.tsx:269`. This is a prop addition, not a redesign, and can be skipped without breaking anything |
| Section semantics | Both sections use `<section aria-labelledby>` tied to their `<h3>` headers, so screen-reader users can jump between "Birth & Navamsa" and "Other Charts" |
| Chart selector buttons | Native `<button>` elements (already keyboard-focusable). Add `aria-pressed={selectedChart === type}` so the active chart is announced. Wrap the row in `<div role="group" aria-label={t("astrology.otherCharts")}>` |
| Keyboard flow | Tab order: tab bar → pair section (non-interactive, skipped) → Other Charts buttons → single chart → (next page content). Enter/Space activates buttons; visible `focus:ring-2 focus:ring-indigo-500` focus ring |
| Color | Active/inactive distinction uses background + text color + `aria-pressed`, not color alone. Caption contrast: gray-700 on white (≥ 4.5:1) |
| Live regions | Not required — chart switch is button-activation, announced via `aria-pressed` change |

---

## Implementation Notes

All changes are confined to `src/app/horoscopes/[id]/page.tsx` and the two message files. Exact anchors:

### 1. Change the default selected chart — `page.tsx:96`

```ts
const [selectedChart, setSelectedChart] = useState<ChartType>(ChartType.HOUSE);
```

(BIRTH is no longer in the single-select list, so the default moves to HOUSE, the first secondary type. No other code references the initial value.)

### 2. Reduce the chart-type list — `page.tsx:525`

Replace `const chartTypes = ALL_CHART_TYPES;` with:

```ts
const chartTypes = ALL_CHART_TYPES.filter(
    (type) => type !== ChartType.BIRTH && type !== ChartType.NAVAMSA_D9,
);
```

Keeping the variable name `chartTypes` means the button-row JSX (`669-683`) needs only the `aria-pressed` addition, not a rename. (`ALL_CHART_TYPES` import at `page.tsx:18` stays.)

### 3. Replace the Charts tab block — `page.tsx:667-759`

The entire `{activeTab === "charts" && (...)}` block is replaced with the two-section structure:

- **Section 1 (pair):** header `<h3>{t("astrology.chartPairTitle")}</h3>` → `grid grid-cols-1 lg:grid-cols-2 gap-4` → two `<figure>` cards. Birth card uses the exact props from the current BIRTH branch (`693-705`); navamsa card uses `const navamsaData = getNavamsaChartData()` + `showAscendantDegree={false}` from the current NAVAMSA branch (`720-734`). If `!calculatedDetails` (or `!navamsaData`), render the existing `min-h-[300px]` empty-state card with `t("astrology.noChartData")` instead.
- **Section 2 (other charts):** header `<h3>{t("astrology.otherCharts")}</h3>` → button row (existing `669-683` markup + `aria-pressed`) → the existing renderer IIFE with the BIRTH and NAVAMSA branches deleted. HOUSE (`707-718`), CHANDRA/SURYA (`736-750`), and the fallback (`752-756`) are copy-pasted unchanged.

### 4. Keep `getNavamsaChartData()` as-is — `page.tsx:338-375`

No change. It is now called once per render for the pair section instead of inside the navamsa branch. Optionally wrap in `useMemo` keyed on `calculatedDetails` if a second call cost is ever noticed — not required.

### 5. i18n — add the 4 keys to `src/messages/en.json` and `src/messages/si.json`

Exactly as listed in the i18n section above; both files must stay in sync (same structure, same key order).

### Explicitly NOT changed

- `BirthChart.tsx`, `HouseChart.tsx`, `chartDataTransform.ts`, `chartTypes.ts`, `astrology.ts` — untouched
- Calculations tab (`761-1179`) — its tables, ascendant/nakshatra card, houses table, planets table/cards, and the underlying `calculatedDetails` data are **completely unaffected**; no data shape changes anywhere
- Dashas tab (`1181-1189`), Metadata tab (`1191-1195`), page header/nav/privacy UI (`243-665`), all API routes and models

---

## Edge Cases

| Case | Behavior |
|------|----------|
| `calculatedDetails` is null (corrupt/legacy horoscope) | Charts tab renders the existing "No chart data available" empty state; both sections show it (same message as today) |
| Navamsa derivation returns null | Only the navamsa card shows the empty state; birth card still renders |
| Selected chart is a D3/D10/vargas type | Identical to today — falls through to the `noChartData` empty state (`752-756`). Rendering these divisional charts is a pre-existing gap, explicitly out of scope for this change |
| User has `data.charts` persisted for chandra/surya | Unchanged behavior — looked up via `data.charts.find(...)` exactly as today |
| Narrow viewport (< 640px) | Pair stacks; charts scale down; existing app-wide narrow-content limitation applies (see Responsive Behavior) |

---

## Future Considerations

- **D3/D10/vargas rendering** — the selector keeps these types, but they currently always show the empty state on the detail page; implementing their SVG rendering would make the secondary selector fully functional
- **Chart comparison tools** — with D1/D9 permanently visible, a future "link" interaction (click a planet in D1 → highlight its navamsa placement in D9) becomes the natural next step for the study workflow
- **Search page parity** — the search result cards (`src/app/search/page.tsx:673-721`) still show one chart at a time behind tabs; the same dual-view pattern could be offered there once cards are wide enough
- **Sidebar responsiveness** — fixing the fixed-256px sidebar on small viewports would unlock tighter pair layouts (e.g. `md:` side-by-side) in a future layout pass
