# QA Test Plan — Shad Bala (ෂඩ් බලය) — Six Planetary Strengths

**Date:** 2026-08-13 20:52
**Author:** QA (BMAD)
**Based on:** `specs/business-analysis/20260813-1954-shadbalaya.md` (US-SB-001…014), `specs/business-analysis/data-model.md` → ShadBalaya, `specs/business-analysis/actors.md`, `specs/architecture/20260813-2011-shadbalaya-architecture.md`, `specs/ux/20260813-2030-shadbalaya.md` (§15 traceability, §16 QA/Developer flags, §17 open questions), `docs/shadbalaya.md`, `src/lib/astrology.ts`, `src/lib/manualChart.ts`, `src/lib/astrologyEnums.ts`, `src/lib/recalculationJob.ts`, `src/app/api/horoscope/[id]/route.ts`, `src/app/api/horoscope/[id]/privacy/route.ts`, `src/app/horoscopes/[id]/page.tsx`, `src/models/CalculatedDetails.ts`, `src/__tests__/calculation.test.ts`, `src/__tests__/manualChart.test.ts`, `src/__tests__/recalculationJob.test.ts`, `jest.config.js`, `package.json`

---

## Scope

This test plan covers the Shad Bala (ෂඩ් බලය) feature — the six classical planetary strengths table in the calculations tab:

- **Pure module** `src/lib/shadBalaya.ts` (NEW): `computeShadBalaya(planets, houses, ctx)`, `mergeShadBalaya(computed, stored)`, types `ShadBalaya`, `ShadBalayaPerPlanet`, `ShadBalaValue`, `ShadBalaReason`, `ShadBalayaKey`, `ShadBalayaContext` — per-bala rules for Sthana, Cheshta, Kala, Dig, Drishti, Naisargika on both `source: "auto"` and `source: "manual"` horoscopes.
- **Schema** `CalculatedDetails.shadbalaya` Map field (NEW) + `ICalculatedDetails` extension.
- **API** `PATCH /api/horoscope/[id]/shadbalaya` (NEW): `{ planet, bala, value }` toggle with `overridden: true`, auth owner-or-super-admin, sparse-write on legacy docs.
- **Recalculation integration** `mergeShadBalaya` applied in `src/lib/recalculationJob.ts` + `scripts/recalculate-horoscopes.ts` + `scripts/recalculate-calculated-horoscopes.ts`.
- **UI** `src/components/ShadBalaTable.tsx` (NEW): 8 columns × 9 rows desktop table, mobile cards, optimistic toggles, 500 ms per-key debounce, override dot, tooltip reasons, read-only mode (disabled checkboxes + ⓘ).
- **Page integration** `src/app/horoscopes/[id]/page.tsx`: legacy lazy recompute + merge at render, placement after the planets table `</section>` (line ~1883), before `DerivedRangesSection` (line ~1885).
- **i18n** `astrology.shadbalaya.*` keys in `src/messages/en.json` + `src/messages/si.json` in sync.

**Out of scope:** planet-war module (deferred — no graha-yuddha logic in the codebase), Hora/Panchama/Sukshama varga-load formula (deferred — unconfirmed by domain), Drishti computation (never computed by design), chart SVG rendering, RAG search, privacy toggling, ephemeris sunrise/sunset refinement (`swe_rise_trans`).

## Test Strategy

| Level | Scope | Tool/Framework | Test IDs |
|-------|-------|----------------|----------|
| Unit | Pure rules in `src/lib/shadBalaya.ts`: Sthana (enemy-sign helper), Cheshta (Uttarayana/uttarayanaSign, paksha, Shukla-Chandra conjunction, Vakra, deferred war hook), Kala (day/night, Shukla/Krushna paksha, deferred varga), Dig (house mapping, Rahu/Ketu), Naisargika (maranakaraka), Drishti (manual only), `mergeShadBalaya` (override preservation, sparse records, ratio never stored), context fallbacks (`ctx.thithi` → `computeThithiFromPlanets`, `ctx.maranakaraka` → `computeMaranakaraka`) | Jest + ts-jest, node env, `@/` → `src/` (jest.config.js moduleNameMapper) | `UT-SB-*` |
| Integration / API | `PATCH /api/horoscope/[id]/shadbalaya`: 401/403/404/400, owner vs super-admin, strict body validation, sparse `$set` dotted path, response shape; recalculation merge in `recalculateOne` (auto + manual) | Jest + mocked `getServerSession` + mocked `connectDB` (reuse `auth.test.ts`/`privacy.test.ts`/`recalculationJob.test.ts` patterns) | `IT-SB-*` |
| Component / UI | Table render (8×9), toggle → optimistic flip → ratio update → 500 ms debounce → PATCH → revert + toast on failure, override dot, tooltip states (checked/unchecked/multi-reason/manual/override footer), read-only disabled mode + ⓘ, legacy no-flicker render, locale switch | `@testing-library/react` (available in devDependencies; per-file `@jest-environment jsdom`) — **or manual if RTL env not configured** | `UI-SB-*`, `AX-SB-*`, `BI-SB-*` |
| E2E | Full user flows (toggle → persist → reload → survives recalc; share-link read-only; manual chart subset) | **No E2E framework installed** (verified: no Playwright/Cypress in `package.json`, no config files) — cases are specified as executable manual scripts; installing Playwright is a Developer/PM decision (see §9) | `E2E-SB-*` (manual) |
| Golden | Auto pipeline integration: `calculateHoroscope` output gains `shadbalaya`; era-stamped fixture assertions | Jest + JSON fixtures under `src/__tests__/fixtures/` | `UT-SB-070..074` |

**Approach:** all rule logic lives in a pure module — unit tests assert against numeric-enum fixtures directly with no mocks. API tests assert exact `$set` dotted paths and prove **no computation runs in the route** (the route must only persist; merge/lazy-recompute happens in the page and the recalc job). UI tests verify tooltip string composition and debounce timing. E2E cases double as the acceptance script for the Developer's manual QA pass.

## Test Environment

| Environment | Configuration |
|-------------|---------------|
| Unit | Jest + ts-jest, node env, `@/` → `src/` (jest.config.js moduleNameMapper) — `npx jest src/__tests__/shadBalaya.test.ts` |
| API | Route-handler tests with mocked `getServerSession` + mocked `connectDB` + mocked Mongoose models (pattern from `privacy.test.ts` / `recalculationJob.test.ts`) |
| Component (optional) | `@testing-library/react` 16.3.2 + `@testing-library/jest-dom` (both already in devDependencies) with `/** @jest-environment jsdom */` per file — jest.config `testEnvironment: "node"` must be overridden per-file |
| E2E | None — manual scripts; Playwright install flagged |
| Golden | Versioned fixture `src/__tests__/fixtures/shadbalaya-default-2026-08.json` (era-stamped, mirroring the aspects fixtures convention) |

---

## 1. Unit Tests — Sthana Bala (US-SB-002)

Sthana rule: `value = !(sign is an enemy sign)` — an enemy-sign (Shatru) placement removes the bala, whether alone or combined with Neecha; a Neecha placement in a non-enemy sign keeps it (reason `debilitated`). The Neecha-and-Shatru combination uses the dedicated `neecheShatru` reason. Debilitation check uses `p.strength` (numeric `PlanetaryStrength.NEECHA = -1` / `ATHI_NEECHA = -1.25`). Enemy-sign check is a **separate helper** because `computePlanetStrength` (manualChart.ts:438 / calculation.ts:227) returns `NEECHA` before the enemy branch, so a debilitated planet's `p.strength` can never be `SHATRU`. Expected helper shape: `isEnemySign(planet: number, sign: number): boolean` using `NATURAL_ENEMIES[planet]?.includes(SIGN_LORD[sign])`.

> ⚠️ **Codebase flag:** `NATURAL_ENEMIES` is `const` (not exported) in `src/lib/manualChart.ts` line 424; only `SIGN_LORD` is exported (line 138). `src/lib/calculation.ts` and `src/lib/currentPlanets.ts` hold private copies. The architect spec states both are exported — **Developer must export `NATURAL_ENEMIES` from `manualChart.ts` (or add a shared map) before the Sthana rule can use it.**

Fixture helper (mirrors `calculation.test.ts:159`):

```ts
const planet = (name: number, house: number, absoluteDegree = 0, o: Partial<Planet> = {}) => ({
    name, house, absoluteDegree,
    sign: o.sign ?? ((house - 1) % 12) + 1,
    strength: PlanetaryStrength.SAMA,
    retrograde: false,
    ...o,
});
```

Known enemy-sign pairs (verified against `SIGN_LORD` + `NATURAL_ENEMIES` in manualChart.ts): Sun(1) debilitated in **Libra(7)** — lord Venus(6), `NATURAL_ENEMIES[1] = [6,7]` → Shatru. Saturn(7) debilitated in **Aries(1)** — lord Mars(3), `NATURAL_ENEMIES[7] = [1,2,3]` → Shatru. Mars(3) debilitated in **Cancer(4)** — lord Moon(2), `NATURAL_ENEMIES[3] = [4]` → **not** Shatru. Moon(2) has `NATURAL_ENEMIES[2] = []` → can never be Shatru.

| ID | Test Case | Input (planets + ctx) | Expected | Maps to |
|----|-----------|----------------------|----------|---------|
| UT-SB-001 | Neecha AND Shatru → no bala (Sun in Libra) | `planet(1, 7, 190, { sign: 7, strength: PlanetaryStrength.NEECHA })`, source auto | `sthanaBala.value === false`; `reasons === [{ key: "shadbalaya.sthana.reason.neecheShatru", params: { strength: -1, sign: 7 } }]` | US-SB-002 AC1 |
| UT-SB-002 | Neecha AND Shatru → no bala (Saturn in Aries) | `planet(7, 1, 10, { sign: 1, strength: PlanetaryStrength.NEECHA })` | `value === false`, reason `neecheShatru` params `{ strength: -1, sign: 1 }` | US-SB-002 AC1 |
| UT-SB-003 | Athi Neecha AND Shatru → no bala | `planet(1, 7, 190, { sign: 7, strength: PlanetaryStrength.ATHI_NEECHA })` (deep-debiliation degree) | `value === false`, reason `neecheShatru` params `{ strength: -1.25, sign: 7 }` | US-SB-002 AC1 |
| UT-SB-004 | Neecha but NOT Shatru → has bala (Mars in Cancer) | `planet(3, 4, 110, { sign: 4, strength: PlanetaryStrength.NEECHA })` | `value === true` (bala kept — Mars debilitated in Cancer, lord Moon is not a natural enemy) | US-SB-002 AC2 |
| UT-SB-005 | Neecha but NOT Shatru → checked-state reason | same as UT-SB-004 | `reasons` non-empty with key `shadbalaya.sthana.reason.debilitated` (params `{ sign: 4 }`) — the checked-state Neecha key, resolved in the Developer phase | US-SB-002 AC2, US-SB-009 |
| UT-SB-006 | Shatru but NOT Neecha → no bala (Saturn in Cancer, strength SHATRU) | `planet(7, 4, 110, { sign: 4, strength: PlanetaryStrength.SHATRU })` | `value === false`, reason `shadbalaya.sthana.reason.shatru` (updated per product correction: enemy-sign placement has no Sthana bala) | US-SB-002 AC3 |
| UT-SB-007 | Uchcha → has bala with Uchcha reason | `planet(1, 1, 10, { sign: 1, strength: PlanetaryStrength.UCHCHA })` | `value === true`, reason `shadbalaya.sthana.reason.uchcha` | US-SB-002 AC4 |
| UT-SB-008 | Athi Uchcha / Moolatrikona / Own sign reasons | Sun ATHI_UCHCHA; Mercury sign 6 Moolatrikona-range strength MOOLATRIKONA; Moon sign 2 OWN_SIGN | each `value === true` with its reason key (`athiUchcha` / `moolatrikona` / `ownSign`) | US-SB-002 AC4 |
| UT-SB-009 | Mitra / Sama reasons | Jupiter strength MITRA in a friend sign; Mars strength SAMA in a neutral sign | `value === true`, reasons `mitra` / `sama` | US-SB-002 AC4 |
| UT-SB-010 | Rule applies to both sources | UT-SB-001 fixture with `ctx.source === "manual"` | identical `value`/`reasons` (manual uses the entered sign + derived strength) | US-SB-002 AC5 |

## 2. Unit Tests — Cheshta Bala (US-SB-003, US-SB-012)

Cheshta rule: `value = OR of any applicable condition`; `reasons` lists every satisfied condition. Paksha: Shukla = thithi 1–15 inclusive (matches `computePanchaPakshi` convention, astrology.ts:137). Same-sign conjunction = planet's `sign === Moon's sign` while Moon in Shukla paksha.

| ID | Test Case | Input (planets + ctx) | Expected | Maps to |
|----|-----------|----------------------|----------|---------|
| UT-SB-011 | Ravi in Uttarayana sign, auto | `planet(1, 10, 285, { sign: 10 })`, `ctx = { source: "auto", thithi: 20 }` | Ravi `cheshtaBala.value === true`, reason `shadbalaya.cheshta.reason.uttarayana` | US-SB-003 AC1 |
| UT-SB-012 | Ravi in Uttarayana sign, manual → sign-based reason | same planet, `ctx = { source: "manual" }` | `value === true`, reason `shadbalaya.cheshta.reason.uttarayanaSign` (NOT `uttarayana`) | US-SB-003 AC1, US-SB-012 AC2 |
| UT-SB-013 | Ravi in non-Uttarayana sign (Dakshinayana), auto | `planet(1, 6, 165, { sign: 6 })` sign 6 (Kanya), auto, thithi 20 | Ravi Cheshta `value === false` (for this condition; no other condition applies) | US-SB-003 AC1 |
| UT-SB-014 | Uttarayana boundary signs | Ravi in signs 10, 11, 12, 1, 2 (one test per boundary sign) | each `value === true` | US-SB-003 AC1, arch §Cheshta 1a |
| UT-SB-015 | Moon in Shukla paksha (thithi 5) | Moon `planet(2, 8, 230, { sign: 8 })`, `ctx.thithi = 5` | Moon `value === true`, reason `shadbalaya.cheshta.reason.shuklaPaksha` | US-SB-003 AC2 |
| UT-SB-016 | Moon in Shukla paksha boundary thithi 1 and 15 | `ctx.thithi = 1` and `ctx.thithi = 15` | both `value === true` (inclusive boundary) | US-SB-003 AC2, arch §paksha |
| UT-SB-017 | Moon in Krushna paksha (thithi 20) | Moon `planet(2, 8, 230)`, `ctx.thithi = 20`, no other condition | Moon `value === false`; **reason ambiguity:** data-model.md:892 shows `shadbalaya.cheshta.reason.krushnaPaksha` for the unchecked state, but the architect Cheshta rules table lists no Krushna condition — **flagged** (see §9.2). Default expectation: `reasons === [{ key: "shadbalaya.cheshta.reason.krushnaPaksha" }]` per data model | US-SB-003 AC2, US-SB-009 AC2 |
| UT-SB-018 | Krushna boundary thithi 16 and 30 | `ctx.thithi = 16` / `30` | Moon Cheshta `value === false` (16–30 = Krushna, inclusive) | US-SB-003 AC2 |
| UT-SB-019 | Kuja conjunct Shukla-paksha Chandra | `planet(3, 4, 100, { sign: 4 })` + Moon `planet(2, 4, 100, { sign: 4 })`, `ctx.thithi = 5` | Kuja `value === true`, reason `shadbalaya.cheshta.reason.shuklaChandra` | US-SB-003 AC3 |
| UT-SB-020 | Same-sign conjunction for all five planets | Budha(4), Sikuru(6), Guru(5), Shani(7) + Kuja, each in Moon's sign, thithi 5 | each `value === true` with `shuklaChandra` reason | US-SB-003 AC3 |
| UT-SB-021 | No conjunction (different sign) | Kuja sign 4, Moon sign 5, thithi 5 | Kuja `value === false` (for this condition) | US-SB-003 AC3 |
| UT-SB-022 | Shukla-Chandra conjunction NOT applied when Moon in Krushna paksha | Kuja sign 4 + Moon sign 4, `ctx.thithi = 20` | Kuja `value === false` (for this condition) | US-SB-003 AC3 |
| UT-SB-023 | Vakra (retrograde) planet | `planet(7, 3, 80, { sign: 3, retrograde: true })`, any thithi | Shani `value === true`, reason `shadbalaya.cheshta.reason.vakra` | US-SB-003 AC4 |
| UT-SB-023b | Rahu/Ketu natural retrograde → NOT vakra | `planet(8, 1, 10, { sign: 1, retrograde: true })`, `planet(9, 2, 40, { sign: 2, retrograde: true })`, thithi 20 | Rahu/Ketu `value === false`, `reasons === []` (product correction: nodes are retrograde by nature — not Vakra) | US-SB-003 AC4 |
| UT-SB-023c | Rahu/Ketu in direct (opposite) motion → vakra | `planet(8, 1, 10, { sign: 1, retrograde: false })`, `planet(9, 2, 40, { sign: 2, retrograde: false })`, thithi 20 | Rahu/Ketu `value === true`, reason `vakra` | US-SB-003 AC4 |
| UT-SB-023d | Rahu/Ketu never gain Shukla-Chandra conjunction Cheshta bala | Rahu sign 4 + Ketu sign 4 + Moon sign 4, thithi 5, natural retrograde | Rahu/Ketu `value === false`, `reasons === []` (conjunction list is exactly Kuja/Buda/Guru/Sikuru/Shani) | US-SB-003 AC3 |
| UT-SB-024 | Multiple conditions → every reason listed | Saturn `planet(7, 4, 110, { sign: 4, retrograde: true })` + Moon sign 4, thithi 5 | `value === true`; `reasons` contains BOTH `vakra` and `shuklaChandra` (order: as evaluated; both present) | US-SB-003 AC6, US-SB-009 AC3 |
| UT-SB-025 | Planet-war winner — deferred v1 | `ctx.warWinnerPlanet` absent (current `ShadBalayaContext` has no such field) | no `shadbalaya.cheshta.reason.warWinner` reason ever emitted; winner case is student-manual | US-SB-003 AC5, arch §Non-Goals |
| UT-SB-026 | Planet-war hook contract (conditional) | **If** Developer adds `ctx.warWinnerPlanet?: number`: `ctx.warWinnerPlanet === 3` with Kuja(3) | Kuja `value === true` with `warWinner` reason; the 48h expiry is out of scope (no war module) — test only the hook exists and gates correctly | US-SB-003 AC5, arch §Open Q2 |

## 3. Unit Tests — Kala Bala (US-SB-004, US-SB-012)

Kala rule: `value = OR of any applicable condition`; reasons list every satisfied condition. Day/night: `ctx.day === true` (Sun above horizon — Sun cusp house 7–12) → Ravi/Guru/Sikuru; `ctx.day === false` → Chandra/Kuja/Shani. Manual without `ctx.day` → day/night conditions skipped.

| ID | Test Case | Input | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UT-SB-027 | Night birth — Chandra/Kuja/Shani | `ctx = { source: "auto", day: false, thithi: 20 }`, planets 2/3/7 in arbitrary houses | planets 2, 3, 7 `kalaBala.value === true` reason `shadbalaya.kala.reason.night`; planets 1, 4, 5, 6, 8, 9 not night-checked | US-SB-004 AC1 |
| UT-SB-028 | Day birth — Ravi/Guru/Sikuru (krushna thithi so Ravi's day is not suppressed) | `ctx.day = true, thithi = 20`, planets 1/5/6 | planets 1, 5, 6 `value === true` reason `shadbalaya.kala.reason.day` | US-SB-004 AC2 |
| UT-SB-029 | Shukla paksha — Budha/Guru/Sikuru/Rahu checked, Ravi never | `ctx.thithi = 5`, planets 1/4/5/6/8 | planets 4, 5, 6, 8 `value === true` reason `shadbalaya.kala.reason.shuklaPaksha`; planet 1 `value === false`, `reasons === []` (product correction: Ravi gets no Kala bala during Shukla, and Rahu joins the Shukla list) | US-SB-004 AC3 |
| UT-SB-029b | Ravi no Kala bala during Shukla even on a day birth | `ctx.day = true, thithi = 5` planet 1; `thithi = 16` planet 1 | thithi 5 → Ravi `value === false`, `reasons === []`; thithi 16 → Ravi `value === true` (day reason — the only Kala source left for Ravi) | US-SB-004 AC2/AC3 |
| UT-SB-029c | Krushna paksha — Ravi never checked, Rahu checked (night-birth regression from live horoscope `6a68e28d150a9f9377fa70e3`) | `ctx.day = false, thithi = 27`, planets 1/8 | Ravi `value === false`, `reasons === []`; Rahu `value === true` reason `shadbalaya.kala.reason.krushnaPaksha` | US-SB-004 AC4 |
| UT-SB-030 | Krushna paksha — Kuja/Shani/Rahu checked, Ravi never | `ctx.thithi = 20`, planets 1/3/7/8 | planets 3, 7, 8 `value === true` reason `shadbalaya.kala.reason.krushnaPaksha`; planet 1 `value === false`, `reasons === []` (product correction: Ravi excluded from the Krushna list, Rahu added) | US-SB-004 AC4 |
| UT-SB-031 | Paksha boundary thithi 15 (Purnima → Shukla) and 16 (Krishna) | `ctx.thithi = 15` vs `16` with planet 4 | thithi 15 → Budha Kala checked; thithi 16 → Budha Kala not paksha-checked | US-SB-004 AC3/AC4, arch §paksha |
| UT-SB-032 | Any-one-condition suffices (day + Shukla overlap) | `ctx.day = true, thithi = 5`, planet 5 (Guru) | Guru Kala `value === true`; `reasons` contains BOTH `day` and `shuklaPaksha` | US-SB-004 AC6, US-SB-009 AC3 |
| UT-SB-033 | Varga loads — deferred v1 | any ctx, planets with hypothetical varga fields absent | no `shadbalaya.kala.reason.vargaLoad` reason ever emitted; student sets manually | US-SB-004 AC5, arch §Non-Goals |
| UT-SB-034 | Manual without `ctx.day` — day/night skipped | `ctx = { source: "manual", thithi: 20 }` (no `day`), planet 3 (Kuja) | Kuja Kala **not** checked by night (Krushna paksha may still check it: thithi 20 → Kuja IS krushna-checked — use planet 3 with thithi 5 for the pure skip case: `value === false`, `reasons` empty → generic manual tooltip) | US-SB-012 AC3, US-SB-004, arch §Kala |
| UT-SB-035 | Manual with `ctx.day` supplied → day/night computed | `ctx = { source: "manual", day: false, thithi: 5 }`, planet 7 | Shani Kala checked reason `night` (manual charts CAN compute when day is derivable) | US-SB-012, arch §Kala |
| UT-SB-036 | Day/night from Sun cusp house (auto pipeline contract) | auto ctx with `day` derived as `findHouse(Sun.absoluteDegree, houses) >= 7` | Developer must derive `day` exactly this way for auto; unit-test the derivation helper if exposed (Sun house 7–12 → true, 1–6 → false, boundary house 7 inclusive) | US-SB-004 AC1/AC2, arch §Kala |

## 4. Unit Tests — Dig Bala (US-SB-005)

| ID | Test Case | Input | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UT-SB-037 | Guru/Budha in 1st house | `planet(5, 1, 15)` sign 1; `planet(4, 1, 15)` | `digBala.value === true`, reason `shadbalaya.dig.reason.house` params `{ house: 1 }` | US-SB-005 AC1 |
| UT-SB-038 | Kuja/Ravi in 10th house | `planet(3, 10, 285)`; `planet(1, 10, 285)` | `value === true`, reason `{ house: 10 }` | US-SB-005 AC1 |
| UT-SB-039 | Chandra/Shukra in 4th house | `planet(2, 4, 100)`; `planet(6, 4, 100)` | `value === true`, reason `{ house: 4 }` | US-SB-005 AC1 |
| UT-SB-040 | Shani in 7th house | `planet(7, 7, 190)` | `value === true`, reason `{ house: 7 }` | US-SB-005 AC1 |
| UT-SB-041 | Directional planet in a different house | Guru in house 5 | `value === false` | US-SB-005 AC2 |
| UT-SB-042 | Rahu/Ketu never have Dig bala | Rahu(8) / Ketu(9) in ANY house incl. 1, 10, 4, 7 | `value === false`, `reasons === []` (generic manual tooltip at render) | US-SB-005 AC3 |
| UT-SB-043 | House source: cusp-based vs entered | auto: `findHouse(p.absoluteDegree, houses) ?? p.house`; manual: entered `p.house` | same-shape output for both sources; assert the fallback `?? p.house` when `findHouse` returns null | US-SB-005 AC4, arch §houses |

## 5. Unit Tests — Naisargika Bala (US-SB-006)

| ID | Test Case | Input | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UT-SB-044 | Maranakaraka planet unchecked with triggering house | `ctx.maranakaraka = [2]` (or planets `[planet(2, 8, 37)]` + houses where cusp house of abs 37 is 8) | Moon `naisargikaBala.value === false`, reason `shadbalaya.naisargika.reason.maranakaraka` params `{ house: 8 }` | US-SB-006 AC1 |
| UT-SB-045 | All other planets checked | planets 1–9 with `ctx.maranakaraka = [2]` | planets ∉ [2] all `value === true`, reason `shadbalaya.naisargika.reason.notMaranakaraka` | US-SB-006 AC2 |
| UT-SB-046 | No maranakaraka → all checked | planets 1–9, `ctx.maranakaraka = []` (no rule fires — e.g. `[planet(2, 7), planet(1, 1), planet(8, 1)]`) | all 9 `value === true` | US-SB-006 AC3 |
| UT-SB-047 | ctx.maranakaraka fallback to `computeMaranakaraka(planets, houses)` | no `ctx.maranakaraka`, planets `[planet(2, 8, 37)]` + houses | Moon unchecked (fallback computes [2]) | US-SB-006 AC4, arch §Naisargika |
| UT-SB-048 | Manual path uses stored resolved maranakaraka | `ctx = { source: "manual", maranakaraka: [2] }` | identical behavior to auto | US-SB-006 AC4 |
| UT-SB-048a | Per-planet maranakaraka (not Chandra-by-default) | planets `[planet(2, 2), planet(4, 4), planet(5, 3)]` (Moon house 2, Budha house 4, Guru house 3), no `ctx.maranakaraka` | only Budha (4) and Guru (5) unchecked — Moon (2) remains checked; Budha reason `{ house: 4 }`, Guru reason `{ house: 3 }` | US-SB-006 AC1/BR |
| UT-SB-048b | Multiple maranakarakas each unchecked | `ctx.maranakaraka = [4, 5]` with planets 1–9 | only planets 4 and 5 `value === false`, all others true | US-SB-006 AC1/BR |

## 6. Unit Tests — Drishti Bala (US-SB-007)

| ID | Test Case | Input | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UT-SB-049 | Never auto-checked, both sources, all planets | planets 1–9, `ctx.source = "auto"` and `"manual"` | every planet `drishtiBala.value === false`, `reasons === [{ key: "shadbalaya.drishti.reason.manual" }]` | US-SB-007 AC1/AC2 |
| UT-SB-050 | No code path sets drishti true | full compute on any fixture | assert across all fixtures: `drishtiBala.value` is never `true` in computed output | US-SB-007 Business Rule |

## 7. Unit Tests — `mergeShadBalaya` (US-SB-013) + Context Fallbacks + Output Contract

| ID | Test Case | Input | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UT-SB-051 | Overridden bala preserved (value + reasons from stored) | computed `shadbalaya["3"].kalaBala = { value: true, ... }`; stored `shadbalaya["3"].kalaBala = { value: false, overridden: true, reasons: [...] }` | merged `kalaBala.value === false`, stored `reasons` kept | US-SB-013 AC1 |
| UT-SB-052 | Non-overridden bala recomputed | stored `sthanaBala = { value: false, overridden: false, ... }`; computed `value: true` | merged `sthanaBala.value === true` (computed wins) | US-SB-013 AC2 |
| UT-SB-053 | Absent stored → computed used | `stored = null` and `stored = {}` | merged === computed (all 9 planets × 6 balas) | US-SB-013 AC2 |
| UT-SB-054 | Sparse stored record (legacy first toggle) | stored only `shadbalaya["3"].cheshtaBala = { value: true, overridden: true, ... }` | merged: that bala = stored; the other 53 cells = computed; **no crash on missing bala keys / missing planet keys** | arch §Legacy, UX §16.7 |
| UT-SB-055 | Overridden sticky even when value equals computed | stored `cheshtaBala = { value: true, overridden: true }`, computed also `true` | merged keeps `overridden: true` (dot still shown) | US-SB-008 edge, BA OQ7 resolved |
| UT-SB-056 | Ratio NOT part of merge/storage | any computed/stored pair | output contains no `ratio`/`anupatha` key anywhere | US-SB-010 Business Rule |
| UT-SB-057 | ctx.thithi fallback to `computeThithiFromPlanets(planets)` | `ctx = { source: "auto", day: true }` (no thithi), Sun abs 10 / Moon abs 25 → thithi 2 | Moon treated as Shukla (thithi 2 → Cheshta checked) | arch §Context |
| UT-SB-058 | ctx.thithi missing + Sun/Moon missing → thithi 1 | planets without Sun/Moon, no `ctx.thithi` | falls back to 1 (Shukla) per `computeThithiFromPlanets` — Moon Cheshta checked | arch §Context |
| UT-SB-059 | Output shape contract | any fixture | exactly 9 keys `"1"`…`"9"`; each has exactly the six bala keys with `{ value, overridden, reasons }`; `overridden === false` in pure computed output; all values booleans; reasons `[]` allowed | data-model ShadBalaya |
| UT-SB-060 | Determinism | same planets/houses/ctx twice | deep-equal outputs (pure, no I/O, no ephemeris — enables the client-side legacy recompute) | arch §shared module |

## 8. Integration / API Tests — `PATCH /api/horoscope/[id]/shadbalaya`

New route file `src/app/api/horoscope/[id]/shadbalaya/route.ts`. Flow per architect: `getServerSession` → 401 → `connectDB()` → `Horoscope.findById` → 404 → owner-or-super-admin → 403 → `CalculatedDetails.findOne({ "horoscope.id": id })` → 404 → strict body validation → 400 → `$set` dotted path + `overridden: true` → `logger.info` → 200.

| ID | Test Case | Setup | Expected | Maps to |
|----|-----------|-------|----------|---------|
| IT-SB-100 | No session | `getServerSession` resolves `null` | 401 `{ error: "Unauthorized" }`; no DB write | US-SB-014 AC3, route pattern |
| IT-SB-101 | Non-owner student | session user B, horoscope owned by user A | 403 `{ error: "Forbidden" }`; no write | US-SB-014 AC3 |
| IT-SB-102 | Super-admin on another user's horoscope | session role `"super-admin"`, horoscope owned by user A | 200, write applied (super-admin MAY mutate Shad Bala — unlike the privacy route which 403s admins) | US-SB-014 Business Rule |
| IT-SB-103 | Horoscope not found | `Horoscope.findById` → null | 404 | route pattern |
| IT-SB-104 | CalculatedDetails not found | horoscope exists, `CalculatedDetails.findOne` → null | 404 | route pattern |
| IT-SB-105 | Invalid planet (0, 10, 1.5, "3", missing) | body `{ planet: 0, bala: "cheshtaBala", value: true }` etc. | 400; **no partial save** — assert no `$set` performed | arch §API validation |
| IT-SB-106 | Invalid bala key | `{ planet: 3, bala: "shadBala", value: true }`, `{ planet: 3, bala: "Sthana", ... }` (case), missing bala | 400 | arch §API validation |
| IT-SB-107 | Invalid value | `value: "true"`, `value: 1`, `value: null`, missing | 400 | arch §API validation |
| IT-SB-108 | Valid toggle writes exactly the dotted path | owner, `{ planet: 3, bala: "cheshtaBala", value: true }` | `findOneAndUpdate` called with `$set: { "shadbalaya.3.cheshtaBala.value": true, "shadbalaya.3.cheshtaBala.overridden": true }`; no other paths touched; no computation invoked (spy `computeShadBalaya` NOT called) | US-SB-008 AC2, arch §API flow |
| IT-SB-109 | Sparse write on legacy doc | stored CalculatedDetails WITHOUT `shadbalaya` field | `$set` creates only `shadbalaya.<planet>.<bala>.*`; document now has a 1-bala shadbalaya; no backfill of other balas | arch §Legacy, UX §16.7 |
| IT-SB-110 | Success response shape | valid toggle | 200 `{ planet: 3, bala: "cheshtaBala", value: true, overridden: true }` | arch §API flow |
| IT-SB-111 | Toggle off (uncheck) | `{ planet: 3, bala: "cheshtaBala", value: false }` | `$set` value false + overridden true (unchecking is also an override) | US-SB-008 AC1 |
| IT-SB-112 | logger.info called | valid toggle | logger.info invoked with planet, bala, value, horoscopeId | route pattern |

## 9. Integration / Recalculation Tests — `mergeShadBalaya` in the job (US-SB-013)

Extend `src/__tests__/recalculationJob.test.ts` (existing mock style: mocked `CalculatedDetails.findOne`/`findOneAndUpdate`, mocked `calculateHoroscope`, mocked `synthesizeCalculation`). The Developer must call `mergeShadBalaya(computed.shadbalaya, existing.shadbalaya)` before persisting in BOTH branches of `recalculateOne` and in the two recalc scripts.

| ID | Test Case | Setup | Expected | Maps to |
|----|-----------|-------|----------|---------|
| IT-SB-120 | Auto recalc preserves overrides | `calculateHoroscope` returns `shadbalaya` with planet 3 kala computed `true`; existing doc has `shadbalaya.3.kalaBala = { value: false, overridden: true }` | `findOneAndUpdate` payload contains `shadbalaya.3.kalaBala.value === false` (stored) | US-SB-013 AC1 |
| IT-SB-121 | Auto recalc recomputes non-overridden | existing `shadbalaya.1.sthanaBala = { value: false, overridden: false }`; computed `true` | payload contains value `true` | US-SB-013 AC2 |
| IT-SB-122 | Auto recalc on doc with no shadbalaya | existing has no `shadbalaya` | payload `shadbalaya` === computed wholesale | US-SB-013 AC2 |
| IT-SB-123 | Manual recalc preserves overrides | `synthesizeCalculation` returns shadbalaya; existing stored override | merged value kept alongside `manualHousePlacements` (never overwritten — parity US-SAS-009) | US-SB-013 AC3 |
| IT-SB-124 | Manual recalc keeps `manualHousePlacements` AND merges shadbalaya in the same persist | manual branch of `recalculateOne` | `findOneAndUpdate` payload has both `manualHousePlacements` (sanitized) and merged `shadbalaya` | US-SB-013 AC1/AC3 |
| IT-SB-125 | Partial-failure safety: merge errors do not corrupt other fields | `mergeShadBalaya` throws for one horoscope | horoscope counted as failed, snapshot untouched, run continues (existing job semantics) | US-SAS-010 |
| IT-SB-126 | PATCH route never touches other overrides | existing override on planet 5; PATCH toggles planet 3 | planet 5 override byte-identical after | US-SB-013, arch §Recalc integration |

## 10. Component / UI Tests (RTL if configured, else manual) — `ShadBalaTable.tsx`

> `@testing-library/react` is in devDependencies but `jest.config.js` uses `testEnvironment: "node"` — a per-file `/** @jest-environment jsdom */` override is required. If the Developer prefers, these cases run as manual checks; either way the assertions below are the acceptance bar.

| ID | Test Case | Steps | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UI-SB-140 | Table renders 8 columns × 9 rows, both sources | render `ShadBalaTable` with resolved auto + manual data | `table` with header cells in order: planet, sthanaBala, cheshtaBala, kalaBala, digBala, drishtiBala, naisargikaBala, ratio; 9 body rows sorted by planet 1→9; planet cell = glyph + localized name | US-SB-001 AC2/AC3 |
| UI-SB-141 | Section placement + chrome | open auto horoscope calculations tab | "ෂඩ් බලය"/"Shad Bala" heading section after planets table, before DerivedRanges (page.tsx ~1883/1885); `bg-white rounded-lg border p-4` wrapper | US-SB-001 AC1, UX §4 |
| UI-SB-142 | Checked vs unchecked render | fixture with mixed values | checked boxes have `checked`; unchecked don't; no flicker (synchronous resolved prop) | US-SB-001 AC4 |
| UI-SB-143 | Ratio column `(n/6)` | planet with 3 checked balas | cell text `(3/6)` — fraction not decimal/percentage | US-SB-010 AC1 |
| UI-SB-144 | Mobile card layout (<640px) | viewport 375px | card-per-planet with 3×2 labeled bala chips, ratio in card header, chip labels from i18n | US-SB-001, UX §5.2 |
| UI-SB-145 | Read-only mode | `isEditable = false` | checkboxes render `disabled` with checked state preserved; ⓘ button per cell; ratio + dots + tooltips intact; clicking does nothing | US-SB-014 AC1/AC2 |
| UI-SB-146 | Optimistic toggle + ratio update | click a checkbox | value flips immediately; ratio updates in the same frame; override dot appears | US-SB-008 AC1/AC4, US-SB-010 AC3 |
| UI-SB-147 | Debounce + PATCH payload | click, wait 300 ms (no PATCH), wait >500 ms | no fetch before 500 ms; exactly one fetch after with `{ planet, bala, value }` and correct URL `/api/horoscope/${id}/shadbalaya` | US-SB-008 AC2, UX §8.1 |
| UI-SB-148 | Last-write-wins on rapid toggles | click A→B→A within 500 ms | single PATCH after quiescence with the final value A; no 400/race error | US-SB-008 edge, UX §8.1 |
| UI-SB-149 | Save failure → revert + toast | mock fetch → 500 | checkbox reverts, ratio reverts, dot removed, error toast `astrology.shadbalaya.toast.saveError` (aria-live polite, 5 s) | US-SB-008 AC5, UX §8.3 |
| UI-SB-150 | Tooltip checked reason | hover checked Sthana box with `uchcha` reason | tooltip heading bala name, `✓ Checked because:`, one line per reason (`Exalted (Uchcha)`) | US-SB-009 AC1 |
| UI-SB-151 | Tooltip unchecked reason | hover unchecked Sthana with `neecheShatru {sign}` | `✗ Unchecked because:` + `Debilitated (Neecha) in the enemy sign {sign}` | US-SB-009 AC2 |
| UI-SB-152 | Tooltip multi-reason + override footer | Cheshta planet both Vakra + Shukla-Chandra conjunct, `overridden: true` | both reason lines, hairline `Set manually — kept through recalculation` footer | US-SB-009 AC3, UX §2.1/§7.2 |
| UI-SB-153 | Tooltip manual-state reason | Drishti box (never toggled) | single line `Set manually — the system cannot calculate Drishti bala` (`drishti.reason.manual`); Rahu/Ketu Dig → generic `reason.manual` | US-SB-009 AC4, US-SB-007, UX §9.2 |
| UI-SB-154 | Override dot + legend | toggle any bala; reopen | dot `aria-hidden`, `title` present, `aria-label` suffix ", set manually"; legend line `override.hint` under header when ≥1 dot | US-SB-013, UX §6.2 |

### E2E Flows (MANUAL — no Playwright installed; see §9.3)

| ID | Flow | Steps | Expected | Maps to |
|----|------|-------|----------|---------|
| E2E-SB-160 | View table on auto horoscope | own auto horoscope → calculations tab → scroll past planets table | 8-column table, 9 rows, computed boxes pre-checked (Sthana/Dig/Naisargika per fixtures; Cheshta/Kala per birth data), Drishti all unchecked, ratios `(n/6)` | US-SB-001 |
| E2E-SB-161 | View table on manual horoscope (no birth time) | own manual horoscope | Sthana/Dig/Naisargika computed from entered placements; Cheshta sign-based Ravi rule; Kala day/night unchecked with manual tooltips; Drishti unchecked; ratio renders | US-SB-012, US-SB-001 |
| E2E-SB-162 | Sthana Neecha+Shatru visible case | horoscope with Sun in Libra | Sun Sthana unchecked, tooltip `Neecha + Shatru`; other planets checked with their strength reasons | US-SB-002 |
| E2E-SB-163 | Cheshta Vakra + conjunction case | horoscope with retrograde planet / Shukla-Moon conjunction | retrograde planet checked with Vakra reason; conjunct planets checked with Shukla-Chandra reason; tooltip lists multiple lines when both | US-SB-003 |
| E2E-SB-164 | Kala day/night case | day-birth horoscope (Sun house ≥7) vs night-birth | day: Ravi/Guru/Sikuru Kala checked; night: Chandra/Kuja/Shani checked | US-SB-004 |
| E2E-SB-165 | Dig directional house case | horoscope with Guru in 1st, Shani in 7th, Rahu anywhere | Guru/Shani Dig checked with house reason; Rahu Dig unchecked | US-SB-005 |
| E2E-SB-166 | Naisargika maranakaraka case | horoscope where a planet is Maranakaraka (e.g. Budha in 4th — not Chandra-by-default) | that planet's Naisargika unchecked with `Maranakaraka (in house 4)`; all others checked; multiple qualifying planets all unchecked | US-SB-006 |
| E2E-SB-167 | Drishti manual case | any horoscope | all Drishti unchecked with manual tooltip; toggle one → persists on reload | US-SB-007 |
| E2E-SB-168 | Toggle persists across reload/navigation/logout | toggle 3 balas → refresh → navigate away/back → logout/login | values + dots intact; ratio matches toggles | US-SB-008 AC3 |
| E2E-SB-169 | Toggle + ratio live | toggle 4 balas on one planet | ratio moves `(n/6)` after each flip, no save button anywhere | US-SB-008 AC4, US-SB-010 AC3 |
| E2E-SB-170 | Sparse legacy first toggle + reload | open legacy horoscope (no stored shadbalaya) → toggle one bala → reload | first paint populated (no all-unchecked flash); after reload the toggled bala shows the user value + dot, the other 53 cells show computed values | US-SB-001 edge, US-SB-008, UX §9.1 |
| E2E-SB-171 | Overrides survive full recalculation | toggle balas → Super Admin changes an AstrologySetting → trigger full recalc → reopen | toggled balas unchanged (dot + value); non-overridden balas may differ; legend explains | US-SB-013 AC4 |
| E2E-SB-172 | Share-link / non-owner read-only | open share link + another student's public horoscope | disabled checkboxes + ⓘ tooltips; no PATCH fired on any interaction; hand-crafted PATCH → 403 | US-SB-014 |

## 11. Bilingual Testing (US-SB-011)

| ID | Test Case | Expected |
|----|-----------|----------|
| BI-SB-180 | Key parity | every `astrology.shadbalaya.*` key in `en.json` exists in `si.json` (and vice versa) — scriptable grep over both files; no key present in only one locale |
| BI-SB-181 | Reason params resolve per locale | `shadbalaya.sthana.reason.neecheShatru {sign:7}` renders sign name via `astrology.signNames.*` (SI `තුලා` / EN `Libra`); `dig.reason.house {house:10}`; `maranakaraka {house:8}`; `shuklaChandra {planet}` if used |
| BI-SB-182 | No hardcoded strings | `ShadBalaTable.tsx` + `ShadBalaCheckbox` + `ShadBalaTooltip` contain no inline Sinhala/English literals — all via `t()` keys |
| BI-SB-183 | Planet names reused | planet cells use `getPlanetName` / `astrology.planetNames.*` — no duplicate planet-name strings in messages |
| BI-SB-184 | Locale switch re-renders | `useI18n()` locale switch (SI ↔ EN) updates headers, planet names, tooltips immediately; no stale English in SI view; tooltip max-width 320px SI / 280px EN |
| BI-SB-185 | Sinhala width allowance | no clipped/wrapped column headers or tooltip lines at 375px viewport with SI locale |

## 12. Accessibility Testing (UX §13)

| ID | Test Case | Expected |
|----|-----------|----------|
| AX-SB-190 | Native checkbox keyboard | Tab focuses each checkbox; Space toggles; no custom key handler required; focus ring `focus-visible:ring-2 ring-indigo-500` |
| AX-SB-191 | aria-label composition | `t(checkbox.ariaChecked\|ariaUnchecked, { planet, bala })` + (when overridden) `, ` + `override.ariaShort`; e.g. EN `Sun Sthana Bala — checked, set manually` |
| AX-SB-192 | Tooltip semantics | trigger `aria-describedby` → `role="tooltip"` with matching `id`; Escape closes and restores focus to the trigger; `title` fallback carries the FULL plain text (heading, state line, all reasons, override line) |
| AX-SB-193 | Read-only ⓘ reachability | ⓘ button focusable in EVERY cell; Tab order never skips disabled cells; `aria-label` = `astrology.shadbalaya.infoGlyph` |
| AX-SB-194 | Override dot not color-only | dot `aria-hidden="true"` but state conveyed via aria-label suffix + tooltip footer + `title` — WCAG 1.4.1 |
| AX-SB-195 | Contrast | tooltip reason text `text-gray-700` ≥ 4.5:1; footer `text-gray-500` at 12px — verify 4.5:1, else bump to `text-gray-600` (UX §16.2 flag); checkbox accent indigo-600 ≥ 3:1; dot ≥ 3:1 |
| AX-SB-196 | Reduced motion | tooltip fade + dot fade disabled under `prefers-reduced-motion` |
| AX-SB-197 | Ratio cell | `aria-label` via `astrology.shadbalaya.ratioAria` (`{planet} — {n} of 6 balas`) |
| AX-SB-198 | Touch targets | mobile bala chips ≥ 44px tall; desktop checkbox label padding extends the hit area; ⓘ ≥ 24px with padded hit area |
| AX-SB-199 | Live regions | error toast `aria-live="polite"`; no other live regions (native checkboxes self-announce); no `aria-busy` needed (sync render) |

## 13. Edge & Negative Cases

| ID | Test Case | Expected | Maps to |
|----|-----------|----------|---------|
| RE-SB-210 | Rahu/Ketu rows: Dig false, ratio denominator still 6 | Rahu row ratio counts only 5 computable columns but displays `/6` (e.g. Rahu with Sthana+Cheshta+Naisargika checked → `(3/6)`); no crash | US-SB-005 AC3, US-SB-010 |
| RE-SB-211 | All balas unchecked → `(0/6)` | fresh manual horoscope, no toggles, no derivable balas | `(0/6)` per row | US-SB-010 AC2 |
| RE-SB-212 | All balas checked → `(6/6)` | toggle all six incl. Drishti on one planet | `(6/6)`; persists on reload | US-SB-010 AC2 |
| RE-SB-213 | Rapid toggling same key (A→B→A) | click 3× quickly | one PATCH after quiescence, server value = A (last write wins); no 400; no interleaved stale PATCH after a later toggle | US-SB-008 edge, UX §8.1 |
| RE-SB-214 | Toggle then navigate away within 500 ms | toggle → immediately navigate | **Flagged:** UX §8.2 recommends keep-alive flush on unmount; architect says unnecessary. Acceptance: the last toggle is EITHER persisted (flush implemented) OR the 500 ms drop window is an accepted, documented product decision — must not be silently flaky. Test whichever the Developer implements; if no flush, verify no unhandled rejection and the page re-syncs on return | US-SB-008 AC3, UX §16.1 |
| RE-SB-215 | Super-admin edits another user's horoscope | admin UI on user A's horoscope | toggles enabled (`isEditable` true for admin), PATCH 200 | US-SB-014 Business Rule |
| RE-SB-216 | Share-link viewer | open share link | read-only; ⓘ tooltips work; ratio/dots render; dev-tools PATCH → 403 | US-SB-014 AC3 |
| RE-SB-217 | Offline / failed request | network down or 500 | revert + dot removal + toast; retry after recovery works | US-SB-008 AC5 |
| RE-SB-218 | Locale switch with pending debounce | toggle in SI → switch to EN within 500 ms | labels re-render in EN; the in-flight PATCH completes; no stale SI/EN mix in tooltips; values unchanged | US-SB-011 AC4 |
| RE-SB-219 | Manual horoscope without birth time | no `ctx.day` derivable | Kala day/night conditions skipped (unchecked + manual tooltip); Cheshta sign-based rule still applies; ratio unaffected | US-SB-012 AC3, arch §Kala |
| RE-SB-220 | Legacy doc: absent `shadbalaya` field | no migration/backfill | first paint = computed values (lazy `mergeShadBalaya(computeShadBalaya(...), undefined)`); first toggle creates sparse record; reload re-merges — 53 other cells computed | US-SB-001 edge, arch §Legacy |
| RE-SB-221 | Toggle equals computed value → dot still shown | toggle a bala to its computed state | `overridden: true` sticky — dot + tooltip footer render; survives reload | US-SB-008 edge, BA OQ7 |
| RE-SB-222 | Concurrent toggles on different keys | toggle planet 3 Cheshta + planet 5 Kala within 100 ms | two independent PATCHes, each `$set` its own dotted path; no cross-key clobber; server accepts both | UX §8.1, arch §PATCH |
| RE-SB-223 | Sun/Moon missing from stored planets (legacy) | legacy doc without Sun or Moon | `computeThithiFromPlanets` → 1 → Moon treated Shukla; no crash | arch §Context fallback |

## 14. Test Data Fixtures

Known-bala fixture set (also used in the strategy doc's data setup):

| Fixture | Planets (name, house, absDeg, sign, strength) | Expected Shad Bala highlights |
|---------|-----------------------------------------------|------------------------------|
| FIX-A | Sun(1, 7, 190, sign 7, NEECHA) | Sthana false — `neecheShatru {strength:-1, sign:7}` |
| FIX-B | Saturn(7, 1, 10, sign 1, NEECHA) | Sthana false — `neecheShatru {strength:-1, sign:1}` |
| FIX-C | Mars(3, 4, 110, sign 4, NEECHA) | Sthana true (Neecha but not Shatru) — `debilitated` checked-state reason (resolved in Dev) |
| FIX-D | Moon(2, 8, 37, sign 8) + houses (cusp house of 37° = 8), `ctx.maranakaraka = [2]` | Naisargika false — `maranakaraka {house:8}` (Moon is Maranakaraka); all others true |
| FIX-E | Guru(5, 1, 15) / Shani(7, 7, 190) / Rahu(8, 10, 285) | Dig true `{house:1}` / true `{house:7}` / false `reasons: []` |
| FIX-F | Ravi(1, 10, 285, sign 10), Moon(2, 8, 230, sign 8), thithi 5, `day: true` (auto) | Ravi Cheshta `uttarayana`; Ravi Kala **no bala** (day suppressed during Shukla); Moon Cheshta `shuklaPaksha`; Guru/Sikuru Kala `day`+`shuklaPaksha` |
| FIX-G | night birth `day: false`, thithi 20 | Chandra/Kuja/Shani Kala `night` + `krushnaPaksha` (both reasons); Rahu `krushnaPaksha` only |
| FIX-H | Kuja(3, 4, 100, sign 4) + Moon(2, 4, 100, sign 4), thithi 5 | Kuja Cheshta `shuklaChandra` (same-sign conjunction) |
| FIX-I | Shani(7, 4, 110, sign 4, SHATRU) | Sthana false — `shatru` reason (Shatru but not Neecha; updated per product correction) |
| FIX-J | manual ctx (no `day`), thithi 20, Ravi sign 6 | Ravi Cheshta false; Kala `reasons === []` (Ravi excluded from the Krushna list per product correction); Drishti manual |
| FIX-K | legacy doc — no `shadbalaya` field | lazy recompute at render; sparse first-toggle record |

Golden integration fixture: `calculateHoroscope(baseData)` (1990-06-15 08:30, Colombo, lahiri — `calculation.test.ts` baseData) must produce `shadbalaya` with 9 planet keys, six bala keys each, `drishtiBala.value === false` everywhere, `overridden === false` everywhere; store as `src/__tests__/fixtures/shadbalaya-default-2026-08.json` (era-stamped).

## 15. Test File Layout (proposed)

```
src/__tests__/shadBalaya.test.ts            // UT-SB-* unit tests (pure module, incl. FIX-A..K)
src/__tests__/shadBalayaApi.test.ts         // IT-SB-100..112, IT-SB-126 API route tests
src/__tests__/recalculationJob.test.ts      // EXTEND — IT-SB-120..125 merge tests
src/__tests__/shadBalaya-ui.test.ts         // UI-SB-* + AX-SB-* + BI-SB-* (RTL, per-file jsdom) — OPTIONAL
src/__tests__/fixtures/shadbalaya-default-2026-08.json   // golden era fixture
e2e/shadbalaya.spec.ts                      // E2E-SB-* — ONLY if Playwright is added (flagged §9.3)
```

## 16. Acceptance Criteria Checklist (traceability)

| User Story | QA test IDs |
|-----------|-------------|
| US-SB-001 | UT-SB-059, IT-SB-109, UI-SB-140/141/142/143/144, E2E-SB-160/161, RE-SB-220 |
| US-SB-002 | UT-SB-001..010, UI-SB-150/151, E2E-SB-162 |
| US-SB-003 | UT-SB-011..026, UI-SB-152, E2E-SB-163 |
| US-SB-004 | UT-SB-027..036, E2E-SB-164, RE-SB-219 |
| US-SB-005 | UT-SB-037..043, E2E-SB-165, RE-SB-210 |
| US-SB-006 | UT-SB-044..048, E2E-SB-166 |
| US-SB-007 | UT-SB-049/050, UI-SB-153, E2E-SB-167 |
| US-SB-008 | IT-SB-108..112, UI-SB-146/147/148/149, E2E-SB-168/169/170, RE-SB-213/214/217/221/222 |
| US-SB-009 | UI-SB-150..153, AX-SB-192/193, BI-SB-181/182 |
| US-SB-010 | UI-SB-143, E2E-SB-169, RE-SB-211/212 |
| US-SB-011 | BI-SB-180..185, RE-SB-218 |
| US-SB-012 | UT-SB-012/013/034/035, E2E-SB-161, RE-SB-219 |
| US-SB-013 | UT-SB-051..056, IT-SB-120..126, UI-SB-154, E2E-SB-171, RE-SB-220/221 |
| US-SB-014 | IT-SB-100..103, UI-SB-145, AX-SB-193, E2E-SB-172, RE-SB-215/216 |

## 17. What Cannot Be Tested (and how to close the gap)

1. **Kala varga-load condition** — formula unconfirmed (BA OQ1, arch Non-Goal). Gap closed when the domain approves the load formula; until then only the "never computed, student sets manually" contract is testable (UT-SB-033).
2. **Cheshta planet-war winner + 48h expiry** — no graha-yuddha module (BA OQ6, arch Non-Goal); `warWinnerPlanet` is referenced in arch open questions but **absent from the `ShadBalayaContext` type** (see §9.2). Gap closed when the war module lands; the hook contract test (UT-SB-026) is ready.
3. **Ephemeris sunrise/sunset day/night** — v1 uses the deterministic Sun-house rule (arch Open Q3). The refinement is a documented future option; the current rule is fully testable (UT-SB-036).
4. **Un-override / reset to system control** — no UI or API exists to clear `overridden: true` (BA OQ7 resolved as "always sticky"). Product gap: a student can never return a bala to auto-recompute. Flagged to PM/UX.
5. **Paksha boundary at exact Purnima/Amavasya** — the domain boundary (thithi 15/16 and 30/1) is resolved by the architect's inclusive rule (15 → Shukla), but note the **pre-existing** `thithi.test.ts:17` test names "180° elongation (full moon) is thithi 15" while asserting `computeThithi(10, 190) === 16` — name/assertion disagree; QA recommends the Developer add explicit boundary tests around elongation 168° (thithi 15) and 180° (thithi 16) and get domain sign-off on the exact-moment behaviour.
6. **E2E automation** — no Playwright/Cypress installed (verified in `package.json`; no config files; the 20260805 plan's "Playwright (new)" was never realised). Until a framework is added, E2E-SB-160..172 run as manual scripts. Closing the gap requires installing Playwright + `e2e/shadbalaya.spec.ts` — Developer/PM decision (§9.3).

## 18. Open Questions for Developer / PM

1. **`NATURAL_ENEMIES` export** — architect states both `NATURAL_ENEMIES` and `SIGN_LORD` are exported from `src/lib/manualChart.ts`; verified **only `SIGN_LORD` is exported** (manualChart.ts:138 vs 424). **RESOLVED in Dev:** `NATURAL_ENEMIES` is consolidated as a single shared export in `src/lib/astrology.ts:53`; `calculation.ts`/`currentPlanets.ts`/`shadBalaya.ts` all import it (no third copy).
2. **Sthana checked-state reason for Neecha-but-not-Shatru** — **RESOLVED in Dev:** added `shadbalaya.sthana.reason.debilitated` ("Debilitated (Neecha) in {sign}") for the checked state (UT-SB-005). **PRODUCT CORRECTION (2026-08-14):** a planet in a Shatru (enemy) sign now has **no** Sthana bala — `value === false` with reason `shadbalaya.sthana.reason.shatru` (UT-SB-006 updated; BA US-SB-002 AC3 + Business Rules amended; FIX-I updated).
3. **Cheshta unchecked reason in Krushna paksha** — **RESOLVED in Dev:** `shadbalaya.cheshta.reason.krushnaPaksha` is emitted as the unchecked-state reason when Moon is not in Shukla paksha (UT-SB-017).
4. **`ctx.warWinnerPlanet` hook** — **RESOLVED in Dev:** added as an optional inert field on `ShadBalayaContext` (`src/lib/shadBalaya.ts`); the pipeline never sets it; the hook contract test is ready for the future war module.
5. **Navigation flush (UX §8.2 vs arch §Toggle)** — **RESOLVED in Dev:** pending debounced toggles flush with `fetch(..., { keepalive: true })` on unmount (RE-SB-214 no silently-lost toggle).
6. **E2E framework** — install Playwright (then E2E-SB-* become automated) or keep E2E-SB-* as manual scripts for this release.
7. **Component test env** — `@testing-library/react` is installed but jest runs `testEnvironment: "node"`; decide whether to add per-file jsdom for UI-SB-* tests or run them manually.
8. **Tailwind `accent-indigo-600`** (UX §16.3) — confirm Tailwind v4 (in devDependencies) supports `accent-*`; fallback `accent-[#4F46E5]`.
9. **SI translation review** (UX §17.3) — all `si.json` shadbalaya strings are proposals; needs BA/domain sign-off before the bilingual tests are considered final.
10. **`balaNames.*` vs `columns.*`** (UX §16.5) — Developer may alias or duplicate; QA will verify both locales render identical heading/header text either way.
11. **PRODUCT CORRECTION (2026-08-14) — Rahu/Ketu Cheshta bala:** Rahu/Ketu are retrograde by nature, so their usual retrograde is NOT Vakra and grants no Cheshta bala; only direct (opposite) motion is Vakra. Also, the Shukla-Chandra conjunction condition applies only to Kuja/Buda/Guru/Sikuru/Shani — Rahu/Ketu are excluded. Implemented in `computeCheshtaBala` (inverted vakra test for nodes + `SHUKLA_CHANDRA_PLANETS` map) and `manualChartDetails.ts` `synthesizePlanets` (nodes stored as `retrograde: true` = natural state so manual charts don't false-trigger vakra). Tests UT-SB-023b/c/d added; BA US-SB-003 AC3/AC4 + business rules, `data-model.md`, and `docs/shadbalaya.md` updated.
12. **PRODUCT CORRECTION (2026-08-14) — Kala bala Shukla-paksha rule:** Ravi has **no** Kala bala while Moon is in Shukla paksha — its day-birth condition is suppressed (a day-birth Ravi in Shukla paksha is unchecked). Rahu is added to the Shukla-paksha list (now Budha/Guru/Sikuru/Rahu). Implemented in `computeKalaBala` (Ravi day suppression + `KALA_SHUKLA_PLANETS` includes 8). Tests UT-SB-029/029b updated/added, FIX-F updated; BA US-SB-004 AC3, `data-model.md`, and `docs/shadbalaya.md` updated.
13. **PRODUCT CORRECTION (2026-08-14) — Kala bala Krushna-paksha rule:** Ravi is excluded from the Krushna-paksha list entirely (his only Kala source is a day birth during Krushna paksha) and Rahu is added (now Kuja/Shani/Rahu). Triggered by the live horoscope `6a68e28d150a9f9377fa70e3` (thithi 27, night birth) still marking Ravi. Implemented in `computeKalaBala` (`KALA_KRUSHNA_PLANETS = {3, 7, 8}`). Tests UT-SB-027/030/FIX-J updated, UT-SB-029c added; BA US-SB-004 AC4, `actors.md`, `data-model.md`, arch Kala table, and `docs/shadbalaya.md` updated.

## Verification

```bash
npx jest src/__tests__/shadBalaya.test.ts       # unit rules + merge (UT-SB-*)
npx jest src/__tests__/shadBalayaApi.test.ts     # PATCH route (IT-SB-100..112, 126)
npx jest src/__tests__/recalculationJob.test.ts  # recalc merge (IT-SB-120..125)
npx jest src/__tests__/shadBalaya-ui.test.ts     # UI/BI/AX (if RTL env configured)
pnpm test                                        # full suite — no regressions
pnpm lint                                        # no new lint errors
pnpm format                                      # import order + prettier
```
