# QA Test Plan — Planet Aspects (ග්‍රහ දෘෂ්ඨි) & Rashi Aspects (රාශි දෘෂ්ඨි)

**Date:** 2026-08-10 12:45
**Author:** QA
**Based on:** `specs/business-analysis/20260809-2133-planet-aspects.md` (US-PA-001…007, incl. the 2026-08-11 both-sources clarification), `specs/business-analysis/20260810-0800-rashi-aspects.md` (US-RA-001…007, incl. the 2026-08-11 both-sources clarification), `specs/business-analysis/data-model.md` (PlanetAspects / RashiAspects structures, Aspect Type enum 30–330, Rashi Category, authoritative 12-row Rashi Aspects Rules, `ManualHousePlacements.planetDegrees` + deterministic fallback-degree derivation), `specs/architecture/20260809-2145-planet-aspects.md` (§6.1 module shape, §6.2 aspect algorithms, §6.4 manual path — both aspect arms + fallback degrees, §6.7 owner view re-derivation, §8 settings API, §11 migration, §13 verification, §14 open questions), `specs/ux/20260809-2215-planet-aspects.md` (§4 settings form, §8 tables, §8.1.1 tooltip, §12 i18n, §14 flags), `docs/aspects.md`, `docs/rash_aspects.md`, `src/lib/calculation.ts`, `src/lib/manualChart.ts`, `src/lib/astrology.ts`, `src/models/User.ts`, `src/app/api/settings/route.ts`

---

## Scope

This test plan covers two related features that change how house and planet aspects are calculated and displayed:

1. **Planet Aspects (දෘෂ්ඨි) setting** — per-user `User.planetAspects`: per-planet configured aspect **houses** (absolute) and aspect **degrees** (multiples of 30 in 30–330) that drive house-aspect and planet-aspect calculation, with the user's `planetaryOrbs` as the orb tolerance:
   - Pure module `src/lib/planetAspects.ts` (NEW — defaults, resolution, validation, `computePlanetAspects`, `computeHouseAspectsByPlanet`/`computeHouseAspectsByHouse`, `computeManualHouseAspects`)
   - `GET`/`PUT /api/settings` round-trip (`planetAspects` + `rashiAspects` added)
   - `POST /api/horoscope`, `PUT /api/horoscope/[id]` (recalc), `PUT /api/horoscope/[id]/manual-chart` (apply setting)
    - `GET /api/horoscope/[id]` owner view-time re-derivation (both `source: "auto"` and `source: "manual"`, not persisted; manual uses stored/fallback per-planet degrees)
   - Settings form + planets/houses table aspect chips + tooltip (multi-reason)
2. **Rashi Aspects (රාශි දෘෂ්ඨි) setting** — per-user `User.rashiAspects`: `{ enabled, overrides }` master switch for the fixed Chara/Thira/Ubaya sign-to-sign drishti rules; when enabled, an **additional (union) source** of house/planet aspects with the aspecting planet's degree + `planetaryOrbs` ("rashmi") governing effectiveness; tooltip renders every distinct reason on its own line.

**In scope:** settings validation, pure-function aspect/degree/rashi calculation, settings API round-trips, calculation integration, owner view re-derivation, manual chart path, tooltip multi-line rendering (SI/EN), accessibility, backward compatibility of the defaults path.

**Out of scope:** chart SVG rendering (data-only by design — Architect D2/AD-2), RAG search, privacy toggling, ephemeris calculation internals, migration/backfill of stored `CalculatedDetails`, aspect-line chart drawing (future feature).

> **NOTE — Rashi architecture gap:** there is NO dedicated "Rashi Aspects" architecture spec yet. This plan uses the BA Rashi stories + `data-model.md` + UX spec as the technical baseline; where the architecture is undecided (reason marker shape, rashi arm `degreeGap`/matched angle storage, Ubaya tie-break for Virgo/Sagittarius/Pisces) the affected cases are **flagged** and treated as blocked/pending confirmation (see §9 "What cannot be tested" and §10 Questions). Manual-chart rashi application is NO LONGER blocked: per the 2026-08-11 clarification both sources feed the same pure functions, with manual charts using stored or fallback-derived per-planet degrees (see §1.7, §3.4).

## Test Strategy

| Level | Scope | Tool/Framework | Test IDs |
|-------|-------|----------------|----------|
| Unit | Pure functions — `src/lib/planetAspects.ts` (defaults, validation, planet aspects, degree-based house aspects, manual house aspects) and rashi rule derivation (category, nearest exclusion, 12-row lookup, union/reason markers) | Jest + ts-jest, node env, `@/` → `src/` (jest.config.js moduleNameMapper) | `UT-PA-*`, `UT-RA-*` |
| Integration / API | `GET`/`PUT /api/settings`, `POST /api/horoscope`, `GET /api/horoscope/[id]` (owner re-derive vs snapshot), `PUT /api/horoscope/[id]`, `PUT /api/horoscope/[id]/manual-chart`; mocked `getServerSession` + mocked `connectDB` (reuse patterns from `auth.test.ts`/`privacy.test.ts`) | Jest + Supertest | `IT-AS-*`, `SC-AS-*` |
| Component / UI | Settings form (9 rows, chips, pills, reset, dirty state, validation), table aspect chips + `AspectReasonTooltip` single/multi-reason rendering | Playwright / RTL (as available) | `UI-AS-*`, `AX-AS-*`, `BI-AS-*` |
| E2E | Full user flows: configure → save → open own horoscope → verify re-derived aspects + multi-line tooltip; enable rashi → verify rashi reason lines | Playwright | `E2E-AS-*` |
| Manual | Golden-data regeneration, visual tooltip states (SI/EN), locale parity, stale-copy scan ("others → 7th") | Manual + golden fixtures | — |

**Approach:** all calculation and validation logic lives in pure modules (no I/O, no ephemeris) — unit tests assert against numeric enum inputs directly. API tests focus on round-trip persistence, all-or-nothing 400s, auth, and the owner-snapshot split. UI tests verify the tooltip string templates character-for-character (delta exactly once) in both locales.

## Test Environment

| Environment | Configuration |
|-------------|---------------|
| Unit | Jest + ts-jest, node env, `@/` → `src/` (jest.config.js moduleNameMapper) |
| Integration | API route handlers with mocked `getServerSession` + mocked `connectDB` (reuse patterns from `auth.test.ts`/`privacy.test.ts`) |
| E2E | Playwright — settings → horoscope detail flows |
| Golden | Versioned JSON fixtures under `src/__tests__/fixtures/` (era-stamped, e.g. `aspects-default-2026-08.json`) |

---

## 1. Unit Tests — Planet Aspects (pure, `src/lib/planetAspects.ts`)

### 1.1 Defaults Resolution & Offsets (US-PA-007, US-PA-005 AC3, data-model defaults)

| ID | Test Case | Input | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UT-PA-001 | SUN default houses/degrees | planet=1 (SUN), no entry | houses `[3,5,7,9,10]`, degrees `[60,90,120,180]` | US-PA-007 |
| UT-PA-002 | MOON default houses/degrees | planet=2 (MOON), no entry | houses `[3,5,7,9,10]`, degrees `[60,90,120,180]` | US-PA-007 |
| UT-PA-003 | MARS/MERCURY default houses | planet=3 and 4, no entry | houses `[4,5,7,8,9]` | US-PA-007 |
| UT-PA-004 | JUPITER/VENUS/RAHU/KETU default houses | planets 5,6,8,9, no entry | houses `[5,7,9]` | US-PA-007 |
| UT-PA-005 | SATURN default houses | planet=7 (SATURN), no entry | houses `[3,5,7,9,10]` | US-PA-007 |
| UT-PA-006 | ALL 9 planets resolve a default — no `[7]` gap | planets 1–9, empty map | `resolveAspectHouses` returns a non-empty list for every planet 1–9; the legacy "others → 7" fallback is unreachable | US-PA-007 |
| UT-PA-007 | Default houses resolve as OFFSETS from the planet's whole-sign house | planet=1 (SUN defaults `[3,5,7,9,10]`), house=4 | effective houses `[6,8,10,12,1]` via `((house−1+offset−1)%12)+1` | US-PA-005 AC3 |
| UT-PA-008 | Default offsets wrap mod-12 | planet=7 (SATURN), house=12 | offsets `[3,5,7,9,10]` → `[2,4,6,8,9]` | US-PA-005 AC3 |
| UT-PA-009 | Default degrees identical for all planets | planets 1–9 | degrees `[60,90,120,180]` | US-PA-007 |
| UT-PA-010 | Configured entry overrides defaults | entry `{ houses:[3,7,10], degrees:[60,180,240] }` for planet 1 | resolution returns the entry values, not defaults | US-PA-005 |
| UT-PA-011 | Default resolution never depends on `planetaryOrbs` | empty orbs map | defaults still resolve (fallback `?? 0` orb for a house-`houses` arm) | US-PA-005 |

### 1.2 Payload Validation — Houses (US-PA-002)

| ID | Test Case | Input | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UT-PA-020 | Valid houses accepted | `{ "1": { houses:[3,7,10], degrees:[60,180,240] } }` | ok; stored as given | US-PA-002 |
| UT-PA-021 | House 0 rejected | houses `[0,7,10]` | error, no partial value | US-PA-002 |
| UT-PA-022 | House 13 rejected | houses `[7,13]` | error | US-PA-002 |
| UT-PA-023 | House 3.5 (non-integer) rejected | houses `[3.5]` | error | US-PA-002 |
| UT-PA-024 | House 1 accepted (lower boundary) | houses `[1]` | ok | US-PA-002 |
| UT-PA-025 | House 12 accepted (upper boundary) | houses `[12]` | ok | US-PA-002 |
| UT-PA-026 | Duplicate houses rejected | houses `[7,7]` | error | US-PA-002 |
| UT-PA-027 | Empty houses rejected | houses `[]` | error (≥1 house required) | US-PA-002 |
| UT-PA-028 | Non-number house rejected | houses `["7"]` | error | US-PA-002 |

### 1.3 Payload Validation — Degrees (US-PA-003)

| ID | Test Case | Input | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UT-PA-030 | Valid degree set accepted | degrees `[60,180,240]` | ok | US-PA-003 |
| UT-PA-031 | Degree 30 accepted (lower boundary) | degrees `[30]` | ok | US-PA-003 |
| UT-PA-032 | Degree 0 rejected | degrees `[0,60]` | error (0° conjunction not configurable) | US-PA-003 |
| UT-PA-033 | Degree 15 rejected (not multiple of 30) | degrees `[15,60]` | error | US-PA-003 |
| UT-PA-034 | Degree 45 rejected (not multiple of 30) | degrees `[45]` | error | US-PA-003 |
| UT-PA-035 | Degree 360 rejected | degrees `[60,360]` | error | US-PA-003 |
| UT-PA-036 | Degree 330 accepted (upper boundary) | degrees `[330]` | ok | US-PA-003 |
| UT-PA-037 | Extended angles accepted | degrees `[210,240,270,300,330]` | ok (all in VALID_ASPECT_DEGREES) | US-PA-003 |
| UT-PA-038 | Duplicate degrees rejected | degrees `[60,60]` | error | US-PA-003 |
| UT-PA-039 | Empty degrees rejected | degrees `[]` | error (≥1 degree required) | US-PA-003 |
| UT-PA-040 | Non-number degree rejected | degrees `["60"]` | error | US-PA-003 |

### 1.4 Payload Validation — Keys & All-or-Nothing (US-PA-001, §8.2)

| ID | Test Case | Input | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UT-PA-041 | Key `"0"` rejected | `{ "0": {...} }` | error | US-PA-001 |
| UT-PA-042 | Key `"10"` rejected | `{ "10": {...} }` | error | US-PA-001 |
| UT-PA-043 | All 9 keys accepted | `"1"`…`"9"` | ok | US-PA-001 |
| UT-PA-044 | One bad entry rejects whole payload | `"1"` valid, `"2"` has empty houses | error — nothing partially accepted | US-PA-001 |
| UT-PA-045 | Missing houses in an entry rejected | `{ "1": { degrees:[60] } }` | error | US-PA-001 |
| UT-PA-046 | Missing degrees in an entry rejected | `{ "1": { houses:[3] } }` | error | US-PA-001 |
| UT-PA-047 | Out-of-order arrays normalized ascending | houses `[10,3,7]` | stored `[3,7,10]` | US-PA-001 |
| UT-PA-048 | Reset via `{}` / omitted key accepted | `{}` | ok — all planets use defaults | US-PA-007 |

### 1.5 Planet-to-Planet Matching (US-PA-006, §6.2 D5)

| ID | Test Case | Input | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UT-PA-050 | Only configured degrees considered | Ravi `degrees:[60,180,240]`, target at 90° separation (within orb 15) | NO aspect recorded (90° not a candidate) | US-PA-006 |
| UT-PA-051 | Happy path — configured degree matches | Ravi `degrees:[60,180,240]`, target 62.5° away, orb 15 | aspect recorded: `aspectType 60`, `exactAspectDegree 60`, `degreeGap 2.5` | US-PA-006 |
| UT-PA-052 | Orb = aspecting planet's `planetaryOrbs` | aspecting orb 15; gap 15 (inclusive) vs gap 15.5 | gap 15 recorded; gap 15.5 NOT recorded (`degreeGap <= orb`) | US-PA-006 |
| UT-PA-053 | Orb=0 exact match | Rahu (orb 0), target at exactly 60° | recorded; target off by any tiny delta NOT recorded | US-PA-006 |
| UT-PA-054 | Conjunction (0°) always a candidate | no configured degrees; target co-located within orb | conjunction aspect `aspectType 0` recorded | US-PA-006 |
| UT-PA-055 | Tie-break — smaller angle wins | candidates `[60,90]`, rawDist 75 (equidistant) | nearest = 60 (smaller angle) | US-PA-006 |
| UT-PA-056 | Extended angles recorded correctly | degrees `[210,240,270,300,330]` each matched | aspectType/exactAspectDegree = matched angle | US-PA-006 |
| UT-PA-057 | degreeGap = minor-arc minus nearest, rounded 2dp | rawDist 62.55, nearest 60 | degreeGap 2.55 | US-PA-006 |
| UT-PA-058 | isBeneficial only for 60/120 | angle 60/120 vs 30/90/150/180/210/240/270/300/330 | true only for 60 and 120 | US-PA-006 |
| UT-PA-059 | Minor arc used for distance | absolute separation 350° → minor 10° | matches against 0 (conjunction) with gap 10 | US-PA-006 |
| UT-PA-060 | No configured degree matches → no aspect (unless conjunction) | degrees `[90]`, target 30° away, orb 8 | no aspect | US-PA-006 |
| UT-PA-061 | Unconfigured planet → default degrees `[60,90,120,180]` + default orb | no entry, target 62.5° away | aspect 60 with default orb applied | US-PA-006 |

### 1.6 Degree-Based House-Aspect Matching (auto, US-PA-005, §6.2 D4/D5)

| ID | Test Case | Input | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UT-PA-070 | Aspect points in BOTH directions (`abs + d` and `abs − d`) | planet abs 100°, d=60 | points {160°, 40°}; a house middle near EITHER point is aspected | US-PA-005 |
| UT-PA-071 | Mod-360 wrap of aspect point | planet abs 350°, d=60 | point 410° → 50°; house at middle 50° aspected | US-PA-005 |
| UT-PA-072 | Wrap on the minus side | planet abs 10°, d=60 | point −50° → 310° | US-PA-005 |
| UT-PA-073 | House absolute middle degree | house `middleSign=5, middleDegree=15` | midAbs = (5−1)*30 + 15 = 135 | US-PA-005 |
| UT-PA-074 | Orb boundary at house middle — inclusive | gap exactly == orb | house ASPECTED (`≤ orb`) | US-PA-005 |
| UT-PA-075 | Just beyond orb — rejected | gap == orb + 0.01 | house NOT aspected via degree arm | US-PA-005 |
| UT-PA-076 | Explicit houses arm applies unconditionally | house in configured `houses` but far from every aspect point | house still aspected (explicit arm) | US-PA-005 |
| UT-PA-077 | Union dedup + ascending sort | house matched by both arms | stored once; result sorted ascending | US-PA-005 |
| UT-PA-078 | Legacy house without usable `middleDegree` | house lacks `middleDegree`/`middleSign` | degree arm SKIPPED for that house; explicit arm still applies | US-PA-005 |
| UT-PA-079 | Unconfigured planet — defaults drive the degree arm | default degrees `[60,90,120,180]` + default orbs + default houses as offsets | union of offset-houses arm + degree arm (never empty for unconfigured auto charts) | US-PA-005 AC3 |
| UT-PA-080 | All 12 houses configured | `houses:[1..12]` | all 12 houses aspected | US-PA-005 |
| UT-PA-081 | Conjunction (0°) is NOT a degree-arm point | planet in house 3, house 3 not in `houses` list | own house NOT aspected (no 0° point; no degree÷30 mapping) | US-PA-005 |
| UT-PA-082 | Transpose consistency | same inputs | `computeHouseAspectsByPlanet` (planet→houses) and `computeHouseAspectsByHouse` (house→planets) agree | US-PA-005 |
| UT-PA-083 | Placidus middleSign may skip/repeat a sign | house `middleSign` differing from whole-sign `sign` | degree arm uses `middleSign`/`middleDegree` (not whole-sign `sign`) | US-PA-005 |

### 1.7 Manual House & Planet Aspects — Both Arms (Union) (US-PA-005 AC2/AC3, US-PA-006 AC3, §6.4)

> Per the 2026-08-11 clarification, manual charts run the SAME two arms as auto charts (explicit `houses` ∪ degree arm) plus rashi when enabled, feeding the shared pure functions with each planet's stored or fallback-derived degree. The manual house-middle reference for the degree arm is the whole-sign sign midpoint `(sign−1)*30+15` (open question: bhava cusps when `lagnaDegree` is recorded — flagged, UT-PA-100).

| ID | Test Case | Input | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UT-PA-090 | Configured `houses` apply as ABSOLUTE numbers on manual charts | planet houseOfPlanet, entry `houses:[3,7,10]` | explicit arm = `[3,7,10]` regardless of the planet's own house (union includes these) | US-PA-005 AC2 |
| UT-PA-091 | Default fallback on manual charts = new table as offsets | no entry, planet=MARS house 4 | explicit arm from offsets `[4,5,7,8,9]` → `[7,8,10,11,12]` (unioned with the degree arm) | US-PA-005 AC2 |
| UT-PA-092 | Degree arm runs on manual charts — entered `planetDegrees` | planet=1 (SUN), entered degree 5°, entry `degrees:[60]`, house sign 3 (sign midpoint 75°) | aspect points {65°, 305°}; house sign 3 mid 75° → gap 10 ≤ SUN orb → house aspected via degree arm (union with explicit arm); `degrees` DO affect manual houses | US-PA-005 AC2 |
| UT-PA-093 | Manual path consumes `DEFAULT_ASPECT_HOUSES` (single source) | `computeAspects(houseOfPlanet, planetAspects?)` | no hardcoded OLD table (MARS 4/8/12 etc.) remains — `manualChart.ts` delegates to the new module | US-PA-007 |
| UT-PA-094 | Fallback degree = navamsa segment midpoint when navamsa sign recorded | planet=MARS, birthSign=1, navamsa sign recorded | absoluteDegree = `(birthSign−1)*30 + (navamsaIndex−0.5)*NAVAMSA_ARC` (equals `deriveNavamsaData.absoluteDegreeMidpoint`); entered `planetDegrees` always takes precedence | US-PA-005 AC3 |
| UT-PA-095 | Fallback degree = sign midpoint 15° when no navamsa sign | planet=MARS, birthSign=1, no navamsa sign | absoluteDegree = `(birthSign−1)*30 + 15` = 15 | US-PA-005 AC3 |
| UT-PA-096 | Manual house-middle reference = whole-sign sign midpoint | any house, sign=5 | `midAbs = (sign−1)*30 + 15` = 135; `computeManualHouseAspects` builds `{ middleSign: sign, middleDegree: 15 }` houses and delegates to `computeHouseAspectsByPlanet` (no duplicated matching logic) | §6.4 |
| UT-PA-097 | Manual planet-to-planet aspects run via `computeManualPlanetAspects` | planets with entered degrees, entry `degrees:[60,180,240]` | delegates to `computePlanetAspects` with absolute degrees; aspect recorded iff `degreeGap <= orb` of the configured candidate angle | US-PA-006 AC3 |
| UT-PA-098 | Manual house aspects = union (explicit ∪ degree), dedup + sorted | house in explicit list AND within orb of an aspect point | stored once; result ascending — identical semantics to the auto path | US-PA-005 AC2 |
| UT-PA-099 | Manual + rashi enabled — rashi drishti on manual houses/planets | planet in Aries (aspected `{5,8,11}`), rashi enabled, whole-sign house/planet signs + stored/fallback degrees | rashi candidate houses/planets from whole-sign `sign`; degree+orb check uses the stored or fallback-derived degree; union with Planet-Aspects reasons, each reason retained | US-RA-004/005 |
| UT-PA-100 | bhava-cusps-vs-whole-sign reference — FLAGGED | manual chart with `lagnaDegree` recorded | whole-sign sign midpoint `(sign−1)*30+15` is used as the manual house-middle reference; whether bhava cusps should be used when a `lagnaDegree` is present is OPEN (§6.4/§14) — test locks the current whole-sign decision, revisit on Architect confirmation | §6.4/§14 |

## 2. Unit Tests — Rashi Aspects (pure, category/exclusion/union derivation)

### 2.1 Category Mapping & Chara/Thira/Ubaya Rules (US-RA-002)

| ID | Test Case | Input | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UT-RA-100 | Chara → Thira candidates | aspecting sign 1 (Aries, Chara) | candidate category = Thira `{2,5,8,11}` (before exclusion) | US-RA-002 |
| UT-RA-101 | Thira → Chara candidates | aspecting sign 2 (Taurus, Thira) | candidate category = Chara `{1,4,7,10}` | US-RA-002 |
| UT-RA-102 | Ubaya → Ubaya candidates | aspecting sign 3 (Gemini, Ubaya) | candidate category = Ubaya `{3,6,9,12}` | US-RA-002 |
| UT-RA-103 | Every sign belongs to exactly one category | signs 1–12 | no overlap/gap across Chara `{1,4,7,10}`, Thira `{2,5,8,11}`, Ubaya `{3,6,9,12}` | US-RA-002 |
| UT-RA-104 | Category mapping fixed (never per-student) | repeated calls | identical mapping every time (pure, deterministic) | US-RA-002 |
| UT-RA-105 | Zodiac wrap 12↔1 in category membership | signs 12 (Pisces) and 1 (Aries) | Pisces=Ubaya, Aries=Chara; derivation handles the wrap | US-RA-002 |
| UT-RA-106 | Aspected set never empty | any aspecting sign | ≥2 aspected signs always | US-RA-002 |

### 2.2 Nearest-Rashi Exclusion & Full 12-Row Lookup (US-RA-003)

| ID | Test Case | Input | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UT-RA-110 | Aries excludes Taurus | aspecting sign 1 | aspected set `{5,8,11}`; Taurus (2) NOT included | US-RA-003 |
| UT-RA-111 | Taurus excludes Aries | aspecting sign 2 | aspected set `{4,7,10}`; Aries (1) NOT included | US-RA-003 |
| UT-RA-112 | Gemini excludes Pisces (Ubaya tie-break, higher sign excluded) | aspecting sign 3 | aspected set `{6,9}`; Pisces (12) NOT included | US-RA-003 |
| UT-RA-113 | Full 12-row lookup matches authoritative table | aspecting signs 1–12 | matches data-model Rashi Aspects Rules table row-for-row (incl. Cancer `{2,8,11}`, Libra `{2,5,11}`, Capricorn `{2,5,8}`, Leo `{1,7,10}`, Scorpio `{1,4,10}`, Aquarius `{1,4,7}`, Virgo `{3,12}`, Sagittarius `{3,6}`, Pisces `{3,6}`) | US-RA-003 |
| UT-RA-114 | Adjacent non-target-category sign never drives exclusion | aspecting sign 3 (Gemini) neighbours Taurus(2)/Cancer(4) are NOT Ubaya | exclusion comes only from the Ubaya arc-distance tie, never adjacency | US-RA-003 |
| UT-RA-115 | Self-exclusion | every sign | a sign is never in its own aspected set | US-RA-003 |
| UT-RA-116 | Determinism | any aspecting sign, repeated calls | identical aspected set every time | US-RA-003 |

### 2.3 Rashi Aspects Applied to House Aspects (US-RA-004)

| ID | Test Case | Input | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UT-RA-120 | Houses of aspected rashis aspected | planet in Aries (aspected `{5,8,11}`), rashi enabled | every house whose whole-sign `sign` ∈ {5,8,11} is a rashi candidate | US-RA-004 |
| UT-RA-121 | Degree + orb still govern (in-range) | candidate house middle within aspecting planet's orb of the relevant aspect point | rashi house aspect recorded | US-RA-004 |
| UT-RA-122 | Degree + orb still govern (out-of-range) | candidate house outside the orb | NO rashi house aspect recorded | US-RA-004 |
| UT-RA-123 | House sign not in aspected set → no rashi reason | house sign = 1 (Aries), planet in Aries | not aspected via rashi (may still be aspected via Planet-Aspects arm) | US-RA-004 |
| UT-RA-124 | Union with Planet-Aspects-setting reasons retained | house aspected by both arms | house aspected once; BOTH reasons retained (rendered as separate tooltip lines) | US-RA-004 |
| UT-RA-125 | Whole-sign (Rasi) sign drives candidate set; Placidus middle degree feeds the orb check | house `sign=5`, `middleSign` differs | candidate set uses whole-sign `sign`; effectiveness uses stored middle degree | US-RA-004 |
| UT-RA-126 | Manual chart — rashi house aspects via whole-sign sign + stored/fallback degree | planet in Aries (aspected `{5,8,11}`), rashi enabled, manual houses with whole-sign `sign` | candidate manual houses from whole-sign `sign`; degree+orb check on stored `planetDegrees` (else fallback navamsa-midpoint / sign-midpoint degree); rashi reason retained alongside the Planet-Aspects reason | US-RA-004, US-RA-004 edge "Both chart sources" |

### 2.4 Rashi Aspects Applied to Planet Aspects (US-RA-005)

| ID | Test Case | Input | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UT-RA-130 | Planets in aspected rashis are candidates | planet in Aries (aspected `{5,8,11}`), rashi enabled | every other planet whose `sign` ∈ {5,8,11} is a rashi candidate | US-RA-005 |
| UT-RA-131 | Orb governs effectiveness | candidate planet within orb vs beyond orb | recorded / not recorded using aspecting planet's `planetaryOrbs` | US-RA-005 |
| UT-RA-132 | Same-sign planets never rashi-aspect each other | both planets in Aries | no rashi reason (own sign never in aspected set) | US-RA-005 |
| UT-RA-133 | Conjunction unchanged | co-located planets | conjunction handled independently of rashi (no dependency) | US-RA-005 |
| UT-RA-134 | One candidate per aspected-sign target, each orb-checked | planet in Aries; targets in Leo, Scorpio, Aquarius | separate candidates per target sign, each evaluated with degree + orb | US-RA-005 |
| UT-RA-135 | Retrograde/combustion do not add/remove rashi reason | target retrograde/combust | rashi reason unaffected | US-RA-005 |
| UT-RA-136 | Manual chart — rashi planet aspects via whole-sign sign + stored/fallback degree | planet in Aries (aspected `{5,8,11}`), rashi enabled, manual planets | candidate manual planets from whole-sign `sign`; degree+orb check on stored/fallback `planetDegrees`; same-sign planets never rashi-aspect each other | US-RA-005, US-RA-005 edge "Both chart sources" |

### 2.5 Composition, Reason Markers & Disabled State (US-RA-001, US-RA-006, US-RA-007)

| ID | Test Case | Input | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UT-RA-140 | Aspect output carries reason/source data | aspect with planetary + rashi reasons | response distinguishes reason per line (e.g. `reason: "planetary" | "rashi"` or a `reasons[]` list — exact shape pending Architecture) | US-RA-006 |
| UT-RA-141 | Aspect aspected by both mechanisms retained once with both reasons | target aspected both ways | single aspect record, both distinct reasons present, no duplication | US-RA-006 |
| UT-RA-142 | Same reason never duplicated | one planetary + one rashi reason | each distinct reason appears exactly once | US-RA-006 |
| UT-RA-143 | Reason ordering — planetary before rashi | aspect with both | planetary reason precedes rashi reason(s) in the output | US-RA-006 |
| UT-RA-144 | Setting disabled → identical to Planet-Aspects-only | `rashiAspects.enabled=false` | output equals the enabled=false baseline (backward compatible) | US-RA-001 |
| UT-RA-145 | Default `rashiAspects` state | no stored setting | `{ enabled:false, overrides:{} }` | US-RA-001 |
| UT-RA-146 | Reset behaves like never-configured | reset `rashiAspects` | `{ enabled:false, overrides:{} }`; no rashi reasons until re-enabled | US-RA-007 |

---

## 3. Integration / API Tests

### 3.1 `GET`/`PUT /api/settings` Round-Trip (US-PA-001, US-RA-001, §8)

| ID | Test Case | Expected | Maps to |
|----|-----------|----------|---------|
| IT-AS-200 | GET returns `{ planetaryOrbs, planetAspects, rashiAspects }` | 200 with all three keys present | US-PA-001, US-RA-001 |
| IT-AS-201 | GET unconfigured `planetAspects` → `{}` | empty map; form renders defaults via `resolveAspectHouses/Degrees` | US-PA-001 |
| IT-AS-202 | PUT valid `planetAspects` → 200, persisted | subsequent GET returns the stored map | US-PA-001 |
| IT-AS-203 | PUT `planetaryOrbs` + `planetAspects` together | both persisted atomically | US-PA-001 |
| IT-AS-204 | PUT `rashiAspects: { enabled: true }` → 200 | persisted; GET reflects enabled=true | US-RA-001 |
| IT-AS-205 | PUT invalid houses (0/13/3.5) → 400, no partial save | GET after 400 shows pre-existing state unchanged | US-PA-002 |
| IT-AS-206 | PUT invalid degrees (45/360/15) → 400, no partial save | GET unchanged | US-PA-003 |
| IT-AS-207 | PUT duplicate houses/degrees → 400 | GET unchanged | US-PA-002/003 |
| IT-AS-208 | PUT empty `houses`/`degrees` → 400 | GET unchanged | US-PA-002/003 |
| IT-AS-209 | PUT non-planet key (`"0"`/`"10"`) → 400 | GET unchanged | US-PA-001 |
| IT-AS-210 | PUT malformed entry (e.g. strings instead of arrays) → 400 | GET unchanged (defense-in-depth vs client) | US-PA-001 |
| IT-AS-211 | Reset a single planet — omit its key | planet behaves as unconfigured (defaults) | US-PA-007 |
| IT-AS-212 | Bulk reset — PUT `planetAspects: {}` | GET returns empty map; all planets use defaults | US-PA-007 |
| IT-AS-213 | PUT with only `planetaryOrbs` (no aspects) | 200, orbs updated, aspects untouched (existing behavior preserved) | US-PA-001 |
| IT-AS-214 | PUT with neither field (empty body) | 400 | US-PA-001 |
| IT-AS-215 | Unauthenticated GET/PUT | 401 | US-PA-001, US-RA-001 |
| IT-AS-216 | Save → re-open (round-trip persistence) | stored map survives repeated GETs | US-PA-001 |
| IT-AS-217 | Rapid successive PUTs (5 saves, one invalid) | 400 aborts with no partial state; valid saves apply cleanly | US-PA-004 |

### 3.2 Calculation Integration — `POST /api/horoscope` (US-PA-004/005/006, US-RA-004/005)

| ID | Test Case | Expected | Maps to |
|----|-----------|----------|---------|
| IT-AS-220 | Configured `planetAspects` applied on create | `planets[].aspects` restricted to configured angles with `aspectType`/`exactAspectDegree` correct | US-PA-004 |
| IT-AS-221 | `houses[].aspectingPlanets` populated | matches union of explicit `houses` arm + degree arm for the owner's setting | US-PA-005 |
| IT-AS-222 | No setting → defaults path (backward compatible) | aspects computed from default degrees `[60,90,120,180]` + default orbs + new default table; conjunction present | US-PA-005/006 |
| IT-AS-223 | Conjunction aspects still recorded | co-located/within-orb planets | US-PA-006 |
| IT-AS-224 | Rashi enabled → rashi-derived aspects present | house/planet aspects include rashi reasons; disabled → absent | US-RA-004/005 |
| IT-AS-225 | Rashi disabled (default) → output identical to pre-feature | no rashi reasons in created horoscope | US-RA-001 |

### 3.3 Owner View Re-Derivation — `GET /api/horoscope/[id]` (US-PA-004 edge, D3/§6.7)

| ID | Test Case | Expected | Maps to |
|----|-----------|----------|---------|
| IT-AS-230 | Setting change reflects on owner's own auto horoscope | change `planetAspects` → GET as owner returns re-derived `planets[].aspects` + `houses[].aspectingPlanets` (not persisted) | US-PA-004 |
| IT-AS-231 | Non-owner sees stored snapshot unchanged | different user (public horoscope) → GET returns stored `CalculatedDetails` aspects | US-PA-004 |
| IT-AS-232 | Re-derivation for owner on BOTH sources | owner + `source:"auto"` → re-derived degree-based union (`aspectingPlanets`); owner + `source:"manual"` → re-derived per-house `aspects`/`planets[].aspects` via stored or fallback-derived per-planet degrees; non-owner → stored snapshot, never re-derived | US-PA-004 |
| IT-AS-233 | No migration — stored `CalculatedDetails` untouched | settings change → DB document unchanged; only the owner GET response overrides in memory | US-PA-004 |
| IT-AS-234 | Re-derived value agrees with a fresh recalc | owner GET re-derived aspects == aspects from `calculateHoroscope` with the same setting | US-PA-004 |
| IT-AS-235 | Rashi enabled affects owner re-derivation | toggle `rashiAspects.enabled` → owner GET reflects rashi reasons without recalculation | US-RA-004/005 |

### 3.4 Recalculation & Manual Chart Paths (both sources — 2026-08-11 clarification)

| ID | Test Case | Expected | Maps to |
|----|-----------|----------|---------|
| IT-AS-240 | `PUT /api/horoscope/[id]` recalc applies latest setting | updated `CalculatedDetails` reflect current `planetAspects` + `rashiAspects` | US-PA-004 |
| IT-AS-250 | Manual chart honors configured `houses` (absolute) | `PUT /api/horoscope/[id]/manual-chart` → per-house `aspects` include configured list (explicit arm) | US-PA-005 AC2 |
| IT-AS-251 | Manual chart default fallback (offsets) | no entry → new 9-planet table offsets form the explicit arm (unioned with the degree arm) | US-PA-005 AC2 |
| IT-AS-252 | Manual chart degree arm with entered `planetDegrees` | request includes `planetDegrees` → per-house `aspects` = explicit arm ∪ degree arm (aspect points vs whole-sign sign midpoints within orb); planet-to-planet aspects also computed; entered degrees always take precedence | US-PA-005 AC2/AC3 |
| IT-AS-253 | Manual chart without `planetDegrees` → fallback degrees | omitted degrees → deterministic fallback (navamsa segment midpoint when the navamsa sign is recorded, else sign midpoint 15°); BOTH arms + planet-to-planet aspects still computed from the fallback | US-PA-005 AC2/AC3 |
| IT-AS-254 | Manual chart + rashi enabled | `PUT .../manual-chart` with owner `rashiAspects.enabled=true` → rashi drishti applied to manual houses/planets with the degree+orb check on stored/fallback degrees; reasons unioned with Planet-Aspects reasons | US-RA-004/005 |
| IT-AS-255 | `planetDegrees` validation | 400 on degree < 0, degree ≥ 30, non-number, non-planet key (`"0"`/`"10"`), or malformed map; nothing partially saved; valid `planetDegrees` (0 ≤ d < 30, keys `"1"`–`"9"`, numbers only) accepted | US-PA-005 AC2 |
| IT-AS-256 | Cross-source consistency | identical birth data entered as auto (matching degrees) vs manual (entered `planetDegrees`) → identical planet-to-planet, house, and rashi aspects | §6.4/§13 |
| IT-AS-257 | Legacy stored manual chart (no `planetDegrees`, no aspects fields) | owner `GET /api/horoscope/[id]` → re-derivation applies fallback degrees + both aspect arms (not persisted); non-owner → stored snapshot; NO migration/backfill of `CalculatedDetails` | US-PA-004, §11 |
| IT-AS-258 | Manual owner view re-derivation reflects latest setting + rashi toggle | change `planetAspects`/`rashiAspects.enabled` → owner `GET` on a manual horoscope returns re-derived per-house `aspects`/`planets[].aspects` without recalculation | US-PA-004, US-RA-004/005 |

---

## 4. Schema / Model Tests

| ID | Test Case | Expected | Maps to |
|----|-----------|----------|---------|
| SC-AS-260 | `User.planetAspects` defaults to `{}` | additive `Schema.Types.Mixed` default `{}` | US-PA-001 |
| SC-AS-261 | `User.rashiAspects` defaults to `{ enabled:false, overrides:{} }` | additive default; backward compatible | US-RA-001 |
| SC-AS-262 | `planetAspects` stores only validated shapes | invalid shapes never persist (service/model guard) | US-PA-001 |
| SC-AS-263 | Legacy users without the new fields resolve defaults | absent fields → defaults path, no crash | US-PA-007, US-RA-001 |
| SC-AS-264 | `houses[].aspectingPlanets` optional/absent on legacy docs | legacy `CalculatedDetails` render empty; owner view re-derives | US-PA-005 |

---

## 5. Component / UI Tests

### 5.1 Settings Form (US-PA-001/002/003/007, US-RA-001/007, UX §4)

| ID | Test Case | Expected | Maps to |
|----|-----------|----------|---------|
| UI-AS-270 | All 9 planet rows render with defaults filled | no empty state; every planet shows default houses + `[60,90,120,180]` | US-PA-001 |
| UI-AS-271 | Default/Custom pill reflects edit state | Default row → edit → pill flips Custom (semantics differ even if numbers match defaults) | US-PA-001 |
| UI-AS-272 | Chips structurally limit houses 1–12 / degrees 30–330 step 30 | no out-of-domain value selectable | US-PA-002/003 |
| UI-AS-273 | At-least-one validation blocks save | deselect all houses → inline error, Save disabled, focus to offending row; clears live | US-PA-002/003 |
| UI-AS-274 | Per-planet reset reverts row (staged); bulk reset uses confirmation modal | reset not persisted until Save; bulk modal cancel/confirm | US-PA-007 |
| UI-AS-275 | Dirty indicator + save flow | "Unsaved changes (n planets)" appears; Save → "Settings saved" → dirty clears | US-PA-001 |
| UI-AS-276 | Server 400 → section banner, state preserved | no partial save; form values retained | US-PA-002/003 |
| UI-AS-277 | Rashi Aspects setting renders with rule summary + toggle | Chara/Thira/Ubaya summary displayed; toggle ON/OFF; default OFF | US-RA-001 |
| UI-AS-278 | Rashi toggle save + reset | enable → saved; reset → `{enabled:false}`; already-default → no-op toast | US-RA-001/007 |

### 5.2 Aspect Tooltip — Compact Reason Lines (US-RA-006, UX §8.1.1)

| ID | Test Case | Expected | Maps to |
|----|-----------|----------|---------|
| UI-AS-280 | Single planetary reason — SI | `ග්‍රහ දෘෂ්ඨි 7 (180) (+02:05:00)` | US-PA-006, US-RA-006 |
| UI-AS-281 | Single planetary reason — EN | `Planet drishti 7 (180) (+02:05:00)` | US-RA-006 |
| UI-AS-282 | Single rashi reason — SI + EN | `රාශි දෘෂ්ඨි මේෂ → මිථුන (+02:05:00)` / `Rashi drishti Aries → Gemini (+02:05:00)` (no angle) | US-RA-006 |
| UI-AS-283 | Multi-reason — delta EXACTLY once | planetary + rashi: `ග්‍රහ දෘෂ්ඨි 7 (180)` + `රාශි දෘෂ්ඨි මේෂ → මිථුන` + `Δ +02:05:00` (hairline footer) — no delta on any reason line, in both locales | US-RA-006 |
| UI-AS-284 | Three reasons — one line each + ONE footer | planetary + 2 rashi lines + single `Δ` footer | US-RA-006 |
| UI-AS-285 | Conjunction — house omitted | single: `ග්‍රහ දෘෂ්ඨි (0) (+00:05:00)`; multi planetary line: `ග්‍රහ දෘෂ්ඨි (0)` | US-RA-006 |
| UI-AS-286 | Delta sign + zero-padded `d:mm:ss` | `+02:05:00`, `-00:45:30` per `formatDegree`; sign ahead/behind of aspect point | US-RA-006 |
| UI-AS-287 | Angle appears only on planetary lines | rashi lines never render `(angle)` | US-RA-006 |
| UI-AS-288 | Reason ordering | planetary line(s) before rashi line(s) | US-RA-006 |
| UI-AS-289 | Table chips show planet NAME ONLY | no angle/delta text outside the tooltip in planets/houses tables | US-RA-006 |
| UI-AS-290 | Single-reason tooltip has no footer | inline delta retained; no `Δ` line | US-RA-006 |
| UI-AS-291 | Tooltip interaction | hover (~150ms) / focus / tap; Esc dismisses; viewport-safe flip; one tooltip open at a time; no auto-timeout | US-RA-006 |
| UI-AS-292 | Multi-line wrapping within max-width (280px / 320px SI) | long Sinhala reason lines wrap, not clipped | US-RA-006 |
| UI-AS-293 | Houses-table tooltip `{house}` = aspected row house | always present in houses table | US-PA-005 |
| UI-AS-294 | Planets-table `{house}` = display derivation `((aspectType/30)%12)+1` | NOT a matching-rule change; only display | US-PA-006 |

### E2E Flows

| ID | Flow | Steps | Expected | Maps to |
|----|------|-------|----------|---------|
| E2E-AS-300 | Configure planet aspects end-to-end | Settings → customize Sun houses 3,7,10 + degrees 60,180,240 → Save → create auto horoscope → open detail | planets/houses tables reflect configured aspects; tooltip single-line | US-PA-001..006 |
| E2E-AS-301 | Multi-reason tooltip after enabling rashi | Enable Rashi Aspects → open own horoscope detail → hover a dual-reason aspect chip | planetary + rashi lines + shared `Δ` footer, delta once | US-RA-004..006 |
| E2E-AS-302 | Reset all to defaults | Bulk reset → Save → create horoscope | aspects computed from defaults (new table), no stale copy | US-PA-007 |
| E2E-AS-303 | Invalid setting blocked | Try to save a planet with no houses | inline error, Save disabled, no partial save | US-PA-002 |

---

## 6. Bilingual Testing

| ID | Test Case | Expected |
|----|-----------|----------|
| BI-AS-310 | Settings strings EN/SI parity | all labels, status pills, hints, validation messages render in both locales |
| BI-AS-311 | `astrology.drishti.label` / `rashiLabel` keys | `Planet drishti` / `ග්‍රහ දෘෂ්ඨි`; `Rashi drishti` / `රාශි දෘෂ්ඨි` |
| BI-AS-312 | Rashi sign names localized | SI `මේෂ → මිථුන`, EN `Aries → Gemini` via existing `astrology.signNames.*`; numerals stay Western |
| BI-AS-313 | Extended-angle labels in both locales | `astrology.aspectAngles.30…330` EN/SI keys present (settings form chips only) |
| BI-AS-314 | `en.json` ↔ `si.json` in sync | no missing keys, no hardcoded EN strings in JSX |
| BI-AS-315 | Sinhala width allowance in tooltip | 320px SI max-width; no clipping/overflow |
| BI-AS-316 | Delta footer language-neutral | `Δ +02:05:00` identical in both locales (Western numerals) |

---

## 7. Accessibility Testing

| ID | Test Case | Expected |
|----|-----------|----------|
| AX-AS-320 | Setting chips focusable buttons with `aria-pressed` | keyboard operable, toggle state announced |
| AX-AS-321 | Tooltip keyboard access | focus shows, blur/Esc hides, focus returns to chip |
| AX-AS-322 | SR reads delta EXACTLY once | footer + reason lines are real text nodes; `aria-describedby` on chip → `role="tooltip"`; `title` fallback = same full text (delta once) |
| AX-AS-323 | `→` arrow announced with localized verb | sr-only/aria `astrology.drishti.rashiVerbAria` (EN `aspects` / SI `දකී`) |
| AX-AS-324 | Status pill not color-only | text always present ("Default"/"Custom") |
| AX-AS-325 | Roles/labels + error announcements | `role="group"` + `aria-labelledby`; errors `role="alert"` + `aria-describedby` |
| AX-AS-326 | Contrast | reason lines ≥4.5:1; footer ≥4.5:1; not color-only |
| AX-AS-327 | Motion reduced | 120ms fade/translate disabled under `prefers-reduced-motion` |

---

## 8. Edge & Regression

| ID | Test Case | Expected |
|----|-----------|----------|
| RE-AS-330 | Existing `calculation.test.ts` passes unchanged | defaults path backward compatible (`calculateHoroscope(baseData)` still valid) |
| RE-AS-331 | Existing `birthChart.test.ts` passes unchanged | defaults path — no aspect regressions |
| RE-AS-332 | Legacy auto chart without `aspectingPlanets` | renders empty; owner view re-derives; no crash |
| RE-AS-333 | Manual horoscope detail regression | owner → re-derived per-house `aspects` + `planets[].aspects` (stored/fallback degrees, both arms + rashi when enabled); non-owner → stored snapshot; tables unchanged in shape |
| RE-AS-334 | Search / share / export unchanged | read stored `CalculatedDetails`; no API shape change |
| RE-AS-335 | Setting change while chart open | stale cached values invalidated on next refresh/recalc |
| RE-AS-336 | Placidus unequal-house cusp edge | `middleSign` skip/repeat handled; degree arm uses stored middles |
| RE-AS-337 | No stale "others → 7th" default copy anywhere in UI | grep settings/form copy for old table (Mars 4/8/12 etc.) |
| RE-AS-338 | Concurrency — two tabs editing settings | last write wins; no partial/corrupt state |

---

## Golden-Data Regeneration (Recommendation)

The default-path outputs of the calculation engine CHANGE with this feature, so existing golden fixtures must be regenerated against the new engine and re-frozen:

1. **Orb semantic change** — `degreeGap < 30` (fixed) → `degreeGap <= planetaryOrbs[aspectingPlanet]` (Architect D5/§11). Rahu/Ketu (default orb 0) become strict exact-matches; other planets (default orbs 7–15) are typically stricter than 30. Any test asserting concrete `aspectType`/`degreeGap` values from `calculateHoroscope` is affected.
2. **New 9-planet default table** — default house aspects for auto + manual charts change (Mars no longer 4/8/12; the "others → 7th" fallback is gone; defaults act as offsets, unioned with the degree arm).
3. **New house-aspect output** — auto charts now emit `houses[].aspectingPlanets` (previously none); unconfigured planets still produce house aspects via the union of default-offset houses and default-degree matching.
4. **Rashi goldens** — create separate enabled/disabled fixtures once the architecture decisions below are resolved (reason marker shape, per-reason vs shared `degreeGap`, Ubaya tie-break).
5. **Manual-chart goldens (new — both-sources clarification)** — the degree-based arms now change manual-chart aspect outputs: create fixtures for a manual chart (a) WITH entered `planetDegrees`, (b) WITHOUT → fallback = navamsa segment midpoint, (c) WITHOUT navamsa sign → fallback = sign midpoint 15°, plus rashi-on; assert the union (explicit ∪ degree) and cross-source parity with the auto golden for matching degrees (IT-AS-256).

**Recommended approach:** fix a single reference birth chart; run it through the NEW engine; manually verify the aspects are domain-correct (with BA/domain); store era-stamped fixtures (`src/__tests__/fixtures/aspects-default-2026-08.json`, `...-rashi-on-2026-08.json`, `...-rashi-off-2026-08.json`); add a loud-failure golden assertion so any future defaults change requires an explicit fixture regen.

**Automation commands:**

```bash
pnpm lint                       # 4-space indent, import ordering (prettier sort-imports)
pnpm format                     # prettier --write over src/**/*.{ts,tsx,css,json}
pnpm build                      # production build must stay green
npx jest src/__tests__/planetAspects.test.ts    # UT-PA-* unit tests (proposed)
npx jest src/__tests__/rashiAspects.test.ts     # UT-RA-* unit tests (proposed)
npx jest src/__tests__/aspectsSetting-api.test.ts   # IT-AS-* + SC-AS-* (proposed)
npx jest src/__tests__/calculation.test.ts      # RE-AS-330 regression (defaults path)
npx jest src/__tests__/birthChart.test.ts       # RE-AS-331 regression (defaults path)
npx jest                                       # full suite
```

**Proposed test file layout:**

```
src/__tests__/planetAspects.test.ts            // UT-PA-* (defaults, validation, planet aspects, house aspects, manual chart both arms + fallback degrees)
src/__tests__/rashiAspects.test.ts             // UT-RA-* (category, exclusion, 12-row lookup, union, reasons, disabled, manual rashi)
src/__tests__/aspectsSetting-api.test.ts       // IT-AS-* + SC-AS-* (settings + horoscope + owner re-derive + manual-chart paths)
src/__tests__/aspectsTooltip-ui.test.ts        // UI-AS-* + AX-AS-* + BI-AS-* (if RTL available)
src/__tests__/fixtures/aspects-default-2026-08.json    // golden fixtures (era-stamped)
src/__tests__/fixtures/aspects-rashi-on-2026-08.json
src/__tests__/fixtures/aspects-rashi-off-2026-08.json
src/__tests__/fixtures/aspects-manual-degrees-2026-08.json    // manual chart: entered planetDegrees / fallback navamsa / fallback sign midpoint 15° + rashi-on
e2e/aspects-setting.spec.ts                    // E2E-AS-* Playwright flows
```

---

## What Cannot Be Tested (Blocked / Pending Decisions)

| Item | Blocker | Action |
|------|---------|--------|
| Rashi reason-line final string for the two-line example | BA US-RA-006 AC1 shows the OLD long form (`රාශි දෘෂ්ඨි මේෂ රාශිය මිථුනය දකී (+02:05:00)`); UX §8.1.1 supersedes with the compact `{aspectingSign} → {aspectedSign}` + shared `Δ` footer. BA doc is read-only | Flag to BA/PM to reconcile US-RA-006 AC1; QA tests follow the UX spec (authoritative) until reconciled |
| Ubaya tie-break for Virgo/Sagittarius/Pisces as aspecting signs | `docs/rash_aspects.md` only pins Gemini → {Virgo, Sagittarius}; the other Ubaya rows are derived (exclude higher sign number), not domain-confirmed | PM/domain confirms the full Ubaya lookup; goldens frozen after confirmation (UT-RA-113 currently asserts the derived rows) |
| Rashi reason data shape (`reason: "planetary"|"rashi"` vs `reasons[]` vs separate collection) | No Rashi-Aspects architecture spec; BA OQ1 / US-RA-006 AC3 open | Architect decides; UT-RA-140/141/142 assertions adapt to the chosen shape |
| Per-reason vs shared `degreeGap` (multi-reason footer) | US-RA-005 AC2 says the rashi arm computes its own matched angle/gap; UX §8.1.1 footer assumes ONE shared `degreeGap` per aspect | Architect/Developer confirms aspect-record shape before the footer is implemented (UI-AS-283) |
| Manual charts + rashi (degree+orb check) | **RESOLVED 2026-08-11** — manual charts feed the same pure rashi functions via stored `planetDegrees` or the deterministic fallback degree; no longer blocked (UT-PA-099, UT-RA-126/136, IT-AS-254) | — |
| Manual house-middle reference when a `lagnaDegree` is recorded | Architect §6.4/§14 keeps the whole-sign sign midpoint `(sign−1)*30+15` for the manual degree arm; using bhava cusps when `lagnaDegree` exists is OPEN | Architect/PM confirms; UT-PA-100 locks the current whole-sign decision, IT-AS-252 re-checked on confirmation |
| Rashi reason line for house-aspect rows (signed delta + aspecting→aspected sign derivation) | depends on the data shape decision above | after architecture decision |
| Extended-angle `isBeneficial` classification | AD-10 fixes {60,120} beneficial, all others non-beneficial in v1 — no domain confirmation | QA tests the AD-10 decision (UT-PA-058); flag for domain review |
| Final EN/SI label wording for extended angles & `Planet drishti` phrasing | UX §2.2 labels + EN `Planet drishti`/`Rashi drishti` are proposals | BA/PM review; QA freezes UI-AS-313 after approval |
| 210° label discrepancy | BA data-model Aspect Type table says "Quincunx, 6 signs"; UX uses "7 signs" (210÷30) | BA/PM reconcile; affects displayed label only, not numeric calculation |
| Golden aspect outputs for rashi | blocked on the decisions above | regenerate goldens after confirmation (see Golden-Data section) |
| Whether owner's search card / export should also re-derive | Architect recommendation: stored snapshot everywhere except owner detail view | Confirm with Architect/PM; QA locks RE-AS-334 to that recommendation |

---

## Acceptance Criteria Checklist (traceability)

| User Story | QA test IDs |
|-----------|-------------|
| US-PA-001 | UT-PA-041..048, IT-AS-200..217, SC-AS-260/262, UI-AS-270/271/275/276, E2E-AS-300 |
| US-PA-002 | UT-PA-020..028, IT-AS-205/207/208, UI-AS-272/273/276, E2E-AS-303 |
| US-PA-003 | UT-PA-030..040, IT-AS-206/207/208, UI-AS-272/273 |
| US-PA-004 | IT-AS-217/220/230..235/240/256/257/258, RE-AS-335 |
| US-PA-005 | UT-PA-070..100, IT-AS-221/222/250..256, UI-AS-293, SC-AS-264 |
| US-PA-006 | UT-PA-050..061/097, IT-AS-220/222/223/252/253/256, UI-AS-280/281/286/287/294 |
| US-PA-007 | UT-PA-001..011, IT-AS-211/212, UI-AS-274, E2E-AS-302, RE-AS-337 |
| US-RA-001 | UT-RA-144/145, IT-AS-200/204/225, UI-AS-277/278 |
| US-RA-002 | UT-RA-100..106 |
| US-RA-003 | UT-RA-110..116 |
| US-RA-004 | UT-RA-120..126, IT-AS-224/235/254/258, E2E-AS-301 |
| US-RA-005 | UT-RA-130..136, IT-AS-224/254/256 |
| US-RA-006 | UT-RA-140..143, UI-AS-280..294, BI-AS-311/312, AX-AS-321..323, E2E-AS-301 |
| US-RA-007 | UT-RA-146, UI-AS-278 |

---

## Questions for Other Roles

### For Architect (incl. the Rashi-Aspects architecture gap)

1. **There is NO Rashi-Aspects architecture spec** — this plan uses the BA stories + `data-model.md` + UX spec as the technical baseline. Please produce the equivalent architecture for Rashi Aspects: the aspect-record reason shape (`reason` marker vs `reasons[]`), the rashi arm's matched angle / `degreeGap` (per-reason vs shared — the UX §8.1.1 footer assumes ONE shared `degreeGap`), and where the rashi rule lookup lives (pure module vs table).
2. **Manual charts + rashi — RESOLVED 2026-08-11:** manual charts feed the same pure rashi functions via stored `planetDegrees` or the deterministic fallback degree, so the degree+orb ("rashmi") check runs on both sources (UT-PA-099, UT-RA-126/136, IT-AS-254). Remaining to confirm: the **manual house-middle reference** when a `lagnaDegree` is recorded — Architect §6.4/§14 keeps the whole-sign sign midpoint `(sign−1)*30+15`; should bhava cusps apply instead when a `lagnaDegree` exists? (UT-PA-100).
3. **Rashi vs Planet-Aspects composition at the data level:** union entries per house/planet with both reasons retained — confirm the exact per-entry reason list shape so the tooltip can render one line per reason (UT-RA-140..143).
4. **Orb semantics golden-test impact (Architect §13 Q1):** confirm the fixed `gap < 30` → per-planet `planetaryOrbs` change is expected to alter existing default-path aspect outputs (Rahu/Ketu at orb 0; other default orbs tighter than 30) and that golden fixtures in `calculation.test.ts`/`birthChart.test.ts` should be regenerated. Confirm the re-derivation and the auto degree arm use the IDENTICAL helper so stored and re-derived values always agree (§10 Dev Q4).
5. Confirm `houses[].aspectingPlanets` (auto) vs per-house `aspects` (manual) remain separate field names in v1 (Dev Q1) — affects SC-AS-264 and RE-AS-333.
6. Confirm the owner's search-result card / export read the stored snapshot everywhere except the owner detail view (Architect §14 Q2 recommendation).

### For Developer

1. `src/lib/manualChart.ts` `ASPECT_HOUSES` (L139-145) still holds the OLD table — action item to consume `DEFAULT_ASPECT_HOUSES` from `planetAspects.ts` as the single source (UT-PA-093).
2. Derive the **signed** delta (`+`/`-` ahead/behind of the aspect point) in the pure module; keep `{house}` display derivation `((aspectType/30)%12)+1` OUT of the matching functions (UI-AS-294).
3. Confirm `planetaryOrbs[String(i)] ?? DEFAULT_ORBS[i] ?? 0` fallback ordering matches the combustion code path (Architect §10 Dev Q3) — affects UT-PA-052/053.
4. Settings route must add `rashiAspects` to GET + accept it on PUT, and validate `enabled` as a strict boolean (IT-AS-204).
5. **Manual-chart degree pipeline (Architect §14 Dev Q6):** implement a single pure `derivePlanetAbsoluteDegree(planet, birthSign, navamsaSign?, enteredDegree?)` helper used by `compute()`, the manual-chart API, and owner view-time re-derivation so stored and re-derived manual aspects always agree; the fallback must mirror `deriveNavamsaData`'s `absoluteDegreeMidpoint` (navamsa segment midpoint) else sign midpoint 15° (UT-PA-094/095, IT-AS-253/256/257). Validate `planetDegrees` (0 ≤ d < 30, keys `"1"`–`"9"`, numbers only) and confirm `manualPlacementsToInput` round-trips it (IT-AS-255).

### For PM / Domain

1. **Ubaya tie-break confirmation** — the full Ubaya lookup for Virgo/Sagittarius/Pisces as aspecting signs is derived (exclude the higher sign number), not pinned by `docs/rash_aspects.md`; confirm so goldens can be frozen (UT-RA-113).
2. **BA US-RA-006 AC1 copy** shows the old two-line example with the delta repeated per line and the long `... රාශිය ... දකී` rashi form; the UX §8.1.1 revision (compact `→` form, shared `Δ` footer, delta once) supersedes it — reconcile the BA doc.
3. Confirm `rashiAspects.enabled` defaults to `false` (opt-in, backward compatible) — the doc's "modify all house and planet aspects" wording could read as opt-out.
4. Confirm extended-angle `isBeneficial` classification ({60,120} beneficial, others non-beneficial in v1) and the final EN/SI display labels (incl. the 210° "7 signs" vs BA "6 signs" discrepancy).
5. Confirm "reset to defaults" scope: per-planet + bulk reset both ship (US-PA-007 edge); Rashi reset covers `enabled` + `overrides`.
6. Confirm the visible behavior change is intended: existing owned auto charts now surface `houses[].aspectingPlanets` (degree-based) via view-time re-derivation without migration.
7. **Manual degree entry — v1 scope (Architect §14 PM Q4 / UX Q5):** is optional per-planet degree entry in the manual-chart form a v1 requirement, or are the deterministic fallback degrees sufficient so both-sources aspect application works on every manual chart (recommended)? Confirmed as dependency of IT-AS-252/253 — the manual-chart API must at least accept/validate `planetDegrees` even if the form is deferred.
8. **Legacy manual charts (Architect §14 PM Q5):** confirm that existing stored manual horoscopes now surface degree-based aspects (via fallback degrees at owner view-time re-derivation, no migration) is intended, and that non-owners continue to see the stored snapshot until the chart is next saved — mirrors the auto-chart no-backfill decision (IT-AS-257, RE-AS-333).
