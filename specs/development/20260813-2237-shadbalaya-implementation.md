# Development Implementation — Shad Bala (ෂඩ් බලය) Table

**Date:** 2026-08-13

Companion specs: `20260813-2011-shadbalaya-architecture.md`, `20260813-2030-shadbalaya.md` (UX), `20260813-2052-shadbalaya-test-plan.md` (QA §18). Core pure-logic library (`src/lib/shadBalaya.ts`, `src/lib/shadBalayaTooltip.ts`) landed in an earlier session with passing suites; this change wires it end-to-end.

## Files Created

| File | Description |
|------|-------------|
| `src/app/api/horoscope/[id]/shadbalaya/route.ts` | PATCH endpoint (arch §API contract lines 244-280). Body `{ planet: int 1-9, bala: ShadBalayaKey, value: boolean }`, validated manually (`parseToggleBody`) — no schema lib, matching the repo's `parseManualChartBody` style. Auth: `getServerSession(authOptions)` → 401; `Horoscope.findById` → 404; owner **or super-admin** → 403 (unlike privacy, super-admin MAY mutate Shad Bala). Persists ONLY the dotted path `$set: { "shadbalaya.<planet>.<bala>.value": value, "shadbalaya.<planet>.<bala>.overridden": true }` — no computation in the route. |
| `src/components/shadbalaya/ShadBalaTable.tsx` | Client table (UX §2): 8-column × 9-row desktop table + per-planet mobile cards. Optimistic toggles (sets `value` + `overridden: true` immediately), 500 ms per-cell debounce with last-write-wins, rollback to `prevValue`/`prevOverridden` + localized `toast.saveError` on PATCH failure, pending debounces flushed with `fetch(..., { keepalive: true })` on unmount (RE-SB-214). Read-only mode (`!isEditable`) renders disabled checkboxes + ⓘ glyph + `readOnlyNotice`. Ratio `(n/6)` derived at render via `ratioFormat`/`ratioAria` (US-SB-010 — never stored). |
| `src/components/shadbalaya/ShadBalaTooltip.tsx` | Compact reason tooltip (`role="tooltip"`), mirroring `AspectTooltip`: bold bala-name heading, `✓/✗ ... because:` state line, `· reason` lines, hairline-separated indigo override footer. Positioned via fixed coordinates from `ShadBalaCell`. |
| `src/__tests__/shadbalayaApi.test.ts` | 10 API tests: 401 / 404 (horoscope) / 403 non-owner / 404 (no CalculatedDetails) / 400 out-of-range + non-integer planet / 400 unknown bala / 400 non-boolean value / 200 owner sparse `$set` (value + `overridden: true`) / 200 super-admin allowed. |

## Files Modified

| File | Description |
|------|-------------|
| `src/lib/astrology.ts` | `CalculationResult.shadbalaya?: ShadBalaya` — **optional** (see Design Decision 1). Maranakaraka correction: `computeMaranakaraka` now returns `number[]` (every planet in its designated death house, not Chandra-by-default), `CalculationResult.maranakaraka: number[]`, plus `normalizeMaranakaraka(value: number \| number[] \| null \| undefined)` for legacy scalar values. |
| `src/models/CalculatedDetails.ts` | Added `shadbalaya: { type: Schema.Types.Mixed }` schema field. Maranakaraka correction: `maranakaraka: [Number]` (was scalar) — mongoose wraps legacy scalar values, `0`/empty dropped by `normalizeMaranakaraka`. |
| `src/lib/calculation.ts` | `calculateHoroscope` return now computes `shadbalaya: computeShadBalaya(planetDetails, houses, { source: "auto", thithi, day: deriveDay(planetDetails, houses), maranakaraka })`, reusing the already-computed maranakaraka. |
| `src/lib/manualChartDetails.ts` | `synthesizeCalculation` now computes `shadbalaya` with `source: "manual"` (day/night omitted — no birth time) and the maranakaraka from `synthesizeOtherDetails`. |
| `src/lib/recalculationJob.ts` | Both `recalculateOne` branches merge `mergeShadBalaya(computed.shadbalaya ?? {}, existing?.shadbalaya)` before persisting (US-SB-013: overrides survive recalculation). The auto branch now fetches the existing snapshot first (was `upsert`-only). |
| `scripts/recalculate-calculated-horoscopes.ts` | Manual recalculation script merges stored overrides (`existing` already fetched). |
| `scripts/recalculate-horoscopes.ts` | Auto recalculation script merges stored overrides (fetches existing snapshot first — was bare `{ ...calculated }`). |
| `src/app/horoscopes/[id]/page.tsx` | State type gains `shadbalaya?: ShadBalaya`. After `getThithi`, computes `resolvedShadbalaya = mergeShadBalaya(computeShadBalaya(planets, houses, { source, thithi: getThithi(), day: source !== "manual" ? deriveDay(...) : undefined, maranakaraka: resolvedMaranakaraka }), calculatedDetails.shadbalaya)` so legacy docs (no stored field) render without a migration. `resolvedMaranakaraka` now recomputes via `computeMaranakaraka(planets, houses)` for both auto and manual, falling back to `normalizeMaranakaraka(calculatedDetails?.maranakaraka)`. Renders `<ShadBalaTable>` at the end of the calculations tab (after derived ranges) with `isEditable = owner || super-admin`. |
| `src/messages/en.json`, `src/messages/si.json` | New `astrology.shadbalaya.*` block in both locales (columns, balaNames, tooltip, all per-bala reason keys, override, checkbox aria, ratioAria/ratioFormat, infoGlyph, readOnlyNotice, toast.saveError). Sinhala strings taken verbatim from UX §12.3/12.4 proposals. |

## Key Design Decisions

1. **`CalculationResult.shadbalaya` is optional, not required.** The architecture spec documents `shadbalaya?: ShadBalaya`, and making it required breaks TS compilation of the typed `CalculationResult` literals in `src/__tests__/search-rag.test.ts` (MOCK_CALC, minimalCalc). All merge call sites therefore guard with `?? {}`. Stored `CalculatedDetails.shadbalaya` is also optional for the same reason plus legacy-doc compatibility.
2. **No computation in the route.** PATCH persists a sparse dotted-path record; the page and recalculation pipeline recompute the full table and merge overrides in. This keeps the sticky-override invariant (US-SB-008, US-SB-013) in exactly one place (`mergeShadBalaya`).
3. **Route validation is manual (no zod),** matching the repo's existing `parseManualChartBody` convention — zod is in `package.json` but unused in `src/`.
4. **Sticky override semantics:** the stored record wins only for cells with `overridden: true`; everything else takes the freshly-computed value. Sparse first-toggles (a single legacy cell) still leave the other 53 cells computed.
5. **Render-time recompute for legacy docs.** Like `getThithi`/`getPanchaPakshi`/`resolvedMaranakaraka`, the page recomputes Shad Bala at render for `CalculatedDetails` docs created before the field existed, then merges stored overrides — no data migration needed.
6. **Component state syncs only on content change.** The page recomputes `resolvedShadbalaya` on every render (a fresh object identity), so `ShadBalaTable` re-syncs its local state only when the JSON signature of the prop changes — otherwise optimistic toggles mid-debounce would be clobbered by parent re-renders.
7. **Unmount flush uses `keepalive: true`** (RE-SB-214) so the last toggle is not lost when the student navigates away within the 500 ms debounce window.
8. **Full Sinhala string parity** for every key (QA §18 item 9), including the two Neecha variants (`sthana.reason.neecheShatru` and the added `sthana.reason.debilitated` for the Neecha-not-Shatru case, QA §18 item 2).

## Test Results

```
Test Suites: 26 passed, 2 failed (pre-existing), 28 total
Tests:       610 passed, 11 failed (pre-existing), 621 total
```

New coverage: `shadbalayaApi.test.ts` (10), plus `recalculationJob.test.ts` US-SB-013 merge tests (auto + manual branches) and `calculation.test.ts` golden test (9 planets × 6 balas, Drishti false everywhere, UT-SB-070..074). The 11 remaining failures are the pre-existing `search-combined.test.ts` + `privacy.test.ts` (fail identically on the clean committed baseline) — unrelated.

`pnpm build` compiles cleanly (`✓ Compiled successfully`, `/api/horoscope/[id]/shadbalaya` in the route table). `tsc --noEmit` clean outside the pre-existing Jest-global errors in test files. `pnpm lint` remains broken at the tooling level (ESLint 10.7.0 vs `eslint-plugin-react` 7.37.5 — crashes while loading `eslint.config.mjs`); verified pre-existing on the stashed clean tree.

## Deviations (documented for QA/PM)

1. **`CalculationResult.shadbalaya` optional** (see Design Decision 1) — the prompt's "required on CalculationResult" checklist item was dropped to match the architecture spec and avoid breaking `search-rag.test.ts` fixtures.
2. **Tooltip state line uses the implementation's single `tooltip.checked`/`tooltip.unchecked` keys** carrying the full "✓ Checked because:" / "✗ Unchecked because:" copy (as unit-tested in `shadBalayaTooltip.test.ts`). UX §12.2 proposed separate short `checked`/`unchecked` + long `checkedBecause`/`uncheckedBecause` keys; not adopted because the pure composer only emits one state line.
3. **Error toast uses the dedicated `astrology.shadbalaya.toast.saveError` key** (UX §12.4), not `common.error`, and renders inline inside the table section (self-contained; no page-level toast wiring).
4. **Read-only ⓘ glyph renders only when `!isEditable`** — editable cells keep a clean checkbox + optional override dot, per §2.1.

## Post-Implementation Product Correction (2026-08-14)

**Sthana bala in an enemy (Shatru) sign.** The product owner reported that Sthana bala being checked for a planet in a Sathuru rashi is incorrect. `computeSthanaBala` now returns `value: false` with the `shadbalaya.sthana.reason.shatru` reason whenever the planet sits in an enemy sign (`isEnemySign`), not only for the Neecha+Shatru combination. The Neecha+Shatru case still uses `neecheShatru`; Neecha-but-not-Shatru stays checked with `debilitated`. `docs/shadbalaya.md`, BA US-SB-002 (AC3 + business rules + traceability), QA UT-SB-006/FIX-I/§18, architecture traceability, and `data-model.md` were updated to match. Test UT-SB-006 flipped to expect `value === false`. Full suite still 610 pass / 11 pre-existing fail.

**Rahu/Ketu Cheshta bala (Vakra).** Rahu/Ketu are retrograde by nature, so their usual retrograde is NOT Vakra and gives no Cheshta bala — only direct (opposite) motion counts as Vakra. `computeCheshtaBala` now inverts the vakra test for nodes (`isVakra = p.name === 8 || p.name === 9 ? !p.retrograde : p.retrograde`) and restricts the Shukla-Chandra conjunction condition to exactly Kuja/Buda/Guru/Sikuru/Shani via a new `SHUKLA_CHANDRA_PLANETS` map (previously the `p.name !== 1 && p.name !== 2` filter wrongly included Rahu/Ketu). Because manual charts hardcode `retrograde: false` (motion never computed), `synthesizePlanets` now stores nodes as `retrograde: true` (their true natural state) so manual charts don't false-trigger vakra — consistent with the existing `p.retrograde && p.name !== 8 && p.name !== 9` node-exclusion convention in BirthChart/chartRenderer/page.tsx. Tests UT-SB-023b/c/d added; BA US-SB-003 AC3/AC4, QA plan, `data-model.md`, and `docs/shadbalaya.md` updated. Full suite: 613 pass / 11 pre-existing fail.

**Kala bala Shukla-paksha rule.** Ravi now has **no** Kala bala while the Moon is in Shukla paksha — its day-birth condition is suppressed (previously a day-birth Ravi in Shukla paksha was checked). Rahu is added to the Shukla-paksha list (`KALA_SHUKLA_PLANETS` now `{4,5,6,8}`). Implemented in `computeKalaBala` via a `shuklaPaksha` guard on Ravi's day condition. Tests UT-SB-029/029b updated/added, FIX-F updated; BA US-SB-004 AC3, QA plan, `data-model.md`, and `docs/shadbalaya.md` updated. Full suite: 614 pass / 11 pre-existing fail.

## Manual E2E / UI Checklist (from QA §18)

- **E2E-SB-101..110** — Owner toggles each of the six balas for Sun; checkbox flips instantly (optimistic), override dot (•) appears, and the value is still checked after a full page reload.
- **E2E-SB-111** — Toggle then navigate away within 500 ms: value persists after reload (keepalive flush).
- **E2E-SB-112** — Toggle while offline: cell rolls back to its previous value and the localized error message shows.
- **E2E-SB-113** — Non-owner share-link viewer sees read-only checkboxes + ⓘ + `readOnlyNotice`; no PATCH is sent on interaction.
- **E2E-SB-114** — Super-admin can toggle a non-owned horoscope's Shad Bala.
- **E2E-SB-115** — Changing AstrologySettings (any orb/rashi setting) triggers recalculation; overridden cells survive, recomputed cells update.
- **UI-SB-201** — Desktop table shows 8 columns (ග්රහයා + 6 balas + අනුපාතය) × 9 rows; ratios `(n/6)` right-aligned.
- **UI-SB-202** — Hover/focus a cell opens the reason tooltip after ~150 ms with heading, state line, `·` reasons, and indigo override footer for overridden cells; `Esc` closes it.
- **UI-SB-203** — Mobile view (< md) renders per-planet cards with bala chips that wrap to 2-1 columns.
- **UI-SB-204** — Sinhala locale renders all strings in Sinhala with wider tooltips; English locale renders English.
- **UI-SB-205** — Sparse legacy `CalculatedDetails` (no `shadbalaya` field) still renders a fully-populated table (render-time recompute + merge).
