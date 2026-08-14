# Shad Bala (ෂඩ් බලය) — Six Planetary Strengths: Architecture Specification

**Date:** 2026-08-13
**Status:** Draft
**Source:** `docs/shadbalaya.md`, `specs/business-analysis/20260813-1954-shadbalaya.md`, `specs/business-analysis/data-model.md` → ShadBalaya
**Related:** `20260812-2111-system-astrology-settings.md` (recalculation job — overrides must survive it), `20260809-2145-planet-aspects.md` (AspectChip/AspectTooltip pattern reused for reason tooltips)

---

## Context

The calculations tab of the horoscope detail page shows a derived planets table, houses, dashas and other calculated values. This feature adds a **ෂඩ් බලය (Shad Bala)** table — the six classical strengths of each planet:

| Bala | Sinhala | Meaning | Computed by system |
|------|---------|---------|--------------------|
| Sthana | ස්ථාන බල | Positional strength (exaltation / debilitation / enmity) | Yes (auto + manual) |
| Cheshta | චේෂ්ටා බලය | Motivational / motion strength (Uttarayana, paksha, conjunction, retrograde, planet war) | Partial (see per-bala rules) |
| Kala | කාල බලය | Temporal strength (day/night, lunar paksha, varga loads) | Partial (varga loads deferred) |
| Dig | දිග් බලය | Directional strength (planet in its directional house) | Yes (auto + manual) |
| Drishti | දෘෂ්ඨි බලය | Aspect strength — manually entered only | No |
| Naisargika | නෛසර්ගික බලය | Natural strength — absent only for the Maranakaraka planets | Yes (auto + manual) |

The table has **8 columns**: ග්රහයා (Planet), the six bala columns, and අනුපාතය (Anupatha ratio) shown as `(n/6)` — the count of checked balas over 6, not a division result.

Each bala renders as a **checkbox** (checked = planet has the bala). Checkboxes are auto-checked from the rules below where the system can calculate them; the student may **check/uncheck any bala** and the change **auto-saves**. Every checkbox has a **tooltip** explaining why it is checked or unchecked. User overrides persist and are **never wiped** by the AstrologySettings recalculation job.

This spec covers the technical design: data model, calculation module, API contract, recalculation merge, UI component, i18n, and traceability to the user stories (US-SB-001…014).

## Goals / Non-Goals

### Goals

- Compute and persist the six balas per planet on `CalculatedDetails` for both `source: "auto"` and `source: "manual"` horoscopes.
- Render a localized 8-column table (9 rows) in the calculations tab with checkbox toggles, auto-save, and reason tooltips.
- Preserve user overrides (`overridden: true`) across the AstrologySettings full-recalculation job.
- Keep all astrological values as numeric enums and all UI text behind i18n keys (`si` + `en`).

### Non-Goals (v1 — deferred, documented in Open Questions)

- **Planet-war module**: no graha-yuddha logic exists anywhere in the codebase (verified by repository search). The Cheshta "planet-war winner" condition is **not computed in v1**; the student sets it manually.
- **Hora/Panchama/Sukshama varga-load calculation**: the load formula is unconfirmed by domain and no varga-load data exists in `CalculationResult`. The Kala varga-load condition is **not computed in v1**; the student sets it manually.
- Drishti bala is never auto-computed (by design — system cannot calculate it).

## Data Model

Storage lives on `CalculatedDetails.shadbalaya` as defined in `data-model.md` → ShadBalaya. Keyed by numeric `Planet` enum string (`"1"`…`"9"`), each planet entry holds one per-bala object carrying the effective `value` (Boolean), whether the student manually toggled it (`overridden`), and the `reasons` used to compose the checkbox tooltip. The ratio is **not stored** — derived at render time as `count of true values / 6`, displayed as `(n/6)`.

```json
{
  "1": {
    "sthanaBala": { "value": true, "overridden": false, "reasons": [{ "key": "shadbalaya.sthana.reason.uchcha" }] },
    "cheshtaBala": { "value": true, "overridden": false, "reasons": [{ "key": "shadbalaya.cheshta.reason.uttarayana" }] },
    "kalaBala": { "value": true, "overridden": false, "reasons": [{ "key": "shadbalaya.kala.reason.day" }] },
    "digBala": { "value": true, "overridden": false, "reasons": [{ "key": "shadbalaya.dig.reason.house", "params": { "house": 10 } }] },
    "drishtiBala": { "value": false, "overridden": false, "reasons": [{ "key": "shadbalaya.drishti.reason.manual" }] },
    "naisargikaBala": { "value": true, "overridden": false, "reasons": [{ "key": "shadbalaya.naisargika.reason.notMaranakaraka" }] }
  }
}
```

- `reasons` always reflect the computed rules (checked or unchecked), so the tooltip can explain both states (US-SB-009). Empty `[]` when no rule applies and the bala is not manual-only.
- Only `overridden: true` entries are authoritative in a recalculation merge (US-SB-013).

### Mongoose schema (`src/models/CalculatedDetails.ts`)

Add to the existing schema (mirrors `planetAspects` / `planetaryOrbs` Record convention):

```ts
shadbalaya: {
    type: Map,
    of: {
        sthanaBala: ShadBalaValueSchema,
        cheshtaBala: ShadBalaValueSchema,
        kalaBala: ShadBalaValueSchema,
        digBala: ShadBalaValueSchema,
        drishtiBala: ShadBalaValueSchema,
        naisargikaBala: ShadBalaValueSchema,
    },
    default: {},
},
```

where `ShadBalaValueSchema = { value: Boolean, overridden: Boolean, reasons: [{ key: String, params: Map }] }` (params optional). The existing `ICalculatedDetails extends CalculationResult` type gains `shadbalaya?: ShadBalaya`.

### Legacy documents

Existing `CalculatedDetails` documents predate the `shadbalaya` field. Following the established `getThithi()` / `getPanchaPakshi()` / `resolvedMaranakaraka` pattern (see `src/app/horoscopes/[id]/page.tsx`), the page **lazily recomputes** Shad Bala at render time from the stored `planets` + `houses` (pure module, no ephemeris) and **persists on next save**: the first toggle writes the full record via the PATCH route. No migration/backfill job is required.

## Calculation Module — `src/lib/shadBalaya.ts`

A new pure shared module consumed by:

- the auto calculation engine (`src/lib/calculation.ts`) — computed at creation / recalculation,
- the manual chart derivation (`src/lib/manualChartDetails.ts` `synthesizeCalculation`) — computed on save / recalculation,
- the horoscope detail page (`src/app/horoscopes/[id]/page.tsx`) — lazy recompute for legacy documents (client-side, no ephemeris, no I/O),
- the AstrologySettings recalculation job — recompute + merge (see Recalculation integration).

### Shared types

```ts
export type ShadBalayaKey = "sthanaBala" | "cheshtaBala" | "kalaBala" | "digBala" | "drishtiBala" | "naisargikaBala";

export interface ShadBalaReason {
    key: string;                    // i18n key, resolved per locale at render — never localized text
    params?: Record<string, number>; // numeric enum params (planet/sign/house/strength)
}

export interface ShadBalaValue {
    value: boolean;
    overridden: boolean;
    reasons: ShadBalaReason[];
}

export interface ShadBalayaPerPlanet {
    sthanaBala: ShadBalaValue;
    cheshtaBala: ShadBalaValue;
    kalaBala: ShadBalaValue;
    digBala: ShadBalaValue;
    drishtiBala: ShadBalaValue;
    naisargikaBala: ShadBalaValue;
}

export type ShadBalaya = Record<string, ShadBalayaPerPlanet>; // keyed by Planet enum string "1".."9"

export interface ShadBalayaContext {
    source: "auto" | "manual";
    thithi?: number;              // paksha source; falls back to computeThithiFromPlanets(planets)
    day?: boolean;                // day/night birth; undefined = not derivable (manual without birth time/lat)
    maranakaraka?: number[];      // overrides the computeMaranakaraka(planets, houses) default (manual path)
}
```

### Function signatures

```ts
export function computeShadBalaya(planets: Planet[], houses: House[], ctx: ShadBalayaContext): ShadBalaya;

export function mergeShadBalaya(computed: ShadBalaya, stored?: ShadBalaya | null): ShadBalaya;
```

One shared `computeShadBalaya` serves both chart sources — the same function runs server-side at calculation time and client-side for legacy lazy recompute, so there is zero logic drift (mirrors the `src/lib/manualChart.ts` shared-module principle). Source-specific conditions are gated by `ctx`:

- `ctx.source === "auto"`: Uttarayana (Ravi) and planet-war conditions eligible; Kala day/night from birth data.
- `ctx.source === "manual"`: Uttarayana replaced by the sign-based rule; planet-war and varga-load conditions skipped; Kala day/night only when `ctx.day` is provided.

The house used for evaluation is **`findHouse(p.absoluteDegree, houses) ?? p.house`** — the cusp-based calculated house on auto charts, the entered house on manual charts (the same house shown in the chart; consistent with the `resolvedMaranakaraka` comment and the planets-table `displayHouse` computation).

### Per-bala rules

#### Sthana (ස්ථාන බල) — US-SB-002

`value = !(sign is an enemy sign)` — an enemy-sign (Shatru) placement removes the bala, whether alone or combined with Neecha; a Neecha placement in a non-enemy sign keeps the bala (Clarifying Assumption 1).

- **Debilitated check**: `p.strength === PlanetaryStrength.NEECHA || p.strength === PlanetaryStrength.ATHI_NEECHA` (numeric `-1` / `-1.25`). Used only to select the `neecheShatru` reason when it coincides with the enemy-sign placement.
- **Enemy-sign check** (separate helper — `computePlanetStrength` collapses a debilitated planet to `NEECHA` and never reports `SHATRU`, so the enemy check cannot come from `p.strength`): `NATURAL_ENEMIES[p.name]?.includes(SIGN_LORD[p.sign])` — both `NATURAL_ENEMIES` and `SIGN_LORD` are exported from `src/lib/manualChart.ts`.
- **Reasons**: when the bala is removed because the planet is in an enemy sign while also Neecha → `shadbalaya.sthana.reason.neecheShatru` with `{ strength, sign }`; when removed for an enemy sign without Neecha → `shadbalaya.sthana.reason.shatru`. When present → the governing strength reason (`uchcha` / `athiUchcha` / `moolatrikona` / `ownSign` / `mitra` / `sama` / `debilitated`) derived from the resolved strength, or the existing `astrology.*` strength labels. Applies to both sources (manual uses the entered sign + its derived strength).

#### Cheshta (චේෂ්ටා බලය) — US-SB-003

`value = OR of any applicable condition`; the tooltip lists every satisfied reason (US-SB-009 AC3).

| # | Condition | Gate | Reason key |
|---|-----------|------|-----------|
| 1 | Ravi in Uttarayana | auto (always has birth time + location) | `shadbalaya.cheshta.reason.uttarayana` |
| 1a | Ravi in Makara/Kumba/Meena/Mesha/Wrushaba (signs 10, 11, 12, 1, 2) | manual fallback | `shadbalaya.cheshta.reason.uttarayanaSign` |
| 2 | Moon in Shukla paksha (thithi 1–15) | both | `shadbalaya.cheshta.reason.shuklaPaksha` |
| 3 | Kuja/Buda/Sikuru/Guru/Shani (3, 4, 6, 5, 7) in the same sign as a Shukla-paksha Moon | both | `shadbalaya.cheshta.reason.shuklaChandra` |
| 4 | Planet is Vakra (`p.retrograde === true`) | both (auto only in practice — manual planets are always `retrograde: false`) | `shadbalaya.cheshta.reason.vakra` |
| 5 | Planet-war winner (holds until 48h after the war) | **deferred — no war module exists**; auto only when it lands | `shadbalaya.cheshta.reason.warWinner` |

**Uttarayana boundary (BA OQ3 resolved):** the same sign-based rule (Ravi in signs 10–12, 1–2) is used for **both** sources in v1. It is deterministic, sidereal-sign based (matches the manual fallback in `docs/shadbalaya.md`), requires no ephemeris, and works in the client-side legacy path. A solstice/longitude-based computation is a possible refinement; documented as an assumption.

**"Combined with Shukla Chandra" (BA OQ4 resolved):** same-sign conjunction with the Moon (planet's `sign` === Moon's `sign`) while the Moon is in Shukla paksha. Deterministic, needs no degree/orb data, and works for manual charts whose planets carry only signs reliably. An orb-based conjunction using the Moon's `planetaryOrbs` is a possible refinement.

**Paksha boundary (BA OQ5 resolved):** Shukla = thithi 1–15 (Purnima = 15 → Shukla), Krishna = thithi 16–30 (Amavasya = 30 → Krishna). This matches the existing `computePanchaPakshi` convention in `src/lib/astrology.ts`.

#### Kala (කාල බලය) — US-SB-004

`value = OR of any applicable condition`; the tooltip lists every satisfied reason.

| # | Condition | Gate | Reason key |
|---|-----------|------|-----------|
| 1 | Chandra(2), Kuja(3), Shani(7) for a **night** birth | `ctx.day === false` | `shadbalaya.kala.reason.night` |
| 2 | Ravi(1), Guru(5), Sikuru(6) for a **day** birth | `ctx.day === true`, **suppressed for Ravi while Moon is in Shukla paksha** | `shadbalaya.kala.reason.day` |
| 3 | Budha(4), Guru(5), Sikuru(6), **Rahu(8)** when Moon is in Shukla paksha | both | `shadbalaya.kala.reason.shuklaPaksha` |
| 4 | Kuja(3), Shani(7), **Rahu(8)** when Moon is in Krishna paksha (**Ravi is excluded from the Krushna list**) | both | `shadbalaya.kala.reason.krushnaPaksha` |
| 5 | Hora/Panchama/Sukshama varga loads | **deferred — formula unconfirmed, no data in `CalculationResult`** | `shadbalaya.kala.reason.vargaLoad` |

**Day/night definition (BA OQ2 resolved):** `day = the Sun is above the horizon at birth`. Implemented deterministically as the Sun's cusp-house relative to the ascendant: Sun in houses 7–12 → day; 1–6 → night. This requires only stored data (no ephemeris) and works in the client-side legacy path. An ephemeris sunrise/sunset computation (swisseph `swe_rise_trans`) is a documented refinement.

- **auto**: always computed (`findHouse(Sun.absoluteDegree, houses) >= 7`).
- **manual**: computed only when a birth time and latitude exist (`ctx.day` supplied); otherwise the day/night conditions are skipped (Kala may still be satisfied by the paksha conditions; any remaining unchecked bala is set manually).

#### Dig (දිග් බලය) — US-SB-005

`value = the planet's house === its directional house`.

| Planet | Directional house |
|--------|-------------------|
| Guru(5), Budha(4) | 1st |
| Kuja(3), Ravi(1) | 10th |
| Chandra(2), Shukra(6) | 4th |
| Shani(7) | 7th |

- Rahu(8) and Ketu(9) never have Dig bala — `value: false` with `reasons: []`.
- House = `findHouse(p.absoluteDegree, houses) ?? p.house` for both sources.
- Reason when checked: `shadbalaya.dig.reason.house` with `{ house }`.

#### Drishti (දෘෂ්ඨි බලය) — US-SB-007

- Never computed by the system on either source. `value: false`, `reasons: [{ key: "shadbalaya.drishti.reason.manual" }]`.
- The student may toggle it; the toggle persists with `overridden: true` (US-SB-008).

#### Naisargika (නෛසර්ගික බලය) — US-SB-006

- `value = !maranakaraka.includes(p.name)` for every planet; each planet occupying its designated death house is itself a Maranakaraka (Chandra→8, Rahu→9, Shani→1, Ravi→5, Shukra→6, Kuja→7, Budha→4, Guru→3), so multiple planets can be unchecked at once (US-SB-006 Business Rules).
- Maranakaraka source: `ctx.maranakaraka ?? computeMaranakaraka(planets, houses)`. The auto and manual calculation engines pass their already-resolved value; the page's legacy path uses `resolvedMaranakaraka` (recomputed from `planets` + `houses` for both auto and manual; stored `calculatedDetails.maranakaraka` only as a fallback).
- Reason when checked: `shadbalaya.naisargika.reason.notMaranakaraka`. When unchecked: `shadbalaya.naisargika.reason.maranakaraka` with `{ house }` (the triggering house — the planet's cusp house at the time the rule fired).

### Default record for unset balas

A bala with no rule applied and not manual-only renders unchecked with `reasons: []`; the UI tooltip then shows the generic "not set / set manually" reason (`shadbalaya.reason.manual`). Drishti always carries the manual reason. This covers the US-SB-001 Edge Case (empty/unset bala renders as an unchecked checkbox with a manual/set-manually tooltip).

## Recalculation integration — US-SB-013

The AstrologySettings full-recalculation job (`src/lib/recalculationJob.ts` `startRecalculation`) recomputes `CalculationResult` and overwrites `CalculatedDetails` per document. Shad Bala must follow the `manualHousePlacements` precedent (never overwritten):

```ts
export function mergeShadBalaya(computed: ShadBalaya, stored?: ShadBalaya | null): ShadBalaya {
    // For each planet, for each bala:
    //   stored.overridden === true  → keep stored value/reasons
    //   otherwise                   → use computed value/reasons
}
```

- **Non-overridden balas are recomputed** from the current chart data (and may change) — US-SB-013 AC2.
- **`overridden: true` balas keep the stored user value** — US-SB-013 AC1.
- Integration points:
  - `src/lib/recalculationJob.ts` — before persisting a recomputed `CalculationResult`, call `mergeShadBalaya(computed.shadbalaya, existing.shadbalaya)`.
  - `scripts/recalculate-horoscopes.ts` (auto) and `scripts/recalculate-calculated-horoscopes.ts` (manual via `recalculateCalculatedHoroscope`) — same merge.
  - The PATCH route never touches `overridden` entries other than the one being toggled.
- **`overridden: true` is sticky** even when the toggled value equals the computed value (Clarifying Assumption 4; BA OQ7 resolved: always set `true` on toggle).

## API — `PATCH /api/horoscope/[id]/shadbalaya`

New route file: `src/app/api/horoscope/[id]/shadbalaya/route.ts`. Follows the standard route pattern (`getServerSession` → 401 → `connectDB()` → authorization → validation → Mongoose mutation → `logger`).

**Request body:**

```json
{ "planet": 3, "bala": "cheshtaBala", "value": true }
```

| Field | Type | Validation |
|-------|------|------------|
| planet | number | integer 1–9 (numeric `Planet`) |
| bala | string | one of `sthanaBala` / `cheshtaBala` / `kalaBala` / `digBala` / `drishtiBala` / `naisargikaBala` |
| value | boolean | required |

**Flow:**

1. `getServerSession(authOptions)` — missing → **401**.
2. `connectDB()`.
3. Load `Horoscope` by id — missing → **404**. If `horoscope.owner.id !== session.user.id` **and** `session.user.role !== "super-admin"` → **403** (US-SB-014 AC3; super-admin may mutate Shad Bala, unlike privacy fields).
4. Load `CalculatedDetails` by `{ "horoscope.id": id }` — missing → **404**.
5. Strictly validate body (planet integer 1–9, bala in the allowed set, value boolean) → **400** on failure, no partial save.
6. Apply a `$set` on the dotted path with `overridden: true`:

```ts
$set: {
    "shadbalaya.<planet>.<bala>.value": value,
    "shadbalaya.<planet>.<bala>.overridden": true,
}
```

For legacy documents this creates a sparse record (only the toggled bala); the page's `mergeShadBalaya(computed, stored)` fills the remainder at render. No computation runs in the route — the merge/lazy-recompute keeps the toggle correct regardless of stored shape.

7. `logger.info` the toggle (`planet`, `bala`, `value`, `horoscopeId`).
8. Respond `200` with `{ planet, bala, value, overridden: true }`.

## UI — `src/components/ShadBalaTable.tsx`

New client component (`"use client"`), placed in the calculations tab of `src/app/horoscopes/[id]/page.tsx` **after the planets table section** (after the closing `</section>` of the planets table, before the manual `DerivedRangesSection`), wrapped in a `bg-white rounded-lg border p-4` section with a `t("astrology.shadbalaya.title")` heading — same visual pattern as the houses/planets tables.

### Props

```ts
export interface ShadBalaTableProps {
    horoscopeId: string;
    shadbalaya: ShadBalaya;        // already resolved: mergeShadBalaya(computed, stored) by the page
    isEditable: boolean;           // horoscope.owner.id === session.user.id || session.user.role === "super-admin"
    getPlanetName: (id: number) => string;
    t: (key: string) => string;
}
```

The page computes the resolved `shadbalaya` via `mergeShadBalaya(computeShadBalaya(planets, houses, ctx), calculatedDetails.shadbalaya)` where `ctx` carries `source`, `thithi` (`getThithi()`), `day` (Sun-house rule, auto only), and the resolved maranakaraka — the same lazy pattern as `getPanchaPakshi()` / `resolvedMaranakaraka`.

### Rendering

- **Desktop**: `overflow-x-auto` table, 8 columns in order — ග්රහයා (Planet), ස්ථාන බල, චේෂ්ටා බලය, කාල බලය, දිග් බලය, දෘෂ්ඨි බලය, නෛසර්ගික බලය, අනුපාතය — one row per planet 1–9 (9 rows), planet names via `getPlanetName` (existing numeric-Planet → i18n labels, US-SB-011 AC5).
- **Bala cells**: a checkbox per bala; checked = has the bala. The ratio column renders `t("astrology.shadbalaya.ratioFormat", { n })` as `(n/6)`, derived from the six `value` flags at render time — never stored (US-SB-010).
- **Mobile**: card view (`sm:hidden`) following the existing planets-table mobile pattern.
- **Read-only (US-SB-014)**: when `isEditable === false` (share links, other students' public horoscopes) render the checked state without interactive checkboxes (disabled checkboxes); ratio and tooltips still render.

### Toggle, auto-save, debounce (US-SB-008)

- Clicking a checkbox flips the value **optimistically** (immediate UI + ratio update).
- **Debounced auto-save**: 500 ms per (planet, bala) key — consecutive toggles on the same key settle on the **latest value (last-write-wins)**; a new toggle resets the pending timer for that key. No separate save button.
- On save: `PATCH /api/horoscope/${horoscopeId}/shadbalaya` with `{ planet, bala, value }`.
- **Failure handling**: revert the checkbox to its previous state and show a localized error toast (`t("common.error")`). (BA OQ9 resolved: per-key debounce + last-write-wins; `navigator.sendBeacon` final flush is unnecessary because toggles only affect `CalculatedDetails`, never page navigation state.)
- The local `shadbalaya` state is re-synced from props when they change (e.g. after recalculation refresh).

### Tooltips (US-SB-009)

Reuse the AspectChip/AspectTooltip pattern (`src/components/aspects/AspectChip.tsx` + `src/components/aspects/AspectTooltip.tsx`): out-of-flow fixed-position tooltip, 150 ms hover delay, focus/tap open, Escape/blur/tap-outside close, `title`/`aria-label` fallback, and Sinhala widening (`max-w-[320px]` when locale is `si`). Each checkbox renders a tooltip with one line per reason (`shadbalaya.reason.manual` fallback when `reasons` is empty), resolved via `t()` from the stored i18n keys + numeric params — no stored localized text.

### Owner/super-admin distinction

The page already derives `isOwner` and holds `session` (`useSession`, page.tsx line ~133). `isEditable = horoscope.owner?.id === session?.user?.id || session?.user?.role === "super-admin"` — mirrors the API's 403 rule exactly so the UI never shows toggles the server will reject.

## i18n — `src/messages/en.json` + `src/messages/si.json`

New `astrology.shadbalaya.*` block, kept in sync across both locales (US-SB-011 AC2). Key set (en samples; si translations required):

```
astrology.shadbalaya.title                                  "Shad Bala"
astrology.shadbalaya.columns.planet                         "Planet"
astrology.shadbalaya.columns.sthanaBala                     "Sthana Bala"
astrology.shadbalaya.columns.cheshtaBala                    "Cheshta Bala"
astrology.shadbalaya.columns.kalaBala                       "Kala Bala"
astrology.shadbalaya.columns.digBala                        "Dig Bala"
astrology.shadbalaya.columns.drishtiBala                    "Drishti Bala"
astrology.shadbalaya.columns.naisargikaBala                 "Naisargika Bala"
astrology.shadbalaya.columns.ratio                          "Ratio"
astrology.shadbalaya.ratioFormat                            "({n}/6)"
astrology.shadbalaya.reason.manual                          "Set manually — the system cannot calculate this bala"
astrology.shadbalaya.sthana.reason.uchcha                   "Exalted (Uchcha)"
astrology.shadbalaya.sthana.reason.athiUchcha               "Deeply exalted (Athi Uchcha)"
astrology.shadbalaya.sthana.reason.moolatrikona             "Moolatrikona"
astrology.shadbalaya.sthana.reason.ownSign                  "Own sign"
astrology.shadbalaya.sthana.reason.mitra                    "Friend sign (Mitra)"
astrology.shadbalaya.sthana.reason.sama                     "Neutral sign (Sama)"
astrology.shadbalaya.sthana.reason.shatru                   "Enemy sign (Shatru)"
astrology.shadbalaya.sthana.reason.neecheShatru             "Debilitated (Neecha) in an enemy sign (Shatru)"
astrology.shadbalaya.cheshta.reason.uttarayana              "Sun in Uttarayana"
astrology.shadbalaya.cheshta.reason.uttarayanaSign          "Sun in Makara/Kumba/Meena/Mesha/Wrushaba (Uttarayana sign)"
astrology.shadbalaya.cheshta.reason.shuklaPaksha            "Moon in Shukla Paksha"
astrology.shadbalaya.cheshta.reason.krushnaPaksha           "Moon not in Shukla Paksha"
astrology.shadbalaya.cheshta.reason.shuklaChandra           "Conjunction with a Shukla-paksha Chandra"
astrology.shadbalaya.cheshta.reason.vakra                   "Retrograde (Vakra)"
astrology.shadbalaya.cheshta.reason.warWinner               "Planet-war winner"
astrology.shadbalaya.kala.reason.day                        "Day birth"
astrology.shadbalaya.kala.reason.night                      "Night birth"
astrology.shadbalaya.kala.reason.shuklaPaksha               "Moon in Shukla Paksha"
astrology.shadbalaya.kala.reason.krushnaPaksha              "Moon in Krishna Paksha"
astrology.shadbalaya.kala.reason.vargaLoad                  "Hora/Panchama/Sukshama varga load"
astrology.shadbalaya.dig.reason.house                       "Planet in the {house} house"
astrology.shadbalaya.drishti.reason.manual                  "Set manually — the system cannot calculate Drishti bala"
astrology.shadbalaya.naisargika.reason.notMaranakaraka      "Not the Maranakaraka"
astrology.shadbalaya.naisargika.reason.maranakaraka         "Maranakaraka (in house {house})"
```

Reason keys follow the data-model examples exactly (`shadbalaya.sthana.reason.uchcha`, `shadbalaya.cheshta.reason.uttarayana`, `shadbalaya.kala.reason.day`, `shadbalaya.dig.reason.house`, `shadbalaya.drishti.reason.manual`, `shadbalaya.naisargika.reason.notMaranakaraka`, `shadbalaya.naisargika.reason.maranakaraka`, `shadbalaya.sthana.reason.neecheShatru`).

## Files touched

| File | Change |
|------|--------|
| `src/lib/shadBalaya.ts` | **New** — `computeShadBalaya`, `mergeShadBalaya`, `ShadBalaya`/`ShadBalaValue`/`ShadBalaReason`/`ShadBalayaContext` types |
| `src/models/CalculatedDetails.ts` | Add `shadbalaya` Map sub-schema; extend `ICalculatedDetails` |
| `src/lib/calculation.ts` | Compute `shadbalaya` in the auto pipeline (`calculateHoroscope`) |
| `src/lib/manualChartDetails.ts` | Compute `shadbalaya` in `synthesizeCalculation` |
| `src/lib/recalculationJob.ts` | Merge `mergeShadBalaya(computed, existing.shadbalaya)` before persist |
| `scripts/recalculate-horoscopes.ts`, `scripts/recalculate-calculated-horoscopes.ts` | Same merge (manual path) |
| `src/app/api/horoscope/[id]/shadbalaya/route.ts` | **New** — PATCH toggle |
| `src/components/ShadBalaTable.tsx` | **New** — table, toggles, debounce, tooltips, read-only mode |
| `src/app/horoscopes/[id]/page.tsx` | Compute resolved `shadbalaya` (legacy lazy merge), render `<ShadBalaTable>` after planets table, pass `isEditable` |
| `src/messages/en.json`, `src/messages/si.json` | Add `astrology.shadbalaya.*` in sync |

## Feature-to-Story Traceability

| Feature requirement (`docs/shadbalaya.md` / BA) | User Story | Spec section |
|------------------------------------------------|-----------|--------------|
| 8-column ෂඩ් බලය table in the calculations tab, both sources | US-SB-001 | UI — rendering |
| Sthana: no bala in a Shatru (enemy) sign (incl. Neecha+Shatru), else has bala | US-SB-002 | Per-bala rules — Sthana |
| Cheshta: Uttarayana / sign fallback, Shukla paksha, Shukla-Chandra, Vakra, planet war | US-SB-003 | Per-bala rules — Cheshta |
| Kala: day/night, paksha, varga loads | US-SB-004 | Per-bala rules — Kala |
| Dig: 1st/10th/4th/7th directional houses | US-SB-005 | Per-bala rules — Dig |
| Naisargika: absent for Maranakaraka | US-SB-006 | Per-bala rules — Naisargika |
| Drishti: manual only | US-SB-007 | Per-bala rules — Drishti |
| Checkbox toggle with auto-save + persistence | US-SB-008 | UI — toggle/auto-save/debounce |
| Tooltip reasons for checked/unchecked | US-SB-009 | UI — tooltips |
| අනුපාතය as (n/6), render-time derived | US-SB-010 | Data model + UI — ratio |
| Sinhala/English i18n | US-SB-011 | i18n |
| Manual horoscopes compute only derivable subset | US-SB-012 | Calculation module — gates |
| Overrides survive AstrologySettings recalculation | US-SB-013 | Recalculation integration |
| Non-owner / share-link read-only | US-SB-014 | UI — read-only + API 403 |

## Open questions (deferred / forwarded)

1. **Hora/Panchama/Sukshama varga-load formula** (BA OQ1) — unconfirmed by domain; not computed in v1. Student sets Kala varga-load manually. Forwarded to PM/Domain.
2. **Planet-war module** (BA OQ6) — no graha-yuddha logic exists anywhere in the codebase (verified). Cheshta war condition deferred until a planet-war module lands; the `ctx.warWinnerPlanet` hook is defined so the condition can be enabled without a module rewrite. Forwarded to Domain/Architect.
3. **Day/night precision** — v1 uses the deterministic Sun-in-houses-7-12 rule for both sources. An ephemeris sunrise/sunset refinement (`swe_rise_trans`) is possible for auto horoscopes; not required in v1.
4. **Conjunction orb** — v1 uses same-sign conjunction with the Moon. An orb-based refinement (Moon's `planetaryOrbs`) is possible; not required in v1.
5. **Manual-state visual indicator** (BA OQ8) — v1 uses the tooltip reason only; a visual dot/strikethrough for student-set balas is a UX follow-up, not in v1.
