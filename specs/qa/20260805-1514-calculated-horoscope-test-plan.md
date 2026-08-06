# QA Test Plan — Calculated Horoscope (Manual Entry)

**Date:** 2026-08-05 15:14
**Author:** QA
**Based on:** `specs/business-analysis/20260805-1514-calculated-horoscope.md`, `specs/architecture/20260805-1514-calculated-horoscope.md`, `specs/ux/20260805-1514-calculated-horoscope.md`, `specs/business-analysis/data-model.md`, `src/__tests__/house.test.ts`, `jest.config.js`

---

## Scope

This test plan covers the Calculated Chart (manual entry) feature:
- `POST /api/horoscope/manual` (create)
- `PUT /api/horoscope/[id]/manual-chart` (update)
- Pure derivation module `src/lib/manualChart.ts`
- UI components (`ManualChartEditor`, `HouseTableEditor`, `PlanetPicker`, `ValidationBadges`, `PlanetsTable`, `NavamsaHouseTableEditor`, `DerivedRanges`, `ModeToggle`, `CalculatedChartBadge`, `ManualChartDetailPanel`)
- Schema changes (`Horoscope.source`, `CalculatedDetails.manualHousePlacements`/`derivedRanges`)
- Detail-page integration for `source: "manual"` horoscopes

**Out of scope:** ephemeris calculation, RAG search, privacy toggling (existing, unchanged).

## Test Environment

| Environment | Configuration |
|-------------|---------------|
| Unit | Jest + ts-jest, node env, `@/` → `src/` (jest.config.js moduleNameMapper) |
| Integration | API route handlers with mocked `getServerSession` + mocked `connectDB` (reuse patterns from `auth.test.ts`/`privacy.test.ts`) |
| E2E | Playwright (new) — full create + edit flows |

---

## 1. Unit Tests — `src/lib/manualChart.ts` (pure, no I/O)

### 1.1 House Sign Derivation (`deriveHouseSigns`)

| ID | Test Case | Input | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UT-CH-001 | Derive house signs for Lagna 1 (Aries) | lagna=1 | [1,2,3,4,5,6,7,8,9,10,11,12] | US-CH-002 |
| UT-CH-002 | Derive house signs for Lagna 7 (Libra) | lagna=7 | [7,8,9,10,11,12,1,2,3,4,5,6] | US-CH-002 |
| UT-CH-003 | Wrap at house 12 | lagna=12 | [12,1,2,3,4,5,6,7,8,9,10,11] | US-CH-002 |
| UT-CH-004 | Reject invalid Lagna | lagna=0, 13, NaN | throws/error | US-CH-001 |
| UT-CH-005 | All 12 house numbers returned in order | lagna=3 | houseNumbers 1..12 | US-CH-002 |

### 1.2 Validation Rules (`validatePlacements`)

Reference house = Ravi (Sun). Budha valid in {Ravi, Ravi−1, Ravi+1}; Sikuru valid in {Ravi, Ravi−2, Ravi+2}; Rahu/Ketu opposite houses (gap == 6, mod 12).

| ID | Test Case | Input | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UT-CH-010 | Budha in same house as Ravi | Ravi=3, Budha=3 | valid | US-CH-004 |
| UT-CH-011 | Budha at Ravi±1 | Ravi=3, Budha=2 / 4 | valid | US-CH-004 |
| UT-CH-012 | Budha out of range | Ravi=3, Budha=6 | invalid | US-CH-004 |
| UT-CH-013 | Budha wrap Ravi=12, +1 → house 1 | Ravi=12, Budha=1 | valid | US-CH-004 |
| UT-CH-014 | Budha wrap Ravi=1, −1 → house 12 | Ravi=1, Budha=12 | valid | US-CH-004 |
| UT-CH-015 | Ravi not placed → Budha status skipped | no Ravi, Budha=3 | skipped + hint | US-CH-004 |
| UT-CH-016 | Sikuru at Ravi±2 | Ravi=3, Sikuru=1 / 5 | valid | US-CH-004 |
| UT-CH-017 | Sikuru out of range | Ravi=3, Sikuru=8 | invalid | US-CH-004 |
| UT-CH-018 | Sikuru wrap Ravi=2, −2 → house 12 | Ravi=2, Sikuru=12 | valid | US-CH-004 |
| UT-CH-019 | Rahu/Ketu opposite houses valid | Rahu=4, Ketu=10 | valid | US-CH-004 |
| UT-CH-020 | Rahu/Ketu opposite reversed valid | Rahu=10, Ketu=4 | valid | US-CH-004 |
| UT-CH-020a | Rahu/Ketu opposite wrap valid | Rahu=7, Ketu=1 | valid | US-CH-004 |
| UT-CH-021 | Rahu/Ketu 7 apart (not opposite) invalid | Rahu=4, Ketu=11 | invalid | US-CH-004 |
| UT-CH-022 | Only Rahu placed | Rahu=4, no Ketu | incomplete | US-CH-004 |
| UT-CH-023 | Both Budha and Sikuru violated | Ravi=3, Budha=8, Sikuru=9 | both invalid reported | US-CH-004 |
| UT-CH-024 | Empty chart (no planets) | {} | all skipped/incomplete (no crash) | US-CH-004 |

### 1.3 Aspects & Conjunctions (`computeAspects`, `computeConjunctions`)

| ID | Test Case | Input | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UT-CH-030 | Mars aspects houses 4/8/12 from itself | Mars=1 | aspects [4,8,12] | US-CH-005 |
| UT-CH-031 | Jupiter aspects houses 5/9/11 | Jupiter=3 | aspects [7,11,1] (3+5,3+9,3+11 mod 12) | US-CH-005 |
| UT-CH-032 | Saturn aspects houses 3/7/10 | Saturn=5 | aspects [7,11,2] | US-CH-005 |
| UT-CH-033 | Moon/Mercury/Venus/Sun 7th-house full aspect | Moon=1 | aspects [7] | US-CH-005 |
| UT-CH-034 | Rahu/Ketu aspect 5/9 | Rahu=4 | aspects [8,12] | US-CH-005 |
| UT-CH-035 | Conjunction same house | {Sun:1, Mars:1} | conjunction partners {1:[3]} | US-CH-005 |
| UT-CH-036 | No conjunction (all separate) | {Sun:1, Mars:2} | no partners | US-CH-005 |
| UT-CH-037 | Wrap: Saturn house 12 aspects | Saturn=12 | aspects [2,6,9] | US-CH-005 |

### 1.4 Planets Table (`derivePlanetsTable`)

| ID | Test Case | Input | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UT-CH-040 | Sign from house | Lagna=1, Mars=4 | Mars sign=4 | US-CH-006 |
| UT-CH-041 | Sign from house wrap | Lagna=9, Venus=12 | Venus sign=8 (9+12−1=20 → mod 12 → 8) | US-CH-006 |
| UT-CH-042 | One row per placed planet | 5 planets | 5 rows | US-CH-006 |
| UT-CH-043 | Atmakaraka deferred without degrees | no navamsa/degree | flagged "not enough data" | US-CH-006 |
| UT-CH-044 | Strength defaults to Sama | no navamsa | strength=Sama | US-CH-006 |
| UT-CH-045 | Conjunction column populated | co-located planets | comma/chips of partners | US-CH-006 |

### 1.5 Navamsa Enrichment (`deriveNavamsaData`)

| ID | Test Case | Input | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UT-CH-050 | Degree range from navamsa index | planet in 1st navamsa | 00°00'–03°20' | US-CH-008 |
| UT-CH-051 | Degree range 2nd navamsa | 2nd navamsa | 03°20'–06°40' | US-CH-008 |
| UT-CH-052 | 12th navamsa wraps mod 30° | 12th navamsa | 36°40'–40°00' (→ 6°40'–10°00' mod 30) | US-CH-008 |
| UT-CH-053 | Nakshatra + pada from midpoint | midpoint 5° of Aries | Ashwini pada 2 (verify against Nakshatra table) | US-CH-008 |
| UT-CH-054 | Nakshatra boundary exactly 13°20' | abs degree = 13°20' | belongs to next nakshatra | US-CH-008 |
| UT-CH-055 | Atmakaraka = highest absolute degree | Moon 20°, Sun 5° | Atmakaraka = Moon | US-CH-008 |
| UT-CH-056 | No navamsa → `—`/empty columns | none | `—` not crash | US-CH-008 |
| UT-CH-057 | Navamsa house signs derive from navamsaLagna | navamsaLagna=5 | house 1 sign=5, house 2 sign=6, house 12 sign=4 | US-CH-002 |
| UT-CH-058 | Navamsa omitted when no navamsaLagna | houses only | navamsaHouses + navamsaLagna undefined | US-CH-002 |
| UT-CH-059 | navamsaLagna required when navamsaHouses present | navamsaHouses w/o navamsaLagna | throws / validation error | US-CH-002 |

### 1.6 Derived Birth Ranges (config tables)

| ID | Test Case | Input | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UT-CH-060 | Birth time Ravi house 1 | raviHouse=1 | 05:00–07:00 | US-CH-009 |
| UT-CH-061 | Birth time Ravi house 4 | raviHouse=4 | 11:00–13:00 | US-CH-009 |
| UT-CH-062 | Birth time Ravi house 12 | raviHouse=12 | 03:00–05:00 | US-CH-009 |
| UT-CH-063 | Birth time full table coverage | all 12 houses | all 12 rows non-empty, contiguous 2h windows | US-CH-009 |
| UT-CH-064 | Birth month Mesha | raviSign=1 | Apr 15 – May 15 | US-CH-010 |
| UT-CH-065 | Birth month Wrushaba | raviSign=2 | May 15 – Jun 15 | US-CH-010 |
| UT-CH-066 | Birth month Meena wrap | raviSign=12 | Mar 15 – Apr 15 | US-CH-010 |
| UT-CH-067 | Birth month full table coverage | all 12 signs | all 12 rows, +1 month per sign, 15th anchor | US-CH-010 |
| UT-CH-068 | Birth date candidates 1st navamsa | navamsaIndex=0 | [12 (12+0), 21 (17+4)] | US-CH-011 |
| UT-CH-069 | Birth date candidates 2nd navamsa | navamsaIndex=1 | [15 (12+3), 24 (17+7)] | US-CH-011 |
| UT-CH-070 | Birth date candidate formula general | navamsaIndex=n | 12+n×3, 17+n×7 | US-CH-011 |
| UT-CH-071 | Age 1st (months) formula | shaniBirthNavamsa=1, currentShani=18° in sign diff | 30 + 18 + 30×(signs−1) months | US-CH-012 |
| UT-CH-072 | Age 2nd = 1st + 30y | computed 1st | previous + 30 years | US-CH-012 |
| UT-CH-073 | Age 3rd = 2nd + 30y | computed 2nd | 2nd + 30 years | US-CH-012 |
| UT-CH-074 | Negative intermediate clamped | formula negative | clamp to 0 months + warning | US-CH-012 |
| UT-CH-075 | Shani not placed → ranges skipped | no Shani | hint, no crash | US-CH-012 |

---

## 2. Integration / API Tests

### 2.1 `POST /api/horoscope/manual`

| ID | Test Case | Expected | Maps to |
|----|-----------|----------|---------|
| IT-CH-100 | Create with name+lagna+houses | 201, horoscope `source: "manual"`, calculatedDetails has manualHousePlacements + derivedRanges | US-CH-001 |
| IT-CH-101 | Create with minimal body (no navamsa) | 201, navamsaHouses absent | US-CH-007 |
| IT-CH-102 | Create with navamsaLagna + navamsaHouses | 201, navamsa data persisted (signs derived from navamsaLagna) | US-CH-007 |
| IT-CH-103 | Create with navamsaHouses but no navamsaLagna | 400 | US-CH-002 |
| IT-CH-103 | No session | 401 | US-CH-001 |
| IT-CH-104 | Missing name | 400 | US-CH-001 |
| IT-CH-105 | Missing/invalid lagna (0, 13, non-number) | 400 | US-CH-001 |
| IT-CH-106 | Invalid house key (0, 13) | 400 | US-CH-001 |
| IT-CH-107 | Invalid planet enum (0, 10, non-number) | 400 | US-CH-001 |
| IT-CH-108 | Duplicate planet across houses | 400 | US-CH-003 |
| IT-CH-109 | birthDate/birthTime NOT required | 201 without them | US-CH-001 |
| IT-CH-110 | Response includes derivedRanges | 201 body has derivedRanges | US-CH-009..012 |
| IT-CH-111 | Charts created for BIRTH + NAVAMSA only | 2 chart records, no dasha | US-CH-013 |
| IT-CH-112 | Search index invoked | indexHoroscope called | US-CH-013 |
| IT-CH-113 | Legacy POST /api/horoscope (auto) unaffected | existing behavior | US-CH-013 |

### 2.2 `PUT /api/horoscope/[id]/manual-chart`

| ID | Test Case | Expected | Maps to |
|----|-----------|----------|---------|
| IT-CH-120 | Update lagna+houses | 200, persisted manualHousePlacements + derivedRanges recomputed | US-CH-013 |
| IT-CH-121 | No session | 401 | US-CH-013 |
| IT-CH-122 | Non-owner | 403 | US-CH-013 |
| IT-CH-123 | Horoscope not found | 404 | US-CH-013 |
| IT-CH-124 | Update on `source: "auto"` horoscope | 409 | US-CH-013 |
| IT-CH-125 | Malformed body | 400 | US-CH-013 |
| IT-CH-126 | Update navamsaLagna + navamsaHouses consistently | navamsaLagna + navamsaHouses in body → persisted with derived signs | US-CH-007 |
| IT-CH-127 | Update navamsaHouses without navamsaLagna | 400 | US-CH-002 |
| IT-CH-127 | Recompute validation + derivedRanges on update | response includes fresh validation/ranges | US-CH-004 |

---

## 3. Schema / Model Tests

| ID | Test Case | Expected | Maps to |
|----|-----------|----------|---------|
| SC-CH-130 | Horoscope defaults `source: "auto"` | legacy behavior unchanged | US-CH-013 |
| SC-CH-131 | Manual horoscope saves without birthDate/birthTime | schema accepts omission | US-CH-001 |
| SC-CH-132 | CalculatedDetails stores manualHousePlacements/derivedRanges | fields round-trip | US-CH-001 |
| SC-CH-133 | Auto horoscope has no manual fields | fields absent | US-CH-013 |
| SC-CH-134 | Duplicate planet across houses rejected at model/service level | 400 | US-CH-003 |

---

## 4. Component / UI Tests (Playwright or RTL as available)

| ID | Test Case | Expected | Maps to |
|----|-----------|----------|---------|
| UI-CH-140 | Mode toggle renders two tabs, defaults to Birth Details | Birth Details active | US-CH-001 |
| UI-CH-141 | Select Calculated Chart → manual form (name + lagna) | manual form shows | US-CH-001 |
| UI-CH-142 | Enter Lagna → house table derives 12 rows with signs | rows 1-12, correct sign glyphs | US-CH-002 |
| UI-CH-143 | Change Lagna → house signs re-derive | updates live | US-CH-002 |
| UI-CH-144 | Add planet via picker → chip appears, derived tables update | placement visible | US-CH-003 |
| UI-CH-145 | Remove planet via × → chip removed, tables update | removal works | US-CH-003 |
| UI-CH-146 | Already-placed planet hidden from picker | no duplicate option | US-CH-003 |
| UI-CH-147 | All 9 placed → all Add buttons disabled | disabled state | US-CH-003 |
| UI-CH-148 | Validation badges update live (valid/invalid/skipped/incomplete) | badge states correct | US-CH-004 |
| UI-CH-149 | Invalid badge tooltip shows rule text | tooltip content | US-CH-004 |
| UI-CH-150 | Save allowed with violations | advisory (non-blocking) | US-CH-004 |
| UI-CH-151 | Navamsa table collapsed by default, expandable | collapsible | US-CH-007 |
| UI-CH-152 | Navamsa planets → planets table gains navamsa columns | columns 8-11 populated | US-CH-008 |
| UI-CH-153 | Derived ranges card shows time/month/date/age | values render | US-CH-009..012 |
| UI-CH-154 | Ravi not placed → range hints | hints show | US-CH-009..012 |
| UI-CH-155 | Detail page shows Calculated Chart badge for manual | badge present | US-CH-013 |
| UI-CH-156 | Detail page Edit Chart opens editor prefilled | prefill works | US-CH-013 |
| UI-CH-157 | Dasha tab on manual horoscope shows "not available" | empty state | US-CH-013 |
| UI-CH-158 | Birth + navamsa charts render on manual detail | dual charts | US-CH-013 |
| UI-CH-159 | Sinhala + English strings both render (bilingual parity) | no missing keys, no tofu | US-CH-013 |
| UI-CH-160 | Mobile: house rows stack, chips wrap, Add ≥44px | responsive OK | US-CH-013 |

### E2E Flows

| ID | Flow | Steps | Expected | Maps to |
|----|------|-------|----------|---------|
| E2E-CH-170 | Create manual horoscope end-to-end | Toggle Calculated Chart → name+Lagna → place Sun, Moon, Mars, Budha, Sikuru, Rahu, Ketu → verify validation → navamsa optional → Save | redirect to detail, data persisted, tables show | US-CH-001..013 |
| E2E-CH-171 | Edit manual horoscope | Detail → Edit Chart → move planet → Save | PUT 200, tables refresh | US-CH-013 |
| E2E-CH-172 | Create with invalid placement | Place Budha far from Ravi | badge shows invalid, save still allowed | US-CH-004 |
| E2E-CH-173 | Validate Rahu/Ketu axis E2E | Rahu 4, Ketu 9 | badge invalid | US-CH-004 |

---

## 5. Bilingual Testing

| ID | Test Case | Expected |
|----|-----------|----------|
| BI-CH-180 | Switch to Sinhala → all manual UI strings render | both languages full parity |
| BI-CH-181 | Sign/planet names localized via enum maps | no hardcoded EN strings in JSX |
| BI-CH-182 | Sinhala text fits (30% wider allowance) | no overflow in badges/table |
| BI-CH-183 | i18n key coverage: every EN key has SI counterpart | en.json ↔ si.json in sync |

---

## 6. Accessibility Testing

| ID | Test Case | Expected |
|----|-----------|----------|
| AX-CH-190 | Mode toggle has `role="tablist"`/`tab`/`aria-selected` | keyboard operable |
| AX-CH-191 | Add planet menu `role="menu"` + `aria-haspopup` | screen-reader label present |
| AX-CH-192 | Planet chip remove buttons have `aria-label` | announce remove |
| AX-CH-193 | Validation badges `aria-live="polite"` | changes announced |
| AX-CH-194 | Tables have `th scope` + accessible names | readable |
| AX-CH-195 | Full keyboard flow: toggle → name → lagna → house → navamsa → save | tab order correct |
| AX-CH-196 | Color not sole channel (glyph+text+color) | WCAG 1.4.1 |
| AX-CH-197 | Contrast ≥4.5:1 text | WCAG AA |

---

## 7. Edge & Regression

| ID | Test Case | Expected |
|----|-----------|----------|
| RE-CH-200 | Lagna changed after placements → signs re-derive, placements re-validate | no crash |
| RE-CH-201 | Legacy auto horoscope detail page unchanged | no manual UI |
| RE-CH-202 | Save concurrent edits (two tabs) | last write wins, no corruption |
| RE-CH-203 | Large houses payload (many planets per house) | handled, all 9 max |
| RE-CH-204 | Ravi in house 12 wrap for birth-time/month | correct mod-12 tables |
| RE-CH-205 | Empty chart save | 201 with empty houses, derived ranges skipped |

---

## Test File Layout (proposed)

```
src/__tests__/manualChart.test.ts          // all UT-CH-* unit tests (pure module)
src/__tests__/manualHoroscope-api.test.ts  // IT-CH-* + SC-CH-* integration tests
src/__tests__/manualChart-ui.test.ts       // UI-CH-* component tests (if RTL available)
e2e/manual-chart.spec.ts                   // E2E-CH-* Playwright flows
```

## Acceptance Criteria Checklist (traceability)

| User Story | QA test IDs |
|-----------|-------------|
| US-CH-001 | UT-CH-004, IT-CH-100/103-105/109, SC-CH-130/131/132, UI-CH-140/141, E2E-CH-170 |
| US-CH-002 | UT-CH-001/002/003/005, UI-CH-142/143 |
| US-CH-003 | IT-CH-108, SC-CH-134, UI-CH-144/145/146/147 |
| US-CH-004 | UT-CH-010..024, IT-CH-127, UI-CH-148/149/150, E2E-CH-172/173 |
| US-CH-005 | UT-CH-030..037 |
| US-CH-006 | UT-CH-040..045 |
| US-CH-007 | IT-CH-101/102/126, UI-CH-151/152 |
| US-CH-008 | UT-CH-050..056, UI-CH-152 |
| US-CH-009 | UT-CH-060..063 |
| US-CH-010 | UT-CH-064..067 |
| US-CH-011 | UT-CH-068..070 |
| US-CH-012 | UT-CH-071..075 |
| US-CH-013 | IT-CH-111/112/113, SC-CH-130/133, UI-CH-155..160, E2E-CH-170/171, RE-CH-201 |
