# Planet Aspects (දෘෂ්ඨි) Setting — Architecture Specification

**Date:** 2026-08-09 21:45
**Author:** Architect
**Based on:** `specs/business-analysis/20260809-2133-planet-aspects.md`, `specs/business-analysis/actors.md`, `specs/business-analysis/data-model.md`, `docs/aspects.md`, `src/lib/calculation.ts`, `src/lib/astrology.ts`, `src/lib/astrologyEnums.ts`, `src/lib/manualChart.ts`, `src/models/User.ts`, `src/app/api/settings/route.ts`, `src/app/api/horoscope/route.ts`, `src/app/api/horoscope/[id]/route.ts`, `src/app/api/horoscope/[id]/manual-chart/route.ts`

---

## 1. Overview

Today aspect calculation is driven by a fixed internal rule set:

- **Planet-to-planet aspects** (`src/lib/calculation.ts`): candidate angles are the hardcoded `ASPECT_TYPES = [0, 60, 90, 120, 180]`; an aspect is recorded when `degreeGap < 30` (a hardcoded orb, unrelated to the per-user `planetaryOrbs`).
- **House aspects** (`src/lib/manualChart.ts`): only manually-entered charts derive house aspects, from the hardcoded Vedic special-aspect table (currently `ASPECT_HOUSES`: Mars 4/8/12, Jupiter 5/9/11, Saturn 3/7/10, Rahu/Ketu 5/9, others → 7). Auto (`source: "auto"`) charts currently compute **no** house aspects at all. This feature introduces a new per-planet default aspect-houses table covering **all 9 planets** (SUN/MOON/SATURN 3,5,7,9,10; MARS/MERCURY 4,5,7,8,9; JUPITER/VENUS/RAHU/KETU 5,7,9 — see §6.1) that **replaces** this hardcoded default table.
- The per-user `planetaryOrbs` setting (stored on the `User` document, managed via `/api/settings`) is currently consumed **only** for combustion detection, not for aspect matching.

This feature introduces a second per-user setting, **"Planets Aspects houses and degrees"** (ප්ලැනට් ඇස්පෙක්ට්ස් හවුස් ඇන්ඩ් ඩිග්රීස්): per planet, the student configures which **houses** the planet aspects (1–12) and which **degree** angles are aspect candidates (multiples of 30 in 30–330). The configured degree angles drive both planet-to-planet matching and **degree-based house-aspect matching** (a planet aspects a house when one of its aspect points lands within the planet's orb of that house's middle degree); the configured `houses` list additionally marks houses as directly aspected. The calculation engine must use these configured values for **house aspects** and **planet aspects**, keep using the user's `planetaryOrbs` values as the orb tolerance, and fall back to the current defaults for planets with no entry — so the system behaves as today until a student customizes (see D4/AD-5 for the corrected hybrid). Both aspect mechanisms apply to **both** `source: "auto"` and `source: "manual"` charts — manual charts feed the same pure functions via each planet's stored or fallback-derived degree (`ManualHousePlacements.planetDegrees`, see §6.4) — per the 2026-08-11 clarification (US-PA-005/006, US-RA-004/005).

## 2. Non-Goals / Explicitly Out of Scope

- **No migration / backfill** of existing `CalculatedDetails` when the setting changes (matches the existing `planetaryOrbs` behavior — changing orbs today never rewrites stored charts).
- **No change to chart SVG rendering.** Verified: `chartRenderer.ts` / `chartDataTransform.ts` contain no aspect references — rendered charts are positional only (houses + planets at degrees). The setting alters aspect **data** (planets table, house aspect lists), not chart art.
- **No ephemeris recalculation at view time.** All view-time derivation is pure and ephemeris-free, from stored absolute degrees / house numbers.
- **No per-viewer recomputation** of aspects for public/shared horoscopes. Non-owner viewers receive the stored snapshot computed from the owner's setting at calculation time (identical to how `planetaryOrbs`-derived aspects behave today).
- **No global (cross-user) setting.**
- **No `degree ÷ 30` → house-number mapping** (`degree ÷ 30` is NOT used to translate a degree angle into a house number). Degree-based house aspects are matched instead by absolute longitude: aspect points derived from the configured `degrees` are compared against each house's absolute `middleDegree` within the planet's orb (see D4 / AD-5 / §6.2).
- **No backfill of per-planet degrees on manual charts**: legacy `source: "manual"` charts without `ManualHousePlacements.planetDegrees` are not migrated — the degree-based aspect arms (planet-to-planet, house-aspect degree arm, rashi degree + orb check) use each planet's deterministic **fallback degree** (navamsa segment midpoint when the planet's navamsa sign is recorded, else sign midpoint 15°) at calculation and view time (D3 / §11). Entered `planetDegrees` are honored when present.
- **Conjunction (0°)** is not configurable and remains computed separately (co-location within orb).

## 3. Design Decisions (BA Open Questions Resolved)

### D1. Per-user setting; owner-computed stored snapshot for shared horoscopes

**Decision: per-user**, stored as `User.planetAspects` (mirrors `planetaryOrbs`). The setting is applied at **calculation time** by the horoscope owner; the resulting aspects are stored in `CalculatedDetails`. Viewers of a public/shared horoscope (or share-link recipients) see the **stored snapshot as computed from the owner's setting** — the same semantics as today's `planetaryOrbs`.

The owner additionally gets a cheap **view-time aspect re-derivation** on their own horoscope detail view (see D3) so that a setting change is reflected "on next refresh" without a full recalculation.

Rationale:
- Consistency with the existing architecture: calculations happen once at creation, are stored, and are served to every viewer (search, export, share, charts all read `CalculatedDetails`). Introducing per-viewer recompute would make the same horoscope render different aspects in search vs. detail vs. export for the same viewer.
- Determinism and auditability: the stored `CalculatedDetails` is a stable artifact; the owner's setting change is a forward-looking preference, not a rewrite of history.
- Cheap to implement: no new collections, no per-viewer cache invalidation, no ephemeris cost for non-owners.

Alternatives considered:
| Alternative | Rejected because |
|---|---|
| Global setting shared by all users | Contradicts BA clarifying assumption #1; kills personalization; a global change would implicitly rewrite every chart's meaning for everyone. |
| Compute per-viewer at view time for ALL viewers | Non-owner viewers would need their own setting injected into search/export/share/charts responses — large surface change, inconsistent artifacts, complex caching, and breaks the "calculate once, store" invariant. |

### D2. Data only — charts unchanged

**Decision: the setting changes aspect data only** (`planets[].aspects`, and the new `houses[].aspectingPlanets`), never the rendered chart art. Chart SVGs are regenerated only when a horoscope is recalculated (existing `PUT /api/horoscope/[id]` path). If a future feature draws aspect lines/colors on charts, it will read the (now setting-derived) `aspects` / `aspectingPlanets` data.

This is confirmed by code: `chartRenderer.ts` and `chartDataTransform.ts` have no aspect references — aspect data is consumed by the planets table / house table only.

### D3. No migration; settings apply forward; owner view re-derives aspects

**Decision:**
1. Saving the setting never triggers recalculation or backfill of existing `CalculatedDetails` (matches `planetaryOrbs` today).
2. The setting takes effect on:
   - **New horoscope creation** (`POST /api/horoscope`),
   - **Recalculation** when a calculation field changes (`PUT /api/horoscope/[id]`),
   - **Manual chart saves** (`PUT /api/horoscope/[id]/manual-chart`).
3. **Owner view-time re-derivation:** `GET /api/horoscope/[id]` — when the requesting user is the owner — re-derives `planets[].aspects` and `houses[].aspectingPlanets` (auto) / the per-house `aspects` list (manual) from the **stored absolute degrees / house numbers** (auto: stored `planets[].absoluteDegree` + house `middleSign`/`middleDegree`; manual: stored `ManualHousePlacements.planetDegrees` or fallback-derived degrees + whole-sign house `sign`/`houseNumber`) using the owner's **current** `planetAspects` + `planetaryOrbs` (+ `rashiAspects` when enabled), and returns the fresh values inline (not persisted). This satisfies US-PA-004's "stale cached values are invalidated on next refresh" without a heavy migration, and surfaces degree-based aspects on existing stored manual charts (via fallback degrees) with no migration. Non-owners always receive the stored snapshot.

The re-derivation is a pure O(81 × angles) computation (no ephemeris, no I/O) — a few hundred floating-point ops; it does not materially affect response latency.

Alternatives considered:
| Alternative | Rejected because |
|---|---|
| Bulk-recalculate all owner horoscopes on save | O(N) full ephemeris recalcs + chart regeneration on every settings save — unacceptable latency and write amplification; the settings page must remain instant. |
| Store per-user aspect overrides and fully ignore stored aspects | Diverges from the stored-artifact architecture; search/export would need the same override applied; much larger surface change. |

### D4. `degrees` and `houses` jointly drive house aspects (degree-based)

**Decision:** House aspects on **both** `source: "auto"` and `source: "manual"` charts are computed **degree-based**: a planet aspects a house when one of the planet's *aspect points* falls within the planet's orb of that house's **absolute middle degree**, OR the house is in the explicitly configured `houses` list. Manual charts feed the same two arms via each planet's stored or fallback-derived degree (§6.4). The configured (or default) `degrees` list therefore drives house aspects too — not only planet-to-planet aspects. There is **no `degree ÷ 30` → house-number mapping**; degree-based matching uses absolute longitude. This corrects the previous decision (which made `houses` the sole source for house aspects) per the AI-engineer clarification: "If some planet degree - or + its rashmi degree + aspects degree close to the house middle value then it is the planet aspect the house". Precise algorithm in §6.2.

Semantics, defined precisely:

- **Aspect points**: for each configured (or default) degree `d`, the two absolute-longitude points `wrap360(absdeg + d)` and `wrap360(absdeg − d)` (both directions around the 360° circle), where `wrap360(x) = ((x % 360) + 360) % 360`.
- **House middle degree**: on **auto** charts the stored cusp midpoint `(house.middleSign − 1) * 30 + house.middleDegree` — both fields are stored on every auto-chart `House` object. On **manual** charts the house-middle reference is the **whole-sign sign midpoint** `(sign − 1) * 30 + 15` (open question: whether bhava cusps should be used when a `lagnaDegree` is recorded — §6.4/§14).
- **Orb ("rashmi")**: the tolerance band around an aspect point is the aspecting planet's `planetaryOrbs` value, `orb_i = planetaryOrbs[String(i)] ?? DEFAULT_ORBS[i] ?? 0` — the same orb used for planet-to-planet aspects (D5). "rashmi degree" in the data-model feature wording maps to this orb band.
- **Union rule**: planet `i`'s aspected houses = **explicit `houses` arm** ∪ **degree arm**:
  - *Explicit arm* — every house number in the configured `houses` list is aspected unconditionally (independent of degrees, orb, or the planet's own house). For an **unconfigured** planet, the default aspect houses from the new Default Aspect Houses table (§6.1 — SUN/MOON/SATURN 3,5,7,9,10; MARS/MERCURY 4,5,7,8,9; JUPITER/VENUS/RAHU/KETU 5,7,9, replacing the old Mars 4/8/12, Jupiter 5/9/11, Saturn 3/7/10, Rahu/Ketu 5/9, others 7) are resolved **relative to the planet's whole-sign house**: `((house_i − 1 + o − 1) % 12) + 1` — preserving the Vedic meaning of the default table and matching manual-chart behavior (US-PA-005 AC3).
  - *Degree arm* — a house is aspected when its absolute middle degree is within the planet's orb of any aspect point: `min(|midAbs − point|, 360 − |midAbs − point|) ≤ orb_i`.
  - The result is the **union**, deduplicated and sorted ascending.
- **Conjunction (0°) is not an aspect point** for house aspects (configurable degrees start at 30) — a planet "aspects" its own house only if that house is in the explicit `houses` list.
- **Manual charts**: run the **same two arms** (explicit `houses` ∪ degree arm). Each planet's degree is its stored `ManualHousePlacements.planetDegrees` entry when entered, else a deterministic fallback degree (navamsa segment midpoint when the planet's navamsa sign is recorded, else sign midpoint 15°); the degree arm matches aspect points against the house's whole-sign sign midpoint `(sign − 1) * 30 + 15` (see §6.4).

Rationale:
- This is the domain-correct reading of the feature (a planet's drishti lands on another house when the aspect angle from the planet's degree coincides with that house's middle within orb) and encodes the AI engineer's correction to the previous D4.
- It keeps the explicit `houses` list meaningful (houses 3/7/10 directly aspected, as US-PA-005 AC1 describes) while adding the degree-based matching the clarification requires.
- Defaults remain sensible: default degrees `[60,90,120,180]` are matched against house middles with default orbs, and the default special-aspect houses are applied relative to the planet's own house — so an unconfigured auto chart still yields traditional-looking drishti (US-PA-007 reset behavior).

Consequence: on **auto** charts (which currently compute no house aspects), house aspects remain a **new computed output** — `houses[].aspectingPlanets` — now derived from the **union** of the explicit `houses` list and degree-based matching against each house's middle degree (previously the explicit list was to be the sole source). On **manual** charts the existing per-house `aspects` list becomes the same **union** (explicit arm ∪ degree arm, plus rashi when enabled) — previously explicit-arm only (see §6.4).

### D5. Orb tolerance = aspecting planet's `planetaryOrbs` value

**Decision: `planetaryOrbs` becomes the orb tolerance for aspect matching** (replacing the fixed `gap < 30`). Exact algorithm in §6.2. The `degreeGap` of an aspect is the difference between the longitudinal distance and the nearest configured candidate angle; the aspect is effective iff `degreeGap <= orb` where `orb = planetaryOrbs[aspectingPlanet]`.

This matches BA US-PA-006 AC2 ("orb tolerance used is the user's planetaryOrbs value for the aspecting planet — current behavior unchanged") and the data-model note. It also unifies `planetaryOrbs` as the single orb source across combustion and aspects.

### D6. House aspects computed for auto charts (new output)

**Decision: add `aspectingPlanets: number[]` to each stored `House` in `CalculatedDetails`** for auto horoscopes — the list of planets that aspect that house. It is the transpose of `computeHouseAspectsByPlanet` (D4): each planet contributes the **union** of its explicit-aspect houses and its degree-matched houses (aspect point within orb of the house's absolute middle degree). This mirrors the manual chart's per-house `aspects` list (which continues to be used for `source: "manual"` and is, per the 2026-08-11 clarification, now the same union — explicit arm ∪ degree arm via stored/fallback per-planet degrees, plus rashi when enabled — see §6.4), giving both sources a uniform per-house "which planets aspect me" representation. The field is additive and optional (absent on legacy documents). See §6.3 for where it is populated.

## 4. System Context Diagram

```
┌──────────────────────────────┐
│         Student              │
│  (bilingual SI/EN, Google    │
│   SSO)                       │
└──────────────┬───────────────┘
               │ HTTPS (REST)
               ▼
┌───────────────────────────────────────────────────────────────┐
│                       Next.js App Layer                        │
│                                                               │
│  ┌────────────────────┐   ┌───────────────────────────────┐   │
│  │ Settings Page      │   │ Horoscope Detail / Search /   │   │
│  │ (planetAspects     │   │ Export / Share views (read    │   │
│  │  houses+degrees    │   │  stored aspects)              │   │
│  │  form)             │   └──────────────┬────────────────┘   │
│  └─────────┬──────────┘                  │                    │
│            ▼                             ▼                    │
│  ┌───────────────────────────────────────────────────────┐   │
│  │                  API Routes (server)                  │   │
│  │  GET/PUT /api/settings            (persist setting)   │   │
│  │  POST /api/horoscope              (create + calc)     │   │
│  │  PUT  /api/horoscope/:id          (recalc on edit)    │   │
│  │  PUT  /api/horoscope/:id/manual-chart (manual save)   │   │
│  │  GET  /api/horoscope/:id          (owner view →       │   │
│  │                                   pure aspect re-     │   │
│  │                                   derive; others →    │   │
│  │                                   stored snapshot)    │   │
│  └──────────────┬────────────────────────────────────────┘   │
│                 ▼                                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Calculation / Derivation Layer          │   │
│  │  src/lib/planetAspects.ts  (NEW pure module)         │   │
│  │    - defaults, resolution, validation                │   │
│  │    - computePlanetAspects (degrees + orbs)           │   │
│  │    - computeHouseAspects (degree-based union:     │   │
│  │                             degrees + houses + orbs)│   │
│  │  src/lib/calculation.ts     (auto calc; consumes     │   │
│  │                             planetAspects)           │   │
│  │  src/lib/manualChart.ts     (manual calc; consumes   │   │
│  │                             planetAspects +          │   │
│  │                             planetDegrees +          │   │
│  │                             rashiAspects)            │   │
│  └──────────────┬────────────────────────────────────────┘   │
│                 ▼                                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   Data Layer (MongoDB)               │   │
│  │  users.planetAspects        (per-user setting)       │   │
│  │  calculatedDetails.planets[].aspects                 │   │
│  │  calculatedDetails.houses[].aspectingPlanets (new)   │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
```

## 5. Architecture Decisions

| # | Decision | Choice | Rationale | Alternatives evaluated |
|---|----------|--------|-----------|------------------------|
| AD-1 | Scope of setting | **Per-user**, stored on `User.planetAspects`, applied at calculation time; stored snapshot served to all viewers; owner view re-derives | Mirrors `planetaryOrbs`; keeps stored artifacts deterministic; zero viewer-facing complexity | Global setting (rejected: contradicts BA #1); per-viewer compute for all (rejected: inconsistent search/export/share) |
| AD-2 | Where the setting lives | **Embedded JSON on the `User` document** (`Schema.Types.Mixed`), no new collection | Exact precedent: `planetaryOrbs`; one document per user; no join; consistent `/api/settings` CRUD | Dedicated `userAspectSettings` collection (rejected: over-engineering, adds join + lifecycle) |
| AD-3 | Shared horoscope aspects for other viewers | **Stored once from the owner's setting**; non-owners read stored snapshot | "Calculate once, store, serve" is the architecture invariant; owner is the only writer | Per-viewer recompute (rejected, see AD-1) |
| AD-4 | Setting-change effect on stored data | **No migration / backfill**; forward-only + owner view-time pure re-derive | Matches current `planetaryOrbs` semantics; settings save stays instant | Bulk recalc on save (rejected: heavy); eager per-horoscope recalc (rejected: write amplification) |
| AD-5 | `degrees` vs `houses` | **`degrees` and `houses` jointly drive house aspects** on both `source: "auto"` and `source: "manual"` charts: aspect points from configured degrees matched against each house's absolute middle degree within the planet's orb, **unioned** with the explicitly configured `houses` list; `degrees` (plus conjunction `0`) drive planet-to-planet aspects; no degree÷30 mapping; manual charts use stored or fallback-derived per-planet degrees and the whole-sign sign midpoint as the house-middle reference | AI-engineer clarification: a planet aspects a house when its aspect point lands near the house's middle value within the planet's orb; explicit `houses` remain directly aspected | Explicit `houses`-list-only (rejected: contradicts the degree-based clarification); degree÷30 → house numbers (rejected: non-traditional, conflicts with explicit `houses`); manual list-only (rejected: the 2026-08-11 clarification requires both-sources application) |
| AD-6 | Orb tolerance | **`planetaryOrbs[aspectingPlanet]`**, `degreeGap <= orb`; conjunction (0°) always a candidate | BA US-PA-006 AC2 / data-model note; replaces fixed `gap < 30`; single orb source | Keep `gap < 30` (rejected: contradicts requirement); hardcode new constant (rejected: per-user orbs exist) |
| AD-7 | House aspects for auto charts | **New `houses[].aspectingPlanets`** computed from the **union** of each planet's configured/default `houses` and its degree-based aspect-point matches against house middle degrees | Auto charts currently compute none; US-PA-005 AC1 requires them; the degree-based union implements the AI-engineer correction; mirrors the manual per-house `aspects` list (which, per the 2026-08-11 clarification, is now the same union computed from stored/fallback per-planet degrees) | Leave auto house aspects absent (rejected: fails US-PA-005); separate collection (rejected: denormalized) |
| AD-8 | Calculation module shape | **New pure `src/lib/planetAspects.ts`** shared by auto calc, manual calc, settings API, owner view-derive | Same shared-pure-module pattern as `manualChart.ts`; one source of truth for defaults/logic | Duplicate logic per caller (rejected: drift risk); fold into `calculation.ts` (rejected: manual chart + API also need it) |
| AD-9 | API surface | **Extend `GET`/`PUT /api/settings`** to carry `planetAspects` | Follows the existing settings pattern exactly; no new routes | Dedicated `/api/settings/aspects` route (rejected: splits one settings concern; needs auth duplication) |
| AD-10 | `isBeneficial` for extended angles | Keep `{60, 120}` beneficial; **all other angles (incl. 30, 150, 210, 240, 270, 300, 330) non-beneficial** in v1 | Preserves today's display classification; non-classical angles have no canonical benefic/malefic in common tradition | Derive from angle mod (rejected: no domain basis); ask domain expert first (deferred to UX/QA — see §10) |

## 6. Component Design

### 6.1 New module: `src/lib/planetAspects.ts`

Pure functions, no I/O, no ephemeris. Operates on numeric enums (`Planet`, `ZodiacSign`). Shared by server (calculation, manual-chart calc, settings API, owner view-derive) and client (settings form live preview, manual-chart editor preview) — same pattern as `manualChart.ts`. The same functions run for both `source: "auto"` and `source: "manual"` charts; manual charts supply each planet's absolute degree via stored `planetDegrees` or the deterministic fallback (§6.4).

```ts
// ---- Types (also exported for reuse) ----
interface PlanetAspectSetting {
    houses: number[];   // integers 1-12, unique, ascending
    degrees: number[];  // multiples of 30 in [30, 330], unique, ascending
}

type PlanetAspectsMap = Record<string, PlanetAspectSetting>;  // keyed by Planet enum string "1".."9"

// ---- Constants / defaults ----
// Default aspect houses per planet — authoritative default table (replaces the old Vedic
// special-aspect table: Mars 4/8/12, Jupiter 5/9/11, Saturn 3/7/10, Rahu/Ketu 5/9, others 7th).
// Every planet 1-9 has an explicit entry, so there is no "others => [7]" fallback:
//   SUN (1)    = [3, 5, 7, 9, 10]
//   MOON (2)   = [3, 5, 7, 9, 10]
//   MARS (3)   = [4, 5, 7, 8, 9]
//   MERCURY(4) = [4, 5, 7, 8, 9]
//   JUPITER(5) = [5, 7, 9]
//   VENUS (6)  = [5, 7, 9]
//   SATURN(7)  = [3, 5, 7, 9, 10]
//   RAHU (8)   = [5, 7, 9]
//   KETU (9)   = [5, 7, 9]
export const DEFAULT_ASPECT_HOUSES: Record<number, number[]>;
export const DEFAULT_ASPECT_DEGREES = [60, 90, 120, 180];
export const VALID_ASPECT_DEGREES = [30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
export const BENEFICIAL_ASPECT_ANGLES = new Set([60, 120]);

// ---- Resolution ----
resolveAspectHouses(planet: number, planetAspects?: PlanetAspectsMap): number[];
//   entry?.houses ?? DEFAULT_ASPECT_HOUSES[planet]   // DEFAULT_ASPECT_HOUSES covers all planets 1-9 — no [7] fallback
resolveAspectDegrees(planet: number, planetAspects?: PlanetAspectsMap): number[];
//   entry?.degrees ?? DEFAULT_ASPECT_DEGREES

// ---- Validation (server-side, settings API) ----
validatePlanetAspectsPayload(raw: unknown): { ok: true; value: PlanetAspectsMap } | { ok: false; error: string };
//   keys "1".."9" only; each entry: non-empty unique ascending houses in 1-12,
//   non-empty unique ascending degrees in VALID_ASPECT_DEGREES; numbers only.

// ---- Planet-to-planet aspects (auto charts + owner view-derive) ----
computePlanetAspects(
    planets: Pick<Planet, "name" | "absoluteDegree">[],
    planetAspects?: PlanetAspectsMap,
    planetaryOrbs?: Record<string, number>,
): Record<number, Aspect[]>;   // aspecting planet name -> its aspects (see §6.2)

// ---- House aspects (degree-based union; auto charts) ----
// Requires stored absolute degrees on planets and stored middle cusp (middleSign/middleDegree) on
// houses so the degree arm can match aspect points against each house's absolute middle degree.
computeHouseAspectsByPlanet(
    planets: Pick<Planet, "name" | "absoluteDegree" | "house">[],
    houses: Pick<House, "houseNumber" | "middleSign" | "middleDegree">[],
    planetAspects?: PlanetAspectsMap,
    planetaryOrbs?: Record<string, number>,
): Record<number, number[]>;                 // planet -> aspected house numbers (union, sorted asc)

computeHouseAspectsByHouse(
    planets: Pick<Planet, "name" | "absoluteDegree" | "house">[],
    houses: Pick<House, "houseNumber" | "middleSign" | "middleDegree">[],
    planetAspects?: PlanetAspectsMap,
    planetaryOrbs?: Record<string, number>,
): Record<number, number[]>;                 // house number -> aspecting planets (transposed)

// ---- Manual chart aspects (thin adapters over the auto functions — same pure module, both sources) ----
// Manual charts build the auto functions' inputs from the stored placements:
//   - per-planet absolute degree = planetDegrees?.[i]   (stored, 0 ≤ d < 30)
//                               ?? fallbackDegree(i)   // pure, deterministic, ephemeris-free:
//     fallbackDegree(i) = navamsa sign recorded
//         ? (birthSign − 1)*30 + (navamsaIndex − 0.5)*NAVAMSA_ARC   // navamsa segment midpoint (= deriveNavamsaData.absoluteDegreeMidpoint)
//         : (birthSign − 1)*30 + 15                                 // sign midpoint
//   - house-middle reference = whole-sign sign midpoint: { middleSign: sign, middleDegree: 15 } per house
//     (open question: bhava cusps when lagnaDegree is present — §14)
// They then delegate to the identical computePlanetAspects / computeHouseAspectsByPlanet functions.

computeManualPlanetAspects(
    planets: Pick<Planet, "name" | "sign" | "house">[],   // placements-derived
    planetDegrees?: Record<string, number>,
    planetAspects?: PlanetAspectsMap,
    planetaryOrbs?: Record<string, number>,
): Record<number, Aspect[]>;                  // aspecting planet -> its aspects (→ computePlanetAspects with absolute degrees)

computeManualHouseAspects(
    houseOfPlanet: Record<number, number>,    // planet -> whole-sign house (1-12)
    houseSigns: number[],                     // deriveHouseSigns(lagna) — whole-sign sign per house
    planetDegrees?: Record<string, number>,
    planetAspects?: PlanetAspectsMap,
    planetaryOrbs?: Record<string, number>,
): Record<number, number[]>;                  // planet -> aspected house numbers (explicit arm ∪ degree arm, sorted asc)
                                              // (→ computeHouseAspectsByPlanet with whole-sign middle cusps)

// Rashi aspects are shared pure functions too (Rashi Aspects architecture, pending): manual charts feed
// the whole-sign sign per house/planet (already stored) plus each planet's stored or fallback-derived
// degree for the degree + orb ("rashmi") check — no manual-specific rashi logic (see §6.4).
```

### 6.2 Aspect matching algorithm (D5)

For each aspecting planet `i`:

```
candidates = [0, ...resolveAspectDegrees(planet i)]   // 0 (conjunction) always present, not configurable
orb_i = planetaryOrbs[String(i)] ?? DEFAULT_ORBS[i] ?? 0

for each other planet j (i != j):
    rawDist = min(|abs_i - abs_j|, 360 - |abs_i - abs_j|)     // minor arc
    nearest = argmin over candidates of |rawDist - angle|      // ties: smaller angle wins
    degreeGap = |rawDist - nearest|
    if degreeGap <= orb_i:
        record { planetName: j, aspectType: nearest, planetAbsoluteDegree: abs_j,
                 degreeGap: round(degreeGap, 2), exactAspectDegree: nearest,
                 isBeneficial: BENEFICIAL_ASPECT_ANGLES.has(nearest) }
```

Notes:
- The orb is always the **aspecting planet's** orb (asymmetric — same as today's `planetaryOrbs` usage intent).
- Only the **configured** angles (plus conjunction) are candidates — e.g. Ravi `degrees: [60, 180, 240]` never matches a 90° separation, even within orb (US-PA-006 AC1).
- `degreeGap <= orb` (inclusive) so `orb = 0` (Rahu/Ketu defaults) still records an exact match.
- Tie-breaking (equal `|rawDist - angle|`) prefers the smaller angle, matching today's reduce-over-ascending-array behavior — deterministic.
- Conjunction (`0`) remains recorded in `planets[].aspects` exactly as today.

#### House-aspect matching (degree-based union; D4 + D5, both sources)

For each aspecting planet `i`, exactly:

```
// Inputs (auto charts: stored planets + houses; manual charts: the same shapes built from the
//  placements + stored/fallback per-planet degrees — see §6.4)
abs_i   = planet_i.absoluteDegree
house_i = planet_i.house                                   // whole-sign house (for default offsets)
entry   = planetAspects?.[String(i)]
degrees = entry?.degrees ?? DEFAULT_ASPECT_DEGREES         // [60, 90, 120, 180] when unconfigured
orb_i   = planetaryOrbs?.[String(i)] ?? DEFAULT_ORBS[i] ?? 0

// Explicit houses arm
explicitHouses =
    entry ? entry.houses                                   // absolute house numbers 1-12 (directly aspected)
    : { ((house_i - 1 + o - 1) % 12) + 1 | o ∈ DEFAULT_ASPECT_HOUSES[i] }
                                                           // default aspect houses resolved as offsets from
                                                           // the planet's whole-sign house; covers all 1-9

// Degree arm — aspect points either side of the planet, wrapped to [0, 360)
points = { wrap360(abs_i + d), wrap360(abs_i - d) | d ∈ degrees }    // wrap360(x) = ((x % 360) + 360) % 360

// Per house
aspected = new Set(explicitHouses)                          // explicit arm always applies
for h in houses:
    midAbs = (h.middleSign - 1) * 30 + h.middleDegree       // absolute middle degree of house h
    if ∃ p ∈ points with min(|midAbs - p|, 360 - |midAbs - p|) ≤ orb_i:
        aspected.add(h.houseNumber)                          // degree arm — union

result[i] = sorted(aspected)                                 // dedup, ascending
```

Notes:
- **Orb ("rashmi")** is the aspecting planet's `planetaryOrbs` value (D5) — inclusive bound `≤ orb_i`, identical semantics to planet-to-planet matching. "rashmi degree" in the data-model/feature wording is interpreted as this orb band.
- **Both directions** (`+d` and `−d`) are evaluated; the mod-360 wrap handles crossing the 0°/360° boundary (e.g. planet at 350° with `d = 60` yields aspect point 410° → 50°).
- **Union semantics**: a house is aspected if it is explicitly listed, or its middle degree falls within an orb of any aspect point — the two arms are independent and deduplicated. A house explicitly listed but far from every aspect point is still aspected (US-PA-005 AC1); the same house matched by both arms is stored once.
- **No `degree ÷ 30` mapping** — houses are matched by absolute middle longitude, never by integer-dividing a degree angle.
- **Conjunction (0°) is not in `degrees`** (validation range 30–330), so the degree arm never produces a 0° point; a planet's own house is aspected only via the explicit arm.
- **House middle degree source**: on **auto** charts use the stored `middleSign`/`middleDegree` (the cusp midpoint, Placidus — these can skip/repeat a sign for unequal houses), not the whole-sign `sign`. On **manual** charts use the whole-sign sign midpoint `(sign − 1) * 30 + 15` (see §6.4; open question: bhava cusps when a `lagnaDegree` is recorded). If a house lacks a usable middle degree, the degree arm is skipped for that house (the explicit arm still applies).
- **Manual charts** run the same degree arm using each planet's stored or fallback-derived degree against the house's whole-sign sign midpoint `(sign − 1) * 30 + 15` as the house-middle reference — see `computeManualHouseAspects` / `computeManualPlanetAspects` in §6.1 and §6.4.

### 6.3 `src/lib/calculation.ts` (auto path)

- Signature becomes `calculateHoroscope(data, planetaryOrbs = DEFAULT_ORBS, planetAspects?: PlanetAspectsMap)` — third parameter optional, default `{}` (all planets fall back to defaults → today's behavior).
- Replace the `ASPECT_TYPES` / `gap < 30` loop with `computePlanetAspects(planetDetails, planetAspects, planetaryOrbs)`.
- After planet details (with `absoluteDegree` + whole-sign `house`) and the `House[]` array (with `middleSign`/`middleDegree`) are built, compute house aspects:
  - `houseAspectsByHouse = computeHouseAspectsByHouse(planetDetails, houses, planetAspects, planetaryOrbs)`
    (transpose of `computeHouseAspectsByPlanet`; the explicit-`houses` arm ∪ the degree arm matched against each house's absolute middle degree — D4/D5).
  - Attach `aspectingPlanets: houseAspectsByHouse[house.houseNumber] ?? []` to each `House` — the aspecting planets for that house number.
- `ASPECT_TYPES` constant is removed (superseded by `resolveAspectDegrees` + conjunction).

### 6.4 `src/lib/manualChart.ts` (manual path)

Manual charts now run **both aspect mechanisms** (Planet Aspects houses + degrees AND Rashi Aspects when enabled), exactly like auto charts — per the 2026-08-11 clarification. The manual path feeds the **same pure functions** from `planetAspects.ts` (shared module, confirmed in §6.1) using each planet's stored or fallback-derived degree.

- **`ManualHousePlacements.planetDegrees` (new, optional)** — per-planet degree **within the planet's birth sign** (0 ≤ d < 30), keyed by numeric Planet enum string (`"1"`…`"9"`), following the `planetaryOrbs`/`planetAspects` embedded-Record convention (BA data-model). `ManualChartInput` gains the same optional `planetDegrees`; `manualPlacementsToInput` round-trips it; `compute()` threads it through; the manual-chart API validates it (see §8.3). Entered degrees always take precedence.
- **Fallback degree** — a planet without a `planetDegrees` entry uses a deterministic fallback degree, mirroring the existing manual degree-estimation pattern (`computeAscendantNakshatra` / `deriveNavamsaData`): the **navamsa segment midpoint** `(birthSign − 1)*30 + (navamsaIndex − 0.5) * NAVAMSA_ARC` (i.e. the existing `deriveNavamsaData` `absoluteDegreeMidpoint`) when the planet's navamsa sign is recorded, else the **sign midpoint** `(birthSign − 1)*30 + 15`. Pure, deterministic, ephemeris-free — the aspect functions stay pure for both sources (US-PA-005 AC2 / US-PA-006 AC3 / US-RA-004 / US-RA-005).
- **Planet-to-planet aspects** — `computeManualPlanetAspects(planets, planetDegrees, planetAspects, planetaryOrbs)` delegates to `computePlanetAspects` with each planet's absolute degree (entered or fallback). A manual-chart planet without an entered degree still participates via its fallback degree.
- **House aspects (union of both arms)** — the per-house `aspects` list = **explicit `houses` arm** ∪ **degree arm**:
  - *Explicit arm* — a configured `houses` list applies as **absolute house numbers** (same semantics as the auto explicit arm); default aspect houses (the new `DEFAULT_ASPECT_HOUSES` table in §6.1) apply as **offsets from the planet's house** (current `computeAspects` behavior preserved).
  - *Degree arm* — each planet's aspect points (`absDeg ± d`, wrapped to 360°) are matched against the house's **whole-sign sign midpoint** `(sign − 1)*30 + 15` (the manual house-middle reference) within the aspecting planet's `planetaryOrbs` orb. Implementation: `computeManualHouseAspects` builds `{ middleSign: sign, middleDegree: 15 }` houses from `deriveHouseSigns(lagna)` and delegates to `computeHouseAspectsByPlanet` — no duplicated matching logic (US-PA-005 AC2).
  - Result is the union, deduplicated, sorted ascending — identical semantics to the auto path.
- **Rashi aspects (when `rashiAspects.enabled`)** — the rashi candidate sets come from the whole-sign `sign` (already stored per house and derivable per planet), and the degree + orb ("rashmi") check uses each planet's stored or fallback-derived degree; rashi house/planet aspects union with the Planet-Aspects arms and each reason is retained (US-RA-004 / US-RA-005). The rashi functions are shared pure functions from the Rashi Aspects architecture — no manual-specific rashi logic.
- `computeAspects(houseOfPlanet, planetAspects?: PlanetAspectsMap)` — new optional param; when absent the current hardcoded `ASPECT_HOUSES` table is used (defaults preserved: offsets from the planet's house). Note the hardcoded `ASPECT_HOUSES` in `src/lib/manualChart.ts` (L139-145) still holds the OLD table (Mars 4/8/12, Jupiter 5/9/11, Saturn 3/7/10, Rahu/Ketu 5/9, others → 7) — as a Developer action item, `computeAspects` must consume the new `DEFAULT_ASPECT_HOUSES` from `planetAspects.ts` as the single source of defaults (§10). `computeAspects` computes the **explicit arm only** (the legacy list-based path); `buildHouses` / `compute()` compute the full **union** via `computeManualHouseAspects` (explicit arm ∪ degree arm) and thread `planetAspects`, `planetDegrees`, `planetaryOrbs`, and `rashiAspects` through. The per-house `aspects` list and the planets-table `aspectsPlanets` derive from the full union.
- **Legacy stored manual charts** (no `planetDegrees`): fallback degrees apply at calculation and owner view-time re-derivation — no migration/backfill (§11).

### 6.5 `src/models/User.ts`

Add (additive, default `{}`):

```
planetAspects: { type: Schema.Types.Mixed, default: {} }   // PlanetAspectsMap
```

Extend `IUser` with `planetAspects: Record<string, { houses: number[]; degrees: number[] }>`.

### 6.6 `src/app/api/settings/route.ts`

- `GET` returns `{ planetaryOrbs, planetAspects }` (raw stored map; planets absent ⇒ defaults).
- `PUT` accepts `{ planetaryOrbs?, planetAspects? }` — at least one required. `planetAspects` is validated with `validatePlanetAspectsPayload` (all-or-nothing; no partial save on error). Persist with `$set` on whichever fields were provided. Reset semantics: omit a planet's key (or send `planetAspects: {}`) ⇒ that planet uses defaults (US-PA-007).

### 6.7 `src/app/api/horoscope/**` (calculation invocation)

- `POST /api/horoscope`: load `user.planetaryOrbs` + `user.planetAspects`; call `calculateHoroscope(horoscope, planetaryOrbs, planetAspects)`; persist `CalculatedDetails` (now includes `planets[].aspects` per new algorithm + `houses[].aspectingPlanets`).
- `PUT /api/horoscope/[id]` (recalc path): same — pass latest `planetAspects`; regenerates `CalculatedDetails` and charts.
- `PUT /api/horoscope/[id]/manual-chart`: `compute(parsed, currentShani, { planetAspects, planetaryOrbs, rashiAspects })` — pass the owner's settings (loaded from `User`); `parsed` may now include `planetDegrees` (optional per-planet degrees, validated 0 ≤ d < 30); re-derives the full aspect union (explicit ∪ degree ∪ rashi) + persists.
- `GET /api/horoscope/[id]`: if `horoscope.owner.id === session.user.id`, run the owner view-time re-derivation (D3): for **auto** charts, `computePlanetAspects` + `computeHouseAspectsByHouse` over the **stored** planets (absolute degrees) and **stored** houses (`middleSign`/`middleDegree`) with the owner's **current** `planetAspects` + `planetaryOrbs` (+ `rashiAspects` when enabled), overriding `planets[].aspects` / `houses[].aspectingPlanets` in the response (not persisted); for **manual** charts, the same functions run over the stored `ManualHousePlacements` using stored or fallback-derived per-planet degrees and the whole-sign sign midpoint as the house-middle reference (see §6.4), overriding `planets[].aspects` / the per-house `aspects` list. Non-owners receive the stored snapshot unchanged.

### 6.8 Settings UI (for UX phase reference)

- Extend `src/app/settings/page.tsx` with a "Planets Aspects houses and degrees" section: per-planet rows (planet picker by EN/SI name → `Planet` enum), houses multi-select (1–12), degrees multi-select (30–330 step 30), per-planet reset, bulk reset.
- Pre-fill from `GET /api/settings` `planetAspects` (show defaults for unconfigured planets). Save via `PUT /api/settings`.
- A live "preview" panel can reuse `computePlanetAspects` client-side (shared pure module) — optional, recommended.
- Add i18n strings to `src/messages/en.json` + `src/messages/si.json` (keep in sync), incl. labels for the extended angles (210, 240, 270, 300, 330).

## 7. Data Flows

### 7.1 Save the setting

```
Student → Settings Page → edit a planet's houses/degrees →
  → PUT /api/settings { planetaryOrbs?, planetAspects?: { "1": { houses: [3,7,10], degrees: [60,180,240] }, ... } }
  → Server: getServerSession(authOptions) → 401 if missing
  → connectDB()
  → validatePlanetAspectsPayload(body.planetAspects) → 400 + localized error if invalid (no partial save)
  → User.findOneAndUpdate({ email }, { $set: { ...(orbs && {planetaryOrbs}), ...(aspects && {planetAspects}) } })
  → Return { message: "Settings saved", planetaryOrbs, planetAspects } →
  → Client confirms; form pre-filled on next open (persisted)
  → No recalculation/migration of existing CalculatedDetails (by design)
```

### 7.2 Calculate a horoscope with the setting applied (create)

```
Student → Add Horoscope → birth details →
  → POST /api/horoscope { name, birthDate, birthTime, latitude, longitude, ayanamsha, ... }
  → Server: session → connectDB → Horoscope.create(...)
  → User.findOne({ googleId }) → planetaryOrbs, planetAspects
  → calculateHoroscope(horoscope, planetaryOrbs, planetAspects)
        └─ computePlanetAspects(planets, planetAspects, planetaryOrbs)
             (candidates = [0, ...configured degrees]; degreeGap <= planetaryOrbs[aspecting])
        └─ computeHouseAspectsByHouse(planets, houses, planetAspects, planetaryOrbs)
              (explicit houses ∪ degrees aspect-points vs house middle degrees) → houses[].aspectingPlanets
  → CalculatedDetails.create({ horoscope, ...calculated })   // aspects now reflect owner's setting
  → Chart.insertMany (positional SVGs — unchanged by the setting)
  → indexHoroscope(id) → 201
```

### 7.3 Recalculation on setting change

Path A — full recalculation (birth-detail edit):
```
Student → Edit horoscope calculation fields →
  → PUT /api/horoscope/:id { birthTime: "..." } →
  → needsRecalc = true → load owner planetaryOrbs + planetAspects →
  → calculateHoroscope(horoscope, orbs, aspects) → CalculatedDetails updated → charts regenerated →
  → 200 (aspects now use the latest setting)
```

Path B — settings save + owner re-opens an existing horoscope (view-time re-derive, no migration):
```
Student → PUT /api/settings (new houses/degrees persisted)
Student → opens own horoscope detail →
  → GET /api/horoscope/:id →
  → load stored CalculatedDetails (planets absolute degrees, houses) →
  → owner check: owner.id === session.user.id →
  → computePlanetAspects(stored planets, current planetAspects, current planetaryOrbs)
  → computeHouseAspectsByHouse(stored planets, stored houses, current planetAspects, current planetaryOrbs)
      (degree-based union re-derived from the stored absolute degrees + house middle degrees)
  → override planets[].aspects + houses[].aspectingPlanets in response (not persisted) →
  → 200 with fresh aspects (stale stored values invalidated on next refresh)
  → For source: "manual", the same re-derivation runs over the stored ManualHousePlacements using
    stored or fallback-derived per-planet degrees + whole-sign sign midpoints (see §6.4) →
  → Non-owner viewers: stored snapshot returned as-is (403/404 privacy rules unchanged)
```

Manual horoscope path (both arms + rashi — both sources):
```
Student → PUT /api/horoscope/:id/manual-chart { lagna, lagnaDegree?, planetDegrees?, houses, ... } →
  → load owner settings → compute(parsed, currentShani, { planetAspects, planetaryOrbs, rashiAspects }) →
  → per-planet absolute degree = parsed.planetDegrees?.[i] ?? fallbackDegree(i)
       (navamsa segment midpoint via deriveNavamsaData.absoluteDegreeMidpoint, else (sign−1)*30+15) →
  → per-house aspects = explicit houses arm (configured list absolute / default offsets from the planet's house)
       ∪ degree arm (aspect points vs each house's whole-sign sign midpoint (sign−1)*30+15 within orb) →
  → planet-to-planet aspects = computeManualPlanetAspects(planets with their degrees, planetAspects, planetaryOrbs) →
  → rashi aspects (when rashiAspects.enabled): rashi candidate sets from whole-sign signs + same degree/orb check →
  → CalculatedDetails updated → 200
```

## 8. API Contracts

### 8.1 `GET /api/settings`

Response `200`:
```json
{
    "planetaryOrbs": { "1": 15, "2": 12, "3": 8, "4": 7, "5": 9, "6": 7, "7": 9, "8": 0, "9": 0 },
    "planetAspects": {
        "1": { "houses": [3, 7, 10], "degrees": [60, 180, 240] }
    }
}
```
- `planetAspects` is the raw stored map; a planet absent from it uses defaults. The settings form renders defaults for unconfigured planets via `resolveAspectHouses`/`resolveAspectDegrees` (constants exported by `planetAspects.ts`).

### 8.2 `PUT /api/settings`

Request body (at least one of `planetaryOrbs` / `planetAspects`):
```json
{
    "planetaryOrbs": { "1": 15 },
    "planetAspects": {
        "1": { "houses": [3, 7, 10], "degrees": [60, 180, 240] },
        "7": { "houses": [3, 7, 10], "degrees": [60, 180, 240] }
    }
}
```

Validation (server-side, mandatory, all-or-nothing):
- Keys MUST be Planet enum strings `"1"`…`"9"`.
- `houses`: non-empty array of integers in `[1, 12]`, unique, sorted ascending (server normalizes order).
- `degrees`: non-empty array of multiples of 30 in `[30, 330]` (i.e. `30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330`), unique, sorted ascending.
- Any violation → `400` with a localized message; nothing partially saved.
- To reset a planet to defaults: omit its key from the map; to bulk-reset: send `"planetAspects": {}` (US-PA-007).

Response `200`:
```json
{
    "message": "Settings saved",
    "planetaryOrbs": { "1": 15 },
    "planetAspects": { "1": { "houses": [3, 7, 10], "degrees": [60, 180, 240] } }
}
```

Errors: `400` validation, `401` no session, `404` user not found.

### 8.3 Unchanged routes (behavioral notes only)

- `POST /api/horoscope`, `PUT /api/horoscope/[id]` — responses unchanged; `CalculatedDetails` now reflects the owner's `planetAspects` + `planetaryOrbs`.
- `GET /api/horoscope/[id]` — the owner's view may return re-derived `planets[].aspects` / `houses[].aspectingPlanets` (auto) or the re-derived per-house `aspects` list (manual) — not persisted; same shape otherwise. Auto `houses[].aspectingPlanets` is now the degree-based union (explicit `houses` ∪ degree-matched house middles), not a `houses`-list-only derivation; manual per-house `aspects` is the same union (explicit ∪ degree, plus rashi when enabled) via stored/fallback per-planet degrees (§6.4).
- `PUT /api/horoscope/[id]/manual-chart` — request body may now include `planetDegrees` (optional; `Record<string, number>` keyed by Planet enum string, each 0 ≤ d < 30); response unchanged; per-house aspects are the explicit `houses` arm ∪ the degree arm (aspect points vs the house's whole-sign sign midpoint `(sign−1)*30+15`, using each planet's stored or fallback-derived degree within orb) plus rashi aspects when the owner has `rashiAspects.enabled`.
- Search / share / export — read stored `CalculatedDetails`; no API change.

## 9. Database Schema Changes

### `users` (Mongoose `User` model)

Add:
```
planetAspects: { type: Schema.Types.Mixed, default: {} }   // PlanetAspectsMap (Record<string, { houses: number[]; degrees: number[] }>)
```

No index needed (always accessed with the owning document).

### `calculatedDetails` (Mongoose `CalculatedDetails` model)

- `planets[].aspects[]` — same shape (`Aspect`), but `aspectType` / `exactAspectDegree` may now be any multiple of 30 in `[30, 330]` (or `0` for conjunction) for new/recalculated charts. `degreeGap` uses the `planetaryOrbs` orb instead of the old `< 30` cutoff.
- `houses[]` — add optional:
```
aspectingPlanets: number[]   // planets that aspect this house (auto charts); absent on legacy docs
```

Additive and backward-compatible; legacy documents simply lack `aspectingPlanets` (rendered as empty, and re-derived for the owner at view time).

## 10. Dependencies

| Depends on | Notes |
|---|---|
| BA user stories US-PA-001…007 | All covered by this design; no blockers |
| BA data-model `planetAspects` structure & Aspect Type enum 30–330 | Source of truth for shapes/validation |
| Existing `/api/settings` pattern (`User`, `planetaryOrbs`) | Reused verbatim for persistence/auth |
| Existing `planetaryOrbs` | Becomes the aspect orb tolerance (single source) |
| `jyotish-calculations` / `swisseph-v2` | Unchanged; no new ephemeris usage (re-derivation is pure) |
| `src/lib/astrology.ts` `Aspect` / `Planet` / `House` types | Extended by the new module; types reused |
| `src/lib/manualChart.ts` `ASPECT_HOUSES` | Superseded — still holds the OLD default table (Mars 4/8/12, Jupiter 5/9/11, Saturn 3/7/10, Rahu/Ketu 5/9, others → 7). New authoritative defaults (9-planet table, §6.1) become `DEFAULT_ASPECT_HOUSES` in `planetAspects.ts` (single source); `manualChart.ts` must consume that constant — Developer action item |

## 11. Migration / Compatibility

- **`User.planetAspects`** is additive with `default: {}` — existing users unaffected; every planet resolves to defaults ⇒ today's behavior.
- **`calculateHoroscope` signature** gains an optional third param — existing callers and all Jest tests (`calculateHoroscope(baseData)`) remain valid; behavior identical when no `planetAspects` is passed.
- **Orb change**: existing/new charts computed with the new engine use `planetaryOrbs` as orb instead of `gap < 30`. For Rahu/Ketu (default orb 0) this is stricter (exact matches only); for other planets (defaults 7–15) it is typically stricter than 30 — a deliberate, requirement-driven behavior change. QA should re-verify aspect outputs (see §13).
- **Behavior change — auto house aspects (degree-based)**: previously auto charts computed **no** house aspects; now `houses[].aspectingPlanets` is derived at calculation time from the **union** of the explicit `houses` arm and the degree arm (aspect points from configured **or default** degrees `[60,90,120,180]` matched to each house's absolute middle degree within default orbs). An unconfigured planet therefore already yields sensible, traditional-looking drishti with no entry required — the union always runs (use the defaults for `degrees`/`orbs`), never an empty result.
- **No backfill** of existing `CalculatedDetails`; owners see fresh aspects via view-time re-derivation (D3) without a migration. Existing legacy auto charts lack `aspectingPlanets` (rendered empty) and their owner view re-derivation uses the corrected degree-based union against stored degrees/houses automatically.
- **Legacy manual charts (no `planetDegrees`)**: existing stored `source: "manual"` horoscopes gain the degree-based arms (planet-to-planet, house-aspect degree arm, rashi degree + orb check) using each planet's deterministic **fallback degree** (navamsa segment midpoint when the planet's navamsa sign is recorded, else sign midpoint 15°) — no migration/backfill, consistent with the no-backfill stance for `CalculatedDetails` (D3). Stored `aspects`/`aspectsPlanets` on legacy manual charts may therefore differ from previously persisted values once the engine is live; owners see the fresh union via owner view-time re-derivation, non-owners see the stored snapshot until the chart is next saved.
- **Extended angles** (210/240/270/300/330) may appear in `aspectType`/`exactAspectDegree` for new/recalculated charts. Display labels for these are data-model "descriptive placeholders" — Developer/UX must add EN/SI labels so existing table rendering doesn't fall back to raw numbers.
- **`houses[].aspectingPlanets`** is additive/optional; legacy charts lack it (empty), view-time re-derivation fills it for the owner only.
- Removing `ASPECT_TYPES` from `calculation.ts` is safe (referenced nowhere else).

## 12. Security Considerations

- **Settings route** follows the existing `/api/settings` auth (`getServerSession` → 401) and ownership (per-user via `session.user.email` / `googleId`). A user can only ever read/write their own `planetAspects`.
- **Strict server-side validation** of the payload (`validatePlanetAspectsPayload`): numbers only, bounded ranges, no arbitrary JSON injection into stored documents; no partial save on invalid input (defense against malformed/bulk-write attempts).
- **No cross-user leakage**: non-owner viewers always receive the stored snapshot; the owner-specific view-time re-derivation runs only when `horoscope.owner.id === session.user.id` (checked server-side, same as existing ownership checks). Non-owners never receive owner-derived data computed from the owner's current settings.
- **Pure derivation, no user-controlled input**: view-time re-derivation reads only stored degrees/houses + the owner's own validated settings — no time/location/degree input from the client, matching the existing "no time-manipulation" stance.
- **CSRF**: `PUT /api/settings` is state-changing; existing protection applies (NextAuth SameSite cookies) — no change.
- **Rate limiting**: settings writes are cheap and authenticated; no new limit required beyond existing settings behavior. Aspect re-derivation at view time is O(n) arithmetic (no ephemeris) — no additional CPU-abuse surface.

## 13. Verification Steps

1. **Unit tests** (Jest, `src/__tests__/planetAspects.test.ts`):
   - Defaults: `resolveAspectHouses/resolveAspectDegrees` per planet (new default table — SUN/MOON/SATURN 3,5,7,9,10; MARS/MERCURY 4,5,7,8,9; JUPITER/VENUS/RAHU/KETU 5,7,9; degrees [60,90,120,180] for all planets).
   - Validation: valid payload accepted; 0/13/3.5 houses rejected; 0/45/360/15 degrees rejected; empty arrays rejected; duplicates rejected; non-planet keys rejected.
   - Aspect matching: Ravi degrees `[60,180,240]` only matches those angles; `degreeGap <= orb` boundary (inclusive at orb; rejected just beyond); orb=0 exact-match; conjunction (0) always candidate; tie-break to smaller angle; extended angles (240/270/330) recorded with correct `aspectType`/`exactAspectDegree`.
   - House aspects (degree-based): aspect point = `abs ± d` both directions with mod-360 wrap (e.g. planet 350° + 60° → 50°); a house is aspected (degree arm) iff its absolute middle `(middleSign−1)*30 + middleDegree` is within orb of an aspect point; orb boundary at the house middle is inclusive (`<=`) and rejected just beyond; union with the explicit `houses` list — an explicitly listed house is aspected even when far from every aspect point, and a house matched by both arms is stored once (dedup, sorted ascending); unconfigured planets use default degrees `[60,90,120,180]` + default orbs + default special-aspect houses applied **as offsets** from the planet's whole-sign house; fail-safe: the degree arm skips houses with no usable stored middle degree.
2. **API tests**: `GET/PUT /api/settings` round-trip; validation 400s (no partial save); reset via omitted key / `{}`; 401 unauthenticated.
3. **Calculation integration**: `POST /api/horoscope` with a configured `planetAspects` yields `planets[].aspects` restricted to configured angles and `houses[].aspectingPlanets` matching configured houses; without `planetAspects` output matches today's semantics (defaults).
4. **Backward compatibility**: run existing `src/__tests__/calculation.test.ts` / `birthChart.test.ts` unchanged — must pass (defaults path).
5. **Owner view re-derivation**: change setting → `GET /api/horoscope/[id]` as owner reflects new aspects; as a different user (public horoscope) the stored snapshot is unchanged.
6. **Manual chart**: per-house `aspects` are the explicit `houses` arm ∪ the degree arm (US-PA-005 AC2/AC3): an entered `planetDegrees` value drives the degree arm; a planet without one uses its deterministic fallback (navamsa segment midpoint, else sign midpoint 15°); identical placements + degrees on an auto chart yield identical planet/house/rashi aspects (cross-source consistency); with `rashiAspects.enabled`, rashi drishti appears on manual houses/planets with the degree+orb check (US-RA-004/US-RA-005); a legacy stored manual chart without `planetDegrees` re-derives the same degree-based aspects via fallback at owner view time.
7. **`pnpm lint` + `pnpm format`** (4-space indentation, import ordering) and `pnpm build` clean.

## 14. Questions for Other Roles

### For UX
1. Should the rendered charts draw aspect lines/colors from the (now setting-derived) `aspects` / `aspectingPlanets` data in v1, or is the planets/house table the only surface? (This architecture is data-only by design; aspect-line rendering is a separate feature.)
2. Display names for the non-classical angles (210, 240, 270, 300, 330) — confirm the "descriptive placeholder" labels for EN/SI (e.g. "Sesquiquadrate (6 signs)") and how they appear in the planets table / settings form.
3. In the settings form, should unconfigured planets show their default houses/degrees (recommended) or an empty state?
4. **[new — from the house-aspect correction + new defaults]** The settings form selects **absolute house numbers** (e.g. Ravi → houses 3, 7, 10 meaning those chart houses directly), while the *default* aspect houses act as offsets from the planet's own house. Confirm the form copy/labels communicate this asymmetry (a configured planet and an unconfigured planet can render different aspected-house sets), and confirm the form's "defaults" display uses the NEW default table (SUN/MOON/SATURN 3,5,7,9,10; MARS/MERCURY 4,5,7,8,9; JUPITER/VENUS/RAHU/KETU 5,7,9 — NOT the old "Mars 4/8/12" special-aspect table).
5. **[new — manual degrees]** In the manual-chart form, should per-planet degree entry be exposed (an optional small degree input per placed planet), or is the deterministic fallback degree sufficient for v1 (recommended)? If exposed, confirm how the entered degree drives planet-to-planet / degree-based house / rashi aspects is communicated to the student, and how a planet's current degree source (entered vs fallback) is shown.

### For QA
1. Confirm the orb semantic change (per-planet `planetaryOrbs` instead of fixed `< 30`) is expected to alter many existing aspect outputs (esp. Rahu/Ketu at orb 0) — does any golden dataset need regenerating?
2. Owner-view re-derivation vs stored snapshot vs search/export: should the owner's search-result card / export also reflect re-derived aspects, or consistently show the stored snapshot? (Recommendation: stored snapshot everywhere except the owner's detail view, to keep artifacts consistent — but confirm.)
3. Test matrix: conjunction at orb boundary, tie between two configured angles, orb=0 exact aspect, 12-houses-configured edge, manual-chart houses setting, manual-chart degree arm (entered vs fallback degrees), and 5-planet rapid setting saves (no partial save).
4. **[new]** Degree-based house matching edge cases: orb boundary exactly at a house's absolute middle degree (inclusive); both directions of each aspect point (`abs + d` and `abs − d`); aspect points wrapping across 360° (planet near 0°/360°); a house whose middle degree is within orb of two different aspect points; a house falling in the orb band but NOT in the explicit list (degree arm gives it) vs in the list but far from every point (explicit arm gives it); legacy houses with a missing/unusable stored `middleDegree` (degree arm skipped, list arm still applies).
5. **[new — manual degrees]** Manual-chart degree matrix: (a) a planet with an entered `planetDegrees` value; (b) a planet without one but with a recorded navamsa sign → fallback = navamsa segment midpoint; (c) a planet with neither → fallback = sign midpoint 15°; (d) the same placements entered as an auto chart (matching degrees) produce identical planet-to-planet, house, and rashi aspects — cross-source consistency; (e) a legacy stored manual chart without `planetDegrees` re-derives the same degree-based aspects via fallback at owner view time.

### For Developer
1. Naming unification: auto charts use `houses[].aspectingPlanets`, manual charts use per-house `aspects` — should these be unified to one field name across both sources in this feature, or left as-is?
2. Should `BENEFICIAL_ASPECT_ANGLES` be exported as a config table (like `manualChart.ts` config consts) so future traditions can extend it?
3. Confirm `planetaryOrbs` `planetaryOrbs[String(i)] ?? DEFAULT_ORBS[i] ?? 0` fallback ordering for aspect orbs matches the combustion code path (`planetaryOrbs["1"] ?? 15`).
4. **[action item]** `src/lib/manualChart.ts` `ASPECT_HOUSES` (L139-145) still holds the OLD default values (MARS [4,8,12], JUPITER [5,9,11], SATURN [3,7,10], RAHU/KETU [5,9], others → `[7]`). The new authoritative 9-planet defaults MUST be implemented as `DEFAULT_ASPECT_HOUSES` in the new `src/lib/planetAspects.ts` (§6.1 table) and `manualChart.ts` `computeAspects` must consume that constant (single source) rather than its own hardcoded map — the old `?? [7]` "others" fallback is unreachable once all 9 planets have explicit entries.
5. **[new]** The auto degree arm compares aspect points against each house's **stored** `middleSign`/`middleDegree` (Placidus cusp midpoints, which can skip/repeat signs for unequal houses); the manual degree arm uses the **whole-sign sign midpoint** `(sign−1)*30+15` as the house-middle reference. Confirm both are the intended references, and confirm the manual reference stays whole-sign rather than bhava cusps when a `lagnaDegree` is recorded (open question — §6.4). Ensure the owner-view re-derivation uses the identical helper/inputs as `compute()` so stored and re-derived values always agree (auto: stored cusps; manual: whole-sign midpoints).
6. **[new — action item]** Extract a single pure `derivePlanetAbsoluteDegree(planet, birthSign, navamsaSign?, enteredDegree?)` helper (used by `compute()`, the manual-chart API, and owner view-time re-derivation) so stored and re-derived manual aspects always agree; the fallback must mirror `deriveNavamsaData`'s `absoluteDegreeMidpoint` (navamsa segment midpoint) else the sign midpoint 15°. Confirm `planetDegrees` validation (0 ≤ d < 30, numbers only) and that `manualPlacementsToInput` round-trips it.

### For PM
1. Confirm no backfill/migration of existing charts is acceptable (recommendation: yes — matches current `planetaryOrbs` behavior; owners see fresh aspects via view re-derivation). If a "recalculate all my horoscopes" bulk action is desired, it is out of scope here.
2. Should the "reset to defaults" action be per-planet only, or also a bulk "reset all planets" control (US-PA-007 edge case)?
3. **[new]** Auto charts previously displayed **no** house aspects; this feature now populates `houses[].aspectingPlanets` degree-based for every auto chart (including default/unconfigured planets). Confirm that surfacing newly-derived house aspects on existing owned auto charts (via view-time re-derivation, no migration) is an intended, visible behavior change.
4. **[new]** Per-planet degree entry on the manual chart: is it a v1 requirement, or are deterministic fallback degrees acceptable so both-sources aspect application works on every manual chart (recommended — no blocking input, consistent with the no-migration stance)? BA tracks the input-UX scope in US-PA Open Question 7; confirm the PM priority.
5. **[new]** Confirm that existing stored manual horoscopes now surface degree-based aspects (via fallback degrees at owner view-time re-derivation) with no migration — mirroring the auto-chart no-backfill decision.
