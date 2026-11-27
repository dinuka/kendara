# Planet Aspects (දෘෂ්ඨි) Setting — UX Design

**Date:** 2026-08-09 22:15
**Last Updated:** 2026-08-10 (rev: planets/houses table aspect chips show planet name only; the aspect tooltip renders compact **reason lines** — a single-reason tooltip keeps the inline signed delta (e.g. ග්‍රහ දෘෂ්ඨි 7 (180) (+02:05:00)), while a multi-reason tooltip (planetary + rashi drishti) hoists the shared delta into **one `Δ` footer** so it is never repeated per line; rashi lines use the compact `{aspectingSign} → {aspectedSign}` form)
**Author:** UX (BMAD)
**Based on:** `specs/business-analysis/20260809-2133-planet-aspects.md`, `specs/business-analysis/actors.md`, `specs/business-analysis/data-model.md`, `specs/architecture/20260809-2145-planet-aspects.md`, `specs/architecture/overview.md`, `docs/aspects.md`, `specs/ux/main-ux-spec.md`, `specs/ux/20260727-1926-privacy-settings.md`, `specs/ux/20260805-1514-calculated-horoscope.md`, `specs/ux/20260730-1200-planet-cards.md`, `src/app/settings/page.tsx`, `src/app/horoscopes/[id]/page.tsx`, `src/app/search/page.tsx`, `src/hooks/useI18n.tsx`

---

## 1. Overview

The **"Planets Aspects houses and degrees"** (ප්ලැනට් ඇස්පෙක්ට්ස් හවුස් ඇන්ඩ් ඩිග්රීස් / දෘෂ්ඨි) setting lets a student configure, per planet, which **houses** the planet aspects (1–12) and which **degree** angles are aspect candidates (multiples of 30 in 30–330). The configured values drive house-aspect and planet-aspect calculation, with the existing Planetary Orbs values acting as the orb tolerance. Unconfigured planets fall back to the new authoritative 9-planet default table.

**UX goals:**

1. **Defaults-first visibility** — every planet row always shows what *will* apply (defaults for unconfigured planets, the stored values for configured ones); there is never an ambiguous empty state (Architect Q3)
2. **Structural validation** — chip selectors make the value domains (houses 1–12, degrees 30–330 step 30) impossible to violate; the remaining rules (at least one house + one degree, uniqueness) surface as clear inline localized errors
3. **Explicit Default-vs-Custom semantics** — the status pill + helper copy communicate the absolute-vs-offset asymmetry (configured houses are absolute house numbers; default houses are offsets from the planet's house) so students understand why an unconfigured planet's effective aspected houses vary per horoscope (Architect Q4)
4. **Staged, reversible saves** — edits and resets are staged locally, marked with an "Unsaved changes" indicator, and persisted only on Save (matching the existing settings page pattern); nothing is written until the user confirms
5. **Data-only by design** — v1 renders the updated aspects in the planets table / house table only; rendered chart art is untouched (Architect Q1 — see §2.1)
6. **Bilingual parity** — all labels, status text, helper copy, validation messages, and angle names render in Sinhala and English, reusing the existing `astrology.planetNames.*` / `astrology.signNames.*` keys where they exist

---

## 2. Answers to Architecture's UX Questions (§14)

### 2.1 Q1: Should rendered charts draw aspect lines/colors in v1?

**Recommendation: NO — keep v1 data-only.**

| Consideration | Analysis |
|---------------|----------|
| Architecture position | D2/AD-2: charts are positional-only; `chartRenderer.ts` / `chartDataTransform.ts` contain no aspect references. Aspect data is consumed by the planets table / house table only |
| Visual clutter | 9 planets × up to 11 candidate angles × 2 directions (aspect points on both sides) produces a dense line web on a chart; for study tables this density is readable, on a chart it obscures house/planet positions |
| Consistency | The setting is per-user but shared horoscopes store the owner's snapshot. Chart SVGs are regenerated only on recalculation; per-viewer aspect lines would require re-rendering charts per viewer — contradicting the stored-artifact architecture |
| Effort vs. value | Aspect-line rendering is a self-contained visualization feature (line color/opacity by angle, orb-band shading, legend, clutter culling) that deserves its own spec, dataset, and QA pass — it would significantly expand this feature's surface for no study-workflow blocker |
| Future path | When a future feature draws aspect lines/colors, it reads the now-setting-derived `planets[].aspects` / `houses[].aspectingPlanets` data — the data model is already in place |

**Decision:** v1 renders aspects in the **planets table** and **houses table** only (this spec, §8). Aspect-line rendering is explicitly out of scope; flag to PM for a future feature. The settings form's optional live "preview" (§4.4, enhancement) shows table-form output, never a chart. Per the AI-engineer clarification, the tables show **planet names only** in the Aspects columns, and the v1 table surface **includes the aspect tooltip** (`AspectReasonTooltip`, §8.1.1) on every aspects chip — it shows **compact reason lines**: a single-reason aspect keeps the inline signed delta (e.g. `ග්‍රහ දෘෂ්ඨි 7 (180) (+02:05:00)`), and a multi-reason aspect (e.g. planetary + rashi drishti, `20260810-0800-rashi-aspects.md`) renders one line per reason plus a **single shared `Δ` delta footer** so the delta is never repeated — the angle/delta detail ships in the tooltip alongside the name-only chips.

### 2.2 Q2: Display names for the non-classical angles (210, 240, 270, 300, 330)

**Proposed labels (EN + SI):**

| Angle | EN label | SI label | Notes |
|-------|----------|----------|-------|
| 30 | Semisextile | අර්ධ ෂඩ්කෝණ | classical |
| 60 | Sextile | ෂඩ්කෝණ | classical; beneficial |
| 90 | Square | චතුරස්ර | classical |
| 120 | Trine | ත්‍රිකෝණ | classical; beneficial |
| 150 | Quincunx | ක්වින්කන්ක්ස් | classical; SI transliteration (provisional) |
| 180 | Opposition | විරුද්ධ | classical |
| 210 | Sesquiquadrate (7 signs) | රාශි 7 දෘෂ්ටිය | non-classical |
| 240 | Trine (8 signs) | රාශි 8 දෘෂ්ටිය | non-classical |
| 270 | Square (9 signs) | රාශි 9 දෘෂ්ටිය | non-classical |
| 300 | Sextile (10 signs) | රාශි 10 දෘෂ්ටිය | non-classical |
| 330 | Semisextile (11 signs) | රාශි 11 දෘෂ්ටිය | non-classical |

**Notes:**
- The **numeric degree value is the source of truth** (per data-model); labels are display-only.
- Non-classical angles use the sign-count style ("Trine (8 signs)") — descriptive, unambiguous, and language-neutral; SI mirrors it as "රාශි N දෘෂ්ටිය". Sinhala labels for 30/60/90/120/180 use standard terms; **all SI labels are proposals and need domain review** (see Appendix B → PM).
- **Discrepancy flag:** the BA data-model Aspect Type table lists 210 as "Sesquiquadrate (Quincunx, **6** signs)" — 210° ÷ 30 = **7** signs. The label "7 signs" is used here; flag for QA/PM to reconcile the BA table.
- **Where labels appear:**
  - Settings form degree chips: `{angle}°` primary with the label as tooltip/aria on all screens; on `lg+` screens chips may render `{angle}° {label}` for the 5 non-classical angles to educate (see §4.4)
  - Planets table / planet cards Aspects column: `{Planet}` — **planet name only** (glyph + localized EN/SI name, e.g. `සිකුරු / Venus`); the angle and signed delta are **not** inline — they move into the aspect tooltip (§8.1.1) as the compact reason lines (single-reason keeps the inline delta; multi-reason shows one line per reason + a shared `Δ` footer), the sole place in the tables for degree/delta details (see §8.1)
  - Degree-chip groups in the settings form use the same label map via `astrology.aspectAngles.*` keys

### 2.3 Q3: Unconfigured planets — defaults or empty state?

**Decision: show defaults (the new 9-planet table).**

- All 9 planet rows are always rendered in the settings form; a planet with no entry in `planetAspects` shows its **default houses and default degrees `[60, 90, 120, 180]`** with a gray **Default** status pill (§4.2).
- Rationale: students see exactly what will apply to their charts without any extra interaction; the authoritative default table becomes legible at a glance; there is no "nothing configured" ambiguity and no blocking save (US-PA-001 edge case "no configuration yet").
- The Default pill carries a tooltip/hint: "Defaults apply as offsets from the planet's house" — see Q4.
- An empty state exists only as an error fallback (§4.7), never as a normal first-run state.

### 2.4 Q4: Absolute-vs-offset asymmetry (configured vs default houses)

**Confirmed and communicated via three channels:**

1. **Status pill** — each row carries `[Custom]` (indigo) or `[Default]` (gray). A Custom entry whose numbers happen to equal the defaults is still labeled Custom, because its *semantics* differ (absolute vs offset).
2. **Section helper copy** — directly under the section title (EN/SI):
   - "Custom houses apply as **absolute** house numbers (e.g. 3, 7, 10 = chart houses 3, 7, 10)."
   - "Default houses apply as **offsets** from the planet's own house in each horoscope, so the effective houses vary per chart."
3. **Per-row hint in the expanded editor** — when a row is Default, the hint reads: "These defaults apply as offsets from the planet's house in each horoscope. Customize to set absolute house numbers."

The form's "defaults" display uses the **new authoritative table** (SUN/MOON/SATURN 3,5,7,9,10; MARS/MERCURY 4,5,7,8,9; JUPITER/VENUS/RAHU/KETU 5,7,9) — **not** the old "Mars 4/8/12, Jupiter 5/9/11, Saturn 3/7/10, Rahu/Ketu 5/9, others → 7th" table. §7 documents the full display mapping.

---

## 3. User Flows

### 3.1 Flow: Configure a planet's aspects

```
Settings (/settings) → "Planets Aspects houses and degrees" (දෘෂ්ඨි) section →
  → Rows load from GET /api/settings (planetAspects + planetaryOrbs) →
    → Unconfigured planets: gray [Default] pill + default houses/degrees shown →
    → Configured planets: indigo [Custom] pill + stored houses/degrees shown →
  → Expand a planet row (e.g. ☉ Ravi) →
    → Toggle house chips (1–12): select 3, 7, 10 →
    → Toggle degree chips (30–330 step 30): select 60, 180, 240 →
    → Status pill flips Default → Custom; "● Unsaved changes" indicator appears →
    → Save →
      → Client validates (every customized planet has ≥1 house and ≥1 degree) →
      → PUT /api/settings { planetAspects: { "1": { houses: [3, 7, 10], degrees: [60, 180, 240] } } } →
      → Success: "Settings saved" text + toast; dirty indicator clears →
  → Next horoscope calculation (create / recalc / manual save) uses the new values →
  → Owner's own auto horoscope detail view re-derives aspects on next refresh
```

### 3.2 Flow: Validation errors (blocked save)

```
Expand a row → deselect ALL house chips → Save →
  → Inline error under the Houses group: "Select at least one house for Sun." (role="alert") →
  → Save disabled; focus moves to the first offending row →
  → User selects a house → error clears on the fly →
  → Save proceeds; other rows are validated the same way (degrees group too)
```

No invalid *value* can be entered via chips (1–12 / 30–330 step 30 are the only options); the range rules from US-PA-002/003 are enforced structurally. Server-side rejections (e.g. stale/malformed payloads) surface as a section-level error banner with the localized message and **no partial save** (§6).

### 3.3 Flow: Reset to defaults

```
Per-planet:
  → Click [Reset] on a Custom row →
    → Row reverts to Default (houses/degrees show defaults, pill → [Default]) →
    → Dirty indicator appears; change is NOT persisted until Save →
    → Save → PUT omits that planet's key (planet behaves as unconfigured) →

Bulk:
  → Click [Reset all to defaults] (top-right of section) →
    → Confirmation modal: "Reset all to defaults? This clears all 9 planets' custom
       aspect settings. Defaults will apply instead." →
    → [Reset all] → all rows revert to Default → dirty → Save →
      → PUT /api/settings { planetAspects: {} } (all planets use defaults)
```

- Per-planet reset needs no modal: the change is staged (reversible by re-selecting chips or discarding). Bulk reset, affecting 9 planets, uses the standard confirmation modal (US-PA-007 AC2 destructive-action confirmation).
- Reset on an already-Default row is a no-op with a toast: "Ravi already uses the default settings." (US-PA-007 edge case).

### 3.4 Flow: See updated aspects in the horoscope detail view

```
After saving the setting →
  → Open own horoscope detail (/horoscopes/[id]) →
    → GET /api/horoscope/:id (owner + source=auto) re-derives planets[].aspects and
       houses[].aspectingPlanets from stored absolute degrees/houses with the current
       planetAspects + planetaryOrbs (pure, no migration) →
  → Calculations tab → Planets table Aspects column:
      "ශනි / Saturn, ගුරු / Jupiter" — aspecting planet names only (glyph + localized name);
      hover/focus/tap on a chip opens the tooltip with the compact reason line(s)
      (single-reason keeps the inline delta, e.g. ග්‍රහ දෘෂ්ඨි 7 (180) (+02:05:00);
      multi-reason shows one line per reason + a shared Δ +02:05:00 footer — §8.1.1) →
  → Houses table Aspects column: aspecting planets as localized names, e.g. "Sun, Saturn"
     (same planet-name-only chips + tooltip) →
  → Search result cards / exports / share views: stored snapshot as computed from the
     owner's setting at calculation time (unchanged surface)
```

### 3.5 Flow diagram

```
┌──────────────┐   ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│  Settings    │   │  Edit planet     │   │  Validate + Save │   │  Horoscope view  │
│  section     │──>│  (chips, pill,   │──>│  PUT /api/       │──>│  re-derived      │
│  loads       │   │  unsaved badge)  │   │  settings        │   │  aspects render  │
└──────────────┘   └──────────────────┘   └──────────────────┘   └──────────────────┘
       │                    │                     │                       │
       │  GET /api/settings │  validation error   │  400 → banner,        │
       │  (rows + defaults) │  → inline, block    │  no partial save      │
       ▼                    ▼                     ▼                       ▼
  9 rows w/ Default    inline row error      success: saved toast   planets table +
  or Custom pills      (focus offending)     + dirty clears         house table update
```

---

## 4. Settings Section Wireframes

### 4.1 Placement on the Settings page

The section is added to `src/app/settings/page.tsx` below the existing Planetary Orbs section, inside the same `max-w-2xl` white card, separated by the existing `<hr>` divider. It keeps the page's per-section save pattern (each section has its own Save + Reset buttons — the orbs section is untouched).

```
┌─ Settings (සැකසුම්) ────────────────────────────────────────────┐
│  ┌─ Language (භාෂාව) ────────────────────────────────────────┐  │
│  │  [සිංහල] [English]                                       │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ─────────────────────────────────────────────────────────────  │
│  ┌─ Planetary Orbs (ග්‍රහ රාශ්මි) ── existing, unchanged ────┐  │
│  │  9 orb inputs … [Save] [Reset to defaults]                │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ─────────────────────────────────────────────────────────────  │
│  ┌─ Planets Aspects houses and degrees (දෘෂ්ඨි) ── NEW ─────┐  │
│  │  …spec below…                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Collapsed list (defaults display — Architect Q3/Q4)

All 9 planets are always listed. Each collapsed row is click-to-expand. The summary columns keep the list scannable.

```
┌─ Planets Aspects houses and degrees (දෘෂ්ඨි) ──────────────────────────────┐
│  ℹ Configure which houses and degree angles each planet aspects.            │
│    Custom houses apply as ABSOLUTE house numbers. Default houses apply as    │
│    OFFSETS from the planet's house in each horoscope. Degrees drive planet-  │
│    to-planet aspects and degree-based house aspects.                         │
│                                                          [Reset all to def.] │
│                                                                              │
│  Planet (ග්‍රහයා)        Status      Houses (භාව)           Degrees (අංශක)    │
│  ────────────────────────────────────────────────────────────────────────   │
│  ▶ ☉ රවි / Sun            [Custom]    3, 7, 10                60, 180, 240   │
│  ▶ ☽ සඳු / Moon           [Default]   3, 5, 7, 9, 10           60, 90, 120, 180 │
│  ▶ ♂ කුජ / Mars           [Default]   4, 5, 7, 8, 9            60, 90, 120, 180 │
│  ▶ ☿ බුධ / Mercury        [Default]   4, 5, 7, 8, 9            60, 90, 120, 180 │
│  ▶ ♃ ගුරු / Jupiter       [Default]   5, 7, 9                 60, 90, 120, 180 │
│  ▶ ♀ සිකුරු / Venus       [Default]   5, 7, 9                 60, 90, 120, 180 │
│  ▶ ♄ ශනි / Saturn         [Default]   3, 5, 7, 9, 10           60, 90, 120, 180 │
│  ▶ ☊ රාහු / Rahu          [Default]   5, 7, 9                 60, 90, 120, 180 │
│  ▶ ☋ කේතු / Ketu          [Default]   5, 7, 9                 60, 90, 120, 180 │
│                                                                              │
│  ● Unsaved changes (2 planets)                                [Save]         │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Row summary rules:**

| Element | Spec |
|---------|------|
| Planet name | Glyph + localized name — `☉ රවි` in SI locale, `☉ Sun` in EN (reuses `astrology.planetNames.*` + glyph map). The row list itself is the planet selector — all 9 planets are present and selectable |
| Status pill | `[Default]` gray (`--text-secondary` at 15% bg) or `[Custom]` indigo (`--primary` at 15% bg); never color-only (text always present) |
| Houses summary | Comma-separated ascending numbers; em dash `—` never occurs (defaults always fill in) |
| Degrees summary | Comma-separated ascending degree numbers (`60, 90, 120, 180`) |
| Chevron | `▶` collapsed / `▼` expanded; row click toggles |
| Per-planet Reset | Text button in the expanded row only (declutters the list) |
| Footer bar | Sticky within the section on mobile: dirty indicator + Save button |

### 4.3 Jump-to-planet selector (planet picker, EN/SI)

A compact dropdown at the top-right of the section (desktop/tablet only; hidden on mobile where the 9-row list is short enough to scroll) lets the student jump directly to a planet's row and expand it:

```
  Planet: [☉ රවි / Sun ▾]        [Reset all to defaults]
          ┌─────────────────────┐
          │ ☉ රවි / Sun         │
          │ ☽ සඳු / Moon        │
          │ ♂ කුජ / Mars        │
          │ … all 9, EN/SI …    │
          └─────────────────────┘
```

Selecting an option scrolls to that planet's row and expands it. This satisfies US-PA-001 AC2's "planet selector (all 9 planets, English/Sinhala names)" literally while the row list remains the primary surface.

### 4.4 Expanded row editor (per-planet form)

```
│  ▼ ☉ රවි / Sun                              [Custom]  [Reset]        │
│     Houses (භාව) — houses this planet aspects:                       │
│     [1] [2] [3▪] [4] [5] [6] [7▪] [8] [9] [10▪] [11] [12]            │
│     Degrees (අංශක) — aspect angles (multiples of 30):                │
│     [30] [60▪] [90] [120] [150] [180▪] [210] [240▪] [270] [300] [330] │
│     ℹ Custom houses are absolute house numbers (3, 7, 10 = chart      │
│       houses 3, 7, 10). Default houses apply as offsets from the      │
│       planet's house in each horoscope.                                │
│     (lg+ screens: degree chips may render "60° Sextile", "210°        │
│      Sesquiquadrate (7 signs)" etc.; smaller screens show "60°" with  │
│      the label in title/aria)                                          │
```

| Element | Spec |
|---------|------|
| Houses group | `role="group"` labeled "Houses (භාව)"; 12 toggle chips `1`–`12`; selected chips indigo-filled; `aria-pressed` per chip |
| Degrees group | `role="group"` labeled "Degrees (අංශක)"; 11 toggle chips `30`–`330` step 30; same toggle behavior |
| Chip behavior | Toggle on click/tap; chips never allow duplicates (single chip per value) and never allow out-of-domain values — validation is structural |
| Status pill | Recomputes live: any change to a Default row flips it to Custom |
| Per-planet Reset | `[Reset]` — reverts row to defaults (staged; see §3.3) |
| Row hint | Contextual helper shown when the row is Default (see §2.4) |
| Optional live preview (enhancement) | When a row is expanded and the horoscope data is available, a small read-only line can preview the planet-aspect output using the shared pure module (e.g. "Preview: aspects Sun → Saturn" — planet names only, matching the table chips; hovering the preview chip opens the compact drishti-line tooltip, §8.1.1). Optional and out of the critical path; the pure module is client-safe per architecture §6.1 |

### 4.5 Validation error states

```
│  ▼ ☉ රවි / Sun                              [Custom]  [Reset]        │
│     Houses (භාව):                                                   │
│     [1] [2] [3] [4] [5] [6] [7] [8] [9] [10] [11] [12]               │
│     ⚠ Select at least one house for Sun.                            │
│     Degrees (අංශක):                                                 │
│     [60▪] [180▪] [240▪] …                                             │
```

- Error text: 13px, `--error` red, warning icon; rendered directly under the offending group; `role="alert"` + `aria-describedby` on the group.
- Errors appear on Save attempt (not while typing) and clear the moment the condition is fixed (live re-validation).
- The Save button is disabled while any row has an error; the footer shows a count: "Fix 1 validation error before saving."
- Server-side rejection (400) renders a section-level banner instead (below).

### 4.6 Save flow / unsaved-changes indicator

```
│  ● Unsaved changes (2 planets)                     [Save]            │
│                                                    (primary, indigo) │
│  Saving…  →  "Settings saved" (green text, fades after 3s)           │
```

| State | Visual | Behavior |
|-------|--------|----------|
| Clean | no indicator | Save disabled (nothing to save) |
| Dirty | amber dot + "Unsaved changes (n planets)" | Save enabled and primary |
| Saving | spinner on Save + section `aria-busy`; all controls disabled | PUT in flight |
| Saved | green "Settings saved" text (reuses `settings.saved`) + success toast | dirty clears; state persists across logout/refresh (server-stored) |
| Navigation while dirty | `beforeunload` guard (recommended) + inline confirm "Discard unsaved aspects changes?" | Prevents silent loss; matches staged-save model |

### 4.7 Loading / error / empty states

```
Loading (first open):
┌─ Planets Aspects houses and degrees (දෘෂ්ඨි) ─────────────┐
│  ◌ ◌ ◌   (3 skeleton rows, pulsing, matching page loader)  │
└────────────────────────────────────────────────────────────┘

Load error:
┌─ Planets Aspects houses and degrees (දෘෂ්ඨි) ─────────────┐
│  ⚠ Could not load your aspects setting.                    │
│  Please try again.                        [Retry]          │
└────────────────────────────────────────────────────────────┘

Save error banner (server 400/500):
│  ⚠ Could not save settings: Houses must be integers 1–12.  [✕]   │
│  (role="alert"; form state preserved; nothing partially saved)    │
```

| State | Trigger | Visual |
|-------|---------|--------|
| Loading | `GET /api/settings` in flight | 3 skeleton rows (pulsing) inside the section |
| Loaded — all defaults | `planetAspects` empty/absent | 9 rows, all `[Default]` |
| Loaded — some custom | entries present | rows show stored values + `[Custom]` |
| Empty (never normal) | API returns malformed map | treated as all-defaults + console warn; no user-facing empty state |
| Load error | fetch fails | inline banner + Retry (re-fetches) |
| Save error | PUT 400/401/500 | section banner with localized message; state preserved; no partial save |

---

## 5. Component Design

| Component | Purpose | States | Props |
|-----------|---------|--------|-------|
| `PlanetAspectsSection` | Container for the feature on the settings page; owns fetch/save/dirty state | `loading`, `loaded`, `dirty`, `saving`, `error`, `resetting` | `planetAspects` (`Record<string, { houses: number[]; degrees: number[] }>`), `onSave(payload)`, `onResetAll()`, `saving`, `error`, `locale` |
| `PlanetAspectRow` | Per-planet row: collapsed summary + expandable editor | `collapsed`, `expanded`, `default`, `custom`, `error`, `disabled` | `planet` (`Planet` enum), `entry?`, `isDefault`, `expanded`, `onToggle`, `onReset`, `error?`, `disabled` |
| `HouseChipGroup` | Houses 1–12 chip multi-select (structural range validation) | `default`, `custom`, `error`, `disabled` | `planet`, `selected` (`number[]`), `onChange` (`number[]`), `error?`, `locale` |
| `DegreeChipGroup` | Degrees 30–330 step 30 chip multi-select (11 angles, labeled) | `default`, `custom`, `error`, `disabled` | `planet`, `selected` (`number[]`), `onChange` (`number[]`), `error?`, `locale` |
| `AspectStatusPill` | Default/Custom semantic indicator (absolute vs offset) | `default`, `custom` | `isDefault`, `locale` |
| `UnsavedChangesIndicator` | Dirty-state indicator + changed-planet count | `clean`, `dirty` | `dirty`, `count` |
| `ResetConfirmDialog` | Bulk-reset destructive confirmation modal | `closed`, `open`, `confirming` | `open`, `planetCount`, `onConfirm`, `onCancel`, `locale` |
| `PlanetJumpSelect` | Planet picker (9 planets, EN/SI) — jump-to-row navigation | `closed`, `open` | `planets` (`Planet[]`), `onSelect(planet)`, `locale` |
| `AspectChip` | Planets/houses table aspect chip — **displays the aspecting planet name only** (glyph + localized EN/SI name; no angle/delta inline); focusable; anchors the `AspectReasonTooltip` | `default`, `hover`, `focus`, `tooltipOpen` | `aspect` (`Aspect`), `locale`, `onShowReason` |
| `AspectReasonTooltip` | Shows **compact reason lines** — one line per distinct aspect reason (planetary drishti and/or rashi drishti), on hover/focus/tap. **Single-reason tooltips keep the inline signed delta** (e.g. `ග්‍රහ දෘෂ්ඨි 7 (180) (+02:05:00)` / EN `Planet drishti 7 (180) (+02:05:00)`; rashi-only: `රාශි දෘෂ්ඨි මේෂ → මිථුන (+02:05:00)`). **Multi-reason tooltips (≥2 reasons) render each reason line WITHOUT its delta and append one shared delta footer** (`Δ +02:05:00`, hairline-separated) so the delta appears exactly once (AI-engineer feedback); rashi lines render `{rashiLabel} {aspectingSign} → {aspectedSign}` (no matched angle on rashi lines); the sole place in the tables for angle/delta detail; viewport-safe, portal-rendered | `hidden`, `hover`, `focus`, `open` (mobile tap) | `aspect` (`Aspect`), `anchorRef`, `locale`, `onDismiss` |

All components are client-side; the numeric Planet enum / numeric arrays flow to `PUT /api/settings` — never display strings (repo convention).

---

## 6. Validation Rules

| Rule | Source | Enforcement | UX surface |
|------|--------|-------------|------------|
| Houses are integers 1–12 | US-PA-002 | Structural (chips only offer 1–12) + server 400 | Chips; banner on server rejection |
| Degrees are multiples of 30 in 30–330 | US-PA-003 | Structural (chips only offer 30–330 step 30) + server 400 | Chips; banner on server rejection |
| At least one house per customized planet | US-PA-002 | Client pre-save + server 400 | Inline error under Houses group; Save disabled |
| At least one degree per customized planet | US-PA-003 | Client pre-save + server 400 | Inline error under Degrees group; Save disabled |
| No duplicate values in a set | structural | Chip toggles make duplicates impossible; server validates array uniqueness | — |
| Planetary Orbs not part of this form | US-PA-006 | Orb values edited only in the existing Planetary Orbs section | orbs section untouched |
| Empty/malformed `planetAspects` | defensive | Server treats missing keys as defaults; malformed map → 400 | banner (§4.7) |
| Unauthorized (401) / role (403) | auth | `getServerSession` in route | redirect to login / settings error banner |

Client-side validation runs on Save attempt and re-validates live; errors are localized (EN/SI). Server-side validation mirrors all rules (defense in depth) and rejects with a localized message and no partial write.

---

## 7. Defaults Display Table (authoritative 9-planet table)

Displayed for every unconfigured planet (Architect Q3 decision) and used as the reset target. **Houses are offsets** (see §2.4); degrees are absolute angle values.

| Planet (EN) | Planet (SI) | Default houses (offsets) | Default degrees |
|-------------|-------------|---------------------------|-----------------|
| Sun | රවි | 3, 5, 7, 9, 10 | 60, 90, 120, 180 |
| Moon | සඳු | 3, 5, 7, 9, 10 | 60, 90, 120, 180 |
| Mars | කුජ | 4, 5, 7, 8, 9 | 60, 90, 120, 180 |
| Mercury | බුධ | 4, 5, 7, 8, 9 | 60, 90, 120, 180 |
| Jupiter | ගුරු | 5, 7, 9 | 60, 90, 120, 180 |
| Venus | සිකුරු | 5, 7, 9 | 60, 90, 120, 180 |
| Saturn | ශනි | 3, 5, 7, 9, 10 | 60, 90, 120, 180 |
| Rahu | රාහු | 5, 7, 9 | 60, 90, 120, 180 |
| Ketu | කේතු | 5, 7, 9 | 60, 90, 120, 180 |

This table replaces the old display default ("Mars 4/8/12, Jupiter 5/9/11, Saturn 3/7/10, Rahu/Ketu 5/9, others → 7th") — the old table was the **offset-of-7 fallback** for unconfigured planets; the new table is authoritative per BA/architecture. Flag: **the old "others → 7th" fallback appears nowhere in the new UI** — QA should verify no stale copy references it.

---

## 8. Horoscope Detail View Updates (data-only, Architect Q1)

**Scope:** Calculations tab (`/horoscopes/[id]`), owner's own horoscope with `source: "auto"`. Manual horoscopes, shared views, exports, and search cards are untouched in v1 (their stored snapshots already reflect the setting at calculation time).

### 8.1 Planets table — Aspects column

Existing Aspects column now renders `planets[].aspects` (planet-to-planet aspects). Per the AI-engineer clarification, each chip shows **only the aspecting planet's name** — the degree angle and signed delta are **not** inline; they live in the aspect tooltip (§8.1.1) as compact reason lines (single-reason keeps the inline delta; multi-reason shows one line per reason + a shared `Δ` footer):

```
| Planet | House | … | Aspects           |
|--------|-------|---|-------------------|
| ☉ Ravi | 1     | … | [ශනි] [ගුරු]      |
| ☽ Moon | 2     | … | —                 |
```

(EN locale renders the same chips as `[Saturn] [Jupiter]` — glyph + localized name per locale.)

- Each aspect chip: `{AspectingPlanet}` — **planet name only** (glyph + localized name), e.g. `සිකුරු` (SI) / `Venus` (EN). No angle, no delta inline.
- **The degree/delta details move into the tooltip**: the matched angle and the signed delta render inside `AspectReasonTooltip` (§8.1.1), never in the table cell — the delta exactly once (inline for a single reason, shared `Δ` footer for ≥2 reasons). No orb tolerance, sign-arc, or gap-explanation text is shown (AI-engineer simplification — small reason lines only).
- The chip links to the aspecting planet's row (`#planet-<id>`), matching the existing row-anchor pattern; it stays focusable so keyboard users can reach the tooltip.
- Multiple chips wrap; a `—` (en dash) renders when `aspects` is empty (existing empty convention).
- The tooltip renders the **plain matched angle value** (e.g. `(180)`, `(210)`) — the §2.2 angle labels are NOT used in the table tooltip (compact reason lines, §8.1.1); the labels remain available for the settings-form degree chips (§4.4). The angle renders **only on planetary reason lines** — rashi lines never show it (§8.1.1).
- **Each aspect chip carries the compact reason-line tooltip** — hover/focus/tap; a single planetary reason keeps `{label} {house} ({angle}) ({delta})` (e.g. `ග්‍රහ දෘෂ්ඨි 7 (180) (+02:05:00)`); ≥2 reasons render one line per reason without deltas plus a single shared `Δ {delta}` footer (e.g. `ග්‍රහ දෘෂ්ඨි 7 (180)` + `රාශි දෘෂ්ඨි මේෂ → මිථුන` + `Δ +02:05:00`) — see §8.1.1.

### 8.1.1 Aspect tooltip — compact reason lines (single or multi)

The Aspects chips tell the student **what** aspect exists — the aspecting planet's name (`සිකුරු / Venus`). The tooltip explains **why and how much** — every distinct reason for the aspect plus the signed degree delta — as **compact reason lines** (AI-engineer simplification: no multi-part primary + breakdown, no orb/gap explanation).

An aspect has **one or more reasons** (Rashi Aspects feature, `specs/business-analysis/20260810-0800-rashi-aspects.md` US-RA-006): a planetary drishti reason and/or one or more rashi drishti reasons. Each distinct reason renders as **its own line**, and the signed delta renders **exactly once** per tooltip (AI-engineer feedback: the delta must not repeat per line):

- **Single reason (planetary)** — the existing compact line, unchanged: `{label} {house} ({angle}) ({delta})` — e.g. SI `ග්‍රහ දෘෂ්ඨි 7 (180) (+02:05:00)` / EN `Planet drishti 7 (180) (+02:05:00)`.
- **Single reason (rashi)** — `{rashiLabel} {aspectingSign} → {aspectedSign} ({delta})` — e.g. SI `රාශි දෘෂ්ඨි මේෂ → මිථුන (+02:05:00)` / EN `Rashi drishti Aries → Gemini (+02:05:00)` (no matched angle on rashi lines — see Notes).
- **Two or more reasons** — the clever multi-line layout: each reason line renders **without** its delta, and the shared signed delta renders once as a **hairline-separated footer** (`Δ {delta}`) that applies to every reason line above:

```
ග්‍රහ දෘෂ්ඨි 7 (180)              ← reason 1 (planetary): label + house + angle
රාශි දෘෂ්ඨි මේෂ → මිථුන           ← reason 2 (rashi): label + aspecting sign → aspected sign
──────────────────────────────────
Δ +02:05:00                       ← shared footer: signed delta ONCE (applies to all lines)
```

EN parallel:

```
Planet drishti 7 (180)
Rashi drishti Aries → Gemini
Δ +02:05:00
```

The tooltip is the **sole place in the tables for the angle/delta details** — the inline `({angle}°, {sign}{dd:mm:ss})` was removed from the chips (§8.1).

#### Layout decision — shared delta footer (Option B), not header (A) or two-column (C)

| Option | Design | Verdict |
|--------|--------|---------|
| A — header + reason bullets | Degree info (angle + delta) in a top header line; reason lines below as bullets | **Rejected:** a third line that either repeats the house token (`ග්‍රහ දෘෂ්ඨි 7` already carries the house) or reads cryptically without it; the first line loses the familiar planetary format; taller tooltip |
| B — stacked reasons + shared `Δ` delta footer (**chosen**) | Reason lines render as today (planetary keeps `(180)`); the delta is hoisted to one hairline-separated footer line | **Chosen:** minimal change from the single-line format; the delta appears once and is explicitly shared by every reason; scales to N reasons (planetary + k rashi) without repetition |
| C — two-column reason list + delta suffix | Delta right-aligned once, associated with all reason lines via column alignment | **Rejected:** column association breaks when lines wrap (tooltip `max-width` 280px / 320px in SI — Sinhala is ~15–20% wider); fragile alignment, cramped Sinhala |

#### Rendering rules

| Reason count | Layout | SI example | EN example |
|--------------|--------|-----------|------------|
| 1 — planetary | `{label} {house} ({angle}) ({delta})` — inline delta retained; conjunction/legacy: `{house}` omitted | `ග්‍රහ දෘෂ්ඨි 7 (180) (+02:05:00)` | `Planet drishti 7 (180) (+02:05:00)` |
| 1 — rashi | `{rashiLabel} {aspectingSign} → {aspectedSign} ({delta})` — inline delta retained; no angle | `රාශි දෘෂ්ඨි මේෂ → මිථුන (+02:05:00)` | `Rashi drishti Aries → Gemini (+02:05:00)` |
| ≥2 | Reason lines **without** deltas — planetary: `{label} {house} ({angle})`; rashi: `{rashiLabel} {aspectingSign} → {aspectedSign}` — then **one** `Δ {delta}` footer | `ග්‍රහ දෘෂ්ඨි 7 (180)` + `රාශි දෘෂ්ඨි මේෂ → මිථුන` + `Δ +02:05:00` | `Planet drishti 7 (180)` + `Rashi drishti Aries → Gemini` + `Δ +02:05:00` |

- **Reason ordering:** planetary reason line(s) render before rashi reason line(s) (US-RA-006 edge case). Multiple rashi reasons render one line per (aspecting sign → aspected sign) pair.
- **Footer styling:** `Δ {delta}` on its own line, separated by a hairline top rule (`--border`); text `--text-secondary` at 12px (Label size). It is a **real text node** — never a CSS pseudo-element — so screen readers receive the delta exactly once.
- **Language-neutral symbols:** `Δ` (U+0394) and `→` (U+2192) render identically in EN and SI; numerals are Western in both locales (app convention).

#### Interaction

| Trigger | Behavior |
|---------|----------|
| Desktop hover | `mouseenter` on an aspect chip → tooltip appears after ~150ms (flicker guard); `mouseleave` → hides immediately; no auto-timeout while hovered |
| Keyboard | Chip is a real focusable element (existing row anchor `<a href="#planet-<id>">` — keep it focusable); `focus` shows the tooltip, `blur` hides it; `Esc` dismisses and returns focus to the chip |
| Mobile (touch) | Each chip renders a `ⓘ` info glyph (accessible name "Show aspect reason"); tap toggles the tooltip; tap outside or `Esc` closes |
| Screen reader | Chip gets `aria-describedby="<tooltip-id>"` pointing at the `role="tooltip"` element; native `title` carries the same full text — all reason lines plus the delta **exactly once** (inline or footer) — as a no-JS/print fallback; since the inline angle/delta was removed from the chips, the tooltip is the only source of that information and must not be lost |

#### Tooltip content

Chip label (§8.1): `{AspectingPlanet}` — **planet name only** (glyph + localized name), e.g. `සිකුරු / Venus`.

Tooltip body — **one line per distinct reason + the delta exactly once** (inline for a single reason, `Δ` footer for ≥2):

| Token | Meaning | Source | Examples |
|-------|---------|--------|----------|
| `{label}` | Localized "planet drishti" prefix | `astrology.drishti.label` (§12) | SI `ග්‍රහ දෘෂ්ඨි`; EN `Planet drishti` (proposal — see Notes) |
| `{rashiLabel}` | Localized "rashi drishti" prefix | `astrology.drishti.rashiLabel` (§12) | SI `රාශි දෘෂ්ඨි`; EN `Rashi drishti` |
| `{house}` | Relative/aspected house 1–12 — planets table: the whole-sign house of the aspect point relative to the aspecting planet (`((aspectType / 30) % 12) + 1`); houses table: the aspected house number of the row | planets table: display derivation from `aspectType`; houses table: the row's house number | `7` |
| `{angle}` | The matched degree difference (`aspectType` / `exactAspectDegree`), plain integer, no `°` symbol — renders **only on planetary reason lines**, never on rashi lines | `aspect` (`Aspect`) | `180` |
| `{aspectingSign}` | Localized name of the sign doing the rashi drishti (the sign the aspecting planet is in) | existing `astrology.signNames.*` keys (numeric `ZodiacSign` enum resolved per locale) | SI `මේෂ`; EN `Aries` |
| `{aspectedSign}` | Localized name of the sign being seen by the rashi drishti | existing `astrology.signNames.*` keys | SI `මිථුන`; EN `Gemini` |
| `{delta}` | Signed `degreeGap` in `d:mm:ss`, zero-padded (existing `formatDegree` convention, `src/lib/astrology.ts`), prefixed `+` when the aspected body is ahead of the exact aspect point in zodiac order, `-` when behind | `degreeGap` magnitude + sign derivation (see Data notes) | `+02:05:00`, `-00:45:30` |
| `Δ` | Language-neutral "delta" prefix of the shared multi-reason footer | `astrology.drishti.deltaFooter` (§12) | `Δ +02:05:00` |
| `→` | Language-neutral "aspects" arrow between the signs on rashi lines | `astrology.drishti.arrow` (§12) | `මේෂ → මිථුන` |

**Exact strings (the ENTIRE tooltip text):**

| Locale | Single — planetary | Single — rashi | Multi (≥2 reasons) |
|--------|--------------------|----------------|---------------------|
| SI | `ග්‍රහ දෘෂ්ඨි 7 (180) (+02:05:00)` | `රාශි දෘෂ්ඨි මේෂ → මිථුන (+02:05:00)` | `ග්‍රහ දෘෂ්ඨි 7 (180)` + `රාශි දෘෂ්ඨි මේෂ → මිථුන` + `Δ +02:05:00` |
| EN | `Planet drishti 7 (180) (+02:05:00)` | `Rashi drishti Aries → Gemini (+02:05:00)` | `Planet drishti 7 (180)` + `Rashi drishti Aries → Gemini` + `Δ +02:05:00` |

**House-omission rule:** the `{house}` token renders when the aspect has a house context — every non-conjunction aspect (30–330: the aspect point lands in a relative house 2–12; houses table: the aspected row house). The `{house}` token is **omitted when no house arm applies**:
- **Conjunction (`aspectType` 0°)** — single-reason: `{label} (0) ({delta})`, e.g. SI `ග්‍රහ දෘෂ්ඨි (0) (+00:05:00)`, EN `Planet drishti (0) (+00:05:00)`; multi-reason planetary line: `{label} (0)` + the shared `Δ {delta}` footer.
- **Legacy/edge data** where the relative-house derivation cannot run (defensive) — the line still renders with `{angle}` (+ `{delta}` inline when single-reason).

Notes:

- **The relative house is a display-time derivation, NOT a matching-rule change.** For a 180° aspect the "7" is the whole-sign house of the aspect point relative to the aspecting planet (`((aspectType / 30) % 12) + 1`: 30°→2, 60°→3, 90°→4, 120°→5, 150°→6, 180°→7, 210°→8, 240°→9, 270°→10, 300°→11, 330°→12). It does **not** re-introduce a degree÷30 house mapping into *matching* (architecture §2 Non-Goals) — it only explains the chip. Flag for Developer: keep the derivation in the pure module/UI layer, never inside `computeHouseAspects*`.
- **No orb, no gap-text, no sign arc, no §2.2 angle labels** render in the tooltip (AI-engineer simplification) — the reason lines + optional `Δ` footer are all it shows. The §2.2 labels remain only in the settings-form degree chips (§4.4).
- **The tooltip is the sole in-table surface for angle/delta detail** — the chips show planet names only, so the tooltip MUST render the matched angle (planetary lines) + signed delta (exactly once), and screen readers must receive it via `aria-describedby`/`title` (see Accessibility below). QA: verify no angle/delta text renders outside the tooltip in the tables.
- **Rashi lines never render the matched angle** — the rashi reason is the sign-to-sign relationship; only the delta (single-reason inline, multi-reason footer) carries degree info on rashi lines. Flag for Developer: US-RA-005 AC2 says the rashi arm computes its own matched angle/`degreeGap`; confirm whether that `aspectType` is stored on the aspect record — the UI deliberately omits it from rashi lines regardless (compactness).
- **EN phrasing proposal:** `Planet drishti` / `Rashi drishti` parallel the SI `ග්‍රහ දෘෂ්ඨි` / `රාශි දෘෂ්ඨි` 1:1 and match the feature's dual naming ("Planet Aspects (දෘෂ්ඨි)" / "Rashi Aspects (රාශි දෘෂ්ඨි)"). Alternatives for BA/PM domain review: `Planetary aspect` / `Sign aspect` (more natural English, less parallel). Numerals are Western in both locales (app convention).

#### Wireframe — hovered tooltip states (extends the §8.1 mockup)

```
| Planet | House | … | Aspects           |
|--------|-------|---|-------------------|
| ☉ Ravi | 1     | … | [ශනි ⓘ] [ගුරු]    |
| ☽ Moon | 2     | … | —                 |
                         │ hover / focus / tap
                         ▼
State 1 — single reason (planetary only):
        ┌─────────────────────────────────────────────┐
        │ role="tooltip"                              │
        │ ග්‍රහ දෘෂ්ඨි 7 (180) (+02:05:00)            │
        │ (EN: Planet drishti 7 (180) (+02:05:00))    │
        └─────────────────────────────────────────────┘

State 2 — single reason (rashi only):
        ┌─────────────────────────────────────────────┐
        │ role="tooltip"                              │
        │ රාශි දෘෂ්ඨි මේෂ → මිථුන (+02:05:00)        │
        │ (EN: Rashi drishti Aries → Gemini           │
        │  (+02:05:00))                               │
        └─────────────────────────────────────────────┘

State 3 — multi reason (planetary + rashi) — clever layout, delta once:
        ┌─────────────────────────────────────────────┐
        │ role="tooltip"                              │
        │ ග්‍රහ දෘෂ්ඨි 7 (180)                       │
        │ රාශි දෘෂ්ඨි මේෂ → මිථුන                   │
        │ ─────────────────────────────────────────── │
        │ Δ +02:05:00                                │
        └─────────────────────────────────────────────┘
        (EN: Planet drishti 7 (180) / Rashi drishti
         Aries → Gemini / Δ +02:05:00)

State 4 — multi reason, 3 lines (planetary + 2 rashi) — footer still once:
        ┌─────────────────────────────────────────────┐
        │ role="tooltip"                              │
        │ ග්‍රහ දෘෂ්ඨි 7 (180)                       │
        │ රාශි දෘෂ්ඨි මේෂ → මිථුන                   │
        │ රාශි දෘෂ්ඨි සිංහ → කුම්භ                 │
        │ ─────────────────────────────────────────── │
        │ Δ +02:05:00                                │
        └─────────────────────────────────────────────┘
```

- **Positioning (viewport-safe):** the tooltip flips above/below/left/right of the chip based on available space; `max-width: 280px` (320px in SI — Sinhala is ~15–20% wider); `line-height: 1.5` on reason lines; `z-index` above the table and any sticky headers; never clipped by the table's overflow container (render via a portal or `position: fixed` with viewport clamping).
- **Dismiss:** mouseleave, `blur`, `Esc`, or tap-outside; there is **no auto-timeout** while the trigger is hovered/focused — students read study data at their own pace.
- **Multiple chips:** only one tooltip open at a time (opening one closes the previous); the open tooltip re-positions if the table scrolls (scroll listener on the scroll container).

#### Accessibility

| Requirement | Design |
|-------------|--------|
| Keyboard | Chips stay real focusable elements; `focus`/`blur` toggle the tooltip; `Esc` dismisses and restores focus to the chip |
| Screen reader | `aria-describedby` on the chip → `role="tooltip"` element; `title` fallback carries the **same full text** — every reason line plus the delta **exactly once** (inline for a single reason, `Δ` footer for ≥2) — no-JS / print. The reason lines and the `Δ` footer are **real text nodes** (never CSS pseudo-elements) so the delta is announced once, never per line. The `→` arrow is announced via an sr-only expansion with the localized verb (`astrology.drishti.rashiVerbAria`: EN `aspects` / SI `දකී`), e.g. an `aria-label` on the tooltip or an sr-only span per rashi line — QA must verify the SR text reads the delta exactly once in both single- and multi-reason tooltips. The inline angle/delta was removed from the chips, so the tooltip is the only accessible source of the degree info — QA must verify it is not lost for screen-reader users |
| Timing | No auto-dismiss timeout; 150ms hover-open delay only — hoverable, dismissible, persistent (WCAG 1.4.13 compliant) |
| Contrast | Tooltip surface = `--surface-elevated` with `--border`; reason-line text `--text-primary` (≥ 4.5:1); footer text `--text-secondary` (≥ 4.5:1); never color-only (text always present) |
| Motion | 120ms fade + 2px translate on open; disabled under `prefers-reduced-motion` |

#### Data notes (composing the lines — flag for Developer/QA)

The reason lines and footer are not free text; each token is derived from existing fields (no new stored schema):

| Token | Source |
|-------|--------|
| `{label}` / `{rashiLabel}` | i18n keys `astrology.drishti.label` / `astrology.drishti.rashiLabel` (§12) — no data dependency |
| `{house}` | Display derivation `((aspectType / 30) % 12) + 1` (planets table) or the aspected row house (houses table) — no new field |
| `{angle}` | `aspectType` / `exactAspectDegree` (existing `Aspect` field) — planetary lines only |
| `{aspectingSign}` / `{aspectedSign}` | Numeric `ZodiacSign` enum values resolved per-locale via existing `astrology.signNames.*` keys — never display strings from the API |
| `{delta}` | `degreeGap` magnitude (existing `Aspect` field, architecture §6.2 `round(degreeGap, 2)`) **+ a sign** — see below |

- **Signed delta (NEW derivation — flag for Developer/QA):** the stored `degreeGap` is an **unsigned magnitude** (architecture §6.2). The `+`/`-` sign must be derived — the aspect point is `abs_i ± d`; the sign reports whether the aspected body sits ahead (`+`) or behind (`-`) of the exact aspect point in zodiac order. Developer: derive the signed value in the pure module (`planetAspects.ts`) or as a view-time helper so EN/SI share one source; QA: verify the sign flips correctly for aspects on both sides of the aspect point, and that `d:mm:ss` is zero-padded per the existing `formatDegree` convention (e.g. `+02:05:00`, `-00:45:30`).
- **Shared-delta assumption (flag for Developer/QA):** the multi-reason footer assumes **one `degreeGap` per aspect record**, shared by all of its reason lines — the AI-engineer observation that "the rashi line's delta would also be the same degreeGap". If the data shape ever allows per-reason `degreeGap`s (US-RA-005 AC2: the rashi arm computes its own matched angle/gap for the same target), the shared footer breaks — confirm the aspect-record shape in the architecture phase before implementing. The UI derives the delta once per tooltip, never per line.
- **No schema change:** the previous `aspectReason` structured-field proposal (older revisions of this §8.1.1) is **withdrawn** — the reason lines compose from the existing `Aspect` fields above, so legacy documents (which already store `aspectType`/`exactAspectDegree`/`degreeGap`) render the compact lines unchanged (single-reason format). The only new computations are the delta sign and the multi-reason reason-list/footer split.
- The localized display strings are built in the UI from the numeric fields + i18n keys — **never stored as text** (repo convention).

### 8.2 Houses table — Aspects column

Existing Aspects column renders `houses[].aspectingPlanets` as **planet-name-only chips** (glyph + localized name, comma-separated) — no angle/delta inline, matching the planets table (§8.1):

```
| House | … | Aspects                    |
|-------|---|----------------------------|
| 1     | … | ☉ Sun, ♄ Saturn            |
| 2     | … | —                          |
```

- Chips use the planet glyph + localized name (EN/SI); a `—` renders when empty.
- **Each chip carries the same compact reason-line tooltip (§8.1.1):** a single planetary reason renders `{label} {house} ({angle}) ({delta})` — the `{house}` token is the aspected row house (always present in the houses table), e.g. SI `ග්‍රහ දෘෂ්ඨි 7 (180) (+02:05:00)` / EN `Planet drishti 7 (180) (+02:05:00)`; a multi-reason tooltip renders one line per reason plus the shared `Δ {delta}` footer (delta once), e.g. SI `ග්‍රහ දෘෂ්ඨි 7 (180)` + `රාශි දෘෂ්ඨි මේෂ → මිථුන` + `Δ +02:05:00`.
- These values are the *stored snapshot* for manual/shared views and the *re-derived* values for owner-auto views (pure computation on refresh, no migration — architecture AD-4).

### 8.3 No other surfaces change

- Chart art, Rasi/KP/navamsa views, dasha tables, report exports, share links, and search result cards are **unchanged** in v1 (their data already reflects the snapshot).
- A banner/hint is NOT added to the detail view in v1 (avoids implying real-time recalculation); the Settings page is the single place that communicates the change.

---

## 9. Accessibility

| Requirement | Design |
|-------------|--------|
| Keyboard navigation | All chips are real `<button>`s (focusable, `aria-pressed`); Tab order: summary row → chevron → chips → Reset → Save. Jump-select is a native `<select>`. `Esc` closes the expanded row / modal / dropdown |
| Screen readers | Sections use `role="group"` + `aria-labelledby`; error text `role="alert"` + `aria-describedby` on the group; Save button `aria-busy` while saving; status pills read "Custom — Sun" / "Default — Sun" (never color-only); modal uses the repo's existing dialog pattern (focus trap, `aria-modal`, labeled by its title) |
| Color contrast | Status pills: indigo on light / gray on light — both ≥ 4.5:1 (existing palette tokens); error text uses `--error`; degree chips show the angle label in `title`/aria, not only in color |
| Touch targets | Chips ≥ 40×40px (existing chip token); on mobile the footer Save bar is thumb-reachable (sticky within section) |
| Focus management | On validation failure, focus moves to the first offending row's first group; on reset, focus returns to the Reset button; on modal close, focus returns to "Reset all to defaults" |
| Motion | Reduce motion respected — toast fade + skeleton pulse are subtle and non-essential (§12) |

---

## 10. Responsive Behavior

| Breakpoint | Layout |
|------------|--------|
| Desktop (≥1024px) | Two-column section header (title left, Reset-all right); rows show all four summary columns; degree chips may render `60° Sextile` full labels; jump-to-planet select visible |
| Tablet (768–1023px) | Rows stack summary onto two lines (name+status / houses+degrees); chips wrap; jump-select hidden (row list is short) |
| Mobile (<768px) | Full-width rows; collapsed row shows name + pill only, "Houses: 3, 7, 10" wraps beneath; expanded editor is a single column; chips wrap to fill width; Save + dirty indicator become a sticky bottom bar within the section; modal is full-screen sheet (existing modal pattern) |

---

## 11. Micro-interactions

| Interaction | Behavior |
|-------------|----------|
| Chip toggle | 120ms scale-down on press, indigo fill + check on select (existing chip token); no page jump |
| Row expand/collapse | 180ms height/opacity ease; chevron rotates `▶`→`▼` |
| Status pill flip | 150ms crossfade `[Default]`→`[Custom]` (semantic change communicates staging) |
| Dirty indicator | Amber dot pulses once on first change; count updates live ("Unsaved changes (2 planets)") |
| Save | Button shows spinner while in flight; success = green "Settings saved" text that fades after 3s + toast |
| Validation error | Error text slides in (120ms), Save shakes once on blocked attempt (existing pattern), focus moves to offending group |
| Reset-all modal | Standard confirm modal; destructive confirm button uses error-red tone |
| Toast | Existing settings toast, auto-dismiss 4s, `aria-live="polite"` |

---

## 12. i18n Message Keys (EN + SI, both synced)

New keys under a `settings.planetAspects.*` namespace (existing `settings.*` pattern; SI translations are proposals for BA/PM review — Appendix B):

| Key | EN | SI (proposal) |
|-----|----|----------------|
| `settings.planetAspects.title` | Planets Aspects houses and degrees | ප්ලැනට් ඇස්පෙක්ට්ස් හවුස් ඇන්ඩ් ඩිග්‍රීස් |
| `settings.planetAspects.subtitle` | Configure which houses and degree angles each planet aspects. | සෑම ග්‍රහයෙක්ම බලපාන භාව සහ අංශක කෝණ සකසන්න. |
| `settings.planetAspects.absoluteHint` | Custom houses apply as absolute house numbers. | අභිරුචි භාව යොදනු ලබන්නේ නිරපේක්ෂ භාව අංක ලෙසිනි. |
| `settings.planetAspects.offsetHint` | Default houses apply as offsets from the planet's house in each horoscope. | පෙරනිමි භාව එක් එක් හොරොස්කෝපයේ ග්‍රහයාගේ භාවයෙන් දුර ප්‍රමාණ ලෙස යොදයි. |
| `settings.planetAspects.statusDefault` | Default | පෙරනිමි |
| `settings.planetAspects.statusCustom` | Custom | අභිරුචි |
| `settings.planetAspects.housesGroup` | Houses (භාව) | භාව |
| `settings.planetAspects.degreesGroup` | Degrees (අංශක) | අංශක |
| `settings.planetAspects.reset` | Reset | යළි සකසන්න |
| `settings.planetAspects.resetAll` | Reset all to defaults | සියල්ල පෙරනිමියට යළි සකසන්න |
| `settings.planetAspects.resetAllConfirmTitle` | Reset all to defaults? | සියල්ල පෙරනිමියට යළි සකසන්නද? |
| `settings.planetAspects.resetAllConfirmBody` | This clears all 9 planets' custom aspect settings. Defaults will apply instead. | මෙය ග්‍රහයන් 9 දෙනාගේම අභිරුචි සැකසුම් ඉවත් කරයි. පෙරනිමි යොදනු ලැබේ. |
| `settings.planetAspects.alreadyDefault` | {planet} already uses the default settings. | {planet} දැනටමත් පෙරනිමි සැකසුම් භාවිතා කරයි. |
| `settings.planetAspects.unsaved` | Unsaved changes ({count} planet(s)) | සුරැකීමට ඇති වෙනස්කම් ({count}) |
| `settings.planetAspects.errAtLeastOneHouse` | Select at least one house for {planet}. | {planet} සඳහා අවම වශයෙන් එක් භාවයක් තෝරන්න. |
| `settings.planetAspects.errAtLeastOneDegree` | Select at least one degree for {planet}. | {planet} සඳහා අවම වශයෙන් එක් අංශකයක් තෝරන්න. |
| `settings.planetAspects.errLoad` | Could not load your aspects setting. Please try again. | ඔබගේ දෘෂ්ඨි සැකසුම පූරණය කළ නොහැක. නැවත උත්සාහ කරන්න. |
| `settings.planetAspects.errSave` | Could not save settings: {message} | සැකසුම් සුරැකිය නොහැක: {message} |
| `settings.planetAspects.saved` | Settings saved | සැකසුම් සුරැකිණි |
| `astrology.aspectAngles.30` … `330` | Semisextile … Semisextile (11 signs) | §2.2 table |
| `astrology.planetNames.*` | existing keys (Sun/Moon/…) | existing keys — reused |
| `astrology.drishti.label` | Planet drishti | ග්‍රහ දෘෂ්ඨි |
| `astrology.drishti.rashiLabel` | Rashi drishti | රාශි දෘෂ්ඨි |
| `astrology.drishti.line` | `{prefix} {house} ({angle}) ({delta})` — **single-reason planetary** only (inline delta retained) | `{prefix} {house} ({angle}) ({delta})` (same template) |
| `astrology.drishti.lineNoHouse` | `{prefix} ({angle}) ({delta})` — single-reason conjunction/legacy: `{house}` omitted | `{prefix} ({angle}) ({delta})` (same template) |
| `astrology.drishti.lineMulti` | `{prefix} {house} ({angle})` — planetary line in a **multi-reason** tooltip (no delta; the delta lives in `deltaFooter`) | `{prefix} {house} ({angle})` (same template) |
| `astrology.drishti.lineMultiNoHouse` | `{prefix} ({angle})` — multi-reason conjunction/legacy planetary line | `{prefix} ({angle})` (same template) |
| `astrology.drishti.rashiLine` | `{rashiLabel} {aspectingSign} → {aspectedSign}` — rashi line in a multi-reason tooltip (no angle, no delta); sign names localized via existing `astrology.signNames.*` | `{rashiLabel} {aspectingSign} → {aspectedSign}` (same template) |
| `astrology.drishti.rashiLineWithDelta` | `{rashiLabel} {aspectingSign} → {aspectedSign} ({delta})` — **single-reason rashi** (inline delta retained; no angle) | `{rashiLabel} {aspectingSign} → {aspectedSign} ({delta})` (same template) |
| `astrology.drishti.deltaFooter` | `Δ {delta}` — shared footer, rendered **ONCE** when the tooltip has ≥2 reasons; `Δ` (U+0394) is language-neutral (numerals Western in both locales) | `Δ {delta}` (identical — not translatable text) |
| `astrology.drishti.arrow` | `→` (U+2192) — visual separator in rashi lines; language-neutral | `→` (identical) |
| `astrology.drishti.rashiVerbAria` | `aspects` — sr-only/aria expansion of the `→` arrow (screen readers) | `දකී` — sr-only/aria expansion of the `→` arrow |
| `astrology.drishti.delta` | `{sign}{dd}:{mm}:{ss}` — signed d:m:ss, zero-padded per existing `formatDegree` (numerals are Western in both locales) | `{sign}{dd}:{mm}:{ss}` (identical — not translatable text) |
| `astrology.aspectReason.infoGlyph` | Show aspect reason | දෘෂ්ඨි හේතුව පෙන්වන්න |

Notes:
- The tooltip renders **one line per distinct reason** from the keys above. **Exactly one reason** → the single-line formats with the inline delta: `astrology.drishti.line` / `lineNoHouse` for planetary, `astrology.drishti.rashiLineWithDelta` for rashi. **Two or more reasons** → each reason line renders WITHOUT its delta (`astrology.drishti.lineMulti` / `lineMultiNoHouse` for planetary, `astrology.drishti.rashiLine` for rashi, planetary lines first) and `astrology.drishti.deltaFooter` renders once as the last line. `{prefix}` = `astrology.drishti.label` or `astrology.drishti.rashiLabel`; `{delta}` = `astrology.drishti.delta` (signed, zero-padded `d:mm:ss`); `→` = `astrology.drishti.arrow`. **Removed in this revision:** `primaryBoth` / `primaryDegree` / `primaryHouse` / `primaryConjunction` / `degreeLine` / `degreeDetail` / `orbDetail` / `houseOrdinal.*` — the two-part tooltip they served no longer exists (AI-engineer simplification to compact reason lines).
- `astrology.aspectReason.infoGlyph` is retained — the mobile `ⓘ` glyph's accessible name (§8.1.1 Interaction) is unchanged.
- Table chips render only `astrology.planetNames.*` (planet name) — **no angle/delta keys appear in the table cells**; all angle/delta copy lives in the tooltip.
- The shared pure module (architecture §6.1) takes numeric degrees and returns output; it contains no strings. Label mapping lives in the UI layer via the keys above.

---

## 13. Interaction States Summary

| State | Settings section | Horoscope tables | Notes |
|-------|------------------|------------------|-------|
| First run (no config) | 9 rows, all Default | aspects render from defaults | never a blocking empty state |
| Configured | Custom rows + Default rows mixed | owner-auto re-derives; snapshots unchanged | — |
| Dirty (unsaved) | amber dot + count; Save enabled | no change until saved | staged model |
| Saving | spinner, controls disabled | — | PUT in flight |
| Saved | green text + toast, clean | next recalculation/refresh picks it up | — |
| Validation error | inline errors; Save disabled | — | live re-validation |
| Load/save error | banners with Retry | — | no partial save |
| Reset all | confirm modal → all Default (dirty) | — | staged until Save |

---

## 14. Files Created/Updated (context for QA)

**Created:**
- `specs/ux/20260809-2215-planet-aspects.md` — this spec

**Updated (UX main documents):**
- `specs/ux/main-ux-spec.md` — settings page section list (Planets Aspects section added), interaction patterns (chips, staged save, reset-to-defaults), empty-states table (defaults-fill, never empty), file index row; rev. 2026-08-10 — planets/houses table aspect chips render planet names only; the aspect tooltip renders compact **reason lines** — single-reason keeps the inline delta (e.g. `ග්‍රහ දෘෂ්ඨි 7 (180) (+02:05:00)`), multi-reason hoists the shared delta to one `Δ` footer so it is never repeated (see §8.1.1)
- `specs/business-analysis/20260809-2133-planet-aspects.md` — (read-only source, unchanged by UX)
- `specs/architecture/20260809-2145-planet-aspects.md` — (read-only source, unchanged by UX)

**Pending (Development):** per architecture spec §7 — `planetAspects` in `UserSettings`, settings route updates, shared pure module, horoscope view consumption; plus the Rashi Aspects feature (`specs/business-analysis/20260810-0800-rashi-aspects.md`) — rashi-drishti reason data must flow to the tooltip so multi-reason lines render.

**Flags for QA:**
1. §2.2 discrepancy: BA Aspect Type table says "Quincunx, 6 signs" for 210°; this spec uses 7 signs (210 ÷ 30) — reconcile with BA/PM.
2. Old "others → 7th" default fallback must not appear anywhere in the new UI copy.
3. SI translations are proposals — BA/PM review needed (Appendix B of BA spec).
4. Manual horoscopes / shared views intentionally show stored snapshots (no live re-derivation) — verify no regression in the calculations tab for `source: "manual"`.
5. Tooltip **single-reason** formats (inline delta retained): planetary `{label} {house} ({angle}) ({delta})` — SI `ග්‍රහ දෘෂ්ඨි 7 (180) (+02:05:00)`, EN `Planet drishti 7 (180) (+02:05:00)`; rashi `{rashiLabel} {aspectingSign} → {aspectedSign} ({delta})` — SI `රාශි දෘෂ්ඨි මේෂ → මිථුන (+02:05:00)`, EN `Rashi drishti Aries → Gemini (+02:05:00)`. QA checks: `{house}` omitted for conjunction/legacy (`{label} (0) ({delta})`); negative delta renders `-` (e.g. `-00:45:30`); `d:mm:ss` zero-padded per `formatDegree`; no orb/gap-text/label/§2.2 angle names anywhere in the tooltip. The old `aspectReason` structured-field proposal is **withdrawn** (no schema change; §8.1.1 Data notes).
6. **Multi-reason clever layout (AI-engineer feedback — the delta must NOT repeat per line):** when a tooltip has ≥2 reasons, QA must verify the signed delta appears **exactly once** — as the shared `Δ {delta}` footer (hairline-separated last line) — and never on any reason line, in BOTH locales. Also verify: the matched angle `(180)` appears only on the planetary line (never on rashi lines); a ≥3-reason tooltip (planetary + 2 rashi) renders one line per reason plus exactly one footer; the footer is a real text node read once by screen readers; single-reason tooltips do NOT show a footer (inline delta retained).
7. Rashi reason line template `{rashiLabel} {aspectingSign} → {aspectedSign}` — QA: sign names localize via existing `astrology.signNames.*` in both locales (SI `මේෂ → මිථුන`, EN `Aries → Gemini`); numerals stay Western; the `→` arrow is language-neutral; screen readers get the localized verb (`astrology.drishti.rashiVerbAria`: EN `aspects` / SI `දකී`) via an sr-only expansion or `aria-label`, and the full text with the delta exactly once via `aria-describedby` + `title` fallback.
8. **BA spec copy drift:** `specs/business-analysis/20260810-0800-rashi-aspects.md` US-RA-006 AC1 documents the OLD two-line example with the delta repeated per line (`ග්‍රහ දෘෂ්ඨි 7 (180) (+02:05:00)` / `රාශි දෘෂ්ඨි මේෂ රාශිය මිථුනය දකී (+02:05:00)`). This UX revision supersedes that copy (delta once, footer; compact `→` rashi line replaces both the short and long rashi forms — BA OQ4 resolved). The BA doc is read-only — flag to BA/PM to reconcile AC1's example.
9. **Shared-delta assumption (Developer):** the multi-reason footer assumes ONE `degreeGap` per aspect record shared by all its reasons. US-RA-005 AC2 says the rashi arm computes its own matched angle/`degreeGap` — confirm the aspect-record shape (single `degreeGap` vs per-reason gaps) in the architecture phase before implementing the footer; also derive the signed delta (stored `degreeGap` is unsigned) in the pure module — §8.1.1 Data notes.


