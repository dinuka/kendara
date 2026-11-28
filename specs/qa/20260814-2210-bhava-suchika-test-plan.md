# QA Test Plan — Bhava Suchika (භාව සුචික) — Navamsa House Index

**Date:** 2026-08-14 22:10
**Author:** QA (BMAD)
**Based on:** `specs/business-analysis/20260814-2055-bhava-suchika.md` (US-BS-001…008), `specs/business-analysis/data-model.md` → [Bhava Suchika (House Index)](#), `specs/business-analysis/actors.md`, `specs/architecture/20260814-2127-bhava-suchika-architecture.md` (D1–D9, verification 1–10), `specs/ux/20260814-2130-bhava-suchika.md` (§OQ4/OQ5, states, traceability, QA questions), `docs/bhava-suchika.md`, `src/lib/astrology.ts`, `src/lib/astrologyEnums.ts`, `src/lib/calculation.ts`, `src/lib/manualChart.ts`, `src/lib/manualChartDetails.ts`, `src/lib/recalculationJob.ts`, `src/lib/search/vocabulary.ts`, `src/lib/search/textContent.ts`, `src/lib/search/indexer.ts`, `src/app/api/search/route.ts`, `src/app/search/page.tsx`, `src/app/horoscopes/[id]/page.tsx`, `src/models/CalculatedDetails.ts`, `src/app/api/horoscope/route.ts`, `src/messages/en.json`, `src/messages/si.json`, `src/__tests__/calculation.test.ts`, `src/__tests__/manualChart.test.ts`, `src/__tests__/recalculationJob.test.ts`, `jest.config.js`, `package.json`

---

## Scope

This test plan covers the භාව සුචික නවාංශක ක්‍රමය (Bhava Suchika / Navamsa house index) feature — the D1-house-of-the-Navamsa-sign index (1–12) for the Lagna and all 9 planets:

- **Pure module** `src/lib/bhavaSuchika.ts` (NEW — **verified not to exist yet**): `computeNavamsaLagnaSign(ascSign, ascDegree)`, `computeLagnaBhavaSuchika(lagnaSign, navamsaLagnaSign)`, `computePlanetBhavaSuchika(navamsaSignValue, lagnaSign)`, `computeBhavaSuchika(planets, lagnaSign)` — rule `((navamsaSign − lagnaSign) mod 12) + 1`, whole-sign (D1/D2/D9).
- **Pipeline integration**: auto (`calculateHoroscope` result object, `calculation.ts:443-474`) and manual (`synthesizeCalculation`, `manualChartDetails.ts:184-229`, gated per D5) — both persist via the existing `...calculated` / `...synth` spreads; **no overrides, no merge** (unlike Shad Bala).
- **Schema**: `CalculatedDetails.lagnaBhavaSuchika` (Integer 1–12) + `CalculatedDetails.bhavaSuchika` (Record `"1"…"9"` → 1–12) + `CalculationResult` optional fields.
- **Render fallback**: pure render-time recompute for legacy docs (mirrors `computeAscendantSpecialFlags` / `resolvedMaranakaraka`), gated OFF for manual-without-Navamsa.
- **UI**: Lagna-section tag (FIRST in the tag row, indigo pill, `{label}: {value} — {name}`, tooltip) + new planets-table column AFTER Nakshatra (`{value} — {name}`, blank `—`, `whitespace-nowrap`) at all three render sites (desktop `<th>`/`<td>`, mobile card `<span>`) + search result card mirroring.
- **i18n**: `astrology.bhavaSuchika.{label, names.1..12, tooltip, infoGlyph}` in `en.json` + `si.json` in sync.
- **Search (US-BS-008 — IN SCOPE)**: new exact conditions `{ type: "bhava_suchika"; value }` and `{ type: "planet_bhava_suchika"; planet; value }` in `/api/search/route.ts`, scoring +1.0 Lagna / +0.5 per planet, `BHAVA_SUCHIKA_*` vocabulary maps, guarded SI+EN sentences in `textContent.ts` (vector leg), search result card mirror.
- **Recalculation**: AstrologySettings job recomputes the fields (pure overwrite — `...calculated` / `...synth` spread, `recalculationJob.ts:189-201, 205-214`).

**Out of scope:** chart SVG rendering; reading the `navamsa-d9` Chart document (D1 — explicitly rejected); English-name domain confirmation (BA OQ1 — transliterations provisional); user overrides / mutation endpoint (US-BS-007 AC4); changes to Shad Bala, Wargoththama/Gandamula, aspects, dashas; any new API routes (D8).

## Test Strategy

| Level | Scope | Tool/Framework | Test IDs |
|-------|-------|----------------|----------|
| Unit | Pure rules in `src/lib/bhavaSuchika.ts` (NEW): mod-12 formula identity, wrap, degree→navamsa wedge boundaries (3°20′, 6°40′, 0, top-of-sign), all-12 sweep, Wargoththama invariant, 9-planet output contract, determinism, source-agnostic | Jest + ts-jest, node env, `@/` → `src/` (jest.config.js moduleNameMapper) | `UT-BS-*` |
| Unit (pipeline) | `calculateHoroscope` (auto) output gains both fields; `synthesizeCalculation` (manual) gating matrix (D5); `synthesizeNavamsaCalculation` untouched; legacy render fallback resolution `stored ?? recompute` | Jest + ts-jest, node env; fixtures via the existing `calculation.test.ts` `baseData` (1990-06-15 08:30 Colombo, lahiri) | `UT-BS-05x` |
| Golden | Era-stamped fixture asserting `calculateHoroscope` golden birth chart gains `lagnaBhavaSuchika` + `bhavaSuchika` (9 keys, exact values) | Jest + JSON fixture under `src/__tests__/fixtures/` | `UT-BS-08x` |
| Integration / API | No new endpoints (D8); POST /api/horoscope persists via `...calculated` spread (`route.ts:80-83`); manual routes derive iff navamsa data; recalc job recomputes (no merge); GET returns fields; nothing on legacy docs | Jest + mocked `getServerSession` + mocked `connectDB` (reuse `auth.test.ts`/`privacy.test.ts`/`recalculationJob.test.ts` patterns) | `IT-BS-*` |
| Search | Query triggers (SI/EN names, numbers, "භාව සුචික"/"bhava suchika"), Lagna-only + planet-pair conditions, exact-condition shape, scoring order (+1.0/+0.5), grammar (comma-AND / හෝ OR), manual-without-Navamsa never matches, vocabulary maps, `textContent.ts` sentences (both languages, guarded), search result card mirror, privacy unchanged | Jest + mocked session/DB + **mocked `@/lib/search/embedding` + `@/lib/search/qdrant`** (Transformers.js model load must be mocked — verified route calls `generateEmbedding` on every POST, `route.ts:747`) | `SR-BS-*` |
| Component / UI | Lagna tag (first position, indigo, label+value+name, button/tooltip), desktop `<th>`/`<td>` after Nakshatra, cell format + `—` blank + nowrap, mobile span after Nakshatra, legacy no-flicker, read-only everywhere, locale switch | `@testing-library/react` 16.3.2 (in devDependencies) **— but see ⚠️ flag: jest `testMatch` only matches `*.test.ts`, JSX needs `.tsx`** — or manual checks; per-file `/** @jest-environment jsdom */` | `UI-BS-*`, `AX-BS-*`, `BI-BS-*` |
| E2E | Full user flows (auto/manual/legacy render, search queries + result cards, share-link read-only, locale switch) | **No E2E framework installed** (verified: no Playwright/Cypress in `package.json`) — cases are executable manual scripts; installing Playwright is a Developer/PM decision (see §What cannot be tested) | `E2E-BS-*` (manual) |
| Edge / Negative | Wrap-around, boundaries, corrupt/out-of-range stored values, partial manual-input matrix, privacy, no mutation surface, concurrency | Jest (pure + route) + manual | `RE-BS-*` |

**Approach:** all rule logic lives in a new pure module — unit tests assert against numeric-enum fixtures directly with no mocks. Pipeline tests prove the fields ride the existing spreads (no new persistence code path beyond `CalculationResult`/schema). API tests assert there is **no new route** and that the existing routes persist/return the fields additively. Search tests must mock the embedding/Qdrant leg (verified: `POST /api/search` calls `generateEmbedding` → Transformers.js on every request; the pure keyword path is the deterministic test surface). E2E cases double as the acceptance script for the Developer's manual QA pass.

## Test Environment

| Environment | Configuration |
|-------------|---------------|
| Unit | Jest + ts-jest, node env, `@/` → `src/` (jest.config.js moduleNameMapper) — `npx jest src/__tests__/bhavaSuchika.test.ts` |
| API | Route-handler tests with mocked `getServerSession` + mocked `connectDB` + mocked Mongoose models (pattern from `privacy.test.ts` / `recalculationJob.test.ts`) |
| Search | Route-level tests must ALSO mock `@/lib/search/embedding` (`generateEmbedding → null` forces the keyword-only path) and `@/lib/search/qdrant` (`ensureCollection`/`searchPoints`) — otherwise Transformers.js attempts a model download |
| Component (optional) | `@testing-library/react` 16.3.2 + `@testing-library/jest-dom` in devDependencies; **jest.config `testMatch` must be extended to `*.test.{ts,tsx}`** (currently `["**/__tests__/**/*.test.ts"]`) — see §Key risk areas |
| E2E | None — manual scripts; Playwright install flagged |
| Golden | Versioned fixture `src/__tests__/fixtures/bhava-suchika-default-2026-08.json` (era-stamped, mirroring the shadbalaya fixtures convention) |

---

## 1. Unit Tests — Pure Module `src/lib/bhavaSuchika.ts` (NEW)

Canonical rule (D2, whole-sign — exact because `houses[].sign` is whole-sign by construction, `calculation.ts:321-325`):

```
Bhava Suchika = ((navamsaSign − lagnaSign) mod 12) + 1
```

`computeNavamsaLagnaSign(ascSign, ascDegree)` = `navamsaSign(ascSign, Math.floor(ascDegree / (30/9)) + 1)` — **verified identical** to the 5 existing inline sites (`calculation.ts:505, 523, 559, 593, 606`; `navamsaSign` exported at `astrology.ts:31`).

| ID | Test Case | Input | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UT-BS-001 | Lagna rule applied (AC1 example 1) | `computeLagnaBhavaSuchika(1, 2)` — Mesha lagna, Vrishabha navamsa lagna | `2` (ධනාංශකය) | US-BS-003 AC1 |
| UT-BS-002 | Lagna rule applied (AC1 example 2) | `computeLagnaBhavaSuchika(1, 10)` — navamsa lagna Makara | `10` (අභිමානාංශකය) | US-BS-003 AC1 |
| UT-BS-003 | Same sign → house 1 | `computeLagnaBhavaSuchika(1, 1)` | `1` (ලග්නාංශකය) | US-BS-003 AC2 |
| UT-BS-004 | Wrap-around (AC3) | `computeLagnaBhavaSuchika(1, 12)` — navamsa lagna Meena in a Mesha chart | `12` (ව්‍යාංශකය) | US-BS-003 AC3 |
| UT-BS-005 | Wrap-behind (navamsa sign one behind lagna) | `computeLagnaBhavaSuchika(5, 4)` — Leo lagna, Cancer navamsa lagna → `((4-5) mod 12)+1 = 12` | `12` | US-BS-003 AC3, D2 |
| UT-BS-006 | Mod-12 identity — fixed lagna, all 12 navamsa lagna values | `computeLagnaBhavaSuchika(1, n)` for n = 1..12 | outputs are exactly `1..12` in order (a permutation — no duplicates, no gaps) | US-BS-003 Business Rule |
| UT-BS-007 | Full 12×12 sweep | all `(lagna, navamsaLagna)` pairs in 1..12 | `value === ((navamsaLagna - lagna + 12) % 12) + 1`; every value in [1, 12]; integer | US-BS-003 BR, D2 |
| UT-BS-008 | Planet rule applied (AC1 example 1) | `computePlanetBhavaSuchika(10, 1)` — planet navamsa sign Makara, Mesha lagna | `10` (අභිමානාංශකය) | US-BS-004 AC1 |
| UT-BS-009 | Planet rule applied (AC1 example 2) | `computePlanetBhavaSuchika(6, 1)` — navamsa Kanya, Mesha lagna | `6` (ශෂ්ඨාංශකය) | US-BS-004 AC1 |
| UT-BS-010 | Planet navamsa == lagna → 1 | `computePlanetBhavaSuchika(lagna, lagna)` for every lagna 1..12 | `1` (ලග්නාංශකය) | US-BS-004, D2 |
| UT-BS-011 | Wargoththama invariant | for each planet key, `sign === navamsaSign` in a fixed lagna chart (e.g. lagna 1, planet in sign 7 → house 7) | `bhavaSuchika[planet] === its D1 house` (e.g. `7` — සප්තමාංශකය) | US-BS-004 AC3 |
| UT-BS-012 | Navamsa-lagna first wedge | `computeNavamsaLagnaSign(1, 0)` | `1` (floor(0/3.333)+1 = 1) | D1, D9 |
| UT-BS-013 | Degree→navamsa boundary at exactly 3°20′ | `computeNavamsaLagnaSign(1, 30/9)` | `2` — the boundary at `30/9` belongs to wedge 2 (`floor(1.0)+1 = 2`) | D1, arch verification 1 |
| UT-BS-014 | Just below 3°20′ | `computeNavamsaLagnaSign(1, 30/9 - 0.0001)` | `1` (`floor(0.99999)+1 = 1`) | D1 |
| UT-BS-015 | Boundary at exactly 6°40′ | `computeNavamsaLagnaSign(1, 2*(30/9))` | `3` | D1 |
| UT-BS-016 | Just below 6°40′ | `computeNavamsaLagnaSign(1, 2*(30/9) - 0.0001)` | `2` | D1 |
| UT-BS-017 | Top of sign (ascDegree 29.999) | `computeNavamsaLagnaSign(1, 29.999)` | `9` (last wedge) | D1, arch verification 1 |
| UT-BS-018 | Sign-12 wrap (zodiac-end lagna) | `computeNavamsaLagnaSign(12, 29.999)` | `9` — `navamsaSign(12, 9)` resolves via the movable/fixed/dual offset table (`astrology.ts:31-35`) | D1, D9 |
| UT-BS-019 | Planet navamsa boundary at exactly 13°20′ | planet at 13°20′ in sign 1 → wedge `floor(13.3333/3.3333)+1 = 5`; `computePlanetBhavaSuchika(5, 1)` | `5` | US-BS-004, manualChart navamsa convention |
| UT-BS-020 | Just below 13°20′ | planet at 13°19.999′ → wedge 4; `computePlanetBhavaSuchika(4, 1)` | `4` | US-BS-004 |
| UT-BS-021 | `computeBhavaSuchika` output contract | `computeBhavaSuchika(planetDetails, lagnaSign)` with 9 planets | object with exactly keys `"1"`…`"9"` (Planet enum strings), every value integer in 1..12 | arch §Data model |
| UT-BS-022 | Rahu/Ketu receive values | `computeBhavaSuchika` with planets 8 and 9 present (navamsa signs arbitrary) | keys `"8"` and `"9"` present, values 1-12 — nodes are points with Navamsa signs like any other planet | US-BS-004 AC2, arch D3 |
| UT-BS-023 | Determinism | same `(planets, lagnaSign)` twice | deep-equal outputs (pure, no I/O, no ephemeris — enables client-side legacy recompute) | US-BS-003/004 BR, D4 |
| UT-BS-024 | Source-agnostic rule | auto-derived navamsa lagna sign vs manual-entered `navamsaLagna` with the same value | `computeLagnaBhavaSuchika(lagna, x)` identical regardless of source — the rule itself knows nothing about auto/manual | US-BS-003 AC4, US-BS-004 AC4 |
| UT-BS-025 | Pure-module import surface | import `@/lib/bhavaSuchika` in a node test | module imports only types/enums (no ephemeris, no Mongo, no logger I/O) — same contract as `shadBalaya.ts` (D4) | arch D4 |

## 2. Unit Tests — Pipeline Integration (auto, manual, legacy fallback)

| ID | Test Case | Input | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UT-BS-051 | Auto output gains both fields | `calculateHoroscope(baseData)` (calculation.test.ts baseData — 1990-06-15 08:30, Colombo, lahiri) | `result.lagnaBhavaSuchika` is an integer in 1..12; `result.bhavaSuchika` has exactly 9 keys `"1"`…`"9"`, each 1-12 | US-BS-007 AC1, arch §Auto flow |
| UT-BS-052 | Auto per-planet cross-check | for each planet p in the auto result | `result.bhavaSuchika[String(p.name)] === ((p.navamsaSign - result.ascendant.sign + 12) % 12) + 1` | US-BS-004 AC1, arch §Calculation rule |
| UT-BS-053 | Auto lagna cross-check | `ascSign`, `ascDegree` from the auto result | `result.lagnaBhavaSuchika === computeLagnaBhavaSuchika(ascSign, computeNavamsaLagnaSign(ascSign, ascDegree))` — inline derivation, never the `navamsa-d9` Chart doc | US-BS-003, D1 |
| UT-BS-054 | Auto Wargoththama invariant on real data | any auto horoscope with a Wargoththama planet (`sign === navamsaSign`) | that planet's `bhavaSuchika` equals its D1 `house` | US-BS-004 AC3, arch sanity |
| UT-BS-055 | Manual (full navamsa data) gains both fields | `compute()` + `synthesizeCalculation()` with `navamsaLagna` + `navamsaHouses` entered | output has `lagnaBhavaSuchika` (from entered `navamsaLagna`) and `bhavaSuchika` (from entered navamsa chart signs mapped into D1) | US-BS-006 AC1/AC2 |
| UT-BS-056 | Manual values match the entered navamsa chart | manual chart where navamsa house 1 sign = X, planet's navamsa sign = Y | `lagnaBhavaSuchika === ((X - lagna + 12) % 12) + 1`; per-planet `((Y - lagna + 12) % 12) + 1` | US-BS-006 AC1/AC2 |
| UT-BS-057 | Manual without navamsa data → both fields absent | `synthesizeCalculation` with no `navamsaLagna`, no `navamsaHouses` | `lagnaBhavaSuchika === undefined`, `bhavaSuchika === undefined` in the return object (gated — never derived) | US-BS-006 AC3, D5 |
| UT-BS-058 | Partial: `navamsaLagna` only | manual input with `navamsaLagna` set, no `navamsaHouses` | `lagnaBhavaSuchika` present; `bhavaSuchika === undefined` (per-planet values require `navamsaHouses`) | US-BS-006 AC4, D5 matrix row 2 |
| UT-BS-059 | Partial API-edge: `navamsaHouses` only | manual input with `navamsaHouses`, no `navamsaLagna` (UI prevents this order — API can produce it) | `lagnaBhavaSuchika === undefined`; `bhavaSuchika` present | US-BS-006 AC4, D5 matrix row 3, UX §QA question |
| UT-BS-060 | `synthesizeNavamsaCalculation` NOT enriched | D9 CalculationResult from the manual pipeline | output does NOT contain `lagnaBhavaSuchika`/`bhavaSuchika` — Bhava Suchika is a D1-chart value, never a D9 value | arch §manual pipeline note |
| UT-BS-061 | Legacy render fallback matches persisted values | auto doc with `lagnaBhavaSuchika`/`bhavaSuchika` removed; recompute from `ascendant.sign`/`ascendant.degree` + per-planet `navamsaSign` | recomputed values deep-equal the pre-removal persisted values (fallback === fresh calculate for the same doc) | US-BS-007 AC3, arch §Legacy |
| UT-BS-062 | Fallback resolution prefers stored | resolution helper with stored `7` + recomputed `7` | resolved `7` (stored wins — no recompute path taken; this is what makes the no-flicker guarantee hold) | US-BS-007 AC3, UX §OQ5 note |
| UT-BS-063 | Manual-without-navamsa: fallback gated OFF | manual doc without navamsa data, fields absent | resolution yields `undefined` (no tag / `—` cells) — the `??` fallback must NOT fire for this case | US-BS-006 AC3, UX §states |
| UT-BS-064 | No drift between `computeNavamsaLagnaSign` and `deriveNavamsaLagnaFromDegree` | both functions over a sweep of `(sign, degree)` pairs (0°, 30/9°, 30/9°−ε, 15°, 29.999°) | identical outputs — the search route uses `deriveNavamsaLagnaFromDegree` (`manualChart.ts:438`) today; the new module must agree (single formula, D9) | D9, SR-BS-200…218 |

## 3. Golden Tests

| ID | Test Case | Input | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UT-BS-081 | Golden auto chart gains both fields | `calculateHoroscope(baseData)` (1990-06-15 08:30, Colombo, lahiri) | `lagnaBhavaSuchika` integer 1-12 + `bhavaSuchika` with exactly 9 keys, frozen as `src/__tests__/fixtures/bhava-suchika-default-2026-08.json` | US-BS-007 AC1, arch verification 3 |
| UT-BS-082 | Golden value domain | fixture contents | every value in 1..12 | US-BS-003/004 BR |
| UT-BS-083 | Golden lagna self-check | fixture + `ascendant` from the same run | `lagnaBhavaSuchika === ((navamsaSign(ascSign, floor(ascDegree/(30/9))+1) − ascSign) mod 12) + 1` | US-BS-003 |
| UT-BS-084 | Golden per-planet self-check | fixture + stored `planets[].navamsaSign` | every `bhavaSuchika[key] === ((navamsaSign − ascSign) mod 12) + 1` | US-BS-004 |
| UT-BS-085 | Fixture regeneration recipe | change the formula (or navamsa offset table) and run the suite | golden assertion fails loudly with the era-stamped diff — regenerate deliberately, never silently | arch verification 2 |

## 4. Integration / API Tests — no new routes (D8), persistence via existing spreads

Verified persistence facts: `POST /api/horoscope` does `CalculatedDetails.create({ horoscope: { id }, ...calculated })` (`route.ts:80-83`); `recalculateOne` spreads `...calculated` (auto, `recalculationJob.ts:205-214`) and `...synth` (manual, `:189-201`). Adding the fields to `CalculationResult` (return object `calculation.ts:443-474`) stores them automatically in every path — **no new persist code exists or is wanted**.

| ID | Test Case | Setup | Expected | Maps to |
|----|-----------|-------|----------|---------|
| IT-BS-100 | No new route files | glob `src/app/api/**` for any bhava-suchika route | no new route; **no PATCH/POST mutation endpoint exists** — a hand-crafted request to a guessed route returns 404 | US-BS-007 AC4, D8 |
| IT-BS-101 | Auto create persists fields | mock `calculateHoroscope` → return object with `lagnaBhavaSuchika: 7`, `bhavaSuchika: { "1": 2, ... }`; call POST /api/horoscope | `CalculatedDetails.create` called with payload containing both fields via the `...calculated` spread; no extra code path | US-BS-007 AC1, D3 |
| IT-BS-102 | Fields absent when calculation omits them | mocked calculated without the fields (legacy-shaped engine output) | create succeeds without the fields — optionality holds, no coercion, no crash | D3, arch §Migration |
| IT-BS-103 | Manual create derives iff navamsa data | POST /api/horoscope/manual with `navamsaLagna` + `navamsaHouses` | persisted `calculatedDetails` includes both fields | US-BS-006 AC1/AC2 |
| IT-BS-104 | Manual create without navamsa → absent | POST /api/horoscope/manual minimal body (no navamsa) | persisted doc has neither field | US-BS-006 AC3 |
| IT-BS-105 | Manual-chart update re-derives | PUT /api/horoscope/[id]/manual-chart with navamsa data changed | fields re-derived on every save (values track the entered chart) | US-BS-006, arch §API contracts |
| IT-BS-106 | GET returns stored fields | GET /api/horoscope/:id (owner) on a fresh auto doc | `calculatedDetails.lagnaBhavaSuchika` + `calculatedDetails.bhavaSuchika` present | arch §API contracts |
| IT-BS-107 | GET legacy doc | GET on a doc stored before the fields existed | fields absent (or `—` in UI); HTTP 200 — no migration/backfill invoked | US-BS-007 AC3, D3 |
| IT-BS-108 | Recalc auto recomputes (no merge) | `recalculateOne` auto branch; `calculateHoroscope` returns the fields | `findOneAndUpdate` payload carries the computed fields via `...calculated`; **no `mergeBhavaSuchika` call exists or is needed** — assert no `overridden` key anywhere in the payload (unlike `mergeShadBalaya`, `:211`) | US-BS-007 AC2 |
| IT-BS-109 | Recalc manual recomputes (gated) | manual branch with navamsa data | payload includes both fields via `...synth` alongside `manualHousePlacements` (sanitized) + `derivedRanges` — parity US-SAS-009 | US-BS-007 AC2 |
| IT-BS-110 | Recalc manual without navamsa | manual branch, no navamsa data | payload fields absent — gating survives recalculation | US-BS-006 AC3, D5 |
| IT-BS-111 | Partial-failure safety | computation throws for one horoscope mid-run | horoscope counted as failed, snapshot untouched, run continues (existing job semantics — regression) | US-SAS-010 |
| IT-BS-112 | Shad Bala PATCH never touches Bhava Suchika | PATCH /api/horoscope/[id]/shadbalaya on a doc with both feature sets | `$set` touches only `shadbalaya.<planet>.<bala>.*`; `lagnaBhavaSuchika`/`bhavaSuchika` byte-identical after | D8, US-BS-007 AC4 |
| IT-BS-113 | Response shape additive | full GET payload vs pre-feature key set | exactly two new keys (`lagnaBhavaSuchika`, `bhavaSuchika`) added under `calculatedDetails`; no key removed/reordered (deep key-set compare) | arch §API contracts |

## 5. Search Tests — US-BS-008 (IN SCOPE)

Verified route facts: `ExactCondition` today is `ascendant | navamsa_ascendant | planet_in_house | nakshatra | planet_strength | planet_role` (`route.ts:34-40`); pairing logic precedent = `getPlanetStrengthPairs` (`:152-220`); scoring precedent = +1.0 ascendant (`:559`), +0.5 per planet strength (`:616`). The new `bhava_suchika` / `planet_bhava_suchika` conditions mirror these. **⚠️ The route calls `generateEmbedding` (Transformers.js) on every POST (`:747`) and Qdrant `ensureCollection`/`searchPoints` (`:749-751`) — all route-level tests must mock `@/lib/search/embedding` and `@/lib/search/qdrant` (return `null`/`false` forces the deterministic keyword path).** No Gemini query-parsing exists anywhere in `src/` (verified — `@google/generative-ai` is an unused dependency); the vector leg is Transformers.js + Qdrant via `indexer.ts`.

| ID | Test Case | Input | Expected | Maps to |
|----|-----------|-------|----------|---------|
| SR-BS-200 | SI trigger + name | query `"භාව සුචික ලග්නාංශකය"` | exact condition `{ type: "bhava_suchika", value: 1 }`; horoscopes with `lagnaBhavaSuchika === 1` returned, ranked first | US-BS-008 AC1 |
| SR-BS-201 | EN trigger + name | `"bhava suchika bhagyamshaka"` | condition value `9`; Lagna-9 horoscopes ranked first | US-BS-008 AC1/AC4 |
| SR-BS-202 | Bare SI name (no trigger) | `"ලග්නාංශකය"` | value `1` — the house-index name alone is a sufficient signal | US-BS-008 edge |
| SR-BS-203 | Bare EN name | `"bhagyamshaka"` | value `9` | US-BS-008 edge |
| SR-BS-204 | SI number form | `"භාව සුචික 9"` | value `9` | US-BS-008 edge |
| SR-BS-205 | EN number form | `"bhava suchika 9"` | value `9` | US-BS-008 edge |
| SR-BS-206 | Out-of-range number | `"bhava suchika 13"`, `"bhava suchika 0"` | no condition (yields nothing, behaves like a plain query — never 500) | arch §edge cases |
| SR-BS-207 | Planet pair SI | `"ගුරු භාව සුචික 11"` | `{ type: "planet_bhava_suchika", planet: 5, value: 11 }` (pairing mirrors `getPlanetStrengthPairs`) | US-BS-008 AC2 |
| SR-BS-208 | Planet pair EN | `"Jupiter bhava suchika labhamshaka"` | planet `5`, value `11` | US-BS-008 AC2/AC4 |
| SR-BS-209 | All 12 SI names resolve | each of `ලග්නාංශකය`…`ව්‍යාංශකය` | `BHAVA_SUCHIKA_NAMES_SI` maps 1..12 exactly (grep-able map test) | US-BS-008 AC4, US-BS-005 |
| SR-BS-210 | All 12 EN names resolve | each of `Lagnamshaka`…`Vyamshaka` | `BHAVA_SUCHIKA_NAMES_EN` maps 1..12 exactly | US-BS-008 AC4, US-BS-005 |
| SR-BS-211 | Vocabulary feeds suggestions | `BHAVA_SUCHIKA_WORDS` + both name maps included in `TRIGGER_WORDS` / `VOCABULARY_WORDS` (`vocabulary.ts:80-92`) | `SEARCH_VOCABULARY` contains `"භාව සුචික"`, `"bhava suchika"`, and the 24 names — suggestions can offer them | arch §vocabulary, US-BS-008 BR |
| SR-BS-212 | Lagna match scoring +1.0 | horoscope A `lagnaBhavaSuchika === 9`, horoscope B value 3; query `"bhagyamshaka"` | A scores ≥ +1.0 above baseline, ranks above B; `matchedConditions` records the match | US-BS-008 AC1, arch §scoring |
| SR-BS-213 | Per-planet match +0.5 | horoscope with Jupiter `bhavaSuchika["5"] === 11`; query `"ගුරු භාව සුචික 11"` | matches, +0.5 contributed; a Lagna match alone (+1.0) outranks a single planet match (+0.5) | US-BS-008 AC2, arch §scoring |
| SR-BS-214 | Exact-condition output shape | any Bhava Suchika query | `queryUnderstanding.conditions` includes `bhava_suchika` / `planet_bhava_suchika` intent (via `getAstroKeywords`); `matchedConditions` strings present; response payload shape unchanged | arch §search flow, D8 |
| SR-BS-215 | Manual-without-Navamsa never matches | manual doc, no navamsa data (no stored fields, fallback gated off) | exact condition fails, score contribution 0 — never returned for a Bhava Suchika query | US-BS-008 AC6 |
| SR-BS-216 | Comma-AND groups | `"භාව සුචික 7, ගුරු භාව සුචික 11"` | both conditions must hold (group AND semantics — same grammar as the rest of search) | US-BS-008 edge |
| SR-BS-217 | හෝ OR clause | `"භාව සුචික 7 හෝ භාව සුචික 11"` | either condition matches the group (OR semantics) | US-BS-008 edge |
| SR-BS-218 | Mixed-language query | `"bhava suchika ලග්නාංශකය"` | resolution works across locales (trigger EN + name SI both recognised) | US-BS-008 AC4 |
| SR-BS-219 | textContent EN sentences | `getTextForBothLanguages(calc)` on an auto calc | EN text contains `Lagna Bhava Suchika: <Name> (<n>).` + per-planet `Jupiter Bhava Suchika: Labhamshaka (11).` style sentences | US-BS-008 AC5, D6 |
| SR-BS-220 | textContent SI sentences | same on SI | SI text contains `ලග්න භාව සුචික: සප්තමාංශකය (7).` + per-planet sentences | US-BS-008 AC5, D6 |
| SR-BS-221 | textContent legacy fallback | calc WITHOUT stored fields (auto legacy) | sentences still emitted via the pure-function fallback (fields optional → recompute at generation time) | US-BS-008 AC5/AC6, arch §textContent |
| SR-BS-222 | textContent manual-without-navamsa | calc with both fields `undefined` (manual, no navamsa) | **no** Bhava Suchika sentence emitted — a naive fallback would inject birth-sign-derived (wrong) values (D5 applies to search text too) | US-BS-008 AC6, D5 |
| SR-BS-223 | Indexer picks up the text | `indexHoroscope` (`indexer.ts:29` → `getTextForBothLanguages`) with mocked `generateEmbedding` | `SearchEmbedding.textContent` (SI + EN) contains the sentences; Qdrant upsert payload includes them when ready | US-BS-008 AC5, D6 |
| SR-BS-224 | Search card Lagna block mirrors | search card for an auto horoscope | Bhava Suchika tag FIRST in the flag row, indigo pill, `{label}: {value} — {name}` — same format as the detail page | US-BS-008 AC3, D7 |
| SR-BS-225 | Search card planet rows mirror | same card | each planet row shows `{value} — {name}` in the same position as the calculation tab (after Nakshatra) | US-BS-008 AC3, D7 |
| SR-BS-226 | Search card manual-without-navamsa | card for a manual no-navamsa horoscope | no tag, `—` cells — nothing to mirror | US-BS-008 AC6 |
| SR-BS-227 | Privacy filtering unchanged | private horoscope of another user with a matching value | never in results (`$or: [{ "owner.id": userId }, { isPublic: true }]` intact — regression) | US-BS-008 BR, privacy spec |
| SR-BS-228 | Legacy doc matches at search time | legacy auto doc (fields absent in Mongo) | search resolves via the same render-layer resolution (stored `??` fallback) — matches correctly | US-BS-008 AC6, arch §search flow |

## 6. Component / UI Tests (RTL if configured, else manual)

> ⚠️ `@testing-library/react` 16.3.2 is in devDependencies but `jest.config.js` sets `testMatch: ["**/__tests__/**/*.test.ts"]` — JSX component tests need `.tsx` files which will NOT match. Either extend testMatch to `*.test.{ts,tsx}` or run these cases as manual checks; either way the assertions below are the acceptance bar.

| ID | Test Case | Steps | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UI-BS-300 | Lagna tag position + content | open auto horoscope calculations tab | tag is FIRST (leftmost) in the ascendant tag row — before Wargoththama; content `භාව සුචික: 7 — සප්තමාංශකය` (SI) / `Bhava Suchika: 7 — Saptamamshaka` (EN) | US-BS-001 AC1, UX OQ4b |
| UI-BS-301 | Tag styling | inspect the tag | same pill geometry as flags (`inline-flex items-center gap-1 text-xs rounded px-2 py-0.5 border`) with indigo treatment `text-indigo-700 bg-indigo-50 border-indigo-200`; never strikethrough | UX OQ4b |
| UI-BS-302 | Tag interactivity | tab to the tag | wrapped in `<button type="button">`; keyboard-focusable; accessible name = full visible text | UX OQ4b, AX |
| UI-BS-303 | Tag tooltip | hover / focus / tap | tooltip text = `astrology.bhavaSuchika.tooltip` (SI `භාව සුචික යනු මෙම ලක්ෂ්‍යයේ නවාංශක රාශිය ජන්ම (ලග්න) කේන්ද්‍රයේ පිහිටන භාවය (1–12) යි.`); closes on blur/Escape; `title` attribute carries the same text (no-JS/print fallback) | UX OQ4b, US-BS-001 |
| UI-BS-304 | Manual-without-navamsa → tag omitted | manual horoscope, no navamsa data | tag absent entirely; flag row shows only whatever flags exist (no empty-state pill) | US-BS-006 AC3, UX §states |
| UI-BS-305 | Legacy no-flicker tag | legacy doc (fields absent) | tag on first paint with the rest of the page — render-time fallback runs synchronously before paint (same as `recomputedAscFlags`, page.tsx:1247-1263); no flash-then-fill | US-BS-007 AC3, UX QA question |
| UI-BS-306 | Desktop `<th>` after Nakshatra | open desktop table | new header between Nakshatra (Pada) and Conjunctions (`page.tsx:1484-1486`), label `astrology.bhavaSuchika.label` + `ⓘ` glyph (aria-label `infoGlyph`) | US-BS-002 AC1, UX OQ4a |
| UI-BS-307 | Desktop `<td>` format | inspect a value row | `7 — සප්තමාංශකය` (number, spaced em dash U+2014, name), `whitespace-nowrap`, after the Nakshatra cell (`page.tsx:1640-1643`) | US-BS-002 AC2, UX OQ4a |
| UI-BS-308 | Desktop manual-without-navamsa | manual no-navamsa doc | `—` (em dash) in every row — the table's existing empty-cell convention | US-BS-002 edge, US-BS-006 AC3 |
| UI-BS-309 | Out-of-range stored value | hand-edit doc: `lagnaBhavaSuchika: 13`, `bhavaSuchika["3"]: 0` | `—` + `console.warn`; never throws, never renders an empty cell, never calls `t("astrology.bhavaSuchika.names.0")` | UX §states, arch §security |
| UI-BS-310 | Mobile card span | viewport < 640px | new span after the Nakshatra span (`page.tsx:1839-1841`), `text-gray-600 whitespace-nowrap`, `—` fallback; card header button gains `flex-wrap` so the wider row wraps (UX question — Developer must confirm) | US-BS-002, UX OQ4a |
| UI-BS-311 | Read-only everywhere | own, public, share-link views | no checkbox/toggle/override affordance anywhere; no PATCH fired on any interaction (unlike Shad Bala) | US-BS-001 AC4, US-BS-007 AC4 |
| UI-BS-312 | Locale switch | `useI18n()` SI ⇄ EN | tag + column header + all 12 names re-render immediately; no stale locale mix | US-BS-005 AC4 |
| UI-BS-313 | Single header tooltip anchor | hover the `ⓘ` | same tooltip as the tag; NO per-cell tooltips (9 redundant triggers per table) | UX OQ4a, US-BS-002 |
| UI-BS-314 | Shared values not deduplicated | two planets with the same value | each cell shows its own value — no grouping/dedup | US-BS-002 edge |

### E2E Flows (MANUAL — no Playwright installed; see §What cannot be tested)

| ID | Flow | Steps | Expected | Maps to |
|----|------|-------|----------|---------|
| E2E-BS-400 | Auto horoscope full render | own auto horoscope → calculations tab | tag first in Lagna row with `{label}: {value} — {name}`; every planets-table row (desktop) and card (mobile) shows `{value} — {name}`; cross-check `((navamsaSign − lagnaSign) mod 12) + 1` against the stored fields and the `navamsa-d9` chart's ascendant sign | US-BS-001/002/003/004 |
| E2E-BS-401 | Manual with navamsa data | manual horoscope with `navamsaLagna` + `navamsaHouses` | values present and match the entered navamsa chart | US-BS-006 AC1/AC2 |
| E2E-BS-402 | Manual without navamsa | manual horoscope, no navamsa data | tag omitted; `—` in every column row | US-BS-006 AC3 |
| E2E-BS-403 | Legacy fallback + recalc restore | `mongosh`: `$unset` both fields on one doc → render → run recalculation job → render | identical values before/after (no flicker, no diff); fields restored after recalc | US-BS-007 AC3, arch verification 5 |
| E2E-BS-404 | Search by Lagna value | POST /api/search `"භාව සුචික ලග්නාංශකය"` / `"bhava suchika bhagyamshaka"` / `"ලග්නාංශකය"` / `"bhava suchika 9"` | matching horoscopes returned and ranked first | US-BS-008 AC1 |
| E2E-BS-405 | Search by planet pair | `"ගුරු භාව සුචික 11"` / `"Jupiter bhava suchika labhamshaka"` | horoscopes where Jupiter's value is 11 returned | US-BS-008 AC2 |
| E2E-BS-406 | Search result cards mirror | run a Bhava Suchika query, inspect cards | Lagna tag first (indigo) + per-planet values in the same format as the detail page | US-BS-008 AC3 |
| E2E-BS-407 | Manual-without-navamsa in search | query a value, verify a no-navamsa manual horoscope | never matches; its card shows no tag / `—` values | US-BS-008 AC6 |
| E2E-BS-408 | Share link / public read-only | open share link + another student's public horoscope | values render; no edit affordance; dev-tools POST to any guessed route → 404 | US-BS-007 AC4, US-BS-001 AC4 |
| E2E-BS-409 | Bilingual end-to-end | SI session → EN session on the same horoscope | tag/header/names fully localized; no English residue in SI (and vice versa) | US-BS-005 |
| E2E-BS-410 | Recalc consistency | admin changes AstrologySettings → full recalc → reopen | values recomputed from current chart data; with unchanged settings they are byte-identical (no overrides to preserve) | US-BS-007 AC2 |

## 7. Accessibility Testing (UX §Accessibility)

| ID | Test Case | Expected |
|----|-----------|----------|
| AX-BS-350 | Tag keyboard | Tab focuses the tag button; Enter/Space opens nothing destructive (it is a tooltip trigger); focus opens the tooltip, blur closes it |
| AX-BS-351 | `ⓘ` header glyph | focusable; `aria-label` = `astrology.bhavaSuchika.infoGlyph`; opens the same tooltip |
| AX-BS-352 | Tooltip semantics | trigger `aria-describedby` → `role="tooltip"` with matching `id`; `title` fallback carries the FULL plain text |
| AX-BS-353 | Contrast | indigo pill `text-indigo-700` on `bg-indigo-50`; `text-gray-600` cell values on white — both ≥ 4.5:1 (existing tag/cell colors, no change) |
| AX-BS-354 | Reduced motion | tooltip fade only (no slide), disabled under `prefers-reduced-motion` |
| AX-BS-355 | Mobile span semantics | plain text read in row context — planet name precedes it in the button's accessible name; no extra aria needed |
| AX-BS-356 | Not color-only | the value is carried by number+name text, never by color alone (WCAG 1.4.1) |

## 8. Bilingual Testing (US-BS-005)

| ID | Test Case | Expected |
|----|-----------|----------|
| BI-BS-380 | Key parity | every `astrology.bhavaSuchika.*` key in `en.json` exists in `si.json` (and vice versa) — scriptable grep over both files |
| BI-BS-381 | 12 SI names exact | `names.1..12` = ලග්නාංශකය, ධනාංශකය, වික්‍රමාංශකය, සුඛාංශකය, පූර්වපුන්‍යාංශකය, ශෂ්ඨාංශකය, සප්තමාංශකය, නිධානාංශකය, භාග්‍යාංශකය, අභිමානාංශකය, ලාභාංශකය, ව්‍යාංශකය — authoritative from `docs/bhava-suchika.md` |
| BI-BS-382 | 12 EN names exact | `names.1..12` = Lagnamshaka, Dhanamshaka, Vikramamshaka, Sukhamshaka, Purvapunyamshaka, Shashthamshaka, Saptamamshaka, Nidhanamshaka, Bhagyamshaka, Abhimanamshaka, Labhamshaka, Vyamshaka — **provisional transliterations, pending domain confirmation (OQ1)** |
| BI-BS-383 | label/tooltip/infoGlyph parity | both keys + both locale strings present and in sync |
| BI-BS-384 | No hardcoded strings | `BhavaSuchikaTag`/`Cell`/`Header` components + page.tsx/search page contain no inline SI/EN literals for the feature — all via `t()` from the numeric value |
| BI-BS-385 | Planet names reused | per-planet cells use `astrology.planetNames.*` — no duplicate planet-name strings |
| BI-BS-386 | Sinhala width allowance | no clipped/wrapped tag or column header at 375px with SI locale (long names e.g. පූර්වපුන්‍යාංශකය; `whitespace-nowrap` + `overflow-x-auto` absorb it) |
| BI-BS-387 | Locale switch re-renders | `useI18n()` switch updates tag + header + names immediately; no stale strings |

## 9. Edge & Negative Cases

| ID | Test Case | Expected | Maps to |
|----|-----------|----------|---------|
| RE-BS-450 | Wrap-behind value 12 | lagna 5, navamsa lagna 4 | `12` (ව්‍යාංශකය) — mod-12 wrap both directions | US-BS-003 AC3 |
| RE-BS-451 | Boundary exact 3°20′ | ascDegree exactly `30/9` | wedge 2 (NOT 1) — `Math.floor` semantics pinned | D1, arch verification 1 |
| RE-BS-452 | Top-of-sign 29.999° | ascDegree 29.999 | wedge 9 | D1 |
| RE-BS-453 | Corrupt stored Lagna value | `lagnaBhavaSuchika: 0 / 13 / "7" (string)` | tag omitted + `console.warn`; no crash, no `t("names.0")` lookup | UX §states, arch §security |
| RE-BS-454 | Sparse `bhavaSuchika` record | stored `{ "3": 7 }` only | planet 3 row shows the value; other 8 rows `—`; no crash on missing keys | US-BS-002 BR, D3 |
| RE-BS-455 | Out-of-range planet keys | stored `{ "10": 7, "abc": 4 }` | ignored — only `"1"…"9"` read | US-BS-002 BR |
| RE-BS-456 | Legacy doc planets missing `navamsaSign` | auto legacy where a planet lacks `navamsaSign` | cell `—` (fallback cannot derive) — defensive, no crash | US-BS-007 AC3 |
| RE-BS-457 | Partial-input matrix (all 4 states) | `navamsaLagna`/`navamsaHouses` × present/absent | tag + column states exactly per D5 matrix (incl. the API-edge `navamsaHouses`-only state) | US-BS-006 AC4, D5 |
| RE-BS-458 | Empty `bhavaSuchika` `{}` on auto doc | stored empty record | `—` cells; Lagna tag still from stored/fallback Lagna value | US-BS-002 BR |
| RE-BS-459 | Privacy: matching private horoscope of another user | search value matches a private non-owned doc | never returned (existing `$or` filter — regression) | US-BS-008, privacy spec |
| RE-BS-460 | No mutation surface | hand-crafted PATCH/POST to any guessed bhava-suchika route | 404 — no endpoint exists; PATCH /shadbalaya unaffected | US-BS-007 AC4, D8 |
| RE-BS-461 | Render during recalculation | open the page while the recalc job runs | stored values render first, updated values after refresh — no crash, no merge artifacts | US-BS-007 AC2 |
| RE-BS-462 | Recomputed === stored | golden chart: `calculateHoroscope` twice | deterministic — second run deep-equals the persisted snapshot (fallback equality guarantee) | US-BS-007 BR, D3 |
| RE-BS-463 | Search out-of-range number | `"bhava suchika 13"` / `"bhava suchika 0"` | no condition; query degrades to plain keyword search; HTTP 200 | arch §edge cases |
| RE-BS-464 | Trigger without a value | `"භාව සුචික"` / `"bhava suchika"` alone | no condition (value required — bare trigger yields nothing) | arch §edge cases |
| RE-BS-465 | Mixed SI/EN in one query | `"bhava suchika ලග්නාංශකය"` | resolves (language detection is per-clause, `route.ts:717-731` — regression-safe) | US-BS-008 AC4 |
| RE-BS-466 | Query validation unchanged | empty query / >500 chars | 400 (existing behaviour — regression) | route pattern |

## 10. Key Risk Areas / Codebase Flags

> All flags below were **verified in the code** on 2026-08-14, not assumed.

1. ⚠️ **`src/lib/bhavaSuchika.ts` does not exist yet** (glob verified). The Developer must create it exporting `computeNavamsaLagnaSign`, `computeLagnaBhavaSuchika`, `computePlanetBhavaSuchika`, `computeBhavaSuchika` (signatures per arch §Component Design). Import path `@/lib/bhavaSuchika`.
2. ✅ **`navamsaSign` exists and is exported**: `navamsaSign(sourceSign: number, navamsaNum: number): number` at `src/lib/astrology.ts:31`. The D9-lagna expression `navamsaSign(ascSign, Math.floor(ascDegree / (30/9)) + 1)` matches the 5 existing inline sites (`calculation.ts:505, 523, 559, 593, 606`) — **verified**, so D9's "same expression" claim holds.
3. ✅ **Recalc overwrites wholesale — no merge needed**: `recalculateOne` (`recalculationJob.ts:205-214` auto, `:189-201` manual) spreads `...calculated` / `...synth` over `findOneAndUpdate`; Shad Bala needs `mergeShadBalaya` because of overrides, Bhava Suchika has none — pure overwrite is correct and **free** (fields ride the spread). The manual branch sets `manualHousePlacements`/`derivedRanges` explicitly after the spread — `synthesizeCalculation` must carry the new fields for the manual path (it returns a full `CalculationResult`, `manualChartDetails.ts:206-228` — verified it will).
4. ✅ **textContent guarded-sentence pattern verified**: optional-field guard `(calc.yogakaraka?.length ?? 0) > 0 ? … : "No Yogakaraka."` at `textContent.ts:81-86` (EN) and `:179-184` (SI); unguarded `maranakaraka` at `:76-80`/`:174-178`. Bhava Suchika sentences follow the **yogakaraka** pattern. ⚠️ **Two guard subtleties the Developer must handle**: (a) `calc.bhavaSuchika` may be `undefined` OR `{}` OR missing keys — guard each read; (b) **manual-without-navamsa must emit NO sentence** — a naive `calc.bhavaSuchika ?? computeBhavaSuchika(...)` fallback would inject birth-sign-derived (wrong) values (D5 applies to search text too, SR-BS-222).
5. ✅ **ExactCondition types verified** (`route.ts:34-40`): `ascendant`, `navamsa_ascendant`, `planet_in_house`, `nakshatra`, `planet_strength`, `planet_role`. New `bhava_suchika` / `planet_bhava_suchika` mirror `planet_strength`'s pairing (`getPlanetStrengthPairs`, `:152-220`) and `getSignMatchNear` (`:225-262`). Scoring anchors: +1.0 ascendant (`:559`), +0.5 per planet strength (`:616`).
6. ⚠️ **Search route testability**: `getExactMatch` / `scoreHoroscope` / `getAstroKeywords` are module-private (not exported). Route-level tests must either POST through the handler (mock `getServerSession`, `connectDB`, `Horoscope.find`, `CalculatedDetails.findOne`) **and** mock `@/lib/search/embedding` (`generateEmbedding → null` — otherwise Transformers.js downloads the `Xenova/all-MiniLM-L6-v2` model on every test) and `@/lib/search/qdrant` (`ensureCollection`/`searchPoints`). Existing `search-*.test.ts` files are pure-helper tests only — the new SR tests either set the route-mocking precedent or the Developer extracts the new condition logic into testable helpers.
7. ⚠️ **D9-lagna drift risk (D9)**: the search route already derives the navamsa lagna via `deriveNavamsaLagnaFromDegree` (`manualChart.ts:438`, used at `route.ts:288`); the new module adds `computeNavamsaLagnaSign`. Both implement the same formula — UT-BS-064 pins agreement; the Developer should alias/consolidate to avoid a third copy.
8. ⚠️ **Vocabulary suggestions pool**: `VOCABULARY_WORDS` (`vocabulary.ts:86-92`) drives `SEARCH_VOCABULARY` → suggestions. `BHAVA_SUCHIKA_WORDS` + both 12-name maps must join `TRIGGER_WORDS` / `VOCABULARY_WORDS` or suggestions never offer the new terms (SR-BS-211).
9. ⚠️ **i18n out-of-range guard**: `t(\`astrology.bhavaSuchika.names.${value}\`)` with value 0/13/NaN resolves a missing key — the resolution layer must guard (render `—` + `console.warn` per UX), never emit an empty cell or throw (UI-BS-309, RE-BS-453).
10. ⚠️ **jest `testMatch` excludes `.tsx`**: `jest.config.js` = `["**/__tests__/**/*.test.ts"]`. RTL component tests (JSX) need `*.test.tsx` — extend testMatch or run UI-SB-…-style cases manually. Same flag as the Shad Bala plan §17.
11. ⚠️ **No Playwright/Cypress** (package.json verified) — E2E-BS-400…410 are manual scripts; automation is a Developer/PM decision.
12. ⚠️ **Vector-leg state (verified)**: Transformers.js (`Xenova/all-MiniLM-L6-v2`, 384-dim) + Qdrant (`QDRANT_URL`-gated) exist and are wired via `indexer.ts` (`getTextForBothLanguages` → SearchEmbedding + Qdrant upsert). **No Gemini anywhere in `src/`** (`@google/generative-ai` is an unused dependency) — the architecture spec's Gemini query-parsing is NOT implemented. Vector-leg tests are therefore: textContent contains the sentences (SR-BS-219…222) + indexer regeneration (SR-BS-223). Do not assert Gemini behaviour.
13. ⚠️ **Manual gating is mandatory (D5)**: `synthesizePlanets` falls back `navamsaSign: row.navamsa?.navamsaSign ?? row.sign` (`manualChartDetails.ts:173`) — without gating, a manual chart without navamsa data would compute values from the birth sign (wrong). Tests pin the gating (UT-BS-057…059, UT-BS-063, SR-BS-215/222, RE-BS-457), not the fallback.
14. ⚠️ **`synthesizeNavamsaCalculation` must NOT gain the fields** (`manualChartDetails.ts:233-269`) — Bhava Suchika is a D1-chart value; adding it to the D9 CalculationResult would pollute the navamsa chart payload (UT-BS-060).
15. ⚠️ **Mobile header button has no `flex-wrap`**: `page.tsx:1818` is `w-full flex items-center gap-2 …` — the new span after Nakshatra (`:1839-1841`) makes the header wider; UX §OQ4a requires `flex-wrap` (or an equivalent) on the button. Developer must confirm the markup change (UX question to Developer, unresolved).
16. ✅ **Persistence path verified**: `CalculatedDetails.create({ horoscope: { id }, ...calculated })` (`api/horoscope/route.ts:80-83`) — the two new `CalculationResult` fields (added at `calculation.ts:443-474` alongside `shadbalaya` at `:463`) persist automatically in the auto path; manual path via `...spread` in the manual routes + `...synth` in the recalc job.
17. ⚠️ **Golden fixture era**: freeze `src/__tests__/fixtures/bhava-suchika-default-2026-08.json` from `calculation.test.ts` baseData (1990-06-15 08:30, Colombo, lahiri) — any future change to the navamsa offset table or the formula fails the fixture loudly (UT-BS-081…085).

## 11. Test File Layout (proposed)

```
src/__tests__/bhavaSuchika.test.ts            // UT-BS-001..025 + UT-BS-051..064 + UT-BS-081..085 (pure + pipeline + golden)
src/__tests__/bhavaSuchikaApi.test.ts         // IT-BS-100..113 (persistence via spreads; no new routes)
src/__tests__/search-bhava-suchika.test.ts    // SR-BS-200..228 (vocabulary + textContent pure; route-level w/ mocked embedding/qdrant)
src/__tests__/recalculationJob.test.ts        // EXTEND — IT-BS-108..111 (recalc recompute assertions)
src/__tests__/bhavaSuchika-ui.test.ts         // UI-BS-* + AX-BS-* + BI-BS-* (RTL, per-file jsdom, testMatch extension required) — OPTIONAL
src/__tests__/fixtures/bhava-suchika-default-2026-08.json   // golden era fixture
e2e/bhava-suchika.spec.ts                     // E2E-BS-* — ONLY if Playwright is added (flag §10.11)
```

## 12. Acceptance Criteria Checklist (traceability)

| User Story | QA test IDs |
|-----------|-------------|
| US-BS-001 | UT-BS-061/062/063, UI-BS-300/301/302/303/304/305/311, E2E-BS-400/408, AX-BS-350, RE-BS-453 |
| US-BS-002 | UT-BS-021/022, UI-BS-306/307/308/309/310/313/314, E2E-BS-400/402, RE-BS-454/455/456/458 |
| US-BS-003 | UT-BS-001..007, UT-BS-012..018, UT-BS-053, UT-BS-064, UT-BS-083, RE-BS-450/451/452 |
| US-BS-004 | UT-BS-008..011, UT-BS-019..023, UT-BS-052/054, UT-BS-084 |
| US-BS-005 | BI-BS-380..387, UI-BS-312, AX-BS-356 |
| US-BS-006 | UT-BS-055..059, UT-BS-063, IT-BS-103/104/105/110, UI-BS-304/308/310, E2E-BS-401/402, RE-BS-457 |
| US-BS-007 | UT-BS-051, UT-BS-061/062, IT-BS-100..113, UI-BS-305/311, E2E-BS-403/408/410, RE-BS-460/461/462 |
| US-BS-008 | SR-BS-200..228, E2E-BS-404/405/406/407, RE-BS-459/463/464/465/466 |

## 13. What Cannot Be Tested (and how to close the gap)

1. **English house-index names (BA OQ1)** — the 12 EN transliterations (Lagnamshaka…Vyamshaka) are provisional; the feature renders them but QA cannot assert their correctness until the domain confirms the canonical forms (and UX notes spelling variants `Purvapunyanshaka` vs `Purvapunyamshaka`). Tests assert the strings the Developer ships (BI-BS-382) and the parity, not the domain truth. Gap closed by a PM/domain sign-off; the tests then need only the string values updated.
2. **E2E automation** — no Playwright/Cypress installed (verified in `package.json`; no config files). Until a framework is added, E2E-BS-400…410 run as manual scripts. Closing the gap requires installing Playwright + `e2e/bhava-suchika.spec.ts` — Developer/PM decision (flag §10.11).
3. **Vector/embedding search end-to-end** — verified: `src/app/api/search/route.ts` is keyword/exact scoring over MongoDB results with an **optional** vector leg (Transformers.js embeddings via `src/lib/search/embedding.ts` + Qdrant via `src/lib/search/qdrant.ts`, both env/availability-gated); the architecture spec's full RAG pipeline (Gemini query parsing) is **not implemented** and `@google/generative-ai` is an unused dependency. Vector-leg tests therefore assert what exists: the Bhava Suchika sentences are present in `generateTextContent`/`getTextForBothLanguages` (SR-BS-219…222) and that `indexHoroscope` stores/upserts that text (SR-BS-223, with embeddings mocked). True cosine-similarity surfacing of Bhava Suchika matches requires a live Qdrant + loaded model — deferred to an integration environment; keyword/exact matching is fully testable today.
4. **No-flicker guarantee** — "first paint with the rest of the page, not after hydration" cannot be asserted in node-env Jest; it is a manual observation (E2E-BS-403, UI-BS-305) unless RTL + jsdom hydration tests are configured (flag §10.10).
5. **Corrupt-doc blast radius** — out-of-range stored values (`lagnaBhavaSuchika: 0|13`, `bhavaSuchika["3"]: 0`, string values, non-planet keys) are only reachable by hand-editing Mongo (no mutation endpoint exists — D8); unit tests pin the resolution layer's guard behaviour (RE-BS-453/454/455, UI-BS-309) but the visible `—` + `console.warn` degradation is a browser-level observation — close the gap with the E2E-BS-408-style manual check or RTL rendering tests if the `testMatch` flag (§10.10) is resolved.

## Verification

```bash
npx jest src/__tests__/bhavaSuchika.test.ts        # pure rules + pipeline + golden (UT-BS-*)
npx jest src/__tests__/bhavaSuchikaApi.test.ts      # no new routes; persistence via spreads (IT-BS-100..113)
npx jest src/__tests__/search-bhava-suchika.test.ts # search (SR-BS-200..228, mocked embedding/qdrant)
npx jest src/__tests__/recalculationJob.test.ts     # recalc recompute (IT-BS-108..111)
npx jest src/__tests__/bhavaSuchika-ui.test.ts      # UI/BI/AX (if RTL env configured)
pnpm test                                           # full suite — no regressions
pnpm lint                                           # no new lint errors
pnpm format                                         # import order + prettier
```
