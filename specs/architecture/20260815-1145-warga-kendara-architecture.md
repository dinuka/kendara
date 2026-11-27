# Warga Kendara (වර්ග කේනදර) — Architecture

**Date:** 2026-08-15 11:45
**Status:** Draft
**Author:** Architect (BMAD)
**Source:** `docs/warga-kendara.md`, `specs/business-analysis/20260815-1129-warga-kendara.md`, `specs/business-analysis/data-model.md` (WargaKendara + Varga Chart Catalog sections), `specs/business-analysis/actors.md`
**Related:** `specs/architecture/20260814-2127-bhava-suchika-architecture.md` (primary template), `specs/architecture/20260813-2011-shadbalaya-architecture.md`, `specs/architecture/20260812-2200-system-astrology-settings.md`

---

## Overview

The Warga Kendara feature replaces the fixed "Birth & Navamsa" chart pair with a warga tab strip (phase 1: Rāśi D1, Navāṁśa D9, Surya Lagna, Chandra Lagna), keeps exactly two charts on screen with **D1 always selected** and **D9 the default second chart**, shrinks "Other charts" to the House chart only, and adds per-chart **main-indication tags** (beneath each figure's caption) plus **per-chart Houses and Planets tables** beneath each displayed chart figure.

All per-chart data (houses/planets rows, conjunctions/aspects, D1-only flags, Maraka/Maranakaraka/Dig Bala) is **pure derived data**: computed once at calculation time by a new shared module `src/lib/wargaKendara.ts`, persisted on `CalculatedDetails.wargaKendara`, recomputed by the AstrologySettings full recalculation job (no overrides to preserve — unlike Shad Bala), and derived at render time as a fallback for legacy documents. The pattern mirrors `shadbalaya`/`bhavaSuchika` exactly.

No new API endpoints, no new permissions, no Chart-document changes, and no D2–D60 chart computation in this phase.

## System Context

```
┌────────────────────────────── Horoscope Detail Page (client) ──────────────────────────────┐
│  charts tab (new layout)                                                                  │
│  ┌──────────────┐  ┌──────────────┐                                                      │
│  │ warga tab    │  │ chart #1:    │  each figure: caption + main-indication tags          │
│  │ strip        │  │ caption+tags │  (static catalog + i18n)                              │
│  └──────┬───────┘  └──────────────┘                                                      │
│  ┌──────┴───────────────────────────┐   exactly two figures: D1 (locked) + second chart   │
│  │ Chart #1 (D1)  │  Chart #2 (sel) │   ── each followed by its own Houses + Planets      │
│  │ ┌────────────┐ │  ┌────────────┐ │   tables (per-chart wargaKendara entry)             │
│  │ │BirthChart  │ │  │BirthChart  │ │                                                      │
│  │ └────────────┘ │  └────────────┘ │                                                      │
│  │ Houses table   │  Houses table   │                                                      │
│  │ Planets table  │  Planets table  │                                                      │
│  └────────────────┴─────────────────┘                                                      │
│  Other charts section: House only (unchanged HouseChart + current-planet overlay)         │
└──────────────┬────────────────────────────────────────────────────────────────────────────┘
               │ GET /api/horoscope/:id  (calculatedDetails.wargaKendara + charts)
               ▼
┌────────────────────────────── Service Layer ──────────────────────────────────────────────┐
│  src/lib/wargaKendara.ts  (NEW pure module — no ephemeris, no I/O)                        │
│    computeWargaKendara(result, { source, manualHousePlacements }) → WargaKendara          │
│    computeWargaMaraka / computeWargaMaranakaraka / digBala (via shadBalaya helper)        │
│    resolveWargaKendara(doc) — stored-first, legacy render-time fallback                   │
│  consumed by: calculation.ts (auto) · manualChartDetails.ts (manual) · page.tsx (fallback)│
└──────────────┬────────────────────────────────────────────────────────────────────────────┘
               ▼
┌──────────────┴────────────────────────────────────────────────────────────────────────────┐
│  Data Layer — CalculatedDetails.wargaKendara (Schema.Types.Mixed, like shadbalaya)        │
│  keyed d1 | d9 | suryaLagna | chandraLagna (phase 1); recomputed by recalculationJob.ts   │
│  (rides the existing `...calculated` / `...synth` spread — no job changes needed)         │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

## Architecture Decisions

| Decision | Choice | Rationale |
| -------- | ------ | --------- |
| Per-chart computation location | New pure module `src/lib/wargaKendara.ts` | Mirrors `shadBalaya.ts`/`bhavaSuchika.ts` (pure, no ephemeris, no I/O) so the same code runs at calculation time, in the recalculation job, and in the render-time legacy fallback with zero logic drift. |
| Storage shape | Persist `wargaKendara` on `CalculatedDetails` (`Schema.Types.Mixed`, keyed `d1`/`d9`/`suryaLagna`/`chandraLagna`) per the data-model [WargaKendara](#) JSON | BA US-WK-011 requires persistence + recalculation + legacy fallback; `shadbalaya`/`bhavaSuchika` precedent (computed at calc time, optional field, `Mixed` schema type). No overrides exist → no merge logic needed. |
| Conjunction/aspect lists | **Stored** in `wargaKendara` entries (computed within each chart by whole-sign rule), not derived at render | BA System responsibility explicitly says "compute per-chart calculation tables… using each chart's own signs, strengths and houses" and persist them; storing keeps render trivial and matches the data-model structure (`planets[].conjunctions`, `planets[].aspects`, `houses[].aspects`). Pure computation means the legacy fallback re-derives them identically. |
| Per-chart Maraka/Maranakaraka rule | Existing rule re-evaluated against each chart's **own** lagna/houses, implemented as one pure function with a marked assumption | The current `computeMaraka` (D1 2nd/7th lords — private in `calculation.ts`) and `computeMaranakaraka` (house-occupancy rule — exported in `astrology.ts`, documented "lagna chart only, never D9") are the only rules that exist. Applying them per-chart is the only domain-plausible reading of US-WK-008; flagged as an **assumption** pending Open Questions 2–3. Design is a single pure function so swapping the rule later touches one place. |
| Per-chart Dig Bala | Reuse the existing `DIG_HOUSE` mapping via a new small exported helper `computeDigBalaPlanets` in `shadBalaya.ts` | `DIG_HOUSE` (Guru/Budha 1st, Kuja/Ravi 10th, Chandra/Shukra 4th, Shani 7th) already exists privately in `shadBalaya.ts`; exporting one pure function keeps it single-source. Rahu/Ketu never match (no mapping). BA Open Question 4 asks only for confirmation, not a new rule. |
| D9 derivation | Same logic as the page's existing `getNavamsaChartData()`: whole-sign houses from the D9 lagna sign, planets at their `navamsaSign` (auto: stored or `navamsaSign(sign, degree)`; manual: entered `navamsaLagna`/`navamsaHouses` only) | Already-proven render path; moving it into `wargaKendara.ts` makes it shareable by the calc pipeline and the legacy fallback. Manual without Navamsa data → `d9: null` → the existing "no chart data" placeholder (US-WK-010). |
| Surya/Chandra Lagna derivation | Reuse `getChartData(result, ChartType.SURYA_LAGNA / CHANDRA_LAGNA)` (rotate-to-lagna) on the D1 result; **no new Chart documents** | `chartDataTransform.ts` already implements `rotateToLagna` and the API route already persists `surya-lagna`/`chandra-lagna` Chart docs for auto horoscopes via the `ALL_CHART_TYPES` loop. `wargaKendara` entries derive from the CalculationResult directly, so the tables never depend on Chart-doc data (which is a rendering blob, per the Bhava Suchika precedent). |
| ChartType enum (D2–D60) | **Deferred** — do not add enum values in phase 1 | Adding values now would force `ALL_CHART_TYPES` (drives Chart-doc creation in `PUT /api/horoscope/:id`), search text content, `chartCaptions`/`chartTypes` i18n and `chartRenderer` to handle non-calculable vargas. D2–D60 are not rendered anywhere in phase 1 (no tabs, no reference table — product decision 2026-08-15). Phase 2 adds enum values + rendering in one place. |
| Varga catalog | Static TS constant `VARGA_CATALOG` (16 keys + D#) in `wargaKendara.ts` + i18n keys `astrology.wargaKendara.vargas.{key}.{name|indication}` | BA: catalog is static system-wide display data, "never stored per horoscope", bilingual via i18n, English authoritative, Sinhala pending (English fallback until provided). |
| API contract | No new endpoints — `wargaKendara` rides `GET /api/horoscope/:id` and `GET /api/share/:token` inside `calculatedDetails` | US-WK-011/013: persisted with the horoscope, read-only everywhere (own/public/share-link), no mutation endpoint. `ICalculatedDetails extends CalculationResult` + `...calculated` spread persists it automatically (Bhava Suchika precedent). |
| Recalculation job | **No changes required** | `recalculateOne` spreads `...calculated` (auto) / `...synth` (manual) into the doc; `wargaKendara` computed inside those functions rides along. No `overridden` state to merge (unlike `shadbalaya`). |
| Manual horoscopes | `d1` from entered placements; `d9` only when Navamsa data entered (else `null` → placeholder); `suryaLagna`/`chandraLagna` by rotating the entered chart; `manualHousePlacements` never overwritten | US-WK-010; mirrors existing manual limitations (D1-only flags the system cannot derive simply don't appear). |
| D1-only details | The twelve D1-only flags map from existing top-level `CalculatedDetails` fields into the `d1` entry only; `cheshtaBala`/`kalaBala` come from the stored `shadbalaya` entry values | US-WK-007: "no new D1 calculations are introduced by this story" — pure field remapping. Bhava Suchika is **not** duplicated (D1 table column reads the existing top-level `lagnaBhavaSuchika`/`bhavaSuchika`). |

## Component Design

### `src/lib/wargaKendara.ts` (NEW — pure shared module)

- **Location:** `src/lib/wargaKendara.ts`
- **Responsibility:** derive the full per-chart Warga Kendara structure from a `CalculationResult`-shaped object; resolve stored vs legacy documents; static 16-varga catalog supplying the main-indication tags.
- **Interfaces:**

```ts
import type { Ascendant, CalculationResult, House, Planet } from "@/lib/astrology";
import { ChartType } from "@/lib/chartTypes";

/** Whole-sign chart-house row. */
export interface WargaHouseRow {
    houseNumber: number; // 1-12
    sign: number;        // numeric ZodiacSign
    planets: number[];   // numeric Planet enums
    aspects: number[];   // numeric Planet enums aspecting the house (display, no degree diff)
}

/** Per-chart planet row. */
export interface WargaPlanetRow {
    name: number;          // numeric Planet 1-9 (all 9 rows in every chart)
    sign: number;          // ZodiacSign per this chart
    strength: number;      // numeric PlanetaryStrength per this chart
    house: number;         // 1-12 in this chart
    nakshatra?: number;    // D1 entry only
    pada?: number;         // D1 entry only
    conjunctions: number[]; // numeric Planet enums (names only — no degree difference)
    aspects: { planetName: number; aspectType: number }[]; // numeric enums — no degree fields
}

/** Per-chart details. D1-only flags exist only on the `d1` entry. */
export interface WargaChartEntry {
    lagnaSign: number;                 // ZodiacSign of the chart's whole-sign lagna
    houses: WargaHouseRow[];           // 12 rows
    planets: WargaPlanetRow[];         // 9 rows
    // d1-only flags (mapped from top-level CalculatedDetails fields):
    wargoththamaPlanets?: number[];
    pushkaraPlanets?: number[];
    gandanthaPlanets?: number[];
    gandamulaPlanets?: number[];
    lord22ndDrekkana?: number;
    lord64thNavamsa?: number;
    cheshtaBalaPlanets?: number[];
    ashtamanshaPlanets?: number[];
    kalaBalaPlanets?: number[];
    atmakaraka?: number;
    combustPlanets?: number[];
    badhakaPlanets?: number[];
    // per-chart details — every chart entry:
    marakaPlanets: number[];
    maranakaraka: number[];
    digBalaPlanets: number[];
}

export type WargaChartKey = "d1" | "d9" | "suryaLagna" | "chandraLagna";

/** Stored shape: keyed by warga chart key; `null` entry = not derivable (manual w/o Navamsa). */
export type WargaKendara = Record<WargaChartKey, WargaChartEntry | null>;

export interface WargaKendaraContext {
    source: "auto" | "manual";
    manualHousePlacements?: ManualHousePlacementsLike; // manual only
}

export function computeWargaKendara(result: CalculationResult, ctx: WargaKendaraContext): WargaKendara;

/** Per-chart Maraka — chart's own 2nd/7th lords (assumption, see Open Questions). */
export function computeWargaMaraka(ascSign: number): number[];

/** Stored-first resolver for the render path (mirrors resolveLagnaBhavaSuchika). */
export function resolveWargaKendara(calculatedDetails: unknown): WargaKendara | undefined;

/** Static 16-varga catalog supplying main-indication tags (labels via i18n). */
export const VARGA_CATALOG: { key: string; d: number }[];
```

- **Internal derivation rules** (all whole-sign, deterministic, no ephemeris):
  - **Per-chart planets/houses:** D1 = `result.houses`/`result.planets`; D9 = the page's existing `getNavamsaChartData()` logic (whole-sign houses from `ascNavSign` = `navamsaSign(asc.sign, asc.degree)`; planets at `navamsaSign`, house `((navSign − ascNavSign) mod 12) + 1`); Surya/Chandra = `getChartData(result, ChartType.SURYA_LAGNA | CHANDRA_LAGNA)`.
  - **Strength per chart:** D9 = stored `planet.navamsaStrength`; rotated charts = the D1 strength (rotation re-houses, never changes sign → strength unchanged).
  - **Conjunctions (per chart):** planets sharing the same whole-sign chart house, listed by name only (assumption — see Open Questions).
  - **Aspects (per chart):** the same whole-sign diff rule the page already uses for the D1 houses table (`getAspectsToHouse`: diff 6 → 180; special aspects per planet 5/9, 3/7, 4/8 etc. by diff) evaluated within the chart (assumption — see Open Questions).
  - **D1-only flags:** remapped from top-level fields (`wargoththamaPlanets`, `gandanthaPlanets`, `gandamulaPlanets`, `pushkaraPlanets`, `lord22ndDrekkana`, `lord64thNavamsa`, `ashtamanshaPlanets`, `atmakaraka`, `badhakaPlanet`); `combustPlanets` = planets with `p.combustion`; `cheshtaBalaPlanets`/`kalaBalaPlanets` = planets whose stored `shadbalaya[planet].cheshtaBala.value` / `.kalaBala.value` is `true`. Manual charts derive only what the stored data allows (consistent with existing manual limitations).
  - **Maraka:** `computeWargaMaraka(entry.lagnaSign)` — 2nd/7th lords of the chart's own lagna.
  - **Maranakaraka:** `computeMaranakaraka(chartPlanets, chartHouses)` (existing exported function in `astrology.ts`, called with the chart's own planets/houses — assumption).
  - **Dig Bala:** `computeDigBalaPlanets(chartPlanets)` (new helper in `shadBalaya.ts`, uses existing `DIG_HOUSE`; Rahu/Ketu never match).

### `src/lib/shadBalaya.ts` (UPDATE)

- **Add** `export function computeDigBalaPlanets(planets: Array<Pick<Planet, "name" | "house">>): number[]` returning planets whose chart house equals `DIG_HOUSE[planet.name]` — single source of truth for the Dig mapping, consumed by `wargaKendara.ts`.

### `src/lib/astrology.ts` (UPDATE — type only)

- Add `wargaKendara?: WargaKendara;` to `CalculationResult` (optional, like `shadbalaya`/`bhavaSuchika`; `import type` from `wargaKendara.ts` — same pattern as the existing `ShadBalaya` type import).

### `src/lib/calculation.ts` (UPDATE)

- In `calculateHoroscope`, before the return: `const wargaKendara = computeWargaKendara({ ascendant, houses, planets, ... }, { source: "auto" });` and add it to the returned object. Persistence rides the `...calculated` spread (no API-route change needed).

### `src/lib/manualChartDetails.ts` (UPDATE)

- In `synthesizeCalculation`, add `wargaKendara: computeWargaKendara(result-shaped, { source: "manual", manualHousePlacements })` — `d1` from entered placements, `suryaLagna`/`chandraLagna` by rotation, `d9` from entered Navamsa data when present else `null`.
- `synthesizeNavamsaCalculation` needs **no** `wargaKendara` stripping (unlike `lagnaBhavaSuchika`/`bhavaSuchika`): the base result's `wargaKendara` describes the D1 chart with D1 lagna; the D9 entry inside it is derived from `navamsaSign` data only when Navamsa input exists.

### `src/models/CalculatedDetails.ts` (UPDATE)

- Add `wargaKendara: { type: Schema.Types.Mixed }` (absent on legacy docs — `resolveWargaKendara` falls back). No other schema changes.

### `src/app/horoscopes/[id]/page.tsx` (UPDATE — charts tab)

- Replace the fixed pair with a warga tab strip (`Rāśi (D1)`, `Navāṁśa (D9)`, `Surya Lagna`, `Chandra Lagna`); state `secondChart: ChartType` defaulting to `NAVAMSA_D9`; D1 is a fixed member (clicking D1 is a no-op). Resets to D9 on horoscope navigation (state lives on the page component keyed per horoscope id).
- Render the two figures (reusing `BirthChart` + `toBirthChartData`) each followed by its main-indication tags (from `VARGA_CATALOG` + i18n, comma-split into chips) and per-chart Houses + Planets tables fed by `resolveWargaKendara(calculatedDetails)`.
- "Other charts" section renders the House chart only (existing `HouseChart` + current-planet overlay, unchanged).
- Keep the calculations tab byte-for-byte unchanged (per BA Clarifying Assumption 1).

### New client components (component boundary design — placement UX-confirmed)

- `src/components/wargaKendara/WargaIndicationTags.tsx` — chip row for one figure's main indication (i18n `vargas.{key}.indication`, comma-split; `—` when unresolvable).
- `src/components/wargaKendara/WargaChartSection.tsx` — one figure + its caption + indication tags + Houses/Planets tables; props `{ entry: WargaChartEntry | null, chartType, source, noDataMessage }`.
- `src/components/wargaKendara/WargaHousesTable.tsx`, `WargaPlanetsTable.tsx` — columns per US-WK-005/006 (Nakshatra (Pada) + Bhava Suchika only on D1; `Other` cell per US-WK-007/008).

### i18n (`src/messages/en.json` + `si.json` — keep in sync)

- `astrology.wargaKendara.tabLabels.{birth|navamsa-d9|surya-lagna|chandra-lagna}` — e.g. "Rāśi (D1)", "Navāṁśa (D9)".
- `astrology.wargaKendara.vargas.{d1..d60}.{name|indication}` — English authoritative; Sinhala pending domain confirmation (English fallback until provided); phase 1 renders `d1`, `d9`, `suryaLagna`, `chandraLagna` only (no reference-table keys exist).
- `astrology.wargaKendara.indicationLabel`, `astrology.wargaKendara.columns.*` (sign, strength, house, conjunctions, aspects, other, nakshatraPada, bhavaSuchika), `astrology.wargaKendara.noDetails` ("—").
- Reuse existing enum-label maps (`astrology.planetNames`, `signNames`, `strengthNames` / strength labels) — no duplication.

## Data Flow

```
Calculation time (auto):
  POST /api/horoscope  |  PUT /api/horoscope/:id (birth-detail change)
    → calculateHoroscope()
        → computeWargaKendara(result, { source: "auto" })          [wargaKendara.ts]
            → d1 from result.houses/planets
            → d9 from navamsaSign derivation
            → suryaLagna/chandraLagna via getChartData() rotation
            → per-chart maraka/maranakaraka/digBala (marked assumption)
        → return { ...result, wargaKendara }
    → CalculatedDetails.findOneAndUpdate({ ...calculated })         [rides the spread]
    → Chart docs regenerated as today (unchanged)

Calculation time (manual):
  POST /api/horoscope/manual | PUT /api/horoscope/:id/manual-chart
    → synthesizeCalculation()
        → computeWargaKendara(synth, { source: "manual", manualHousePlacements })
            → d1 from entered placements; d9 = null when no Navamsa data;
              suryaLagna/chandraLagna by rotation of entered chart
    → persisted; manualHousePlacements untouched

Recalculation (AstrologySettings job — no code change):
  recalculateOne() → calculateHoroscope() / synthesizeCalculation()
    → wargaKendara rides `...calculated` / `...synth`
    → no merge needed (no overrides exist)

Render (legacy documents / all views):
  page.tsx charts tab → resolveWargaKendara(calculatedDetails)
    → stored wargaKendara valid → use it
    → absent/invalid (console.warn on corrupt) → computeWargaKendara from stored
      planets/houses/ascendant (+ manualHousePlacements) at render time
    → tables + figures render from the resolved entries; D9 null → "no chart data" placeholder
```

## API Contracts

No new routes. Existing responses grow additively:

| Method | Route | Request | Response (delta) |
| ------ | ----- | ------- | ---------------- |
| GET | `/api/horoscope/:id` | — | `calculatedDetails.wargaKendara` (object keyed `d1`/`d9`/`suryaLagna`/`chandraLagna`; `null` entry = not derivable) — absent on legacy docs (client falls back) |
| GET | `/api/share/:token` | — | `calculatedDetails.wargaKendara` (same; share-link viewers see identical read-only content per US-WK-013) |

No mutation endpoint. No changes to `/api/search`, `/api/search/filter`, `/api/settings`, Shad Bala, Bhava Suchika or AstrologySettings routes.

## Dependencies

- No new npm packages.
- New files: `src/lib/wargaKendara.ts`; `src/components/wargaKendara/{WargaIndicationTags,WargaChartSection,WargaHousesTable,WargaPlanetsTable}.tsx`.
- Modified files: `src/lib/shadBalaya.ts` (export `computeDigBalaPlanets`), `src/lib/astrology.ts` (type only), `src/lib/calculation.ts`, `src/lib/manualChartDetails.ts`, `src/models/CalculatedDetails.ts`, `src/app/horoscopes/[id]/page.tsx`, `src/messages/en.json`, `src/messages/si.json`.
- Consumes existing: `getChartData` (`chartDataTransform.ts`), `computeMaranakaraka` (`astrology.ts`), `SIGN_LORD` (`manualChart.ts` / local copies), `shadbalaya` stored values for Cheshta/Kala flags.

## Migration / Compatibility

- **Legacy documents:** no migration/backfill. `resolveWargaKendara` derives entries at render time from always-stored D1 data (the Bhava Suchika / Shad Bala legacy pattern).
- **Breaking changes:** none — `wargaKendara` is an additive optional field; the calculations tab is untouched; the "Other charts" section reduction is client-only.
- **SavedFilter `visibleSections`:** BA Open Question 9 — old section keys (`drekkanaD3`, `dasamsaD10`, `shodashaVargas`, `chandraLagna`, `suryaLagna`) may reference sections that no longer exist on the detail page. Search result cards are **out of scope** (BA Out of Scope: "Search integration … search behaviour is unchanged"), so configs are left untouched unless PM decides to remap.
- **Manual `d9`:** manual horoscopes without entered Navamsa data store `d9: null` — renderer shows the existing placeholder, never an empty table.

## Security Considerations

- Read-only feature: no new mutation endpoints, no permission changes (US-WK-013). Own/public/share-link views all render from `calculatedDetails` served by the existing privacy-checked routes (`GET /api/horoscope/:id` owner/public filter; `GET /api/share/:token` token-expiry check).
- All values are numeric enums (Planet 1-9, ZodiacSign, PlanetaryStrength, houses 1-12) — no localized or free-form text is ever stored; display resolves per locale at render time.
- `wargaKendara` is pure derived data with no user input path — no payload validation surface beyond the existing manual-chart strict validation.
- No ephemeris call added to any render path (fallback is pure derivation from stored data) — no new CPU-cost/rate-limit surface.

## Verification

1. `pnpm build` — TypeScript compile (new `WargaKendara` types, `CalculationResult.wargaKendara`, exported `computeDigBalaPlanets`).
2. `npx jest` — existing tests pass; add unit tests for `computeWargaKendara`:
   - D1 entry equals the D1 houses/planets with D1-only flags mapped (fixture: `6a68e337150a9f9377fab96d` — D1 Saturn = Capricorn | Own Sign, shows Combust + Kala Bala; D9 Saturn = Cancer | Enemy).
   - D9 entry derives from navamsa signs; Surya/Chandra entries rotate correctly.
   - Maraka = chart's 2nd/7th lords; Maranakaraka/Dig Bala per chart; Rahu/Ketu never get Dig Bala.
   - Manual without Navamsa → `d9: null`; manual with Navamsa → real entry; `manualHousePlacements` untouched.
   - Legacy doc (no `wargaKendara`) → `resolveWargaKendara` derives; corrupt stored value → warn + fallback.
   - All 16 `VARGA_CATALOG` keys have `name`+`indication` in both `si.json` and `en.json` (parity test, mirroring the vocabulary test pattern).
3. Manual test scenarios:
   - Open an auto horoscope → tabs show D1+D9; select Surya Lagna → D1+Surya; D1 tab click is a no-op; navigate to another horoscope → resets to D9.
   - Per-chart tables under each figure; Nakshatra (Pada) + Bhava Suchika columns only on D1; no degree differences anywhere.
   - Manual horoscope with and without Navamsa data (placeholder path).
   - Legacy `CalculatedDetails` (strip `wargaKendara` in a dev DB) → tables still render.
   - Public horoscope + share link → identical read-only content; locale switch re-renders tables + indication tags immediately.

## Questions for other roles

- **UX** (next role): tab-strip + two-chart selection layout (D1 locked, second swappable) on desktop/mobile; placement/style of the main-indication tags beneath each chart caption; exact placement of per-chart tables under each figure. **Resolved (2026-08-15):** no reference table — each displayed chart shows its main indication as tag chips beneath the caption; D2–D60 are omitted entirely.
- **PM/Domain** (blocking for final rule confirmation, not for this design): per-chart Maraka/Maranakaraka rules (Open Questions 2–3), Dig Bala confirmation (Open Question 4), Yogakaraka/Nidhanamsha on the D1 per-chart table (Open Question 5), Sinhala strings for the 16 vargas (Open Question 7).
- **Developer**: the whole-sign conjunction/aspect rule for varga charts needs domain sign-off (Open Question 6) — the architecture implements the existing whole-sign diff rule so swapping to an orb-based rule is a one-function change; also confirm SavedFilter section-key handling (Open Question 9).
- **QA**: test matrix from BA — pair permutations (D1+D9, D1+Surya, D1+Chandra), D1 lock, manual with/without Navamsa, legacy fallback, read-only on public/share-link, locale switching, `6a68e337150a9f9377fab96d` fixture.

## Open Items and Assumptions

1. **Per-chart Maraka/Maranakaraka = existing rule re-evaluated per chart (ASSUMPTION)** — `computeWargaMaraka` (2nd/7th lords of the chart's lagna) and `computeMaranakaraka(chartPlanets, chartHouses)`. Single pure function so the rule can be swapped on domain confirmation. (Open Questions 2–3)
2. **Conjunctions = same whole-sign chart house; Aspects = existing whole-sign diff/special-aspect table** evaluated within each chart, stored without degree fields. (Open Question 6)
3. **D9 strength = stored `navamsaStrength`; rotated-chart strength = D1 strength** (rotation changes houses, not signs).
4. **Cheshta/Kala per-chart flags for D1** read the stored `shadbalaya` values (no new calculation); D1-only set per the feature doc's twelve items — Yogakaraka/Nidhanamsha inclusion pending Open Question 5.
5. **Selection state is client-side only**; resets to D9 per horoscope navigation (Open Question 8 — persistence deferred).
6. **ChartType enum deferred** — phase 2 adds D2–D60 values, Chart-doc creation, rendering and i18n in one place; the catalog + uniform per-chart structure make this additive (US-WK-009 edge case).
7. **Sinhala varga names/indications pending** — English fallback renders until provided (US-WK-012 edge case).
