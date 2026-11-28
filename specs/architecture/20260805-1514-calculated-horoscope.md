# Architecture — Calculated Horoscope (Manual Entry)

**Date:** 2026-08-05 15:14
**Author:** Architect
**Based on:** `specs/business-analysis/20260805-1514-calculated-horoscope.md`, `specs/business-analysis/actors.md`, `specs/business-analysis/data-model.md`, `src/app/api/horoscope/route.ts`, `src/models/Horoscope.ts`, `src/models/CalculatedDetails.ts`, `src/lib/astrology.ts`, `src/lib/astrologyEnums.ts`, `src/app/horoscopes/new/page.tsx`

---

## Overview

Students receive already-calculated horoscopes (printed charts) without birth information and want to enter them for study. This feature adds a **manual entry mode** to the Add Horoscope flow: the student enters a Lagna, places planets in the derived 12-house table, optionally enters the Navamsa Lagna, and the system validates placements, derives aspects/conjunctions, builds a planets table, and derives probable birth ranges (time, month, date, age).

Key architectural stance: **the house placements are the single source of truth.** All tables (house table, planets table, Navamsa table, validation state, derived ranges) are recomputed from it by pure derivation functions — never stored independently, never hand-edited.

## Non-Goals / Explicitly Out of Scope

- Ephemeris (Swiss Ephemeris) calculation for manual horoscopes — no dasha/varga calculation from birth details (none exist)
- D9/D3/D10 chart SVG rendering for manual horoscopes beyond the birth/navamsa charts that can be derived from sign data
- Qdrant/Gemini RAG changes — manual horoscopes reuse the existing search pipeline (`source` is added as a filterable field only)
- Back-filling/migration of existing horoscopes (they default to `source: "auto"`)

## Technology Decisions

| Decision | Choice | Justification |
|----------|--------|---------------|
| Derivation location | Pure TS module `src/lib/manualChart.ts`, shared client + server | The whole manual-chart derivation is deterministic and pure (whole-sign, mod-12 arithmetic) — no ephemeris, no I/O. A shared module lets the client preview instantly and the server persist on save, with one source of truth for logic. |
| Persistence | Reuse `Horoscope` + `CalculatedDetails` models with new optional fields | Follows the existing `{ id: UUID }` embedded-object and numeric-enum conventions; no new collections needed. |
| API surface | Extend `POST /api/horoscope` + new `PUT /api/horoscope/[id]/manual-chart` | Matches existing REST patterns (`POST` create, `PUT` update); keeps one create path that branches on `source`. |
| Configurable mapping tables | `src/lib/manualChart.ts` exports const tables | Birth-time, birth-month, birth-date, and age formulas are single-source-of-truth config tables (per BA business rules). |

## Module Design

### New module: `src/lib/manualChart.ts`

Pure functions, no I/O, no ephemeris. All operate on numeric enums (`Planet`, `ZodiacSign`, `Nakshatra`, `PlanetaryStrength`).

```ts
// Types
interface ManualHousePlacements {
    lagna: number;                       // ZodiacSign enum
    lagnaDegree?: number;                // ascendant degree within the lagna sign, [0,30); optional
    houses: ManualHouse[];               // always 12 entries
    navamsaLagna?: number;               // ZodiacSign enum, optional; required when navamsa houses present
    navamsaHouses?: ManualHouse[];       // navamsa chart house table, signs derived from navamsaLagna
    validation: PlacementValidation;
}

interface ManualHouse {
    houseNumber: number;                 // 1..12
    sign: number;                        // ZodiacSign enum (derived)
    planets: number[];                   // Planet enum values
    aspects: number[];                   // Planet enum values that aspect this house
}

interface PlacementValidation {
    budha: ValidationResult;
    sikuru: ValidationResult;
    rahuKethuAxis: ValidationResult;
}

interface ValidationResult {
    status: "valid" | "invalid" | "incomplete" | "skipped";
    message: string;
}

// Functions
deriveHouseSigns(lagna: number): number[];                 // whole-sign, mod-12
buildHouses(lagna: number, planetPlacements: Record<number, number>): ManualHouse[];
//   Navamsa house signs = deriveHouseSigns(navamsaLagna); navamsa has no aspects column
computeAspects(houseOfPlanet: Record<number, number>): Record<number, number[]>;
//   Mars 4/8/12, Jupiter 5/9/11, Saturn 3/7/10, Rahu/Ketu 5/9, others 7th-house
computeConjunctions(planetPlacements: Record<number, number>): Record<number, number[]>;
validatePlacements(placements): PlacementValidation;
//   Budha: |budhaHouse - raviHouse| in {0,1}; Sikuru: in {0,2}; Rahu/Ketu opposite houses (gap == 6 mod 12)
derivePlanetsTable(placements, navamsaHouses?): ManualPlanetRow[];
//   Planet, Sign (from house), Str, House, Conjunctions, Aspects, Other (lords)
deriveNavamsaData(planetSigns, planetNavamsaSigns): NavamsaEnrichment[];
//   Navamsa, Navamsa Str, Degree range (navamsa segment), Nakshatra/Pada from midpoint
deriveBirthTimeRange(raviHouse: number): { start: string; end: string };   // config table
deriveBirthMonthRange(raviSign: number): { start: {m,d}; end: {m,d} };     // config table
deriveBirthDateCandidates(raviNavamsaIndex: number): { navamsaIndex: number; candidateDay: number; reasoning: string }[];
//   base 12 + n*3, base 17 + n*7
deriveAgeRanges(shaniBirthNavamsa: number, currentShaniDegree: number, currentShaniSign: number, birthShaniSign: number): AgeRange[];
//   1st age months formula, 2nd/3rd +30yr
```

### Config tables (exported consts in `manualChart.ts`)

```ts
export const BIRTH_TIME_RANGES: Record<number, { start: string; end: string }> = {
    1: { start: "05:00", end: "07:00" }, 2: { start: "07:00", end: "09:00" },
    3: { start: "09:00", end: "11:00" }, 4: { start: "11:00", end: "13:00" },
    5: { start: "13:00", end: "15:00" }, 6: { start: "15:00", end: "17:00" },
    7: { start: "17:00", end: "19:00" }, 8: { start: "19:00", end: "21:00" },
    9: { start: "21:00", end: "23:00" }, 10: { start: "23:00", end: "01:00" },
    11: { start: "01:00", end: "03:00" }, 12: { start: "03:00", end: "05:00" },
};

export const BIRTH_MONTH_RANGES: Record<number, { start: { month: number; day: number }; end: { month: number; day: number } }> = {
    1: { start: { month: 4, day: 15 }, end: { month: 5, day: 15 } },   // Mesha
    2: { start: { month: 5, day: 15 }, end: { month: 6, day: 15 } },   // Wrushaba
    // ... continues per sign, +1 month, 15th-day anchor, wraps at Meena
};

export const BIRTH_DATE_BASE = { base1: 12, increment1: 3, base2: 17, increment2: 7 };
export const SHANI_MONTHS_FOR_SIGN = { default: 30, alternate: 27 };
```

## Data Flow

### Manual Horoscope Create Flow

```
Student → Add Horoscope → Select "Calculated Chart" mode →
  → Enter name + Lagna →
  → Place planets in the derived 12-house table (and optionally the Navamsa house table) →
  → POST /api/horoscope/manual { name, lagna, lagnaDegree?, houses, navamsaLagna, navamsaHouses } →
  ...
  → Server: getServerSession → connectDB →
    → Horoscope.create({ name, source: "manual" })   // birthDate (optional); birthTime/location absent
    → ManualChart.compute({ lagna, houses, navamsaLagna, navamsaHouses }) →
        houses, navamsaHouses, planetsTable, validation, derivedRanges
    → CalculatedDetails.create({ horoscope, manualHousePlacements, derivedRanges, ... })
    → Chart records for BIRTH and NAVAMSA only (derivable from sign data)
    → indexHoroscope(id) → Return horoscope + derived data (201) →
  → Client renders detail + derived tables from the response
```

### Birth Date Autofill Flow (optional, client-triggered)

```
Student (optional) enters Lagna + Birth date →
  → Client debounced POST /api/horoscope/manual/positions
      { date: "YYYY-MM-DD", lagna, navamsaLagna? } →            // no DB writes
  → Server: swisseph planets at 12:00 (Colombo tz, Lahiri), for the 9 planets:
      sign, degree, whole-sign house (from lagna), navamsa sign + navamsa house (from navamsaLagna)
  → Client auto-fills House Table & Navamsa House Table; user edits freely
  → Local validation flags any planet moved to a house ≠ computed value (amber •)
```

### Planet Placement Update Flow (client-driven, server-persisted)

```
Student edits house table (add/move/remove planet) →
  → Client recomputes instantly via shared manualChart.ts (houses, aspects, conjunctions, planets table, validation, derived ranges) →
  → Debounced PUT /api/horoscope/[id]/manual-chart { lagna, houses, navamsaLagna, navamsaHouses } →
  → Server validates session+owner → recomputes via manualChart.ts → updates CalculatedDetails.manualHousePlacements + derivedRanges →
  → Returns updated derivedRanges/validation → client reconciles
```

**Design note:** Client-side derivation gives an instant, interactive editor; the server re-derives on save so the DB is always consistent (server is source of truth, client preview is derived). Both use the identical shared module — no logic drift.

## API Contract

### New `POST /api/horoscope/manual`

Dedicated endpoint for creating a manually-entered (calculated) horoscope. Body contains ONLY the chart data:

```json
{
  "name": "Sample Chart",
  "lagna": 1,
  "houses": { "1": [1, 4], "4": [2] },
  "navamsaLagna": 7,
  "navamsaHouses": { "1": [1] }
}
```

Validation (server-side, mandatory):
- `name` required (string)
- `lagna` required (1–12, ZodiacSign enum)
- `lagnaDegree` optional — number in [0, 30); metadata only, drives client-side Navamsa-Lagna autofill; persisted in `manualHousePlacements`
- `houses` required — keys 1–12, values arrays of Planet enum (1–9); a planet appears at most once across all houses
- `navamsaLagna` optional — 1–12, ZodiacSign enum; required when `navamsaHouses` present; navamsa house signs derive whole-sign from it
- `navamsaHouses` optional — keys 1–12, values arrays of Planet enum; uses the same uniqueness rule within the navamsa chart

Server behavior:
- Creates `Horoscope` with `source: "manual"` (no birthDate/birthTime/location)
- Runs `ManualChart.compute()` to derive houses with signs, aspects, conjunctions, planets table, validation, and derived birth ranges
- Persists `CalculatedDetails` with `manualHousePlacements` + `derivedRanges` and BIRTH/NAVAMSA chart records
- Indexes for search

Response `201`:
```json
{
  "horoscope": { ... },
  "derivedRanges": { "birthTimeRange": {...}, "birthMonthRange": {...}, "birthDateCandidates": [...], "ageRanges": [...] }
}
```

Errors: `400` malformed body / invalid enums / duplicate planet, `401` no session.

### New `PUT /api/horoscope/[id]/manual-chart`

Request body:
```json
{
  "lagna": 1,
  "houses": { "1": [1, 4], "4": [2] },
  "navamsaLagna": 7,
  "navamsaHouses": { "1": [1] }
}
```

Validation: same as create + owner check (`horoscope.owner.id === session.user.id`).

Response `200`:
```json
{
  "manualHousePlacements": { "lagna": 1, "lagnaDegree": 12, "navamsaLagna": 7, "houses": [...], "navamsaHouses": [...], "validation": {...} },
  "derivedRanges": { "birthTimeRange": {...}, "birthMonthRange": {...}, "birthDateCandidates": [...], "ageRanges": [...] }
}
```

Errors: `400` malformed, `401` no session, `403` non-owner, `404` horoscope not found, `409` attempted on `source: "auto"` horoscope.

### Auth & privacy

- Same `getServerSession(authOptions)` pattern as all routes; owner check on update
- Manual horoscopes inherit all existing privacy/search/share behavior; `source` is additive

## Database Schema Changes

### `Horoscope` model (`src/models/Horoscope.ts`)

Add:
```
source: { type: String, enum: ["auto", "manual"], default: "auto" }
```

Relax: `birthDate`/`birthTime` no longer `required: true` (they become optional; manual horoscopes omit them). Add conditional schema behavior documented in the model comment.

### `CalculatedDetails` model (`src/models/CalculatedDetails.ts`)

Add:
```
manualHousePlacements: { type: Schema.Types.Mixed },   // ManualHousePlacements structure
derivedRanges: { type: Schema.Types.Mixed },            // DerivedRanges structure
```

Both optional; present only for `source: "manual"` horoscopes.

## UI Flow Sketch (for UX phase reference)

```
Add Horoscope page:
  [Mode toggle: Birth Details | Calculated Chart]
  ┌─ Calculated Chart mode ─────────────────────────────┐
  │ Name                                                │
  │ Lagna: [sign select ▼]                              │
  │                                                      │
  │ House Table (12 rows): House | Planets | Aspects    │
  │   [planet add chips per row, dropdown picker]       │
  │ Validation badges: Budha ✓  Sikuru ✗  Rahu-Ketu ⏳  │
  │                                                      │
  │ [Navamsa House Table — optional, entered directly]  │
  │   (12 rows: House | Planets, same planet picker)    │
  │                                                      │
  │ Planets Table: Planet|Sign|Str|House|Conj|Asp|Other │
  │                                                      │
  │ Derived Ranges:                                      │
  │   Birth time: 05:00–07:00                            │
  │   Birth month: April 15 – May 15                     │
  │   Birth dates: 12, 21                                │
  │   Ages: 1st 4y 2nd 34y 3rd 64y                       │
  │ [Save] [Save & Continue editing]                     │
  └──────────────────────────────────────────────────────┘
```

## Component Design (for UX phase reference)

| Component | File (proposed) | Purpose |
|-----------|-----------------|---------|
| `ManualChartEditor` | `src/components/ManualChart/ManualChartEditor.tsx` | Client editor orchestrating all sub-panels |
| `HouseTableEditor` | `src/components/ManualChart/HouseTableEditor.tsx` | 12-row editable house table with planet picker |
| `PlanetPicker` | `src/components/ManualChart/PlanetPicker.tsx` | Dropdown of unplaced planets (EN/SI names) |
| `ValidationBadges` | `src/components/ManualChart/ValidationBadges.tsx` | Per-rule validation feedback |
| `PlanetsTable` | `src/components/ManualChart/PlanetsTable.tsx` | Derived planets table (birth + navamsa enriched) |
| `NavamsaSection` | `src/components/ManualChart/NavamsaSection.tsx` | Optional Navamsa house table editor (entered directly, no Lagna input needed) |
| `DerivedRanges` | `src/components/ManualChart/DerivedRanges.tsx` | Birth time/month/date/age range display |

Detail-page integration: on a `source: "manual"` horoscope, the Charts tab shows birth + navamsa charts (derivable); Dashas tab shows the existing "not available" empty state; a new "Manual Chart" edit entry point is added.

## Edge Cases

| Case | Handling |
|------|----------|
| Planet placed twice | Rejected at picker level; server 400 on duplicate planet |
| Ravi not placed | Budha/Sikuru validation `status: "skipped"` with hint |
| Rahu or Ketu missing | Axis validation `status: "incomplete"` |
| House wrap (Ravi in 12) | mod-12 arithmetic everywhere |
| No degree data | Degree range derived from Navamsa segment midpoint; Nakshatra/Pada from midpoint |
| Age formula negative intermediate | Clamp to 0 months + warning flag |
| Edit after save | Client recomputes from stored placements; PUT persists |
| Existing `source: "auto"` horoscopes | Unaffected — new fields absent |
| Legacy `birthDate` required check | Migration note: existing docs already have birthDate; schema relaxation is additive-safe |

## Security

- Owner-only writes via session check on PUT (same pattern as `PATCH /api/horoscope/:id/privacy`)
- Manual chart payload validated strictly (numeric enums, house range, no duplicates) server-side — client-side picker is UX, not security
- No user-controlled degree input accepted for birth-range derivation beyond the navamsa index (matches the existing "no time-manipulation" stance — derived ranges are read-only outputs)
- No PII introduced; manual charts follow existing privacy/search/share rules

## Testing Strategy Pointer

- Pure derivation functions in `manualChart.ts` are fully unit-testable (no I/O): house derivation, aspect rules, validation rules, all config-table lookups, navamsa enrichment, and every birth-range formula
- API tests: POST manual create, PUT manual-chart (owner/403/404/409), validation errors
- No ephemeris mocking needed for the derivation itself — see QA spec for the full matrix
