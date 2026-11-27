# User Stories — Yoga / Dosha Separated Tags (යෝග / දෝෂ)

**Date:** 2026-09-06 07:07
**Source:** `docs/yoga.md` (feature request); `docs/shani-mangala-yoga.md` (authoritative example of the desired output depth/style for ONE yoga)
**Status:** Draft
**Related:** `specs/business-analysis/data-model.md` (existing `CalculatedDetails.yogas` / `doshas` placeholders, enum conventions, static-catalog precedents); `20260815-1129-warga-kendara.md` (precedent: static catalogs resolved via i18n + derived data stored on `CalculatedDetails` + render-time legacy fallback); `20260813-1954-shadbalaya.md` (precedent: reason-object i18n composition, numeric-enum storage, recalculation preservation rules); `20260816-1543-student-notes.md` (precedent: static catalog + derived observation patterns, read-only conventions)

---

## Background / Context

The platform currently **reserves** the yoga and dosha fields on `CalculatedDetails` but never computes them: `yogas` is always `[]` and `doshas` is always `{ doshas: [] }` (see `src/lib/calculation.ts` and `src/lib/manualChartDetails.ts`). The single horoscope (detail) view shows **no** yoga/dosha content today — only the search result cards have a combined "Yogas & Doshas" configurable section (`src/app/search/page.tsx`), which renders the (empty) stored arrays.

The feature request (`docs/yoga.md`) asks for:

1. **Separated tags** — Yoga tags and Dosha tags as two distinct groups on the **single horoscope view** (the horoscope detail page).
2. **Incremental rule guidance** — "There are lot of Yoga and Dosha based on the planet positions, will guide you one by one how to find each yoga is include or not." The domain will feed formation rules step-by-step over time.
3. **Rich per-yoga display** — when showing a yoga, the view must show its **name**, **why it is happening** (the exact planetary conditions that form it), **what its result is**, and **if/why it is cancelled**.
4. **Depth anchor** — `docs/shani-mangala-yoga.md` is the authoritative example of the desired depth/style for **one** yoga (Shani–Mangala / Saturn–Mars). It demonstrates: multiple formation rules per yoga (not one boolean), structured output with formation reasons, house-specific interpretation, mitigation vs cancellation as separate concepts, tradition/source provenance, dasha activation, and a **rule-engine + interpretation-engine** architecture (deterministic astrology engine computes chart facts → rule engine evaluates formation/cancellation/mitigation → AI/human-readable interpreter composes the explanation).

**Scope note (explicit):** `shani-mangala-yoga.md` is the *pattern* — the deliverable is a **framework** that supports incrementally adding many yogas/doshas, **plus the first concrete rule set as a seed**. The Shani–Mangala rules are fully specified in the reference doc and are therefore the natural first seed yoga. A proposed first seed dosha (Manglik/Kuja Dosha) is included but **pending domain confirmation of its rules and tradition** — see Open Questions.

**Design posture (mirroring the Warga Kendara / Shad Bala / Student Notepad precedents):**

- The **Yoga/Dosha Rule Catalog** is static, system-wide reference data (registry) — a stable ID per yoga/dosha, tradition/source label, formation-rule metadata, and bilingual display keys. Never stored per horoscope, never user-editable. New yogas/doshas are **new catalog rows + deterministic rule functions** — additive and non-breaking.
- The **rule engine is deterministic** — it evaluates the *stored chart facts* (planets, signs, houses, strengths, aspects) against the catalog. No LLM computes formation (per the architectural recommendation in `docs/shani-mangala-yoga.md` §"One architectural change I'd strongly recommend").
- The **interpretation engine** maps formation + house context + planetary strength to i18n theme/expression keys. The stored output is **structured data** (never display text); the UI composes the bilingual explanation at render time from `key` + numeric `params` (the ShadBalaya reason-object convention).
- **Cancellation ≠ mitigation ≠ formation** — three separate evaluation paths, each with rule IDs and tradition provenance.
- **No deterministic predictions** — the stored and rendered language is *tendency/expression* ("may become active during Saturn/Mars dasha periods"), never "this person will have career problems" (per `docs/shani-mangala-yoga.md` §14–15).

**General note (the "one by one" guidance):** the domain explicitly says yogas/doshas will be guided one by one. The stories below therefore cover: (a) the **framework** — catalog/registry-driven approach with structured per-yoga/per-dosha output; (b) the **first concrete seeds** — Shani–Mangala Yoga (fully specified) and Manglik Dosha (proposed); (c) **UI display requirements** — yoga name, reason of formation, result, cancellation (if cancelled and why); (d) **separated Yoga vs Dosha tags** on the single horoscope view; (e) **bilingual (Sinhala/English)** rendering of every surface via i18n + numeric enums.

---

## Actors

### Student

- View the Yoga and Dosha tags separated into two distinct groups on the single horoscope (detail) view
- View each present yoga's structured details — name, reason of formation (exact planetary conditions), result/themes, and cancellation (if cancelled, by which rule and which tradition)
- View each present dosha's structured details — name, formation conditions, affected houses, severity, cancellation/mitigation
- Expand/collapse per-yoga and per-dosha detail areas
- Distinguish "present" vs "cancelled" vs "not present" states on the tags
- View the existing read-only behavior on own, public and share-linked horoscopes

### System (Calculation + Rule + Interpretation Engines)

- Maintain the static Yoga/Dosha Rule Catalog (registry) — stable IDs, tradition labels, formation-rule metadata, bilingual display keys; extendable one-by-one as the domain guides
- Evaluate every registered yoga/dosha against the horoscope's chart facts via a deterministic rule engine — structured formation results (rules triggered, primary rule, strength, reasons with exact planetary conditions, deduplicated equivalent reasons), never a boolean
- Evaluate cancellation separately from mitigation per registered rule — each factor carries rule ID, factor, planets/houses involved and tradition provenance; mitigation never cancels unless the tradition explicitly says so
- Produce house-specific interpretation via the interpretation engine — theme/expression keys resolved via i18n, never deterministic predictions
- Persist the structured `yogas` and `doshas` arrays on `CalculatedDetails` for **both** `source: "auto"` and `source: "manual"` horoscopes; recompute during the AstrologySettings full recalculation job like any derived value
- Keep the existing search surfaces (text content, result cards, export, route filtering) working with the new structured shape

---

## Parent Stories

---

### US-YD-001: Static Yoga/Dosha Rule Catalog (registry)

- **Title**: Supported yogas and doshas come from a static, extensible rule catalog — additions are additive
- **Story**: As the domain, I want every evaluated yoga/dosha identified by a stable catalog ID with its tradition label, formation-rule metadata and bilingual display keys in one static registry, so that new yogas/doshas are added one-by-one as additive entries without touching existing behavior.
- **Priority**: High
- **Actor**: System
- **Dependencies**: Static catalog data (see `data-model.md` → Yoga/Dosha Rule Catalog); i18n message files

#### Acceptance Criteria

1. **Registry-driven evaluation**:
    - Given the rule engine runs, When it evaluates a horoscope, Then it evaluates **exactly** the yoga/dosha entries currently registered in the catalog — nothing hardcoded in the calculation path, no per-yoga booleans scattered in the engine
    - Each catalog entry carries: `id` (stable key, e.g. `shaniMangala`), `type` (`yoga` | `dosha`), bilingual display-name keys (EN + SI), tradition/source label (e.g. `MAIN_STREAM`), and its formation-rule metadata

2. **Bilingual display keys**:
    - Given a catalog entry, When any surface renders its name, Then it resolves via i18n per the active locale (e.g. Shani–Mangala Yoga / ශනි-කුජ යෝග) — never stored or rendered as a hardcoded display string

3. **Additive extension**:
    - Given the catalog has N entries, When a new yoga/dosha is added (new row + new rule functions, per US-YD-013), Then existing entries, stored snapshots and UI render identically — the addition is non-breaking

#### Edge Cases

- **Unregistered ID in a stored snapshot**: a legacy/stale document referencing a removed catalog ID renders a neutral "not available" tag and logs a warning — never a crash
- **Catalog/translation gap**: an entry missing a SI translation falls back to English (existing convention) until the domain provides it

#### Business Rules

- The catalog is static, system-wide reference data — resolved via i18n message keys, never stored per horoscope, never user-editable (Varga Chart Catalog / House Purpose Catalog precedent)
- Catalog ID is the stable identity — localized display text is never used as a key

---

### US-YD-002: Deterministic rule engine — formation

- **Title**: Formation is computed deterministically and returns structured results, never a boolean
- **Story**: As the System, I want each registered yoga/dosha evaluated against the chart facts through deterministic formation rules (conjunction, mutual Graha Drishti, mutual 7th house, 4/10, parivartana, etc.), so that every satisfied rule — not just one flag — is recorded with its exact reason.
- **Priority**: High
- **Actor**: System
- **Dependencies**: US-YD-001 (catalog); stored chart facts (`CalculatedDetails.planets/houses`, aspects, strengths)

#### Acceptance Criteria

1. **Structured formation output**:
    - Given a horoscope chart, When the rule engine evaluates a registered yoga/dosha, Then it returns `{ exists, formation: { rulesTriggered[], primaryRule, strength, reasons[] } }` — never `{ yoga: true }`
    - Each `reasons[]` entry carries the rule ID, an i18n `reasonKey`, and numeric `params` (planet/sign/house enums) describing the exact conditions (ShadBalaya reason-object precedent)

2. **Multiple formation rules**:
    - Given Saturn in 7th and Mars in 1st, When the engine evaluates Shani–Mangala, Then both `MUTUAL_7TH_HOUSE` and `MUTUAL_GRAHA_DRISHTI` style rules appear in `rulesTriggered` — all satisfied rules are returned, and equivalent/duplicate reasons are deduplicated per the reference doc §3

3. **Primary rule ranking**:
    - Given several rules satisfied, When the engine ranks them, Then `primaryRule` is the highest-strength satisfied rule (e.g. conjunction outranks mutual 7th per the catalog's strength table)

4. **Formation strength**:
    - `formation.strength` uses the numeric `YogaStrength` enum (e.g. conjunction = Very Strong (1), mutual 7th = Strong (2)) per the catalog

5. **Both chart sources**:
    - The engine evaluates `source: "auto"` and `source: "manual"` horoscopes identically, using the manual chart's entered placements (with the existing degree fallback where degrees are absent)

#### Edge Cases

- **Boundary relationship** (e.g. planets 7 houses apart — aspect zone boundary): the aspect/relationship functions reuse the existing stored aspect data — no new aspect math in phase 1 (flag if a rule needs a relationship the stored data cannot answer — Open Question for Architect)
- **No rule satisfied**: `exists: false` with empty `rulesTriggered` — the entry is stored or omitted per US-YD-005
- **Tradition-gated rules** (e.g. the 2/12 Shani–Mangala relationship, which only some traditions accept): a disabled-by-tradition rule is never evaluated/returned — the catalog flags it as gated

#### Business Rules

- The rule engine is **deterministic and pure** — same chart facts in, same structured result out; no generative model in the formation path (reference doc's architectural recommendation)
- All planets/signs/houses/strengths are numeric enums; reason text is composed at render time from `key` + `params`
- Chart facts come from the already-stored `CalculatedDetails` (incl. aspects) — no new ephemeris calculations in this story

---

### US-YD-003: Interpretation engine — result and house-specific themes

- **Title**: The "result" of a yoga/dosha is a house-specific interpretation composed from i18n theme keys
- **Story**: As a student, I want the result of a yoga explained for the houses it actually affects (e.g. 7th → partnership tension/delayed marriage themes; 10th → career pressure/persistence themes), so that the interpretation matches this horoscope rather than a generic description.
- **Priority**: High
- **Actor**: System
- **Dependencies**: US-YD-002 (formation output); house signification knowledge (existing house-purpose catalog precedent); domain theme keys

#### Acceptance Criteria

1. **House-specific interpretation**:
    - Given the Shani–Mangala formation with Saturn/Mars in the 7th, When the interpretation engine runs, Then it emits the 7th-house theme keys (relationship conflict, impatience in partnership, delayed marriage, etc. per the reference doc §5) — and NOT the generic 10th/8th themes
    - The chosen themes come from the catalog's registered per-house theme keys; the interpretation always reflects this horoscope's houses

2. **Structured output**:
    - `interpretation.themes[]` stores i18n keys (+ optional numeric params) — display text is never stored

3. **Planetary mechanism** (conceptual core):
    - The interpretation includes the contributing-planet mechanism keys where the catalog defines them (e.g. Mars = action/courage/initiative; Saturn = restriction/delay/discipline — and the resulting combination "Mars's impulse subjected to Saturn's restriction", reference doc §4)

4. **Tendency language, not prediction**:
    - Every theme/expression string is phrased as tendency or expression — no deterministic prediction ("will have career problems") anywhere in the catalog (reference doc §14)

#### Edge Cases

- **House not in the catalog's theme table**: no theme keys registered for that house → the interpretation section renders the formation reason only (no empty theme rows)
- **Multiple affected houses**: themes for every affected house render, grouped per house (e.g. 4th + 10th both shown)

#### Business Rules

- The interpretation engine is deterministic: it maps (formation, houses, planetary strength/functional role) → registered theme keys; the human-language composition happens at render time from `key` + `params`
- Functional benefic/malefic status is **excluded from phase 1** unless the domain confirms it (Open Question 11) — `context.planets[].strength` (PlanetaryStrength) is available to the interpretation engine from day one

---

### US-YD-004: Cancellation & mitigation engine

- **Title**: Cancellation is evaluated separately from mitigation, with rule IDs and tradition provenance
- **Story**: As a student, I want to know not just whether a yoga exists, but whether it is **mitigated** (reduced) or **cancelled** (per the tradition), with the reason and source for each — so that "cancelled" is never confused with "Jupiter helps".
- **Priority**: High
- **Actor**: System
- **Dependencies**: US-YD-002 (formation); catalog cancellation/mitigation rules; tradition labels

#### Acceptance Criteria

1. **Three separate paths**:
    - Given a formed yoga, When the engine evaluates consequences, Then it runs **formation** → **mitigation** → **cancellation** as three separate passes (reference doc §6) and the stored output keeps them in three separate fields
    - A mitigation factor (e.g. Jupiter aspect) **never** sets the cancellation status by itself — only a cancellation rule the selected tradition explicitly defines may do so

2. **Structured cancellation**:
    - Given a tradition-gated cancellation rule is satisfied, When the engine writes `cancellation`, Then it records `status` (numeric `CancellationStatus` enum), the cancellation rule ID, the exact condition satisfied, the planets/houses involved, and the tradition/source label (provenance — reference doc §12)
    - Conflicting tradition rules are **never silently combined** — each factor keeps its own `tradition` label

3. **Structured mitigation**:
    - Each mitigation entry carries `ruleId`, `factor` (e.g. `JUPITER_ASPECT`, `MARS_OWN_SIGN`), `effect` (e.g. `REDUCES_SEVERITY`), optional `target` (numeric Planet), `tradition` and `confidence` (numeric) — per the reference doc §12 shape

4. **Final synthesis**:
    - The weighted assessment (formation strength → affliction → mitigation → cancellation → house relevance → final severity) is stored in `finalAssessment` with severity (`YogaStrength` enum) and expression keys (reference doc §13)

#### Edge Cases

- **Strong Mars / weak Saturn variations**: strength combinations (weak Mars + Saturn = frustration; strong Mars + Saturn = disciplined force) produce different expression keys per the catalog — "strong" never auto-cancels the yoga (reference doc §7–8)
- **No cancellation rules registered yet for a tradition**: `cancellation` defaults to `{ status: 1, factors: [] }` ("not cancelled — no tradition-specific cancellation rule evaluated")

#### Business Rules

- Cancellation and mitigation are distinct concerns; the UI renders them as distinct visual states (see US-YD-009)
- Every cancellation/mitigation factor carries `tradition` provenance; the domain approves which traditions are registered per catalog entry (Open Question 2)

---

### US-YD-005: Structured persistence on CalculatedDetails

- **Title**: The structured `yogas` and `doshas` arrays persist on CalculatedDetails for both chart sources, recompute with the settings recalculation, and degrade gracefully on legacy documents
- **Story**: As the System, I want the rule/interpretation engine output stored as structured `yogas` / `doshas` arrays on `CalculatedDetails` — for auto and manual horoscopes, recomputed by the existing recalculation job — so that the UI and search read one consistent persisted shape.
- **Priority**: High
- **Actor**: System
- **Dependencies**: US-YD-001…US-YD-004; `CalculatedDetails` storage; AstrologySettings recalculation job

#### Acceptance Criteria

1. **Stored shape**:
    - Given an evaluated horoscope, When `CalculatedDetails` is written, Then `yogas` is an array of structured per-yoga entries and `doshas.doshas` an array of structured per-dosha entries per the revised `data-model.md` structures (formation / context / interpretation / mitigation / cancellation / finalAssessment / dashaActivation)

2. **Both chart sources**:
    - `source: "auto"` horoscopes evaluate from the ephemeris-derived chart; `source: "manual"` horoscopes evaluate from the entered `manualHousePlacements` (same rule functions, degree fallback where needed) — `manualHousePlacements` remains the single source of truth, never overwritten

3. **Recalculation**:
    - The AstrologySettings full recalculation job recomputes `yogas`/`doshas` like any other derived value; there are **no user overrides** (mirrors `wargaKendara`/Bhava Suchika behavior)

4. **Legacy documents**:
    - Given a horoscope stored before this feature, When its stale `yogas: []` / `doshas: { doshas: [] }` (or missing fields) are read, Then the UI renders the "no yogas/doshas evaluated" empty states — no crash, no migration required at read time (recompute happens on the next full recalculation)

5. **Dosha backward compatibility**:
    - Each stored dosha entry keeps `isPresent` (the field the search result cards, export and route filtering already read) and replaces the legacy string `name`/`severity` with the catalog `id` + numeric `YogaStrength` — consumers updated per US-YD-011

#### Edge Cases

- **Partial evaluation**: if one catalog entry's rule function throws (bad data), that entry fails closed (`exists: false` with a logged warning) without aborting the other entries (recalculation-job resumability precedent)
- **Empty catalog**: no registered entries → both arrays empty → UI shows the empty state

#### Business Rules

- The shape is a render-time contract; display composition happens in the UI from numeric enums + i18n keys — no display strings in storage (repo convention)
- Recalculation never touches user-entered data (manual placements, Shad Bala overrides) — yogas/doshas are derived, not user-editable

---

### US-YD-006: Seed yoga — Shani–Mangala (Saturn–Mars) Yoga

- **Title**: Shani–Mangala Yoga ships as the first concrete yoga with the reference doc's formation rules, house themes, mitigation and tradition-gated cancellation
- **Story**: As a student, I want the Shani–Mangala (Saturn–Mars) yoga evaluated with the full depth of `docs/shani-mangala-yoga.md` — multiple formation rules, strength, house-specific results, separate mitigation/cancellation, provenance — so that I see exactly why this horoscope has (or has not) the yoga.
- **Priority**: High
- **Actor**: System
- **Dependencies**: US-YD-002…US-YD-005; `docs/shani-mangala-yoga.md` rules; domain theme-key approvals

#### Acceptance Criteria

1. **Formation rules registered** (catalog rows, per the reference doc §1):
    - SM-01 Saturn conjunct Mars (same sign/house) — Very Strong (1)
    - SM-02 Saturn and Mars mutually aspect by Graha Drishti — Strong (2)
    - SM-03 Saturn and Mars in mutual 7th-house relationship — Strong (2)
    - SM-04 Saturn/Mars 4/10 relationship with mutual special aspect — Strong (2)
    - SM-05 **Parivartana** (sign exchange: Saturn in Mars sign, Mars in Saturn sign) — separate relationship type, never treated as conjunction (reference doc §10) — special handling as its own rule
    - The 2/12 relationship is **tradition-gated** (only evaluated when the selected tradition registers it — reference doc §1, Open Question 2)

2. **Deduplication**: SM-02 and SM-03 triggering together produce one user-facing explanation ("occupy opposite houses and thereby mutually influence each other", reference doc §3) — equivalent reasons deduplicated

3. **Exact chart-specific reason**: the explanation states the actual positions (e.g. "Saturn is in the 10th house and Mars is in the 4th; Mars's 4th aspect falls on Saturn while Saturn aspects Mars by its 10th aspect — therefore a direct mutual planetary relationship", reference doc §4) — composed from numeric params at render time

4. **House-specific themes**: registered themes for at least the 7th (relationship conflict, impatience, delayed marriage, arguments, dominance/control), 10th (career pressure, authority conflict, endurance, competitive career), 4th (domestic tension, property disputes, construction/property drive) and 8th (sudden obstacles, intense transformation, psychological pressure — **never** deterministic accident/injury claims, reference doc §5)

5. **Mitigation registered**: Jupiter influence (conjunction/aspect/strong house influence) as mitigation — never cancellation (reference doc §7); Mars/Saturn dignity (own sign, exaltation, debilitation, combustion, retrogression) changes the *expression*, not the existence (reference doc §7–8)

6. **Cancellation registered per tradition**: cancellation rules only from traditions explicitly defining Saturn–Mars configurations as cancelled; provenance stored per factor (reference doc §11–12); the Sri Lankan matrimonial-blemish-neutralization rule (blemish neutral when the partner's chart shows the same) is `tradition`-labeled culture-specific content, out of phase-1 scope unless the domain authorizes it

7. **Dasha activation (soft)**: the stored output includes `dashaActivation.planets` = [Saturn, Mars] with a note key ("the combination may become active during Saturn/Mars periods") — a soft note, never a timing prediction (reference doc §15)

#### Edge Cases

- **Saturn/Mars in 2/12 only**, tradition without 2/12 registered → `exists: false` (the rule is gated, not evaluated)
- **Sign exchange vs conjunction ambiguity**: Saturn in Aries + Mars in Capricorn (parivartana) → reported as `PARIVARTANA`, not conjunction, with its own interpretation (reference doc §10)
- **Mars strong + Saturn weak** → expression keys for "Mars pushes through obstacles" (reference doc §8), distinct from the weak-Mars frustration keys

#### Business Rules

- The Shani–Mangala seed is authoritative for the *output shape* and depth; all subsequent yogas follow the same catalog + rule-engine + interpretation structure
- Every rule, theme and cancellation factor carries its `tradition` provenance; display strings are i18n keys — no text is stored per horoscope

#### Domain Change (2026-09-06, supersedes the US-YD-006 rule list above)

Per `docs/agni-marutha-dosha.md`, the domain redefined the Saturn–Mars seed on 2026-09-06: **Shani Mangala** is narrowed to **three rules** — SM-01 conjunction (1), SM-02 7th-from-each-other with the **mutual 180° drishti record** (2), SM-03 mutual 4-10 with the **mutual 90°/270° drishti record** (2); **mutual drishti alone, 2/12 and parivartana are removed** from it. The broad Saturn–Mars relationship becomes its own second dosha, **Agni Marutha** (8 rules — am01 conjunct, am02/am03 aspect, am04/am05 sign ownership, am06/am07 nakshatra lordship, am08 parivartana), so every SM rule is naturally a subset of an AM rule but the two are computed independently.

**Domain correction (2026-09-07, supersedes the SM-02/SM-03 clauses above):** for SM-2 and SM-3, **placement alone is not enough** — "Both Kuja and Shani should have their aspects … need to consider the planet Orbs value … only given locations like 7, 4, 8." Both directions must appear in the stored aspect records (already orb-filtered at compute time), i.e. a one-way aspect (real chart `6a68e773…`: Mars→Saturn 210° only) is **Agni Marutha only**. `yogaDoshaVersion` is `4` (pre-v4 recompute at render/search). Implemented expectations: dev spec Revision 7 / data-model Rule Catalog / QA Rev 7.

**Domain correction (2026-09-07, supersedes the SM-01 conjunction clause — Rev 9):** the same orb discipline applies to conjunction — "Kuja and Shani not combined because those planets are not in their orbs range." Real chart `6a74b291a5e25025ca4cb61a`: Saturn 16.03° and Mars 29.6° both in Vrishchika/house 7 but **13.57° apart** (beyond Saturn's 9°/Mars's 8° orbs) → the compute pipeline stores **no 0° records** → **Shani Mangala absent**; Agni Marutha stays present via AM-04 (Saturn in Vrishchika). SM-01 and AM-01 require same sign + house **and** both stored mutual 0° (conjunction) records — pure co-location without in-orb records does not combine. Implemented expectations: dev spec Revision 9 / data-model Rule Catalog / QA Rev 9.

---

### US-YD-007: Seed dosha — Manglik (Kuja Dosha)

- **Title**: Manglik (Kuja) Dosha ships as the first concrete dosha, pending domain confirmation of its rules
- **Story**: As a student, I want the Manglik Dosha evaluated from Mars's house placement (the classic 1/4/7/8/12 rule) with the same structured treatment as yogas — name, why it forms, affected houses, severity, and cancellation per the registered tradition — so that the Dosha tags show real content rather than an empty state.
- **Priority**: Medium
- **Actor**: System
- **Dependencies**: US-YD-002…US-YD-005; **domain confirmation** of the Manglik formation/cancellation rules and tradition (Open Question 9)

#### Acceptance Criteria

1. **Formation rule registered** (proposed — pending domain confirmation):
    - MK-01 Mars in houses 1, 4, 7, 8 or 12 from the Lagna → Manglik Dosha present; `strength` per the confirmed severity mapping (e.g. strength weighted by Mars dignity and exact house)

2. **Structured output**: the dosha entry carries `isPresent`, `formation`, `context.houseImpact` + `context.planets`, `interpretation.themes` (partnership/marriage tension per affected house), `mitigation`, `cancellation` and `finalAssessment.severity` — the same shape as yogas (the Dosha symmetric treatment — Open Question 4)

3. **Cancellation per tradition**: cancellation rules (e.g. Mars in own/exaltation sign, or specific house-based waivers) are registered **only** from a confirmed tradition and carry provenance — the engine never cancels Manglik by default

4. **Bilingual display**: name/key/theme/expression strings exist in EN + SI (මංගල දෝෂය / Manglik Dosha)

#### Edge Cases

- **Mars absent from all five houses**: `exists: false`, no dosha tag rendered
- **Tradition split**: if traditions disagree on e.g. whether Mars in 12th counts, the registered tradition's rule wins and is displayed with its provenance label (Open Question 9)

#### Business Rules

- The Manglik seed is **proposed content** — its rules must be confirmed by the domain before implementation; the framework itself does not depend on this confirmation (it ships with an empty dosha catalog if needed)
- Dosha entries preserve `isPresent` for existing search/export consumers (US-YD-011)

---

### US-YD-008: Separated Yoga and Dosha tags on the single horoscope view

- **Title**: The horoscope detail view shows Yoga tags and Dosha tags as two distinct, visually separated groups
- **Story**: As a student, I want to see the horoscope's yogas and doshas as two clearly separated tag groups on the single horoscope view — "Yoga" (යෝග) and "Dosha" (දෝෂ) — so that I can immediately tell benefic formations from afflictions.
- **Priority**: High
- **Actor**: Student
- **Dependencies**: US-YD-005 (stored structured data); US-YD-006/007 (seed content); UX tag rendering

#### Acceptance Criteria

1. **Two separated groups**:
    - Given a horoscope detail page with stored yogas/doshas, When the view renders, Then the Yoga tags and the Dosha tags appear as two **separate sections/groups** with distinct labels and visual treatment (e.g. different accent colors) — never a combined "Yogas & Doshas" list on the detail view
    - Each tag shows the yoga/dosha name (bilingual, from the catalog)

2. **Tag states**:
    - Present (not cancelled) entries show a normal tag; cancelled entries render with a struck-through or "cancelled" visual state (mirroring the existing Wargoththama strikethrough tag pattern); each tag communicates present/cancelled at a glance

3. **Only present entries tag**:
    - Stored entries with `exists: false` never render as tags (the engine stores or omits them per US-YD-005; the empty state handles the "nothing here" case)

4. **Empty states**:
    - No yogas present → a "no yogas" placeholder (e.g. "යෝග නොමැත" / "No yogas"); no doshas → "no doshas" placeholder. Legacy documents (never evaluated) show the same empty states

5. **Read-only and role-consistent**:
    - The tags render read-only on own, public and share-linked horoscopes alike (like the rest of the Warga Kendara content); no editing, no overrides

#### Edge Cases

- **Long Sinhala names**: tags wrap or truncate without breaking the layout (UX decision)
- **Many tags**: more tags than fit the row → the group wraps or scrolls (UX decision)
- **Manual horoscopes**: tags derive from the entered placements — the same empty-state rules apply when no entry evaluates present

#### Business Rules

- The groups are sourced from `CalculatedDetails.yogas` / `doshas` only — no separate calculation at render time
- Yoga and Dosha are two distinct domain concepts (benefic formations vs afflictions per the reference doc §11's terminology guidance) — the UI must never merge or blur them

---

### US-YD-009: Yoga detail panel — name, reason, result, cancellation

- **Title**: Each yoga tag expands to its full structured detail — name, why it is happening, result, cancellation
- **Story**: As a student, I want to open a yoga tag and see **why** it forms in this horoscope (the exact planetary conditions), **what its result is** (house-specific themes), and **whether/how it is cancelled** — with the tradition provenance — so that I can study the yoga rather than just see its name.
- **Priority**: High
- **Actor**: Student
- **Dependencies**: US-YD-008 (tags); US-YD-003/004 (interpretation + cancellation data); US-YD-006 (seed themes)

#### Acceptance Criteria

1. **Detail view contents** — given the yoga is present, when the student opens its detail, then the panel shows, per the feature request (`docs/yoga.md`):
    - **Name** — bilingual catalog name (e.g. Shani–Mangala Yoga / ශනි-කුජ යෝග), with the tradition/source label
    - **Why it is happening (reason)** — the exact planetary conditions: every satisfied rule composed from `formation.reasons[]` into readable sentences (e.g. "Saturn (ශනි) in the 10th house and Mars (කුජ) in the 4th house mutually aspect each other"); headline uses the primary rule
    - **What is the result** — the house-specific themes from `interpretation.themes` (grouped per affected house), in tendency language
    - **Cancellation** — when `cancellation.status` = cancelled/mitigated: which rule cancelled it, the condition, and the tradition; when not cancelled: an explicit "not cancelled" line (reference doc: never silently omit the question)

2. **Tendency, not prediction**: every result/cancellation string uses the registered tendency wording — the panel never contains deterministic predictions

3. **Numerics resolved per locale**: all planet/sign/house/strength references render via the existing i18n enum labels (Planet 1-9, ZodiacSign, etc.)

4. **Open/close**: the detail expands/collapses in place (accordion/panel per UX); only one open at a time is acceptable (UX decision)

#### Edge Cases

- **Mitigated but not cancelled**: the panel shows the mitigation factors under a distinct "mitigation/reduced" subsection — visually distinct from cancellation (per US-YD-004)
- **No themes for the affected house**: the result section shows the formation reason only — no empty theme placeholders
- **Legacy/corrupt entry**: a stored entry missing required fields renders a neutral "not available" fallback — never a crash

#### Business Rules

- The detail panel is a **pure render-time composition** of the stored structured entry (numeric enums + i18n keys) — no API call, data ships with the page (existing detail-page pattern)
- Cancellation and mitigation are visually and conceptually distinct (reference doc §6)

---

### US-YD-010: Dosha detail panel

- **Title**: Each dosha tag expands to its structured detail — name, formation conditions, affected houses, severity, cancellation/mitigation
- **Story**: As a student, I want the same study depth for a dosha as for a yoga — why it forms, which houses it affects, its severity, and whether it is cancelled or reduced — so that the Dosha side of the feature is not just a red tag.
- **Priority**: High
- **Actor**: Student
- **Dependencies**: US-YD-008 (tags); US-YD-007 (seed dosha); domain confirmation of the dosha structured treatment (Open Question 4)

#### Acceptance Criteria

1. **Detail view contents** — given a present dosha, when its detail opens, then the panel shows: name (bilingual + tradition), formation conditions (rules + reasons), affected houses (`context.houseImpact`), severity (numeric `YogaStrength` → localized label), and cancellation/mitigation state with provenance
2. **Severity labeling**: severity renders via i18n (e.g. මධ්යම / Moderate) — never the raw numeric
3. **Consistent with yoga panel**: the dosha panel shares the yoga panel's layout/behavior where the data shape matches (US-YD-009 reused components — UX decision)

#### Edge Cases

- **Cancelled dosha**: the tag shows the cancelled state and the panel explains why per the registered tradition (US-YD-007)
- **Empty dosha catalog** (domain rules not yet confirmed): the Dosha group shows the "no doshas" empty state while Yoga tags already render — the two groups are independent

#### Business Rules

- Dosha severity and yoga strength share the `YogaStrength` scale (domain Open Question 3); display names come from the enum's i18n labels

---

### US-YD-011: Search compatibility and specific yoga/dosha name search

- **Title**: Existing search surfaces keep working with the new structured shape; specific yoga/dosha names become searchable
- **Story**: As a student, I want to keep finding horoscopes by their yogas/doshas — including by a specific yoga name ("ශනි කුජ යෝග", "Shani Mangala yoga") — so that the structured redesign never breaks what search already does.
- **Priority**: Medium
- **Actor**: System
- **Dependencies**: US-YD-005 (new stored shape); `src/lib/search/` (textContent, vocabulary, route, export)

#### Acceptance Criteria

1. **Text content compatibility**:
    - Given a horoscope with stored yogas/doshas, When `generateTextContent` runs, Then the SI and EN sentences ("යෝග: …", "දෝෂ: …" / "Yogas: …", "Doshas: …") list the resolved bilingual catalog names — the current `y.name` string read is replaced with the catalog name lookup (SI + EN)

2. **Result cards and export**:
    - The search result card's "Yogas & Doshas" sections and the CSV export resolve `id` → bilingual name + numeric severity → localized label; `isPresent` filtering keeps working unchanged

3. **Specific-name query support** (proposed — see Open Question 8):
    - Given a query containing a cataloged yoga/dosha name in Sinhala or English (e.g. "ශනි කුජ", "Shani Mangala"), When search runs, Then horoscopes whose stored `yogas[].id` / `doshas[].id` match are surfaced (in addition to the existing keyword/overall-yoga triggers)
    - Catalog names join the search vocabulary (`SEARCH_VOCABULARY`) so suggestions include them

#### Edge Cases

- **Name collision**: a yoga name that shares words with a planet/sign query term stays unambiguous (parsing precedence decision — Architect/QA)
- **Legacy snapshot without struct id**: a stored entry without `id` is skipped by the filter and logged

#### Business Rules

- The search surfaces read the **same** stored structured data — no second shape, no duplicated calculation
- This story is **compatibility-first**: it must never regress existing search behavior; specific-name filtering can be phased after the compatibility work if the domain deems keyword search sufficient (Open Question 8)

---

### US-YD-012: Bilingual UI

- **Title**: All Yoga/Dosha surfaces render in Sinhala and English
- **Story**: As a Sinhala or English student, I want every yoga/dosha surface — group labels, tag names, formation reasons, themes, cancellation/mitigation lines, severity labels, empty states — in my chosen language, so that the feature is bilingual like the rest of the platform.
- **Priority**: High
- **Actor**: Student
- **Dependencies**: US-YD-008…US-YD-010; catalog i18n keys (US-YD-001)

#### Acceptance Criteria

1. **Message-key parity**: every new string exists in both `src/messages/si.json` and `src/messages/en.json` — no yoga/dosha string in only one locale
2. **No hardcoded strings**: component code contains no inline Sinhala/English literals; names, reasons, themes, cancellations, severities and empty states resolve via i18n from catalog keys and numeric enums
3. **Locale switch**: switching the active language re-renders all yoga/dosha surfaces immediately (existing `useI18n()` behavior)
4. **Enum labels reused**: planet/sign/house/strength names reuse the existing numeric-enum → i18n label mappings

#### Edge Cases

- **Missing Sinhala translation** for a pending-domain string: English fallback renders until provided (existing convention)
- **Sinhala names in search text**: search text content is generated per language already — both SI and EN sentences must resolve catalog names in their own language

#### Business Rules

- Only numeric enums + stable catalog IDs/keys are stored; every display string resolves per locale at render time (repo-wide convention)

---

### US-YD-013: Incremental yoga/dosha addition process

- **Title**: Adding the Nth yoga/dosha is a documented, additive, tested process — the framework stays unbroken
- **Story**: As the domain, I want a clear process for adding each new guided yoga/dosha — catalog row, rule functions, interpretation keys, i18n strings, fixture tests — so that "guide us one by one" maps to a repeatable, low-risk change.
- **Priority**: Medium
- **Actor**: System, Developer
- **Dependencies**: US-YD-001…US-YD-006 (the framework and seed)

#### Acceptance Criteria

1. **Checklist documented**: adding a new yoga/dosha requires — catalog entry (`id`, `type`, tradition, bilingual name keys), formation-rule functions (numeric enums only, pure), interpretation theme keys per house, mitigation/cancellation rules with tradition provenance, SI + EN messages, and fixture-chart tests for every rule (present/absent/edge)
2. **Non-breaking**: an addition never changes existing entries' storage shape, existing stored snapshots, or existing UI (existing tags/details render identically after the addition)
3. **Fixture coverage**: each new rule has at least one chart fixture proving formation, one proving absence, and one proving cancellation/mitigation behavior where applicable (QA can author with the domain)

#### Edge Cases

- **Rule conflicts between traditions**: a new tradition's rule conflicting with an existing entry's rule is rejected at review unless both are `tradition`-labeled and never combined silently (US-YD-004 rules)
- **Removal of a catalog entry**: removed entries' IDs in old snapshots render the neutral "not available" fallback (US-YD-001 edge case)

#### Business Rules

- The catalog and rule modules are the **only** places a new yoga/dosha touches the calculation path; the engine, storage, UI and search stay generic (catalog-driven)

---

## Clarifying Assumptions

1. **"Single horoscope view"** = the horoscope detail page (`/horoscopes/[id]`), where the Yoga/Dosha tags will be added as a new view section/tab. Search result cards are out of scope for the *tags* (they already have their own combined section — see US-YD-011 for compatibility).
2. **Framework first, seeds second**: the catalog + rule engine + interpretation engine + storage + UI are the hard deliverable; Shani–Mangala is the first yoga because it is fully specified; Manglik Dosha is proposed but its rules are domain-pending — the framework ships regardless.
3. **Deterministic engines, no LLM in formation**: the rule engine computes formation/cancellation/mitigation from stored chart facts; the interpretation is deterministic theme composition — matching `docs/shani-mangala-yoga.md`'s architectural recommendation. (Whether an AI interpreter is layered on top later is a separate decision — Out of Scope.)
4. **Numeric-enum conventions** apply throughout: planets 1-9, signs 1-12, houses 1-12, `PlanetaryStrength`, new `YogaStrength` and `CancellationStatus` enums — never display strings in storage. Catalog IDs and rule IDs are stable string keys (sub-tag catalog-key precedent).
5. **Standalone `name`/`severity` strings on doshas are removed** with consumers updated (search card, export, route) — `isPresent` is preserved; legacy string values are normalized at read time.
6. **Provenance everywhere**: every formation rule, theme, mitigation factor and cancellation factor in the catalog carries a tradition/source label; conflicting traditions are never silently combined.
7. **No deterministic predictions**: all theme/expression strings are tendency-level; dasha activation is a soft note ("may become active during…").
8. **Read-only feature**: yogas/doshas are derived system data — no user overrides, no editing, on all views (own/public/share-linked).
9. **Legacy behavior**: horoscopes stored before this feature render the empty states until the next full recalculation — no eager migration.

## Open Questions (Domain)

1. **Which yogas/doshas and in what order?** The domain will guide "one by one" — confirm the roadmap after Shani–Mangala (which yogas first: e.g. Gaja-Kesari, Budha-Aditya, Chandra-Mangala? which doshas: e.g. Rahu/Ketu doshas, Guru-Chandala?). The framework is ready for any order.
2. **Per-tradition cancellation rules** — which Jyotisha tradition(s) are authoritative for cancellation per yoga/dosha? `docs/shani-mangala-yoga.md` shows conflicting traditions (e.g. 2/12 counts only in some; matrimonial-blemish neutralization is Sri Lankan culture-specific). Which traditions does the platform register, and per which catalog entries?
3. **Strength semantics** — confirm the `YogaStrength` numeric scale (1 = Very Strong … 4 = Weak) for both formation strength and final severity; confirm how formation strength + mitigation + house relevance combine into `finalAssessment.severity` (weighting/ordering).
4. **Dosha structured treatment** — do doshas get the full symmetric structure (formation rules, house themes, mitigation, cancellation, dasha activation) or a reduced shape (present + severity + affected houses + cancellation)? Proposed: full symmetric treatment (US-YD-007/010).
5. **House-theme sources** — are the Shani–Mangala house themes (7th/10th/4th/8th, reference doc §5) authoritative as registered? Who provides the per-house theme keys for future yogas, and are the SI translations domain-approved?
6. **Dasha activation depth** — is the soft note ("may become active during Saturn/Mars dasha periods", planets listed) sufficient, or should the output compute actual dasha overlap from the stored dashas (hard link)? Proposed: soft note in phase 1.
7. **Manual horoscope applicability** — confirm yogas/doshas evaluate on manual charts from entered placements with the same rules (assumed — aspects and degrees use the existing fallback).
8. **Search scope** — should specific yoga/dosha name queries (e.g. "ශනි කුජ යෝග") filter horoscopes by yoga presence in phase 1, or is keyword compatibility sufficient initially (US-YD-011)?
9. **Manglik (Kuja Dosha) seed** — is Manglik acceptable as the first dosha, and are its rules standard (Mars in 1/4/7/8/12) with which cancellation rules (e.g. Mars own-sign/exalted waivers)? Which tradition registers the cancellation?
10. **Navamsha inputs** — does Shani–Mangala (or the first doshas) need Navamsha (D9) relationships in phase 1 (reference doc §16 mentions Navamsha support), given manual charts may lack Navamsa data? Proposed: D1-only in phase 1.
11. **Functional benefic/malefic status** — the reference doc §9 stresses natural vs functional malefic (lordship-based). Is functional status required for phase-1 interpretation, or only `PlanetaryStrength` per planet? Proposed: strength only in phase 1, functional role later.
12. **Search result card tags** — should the separated Yoga/Dosha tag treatment also apply to search result cards, or only the single horoscope detail view as requested?

## Out of Scope

- **New astrological calculations** — yogas/doshas evaluate the already-stored chart facts (planets, houses, aspects, strengths, dashas); no new ephemeris/varga computation in phase 1 (Navamsha-based rules are gated by Open Question 10)
- **Generative/AI interpretation** — deterministic interpretation engines only; an LLM "interpreter" layer over the structured output is a separate future decision
- **User editing/overrides** — yogas/doshas are derived system data; no student overrides, no admin per-horoscope edits
- **Marriage/health/career prediction logic** — the feature shows tendency-level results; no deterministic prediction engine, no corroboration engine (reference doc §14's Level-3 hierarchy is out of phase 1)
- **Culture-specific content** (e.g. the Sri Lankan matrimonial-blemish partner-neutralization rule) unless explicitly authorized by the domain
- **Detail-page layout redesign** — only the Yoga/Dosha tag groups + detail panels are added; the rest of the horoscope detail page stays as-is
- **Search index/embedding rework** — specific-name search is additive to the existing keyword pipeline (no embedding changes in phase 1)

## Documents Updated

- `specs/business-analysis/actors.md` — added Student permissions (view separated Yoga/Dosha tags on the single horoscope view; expand each yoga/dosha into its structured detail — name, formation reason, result/themes, cancellation with tradition provenance; distinguish present/cancelled/absent; read-only on own/public/share-linked views) and System responsibilities (maintain the static Yoga/Dosha Rule Catalog; evaluate registered yogas/doshas deterministically with structured formation output; evaluate cancellation separately from mitigation with provenance; produce house-specific interpretation via i18n theme keys; persist structured `yogas`/`doshas` on `CalculatedDetails` for both sources; recompute in the AstrologySettings recalculation job; keep search surfaces working)
- `specs/business-analysis/data-model.md` — revised the `CalculatedDetails.yogas` and `doshas` rows; replaced the placeholder [Yogas] and [Doshas] JSON structures with the structured per-yoga/per-dosha output (formation / context / interpretation / mitigation / cancellation / finalAssessment / dashaActivation; `isPresent` preserved on doshas); added the numeric `YogaStrength` and `CancellationStatus` enums; added the static [Yoga/Dosha Rule Catalog] registry table (seed entries: Shani–Mangala Yoga, Manglik Dosha); added a recalculation/legacy note to the CalculatedDetails notes

## Feature-to-Story Traceability

| Feature Document Requirement (`docs/yoga.md`) | User Story |
|------------------------------------------------|------------|
| "Need to add separated tags as Yoga and Dosha to single horoscope view" | US-YD-008 (separated groups on the detail view) |
| "will guide you one by one how to find each yoga is include or not" | US-YD-001 (catalog), US-YD-013 (incremental process) |
| Show the yoga **name** | US-YD-009 (bilingual name from catalog), US-YD-001 |
| Show **why it is happening — reason of the yoga** | US-YD-002 (formation rules), US-YD-009 (reason rendering), US-YD-006 (seed reasons) |
| Show **what is the result of that** | US-YD-003 (interpretation themes), US-YD-009 |
| Show **if it cancellation how it cancelled** | US-YD-004 (cancellation/mitigation engine), US-YD-009 |
| Depth/style anchor — `docs/shani-mangala-yoga.md` (multi-rule formation, structured output, house-specific interpretation, mitigation vs cancellation, provenance, dasha, rule-engine architecture) | US-YD-002…US-YD-006 (framework + seed yoga) |
| Dosha parity | US-YD-007 (seed dosha), US-YD-010 (dosha detail) |
| Bilingual platform convention | US-YD-012, US-YD-011 (search text) |