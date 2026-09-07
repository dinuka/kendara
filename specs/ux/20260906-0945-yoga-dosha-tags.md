# Yoga/Dosha Separated Tags (යෝග සහ දෝෂ) — UX Design

**Date:** 2026-09-06 09:45
**Author:** UX (BMAD)
**Based on:** specs/business-analysis/20260906-0707-yoga-dosha-tags.md (US-YD-008..US-YD-012), specs/business-analysis/data-model.md (§Yogas / §Doshas / §Yoga/Dosha Rule Catalog / §YogaStrength / §CancellationStatus), specs/architecture/20260906-0905-yoga-dosha-tags-architecture.md (types.ts render contract, `yogaDoshaVersion`, "Pass forward to UX" note), docs/yoga.md, docs/shani-mangala-yoga.md (§2 structured output, §3 dedup, §4 exact reason, §5 house interpretation, §11 terminology, §13 final result), specs/ux/main-ux-spec.md, src/app/horoscopes/[id]/page.tsx, src/messages/en.json, src/messages/si.json

**Rev 6 addendum (2026-09-06, Agni Marutha Dosha + SM narrowed):** per `docs/agni-marutha-dosha.md` the Dosha group now hosts **two** active doshas — **Shani Mangala Dosha** (narrowed to 3 positional rules) and **Agni Marutha Dosha / අග්නි මාරුත දෝෂය** (8 broad Saturn–Mars relationship rules). The render treatment is unchanged and catalog-driven: both appear as red/gray dosha chips in the amber-labeled Dosha group, each expanding the same structured panel with rule reasons (`dosha.agniMarutha.rule.am01..am08`), house-grouped themes (`dosha.agniMarutha.theme.house1..12`), expression block and soft dasha note (Agni Marutha has **no mitigation/cancellation blocks yet** — catalog `mitigations`/`cancellations` empty). A conjunct Saturn–Mars pair now yields **two** dosha tags (Shani Mangala + Agni Marutha) — the panel block order, chip color contract, and all accessibility rules above apply identically to both. No component changes were required; the i18n `dosha.agniMarutha.*` namespace was added in both locales.

**Rev 7 addendum (2026-09-07, SM-2/SM-3 require the mutual drishti):** internal rule semantics only — **no UI change.** Per the user's correction against real chart `6a68e773…`, SM-2 (7th-from-each-other) and SM-3 (mutual 4-10) additionally require **both** planets' stored aspect records (i.e. the mutual graha drishti within the per-planet orbs); a positionally-7th/4-10 pair with a one-way aspect now shows **Agni Marutha only** (its reason line renders the one-directional aspect). The chip color contract ("present = any satisfied formation rule") and all accessibility rules are unchanged.

**Rev 9 addendum (2026-09-07, SM-01 conjunction gates on the orbs):** internal rule semantics only — **no UI change.** Per the user's correction against real chart `6a74b291…`, SM-01/AM-01 conjunction additionally requires the stored **mutual 0° (conjunction) records** (same sign + house AND within each planet's orb); a co-located pair outside the orbs (both Vrishchika/7th, 13.57° apart) now shows **Agni Marutha only** (via `am04` — Saturn in Vrishchika). Reason-line wording ("…occupy house {house} of {sign}…") is unchanged — the rule simply stops firing for non-combined pairs. Chip color contract and all accessibility rules unchanged.

---

## Overview

This feature puts the horoscope's **yogas and doshas as two visually separated, independently empty-stated tag groups** on the single horoscope (detail) view. Each present tag is a chip that expands **in place** into a structured detail panel answering exactly what `docs/yoga.md` asked: the yoga/dosha **name**, **why it is happening** (the exact planetary conditions — every satisfied rule), **what its result is** (house-specific tendency themes), and **if/how it is cancelled** (explicit status line, per-factor reasons, tradition provenance) — plus a visually distinct **mitigation** subsection and a soft **dasha-activation** note.

The surface is a **pure render-time composition** of the stored structured evaluation (`CalculatedDetails.yogas` / `doshas.doshas`, Architect `YogaEvaluation`/`DoshaEvaluation` types) + the static catalog + i18n. No new endpoints, no user mutations, no loading states (data ships with the page; legacy documents recompute at render via `resolveYogas`/`resolveDoshas`).

**UX goals:**

- **Immediate separation** — a student scanning the detail view can tell benefic formations (Yoga, indigo) from afflictions (Dosha, amber) at a glance, per `docs/shani-mangala-yoga.md` §11 ("don't call every effect a dosha").
- **Study depth without a tab maze** — the tags live among the other study surfaces (Calculations tab, beside the Lagna summary), and each panel answers the four requested questions in a fixed, predictable block order.
- **Tendency, never prediction** — every result/expression string is registered tendency wording; the UI never renders deterministic claims.
- **Bilingual parity + numeric-enum discipline** — no display text stored, no raw numbers rendered; planets/signs/houses resolve via the existing i18n enum maps, everything in EN + SI.
- **Consistency with existing conventions** — Wargoththama strikethrough tag state, Bhava Suchika/Wargoththama indigo pill, notepad dot+tint+aria-label chips and `(n)` badges, Information-Glyph tooltips, `aria-expanded`/`role="region"` disclosure panels.

---

## Answers to the design questions (decisions)

### Q1 — Layout / mount point: dedicated tab `යෝග සහ දෝෂ / Yogas & Doshas` (peer of Charts / Calculations / Dashas / Metadata)

**Decision (rev 2, per 2026-09-06 engineer direction): a new 5th read-only tab `යෝග සහ දෝෂ / Yogas & Doshas` on the horoscope detail page, placed between the Dashas tab and the Metadata tab** (tab strip `charts → calculations → dashas → yoga-doshas → metadata`; the tab owns `activeTab === "yoga-doshas"` and renders the section card). The section is **no longer embedded in the Calculations tab** between the Lagna card and the Houses section. Tab label key: `horoscope.yogaDoshas` (EN "Yogas & Doshas" / SI "යෝග සහ දෝෂ"). Rev 1 ("new section inside the Calculations tab between the Lagna/ascendant summary card and the Houses section", `page.tsx:1352-1458`/`:1460`) is superseded by this decision and was superseded in code by the implementation.

Rationale for the dedicated tab, verified against the live page structure:

| Option | Rejected because |
|--------|------------------|
| New section card between the Lagna card and the Houses card (rev 1) | The Calculations tab is already the densest surface (Shad Bala, Bhava Suchika, Wargoththama, the Lagna card, Planets, Houses, Derived Ranges); the user found the tags buried inside it. A yoga/dosha evaluation is its own study surface — the Dasha tab proves this is the accepted pattern for a distinct analysis surface. |
| Inside the Lagna tag row (the `ascTags` `<p>` at `page.tsx:1420-1438`) | That row is a compact flag list for the ascendant — adding two whole groups would break its density and its "flags about the ascendant" meaning. |
| **Dedicated 5th tab `යෝග සහ දෝෂ` between Dashas and Metadata** ✅ | Separates the tags from the raw calculation dump and mirrors the Dashas surface precedent; the tab renders the same one section card (`bg-white rounded-lg border p-4`) with the section-header pattern (`font-semibold text-sm text-indigo-700 uppercase tracking-wide`); details stay in place under the tags; the whole thing is read-only. |

Section anatomy (same card as rev 1, now hosted in its own tab):

```
<section id="yogas-doshas" class="bg-white rounded-lg border p-4" aria-labelledby="yogas-doshas-title">
    <div class="flex items-center gap-2 mb-3">
        <h3 id="yogas-doshas-title" class="font-semibold text-sm text-indigo-700 uppercase tracking-wide">
            යෝග සහ දෝෂ            <!-- EN: Yogas & Doshas -->
        </h3>
        <InfoGlyph> …              <!-- section-explanation tooltip, AspectTooltip pattern -->
    </div>
    <div class="space-y-4">
        <YogaTagGroup/>           <!-- label chip + (n) badge + tags OR empty -->
        <DoshaTagGroup/>          <!-- label chip + (n) badge + tags OR empty -->
    </div>
</section>
```

Both groups live in **one** section card (one mount point, one anchor `#yogas-doshas`), but the two groups are visually separated by their own label chips, accent colors and independent empty states — never a merged list.

**Tag-row composition per group:** localized group label chip (small-caps style, e.g. `යෝග` / `Yogas`) + `(n)` count badge (only when ≥ 1 tag — the notepad ratio-badge rule) + wrapped chips. When a group has zero present entries the group still renders its label chip followed by its localized empty text (the two groups are independent — e.g. the Dosha group may show "දෝෂ නොමැත" while the Yoga group already shows tags, per the pending-domain Manglik seed).

### Q2 — Detail-panel anatomy: in-place, **multi-open** disclosure panels

**Decision: each tag is an independent disclosure button; the panel expands in place under the tag. Multiple panels may be open simultaneously.** Not a modal, not a side panel, not a single-open accordion.

Rationale:

- Study-first: a student comparing the formation reasons of two yogas (or a yoga vs a dosha) needs both panels open — the search result cards and the Dasha timeline already allow multi-expansion.
- No scroll-jacking/overlay (modal/side-panel would hide the chart context the panel references).
- ARIA stays trivial: each tag is `<button aria-expanded aria-controls={id}>` + `<section id={id} role="region" aria-labelledby={tagId} hidden>`. No roving tabindex needed (disclosure pattern, all buttons in tab order; arrow-key navigation is not required by the disclosure pattern).
- State lives client-side only (`openIds: Set<string>`), resets to `{}` on horoscope change (`useEffect` on `params.id`, same as the Warga second-chart reset).

**Panel anatomy (fixed block order), and the stored fields that feed each block** (`YogaEvaluation`/`DoshaEvaluation` from the Architect `types.ts`):

| # | Block | Stored field(s) | Composition |
|---|-------|-----------------|-------------|
| 0 | **Header** | `id → catalog.nameKey`, `tradition`, `formation.strength`/`finalAssessment.severity`, `cancellation.status` | Name (`yoga.shaniMangala.name` / `dosha.manglik.name`) · `Tradition: {tradition}` provenance line (`yogaDosha.panel.provenance` + `tradition.MAIN_STREAM`) · `yogaStrength.*` pill from **final assessment severity** (`finalAssessment.severity`) · status badge from `cancellation.status` |
| 1 | **Why it forms** (reason) | `formation.primaryRule`, `formation.reasons[]` (`rule`, `reasonKey`, `params`) | **Headline sentence** = the reason object whose `rule === primaryRule`, resolved via `reasonKey` + `params` (bold). Then one muted line per **every** satisfied rule (`formation.reasons[]`, already deduped by the engine), e.g. SM-02 and SM-03 co-firing for a 7th-house pair both render. Numeric params resolve at render: `planet`/`otherPlanet`/`target` → `astrology.planetNames.{n}`, `sign`/`otherSign` → `astrology.signNames.{n}` (locative variants where the message calls for them), `house`/`otherHouse` → localized ordinal (`{house} වන භාවය` / `house {house}`). |
| 2 | **Result** | `interpretation.themes[]` (`key`), `context.houseImpact` | Theme keys group **per house** by parsing the `house{n}` segment of the catalog key convention (`yoga.shaniMangala.theme.house7.{slug}`). Each group renders under a house heading (`yogaDosha.panel.houseGroup` → `7 වන භාවය` / `7th house`) with one bullet per theme, tendency wording ONLY. A theme key without a `house{n}` segment (catalog drift) renders in a single ungrouped bullet list. **Block omitted entirely when `interpretation.themes` is empty** — never an empty "Result" heading (interpretation of the BA AC "the result section shows the formation reason only"; the formation reason above already answers the question). |
| 3 | **How it expresses** | `finalAssessment.expressionKeys[]` | One bullet per expression key (tendency lines, e.g. "expresses as disciplined, persistent action"). Block omitted when empty. |
| 4 | **Cancellation** | `cancellation.status` (1/2/3), `cancellation.factors[]` (`ruleId`, `reasonKey`, `planets?`, `houses?`, `tradition`) | **Always renders a status line** — the question is never silently skipped. status 1 → `Not cancelled` + hint `No registered tradition-specific cancellation rule applies…`; status 2 → `Cancelled by {ruleId}` + one line per factor (condition via `reasonKey` + `Involved planets/houses` where present + `Tradition: {tradition}`); status 3 → `Not cancelled — reduced by mitigating factors` + pointer to the Mitigation block below. |
| 5 | **Mitigation** (distinct subsection) | `mitigation[]` (`ruleId`, `factor`, `effect`, `target?`, `tradition`, `confidence`) | One line per factor: `{factor label} {on target} — {effect label}` + `Tradition: {tradition}` + `Confidence: {low/medium/high}`. Visually distinct from Cancellation (separate heading, tinted left border, subdued "reduces/does not cancel" note line). Block rendered when `mitigation.length > 0` **or** `cancellation.status === 3`. |
| 6 | **Dasha activation** (soft) | `dashaActivation?` (`planets`, `noteKey`) | Muted footnote line: `yoga.shaniMangala.dashaNote` with `{planets}` resolved per locale ("may become active during Saturn/Mars dasha periods") — never a timing prediction. Omitted when `dashaActivation` is absent. |

Unknown factor strings / unknown expression keys / unknown tradition keys → **raw string fallback** (never a crash, warn-logged), consistent with the "not available" convention.

### Q3 — Tag states + colors

| State | Trigger | Tag rendering | Interactivity |
|-------|---------|---------------|---------------|
| Present | `exists: true` + `cancellation.status === 1` | Leading status dot (yoga = indigo dot, dosha = amber dot, `aria-hidden`), name, `yogaStrength.*` pill (final severity). Yoga pill tint `text-indigo-700 bg-indigo-50 border-indigo-200`; dosha tint `text-amber-700 bg-amber-50 border-amber-200`. | Button — expands the panel |
| Cancelled | `cancellation.status === 2` | Gray dot + **struck-through name** (`line-through`, Wargoththama precedent) + `Cancelled` badge (`bg-gray-200 text-gray-600 border-gray-300`) — **both** the strike and the badge: the strike is a persistent text-format state, the badge is the explicit word for scanning; the word also ships in the `aria-label`. Pill still shows the pre-cancellation severity. | Button — expands the panel (panel explains the cancellation) |
| Mitigated | `cancellation.status === 3` | Amber dot + normal name + `Reduced` badge (`bg-amber-50 text-amber-700 border-amber-200`). | Button — expands the panel (panel shows the mitigation factors) |
| Unknown / legacy catalog ID | stored `id` not in the catalog | Dashed gray border chip (`border-dashed text-gray-500 bg-gray-50`), raw `id` as the visible text, `Not available` badge (`yogaDosha.unknownBadge`); **not** a button — no structured data to expand. Warn-logged at render (Architect/US-YD-001 edge). | None |

Color is **never the only channel**: every state also carries (a) the badge word, (b) the `line-through` text format for cancelled, and (c) the state word baked into the tag `aria-label` (notepad classification-chip convention).

**Affliction-vs-benefic distinction without "bad/good":** the **group-level** accent (Yoga indigo vs Dosha amber) is the distinction — indigo communicates "benefic formation tradition", amber communicates "affliction/caution", and error-red is deliberately **not** used anywhere (amber is not danger). Within the Yoga group, an afflicted/challenged expression is **not** permanently marked on the closed tag; the tendency tone surfaces in the panel's "How it expresses" block (`finalAssessment.expressionKeys`, e.g. "blocked action" vs "disciplined action") per `docs/shani-mangala-yoga.md` §11. If the domain later wants a tag-level "challenging expression" classifier, that needs a catalog metadata flag (→ Asked Questions, Q-Arch-2).

### Q4 — Empty states

One **neutral, shared empty state per group** — the same copy for legacy (never-evaluated) and computed-empty:

| Group | EN | SI |
|-------|----|----|
| Yoga | "No yogas" | "යෝග නොමැත" |
| Dosha | "No doshas" | "දෝෂ නොමැත" |

`yogaDoshaVersion` is **not surfaced**: legacy documents already get a pure render-time recompute (`resolveYogas`/`resolveDoshas`), so the first paint is populated when anything exists, and the recompute-and-empty case is semantically identical to computed-empty ("this chart has no such result"). Rendered as a muted line (`role="status"` so screen readers announce it), gray `text-xs`, no badge. Per US-YD-012 the two groups have **independent** empty states.

### Q5 — Interactive spec (keyboard / ARIA / tooltip / mobile)

- Each tag: `<button type="button" aria-expanded="true|false" aria-controls="yd-panel-{id}">`; panel: `<section id="yd-panel-{id}" role="region" aria-labelledby="yd-tag-{id}" hidden>` (or a grid-rows `transition` animation — see Micro-interactions).
- Multi-open: toggling one tag never closes another; clicking an open tag's button collapses its own panel. Focus stays on the tag button after toggle. No arrow-key navigation (disclosure pattern — all buttons remain in tab order).
- The group wrapper: `<div role="group" aria-label={yogaDosha.groupYogaAria|groupDoshaAria}>`; the section has `aria-labelledby` on its `<h3>`; the section InfoGlyph uses the existing AspectTooltip pattern (`aria-describedby` → `role="tooltip"`, hover/focus/tap, 150ms delay, Esc dismiss, `title` fallback, SI `max-w-[320px]`).
- Tag `aria-label` composed as `yogaDosha.tagAria` → `"{name}, {strength}, {status}"` where `{status}` = "present"/"cancelled"/"reduced"/"not available" (localized `yogaDosha.presentStatusWord` / the badge words).
- Long theme text: **inline bullets**, never tooltips — themes are short tendency phrases (2–8 words); Sinhala wraps naturally; the InfoGlyph is the only tooltip in the section.
- Mobile (< 640px): tags wrap freely (no horizontal scroll, no truncation); panels are full-width; the count badge and label chip stay inline; touch targets ≥ 40px(44 preferred) on the tag buttons.
- Sinhala 30% width allowance: tag chips get `max-w`-free wrapping, group label chip keeps comfortable padding; the section is single-column at every breakpoint (same as the other Calculations-tab cards).

### Q6 — Search result cards: **keep the existing combined sections this phase**

**Decision:** the separated-tag treatment applies to the **horoscope detail view only**. Search result cards (`src/app/search/page.tsx:1210-1269`) keep their existing combined "Yogas" / "Doshas" card sections this phase. Compatibility (Architect's plan): the card name reads switch to catalog-resolved names (`YogaDoshaNamesEn/Si[id]` with the legacy `name`-string fallback), dosha `isPresent`-based filtering stays untouched, severity resolves `yogaStrength.*` labels. US-YD-011 is compatibility-first; a later phase may restyle cards to the separated treatment (BA Open Question 12) — flagged to PM.

---

## User Flows

### Flow 1 — Read the separated tags (default)

```
Student opens a horoscope → Yoga & Doshas tab
  → "යෝග සහ දෝෂ" section renders at the top of the tab's own surface
  → Yoga group: [යෝග (2)] ● ශනි-කුජ යෝග · ප්රබල   ● ගජ-කේසරී යෝග · මධ්යම
  → Dosha group: [දෝෂ (1)] ● මංගල දෝෂය · ප්රබල
  → Count badges show only because each group has ≥ 1 tag
```

### Flow 2 — Open a yoga detail

```
Student clicks the ශනි-කුජ යෝග tag
  → aria-expanded=true; panel expands in place under the tag
  → Header: ශනි-කුජ යෝග · සම්ප්රදාය: ප්රධාන ධාරාව · [ප්රබල]
  → Why it forms: headline = primary rule sentence (SM-01 conjunction wording with actual
    sign/house/planets resolved), then one line per satisfied rule (SM-02/SM-03 both shown when co-fired)
  → What result it gives: "7 වන භාවය" → relationship-conflict + delayed-marriage bullets
  → How it expresses: disciplined-action bullet
  → Cancellation: "අවලංගු වී නැත." + hint line
  → Mitigation: Jupiter-aspect factor line (factor + target + effect + tradition + confidence)
  → Dasha activation: soft note naming Saturn/Mars periods
  → Student clicks a second yoga tag → both panels stay open (multi-open)
  → Student clicks the first tag again → only that panel collapses
```

### Flow 3 — Cancelled and mitigated states

```
Chart with a cancelled yoga:
  → Yoga tag shows struck-through name + [අවලංගු/Cancelled] badge + gray dot
  → Panel: Cancellation block = "Cancelled by SM-CAN-001" + condition + tradition; Mitigation block absent
Chart with a mitigated yoga:
  → Tag shows normal name + [අවම කළ/Reduced] badge + amber dot
  → Panel: Cancellation = "Not cancelled — reduced by mitigating factors"; Mitigation block lists factors
```

### Flow 4 — Legacy / stale documents

```
Pre-feature horoscope (yogas: [], suitable legacy detection via missing yogaDoshaVersion)
  → resolveYogas/resolveDoshas recompute pure at render → populated first paint, no flicker
Truly empty chart or legacy recompute with no rules fired
  → groups render label chips + "යෝග නොමැත" / "දෝෂ නොමැත" empty lines
Stored entry referencing a catalog ID that no longer exists
  → dashed-gray "not available" chip with the raw id; panel not available; warn logged
```

### Flow 5 — Share / public view

```
Visitor opens a public horoscope or share link → Yoga & Doshas tab identical
  → Tags, panels, badges, provenance all render read-only
  → No editing affordances anywhere (no overrides exist for this feature)
```

---

## Wireframes / Mockups

### Screen: Horoscope detail → Yoga & Doshas tab (desktop)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Charts  Calculations  Dashas  Yoga & Doshas  Metadata (tab strip, active)    │
│  ┌─ යෝග සහ දෝෂ                               [ⓘ] ────────────────────────┐  │
│  │                                                                            │  │
│  │  යෝග (2)                                                                  │  │
│  │  [● ශනි-කුජ යෝග · ප්රබල]  [● ගජ-කේසරී යෝග · මධ්යම]                  │  │
│  │  [● ~~ශනි-කුජ යෝග~~ · ප්රබල] [අවලංගු]  ← strikethrough example        │  │
│  │                                                                            │  │
│  │  දෝෂ (1)                                                                  │  │
│  │  [● මංගල දෝෂය · ප්රබල]                                                  │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│  ┌─ Houses section (unchanged) ────────────────────────────────────────────┐  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Screen: Expanded yoga panel (multi-open shown for one panel)

```
│  යෝග (1)                                                                      │
│  [▾ ● ශනි-කුජ යෝග · ප්රබල]                                                   │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │ සම්ප්රදාය: ප්රධාන ධාරාව                           [Reduced] (when status 3) │ │
│  │                                                                            │ │
│  │ හටගැනීමට හේතුව             WHY IT FORMS                                    │ │
│  │   ශනි සහ කුජ යන දෙකම මකර රාශියේ 7 වන භාවයේ සිටිති —                       │ │
│  │   එකම රාශිය හා භාවය (සංයෝගය).                       ← primary-rule headline│ │
│  │   · ශනි සහ කුජ එකිනෙකට ප්රති භාවයේ (7/7) සිටිති.      ← satisfied rule #2   │ │
│  │                                                                            │ │
│  │ දෙන ඵලය                  WHAT RESULT IT GIVES                             │ │
│  │   7 වන භාවය                                                                │ │
│  │     · සබඳතා ගැටුම් ඇතිවීමේ ප්රවණතාව                                        │ │
│  │     · විවාහ ප්රමාදයේ ප්රවණතාව                                              │ │
│  │                                                                            │ │
│  │ ප්රකාශ වන ආකාරය           HOW IT EXPRESSES                                │ │
│  │     · විනයගරුක, නොපසුබට ක්රියාවක් ලෙස ප්රකාශ වේ.                          │ │
│  │                                                                            │ │
│  │ අවලංගු වීම               CANCELLATION                                     │ │
│  │     අවලංගු වී නැත.                                                        │ │
│  │     ලියාපදිංචි සම්ප්රදාය-විශේෂිත අවලංගු රීතියක් මෙම සංයෝගයට අදාළ නොවේ.  │ │
│  │                                                                            │ │
│  │ අවම කිරීම                MITIGATION (distinct block)                      │ │
│  │     · ගුරුගේ දෘෂ්ටිය කුජට — බරපතලකම අවම කරයි                              │ │
│  │       (සම්ප්රදාය: ප්රධාන ධාරාව · විශ්වාසය: මධ්යම)                        │ │
│  │                                                                            │ │
│  │ දශා සක්රියතාව             DASHA ACTIVATION (soft)                         │ │
│  │     ශනි/කුජ දශා කාලවලදී මෙම සංයෝගය සක්රිය විය හැක.                      │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
```

### Screen: Empty / no-data (and mobile)

```
│  යෝග සහ දෝෂ                               [ⓘ]                              │
│  යෝග                                                                          │
│  යෝග නොමැත                                ← muted line, role="status"        │
│  දෝෂ                                                                          │
│  දෝෂ නොමැත                                                                   │
│  (Mobile < 640px: same card, single column, tags wrap freely, full-width panels) │
```

---

## Component Design

| Component | Purpose | States | Props |
| --------- | ------- | ------ | ----- |
| `YogaDoshaSection` | Section wrapper: title + InfoGlyph + both tag groups | default | `yogas: YogaEvaluation[]`, `doshas: DoshaEvaluation[]`, `locale`, `catalog` name maps |
| `YogaTagGroup` | Label chip + `(n)` count + yoga tags / empty line | populated, empty | `yogas`, `openIds: Set<string>`, `onToggle(id)` |
| `DoshaTagGroup` | Label chip + `(n)` count + dosha tags / empty line | populated, empty | `doshas`, `openIds`, `onToggle(id)` |
| `YogaDoshaTag` | Disclosure button chip | present, cancelled, mitigated, unknown(span), hover, focus | `evaluation`, `type: "yoga"\|"dosha"`, `open`, `onToggle` |
| `YogaDoshaDetailPanel` | `role="region"` panel | open, closed (hidden) | `evaluation`, `panelId`, `labelledBy` |
| `ReasonBlock` | Primary-rule headline + satisfied-rule lines | populated, always rendered for present entries | `formation: FormationResult`, `paramsResolver` |
| `ResultBlock` | House-grouped theme bullets | rendered when `themes.length > 0`; omitted otherwise | `themes: {key}[]`, `houseGroupHeading` |
| `ExpressionBlock` | `finalAssessment.expressionKeys` bullets | rendered when non-empty; omitted otherwise | `expressionKeys[]` |
| `CancellationBlock` | Status line; status-2 factor lines; status-3 pointer | status 1 / 2 / 3 | `cancellation: CancellationResult`, `traditionLabels` |
| `MitigationBlock` | Factor lines + note | rendered when `mitigation.length > 0` or status 3; omitted otherwise | `mitigation: MitigationFactor[]` |
| `DashaNoteBlock` | Soft activation footnote | rendered when `dashaActivation` present; omitted otherwise | `dashaActivation` |
| `YogaStrengthPill` | `yogaStrength.*` label pill | 1..4 | `strength: YogaStrength`, `tone: "yoga"\|"dosha"` |
| `StateBadge` | Cancelled / Reduced / Not available badge | none, cancelled, reduced, unknown | `status`, `type` |

**Data flow:** `calculatedDetails.yogas` / `doshas.doshas` (or `resolveYogas`/`resolveDoshas` for legacy) → section → groups → tags → panels. No API calls, no mutation endpoints, no loading spinners. Numeric params are resolved through the existing `astrology.planetNames`/`signNames`/`signNamesLocative` maps and the localized house-ordinal helper.

---

## States

| State | Trigger | UI |
|-------|---------|-----|
| Default | Page load, auto or manual horoscope with present entries | Section + both groups populated with count badges |
| Empty group | No present entries in one group (evaluated-empty or legacy recompute) | Group label chip + muted empty line, no count badge; other group unaffected |
| Legacy | Document without `yogaDoshaVersion` (stale `[]` or normalizing legacy flat dosha strings) | Render-time recompute — identical UI, populated first paint, no flicker |
| Cancelled | `cancellation.status === 2` | Struck-through name + Cancelled badge + gray dot; panel Cancellation block lists the factors |
| Mitigated | `cancellation.status === 3` | Reduced badge + amber dot; panel shows mitigation factors + status-3 line |
| Unknown ID | Stored `id` not in `YOGA_DOSHA_CATALOG` | Dashed-gray non-interactive chip, raw id, Not available badge, warn log |
| Panel open/close | Tag click | In-place expansion; multi-open; focus stays on the tag |
| Manual chart | `source: "manual"` | Same evaluation path from entered placements (Architect); same empty-state rules |
| Mobile | < 640px | Single-column card; tags wrap; panels full-width; 44px tap targets |
| Error | — | Not applicable client-side (pure derived data, no API); corrupt stored values degrade to the unknown-chip / empty line per edge cases — never a crash |

---

## Micro-interactions

- **Panel expand**: 200ms ease-out height+opacity (`grid-template-rows: 0fr→1fr` or measured `max-height` transition — Developer's choice), chevron/`aria-expanded` icon rotates; **collapse** 150ms ease-in (search-card timing convention).
- **Tag press**: `transition-colors` 100ms (accent tint → `bg-gray-50` active), visible focus ring (indigo 2px offset).
- **Cancelled tag**: no animation on the `line-through` (deliberate — static state, like the Wargoththama cross).
- **InfoGlyph**: existing AspectTooltip pattern (150ms hover delay, `role="tooltip"`, `max-w-[280px]` EN / `max-w-[320px]` SI).
- **No toasts** — the section mutates nothing.

---

## Responsive Behavior

| Breakpoint | Section | Group rows | Tags | Panels |
|------------|---------|------------|------|--------|
| Desktop > 1024px | Single card, full content width | Label chip + `(n)` + tags on one row | Chips wrap to next line, left-aligned | In-place column under the triggering tag |
| Tablet 640–1024px | Single card | Same, narrower | Chips wrap | In-place |
| Mobile < 640px | Single card, `p-4` | Label chip row stays inline; count badge inline | Free wrap, no truncation, no horizontal scroll | Full-width, in-place |

**Sinhala considerations:** Sinhala chip text is 15–20% wider — chips never get a `max-width` truncation (they wrap whole-word); the group label chip keeps 30% extra horizontal padding; panel prose wraps freely with `leading-relaxed`; Western numerals for `(n)` counts and house numbers (platform convention).

---

## Accessibility

- **Tag buttons**: `<button>` with `aria-expanded` + `aria-controls`; visible focus ring; the status word is in the `aria-label` ("…, cancelled") so state is never conveyed by color/strike alone.
- **Panels**: `role="region"` + `aria-labelledby` pointing at the tag's inner label span; `hidden` when closed (or equivalent removal from the a11y tree).
- **Groups**: labeled `role="group"` (`යෝග`/`Yogas`, `දෝෂ`/`Doshas` + aria labels `yogaDosha.groupYogaAria`/`groupDoshaAria`).
- **Empty states**: `role="status"` (announced on first paint when a group is empty).
- **Unknown chips**: non-interactive `<span>` with `aria-label` = `{raw id}, not available`; never a focus stop.
- **InfoGlyph**: `aria-describedby` → `role="tooltip"`; keyboard reachable; Esc dismisses; `title` fallback.
- **Screen readers**: enums never announced as raw numbers — `yogaStrength.*`/`cancellationStatus.*` labels and localized planet/sign/house names are composed into every label; the multi-open disclosure pattern needs no roving-tabindex machinery.
- **Contrast**: indigo/amber tints on white meet AA (`#4F46E5`/`#B45309`-family text on 50-level tints); badges ≥ 4.5:1; focus ring 2px solid indigo.
- **Touch targets**: tag buttons ≥ 40px tall (44px preferred) on mobile.

---

## i18n Message Keys (EN + SI)

New top-level namespaces in both `src/messages/en.json` and `src/messages/si.json`: `yogaDosha.*` (shared chrome), `yoga.*` (group + panel + seed content), `dosha.*` (group + panel + seed content), `yogaStrength.*`, `cancellationStatus.*`, `tradition.*`. No existing keys are modified (search-card `search.card.yogas/doshas` etc. stay). Planet/sign/house labels are reused from `astrology.planetNames` / `astrology.signNames` / `astrology.signNamesLocative` / the house-ordinal helper.

Message format: next-intl ICU (`{param}` placeholders, numeric params resolved per locale before interpolation).

### Shared chrome — `yogaDosha.*`

| Key | EN | SI |
|-----|----|----|
| `sectionTitle` | "Yogas & Doshas" | "යෝග සහ දෝෂ" |
| `sectionTooltip` | "Yogas are benefic planetary combinations; doshas are afflictions. Each tag opens the exact formation reason, the house-specific result, and the cancellation or mitigation." | SI-pending → EN fallback |
| `groupYogaAria` | "Yoga tags" | "යෝග ටැග්" |
| `groupDoshaAria` | "Dosha tags" | "දෝෂ ටැග්" |
| `tagAria` | "{name}, {strength}, {status}" | "{name}, {strength}, {status}" |
| `presentStatusWord` | "present" | "පවතී" |
| `cancelledBadge` | "Cancelled" | "අවලංගු" |
| `reducedBadge` | "Reduced" | "අවම කළ" |
| `unknownBadge` | "Not available" | "නොමැත" |
| `unknownAria` | "{id}, not available" | "{id}, නොමැත" |
| `panel.houseGroup` | "{house} house" | "{house} වන භාවය" |
| `panel.provenance` | "Tradition: {tradition}" | "සම්ප්රදාය: {tradition}" |
| `panel.notCancelled` | "Not cancelled" | "අවලංගු වී නැත" |
| `panel.notCancelledHint` | "No registered tradition-specific cancellation rule applies to this combination." | SI-pending → EN fallback |
| `panel.cancelledBy` | "Cancelled by {rule}" | "{rule} මගින් අවලංගු කර ඇත" |
| `panel.mitigatedStatus` | "Not cancelled — reduced by mitigating factors." | SI-pending → EN fallback |
| `panel.mitigationNote` | "These factors reduce the difficult expression; they do not cancel the combination." | SI-pending → EN fallback |
| `panel.involvedPlanets` | "Involved planets: {planets}" | "සම්බන්ධ ග්‍රහයින්: {planets}" |
| `panel.involvedHouses` | "Involved houses: {houses}" | "සම්බන්ධ භාව: {houses}" |
| `panel.confidence` | "Confidence: {level}" | "විශ්වාසය: {level}" |

### Per-group — `yoga.*` and `dosha.*`

| Key | EN | SI |
|-----|----|----|
| `yoga.groupTitle` | "Yogas" | "යෝග" |
| `yoga.empty` | "No yogas" | "යෝග නොමැත" |
| `yoga.panel.why` | "Why it forms" | "හටගැනීමට හේතුව" |
| `yoga.panel.result` | "What result it gives" | "දෙන ඵලය" |
| `yoga.panel.expression` | "How it expresses" | "ප්‍රකාශ වන ආකාරය" |
| `yoga.panel.cancellation` | "Cancellation" | "අවලංගු වීම" |
| `yoga.panel.mitigation` | "Mitigation" | "අවම කිරීම" |
| `yoga.panel.dasha` | "Dasha activation" | "දශා සක්‍රියතාව" |
| `dosha.groupTitle` | "Doshas" | "දෝෂ" |
| `dosha.empty` | "No doshas" | "දෝෂ නොමැත" |
| `dosha.panel.why` | "Why it forms" | "හටගැනීමට හේතුව" |
| `dosha.panel.result` | "What result it gives" | "දෙන ඵලය" |
| `dosha.panel.expression` | "How it expresses" | "ප්‍රකාශ වන ආකාරය" |
| `dosha.panel.cancellation` | "Cancellation" | "අවලංගු වීම" |
| `dosha.panel.mitigation` | "Mitigation" | "අවම කිරීම" |
| `dosha.panel.dasha` | "Dasha activation" | "දශා සක්‍රියතාව" |

(Panel values are intentionally duplicated per group rather than shared, so yoga/dosha wording can diverge later without touching shared keys — same rationale as `search.card.yogas`/`doshas`.)

### Enum labels — `yogaStrength.*` and `cancellationStatus.*`

| Key | EN | SI |
|-----|----|----|
| `yogaStrength.1` | "Very Strong" | "ඉතා ප්‍රබල" |
| `yogaStrength.2` | "Strong" | "ප්‍රබල" |
| `yogaStrength.3` | "Moderate" | "මධ්‍යම" |
| `yogaStrength.4` | "Weak" | "දුර්වල" |
| `cancellationStatus.1` | "Not cancelled" | "අවලංගු නොවූ" |
| `cancellationStatus.2` | "Cancelled" | "අවලංගු" |
| `cancellationStatus.3` | "Reduced" | "අවම කළ" |

### Provenance — `tradition.*`

| Key | EN | SI |
|-----|----|----|
| `tradition.MAIN_STREAM` | "Mainstream" | "ප්‍රධාන ධාරාව" |

### Seed yoga — `yoga.shaniMangala.*` (EN authoritative from `docs/shani-mangala-yoga.md`; SI pending domain confirmation where marked)

| Key | EN | SI |
|-----|----|----|
| `name` | "Shani–Mangala Yoga" | "ශනි-කුජ යෝග" |
| `rule.sm01` (params `{planet, otherPlanet, sign, house}`) | "{planet} and {otherPlanet} both occupy house {house} of {sign} — the same sign and house (conjunction)." | SI-pending → EN fallback |
| `rule.sm02` (params `{planet, otherPlanet}`) | "{planet} and {otherPlanet} cast their planetary aspects (Graha Drishti) upon each other." | SI-pending → EN fallback |
| `rule.sm03` (params `{planet, otherPlanet}`) | "{planet} and {otherPlanet} occupy opposite houses (7th from each other), mutually influencing each other." | SI-pending → EN fallback |
| `rule.sm04` (params `{planet, otherPlanet}`) | "{planet} and {otherPlanet} are in a 4/10 relationship (4th and 10th from each other) with mutual special aspects." | SI-pending → EN fallback |
| `rule.sm05` (params `{planet, otherPlanet}`) | "{planet} and {otherPlanet} exchange signs (parivartana)." | SI-pending → EN fallback |
| `rule.sm06` (params `{planet, otherPlanet, tradition}`) | "{planet} and {otherPlanet} are in a 2/12 relationship (2nd and 12th from each other), recognized by the {tradition} tradition." | SI-pending → EN fallback |
| `theme.house4.domesticTension` | "Tendency toward tension in the home environment." | SI-pending → EN fallback |
| `theme.house4.propertyFriction` | "Possible friction around property matters." | SI-pending → EN fallback |
| `theme.house4.restlessnessAtHome` | "Restlessness at home is a tendency." | SI-pending → EN fallback |
| `theme.house4.motherHomePressure` | "Pressure relating to mother, home or property may surface." | SI-pending → EN fallback |
| `theme.house4.constructionDrive` | "A drive toward construction, engineering or property work." | SI-pending → EN fallback |
| `theme.house7.relationshipConflict` | "Tendency toward friction in close relationships." | SI-pending → EN fallback |
| `theme.house7.impatienceInPartnership` | "Impatience may surface in partnerships." | SI-pending → EN fallback |
| `theme.house7.delayedMarriage` | "Tendency toward delayed marriage." | SI-pending → EN fallback |
| `theme.house7.arguments` | "Arguments may flare under pressure." | SI-pending → EN fallback |
| `theme.house7.dominanceControl` | "Dominance-or-control patterns may emerge in partnerships." | SI-pending → EN fallback |
| `theme.house7.partnerFrustration` | "Frustration between partners is a tendency." | SI-pending → EN fallback |
| `theme.house8.suddenObstacles` | "Sudden obstacles may interrupt progress." | SI-pending → EN fallback |
| `theme.house8.intenseTransformation` | "Intense transformation is a tendency." | SI-pending → EN fallback |
| `theme.house8.inheritanceSharedResources` | "Shared resources and inheritance themes may be marked." | SI-pending → EN fallback |
| `theme.house8.psychologicalPressure` | "Psychological pressure may build during difficult periods." | SI-pending → EN fallback |
| `theme.house8.prolongedStruggles` | "Prolonged struggles may require endurance." | SI-pending → EN fallback |
| `theme.house10.careerPressure` | "Career pressure tends to build under this combination." | SI-pending → EN fallback |
| `theme.house10.authorityConflict` | "Tendency toward conflict with authority figures." | SI-pending → EN fallback |
| `theme.house10.difficultConditions` | "Difficult working conditions call for stamina." | SI-pending → EN fallback |
| `theme.house10.highEndurance` | "High endurance under pressure." | SI-pending → EN fallback |
| `theme.house10.competitiveCareer` | "A competitive career path is indicated as a tendency." | SI-pending → EN fallback |
| `theme.house10.workUnderPressure` | "Ability to work under pressure strengthens." | SI-pending → EN fallback |
| `expression.disciplinedAction` | "Expresses as disciplined, persistent action." | SI-pending → EN fallback |
| `expression.blockedAction` | "Action may at times feel blocked or frustrated." | SI-pending → EN fallback |
| `expression.frustration` | "Frustration may build when results are delayed." | SI-pending → EN fallback |
| `expression.persistence` | "Persistence through obstacles is the characteristic expression." | SI-pending → EN fallback |
| `expression.conflictUrgencyDelay` | "A push-pull between urgency and delay may mark the expression." | SI-pending → EN fallback |
| `expression.pushThroughObstacles` | "Mars may push through obstacles despite Saturn's restraint." | SI-pending → EN fallback |
| `mitigation.factor.jupiterAspect` (params `{target}`) | "Jupiter aspects {target}" | SI-pending → EN fallback |
| `mitigation.factor.ownSign` (params `{planet}`) | "{planet} in its own sign" | SI-pending → EN fallback |
| `mitigation.factor.beneficAspect` (params `{planet}`) | "Benefic aspect from {planet}" | SI-pending → EN fallback |
| `mitigation.effect.reducesSeverity` | "Reduces severity" | SI-pending → EN fallback |
| `mitigation.effect.changesExpression` | "Changes the expression" | SI-pending → EN fallback |
| `dashaNote` (params `{planets}`) | "May become active during {planets} dasha periods." | SI-pending → EN fallback |

### Seed dosha — `dosha.manglik.*` (registered `pending-domain`; keys ship for both locales per US-YD-012 so the entry is render-ready once confirmed)

| Key | EN | SI |
|-----|----|----|
| `name` | "Manglik (Kuja) Dosha" | "මංගල දෝෂය" |
| `rule.mk01` (params `{planet, house}`) | "Mars ({planet}) is in house {house} — one of the Manglik houses (1, 4, 7, 8, 12)." | SI-pending → EN fallback |
| `theme.house7.partnershipTension` | "Tendency toward tension in marriage or partnerships." | SI-pending → EN fallback |
| `expression.partnershipStress` | "May express as stress in close partnerships." | SI-pending → EN fallback |

**Confidence levels** for `panel.confidence`: `yogaDosha.confidence.1 = "Low" | "අඩු"`, `.2 = "Medium" | "මධ්‍යම"`, `.3 = "High" | "ඉහළ"` (or map to a shared existing key if one exists — Developer check).

---

## Traceability

| User story | Covered by |
|------------|-----------|
| US-YD-008 — separated Yoga/Dosha tag groups on the single horoscope view | Q1 (mount point), Wireframes, `YogaDoshaSection`/`YogaTagGroup`/`DoshaTagGroup` |
| US-YD-008 — tag states (present/cancelled), only present entries tag, empty states | Q3, Q4, `YogaDoshaTag` |
| US-YD-008 — read-only on own/public/share | Flow 5 |
| US-YD-009 — yoga detail panel: name, reason, result, cancellation | Q2 (blocks 0–4), Flow 2, `YogaDoshaDetailPanel` |
| US-YD-009 — tendency wording, numerics per locale, open/close | Q2, Accessibility, i18n |
| US-YD-010 — dosha detail panel (severity, affected houses, cancellation/mitigation) | Q2 (shared anatomy), `YogaStrengthPill`, `dosha.*` keys |
| US-YD-012 — bilingual UI, message-key parity, no hardcoded strings | i18n section, enum-label reuse |
| US-YD-011 — search compatibility (this phase: cards unchanged, catalog-name reads) | Q6 |
| US-YD-001 — unregistered-ID fallback | Q3 (unknown state) |

---

## Out of Scope

- **Search result card restyle** to the separated treatment — deferred (US-YD-011 compatibility phase only; BA Open Question 12 → PM).
- **New astrological content** — this spec is the render/interaction treatment of the Architect's stored `YogaEvaluation`/`DoshaEvaluation` contract; rule engines, catalog rows and themes are BA/Architect/domain territory.
- **Functional benefic/malefic status, Navamsha rules, deterministic predictions** — all follow the BA/Architecture phase-1 scoping.
- **Any editing/overrides** — read-only everywhere.
- **Detail-page layout redesign** beyond the new section card.

---

## Files Created / Updated

**Created:**
- `specs/ux/20260906-0945-yoga-dosha-tags.md` — this document.

**Updated (main UX spec):**
- `specs/ux/main-ux-spec.md` — revision note on the "Last Updated" line (2026-09-06 rev, previous rev preserved), new `> **Yoga/Dosha Tags UX:**` dedicated-spec blockquote, new Interaction Patterns entry "Yoga & Dosha Tag Groups (යෝග සහ දෝෂ)", File Index row.

**Not yet touched (awaiting Developer/QA):**
- `src/components/yogaDosha/YogaDoshaSection.tsx` (component seam per Architect) + `YogaTagGroup`/`DoshaTagGroup`/`YogaDoshaTag`/`YogaDoshaDetailPanel` + the five panel blocks + `YogaStrengthPill`/`StateBadge`.
- `src/app/horoscopes/[id]/page.tsx` — add the `yoga-doshas` tab (label key `horoscope.yogaDoshas`, between `dashas` and `metadata` in the `tabs` array) and render the section card from `{activeTab === "yoga-doshas" && calculatedDetails && (…)` (rev 2; rev 1 embedded it in the Calculations tab — superseded).
- `src/messages/en.json` / `src/messages/si.json` — the six new namespaces above.
- Search card name reads (catalog-resolved, legacy fallback) per Architect/US-YD-011.

---

## QUESTION FOR <role> — items to verify

### For BA
1. Legacy conflict on my Q4 decision: US-YD-009's edge case says "no themes for the affected house → the result section shows the formation reason only". I implement "**omit the empty Result block**" (the formation reason above already answers it; no empty heading). Confirm the omission reading is acceptable.
2. The `(n)` count: does it count **all present entries including cancelled ones** (my assumption), or only active (non-cancelled)? I assumed all rendered tags (cancelled included) — visible count = number of tags.
3. Label semantics of `yogaStrength.*` on the tag pill: I show **final-assessment severity** (`finalAssessment.severity`) on both yoga and dosha tags (one consistent field). The panel shows formation strength only via the primary-rule sentence. Confirm final-severity-on-tag is the desired signal (vs formation strength).
4. `dosha.panel.expression` — dosha entries carry `finalAssessment.expressionKeys` in the symmetric shape; confirm the Expression block is wanted for doshas in phase 1 (it is implied by symmetry; harmless if empty).

### For Architect
5. **Theme→house grouping contract**: my Result block groups `interpretation.themes[]` by parsing the `house{n}` segment out of each theme key convention (`yoga.<id>.theme.house{n}.<slug>`). Confirm this key convention is a **catalog invariant** (enforced by the catalog-integrity test you spec'd), or provide the house mapping in a machine-read form.
6. **Dasha note params**: `dashaActivation.planets` is `Planet[]`; my `dashaNote` message interpolates `{planets}` — confirm the renderer gets the localized planet-name list as a single comma-joined param rather than per-planet placeholders.
7. Mitigation `factor`/`effect` strings are catalog-fixed strings (`JUPITER_ASPECT`, `REDUCES_SEVERITY`); I map them to `yoga.shaniMangala.mitigation.factor.{camelCase}` keys per seed. Confirm a **generic** `yogaDosha.mitigation.factor.*` map is not needed for phase 1 (all factors are seed-catalog-owned), or confirm the generic fallback expectation for unknown factors (my current fallback: raw string).
8. Unknown catalog IDs at render (`resolveYogas` normalization) — confirm the render contract passes the raw `id` through for the "Not available" chip rather than dropping the entry.

### For QA
9. Verify the tag state matrix on one chart: present / cancelled / mitigated / unknown chips render correctly in both locales, `aria-expanded` toggling, multi-open panel behavior, focus retention, legacy-recompute equivalence, and the "no empty Result heading" edge.
10. Verify Sinhala wrapping at 360px viewport: group label chip + up to 4 wrapped tags + badges never overflow the card; 44px tap targets.
11. Verify the catalog-integrity check that every `yoga.*`/`dosha.*` key used by the renderer resolves in both `en.json` and `si.json` (supports my SI-pending → EN fallback markers).
12. Verify screen-reader output of a cancelled tag: label contains the word "cancelled", the strike-through is not announced as an unreadable artifact, and the panel region is reachable right after its button.

### For Developer
13. Disclosure animation: I allow either the `grid-template-rows 0fr→1fr` technique or a measured `max-height` transition — pick the one that does not break `role="region"` visibility semantics; `hidden` must be applied when closed.
14. Implement the house-ordinal helper for `{house} වන භාවය` / `house {house}`; do not build a house-name enum — reuse the numeric formatting convention.
15. Keep the new message namespaces top-level (`yogaDosha`, `yoga`, `dosha`, `yogaStrength`, `cancellationStatus`, `tradition`) so search vocabulary/grammar can reuse `yogaStrength.*` labels for the specific-name query work later.

### For PM
16. **Resolved (2026-09-06):** search result cards keep the existing combined "Yogas"/"Doshas" sections this phase; the separated tag treatment is detail-view only. BA Open Question 12 (whether to restyle cards later) needs a phase decision.
17. The Manglik dosha seed is `pending-domain` — the Dosha group will legitimately render "දෝෂ නොමැත / No doshas" (while the Yoga group is populated) until domain confirms MK-01's rules. Confirm that "empty dosha group" is an acceptable launch state.