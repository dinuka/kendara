# Architecture Overview

## High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Layer                              │
│  ┌─────────────────────┐  ┌──────────────────────────────┐  │
│  │   Next.js Frontend  │  │   PDF/Image Export Client    │  │
│  │  (React, Tailwind)  │  │   (html2canvas, jsPDF)       │  │
│  └──────────┬──────────┘  └──────────────────────────────┘  │
└─────────────┼────────────────────────────────────────────────┘
               │ HTTPS / WebSocket
┌─────────────┼────────────────────────────────────────────────┐
│             │            API Gateway Layer                    │
│  ┌──────────┴──────────┐                                     │
│  │   Next.js API Routes│                                     │
│  │   (REST + GraphQL)  │                                     │
│  └──────────┬──────────┘                                     │
└─────────────┼────────────────────────────────────────────────┘
               │
┌─────────────┼────────────────────────────────────────────────┐
│             │            Service Layer                        │
│  ┌──────────┴──────────┐  ┌──────────────────────────────┐  │
│  │  Auth Service       │  │  Horoscope Calculation       │  │
│  │  (Google SSO, JWT)  │  │  Engine (Offline Library)    │  │
│  └─────────────────────┘  └──────────┬───────────────────┘  │
│  ┌─────────────────────┐  ┌──────────┴───────────────────┐  │
│  │  Chart Generator    │  │  RAG Search Engine           │  │
│  │  (SVG/Canvas)       │  │  (Embedding + LLM)           │  │
│  └─────────────────────┘  └──────────┬───────────────────┘  │
│  ┌─────────────────────┐  ┌──────────┴───────────────────┐  │
│  │  Metadata Service   │  │  Share/Export Service        │  │
│  └─────────────────────┘  └──────────────────────────────┘  │
│  ┌─────────────────────┐                                     │
│  │  Location Service   │                                     │
│  │  (Geocoding, CRUD,  │                                     │
│  │   CSV Parsing)      │                                     │
│  └─────────────────────┘                                     │
│  ┌─────────────────────┐                                     │
│  │  Dasha Calculation  │                                     │
│  │  Engine             │                                     │
│  └─────────────────────┘                                     │
│  ┌─────────────────────┐                                     │
│  │  Current Planet     │                                     │
│  │  Calculation Engine │                                     │
│  └─────────────────────┘                                     │
│  ┌─────────────────────┐                                     │
│  │  Manual Chart       │                                     │
│  │  Derivation Engine  │                                     │
│  │  (pure, no ephemeris)│                                     │
│  └─────────────────────┘                                     │
└─────────────┼────────────────────────────────────────────────┘
              │
┌─────────────┼────────────────────────────────────────────────┐
│             │            Data Layer                           │
│  ┌──────────┴──────────┐  ┌──────────────────────────────┐  │
│  │  MongoDB            │  │  Vector DB (Qdrant)          │  │
│  │  (Document Store)   │  │  (Embeddings)                │  │
│  └─────────────────────┘  └──────────────────────────────┘  │
│  ┌─────────────────────┐                                     │
│  │  MinIO/S3           │                                     │
│  │  (Chart Images,     │                                     │
│  │   Exports)          │                                     │
│  └─────────────────────┘                                     │
└──────────────────────────────────────────────────────────────┘
```

## Technology Stack

| Layer | Technology | Justification |
|-------|-----------|---------------|
| Frontend | Next.js, React, Tailwind CSS | Full-stack framework, SSR, i18n support |
| Backend | Next.js API Routes (REST) | Server-side logic, MongoDB access, calculation orchestration |
| Auth | NextAuth.js | Google SSO provider, JWT session management |
| Astrology Calc | jyotish-calculations + swisseph | Vedic astrology library built on Swiss Ephemeris — Nakshatra, Graha, Rashi, Bhava, Dasha calculations |
| Chart Rendering | D3.js / SVG | Client-side chart generation without external APIs |
| Database | MongoDB | Document store — flexible schema for calculated horoscope JSON data |
| Vector DB | Qdrant | Dedicated vector DB for horoscope embeddings (HNSW index) |
| RAG Pipeline | Gemini API + Transformers.js + Qdrant JS client | Free online LLM (Gemini API) for query parsing, Transformers.js for local embeddings, Qdrant JS client for vector search |
| Object Storage | MinIO / S3-compatible | Chart images, PDF exports |
| i18n | next-intl | Sinhala/English bilingual support with ICU message format |
| PDF Export | jsPDF + html2canvas | Client-side PDF/image generation |
| Geocoding | Nominatim (OpenStreetMap) | Free geocoding API for location name → Lat/Lon suggestions — no API key required |

## Key Architecture Decisions

### 1. Offline-First Astrology Calculations

- All ephemeris and astrological calculations run locally using **jyotish-calculations** (built on Swiss Ephemeris via swisseph)
- No external astrology API calls — ensures privacy, zero cost, offline capability
- Calculations run on the server during horoscope creation (Node.js/Next.js API routes)
- Embedding generation for RAG search runs asynchronously as a background job — horoscope creation returns immediately, embedding is queued and processed offline

### 2. RAG-Based Search Pipeline

- Horoscope data is converted to text descriptions and embedded as vectors using **Transformers.js** (@xenova/transformers) — runs locally in Node.js
- Embeddings are generated per language (Sinhala AND English), stored as separate SearchEmbedding records with `language` and `embeddingModel` fields
- Search queries are parsed by a free online LLM (**Gemini API** — generous free tier, strong Sinhala support) into structured astrological conditions
- Embeddings stored and searched in **Qdrant** via its JS client library with HNSW index
- Hybrid approach: Qdrant vector similarity + MongoDB structured filter for precise astrological conditions
- Graceful degradation chain: Gemini API → keyword parsing → MongoDB-only search if Qdrant is unreachable
- Embedding generation runs asynchronously via background job queue (in-process microtask for MVP, BullMQ for production)
- Search results are full-detail horoscope cards (not summaries) — all data pre-calculated and returned in search response
- Configurable results display: user can toggle individual sections (charts, calculations, strengths) on/off per result card, persisted in SavedFilter

### 3. Bilingual Support (Sinhala/English)

- Astrological terms stored as numeric enums — display names mapped per language
- UI text via next-intl with ICU message format
- Search queries handled in both languages via the RAG pipeline

### 4. Current Planets Computed in Real-Time (Not Stored)

- Current planetary positions are computed on-the-fly from Swiss Ephemeris at API request time — never stored in MongoDB
- The calculation uses the server's current system date/time, not a stored timestamp
- Only birth chart data (planetary positions at time of birth) is persisted in calculatedDetails
- Results are ephemeral overlay data returned alongside the chart response and discarded after serving
- This avoids stale transit data and eliminates the need for a background refresh job

### 5. Manual Chart Derivation (Calculated Horoscopes)

- Students can enter already-calculated horoscopes without birth details via a "Calculated Chart" mode
- The house placements (lagna + planets-per-house) are the single source of truth; all tables (houses, planets table, navamsa, validation, derived birth ranges) are recomputed from it by pure functions in `src/lib/manualChart.ts`
- The derivation is fully deterministic (whole-sign, mod-12 arithmetic, config-table lookups) — **no ephemeris, no I/O** — so the same shared module runs client-side for instant preview and server-side for persistence with zero logic drift
- Horoscopes are flagged `source: "manual"` (vs `"auto"` for ephemeris-calculated); manual horoscopes reuse the existing privacy/search/share features and show "not available" empty states for ephemeris-dependent data (dashas, varga charts)
- Full spec: `specs/architecture/20260805-1514-calculated-horoscope.md`

### 6. Per-User Planet Aspects (දෘෂ්ඨි) Setting

- A per-user setting **"Planets Aspects houses and degrees"** lets each student configure, per planet, which **houses** the planet aspects (integers 1–12) and which **degree** angles are aspect candidates (multiples of 30 in 30–330) — the degree angles drive both planet-to-planet matching and degree-based house-aspect matching.
- Stored on the `User` document as `planetAspects` (`Record<string, { houses: number[], degrees: number[] }>` keyed by numeric Planet enum string), mirroring the existing `planetaryOrbs` per-user settings pattern and managed via `GET`/`PUT /api/settings`.
- Aspect calculation is driven by the setting: **`degrees` and `houses` jointly drive house aspects** and `degrees` (plus conjunction `0`) drive planet-to-planet aspects. House aspects on auto charts are **degree-based** — each planet's aspect points (`absoluteDegree ± d` for each configured/default `d`, wrapped to 360°) are matched against each house's absolute middle degree `(middleSign − 1) * 30 + middleDegree` within the aspecting planet's orb — **unioned** with the explicitly configured `houses` list (houses directly aspected). For unconfigured planets, default degrees `[60, 90, 120, 180]` are matched against house middles with default orbs and the **default aspect houses** apply as offsets from the planet's house — SUN/MOON/SATURN 3,5,7,9,10; MARS/MERCURY 4,5,7,8,9; JUPITER/VENUS/RAHU/KETU 5,7,9 (the new authoritative Default Aspect Houses table, replacing the old Mars 4/8/12 / Jupiter 5/9/11 / Saturn 3/7/10 / Rahu-Ketu 5/9 / others-7th table; see full spec §6.1) — so behavior is sensible and unchanged-in-spirit until a student customizes. The orb tolerance is the aspecting planet's `planetaryOrbs` value (replacing the former fixed `degreeGap < 30`); there is no `degree ÷ 30` → house mapping.
- The logic lives in a new pure shared module `src/lib/planetAspects.ts` (defaults, validation, `computePlanetAspects`, `computeHouseAspects*`), consumed by the auto calculation engine (`src/lib/calculation.ts`), the manual chart derivation (`src/lib/manualChart.ts`), the settings API, and the owner's view-time aspect re-derivation.
- Aspects are **data-only**: chart SVG art (positional) is unaffected; rendered charts regenerate only when a horoscope is recalculated.
- Shared/public horoscope aspects are **computed once from the owner's setting at calculation time** and stored in `CalculatedDetails` — other viewers see the stored snapshot. The owner's own detail view re-derives aspects purely from stored degrees/houses (no ephemeris) so a setting change is reflected on next refresh without a migration/backfill.
- Auto charts gain a new house-aspect output: `calculatedDetails.houses[].aspectingPlanets` (which planets aspect each house), computed degree-based as the union of each planet's explicitly configured `houses` and its aspect points matched against the house's absolute middle degree within the planet's orb — mirroring the manual chart's per-house `aspects` list. Per the 2026-08-11 clarification, **both aspect mechanisms apply to both chart sources**: manual charts run the same union (explicit `houses` arm ∪ degree arm, plus Rashi Aspects when enabled) fed by each planet's stored or fallback-derived degree (`ManualHousePlacements.planetDegrees`, else navamsa segment midpoint / sign midpoint 15°), with the house's whole-sign sign midpoint `(sign−1)*30+15` as the manual house-middle reference.
- Full spec: `specs/architecture/20260809-2145-planet-aspects.md`

### 7. Shad Bala (ෂඩ් බලය) — Six-Strengths Table

- A per-planet ෂඩ් බලය table in the calculations tab: 8 columns (ග්රහයා, ස්ථාන බල, චේෂ්ටා බලය, කාල බලය, දිග් බලය, දෘෂ්ඨි බලය, නෛසර්ගික බලය, අනුපාතය), 9 rows, with checkbox toggles and reason tooltips per bala.
- Each bala is a Boolean computed from stored chart data (`planets` + `houses`) by a pure shared module `src/lib/shadBalaya.ts` (`computeShadBalaya(planets, houses, ctx)`) — no ephemeris, no I/O — so the same module runs server-side at calculation time and client-side for legacy-document lazy recompute. Results are stored on `CalculatedDetails.shadbalaya` (keyed by numeric Planet enum string `"1"`…`"9"`); the ratio `(n/6)` is derived at render time, never stored.
- Rules: Sthana = checked unless Neecha AND enemy-sign together; Cheshta = Uttarayana (sign-based for both sources), Shukla paksha Moon, same-sign Shukla-Chandra conjunction, Vakra, planet-war (deferred); Kala = day/night (Sun-in-houses-7-12 rule), paksha conditions, varga loads (deferred); Dig = 1st/10th/4th/7th directional houses (Rahu/Ketu never); Naisargika = present unless Maranakaraka; Drishti = manual only.
- Students may toggle any bala; toggles persist with `overridden: true` and are **preserved across the AstrologySettings full recalculation** (`mergeShadBalaya(computed, stored)` keeps `overridden: true` entries, recomputes the rest — mirroring `manualHousePlacements`).
- Toggles write via `PATCH /api/horoscope/:id/shadbalaya` (owner or super-admin; 403 otherwise; 401 unauthenticated) with a client-side 500 ms debounce, last-write-wins, optimistic UI, and rollback toast on failure. Non-owner/share-link views render read-only.
- Tooltips reuse the AspectChip/AspectTooltip pattern and are composed from i18n keys + numeric enum params (never stored localized text), resolved per locale in `si`/`en`.
- Full spec: `specs/architecture/20260813-2011-shadbalaya-architecture.md`

### 8. Bhava Suchika (භාව සුචික) — Navamsa House Index

- භාව සුචික නවාංශක ක්‍රමය: the "house index" of a point (the Lagna or a planet) — take the point's Navamsa (D9) sign and find which house that sign occupies in the Lagna (D1) chart; that house number (1-12) is the point's Bhava Suchika. Equivalently `((navamsaSign − lagnaSign) mod 12) + 1`, using **whole-sign** house assignment (`houses[].sign` is whole-sign by construction in `src/lib/calculation.ts` — cusp midpoints are never used for sign/house-of-sign mapping).
- Computed by a new pure shared module `src/lib/bhavaSuchika.ts` (no ephemeris, no I/O — same contract as `src/lib/shadBalaya.ts`): `computeNavamsaLagnaSign`, `computeLagnaBhavaSuchika`, `computePlanetBhavaSuchika`, `computeBhavaSuchika`. Consumed by the auto engine (`calculateHoroscope`), the manual synthesizer (`synthesizeCalculation` in `src/lib/manualChartDetails.ts`), the render-time legacy fallback, and the AstrologySettings recalculation job.
- Persisted on `CalculatedDetails` as `lagnaBhavaSuchika` (Integer 1-12) + `bhavaSuchika` (Record keyed by numeric Planet enum string `"1"`…`"9"`) for both `source: "auto"` and `source: "manual"` horoscopes — **manual only when Navamsa data has been entered** (`navamsaLagna` / `navamsaHouses`). Persistence is automatic via the `...calculated` spread (`POST /api/horoscope`), since `ICalculatedDetails extends CalculationResult`.
- **Auto D9 lagna sign** is derived inline from the stored ascendant (`navamsaSign(ascSign, Math.floor(ascDegree / (30/9)) + 1)` — the same expression used by the existing ascendant Navamsa computations) and is **never read from the `navamsa-d9` Chart document** (Chart data is a rendering blob, not a calculation input).
- **Display-only** — no overrides, no mutation endpoint (unlike Shad Bala checkboxes). Rendered in the Lagna section alongside Wargoththama/Gandamula and as a new column in the planets table of the calculation tab; the 12 names resolve per locale via i18n (`astrology.bhavaSuchika.names.1..12` — Sinhala authoritative, English transliterations pending domain confirmation).
- **Recalculation:** recomputed by the AstrologySettings full recalculation job with no `overridden` state to preserve (pure derived value). **Legacy documents** render via a pure render-time fallback mirroring `computeAscendantSpecialFlags` — no migration/backfill required.
- **No API route changes** — existing responses grow additively. **Search integration:** Bhava Suchika is searchable in `/api/search` (Lagna + per-planet, by house-index name or number, bilingual — new exact conditions `bhava_suchika` / `planet_bhava_suchika` + keyword intents), included in the search text content (`src/lib/search/textContent.ts`, SI + EN, for the vector leg), and **mirrored on search result cards** (`src/app/search/page.tsx` — Lagna tag + per-planet values, same format as the calculation tab) per US-BS-008.
- Full spec: `specs/architecture/20260814-2127-bhava-suchika-architecture.md`

### 9. Warga Kendara (වර්ග කේනදර) — Divisional Chart Tabs & Per-Chart Tables

- The horoscope detail page's **charts tab** replaces the fixed "Birth & Navamsa" pair with a warga tab strip (phase 1: Rāśi D1, Navāṁśa D9, Surya Lagna, Chandra Lagna). **D1 is always selected** (cannot be deselected), **D9 is the default second chart**, and selecting any other tab swaps the second chart — exactly two charts are displayed at once. Selection state is client-side only in phase 1 (no persistence).
- Each displayed chart figure renders its **main indication as tag chips** directly beneath the caption, sourced from a static 16-varga catalog (`VARGA_CATALOG` in `src/lib/wargaKendara.ts` + i18n keys, comma-split into chips) — never stored per horoscope, never user-editable. Phase 1 renders tags for D1, D9, Surya Lagna and Chandra Lagna only; **D2–D60 are omitted entirely** (no reference table, no tabs — product decision 2026-08-15; the `ChartType` enum is deliberately NOT extended until phase 2, since adding values now would ripple into `ALL_CHART_TYPES`, search text content and chart rendering).
- The **"Other charts" section is reduced to the House chart only** (HouseChart + current-planet overlay unchanged); Surya/Chandra move to the tabs; Drekkana/Dasamsa/Shodasha Vargas are omitted entirely in phase 1.
- **Per-chart Houses (#, Sign, Planets, Aspects) and Planets (Planet, Sign, Str, House, Conjunctions, Aspects, Other) tables** render beneath each displayed chart figure, showing that chart's own data (e.g. D1 Saturn = Capricorn | Own Sign vs D9 Saturn = Cancer | Enemy). Nakshatra (Pada) and Bhava Suchika columns exist **only on the D1 table** (Bhava Suchika reads the existing top-level `lagnaBhavaSuchika`/`bhavaSuchika` fields — not duplicated); Conjunctions/Aspects render **without degree differences**. The D1 `Other` cell shows the twelve D1-only details (Wargoththama, Pushkara, Gandantha, Gandamula, 64th Navamsa Lord, 22nd Drekkana Lord, Cheshta Bala, Ashtamansha, Kala Bala, Atmakaraka, Combust, Badhaka); every chart's `Other` cell shows Maraka, Maranakaraka and Dig Bala computed against that chart's own lagna/houses (per-chart rule = existing rule re-evaluated per chart — marked assumption pending domain confirmation).
- All per-chart data is **pure derived data** computed by a new shared module `src/lib/wargaKendara.ts` (no ephemeris, no I/O — same contract as `shadBalaya.ts`/`bhavaSuchika.ts`): D1 from the stored houses/planets; D9 from the navamsa-sign derivation (the page's existing `getNavamsaChartData` logic, moved into the module); Surya/Chandra from the existing `getChartData` rotate-to-lagna (`chartDataTransform.ts` — **no new Chart documents**). Conjunctions = same whole-sign chart house; Aspects = the existing whole-sign diff/special-aspect rule evaluated within the chart (assumption pending Open Question 6). Maraka = `computeWargaMaraka(ascSign)` (chart's 2nd/7th lords); Maranakaraka = the existing `computeMaranakaraka` called with the chart's own planets/houses; Dig Bala = new exported `computeDigBalaPlanets` in `shadBalaya.ts` reusing the existing `DIG_HOUSE` map (Rahu/Ketu never).
- **Persisted** on `CalculatedDetails.wargaKendara` (`Schema.Types.Mixed`, keyed `d1`/`d9`/`suryaLagna`/`chandraLagna`; `null` entry = not derivable, e.g. manual without Navamsa data) for both `source: "auto"` (computed inside `calculateHoroscope`) and `source: "manual"` (computed inside `synthesizeCalculation`; `manualHousePlacements` remains the single source of truth). Persistence rides the existing `...calculated`/`...synth` spread (`ICalculatedDetails extends CalculationResult` — Bhava Suchika precedent). **No user overrides exist** (unlike Shad Bala), so the AstrologySettings full recalculation job needs **no changes** — `wargaKendara` recomputes automatically with the spread. **Legacy documents** fall back to a render-time pure-function derivation via `resolveWargaKendara` (stored-first, warn+fallback on corrupt values — mirroring `resolveLagnaBhavaSuchika`).
- **Read-only on all views** (own/public/share-link) — no new endpoints, no mutation, no permission changes. The existing `GET /api/horoscope/:id` and `GET /api/share/:token` payloads grow additively (`calculatedDetails.wargaKendara`). Manual horoscopes without entered Navamsa data show the existing "no chart data" placeholder for D9. Search integration and the calculations tab are explicitly **out of scope** and unchanged.
- Full spec: `specs/architecture/20260815-1145-warga-kendara-architecture.md`

### 10. Student Notepad (ශිෂ්ය සටහන් පොත) — Per-Horoscope Private Observation Workspace

- The notepad is a movable/resizable **non-modal popup** on the horoscope detail page. **13 parent tags** (12 house purposes + "Other", numeric `0` = Other / `1`-`12` = house number — the house number is the value, no separate enum) form a single-select radio strip; selecting a parent reveals its **sub-tags** (house significations) from a static house-purpose catalog.
- **System observations are derived, never stored**: selecting a sub-tag derives the six observation groups (planets in the house; house load + position + Nakshatra load + position; sub-tag planet significations; Chandra Lagna related house; Surya Lagna related house; related Warga Kendara) at render time via a new pure module `src/lib/notepadObservations.ts` over the already-shipped `CalculatedDetails` payload (including `wargaKendara`) — the `currentPlanets`/`wargaKendara`-fallback precedent. No per-request API call, no loading spinner. Colors (green = good / red = bad / white = neutral) and `(n/m)` ratios are render-time derivations with a **pluggable classifier** (default: planet `PlanetaryStrength` sign — positive green, negative red, Sama 0 white). The domain-pending "house load" / "Nakshatra load" definitions render neutral placeholder tags until confirmed — **no new `CalculatedDetails` fields in phase 1** (BA Open Questions 1–2).
- The static **house-purpose catalog** (13 parent tags, Sanskrit names, significations → sub-tags) and **planet-signification catalog** (feeding the reverse sub-tag → planet mapping) live in `src/lib/notepadCatalogs.ts`, resolved via i18n (`notepad.*` keys in `si`/`en`) — never stored per horoscope, never user-editable (Varga Chart Catalog precedent). Sub-tag identity is the stable catalog **key**, never the localized display text.
- **Student-entered data lives on a new `HoroscopeNote` Mongoose model** (`src/models/HoroscopeNote.ts`) — one document per (student, horoscope), unique compound index `{ "user.id": 1, "horoscope.id": 1 }` (SearchBookmark precedent). Stores `notepadState` (popup geometry + optional last selection), `observationTags` (student tags with numeric `TagColor` enum), `resultNotes`. Lazy creation on first save; GET of a missing note returns empty defaults. **Cascade-deleted with the horoscope** (`HoroscopeNote.deleteMany` added to both horoscope DELETE routes). **Never touched by the AstrologySettings recalculation job** (student data, not derived data — Shad Bala `overridden` precedent in spirit).
- **API**: `GET` / `PUT /api/horoscope/:id/note` — 401 unauthenticated; 404 horoscope missing or not viewable (same check as `GET /api/horoscope/:id`); the note is always the **caller's own** document — **not** horoscope-owner-scoped (unlike the Shad Bala PATCH route: any authenticated student with view access gets their own private notepad). `PUT` is a validated full-document upsert (`$set` per provided field group, no partial save). Client persists with a 500 ms debounce + optimistic UI + `keepalive` flush on unmount (Shad Bala Table pattern).
- **Privacy**: notepad content is never rendered to other students, public viewers or search results (US-SN-014); the note route reuses the detail-page viewability check. Super Admin visibility defaults to strictly private (BA Open Question 9).
- Full spec: `specs/architecture/20260816-1559-student-notes-architecture.md`

### Planet Aspects Setting Flow

```
User → Settings → "Planets Aspects houses and degrees" →
  → Select planet (EN/SI name → Planet enum) → edit houses (1-12) / degrees (30-330 step 30) →
  → PUT /api/settings { planetAspects: { "1": { houses: [3,7,10], degrees: [60,180,240] } } } →
  → Server validates (session → 401; strict payload validation → 400, no partial save) →
  → $set user.planetAspects (omit a key = reset that planet to defaults) →
  → No migration/backfill of existing CalculatedDetails →
  → Next calculations (create / recalc on birth-detail edit / manual-chart save) use the new setting
  → Owner's own horoscope detail view re-derives aspects at view time (pure, no ephemeris)
```

### Toggle Privacy Setting Flow

```
User → Horoscope Detail/Settings Page →
  → Toggle "Public/Private" or "Show/Hide Name" →
  → PATCH /api/horoscope/:id/privacy { isPublic: boolean, displayName?: boolean } →
  → Server validates session (owner check) →
  → Server updates fields in MongoDB →
  → Update takes effect immediately →
  → [If isPublic changed false→true] Queue search embedding generation (async) →
  → [If isPublic changed true→false] Queue search embedding removal (async) →
  → Return updated horoscope →
  → Client updates UI:
    → If isPublic=false: hide from other students' search
    → If displayName=false: show anonymous placeholder in public surfaces
    → Owner always sees name regardless of displayName
    → Share links remain functional through public→private transition
```

Note: Search embedding lifecycle is handled asynchronously so the privacy toggle remains instant. The existing search layer (MongoDB $or filtering with `{ "owner.id": session.user.id }, { isPublic: true }`) already provides correct query-level privacy enforcement — a horoscope made private becomes invisible to other students on the next search query, even before the embedding job completes. The async embedding sync is only needed when the Qdrant vector search pipeline is enabled (see architecture spec on search embedding lifecycle).

### Super Admin Access Flow

```
Super Admin → Admin Dashboard or Admin API →
  → GET /api/admin/horoscope (bypasses isPublic filter) →
  → GET /api/admin/horoscope/:id (returns full name regardless of displayName) →
  → Each admin view of a private horoscope is logged to auditLogs collection →
  → Super Admin CANNOT modify isPublic or displayName (read-only privacy access)
```

## Data Flows

### Add Horoscope Flow

```
User → Open Horoscope Form →
  → Select Location (dropdown of saved locations from DB — public + own private) →
    → If no saved locations, prompt to add one first
    → Can also search geocoding API for new places (creating on the fly)
  → Location fields auto-populated from saved location (lat, lon, name)
  → User can override Lat/Lon values after selection (horoscope-level overrides)
    → Overrides do not modify the saved location
  → Fill remaining birth details →
  → Submit → Server Validates →
  → Calculate Horoscope (jyotish-calculations) →
    → Ascendant, Houses, Planets, Nakshatra, Dashas
    → Advanced: Strengths, Aspects, Lords, Yogas, Doshas
  → Generate Charts (D3.js server-side SVG) →
  → Store in MongoDB (horoscope + calculated details + charts) →
    → horoscope.location = { id: <Location UUID> }
    → horoscope.locationName = saved name (cached)
    → horoscope.latitude / longitude = selected-or-overridden values
  → Queue embedding generation (async background job) →
  → Return to User immediately
  → [Background] Generate embedding text → Store in Qdrant
```

### Manual (Calculated Chart) Horoscope Flow

```
User → Open Horoscope Form → Select "Calculated Chart" mode →
  → Enter name + Lagna →
  → Place planets in derived 12-house table (Navamsa house table optional, entered directly) →
    → Client recomputes houses/aspects/validation/planets table instantly via src/lib/manualChart.ts →
  → View derived birth ranges (time from Ravi's house, month from Ravi's sign,
      date candidates from Ravi's degree/Navamsa, ages from Shani) →
  → Submit → POST /api/horoscope/manual { name, lagna, houses, navamsaHouses } →
  → Server validates + re-derives via same manualChart.ts module →
  → Store Horoscope(source: "manual") + CalculatedDetails(manualHousePlacements, derivedRanges)
      + birth/navamsa Chart records →
  → Return horoscope + derived ranges →
  → Subsequent edits: PUT /api/horoscope/[id]/manual-chart (debounced, owner-only) →
    → Server re-derives and persists → client reconciles
```

### Shad Bala Toggle Flow

```
User → Horoscope Detail → Calculations tab → ෂඩ් බලය table →
  → Computed balas stored on CalculatedDetails.shadbalaya at calculation time
    (auto pipeline / manual synthesizeCalculation via src/lib/shadBalaya.ts)
  → Legacy docs without shadbalaya: recomputed lazily at render from planets + houses,
    persisted on next toggle (no migration/backfill)
  → Student checks/unchecks a bala (optimistic UI + ratio (n/6) updates instantly) →
  → Debounced 500ms PATCH /api/horoscope/:id/shadbalaya { planet, bala, value } →
    → Server validates session (owner or super-admin; 401/403 otherwise) →
    → $set shadbalaya.<planet>.<bala>.value + .overridden=true →
    → Failure → revert checkbox + error toast
  → AstrologySettings full recalculation: mergeShadBalaya(computed, stored) keeps
    overridden:true entries, recomputes the rest → overrides never wiped
  → Non-owners / share links render the table read-only
```

### Student Notepad Observation Flow

```
User → Horoscope Detail page → notepad button → Student Notepad popup (non-modal, draggable, resizable)
  → Page already holds calculatedDetails (existing GET /api/horoscope/:id, incl. wargaKendara)
  → Notepad fetches GET /api/horoscope/:id/note
      → { notepadState: null, observationTags: [], resultNotes: [] } when no document
        (lazy creation on first save; 401 unauthenticated / 404 not viewable)
  → User selects a parent tag (single-select radio, 0-12) → sub-tag chips (static catalog keys)
  → User selects a sub-tag → resolveNotepadObservation(calculatedDetails, parentTag, subTag)
      [pure render-time derivation — no API call, no spinner]
      → six observation sections: planetsInHouse, houseLoad, nakshatraLoad, subTagPlanet,
        chandraLagnaHouse, suryaLagnaHouse, wargaKendara
      → each tag colored green/red/white (default classifier: PlanetaryStrength sign;
        domain-pending loads render neutral) + per-section ratio (n/m) — never stored
  → User adds own tags (TagColor picker) / result notes / moves-resizes popup / changes selection
      → optimistic local state → debounced 500ms PUT /api/horoscope/:id/note
        { notepadState, observationTags, resultNotes } → server validates + upserts caller's doc
      → failure → rollback + localized error toast (Shad Bala Table pattern)
  → Navigate to another horoscope → note refetched for the new (student, horoscope) pair;
    observations re-derive from the new horoscope's calculatedDetails (no cross-horoscope bleed)
  → AstrologySettings full recalculation → recalculateOne recomputes CalculatedDetails only —
    HoroscopeNote is never read or written (student data preserved)
  → Horoscope deletion → both DELETE routes also HoroscopeNote.deleteMany({ "horoscope.id": id })
```

### Search Flow

```
User → Enter Natural Language Query (SI/EN) →
  → RAG Pipeline:
    → Parse query with Gemini API → Extract structured astrological conditions
    → Generate query embedding via Transformers.js
    → Vector similarity search in Qdrant (HNSW index, top-K=100)
    → Structured filter on parsed conditions (MongoDB $match)
    → Filter privacy: $or: [{ "owner.id": session.user.id }, { isPublic: true }]
  → Merge & Rank Results (hybrid score: 0.7 * vectorSimilarity + 0.3 * structuredMatchScore) →
  → Return matching horoscopes with full calculated data (charts, planets, dashas) →
  → Client renders vertical list of full-detail result cards →
    → Each card: Name → Birth Chart (horizontal scroll) → Navamsa → House Chart → Calculations → Dashas
    → Charts displayed inline with horizontal scroll per card
    → Sections togglable via US-009 Config Panel
    → Results paginated (default 5/page, max 20)
    → Collapse/expand per result item
  → User configures visible sections → UI hides/shows sections immediately (no re-fetch)
```

### View Dasha Timeline Flow

```
User → Open Horoscope Detail →
  → Dasha section loads nested JSON from calculatedDetails.dashas →
  → Client determines current date → Matches against period date ranges →
  → Client identifies current MD, AD, Vidasa, Sukshama →
  → Renders nested accordion with active periods auto-expanded →
  → User expands/collapses periods to explore →
  → Smooth animation on toggle
```

### Current Planet Overlay Flow

```
User → Open House Chart View →
  → Toggle "Show Current Planets" ON (or loaded per saved preference) →
  → Client appends ?includeCurrentPlanets=true to GET /api/horoscope/:id/chart/house →
  → Server: getServerSession → connectDB → load birth chart data →
  → Server: Calculate current planet positions (jyotish-calculations + swisseph) →
    → For each of 9 planets (Sun–Ketu):
      → Compute current ecliptic longitude, latitude, speed at server timestamp
      → Determine sign, degree, absolute degree from longitude
      → Map to birth house: find house cusp where current longitude falls
      → Compute nakshatra, pada, retrograde, combustion, strength
    → Apply same ayanamsha as horoscope's birth chart
  → Return chart JSON with { ..., currentPlanets: [...] } appended →
  → Client renders overlay: current planets as Sinhala first-letter symbols with sky-blue border →
  → User toggles OFF → overlay hidden (no re-fetch needed)

  Note: Current planets are computed in real-time per request —
        never stored in the database. Toggling off preserves
        the fetched data in memory for instant re-show.
```

### Authentication Flow

```
User → Click "Login with Google" →
  → Google OAuth → Callback →
  → NextAuth.js handles JWT →
  → Check if existing user → Create if new (auto-assign Student role) →
  → Redirect to dashboard
```

## API Route Design

### Authentication

| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/auth/signin | Google SSO sign-in |
| POST | /api/auth/signout | Sign out |
| GET | /api/auth/session | Get current session |

### Horoscope

| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/horoscope | List user's + public horoscopes |
| POST | /api/horoscope | Create horoscope from birth details (triggers ephemeris calculation) |
| POST | /api/horoscope/manual | Create a manually-entered horoscope from an already-calculated chart — body: `{ name, lagna, houses, navamsaHouses }` (no birth details required) |
| GET | /api/horoscope/:id | Get horoscope with all details |
| PUT | /api/horoscope/:id | Update horoscope |
| DELETE | /api/horoscope/:id | Delete horoscope (own) |
| PATCH | /api/horoscope/:id/privacy | Toggle public/private and/or show/hide name — body: `{ isPublic?: boolean, displayName?: boolean }` |
| PATCH | /api/horoscope/:id/shadbalaya | Toggle a Shad Bala bala — body: `{ planet, bala, value }` (owner or super-admin; stores `overridden: true`; 401/403/404/400 otherwise) |
| GET | /api/horoscope/:id/note | Get the calling student's notepad for the horoscope — returns `{ notepadState, observationTags, resultNotes }` or empty defaults when no document exists (lazy creation on first save; 401 unauthenticated / 404 horoscope missing or not viewable) |
| PUT | /api/horoscope/:id/note | Upsert the calling student's notepad — body: `{ notepadState?, observationTags?, resultNotes? }` (server-validated, at least one group; `$set` per provided group, no partial save; always the caller's own document, never another student's; 401/404/400) |
| PUT | /api/horoscope/:id/manual-chart | Update a manual horoscope's chart — body: `{ lagna, houses, navamsaHouses }` (owner-only; 409 on `source: "auto"`) |
| GET | /api/horoscope/:id/dasha | Get dasha timeline data (returns dashas JSON from CalculatedDetails) — optional standalone endpoint; data also available via GET /api/horoscope/:id |

### Location

| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/location | List locations (public + user's own private), supports pagination |
| POST | /api/location | Create location (name + geocoding suggestion OR CSV Lat/Lon) |
| GET | /api/location/search | Geocoding autocomplete via Nominatim (existing) |
| GET | /api/location/[id] | Get single location |
| PUT | /api/location/[id] | Update location (name, lat, lon, visibility) |
| DELETE | /api/location/[id] | Delete location (own locations only; admin can delete public) |

### Search

| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/search | Search horoscopes (RAG + structured) — returns full-detail result cards |
| GET | /api/search/filter | Get saved filters for user |
| POST | /api/search/filter | Save a filter configuration |
| PUT | /api/search/filter/:id | Update a saved filter name/config |
| DELETE | /api/search/filter/:id | Delete a saved filter |
| GET | /api/search/history | Get search history for current user |
| DELETE | /api/search/history | Clear all search history for current user |
| DELETE | /api/search/history/:id | Delete single search history entry |
| GET | /api/search/bookmark | Get bookmarked horoscopes for current user |
| POST | /api/search/bookmark | Bookmark a horoscope — body: `{ horoscopeId: string, notes?: string }` |
| DELETE | /api/search/bookmark/:horoscopeId | Remove a bookmark |
| PUT | /api/search/bookmark/:horoscopeId | Update bookmark notes |
| GET | /api/search/export | Export current search results as CSV or JSON — query params: `?format=csv|json&query=...&filterConfig=...&page=...` |

### Chart

| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/horoscope/:id/chart | Get all charts for horoscope |
| GET | /api/horoscope/:id/chart/:type | Get specific chart type (supports `?includeCurrentPlanets=true` for house chart overlay) |
| GET | /api/horoscope/:id/export | Export horoscope as PDF |
| GET | /api/horoscope/:id/export/chart/:type | Export chart as image |

### Metadata

| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/horoscope/:id/metadata | Get metadata |
| POST | /api/horoscope/:id/metadata | Add metadata |
| PUT | /api/horoscope/:id/metadata/:metaId | Update metadata |
| DELETE | /api/horoscope/:id/metadata/:metaId | Delete metadata |

### Share

| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/horoscope/:id/share | Generate share link |
| DELETE | /api/horoscope/:id/share/:token | Revoke share link |
| GET | /api/share/:token | Access shared horoscope |

### Admin

| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/admin/horoscope | List all horoscopes |
| PUT | /api/admin/horoscope/:id | Update any horoscope |
| DELETE | /api/admin/horoscope/:id | Delete public horoscope |
| GET | /api/admin/user | List users |
| PATCH | /api/admin/user/:id | Update user role/status |

### Settings

| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/settings | Get current user's settings — returns `{ planetaryOrbs, planetAspects }` (`planetAspects` is the raw stored map; absent planets use defaults) |
| PUT | /api/settings | Update current user's settings — body `{ planetaryOrbs?, planetAspects? }`; validates `planetAspects` strictly (keys `"1"`–`"9"`, houses ints 1–12 unique/non-empty, degrees multiples of 30 in 30–330 unique/non-empty) with no partial save; omit a planet key (or send `{}`) to reset to defaults |

## Database Schema

### MongoDB Collections

**users**

```
{
  id: UUID (string),
  googleId: string (unique),
  email: string,
  name: string,
  role: "student" | "super-admin",
  preferredLanguage: "si" | "en",
  planetaryOrbs: object,        // per-user orb tolerance (Record keyed by Planet enum string); also the orb used for aspect matching
  planetAspects: object,        // per-user "Planets Aspects houses and degrees" setting (Record<string, { houses: number[], degrees: number[] }> keyed by Planet enum string)
  createdAt: Date,
  updatedAt: Date
}
```

**horoscopes**

```
{
  id: UUID (string),
  owner: { id: UUID },
  name: string,
  displayName: boolean,
  birthDate: Date,           // optional when source = "manual"
  birthTime: string,         // optional when source = "manual"
  location: { id: UUID },
  locationName: string,
  latitude: number,
  longitude: number,
  gender: "male" | "female" | "other",
  ayanamsha: "lahiri" | "raman" | "krishnamurti" | "yukteshwar",
  source: "auto" | "manual", // "manual" = entered from an already-calculated chart
  isPublic: boolean,
  createdAt: Date,
  updatedAt: Date
}
```

**calculatedDetails**

```
{
  id: UUID (string),
  horoscope: { id: UUID },
  ascendant: { sign: number, degree: number, lord: number },
  houses: [{ houseNumber, startDegree, middleDegree, endDegree, sign, lord, aspectingPlanets? }],
  planets: [{ name, sign, degree, house, nakshatra, pada, strength, aspects, ... }],
  nakshatra: { moonNakshatra: {}, ascendantNakshatra: {} },
  dashas: {
    mahadasha: [{
      planet: number,
      startDate: string,
      endDate: string,
      durationYears: number,
      remainingYearsAtBirth: number,
      antardasha: [{
        planet: number,
        startDate: string,
        endDate: string,
        durationMonths: number,
        vidasa: [{
          planet: number,
          startDate: string,
          endDate: string,
          durationDays: number,
          sukshama: [{
            planet: number,
            startDate: string,
            endDate: string,
            durationDays: number,
            prana: [{
              planet: number,
              startDate: string,
              endDate: string,
              durationHours: number
            }]
          }]
        }]
      }]
    }],
    currentPeriod: {
      mahadashaLord: number,
      antardashaLord: number,
      vidasaLord?: number,
      sukshamaLord?: number,
      pranaLord?: number
    }
  },
  lord22ndDrekkana: number,
  lord64thNavamsa: number,
  badhakaPlanet: number[],
  marakaPlanets: number[],
  atmakaraka: number,
  yogas: [...],
  doshas: { doshas: [...] },
  manualHousePlacements?: object,   // source="manual": { lagna, houses, navamsaLagna, navamsaHouses?, validation }
  derivedRanges?: object,           // source="manual": { birthTimeRange, birthMonthRange, birthDateCandidates, ageRanges }
  shadbalaya?: object,              // ෂඩ් බලය six-strengths per planet (Record keyed by Planet enum string "1"-"9");
                                    // each bala: { value: boolean, overridden: boolean, reasons: [{ key, params? }] };
                                    // overridden:true entries are preserved across the AstrologySettings recalculation
  lagnaBhavaSuchika?: number,       // භාව සුචික house index (1-12) of the Navamsa Lagna sign in the D1 chart
                                    // (whole-sign); absent on manual horoscopes without entered Navamsa data
  bhavaSuchika?: object,            // per-planet භාව සුචික (Record keyed by Planet enum string "1"-"9",
                                    // values 1-12) — the D1 house of each planet's Navamsa sign
  wargaKendara?: object,            // වර්ග කේනදර per-chart data (Record keyed by warga chart key:
                                    // "d1" | "d9" | "suryaLagna" | "chandraLagna" — phase 1; null entry =
                                    // not derivable). Each entry: { lagnaSign, houses[12], planets[9],
                                    // D1-only flags (d1 only), marakaPlanets, maranakaraka, digBalaPlanets }.
                                    // Pure derived data — recomputed by recalculation, render-time
                                    // fallback for legacy docs, no user overrides
  createdAt: Date
}
```

**charts**

```
{
  id: UUID (string),
  horoscope: { id: UUID },
  type: "birth" | "house" | "navamsa-d9" | "drekkana-d3" | "dasamsa-d10" | "shodasha-vargas" | "chandra-lagna" | "surya-lagna",
  data: object,
  imageKey: string,
  createdAt: Date
}
```

**metadata**

```
{
  id: UUID (string),
  horoscope: { id: UUID },
  key: string,
  value: string,
  isPublic: boolean,
  createdBy: { id: UUID },
  createdAt: Date,
  updatedAt: Date
}
```

**shareLinks**

```
{
  id: UUID (string),
  horoscope: { id: UUID },
  token: string (unique),
  expiresAt: Date,
  createdAt: Date
}
```

**horoscopeNotes**

```
{
  id: UUID (string),
  user: { id: UUID },                // the owning student (caller-scoped — NOT the horoscope owner)
  horoscope: { id: UUID },
  notepadState: object | null,       // popup geometry + optional selection state:
                                     //   { position: { x, y }, size: { width, height },
                                     //     isOpen?, selectedParentTag?, selectedSubTag? }
  observationTags: array,            // student tags:
                                     //   [{ id, parentTag (0-12), subTag|null (catalog key),
                                     //      text, color (TagColor 1-6), createdAt, updatedAt }]
  resultNotes: array,                // [{ id, text, createdAt, updatedAt }] — newest-first at render
  createdAt: Date,
  updatedAt: Date
}
```

**auditLogs**

```
{
  id: UUID (string),
  action: "privacy_change" | "admin_view_private" | "admin_action",
  actor: { id: UUID },          // User who performed the action
  target: { id: UUID, type: "horoscope" | "user" },  // Affected resource
  details: {
    field?: string,              // e.g. "isPublic", "displayName"
    oldValue?: any,
    newValue?: any
  },
  timestamp: Date,
  ip?: string,
  userAgent?: string
}
```

**savedFilters**

```
{
  id: UUID (string),
  user: { id: UUID },
  name: string,                   // User-defined label for the saved search
  query: string,
  filterConfig: object,           // Visible sections configuration
  lastRunAt: Date,                // Last execution timestamp
  resultCount: number,            // Cached result count for display
  createdAt: Date
}
```

**searchEmbeddings**

```
{
  id: UUID (string),
  horoscope: { id: UUID },
  embedding: number[],            // Vector embedding array
  textContent: string,            // Structured text representation for embedding
  language: "si" | "en",          // Bilingual support — separate embeddings per language
  chunkIndex: number,             // For chunked large horoscopes (0-based)
  embeddingModel: string,         // Model version tracking (e.g. "all-MiniLM-L6-v2")
  isActive: boolean,              // Soft-deactivation on privacy change
  createdAt: Date,
  updatedAt: Date
}
```

**searchHistory**

```
{
  id: UUID (string),
  user: { id: UUID },
  query: string,                  // Raw query text
  parsedConditions: object,       // Parsed structured conditions (for debug/improvement)
  resultCount: number,            // Number of results returned
  language: "si" | "en",         // Detected query language
  source: "basic" | "complex",   // Which search mode was used
  createdAt: Date
}
```

**searchBookmarks**

```
{
  id: UUID (string),
  user: { id: UUID },
  horoscope: { id: UUID },
  notes: string,                  // Optional user notes
  queryContext: string,           // Optional query that led to bookmarking
  createdAt: Date
}
```

**locations**

```
{
  id: UUID (string),
  name: string,
  latitude: number,
  longitude: number,
  isPublic: boolean,
  createdBy: { id: UUID },
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes

- users: { googleId: 1 } (unique)
- horoscopes: { "owner.id": 1 }, { isPublic: 1 }, { createdAt: -1 }, { source: 1 }
- calculatedDetails: { "horoscope.id": 1 } (unique)
- charts: { "horoscope.id": 1 }
- metadata: { "horoscope.id": 1 }, { key: 1 }
- shareLinks: { token: 1 } (unique)
- locations: { "createdBy.id": 1 }, { isPublic: 1 }, { name: "text" }
- calculatedDetails: { "dashas.currentPeriod.mahadashaLord": 1 } (for querying by current dasha lord)
- auditLogs: { timestamp: -1 }, { "actor.id": 1 }, { action: 1 }
- horoscopes: { "owner.id": 1, isPublic: 1, displayName: 1 } (compound index for search filtering)
- savedFilters: { "user.id": 1, lastRunAt: -1 } (for listing user's saved searches by recency)
- searchHistory: { "user.id": 1, createdAt: -1 } (for fetching recent query history)
- searchHistory: { "user.id": 1, query: 1, createdAt: -1 } (for dedup consecutive same queries)
- searchBookmarks: { "user.id": 1, createdAt: -1 } (for listing user's bookmarks)
- searchBookmarks: { "user.id": 1, "horoscope.id": 1 } (unique compound — prevent duplicate bookmarks)
- horoscopeNotes: { "user.id": 1, "horoscope.id": 1 } (unique compound — one notepad per (student, horoscope))
- horoscopeNotes: { "horoscope.id": 1 } (cascade-delete lookups)
- searchEmbeddings: { "horoscope.id": 1, language: 1, isActive: 1 } (for managing embedding lifecycle)
- searchEmbeddings: { isActive: 1, language: 1 } (for filtering active embeddings by language during search)

## Security Considerations

- Google SSO only — no password authentication
- JWT tokens with expiry for API authentication
- MongoDB access control for data isolation
- Share links use cryptographically random tokens with expiration
- All astrology calculations performed server-side
- Admin routes require SuperAdmin role middleware
- Rate limiting on search and export endpoints
- CORS configured for frontend domain only
- Location endpoints enforce ownership checks: users can only edit/delete their own locations
- Super Admin can view all locations and delete any public location (but not private)
- Private locations are filtered out from query results unless the requesting user is the creator or a Super Admin
- Location overrides on horoscope (latitude/longitude) do not propagate back to the saved Location record
- Ephemeris files (Swiss Ephemeris) are bundled with the application via `swisseph-v2` — no external API call is made for ephemeris data
- Current planet computation uses the ephemeris library synchronously per request; rate limiting should be applied to prevent abuse since each calculation is CPU-intensive
- The calculation function uses only the server's system clock — no user-controlled time input is accepted (avoids time-manipulation attacks)
- Ephemeris data access is read-only and does not require authentication scoping beyond the standard session check
- Manual chart payloads (`source: "manual"` + `PUT /api/horoscope/:id/manual-chart`) are strictly validated server-side (numeric enums, house range 1–12, no duplicate planets) and are owner-only writes
- Derived birth ranges (time/month/date/age) are read-only outputs computed from user-entered sign/placement data — no user-controlled degree/time input is accepted for range derivation
- Per-user settings (`planetaryOrbs`, `planetAspects`) are scoped to the owning session (`/api/settings` uses `getServerSession` and writes by `session.user.email`/`googleId`); `planetAspects` payloads are strictly validated server-side (numeric-only, bounded ranges, no partial save) and non-owners always receive the stored aspect snapshot — owner-specific view-time aspect re-derivation runs only under an ownership check
- Shad Bala writes (`PATCH /api/horoscope/:id/shadbalaya`) are strictly validated server-side (planet integer 1–9, bala in the allowed six-key set, boolean value) and authorized to the owner or a super-admin only (401 unauthenticated, 403 otherwise); non-owner/share-link views render read-only and any mutation attempt is rejected regardless of what the UI shows; `overridden` entries are never rewritten by the recalculation job
- Notepad reads/writes (`GET`/`PUT /api/horoscope/:id/note`) are scoped to the owning session and the **caller's own** `HoroscopeNote` document — no endpoint ever reads or writes another student's note; the route reuses the detail-page viewability check (404 for missing or non-viewable horoscopes, 401 unauthenticated) and strictly validates payloads server-side (parentTag 0–12, subTag from the static catalog or null, tag/note text length caps, `TagColor` 1–6, geometry bounds) with no partial save
- Notepad content is private per student: never included in search text content, search result cards, public detail payloads or share-link payloads (US-SN-014)

### Privacy & Access Control

- **Privacy enforcement at query level**: The search endpoint (`POST /api/search`) filters horoscopes at the MongoDB query level using `$or: [{ "owner.id": session.user.id }, { isPublic: true }]` — this ensures private horoscopes are never loaded into application memory for unauthorized users, providing defense-in-depth
- **Ownership enforcement**: `PATCH /api/horoscope/:id/privacy` checks `horoscope.owner.id === session.user.id` — only the owner can change privacy settings
- **Super Admin read-only access**: Admin routes can view all horoscopes and actual names, but MUST NOT modify `isPublic` or `displayName` fields except as part of approved support actions
- **Share link survival**: When a horoscope transitions from public to private, existing share links remain valid — the share link endpoint (`GET /api/share/:token`) bypasses the `isPublic` check because share links imply intentional sharing
- **Audit trail**: All Super Admin views of private horoscopes are logged to the `auditLogs` collection with `action: "admin_view_private"` for compliance and transparency
- **Privacy change audit**: Every toggle of `isPublic` or `displayName` is logged to `auditLogs` with `action: "privacy_change"` capturing old and new values
- **No data leakage via search**: The search endpoint returns anonymous placeholder text (not the actual name) when `isPublic=true` and `displayName=false`. The placeholder format is TBD by UX but must not leak identifiable information
- **Search embedding isolation**: When the Qdrant vector search pipeline is operational, Qdrant point payloads include an `isPublic` field, and search queries filter on it. The embedding lifecycle (create/delete on privacy toggle) is asynchronous to keep the toggle responsive
- **Search history privacy**: SearchHistory entries are user-scoped — only the owning user can read/clear their history. No cross-user search history access
- **Bookmark privacy**: SearchBookmark is user-scoped. Bookmarking a public horoscope does NOT expose it — the bookmark merely stores a reference. Accessing bookmarked content still requires the same privacy checks as direct horoscope access
- **Export data limits**: Search export endpoint is rate-limited to 10 req/min/user and restricted to the current page (max 20 results) to prevent bulk data extraction
- **Graceful degradation fallback logging**: All RAG pipeline fallbacks (LLM unavailable, Qdrant down, Transformers.js failure) are logged with the failure reason but the endpoint must never expose internal error details to the client

## Performance Considerations

- Vector search index (HNSW in Qdrant) for fast similarity search
- Chart data cached after initial calculation
- Horoscope calculation runs asynchronously with progress indication
- Search results paginated
- Image/CDN caching for chart images
- Lazy loading for chart rendering in UI
- **Search result cards**: Charts within each result card are lazy-rendered via IntersectionObserver — only rendered when the result item is near the viewport, preventing layout thrashing from 5+ chart SVGs per card
- **Horizontal scroll**: Each result card's chart section uses CSS `overflow-x: auto` with horizontal scrolling — no JS carousel, native browser scroll performance
- **Default page size**: 5 results per page (reduced from 20) because each result is a full-detail card with multiple charts
- **Search response payload**: Returns full calculated data (charts, planets, dashas) inline — no separate fetch per result. Data size per result is ~10-20KB JSON, ~50-100KB per page at default 5 results
- **Collapse/expand**: Collapsed result cards render as compact summary (name + ascendant + score) with zero chart rendering — improves perceived performance when scanning many results
