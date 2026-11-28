# Yoga/Dosha Separated Tags (යෝග සහ දෝෂ) — QA Plan

**Date:** 2026-09-06 08:37
**Author:** QA (BMAD)
**Based on:** `specs/business-analysis/20260906-0707-yoga-dosha-tags.md` (US-YD-001..013), `specs/business-analysis/data-model.md` (§Yogas/§Doshas/§Yoga/Dosha Rule Catalog/§YogaStrength/§CancellationStatus), `specs/architecture/20260906-0905-yoga-dosha-tags-architecture.md`, `specs/ux/20260906-0945-yoga-dosha-tags.md`

---

## Revision (2026-09-06, engineer direction rev 3) — Shani Mangala is now a dosha

Rev 3 reclassifies **Shani Mangala from the Yoga group to the Dosha group** (renders as **Shani Mangala Dosha / ශනි මංගල දෝෂය**, amber group). All `shaniMangala`-as-`yoga` expectations below are superseded: the catalog now holds `shaniMangala` as `dosha` (`active`) + `manglik` as `dosha` (`pending-domain`); the Yoga group is empty; stored v2 snapshots carry `yogas: []` and `doshas.doshas: [shaniMangala, …]`; rule ids (`shaniMangala.sm01..sm06`) and their reason/mitigation/theme/dasha keys are unchanged but resolve under `dosha.shaniMangala.*`; search resolves "ශනි කුජ යෝග"/"shani mangala" to a **dosha**-id condition and `hasDosha` scoring; `yogaDoshaVersion` is `2`. The implemented/passing test suites are the source of truth for the revised expectations: `yogaDosha.test.ts` (47), `yogaDoshaSearch.test.ts` (14), `yogaDoshaComponents.test.tsx` (17), `calculation.test.ts` IT-YD-200 (fixture: `yogas: []`, doshas `[{id:"shaniMangala", isPresent:true}]`).

**Rev 4 addendum (2026-09-06, search by yoga/dosha name):** `/api/search` resolves `yoga_id`/`dosha_id` name conditions and `hasYoga`/`hasDosha` scoring through `resolveYogaDoshas` (the render-time view) instead of raw stored fields, so legacy pre-v2 docs that render the tag are now findable by name. New expectations added: SR-YD-808 (legacy doc with only chart facts matches "shani mangala"; non-conjunct legacy doc stays excluded), SR-YD-809 (v1 doc carrying shaniMangala inside `yogas` recomputes to the dosha view and matches), and SR-YD-810 (longest-span precedence — "ශනි මංගල දෝෂය" must not fire the `මංගල` manglik condition, while a bare "මංගල" still resolves manglik). Search-suite count is now 14.

**Rev 5 addendum (2026-09-06, dosha chip colors):** dosha tag chips are color-coded by cancellation state per user direction — present dosha = **red chip** (`bg-red-50`/`text-red-700`/`border-red-300`, `bg-red-600` dot), cancelled dosha = **gray chip** (`bg-gray-100`/`text-gray-500`, line-through, gray dot). Yoga chips keep the neutral white/gray treatment with indigo hover. Accessibility contract unchanged (color is never the only channel: strikethrough + status in the aria-label + dot). Component-suite count is now 18.

**Rev 6 addendum (2026-09-06, Agni Marutha Dosha + SM narrowed):** per `docs/agni-marutha-dosha.md`, **Agni Marutha** is added as a second ACTIVE dosha (8 rules, id `agniMarutha`; am01 conjunct, am02/am03 aspect, am04/am05 sign ownership, am06/am07 nakshatra lord, am08 parivartana). **Shani Mangala** is narrowed to 3 positional-only rules (SM-01 conjunction, SM-02 7th-from-each-other, SM-03 mutual 4-10): mutual drishti, 2/12, and parivartana are removed. Parivartana moves to AM-08. Both doshas remain in the Dosha group. `yogaDoshaVersion` is now `3`; stored v2 documents recompute from chart facts via the resolver (v1→v2 pattern reused).

Key test impacts:
- **yogaDosha.test.ts:** catalog rows/aliases updated (AM added); theme assertions now include full 12-house key set for both doshas; SM+AM rules block rewritten (UT-YD-040..047 + AM-01..08 + parivartana-is-AM-only test); UT-YD-070 loop excludes house 8 (now SM-02 positional); UT-YD-116 / UT-YD-150 / UT-YD-153 updated for AM presence; total suite now 101 tests.
- **yogaDoshaSearch.test.ts:** SR-YD-806/807 text assertions updated (conjunct charts now yield both dosha names); +SR-YD-811 (AM-only parivartana chart matches "agni marutha"/"අග්නි මාරුත දෝෂය" but NOT "shani mangala"). Suite now ~7 tests.
- **calculation.test.ts IT-YD-200:** `rulesTriggered` is now `["shaniMangala.sm01"]` only; asserts agniMarutha present and both ids in `doshas.doshas`. IT-YD-201 golden fixture regenerated (now includes both doshas).
- **yogaDoshaComponents.test.tsx:** planet fixture arrays updated with `nakshatra` field (buildChartFacts passthrough); suite unchanged (18 tests).
- **data-model.md Rule Catalog:** updated SM row to Dosha/positional-only; added AM row; `ruleIds`/`rulesTriggered` example corrected to lowercase `shaniMangala.sm01`.
- Feature suite total: 126 (101 engine + ~7 search + 18 components). Full suite: 1014 pass / 10 pre-existing failures (search-combined + privacy). Build: exit 0.

**Rev 7 addendum (2026-09-07, SM-2/SM-3 require the MUTUAL drishti):** user corrected SM semantics against real chart `6a68e773…` (Isuri): placement alone is not enough — "Both Kuja and Shani should have their aspects … consider the planet Orbs … only given locations like 7, 4, 8." That chart is 7th-from-each-other positionally but only Mars→Saturn aspects (210°, stored gap 7.76; Saturn's records contain no Mars) → **Shani Mangala is absent; Agni Marutha is present** (AM-02 via the stored 210° record + AM-06 via Saturn in Dhanishta/23). Implemented expectations:
- **SM-02** = gap 6 AND stored **mutual 180°** records (both directions, per-planet orbs — orb check derives from the stored `aspects`, which are already orb-filtered at compute time). One-way 7th → SM absent.
- **SM-03** = positional mutual 4-10 (Mars 10th from Saturn) AND **both** directions present in the 90°/270° family. Trines/sextiles (120/60), Mars's 8th drishti (210°) and one-way aspects never qualify.
- `yogaDoshaVersion` is now **4** (stored v3 docs had old positional-SM results → recompute via resolver on read).
- **yogaDosha.test.ts:** UT-YD-041 (gap-6 fixtures now carry mutual 180 records; new one-way-7th negative), UT-YD-042 (mutual 90/270 for 4-10; one-way-4-10 negative; gap-3 orientation excluded), UT-YD-116 (2/8 fixture → mutual 180), +UT-YD-045 regression from the real `6a68e773` chart facts (SM absent; AM `["…am02","…am06"]`). Suite now **102** tests.
- Feature suite total: **127** (102 engine + ~7 search + 18 components). Full suite: **1015 pass** / 10 pre-existing failures (unchanged). Build: exit 0.

**Rev 8 addendum (2026-09-07):** Sinhala display name **ශනි කුජ දෝෂය → ශනි මංගල දෝෂය** (catalog `keywordSi`, `si.json` name; old long form kept as a search alias). Updating the display-name assertions (yogaDosha.test.ts keywordSi, yogaDoshaSearch.test.ts SI textContent). Feature suites 83/83; full suite 1015/10 unchanged.

**Rev 9 addendum (2026-09-07, SM-01/AM-01 conjunction gates on the per-planet orbs):** user corrected SM conjunction against real chart `6a74b291a5e25025ca4cb61a` ("Kuja and Shani not combined because those planets are not in their orbs range — has not Shani Mangala"). Saturn 16.03° Vrishchika (house 7, Anuradha/17) and Mars 29.6° Vrishchika (house 7, Jyeshtha/18) are same sign + house but **13.57° apart**, beyond Saturn's 9° / Mars's 8° orbs → the compute pipeline stored **no** 0° records on either side. Implemented expectation:
- **SM-01 / AM-01** = same sign AND same house AND **both** stored aspect lists carry the partner at `aspectType 0` (conjunction records exist only within the aspecting planet's orb — reuse stored records, US-YD-002; no recomputed orb math in the rules).
- Chart `6a74b291` → **Shani Mangala absent; Agni Marutha present via AM-04** (Saturn in Vrishchika, `SIGN_LORDS[8] === 3`). Stored calc doc (`calculateddetails` `_id …b`, `yogaDoshaVersion: 2`) recomputes on read (v2 < v4).
- **yogaDosha.test.ts:** `UT-YD-020` now asserts the mutual 0°-record requirement; +`UT-YD-021b` (out-of-orb same-sign pair not conjunct) and +`UT-YD-048` (engine regression from the real `6a74b291` facts: SM absent, AM `["…am04"]`). Conjunct fixtures across engine/search/components suites given their mutual 0° records; `UT-YD-151` (manual chart with no stored aspects) now expects absence (no in-orb evidence).
- Feature suite total: **128** (52 engine + 15 search + 18 components + 44 calculation). Full suite: **1017 pass** / 10 pre-existing failures (unchanged). Build: exit 0.

---

## Scope

**In scope:**

- New pure module `src/lib/yogaDosha/` (`catalog.ts`, `relationships.ts`, `rules.ts`, `ruleEngine.ts`, `interpretation.ts`, `cancellation.ts`, `types.ts`, `index.ts`) — catalog integrity, relationship helpers, SM-01..SM-06 + MK-01 rule functions, evaluation pipeline, cancellation/mitigation separation, legacy fallback.
- New enums `YogaStrength` (1–4) and `CancellationStatus` (1–3) in `src/lib/astrologyEnums.ts`.
- Calc-time persistence: `calculateHoroscope` (auto) + `synthesizeCalculation` (manual) emit `yogas` / `doshas.doshas` / `yogaDoshaVersion: 1` via the existing `...calculated` / `...synth` spreads; `src/lib/astrology.ts` retype (`unknown[]` → `YogaEvaluation[]` / `DoshaEvaluation[]`).
- Read-only additive API surface: `GET /api/horoscope/:id`, `GET /api/share/:token`, `POST /api/search` (new `yogaId`/`doshaId` exact conditions), CSV export.
- Search compatibility: `textContent.ts` catalog-name resolution (legacy string fallback), `vocabulary.ts` `YOGA_DOSHA_NAME_WORDS`, result cards `isPresent`-based rendering unchanged.
- Render-time composition: `YogaDoshaSection` (dedicated `yoga-doshas` tab between Dashas and Metadata — rev 2; rev 1 had it between the Lagna card and the Houses section in the Calculations tab, superseded), `YogaTagGroup`/`DoshaTagGroup`, `YogaDoshaTag`, `YogaDoshaDetailPanel` + five blocks, `YogaStrengthPill`, `StateBadge`.
- Bilingual (SI/EN) message namespaces `yogaDosha.*`, `yoga.*`, `dosha.*`, `yogaStrength.*`, `cancellationStatus.*`, `tradition.*`.

**Out of scope (per BA/Architect/UX):**

- New astrological calculations, Gemini/LLM interpretation, user editing/overrides, search-card restyle to separated tags, Navamsha (D9) rules (phase-1 D1-only), functional benefic/malefic status.
- Shani–Mangala house-theme/expression **content** (BA/domain territory); the plan asserts structure, key resolution and tendency wording, not the astrological accuracy of the seeded strings.
- AstrologySettings recalculation job code changes (architect D10: **zero changes** — QA regression-tests that, but no new job tests are authored).
- Performance/load and visual-regression (Chromatic) — no tooling installed; flagged in "What cannot be tested".

## Test Strategy

| Level | Scope | Tool/Framework | Notes |
|-------|-------|----------------|-------|
| Unit (Jest, pure) | `src/lib/yogaDosha/*` — catalog, relationships, rules, engine, cancellation/mitigation, legacy resolvers | Jest + ts-jest, node env | **Assert against the architect's typed contract, not code** — `src/lib/yogaDosha/` does not exist yet (verified 2026-09-06). No mocks, no I/O for pure functions. |
| Integration | `calculateHoroscope` / `synthesizeCalculation` output shape, legacy-`resolve` paths | Jest + ts-jest | Golden fixture era-stamped; schema invariants; auto↔manual equivalence |
| Search | `textContent.ts`, `vocabulary.ts`, `/api/search` route, `/api/search/export`, result cards | Jest route tests | Mock session/DB + `@/lib/search/embedding` + `@/lib/search/qdrant` (mandatory — `generateEmbedding` runs on every POST) |
| Component/UI | `YogaDoshaSection` + groups/tags/panels | Jest + RTL + jsdom | `.test.tsx` supported — **verified `jest.config.js` `testMatch: ["**/__tests__/**/*.test.{ts,tsx}"]`** (supersedes the "tsx excluded" notes in prior plans). Per-file `/** @jest-environment jsdom */` precedent: `notepadComponents.test.tsx`. RTL 16.3.2 + jest-dom present. |
| E2E | Full user flows | Manual scripts | **No Playwright/Cypress in `package.json`** (verified) — flagged Developer/PM decision |
| Bilingual | Message-key parity, fallback, locale re-render | Jest (fs key diff) + RTL | `notepadCatalogs.test.ts` fs-read pattern |
| Accessibility | Button/region contract, SR output, focus, color-not-only-channel, contrast | RTL + axe-style assertions | Follow UX §Accessibility; manual NVDA/JAWS scripts |
| Regression | Pre-existing calculation/search/export/recalc tests unaffected | `npx jest` full suite | See §Regression Impact |

**Verified repo facts that shape the plan:**

1. `jest.config.js` line 2: `testMatch: ["**/__tests__/**/*.test.{ts,tsx}"]` — **`.tsx` IS included**; the earlier "jest excludes .tsx" risks in the bhava-suchika (risk 6) and notepad (risk 6) strategy sections are outdated. No config change needed for RTL suites.
2. `src/lib/yogaDosha/` **does not exist** — all unit tests are written against the architect's declared interfaces (`ChartFacts`, `RuleResult`, `YogaEvaluation`, `DoshaEvaluation`, `CancellationResult`, …).
3. `src/lib/astrology.ts:454` `DoshaInfo { doshas: unknown[] }`, `:503` `CalculationResult.yogas: unknown[]` — Developer retypes.
4. `src/lib/calculation.ts:483-484` and `src/lib/manualChartDetails.ts:227-228` currently hardcode `yogas: []`, `doshas: { doshas: [] }`.
5. Existing test-mock pattern for route tests: `search-bhava-suchika.test.ts` mocks `@/models/Horoscope|CalculatedDetails|Chart`, `next-auth`, `@/lib/db`, `@/lib/search/embedding`, `@/lib/search/qdrant`, `@/app/api/auth/[...nextauth]/route`.
6. `src/lib/search/textContent.ts` reads `y.name` / `d.name` (lines 89-106, 188-205) and `src/app/api/search/export/route.ts` reads `y.name`/`d.name` (lines 148-156) — both must gain catalog-name resolution with legacy fallback.
7. `src/app/api/search/route.ts:38-49` `ExactCondition` union — Developer extends with `{ type: "yoga_id"; yogaId: string }`-style generic conditions (catalog-driven, no hardcoded ids in the route).
8. Golden fixture precedent: `src/__tests__/fixtures/bhava-suchika-default-2026-08.json` (era-stamped `_comment`, generator test).

## Test Environment & Data Setup

| Item | Setup |
|------|-------|
| `baseData` (golden) | `calculateHoroscope(baseData)` — `1990-06-15 08:30` Colombo `6.9271/79.8612`, male, lahiri, `isPublic: false`, owner `user-1` (the `calculation.test.ts` fixture) |
| Golden fixture | `src/__tests__/fixtures/yoga-dosha-default-2026-09.json`, era-stamped `_comment` "Generated 2026-09-06 (era stamp). Regenerate deliberately with the generator test." — mirror `bhava-suchika-default-2026-08.json`. **Content frozen only after domain OQs resolve (parivartana strength, SM-02/SM-03 phrasing, 2/12 tradition, Manglik)** |
| Chart fixtures per rule (unit) | Synthetic `ChartFacts` builders — `planet(name, house, sign, absoluteDegree, strength, retrograde, aspects[])` + `houses[12]` whole-sign with `lord` (mirror `shadBalaya.test.ts` helper style). Per-rule present/absent/edge fixtures: SM-01 conjunction; SM-02 mutual drishti (both lists) + one-direction-only; SM-03 gap-6 wrap both ways; SM-04 gaps 3/9 + special aspect set; SM-05 sign exchange; SM-06 gap 1/11 under both traditions; MK-01 fixture (Mars in each of 1/4/7/8/12) to prove `pending-domain` skipping |
| Manual fixtures | `synthesizeCalculation(compute({ lagna, houses, navamsaLagna, navamsaHouses }))` (bhava-suchika pattern) — with and without `planetDegrees` (fallback navamsa-midpoint → sign-midpoint 15°) |
| API/search tests | Mocked `getServerSession` (owner-1, role student) + `connectDB` + the five model mocks + embedding/qdrant mocks (copy `search-bhava-suchika.test.ts` skeleton) |
| Component tests | `@testing-library/react`, per-file `/** @jest-environment jsdom */`, stubbed `useI18n` hook with seeded messages (notepadComponents pattern), catalog + fixture evaluations as props |
| i18n parity | fs-read `src/messages/en.json` + `si.json` (notepadCatalogs pattern); assert every `yoga.*`/`dosha.*`/`yogaDosha.*`/`yogaStrength.*`/`cancellationStatus.*`/`tradition.*` key used by catalog + renderer resolves in **both** locales |
| E2E/manual | One auto horoscope (golden), one manual horoscope with same placements, one manual without navamsa, one legacy doc (strip `yogaDoshaVersion`, stale `yogas: []` + legacy flat dosha strings), one doc with unknown catalog id, one share link; SI + EN sessions; dev server + seeded DB |

## Test Cases

### Unit — catalog & enums (`src/lib/yogaDosha/catalog.ts`)

### UT-YD-001: Catalog is registry-driven
- **Related story:** US-YD-001 AC1, US-YD-007
- **Priority:** P0
- **Preconditions:** `YOGA_DOSHA_CATALOG` exists per architect `CatalogEntry[]` contract.
- **Steps:**
  1. Enumerate `YOGA_DOSHA_CATALOG`.
  2. Assert every row carries `id`, `type: "yoga"|"dosha"`, `nameKey`, `traditionKey`, `status`, `rules[]`, `cancellationRules[]`, `mitigationRules[]`, `houseThemes`, `expressionKeys`.
- **Expected:** Phase-1 exactly `shaniMangala` (`type: "yoga"`, `status: "active"`) + `manglik` (`type: "dosha"`, `status: "pending-domain"`). No other entries. No per-yoga booleans outside the catalog.
- **Edge cases:** `pending-domain` entries are listed but MUST NOT be evaluated (UT-YD-080); removing rows later must not crash stored snapshots (UT-YD-009).

### UT-YD-002: Catalog rows match the data-model seed table
- **Related story:** US-YD-001
- **Priority:** P0
- **Steps:** 1. Read the §Yoga/Dosha Rule Catalog seed table in `specs/business-analysis/data-model.md`. 2. Diff ids, types, traditions, rule refs (SM-01..SM-06, MK-01) against the catalog.
- **Expected:** 1:1 match — the catalog is the machine-readable form of the spec table.

### UT-YD-003: IDs and rule references are unique/consistent
- **Related story:** US-YD-001 AC1, US-YD-013
- **Priority:** P0
- **Steps:** 1. Collect all catalog `id`s. 2. Collect all `rules[].id` (SM-01..SM-06) via every active entry.
- **Expected:** Catalog ids unique; every rule id referenced in a `rules[]` array resolves to a function exported from `src/lib/yogaDosha/rules.ts`; no dangling refs.
- **Edge cases:** A rule id present in the spec table but not wired (e.g. SM-06 gated) — test must distinguish "registered" from "active".

### UT-YD-004: Bilingual name maps keyed by catalog id
- **Related story:** US-YD-001 AC2
- **Priority:** P1
- **Steps:** 1. Read `YogaDoshaNamesSi` / `YogaDoshaNamesEn`.
- **Expected:** Keys = catalog ids, values = localized names; every id resolves a non-empty name in both maps; maps are frozen.

### UT-YD-005: Catalog i18n integrity — every key resolves in EN and SI
- **Related story:** US-YD-001 AC2, US-YD-012 AC1
- **Priority:** P0
- **Steps:** 1. Collect all `nameKey`, `reasons[].reasonKey`, `houseThemes` keys, `expressionKeys`, cancellation `reasonKey`s, mitigation labels, `dashaNoteKey`, enum labels (`yogaStrength.*`, `cancellationStatus.*`, `tradition.*`). 2. fs-read `en.json` and `si.json`. 3. Resolve each key in both.
- **Expected:** Every key resolves a non-empty string in **both** locales (SI fully translated 2026-09-06; the EN-fallback convention was the interim state — a missing key, i.e. raw key leak, fails the test either way).
- **Edge cases:** Theme key without a `house{n}` segment (catalog drift) — fails per UT-YD-006.

### UT-YD-006: `house{n}` theme-key convention is a catalog invariant
- **Related story:** US-YD-003 AC1 (UX Q5)
- **Priority:** P1
- **Steps:** 1. Regex-scan every `houseThemes` key.
- **Expected:** `house{n}` ∈ {1..12}; the `n` maps to the house number the theme is registered under. The renderer relies on this convention for grouping (no machine-read house map).

### UT-YD-007: Additive extension is non-breaking
- **Related story:** US-YD-013 AC2
- **Priority:** P1
- **Steps:** 1. Snapshot `YOGA_DOSHA_CATALOG` ids and `computeYogaDoshas` output for a fixed fixture. 2. Simulate an addition (module-level clone with one extra `pending-domain` entry). 3. Re-run.
- **Expected:** Existing entries' outputs identical; only the new row appears.

### UT-YD-008: Enum values and labels match data-model
- **Related story:** US-YD-002 AC4, US-YD-004 AC2
- **Priority:** P0
- **Steps:** 1. Assert `YogaStrength` = {1 Very Strong, 2 Strong, 3 Moderate, 4 Weak}. 2. Assert `CancellationStatus` = {1 Not Cancelled, 2 Cancelled, 3 Mitigated}. 3. Assert i18n labels `yogaStrength.{1..4}` / `cancellationStatus.{1..3}` in both locales.
- **Expected:** Numeric range exactly as spec; lower number = stronger; labels never rendered raw.

### UT-YD-009: Unregistered catalog id in a stored snapshot is preserved for the "Not available" chip
- **Related story:** US-YD-001 edge case
- **Priority:** P1
- **Preconditions:** Stored entry carries `id: "removedYoga"` not in catalog.
- **Steps:** 1. Run `resolveYogas`.
- **Expected:** Entry survives normalization with its raw `id` (render shows neutral chip, UX Q8); warn-level log emitted; no crash.

### UT-YD-010: `buildChartFacts` extraction contract
- **Related story:** US-YD-002, US-YD-006
- **Priority:** P1
- **Steps:** 1. Feed a full `CalculationResult` (auto). 2. Assert extracted `planets[].aspects`, `houses[].lord`, `ascendantSign`, `source`, `day` derivation (Sun in 7th+ → day, shadBalaya `deriveDay` semantics), `thithi` fallback, `maranakaraka`.
- **Expected:** ChartFacts carries only stored fields; no ephemeris calls; `tradition` defaults `"MAIN_STREAM"`.

### Unit — relationships (`src/lib/yogaDosha/relationships.ts`)

### UT-YD-020: `areConjunct`
- **Related story:** US-YD-002, US-YD-006 AC1 (SM-01)
- **Priority:** P0
- **Steps:** 1. Same sign + same house + mutual stored 0° (conjunction) records → true. 2. Same sign + house but no stored 0° records (out of the per-planet orbs) → false. 3. Different houses/signs → false.
- **Expected:** Conjunction requires same sign AND same house AND both stored aspect lists carrying the partner at `aspectType 0` (records exist only within each planet's orb — Saturn 9°, Mars 8°), reusing the compute-time records exactly (US-YD-002). **Rev 9:** pure positional equality no longer proves an in-orb combination.

### UT-YD-021b: `areConjunct` out-of-orb regression (chart 6a74b291)
- **Related story:** US-YD-006 AC1 (SM-01), Rev 9 addendum (corrected 6a74b291)
- **Priority:** P0
- **Steps:** 1. Saturn 16.03° Vrishchika (house 7, Anuradha/17) + Mars 29.6° Vrishchika (house 7, Jyeshtha/18) `absoluteDegree` 226.03/239.6, `aspects: []`. 2. Assert `degreeGapBetween === 13.57` (test tolerance), `areConjunct === false`, SM-01/02/03 all untriggered.
- **Expected:** separation exceeds Saturn's 9° and Mars's 8° orbs → no stored 0° records → NOT conjunct → Shani Mangala absent; Agni Marutha present via `am04` (Saturn in Vrishchika, `SIGN_LORDS[8] === 3`).

### UT-YD-021: `isMutualSeventhHouse` — mod-12 wrap
- **Related story:** US-YD-002, US-YD-006 AC1 (SM-03)
- **Priority:** P0
- **Steps:** All gap-6 pairs both directions: (1,7), (7,1), (12,6), (6,12), (2,8)…
- **Expected:** `((a.house − b.house + 12) % 12) === 6`; gaps 5 and 7 → false.

### UT-YD-022: `is4_10`
- **Related story:** US-YD-006 AC1 (SM-04)
- **Priority:** P0
- **Steps:** Gaps 3 and 9 across wraps (1↔10, 10↔1, 4↔7, 12↔3).
- **Expected:** Only gaps {3, 9} true; others false.

### UT-YD-023: `is2_12`
- **Related story:** US-YD-006 AC1, AC-edge (SM-06 tradition-gated)
- **Priority:** P1
- **Steps:** Gaps 1 and 11 (2↔3, 3↔2, 12↔1, 1↔12).
- **Expected:** Only gaps {1, 11} true.

### UT-YD-024: `isParivartana` — sign exchange, never conjunction
- **Related story:** US-YD-006 AC1/AC-edge (SM-05)
- **Priority:** P0
- **Steps:** 1. Saturn in Aries (lord Mars) + Mars in Capricorn (lord Saturn) → true. 2. Same-sign pair → false (conjunction path, not exchange). 3. Reads `houses[].lord` — no new static table.
- **Expected:** `isParivartana(a,b,houses)` true iff `a.sign === lord(b.sign) && b.sign === lord(a.sign)`; the engine reports SM-05 separately from SM-01.

### UT-YD-025: `isMutualDrishti` — stored aspects union
- **Related story:** US-YD-002, US-YD-006 AC1 (SM-02)
- **Priority:** P0
- **Steps:** 1. Both `a.aspects` contains `b.name` AND `b.aspects` contains `a.name` → true. 2. One direction only → false. 3. Empty aspect arrays → false. 4. Auxiliary: aspect `degreeGap`/`aspectType` not required for the boolean.
- **Expected:** Reuses the persisted per-planet aspect lists exactly (identical for auto and manual) — no new aspect math (`a.aspects`/`b.aspects` both checked; aspectType irrelevant to SM-02, relevant only to SM-04's special set).

### Unit — Shani–Mangala rules (`src/lib/yogaDosha/rules.ts`)

### UT-YD-040: SM-01 conjunction
- **Related story:** US-YD-006 AC1
- **Priority:** P0
- **Preconditions:** ChartFacts with Saturn(7) and Mars(3) same whole-sign house.
- **Steps:** 1. Run the SM-01 rule function.
- **Expected:** `{ triggered: true, strength: 1, reasons: [{ rule: "SM-01", reasonKey: "yoga.shaniMangala.rule.sm01", params: { planet: 7, otherPlanet: 3, sign, house } }] }`.
- **Edge cases:** Same sign but different houses (different whole-sign houses impossible within one sign — assert invariant); retrograde/combustion flags do not affect formation.

### UT-YD-041: SM-02 7th-from-each-other needs the mutual opposition record
- **Related story:** US-YD-006 AC1, Rev 7 addendum (corrected 6a68e773)
- **Priority:** P0
- **Preconditions:** Gap-6 houses (e.g. Saturn 7 / Mars 1) AND **both** stored aspect lists contain the other at ≈180°.
- **Expected:** `triggered: true`, `strength: 2`, reason `sm02` with `{ gap: 6 }`.
- **Edge cases:** Positionally 7th but only ONE direction aspects (6a68e773 shape: Mars→Saturn 210 only) → **absent** (never Shani Mangala). Non-opposite (gap ≠ 6) → absent even with mutual records.

### UT-YD-042: SM-03 mutual 4-10
- **Related story:** US-YD-006 AC1 / AC2 (dedup note), `docs/agni-marutha-dosha.md` §7
- **Priority:** P0
- **Preconditions:** Mars 10th from Saturn AND Saturn 4th from Mars (gap 9) AND **both** directions present in the stored **90°/270° family**.
- **Expected:** `triggered: true`, `strength: 2`, reason `sm03` with `{ gap: 9 }`. Reverse orientation (Saturn 4th / Mars 1st) also fires.
- **Edge cases:** Gap-3 orientation (Mars 4th from Saturn) → absent even with mutual 90°; one-way 4-10 (only Saturn→Mars) → absent; trines/sextiles (120/60) and Mars's 8th drishti (210°) never satisfy SM-03; 7th pairs fire SM-02 not SM-03.

### UT-YD-043: SM-04 4/10 + mutual special aspect
- **Related story:** US-YD-006 AC1
- **Priority:** P1
- **Preconditions:** Gap 3/9 pair; both aspect lists contain the other with `aspectType ∈ {60, 90, 210, 240, 270, 300}`.
- **Expected:** `triggered: true`, `strength: 2`, reason `sm04`. Gap 3/9 without special mutual aspects → `null`.

### UT-YD-044: SM-05 parivartana
- **Related story:** US-YD-006 AC1/edge
- **Priority:** P0
- **Preconditions:** Sign-exchange pair (UT-YD-024 fixture).
- **Expected:** `triggered: true`, `strength: 1` (Very Strong — pending Architect OQ-1/domain; test asserts the implemented value ∈ {1, 2} and flags once domain confirms), reason `sm05`; SM-01 NOT triggered.

### UT-YD-045: SM-06 2/12 tradition-gated
- **Related story:** US-YD-006 AC1/edge, US-YD-002 edge case
- **Priority:** P0
- **Preconditions:** Gap 1/11 pair.
- **Steps:** 1. `facts.tradition = "MAIN_STREAM"`. 2. Run. 3. `facts.tradition` = a tradition registered in the entry's `traditionGate`.
- **Expected:** Under MAIN_STREAM → `null` (never evaluated); under the gating tradition → `strength: 3`, reason `sm06` with `{tradition}` param. No-op default keeps `MAIN_STREAM` charts free of 2/12 noise.

### UT-YD-046: Rule mutual exclusivity
- **Related story:** US-YD-006 AC1
- **Priority:** P1
- **Steps:** Conjunction fixture (SM-01) — assert SM-02/SM-03/SM-04/SM-05 do not also fire (SM-02 mutually exclusive by house; SM-05 requires different houses).
- **Expected:** Exactly the conjunction rule triggers; no duplicate/contradictory relationships.

### UT-YD-047: No rule satisfied
- **Related story:** US-YD-002 edge case
- **Priority:** P1
- **Steps:** Random non-related placement (e.g. Saturn in 2nd, Mars in 9th, no aspects).
- **Expected:** All SM rules return `null`/empty; entry `exists: false`; entry omitted from persisted output per US-YD-005.

### UT-YD-048: out-of-orb conjunction regression (chart 6a74b291)
- **Related story:** US-YD-006 AC1 (SM-01), Rev 9 addendum
- **Priority:** P0
- **Steps:** 1. Feed the real `6a74b291` facts — Saturn + Mars both Vrishchika/house 7, `absoluteDegree` 226.03 / 239.6, `aspects: []` (nakshatras 17/18). 2. Assert `degreeGapBetween → 13.57`, `areConjunct → false`, SM-01/02/03 untriggered.
- **Expected:** Shani Mangala `isPresent: false`; Agni Marutha `isPresent: true` with `agniMarutha.am04` in `rulesTriggered` (Saturn in Mars's own sign).

### Unit — candidate dosha rules

### UT-YD-070: Manglik `pending-domain` — MK-01 never evaluates
- **Related story:** US-YD-007 AC1/edge, US-YD-005 edge case
- **Priority:** P0
- **Preconditions:** `manglik` catalog row `status: "pending-domain"`; Mars in house 1/4/7/8/12 fixture.
- **Steps:** 1. Run `evaluateCatalog`.
- **Expected:** `doshas.doshas` is `[]` even though MK-01's house set is satisfied — registered but skipped (architect D9). If `rules.ts` has no MK-01 function yet, the catalog reference must be inert/optional.
- **Edge cases:** Once domain confirms (BA OQ-9) and status flips to `active`, UT-YD-071 spins up: Mars in each of 1/4/7/8/12 → present; Mars in 2/3/5/6/9/10/11 → absent; strength per confirmed mapping.

### Unit — rule engine (`src/lib/yogaDosha/ruleEngine.ts`)

### UT-YD-080: Only active catalog entries evaluated
- **Related story:** US-YD-001 AC1, US-YD-007
- **Priority:** P0
- **Steps:** 1. `evaluateCatalog(facts)` with the seed catalog.
- **Expected:** Yoga evaluations contain `shaniMangala` only; dosha evaluations empty (manglik pending). No hardcoded entry names in the calculation path.

### UT-YD-081: Structured output shape
- **Related story:** US-YD-002 AC1, US-YD-005 AC1
- **Priority:** P0
- **Steps:** 1. Evaluate a triggering fixture. 2. Validate against the `YogaEvaluation`/`DoshaEvaluation` interfaces.
- **Expected:** `{ id, exists, tradition, formation: { rulesTriggered[], primaryRule, strength, reasons[] }, context: { houseImpact[], planets[] }, interpretation: { themes[] }, mitigation[], cancellation: { status, factors[] }, finalAssessment: { severity, expressionKeys[] }, dashaActivation? }` — never `{ yoga: true }`.

### UT-YD-082: All satisfied rules + primary-rule ranking
- **Related story:** US-YD-002 AC2/AC3
- **Priority:** P0
- **Steps:** Multi-fire fixture (SM-01 + SM-03).
- **Expected:** `rulesTriggered = ["SM-01","SM-03"]` (all, order per catalog); `primaryRule = "SM-01"` (lowest strength = strongest; catalog order tiebreak); `formation.strength = 1` (primary's strength).
- **Edge cases:** Tie between two same-strength rules (SM-02/SM-03) → catalog-order tiebreak (UT-YD-042).

### UT-YD-083: Reason deduplication
- **Related story:** US-YD-006 AC2
- **Priority:** P1
- **Steps:** Fixture producing two rules with identical `reasonKey`+`params`.
- **Expected:** Single merged reason entry; user-facing explanation deduplicated ("occupy opposite houses and thereby mutually influence each other" style).

### UT-YD-084: Reasons carry numeric params only
- **Related story:** US-YD-002, business rule
- **Priority:** P1
- **Steps:** Inspect every `reasons[].params` from a triggering fixture.
- **Expected:** All values are numbers (planets 1–9, signs 1–12, houses 1–12, strengths); no display strings, no locale text, no free-form input.

### UT-YD-085: `context` derivation
- **Related story:** US-YD-003 AC1
- **Priority:** P1
- **Steps:** Fixture with involved houses 7 + 10.
- **Expected:** `context.houseImpact` = union of involved houses + registered relationship domain houses (7/10/4/8 as the seed registers them); `context.planets` = per involved planet `{ planet, house, sign, strength }` from stored facts.

### UT-YD-086: Interpretation themes mirror affected houses; no registered theme → empty
- **Related story:** US-YD-003 AC1/edge
- **Priority:** P1
- **Steps:** 1. Formed yoga with house 7 → assert `houseThemes[7]` keys copied to `interpretation.themes`. 2. House without registered themes.
- **Expected:** `themes` = registered keys only; no theme rows for unregistered houses (empty `themes` allowed; renderer omits the Result block, UI-YD-533).

### UT-YD-087: Determinism
- **Related story:** US-YD-002 business rule
- **Priority:** P1
- **Steps:** 1. Run `evaluateCatalog` twice on the same `ChartFacts`.
- **Expected:** Deep-equal outputs — no randomness, no date/time dependence, no I/O.

### UT-YD-088: Partial evaluation fails closed
- **Related story:** US-YD-005 edge case
- **Priority:** P1
- **Steps:** 1. Monkey-patch one rule function to throw. 2. Run engine.
- **Expected:** That entry fails closed (`exists: false`, logged warn); other entries evaluate normally; no exception propagates.

### UT-YD-089: Empty catalog
- **Related story:** US-YD-005 edge case
- **Priority:** P1
- **Steps:** 1. Evaluate with an empty `YOGA_DOSHA_CATALOG` (or all `pending-domain`).
- **Expected:** `{ yogas: [], doshas: [] }` — UI empty states handle it.

### UT-YD-090: Tradition-gated rules respect `facts.tradition`
- **Related story:** US-YD-002 edge case, US-YD-006 AC6
- **Priority:** P0
- **Steps:** Both traditions on the same 2/12 fixture (UT-YD-045).
- **Expected:** Only the tradition listed in the entry's gate evaluates SM-06; conflicting traditions never combined (per-factor `tradition` provenance preserved in output).

### Unit — cancellation & mitigation (`src/lib/yogaDosha/cancellation.ts`, engine steps 6–8)

### UT-YD-110: Three separate passes, three separate stored fields
- **Related story:** US-YD-004 AC1
- **Priority:** P0
- **Steps:** Fixture with formation + a registered cancellation + a mitigation factor.
- **Expected:** Stored output keeps `formation` / `mitigation[]` / `cancellation {status, factors[]}` distinct; pass order formation → mitigation → cancellation.

### UT-YD-111: Registered cancellation fires status 2 with provenance
- **Related story:** US-YD-004 AC2
- **Priority:** P0
- **Preconditions:** A `CancellationRule` registered for `shaniMangala` whose condition matches.
- **Steps:** 1. Evaluate. 2. Inspect `cancellation`.
- **Expected:** `status: 2`; `factors[]` carries `ruleId`, `reasonKey`, `planets`/`houses` involved, `tradition`. Factor's tradition never merged with another tradition's rule.

### UT-YD-112: Jupiter mitigation never cancels
- **Related story:** US-YD-004 AC1, US-YD-006 AC5
- **Priority:** P0
- **Preconditions:** JUPITER_ASPECT mitigation rule satisfied; no cancellation rule fires.
- **Steps:** 1. Evaluate. 2. Inspect `mitigation` and `cancellation`.
- **Expected:** `mitigation[]` has `{ ruleId, factor: "JUPITER_ASPECT", effect: "REDUCES_SEVERITY", target, tradition, confidence }`; `cancellation.status` stays **1** — a mitigation factor NEVER sets status 2.

### UT-YD-113: Mitigation factor shape
- **Related story:** US-YD-004 AC3
- **Priority:** P1
- **Steps:** Trigger OWN_SIGN and JUPITER_ASPECT mitigation.
- **Expected:** Every factor has `ruleId`, `factor`, `effect`, optional `target` (numeric planet), `tradition`, `confidence` (1..3).

### UT-YD-114: No registered cancellation → status 1 default
- **Related story:** US-YD-004 edge case
- **Priority:** P1
- **Steps:** Formed yoga, no cancellation rules registered for the tradition.
- **Expected:** `cancellation = { status: 1, factors: [] }` — not silently omitted.

### UT-YD-115: `finalAssessment` weighted synthesis
- **Related story:** US-YD-004 AC4
- **Priority:** P0
- **Steps:** Fixture with mitigation reducing severity.
- **Expected:** `finalAssessment.severity` = weighted outcome after formation → affliction → mitigation → cancellation → house relevance; clamped 1..4; when mitigation reduces, `cancellation.status` MAY become 3 at final assessment (still `exists: true`); `expressionKeys` non-empty for present entries.

### UT-YD-116: Expression keys selected per themes
- **Related story:** US-YD-003 AC2
- **Priority:** P2
- **Steps:** Fixture where active themes filter the entry's `expressionKeys`.
- **Expected:** Only keys aligned with the active house themes are emitted (e.g. `disciplinedAction` not `blockedAction` for a strong-Mars fixture).

### UT-YD-117: Strength variation changes expression, never existence
- **Related story:** US-YD-004 edge case, US-YD-006 edge case
- **Priority:** P1
- **Steps:** 1. Strong Mars / weak Saturn fixture. 2. Weak Mars / strong Saturn fixture. 3. Same formation rule satisfied both times.
- **Expected:** Existence unchanged (`exists: true`, same formation); `expressionKeys` differ (e.g. `pushThroughObstacles` vs `frustration`); "strong" never auto-cancels.

### UT-YD-118: Conflicting traditions never silently combined
- **Related story:** US-YD-004 AC2/edge, US-YD-013 edge case
- **Priority:** P1
- **Steps:** Two traditions each with a different cancellation rule for the same condition.
- **Expected:** Only rules registered under `facts.tradition` consulted; each emitted factor carries its own `tradition`; no silent union of conflicting outcomes.

### Unit — dasha activation

### UT-YD-130: Soft dasha note
- **Related story:** US-YD-006 AC7
- **Priority:** P1
- **Steps:** Triggered `shaniMangala` fixture.
- **Expected:** `dashaActivation = { planets: [7, 3], noteKey: "yoga.shaniMangala.dashaNote" }`; note copy ^ rendered in tendency language ("may become active during…") — never a timing prediction. `dashaActivation` absent when the entry defines none.

### Unit — legacy & manual paths (`src/lib/yogaDosha/index.ts`)

### UT-YD-150: Manual source — same rule functions, entered placements
- **Related story:** US-YD-002 AC5, US-YD-005 AC2
- **Priority:** P0
- **Preconditions:** `synthesizeCalculation` output with `source: "manual"`.
- **Steps:** 1. `buildChartFacts` + `computeYogaDoshas`.
- **Expected:** Identical evaluation contract; `manualHousePlacements` never overwritten; aspects read from the stored manual-planet aspect lists.

### UT-YD-151: Manual degree fallback path
- **Related story:** US-YD-002 AC5, data-model fallback note
- **Priority:** P1
- **Preconditions:** Manual chart WITHOUT `planetDegrees` for an involved planet.
- **Steps:** 1. Evaluate.
- **Expected:** Degree fallback deterministic — navamsa segment midpoint when the navamsa sign is recorded, else sign midpoint `15°`; the fallback feeds stored-aspect checks exactly as the aspect engine used it (2026-08-11 rule); no crash, no NaN degrees.

### UT-YD-152: `resolveYogas` stored-first + legacy recompute
- **Related story:** US-YD-005 AC4, Architect D5
- **Priority:** P0
- **Steps:** 1. Doc with `yogaDoshaVersion: 1` → stored array returned with normalization. 2. Doc without version, stale `yogas: []` → pure recompute from stored planets/houses (no ephemeris). 3. Doc with corrupt stored entry → warn + neutral "not available" per entry.
- **Expected:** Stored-first; legacy recompute equals `computeYogaDoshas`; corrupt never crashes.

### UT-YD-153: `resolveDoshas` stored-first + legacy recompute
- **Related story:** US-YD-005 AC4/AC5
- **Priority:** P0
- **Steps:** 1. Versioned doc with structured doshas. 2. Legacy `doshas: { doshas: [] }`. 3. Legacy flat-string dosha entry.
- **Expected:** Returns `{ doshas: DoshaEvaluation[] }`; legacy flat strings normalized at read (id/converted fields, `isPresent` preserved); `exists: false` entries not surfaced as tags.

### UT-YD-155: Schema-invariant validator shared by golden tests
- **Related story:** US-YD-005 AC1, Architect §Verification 4
- **Priority:** P0
- **Steps:** 1. Export/relocate a `validateYogaDoshaShape(entry)` helper (or share an assertion block). 2. Run over engine + resolver outputs.
- **Expected:** `formation.rulesTriggered` non-empty for `exists:true`; `formation.strength ∈ 1..4`; `cancellation.status ∈ 1..3`; no `exists:false` entries persisted; all enum params integers in range.

### Integration

### IT-YD-200: Auto calculation emits the structured fields
- **Related story:** US-YD-005 AC1
- **Priority:** P0
- **Preconditions:** `calculateHoroscope(baseData)`.
- **Steps:** 1. Run. 2. Inspect `result.yogas`, `result.doshas.doshas`, `result.yogaDoshaVersion`.
- **Expected:** `yogas` valid `YogaEvaluation[]`; `yogaDoshaVersion === 1`; persisted automatically via `...calculated` spread (mirrors Bhava Suchika — no bespoke persist code).

### IT-YD-201: Golden fixture matches stored shape (era-stamped)
- **Related story:** US-YD-005 AC1, Architect §Verification 4
- **Priority:** P0
- **Preconditions:** Generator test writes `fixtures/yoga-dosha-default-2026-09.json` on first run (era-stamp `_comment`); subsequent runs compare.
- **Steps:** 1. `calculateHoroscope(baseData)`. 2. Compare `ascendant`, `planets[].name/sign/house/aspects`, `yogas`, `doshas.doshas` against the fixture.
- **Expected:** Exact match after freeze; regenerate deliberately only when domain confirms OQs (this is the loud-failure guard that defaults change again — Aspect/Shad Bala regeneration precedent). **Do not freeze until domain OQs resolve** — invariant checks (IT-YD-200/202) are the gate in the meantime.

### IT-YD-202: Manual synthesis golden equivalence
- **Related story:** US-YD-002 AC5, Architect §Verification 4
- **Priority:** P0
- **Preconditions:** Manual chart built from the golden horoscope's placements (`synthesizeCalculation` from the fixture's houses/planets/lagna).
- **Steps:** 1. Resolve to `ChartFacts`. 2. Evaluate.
- **Expected:** Same `rulesTriggered`/`primaryRule`/`strength` as the auto golden where stored placements match; flag if stored aspect lists legitimately differ (degree-arm differences) — equivalence assert targets rule outcomes, not byte-identical aspect arrays.

### IT-YD-203: Recalculation job — zero changes, spread recomputes
- **Related story:** US-YD-005 AC3
- **Priority:** P0
- **Preconditions:** Existing `recalculationJob.test.ts` style mocks.
- **Steps:** 1. Run one recalculation over a stored doc. 2. Assert new fields present post-recalc and `yogaDoshaVersion: 1`.
- **Expected:** No `mergeYogaDoshas` needed (no overrides exist — unlike `mergeShadBalaya`); manual placements and Shad Bala overrides untouched.

### IT-YD-204: POST persist via spreads (both sources)
- **Related story:** US-YD-005 AC1/AC2
- **Priority:** P1
- **Steps:** 1. `POST /api/horoscope` (auto). 2. `POST /api/horoscope/manual`.
- **Expected:** Persisted `CalculatedDetails` carries `yogas`/`doshas`/`yogaDoshaVersion`; both ride `...calculated`/`...synth` only.

### IT-YD-205: GET /api/horoscope/:id additive fields (read-only)
- **Related story:** US-YD-008 AC5
- **Priority:** P0
- **Steps:** 1. GET own private, public, share-token.
- **Expected:** `calculatedDetails.yogas`/`doshas`/`yogaDoshaVersion` present and structured for all three (viewability gates unchanged); no edit affordances in payload (no new mutation routes exist).

### IT-YD-206: Legacy doc read path
- **Related story:** US-YD-005 AC4
- **Priority:** P1
- **Steps:** 1. Seed a doc with `$unset` `yogaDoshaVersion` + stale `yogas: []`. 2. GET + render through `resolveYogas`.
- **Expected:** No migration at read; render-time recompute populates; next full recalc upgrades the doc (version appears).

### Search (SR)

### SR-YD-300: EN text content — catalog names in the Yogas sentence
- **Related story:** US-YD-011 AC1
- **Priority:** P0
- **Preconditions:** `calculateHoroscope(baseData)` output with ≥1 yoga; `generateTextContent(calc, "en")`.
- **Steps:** 1. Run text generation.
- **Expected:** `"Yogas: <YogaDoshaNamesEn[shaniMangala]>, …."` — a catalog name per stored entry, never the raw `id`, never `undefined`.

### SR-YD-301: SI text content — same, in Sinhala
- **Related story:** US-YD-011 AC1, US-YD-012 edge case
- **Priority:** P0
- **Steps:** 1. `generateTextContent(calc, "si")`.
- **Expected:** `"යෝග: ශනි-කුජ යෝග, …."` via `YogaDoshaNamesSi`.

### SR-YD-302: Legacy string-name fallback
- **Related story:** US-YD-011 AC1
- **Priority:** P0
- **Preconditions:** Pre-feature `CalculatedDetails` with `yogas: [{ name: "Shani Mangala Yoga" }]` (string, no `id`).
- **Steps:** 1. Generate EN + SI text.
- **Expected:** Legacy sentence preserves the stored string (no `undefined`, no drop). Dual read `(id.id) ?? (name)` — never regresses pre-feature docs.

### SR-YD-303: Doshas text — `isPresent` filtering unchanged
- **Related story:** US-YD-011 AC1
- **Priority:** P0
- **Preconditions:** Mixed present/absent dosha entries (`isPresent` true/false).
- **Steps:** 1. Generate text.
- **Expected:** Only `isPresent: true` entries named (`"Doshas: …."`); all absent → `"No doshas present."`.

### SR-YD-304: Yoga entries without resolvable names
- **Related story:** US-YD-011 AC1/edge
- **Priority:** P1
- **Steps:** 1. Stored yoga with `id` present but catalog name missing (removed entry) + 1 resolvable.
- **Expected:** Count-based fallback sentence (`"2 yoga formations present."` style) when no names resolve; empty/redundant names skipped.

### SR-YD-310: `YOGA_DOSHA_NAME_WORDS` joins the vocabulary
- **Related story:** US-YD-011 AC3
- **Priority:** P1
- **Steps:** 1. Assert `YOGA_DOSHA_NAME_WORDS` exported from `vocabulary.ts` (SI + EN). 2. Assert the words merge into `SEARCH_VOCABULARY` (union, deduped, no fragments).
- **Expected:** Suggestions can include catalog names in both languages; existing `SINHALA_YOGA`/`ENGLISH_YOGA`/`DOSHA_WORDS` triggers untouched.

### SR-YD-311: Suggestions surface catalog names
- **Related story:** US-YD-011 AC3
- **Priority:** P2
- **Steps:** 1. Hit the suggestions path with "ශනි"/"shani".
- **Expected:** Catalog-name vocabulary entries are suggestible (word pool inclusion only — no embedding changes in phase 1).

### SR-YD-320: Specific-name query — SI "ශනි-කුජ යෝග"
- **Related story:** US-YD-011 AC3
- **Priority:** P0
- **Preconditions:** Route test skeleton (`search-bhava-suchika.test.ts` mocks); `CalculatedDetails.findOne` returns a doc with `yogas: [{ id: "shaniMangala", … }]`.
- **Steps:** 1. `POST /api/search` body `{ query: "ශනි-කුජ යෝග" }`.
- **Expected:** The stored `shaniMangala` horoscope surfaces; `queryUnderstanding.exactMatch` contains the generic **yoga-catalog-id** condition (catalog-driven — no hardcoded id in the route); score reflects the exact match.

### SR-YD-321: Specific-name query — EN "shani mangala" + dosha id
- **Related story:** US-YD-011 AC3
- **Priority:** P0
- **Steps:** 1. Query `"shani mangala"` and a dosha-name query (`"මංගල දෝෂය"`) against a dosha doc.
- **Expected:** Yoga-id and dosha-id conditions respectively; names parse in both languages.

### SR-YD-322: Existing overall-yoga/dosha keyword scoring unchanged
- **Related story:** US-YD-011 (compatibility), RE
- **Priority:** P0
- **Steps:** 1. Query `"yoga"`/`"දෝෂ"` against triggers.
- **Expected:** Pre-existing `yoga_present=n_yogas` / `dosha=<name>` conditions still emitted (route lines 921-965 semantics preserved); no regression to the generic keyword path.

### SR-YD-323: Name collision / parsing precedence
- **Related story:** US-YD-011 edge case
- **Priority:** P1
- **Steps:** 1. `"parivartana"` query. 2. Query where a yoga-name word could also parse as a planet/sign alias.
- **Expected:** Unambiguous parse — catalog-name matching takes precedence where defined; a planet/sign keyword query mentioning the same word still resolves its existing conditions. Precedence decision documented by QA + Developer (open until implementation).

### SR-YD-324: Legacy snapshot without struct `id` skipped + logged
- **Related story:** US-YD-011 edge case
- **Priority:** P1
- **Preconditions:** Stored `yogas: [{ name: "Shani Mangala", … }]` (no `id`) + a `yogaId`-typed query.
- **Steps:** 1. Run route.
- **Expected:** Entry skipped by the catalog-id filter (can't match), warn-logged, no crash; result still returns (possibly via keyword path). `isPresent` dosha filtering unchanged.

### SR-YD-325: Privacy filter with specific-name queries
- **Related story:** US-YD-011, Search privacy
- **Priority:** P0
- **Steps:** 1. Non-owner session queries the exact yoga name; DB has the private horoscope.
- **Expected:** Not surfaced — `$or: [{ "owner.id": user }, { isPublic: true }]` applied before the yoga/dosha exact-condition filter; no data leak to app memory for non-owners.

### SR-YD-330: Result cards — Yogas/Doshas sections keep `isPresent` behavior
- **Related story:** US-YD-011 AC2
- **Priority:** P0
- **Steps:** 1. Render search results (or RTL suite) with structured + legacy docs.
- **Expected:** `isPresent` filtering unchanged; names resolve via catalog with legacy fallback; severity renders `yogaStrength.*` label, not the raw number; card layout untouched (US-YD-011 AC2; detail-view separation does NOT apply to cards this phase).

### SR-YD-331: Card dosha section with cancelled/mitigated entries
- **Related story:** US-YD-011 AC2
- **Priority:** P1
- **Steps:** 1. Dosha doc with `isPresent: true, cancellation.status: 2`.
- **Expected:** Card still lists it (`isPresent` governs cards); severity label correct; no cancellation mention required on cards this phase (unchanged behavior).

### SR-YD-332: CSV export — Yogas/Doshas columns resolve catalog names
- **Related story:** US-YD-011 AC2
- **Priority:** P1
- **Preconditions:** Export route test; `pageResults` with structured entries.
- **Steps:** 1. Call export.
- **Expected:** `"Yogas"`/`"Doshas"` CSV cells list catalog-resolved names (`Sem; `-joined), severity not included at cell level unless implemented; legacy string docs keep their stored comma lists (dual read).

### SR-YD-333: Export legacy fallback
- **Related story:** US-YD-011 AC2
- **Priority:** P1
- **Steps:** 1. Legacy `yogas: [{ name: … }]` docs through export.
- **Expected:** Old behavior preserved (`y.name` read).

### Component / UI (RTL + jsdom, `.test.tsx`)

### UI-YD-500: Section mount point — dedicated `yoga-doshas` tab (rev 2), between Dashas and Metadata
- **Related story:** US-YD-008 AC1, UX Q1 (rev 2 — engineer direction 2026-09-06: dedicated tab, supersedes rev 1 Calculations-tab placement)
- **Priority:** P1
- **Preconditions:** Mounted horoscope detail page (or a section-level render with the page's DOM order stubbed).
- **Steps:** 1. Render the horoscope detail page. 2. Open the `යෝග සහ දෝෂ / Yogas & Doshas` tab (label key `horoscope.yogaDoshas`, `id: "yoga-doshas"`, positioned between `dashas` and `metadata` in the tab strip).
- **Expected:** `#yogas-doshas` section renders at the top of the dedicated tab's surface; the Calculations tab is unchanged (no section between the Lagna card and the Houses section); `aria-labelledby` on the section title; single card `bg-white rounded-lg border p-4`.

### UI-YD-501: Two separated groups
- **Related story:** US-YD-008 AC1, US-YD-010 (independent groups)
- **Priority:** P0
- **Steps:** 1. Render with 1 yoga + 1 dosha.
- **Expected:** Distinct `යෝග`/`Yogas` and `දෝෂ`/`Doshas` group labels, distinct accent treatments, separate `role="group"` wrappers, never a merged "Yogas & Doshas" list on the detail view.

### UI-YD-502: `(n)` count badge semantics
- **Related story:** US-YD-008 AC1, UX Q2
- **Priority:** P1
- **Steps:** 1. Group with 2 present + 1 cancelled + 1 mitigated. 2. Group with 0 entries.
- **Expected:** Count badge = number of rendered tag chips **including cancelled and mitigated** (UX assumption — count = tags the student sees; QA locks this until BA confirms); hidden when 0. Unknown-ID chips follow the same count rule (they are rendered chips).

### UI-YD-503: Independent per-group empty states
- **Related story:** US-YD-008 AC4, US-YD-010 edge case
- **Priority:** P0
- **Steps:** 1. Yoga present, doshas empty (launch state — Manglik pending-domain).
- **Expected:** Yoga group renders tags + count; Dosha group renders `දෝෂ නොමැත`/`No doshas` with `role="status"`; no cross-group interference; legacy-evaluated-empty and computed-empty render identically (UX Q4).

### UI-YD-504: Only `exists: true` entries tag
- **Related story:** US-YD-008 AC3
- **Priority:** P0
- **Steps:** 1. Evaluation array containing an `exists:false` entry (parse-defensive) + present entries.
- **Expected:** `exists:false` never renders a tag.

### UI-YD-505: Manual-source render
- **Related story:** US-YD-008 edge case
- **Priority:** P1
- **Steps:** 1. Manual-source evaluations (same fixture).
- **Expected:** Identical section/tag/panel rendering as auto; empty rules apply the same way.

### UI-YD-510: Present tag state
- **Related story:** US-YD-008 AC2
- **Priority:** P0
- **Steps:** 1. Render present entry.
- **Expected:** Indigo status dot (yoga) / amber dot (dosha) (`aria-hidden`), name, `yogaStrength.*` pill from **`finalAssessment.severity`** (UX Q3 — tag pill shows final severity; panel shows formation strength via the primary-rule sentence).

### UI-YD-511: Cancelled tag state
- **Related story:** US-YD-008 AC2
- **Priority:** P0
- **Steps:** 1. Render `cancellation.status === 2`.
- **Expected:** Gray dot + struck-through name (`line-through`) + `Cancelled` badge — strike AND badge AND the word in `aria-label` (three channels, color never alone); pill still shows pre-cancellation severity; tag remains a button (panel explains why).

### UI-YD-512: Mitigated tag state
- **Related story:** US-YD-010 AC1, US-YD-004
- **Priority:** P1
- **Steps:** 1. Render `cancellation.status === 3`.
- **Expected:** Amber dot + normal name + `Reduced` badge; button expands to the mitigation block + status-3 line.

### UI-YD-513: Unknown / legacy catalog id chip
- **Related story:** US-YD-001 edge case
- **Priority:** P1
- **Steps:** 1. Render entry with `id` not in catalog.
- **Expected:** Dashed-gray non-interactive chip (`<span>`, never a focus stop), raw `id` visible, `Not available` badge + `aria-label` `{id}, not available`, warn logged (UX Q8: raw id passes through — never dropped).

### UI-YD-514: Severity pill resolves labels, not raw numbers
- **Related story:** US-YD-010 AC2
- **Priority:** P0
- **Steps:** 1. Severity values 1..4.
- **Expected:** Rendered `yogaStrength.*` labels per locale (e.g. `ප්‍රබල`/`Strong`); no raw digit anywhere in the pill.

### UI-YD-520: Tag disclosure contract
- **Related story:** US-YD-009 AC4
- **Priority:** P0
- **Steps:** 1. Inspect tag markup.
- **Expected:** `<button type="button" aria-expanded aria-controls="yd-panel-{id}">`; panel `<section id="yd-panel-{id}" role="region" aria-labelledby="yd-tag-{id}" hidden>` when closed.

### UI-YD-521: Multi-open disclosure
- **Related story:** US-YD-009 AC4, UX Q2
- **Priority:** P0
- **Steps:** 1. Open tag A. 2. Open tag B. 3. Click A again.
- **Expected:** A stays open when B opens (multi-open); clicking A collapses only A; B unaffected; no arrow-key roving needed (all buttons in tab order).

### UI-YD-522: Focus retention after toggle
- **Related story:** US-YD-009 AC4, UX Q5
- **Priority:** P1
- **Steps:** 1. Click a tag. 2. Assert `document.activeElement`.
- **Expected:** Focus stays on the tag button after both open and close.

### UI-YD-523: `openIds` reset on horoscope change
- **Related story:** US-YD-009, UX Q2
- **Priority:** P1
- **Steps:** 1. Open panels. 2. Switch `params.id`.
- **Expected:** All panels collapse; no stale panel from the previous horoscope (no cross-horoscope bleed).

### UI-YD-530: Panel block order
- **Related story:** US-YD-009 AC1, US-YD-010 AC1
- **Priority:** P0
- **Steps:** 1. Expand a fully-populated present entry.
- **Expected:** Fixed order: 0 Header (name · tradition provenance · severity pill · status badge) → 1 Why it forms → 2 Result → 3 How it expresses → 4 Cancellation → 5 Mitigation → 6 Dasha activation. Blocks 2/3/6 omitted when their data is empty.

### UI-YD-531: Why block — primary headline + every satisfied rule
- **Related story:** US-YD-009 AC1
- **Priority:** P0
- **Preconditions:** Entry with `formation.reasons` = [SM-01, SM-03], `primaryRule: "SM-01"`.
- **Steps:** 1. Expand.
- **Expected:** Headline sentence = the reason whose `rule === primaryRule` (bold); then one muted line per **every** satisfied rule — SM-02/SM-03 co-fire both render their own lines.

### UI-YD-532: Numerics resolved per locale
- **Related story:** US-YD-009 AC3, US-YD-012 AC4
- **Priority:** P0
- **Steps:** 1. Expand entry whose reasons carry `planet/sign/house` params. 2. Render in both locales.
- **Expected:** `astrology.planetNames.{n}`, `astrology.signNames.{n}` (locative where the message calls for it), localized house ordinal (`7 වන භාවය` / `house 7`); no raw numbers in any rendered param slot.

### UI-YD-533: Result block — per-house grouping, omitted when empty
- **Related story:** US-YD-009 AC1/edge, UX Q4
- **Priority:** P0
- **Steps:** 1. Entry with house-7 + house-10 themes. 2. Entry with `themes: []`.
- **Expected:** Themes group under `{house} වන භාවය`/`{house} house` headings (from the `house{n}` key segment); NO empty "Result" heading when themes are empty — the formation reason above already answers it (BA edge case reading confirmed with UX).

### UI-YD-534: Cancellation block always renders a status line
- **Related story:** US-YD-009 AC1, US-YD-004
- **Priority:** P0
- **Steps:** 1. status 1, 2, 3 entries.
- **Expected:** status 1 → `Not cancelled` + hint; status 2 → `Cancelled by {ruleId}` + one line per factor (condition, involved planets/houses, tradition); status 3 → `Not cancelled — reduced by mitigating factors` + pointer to Mitigation. The question is never silently skipped.

### UI-YD-535: Cancelled panel specifics
- **Related story:** US-YD-009 AC1, US-YD-004 AC2
- **Priority:** P1
- **Steps:** 1. Expand a cancelled tag.
- **Expected:** Cancellation block lists `ruleId`/reason/planets/houses/tradition per factor; Mitigation block conditionally absent.

### UI-YD-536: Mitigation subsection distinct from cancellation
- **Related story:** US-YD-009 edge case, US-YD-004 AC1
- **Priority:** P1
- **Steps:** 1. Entry with `mitigation.length > 0`, status 1. 2. Entry with status 3.
- **Expected:** Mitigation rendered when `mitigation.length > 0` **or** `status === 3`; separate heading, tinted left border, "reduces/does not cancel" note line — never visually merged into Cancellation.

### UI-YD-537: Dasha note soft activation
- **Related story:** US-YD-006 AC7, US-YD-009
- **Priority:** P1
- **Steps:** 1. Expand entry with `dashaActivation`.
- **Expected:** Muted footnote with `{planets}` resolved (e.g. "May become active during Saturn/Mars dasha periods"); omitted when absent; never phrased as a timing prediction.

### UI-YD-538: Tendency language enforced in rendered copy
- **Related story:** US-YD-009 AC2, US-YD-003 AC4
- **Priority:** P1
- **Steps:** 1. Grep rendered strings (i18n message values) for deterministic-prediction patterns (`will have`, `will marry`, `will die`, `will suffer`, accident/injury claims).
- **Expected:** No deterministic predictions anywhere in `yoga.*`/`dosha.*`/`yogaDosha.*` message values; all tendency ("may", "tends to", "is a tendency").

### UI-YD-540: Legacy fallback — populated first paint, no flicker
- **Related story:** US-YD-005 AC4, UX Flow 4
- **Priority:** P0
- **Preconditions:** Legacy page props (`yogaDoshaVersion` absent, stale `[]`/flat strings).
- **Steps:** 1. Render page with `resolveYogas`/`resolveDoshas` wired.
- **Expected:** First paint populated when any rule fires (pure recompute at render — no loading state, no flash of empty then populated).

### UI-YD-541: Read-only on own/public/share views
- **Related story:** US-YD-008 AC5
- **Priority:** P0
- **Steps:** 1. Render the three viewer types.
- **Expected:** Identical content; no edit/override affordances anywhere (no PATCH route exists for this feature).

### UI-YD-550: Sinhala wrap at 360px
- **Related story:** US-YD-008 edge case, UX Q10
- **Priority:** P1
- **Steps:** 1. jsdom/viewport 360px (or manual at 360px). 2. Render group label + 4 wrapped tags + badges longest SI names (`ශනි-කුජ යෝග · ඉතා ප්‍රබල`).
- **Expected:** Tags wrap whole-word (no `max-width` truncation, no horizontal scroll); group label chip keeps 30% extra padding; panels full-width; nothing overflows the card.

### UI-YD-551: Mobile tap targets
- **Related story:** UX Q5
- **Priority:** P2
- **Steps:** 1. Measure tag button heights at mobile breakpoint.
- **Expected:** ≥ 40px (44px preferred).

### UI-YD-552: Locale switch re-renders all surfaces
- **Related story:** US-YD-012 AC3
- **Priority:** P1
- **Steps:** 1. Toggle `useI18n()` locale while panels open.
- **Expected:** Group labels, tag names, pills, badges, panel blocks all re-render in the new locale via `router.refresh()` (existing hook behavior).

### Accessibility (AX)

### AX-YD-600: Disclosure button/region contract
- **Related story:** US-YD-009 AC4
- **Priority:** P0
- **Steps:** 1. Inspect/query DOM.
- **Expected:** Every tag is a real `<button>` with `aria-expanded` + `aria-controls`; panel `role="region"` + `aria-labelledby`; no interactive content inside `hidden` panels.

### AX-YD-601: Group semantics
- **Related story:** US-YD-008
- **Priority:** P1
- **Steps:** 1. Inspect group wrappers.
- **Expected:** `role="group"` with `aria-label` = `yogaDosha.groupYogaAria`/`groupDoshaAria`.

### AX-YD-602: Empty states announced
- **Related story:** US-YD-008 AC4
- **Priority:** P1
- **Steps:** 1. Render empty group. 2. Assert `role="status"`.
- **Expected:** Screen readers announce "යෝග නොමැත"/"No yogas" on first paint.

### AX-YD-603: Tag `aria-label` composes name + strength + status
- **Related story:** US-YD-008 AC2, UX Q3
- **Priority:** P0
- **Steps:** 1. Present tag. 2. Cancelled tag. 3. Mitigated tag.
- **Expected:** `"{name}, {strength}, {status}"` with the status word localized — state conveyed beyond color/strike alone.

### AX-YD-604: Screen-reader output of a cancelled tag (UX Q12)
- **Related story:** US-YD-008 AC2
- **Priority:** P1
- **Steps:** 1. NVDA/JAWS smoke on a cancelled tag (manual) + RTL assertion of `aria-label`.
- **Expected:** The word "cancelled" is announced; the `line-through` is not read as an artifact; the panel region is reachable immediately after its button (focus moves tag → region content in DOM order).

### AX-YD-605: Unknown chip never a focus stop
- **Related story:** US-YD-001 edge case
- **Priority:** P1
- **Steps:** 1. Tab through a group with an unknown-id chip.
- **Expected:** Chip is a plain `<span>` — skipped by tab order; `aria-label` still communicates `{id}, not available`.

### AX-YD-606: Visible focus ring
- **Related story:** UX §Accessibility
- **Priority:** P1
- **Steps:** 1. Focus a tag via keyboard.
- **Expected:** 2px indigo offset ring visible on focus-visible.

### AX-YD-607: Colour is never the only channel
- **Related story:** US-YD-008 AC2, WCAG 1.4.1
- **Priority:** P0
- **Steps:** 1. For each state assert ≥ 2 of: dot, badge word, strikethrough, aria-label word.
- **Expected:** Cancelled = strike + badge + word; mitigated = badge + word; present = no distinguishing channel needed (baseline) + pill label.

### AX-YD-608: Contrast
- **Related story:** UX §Accessibility
- **Priority:** P2
- **Steps:** 1. Compute contrast for indigo/amber tinted text and badges on white.
- **Expected:** Text ≥ 4.5:1; badges ≥ 4.5:1; non-text indicators ≥ 3:1 (WCAG AA).

### AX-YD-609: InfoGlyph tooltip accessibility
- **Related story:** UX §Accessibility
- **Priority:** P2
- **Steps:** 1. Focus/tap the section InfoGlyph.
- **Expected:** `aria-describedby` → `role="tooltip"`; keyboard reachable; Esc dismisses; `title` fallback; SI tooltip `max-w-[320px]`.

### Bilingual (BI)

### BI-YD-700: Message-key parity (both locales)
- **Related story:** US-YD-012 AC1
- **Priority:** P0
- **Steps:** 1. Diff `yogaDosha.*`, `yoga.*`, `dosha.*`, `yogaStrength.*`, `cancellationStatus.*`, `tradition.*` across `en.json` ↔ `si.json`.
- **Expected:** Identical key sets — no yoga/dosha string in only one locale (same fs test as UT-YD-005, run as a standalone BI guard).

### BI-YD-701: No hardcoded strings in components
- **Related story:** US-YD-012 AC2
- **Priority:** P0
- **Steps:** 1. Grep `src/components/yogaDosha/**` and the mounted page section for Sinhala/English literals.
- **Expected:** No inline display strings; every name/reason/theme/cancellation/severity/empty-state resolves via i18n keys.

### BI-YD-702: Enum labels reused
- **Related story:** US-YD-012 AC4
- **Priority:** P1
- **Steps:** 1. Render across locales.
- **Expected:** Planets/signs/houses/strengths use the existing `astrology.planetNames`/`signNames`/`signNamesLocative` mappings; `yogaStrength.*`/`cancellationStatus.*`/`tradition.*` are the only new label namespaces.

### BI-YD-703: SI-pending → English fallback, never key leak
- **Related story:** US-YD-012 edge case
- **Priority:** P1
- **Steps:** 1. Render SI with a key whose SI value is marked pending.
- **Expected:** English value renders (not the raw key). The identity of that fallback string is visible to the user; the domain can replace it later without code change.

### BI-YD-704: Locale switch re-render
- **Related story:** US-YD-012 AC3
- **Priority:** P1
- **Steps:** 1. Open panels, switch locale.
- **Expected:** All open panels + tags re-render immediately in the new locale (UI-YD-552 at the integration level).

### BI-YD-705: Search text content SI + EN catalog names
- **Related story:** US-YD-011 AC1, US-YD-012 edge case
- **Priority:** P1
- **Steps:** 1. `getTextForBothLanguages` on one doc.
- **Expected:** Each language lists catalog names in its own language (SI sentence uses `YogaDoshaNamesSi`, EN uses `YogaDoshaNamesEn`).

### E2E / Manual (no Playwright installed — see §What cannot be tested)

### E2E-YD-800: Auto horoscope end-to-end
- **Related story:** US-YD-006/008/009/010/012
- **Priority:** P1
- **Preconditions:** Dev server + seeded DB with the golden auto horoscope.
- **Steps:** 1. Open Yoga & Doshas tab → expand every tag; 3. toggle locale; 4. search by name; 5. export CSV.
- **Expected:** Section between Lagna card and Houses; panels show all six blocks; multi-open works; SI/EN correct; search + export resolve catalog names.

### E2E-YD-801: Manual horoscope same placements
- **Related story:** US-YD-002 AC5
- **Priority:** P1
- **Steps:** 1. Open the manual horoscope built from the golden placements.
- **Expected:** Same Yoga tags/panels as the auto horoscope (rule outcomes equivalent).

### E2E-YD-802: Legacy document upgrade path
- **Related story:** US-YD-005 AC4
- **Priority:** P1
- **Steps:** 1. Open a pre-feature doc (no version). 2. Trigger a settings recalculation.
- **Expected:** First paint populated without flicker; after recalc the doc carries `yogaDoshaVersion: 1` and the same tags.

### E2E-YD-803: Search manifest
- **Related story:** US-YD-011 AC3
- **Priority:** P1
- **Steps:** 1. Query `ශනි-කුජ යෝග`, `shani mangala`, `මංගල දෝෂය`, plain `yoga`/`දෝෂ`.
- **Expected:** Catalog-name queries surface matching horoscopes; keyword triggers unchanged; result cards + export correct.

### E2E-YD-804: Read-only on own/public/share + unknown-id doc
- **Related story:** US-YD-008 AC5, US-YD-001 edge
- **Priority:** P1
- **Steps:** 1. Open own, public, share link. 2. Open the unknown-id seeded doc.
- **Expected:** No edit affordances on any view; unknown chip renders dashed + Not available; no console crash (warn logged).

### E2E-YD-805: Mobile + Sinhala wrap
- **Related story:** UX Q5/Q10
- **Priority:** P2
- **Steps:** 1. 360px viewport, SI locale, 4 tags + badges.
- **Expected:** No horizontal scroll, no truncation; tap targets ≥ 40px; panels full-width.

### Regression (RE)

- **RE-YD-900:** `calculation.test.ts` existing goldens pass — new fields are additive only (`yogas` was `[]`; existing assertions on other fields unchanged). (US-YD-005)
- **RE-YD-901:** Existing search textContent tests pass — legacy `y.name` reads preserved via dual read. (US-YD-011)
- **RE-YD-902:** Existing search route tests pass with the extended `ExactCondition` union (type-safe; new conditions never shadow existing types). (US-YD-011)
- **RE-YD-903:** Export route legacy behavior unchanged. (US-YD-011)
- **RE-YD-904:** `recalculationJob` tests pass with **zero code changes** (spread carries the fields). (US-YD-005 AC3)
- **RE-YD-905:** `wargaKendara` / `shadBalaya` / `bhavaSuchika` suites pass — engine shares no state with `src/lib/yogaDosha/`. (framework)
- **RE-YD-906:** Shad Bala PATCH route never writes `yogas`/`doshas`/`yogaDoshaVersion` (no spread conflict). (US-YD-005)
- **RE-YD-907:** `pnpm build` / `tsc --noEmit` passes with the `unknown[]` → `YogaEvaluation[]`/`DoshaEvaluation[]` retype; no `any` introduced. (arch §Verification 1)

## Acceptance-Criteria Traceability

| User story | QA test IDs |
|-----------|-------------|
| US-YD-001 | UT-YD-001..009, UI-YD-513, AX-YD-605, BI-YD-700, E2E-YD-804 |
| US-YD-002 | UT-YD-010/020..025/040..047/080/082/084/087/090, IT-YD-202, E2E-YD-801 |
| US-YD-003 | UT-YD-006/085/086/116, UI-YD-533/538 |
| US-YD-004 | UT-YD-008/110..118, UI-YD-511/512/534/535/536 |
| US-YD-005 | UT-YD-081/088/089/152..155, IT-YD-200..206, UI-YD-540, E2E-YD-800/802, RE-YD-900..907 |
| US-YD-006 | UT-YD-020..025/040..047/090/130, UI-YD-530/531/537, E2E-YD-800 |
| US-YD-007 | UT-YD-001/070/080, UI-YD-503, BI-YD-703, E2E-YD-803 |
| US-YD-008 | IT-YD-205, UI-YD-500..505/510..514, AX-YD-601/602/603/607, E2E-YD-804 |
| US-YD-009 | UI-YD-520..538, AX-YD-600/603/604, E2E-YD-800 |
| US-YD-010 | UI-YD-512/514/530/534/535/536, BI-YD-702 |
| US-YD-011 | SR-YD-300..333, UI-YD-502, BI-YD-705, E2E-YD-803, RE-YD-901..903 |
| US-YD-012 | UT-YD-005, BI-YD-700..705, UI-YD-532/552, SR-YD-300/301 |
| US-YD-013 | UT-YD-003/007, BI-YD-700, RE-YD-907 |

## Regression Impact

- **Calculation pipeline** — `calculateHoroscope`/`synthesizeCalculation` gain fields via spreads; previously asserted empty arrays change. Any existing test asserting `yogas === []` breaks by design and must be updated (audit `calculation.test.ts`, `search-*` fixtures).
- **Search surfaces** — textContent/cards/export read paths change (dual read); route `ExactCondition` union extends.
- **Astrology types** — the `unknown[]` retype touches `textContent.ts` and `export/route.ts` compile sites; no runtime shape change for legacy bytes.
- **Recalculation job** — zero code change; output shape changes only (now includes the fields).
- **No shared state** with Shad Bala / Warga Kendara / Bhava Suchika — the new module is isolated.

## Automation

- **All unit/integration/search tests** live in `src/__tests__/yogaDosha.test.ts` (engine + catalog + relationships + legacy) + `src/__tests__/yogaDoshaSearch.test.ts` (textContent/vocabulary/route/export) — or per-file splits mirroring `bhavaSuchika.test.ts` + `search-bhava-suchika.test.ts`.
- **Component tests** `src/__tests__/yogaDoshaComponents.test.tsx` with per-file `/** @jest-environment jsdom */` (RTL 16.3.2 + jest-dom; testMatch already includes `.tsx`).
- **Golden fixture** `src/__tests__/fixtures/yoga-dosha-default-2026-09.json` + a generator guard.
- **i18n parity** fs-read guard (notepadCatalogs pattern).
- **Commands:**

```bash
npx jest src/__tests__/yogaDosha.test.ts      # engine/catalog/rules/legacy
npx jest src/__tests__/yogaDoshaSearch.test.ts # textContent/vocabulary/route/export
npx jest src/__tests__/yogaDoshaComponents.test.tsx
npx jest                                       # full suite (regression gates)
pnpm build                                     # retype/compile gate
```

## What Cannot Be Tested (flagged)

1. **Domain confirmations (block freezing the golden fixture):** Architect OQ-1 parivartana strength (1 vs 2); OQ-2 SM-02/SM-03 co-fire phrasing; OQ-3 2/12 gating tradition + strength; OQ-4/OQ-5 Manglik MK-01 + cancellation rules; OQ-6 SI translations (EN authoritative). Also BA OQs 1–12. Until resolved: invariant tests (IT-YD-200/202) gate; the era-stamped fixture is generated but marked `_comment` provisional.
2. **Golden fixture values** — the exact `rulesTriggered`/reasons for the 1990-06-15 chart can only be frozen after Developer implements + domain confirms; QA authors the generator + invariants now.
3. **Visual appearance** (tints, badge styling, strikethrough pixel look) — real visual regression needs Storybook + Chromatic (not installed); manual visual check scripted in E2E §.
4. **Real NVDA/JAWS output** — manual script only (RTL asserts `aria-label` composition, not SR rendering).
5. **E2E automation** — no Playwright/Cypress in `package.json` (verified) — **Developer/PM decision** to install for CI coverage; until then the E2E cases are executable manual scripts.
6. **RTL suite depth** — optional per repo precedent (notepad: "Component (optional)"); QA recommends requiring the tag-state matrix + disclosure tests (UI-YD-510..523) since they lock US-YD-008/009 acceptance.
7. **Legacy-DB equivalence** end-to-end — no seeded pre-feature DB in CI; automated proof is the unit-level legacy-shape fixture (UT-YD-152/153) + E2E-YD-802 against a seeded local doc.

## Open Questions Handed to Developer / PM

1. **ExactCondition naming** — architect says "generic `{ yogaId }` / `{ doshaId }`"; Developer picks `{ type: "yoga_id"; yogaId }` / `{ type: "dosha_id"; doshaId }` (or similar) — QA asserts catalog-driven, id-free route code, not the literal name.
2. **Name-collision precedence** (SR-YD-323) — the parsing precedence for catalog-name words vs planet/sign aliases is implementation-defined until Demo; QA expects a documented order.
3. **Multi-line rendering of cancelled reports** — panel factor lines can be long in SI; Developer must wrap (no truncation) per UX §Micro-interactions.
4. **Playwright acquisition** — E2E automation decision (Developer/PM).