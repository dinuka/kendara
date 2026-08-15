# Bhava Suchika (භාව සුචික) — Navamsa House Index: Architecture Specification

**Date:** 2026-08-14 21:27
**Status:** Draft
**Author:** Architect (BMAD)
**Source:** `docs/bhava-suchika.md`, `specs/business-analysis/20260814-2055-bhava-suchika.md` (US-BS-001…008), `specs/business-analysis/data-model.md` → [Bhava Suchika (House Index)](#bhava-suchika-house-index)
**Related:** `20260813-2011-shadbalaya-architecture.md` (template precedent: pure shared module + persisted derived values), `20260812-2200-system-astrology-settings.md` (recalculation job — no overrides to preserve here)

---

## Overview

භාව සුචික නවාංශක ක්‍රමය adds the **"house index" of a point** (the Lagna or a planet) to the calculations tab: take the point's Navamsa (D9) sign, find which house that sign occupies in the Lagna (D1) chart — that house number (1-12) is the point's Bhava Suchika. Equivalently:

```
Bhava Suchika = ((navamsaSign − lagnaSign) mod 12) + 1     // whole-sign counting, 1-12
```

- **Lagna:** the Navamsa sign is the sign of the 1st house of the Navamsa chart (auto: the D9 ascendant sign; manual: the entered `navamsaLagna`).
- **Planets:** the Navamsa sign is the planet's sign in the D9 chart (auto: the computed `planet.navamsaSign`; manual: derived from the entered Navamsa chart). All 9 planets including Rahu/Ketu receive a value.
- **Display:** the Lagna value renders in the Lagna section alongside Wargoththama/Gandamula/Pushkara; each planet's value renders in a new column of the planets table in the calculation tab. The 12 house-index names resolve per locale via i18n. The values are **also mirrored on the search result cards** (Lagna tag + per-planet values) and **usable in search queries** (US-BS-008).
- **Persistence:** values are computed at calculation time and stored on `CalculatedDetails` (`lagnaBhavaSuchika` + `bhavaSuchika`), recomputed by the AstrologySettings full recalculation job, with a render-time pure-function fallback for legacy documents. There are **no user overrides** — read-only everywhere.

This spec covers: the calculation rule and its code-grounded sources, the data model, the new pure calculation module, both pipelines (auto/manual), the recalculation integration, the render-layer anchors, the search integration (queries + result cards), i18n, API impact, migration, security, and verification. It also resolves the BA open questions (OQ1–OQ7 from `20260814-2055-bhava-suchika.md`).

## Goals / Non-Goals

### Goals

- Compute and persist `lagnaBhavaSuchika` (Integer 1-12) and `bhavaSuchika` (`Record<"1"…"9", 1-12>`) on `CalculatedDetails` for both `source: "auto"` and `source: "manual"` horoscopes (manual only when Navamsa data has been entered).
- Render the Lagna value alongside the existing ascendant tags and a per-planet value column in the calculation tab, bilingual via i18n, read-only.
- Survive the AstrologySettings full recalculation (no `overridden` state — always recomputed).
- Render correct values for legacy documents via a pure render-time fallback (no migration/backfill).
- Make Bhava Suchika **searchable** (Lagna + per-planet, by house-index name or number, bilingual) and **mirror the values on search result cards** (US-BS-008).

### Non-Goals (v1)

- **No user overrides/editing** — no toggles, no PATCH endpoint (unlike Shad Bala).
- **No chart rendering changes** — values appear in the Lagna section, planets table, and search result cards only.
- **No new search UI or search route** — search matching reuses the existing grammar (`src/app/api/search/route.ts`), vocabulary (`src/lib/search/vocabulary.ts`), and result-card layout (`src/app/search/page.tsx`).
- No changes to Shad Bala, Wargoththama/Gandamula logic, aspects, or dashas.

## System Context

```
┌─────────────────────────── calculation pipeline (server) ───────────────────────────┐
│  src/lib/calculation.ts: calculateHoroscope()          src/lib/manualChartDetails.ts │
│    → ascSign, ascDegree (D1)                             → synthesizeCalculation()     │
│    → houses[].sign (whole-sign, D1)                      → synthesizePlanets()         │
│    → planets[].navamsaSign (D9, per planet)              → manualHousePlacements:      │
│    → (D9 lagna derived inline:                            navamsaLagna / navamsaHouses │
│       navamsaSign(ascSign, floor(ascDegree/(30/9))+1))                                 │
└──────────────────────────────────┬────────────────────────────────────────────────────┘
                                   │  NEW: src/lib/bhavaSuchika.ts (pure, no ephemeris, no I/O)
                                   ▼
                    lagnaBhavaSuchika: number, bhavaSuchika: Record<"1".."9", number>
                                   │
              ┌────────────────────┼──────────────────────────┐
              ▼                    ▼                          ▼
   CalculatedDetails (Mongo)   recalculationJob.ts      render fallback (pure, same module)
   spread via ...calculated    (recomputes, no           page.tsx / search page — legacy docs
   (api/horoscope/route.ts)    overrides to merge)       missing the fields derive at render
```

The feature is a thin pure-derivation layer: every input (D1 lagna sign, whole-sign D1 house signs, per-planet Navamsa signs) is **already produced and stored** by the existing pipelines. No new data sources, no new services, no new dependencies, no new API routes.

## Architecture Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| D1 | **D9 lagna sign source (auto)** — BA OQ6 | Derive inline from the already-computed ascendant: `navamsaSign(ascSign, Math.floor(ascDegree / (30/9)) + 1)` — the **same expression already used 5× in the auto pipeline** (`computeAscendantWargoththama`, `computeAscendantPushkara`, `computeNavamsaLord`, `computeNidhanamsha`, `computeAshtamansha` — `calculation.ts:504-505, 522-523, 558-559, 592-593, 605-606`). **Never read from the `navamsa-d9` Chart document.** | Alternatives evaluated: (a) read the persisted `navamsa-d9` Chart doc — **rejected**: `Chart.data` is a generic `Mixed` rendering blob (`src/models/Chart.ts`), not a calculation input, and adds I/O + a second source of truth; (b) re-run the ephemeris — **rejected**: breaks the render-time fallback's purity (no ephemeris at render) and duplicates work. The inline derivation is deterministic, pure, and consistent with what the D9 chart SVG is rendered from. |
| D2 | **House mapping** — BA OQ2 | Whole-sign. `houses[].sign` is whole-sign **by construction**: `houseSign = ((ascSign - 1 + i) % 12) + 1` (`calculation.ts:325`, with the comment at 321-324 explicitly forbidding cusp midpoints for sign/lord assignment). The formula `((navamsaSign − lagnaSign) mod 12) + 1` is therefore exact — no cusp-split logic. | Alternatives evaluated: cusp-boundary house lookup via `findHouse()` — **rejected**: `findHouse` (`astrology.ts:283-293`) answers "which house contains this longitude" (used for planet-in-house on unequal cusps), not "which house owns this sign". Whole-sign is both the documented intent (`docs/bhava-suchika.md`) and the existing `houses[].sign` semantics. |
| D3 | **Persistence model** — BA OQ3 | Computed at calculation time and **persisted** (`lagnaBhavaSuchika` + `bhavaSuchika` on `CalculatedDetails`), recomputed by the recalculation job, with a **render-time pure-function fallback** for legacy docs. No overrides. | Follows the `yogakaraka`/`maranakaraka`/`wargoththamaPlanets` precedent. Persistence is nearly free: `ICalculatedDetails extends CalculationResult` (`src/models/CalculatedDetails.ts:6`) and auto-create persists via `CalculatedDetails.create({ horoscope: { id }, ...calculated })` (`src/app/api/horoscope/route.ts:80-83`) — adding fields to the `CalculationResult` return object (assembled at `calculation.ts:443-474`) stores them automatically. Alternatives: compute-only at render — **rejected** (inconsistent with the derived-value precedent, loses cross-session consistency); persist + backfill migration — **rejected** (render fallback makes it unnecessary, matching the `computeAscendantSpecialFlags` precedent). |
| D4 | **Module placement** | New pure shared module `src/lib/bhavaSuchika.ts`, consumed by the auto engine, the manual synthesizer, the render fallback, and the recalculation job. | Mirrors `src/lib/shadBalaya.ts` exactly (pure module, no ephemeris, no I/O). Alternatives: inline in `calculation.ts` — **rejected** (would force the render layer to import the whole calculation engine for the fallback); extend `shadBalaya.ts` — **rejected** (different domain, no override/merge semantics). |
| D5 | **Manual gating** — BA OQ3 | Lagna value computed iff entered Navamsa data exists; per-planet values iff `navamsaHouses` entered. Partial-input matrix in [Data Flow → Manual](#manual-horoscope-flow) below. | US-BS-006; the UI already requires selecting a Navamsa Lagna before entering navamsa placements (`20260805-1514-calculated-horoscope.md`), so the only realistic state is "no navamsa data" (both omitted) or "full navamsa data" (both present). The gating also protects against the `synthesizePlanets` navamsa-sign fallback `row.navamsa?.navamsaSign ?? row.sign` (`manualChartDetails.ts:173`) which would otherwise produce birth-sign-derived (wrong) values. |
| D6 | **Search text** — BA OQ7 | **Added** to `src/lib/search/textContent.ts` in both languages (SI + EN), guarded like the `Maranakaraka`/`Yogakaraka`/`Wargoththama planets` lines (`textContent.ts:77-96, 175-194`), so vector/embedding search surfaces Bhava Suchika matches. | US-BS-008 AC5 (product owner decision 2026-08-14): Bhava Suchika is a first-class search facet. The text is pure strings derived from already-stored numeric values — zero I/O cost, and the existing `generateTextContent` call sites (indexer/embedding) pick it up automatically. |
| D7 | **Search-page mirroring** — BA OQ5 | **Mirrored** onto search result cards (`src/app/search/page.tsx`): the Lagna block gains the Bhava Suchika tag alongside the existing flags, and each planet row shows the per-planet value — same position/format as the calculation tab. | US-BS-008 AC3 (product owner decision 2026-08-14). The card already mirrors the Lagna flags via `computeAscendantSpecialFlags` (`search/page.tsx:778-824`) and per-planet rows exist, so this is an additive render change reusing the same `resolved*` resolution the detail page uses. |
| D8 | **API surface** | **No new or changed routes.** No mutation endpoint. Existing responses grow additively (the new fields ride along in `calculatedDetails`). | Read-only derived values — the same auth surface as any other `CalculatedDetails` field; adding a mutation endpoint would contradict US-BS-007 AC4. |
| D9 | **Consolidate D9-lagna derivation** | Export `computeNavamsaLagnaSign(ascSign, ascDegree)` from `src/lib/bhavaSuchika.ts` (same formula as the 5 existing inline sites) and use it for the new computation; optionally refactor the 5 existing call sites to it (non-breaking, cosmetic). | The identical `navamsaSign(ascSign, Math.floor(ascDegree / (30/9)) + 1)` expression is currently duplicated 5× — a latent drift risk; the new feature needs the same value and should not add a 6th copy. Refactor of the existing sites is optional and out of the critical path. |

## Data Model

Storage lives on `CalculatedDetails` per `data-model.md` → [Bhava Suchika (House Index)](#bhava-suchika-house-index):

```json
{
  "lagnaBhavaSuchika": 7,
  "bhavaSuchika": {
    "1": 2, "2": 7, "3": 10, "4": 5, "5": 12,
    "6": 1, "7": 3, "8": 6, "9": 11
  }
}
```

- `lagnaBhavaSuchika`: Integer 1-12. The D1 house of the Navamsa Lagna sign.
- `bhavaSuchika`: Record keyed by numeric `Planet` enum string `"1"`…`"9"` (the `planetaryOrbs`/`shadbalaya` Record convention), each value 1-12.
- Only the numeric house index is stored — the 12 display names are resolved per locale at render, never stored as localized text.
- **Absent** on manual horoscopes without entered Navamsa data; **absent** on legacy documents (render fallback covers those).

### Calculation rule (canonical)

- `lagnaBhavaSuchika = ((navamsaLagnaSign − lagnaSign) mod 12) + 1`
  - auto: `navamsaLagnaSign = navamsaSign(lagnaSign, Math.floor(lagnaDegree / (30/9)) + 1)` (D9 ascendant sign)
  - manual: `navamsaLagnaSign =` entered `manualHousePlacements.navamsaLagna` (when present)
- `bhavaSuchika[planet] = ((planet.navamsaSign − lagnaSign) mod 12) + 1` for each of the 9 planets
  - auto: `planet.navamsaSign` (computed at `calculation.ts:352-353, 366`)
  - manual: the planet's navamsa sign from the entered Navamsa chart (surfaced on the synthesized planets, `manualChartDetails.ts:173`)
- Sanity: a Wargoththama planet (`sign === navamsaSign`) has `bhavaSuchika[planet] === its D1 house`; a Navamsa Lagna equal to the D1 Lagna gives `lagnaBhavaSuchika === 1` (ලග්නාංශකය).

### Mongoose schema (`src/models/CalculatedDetails.ts`)

Add to the existing schema (mirrors the `shadbalaya` Map convention introduced in `20260813-2011-shadbalaya-architecture.md`):

```ts
lagnaBhavaSuchika: { type: Number, required: false },       // 1-12; absent on manual w/o navamsa data
bhavaSuchika: { type: Map, of: Number, default: {} },       // "1".."9" -> 1-12
```

The `ICalculatedDetails extends CalculationResult` type picks up the fields automatically once `CalculationResult` is extended (see below). Both fields are optional — old documents simply lack them.

### Shared type changes (`src/lib/astrology.ts` → `CalculationResult`, line 453)

Add, following the existing `shadbalaya?: ShadBalaya` optional-field-with-legacy-comment precedent (line 484-486):

```ts
/** Bhava Suchika (භාව සුචික) of the Lagna — the D1 house (1-12) of the Navamsa Lagna sign. Optional
 *  because legacy CalculatedDetails documents predate the field and are lazily recomputed at render;
 *  also absent on manual horoscopes without entered Navamsa data (see src/lib/bhavaSuchika.ts). */
lagnaBhavaSuchika?: number;
/** Per-planet Bhava Suchika (භාව සුචික) — Record keyed by numeric Planet enum string ("1".."9"),
 *  each value the D1 house (1-12) of that planet's Navamsa sign. Same optionality as the Lagna value. */
bhavaSuchika?: Record<string, number>;
```

## Component Design

### `src/lib/bhavaSuchika.ts` — pure calculation module (NEW)

- **Location:** `src/lib/bhavaSuchika.ts`
- **Responsibility:** deterministic, pure, I/O-free computation of both Bhava Suchika values from already-stored inputs. No ephemeris, no MongoDB — safe to run server-side at calculation time and client-side at render (legacy fallback), mirroring `src/lib/shadBalaya.ts`.
- **Interfaces:**

```ts
/** D9 (Navamsa) Lagna sign from the D1 ascendant sign + degree-in-sign (3°20' wedges). Same
 *  expression as the 5 existing inline sites in calculation.ts — single source of truth (D9). */
export function computeNavamsaLagnaSign(ascSign: number, ascDegree: number): number;

/** Lagna's Bhava Suchika: the D1 house (1-12) of the Navamsa Lagna sign. */
export function computeLagnaBhavaSuchika(lagnaSign: number, navamsaLagnaSign: number): number;

/** A planet's Bhava Suchika: the D1 house (1-12) of its Navamsa sign. */
export function computePlanetBhavaSuchika(navamsaSignValue: number, lagnaSign: number): number;

/** All 9 planets' Bhava Suchika, keyed by numeric Planet enum string ("1".."9"). */
export function computeBhavaSuchika(
    planets: Array<Pick<Planet, "name" | "navamsaSign">>,
    lagnaSign: number,
): Record<string, number>;
```

- **Data:** reads only `Planet`/`ZodiacSign` numeric enums from `src/lib/astrology.ts` types. No schema references beyond `CalculationResult`.

### `src/lib/calculation.ts` — auto pipeline (MODIFY)

- **Location:** `src/lib/calculation.ts` (`calculateHoroscope`, result assembled at lines 443-474)
- **Change:** compute both values just before the `return { ... }` and add them to the returned `CalculationResult`:

```ts
// after planetDetails / ascSign / houses exist (same scope as the shadbalaya compute at 436-441):
const lagnaBhavaSuchika = computeLagnaBhavaSuchika(
    ascSign,
    computeNavamsaLagnaSign(ascSign, ascLong % 30),
);
const bhavaSuchika = computeBhavaSuchika(planetDetails, ascSign);
// ...in the return object (443-474), alongside shadbalaya (463):
lagnaBhavaSuchika,
bhavaSuchika,
```

- Persistence is automatic via the `...calculated` spread in `POST /api/horoscope` (`route.ts:80-83`) and via `startRecalculation` (see below).

### `src/lib/manualChartDetails.ts` — manual pipeline (MODIFY)

- **Location:** `src/lib/manualChartDetails.ts` (`synthesizeCalculation`, lines 184-229)
- **Change:** gate on entered Navamsa data, then compute from the synthesized planets + D1 lagna:

```ts
const { manualHousePlacements } = result;
// Lagna value: only when a Navamsa chart was entered (navamsaLagna present, or navamsaHouses
// whose house-1 sign implies it). Per-planet values: only when navamsaHouses entered.
const navamsaDataEntered = !!manualHousePlacements.navamsaLagna ||
    (!!manualHousePlacements.navamsaHouses && manualHousePlacements.navamsaHouses.length > 0);
const lagnaBhavaSuchika = manualHousePlacements.navamsaLagna
    ? computeLagnaBhavaSuchika(lagna, manualHousePlacements.navamsaLagna)
    : undefined;
const bhavaSuchika = navamsaDataEntered
    ? computeBhavaSuchika(planets, lagna)
    : undefined;
// ...add both to the return object (206-228), alongside shadbalaya (221)
```

- Note: `synthesizeNavamsaCalculation` (line 233) is unaffected — Bhava Suchika is a D1-chart value, not a D9-chart value; it must **not** be added to the Navamsa (D9) CalculationResult.

### `src/models/CalculatedDetails.ts` — Mongoose schema (MODIFY)

- Add the two schema fields shown in [Data Model](#data-model). No index changes (no query filters on these fields).

### `src/app/horoscopes/[id]/page.tsx` — render anchors (MODIFY)

- **Lagna section** (anchor: the ascendant-tags IIFE at lines 1245-1310, where `recomputedAscFlags` is derived):
  - Add `resolvedLagnaBhavaSuchika` next to the flag resolution:
    ```ts
    const resolvedLagnaBhavaSuchika =
        calculatedDetails.lagnaBhavaSuchika ??
        computeLagnaBhavaSuchika(
            calculatedDetails.ascendant.sign,
            computeNavamsaLagnaSign(calculatedDetails.ascendant.sign, calculatedDetails.ascendant.degree),
        );
    ```
  - Render it alongside the existing `ascTags` (US-BS-001): label + name resolved via `t(\`astrology.bhavaSuchika.names.${resolvedLagnaBhavaSuchika}\`)`. Exact tag style/placement → UX (see Open Questions).
  - **Manual-without-navamsa-data:** omit — the resolution must gate on `horoscope.source === "manual"` and the absence of `calculatedDetails.manualHousePlacements.navamsaLagna`/`navamsaHouses` (US-BS-006 AC3; the stored fields are simply absent, so the `??` fallback must not fire for that case — gate the fallback accordingly).
- **Planets table** (two render sites — the "table" is a vertical flex list of rows on mobile plus a `<table>` on desktop/tablet):
  - **Desktop/tablet table:** insert a new `<th>` after the Nakshatra header (lines 1484-1486) and a matching `<td>` after the Nakshatra cell (lines 1640-1643) — i.e. the new column sits between Nakshatra and Conjunctions (per the product owner's explicit requirement).
  - **Mobile card:** after the Nakshatra span (lines 1839-1841, `{getNakshatraName(p.nakshatra) || p.nakshatra} ({p.pada})`), add:
    ```ts
    <span className="text-gray-600 whitespace-nowrap">
        {resolvedBhavaSuchika[p.name]
            ? `${resolvedBhavaSuchika[p.name]} — ${t(`astrology.bhavaSuchika.names.${resolvedBhavaSuchika[p.name]}`)}`
            : "\u2014"}
    </span>
    ```
  - where `resolvedBhavaSuchika` is `calculatedDetails.bhavaSuchika` merged with per-planet fallback `computePlanetBhavaSuchika(p.navamsaSign, calculatedDetails.ascendant.sign)` for legacy docs (auto only; manual gated on entered navamsa data). Exact column position/format → UX (see Open Questions).

### i18n — `src/messages/en.json` + `src/messages/si.json` (MODIFY)

Add under the existing `astrology` namespace (keep both files in sync — US-BS-005 AC2):

| Key | EN | SI |
|-----|----|----|
| `astrology.bhavaSuchika.label` | Bhava Suchika | භාව සුචික |
| `astrology.bhavaSuchika.names.1` | Lagnamshaka | ලග්නාංශකය |
| `astrology.bhavaSuchika.names.2` | Dhanamshaka | ධනාංශකය |
| `astrology.bhavaSuchika.names.3` | Vikramamshaka | වික්‍රමාංශකය |
| `astrology.bhavaSuchika.names.4` | Sukhamshaka | සුඛාංශකය |
| `astrology.bhavaSuchika.names.5` | Purvapunyamshaka | පූර්වපුන්‍යාංශකය |
| `astrology.bhavaSuchika.names.6` | Shashthamshaka | ශෂ්ඨාංශකය |
| `astrology.bhavaSuchika.names.7` | Saptamamshaka | සප්තමාංශකය |
| `astrology.bhavaSuchika.names.8` | Nidhanamshaka | නිධානාංශකය |
| `astrology.bhavaSuchika.names.9` | Bhagyamshaka | භාග්‍යාංශකය |
| `astrology.bhavaSuchika.names.10` | Abhimanamshaka | අභිමානාංශකය |
| `astrology.bhavaSuchika.names.11` | Labhamshaka | ලාභාංශකය |
| `astrology.bhavaSuchika.names.12` | Vyamshaka | ව්‍යාංශකය |

SI names are authoritative (from `docs/bhava-suchika.md`); EN are proposed transliterations pending domain confirmation (BA OQ1). No hardcoded strings in components — names resolve from the numeric value via `t(...)`.

### `src/lib/search/vocabulary.ts` — search vocabulary (MODIFY)

- **Location:** `src/lib/search/vocabulary.ts`
- **Change:** add the Bhava Suchika search terms so query parsing can recognise them:
  - `BHAVA_SUCHIKA_WORDS`: trigger words — `"භාව සුචික"` (SI), `"bhava suchika"` (EN), plus aliases `"house index"`, `"නිවාස දර්ශක"` (optional).
  - `BHAVA_SUCHIKA_NAMES_SI` / `BHAVA_SUCHIKA_NAMES_EN`: the 12 house-index names in each language (`ලග්නාංශකය`…`ව්‍යාංශකය` / `Lagnamshaka`…`Vyamshaka`), keyed by house index 1-12 — matching the i18n table above.
- **Data:** plain string maps, consistent with the existing `PLANET_ROLE_WORDS`/`SINHALA_YOGA` pattern in the file.

### `src/app/api/search/route.ts` — search query handling (MODIFY, internal only)

- **Location:** `src/app/api/search/route.ts` — **route signature unchanged** (D8; US-BS-008 Business Rule "no new route").
- **Change (new exact condition):**
  ```ts
  type ExactCondition =
      | ...
      | { type: "bhava_suchika"; value: number }                    // Lagna Bhava Suchika = value
      | { type: "planet_bhava_suchika"; planet: number; value: number };
  ```
  - Detection: if the clause mentions a Bhava Suchika trigger word or any house-index name, resolve the house index (1-12) from the name/number, then:
    - a bare name/number (no planet) → `bhava_suchika` (Lagna value)
    - a planet name paired near the value → `planet_bhava_suchika` (mirrors `getPlanetStrengthPairs` pairing logic)
  - Scoring (`scoreHoroscope`): `+1.0` when the resolved Lagna value matches the stored/derived `lagnaBhavaSuchika`; `+0.5` per planet whose `bhavaSuchika[planet]` matches (reusing the same resolution as the render layer).
  - Keywords (`getAstroKeywords`): push `bhava_suchika` / `planet_bhava_suchika` so `queryUnderstanding.conditions` reports the intent.
- **Edge cases:** manual charts without Navamsa data simply never match (no stored/derived value); out-of-range input (e.g. `bhava suchika 13`) yields no condition; comma-groups / හෝ clauses follow the existing grammar.

### `src/lib/search/textContent.ts` — search text content (MODIFY)

- **Location:** `src/lib/search/textContent.ts`
- **Change:** append guarded lines in both `textPartsEn` (after the Wargoththama/Yogakaraka lines, ~line 108) and `textPartsSi` (~line 202), following the guarded optional-field precedent:
  ```ts
  // EN:  `Lagna Bhava Suchika: Saptamamshaka (7). Jupiter Bhava Suchika: Labhamshaka (11). ...`
  // SI:  `ලග්න භාව සුචික: සප්තමාංශකය (7). ගුරු භාව සුචික: ලාභාංශකය (11). ...`
  ```
  - Values resolve from `calc.lagnaBhavaSuchika` / `calc.bhavaSuchika` (optional fields — guard the read like `calc.yogakaraka`), and **fall back to the pure functions** (`computeLagnaBhavaSuchika`/`computePlanetBhavaSuchika`) so legacy docs still produce search text (US-BS-008 AC5/AC6).
  - House-index names come from a shared `BHAVA_SUCHIKA_NAMES_EN/SI` map (reuse the vocabulary maps rather than duplicating the i18n table).

### `src/app/search/page.tsx` — search result cards (MODIFY)

- **Location:** `src/app/search/page.tsx` — Lagna block (`search/page.tsx:775-830`) and the per-planet rows.
- **Change (US-BS-008 AC3):** resolve the values exactly like the detail page (stored `??` pure fallback, gated for manual-without-navamsa), then:
  - Lagna block: add the Bhava Suchika tag alongside the flags computed by `computeAscendantSpecialFlags` (same tag styling as the detail page).
  - Planet rows: add the `n — name` value in the same position as the calculation tab (after Nakshatra).

## Data Flow

### Auto horoscope flow

```
POST /api/horoscope (birth details)
  → getServerSession → connectDB → Horoscope.create
  → calculateHoroscope(horoscope, settings)              // calculation.ts:242
      → ascSign/ascDegree, houses[].sign (whole-sign), planets[].navamsaSign
      → NEW: lagnaBhavaSuchika = computeLagnaBhavaSuchika(ascSign, computeNavamsaLagnaSign(ascSign, deg))
             bhavaSuchika      = computeBhavaSuchika(planetDetails, ascSign)
      → return CalculationResult (443-474, + 2 fields)
  → CalculatedDetails.create({ horoscope: { id }, ...calculated })   // route.ts:80-83 — fields persisted
  → chart docs + indexHoroscope (unchanged)
```

### Manual horoscope flow

```
POST /api/horoscope/manual | PUT /api/horoscope/[id]/manual-chart  (payload already carries
    lagna, houses, navamsaLagna, navamsaHouses — NO request change)
  → synthesizeCalculation(result)                        // manualChartDetails.ts:184
      → synthesizePlanets (planets carry navamsaSign from entered navamsa chart)
      → buildWholeSignHouses(lagna)
      → NEW (gated): navamsaLagna present  → lagnaBhavaSuchika
                      navamsa data entered → bhavaSuchika
      → else both undefined (omitted)
  → persist via ...spread (unchanged)
```

**Partial-input matrix (D5 / BA OQ3):**

| `navamsaLagna` | `navamsaHouses` | Lagna value | Per-planet values |
|----------------|-----------------|-------------|-------------------|
| absent | absent | omitted | omitted |
| present | absent | shown (from `navamsaLagna`) | omitted |
| absent | present (API edge — UI prevents this) | omitted | shown (per-planet from navamsa chart) |
| present | present | shown | shown |

### Recalculation flow (AstrologySettings full recalc — `src/lib/recalculationJob.ts`)

```
startRecalculation() → for each horoscope snapshot:
  source "auto"   → calculateHoroscope(...)          → new fields recomputed (no overrides to merge)
  source "manual" → compute + synthesizeCalculation  → new fields recomputed (gated as above)
  → CalculatedDetails.updateOne({ ...computed })     // fields land in every refreshed document
```

No `merge*` step is needed — unlike Shad Bala there is no `overridden` state (US-BS-007 AC2).

### Legacy-document render fallback

```
GET /api/horoscope/:id → CalculatedDetails without lagnaBhavaSuchika/bhavaSuchika
  → page.tsx Lagna section:  stored ?? computeLagnaBhavaSuchika(asc.sign, computeNavamsaLagnaSign(asc.sign, asc.degree))
  → page.tsx planets rows:   stored per-planet ?? computePlanetBhavaSuchika(p.navamsaSign, asc.sign)
  → manual w/o navamsa data: no fallback (fields gated off) — same pattern as getThithi /
    resolvedMaranakaraka / recomputedAscFlags (page.tsx:1247-1263)
```

### Search flow (queries + results)

```
POST /api/search { query }                                  // route unchanged (D8)
  → splitQueryGroups / splitQueryClauses (existing grammar)
  → getExactMatch(clause) NEW: detects bhava_suchika trigger / house-index names
      → { type: "bhava_suchika", value } or { type: "planet_bhava_suchika", planet, value }
  → getAstroKeywords(clause) NEW: pushes bhava_suchika intent
  → per horoscope:
      → stored/derived lagnaBhavaSuchika + bhavaSuchika (same resolution as render layer)
      → exact-match + scoreHoroscope bonuses (+1.0 Lagna, +0.5 per planet)
  → vector leg: textContent.ts now includes Bhava Suchika sentences (both languages)
      → embedding search also surfaces matches
  → response payload unchanged shape; matchedConditions may carry bhava_suchika entries
GET /api/search/suggestions, search page cards
  → search/page.tsx mirrors Lagna tag + per-planet values (US-BS-008 AC3)
```

## API Contracts

**No new routes, no route changes, no request-shape changes** (D8). The new fields ride along additively in `calculatedDetails` on existing responses:

| Method | Route | Request | Response impact |
| ------ | ----- | ------- | --------------- |
| POST | /api/horoscope | unchanged (birth details) | 201; stored `calculatedDetails` now includes `lagnaBhavaSuchika` + `bhavaSuchika` |
| POST | /api/horoscope/manual | unchanged (`{ name, lagna, houses, navamsaHouses }` — navamsa fields already in payload) | 201; derived fields present iff navamsa data entered |
| PUT | /api/horoscope/[id]/manual-chart | unchanged | 200; fields re-derived on every save |
| GET | /api/horoscope/:id | unchanged | 200; `calculatedDetails.lagnaBhavaSuchika` / `calculatedDetails.bhavaSuchika` present when stored; absent (or `—` in UI) on manual w/o navamsa data and legacy docs |
| PATCH | /api/horoscope/:id/shadbalaya | unchanged | unaffected — Bhava Suchika is never user-writable |
| POST | /api/search | **unchanged shape** — query parsing gains Bhava Suchika intents internally (D6/D7) | 200; `matchedConditions` may include `bhava_suchika` / `planet_bhava_suchika` entries; results ranked with Bhava Suchika matches |

No mutation endpoint exists or is planned (US-BS-007 AC4).

## Dependencies

- **New packages:** none.
- **External services:** none (pure arithmetic over already-stored numeric enums; no ephemeris, no I/O — explicitly matches the `shadBalaya.ts` contract).
- **New imports:** `computeLagnaBhavaSuchika`, `computePlanetBhavaSuchika`, `computeBhavaSuchika`, `computeNavamsaLagnaSign` from `@/lib/bhavaSuchika` in `calculation.ts`, `manualChartDetails.ts`, `page.tsx`, `search/page.tsx`, `search/textContent.ts`; `BHAVA_SUCHIKA_*` vocab maps in `search/route.ts`.

## Migration / Compatibility

- **Breaking changes:** none. Both new `CalculatedDetails` fields are optional; existing documents simply lack them.
- **No backfill job:** the render-time pure-function fallback covers legacy documents immediately (same decision as Shad Bala, `20260813-2011-shadbalaya-architecture.md` §Legacy documents).
- **Recalculation job:** fills the fields on the next full run for every snapshot — no data migration needed.
- **No index changes:** no query path filters on these fields.
- **Type flow:** `CalculationResult` gains two optional fields → `ICalculatedDetails` inherits them → Mongoose schema fields added explicitly → no runtime coercion needed; existing docs pass through `.lean()` without issue (absent fields stay absent).

## Security Considerations

- **No new attack surface:** no new endpoints, no user-supplied input for these fields (they are never accepted from clients — derived server-side only). Auth surface is identical to any read of `CalculatedDetails`.
- **Read-only everywhere:** own, public and share-linked views render the stored/derived values; there is nothing to mutate (US-BS-001 AC4, US-BS-007 AC4).
- **Data validation:** not applicable for writes (no write path). The computation clamps to 1-12 by construction (`mod 12` + 1).
- **Recalc job:** unchanged authorization model (admin-triggered); the new fields carry no PII and no additional blast radius.
- **i18n safety:** names resolve from the numeric value via message keys; a corrupt out-of-range stored value simply renders no name (guard the lookup), never throws.

## Verification

1. **TypeScript compile** — `pnpm build` passes: `CalculationResult`/`ICalculatedDetails` gain the optional fields; `bhavaSuchika.ts` imports resolve.
2. **Existing tests** — `npx jest` (incl. `src/__tests__/calculation.test.ts`) passes; no existing assertion depends on the exact shape of the `CalculationResult` return object.
3. **Unit (new, recommended)** — add `src/__tests__/bhavaSuchika.test.ts`:
   - `computeLagnaBhavaSuchika(1, 2) === 2` (Mesha lagna, Vrishabha navamsa lagna → ධනාංශකය — US-BS-003 AC1)
   - `computeLagnaBhavaSuchika(1, 1) === 1` (same sign → ලග්නාංශකය — AC2)
   - `computeLagnaBhavaSuchika(1, 12) === 12` (wrap-around → ව්‍යාංශකය — AC3)
   - `computePlanetBhavaSuchika(10, 1) === 10`; `computePlanetBhavaSuchika(6, 1) === 6` (US-BS-004 AC1)
   - Wargoththama invariant: planet with `sign === navamsaSign` in house `h` ⇒ `bhavaSuchika === h` (AC3)
4. **Manual end-to-end (auto):** create an auto horoscope → Lagna section shows the Bhava Suchika name; each planets-table row shows `n — name`; cross-check `((navamsaSign − lagnaSign) mod 12) + 1` against the stored fields and the `navamsa-d9` chart's ascendant sign.
5. **Legacy fallback:** `mongosh` — `db.calculateddetails.updateOne({}, { $unset: { lagnaBhavaSuchika: 1, bhavaSuchika: 1 } })` → page still renders identical values (render fallback), then run the recalculation job → fields are back, values unchanged.
6. **Manual e2e:** manual horoscope without navamsa data → both values omitted (blank cell / no tag); with navamsa data → values present and match the entered navamsa chart.
7. **i18n:** toggle locale (Sinhala ⇄ English) → names switch immediately via `useI18n()`; `si.json`/`en.json` key parity (US-BS-005 AC2/AC4).
8. **Search queries:** POST `/api/search` with `"භාව සුචික ලග්නාංශකය"`, `"bhava suchika bhagyamshaka"`, `"ලග්නාංශකය"`, `"bhava suchika 9"` returns horoscopes whose Lagna value matches, ranked first (US-BS-008 AC1); `"ගුරු භාව සුචික 11"` / `"Jupiter bhava suchika labhamshaka"` returns horoscopes where that planet matches (AC2); manual w/o navamsa never matches (AC6).
9. **Search results:** a search card renders the Lagna Bhava Suchika tag and per-planet values in the same format as the detail page (AC3); `queryUnderstanding.conditions` includes the `bhava_suchika` intent.
10. **Search text (vector leg):** `getTextForBothLanguages` output contains the Bhava Suchika sentences in both languages; embedding index regeneration picks them up (AC5).

## Traceability

| User story | Design elements |
|-----------|-----------------|
| US-BS-001 (Lagna section) | page.tsx Lagna-section anchor (1245-1310) + `resolvedLagnaBhavaSuchika`; i18n `astrology.bhavaSuchika.*` |
| US-BS-002 (planets column) | page.tsx planet-row span after Nakshatra (1839-1841) + desktop `<th>`/`<td>` after Nakshatra (1484-1486 / 1640-1643); stored `bhavaSuchika` + per-planet fallback |
| US-BS-003 (Lagna calculation) | `computeLagnaBhavaSuchika` + `computeNavamsaLagnaSign` (D1/D2/D9) |
| US-BS-004 (per-planet calculation) | `computeBhavaSuchika` / `computePlanetBhavaSuchika` (all 9 planets incl. Rahu/Ketu) |
| US-BS-005 (bilingual names) | i18n keys `astrology.bhavaSuchika.names.1..12` (si + en), numeric-enum storage only |
| US-BS-006 (manual behaviour) | `synthesizeCalculation` gating (D5) + partial-input matrix |
| US-BS-007 (storage/recalc/legacy) | `CalculationResult` fields → `...calculated` persist (route.ts:80-83); recalculationJob re-run (no merge); render-time fallback (D3) |
| US-BS-008 (search queries + results) | `search/route.ts` exact conditions + scoring (D6), `vocabulary.ts` maps, `textContent.ts` sentences (vector leg), `search/page.tsx` card mirror (D7) |

## Open Questions (resolved + deferred)

**Resolved by this spec (BA OQ2, OQ3, OQ5, OQ6, OQ7):**

1. **OQ6 — Auto D9 lagna source:** inline derivation from stored `ascSign` + `ascDegree` via `navamsaSign(ascSign, floor(ascDegree/(30/9))+1)`; never the `navamsa-d9` Chart doc (D1).
2. **OQ2 — Whole-sign vs cusp-split:** whole-sign (`houses[].sign`, by construction) — mod-12 formula is exact (D2).
3. **OQ7 — Search-text inclusion:** **added** to `textContent.ts` (SI + EN), guarded + fallback to the pure functions (D6) — product owner decision 2026-08-14.
4. **OQ3 — Partial-input matrix:** as tabulated in [Manual horoscope flow](#manual-horoscope-flow) (D5).
5. **OQ5 — Search-page mirroring:** **mirrored** onto search result cards (D7) — product owner decision 2026-08-14.

**Deferred to other roles (QA/PM/UX confirm):**

- **OQ1 — English names:** proposed transliterations used in the i18n table above; domain confirmation still required.
- **OQ4 — Column placement and cell format:** architect anchor = new span after the Nakshatra span (per the product owner's explicit requirement), format `"n — name"` per US-BS-002 AC2; exact styling/position and Lagna-section tag format left to UX.
