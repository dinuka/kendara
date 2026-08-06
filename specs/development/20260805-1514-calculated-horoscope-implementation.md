# Calculated Horoscope (Manual Entry) — Implementation

**Date:** 2026-08-05 15:14
**Author:** Developer
**Based on:** `specs/business-analysis/20260805-1514-calculated-horoscope.md`, `specs/architecture/20260805-1514-calculated-horoscope.md`, `specs/ux/20260805-1514-calculated-horoscope.md`, `specs/qa/20260805-1514-calculated-horoscope-test-plan.md`

---

## Summary

Implemented the Calculated Horoscope feature: a **"Calculated Chart" mode** in the Add Horoscope flow and an **Edit Chart** workflow on the detail page. Students enter a Lagna (and optional Navamsa Lagna + Navamsa placements) and place the 9 planets in a derived 12-house table; the system derives aspects, conjunctions, a planets table, validation badges, and probable birth ranges.

Manual horoscopes are stored with `Horoscope.source: "manual"`; the house placements are the single source of truth and all derived output (planets table, derived ranges) is always recomputed. Validation is advisory and non-blocking.

---

## Delivered

### Server / logic
- `src/lib/manualChart.ts` — new **pure** derivation engine (no ephemeris): `deriveHouseSigns`, `computeAspects`, `computeConjunctions`, `placementsToMap`, `buildHouses`, `validatePlacements`, `computePlanetStrength`, `deriveNavamsaData`, `derivePlanetsTable`, `deriveBirthTimeRange`, `deriveBirthMonthRange`, `deriveBirthDateCandidates`, `deriveAgeRanges`, `deriveRanges`, `compute`, plus config tables (`BIRTH_TIME_RANGES`, `BIRTH_MONTH_RANGES`, `BIRTH_DATE_BASE`, `SHANI_MONTHS_FOR_SIGN`), `formatNavamsaDegreeRange`, and `buildWholeSignHouses`. All astrological values stay as **numeric enums** (`Planet`, `PlanetaryStrength`, `ZodiacSign`).
- `src/lib/manualChartDetails.ts` — new shared **payload parser** `parseManualChartBody` (strict: lagna + navamsaLagna 1–12, house keys 1–12, planet enums 1–9, no duplicate planet within a chart, `navamsaLagna` required when `navamsaHouses` present) and **synthesis** helpers: `synthesizeAscendant`, `synthesizePlanets`, `synthesizeCalculation` (full `CalculationResult` shape with empty dasha arrays), `synthesizeNavamsaCalculation` (null when no navamsa houses; D9 lagna = entered Navamsa Lagna), and `getCurrentShani` (best-effort, wraps `computeCurrentPlanets`; returns null on failure so age ranges degrade gracefully).
- `src/app/api/horoscope/manual/route.ts` — `POST`. Session → `connectDB` → JSON/name validation → `parseManualChartBody` → `getCurrentShani` + `compute` → create `Horoscope` (`source: "manual"`, `displayName` from body, privacy/ayanamsha/gender defaults) → create `CalculatedDetails` (synthesized fields + `manualHousePlacements` + `derivedRanges`) → insert `Chart` BIRTH (+ NAVAMSA_D9 when navamsa houses present) via `generateChartSvg` → fire-and-forget `indexHoroscope` → 201.
- `src/app/api/horoscope/[id]/manual-chart/route.ts` — `PUT`. Owner-only; rejects non-`manual` horoscopes (409). Recomputes via `parseManualChartBody` + `compute` + `getCurrentShani`, upserts `CalculatedDetails` (replacing `manualHousePlacements`/`derivedRanges` + synthesized fields), deletes + re-inserts BIRTH/D9 `Chart` docs, fire-and-forget `reindexHoroscope`.
- `src/app/api/horoscope/[id]/route.ts` — GET unchanged (manual fields ride along on `CalculatedDetails`). PUT now skips ephemeris recalculation for `source: "manual"` horoscopes (birth-detail edits are not applicable).
- `src/lib/calculation.ts` — `calculateHoroscope` now throws a clear error when `birthDate` is missing (guards the now-optional field; manual horoscopes never reach this path).

### Models
- `src/models/Horoscope.ts` — new `HoroscopeSource = "auto" | "manual"`, `source` field (enum, default `"auto"`); `birthDate`/`birthTime` are no longer required.
- `src/models/CalculatedDetails.ts` — added optional `manualHousePlacements` and `derivedRanges` (both `Schema.Types.Mixed`) alongside the embedded `CalculationResult` shape (per `specs/business-analysis/data-model.md`).

### Client / UI
- All components under `src/components/ManualChart/`: `ModeToggle`, `ManualChartEditor` (orchestrates create + edit; owns name/lagna/placements state; live `compute` preview), `HouseTableEditor`, `NavamsaHouseTableEditor`, `PlanetPicker` (shared unplaced-planet popover), `ValidationBadges`, `PlanetsTable` (birth + navamsa enrichment columns), `DerivedRanges`, `visuals` helper (sign/planet glyphs + colors), and `ManualChartDetailPanel` (read-only detail rendering). Plus `src/components/CalculatedChartBadge.tsx`.
- `src/app/horoscopes/new/page.tsx` — added the `ModeToggle` segmented control; the existing Birth Details form is unchanged while `Calculated Chart` renders `ManualChartEditor mode="create"`.
- `src/app/horoscopes/[id]/page.tsx` — shows `CalculatedChartBadge`, hides the birth-details line, and swaps the pencil for an **Edit Chart** button (owner only) that opens `ManualChartEditor mode="edit"` (pre-loaded from stored placements). The calculations tab prepends `ManualChartDetailPanel` for manual horoscopes.
- `src/messages/en.json` + `src/messages/si.json` — new `manualChart` namespace (mode labels, column headers, validation messages, derived-range labels, months, actions, toasts); **kept in sync** (verified identical key sets).

### Tests
- `src/__tests__/manualChart.test.ts` — **69 tests** covering house derivation, aspects/conjunctions, validation states (including 9-planet counts), strength, navamsa enrichment (incl. navamsa-lagna-derived signs), all four derived range types, and edge cases. All 69 pass.

---

## Verification

| Check | Result |
|-------|--------|
| `npx jest src/__tests__/manualChart.test.ts` | 69 passed, 0 failed |
| `pnpm build` (TypeScript + production build) | exit 0, compiled + static pages generated |
| `npx jest` (full suite) | 337 passed / 11 failed — the 11 are pre-existing failures in `privacy.test.ts` + `search-combined.test.ts` (verified to fail identically on the clean tree via `git stash`; unrelated to this feature) |
| `npx tsc --noEmit` | clean for all ManualChart/manual-chart files |
| `pnpm lint` | blocked by a pre-existing environment-wide crash (`eslint-plugin-react` vs ESLint 10, fails loading `eslint.config.mjs` itself); no feature-specific lint errors surfaced |
| i18n parity | en/si `manualChart` namespaces have identical key sets |

---

## Notes / Decisions

- **No degree input** in v1 — manual planets carry degree from navamsa segment start (or 0). Planets-table strength and navamsa strength are **sign-based** (exaltation/debilitation/moolatrikona/own/friend/enemy/sama evaluated at degree 0) — not hardcoded Sama.
- **Navamsa** entered via an optional **Navamsa Lagna (D9)** field plus per-house placements in a derived 12-house table (House | Sign | Planets — no aspects column). Navamsa house signs derive whole-sign from the Navamsa Lagna; D9 charts are generated only when navamsa placements are present. The server requires `navamsaLagna` whenever `navamsaHouses` are provided. Legacy stored charts without `navamsaLagna` fall back to the birth lagna in the detail panel/editor preload (`navamsaLagna ?? lagna`).
- **Live preview vs persisted ranges**: the client preview calls `compute` without a current-Shani value (ephemeris is server-only), so the **ages** row shows `—` in preview; the persisted `derivedRanges` (with age ranges from the server) appear on the detail page.
- **Advisory validation** — neither route blocks save on Budha/Sikuru/Rahu–Ketu violations; badges stay visible.
- **9-planet count** — advisory validation for both charts: `planetCount` ("N/9 planets placed") on the birth chart, `navamsaPlanetCount` on the navamsa chart (only when navamsa is entered). Both are non-blocking (`valid` at 9, else `incomplete`; `skipped` when the optional navamsa chart is absent).
- **Search parity** deferred (out of scope for v1); manual horoscopes are indexed/reindexed by the same indexer used for `auto`.