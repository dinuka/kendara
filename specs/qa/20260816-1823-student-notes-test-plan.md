# Student Notepad (ශිෂ්ය සටහන් පොත) — QA Plan

**Date:** 2026-08-16 18:23
**Author:** QA (BMAD)
**Based on:** `docs/student-notes.md`, `specs/business-analysis/20260816-1543-student-notes.md` (US-SN-001…016), `specs/business-analysis/data-model.md` (HoroscopeNote, NotepadState, ObservationTags, ResultNotes, NotepadObservation, TagColor, House Purpose Catalog, Planet Signification Catalog), `specs/architecture/20260816-1559-student-notes-architecture.md`, `specs/ux/20260816-1803-student-notes.md`, `specs/ux/main-ux-spec.md` (Student Notepad revision)
**Precedent plans:** `specs/qa/20260813-2052-shadbalaya-test-plan.md` (debounced autosave, optimistic UI + rollback, overridden preservation), `specs/qa/20260815-1233-warga-kendara-test-plan.md` (pure-module unit tests, legacy fallback, bilingual), `specs/qa/20260814-2210-bhava-suchika-test-plan.md` (pure-module + search + render-time fallback)

---

## Scope

**In scope:** the Student Notepad feature end-to-end, before any code is written:

- Static house-purpose catalog (`src/lib/notepadCatalogs.ts` — to be built) and system-observation derivation (`src/lib/notepadObservations.ts` — to be built)
- `HoroscopeNote` Mongoose model (`src/models/HoroscopeNote.ts` — to be built) and GET/PUT `/api/horoscope/[id]/note` route (`src/app/api/horoscope/[id]/note/route.ts` — to be built)
- Notepad popup component(s) under `src/components/notepad/` (geometry, parent/sub-tag selection, system chips, student tags, result notes, autosave, counters)
- Bilingual `notepad.*` keys in `src/messages/en.json` / `src/messages/si.json`
- Cascade delete of `HoroscopeNote` from both horoscope DELETE routes; recalc-job non-interference
- Accessibility, bilingual, search-exposure, regression, and manual E2E coverage

**Out of scope:** the RAG search pipeline (existing keyword-based route, untouched); astrology engine changes (derivation must reuse existing stored `CalculatedDetails` fields only); domain-rule research (Open Questions 1–6 in the BA spec — provisional defaults asserted instead); share-link editing (read-only views show no notepad).

> ⚠️ **Greenfield verification (2026-08-16):** `src/lib/notepadCatalogs.ts`, `src/lib/notepadObservations.ts`, `src/models/HoroscopeNote.ts`, `src/app/api/horoscope/[id]/note/`, `src/components/notepad/`, and all `notepad.*` message keys **do not exist yet** (verified against `src/lib/`, `src/models/`, `src/app/api/horoscope/[id]/`, `src/components/`, `src/messages/*.json`). This plan asserts the architecture contract, not the code.

## Test Strategy

| Level | Approach | Framework | IDs |
|-------|----------|-----------|-----|
| Unit | Pure-module tests against numeric-enum fixtures; catalog completeness vs `docs/student-notes.md` 13-parent table; per-section derivation (auto+`wargaKendara`, legacy-no-warga, manual-no-warga, corrupt input); no mocks | Jest + ts-jest (node env) | `UT-SN-*` |
| Integration/API | Route-handler tests with mocked `getServerSession` + `connectDB` + mocked models (pattern: `privacy.test.ts`, `shadbalayaApi.test.ts`); assert exact `$set` dotted paths; prove **no computation runs in the route** | Jest | `IT-SN-*` |
| Component/UI | RTL 16.3.2 + jest-dom with per-file `/** @jest-environment jsdom */` (jest.config `testEnvironment: "node"` must be overridden per file — shadbalaya precedent); debounce/flush/rollback timing tests | RTL + Jest (jsdom per file) | `UI-SN-*` |
| E2E | **No E2E framework installed** (verified: no Playwright/Cypress in `package.json`) — cases are executable manual scripts; Playwright install is a Developer/PM decision (§Open Questions OQ-4) | Manual | `E2E-SN-*` |
| Accessibility | Keyboard operation, ARIA semantics, focus management, colorblind-safe distinction — static + manual + (optional) axe | Manual / axe (optional) | `AX-SN-*` |
| Bilingual | SI/EN key parity check (scripted), catalog fallback behaviour, Sinhala wrap at 360px | Jest (parity) + manual (wrap) | `BI-SN-*` |
| Search | Prove HoroscopeNote is never read by the search route; notes never leak into results | Jest (static + route tests) | `SR-SN-*` |
| Regression | Existing horoscope page, share view, recalc job, search, delete-cascade — no interference | Jest + manual | `RE-SN-*` |

**Approach:** all rule logic lives in the two pure modules — unit tests assert against fixtures directly with no mocks. API tests assert persistence shape and prove the route only persists (no derivation, no GET side effects). UI tests verify debounce/rollback/flush and isolation. E2E cases double as the Developer's manual acceptance script. **The two locked-in requirements (below) are treated as the acceptance spine** — every test in their matrix failing is a release blocker.

## Locked-In Requirements (acceptance spine — RELEASE BLOCKER if violated)

**Requirement 1 — Observations always follow the viewed horoscope** (US-SN-001 AC5, US-SN-016): system observations are derived strictly from the **currently viewed horoscope's** `CalculatedDetails` (incl. `wargaKendara`). Switching horoscopes instantly switches observations/tags/notes/geometry; the notepad never shows another horoscope's data; no cross-horoscope bleed.

- Coverage: UT-SN-102/113/116 (derivation inputs), UI-SN-414/415 (instant switch + stale-response guard), E2E-SN-1101 (two-horoscope manual flow), IT-SN-224 (no cached computation in route).

**Requirement 2 — All student modifications persist per (student, horoscope)** (US-SN-013 AC5): every student change — popup geometry, selection state (when persisted), observation tags, result notes — is written to the `HoroscopeNote` document for that (student, horoscope) pair. Nothing lives only in memory; reopening restores everything from the DB.

- Coverage: IT-SN-206..209/222/223/228 (lazy create, upsert, field-group `$set`, last-write-wins, concurrent saves), UI-SN-500..506 (debounce/flush/rollback), UI-SN-305 (restore-on-reopen), RE-SN-907 (reload), E2E-SN-1100/1105.

## Test Environment & Data Setup

| Environment | Configuration |
|-------------|---------------|
| Unit | `npx jest src/__tests__/notepadCatalogs.test.ts` / `npx jest src/__tests__/notepadObservations.test.ts` |
| API | Route-handler tests, mocked session + DB + models (reuse `privacy.test.ts` / `shadbalayaApi.test.ts` patterns); assert `$set` dotted paths on mocked `findOneAndUpdate`/`updateOne` |
| Component | `/** @jest-environment jsdom */` per file + fake timers for debounce/flush |
| E2E/manual | Dev server, seeded DB: 2 auto horoscopes (with `wargaKendara`), 1 manual-without-warga, 1 legacy doc (no `wargaKendara`), 1 share link; SI + EN sessions |

**Fixture conventions (mirror `calculation.test.ts` fixture helpers):**

```ts
const planet = (name: number, house: number, absoluteDegree = 0, o: Partial<Planet> = {}) => ({
    name, house, absoluteDegree,
    sign: o.sign ?? ((house - 1) % 12) + 1,
    strength: PlanetaryStrength.SAMA,
    retrograde: false,
    nakshatra: o.nakshatra ?? 1,
    pada: o.pada ?? 1,
    ...o,
});
```

Per-section `CalculatedDetails` fixtures: `autoWarga` (planets + `wargaKendara` with `d1`, `chandraLagna`, `suryaLagna`, 4 warga entries), `legacyNoWarga` (planets only), `manualNoWarga` (manual planets only), `corruptPartial` (missing arrays, `undefined` fields, malformed warga).

---

## 1. Unit Tests — Static House-Purpose Catalog (`src/lib/notepadCatalogs.ts`)

Catalog contract (BA US-SN-003, `docs/student-notes.md`): exactly 13 parent tags — house purposes 1–12 (Sanskrit names) + "Other" — each with stable sub-tag keys; planet-signification catalog with reverse sub-tag → planet mapping.

| ID | Test Case | Expected | Maps to |
|----|-----------|----------|---------|
| UT-SN-001 | Parent tag count and order | Exactly 13 parents: 1–12 (house number order) then 0/"Other" last; every parent has numeric `parentTag` 1–12 or 0 | US-SN-003 AC1 |
| UT-SN-002 | Sanskrit names per parent | 1 Tanu/Lagna, 2 Dhana, 3 Sahaja/Bhrātṛ, 4 Sukha, 5 Putra, 6 Ripu, 7 Yuvati/Kalatra, 8 Ayur, 9 Dharma, 10 Karma, 11 Labha, 12 Vyaya (match `docs/student-notes.md` table verbatim) | US-SN-003 AC2 |
| UT-SN-003 | Sub-tags of parent 1 | Exactly: Self, Body, Personality, Identity, Vitality, Appearance — each with a stable string key | US-SN-003 AC3 |
| UT-SN-004 | Sub-tag key stability & uniqueness | Every sub-tag key is a stable non-empty string; keys unique across the whole catalog; no two parents share a key | US-SN-003 AC3 |
| UT-SN-005 | "Other" parent has no sub-tags | Parent 0/Other → empty sub-tag list (free-form tags area instead); `subTag` must be `null` for Other | US-SN-002 AC3, US-SN-011 |
| UT-SN-006 | Every house parent has ≥1 sub-tag | Parents 1–12 each expose ≥1 sub-tag (failing = empty drill-down) | US-SN-003 AC3 |
| UT-SN-007 | Reverse signification mapping — sub-tag → planets | For every sub-tag: `subTagToPlanets` yields ≥1 planet OR the sub-tag is explicitly unmapped (neutral); no crash on unmapped | US-SN-006 AC2 |
| UT-SN-008 | Planet signification catalog coverage | Every planet 1–9 appears in `planetToSignifications` with ≥1 signification | US-SN-006 AC2 |
| UT-SN-009 | TagColor enum | Values 1–6 map to Green/Red/White/Blue/Yellow/Purple; default = White (3); invalid 0 / 7 / "1" rejected by the validator | US-SN-011, data-model TagColor |
| UT-SN-010 | Catalog is static (no runtime generation) | Deep-freeze/immutability snapshot: repeated access returns identical structure; modifying a returned object throws (or is inert) — guards render-time identity for React keys | US-SN-011, US-SN-016 |

---

## 2. Unit Tests — System Observation Derivation (`src/lib/notepadObservations.ts`)

Contract: pure function over `CalculatedDetails` (+ selected `parentTag`/`subTag`) → `NotepadObservation` with `sections[]` — section keys: `planetsInHouse`, `houseLoad`, `nakshatraLoad`, `significations`, `chandraLagnaHouse`, `suryaLagnaHouse`, `relatedWargaKendara` (provisional names — see §Open Questions OQ-5). Every section: `ratio: { green, total }` and `tags[]` with `kind`, `color` (`green`/`red`/`white`), `labelKey` + `params`.

### 2a. Planets in the house (US-SN-004)

| ID | Test Case | Input | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UT-SN-100 | Planets listed for selected house, auto source | `autoWarga` fixture, parent 7 | Section `planetsInHouse` lists every planet whose whole-sign house = 7 per `wargaKendara.d1.houses[].planets`; each tag has `kind: "planet"`, `planet`, `sign`, `house`, `strength`, `nakshatra`, `pada` | US-SN-004 AC1 |
| UT-SN-101 | Legacy fallback — no `wargaKendara` | `legacyNoWarga`, parent 7 | Planets taken from `CalculatedDetails.planets[].house` (same tag shape) — feature still works pre-`wargaKendara` | US-SN-004 AC2, US-SN-016 |
| UT-SN-102 | Source precedence — both sources disagree | fixture where `wargaKendara.d1` whole-sign house ≠ `planets[].house` | `wargaKendara.d1` wins deterministically (whole-sign placement is authoritative); never a mix within one render | US-SN-004 AC1, US-SN-016 |
| UT-SN-113b | Manual horoscope without warga | `manualNoWarga`, parent 1 | Planets listed from manual planets' `house`; no crash | US-SN-004 AC2, US-SN-016 |

### 2b. House load and Nakshatra load (US-SN-005)

> Domain rule pending (BA OQ1–2) — provisional: `houseLoad` = count of planets in the selected house (incl. Rahu/Ketu), `nakshatraLoad` = count of planets in the selected house's nakshatra. **Structure and determinism are asserted; exact semantics swap in when Domain confirms** (classifier must be pluggable).

| ID | Test Case | Input | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UT-SN-103 | House load tag emitted | 2 planets in house 7 | `houseLoad` section with `ratio: { green: <per provisional rule>, total: 2 }`; single `kind: "load"` tag, `labelKey: "notepad.observation.houseLoad"`, `params: { house: 7, count: 2 }` | US-SN-005 AC1 |
| UT-SN-104 | Empty house → no load tag | 0 planets in house 7 | `houseLoad` section omitted entirely (zero-tag sections are not rendered — UX decision) — never `(0/0)` | US-SN-005, US-SN-010 |
| UT-SN-105 | Nakshatra load tag emitted | 1 planet in nakshatra X | `nakshatraLoad` section with `ratio: { green: <per rule>, total: 1 }` and load tag params `{ nakshatra: X, count: 1 }` | US-SN-005 AC2 |

### 2c. Sub-tag relevant planet significations (US-SN-006)

| ID | Test Case | Input | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UT-SN-106 | Signification planets resolved via reverse map | sub-tag "marriage" → planet(s) via `subTagToPlanets` | `significations` section lists exactly the mapped planets present in the chart, same tag shape as planetsInHouse | US-SN-006 AC1 |
| UT-SN-106b | Unmapped sub-tag | sub-tag with no signification planets | Section rendered with a neutral `kind: "signification"` tag (white), `params` noting unmapped — never empty crash | US-SN-006 AC2 |
| UT-SN-107 | Strength-based color classification | planet with `PlanetaryStrength.UCHCHA/ATHI_UCHCHA/OWN_SIGN/MOOLATRIKONA/MITRA` → green; `NEECHA/ATHI_NEECHA/SHATRU` → red; `SAMA` → white | Each tag's `color` matches the provisional rule; classification identical across all sections for the same planet | US-SN-006 AC3, US-SN-010 AC1 |
| UT-SN-108 | Pluggable classifier + domain-pending neutrality | Default classifier; strength outside the known set (`NaN`, new enum value) | Unknown strength → `white` (neutral), never throws; classifier can be swapped without touching section builders | US-SN-010 AC2 |

### 2d. Chandra Lagna / Surya Lagna related house (US-SN-007/008)

| ID | Test Case | Input | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UT-SN-109 | Chandra Lagna related house | `autoWarga` with `chandraLagna` present, parent 7 | `chandraLagnaHouse` section: related house number resolved from `wargaKendara.chandraLagna` (provisional rule: parent house number in the reference chart), planets of that house listed | US-SN-007 AC1 |
| UT-SN-110 | Surya Lagna related house | `autoWarga` with `suryaLagna` present, parent 7 | Same shape via `wargaKendara.suryaLagna`; identical related-house rule to UT-SN-109 | US-SN-008 AC1 |
| UT-SN-109b | Chandra/Surya Lagna absent | `legacyNoWarga` / `manualNoWarga` | Sections degrade to not-available tag (`color: "white"`, label indicates unavailable) + `logger.warn` — never throws | US-SN-007/008, US-SN-016 |

### 2e. Related Warga Kendara (US-SN-009)

| ID | Test Case | Input | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UT-SN-111 | Legacy fallback via `resolveWargaKendara` | `legacyNoWarga` (no `wargaKendara` field) | `resolveWargaKendara` fallback path invoked; section degrades to not-available (warga data does not exist for legacy snapshots) + warn; never throws | US-SN-009, US-SN-016 |
| UT-SN-112 | Full warga observation | `autoWarga` with 4 warga entries, parent 7 | `relatedWargaKendara` section includes warga lagna, warga load + position, related house, and D1 load in the warga chart (per architecture `resolveWargaKendara` contract); `ratio` reflects warga planets | US-SN-009 AC1–2 |
| UT-SN-112b | Warga entry missing fields | `corruptPartial` with warga entries missing `lagna`/`planets` | Affected sub-parts degrade to not-available individually; section still renders; no partial-data leaks from another house | US-SN-009, US-SN-016 |

### 2f. Ratio, determinism, robustness (US-SN-010, US-SN-016)

| ID | Test Case | Input | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UT-SN-115 | Ratio computation matrix | (a) 2 planets, 1 green → `{ green: 1, total: 2 }`; (b) 0 green of 2 → `{ green: 0, total: 2 }` (badge all-white, still rendered); (c) single-planet section `{ green: 0, total: 1 }`; (d) zero tags → section omitted (no `0/0`) | Ratio object matches for all four cases; never `total: 0` on a rendered section | US-SN-010 AC3 |
| UT-SN-116 | Determinism | Same fixture twice + JSON deep-equal | Identical `NotepadObservation` output (stable ordering, stable tag IDs/keys for React reconciliation) | US-SN-016 |
| UT-SN-117 | Corrupt/partial input never throws | `corruptPartial` (missing arrays, `undefined` fields, malformed warga) | Each section degrades to not-available; function returns valid shape or logs + returns graceful empty sections; no exception escapes | US-SN-016 AC3 |

---

## 3. Integration / API Tests — GET/PUT `/api/horoscope/[id]/note` (US-SN-013, US-SN-014)

Route contract (architecture): `getServerSession` → 401 if missing → `connectDB` → viewability check → GET returns stored doc or **empty defaults without creating one**; PUT upserts with per-field-group `$set`, strict body validation → 400 with **no writes**; last-write-wins; cascade delete; recalc never touches the collection.

### 3a. Auth & viewability (US-SN-014)

| ID | Test Case | Steps | Expected | Maps to |
|----|-----------|-------|----------|---------|
| IT-SN-200 | GET unauthenticated | No session, GET `/api/horoscope/<id>/note` | `401 { error: "Unauthorized" }` | US-SN-014 AC1 |
| IT-SN-201 | PUT unauthenticated | No session, PUT with valid body | `401`, no write | US-SN-014 AC1 |
| IT-SN-202 | Horoscope not found | Session, GET `/api/horoscope/<nope>/note` | `404` (never 403) | US-SN-014 AC2 |
| IT-SN-203 | Non-owner, non-public horoscope | Session of user B, horoscope owned by user A (private) | `404` — **never `403`** (privacy posture; differs from shadbalaya route) | US-SN-014 AC2 |
| IT-SN-204 | Share-link / public viewer | Session of viewer, horoscope viewable via share token but not owned | `404` — notes are private to the student, never exposed to share/public viewers | US-SN-014 AC3 |
| IT-SN-205 | Super-admin access | Session role `super-admin`, any horoscope | `200` GET (repo precedent: admins may mutate student data, cf. shadbalaya) — confirm in OQ-6 | US-SN-014 |

### 3b. GET semantics (US-SN-013)

| ID | Test Case | Steps | Expected | Maps to |
|----|-----------|-------|----------|---------|
| IT-SN-206 | GET with no existing note → empty defaults, **no document created** | Session + existing horoscope, no HoroscopeNote doc | `200` body exactly `{ notepadState: null, observationTags: [], resultNotes: [] }`; collection count unchanged (no lazy create on GET) | US-SN-013 AC1 |
| IT-SN-207 | GET with existing note → exact round-trip | Seed HoroscopeNote with geometry + 2 tags + 1 note | `200` body deep-equals stored values (no transformation loss) | US-SN-013 AC2 |

### 3c. PUT semantics (US-SN-013)

| ID | Test Case | Steps | Expected | Maps to |
|----|-----------|-------|----------|---------|
| IT-SN-208 | First PUT creates the doc (lazy create) | PUT valid body, no prior doc | `200`; one HoroscopeNote doc created keyed on (user.id, horoscope.id); body values persisted | US-SN-013 AC1 |
| IT-SN-209 | Subsequent PUT upserts, never duplicates | Two PUTs same (student, horoscope) | Exactly one doc; second PUT updates it (`findOneAndUpdate` upsert path), count stays 1 | US-SN-013 AC2 |
| IT-SN-210 | Valid geometry persisted | PUT `notepadState.position = {x:120,y:80}`, `size = {width:480,height:640}` | `200`; `$set` includes `"notepadState.position"`, `"notepadState.size"` dotted paths | US-SN-001 AC3 |
| IT-SN-211 | Geometry below min bounds → 400, no write | `size.width = 319` (min 320) | `400`; no document created/modified | US-SN-001 AC3 |
| IT-SN-212 | Geometry above max bounds → 400, no write | `size.height = 1201` (max 1200) | `400`; no write | US-SN-001 AC3 |
| IT-SN-213 | `parentTag` out of range | `selectedParentTag = 13` or `-1` | `400`; no write | US-SN-002 |
| IT-SN-214 | `parentTag` non-integer / non-number | `"7"`, `7.5`, `null` | `400` | US-SN-002 |
| IT-SN-215 | `subTag` not in catalog for that parent | `selectedParentTag: 7, selectedSubTag: "not-a-key"` | `400`; no write | US-SN-002 AC2 |
| IT-SN-216 | `subTag: null` valid for "Other" | `selectedParentTag: 0, selectedSubTag: null` | `200` | US-SN-002 AC3 |
| IT-SN-217 | Observation tag text > 500 chars | tag `text` length 501 | `400`; no write (boundary 500 → `200`) | US-SN-011 AC3 |
| IT-SN-218 | Result note text > 2000 chars | note `text` length 2001 | `400`; no write (boundary 2000 → `200`) | US-SN-012 AC2 |
| IT-SN-219 | TagColor out of range | tag `color: 0` or `7` | `400`; no write | US-SN-011 AC2 |
| IT-SN-220 | Tag count cap | `observationTags` array length 201 | `400`; no write (boundary 200 → `200`) | US-SN-011 AC3 |
| IT-SN-221 | Note count cap | `resultNotes` length 101 | `400`; no write (boundary 100 → `200`) | US-SN-012 AC2 |
| IT-SN-222 | Per-field-group `$set` — untouched groups survive | Seed doc with all three groups; PUT only `notepadState` | `200`; `$set` touches only `notepadState.*`; `observationTags`/`resultNotes` unchanged in DB | US-SN-013 AC3 |
| IT-SN-223 | Last-write-wins | PUT geometry A, then PUT geometry B (sequential) | Final stored geometry = B; no merge, no conflict error | US-SN-013 AC2 |
| IT-SN-228 | Concurrent PUTs same doc | Two parallel PUTs with different geometry | One doc total; final state = one of the two (last-write-wins), never two docs, never corrupted JSON | US-SN-013 AC2 |
| IT-SN-229 | Unknown extra fields ignored | Body with `notepadState` + `hackerField: "x"` | `200`; `hackerField` not persisted | US-SN-013 AC4 |
| IT-SN-230 | Empty / malformed JSON body | `PUT` with `{}` or invalid JSON | `400`; no write | US-SN-013 AC4 |

### 3d. No computation in route + lifecycle (US-SN-013/016, US-SN-014)

| ID | Test Case | Steps | Expected | Maps to |
|----|-----------|-------|----------|---------|
| IT-SN-224 | Route performs no derivation | Static check: `route.ts` imports neither `notepadObservations` nor `notepadCatalogs` | Derivation lives in pure modules only; route persists what it receives verbatim (shadbalaya precedent) | US-SN-016 |
| IT-SN-225 | Recalc job never touches HoroscopeNote | Static + behavioural check: `recalculationJob.ts` has no `HoroscopeNote` import/query; run recalc over seeded notes | `CalculatedDetails` updated; `HoroscopeNote` docs byte-identical before/after | US-SN-013 AC5 |
| IT-SN-226 | Cascade delete on horoscope DELETE | DELETE horoscope with existing HoroscopeNote | `HoroscopeNote.deleteMany({ "horoscope.id": id })` invoked; no orphan docs (both DELETE routes) | US-SN-014 AC4, data-model lifecycle |

---

## 4. Component / UI Tests — Notepad Popup (`src/components/notepad/*`)

### 4a. Geometry (US-SN-001)

| ID | Test Case | Steps | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UI-SN-300 | Open notepad from detail page | Click notepad entry point | Popup renders with `z-index: 40`, default right-docked `480×640`; page content remains interactive behind it | US-SN-001 AC1 |
| UI-SN-301 | Drag moves popup | Pointer drag on header | `position` updates live; on release, PUT persists new `position` | US-SN-001 AC2 |
| UI-SN-302 | Resize handle | Drag bottom-right handle | `size` updates live within bounds; persisted on release | US-SN-001 AC2 |
| UI-SN-303 | Resize clamps below min | Attempt to shrink below `320×400` | Size never below min (clamped, not rejected mid-drag); persisted clamped value | US-SN-001 AC3 |
| UI-SN-304 | Resize clamps above max | Attempt to grow beyond `900×1200` | Size never exceeds max | US-SN-001 AC3 |
| UI-SN-305 | Reopen restores geometry + open-state + selection | Close with `{x:120,y:80,480×640}`, open again | Popup reopens at stored position/size; `isOpen`/selection restored from DB (Requirement 2) | US-SN-001 AC4, US-SN-013 |
| UI-SN-309 | Close button flushes pending save then closes | Type a tag, click close < 500ms after | PUT fires before close completes; popup closes after (Requirement 2) | US-SN-001, US-SN-013 |
| UI-SN-310 | No remount churn on tab switch | Switch browser tabs and return | Popup geometry/state intact (no flicker, no re-derive flash) | US-SN-001 |

### 4b. Parent/sub-tag selection & chips (US-SN-002, US-SN-011, US-SN-010)

| ID | Test Case | Steps | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UI-SN-400 | Parent strip renders 13 items, single-select | Open notepad | 12 house purpose items + "Other"; selecting one deselects the others (radio semantics via `aria-pressed`); "Other" is last | US-SN-002 AC1 |
| UI-SN-401 | Sub-tag area follows parent | Select parent 7 | Sub-tag list for parent 7 renders (e.g. Marriage); system observations re-derive for (7, selected sub-tag) | US-SN-002 AC2 |
| UI-SN-402 | "Other" parent shows free-form area | Select "Other" | No house sub-tags; student free-form observation tags area renders instead (US-SN-011) | US-SN-002 AC3 |
| UI-SN-403 | No-op click on already-selected parent | Click currently selected parent 7 | No state change; no save churn (no PUT fired) | US-SN-002 AC1 |
| UI-SN-404 | No-op click on already-selected sub-tag | Click currently selected sub-tag | No state change; no PUT fired | US-SN-002 AC2 |
| UI-SN-405 | Selecting sub-tag re-derives observations | Select sub-tag "marriage" | All seven sections re-derive against (7, "marriage"); no stale sections from previous selection | US-SN-002 AC2, US-SN-016 |
| UI-SN-406 | Default selection on first-ever open | Fresh (student, horoscope), no saved state | Parent 1 selected, no sub-tag; nothing saved to DB until first student modification | US-SN-002, US-SN-013 |
| UI-SN-407 | System chips vs student tags visually distinct (colorblind-safe) | Render both kinds | System chips = pill + dot + label; student tags = dashed-square + tint — distinguishable **without color** (never color-only distinction) | US-SN-010 AC4, US-SN-011 |
| UI-SN-408 | TagColor picker (6 colors, default White) | Add student tag | Picker offers exactly 6 colors (TagColor 1–6); default White (3); selection applies tint immediately | US-SN-011 AC2 |
| UI-SN-409 | Free-form tag add under Other | "Other" selected, type text + color, submit | Tag chip appears under Other with `parentTag: 0, subTag: null`; queued for autosave | US-SN-011 AC1 |
| UI-SN-410 | Tag text input cap | Type 501 chars into tag composer | Input stops at 500; counter shows 500; save persists 500 | US-SN-011 AC3 |
| UI-SN-411 | Tag delete | Delete a student tag | Chip removed immediately (optimistic); deletion persisted | US-SN-011 AC4 |
| UI-SN-412 | Result note add | Type a note in the result-notes area | Note appended; newest-first at render; persisted | US-SN-012 AC1 |
| UI-SN-413 | Result note delete | Delete a note | Removed immediately; persisted | US-SN-012 AC1 |

### 4c. Per-horoscope isolation (Requirement 1 — RELEASE BLOCKER if violated)

| ID | Test Case | Steps | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UI-SN-414 | Switching horoscopes swaps everything instantly | Notepad open on horoscope A (parent 7, tags, notes); navigate to horoscope B | Observations, tags, notes, geometry all swap to B's data immediately; no frame shows A's data under B (Requirement 1) | US-SN-001 AC5, US-SN-016 AC1 |
| UI-SN-415 | Stale-response guard across switches | Slow PUT in flight for A, switch to B, B's autosave resolves first; A's response arrives late | Late A response is discarded — B's state never overwritten by A's response (Requirement 1 + 2) | US-SN-001 AC5, US-SN-013 AC5 |
| UI-SN-415b | Flush before switch | Pending unflushed edit on A, navigate to B | A's edit is flushed to A's doc before B's state loads (keepalive flush on navigate) | US-SN-013 AC5 |

### 4d. Autosave — debounce, optimistic UI, rollback, flush (US-SN-013)

| ID | Test Case | Steps | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UI-SN-500 | 500ms debounce — no PUT before quiet period | Change a tag; observe network | No PUT within 500ms; exactly one PUT after 500ms of quiet | US-SN-013 AC2 |
| UI-SN-501 | Rapid successive edits coalesce | Type 10 chars quickly (each an edit) | One PUT with final state (not 10); debounce timer resets per keystroke | US-SN-013 AC2 |
| UI-SN-502 | Optimistic UI | Change selection | UI reflects change immediately (before PUT resolves); no spinner/block | US-SN-013 AC2 |
| UI-SN-503 | PUT failure → rollback + toast | Mock PUT → 500 | UI reverts to pre-change state; error toast shown (`role=alert`); student retries manually | US-SN-013 AC2 |
| UI-SN-504 | Keepalive flush on close | Edit, close within 500ms | Pending change flushed on close (Requirement 2) | US-SN-013 AC3 |
| UI-SN-505 | Keepalive flush on navigate/unmount | Edit, navigate away within 500ms | Pending change flushed before unmount (Requirement 2) | US-SN-013 AC3 |
| UI-SN-506 | Stale-response guard on flush | Flush fired; a pre-flush PUT resolves after flush | Late pre-flush response does not clobber the flushed state (compare-sequence guard) | US-SN-013 AC2 |

### 4e. Counters & caps (US-SN-011, US-SN-012)

| ID | Test Case | Steps | Expected | Maps to |
|----|-----------|-------|----------|---------|
| UI-SN-600 | Tag counter n/200; amber ≥80% | Add 160 tags | Counter `160/200` styled amber (≥80%); red at 200 | US-SN-011 AC3 |
| UI-SN-601 | Note counter n/100; amber ≥80% | Add 80 notes | Counter `80/100` amber; red at 100 | US-SN-012 AC2 |
| UI-SN-602 | Composer disabled at 200 tags | 200 tags present | Tag composer disabled; no further adds (API would 400 anyway) | US-SN-011 AC3 |
| UI-SN-603 | Composer disabled at 100 notes | 100 notes present | Note composer disabled | US-SN-012 AC2 |
| UI-SN-604 | Note char counter 2000; amber ≥1600, red 2000 | Type into note textarea | Counter `n/2000`; amber from 1600; input blocked at 2000 | US-SN-012 AC2 |
| UI-SN-605 | Tag char counter 500; blocked at cap | Type into tag composer | Counter `n/500`; blocked at 500 | US-SN-011 AC3 |

---

## 5. Accessibility Tests (AX-SN)

| ID | Test Case | Steps | Expected | Maps to |
|----|-----------|-------|----------|---------|
| AX-SN-700 | Focus trap + Esc | Tab repeatedly inside open popup; press Esc | Tab cycles within popup (focus never escapes to background); Esc closes popup and returns focus to entry point | US-SN-001 AC1 |
| AX-SN-701 | Parent strip keyboard operation | Arrow keys over parent strip | Arrow keys move selection across the 13 parents (radio-group pattern); `aria-pressed` reflects state for AT | US-SN-002 AC1 |
| AX-SN-702 | Sub-tag list keyboard operable | Tab to sub-tag list, arrows | Sub-tags selectable via keyboard; selection announced | US-SN-002 AC2 |
| AX-SN-703 | Chip color announced | Screen reader over a tinted student tag | Color conveyed in the accessible name/label (not color-only) | US-SN-011 AC2 |
| AX-SN-704 | Keyboard geometry reachable | Ctrl+Alt+Arrow on popup | Moves/resizes popup per UX keyboard spec; clamped to bounds; reset action reachable | US-SN-001 AC2 |
| AX-SN-705 | Focus restore on close | Open, interact, Esc/close | Focus returns to the notepad entry point (no focus loss) | US-SN-001 |
| AX-SN-706 | Colorblind-safe chips (static review) | Inspect chip styles | Dashed-border/tint + dot + label for student tags; pill + dot + label for system chips — no information conveyed by color alone | US-SN-010 AC4 |
| AX-SN-707 | Toast announced | Trigger PUT failure rollback | Toast has `role="alert"`/`aria-live`; screen reader announces without focus steal | US-SN-013 AC2 |
| AX-SN-708 | Contrast on tinted chips | Sample all 6 TagColor tints + white | Text on every tint meets WCAG AA 4.5:1 (or 3:1 for large text) | US-SN-011 |
| AX-SN-709 | Reduced motion | `prefers-reduced-motion: reduce` + open/close/drag | No problematic animation (or motion disabled); geometry ops remain functional | US-SN-001 |

---

## 6. Bilingual Tests (US-SN-015)

| ID | Test Case | Steps | Expected | Maps to |
|----|-----------|-------|----------|---------|
| BI-SN-800 | `notepad.*` key parity | Script: diff `notepad.*` keys in en.json vs si.json | Identical key sets (no missing keys in either locale); all values non-empty | US-SN-015 AC1 |
| BI-SN-801 | SI-pending catalog → EN fallback | Catalog string missing SI translation | EN string renders; never a raw `notepad.parentTag.*` key leak | US-SN-015 AC2 |
| BI-SN-802 | Parent/sub-tag labels localized | Render strip in SI and EN sessions | Parent 1 label "1 — The person" / SI equivalent + Sanskrit name present in both; sub-tag labels translated | US-SN-015 AC1 |
| BI-SN-803 | Sinhala wrap at 360px | Popup resized to min width 320 (near-bound 360 check) in SI session | Long Sinhala labels/chips wrap without horizontal overflow or clipped text | US-SN-015 AC3 |
| BI-SN-804 | Sinhala wrap in note textarea + chips | SI note with long sentence, narrow popup | Text wraps; no scrollbar overflow; chips grow vertically, not horizontally | US-SN-015 AC3 |
| BI-SN-805 | Locale switch mid-session | Change locale while notepad open | Labels re-render in new locale; student tags/notes data untouched (data is locale-independent, only UI strings translate) | US-SN-015 |

---

## 7. Search Tests (SR-SN) — notes never indexed or leaked

| ID | Test Case | Steps | Expected | Maps to |
|----|-----------|-------|----------|---------|
| SR-SN-1000 | Search route never reads HoroscopeNote | Static check of `src/app/api/search/route.ts` | No `HoroscopeNote` import/query anywhere in the search pipeline | US-SN-014 AC5 |
| SR-SN-1001 | Notes not indexed | Create horoscope with 200 tags incl. keyword "secret-astro"; search "secret-astro" | Result ranking unaffected by note content; no note text in any result payload | US-SN-014 AC5 |
| SR-SN-1002 | Note content absent from share/result payloads | Share-link GET + search result payload for a horoscope with notes | Payloads contain no `notepadState`/`observationTags`/`resultNotes` fields | US-SN-014 AC3/AC5 |

---

## 8. Regression Tests (RE-SN)

| ID | Test Case | Expected | Maps to |
|----|-----------|----------|---------|
| RE-SN-900 | Horoscope detail page renders with notepad entry point | Page loads; chart, dashas, metadata sections unaffected; entry point present for owner | US-SN-001 |
| RE-SN-901 | Share-link / public view shows no notepad | No entry point, no notes exposure, no geometry state fetched | US-SN-014 AC3 |
| RE-SN-902 | Recalc job with notes present | Recalc completes; `CalculatedDetails` refreshed; notes/geometry byte-identical | US-SN-013 AC5 |
| RE-SN-903 | Search results page unaffected | Search page loads with no notepad artifacts | US-SN-014 AC5 |
| RE-SN-904 | Horoscope delete cascades to notes | DELETE horoscope → notes gone (no orphan docs, no FK errors) | US-SN-014 AC4 |
| RE-SN-905 | Existing saved-filter / search-bookmark flows unaffected | Bookmark/filter CRUD round-trips pass | — |
| RE-SN-906 | Performance at max capacity | Open notepad with 200 tags + 100 notes + full observations | No measurable page jank; popup drag/resize stays responsive (manual, dev-server check) | US-SN-011/012 |
| RE-SN-907 | State survives reload (Requirement 2) | Add tags/notes/geometry, hard-reload page | Everything restores from DB — nothing lost, nothing duplicated | US-SN-013 AC1 |

---

## 9. E2E Manual Test Scripts (E2E-SN) — no framework installed

> No Playwright/Cypress in `package.json` (verified). These scripts double as the Developer's manual acceptance pass. Install decision: §Open Questions OQ-4.

| ID | Script | Expected |
|----|--------|----------|
| E2E-SN-1100 | **Persistence round-trip (Req 2):** open notepad → select parent 7 + sub-tag "marriage" → add 2 colored student tags → add 1 result note → resize/move popup → close → reopen | Geometry, selection, tags, notes all restored exactly; DB shows one HoroscopeNote doc; no duplicate PUTs after reopen |
| E2E-SN-1101 | **Cross-horoscope isolation (Req 1):** notepad open on horoscope A with tags/notes → navigate to horoscope B → verify B's observations/tags/notes/geometry → navigate back to A | A's data returns exactly; no bleed in either direction; observations always match the viewed horoscope |
| E2E-SN-1102 | **Share-link read-only:** open share link of a horoscope with notes | No notepad entry point; no notes in payloads; page renders read-only |
| E2E-SN-1103 | **Recalc survival:** run AstrologySettings recalculation → reopen notepad | Notes/tags/geometry unchanged; observations re-derive from refreshed `CalculatedDetails` |
| E2E-SN-1104 | **Bilingual flow:** SI session full flow (open, tag, note, close, reopen); EN session same | SI labels render (EN fallback where catalog SI-pending, no raw keys); no layout break at 360px width |
| E2E-SN-1105 | **Caps + counters:** fill to 200 tags and 100 notes; push note text to 2000 chars; trigger a forced PUT failure (devtools offline) | Counters amber→red; composers disable at caps; failure rolls back with toast; retry persists |

---

## Traceability Matrix (user story → test IDs)

| User story | Test IDs |
|-----------|----------|
| US-SN-001 (open/move/resize) | UI-SN-300..304/309/310, AX-SN-700/704/705/709, IT-SN-210..212, E2E-SN-1100 |
| US-SN-002 (parent strip + drill-down) | UT-SN-005, UI-SN-400..406, AX-SN-701/702, IT-SN-213..216 |
| US-SN-003 (house-purpose catalog) | UT-SN-001..008, BI-SN-801/802 |
| US-SN-004 (planets in house) | UT-SN-100/101/102/113b, IT-SN-224 |
| US-SN-005 (house/nakshatra load) | UT-SN-103..105 |
| US-SN-006 (sub-tag significations) | UT-SN-007/008/106/106b/107 |
| US-SN-007 (Chandra Lagna) | UT-SN-109/109b |
| US-SN-008 (Surya Lagna) | UT-SN-110/109b |
| US-SN-009 (related Warga Kendara) | UT-SN-111/112/112b |
| US-SN-010 (color + ratio) | UT-SN-107/108/115, UI-SN-407/408, AX-SN-706/708 |
| US-SN-011 (student observation tags) | UT-SN-009/010, UI-SN-407..411/600/602/605, IT-SN-217/219/220, AX-SN-703 |
| US-SN-012 (result notes) | UI-SN-412/413/601/603/604, IT-SN-218/221 |
| US-SN-013 (persistence + lifecycle) | IT-SN-206..209/222/223/228..230, UI-SN-500..506, RE-SN-907, E2E-SN-1100/1105 |
| US-SN-014 (privacy / read-only) | IT-SN-200..205/226, RE-SN-901/904, SR-SN-1000..1002, E2E-SN-1102 |
| US-SN-015 (bilingual) | BI-SN-800..805, E2E-SN-1104 |
| US-SN-016 (derivation from CalculatedDetails) | UT-SN-100..117, IT-SN-224/225, UI-SN-405/414/415, E2E-SN-1101 |

**Counts:** UT-SN 34 · IT-SN 31 · UI-SN 37 · AX-SN 10 · BI-SN 6 · SR-SN 3 · RE-SN 8 · E2E-SN 6 = **135 test cases** (incl. 7 locked-in-requirement acceptance cases).

---

## What Cannot Be Tested / Gaps to Close

1. **Component-level automation** — jest `testMatch: ["**/__tests__/**/*.test.ts"]` excludes `.tsx`; RTL per-file `jsdom` override works only for small wrappers, not full popup interaction. Close: extend `testMatch` to `.test.tsx` + add jsdom env (Developer decision, OQ-3).
2. **True E2E automation** — no Playwright/Cypress. Close: install Playwright (PM/Developer decision, OQ-4) and convert E2E-SN-1100..1105 into specs.
3. **Domain rules (BA OQ1–6)** — house-load/Nakshatra-load definitions, exact classification thresholds, related-house rule, related-warga selection. Close: Domain confirmation; until then provisional rules are asserted structurally, and the classifier is pluggable.
4. **Visual regression of chips/colors** — no screenshot tooling. Close: Playwright `toHaveScreenshot` once installed, or manual visual pass per E2E-SN-1104.
5. **Exact SI translations** — pending i18n content. Close: BI-SN-800 enforces key parity; fallback guarantees no raw-key leaks until translations land.
6. **Super-admin note-route posture** — repo precedent conflicts (shadbalaya 403s non-owners but allows admin mutation; note route posture is 404-never-403). Assumed owner-only PUT + admin GET (IT-SN-205) — confirm with Developer (OQ-6).

---

## Open Questions (for Developer / PM / Domain)

| ID | Question | For | Provisional assumption |
|----|----------|-----|------------------------|
| OQ-1 | House-load definition — count of planets in the house (incl. Rahu/Ketu), or only classical planets? | Domain | All 9 planets counted |
| OQ-2 | Nakshatra-load definition — planets in the selected house's nakshatra, or nakshatra of the house lord? | Domain | House nakshatra |
| OQ-3 | jest `testMatch` excludes `.tsx` — extend config for RTL component tests? | Developer | Per-file jsdom override now; full config extension later |
| OQ-4 | Install Playwright for E2E automation? | Developer/PM | No — manual scripts until decision |
| OQ-5 | Section key naming (`planetsInHouse`, `houseLoad`, …) + exact related-house rule | Developer/Domain | Provisional names above |
| OQ-6 | Super-admin access to students' notepads — owner-only PUT or admin too? | Developer/PM | Owner-only PUT, admin GET (repo precedent) |
| OQ-7 | Keepalive flush implementation — `beforeunload` vs router events? | Developer | Flush on close + navigate; `beforeunload` fallback |

## Verification

```bash
npx jest src/__tests__/notepadCatalogs.test.ts   # UT-SN-001..010
npx jest src/__tests__/notepadObservations.test.ts  # UT-SN-100..117
npx jest src/__tests__/notepadApi.test.ts        # IT-SN-200..230 (new)
npx jest -t "notepad"                            # all notepad tests
# Manual: E2E-SN-1100..1105 scripts (§9) against dev server with seeded fixtures
```
