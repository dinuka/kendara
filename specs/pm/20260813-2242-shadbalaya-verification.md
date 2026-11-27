# Shad Bala (ෂඩ් බලය) Verification Report

**Date:** 2026-08-14 22:42
**Verifier:** PM/QA verification pass (read-only; no code changes made)
**Repo:** `kendara` — branch `version2`, HEAD `11772c1` (`feat: system-wide astrology settings with background recalculation`)
**Scope:** Verify the implemented Shad Bala feature against the five Shad Bala specs and the four confirmed product rules from the product owner; report verdict, traceability, and issues.

**Specs under review:**
- `specs/business-analysis/20260813-1954-shadbalaya.md` (US-SB-001..014, 557 lines)
- `specs/architecture/20260813-2011-shadbalaya-architecture.md` (406 lines)
- `specs/ux/20260813-2030-shadbalaya.md` (589 lines)
- `specs/qa/20260813-2052-shadbalaya-test-plan.md` (375 lines; corrections #11–13)
- `specs/development/20260813-2237-shadbalaya-implementation.md` (79 lines)

---

## 1. Verification Result Summary

### PASS

The Shad Bala feature is functionally complete and correct against all **4 confirmed product rules** (Cheshta, Kala, Maranakaraka/Naisargika, and Sthana). All **63 acceptance criteria across 14 user stories** trace to QA test IDs, and the automated suite passes (**335/335 tests across 7 suites**).

**HIGH-1 (Sthana) and MED-2 (stale spec wording) are CLOSED.** The product owner re-confirmed on 2026-08-14 that **an enemy-sign (Shatru) placement alone removes Sthana bala** (reason `shatru`; Neecha+Shatru → dedicated `neecheShatru` reason; Neecha alone keeps the bala). The implementation already matches; the stale BA lines 29/512, arch lines 150-156, and QA §1 wording were updated to match. Eight LOW severity UI/UX deviations remain (LOW-1..LOW-8) — non-blocking, see §6.

| Dimension | Result |
|-----------|--------|
| Product rules (4) | 4 MATCH (Sthana re-confirmed by PO on 2026-08-14) |
| AC traceability | 63/63 ACs traced; 14/14 stories covered |
| Automated tests | 335 passed / 7 suites; 0 failures in scope |
| i18n parity (en/si) | 54 keys both locales; zero drift |
| Schema / storage contract | Matches data-model (dev-documented deviation: `Mixed` type) |
| Override persistence | Verified across toggle, reload, and recalculation paths |

---

## 2. Acceptance-Criteria Traceability Matrix

All 14 BA user stories and all **63 ACs** have ≥1 QA test ID; each QA test maps back to a US-SB story. Status for every tested AC is **PASS** (verified by the passing automated suite and source inspection); untestable-by-automation ACs (E2E/BI) are traced to manual scripts / component tests.

| User Story | ACs | QA test IDs | Source / test location | Status |
|-----------|-----|-------------|------------------------|--------|
| US-SB-001 Table (8 columns) | 4 | UT-SB-059, UI-SB-140/141/142/143/144, IT-SB-109, RE-SB-220 | `shadBalaya.test.ts`; `ShadBalaTable.tsx`; `page.tsx:1911` | PASS* |
| US-SB-002 Sthana bala | 5 | UT-SB-001..010, UI-SB-150/151 | `shadBalaya.ts:122-169`; UT-SB-006 | PASS (rule re-confirmed by PO 2026-08-14) |
| US-SB-003 Cheshta bala | 6 | UT-SB-011..026, UI-SB-152 | `shadBalaya.ts:171-208` (vakra inversion 195, `SHUKLA_CHANDRA_PLANETS` 64) | PASS |
| US-SB-004 Kala bala | 6 | UT-SB-027..036, RE-SB-219 | `shadBalaya.ts:210-229` (Ravi day suppression 215; lists 57-60) | PASS |
| US-SB-005 Dig bala | 4 | UT-SB-037..043, RE-SB-210 | `shadBalaya.ts:231-241` (`DIG_HOUSE` 68-76; node exclusion 232) | PASS |
| US-SB-006 Naisargika bala | 4 | UT-SB-044..048, 048a, 048b | `shadBalaya.ts:243-258`; `astrology.ts:296-329` | PASS |
| US-SB-007 Drishti bala (manual) | 3 | UT-SB-049/050, UI-SB-153 | `shadBalaya.ts:260-262` | PASS |
| US-SB-008 Toggle + auto-save | 5 | IT-SB-108..112, UI-SB-146..149, RE-SB-213/214/217/221/222 | `ShadBalaTable.tsx` (optimistic + 500 ms debounce + keepalive flush); `route.ts` (sparse `$set` only) | PASS |
| US-SB-009 Tooltip reasons | 5 | UI-SB-150..153, AX-SB-192/193, BI-SB-181/182 | `shadBalayaTooltip.ts`; `ShadBalaTooltip.tsx`; `shadBalayaTooltip.test.ts` | PASS |
| US-SB-010 Ratio (n/6) | 4 | UI-SB-143, RE-SB-211/212, AX-SB-197 | derived at render (`ratioFormat`/`ratioAria`); never stored | PASS |
| US-SB-011 i18n SI+EN | 5 | BI-SB-180..185, RE-SB-218 | `en.json`/`si.json:503+`; parity verified (54 keys) | PASS |
| US-SB-012 Manual behaviour | 5 | UT-SB-012/013/034/035, RE-SB-219 | `manualChartDetails.ts` (no `day` for manual; node `retrograde: true` 170) | PASS |
| US-SB-013 Overrides survive recalc | 4 | UT-SB-051..056, IT-SB-120..126, RE-SB-220/221 | `mergeShadBalaya` (`shadBalaya.ts`); `recalculationJob.ts`; `scripts/recalculate-*.ts` | PASS |
| US-SB-014 Read-only non-owner | 3 | IT-SB-100..103, UI-SB-145, AX-SB-193 | `route.ts` (401/404/403, super-admin allowed); `ShadBalaTable.tsx` disabled + ⓘ | PASS |

*US-SB-001 AC1 (placement) carries a **LOW** deviation — see LOW-1. All other US-SB-001 ACs PASS.

**Traceability verification (from QA §16 checklist):** 14/14 stories mapped; the 63 ACs are covered by the listed UT/IT/UI/AX/BI/RE/E2E IDs. Note: the QA plan's E2E-SB-160..172 are specified as **manual scripts** (no Playwright/Cypress installed — QA §17.6), so they are not part of the automated 335-test count.

---

## 3. Product-Rules Table (confirmed rules vs implementation)

| # | Confirmed product rule | Spec states | Implementation does | Verdict |
|---|------------------------|-------------|---------------------|---------|
| 1 | **Sthana bala is unchecked in an enemy-sign (Shatru) placement — whether alone or combined with Neecha; Neecha alone keeps the bala** | **Resolved.** BA rules summary (line 29), Clarifying Assumption 1 (line 512), arch formula (line 150-156), and QA §1 were updated on 2026-08-14 to the enemy-sign rule (matching BA US-SB-002 title/AC3, QA UT-SB-006, dev correction, `docs/shadbalaya.md:17`). | `computeSthanaBala` (`shadBalaya.ts:122-169`): Neecha+Shatru → `false` + `neecheShatru` (125-136); enemy-only → `false` + `shatru` (137-143); Neecha-only → `true` + `debilitated` (165-167); other strengths → `true` (144-168). | **MATCH** (PO re-confirmed enemy-sign rule 2026-08-14; HIGH-1/MED-2 closed) |
| 2 | **Cheshta bala: Rahu/Ketu only gain it from Vakra (direct motion, not natural retrograde); Shukla-Chandra conjunction limited to Kuja/Buda/Guru/Sikuru/Shani; mutually exclusive (a vakra planet gets ONLY the vakra reason)** | BA US-SB-003 AC3/AC4, QA correction #11, `docs/shadbalaya.md:26-28`, arch Cheshta table. | `isVakra = p.name === 8 \|\| p.name === 9 ? !p.retrograde : p.retrograde` (`shadBalaya.ts:195`); `SHUKLA_CHANDRA_PLANETS = {3,4,5,6,7}` (line 64); nodes excluded from conjunction (191). Nodes never receive Uttarayana/paksha/conjunction reasons — the "mutually exclusive" clause is interpreted as applying to nodes; non-node planets list every applicable reason (US-SB-003 AC6). | **MATCH** (interpretation note: mutually-exclusive applies to nodes; tests UT-SB-023b/c/d). |
| 3 | **Kala bala: Shukla-paksha list = {4,5,6,8} (no Ravi); Krushna-paksha list = {3,7,8} (no Ravi); Ravi day-birth suppressed while Moon in Shukla paksha; only ONE planet gains per condition (any one condition suffices)** | BA US-SB-004 AC2/AC3/AC4, QA corrections #12/#13, arch Kala table, `docs/shadbalaya.md:38-40`. | `KALA_DAY_PLANETS={1,5,6}` (57), `KALA_NIGHT_PLANETS={2,3,7}` (58), `KALA_SHUKLA_PLANETS={4,5,6,8}` (59), `KALA_KRUSHNA_PLANETS={3,7,8}` (60); Ravi day suppressed while Shukla (215); `deriveDay` = Sun cusp house 7–12 (`shadBalaya.ts:266-269`); any-one-suffices via OR (`reasons.length > 0`, 228). | **MATCH** (UT-SB-027..036; QA corrections #12/#13 match). |
| 4 | **Maranakaraka (Naisargika) mapping: Chandra→8, Rahu→9, Shani→1, Ravi→5, Shukra→6, Kuja→7, Budha→4, Guru→3; lagna (rasi) chart only, never D9; per-planet (not Chandra-by-default)** | BA US-SB-006, `docs/done/maranakaraka.md`, `data-model.md:927`. | `MARANAKARAKA_RULE = {2:8, 8:9, 7:1, 1:5, 6:6, 3:7, 4:4, 5:3}` (`astrology.ts:296-305`); `computeMaranakaraka(planets, houses?)` uses `findHouse` when houses given, else `p.house` (314-325); `normalizeMaranakaraka` drops 0 (329-335); lagna-only (no D9). | **MATCH** (UT-SB-044..048b; calculation.ts:429 auto / manualChart.ts:754 manual). |

---

## 4. Test Execution Results

Run 2026-08-14 22:41 on branch `version2` (HEAD `11772c1`):

```
$ npx jest src/__tests__/shadBalaya.test.ts src/__tests__/calculation.test.ts src/__tests__/manualChart.test.ts src/__tests__/search-rag.test.ts src/__tests__/shadbalayaApi.test.ts src/__tests__/shadBalayaTooltip.test.ts src/__tests__/recalculationJob.test.ts

Test Suites: 7 passed, 7 total
Tests:       335 passed, 335 total
Snapshots:   0 total
Time:        2.245 s
```

| Suite | Covers |
|-------|--------|
| `shadBalaya.test.ts` | UT-SB-001..060: all six per-bala rules, merge, context fallbacks, output contract |
| `calculation.test.ts` | Golden auto pipeline: 9 planets × 6 balas, Drishti never checked (UT-SB-070..074) |
| `manualChart.test.ts` | Manual pipeline: maranakaraka via `p.house` (U048/U048a) |
| `search-rag.test.ts` | Maranakaraka in EN/SI search text (incl. "Maranakaraka: Moon") |
| `shadbalayaApi.test.ts` | PATCH route: 401/403/404/400 × validation, owner sparse `$set`, super-admin (10 tests) |
| `shadBalayaTooltip.test.ts` | Tooltip composition + AX-SB-197 ratio aria label (8 tests) |
| `recalculationJob.test.ts` | mergeShadBalaya override survival, auto + manual branches (US-SB-013) |

**Not run / out of scope:** the 11 pre-existing failures in `search-combined.test.ts` and `privacy.test.ts` (fail identically on the clean committed baseline — unrelated to Shad Bala). E2E-SB-160..172 are manual scripts (no E2E framework installed).

---

## 5. Implementation Verification (source inspection)

- **Auto pipeline:** `calculateHoroscope` returns `shadbalaya: computeShadBalaya(planetDetails, houses, { source: "auto", thithi, day: deriveDay(planetDetails, houses), maranakaraka })` — `calculation.ts:429-439`.
- **Manual pipeline:** `synthesizeCalculation` uses `source: "manual"` (no `day` — no birth time); `synthesizePlanets` stores Rahu/Ketu as `retrograde: true` (their natural state) so manual charts don't false-trigger vakra — `manualChartDetails.ts:154-170`.
- **Override survival:** `mergeShadBalaya(computed, stored)` — stored `overridden: true` cells win; everything else recomputed. Applied in `recalculationJob.ts` (auto branch fetches existing first), `scripts/recalculate-horoscopes.ts:56`, `scripts/recalculate-calculated-horoscopes.ts:42`. Sparse legacy records keep the other 53 cells computed.
- **API:** `PATCH /api/horoscope/[id]/shadbalaya` — strict body validation (planet int 1–9, bala in `SHADBALAYA_KEYS`, value boolean); 401 → 404 → 403 (owner-or-super-admin; super-admin MAY mutate, unlike the privacy route); persists **only** the dotted path `shadbalaya.<planet>.<bala>.value` + `.overridden: true`; no computation in the route.
- **Page:** `resolvedMaranakaraka` recomputed at render (369-372); `resolvedShadbalaya` = merge of recompute + stored (504-514); `<ShadBalaTable>` rendered with `isEditable = owner || super-admin` (1911-1917). Legacy docs (no stored field) render fully populated — no migration.
- **Search/text:** `search/page.tsx:549-552` recomputes maranakaraka (lagna only); tags at 1026-1027; `textContent.ts:77-78` (EN) / `169-170` (SI) include the Maranakaraka line.
- **i18n:** `astrology.shadbalaya.*` block in `en.json` and `si.json` (line 503); verified **54 keys per locale, zero drift** (both `columns`, `balaNames`, `tooltip`, per-bala reasons incl. `shatru`/`neecheShatru`/`debilitated`, override, toast). Note: `kala.reason.vargaLoad` exists but is never emitted (varga loads deferred — matches arch Non-Goal).

---

## 6. Issues and Risks

### HIGH

- **HIGH-1 — CLOSED (2026-08-14, product decision).** The product owner re-confirmed that **an enemy-sign (Shatru) placement alone removes Sthana bala** (reason `shatru`), matching the implementation. The Neecha+Shatru combination keeps the dedicated `neecheShatru` reason; Neecha alone keeps the bala (`debilitated` reason). No implementation change required.

### MEDIUM

- **MED-2 — CLOSED (2026-08-14).** BA spec lines 29/512, arch lines 150-156, and QA §1 rule wording were updated to the confirmed enemy-sign rule. Remaining stale references checked and cleared (`grep` for "always Chandra"/"Neecha AND Shatru must BOTH hold" returns no matches in specs/docs).

### LOW

- **LOW-1 — Table placement deviates from UX §4 / QA UI-SB-141 / arch line 378.**
  `ShadBalaTable` renders **after** `DerivedRangesSection` (`page.tsx:1907-1911`) rather than "after the planets table, before DerivedRanges" (`page.tsx ~1883/1885`). Documented in the dev spec, but the UX/QA/arch wording wasn't updated. **Fix:** move the `<ShadBalaTable>` render above line 1907 or update the three specs.
- **LOW-2 — Mobile breakpoint mismatch.** Implementation uses `md:` (768px) for the desktop/mobile switch; UX §2 specifies `sm:` (640px). (`ShadBalaTable.tsx`)
- **LOW-3 — Planet cell shows name only, not glyph + name.** UX §5.3 specifies a planet glyph alongside the localized name (`ShadBalaTable.tsx` planet cell).
- **LOW-4 — Override dot lacks `aria-hidden="true"`.** UX §6.2/AX-SB-194 requires the decorative dot be hidden from AT; override state is still conveyed via the `aria-label` suffix ("set manually"), so impact is limited.
- **LOW-5 — Override hint legend always rendered.** UX §6.2 renders the legend only when ≥1 override dot exists; implementation renders it unconditionally.
- **LOW-6 — Read-only ⓘ is a non-focusable `<span>` with `title`.** UX §6.3/AX-SB-193 wants a keyboard-reachable button; tab order skips disabled cells (`ShadBalaTable.tsx`).
- **LOW-7 — Error toast semantics differ from UX §8.3/AX-SB-199.** Implementation: `role="alert"` (assertive) + 3 s auto-dismiss; UX specifies `aria-live="polite"` + 5 s.
- **LOW-8 — Section heading is `<h4>`, not `<h3>`** as in the UX mock.

### INFO / OPEN (not defects)

- **Schema type:** `CalculatedDetails.shadbalaya` is `{ type: Schema.Types.Mixed }` (dev-documented deviation from arch's typed Map sub-schema); matches repo convention.
- **Deferred v1 conditions:** `warWinnerPlanet` and `vargaLoad` hooks exist but are never emitted (no planet-war module, no varga formula) — consistent with arch Non-Goals and QA §17.1/17.2.
- **Un-override product gap:** no UI/API to clear `overridden: true` — a student can never return a bala to auto-recompute (QA §17.4, BA OQ7 resolved as "always sticky"). Flagged to PM/UX.
- **SI translation sign-off:** all Sinhala bala-name/reason strings are proposals pending BA/domain review (UX §17.3, QA §18.9).

---

## 7. Sign-off

| Role | Decision | Signature / Date |
|------|----------|------------------|
| Product Owner | Rule 1 (Sthana): **enemy-sign placement alone removes Sthana bala** — confirmed 2026-08-14. HIGH-1/MED-2 closed. | ______ / 2026-08-14 |
| Engineering | LOW-1..LOW-8 accepted as non-blocking follow-ups; report filed | ______ / 2026-08-14 |
| QA | 335/335 automated tests pass; E2E-SB-* manual pass pending | ______ / 2026-08-14 |

**Work state:** all Shad Bala work is uncommitted on branch `version2` (untracked: `src/lib/shadBalaya.ts`, `shadBalayaTooltip.ts`, `src/components/shadbalaya/`, `src/app/api/horoscope/[id]/shadbalaya/`, `src/__tests__/shadBalaya*`; ~25 modified files incl. specs). Committing is a separate PM/Dev decision.
