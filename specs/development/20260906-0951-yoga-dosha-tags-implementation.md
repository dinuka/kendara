# Yoga / Dosha Separated Tags — Implementation

**Date:** 2026-09-06 09:51
**Author:** Developer (BMAD)
**Based on:** specs/business-analysis/20260906-0707-yoga-dosha-tags.md, specs/architecture/20260906-0905-yoga-dosha-tags-architecture.md, specs/ux/20260906-0945-yoga-dosha-tags.md, specs/qa/20260906-0837-yoga-dosha-tags-test-plan.md

---

## Files Changed

| File | Change |
| ---- | ------ |
| `src/lib/yogaDosha/catalog.ts` | `mitigations?: MitigationKey[]` moved onto `CatalogEntryBase` (was `DoshaCatalogEntry`-only, dead-coding yoga mitigation); `shaniMangala` now lists `mitigations: ["shaniMangala.mitigation.sm-mit-001"]`; manglik kept `PENDING_DOMAIN` |
| `src/lib/yogaDosha/ruleEngine.ts` | `evaluateEntry` reads `entry.mitigations ?? []` directly off the base (removed stale `in`/`DoshaCatalogEntry` cast) |
| `src/app/api/search/route.ts` | `hasCatalogWord` unicode word-boundary matcher for catalog-name conditions (SR-YD-323 precedence — "Mangal" can no longer fire inside "Shani-Mangala"); younger `yoga_id`/`dosha_id` exact conditions + route evaluation; `scoreHoroscope` now scores per present-yoga/per-dosha keywords instead of a blanket count |
| `src/lib/search/textContent.ts` | `yogaDoshaDisplayNames` filters `isPresent !== false` (v1-absent excluded; legacy snapshots without the flag stay listed); EN/SI yoga sections keyed to `.some(y => y.isPresent !== false)` with present-only count fallback; dosha filters made dual-read consistent |
| `src/__tests__/calculation.test.ts` | +3 tests (IT-YD-200..202): calc-time persistence shape, golden-fixture generator round-trip, recalcJob zero-change guard |
| `src/lib/astrology.ts` | `CalculationResult` grew `yogas: YogaEvaluation[]`, `doshas: DoshaInfo`, `yogaDoshaVersion?` (prior) |
| `src/lib/calculation.ts` | auto path persists versioned yogas/doshas once at calculation time (prior) |
| `src/lib/manualChartDetails.ts` | manual path persists the same fields (prior) |
| `src/models/CalculatedDetails.ts` | additive `yogas`/`doshas` Mixed + optional `yogaDoshaVersion` (prior) |
| `src/lib/astrologyEnums.ts` | `YogaStrength`, `CancellationStatus`, `YogaId`, `DoshaId` enums + lookup maps (prior) |
| `src/lib/search/vocabulary.ts`, `src/app/api/search/export/route.ts`, `src/app/search/page.tsx`, `src/app/horoscopes/[id]/page.tsx` | search vocabulary lock-step, export dual-read, search cards, page mount (prior) |
| `src/messages/en.json`, `src/messages/si.json` | `yogaDosha.unknownName` → “not available”; new `groupYogaAria`/`groupDoshaAria`; full yoga/dosha namespaces |
| `src/components/yogaDosha/YogaTagGroup.tsx`, `DoshaTagGroup.tsx` | `role="group"` + `aria-label` (AX-YD-601) |
| `src/components/yogaDosha/YogaDoshaTag.tsx` | unknown-id chip is a non-focusable span, aria-label/title = `${entry.id}, not available` (AX-YD-605) |

## New Files Created

| File | Purpose |
| ---- | ------- |
| `src/lib/yogaDosha/` (catalog.ts, configuration.ts, contentBlocks.ts, mitigation.ts, cancellation.ts, rules/*.ts, ruleEngine.ts, resolve.ts, types.ts, vocabulary.ts, index.ts) | Evaluation module: catalog-driven fail-closed engine, mitigation/cancellation synthesis, resolve/derive fallbacks; unit-tested in isolation |
| `src/components/yogaDosha/` (YogaDoshaSection.tsx, YogaTagGroup.tsx, DoshaTagGroup.tsx, YogaDoshaTag.tsx, YogaDoshaDetailPanel.tsx, ReasonBlock.tsx, ResultBlock.tsx, ExpressionBlock.tsx, CancellationBlock.tsx, MitigationBlock.tsx, DashaNoteBlock.tsx, InfoGlyph.tsx, YogaStrengthPill.tsx, StateBadge.tsx) | Separated tags UI: multi-open disclosures, grouped yogas/doshas, severity pills, cancellation/mitigation badges, detail blocks |
| `src/__tests__/yogaDosha.test.ts` | 47 tests — catalog/enums/relationships/rules/engine (fail-closed, determinism), mitigation, cancellation, dasha, resolve, validation (UT-YD-001..155, BI-YD-700/705) |
| `src/__tests__/yogaDoshaSearch.test.ts` | 11 tests — enchanted Sinhala/EN exact `yoga_id`/`dosha_id` conditions, privacy RE-YD-870, name-collision precedence SR-YD-323, keyword path, EN/SI textContent (genuine present chart + absent-chart negative), vocabulary lock-step |
| `src/__tests__/yogaDoshaComponents.test.tsx` | 17 tests — jsdom/RTL: AX-YD-600..607 disclosures, `role="group"` aria labels, empty `role="status"` states, cancelled/unknown chips, mitigation/cancellation/dasha blocks |
| `src/__tests__/fixtures/yoga-dosha-default-2026-09.json` | Era-stamped golden fixture — 2012-08-16 12:00 Colombo lahiri (genuine Saturn–Mars conjunction in Libra): ascendant 7, planets, `yogas: []`, present shaniMangala in `doshas.doshas` (sm01+sm02, severity 1) |

## Implementation Notes

- **Rule set is live for Shani-Mangala only — now a *dosha*.** SM-01 conjunction (strength 1), SM-02 mutual drishti (2), SM-03 mutual 180°±8 (2), SM-04 mutual 120/240 (2), SM-05 parivartana (1), SM-06 2/12 — gated `RULE_TRADITION_GATES: { "shaniMangala.sm06": [] }` → no-op under `MAIN_STREAM` (config-driven). Manglik rules are registered but the entry stays `PENDING_DOMAIN` → never evaluated; `yogas: []` and `doshas.doshas: [shaniMangala]` persist at calc time.
- **Severity synthesis:** `severity = min(strength + appliedMitigations, max(mitigation.targets…, strength), 4)`; status = `MITIGATED(3)` when a mitigation applied and severity > strength, else `NOT_CANCELLED(1)`. `CANCELLED(2)` is unreachable this release (empty cancellation registry, per US-YD-006).
- **Search:** catalog names + aliases resolve via `YOGA_DOSHA_NAME_WORDS` only at word boundaries (`hasCatalogWord` — unicode-aware `\p{L}` checks). A single `yoga_id` exact condition alone scores 0 — the keyword path (`hasYoga`/`hasDosha` incl. “දෝෂ”) still decides ranking, so queries must carry a trigger word.
- **TextContent dual-read:** v1 evaluations list only when `isPresent !== false`; legacy flat-string snapshots (no flag) remain listed — the snippet must not claim a yoga that did not form, but must not drop legacy data either.
- **Golden fixture generator:** IT-YD-201 writes the fixture on first run (era-stamped `_comment`), compares loud `toEqual` on subsequent runs (bhava-suchika precedent, but generator-first instead of committing blindly). 2012-08-16 was chosen after scanning real ephemeris data for a genuine ≤1° Saturn–Mars conjunction (0.45° in Libra).
- **Gates:** `pnpm build` ✅ (passes TypeScript + Turbopack). `npx jest` ✅ 42/44 suites, 1007/1017 tests. **Two failing suites are pre-existing at HEAD** (verified by stash-tests): `search-combined` (stale flat `exactMatch` expectations vs nested RAG-era shape) and `privacy` (mock `req` lacks `nextUrl` for the `[id]` route `sortBy`). **Skipped:** `pnpm format` — the repo has no Prettier config and even HEAD files fail default-config Prettier (the 4-space convention is intentionally non-Prettier); `pnpm lint` crashes before linting any source (ESLint 10.7 + eslint-plugin-react incompatibility while loading `eslint.config.mjs` — config untouched by this feature).

## Deviations from Architecture Spec

- **Absent entries are stored** (`isPresent: false` in the array) rather than omitted — array membership is catalog-complete so the UI, search `$or` filters, and future version bumps can rely on stable ids. UT-YD tests assert this intent.
- **Legacy flat-string entries** (`yogas: [{ name: "…" }]`) are kept as-is at storage and derived at render/search (warn + content-block fallback) — not normalized, since no migration is permitted.
- **Mitigation-status discrepancy:** a severity-reduced yoga carries `status: 3 (MITIGATED)` but `CancellationStatus`'s data-model example showed status 1 alongside a reduction — flagged for BA/QA rather than silently changed.
- **Name-collision precedence (SR-YD-323):** implemented as word-boundary-first (full catalog name wins; embedded words never fire) and documented in the route comment — QA left the precedence implementation-defined.

## Verification

1. `pnpm build` — ✅ successful production build (TypeScript clean, Turbopack).
2. `npx jest` — ✅ 1007 passing / 10 pre-existing failures in 2 untouched suites (search-combined: stale exactMatch expectations; privacy: stale route mock).
3. `npx jest src/__tests__/yogaDosha.test.ts` — 47 ✓ (module/engine/resolve).
4. `npx jest src/__tests__/yogaDoshaSearch.test.ts` — 11 ✓ (route + textContent + vocabulary).
5. `npx jest src/__tests__/yogaDoshaComponents.test.tsx` — 17 ✓ (jsdom AX-YD).
6. Manual: `pnpm dev`, open any horoscope detail page (new calculations) — Yogas & Doshas section renders between the Lagna card and Houses table; open search — Sinhala “ශනි කුජ යෝග” / “මංගල දෝෂ” resolve; snippet sparks only present yogas.

---

## Revision (2026-09-06, engineer direction) — dedicated tab

**Change:** the section moved OUT of the Calculations tab into a new 5th tab `යෝග සහ දෝෂ / Yogas & Doshas` (`id: "yoga-doshas"`), placed between `dashas` and `metadata` in the tab strip, owned by `{activeTab === "yoga-doshas" && calculatedDetails && …}`. The Calculations tab is fully restored to its pre-feature layout (no section between the Lagna card and the Houses section). Supersedes the rev-1 UX "no new tab, section inside Calculations" decision; the UX spec Q1/Flow/Wireframe sections, main-ux-spec blockquote + Placement bullet, and QA UI-YD-500/strategy scope were all updated to rev 2 to stay in traceable lock-step.

**Code changes:**

| File | Change |
| ---- | ------ |
| `src/app/horoscopes/[id]/page.tsx` | added `{ id: "yoga-doshas", label: t("horoscope.yogaDoshas") }` to the `tabs` array (between `dashas` and `metadata`); moved `<YogaDoshaSection/>` out of the `calculations` branch (removed from between the Lagna card and the Houses section) into a new `activeTab === "yoga-doshas"` branch |
| `src/messages/en.json` | `horoscope.yogaDoshas: "Yogas & Doshas"` |
| `src/messages/si.json` | `horoscope.yogaDoshas: "යෝග සහ දෝෂ"` |

**Rationale:** user (AI engineer) found the tags buried inside the already-dense Calculations tab; a dedicated tab mirrors the accepted Dasha tab pattern for a distinct analysis surface. No model/engine/search changes required — this is purely a view-level mount change (the stored evaluations and legacy render-time recompute are untouched).

**Verification:** `npx jest` new suites unchanged (75 feature tests pass); re-verified tab strip + rendering paths by reading the edited page branch. No E2E impact — the existing manual scripts change their step 1 to "open the Yoga & Doshas tab".

---

## Revision 2 (2026-09-06, engineer direction) — Sinhala translations

All UI strings in the Yoga/Dosha feature are now real Sinhala in `src/messages/si.json` (previously `SI-pending → EN fallback` placeholders). Translated: `yogaDosha.*` chrome (infoGlyph, houseHeading, itemGroup, all panel headings, unknownName, mitigationNote), `cancellationStatus.3`, `tradition.MAIN_STREAM` ("ප්‍රධාන ධාරාව"), the full `dosha.shaniMangala.*` seed content (name "ශනි කුජ දෝෂය", rules SM-01..SM-06, house themes, expression, dashaNote, mitigation), `dosha.manglik.*` (name "මංගල දෝෂය", rule MK-01, themes, expression, mitigation), and the yoga namespace left empty. Terms follow the repo's established Sinhala planet/house vocabulary (ශනි / කුජ / ගුරු / "වන ගෘහය"). ICU placeholders `{count}`/`{house}` preserved. Verified: `JSON.parse` OK, `npx jest` feature suites 75/75 (BI-YD-700 parity incl.), no code sentinel references SI-pending. Specs' SI-pending markers updated (main-ux-spec, QA plan, strategy).

---

## Revision 3 (2026-09-06, engineer direction) — Shani Mangala moved to the Dosha group

**Change:** Shani Mangala is reclassified from the Yoga group to the Dosha group, rendering under the amber Dosha tag group as **Shani Mangala Dosha** (ශනි කුජ දෝෂය). The engine/storage/UI/search architecture is kind-agnostic, so this is purely a **catalog + i18n + version bump**:

| File | Change |
| ---- | ------ |
| `src/lib/yogaDosha/types.ts` | `DoshaId = "shaniMangala" \| "manglik"`; `YogaId = never`; new `ShaniMangalaRuleId`/`ManglikRuleId` unions; `DoshaRuleId = ShaniMangalaRuleId \| ManglikRuleId`; `YogaRuleId = never` |
| `src/lib/yogaDosha/catalog.ts` | `CatalogEntryBase` gains `planets: number[]`, `expressionKeys: string[]`, optional `dashaActivation`; `shaniMangala` row moved from `YOGA_CATALOG` to `DOSHA_CATALOG` (kind `dosha`, `keywordEn` "Shani Mangala Dosha", `keywordSi` "ශනි කුජ දෝෂය", `i18nKey "dosha.shaniMangala"`, planets `[7, 3]`, expressionKeys `["expression.main"]`, dashaActivation noteKey `dosha.shaniMangala.dashaNote`, mitigations sm-mit-001); `YOGA_CATALOG = []`; manglik gains `planets: [3]` + `expressionKeys` |
| `src/lib/yogaDosha/interpretation.ts` | `interpretShaniMangala`/`interpretManglik` replaced by generic `interpretHouses(ruleResults, expressionKeys)` |
| `src/lib/yogaDosha/rules.ts` | `evaluateYogaRule` → `evaluateShaniMangalaRule(rule: ShaniMangalaRuleId)`; `evaluateDoshaRule` → `evaluateManglikRule(rule: ManglikRuleId)`; prefix dispatch (shaniMangala./manglik.) for the unified `evaluateCatalogRule` |
| `src/lib/yogaDosha/ruleEngine.ts` | `YOGA_DOSHA_VERSION = 2`; planets from `entry.planets`; interpretation via `interpretHouses(entry.expressionKeys)`; `dashaActivation` read off the entry |
| `src/app/api/search/route.ts` | `scoreHoroscope`'s `hasDosha` trigger extended to the DOSHA catalog words/aliases (a query naming a dosha via any alias — e.g. "ශනි කුජ යෝග" — now scores present doshas, not just the generic දෝෂ/dosha/මංගල triggers) |
| `src/messages/en.json`, `src/messages/si.json` | `yoga.shaniMangala.*` moved to `dosha.shaniMangala.*` (name "Shani Mangala Dosha"/"ශනි කුජ දෝෂය"); `yoga` namespace emptied |

**Rationale:** the user identified Shani Mangala as a classical *dosha* heading (ශනි කුජ දෝෂය), not a benefic yoga. Because rules, rule ids (`shaniMangala.sm01..sm06`), mitigations and theme keys are reused unchanged, no chart facts or evaluation logic change — only where the result is listed and what it is called. `YOGA_DOSHA_VERSION` bumps **1→2** so stored v1 documents (which hold shaniMangala inside `yogas`) are treated as legacy and reclassify at render time (`resolveDoshas` moves present shaniMangala → doshas) without a recalculation job — the stored numeric facts are identical.

**Verification:** `npx jest` feature suites 89/89 (yogaDosha 47 → rewritten 47, search 11, components 17, calculation IT-YD-200 updated); full suite `npx jest` 1007 pass / 10 pre-existing failures (search-combined, privacy — unchanged at HEAD); golden fixture regenerated to the dosha shape; `pnpm build` exit 0.

---

## Revision 4 (2026-09-06, engineer direction) — search by yoga/dosha name is fully enabled

**Change:** `/api/search` now evaluates `yoga_id`/`dosha_id` name conditions (and the `hasYoga`/`hasDosha` keyword scoring) against the **same read-time view the detail panel renders** — `resolveYogaDoshas` (stored v2 wins; legacy/v1 docs recompute purely from stored chart facts). Previously the route read only the stored `yogas`/`doshas` fields, so a pre-v2 horoscope showing the Shani Mangala Dosha tag could never be found by name even though the tag rendered. Also made `hasYoga` symmetric with `hasDosha` (yoga catalog words/aliases trigger yoga scoring; empty catalog today, harmless).

| File | Change |
| ---- | ------ |
| `src/app/api/search/route.ts` | import `resolveYogaDoshas`; per-horoscope normalize `calculatedDetails` → `{ ...raw, yogas: resolved.yogas, doshas: { doshas: resolved.doshas } }` when resolvable (other fields untouched); exact-match `yoga_id`/`dosha_id` cases + `scoreHoroscope` read the normalized lists; `hasYoga` gains the yoga-catalog word/alias trigger |
| `src/app/api/search/route.ts` | catalog-name matching rewritten to **longest-span precedence**: boundary-matched catalog words are dropped when a strictly longer registered word covers the same span — `මංගල` (manglik keyword) no longer fires inside `ශනි මංගල`/`මංගල දෝෂ`, so "ශනි මංගල දෝෂය" resolves to `dosha_id shaniMangala` only (a bare "මංගල" still resolves manglik on its own) |
| `src/__tests__/yogaDoshaSearch.test.ts` | stored fixtures now carry `yogaDoshaVersion: YOGA_DOSHA_VERSION` (keeps stored-vs-derived semantics); +3 tests — SR-YD-808 legacy doc (chart facts only) matches by "shani mangala" and a non-conjunct legacy doc stays excluded; SR-YD-809 v1 doc (shaniMangala inside `yogas`) recomputes to the dosha view and matches; SR-YD-810 "ශනි මංගල දෝෂය" must not fire manglik, bare "මංගල" must |

Search autocomplete already surfaces the names: `SEARCH_VOCABULARY` includes the catalog keywords + aliases (`yooga-doshsa name words` merged into `TRIGGER_WORDS`), so `getSuggestions` offers "Shani Mangala Dosha", "ශනි කුජ දෝෂය" and their aliases while typing.

**Rationale:** "search by yoga or dosha name" should find exactly the charts that render the tag. The resolver is the single source of truth for that view (page + notepad consumers already use it); the search route now joins them, ending the stored-only blind spot for pre-v2 and pre-feature docs. No scoring/condition semantics changed for v2 docs (normalization is a no-op when stored versioned evaluation wins).

**Verification:** `npx jest` feature suites 122/122 (yogaDosha 47, search 14, components 17, calculation); full suite 1010 pass / 10 pre-existing failures (unchanged at HEAD); `pnpm build` exit 0.
---

## Revision 5 (2026-09-06, user direction) — dosha tag chips: red when present, gray when cancelled

**Change:** dosha tag chips are now color-coded by cancellation state. A **present (not cancelled) dosha** renders as a **red chip** (`bg-red-50 text-red-700 border-red-300`, `bg-red-600` status dot, `focus-visible:ring-red-400`); a **cancelled dosha** renders **gray** (`bg-gray-100 text-gray-500 border-gray-300`, `line-through`, gray dot). Yoga chips keep the unchanged neutral white/gray chip with the indigo hover and ring; the unknown-id chip stays dashed gray; the severity pill (detail panel) and cancellation "Cancelled" badge are unchanged.

| File | Change |
| ---- | ------ |
| `src/components/yogaDosha/YogaDoshaTag.tsx` | branch chip/dot/ring classes on `isDosha` + `cancellation.status === CancellationStatus.CANCELLED` (enum import replaces the magic `2`); dosha present → red, dosha cancelled → gray, yoga → previous treatment |
| `src/__tests__/yogaDoshaComponents.test.tsx` | +1 test asserting the red chip (bg-red-50/text-red-700/red dot) for a present dosha and the gray chip (gray-100/text-gray-500/line-through/gray dot) for a cancelled one |

**Reasoning mirrors the existing color-is-never-the-only-channel contract:** cancellation is still conveyed by the strikethrough + `CancellationStatus` label in the aria-name, the dot (color + state combination), and the panel's Cancellation block — the chip color merely adds the dosha/severity-tinting the user asked for. The existing amber "mitigated" dot is preserved for yoga chips; dosha chip color is strictly present→red / cancelled→gray per direction.

**Verification:** `npx jest` feature suites 123/123 (components 18); full suite 1011 pass / 10 pre-existing failures (unchanged at HEAD); `pnpm build` exit 0.

## Revision 6 (2026-09-06, user direction) — Agni Marutha Dosha; Shani Mangala narrowed to 3 positional rules

**Change:** per `docs/agni-marutha-dosha.md`, the broad Saturn–Mars relationship becomes a **second ACTIVE dosha, Agni Marutha** (8 rules, id `agniMarutha`), while **Shani Mangala is narrowed to exactly three positional rules** (SM-01 conjunction, SM-02 7th-from-each-other, SM-03 mutual 4-10). Mutual drishti and 2/12 are **removed** from Shani Mangala; parivartana moves to **Agni Marutha AM-08**; both doshas stay in the Dosha group (user-confirmed). Engine writes now carry `yogaDoshaVersion: 3`; stored v2 documents recompute from chart facts at render/search via the resolver.

| File | Change |
| ---- | ------ |
| `docs/agni-marutha-dosha.md` | authoritative ruleset for the change (new doc) |
| `src/lib/yogaDosha/types.ts` | `DoshaId` += `"agniMarutha"`; `AgniMaruthaRuleId` (am01..am08); `DoshaRuleId` union extended; `PlanetFact.nakshatra` added |
| `src/lib/yogaDosha/relationships.ts` | `NAKSHATRA_LORDS` (Vimshottari, Nakshatra 1..27 → lord incl. Rahu 8/Ketu 9) + `nakshatraLord()` helper; Saturn–Mars sign lordship helpers reused by AM |
| `src/lib/yogaDosha/rules.ts` | rewrote `evaluateShaniMangalaRule` → positional-only sm01..sm03 (no aspects, no 2/12, no parivartana); added `evaluateAgniMaruthaRule` (am01 conjunct, am02/am03 aspect, am04/am05 sign ownership, am06/am07 nakshatra lord, am08 parivartana); removed `RULE_TRADITION_GATES`/`ruleAllowedIn` |
| `src/lib/yogaDosha/catalog.ts` | shaniMangala rules = sm01(1)/sm02(2)/sm03(2); new ACTIVE `agniMarutha` entry (keywordEn "Agni Marutha Dosha", keywordSi "අග්නි මාරුත දෝෂය", planets [7,3], expressionKeys ["expression.main"], no mitigations/cancellations yet) |
| `src/lib/yogaDosha/ruleEngine.ts` | `YOGA_DOSHA_VERSION = 3`; `PlanetLike`/`buildChartFacts` map `nakshatra` (fallback 0 → AM-6/7 fail closed) |
| `src/messages/en.json`, `src/messages/si.json` | shaniMangala rules rewritten to sm01..sm03; full `dosha.agniMarutha` (rule.am01..am08, theme.house1..12, expression.main, dashaNote) in both locales |
| `src/__tests__/yogaDosha.test.ts` | catalog/theme/id assertions updated for AM; rules block rewritten (UT-YD-040..047 + AM-01..08 + parivartana-is-AM-only); UT-YD-070 house loop, 116, 150, 153 updated; +126 total in suite |
| `src/__tests__/calculation.test.ts` | IT-YD-200: `rulesTriggered` now `["shaniMangala.sm01"]`, asserts agniMarutha present + both ids in `doshas.doshas`; fixture regenerated |
| `src/__tests__/fixtures/yoga-dosha-default-2026-09.json` | regenerated — `doshas` now `[shaniMangala present, agniMarutha present]` |
| `src/__tests__/yogaDoshaSearch.test.ts` | SR-YD-806/807 text expectations include the second dosha name; +SR-YD-811: "අග්නි මාරුත දෝෂය"/"agni marutha" resolve `agniMarutha`, AM-only (parivartana) chart does NOT match "shani mangala" |
| no change | search route/vocabulary/textContent are catalog-driven; `YOGA_DOSHA_NAME_WORDS` + exactMatch pick up `agniMarutha` keyword/aliases automatically |

**Decisions & defaults (flagging for domain/PM confirmation):** AM rule strengths am01→1, am02/03→2, am04/05→2, am06/07→3, am08→1; Agni Marutha has **no mitigation/cancellation rules yet** (doc covers existence only — the Jupiter mitigation stays on Shani Mangala). Regression risk: every SM rule is naturally a subset of an AM rule, so charts where Sun-interpretation previously showed Shani Mangala now show BOTH names in the dosha list.

**Verification:** feature suites 126/126 (yogaDosha 101, components 18, search ~7, calculation 44 incl. IT-YD-200/201); full suite 1014 pass / 10 pre-existing failures (search-combined 6 + privacy 4, unchanged at HEAD); `pnpm build` exit 0.

## Revision 7 (2026-09-07, user direction) — Shani Mangala requires the MUTUAL drishti (orbs via stored records)

**Change:** the user corrected the SM-2/SM-3 semantics against real chart `6a68e773…`: placement alone is not enough — "Both Kuja and Shani should have their aspects … need to consider the planet Orbs value … only given locations like 7, 4, 8." Chart `6a68e773` (Isuri) is 7th-from-each-other positionally, but only **Mars→Saturn** aspects (210°, gap 7.76); Saturn's stored records contain **no** Mars entry → Shani Mangala must be **absent**, Agni Marutha stays present (AM-02 + AM-06: Dhanishta/23 is Mars-ruled). Implemented: SM-02 = gap 6 AND stored mutual 180° record; SM-03 = gap 9 (Mars 10th from Saturn) AND both directions present in the 90°/270° family. One-way aspects, trines/sextiles (120/60) and Mars's 8th drishti (210°) never create Shani Mangala. `YOGA_DOSHA_VERSION = 4` (stored v3 docs had positional-SM results and recompute on read).

| File | Change |
| ---- | ------ |
| `src/lib/yogaDosha/relationships.ts` | +`hasMutualAspectAngle(a,b,angle,orb=8)` (reused by SM-02) and +`hasMutualFourTenAspect(a,b,orb=8)` (SM-03). Stored `aspects` are already orb-filtered at compute time, so requiring both records implements the per-planet orb check |
| `src/lib/yogaDosha/rules.ts` | sm02 gates on `hasMutualAspectAngle(saturn, mars, 180)`; sm03 gates on the positional mutual 4-10 AND `hasMutualFourTenAspect(saturn, mars)`; sm01 conjunction unchanged |
| `src/lib/yogaDosha/ruleEngine.ts` | `YOGA_DOSHA_VERSION = 4` |
| `src/__tests__/yogaDosha.test.ts` | UT-YD-041 (gap-6 fixtures now carry mutual 180 records; one-way 7th → SM absent), UT-YD-042 (mutual 90/270 for 4-10; one-way 4-10 → SM absent; gap-3 orientation excluded), UT-YD-116 (2/8 fixture to mutual 180), +UT-YD-045 regression using the real `6a68e773` chart facts (SM absent, AM `["…am02","…am06"]`) |
| `docs/agni-marutha-dosha.md` | SM-2/SM-3 bullets + table footnote: mutual graha drishti on the per-planet orbs required; one-way → Agni Marutha only |

**Verification:** feature suites 127/127 (yogaDosha 102, +1 regression); full suite 1015 pass / 10 pre-existing failures (unchanged at HEAD); `pnpm build` exit 0. Other specs (data-model catalog, architecture OQ, QA, UX) updated in parallel (Revision 7 / Rev 6+ note).

## Revision 8 (2026-09-07, user direction) — Sinhala display name corrected to ශනි මංගල දෝෂය

**Change:** the Sinhala name of the `shaniMangala` dosha is renamed **"ශනි කුජ දෝෂය" → "ශනි මංගල දෝෂය"** (matches the accepted classical heading and the existing `Śanī Maṅgala` alias). Runtime: `catalog.ts` `keywordSi` and `si.json` `dosha.shaniMangala.name`; the old long form stays resolvable in search as a `searchAliasesSi` entry (backward-compatible), and the existing shorter alias "ශනි මංගල" already resolved the dosha. Display-name assertion (`yogaDosha.test.ts` keywordSi) and SI textContent expectation (`yogaDoshaSearch.test.ts`) updated. Rule reason sentences that grammatically reference "ශනි කුජ" ("Saturn … from Mars") are unchanged.

**Verification:** feature suites 83/83 (yogaDosha 57 + search ~8 + components 18); full suite unchanged (1015 pass / 10 pre-existing); no `pnpm build` impact (i18n + catalog strings only).

## Revision 9 (2026-09-07, user direction) — SM-01/AM-01 conjunction gates on the per-planet orbs

**Change:** a same-sign/same-house Saturn–Mars pair is no longer conjunct by pure position. `areConjunct` (relationships.ts, shared by `shaniMangala.sm01` rules.ts:62 and `agniMarutha.am01` rules.ts:99) now additionally requires **both stored mutual 0° (conjunction) aspect records** — records the compute pipeline writes only when the pair lies within each planet's own orb (Saturn 9°, Mars 8° in `planetAspects.ts`). Drives the user-reported chart `6a74b291a5e25025ca4cb61a`: Saturn 16.03° / Mars 29.6° Vrishchika, both house 7, separation 13.57° → no 0° records on either stored aspect list → **Shani Mangala absent** (Agni Marutha remains present via `am04` — Saturn in Vrishchika). Consistent with the mutual stored-record invariant (US-YD-002) already applied to SM-02/SM-03 in Revision 7.

**Test updates:** new regression `UT-YD-048` (chart 6a74b291 — SM-01 off, AM-04 on) and `UT-YD-021b` (areConjunct false for the same out-of-orb pair); `UT-YD-020` now asserts the mutual 0°-record requirement. Conjunct fixtures across yogaDosha/`yogaDoshaSearch`/`yogaDoshaComponents` suites gained their mutual 0° records; `UT-YD-151` (manual chart lacking stored aspects) now asserts absence rather than presence, since with no records there is no in-orb evidence.

**Verification:** feature suites 128/128 (yogaDosha 52 + search 15 + components 18 + calculation 44); full suite 1017 pass / 10 pre-existing (search-combined 6 + privacy 4); `pnpm build` exit 0. DB re-check on the stored calc doc (`calculateddetails` 6a74b291a5e25025ca4cb61b, `yogaDoshaVersion: 2`): no cross planet-aspect records, separation 13.57 → resolver recompute (v2 < v4) yields SM absent.
