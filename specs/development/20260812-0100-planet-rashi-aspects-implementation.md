# Development Implementation — Planet Aspects + Rashi Aspects

**Date:** 2026-08-12

Companion BA specs: `20260809-2133-planet-aspects.md`, `20260810-0800-rashi-aspects.md`.
Test plan: `20260810-1245-planet-rashi-aspects-test-plan.md`. Architecture: `20260809-2145-planet-aspects.md`.

## Files Created

| File | Description |
|------|-------------|
| `src/lib/planetAspects.ts` | Pure module (no Mongoose): `PlanetAspectSetting`/`PlanetAspectsMap`, `DEFAULT_ASPECT_HOUSES` (authoritative 9-planet table), `defaultAspectDegrees` (per-planet default degrees derived from the default aspect houses, H → (H−1)×30 — replaces the old flat `DEFAULT_ASPECT_DEGREES`; Sun 3/5/7/9/10 → 60/120/180/240/270), `VALID_ASPECT_DEGREES`, `BENEFICIAL_ASPECT_ANGLES`, `DEFAULT_ORBS`, `aspectPointSignedDelta`, `resolveOrb`, `resolveAspectHouses`, `resolveAspectDegrees`, `validatePlanetAspectsPayload`, `derivePlanetAbsoluteDegree`, `computePlanetAspects`, `computeHouseAspectsByPlanet`, `computeHouseAspectsByHouse`, `computeManualPlanetAspects`, `computeManualHouseAspects`. |
| `src/lib/rashiAspects.ts` | Pure module: `RashiCategory`, `RashiAspectOverride`, `RashiAspectsSetting`, `RASHI_CATEGORY`, `DEFAULT_RASHI_ASPECTS` (`{enabled:false, overrides:{}}`), `computeRashiAspectSigns` (12-row derived lookup), `validateRashiAspectsPayload`, `isRashiEnabledForSign`, `computeRashiHouseCandidates`, `computeRashiPlanetCandidates`, `rashiReasonForTarget`, `computeHouseAspectsByPlanetWithRashi`, `computeHouseAspectsByHouseWithRashi`, `mergeRashiIntoPlanetAspects`. |
| `src/lib/aspectTooltip.ts` | Pure tooltip composer (UX §8.1.1): `formatSignedDelta` (signed `d:mm:ss`), `relativeAspectHouse` (`((aspectType/30)%12)+1`, null for 0°), `composeAspectTooltip` — one line per distinct reason; a single reason keeps the inline signed delta; ≥2 reasons render one line per reason WITHOUT deltas plus one shared `Δ {delta}` footer (delta exactly once). Ordering planetary → rashi. Legacy aspects (no `reasons`) degrade to a single planetary line. |
| `src/components/aspects/AspectTooltip.tsx` | Compact reason-line tooltip (`role="tooltip"`): reason lines at 12px/1.5, hairline-separated `Δ {delta}` footer when ≥2 reasons, `max-width` 280px (320px in SI), wider surface per §8.1.1. |
| `src/components/aspects/AspectChip.tsx` | Planets/houses table aspect chip — planet name only (no inline angle/delta); anchors the tooltip with viewport-safe `position:fixed` clamping; hover (150ms delay)/focus/tap open, `Esc`/blur/mouseleave close; `aria-describedby` + `title` fallback carry the full text (delta exactly once). |
| `src/__tests__/aspectTooltip.test.ts` | 10 tests: `formatSignedDelta` (sign/pad), `relativeAspectHouse`, single planetary line (inline delta), single rashi line (no angle), conjunction house-omission, legacy no-reasons fallback, houses-table row-house override, multi 2-line (delta once), multi 3-line (one footer), planetary-before-rashi ordering. |
| `src/__tests__/planetAspects.test.ts` | 24 tests: constants/resolution, validation, planet aspects, degree fallback, house aspects, manual adapters. |
| `src/__tests__/rashiAspects.test.ts` | 26 tests: all 12 rashi rows, categories, validation, sign enablement, candidates, rashi/planetary reason merge, house-aspect rashi arm (ON/OFF contrast via the arc-5/150° house that only rashi reaches). |

## Files Modified

| File | Description |
|------|-------------|
| `src/lib/astrology.ts` | Added `AspectReason` interface; `Aspect.delta?` + `Aspect.reasons?`; `House.aspectingPlanets?` (additive, backward compatible). |
| `src/lib/calculation.ts` | `calculateHoroscope(data, planetaryOrbs, planetAspects?, rashiAspects?)`. Replaced the `ASPECT_TYPES`/`gap<30` loop with `mergeRashiIntoPlanetAspects(computePlanetAspects(...))`; populates `houses[].aspectingPlanets` via `computeHouseAspectsByHouseWithRashi`. Removed dead `ASPECT_TYPES`. |
| `src/lib/manualChart.ts` | `ManualAspectOptions` (planetAspects/planetDegrees/planetaryOrbs/rashiAspects/navamsaSigns) threaded through `ManualChartInput`/`ManualChartResult`, `computeAspects(houseOfPlanet, houseSigns, options)` → delegates to `computeManualHouseAspects` + `computeHouseAspectsByPlanetWithRashi`, and through `buildHouses`/`derivePlanetsTable`/`compute`. Removed the old hardcoded `ASPECT_HOUSES`. |
| `src/lib/manualChartDetails.ts` | `synthesizeCalculation` now populates `planets[].aspects` via `computePlanetAspects` + `mergeRashiIntoPlanetAspects` (UT-AS-252/253). |
| `src/models/User.ts` | Added `planetAspects` and `rashiAspects` Mixed fields. |
| `src/app/api/settings/route.ts` | GET returns `planetaryOrbs` + `planetAspects` + `rashiAspects`; PUT validates each provided setting through the pure-module validators. |
| `src/app/api/horoscope/route.ts` | Auto POST passes user `planetAspects`/`rashiAspects` into `calculateHoroscope`. |
| `src/app/api/horoscope/[id]/route.ts` | Recalc path passes the two settings into `calculateHoroscope`. |
| `src/app/api/horoscope/manual/route.ts`, `src/app/api/horoscope/[id]/manual-chart/route.ts` | Thread the user's aspect settings into `compute` via `aspectOptions`. |
| `src/app/settings/page.tsx` | Settings UI: per-planet house (1–12) + degree (60/90/120/180) editor with per-planet reset/customize, and the Rashi Aspects master toggle + per-sign opt-out chips. |
| `src/messages/en.json`, `src/messages/si.json` | New `settings.planetAspects*` / `settings.rashiAspects*` keys, kept in sync; plus the aspect-tooltip keys `astrology.drishti.*` (label/rashiLabel/line/lineNoHouse/lineMulti/lineMultiNoHouse/rashiLine/rashiLineWithDelta/deltaFooter/arrow/rashiVerbAria/delta), `astrology.aspectAngles.*` (30–330 labels per UX §2.2), and `astrology.aspectReason.infoGlyph`, kept in sync. |
| `src/app/horoscopes/[id]/page.tsx` | Planets + houses tables render the old inline `aspects.join(", ")` (planet name + `(dd:mm:ss)`) as `AspectChip`s (planet name only, tooltip on hover/focus/tap). `getManualAspects` now returns `Aspect[]`: stored `p.aspects` (with `reasons`, incl. rashi) preferred, legacy records re-derived via `computeManualPlanetAspects` with conjunction records filtered. Houses table builds a per-aspecting-planet single-reason `Aspect` (angle + row-house delta) for the tooltip. |
| `src/__tests__/manualChart.test.ts` | Updated UT-CH-030..037 + U046 to the new authoritative defaults (union of explicit offsets + degree arm) and the `computeAspects(houseOfPlanet, houseSigns, options)` signature. |

## Key Design Decisions

1. **Two pure modules, one shared engine.** `planetAspects.ts` owns the configurable Planet-Aspects arms; `rashiAspects.ts` imports only from it (one-directional, no cycles) and adds the rashi arm + the union/merge composers. No duplicated matching logic.
2. **Aspect data is extended additively** (`delta?`, `reasons?: AspectReason[]`); existing fields unchanged → legacy consumers and stored snapshots unaffected. `isBeneficial` stays the sole 60/120 flag; rashi reasons use the rashi angle for their own line and the top-level `delta`/`aspectType` reflect the planetary (primary) reason when both exist.
3. **Union semantics (auto + manual).** House aspects = explicit `houses` arm (absolute when configured, else default offsets from whole-sign house) ∪ degree arm (aspect points `abs±d` within the planet's orb of the house middle) ∪ rashi arm (houses whose whole-sign sign is rashi-aspectable and within orb). Planet aspects = planetary degree arm ∪ rashi targets, each target holding every distinct reason (planetary first, rashi appended).
4. **`DEFAULT_ORBS` duplicated** in `planetAspects.ts` (already duplicated in `calculation.ts`/`User.ts`) to keep the pure module Mongoose-free — matches the existing pattern.
5. **Rashi angle** = `30 × zodiacal minor-arc gap`; signed `delta` = signed shortest arc from the closest aspect point to the target; effectiveness requires `|delta| ≤` the aspecting planet's orb. Degree-arm orb `<=` (inclusive) matches the pre-existing `bestDiff < 30`-style tolerance per plan UT-PA-010.
6. **Manual degree fallback** (`derivePlanetAbsoluteDegree`): entered `planetDegrees` wins → navamsa-segment midpoint when the planet's navamsa sign is known → sign midpoint (15°). Manual `compute()` resolves the navamsa signs before building houses so both charts use the same fallback.
7. **Rashi disabled by default** (`{enabled:false, overrides:{}}`) — calculation unchanged until the student enables it (backward compatible, per BA US-RA default state).
8. **Settings PUT validates each provided key independently** through `validatePlanetAspectsPayload` / `validateRashiAspectsPayload` (all-or-nothing per key); the existing `planetaryOrbs` path is unchanged so old clients keep working.
9. **Ubaya tie-break** reproduces the authoritative 12-row table by excluding the higher sign number among equidistant nearest candidates.

## Test Results

```
Test Suites: 20 passed, 2 failed (pre-existing env-only), 22 total
Tests:       494 passed, 11 failed (pre-existing), 505 total
```

New coverage: `planetAspects.test.ts` (24), `rashiAspects.test.ts` (26), `aspectTooltip.test.ts` (10), and updated `manualChart.test.ts` UT-CH-030..037/U046. The 11 remaining failures are `search-combined.test.ts` + `privacy.test.ts`, which fail identically on the pre-change baseline (require a running MongoDB) — unrelated to this feature.

`tsc --noEmit` clean (src only; the Jest-global errors in test files are pre-existing). `pnpm lint` is currently broken at the tooling level (ESLint 10 vs `eslint-plugin-react`), pre-existing, unrelated.

## Deviations from UX §8 (documented for QA/PM)

1. **Tooltip templates live in the shared pure module.** `composeAspectTooltip` (`src/lib/aspectTooltip.ts`) builds the reason lines exactly as the §12 `astrology.drishti.*` keys spell them (they are added to both locales for spec parity, but the tooltip renders via the pure composer so the single/multi/delta-once rules are unit-tested — `aspectTooltip.test.ts`).
2. **Houses-table chips use a client-derived single planetary reason.** The houses table keeps its existing per-house angle + signed delta derivation (`getAspectsToHouse`, orb-filtered) and wraps it in a single-reason tooltip (`{label} {house} ({angle}) ({delta})`, row house) — matching §8.2's example exactly. `houses[].aspectingPlanets` (name-only, no per-house matched angle/reasons) is NOT yet the chip source; switching to it would lose the tooltip's angle/delta and is a follow-up needing stored per-house reasons.
3. **Mobile `ⓘ` info glyph not rendered in v1** (§8.1.1 Interaction). Chips are plain buttons; tap toggles the tooltip and the `title` fallback carries the full text (delta exactly once) for touch/no-JS users.
4. **Cross-chip "only one tooltip open"** (§8.1.1) is enforced naturally by per-chip hover/focus state; no global singleton management in v1.

## Open / Outstanding

1. Owner view-time re-derivation on settings change (RE-AS-321) is out of scope for v1 — aspects are stored at create/update time; new/edited charts reflect the current settings.
2. Houses-table chips still source from the client-side special-aspect derivation rather than stored `houses[].aspectingPlanets` (see Deviations §2) — revisit if per-house reasons are added to the aspect record.
3. Mobile `ⓘ` info glyph and global single-tooltip management are UX §8.1.1 polish, deferred (see Deviations §3/§4).
