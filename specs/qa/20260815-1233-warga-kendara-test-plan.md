# QA Test Plan — Warga Kendara (වර්ග කේනදර) — Varga Chart Viewer

**Date:** 2026-08-15 12:33
**Author:** QA (BMAD)
**Based on:** `docs/warga-kendara.md`, `specs/business-analysis/20260815-1129-warga-kendara.md` (US-WK-001…013, incl. the 2026-08-15 product decision removing the 16-varga reference table), `specs/business-analysis/data-model.md` (§WargaKendara, §Varga Chart Catalog), `specs/business-analysis/actors.md`, `specs/architecture/20260815-1145-warga-kendara-architecture.md` (module design + Verification 1–5), `specs/ux/20260815-1203-warga-kendara.md` (2026-08-15 revisions: indication tags, D2–D60 omitted, D1 pinned badge, `aria-pressed` group, mobile cards, i18n keys), `specs/qa/20260814-2210-bhava-suchika-test-plan.md` (format precedent), `src/lib/astrology.ts`, `src/lib/calculation.ts`, `src/lib/manualChartDetails.ts`, `src/lib/manualChart.ts`, `src/lib/shadBalaya.ts`, `src/lib/chartTypes.ts`, `src/app/horoscopes/[id]/page.tsx`, `src/models/CalculatedDetails.ts`, `src/lib/recalculationJob.ts`, `src/messages/en.json`, `src/messages/si.json`, `jest.config.js`, `package.json`

---

## Scope

This test plan covers the **වර්ග කේනදර (Warga Kendara / divisional chart viewer)** feature — phase 1:

- **Warga tab strip** (charts tab): Rāśi (D1) permanently pinned as a non-interactive badge (lock glyph, `aria-label`, click = no-op), second chart selectable among Navāṁśa (D9, default), Surya Lagna, Chandra Lagna — **exactly two charts displayed at once**; selection is client-side only and resets to D9 on horoscope navigation.
- **Main-indication tags** beneath each displayed chart's caption (US-WK-001): comma/semicolon-split chips from the static `VARGA_CATALOG` + i18n `astrology.wargaKendara.vargas.{key}.indication`; `—` when unresolvable. **No 16-varga reference table** (product decision 2026-08-15).
- **Per-chart tables** beneath each figure (US-WK-005/006): Houses (`#`, `Sign`, `Planets`, `Aspects`) then Planets (`Planet`, `Sign`, `Str`, `House`, `Conjunctions`, `Aspects`, `Other`); Nakshatra (Pada) + Bhava Suchika columns **only on D1**; Conjunctions/Aspects **without degree differences**; `Other` = 12 D1-only flags on D1 + Maraka/Maranakaraka/Dig Bala on **every** chart.
- **"Other Charts" section reduced to House only** (US-WK-004); House chart + current-planet overlay unchanged.
- **D2–D60 omitted entirely** (US-WK-009): no tabs, no reference table, no `ChartType` enum extension.
- **Data path** (US-WK-010/011): pure module `src/lib/wargaKendara.ts` (NEW) — `computeWargaKendara`, `computeWargaMaraka`, `computeMaranakaraka` (existing, per-chart), `computeDigBalaPlanets` (NEW export in `shadBalaya.ts`), `resolveWargaKendara`, `VARGA_CATALOG`; stored on `CalculatedDetails.wargaKendara` (keyed `d1|d9|suryaLagna|chandraLagna`, `null` = not derivable); recomputed by the AstrologySettings recalculation job; render-time fallback for legacy docs.
- **Read-only on all views** (US-WK-013): own, public, share-link.
- **Bilingual EN/SI** (US-WK-012): SI varga strings provisional — English authoritative; SI falls back to EN where pending.

**Out of scope:** D2–D60 chart computation and rendering (phase 2+); changes to the existing **calculations tab** (Start/Mid/End, Navamsa columns, degree differences stay as-is — regression-checked only); chart SVG rendering changes; search integration / SavedFilter section-key remapping (`drekkanaD3`, `dasamsaD10`, `shodashaVargas`, `chandraLagna`, `suryaLagna` in `src/app/search/page.tsx` — regression-checked only, per BA Out of Scope); new API endpoints (none); Shad Bala / Bhava Suchika / AstrologySettings changes; Yogakaraka/Nidhanamsha on the D1 per-chart table (pending domain — **do not test as required**, see §Open Questions).

## Test Strategy

| Level | Scope | Tool/Framework | Test IDs |
|-------|-------|----------------|----------|
| Unit | Pure rules in `src/lib/wargaKendara.ts` (NEW — **verified not to exist yet**): per-chart D1/D9/Surya/Chandra derivation, conjunction/aspect lists, D1-only flag mapping, per-chart Maraka/Maranakaraka/Dig Bala, `computeWargaMaraka`, `computeDigBalaPlanets` (in `shadBalaya.ts`), `VARGA_CATALOG` (16 keys), `resolveWargaKendara` stored-first/legacy/corrupt | Jest + ts-jest, node env, `@/` → `src/` (jest.config.js moduleNameMapper) | `UT-WK-*` |
| Unit (pipeline) | `calculateHoroscope` (auto) output gains `wargaKendara`; `synthesizeCalculation` (manual) gating matrix (with/without/partial Navamsa); `synthesizeNavamsaCalculation` retains base `wargaKendara`; recalc recomputes via `...calculated`/`...synth` (no overrides); legacy fallback `stored ?? compute` | Jest + ts-jest; fixtures via `calculation.test.ts` `baseData` (1990-06-15 08:30, Colombo, lahiri) | `UT-WK-05x` |
| Golden | Era-stamped fixture asserting `calculateHoroscope` gains a `wargaKendara` object (4 keys, D1/D9 example values for the documented `6a68e337150a9f9377fab96d` shape) | Jest + JSON fixture under `src/__tests__/fixtures/` (mirrors `bhava-suchika-default-2026-08.json`) | `UT-WK-08x` |
| Integration / API | No new endpoints (arch D8); `POST /api/horoscope` and manual routes persist via the existing `...calculated`/`...synth` spreads; recalc job recomputes (no merge); `GET /api/horoscope/:id` and `GET /api/share/:token` return `calculatedDetails.wargaKendara`; privacy + share-expiry unchanged; Shad Bala PATCH never touches it | Jest + mocked `getServerSession` + mocked `connectDB` (reuse `privacy.test.ts` / `recalculationJob.test.ts` patterns) | `IT-WK-*` |
| Component / UI | Tab strip (D1 pinned badge, second-chart buttons), exactly-two-charts invariant, no-op clicks, reset-on-navigation, indication tags (split/wrap/`—`), per-chart Houses/Planets tables (columns per chart, no degree differences, D1-only details), "Other Charts" = House only, D2–D60 absence, no-data placeholder, read-only views | `@testing-library/react` 16.3.2 is in devDependencies **but ⚠️ jest `testMatch` only matches `*.test.ts`** (JSX needs `.tsx`) — run as manual scripts unless testMatch is extended; per-file `/** @jest-environment jsdom */` if extended | `UI-WK-*`, `AX-WK-*`, `BI-WK-*`, `RS-WK-*` |
| E2E | Full user flows (auto/manual/legacy render, pair permutations, D1 lock, share-link/public read-only, locale switch, keyboard-only, 360px SI) | **No E2E framework installed** (verified: no Playwright/Cypress in `package.json`) — cases are executable manual scripts; Playwright install is a Developer/PM decision (see §What cannot be tested) | `E2E-WK-*` (manual) |
| Edge / Negative | Corrupt stored `wargaKendara`, partial manual-input matrix, empty arrays, privacy, no mutation surface, concurrency/determinism, legacy-missing fields | Jest (pure + route) + manual | `RE-WK-*` |

**Approach:** all rule logic lives in one new pure module — unit tests assert against numeric-enum fixtures directly with no mocks. Pipeline tests prove the field rides the existing spreads (no new persistence code path). API tests assert there is **no new route** and the existing routes persist/return the field additively. UI/E2E cases double as the acceptance script for the Developer's manual QA pass.

## Test Environment & Prerequisites

| Environment | Configuration |
|-------------|---------------|
| Unit | Jest + ts-jest, node env — `npx jest src/__tests__/wargaKendara.test.ts` |
| API | Route-handler tests with mocked `getServerSession` + mocked `connectDB` + mocked Mongoose models (pattern from `privacy.test.ts` / `recalculationJob.test.ts`) |
| Component (optional) | `@testing-library/react` 16.3.2 + `@testing-library/jest-dom`; **jest.config `testMatch` must be extended to `*.test.{ts,tsx}`** (currently `["**/__tests__/**/*.test.ts"]`) — see §Key risk areas |
| E2E / manual browser | Local dev server (`pnpm dev`) + local MongoDB; test users: `student` (owner), `super-admin`, second `student` (non-owner); SI + EN sessions |
| Golden | Versioned fixture `src/__tests__/fixtures/warga-kendara-default-2026-08.json` (era-stamped, mirroring the bhava-suchika fixture convention) |

### Test data setup

| Fixture | Purpose | How to obtain |
|---------|---------|---------------|
| Auto horoscope `6a68e337150a9f9377fab96d` | The feature-doc example — D1 Saturn = Capricorn \| Own Sign, Other shows Combust + Maranakaraka + Maraka + Kala Bala; D9 Saturn = Cancer \| Enemy. **⚠️ This is a dev-DB horoscope, not a repo fixture** (glob verified — it appears only in docs/specs). Unit tests replicate its documented values via a constructed `CalculationResult`; browser checks use the real dev-DB doc | Dev DB, auto source, birth details as stored |
| Auto horoscope (fresh) | Full auto path with all four phase-1 charts populated | `POST /api/horoscope` (auto, with birth time + location) |
| Manual horoscope with Navamsa data | D9 entry real | `POST /api/horoscope/manual` with `navamsaLagna` + `navamsaHouses` |
| Manual horoscope without Navamsa data | D9 `null` → placeholder path | `POST /api/horoscope/manual` minimal body |
| Manual horoscope, partial Navamsa | `navamsaLagna` only / `navamsaHouses` only | API-level craft (UI may prevent ordering) |
| Legacy doc | `wargaKendara` absent → render-time fallback | `mongosh`: `$unset` the field on one auto + one manual doc |
| Corrupt doc | Stored `wargaKendara` invalid shape | `mongosh`: hand-set `{ d1: "bogus", d9: 42 }` |
| Public horoscope + share link | Read-only view parity | Toggle `isPublic` on one doc; create a share link |
| Unit fixtures | `calculation.test.ts` `baseData` (1990-06-15 08:30, Colombo, lahiri); constructed result replicating `6a68e337150a9f9377fab96d` (Saturn sign 10/strength OWN/D9 sign 4/strength ENEMY) | Inline in `wargaKendara.test.ts` |

### Risk matrix

| Risk | Likelihood | Impact | Mitigation / Test IDs |
|------|-----------|--------|-----------------------|
| Per-chart Maraka/Maranakaraka rule wrong (domain assumption) | High | High — wrong `Other` chips on every chart | Test the assumed rule (UT-WK-012/013); isolate in one pure function so the rule swap is one change; block sign-off on domain confirmation (§Open Questions) |
| Conjunction/aspect rule for varga charts (whole-sign assumption) | Medium | High — wrong Conjunctions/Aspects cells | UT-WK-007/008/009 pin the implemented rule; flag for domain |
| `resolveWargaKendara` legacy fallback drifts from stored path | Medium | High — legacy docs render differently than fresh docs | UT-WK-060 pins fallback === fresh compute; E2E-WK-405 |
| jest `testMatch` excludes `.tsx` → no component automation | Certain | Medium — UI cases manual only | Flag §Key risk areas; manual scripts provided |
| `6a68e337150a9f9377fab96d` not reproducible in unit tests | Certain | Medium — golden example unverifiable in CI | Constructed fixture replicating documented values (UT-WK-002/003/053); browser check against real doc (E2E-WK-400) |
| Sinhala strings provisional (domain pending) | High | Medium — wrong SI labels shipped | BI-WK-380/381/383 assert parity + fallback, not domain truth; sign-off gate |
| D9 tables accidentally showing D1-only flags | Medium | High — US-WK-007 violation | UT-WK-011, UI-WK-323, RE-WK-451 |
| Degree differences leaking into per-chart cells | Medium | Medium — US-WK-006 violation | UT-WK-008 (stored shape has no degree fields), UI-WK-320 (DOM text assertion) |
| Recalc job touching overrides (none exist) | Low | Medium | IT-WK-108/109 assert no `overridden` keys |
| SavedFilter legacy section keys break search cards | Low | Low — out of scope | RE-WK-462 regression check only |

---

## 1. Unit Tests — Pure Module `src/lib/wargaKendara.ts` (NEW)

**Verified:** `src/lib/wargaKendara.ts` does **not** exist yet (glob). Developer creates it per arch §Component Design. Supporting facts verified: `computeMaranakaraka` exported at `astrology.ts:324` (doc note "lagna chart only, never D9" — needs updating per the per-chart assumption); `computeMaraka` private at `calculation.ts:585` (a public `computeMaraka` also exists at `manualChart.ts:1113` — architect's `computeWargaMaraka` is new); `DIG_HOUSE` private map at `shadBalaya.ts:68`; `getNavamsaChartData` at `page.tsx:543`, `getSunMoonChartData` at `page.tsx:724`.

| ID | Test Case | Input | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UT-WK-001 | D1 entry shape | `computeWargaKendara(result, { source: "auto" })` on the `baseData` result | `wargaKendara.d1` has `lagnaSign === result.ascendant.sign`, 12 `houses` rows, 9 `planets` rows; every chart entry `null`-able but D1 never null for a computed result | US-WK-005/006, arch §Component Design |
| UT-WK-002 | D1 planet row values (feature-doc example shape) | constructed result with Saturn sign 10, strength OWN, house as stored | `d1.planets` Saturn row: `sign: 10` (Capricorn), `strength: OWN`, `house` 1–12, `conjunctions`/`aspects` numeric enums only | US-WK-006 AC2, arch verification 2 |
| UT-WK-003 | D9 derivation | result with asc sign/degree + planet navamsa signs | `d9.lagnaSign === navamsaSign(asc.sign, floor(asc.degree/(30/9))+1)`; Saturn D9 row `sign: 4` (Cancer), `strength: navamsaStrength` (ENEMY in the fixture), house `((navSign − ascNavSign) mod 12) + 1` | US-WK-006 AC2, arch D9 rule |
| UT-WK-004 | D9 strength = stored `navamsaStrength` | planet with `navamsaStrength` set | `d9.planets[i].strength === planets[i].navamsaStrength` | US-WK-006, arch assumption 3 |
| UT-WK-005 | Surya Lagna rotation | result with Sun in sign 5 | `suryaLagna.lagnaSign === 5`; planets re-housed by rotation; `strength` unchanged from D1 (rotation changes houses, not signs) | US-WK-002, arch §Component Design |
| UT-WK-006 | Chandra Lagna rotation | result with Moon in sign 2 | `chandraLagna.lagnaSign === 2`; planets re-housed; strength unchanged | US-WK-002 |
| UT-WK-007 | Conjunctions = same whole-sign house | two planets in house 4 of the D9 chart | both `conjunctions` lists contain each other (name-only numeric enums); a lone planet → empty array; self never listed | US-WK-006 AC3, arch assumption 2 |
| UT-WK-008 | Aspects = whole-sign diff rule within chart, no degree fields | chart where planet A is 6 houses from planet B | `aspects` entries contain exactly `{ planetName, aspectType }` (diff 6 → 180; special aspects per planet 5/9, 3/7, 4/8 etc. by diff); **no degree/delta field in the object shape** | US-WK-006 AC4, arch assumption 2 |
| UT-WK-009 | Houses aspects | house with an aspecting planet | `houses[h].aspects` lists aspecting Planet enums; empty house → empty array | US-WK-005, arch §Component Design |
| UT-WK-010 | D1-only flags mapped from top-level fields | result with `wargoththamaPlanets: [5]`, `pushkaraPlanets: []`, `lord22ndDrekkana: 4`, `atmakaraka: 5`, one planet `combustion: true`, stored `shadbalaya` with `kalaBala`/`cheshtaBala` true | `d1` entry carries all 12 mapped fields (`wargoththamaPlanets`, `pushkaraPlanets`, `gandanthaPlanets`, `gandamulaPlanets`, `lord22ndDrekkana`, `lord64thNavamsa`, `cheshtaBalaPlanets`, `ashtamanshaPlanets`, `kalaBalaPlanets`, `atmakaraka`, `combustPlanets`, `badhakaPlanets`); combust = `p.combustion`; cheshta/kala read stored `shadbalaya[planet].cheshtaBala.value`/`.kalaBala.value` | US-WK-007 AC1, arch D1-only rule |
| UT-WK-011 | D1-only flags NEVER on other charts | `d9`/`suryaLagna`/`chandraLagna` entries from a result whose D1 qualifies | the three non-D1 entries have **no** `wargoththamaPlanets`…`badhakaPlanets` keys, and no `nakshatra`/`pada` on planet rows (absent, not empty) | US-WK-007 AC2, data-model §WargaKendara |
| UT-WK-012 | Maraka = chart's own 2nd/7th lords | `computeWargaMaraka(ascSign)` for several signs incl. wrap (lagna 11 → 2nd = sign 12, 7th = sign 5) | returns `SIGN_LORD[((asc+1) mod 12)+1]` + `SIGN_LORD[((asc+6) mod 12)+1]`-based lists; D9 lagna's maraka differs from D1's when lagnas differ (per-chart re-evaluation — assumption) | US-WK-008 AC2, arch assumption 1 |
| UT-WK-013 | Maranakaraka per chart | `computeMaranakaraka(chartPlanets, chartHouses)` called with the chart's own planets/houses | planets in the chart's own designated death houses; e.g. a planet in D9 house 8 lands in `maranakaraka` of the D9 entry even if not in D1's | US-WK-008 AC2, arch assumption 1 |
| UT-WK-014 | Dig Bala per chart | `computeDigBalaPlanets(chartPlanets)` for each chart entry | Guru/Budha in house 1, Kuja/Ravi in 10, Chandra/Shukra in 4, Shani in 7 → in `digBalaPlanets`; others not | US-WK-008 AC2, arch D4 |
| UT-WK-015 | Rahu/Ketu never get Dig Bala | planets 8 and 9 in any of the 4 mapped houses | never in `digBalaPlanets` in any chart entry | US-WK-008 edge, BA OQ4 |
| UT-WK-016 | `computeWargaMaraka` output contract | any ascSign 1–12 | array of Planet enums; deterministic; no empty array for a valid lagna (every sign has a 2nd/7th lord) | US-WK-008 BR |
| UT-WK-017 | `computeDigBalaPlanets` output contract | 9 planets with mixed houses | only mapped-house planets listed; ordered by Planet enum | arch D4, US-WK-008 |
| UT-WK-018 | All 9 planets in every chart | computed 4 entries | each entry's `planets` array has exactly names 1–9 (incl. Rahu 8, Ketu 9) in enum order | US-WK-006 AC2, data-model |
| UT-WK-019 | `nakshatra`/`pada` only on D1 rows | computed 4 entries | `d1.planets[*]` may carry `nakshatra`/`pada`; non-D1 rows have neither key | US-WK-006 AC1, data-model |
| UT-WK-020 | Determinism | same `(result, ctx)` twice | deep-equal outputs (pure — enables render-time legacy recompute) | US-WK-011 BR, arch D4 |
| UT-WK-021 | Pure-module import surface | import `@/lib/wargaKendara` in a node test | imports only types/enums + `chartTypes` + pure helpers (`getChartData`, `computeMaranakaraka`); no ephemeris, no Mongo, no logger I/O — same contract as `shadBalaya.ts` | arch D4 |
| UT-WK-022 | `VARGA_CATALOG` completeness | the exported constant | exactly 16 entries; keys `d1, d2, d3, d4, d7, d9, d10, d12, d16, d20, d24, d27, d30, d40, d45, d60` with D# 1,2,3,4,7,9,10,12,16,20,24,27,30,40,45,60 — matches `docs/warga-kendara.md` table exactly | US-WK-001 AC2, data-model §Varga Chart Catalog |
| UT-WK-023 | `resolveWargaKendara` stored-first | valid stored object | returned as-is (no recompute — this is the no-flicker guarantee) | US-WK-011 AC3, UX §states |
| UT-WK-024 | `resolveWargaKendara` legacy fallback | `calculatedDetails` without the field but with `planets`/`houses`/`ascendant` (+ `manualHousePlacements` when manual) | derives `computeWargaKendara` from stored D1 data at render time; matches fresh computation (see UT-WK-060) | US-WK-011 AC3 |
| UT-WK-025 | `resolveWargaKendara` corrupt stored | `wargaKendara: "bogus"`, `{ d1: 42 }`, `{ d9: null }` alone | `console.warn` emitted; falls back to derivation; never throws | US-WK-011, arch §Data Flow (warn on corrupt) |

## 2. Unit Tests — Pipeline Integration (auto, manual, legacy, recalc)

| ID | Test Case | Input | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UT-WK-051 | Auto output gains `wargaKendara` | `calculateHoroscope(baseData)` | `result.wargaKendara` is an object with exactly keys `d1`, `d9`, `suryaLagna`, `chandraLagna`; every entry non-null | US-WK-011 AC1, arch §calculation.ts |
| UT-WK-052 | Auto D1 entry mirrors the result | auto result | `d1.houses`/`d1.planets` deep-equal the result's own houses/planets (lagna, signs, houses, strengths) | US-WK-005/006, arch §Internal derivation |
| UT-WK-053 | Feature-doc example values | constructed result replicating `6a68e337150a9f9377fab96d` (Saturn D1 sign 10 OWN; D9 sign 4 ENEMY) | `d1` Saturn row = Capricorn \| Own Sign; `d9` Saturn row = Cancer \| Enemy; `d1` Saturn `Other` sources include combust + maranakaraka + maraka + kalaBala sets | US-WK-006 AC2, US-WK-007 AC1, US-WK-008 AC3 |
| UT-WK-054 | Manual with Navamsa data | `synthesizeCalculation` with `navamsaLagna` + `navamsaHouses` | `wargaKendara.d1` from entered placements; `d9` real entry derived from entered navamsa chart; `manualHousePlacements` input deep-equal after (never overwritten) | US-WK-010 AC1/AC2, arch §manual |
| UT-WK-055 | Manual without Navamsa | `synthesizeCalculation` minimal (no navamsa) | `wargaKendara.d9 === null`; `d1` populated from `manualHousePlacements`; `suryaLagna`/`chandraLagna` derived by rotation | US-WK-010 AC2, UX §Q5 |
| UT-WK-056 | Manual partial Navamsa matrix | `navamsaLagna` only / `navamsaHouses` only / neither / both | `d9` is `null` or a derivable entry per data present (mirroring the existing navamsa enrichment partial-input behaviour); never throws; never fabricates values | US-WK-010 edge, BA OQ (partial input) |
| UT-WK-057 | `synthesizeNavamsaCalculation` retains base `wargaKendara` | D9 CalculationResult from the manual pipeline | base result's `wargaKendara` NOT stripped (unlike `lagnaBhavaSuchika`/`bhavaSuchika`); D9 entry inside describes the D1 chart; derived from `navamsaSign` data only when Navamsa input exists | arch §manualChartDetails.ts |
| UT-WK-058 | Recalc auto recomputes (no merge) | `recalculateOne` auto branch with computed `wargaKendara` | `findOneAndUpdate` payload carries `wargaKendara` via `...calculated`; **no `overridden` key anywhere in the payload** (unlike `mergeShadBalaya`) | US-WK-011 AC2 |
| UT-WK-059 | Recalc manual recomputes | manual branch with/without navamsa | payload carries `wargaKendara` via `...synth`; `d9` null preserved when no navamsa input | US-WK-011 AC2, US-WK-010 |
| UT-WK-060 | Legacy fallback === fresh compute | auto doc with `wargaKendara` removed; recompute via `resolveWargaKendara` | derived entries deep-equal a fresh `computeWargaKendara` on the same stored data | US-WK-011 AC3, arch verification 4 |
| UT-WK-061 | Stored-first resolution | stored valid + derived available | resolved = stored (no recompute path) | US-WK-011 AC3, UX no-flicker |
| UT-WK-062 | Corrupt stored → warn + fallback | invalid stored value | `console.warn` (spy) + fallback derivation; result usable | arch §Data Flow, RE-WK-451 |
| UT-WK-063 | Cheshta/Kala flags read stored `shadbalaya` | result + stored shadbalaya with `kalaBala.value: true` for Saturn | `d1.kalaBalaPlanets` includes Saturn (fixture `6a68e337150a9f9377fab96d` shows Kala Bala on Saturn) | US-WK-007 AC1, arch D1-only rule |
| UT-WK-064 | `CalculationResult` type carries optional `wargaKendara` | TS type assertion in a node test | `result.wargaKendara` is assignable/optional; no compile errors | arch §astrology.ts type-only update |

## 3. Golden Tests

| ID | Test Case | Input | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UT-WK-081 | Golden auto chart gains `wargaKendara` | `calculateHoroscope(baseData)` (1990-06-15 08:30, Colombo, lahiri) | `wargaKendara` frozen as `src/__tests__/fixtures/warga-kendara-default-2026-08.json` (4 keys; full D1 + D9 entries; Surya/Chandra entries) | US-WK-011 AC1, arch verification 2 |
| UT-WK-082 | Golden value domains | fixture contents | every `sign`/`lagnaSign` in 1..12; every `house`/`houseNumber` in 1..12; every `name` in 1..9; `strength` numeric enum; `aspectType` in known set | data-model §WargaKendara |
| UT-WK-083 | Golden D1 self-check | fixture + result from the same run | `d1.houses` deep-equals `result.houses` (sign/planets/aspects); `d1.planets[i].name === result.planets[i].name` for i=0..8 | US-WK-005/006, arch |
| UT-WK-084 | Golden D9 cross-check | fixture + per-planet `navamsaSign` | every D9 planet `sign === planets[i].navamsaSign`; D9 house `((navamsaSign − ascNavSign) mod 12) + 1` | US-WK-006, arch D9 rule |
| UT-WK-085 | Fixture regeneration recipe | change any derivation rule and run the suite | golden assertion fails loudly with the era-stamped diff — regenerate deliberately, never silently | arch verification, bhava-suchika precedent |

## 4. Integration / API Tests — no new routes (D8), persistence via existing spreads

**Verified persistence facts:** `POST /api/horoscope` does `CalculatedDetails.create({ horoscope: { id }, ...calculated })` (`api/horoscope/route.ts:80-83`); `recalculateOne` spreads `...calculated` (auto) / `...synth` (manual). Adding `wargaKendara` to `CalculationResult` stores it automatically in every path — **no new persist code exists or is wanted**.

| ID | Test Case | Setup | Expected | Maps to |
|----|-----------|-------|----------|---------|
| IT-WK-100 | No new route files | glob `src/app/api/**` for any warga-kendara route | no new route; a hand-crafted PATCH/POST to a guessed route returns 404 | US-WK-013 BR, arch D8 |
| IT-WK-101 | Auto create persists | mock `calculateHoroscope` → object with `wargaKendara`; POST /api/horoscope | `CalculatedDetails.create` payload contains `wargaKendara` via the `...calculated` spread; no extra code path | US-WK-011 AC1 |
| IT-WK-102 | Optionality | legacy-shaped engine output without `wargaKendara` | create succeeds; field absent; no coercion, no crash | arch §Migration |
| IT-WK-103 | Manual create with navamsa | POST /api/horoscope/manual with navamsa data | persisted `calculatedDetails.wargaKendara.d9` is a real entry | US-WK-010 AC2 |
| IT-WK-104 | Manual create without navamsa | POST /api/horoscope/manual minimal | persisted `wargaKendara.d9 === null` | US-WK-010 AC2 |
| IT-WK-105 | Manual-chart update re-derives | PUT /api/horoscope/[id]/manual-chart with changed navamsa data | `wargaKendara` re-derived on save; `manualHousePlacements` untouched | US-WK-010 BR |
| IT-WK-106 | GET returns stored field | GET /api/horoscope/:id (owner) on a fresh auto doc | `calculatedDetails.wargaKendara` present with the 4 keys | arch §API contracts |
| IT-WK-107 | GET legacy doc | doc stored before the field existed | field absent; HTTP 200 — no migration/backfill invoked | US-WK-011 AC3 |
| IT-WK-108 | Recalc auto recomputes | recalc auto branch | payload carries `wargaKendara`; no `overridden` keys | US-WK-011 AC2 |
| IT-WK-109 | Recalc manual recomputes (gated) | manual branch with/without navamsa | payload carries `wargaKendara` via `...synth`; `d9: null` preserved when no navamsa | US-WK-011 AC2, US-WK-010 |
| IT-WK-110 | Share-link parity + expiry | GET /api/share/:token on a doc with `wargaKendara`; then an expired token | valid token → identical `calculatedDetails.wargaKendara` (read-only); expired/unknown token → existing error (404/410 per current behaviour), field never leaked | US-WK-013, arch §Security |
| IT-WK-111 | Response shape additive | full GET payload vs pre-feature key set | exactly one new key `wargaKendara` under `calculatedDetails`; no key removed/reordered (deep key-set compare) | arch §API contracts |
| IT-WK-112 | Privacy unchanged | non-owner GET on a private horoscope with `wargaKendara` | 404 (no data leak, incl. the field); public horoscope returns `wargaKendara` for non-owners | US-WK-013, privacy spec |
| IT-WK-113 | Shad Bala PATCH never touches it | PATCH /api/horoscope/[id]/shadbalaya on a doc with both feature sets | `$set` touches only `shadbalaya.<planet>.<bala>.*`; `wargaKendara` byte-identical after | US-WK-013 BR, regression |

## 5. Component / UI Tests (charts tab)

> ⚠️ `@testing-library/react` 16.3.2 is in devDependencies but `jest.config.js` sets `testMatch: ["**/__tests__/**/*.test.ts"]` — JSX component tests need `.tsx` files which will NOT match. Either extend testMatch to `*.test.{ts,tsx}` or run these cases as manual checks; either way the assertions below are the acceptance bar.

| ID | Test Case | Steps | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UI-WK-300 | Strip renders with D1 pinned + D9 default | open an auto horoscope → charts tab | strip shows `[🔒 රාශි (D1)] [නවාංශක (D9)✓] [සූර්ය ලග්න] [චන්ද්ර ලග්න]`; D1 is a `<span>` (not `<button>`), `tabindex="-1"`, lock glyph `aria-hidden`, `aria-label` = "Rāśi (D1) — always shown" / "රාශි (D1) — සැමවිටම පෙන්වයි"; D9 button `aria-pressed="true"`; exactly two chart figures | US-WK-002/003, UX Q1/Q6 |
| UI-WK-301 | Section title | inspect the charts-tab header | "වර්ග කේනදර" / "Warga Kendara" (new key) replaces the `chartPairTitle` usage on this page (`page.tsx:1091`) | UX Q1, US-WK-002 |
| UI-WK-302 | Default pair D1 + D9 | fresh page load | grid shows D1 (left) + D9 (right); D9 tables carry no Nakshatra/Bhava Suchika columns | US-WK-003 AC1, US-WK-006 |
| UI-WK-303 | Clicking D1 = no-op | click/tap the D1 badge | zero state change; no console error; second chart unchanged | US-WK-003 AC2, UX Q1 |
| UI-WK-304 | Clicking selected second tab = no-op | click D9 while D9 selected | view unchanged; `aria-pressed` stays on D9 | US-WK-003 AC4 |
| UI-WK-305 | Swap D9 → Surya Lagna | click [සූර්ය ලග්න] | `aria-pressed` moves D9 → Surya Lagna; right figure crossfades (150ms); indication tags + Houses/Planets tables swap to Surya Lagna data (no D1-only columns); D1 figure untouched | US-WK-003 AC3, UX Flow 2 |
| UI-WK-306 | Swap D9 → Chandra Lagna | click [චන්ද්ර ලග්න] | D1 + Chandra Lagna displayed; Chandra tables populated | US-WK-003 AC3 |
| UI-WK-307 | Swap back to D9 | click [නවාංශක (D9)] after a swap | D1 + D9 restored; no duplicate figures | US-WK-003 |
| UI-WK-308 | Exactly two figures at all times | DOM query after each of D9/Surya/Chandra selection | always exactly 2 chart-figure cards; never 1 or 3 | US-WK-003 AC3 |
| UI-WK-309 | Rapid switching settles on last selection | click Surya → Chandra → Surya quickly | settles on D1 + Surya Lagna; exactly two figures; tables match the final selection (no stale/partial data) | US-WK-003 edge |
| UI-WK-310 | Reset on horoscope navigation | navigate from horoscope A to horoscope B | second chart resets to D9 (state keyed per horoscope id; no persistence) | US-WK-003 edge, arch §page.tsx |
| UI-WK-311 | D1 indication tags | inspect D1 figure caption area | chips beneath caption, above Houses table: SI `සමස්ත ජීවිතය · ශරීරය · පොදු තත්ත්ව` (3 chips) / EN `Overall life · Body · General circumstances` (3 chips after comma-split); chip row `aria-label` = indication label ("Main indication") | US-WK-001 AC1, UX Q2 |
| UI-WK-312 | D9 indication tags | inspect D9 figure | SI `විවාහය · ධර්මය · ග්රහ බලය` (3 chips) / EN `Marriage · Dharma · Strength of planets` (3 chips) | US-WK-001 AC1/AC2 |
| UI-WK-313 | Surya/Chandra Lagna indication tags | swap to each | own indication tags render (provisional "Sun-based chart" / "Moon-based chart" EN or SI equivalents per shipped i18n) | US-WK-001 AC2, UX Q2 |
| UI-WK-314 | Locale switch re-renders tags | `useI18n()` SI ⇄ EN | tag chips re-render immediately in the new locale; no stale mix | US-WK-001 AC3, US-WK-012 |
| UI-WK-315 | Unresolvable indication → `—` | temporarily remove a varga indication key (dev only) | tag row renders `—`; never empty, never crash | US-WK-001 edge |
| UI-WK-316 | Tags wrap on mobile | 360px viewport | chips wrap to multiple lines; **no horizontal scroll** | US-WK-001 edge, UX §Responsive |
| UI-WK-317 | Houses table per chart | inspect under each figure | columns exactly `#` `Sign` `Planets` `Aspects`; 12 rows; empty cells `—`; each table's data matches its own figure | US-WK-005 AC1/AC2 |
| UI-WK-318 | D1 Planets table columns | inspect D1 table | `Planet` `Sign` `Str` `House` `Nakshatra (Pada)` `Bhava Suchika` `Conjunctions` `Aspects` `Other` (existing Bhava Suchika column from US-BS) | US-WK-006 AC1 |
| UI-WK-319 | Non-D1 Planets table columns | inspect D9/Surya/Chandra tables | `Nakshatra (Pada)` and `Bhava Suchika` headers **absent from the DOM** (omitted entirely, never empty columns) | US-WK-006 AC1, UX Q3 |
| UI-WK-320 | No degree differences | text-scan all per-chart Conjunctions/Aspects cells | no `(±dd:mm:ss)` / `(dd°)` / degree-gap text anywhere in the four per-chart tables | US-WK-006 AC3/AC4 |
| UI-WK-321 | Fixture D1 Saturn row | open `6a68e337150a9f9377fab96d` → D1 table | Saturn row: Capricorn \| Own Sign; `Other` chips include Combust, Maranakaraka, Maraka, Kala Bala | US-WK-007 AC1, US-WK-008 AC3, feature doc |
| UI-WK-322 | Fixture D9 Saturn row | same horoscope → D9 table | Saturn row: Cancer \| Enemy; `Other` shows only Maraka/Maranakaraka/Dig Bala chips (no Combust/Kala Bala) | US-WK-006 AC2, US-WK-007 AC2 |
| UI-WK-323 | D1-only details never on other charts | a planet qualifying for Combust/Wargoththama in D1; swap to D9/Surya/Chandra | detail absent from non-D1 `Other` cells | US-WK-007 AC2 |
| UI-WK-324 | No details → `—` | planet with no flags | `Other` cell shows `—` | US-WK-007 AC3 |
| UI-WK-325 | 9 planet rows every chart | count rows in each of the 4 tables | 9 rows each, incl. Rahu (8) and Ketu (9) | US-WK-006 AC2 |
| UI-WK-326 | "Other Charts" = House only | inspect the Other Charts section | only the House button remains; Drekkana D3, Dasamsa D10, Shodasha Vargas, Surya Lagna, Chandra Lagna buttons removed | US-WK-004 AC1 |
| UI-WK-327 | House chart unchanged | click House | birth chart + house cusps + current-planet overlay toggle behave exactly as before | US-WK-004 AC2 |
| UI-WK-328 | D2–D60 absent | DOM/text search for D2/D3/D4/D7/D10/D12/D16/D20/D24/D27/D30/D40/D45/D60 | no tab, no reference table, no disabled tab, no string anywhere in the charts tab | US-WK-009 AC2/AC3 |
| UI-WK-329 | Manual without Navamsa → placeholder | open manual horoscope without navamsa → charts tab, select D9 | second slot shows `astrology.noChartData` placeholder ("සටහන් දත්ත නොමැත"); no empty table; D1 figure + tables unaffected | US-WK-010 AC2, UX Flow 4 |
| UI-WK-330 | Read-only on all views | own, public, share-link | identical Warga Kendara content; no editing affordances anywhere (no toggles/inputs/overrides) | US-WK-013 AC1 |

## 6. Accessibility Testing (UX §Accessibility)

| ID | Test Case | Expected |
|----|-----------|----------|
| AX-WK-350 | Strip semantics | `role="group"` + `aria-label` = "Select second chart" / "දෙවන සටහන තෝරන්න" (NOT `role="tablist"`); buttons carry `aria-pressed` | 
| AX-WK-351 | D1 badge | a `<span>` with `tabindex="-1"` (not focusable, not in tab order); `aria-label` "Rāśi (D1) — always shown" / "රාශි (D1) — සැමවිටම පෙන්වයි"; lock glyph `aria-hidden` | 
| AX-WK-352 | Roving tabindex | exactly one second-chart button in the tab order; selection moves focus correctly | 
| AX-WK-353 | Keyboard navigation | Tab into group; Left/Right arrows move between buttons; Home/End jump to first/last; Space/Enter activates; selection via keyboard swaps the second chart | 
| AX-WK-354 | Focus ring | visible indigo 2px offset ring on all strip buttons (hover/focus) | 
| AX-WK-355 | SR announcement on swap | chart swap announces the new chart name (existing `aria-live="polite"` region around the chart pair or button `aria-label` change) | 
| AX-WK-356 | Tables semantics | real `<table>` with `<caption>`, `<thead>` `<th scope="col">`, first column `<th scope="row">`; mobile card layout is `role="list"`/`role="listitem"` with `aria-label` = full row text | 
| AX-WK-357 | Indication tags group | tag row has `aria-label` = `astrology.wargaKendara.indicationLabel`; chips are decorative (no interactive role); `—` announced for unresolvable | 
| AX-WK-358 | Contrast | selected pill `bg-indigo-600 text-white` AA; indication chips ≥ 4.5:1 against `--surface`; no color-only markers | 
| AX-WK-359 | Touch targets | strip buttons ≥ 40px (44px preferred) tap area on mobile | 
| AX-WK-360 | No-op interactions a11y-clean | Tab/click the D1 badge and the selected second tab | no focus trap, no unexpected focus move, no console errors, no live-region spam | 

## 7. Bilingual Testing (US-WK-012)

| ID | Test Case | Expected |
|----|-----------|----------|
| BI-WK-380 | Key parity | every `astrology.wargaKendara.*` key in `en.json` exists in `si.json` and vice versa (scriptable grep/JSON-diff over both files) — incl. `title`, `tabs.{rashi,navamsa,suryaLagna,chandraLagna}`, `pinnedAria`, `secondChartAria`, `indicationLabel`, `columns.*`, `noDetails`, `vargas.*` |
| BI-WK-381 | 16-catalog parity (architect's test) | all 16 `VARGA_CATALOG` keys have `name` + `indication` in both `si.json` and `en.json` (unit test reading the message files, mirroring the vocabulary test pattern) |
| BI-WK-382 | EN authoritative | EN varga names/indications match `docs/warga-kendara.md` exactly (Rāśi/Navāṁśa names, "Overall life, body, general circumstances" etc.) |
| BI-WK-383 | SI fallback to EN where pending | if an SI varga key is missing/pending, the EN string renders (fallback), never empty/crash — assert the fallback path with a deliberately removed SI key |
| BI-WK-384 | No hardcoded strings | `src/components/wargaKendara/*` + the charts-tab section contain no inline SI/EN literals; all labels via `t()` from numeric enums / catalog keys (grep-checkable) |
| BI-WK-385 | Enum labels reused | planet/sign/strength names resolve via existing `astrology.planetNames`/`signNames`/`strength` maps — no duplicated strings |
| BI-WK-386 | Chart captions | `astrology.chartCaptions.suryaLagna` / `chandraLagna` added to both locales; reused for the figure captions |
| BI-WK-387 | Locale switch | `useI18n()` SI ⇄ EN re-renders tabs, tags, table headers, chips immediately; no stale mix (same horoscope, both sessions) |
| BI-WK-388 | SI width | at 360px, SI tab labels (රාශි (D1), නවාංශක (D9), සූර්ය ලග්න, චන්ද්ර ලග්න) + lock glyph fit within the `overflow-x-auto` strip; chips wrap without clipping | 

## 8. Responsive Testing (UX §Responsive Behavior)

| ID | Test Case | Viewport | Expected |
|----|-----------|----------|----------|
| RS-WK-361 | Desktop | ≥ 1024px | strip single row left-aligned; chart pair `grid-cols-2` side-by-side; full-width tables under each figure; tags wrap |
| RS-WK-362 | Tablet | 640–1024px | figures stacked (`grid-cols-1` per existing `lg:` behavior); tables `sm:block`; strip single row (scrolls if SI labels wide) |
| RS-WK-363 | Mobile | < 640px | strip `overflow-x-auto` swipeable (no scrollbar); figures stacked; Houses/Planets become card-per-row (`role="list"`); indication chips wrap; **no horizontal page scroll** |
| RS-WK-364 | SI at 360px | 360px, SI locale | 4 tabs + lock glyph scroll within the strip (never shrink/truncate mid-glyph); no overflow beyond `overflow-x-auto` (UX QA question 7) |
| RS-WK-365 | Mobile cards content | < 640px | house card `1 · මේෂ · රවි` style with Aspects line; planet card includes Planet/Sign/Str/House (+ D1-only Nakshatra/Pada/Bhava Suchika on D1), Conj/Asp/Other lines; Other chips wrap; `aria-label` = full row text | 

## 9. Edge & Negative Cases

| ID | Test Case | Expected | Maps to |
|----|-----------|----------|---------|
| RE-WK-450 | Partial manual Navamsa matrix (all 4 states) | `navamsaLagna`/`navamsaHouses` × present/absent → `d9` null or derivable entry per data; never crash; placeholder for null (mirrors US-WK-010 edge + bhava-suchika D5 precedent) | US-WK-010 edge |
| RE-WK-451 | Corrupt stored `wargaKendara` | non-object / wrong keys / `d9: "x"` / planets array missing rows → `console.warn` + fallback; UI never renders `t()` out-of-range; no crash | US-WK-011, arch §Data Flow |
| RE-WK-452 | Stored `d9: null` on manual doc | renders `noChartData` placeholder; selecting D9 tab keeps placeholder; never an empty table | US-WK-010 AC2, UX §Q5 |
| RE-WK-453 | Empty arrays | no conjunctions, no aspects, no maraka/digBala planets → `—` cells | US-WK-006 AC3, US-WK-008 edge |
| RE-WK-454 | Legacy planet missing `navamsaSign` | auto legacy doc, planet without `navamsaSign` | D9 row defensively `—` (fallback cannot derive); no crash | US-WK-011 AC3 |
| RE-WK-455 | `resolveWargaKendara(undefined)` / `resolveWargaKendara({})` | absent/empty details | falls back to derivation (or returns undefined if nothing derivable — caller shows placeholder); never throws | US-WK-011 AC3 |
| RE-WK-456 | Render during recalculation | open the page while the recalc job runs | stored values render first, updated values after refresh; no merge artifacts (no overrides exist) | US-WK-011 AC2 |
| RE-WK-457 | Determinism | `calculateHoroscope` twice | `wargaKendara` deep-equal across runs | US-WK-011 BR |
| RE-WK-458 | Privacy regression | private non-owned horoscope with `wargaKendara` | 404 — field never leaked | US-WK-013, privacy spec |
| RE-WK-459 | Share-token expiry | expired/invalid token | existing error (404/410), no `wargaKendara` data in the response | US-WK-013 |
| RE-WK-460 | No mutation surface | hand-crafted PATCH/POST to any guessed warga-kendara route | 404 — no endpoint exists; Shad Bala PATCH unaffected | US-WK-013 BR, D8 |
| RE-WK-461 | Locale missing key at render | indication key absent in the active locale | `—` chip; no crash; console may warn | US-WK-001 edge, US-WK-012 |
| RE-WK-462 | SavedFilter legacy section keys (regression) | open a search result card saved with `visibleSections` incl. `drekkanaD3`/`dasamsaD10`/`shodashaVargas`/`chandraLagna`/`suryaLagna` | card renders without error (config keys untouched per BA Out of Scope; remapping is a PM decision, not a code change in this phase) | US-WK-004 edge, BA OQ9 |

## 10. E2E Flows (MANUAL — no Playwright installed; see §What cannot be tested)

| ID | Flow | Steps | Expected | Maps to |
|----|------|-------|----------|---------|
| E2E-WK-400 | Auto horoscope full render (fixture) | open `6a68e337150a9f9377fab96d` → charts tab | strip D1 pinned + D9 selected; D1 tags සමස්ත ජීවිතය · ශරීරය · පොදු තත්ත්ව; D9 tags විවාහය · ධර්මය · ග්රහ බලය; D1 Saturn = Capricorn \| Own Sign with Combust/Maranakaraka/Maraka/Kala Bala; D9 Saturn = Cancer \| Enemy with no D1-only chips | US-WK-001/005/006/007/008 |
| E2E-WK-401 | Pair permutations | select Surya Lagna then Chandra Lagna then D9 | D1+Surya → D1+Chandra → D1+D9; each swap updates tags + tables; exactly two figures always | US-WK-003 |
| E2E-WK-402 | D1 lock + no-op clicks | click D1 badge, click selected second tab | nothing changes; no console errors | US-WK-003 AC2/AC4 |
| E2E-WK-403 | Manual with Navamsa | open manual horoscope with navamsa data | all four tabs usable; D9 tables use entered navamsa chart | US-WK-010 AC1/AC2 |
| E2E-WK-404 | Manual without Navamsa | open manual horoscope, no navamsa | D1 renders; D9 slot shows සටහන් දත්ත නොමැත placeholder; D9 tab selectable | US-WK-010 AC2, UX Flow 4 |
| E2E-WK-405 | Legacy fallback + recalc restore | `mongosh`: `$unset wargaKendara` on one auto + one manual doc → render → run the AstrologySettings full recalc → render | tables render identically before/after (no flicker, no diff); field restored after recalc | US-WK-011 AC2/AC3, arch verification 5 |
| E2E-WK-406 | Public + share-link read-only | open another student's public horoscope + a share link | identical Warga Kendara content; no editing affordance; dev-tools POST to a guessed mutation route → 404 | US-WK-013 |
| E2E-WK-407 | Bilingual end-to-end | SI session → EN session on the same horoscope | tabs/tags/headers/chips fully localized; no English residue in SI (and vice versa) | US-WK-012 |
| E2E-WK-408 | Keyboard-only | Tab into strip, arrows/Home/End, Space/Enter to select | full swap flow works without a mouse; D1 badge skipped | US-WK-002/003, AX |
| E2E-WK-409 | 360px SI viewport | DevTools 360px, SI locale | strip scrolls horizontally (swipeable); chips wrap; no page-level horizontal scroll; SI glyphs not clipped | UX QA question 7, RS |
| E2E-WK-410 | Navigation reset | open horoscope A, swap to Surya, navigate to horoscope B, then back to A | each horoscope's charts tab starts at D1 + D9 (reset per navigation) | US-WK-003 edge |
| E2E-WK-411 | "Other Charts" = House only | open charts tab, scroll to Other Charts | only House button; House chart + current-planet overlay still work | US-WK-004 |
| E2E-WK-412 | Calculations tab regression | open calculations tab before/after the feature | Start/Mid/End, Navamsa columns, degree differences in conjunctions/aspects — unchanged | BA Clarifying Assumption 1 |

## 11. Regression Impact

| Area | Risk | Verification |
|------|------|--------------|
| Calculations tab (D1 tables) | Per-chart tables added to the charts tab must not touch the calculations tab | E2E-WK-412, full existing suite (`npx jest`) |
| Chart pair rendering (`BirthChart`/`HouseChart`) | D1 figure reuse must not alter SVG output | E2E-WK-400, existing `birthChart.test.ts` |
| "Other Charts" section | Reduction to House only changes `page.tsx` selection state | UI-WK-326/327, E2E-WK-411 |
| SavedFilter `visibleSections` keys | Legacy section ids (`drekkanaD3`, `dasamsaD10`, `shodashaVargas`, `chandraLagna`, `suryaLagna`) only exist in `src/app/search/page.tsx` — search cards must not break | RE-WK-462, existing search tests |
| Search | No search changes intended; `wargaKendara` never enters search text/conditions | existing `search-*.test.ts` suite unchanged; IT-WK-111 asserts payload is additive only |
| Shad Bala / Bhava Suchika | `wargaKendara` coexistence with both feature fields on the same doc | IT-WK-113, existing shadbalaya/bhava-suchika suites |
| Recalculation job | Job must not need changes; `wargaKendara` rides the spreads | UT-WK-058/059, IT-WK-108/109 |
| API payload size | `wargaKendara` adds per-chart houses/planets to `GET /api/horoscope/:id` and `GET /api/share/:token` | IT-WK-111; manual payload-size sanity check on the fixture doc |
| i18n files | New keys must not break existing message consumers | `pnpm build` + locale-switch checks (BI-WK-387); grep that `chartPairTitle`/`otherCharts` keys are still present (other usages may exist — UX question 10) |

## 12. Test File Layout (proposed)

```
src/__tests__/wargaKendara.test.ts            // UT-WK-001..025 + UT-WK-051..064 + UT-WK-081..085 (pure + pipeline + golden)
src/__tests__/wargaKendaraApi.test.ts         // IT-WK-100..113 (persistence via spreads; no new routes)
src/__tests__/recalculationJob.test.ts        // EXTEND — UT-WK-058/059 + IT-WK-108/109 (recalc recompute assertions)
src/__tests__/wargaKendara-ui.test.ts         // UI-WK-* + AX-WK-* + BI-WK-* + RS-WK-* (RTL, per-file jsdom, testMatch extension required) — OPTIONAL
src/__tests__/fixtures/warga-kendara-default-2026-08.json   // golden era fixture
e2e/warga-kendara.spec.ts                     // E2E-WK-* — ONLY if Playwright is added (flag §13.2)
```

## 13. Key Risk Areas / Codebase Flags

> All flags below were **verified in the code** on 2026-08-15, not assumed.

1. ⚠️ **`src/lib/wargaKendara.ts` does not exist yet** (glob verified). The Developer must create it exporting `computeWargaKendara`, `computeWargaMaraka`, `computeMaranakaraka` (re-export or import from `astrology.ts`), `computeDigBalaPlanets` (from `shadBalaya.ts`), `resolveWargaKendara`, `VARGA_CATALOG` per arch §Component Design.
2. ✅ **`computeMaranakaraka` is exported** at `astrology.ts:324` — but its doc note says "lagna chart only, never D9". The per-chart assumption (US-WK-008) requires calling it with each chart's own planets/houses; the Developer must update that doc note and the tests pin the per-chart call (UT-WK-013).
3. ✅ **`computeMaraka` is private** at `calculation.ts:585`; a public `computeMaraka(ascSign)` already exists at `manualChart.ts:1113`. The architect's `computeWargaMaraka(ascSign)` is new — Developer should consider reusing the `manualChart.ts` one to avoid a third copy (drift risk, same pattern as the bhava-suchika D9-lagna flag).
4. ✅ **`DIG_HOUSE` private map** at `shadBalaya.ts:68` (Guru/Budha 1, Kuja/Ravi 10, Chandra/Shukra 4, Shani 7). New exported `computeDigBalaPlanets(planets)` must be the single consumer — no re-implementation.
5. ✅ **Page-local helpers** `getNavamsaChartData` (`page.tsx:543`) and `getSunMoonChartData` (`page.tsx:724`) exist and move into the new module; the page then consumes `resolveWargaKendara` — tests must not depend on the page-local copies surviving.
6. ✅ **`ChartType` NOT extended** (`chartTypes.ts`): `BIRTH | NAVAMSA_D9 | HOUSE | CHANDRA_LAGNA | SURYA_LAGNA | DREKKANA_D3 | DASAMSA_D10 | SHODASHA_VARGAS`; `ALL_CHART_TYPES` unchanged. D2–D60 absent everywhere in phase 1 (UI-WK-328).
7. ⚠️ **jest `testMatch` excludes `.tsx`**: `jest.config.js` = `["**/__tests__/**/*.test.ts"]`. RTL component tests (JSX) need `*.test.tsx` — extend testMatch or run UI/AX/BI/RS cases manually. Same flag as the Bhava Suchika plan §10.10 and Shad Bala plan.
8. ⚠️ **No Playwright/Cypress** (package.json verified) — E2E-WK-400…412 are manual scripts; automation is a Developer/PM decision.
9. ⚠️ **`CalculatedDetails` model lacks `wargaKendara`** today (verified: `shadbalaya`/`bhavaSuchika`/`manualHousePlacements` are `Mixed`, `wargaKendara` absent) — Developer adds `wargaKendara: { type: Schema.Types.Mixed }`.
10. ⚠️ **No `astrology.wargaKendara.*` i18n keys exist yet** in either locale (grep verified); `chartCaptions` has only `birth` + `navamsa-d9` (`en.json:523`) — `surya-lagna`/`chandra-lagna` captions + the full `wargaKendara` block must be added to **both** files in sync.
11. ✅ **`aria-pressed` button-group pattern already exists** at `page.tsx:1149-1157` (Other Charts selection) — the new strip reuses this pattern (UX Q1); the D1 badge is a new construct (span + lock glyph).
12. ⚠️ **`chartPairTitle` used at `page.tsx:1091`** — replaced on the charts tab but the key must stay in the message files (other usages may exist; UX question 10 — grep before removing).
13. ⚠️ **Fixture horoscope `6a68e337150a9f9377fab96d` is a dev-DB doc, not a repo fixture** (glob verified — docs/specs only). Unit/golden tests must construct a result replicating its documented values (UT-WK-053); the browser checks use the real doc (E2E-WK-400).
14. ✅ **Recalc overwrites wholesale — no merge needed**: `recalculateOne` spreads `...calculated`/`...synth` (`recalculationJob.ts:205-214` / `:189-201`); no `overridden` state exists for `wargaKendara` (unlike `mergeShadBalaya`) — pure overwrite is correct and free.
15. ⚠️ **Manual `synthesizePlanets` falls back** `navamsaSign: row.navamsa?.navamsaSign ?? row.sign` (`manualChartDetails.ts:173`) — D9 must be `null` when no navamsa data, never derived from the birth sign (UT-WK-055/056; same gating discipline as bhava-suchika D5).
16. ⚠️ **No new API route and no mutation surface** — IT-WK-100/RE-WK-460 pin this; the field rides existing GET payloads only.

## 14. Acceptance Criteria Checklist (traceability matrix)

| User Story | QA test IDs | Priority | Test type |
|-----------|-------------|----------|-----------|
| US-WK-001 — Main indication as tags after each chart | UT-WK-022, UI-WK-311/312/313/314/315/316, BI-WK-381/382/383, RE-WK-461, E2E-WK-400, AX-WK-357 | Critical | unit, manual |
| US-WK-002 — Chart section tabs | UI-WK-300/301/305/306, RS-WK-361…364, AX-WK-350…355, E2E-WK-400/408, BI-WK-386 | Critical | manual |
| US-WK-003 — D1 always selected, exactly two charts | UI-WK-300/302/303/304/305/306/307/308/309/310, AX-WK-352/353/360, E2E-WK-401/402/410 | Critical | manual |
| US-WK-004 — "Other charts" reduced to House | UI-WK-326/327, E2E-WK-411, RE-WK-462 | High | manual |
| US-WK-005 — Per-chart Houses table | UT-WK-001/009, UT-WK-051/052, UT-WK-083, UI-WK-317, UI-WK-329, RE-WK-454 | Critical | unit, manual |
| US-WK-006 — Per-chart Planets table | UT-WK-002/003/004/007/008/018/019, UT-WK-052/053/084, UI-WK-318/319/320/321/322/325, RE-WK-453 | Critical | unit, manual |
| US-WK-007 — D1-only planet details | UT-WK-010/011/063, UI-WK-321/323/324, RE-WK-451 | Critical | unit, manual |
| US-WK-008 — Per-chart Maraka/Maranakaraka/Dig Bala | UT-WK-012/013/014/015/016/017, UI-WK-321/322, E2E-WK-400 | Critical | unit, manual |
| US-WK-009 — Phase-1 availability (D2–D60 omitted) | UT-WK-022, UI-WK-300/328 | High | unit, manual |
| US-WK-010 — Manual horoscopes | UT-WK-054/055/056/057/059, IT-WK-103/104/105/109, UI-WK-329, E2E-WK-403/404, RE-WK-450/452 | High | unit, integration, manual |
| US-WK-011 — Storage, recalculation, legacy | UT-WK-020/023/024/025, UT-WK-051/058/060/061/062, UT-WK-081…085, IT-WK-100/101/102/106/107/108/110/111/112/113, E2E-WK-405, RE-WK-451/455/456/457 | Critical | unit, integration, manual |
| US-WK-012 — Bilingual | BI-WK-380…388, UI-WK-314, E2E-WK-407, RS-WK-364, RE-WK-461 | High | unit, manual |
| US-WK-013 — Read-only on all views | IT-WK-100/110/112/113, UI-WK-330, E2E-WK-406/412, RE-WK-458/459/460 | High | integration, manual |
| Cross-cutting (arch Verification) | UT-WK-001…025, UT-WK-051…064, UT-WK-081…085, BI-WK-381, IT-WK-100…113 | Critical | unit, integration |
| a11y (UX §Accessibility) | AX-WK-350…360, E2E-WK-408 | High | manual |
| Responsive (UX §Responsive) | RS-WK-361…365, UI-WK-316, BI-WK-388, E2E-WK-409 | Medium | manual |
| Regression | E2E-WK-412, IT-WK-111/113, RE-WK-462, full existing suite | High | all |

## 15. What Cannot Be Tested (and how to close the gap)

1. **Per-chart Maraka/Maranakaraka rule correctness (BA OQ2/OQ3, arch assumption 1)** — the existing rule re-evaluated per chart is an **assumption**, not confirmed domain. Tests (UT-WK-012/013, UI-WK-321/322) assert the *implemented* rule and the feature-doc example values, not domain truth. Gap closed by domain sign-off; if the rule changes, only `computeWargaMaraka`/the `computeMaranakaraka` call site change (one function — the architect's design), and the affected golden fixture regenerates deliberately.
2. **Conjunction/aspect rule inside varga charts (BA OQ6, arch assumption 2)** — whole-sign diff/special-aspect evaluation is an assumption; tests pin the implemented behaviour. Same one-function swap path.
3. **Sinhala varga names/indications (BA OQ7)** — provisional SI strings; BI tests assert parity + fallback (EN authoritative), not linguistic truth. Sign-off gate for the shipped SI strings.
4. **Yogakaraka/Nidhanamsha on the D1 per-chart table (BA OQ5)** — pending domain; deliberately **not** asserted as required (the feature-doc D1-only list is exactly 12 items). If confirmed in, the D1 `Other` cell gains two chips and UI-WK-321 updates.
5. **E2E automation** — no Playwright/Cypress installed (verified in `package.json`). Until a framework is added, E2E-WK-400…412 run as manual scripts. Closing the gap requires installing Playwright + `e2e/warga-kendara.spec.ts` — Developer/PM decision (flag §13.8).
6. **Component automation** — jest `testMatch` excludes `.tsx`; UI/AX/BI/RS cases run manually unless the config is extended (flag §13.7).
7. **Payload-size impact** — `wargaKendara` roughly doubles per-horoscope payload on the two GET routes; no perf budget is defined. Manual sanity check on the fixture doc; add a perf test if the PM sets a target.
8. **Pixel-perfect legacy vs stored parity** — unit tests prove deep-equality of data (UT-WK-060); exact visual parity (no flicker) is verified manually (E2E-WK-405), since no visual-regression tooling exists.

## 16. Verification Commands

```bash
# 1. TypeScript compile — new WargaKendara types, CalculationResult.wargaKendara,
#    exported computeDigBalaPlanets, new components
pnpm build

# 2. Lint — new module + components follow repo conventions
pnpm lint

# 3. Full Jest suite — existing tests pass + new wargaKendara tests
npx jest

# 4. New pure-module + pipeline tests (fast, no mocks)
npx jest src/__tests__/wargaKendara.test.ts

# 5. New API/persistence tests
npx jest src/__tests__/wargaKendaraApi.test.ts

# 6. Recalc extension
npx jest src/__tests__/recalculationJob.test.ts

# 7. Optional component tests (only after jest.config testMatch is extended to *.test.{ts,tsx})
npx jest src/__tests__/wargaKendara-ui.test.ts
```

**Dev-DB persistence check (US-WK-011):**

```bash
# After POST/PUT /api/horoscope (auto or manual), verify the field:
mongosh --quiet mongodb://localhost:27017/kendara --eval '
    const d = db.calculateddetails.findOne({ "horoscope.id": "<id>" });
    printjson({
        hasWargaKendara: !!d.wargaKendara,
        keys: d.wargaKendara ? Object.keys(d.wargaKendara) : null,
        d9IsNull: d.wargaKendara && d.wargaKendara.d9 === null,
        d1Saturn: d.wargaKendara && d.wargaKendara.d1.planets.find(p => p.name === 7)
    });
'

# Legacy simulation (US-WK-011 AC3): strip the field, render, then recalc:
db.calculateddetails.updateOne(
    { "horoscope.id": "6a68e337150a9f9377fab96d" },
    { $unset: { wargaKendara: "" } }
)
# → render the charts tab (tables must still appear via resolveWargaKendara)
# → run the AstrologySettings full recalculation job
# → the field is restored with recomputed values
```

**Browser manual pass (acceptance script):**

1. Auto horoscope (`6a68e337150a9f9377fab96d`): D1 pinned badge + D9 selected; D1/D9 tags; D1 Saturn Capricorn|Own Sign with Combust/Maranakaraka/Maraka/Kala Bala; D9 Saturn Cancer|Enemy without D1-only chips; Nakshatra (Pada) + Bhava Suchika columns only on D1; no degree differences anywhere.
2. Swap D9 → Surya → Chandra → D9; click D1 and the selected tab (no-ops); rapid-switch settle; navigate to another horoscope (reset to D9).
3. Manual horoscope with Navamsa data → D9 populated; without → සටහන් දත්ත නොමැත placeholder.
4. Legacy doc (`$unset` above) → tables still render; recalc restores.
5. Public horoscope + share link → identical read-only content; expired token → existing error.
6. SI ⇄ EN switch → tabs/tags/headers/chips re-render; 360px SI viewport → strip scrolls, chips wrap, no page-level horizontal scroll.
7. Keyboard-only: Tab → arrows → Home/End → Space/Enter; D1 badge skipped; swap announces.
8. "Other Charts" shows House only; House chart + current-planet overlay unchanged; calculations tab unchanged.

## 17. Open Questions / Risks (must be confirmed before sign-off)

1. **Per-chart Maraka/Maranakaraka rule (US-WK-008, BA OQ2/OQ3)** — the tests and implementation assume the existing rule re-evaluated against each chart's own lagna/houses. Domain must confirm before sign-off; wrong rule = wrong `Other` chips on every chart (highest-risk item).
2. **Dig Bala mapping per chart (BA OQ4)** — tests assume the existing `DIG_HOUSE` map evaluated against each chart's own houses with Rahu/Ketu excluded. Confirm with domain.
3. **Conjunction/aspect rule inside varga charts (BA OQ6)** — tests assume whole-sign same-house conjunctions + the existing whole-sign diff/special-aspect table within each chart, without degree fields. Confirm with domain.
4. **Yogakaraka/Nidhanamsha on the D1 per-chart table (BA OQ5)** — NOT tested as required; if domain includes them, the D1 `Other` cell grows (UI-WK-321/323 updates).
5. **Sinhala strings (BA OQ7)** — provisional; BI tests assert parity and EN fallback only. Authoritative SI strings required before release.
6. **Surya/Chandra Lagna indication strings** — provisional ("Sun-based chart"/"Moon-based chart"); domain confirmation needed (UX Q11).
7. **Selection persistence (BA OQ8)** — phase 1 is client-side only, reset per navigation; UI-WK-310 pins this. If persistence is later required, the reset test changes.
8. **SavedFilter section-key remapping (BA OQ9)** — config keys left untouched; RE-WK-462 regression-checks search cards only. PM decision pending.
9. **D9 partial-navamsa derivation (US-WK-010 edge)** — "whatever is derivable or the placeholder" is deliberately loose; RE-WK-450/UT-WK-056 pin the implemented matrix, which the Developer must document explicitly.
10. **`computeMaraka` duplication (flags §13.3)** — three copies of the 2nd/7th-lord rule (calculation.ts, manualChart.ts, new computeWargaMaraka) is a drift risk; Developer should consolidate, and the parity of the three must be pinned by a test if consolidated into a shared helper.

## Documents Updated

- `specs/qa/20260815-1233-warga-kendara-test-plan.md` — this document (new).
- `specs/qa/strategy.md` — pending: add a "Warga Kendara (වර්ග කේනදර) — Testing Considerations" section mirroring the Shad Bala / Bhava Suchika entries once this plan is reviewed.
