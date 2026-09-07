# Yoga/Dosha Engine — Separated Tags with Structured Evaluations — Architecture

**Date:** 2026-09-06 09:05
**Author:** Architect (BMAD)
**Based on:** `specs/business-analysis/20260906-0707-yoga-dosha-tags.md`

---

## Overview

This spec designs the **Yoga/Dosha Engine**: separated Yoga and Dosha tag groups on the single horoscope detail view (US-YD-001..US-YD-007), each tag expanding into a structured detail panel (name, why it forms, what result it gives, cancellation/mitigation), driven by a static catalog and deterministic rule + interpretation + cancellation engines, bilingual end-to-end, with search integration (US-YD-008..US-YD-011) and an incremental rule-addition path (US-YD-013).

The design follows the established **pure derived-data module** pattern of `shadBalaya.ts` / `wargaKendara.ts` / `bhavaSuchika.ts`:

1. A new **static rule catalog** — the only place the calculation path references a yoga/dosha identity.
2. A new **pure engine module `src/lib/yogaDosha/`** — no ephemeris, no I/O, deterministic over already-stored chart facts — consumed by the auto calculator, the manual synthesizer, the render-time legacy fallback and (via the automatic spreads) the AstrologySettings recalculation job.
3. **Calc-time persistence** of structured evaluation results on `CalculatedDetails.yogas` / `doshas` for both `source: "auto"` and `source: "manual"` horoscopes.
4. **Read-only everywhere** — no new endpoints, no overrides, no user-editable state.

## System Context

```
┌──────────────────────────────  Stored chart facts (source of truth)  ─────────────────────────────┐
│  CalculatedDetails: ascendant, houses[12] (whole-sign), planets[9] (sign/house/degree/aspects[]),  │
│                     source: "auto" | "manual", thithi, day/night, strength per planet              │
└───────────────┬────────────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
        ┌───────────────── src/lib/yogaDosha/ (pure, no ephemeris, no I/O) ─────────────────┐
        │                                                                                    │
        │  catalog.ts   — YOGA_DOSHA_CATALOG (static registry: ids, type, tradition,        │
        │                 rule refs, theme/expression/cancellation/mitigation metadata,     │
        │                 bilingual name maps)                                               │
        │  relationships.ts — house-gap helpers (mutual-7th, 4/10, 2/12), sign-lord,        │
        │                 parivartana, mutual-drishti over stored aspects[]                 │
        │  rules.ts      — SM-01..SM-05 + MK-01 rule functions (ruleId → RuleResult|null)   │
        │  ruleEngine.ts — evaluateCatalog(facts): triggered rules, ranking, dedup,         │
        │                 primaryRule, formation{strength,reasons}                           │
        │  interpretation.ts — house-theme + expression key selection (tendency only)       │
        │  cancellation.ts — registered cancellation rules (status 2) vs mitigation         │
        │                 factors (may set status 3) — never silently combined              │
        │  index.ts      — computeYogaDoshas(), resolveYogas/resolveDoshas(legacy fallback),│
        │                 typed exports                                                     │
        └───────┬───────────────────────────────┬───────────────────────────────┬──────────┘
                │                               │                               │
   auto: calc-time          manual: synth-time              render-time legacy fallback
   calculateHoroscope       synthesizeCalculation           resolveYogas / resolveDoshas
   (src/lib/calculation.ts) (src/lib/manualChartDetails.ts) (stored-first; pure recompute)
                │                               │                               │
                ▼                               ▼                               ▼
        ┌────────────────────────────────────────────────────────────────────────────────┐
        │  Persisted on CalculatedDetails  yogas: YogaEvaluation[]                        │
        │                                  doshas: { doshas: DoshaEvaluation[] }         │
        │                                  yogaDoshaVersion: 1  (discriminator)          │
        └───────────────┬───────────────────────────────┬──────────────────────────────┬─┘
                        │                               │                              │
                        ▼                               ▼                              ▼
          GET /api/horoscope/:id                 AstrologySettings                  Search
          GET /api/share/:token                  recalculation job                   textContent.ts (SI/EN)
          (payload grows additively)             (no changes — ...calculated          vocabulary.ts (name words)
                                                 spread recomputes on the fly)        /api/search (yoga/dosha
                        │                                                            catalog-id exact conditions)
                        ▼
          Horoscope detail page — YogaAndDoshaSection (read-only tags + detail panels)
```

## Architecture Decisions

| Decision | Choice | Rationale |
| -------- | ------ | --------- |
| Engine location | New pure module `src/lib/yogaDosha/` (`catalog.ts`, `relationships.ts`, `rules.ts`, `ruleEngine.ts`, `interpretation.ts`, `cancellation.ts`, `types.ts`, `index.ts`) | Same contract as `shadBalaya.ts`/`wargaKendara.ts` (no ephemeris, no I/O — shared by auto calc, manual synth, render fallback, tests). Keeping it out of `calculation.ts` keeps the ephemeris path free of rule concerns and lets the catalog grow iteratively (US-YD-013) without touching the ephemeris pipeline. Alternatives rejected: (a) inline rules in `calculation.ts` — makes catalog-driven additions invasive and hard to unit-test; (b) declarative/JSON-only rules — cannot express parivartana, sign-lordship or dignity conditions type-safely; chosen design is **code rules + metadata catalog**, matching the `notepadCatalogs.ts`/`VARGA_CATALOG` static-TS-catalog precedent. |
| Numeric enums | `YogaStrength` (1 Very Strong / 2 Strong / 3 Moderate / 4 Weak) and `CancellationStatus` (1 Not Cancelled / 2 Cancelled / 3 Mitigated) added to `src/lib/astrologyEnums.ts` | In lockstep with the BA data-model tables; compiles into the bilingual STRENGTH/LABEL lookup convention already used for search parsing; display names still resolve via i18n per locale — enums are never rendered directly. |
| Evaluation timing | Calc-time persistence for both `source`s via the existing `...calculated`/`...synth` spreads (`ICalculatedDetails extends CalculationResult`); render-time pure recompute `resolveYogas`/`resolveDoshas` as the **legacy fallback**; stored `yogaDoshaVersion: 1` marker disambiguates legacy from computed-empty | Mirrors Bhava Suchika/Warga Kendara exactly (incl. their "AstrologySettings job needs no changes" property — no user overrides exist). The `[]`-vs-`[]` ambiguity is real: pre-feature every doc stored `yogas: []`, but post-feature `[]` legitimately means "no yogas". The version marker (1 line in the schema, optional) lets the render path prefer stored data and only recompute for legacy docs. |
| Catalog representation | `YOGA_DOSHA_CATALOG: CatalogEntry[]` — stable `id`, `type: "yoga"\|"dosha"`, `tradition`, `nameKey`, ordered `rules: RuleDefinition[]`, theme/expression/cancellation/mitigation metadata, `status: "active"\|"pending-domain"` | Catalog is the **only** identity reference; downstream (engine, storage, UI, search) is fully generic. `pending-domain` entries are registered but skipped by the engine, so `manglik` seeds without asserting half-confirmed rules (no false Manglik tags). Each new entry is additive and non-breaking (US-YD-013 checklist below). |
| Rule input contract | `ChartFacts` built from stored `CalculatedDetails` only: `planets[]` (name/sign/house/degree/absoluteDegree/strength/retrograde/aspects[]/navamsaSign?), `houses[]` (sign/lord), `ascendant.sign`, `source`, `thithi?`, `day?`, `maranakaraka?` | No Chart documents, no ephemeris. Manual charts already persist the full derived `planets` table (including degree-arm + explicit-houses-arm + rashi-arm aspects), so **stored `planets[].aspects` is reused for mutual-drishti checks on both sources**; `manualHousePlacements` remains the single source of truth and is never re-derived here. |
| Shani–Mangala seed | SM-01 conjunction (Very Strong), SM-02 mutual Graha Drishti (Strong), SM-03 mutual 7th (Strong), SM-04 4/10 + mutual special aspect (Strong), SM-05 parivartana (special handling); 2/12 tradition-gated; per-rule `reasonKey` + numeric params; house-theme mapping for 7/10/4/8; Jupiter + dignity mitigation with provenance; soft dasha note | Straight transcription of `docs/shani-mangala-yoga.md` formation table into rule functions over stored chart facts; SM-01..SM-05 intentionally carry *distinct* meanings (conjunction ≠ aspect ≠ house-relationship ≠ sign-exchange). Dedup: rules returning identical reason text are merged; SM-02/SM-03 may co-fire for 7th-house pairs (180° is in the default degree set) — both reason lines render per the doc's rule-per-relationship guidance, primary = catalog order (open question OQ-2). |
| Dosha approach | **Symmetric engine**: `DoshaEvaluation extends YogaEvaluation` + `isPresent`; legacy flat strings (`name`/`severity`/`affectingHouses`/`planetsInvolved`) normalized at read; `manglik` registered but `pending-domain` | BA mandates identical shape with `isPresent` preserved for search cards/route/export; symmetric reuse keeps one code path and one test suite. Marking the seed `pending-domain` avoids asserting an unconfirmed House-based Manglik rule (MK-01) as authoritative. |
| Search integration | `textContent.ts` resolves yoga/dosha names from the catalog name maps (SI/EN) with legacy-string fallback; `vocabulary.ts` gains `YOGA_DOSHA_NAME_WORDS` from the catalog; `/api/search` adds generic `yoga`/`dosha` catalog-id exact conditions | US-YD-011 requires the existing surfaces to keep working (old `name` string reads, `isPresent` filtering) while specific-name queries (e.g. "ශනි-කුජ", "shani mangala", "parivartana") become parseable in both languages. Existing ExactCondition machinery is extended, not replaced. |
| API surface | **No new routes, no mutations.** `GET /api/horoscope/:id` and `GET /api/share/:token` grow additively (`calculatedDetails.yogas`, `doshas`, `yogaDoshaVersion`). | Content is read-only on every view (actors.md: "no editing, no overrides"); the Shad Bala PATCH precedent is intentionally NOT followed because the feature explicitly has no student toggles. |
| UI architecture | `YogaAndDoshaSection` with two tag groups (`YogaTagGroup`, `DoshaTagGroup`) + expand/collapse `YogaDoshaDetailPanel`; cancelled → strikethrough chip (Wargoththama-tag pattern); read-only on own/public/share views | UX owns final layout; architecture only pins the component seam, the stored→i18n rendering contract and the read-only rule. |

## Component Design

### `src/lib/yogaDosha/types.ts`

- **Location:** `src/lib/yogaDosha/types.ts`
- **Responsibility:** shared TypeScript contracts for catalog rows, rules and evaluations.
- **Interfaces (mirror the BA data-model JSON 1:1):**

```ts
import type { Planet, PlanetaryStrength, YogaStrength, CancellationStatus } from "@/lib/astrologyEnums";

/** Pure input contract — everything the engine may read. Built from stored CalculatedDetails. */
export interface ChartFacts {
    planets: Array<{ name: Planet; sign: number; house: number; degree: number;
                     absoluteDegree: number; strength: PlanetaryStrength; retrograde: boolean;
                     aspects: Array<{ planetName: Planet; aspectType: number; degreeGap: number }>;
                     navamsaSign?: number }>;
    houses: Array<{ houseNumber: number; sign: number; lord: Planet }>;
    ascendantSign: number;
    source: "auto" | "manual";
    tradition: string;          // selected tradition key; phase 1 = "MAIN_STREAM"
    thithi?: number;
    day?: boolean;              // deriveDay from planets when absent (shadBalaya.ts helper)
    maranakaraka?: number[];
}

/** One satisfied formation rule. */
export interface RuleReason {
    rule: string;                       // "SM-01"
    reasonKey: string;                  // "yoga.shaniMangala.rule.sm01"
    params?: Record<string, number | number[]>;
}

/** Atomic rule result. */
export interface RuleResult {
    triggered: boolean;
    strength: YogaStrength;
    reasons: RuleReason[];
}

/** Catalog metadata — never stored per horoscope. */
export interface CatalogEntry {
    id: string;                         // "shaniMangala" | "manglik" | ...
    type: "yoga" | "dosha";
    nameKey: string;                    // "yoga.shaniMangala.name" | "dosha.manglik.name"
    traditionKey: string;               // "MAIN_STREAM"
    status: "active" | "pending-domain";
    rules: RuleDefinition[];
    cancellationRules: CancellationRule[];
    mitigationRules: MitigationRule[];
    houseThemes: Record<number, string[]>;     // house -> i18n theme keys (tendency language)
    expressionKeys: string[];                  // final-assessment expression keys
    dashaNoteKey?: string;                     // soft dasha activation note
}

export interface RuleDefinition {
    id: string;                         // "SM-01"
    evaluate: (facts: ChartFacts) => RuleResult | null;   // null = not applicable
}

export interface CancellationRule {
    ruleId: string;                     // "SM-CAN-001"
    condition: (facts: ChartFacts) => boolean;
    reasonKey: string;
    tradition: string;                  // provenance — never combined across traditions
}

export interface MitigationRule {
    ruleId: string;
    factor: "JUPITER_ASPECT" | "OWN_SIGN" | "BENEFIC_ASPECT" | string;
    effect: "REDUCES_SEVERITY" | string;
    condition: (facts: ChartFacts) => boolean;
    target?: Planet;
    tradition: string;
    confidence: number;                 // 1..3 weight for the final-assessment synthesis
}
```

**Persisted evaluation shapes** (stored verbatim on `CalculatedDetails.yogas` / `doshas.doshas` — numeric enums only, no display text):

```ts
export interface FormationResult {
    rulesTriggered: string[];           // ALL satisfied rule IDs, deduped
    primaryRule: string;                // strongest satisfied rule (lowest YogaStrength; catalog order tiebreak)
    strength: YogaStrength;             // 1..4 (BA table)
    reasons: RuleReason[];              // one reason per satisfied rule (numeric-enum params)
}

export interface MitigationFactor { ruleId: string; factor: string; effect: string;
    target?: Planet; tradition: string; confidence: number }

export interface CancellationResult { status: CancellationStatus; factors: CancellationFactor[] }

export interface CancellationFactor { ruleId: string; reasonKey: string;
    planets?: Planet[]; houses?: number[]; tradition: string }

export interface FinalAssessment { severity: YogaStrength; expressionKeys: string[] }

export interface DashaActivation { planets: Planet[]; noteKey: string }

export interface YogaEvaluation {
    id: string;                         // catalog id
    exists: boolean;
    tradition: string;                  // evaluated tradition (provenance)
    formation: FormationResult;
    context: { houseImpact: number[]; planets: Array<{ planet: Planet; house: number;
               sign: number; strength: PlanetaryStrength }> };
    interpretation: { themes: Array<{ key: string }> };
    mitigation: MitigationFactor[];
    cancellation: CancellationResult;
    finalAssessment: FinalAssessment;
    dashaActivation?: DashaActivation;
}

export interface DoshaEvaluation extends Omit<YogaEvaluation, "id" | "exists"> {
    id: string;                         // catalog id
    isPresent: boolean;                 // preserved for search cards / route / export filtering
    exists: boolean;                    // kept for shape symmetry with yogas
}
```

### `src/lib/yogaDosha/catalog.ts`

- **Location:** `src/lib/yogaDosha/catalog.ts`
- **Responsibility:** the static `YOGA_DOSHA_CATALOG` registry + bilingual name maps (authoritative English from `docs/shani-mangala-yoga.md`, Sinhala pending domain confirmation — placeholder transliterations resolve via i18n keys, never stored).
- **Interfaces:** `CatalogEntry[]` (above); helper exports `YogaDoshaNamesSi` / `YogaDoshaNamesEn` (Record<id, localized name>) reused by search text content and vocabulary.
- **Phase-1 seed rows:**

| id | type | status | Rules (phase-1) |
|----|------|--------|------------------|
| `shaniMangala` | yoga | `active` | SM-01..SM-05 (see below) |
| `manglik` | dosha | `pending-domain` | MK-01 (Mars in houses 1/4/7/8/12 + to-be-confirmed cancellation rules) — registered, **skipped** until confirmed |

### `src/lib/yogaDosha/relationships.ts`

- **Location:** `src/lib/yogaDosha/relationships.ts`
- **Responsibility:** pure relationship helpers over `ChartFacts` (all mod-12 arithmetic on whole-sign houses/signs):
  - `isConjunct(a, b)` — `a.house === b.house` (whole-sign house equality; same house ⇒ same sign).
  - `isMutualDrishti(a, b)` — stored `a.aspects` contains `b.name` AND `b.aspects` contains `a.name` (both directions). Uses the persisted per-planet aspect lists exactly as computed by the aspect engine — identical for auto and manual (manual lists were derived under both aspect arms).
  - `isMutualSeventhHouse(a, b)` — `((a.house − b.house + 12) % 12) === 6` (opposite houses).
  - `is4_10(a, b)` — gap `∈ {3, 9}`.
  - `is2_12(a, b)` — gap `∈ {1, 11}` (tradition-gated only).
  - `isParivartana(a, b, houses)` — `a.sign === signLord(b.sign)` AND `b.sign === signLord(a.sign)` (sign exchange), via a small `signLord` helper reading the stored `houses[].lord` (whole-sign lordship map — no new static table).
- **Data:** none (pure functions only).

### `src/lib/yogaDosha/rules.ts`

- **Location:** `src/lib/yogaDosha/rules.ts`
- **Responsibility:** the concrete rule functions referenced by the catalog.

| Rule | Condition (over ChartFacts) | Strength | reasonKey |
|------|----------------------------|----------|-----------|
| SM-01 | `areConjunct(Saturn, Mars)` — same whole-sign house **and both stored aspect lists carry the partner at `aspectType 0`** (0° records exist only within each planet's orb — Rev 9; 6a74b291 13.57° apart → not conjunct) | 1 Very Strong | `yoga.shaniMangala.rule.sm01` |
| SM-02 | `isMutualDrishti(Saturn, Mars)` (both stored aspect lists contain the other) — mutually exclusive with SM-01 by house | 2 Strong | `yoga.shaniMangala.rule.sm02` |
| SM-03 | `isMutualSeventhHouse(Saturn, Mars)` | 2 Strong | `yoga.shaniMangala.rule.sm03` |
| SM-04 | `is4_10(Saturn, Mars)` AND `isMutualDrishti(...)` (mutual **special** aspect present in the stored lists — aspectType in the special set {60, 90, 210, 240, 270, 300}) | 2 Strong | `yoga.shaniMangala.rule.sm04` |
| SM-05 | `isParivartana(Saturn, Mars, houses)` | 1 Very Strong (parivartana acts like conjunction — **open question OQ-1**) | `yoga.shaniMangala.rule.sm05` |
| SM-06 (tradition-gated) | `is2_12(Saturn, Mars)` — evaluated **only** when `facts.tradition` is in the entry's `traditionGate` list; no-op under `MAIN_STREAM` (phase 1) | 3 Moderate | `yoga.shaniMangala.rule.sm06` |

Notes:
- A rule returns `null` when not applicable; the engine only records `triggered: true` results.
- SM-02 and SM-03 may co-fire for 7th-house pairs (180° is in the default aspect degrees): both reason lines render (the doc lists each relationship separately), the primary rule is the catalog-order tiebreak — see OQ-2.
- House themes entering `context.houseImpact` / `interpretation.themes`: involved houses + the life-domain house(s) the relationship most strongly marks — 7 (marriage/partnership), 10 (career/status), 4 (home/property), 8 (transformation) per `docs/shani-mangala-yoga.md`; theme keys under `yoga.shaniMangala.theme.house7.*` etc., tendency language only.
- **Dasha note:** `dashaActivation = { planets: [7, 3], noteKey: "yoga.shaniMangala.dashaNote" }` — "may become active during Saturn/Mars periods", never a timing prediction.

### `src/lib/yogaDosha/ruleEngine.ts`

- **Location:** `src/lib/yogaDosha/ruleEngine.ts`
- **Responsibility:** `evaluateCatalog(facts): { yogas: YogaEvaluation[]; doshas: DoshaEvaluation[] }`.
- **Pipeline per catalog entry (active only):**
  1. Run every `RuleDefinition` against `facts`; collect triggered rules + reasons (reason dedup: identical `reasonKey`+`params` merged).
  2. Rank by strength (lowest numeric = strongest), tiebreak by catalog rule order → `primaryRule`.
  3. `formation.strength` = primary rule's `YogaStrength`; `formation.reasons` = one reason per satisfied rule (BA mandates "all satisfied rules, never a boolean").
  4. Build `context`: `houseImpact` = union of involved planets' houses + relationship domain houses; `context.planets` = per involved planet `{planet, house, sign, strength}`.
  5. `interpretation.themes` = `houseThemes[house]` for each affected house (tendency keys only).
  6. **Cancellation, separately from mitigation:** run only the registered `CancellationRule`s (with provenance) → status 2 when any fires; otherwise status 1. A mitigation factor may **never** set status 2 (BA data-model note).
  7. **Mitigation:** run `MitigationRule`s → `mitigation[]` factors; at final assessment they may lower the weighted severity and set status 3 ("Mitigated") — the yoga still exists but with reduced expression.
  8. `finalAssessment.severity` = weighted synthesis (formation → affliction → mitigation → cancellation → house relevance), clamped to 1–4; `finalAssessment.expressionKeys` = the entry's expression keys filtered by active themes.
  9. Attach `dashaActivation` when the entry defines it.
- **Data:** none (pure). Deterministic: same `ChartFacts` ⇒ same output.

### `src/lib/yogaDosha/index.ts`

- **Location:** `src/lib/yogaDosha/index.ts`
- **Responsibility:** public API.
  - `computeYogaDoshas(facts: ChartFacts)` — full evaluation, returns `{ yogas, doshas }`.
  - `buildChartFacts(calc: CalculationResult, tradition = "MAIN_STREAM"): ChartFacts` — extract persisted fields; derives `day` from `sun.house >= 7` (reusing `shadBalaya.deriveDay` semantics), thithi if absent.
  - `resolveYogas(calc: CalculationResult): YogaEvaluation[]` and `resolveDoshas(calc: CalculationResult): { doshas: DoshaEvaluation[] }` — **stored-first** (when `yogaDoshaVersion` present, return stored shape with normalization); otherwise **pure recompute** at render for legacy documents (warn-level log on corrupt stored values), mirroring `resolveWargaKendara`/`resolveLagnaBhavaSuchika`.
  - Re-exports `YOGA_DOSHA_CATALOG`, `YogaDoshaNamesSi/En`, all types.

### Integration points (existing files)

- **`src/lib/astrology.ts`** — retype `CalculationResult.yogas: unknown[]` → `YogaEvaluation[]` and `DoshaInfo.doshas: unknown[]` → `DoshaEvaluation[]`; add optional `yogaDoshaVersion?: number`.
- **`src/lib/calculation.ts`** (`calculateHoroscope`, auto) — after the existing derived fields, run `computeYogaDoshas(buildChartFacts(result))` and assign `result.yogas` / `result.doshas.doshas` / `result.yogaDoshaVersion = 1`. Persisted automatically by the shared spread driven by the `POST /api/horoscope` route (`ICalculatedDetails extends CalculationResult`), exactly like Bhava Suchika.
- **`src/lib/manualChartDetails.ts`** (`synthesizeCalculation`, manual) — same call against the synthesized `planets`/`houses`/`ascendant` with `source: "manual"`; rides the `...synth` spread. `manualHousePlacements` remains the single source of truth and is never overwritten.
- **`src/models/CalculatedDetails.ts`** — no storage migration: `yogas` stays `[Schema.Types.Mixed]`, `doshas` stays `Schema.Types.Mixed` (line 114-115). **Additive only:** `yogaDoshaVersion: { type: Number }` to distinguish computed-empty from legacy.
- **`src/lib/recalculationJob.ts`** — **zero changes**: the job recomputes `CalculatedDetails` via `calculateHoroscope`/`synthesizeCalculation`, which now emit the new fields; no overrides exist to merge (unlike `mergeShadBalaya`).
- **`src/lib/search/textContent.ts`** — replace the raw `y.name` / `d.name` string reads with catalog-name resolution (`YogaDoshaNamesEn/Si[id.id] ?? id.id`) while **keeping the legacy string fallback** (`(y as {name?: string}).name`) so stored pre-feature docs keep their text; `isPresent` filtering on doshas stays untouched.
- **`src/lib/search/vocabulary.ts`** — add `YOGA_DOSHA_NAME_WORDS` (from the catalog name maps: `["ශනි","කුජ","ශනි-කුජ","ශනි කුජ යෝග","shani","mangala","shani mangala","parivartana","පරිවර්තන","මංගල","manglik","දෝෂය","dosha"]` merged into the existing `SINHALA_YOGA`/`ENGLISH_YOGA`/`DOSHA_WORDS` triggers) so specific-name queries parse bilingual.
- **`src/app/api/search/route.ts`** — extend `ExactCondition` with generic `{ yogaId: string }` / `{ doshaId: string }` matching `calculatedDetails.yogas.id` / `calculatedDetails.doshas.doshas.id` (catalog-driven — no hardcoded ids in the route).
- **`src/app/horoscopes/[id]/page.tsx`** + new components — `YogaAndDoshaSection` (renders `resolveYogas`/`resolveDoshas` output), `YogaTagGroup`/`DoshaTagGroup`, `YogaDoshaTag` (chip: present / cancelled-strikethrough / not-present states), `YogaDoshaDetailPanel` (expand/collapse accordion: name, why, result, cancellation, mitigation subsection, dasha note). Wired into the existing "Calculations / details" area, read-only on own/public/share views.
- **`src/app/search/page.tsx`** — the existing `yogas`/`doshas` card sections keep `isPresent`-based rendering; the name read changes to catalog-resolved names (legacy fallback kept).

## Data Flow

```
Horoscope creation / recalc / manual save
─────────────────────────────────────────
  calculateHoroscope / synthesizeCalculation─────────────┐
        │  result = { ascendant, houses, planets, ... } │
        ▼                                                │
  buildChartFacts(calc, tradition="MAIN_STREAM")          │
        ▼                                                │
  computeYogaDoshas(facts)  [src/lib/yogaDosha]           │
        │  per active catalog entry:                      │
        │    rules (relationships.ts helpers)             │
        │      → formation { rulesTriggered, primaryRule, │
        │                   strength 1..4, reasons[] }    │
        │    interpretation: house themes                 │
        │    cancellation (registered rules only)         │
        │    mitigation → finalAssessment.severity        │
        │    dashaActivation note                         │
        ▼                                                │
  result.yogas / result.doshas.doshas /                   │
  result.yogaDoshaVersion = 1                             │
        ▼                                                │
  ...calculated / ...synth spread → CalculatedDetails     │
  (recalculation job unchanged — no overrides)            │
───────────────────────────────────────────────────────────

Detail view (own / public / share link)
────────────────────────────────────────
  GET /api/horoscope/:id  →  stored yogas/doshas/yogaDoshaVersion
        ▼
  resolveYogas / resolveDoshas  (page render)
    ├─ stored-first when yogaDoshaVersion present
    └─ legacy docs (no version): pure render-time recompute
        from stored planets/houses/ascendant (no ephemeris)
        → warn log on corrupt values (resolveWargaKendara pattern)
        ▼
  YogaAndDoshaSection → YogaTagGroup | DoshaTagGroup
    → YogaDoshaDetailPanel (i18n keys yoga.* / dosha.* /
      yogaStrength.* / cancellationStatus.*, numeric params)

Search
──────
  textContent.ts (SI/EN) → catalog-name words (legacy fallback)
  vocabulary.ts          → YOGA_DOSHA_NAME_WORDS (both languages)
  /api/search            → yogaId / doshaId exact conditions
  search cards           → isPresent-based dosha rendering preserved
```

## API Contracts

**No new routes and no mutations.** Existing payloads grow additively:

| Method | Route | Request | Response |
| ------ | ----- | ------- | -------- |
| GET | `/api/horoscope/:id` | — | Horoscope JSON + `calculatedDetails.yogas` (`YogaEvaluation[]`), `calculatedDetails.doshas.doshas` (`DoshaEvaluation[]`), `calculatedDetails.yogaDoshaVersion` (optional). Read-only — no auth beyond the existing viewability gates. |
| GET | `/api/share/:token` | — | Same additive fields for share-link recipients. |
| POST | `/api/search` | query + `ExactCondition` now including optional `{ yogaId }` / `{ doshaId }` | Existing response; result cards read the structured names. |
| POST | `/api/auth/...`, others | — | Unchanged. |

## Dependencies

- **No new npm packages.** Everything uses existing dependencies (Mongoose, next-intl, pino, jyotish-calculations — the engine itself never touches the ephemeris wrapper).
- **No external services.**

## Migration / Compatibility

- **MongoDB:** no migration. `yogas`/`doshas` keep their Mixed column types; the new fields flow through the normal save path. The additive `yogaDoshaVersion` field needs no backfill.
- **Legacy documents** (`yogas: []`, `doshas: { doshas: [] }` pre-feature):
  - Search text content: legacy string `name` fields keep working via the dual read.
  - Detail view: `resolveYogas`/`resolveDoshas` recompute pure at render (no backfill, no job) — the same accepted pattern as `resolveWargaKendara`/Shad Bala lazy recompute.
  - Recalculation job: on the next full recalc (AstrologySettings change), the spread overwrites with the new structured shape + version.
- **Breaking changes:** none. `CalculationResult.yogas`/`DoshaInfo.doshas` retyping is compile-time additive; the runtime shape for legacy docs is still an array/object the current consumers already tolerate.

## Security Considerations

- **Read-only feature:** no create/update/delete surface for yogas/doshas anywhere. Existing viewability enforcement on `GET /api/horoscope/:id` and `GET /api/share/:token` (owner / public / valid share token) covers all reads; search remains privacy-filtered by the existing `$or` predicate.
- **No user input** flows into the engine, catalog, reasons or params — all rule conditions/intents are system-derived numeric enums; i18n params are numeric only, so no injection surface in message composition.
- **Rate limiting:** no new routes → no new rate-limit policy needed.
- **Provenance integrity:** cancellation/mitigation factors carry `tradition`; conflicting traditions are never silently combined (BA data-model rule) — the engine consults only registered rules of the evaluated `facts.tradition`.

## Verification

1. **TypeScript compile** — `pnpm build` (or `npx tsc --noEmit`) passes with the retyped `yogas`/`doshas`.
2. **Catalog integrity test** (part of the yogaDosha test file):
   - unique catalog ids; every rule id referenced in the catalog exists in `rules.ts`;
   - every `reasonKey`/`nameKey`/theme/expression/cancellation key resolves in **both** `src/messages/en.json` and `si.json`;
   - `YOGA_DOSHA_CATALOG` rows match `specs/business-analysis/data-model.md` §Yoga/Dosha Rule Catalog seed table.
3. **Relationship unit tests** on synthetic `ChartFacts`:
   - same-house Saturn/Mars → SM-01 fires, strength 1, primary `SM-01`;
   - opposite-house pair with mutual 180° aspects → SM-02 + SM-03, primary per catalog order;
   - 4/10 pair with stored mutual special aspects → SM-04;
   - Saturn in Capricorn + Mars in Aries (sign exchange; sample chart) → SM-05;
   - 2/12 pair under `MAIN_STREAM` → not triggered; under the gating tradition → SM-06.
4. **Golden test** with the existing fixture (`baseData` — 1990-06-15 08:30, Colombo 6.9271/79.8612, male, lahiri, `src/__tests__/calculation.test.ts`):
   - `calculateHoroscope(baseData).yogas` is a valid `YogaEvaluation[]`; every entry matches the schema invariants (`formation.rulesTriggered` non-empty, `formation.strength` ∈ 1..4, `cancellation.status` ∈ 1..3, no `exists: false` entries persisted).
   - Shape/behaviour is identical under `source: "manual"` when built from the same placements (`synthesizeCalculation`).
5. **Existing tests pass** — `npx jest` (calculation, search text content, vocabulary, recalculation).
6. **Manual smoke:**
   - auto horoscope + manual horoscope (with the same placements) show the same Yoga tags/detail panels;
   - a legacy document (strip `yogaDoshaVersion`) still renders via `resolveYogas`;
   - search query "ශනි-කුජ යෝග" / "shani mangala yoga" matches a Shani–Mangala horoscope and the card dosha/yoga sections keep `isPresent` behavior;
   - own/public/share-link views are read-only (no edit affordances), SI/EN render correctly.

## Incremental Addition Checklist (US-YD-013)

Adding a new yoga/dosha is **additive and non-breaking**:

1. Domain confirms the formation rules + strength table + cancellation/mitigation rules (one-by-one).
2. Add `CatalogEntry` row in `src/lib/yogaDosha/catalog.ts` (`status: "active"`).
3. Add rule functions in `src/lib/yogaDosha/rules.ts` (+ relationship helpers if needed).
4. Add i18n keys (`yoga.<id>.name/rule.*/theme.*/expression.*/dashaNote`, `dosha.<id>.*`, `yogaStrength.*`, `cancellationStatus.*`) to **both** `en.json` and `si.json`.
5. Add the bilingual name to `YogaDoshaNamesEn/Si` + `YOGA_DOSHA_NAME_WORDS` in `vocabulary.ts`.
6. Add unit + catalog-integrity tests.
7. `pnpm format`, `pnpm lint`, `npx jest`, `pnpm build`.

## Open Questions (domain confirmations needed)

- **OQ-1** — resolved by Rev 6: parivartana is no longer a Shani Mangala rule — moved to **Agni Marutha AM-08** (strength 1 default). The seed-table rows (SM-01..SM-06) above describe the **rev 3→5** Shani Mangala; since the 2026-09-06 domain change (`docs/agni-marutha-dosha.md`) the implemented catalog is: **Shani Mangala** = 3 rules (SM-01 conjunction 1, SM-02 7th-from-each-other + mutual 180° drishti 2, SM-03 mutual 4-10 + mutual 90°/270° drishti 2) and **Agni Marutha** = 8 rules (am01 conjunct 1, am02/am03 aspect 2, am04/am05 sign ownership 2, am06/am07 nakshatra lord 3, am08 parivartana 1) — see dev spec Revision 6/7. `shaniMangala.sm01`/`agniMarutha.am01` share the conjunction predicate; no explicit inheritance in the engine.
- **OQ-2** — resolved by Rev 6/7/9: mutual drishti is now **required** inside SM-02/SM-03 and the **orb gate** applies to SM-01 (per the 2026-09-07 corrections — real charts `6a68e773…` and `6a74b291…`). SM-01/02/03 read **stored** aspect records only (never recomputed — US-YD-002 edge); both directions must be present within the per-planet orbs (the stored records are orb-filtered at compute time): SM-02/03 need mutual 180°/90/270 records, and SM-01 (same sign + house) additionally needs the mutual 0° conjunction records — a 13.57°-apart co-located pair (6a74b291) is Agni Marutha only (am04). `yogaDoshaVersion` is `4`; stored v1..v3 documents recompute on read. For Agni Marutha, am02/am03 replace the old mutual-drishti clause.
- **OQ-3** — resolved by Rev 6: 2/12 is **removed from both doshas** (no SM-06 / no tradition-gated row; `RULE_TRADITION_GATES` deleted).
- **OQ-4** — `manglik` seed: confirm MK-01 house set (1/4/7/8/12) **and** the cancellation rules (own-sign, Moon-sign/Chandra exemptions, etc.) before flipping `status` to `active`.
- **OQ-5** — Cancellation/mitigation rules for Shani–Mangala (Jupiter aspect, own-sign dignity): the Jupiter mitigation (`sm-mit-001`) is registered; Agni Marutha has **no mitigation/cancellation rules yet** (doc covers existence only — pending domain confirmation).
- **OQ-6** — Sinhala translations for yoga/dosha names, themes and expressions (English authoritative from `docs/shani-mangala-yoga.md`).