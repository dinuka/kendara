# Yogakaraka (යෝගකාරක) — Implementation

**Date:** 2026-08-14 19:52
**Author:** Developer (BMAD)
**Based on:** docs/yogakaraka.md, specs/architecture/overview.md, specs/business-analysis/data-model.md, specs/qa/ (maranakaraka U048 pattern)

---

## Files Changed

| File | Change |
| ---- | ------ |
| `src/lib/astrology.ts` | Added local `SIGN_LORD` map, `computeYogakaraka(ascSign)` pure function, and `yogakaraka: number[]` on `CalculationResult` |
| `src/lib/calculation.ts` | Imported `computeYogakaraka`; computes `yogakaraka = computeYogakaraka(ascSign)` for auto charts and adds it to the returned `CalculationResult` |
| `src/lib/manualChart.ts` | Imported `computeYogakaraka`; `derivePlanetsTable` computes it from the lagna and pushes `"yogakaraka"` into the row's `other` array; `synthesizeOtherDetails` now also returns `yogakaraka` |
| `src/models/CalculatedDetails.ts` | Added `yogakaraka: [Number]` schema field after `maranakaraka` |
| `src/components/ManualChart/PlanetsTable.tsx` | Added `yogakaraka: "yogakaraka"` to `OTHER_KEYS` so the tag renders in the Other column |
| `src/messages/en.json` | Added `yogakarakaLabel` (horoscope-detail labels) and `yogakaraka` (manualChart section) |
| `src/messages/si.json` | Same two keys in Sinhala |
| `src/lib/search/textContent.ts` | Appended "Yogakaraka: …." / "No Yogakaraka." (EN) and "යෝගකාරක: …." / "යෝගකාරක නොමැත." (SI), guarded for legacy docs |
| `src/__tests__/calculation.test.ts` | Added `describe("computeYogakaraka")` block (Taurus/Libra/Cancer → planet, Aries → [], invalid throws) + result-carries-field test |
| `src/__tests__/manualChart.test.ts` | Added U049/U049a/U049b Other-column tests |
| `src/__tests__/search-rag.test.ts` | Added required `yogakaraka` field to both `CalculationResult` fixtures + EN/SI text assertions |

## New Files Created

| File | Purpose |
| ---- | ------- |
| `specs/development/20260814-1952-yogakaraka-implementation.md` | This implementation spec |

## Implementation Notes

### `computeYogakaraka` signature & behavior

```ts
export function computeYogakaraka(ascSign: number): number[]
```

- Whole-sign counting from the lagna: house N's sign = `((ascSign - 1 + N - 1) % 12) + 1`.
- A planet qualifies when it owns (by sign lordship) any Kendra house (4, 7, 10) AND any Trikona house (5, 9). 1st house is excluded from both.
- Rahu/Ketu own no signs, so they can never qualify (the sign-lord map only covers planets 1–7).
- Returns the qualifying planet(s) sorted ascending; empty array when none (e.g. Aries lagna).
- Throws `Invalid lagna: <n>` for a non-integer or out-of-range lagna — mirrors `deriveHouseSigns` in `manualChart.ts` (which is always called first in `derivePlanetsTable`, so the throw is unreachable there but guards direct callers).
- Uses a **local `SIGN_LORD` copy** in `astrology.ts` because `manualChart.ts` imports `astrology.ts` — importing the `manualChart.ts` copy would be circular. This follows the existing precedent (`calculation.ts:126`, `currentPlanets.ts:67`, `chartDataTransform.ts:50`).
- Verified examples: Taurus lagna → `[7]` (Saturn: 9th Capricorn + 10th Aquarius); Libra lagna → `[7]` (4th Capricorn + 5th Aquarius); Cancer lagna → `[3]` (5th Scorpio + 10th Aries); Aries lagna → `[]`.

### How `synthesizeOtherDetails` (item 4) was handled

`synthesizeOtherDetails` lives in **`src/lib/manualChart.ts`** (not `manualChartDetails.ts`); `manualChartDetails.ts` consumes it via `const otherDetails = synthesizeOtherDetails(...)` and spreads `...otherDetails` into the synthesized `CalculationResult`. So the fix was:

1. Add `"yogakaraka"` to the `Pick<CalculationResult, …>` return type.
2. Add `yogakaraka: computeYogakaraka(lagna)` to the returned object (next to `maranakaraka: computeMaranakaraka(planets)`).

`manualChartDetails.ts` needed **no code change**: `synthesizeCalculation` picks it up automatically through the spread, so new manual-chart `CalculatedDetails` docs stored in MongoDB carry the field.

**D9 (`synthesizeNavamsaCalculation`):** mirrors maranakaraka exactly — the D9 result is built by spreading `base = synthesizeCalculation(result, birthDate)` (which now includes the D1-lagna `yogakaraka`) and overriding only `ascendant`, `houses`, `planets`. Maranakaraka is likewise the D1 value carried through the spread; no D9-specific yogakaraka is synthesized, matching the maranakaraka behavior.

### Deviations from the maranakaraka pattern

1. **Search-text guard for legacy docs.** Maranakaraka reads `calc.maranakaraka.length` directly; `yogakaraka` uses `(calc.yogakaraka?.length ?? 0) > 0` and `calc.yogakaraka ?? []` because legacy `CalculatedDetails` documents predate the field (the type says `number[]`, but runtime lean docs from MongoDB may lack the key). This is a read-path-only guard; new docs always carry the field.
2. **i18n Sinhala "none" phrasing.** The SI search line uses `යෝගකාරක නොමැත.` per the feature spec, whereas the maranakaraka line uses `මරණකාරක නැත.` — both "no …" in Sinhala, kept as specified.
3. Everything else follows the maranakaraka commit exactly: shared pure lib function typed on `CalculationResult`, computed in `calculation.ts` for auto charts, computed in `derivePlanetsTable` + `synthesizeOtherDetails` for manual charts, `[Number]` schema field, `OTHER_KEYS` tag, both i18n keys, and search index text.

### Notes

- Shad Bala / naisargika logic was **not** touched — the doc only requires the planets-table "Other" column plus the stored field, and `shadbalaya` is computed from `maranakaraka` only.
- `astrologyEnums.ts` was not touched — no new enum needed since planets/signs are already numeric enums; display names resolve via i18n at render.
- The search-rag test fixtures were given `yogakaraka` values consistent with their ascendants (MOCK_CALC Aries → `[]`; minimalCalc Leo → `[3]`, since Mars owns 4th Scorpio and 9th Aries).

## Verification

1. `npx jest src/__tests__/calculation.test.ts` → **41 passed**
2. `npx jest src/__tests__/manualChart.test.ts` → **117 passed**
3. `npx jest src/__tests__/search-rag.test.ts` → **85 passed**
4. `npx jest` (full suite) → 629 passed, 11 failed in 2 suites (`privacy.test.ts`, `search-combined.test.ts`) — **identical to the pre-existing baseline** confirmed via `git stash` (clean tree: same 11 failures, same suites; unrelated to this feature).
5. `pnpm build` → ✓ Compiled successfully, 29/29 static pages generated.
6. `pnpm lint` → fails to run with an internal ESLint crash (`eslint-plugin-react`/`react-display-name` incompatible with ESLint 10.7.0) while linting `eslint.config.mjs` itself — **confirmed pre-existing** on the clean tree via `git stash`; not caused by this change.
7. `npx tsc --noEmit` → no errors in any non-test source file. The only reported errors are `Cannot find name 'test'/'expect'/'describe'` in `__tests__/` (jest globals not visible to bare `tsc`; these are checked by ts-jest at test time and all test suites pass). Baseline comparison: 2336 errors clean vs 2341 with this change — the +5 are the new `test`/`expect`/`describe` tokens in the added tests, same false-positive category.
