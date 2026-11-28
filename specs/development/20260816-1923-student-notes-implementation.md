# Student Notepad (ශිෂ්ය සටහන් පොත) — Implementation

**Date:** 2026-08-16 19:23
**Author:** Developer (BMAD)
**Based on:** `specs/business-analysis/20260816-1543-student-notes.md`, `specs/architecture/20260816-1559-student-notes-architecture.md`, `specs/ux/20260816-1803-student-notes.md`, `specs/qa/20260816-1823-student-notes-test-plan.md`

---

## Summary

The Student Notepad is a draggable/resizable popup on the horoscope detail page where a student records
personal observations (tagged per house-purpose context) and free-form result notes. The system layer
derives 7 astrological observation sections per selected (parent, sub-tag) context from the chart
`CalculatedDetails`; the student layer stores their own tags/notes in a new `HoroscopeNote` document
(one per user+horoscope) persisted through a debounced autosave pipeline with rollback.

---

## Files Changed

| File | Change |
| ---- | ------ |
| `src/app/horoscopes/[id]/page.tsx` | Imported and mounted `<Notepad horoscopeId={params.id} calculatedDetails={calculatedDetails} />` as the first child of the header action row (before the owner-only share/delete group). |
| `src/app/api/horoscope/[id]/route.ts` | Cascade delete: `await HoroscopeNote.deleteMany({ "horoscope.id": id })` in `DELETE` (after `Metadata.deleteMany`). |
| `src/app/api/admin/horoscope/[id]/route.ts` | Same cascade delete in the admin `DELETE`. |
| `src/messages/en.json` | Added the full `notepad.*` i18n block (house-purpose labels/sanskrit, 103 sub-tag keys incl. signification-only, observation labels/classification/ratio, tag colors, student-tags/result-notes strings, aria labels, drag/resize/reset/hint/toast). |
| `src/messages/si.json` | Symmetric `notepad.*` key tree. Core chrome (title/button/close/observations headers, etc.) translated to Sinhala; catalog-derived strings (house-purpose labels, sub-tag names) use English fallbacks in the SI file pending a domain-expert glossary (key-tree parity is exact — no raw-key leaks). |
| `jest.config.js` | `testMatch` extended to `["**/__tests__/**/*.test.{ts,tsx}"]` to admit the component tests. |
| `package.json` / `pnpm-lock.yaml` | Added devDependency `jest-environment-jsdom@30.4.1` — the QA plan mandates per-file `@jest-environment jsdom` for RTL component tests; no jsdom environment existed in the repo (see Infrastructure). This is the **only** dependency change and it is test-infra only. |

## New Files Created

| File | Purpose |
| ---- | ------- |
| `src/models/HoroscopeNote.ts` | Mongoose model: one document per `{user.id, horoscope.id}` (unique compound index), `notepadState` (position/size/isOpen/selectedParentTag/selectedSubTag), `observationTags` (parentTag, subTag, text ≤500, color 1–6), `resultNotes` (text ≤2000). `createdAt`/`updatedAt` are ISO **strings** (matching the embedded `{ id }` convention; no ObjectId refs). |
| `src/lib/notepadCatalogs.ts` | Single source of truth: `HOUSE_PURPOSE_CATALOG` (parents 1–12 + 0/Other, ordered 1–12 then 0), sub-tag lists, `PLANET_SIGNIFICATION_CATALOG`, `TAG_COLOR_CATALOG` (1–6), caps (200 tags / 100 notes / 500 / 2000 chars, min/max geometry), and the validation helpers `isValidParentTag` / `isValidSubTag` / `isValidTagColor` / `planetsForSubTag` (frozen results) / `allSubTagKeys`. |
| `src/lib/notepadObservations.ts` | Pure derivation: `resolveNotepadObservation(calculatedDetails, parentTag, subTag)` → 7 fixed-order sections (planetsInHouse, houseLoad, nakshatraLoad, d1LoadInWarga, wargaKendara, subTagPlanet, chandraLagnaHouse, suryaLagnaHouse — the latter two share the chandra/surya "house" section type). Never throws; degrades per-section to "not available". |
| `src/components/notepad/Notepad.tsx` | Popup container: fetch lifecycle (stale-guarded per horoscopeId), 500 ms debounced autosave with coalescing, optimistic UI, rollback to last confirmed doc + error toast, keepalive flush on unmount/beforeunload/visibilitychange, drag/resize (pointer events), Ctrl+Alt+Arrow nudge/resize, reset position, Escape close, open/close focus handling. |
| `src/components/notepad/NotepadTagStrip.tsx` | 13 parent chips (radio semantics via `aria-pressed`; roving tabindex, arrow/Home/End) + sub-tag chips rendered only for a selected non-0 parent. Second click on the selected chip is a no-op. |
| `src/components/notepad/NotepadObservations.tsx` | Renders the 7 derived sections; empty sections render localized empty text; ratio badge only when `tags.length > 0 && ratio.total > 0`; `PlanetChip` with 150 ms hover/focus tooltip; strength glyphs `☉☽♂☿♃♀♄☊☋`. |
| `src/components/notepad/NotepadStudentTags.tsx` | "My observations": context-grouped dashed-square chips (overview / parent / parent+sub-tag), edit-in-place, delete, 6-swatch color picker defaulting White, n/500 counter, disabled at 200 tags. |
| `src/components/notepad/NotepadResultNotes.tsx` | "Result notes": newest-first cards, multiline composer (Ctrl/Cmd+Enter), n/2000 counter, disabled at 100 notes. |
| `src/__tests__/notepadCatalogs.test.ts` | UT-SN-001..010 + validators + deep-freeze + en/si i18n key-tree parity (15 tests). |
| `src/__tests__/notepadObservations.test.ts` | UT-SN-100..117 with 4 fixtures (autoWarga, legacyNoWarga, manualNoWarga, corruptPartial) — 23 tests. |
| `src/__tests__/notepadApi.test.ts` | IT-SN-200..230 (GET/PUT semantics, validation 400s, dotted `$set`, caps, no-write on invalid), IT-SN-224/225/226 + SR-SN-1000 static checks — 29 tests. |
| `src/__tests__/notepadComponents.test.tsx` | UI-SN-305, 403/404, 500..506 with fake timers + stubbed fetch in jsdom — 9 tests. |

---

## Implementation Notes

### Key decisions

- **Lazy creation, never on GET.** `GET` returns the exact empty defaults `{ notepadState: null, observationTags: [], resultNotes: [] }` when no document exists; the first `PUT` upserts via `findOneAndUpdate(..., { upsert: true, new: true })`. GET never writes (IT-SN-206).
- **Field-group `$set`.** PUT writes each present group through dotted paths (`notepadState.position`, `notepadState.selectedParentTag`, `observationTags`, `resultNotes`, …) so untouched groups — including a concurrent renderer's own fields — are never clobbered (IT-SN-222). Unknown top-level fields are ignored (IT-SN-229).
- **Per-section degradation.** The derivation never throws: missing/holey warga charts degrade that single section to "not available"; `calculatedDetails: null` yields all 7 not-available sections; empty house load renders an empty state (UT-SN-104) rather than omitting the section (UX line 91).
- **Strength classifier.** A planet is classified by its numeric strength only when the value is in the known set `{1.25, 1, -1, -1.25, 0.75, 0.5, 0.1, -0.1, 0}` (pos → green, neg → red); anything else (incl. missing) is neutral white — legacy/manual rows without strengths never misclassify.
- **Viewability, not ownership.** Both note methods use the same guard as the detail page: owner || `isPublic` || super-admin, else 404 — never 403. See deviation D-6 for the public-viewer nuance.
- **Keepalive-safe flush.** Unmount, `beforeunload`, and `visibilitychange` all flush with `keepalive: true` so a pending edit survives navigation; the 500 ms debounce is cancelled on horoscope switch (UI-SN-414/415b semantics).
- **Rollback semantics.** On a failed PUT the UI reverts to the last *confirmed* document and shows a 3 s error toast. If the open-state save itself never confirmed, a failed edit-save will close the popup (nothing had been confirmed) — acceptable and tested (UI-SN-503 with a pre-confirmed open).

### Deviations from the architecture/UX/QA specs

| # | Spec expectation | Implementation | Reason |
| -- | ---------------- | -------------- | ------ |
| D-1 | QA UI-SN-406: first-ever open defaults to parent 1 | No parent is auto-selected on first open; the system area shows the localized hint instead | Avoids implying an observation selection the user never made; also avoids an immediate save (only the `isOpen: true` state persists, which UI-SN-305 requires) |
| D-2 | QA UI-SN-500 area: `{count}` = number of planets in house | Message reads "House load: {count} · Planets {planets} · {sign}" — the component maps `count ← params.house` (a planet count), `planets ← params.count` (the planet list) | The UX inventory shipped a semantically mismatched param name; the resolved values are correct |
| D-3 | UX inventory: `d1LoadInWargaLabel` includes `{strength}` | Message ships without `{strength}`; the component appends ` · {strength}` only when the d9 row actually carries a strength | Legacy/manual d9 rows often lack strengths — an always-printed strength placeholder would be misleading |
| D-4 | UX inventory: focus trap with roving first-chip focus | `aria-modal="false"`, focus moves to the dialog container on open and back to the toggle on close | Page content must remain interactive behind the notepad (QA UI-SN-300); a full focus trap would trap the user |
| D-5 | QA IT-SN-204: public viewer with a share token gets the owner's note or 404 | Public-viewer GET returns 200 with the **viewer's own** (empty) note document, keyed on `session.user.id` | The share page (`/share/[token]`) is a stub in this codebase — the token scenario is unreachable; the implementation can never leak another student's notes because every query is caller-scoped |
| D-6 | QA IT-SN-406/UI-SN-406: "nothing saved until first modification" | Opening the notepad persists `isOpen: true` (one PUT) | Directly required by UI-SN-305 ("isOpen/selection restored from DB"); without it the popup could never restore open state |
| D-7 | QA UI-SN-302: resize handle bottom-right corner | Present (`role="presentation"`, pointer capture-free drag) | Matches spec; pointer events on the container drive drag/resize uniformly |
| D-8 | QA plan line 44: derivation coverage note | `IT-SN-224` enforced statically: the note route imports `notepadCatalogs` but never `notepadObservations` | Guarantees no cached/computed observation data can be persisted server-side |

### Follow-up items / technical debt

1. **ESLint is broken in the repo** — `eslint-plugin-react@7.37.5` crashes ESLint 10 at config-load time (`contextOrFilename.getFilename is not a function`) for **any** file, including on a clean HEAD checkout. Not caused by this feature; needs a plugin major-bump in a separate chore.
2. **`npx tsc --noEmit` noise** — the repo has no `@types/jest`; all `__tests__` files (including pre-existing ones) report "Cannot use namespace 'jest'" under plain tsc. The `next build` pipeline excludes tests and compiles clean; my non-test sources are tsc-clean.
3. **Pre-existing failing suites** — `privacy.test.ts` (4) and `search-combined.test.ts` (7) fail on HEAD identically (verified by stashing this feature's only shared files). They exercise `GET /api/horoscope/[id]` (mock `req.nextUrl` gap) and the search route's `queryUnderstanding.exactMatch` shape — both out of scope.
4. **SI catalog strings** use English fallbacks (house-purpose labels, sub-tag names) — needs a domain-expert glossary pass.
5. **Share page** (`/share/[token]`) remains a stub — when implemented, revisit the public-viewer note semantics (D-5) and consider note visibility on shares.
6. **Concurrent-tab last-write-wins** — two open tabs both autosave; the field-group `$set` keeps per-group consistency but cross-group races are resolved by the last writer. A future revision could add a revision counter.

---

## Infrastructure

- **Test infra:** added `jest-environment-jsdom@30.4.1` (devDependency, QA-mandated for RTL component tests) and widened `jest.config.js` `testMatch` to `{ts,tsx}`. No other infra (Docker/CI/cloud) is needed — the feature is app-layer only (MongoDB via the existing connection; no new collections beyond `HoroscopeNote`, which is created by Mongoose on first write).

## Verification

1. `pnpm build` — **passes**; `/api/horoscope/[id]/note` route is emitted; all pages compile.
2. `npx jest` — **838 passed / 11 failed**. The 11 failures are the two pre-existing suites (`privacy`, `search-combined`) proven identical on HEAD via stash. All 77 new tests pass:
   - `notepadCatalogs.test.ts` 15/15, `notepadObservations.test.ts` 23/23, `notepadApi.test.ts` 29/29, `notepadComponents.test.tsx` 9/9.
3. `pnpm lint` — **blocked by the pre-existing ESLint 10 + eslint-plugin-react crash** (verified on HEAD with this feature stashed; no source file is linted).
4. `npx tsc --noEmit` — no errors in any file created/modified by this feature (pre-existing test-file noise only, matching the repo status quo).
5. `pnpm format` — applied.

## Post-review addendum (user feedback, 2026-08-17)

**D-9 — House Load & position section became House Lord & position (භාවාධිපති හා පිහිටීම).** User-confirmed redesign of the `houseLoad` observation section:

- **Section key renamed** `houseLoad` → `houseLord` (`ObservationSectionKey`, `SECTION_KEYS`, `SECTION_ORDER`, message `notepad.observation.houseLord`). The `houseLoad` *message* key is **kept** because `houseLoadTag()` is still used by the Chandra/Surya Lagna sections' load tags.
- **Primary tag** (`kind: "lord"`): the house's whole-sign lord + its relative position counted from the house it rules (own house = 1; e.g. Makara lagna, 7th house = Cancer, Moon in the 8th → `Chandra - 2`). Label composed in the component as `{planet} - {position}`.
- **Position colour rule** (`classifyHouseLordPosition`): relative position **6/8/12 → red**, **1/5/9 → dark green**, everything else → **light green**. New colours `darkGreen`/`lightGreen` added to `ObservationColor`, the chip/dot styles, and `notepad.observation.classification.{darkGreen,lightGreen}` (both locales).
- **Every house has a lord** — no empty state; the section always emits at least the primary tag (degraded only when the house sign/lord or the lord's placement cannot be derived → single `not-available` tag, `0/1`).
- **Related tags** (`kind: "lordDetail"`, `detail` discriminator) surface every planet-table condition of the lord, each degrading to nothing when absent:
  - ownership of other houses (`ownsHouses`, only when the lord owns > 1 house), sign placement, nakshatra + pada, strength (coloured by `classifyPlanetStrength`), Navamsa sign, retrograde, combust, conjunctions (same-sign planets), aspects made/received (coloured by `isBeneficial`), Ashtamamsha (lord in the absolute 8th house), Ashtamansha (`ashtamanshaPlanets`), Kala/Cheshta Bala (`shadbalaya` value flags), Bhava Suchika (`bhavaSuchika`), Atmakaraka/Yogakaraka/Maranakaraka/Maraka/Badhaka/Nidhanamsha/Wargoththama/Gandantha/Gandamula/Pushkara flags, 22nd Drekkana / 64th Navamsa lordship.
  - Related-tag colours: strength/aspects/bala polarity green-red; benefic flags (atmakaraka/yogakaraka/wargoththama/pushkara) green, malefic flags (maranakaraka/maraka/badhaka/nidhanamsha/gandantha/gandamula/ashtamamsha/ashtamansha) red; informational tags (ownsHouses/inSign/inNakshatra/navamsa/retrograde/combust/bhavaSuchika/drekkanaLord/navamsaLord) white.
- **Ratio** = the primary tag only: `{1,1}` for dark/light green, `{0,1}` for red (user-confirmed).
- **Spec delta:** this supersedes UT-SN-103/104 in `specs/qa/20260816-1823-student-notes-test-plan.md` (load-count tag + empty-house behaviour) and the architecture's "House load & position" section definition in `specs/architecture/20260816-1559-student-notes-architecture.md`. New tests UT-SN-103b/103c/104b + the position-colour and related-tag suites were added to `notepadObservations.test.ts`; the QA `notepadCatalogs` classification guard now covers all five colours. Full suite: **846 passed / 11 pre-existing failed**; build passes.

### Manual E2E script (QA E2E-SN-1100/1101/1105 stand-in)

**D-10 — Planet-strength section before the parent tags + factor sub-tags (TODO #26).** User-confirmed feature: a new section renders **above the parent-tag strip** showing every planet with a strength ratio tag (e.g. කුජ (7/9)); the sub-tags that explain the ratio are the **strength factors**; planet tags in the other sections also show the ratio; clicking a planet opens the strength panel to determine the planet's strength.

- **Factor catalog** (`PLANET_STRENGTH_FACTORS`, 20 stable keys, display order — in `notepadCatalogs.ts`): `sign`, `navamsa`, `house`, `dig`, `kala`, `cheshta`, `naisargika`, `retrograde`, `combust`, `atmakaraka`, `yogakaraka`, `maranakaraka`, `maraka`, `badhaka`, `wargoththama`, `pushkara`, `gandantha`, `gandamula`, `ashtamansha`, `nidhanamsha`. Validators `isPlanetStrengthFactorKey` / `isPlanetFactorColor` + `PLANET_FACTOR_OVERRIDES_MAX_PLANETS` live in the catalogue so the API route stays derivation-free (IT-SN-224 spirit).
- **Only PRESENT factors are shown — absence NEVER produces a tag (user-confirmed 2026-08-19):** there are no "netha" / "not X" tags (e.g. no "මරණකාරක නොවේ", no "No Dig Bala"). A factor only emits when its source data applies (`dig` never for Rahu/Ketu; `retrograde` informational white only when retrograde; flags only when the planet is a member — missing data is NOT a factor). The planet ratio counts ONLY the shown (emitted) tags: `ratio = { green, total: green + red }` — white (informational/neutral) tags are shown but never affect it.
- **Factor derivation** (`src/lib/planetStrength.ts`, pure, never throws — per-planet try/catch): `sign`/`navamsa` from `classifyPlanetStrength` (positive green, negative red, Sama/unknown white); `house` from the D1 whole-sign house (`wargaKendara.d1` authoritative, else `planets[].house`): kendra/trikona (1,4,5,7,9,10) green, dusthana (6,8,12) red, others white; `dig/kala/cheshta/naisargika` from `shadbalaya.<planet>.<balaKey>.value` (`digBala`/`kalaBala`/`cheshtaBala`/`naisargikaBala`) — emitted only when gained (`true`) → green; `combust` emitted only when true → red. The former `karaka`/`varga` aggregates are split into the eleven individual presence flags (Atmakaraka, Yogakaraka, Maranakaraka, Maraka, Badhaka, Wargoththama, Pushkara, Gandantha, Gandamula, Ashtamansha, Nidhanamsha) — emitted only when the planet is a member: benefic green, malefic red.
- **Ratio colour bands** (`ratioColorOf`): ≤25% dark red, ≤40% light red, ≤60% white, ≤80% light green, else dark green; zero-total → white (no badge shown).
- **Student determination (overrides):** a factor chip cycles `green → red → white → green` (`nextPlanetFactorColor`); the override persists per (student, horoscope) on `HoroscopeNote.planetFactorOverrides` (validated + `$set`-merged in the note route like `observationTagOverrides`; whole map rejected on any invalid planet/factor/colour). Overrides feed every ratio immediately (the observation chips' ratios recompute from the same overrides).
- **Section rendering:** `NotepadPlanetStrengths` renders **before `NotepadTagStrip`**; planet chips there show `{glyph} {name} ({green}/{total})` in the ratio band colour. In the observation sections, planet-referencing tags (kinds `planet`, `lord`, `d1LoadInWarga`) **keep their derived strength colour** (user-confirmed — never the ratio band) and append the same ratio badge; clicking them opens the shared `PlanetStrengthPanel` (one panel at a time per location) **in place of the colour picker** — the panel keeps the "mark not relevant / restore" toggle. Non-planet tags keep the colour picker unchanged.
- **Spec delta:** planet tags in observation sections no longer open the colour picker (their colour override is superseded by the factor toggle); UI-SN-507's restore flow now happens directly from the still-open strength panel. New tests: `src/__tests__/planetStrength.test.ts` (derivation, bands, cycle, present-only emission, overrides, never-throws), API validation/round-trip (`IT-SN-219f/g/h`, `IT-SN-207b`), components (`UI-SN-508`: section order, ratio chips, factor toggle → PUT `planetFactorOverrides`, observation ratio badges, panel not-relevant footer). Full suite: **897 passed / 11 pre-existing failed**; build passes.

1. `pnpm dev`, sign in with Google, open an existing horoscope.
2. Click the notepad toggle (top-right of the header). Popup opens right-docked 480×640, `z-40`.
3. No parent selected → hint shown; click chip **7 — Ṣaṣṭhāṅga…** → system sections re-derive; click **Marriage** → sub-tag context re-derives; system chips show glyph + strength tooltip (150 ms hover).
4. Type a tag in "My observations" → chip appears immediately (optimistic); counter n/500; pick a color; wait ~0.5 s → reload → tag persists under its context.
5. Add a result note (Ctrl/Cmd+Enter) → newest-first card; reload → persists.
6. Drag the header → position persists on release; resize handle → size persists; Ctrl+Alt+Arrow nudges 8 px (16 with Shift); reset icon re-docks.
7. Close, reopen → position/size/selection restored from DB (UI-SN-305).
8. Open a second horoscope → all state swaps instantly to that horoscope's data (UI-SN-414).
9. In a second browser tab, open the same horoscope and edit — no data loss on either side (field-group `$set`).
10. DevTools → offline; edit a tag → after 500 ms the toast "Save failed…" appears and the UI rolls back; re-enable network and edit again → saves.
11. Delete the horoscope (owner) → admin/user DELETE also removes the note document (check Mongo `horoscopenotes`).
12. Planet-strength section (D-10): open the notepad → the planet section sits ABOVE the house-purpose strip; each planet shows `{glyph} {name} ({green}/{total})` in its ratio band colour; click a planet → the factor chips open beneath it (Sign, Navamsa, House n, Dig/Kala/Cheshta/Naisargika Bala, Retrograde, Combust, Atmakaraka, Yogakaraka, Maranakaraka, Maraka, Badhaka, Wargoththama, Pushkara, Gandantha, Gandamula, Ashtamansha, Nidhanamsha). The Sign/Navamsa chips are MEANINGFUL — they read as the strength-in-sign, e.g. Sun debilitated in Libra shows "තුලාවේ නීචව" (red) and Sun's navamsa enemy in Taurus shows "වෘෂභයේ සතුරුව" (red); when a stored strength isn't a known enum the chip falls back to the generic "රාශි බල"/"නවාංශක බල". An open planet's factor panel is bottom-gapped (`mb-2`) so it reads as separate from the other planet chips. Only PRESENT tags are shown — a planet that lost Dig Bala shows NO Dig Bala tag, a non-member planet shows no "නොවේ" tags. The ratio counts only the shown tags: e.g. a planet with Dig Bala (green) and Ashtamansha (red) shows (1/2), and a planet with only those two plus a neutral upachaya house still shows (1/2).
13. Click a factor chip → its classification cycles (good → bad → neutral); the chip's ratio updates in the same click and white tags are excluded from it; wait ~0.5 s → reload → the determination persists and the ratio still reflects it (Sinhala locale shows the same flow with Sinhala labels).
14. In an observation section (e.g. Planets in this house), the planet chips now also carry the ratio badge and keep their strength colour; click one → the strength panel opens in place of the colour picker, with the "Mark as not relevant / Restore" toggle still available; non-planet tags still open the colour picker as before.
