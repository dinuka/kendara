# Student Notepad (ශිෂ්ය සටහන් පොත) — Architecture

**Date:** 2026-08-16 15:59
**Status:** Draft
**Author:** Architect (BMAD)
**Source:** `docs/student-notes.md`, `specs/business-analysis/20260816-1543-student-notes.md`, `specs/business-analysis/data-model.md` (HoroscopeNote entity, NotepadState/ObservationTags/ResultNotes/NotepadObservation structures, House Purpose Catalog, Planet Signification Catalog, TagColor enum), `specs/business-analysis/actors.md`
**Related:** `specs/architecture/20260815-1145-warga-kendara-architecture.md` (primary template: static catalogs via i18n, pure derived data + render-time legacy fallback), `specs/architecture/20260813-2011-shadbalaya-architecture.md` (override persistence, debounced PATCH pattern, `(n/6)`-style ratio derived at render), `specs/architecture/20260814-2127-bhava-suchika-architecture.md` (pure shared module contract), `specs/business-analysis/20260727-2055-search-horoscope.md` (SearchBookmark — the per-(user, horoscope) private-document precedent)
**Revision (2026-08-16 16:30):** continuation pass — the two locked-in AI-engineer requirements are made explicit and enforced end-to-end (§Locked-In Requirements, Architecture Decisions rows, `Notepad.tsx` lifecycle, Data Flow); Open Items are triaged into **provisional defaults (implement now)** vs **deferred later-role decisions**; the Developer handoff is sharpened (file-level plan, typed `notepadObservations.ts` contract, PUT route validation table, no-middleware model note); a Handoff to UX checklist is added.

---

## Locked-In Requirements

The BA phase locked in two AI-engineer requirements (from `docs/student-notes.md` + BA feedback on `specs/business-analysis/20260816-1543-student-notes.md` — US-SN-001 AC5 / US-SN-013 AC5). The architecture below enforces both end-to-end; the Developer **must not regress either**:

1. **Observations change with the horoscope** — system observations derive **strictly from the currently viewed horoscope's** `CalculatedDetails` (incl. `wargaKendara`). Switching horoscopes instantly switches the observations; the notepad never shows another horoscope's data, and the student's saved tags/notes/geometry are keyed to the horoscope they were created on (per-horoscope isolation — no cross-horoscope bleed).
2. **Every student modification persists to the database per horoscope** — popup geometry, selection state (when enabled), observation tags and result notes are all written to the `HoroscopeNote` document for the owning (student, horoscope) pair. Nothing lives only in memory; reopening the notepad on the same horoscope restores everything from the DB.

The mechanisms that implement these are: the caller-scoped note route (§API Contracts), the `Notepad.tsx` fetch/save lifecycle keyed by `horoscopeId` (§Component Design), and the pure derivation reading the current render's `calculatedDetails` prop (§`notepadObservations.ts`).

## Overview

The Student Notepad is a movable/resizable **non-modal popup** on the horoscope detail page where a student makes the observations that lead to a prediction. It has:

- **13 parent tags** (12 house purposes + "Other", numeric `0` = Other / `1`-`12` = house number) as a single-select radio strip; selecting a parent reveals its **sub-tags** (house significations) from a static house-purpose catalog.
- **System-generated observations** derived **on-the-fly at render time** from the already-shipped `CalculatedDetails` payload (including `wargaKendara`) — the six observation groups (planets in the house; house load + position + Nakshatra load + position; sub-tag planet significations; Chandra Lagna related house; Surya Lagna related house; related Warga Kendara) render as color-coded tags (green = good / red = bad / white = neutral) with a per-section `(n/m)` ratio. **Never stored** — the `currentPlanets`/`wargaKendara`-fallback precedent.
- **Student-entered data** — the student's own observation tags (with a selectable `TagColor`) and result notes — persisted on a new **`HoroscopeNote` document**, one per (student, horoscope), private to the student, never touched by the AstrologySettings recalculation job (SearchBookmark + Shad Bala `overridden` precedents).

Two new pure shared modules (`src/lib/notepadCatalogs.ts`, `src/lib/notepadObservations.ts`), one new Mongoose model (`src/models/HoroscopeNote.ts`), one new API route pair (`GET`/`PUT /api/horoscope/:id/note`), five new client components under `src/components/notepad/`, one page mount point, and two one-line cascade-delete additions.

## System Context

```
┌────────────────────────────── Horoscope Detail Page (client) ─────────────────────────────┐
│  charts/calculations tabs (unchanged) + Student Notepad popup (non-modal, draggable,      │
│  resizable, fixed-position, above page content)                                           │
│  ┌──────────────────────────────────────────────────────────┐                             │
│  │ Notepad.tsx                                               │                             │
│  │  NotepadTagStrip      → 13 parent tags (radio) → sub-tags │  geometry + selection      │
│  │  NotepadObservations  → 6 sections, colored tags, (n/m)   │  state → NotepadState      │
│  │  NotepadStudentTags   → own tags + TagColor picker        │  (persisted per horoscope) │
│  │  NotepadResultNotes   → result notes (newest first)       │                             │
│  └──────────────────────────────┬───────────────────────────┘                             │
│  observations derive from page-held calculatedDetails (incl. wargaKendara) —              │
│  pure functions, no API call, no spinner                                                  │
└──────────────┬────────────────────────────────────────────────────────────────────────────┘
               │ GET/PUT /api/horoscope/:id/note (debounced 500ms full-doc upsert)
               ▼
┌────────────────────────────── Service Layer ──────────────────────────────────────────────┐
│  src/lib/notepadCatalogs.ts      (NEW static catalogs — no I/O)                           │
│    HOUSE_PURPOSE_CATALOG (13 parents + Sanskrit names + signification keys → sub-tags)    │
│    PLANET_SIGNIFICATION_CATALOG (9 planets) + planetsForSubTag(subTag) reverse lookup     │
│  src/lib/notepadObservations.ts  (NEW pure module — no ephemeris, no I/O)                 │
│    resolveNotepadObservation(calculatedDetails, parentTag, subTag) → NotepadObservation   │
│    classifyPlanetStrength (default classifier; ClassifyObservation pluggable)             │
│  src/app/api/horoscope/[id]/note/route.ts (NEW — GET/PUT, caller-scoped upsert)           │
└──────────────┬────────────────────────────────────────────────────────────────────────────┘
               ▼
┌──────────────┴────────────────────────────────────────────────────────────────────────────┐
│  Data Layer — horoscopeNotes collection (NEW Mongoose model, SearchBookmark pattern)      │
│  unique compound index { "user.id": 1, "horoscope.id": 1 }; cascade-deleted with the      │
│  horoscope (both DELETE routes); NEVER read or written by recalculationJob.ts             │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

## Architecture Decisions

| Decision | Choice | Rationale |
| -------- | ------ | --------- |
| System-observation derivation | **On-the-fly pure render-time functions** over the shipped `CalculatedDetails`/`wargaKendara` payload (`src/lib/notepadObservations.ts`) — **no new endpoint** | Answers BA Architect Q1. US-SN-016 requires on-the-fly derivation ("no per-request API call, no loading spinner"); the `currentPlanets`/`wargaKendara`-fallback precedent; works identically for `source: "auto"`, `source: "manual"` and legacy docs. |
| "House load"/"Nakshatra load" values | **No new `CalculatedDetails` fields in phase 1** — the domain-pending sections render neutral placeholder tags; derivation + classifier are **pluggable hooks** so confirmed rules slot in without structural change | Answers BA Architect Q2. Definitions are BA Open Questions 1–2 (terms exist only in `docs/student-notes.md`); if confirmed rules need values not derivable from stored fields, they are added later mirroring `wargaKendara` (recomputed by the AstrologySettings recalculation job) — US-SN-005/016 explicitly allow this. |
| API shape | `GET` + `PUT /api/horoscope/:id/note` — a single full-document upsert (per-field-group `$set`, at least one group per request) | Answers BA Architect Q3. One small document per (student, horoscope); a full-doc PUT keeps the client debounce trivial and avoids five+ granular endpoints (geometry/selection/tags/notes); last-write-wins per field group (US-SN-013 edge cases). |
| Ownership / authorization | The note is **caller-scoped**: any authenticated student with view access reads/writes their **own** document; the horoscope's `isPublic`/`displayName`/share-link rules do **not** extend to note content | US-SN-014: every viewer gets their own private notepad on own/public/share views. Deliberately differs from `PATCH /api/horoscope/:id/shadbalaya` (owner/super-admin only) because the notepad is per-viewer study data, not horoscope data. The route reuses the detail-page viewability check (`GET /api/horoscope/:id` line 36: 404 for missing / non-owner / non-public / non-admin). |
| Storage | New `HoroscopeNote` Mongoose model (`src/models/HoroscopeNote.ts`) with embedded `{ id: UUID }` refs (`user`, `horoscope`), unique compound index, lazy creation on first save, cascade delete with the horoscope | Answers BA Architect Q4. SearchBookmark is the exact template (uuid `id`, embedded refs, unique `{ "user.id": 1, "horoscope.id": 1 }` index). Lazy creation: GET never creates a document — a horoscope without a notepad renders empty defaults (US-SN-013 AC1/edge case). |
| System observations storage | **Never stored on `HoroscopeNote`** — `NotepadObservation` is a render-time contract only | US-SN-010/016 + data-model `NotepadObservation` ("derived, NOT stored"); colors and ratios are pure render-time derivations, contrast with student tags which store a numeric `TagColor`. |
| Recalculation job | **No changes** — `recalculationJob.ts` must never read or write `HoroscopeNote` | US-SN-013 AC4: the job recomputes `CalculatedDetails` only; the notepad holds student data (Shad Bala `overridden` preservation principle in spirit — student-entered data is never recomputed or overwritten). |
| Static catalogs | TS constants in `src/lib/notepadCatalogs.ts` + i18n keys (`notepad.*`) — stable sub-tag **keys**, English/Sanskrit authoritative, Sinhala pending with English fallback | US-SN-003/015; Varga Chart Catalog precedent. Sub-tag identity is the catalog key, so a later catalog wording change never breaks stored tags. Parent-tag value = house number (`0` = Other) — no separate enum. |
| Color classification + ratios | Pluggable `ClassifyObservation` (default `classifyPlanetStrength`: `PlanetaryStrength` sign — positive green, negative red, `Sama 0` white); `(n/m)` derived at render, never stored | US-SN-010; BA Clarifying Assumption 7 default. The pluggable hook means the confirmed per-kind domain rules (load/warga goodness) replace one function, not the design. |
| Persistence cadence | 500 ms debounce full-doc `PUT` + optimistic local state + `keepalive` flush on unmount; rollback + localized toast on failure | Shad Bala Table pattern (US-SB-008/RE-SB-214). US-SN-013 AC5: every student modification (geometry, selection, tags, notes) persists to the DB — nothing lives only in memory. |
| Per-horoscope isolation (locked-in requirement a) | System observations are **derived during render** from the currently mounted horoscope's `calculatedDetails` prop — never stored, never cached in state. The student note doc is fetched/owned per `(user.id, horoscope.id)` pair (unique compound index). | Switching horoscopes must instantly switch observations with zero stale-data window; the render-time derivation memoized on `[calculatedDetails, parentTag, subTag]` re-derives on horoscope switch by construction. |
| Persistence guarantee (locked-in requirement b) | **All** student data (geometry, selection, tags, notes) lives in the `HoroscopeNote` doc; a single `scheduleSave()` pipeline debounce-writes the full doc; on horoscope switch the pending debounce is **flushed synchronously before** the new horoscope's data is fetched; on unmount a `keepalive` flush runs. | Nothing may be lost on horoscope switch, tab close, or browser refresh; re-opening the horoscope restores exactly the saved state (US-SN-013 AC5). |
| Selection / open-state persistence | Store `isOpen` + `selectedParentTag` + `selectedSubTag` in `notepadState` and restore on reopen | US-SN-001 AC1/AC5. BA Open Question 10 is a UX interaction question — the architecture decision is to persist (the data model already provides the fields); UX confirms the restore interaction. |
| Share-link views | Phase-1 notepad mounts on the **detail page only**; the share page (`src/app/share/[token]/page.tsx`) is a minimal stub (no detail content) → notepad on share links is **deferred** | The note route is horoscope-id-scoped; mounting on the share page requires the share payload to expose the horoscope id and a token-aware access path. Flagged as an Open Item for PM (BA Open Question 8 assumed availability scope). |
| Tag/note ids | Client-generated UUIDs (`crypto.randomUUID`) validated as non-empty strings server-side | Matches the repo's `{ id: UUID }` convention; keeps the client optimistic-edit path simple. |

## Component Design

### `src/models/HoroscopeNote.ts` (NEW — Mongoose model)

- **Location:** `src/models/HoroscopeNote.ts`
- **Responsibility:** the single persistent store for student notepad data — one document per (student, horoscope). Mirrors `src/models/SearchBookmark.ts` exactly (uuid `id`, embedded `{ id: UUID }` refs, unique compound index).
- **Interfaces / schema:**

```ts
import mongoose, { Document, Model, Schema } from "mongoose";
import { v4 as uuidv4 } from "uuid";

export interface NotepadState {
    position: { x: number; y: number };
    size: { width: number; height: number };
    isOpen?: boolean;            // optional — restore open state on reopen (UX interaction)
    selectedParentTag?: number;  // 0 = Other, 1-12 = house number
    selectedSubTag?: string | null; // stable catalog key from HOUSE_PURPOSE_CATALOG
}

export interface ObservationTag {
    id: string;                  // client-generated UUID
    parentTag: number;           // 0 = Other, 1-12 = house number
    subTag: string | null;       // catalog key; always null for parentTag 0
    text: string;                // non-empty, <= 500 chars
    color: number;               // numeric TagColor enum 1-6
    createdAt: string;
    updatedAt: string;
}

export interface ResultNote {
    id: string;                  // client-generated UUID
    text: string;                // non-empty, <= 2000 chars
    createdAt: string;
    updatedAt: string;
}

export interface IHoroscopeNote extends Document {
    id: string;
    user: { id: string };
    horoscope: { id: string };
    notepadState?: NotepadState;
    observationTags: ObservationTag[];
    resultNotes: ResultNote[];
    createdAt: Date;
    updatedAt: Date;
}

const HoroscopeNoteSchema = new Schema<IHoroscopeNote>(
    {
        id: { type: String, required: true, unique: true, default: (): string => uuidv4() },
        user: { id: { type: String, required: true } },
        horoscope: { id: { type: String, required: true } },
        notepadState: { type: Schema.Types.Mixed },   // absent on legacy/empty notepads
        observationTags: { type: Schema.Types.Mixed, default: [] },
        resultNotes: { type: Schema.Types.Mixed, default: [] },
    },
    { timestamps: true },
);

HoroscopeNoteSchema.index({ "user.id": 1, "horoscope.id": 1 }, { unique: true });
HoroscopeNoteSchema.index({ "horoscope.id": 1 });

export const HoroscopeNote: Model<IHoroscopeNote> =
    mongoose.models.HoroscopeNote || mongoose.model<IHoroscopeNote>("HoroscopeNote", HoroscopeNoteSchema);
```

- **Data:** `notepadState` per the data-model [NotepadState](#) JSON; `observationTags` per [ObservationTags (HoroscopeNote)](#); `resultNotes` per [ResultNotes (HoroscopeNote)](#). System observations are **never** written here.
- **Middleware:** **none** — the model declares **no pre/post schema hooks** (no mongoose middleware). Cascade deletion is route-level `HoroscopeNote.deleteMany({ "horoscope.id": id })` in both horoscope DELETE routes (§Component Design). The only index behavior is the static `schema.index(...)` unique compound index declared at model definition time.

### `src/lib/notepadCatalogs.ts` (NEW — static reference data, no I/O)

- **Location:** `src/lib/notepadCatalogs.ts`
- **Responsibility:** the static house-purpose catalog (13 parent tags + Sanskrit names + significations → sub-tags) and planet-signification catalog (+ reverse sub-tag → planet mapping). Display strings resolve via i18n; the module holds **stable keys** only.
- **Interfaces:**

```ts
export interface HousePurposeEntry {
    parentTag: number;            // 0 = Other, 1-12 = house number
    sanskritName: string;         // i18n key suffix, e.g. "tanuLagna" → t("notepad.housePurpose.1.sanskrit")
    subTags: string[];            // stable signification keys, e.g. ["self", "body", "personality", ...]; [] for Other
}

export const HOUSE_PURPOSE_CATALOG: HousePurposeEntry[]; // 13 entries, indexable by parentTag

export interface PlanetSignificationEntry {
    planet: number;               // numeric Planet enum 1-9
    significations: string[];     // stable keys, e.g. [ "self", "soul", "father", "authority", "government", "status" ]
}

export const PLANET_SIGNIFICATION_CATALOG: PlanetSignificationEntry[]; // 9 entries (Sun..Ketu)

/** Reverse lookup: every planet whose signification list contains the sub-tag key (all matches, US-SN-006). */
export function planetsForSubTag(subTagKey: string): number[];

/** Validation helpers shared by the API route and the client. */
export function isValidParentTag(value: unknown): value is number;                    // integer 0-12
export function isValidSubTag(parentTag: number, subTag: string | null): boolean;     // key in catalog; null only for Other
```

- **Data source:** the authoritative tables in `specs/business-analysis/data-model.md` → House Purpose Catalog + Planet Signification Catalog (English/Sanskrit from `docs/student-notes.md`). Comma-split the signification lists at build time into sub-tag keys (mirroring the varga indication-tag split pattern).
- **i18n keys consumed:** `notepad.housePurpose.{0..12}.{label|sanskrit}`, `notepad.housePurpose.subTags.{key}`, `notepad.planetSignification.{planet}.significations.{key}` — English authoritative, Sinhala pending domain confirmation (English fallback, existing convention).

### `src/lib/notepadObservations.ts` (NEW — pure shared module)

- **Location:** `src/lib/notepadObservations.ts`
- **Responsibility:** derive the system observation payload (`NotepadObservation` render contract from the data model) for a selected parent/sub-tag from a `CalculatedDetails`-shaped object; classify each tag and compute each section's ratio. **No ephemeris, no I/O** — same contract as `shadBalaya.ts`/`bhavaSuchika.ts`/`wargaKendara.ts`, so the same module runs on the client at render time.
- **Interfaces:**

```ts
export type ObservationColor = "green" | "red" | "white";
export type WargaChartKey = "d1" | "d9" | "suryaLagna" | "chandraLagna";

export interface ObservationTagBase {
    kind: "planet" | "house" | "lagna" | "load" | "d1LoadInWarga";
    color: ObservationColor;       // render-time classification only — never stored
    labelKey?: string;             // i18n composition for load / not-available tags (ShadBalaya reason-object convention)
    params?: Record<string, number>; // numeric params for labelKey
    // per-kind fields (numeric enums — display names resolved per locale, never stored):
    planet?: number;               // Planet 1-9
    sign?: number;                 // ZodiacSign
    house?: number;                // 1-12
    strength?: number;             // PlanetaryStrength
    nakshatra?: number;            // Nakshatra
    pada?: number;
    chart?: WargaChartKey;         // reference chart for house/lagna/d1LoadInWarga tags
    lagnaSign?: number;
    loadCount?: number;
    planets?: number[];            // planets loading the house (numeric enums)
}

export interface ObservationSection {
    key: "planetsInHouse" | "houseLoad" | "nakshatraLoad" | "subTagPlanet" |
         "chandraLagnaHouse" | "suryaLagnaHouse" | "wargaKendara";
    ratio: { green: number; total: number };   // rendered literally as (n/m), no division
    tags: ObservationTagBase[];
}

export interface NotepadObservation {
    parentTag: number;             // 0-12
    subTag: string | null;         // catalog key
    sections: ObservationSection[]; // all seven section keys — they encode the SIX feature-doc groups:
    // group 2 ("house load, house load position, Nakshatra load...") splits into houseLoad + nakshatraLoad
}

export type ClassifyObservation = (o: ObservationTagBase) => ObservationColor;

/** Default rule (BA Clarifying Assumption 7): positive PlanetaryStrength → green,
 *  negative → red, Sama 0 / undefined → white. Load/warga kinds default to white
 *  until the domain confirms their rules (BA Open Questions 2-3). */
export function classifyPlanetStrength(o: ObservationTagBase): ObservationColor;

```ts
// The ONLY input shape the module reads from a calculated-details payload.
// Narrow, explicit, and exactly what US-SN-002/004/005/006/008/009 need.
interface CalculatedDetailsLike {
    planets: Array<{
        planet: number; sign: number; house: number;
        degree: number; strength: number; nakshatra: number; pada: number;
    }>;
    houses: Array<{ sign: number }>; // D1 house signs — index = house number (1-based)
    nakshatra: { moonNakshatra: number }; // stored Moon Nakshatra (numeric enum)
    wargaKendara: Record<string, WargaKendaraChartLike | null>; // incl. "d9"
}
interface WargaKendaraChartLike {
    lagnaSign: number;
    planets: Array<{ planet: number; sign: number; house: number; strength: number }>;
}

export function resolveNotepadObservation(
    calculatedDetails: CalculatedDetailsLike | null | undefined, // null → every section = not-available
    parentTag: number,
    subTag: string | null,
    classify?: ClassifyObservation, // default: classifyPlanetStrength (positive → green, negative → red, Sama 0 → white)
): NotepadObservation;
```

- **Throw-safety contract:** each section is derived in its own try/catch. A malformed/missing sub-field (e.g. `wargaKendara.d9.planets` array hole) must **not** fail the whole notepad — that section degrades to a single neutral `not available` tag (`{ kind: "load", color: "white", labelKey: "notepad.observation.notAvailable" }`) and the failure is `console.warn`-logged. The function itself never throws to the caller.
- **Per-section derivation rules** (all whole-sign, deterministic, no ephemeris):

| Section key | Derivation | Empty / edge case |
| --- | --- | --- |
| `planetsInHouse` | stored D1 `planets` filtered by `p.house === parentTag`; each → `{ kind: "planet", planet, sign, strength, house, nakshatra, pada }`, colored by classifier (US-SN-004 — source is the stored D1 planets/houses, degree/strength/nakshatra/pada included) | `tags: []`, ratio `{ 0, 0 }`; component renders localized empty-state (UX decides `(0/0)` vs omitted) |
| `houseLoad` | **[PROVISIONAL default, BA Open Questions 1–2 pending]** one neutral tag `{ kind: "load", color: "white", labelKey: "notepad.observation.houseLoad", params: { house: parentTag, count, sign } }` — `count` = number of D1 planets in house N, `sign` = house N's sign from `houses` (the load position). Never an empty section (US-SN-005 edge case). Confirmed domain rule swaps in behind the same tag shape via the `classify` param. | `houses` missing → not-available tag |
| `nakshatraLoad` | **[PROVISIONAL default]** one neutral tag `{ kind: "load", color: "white", labelKey: "notepad.observation.nakshatraLoad", params: { nakshatra, pada } }` — `nakshatra` = stored `nakshatra.moonNakshatra` (numeric enum), `pada` from the Moon planet entry in `planets`. Never an empty section. | `moonNakshatra` null → not-available tag (does **not** reuse the `{ "nakshatra": 14, "lord": 6 }` data-model example — that sample is internally inconsistent, Chitra 14's lord is Mars 3 not Venus 6) |
| `subTagPlanet` | `planetsForSubTag(subTag)` → each matching planet's stored details as a planet tag (all matches render — US-SN-006). | no match → `tags: []`, ratio `{ 0, 0 }`, component renders "no significant planet" empty-state |
| `chandraLagnaHouse` / `suryaLagnaHouse` | the `wargaKendara.chandraLagna` / `.suryaLagna` entry (legacy docs → `resolveWargaKendara` render-time fallback, existing pattern). Related house = `parentTag` (assumption, BA Clarifying Assumption 4). Tag: `{ kind: "house", chart, house: parentTag, planets, loadCount }` + a neutral load tag for the house-load position. | entry `null` → single neutral not-available tag |
| `wargaKendara` | related warga chart = **`d9` default in phase 1** (assumption, BA Clarifying Assumption 6 / Open Question 3). Three tag groups: warga lagna `{ kind: "lagna", chart, lagnaSign, loadCount }`; related house N `{ kind: "house", chart, house: parentTag, planets, loadCount }`; D1 load in the warga chart **[PROVISIONAL default, BA Open Question 5 pending]** `{ kind: "d1LoadInWarga", chart, planet, sign, house, strength }` — each D1 planet loading house N rendered at its `wargaKendara.d9.planets` position (missing row → D1 placement, neutral) | `d9: null` (manual without Navamsa) → one neutral not-available tag; the other warga entries still render (US-SN-009 edge case) |

- **Ratios:** per section, `green` = count of green tags, `total` = count of all tags; rendered literally as `(n/m)`.
- **Classification:** the classifier receives each tag; the default colors planet tags by `strength` sign and everything else white. Domain-confirmed per-kind rules replace the default via the `classify` parameter — one-function change, no structural change.

### `src/app/api/horoscope/[id]/note/route.ts` (NEW — GET/PUT)

- **Location:** `src/app/api/horoscope/[id]/note/route.ts`
- **Responsibility:** read/write the **calling student's own** notepad document for the horoscope. Standard route pattern: `getServerSession` → 401; `connectDB()` → `Horoscope.findById` → 404; viewability check mirroring `GET /api/horoscope/:id` (owner OR public OR super-admin, else 404 — no 403, matching the detail route's privacy posture); then operate on `{ "user.id": session.user.id, "horoscope.id": id }`.
- **`GET`:** returns `HoroscopeNote.findOne(...).lean()` normalized to `{ notepadState: notepadState ?? null, observationTags, resultNotes }`, or `{ notepadState: null, observationTags: [], resultNotes: [] }` when no document exists. **Never creates a document on GET** (lazy creation on first save). Logs at debug.
- **`PUT`:** strict body validation (no schema lib — `parseNoteBody` mirroring `parseToggleBody`/`parseManualChartBody` style), at least one field group required, **no partial save**:
  - `notepadState`: `position { x, y }` integers, `size { width, height }` integers within proposed bounds (min `320×400`, max `900×1200`), `isOpen` boolean optional, `selectedParentTag` integer 0–12 optional, `selectedSubTag` string catalog key or null optional (`null` required when `selectedParentTag === 0`).
  - `observationTags`: array ≤ 200; each `{ id: non-empty string, parentTag: 0–12, subTag: catalog key | null, text: non-empty ≤ 500, color: integer 1–6, createdAt/updatedAt: strings }`.
  - `resultNotes`: array ≤ 100; each `{ id: non-empty string, text: non-empty ≤ 2000, createdAt/updatedAt: strings }`.
  - Valid → `HoroscopeNote.findOneAndUpdate({ "user.id": userId, "horoscope.id": id }, { $set: { ...provided groups } }, { upsert: true, new: true })` (an omitted group is left untouched — last-write-wins per field group). Returns the stored document. Invalid → 400 with a localized error string, **no writes at all** (validation completes before any DB call). Logs at info.

  Validation summary (implemented in `parseNoteBody`, mirroring `parseToggleBody`/`parseManualChartBody` style — no schema lib):

  | Group | Fields | Rules |
  | --- | --- | --- |
  | `notepadState` | `position { x, y }`, `size { width, height }`, `isOpen`, `selectedParentTag`, `selectedSubTag` | integers; size within proposed bounds min `320×400` max `900×1200`; `selectedParentTag` integer 0–12 optional; `selectedSubTag` catalog key or null optional, **`null` required when `selectedParentTag === 0`** |
  | `observationTags` | `id`, `parentTag`, `subTag`, `text`, `color`, `createdAt/updatedAt` | array ≤ 200; `id` non-empty string; `parentTag` 0–12; `subTag` catalog key or null; `text` non-empty ≤ 500; `color` integer 1–6; timestamps strings |
  | `resultNotes` | `id`, `text`, `createdAt/updatedAt` | array ≤ 100; `id` non-empty string; `text` non-empty ≤ 2000; timestamps strings |
  | (upsert semantics) | — | at least **one** of the three groups required; `$set` writes only provided groups; `upsert: true` creates the `(user, horoscope)` doc on first save; unique compound index `{ "user.id": 1, "horoscope.id": 1 }` makes the pair single-sourced |

### `src/components/notepad/Notepad.tsx` (NEW — popup shell, "use client")

- **Responsibility:** the draggable/resizable non-modal popup + notepad button. Owns `notepadState` (geometry + selection), the note fetch, the debounced PUT, and the child components. Mounted once on the detail page root (fixed-position, above page content, below modals).
- **Behaviour — state ownership:** holds only **student-owned** state as local state: `notepadState` (geometry + selection + open flag) and the saved `observationTags`/`resultNotes`. System observations are **never state** — they are derived during render from the `calculatedDetails` prop via `resolveNotepadObservation`, memoized on `[calculatedDetails, parentTag, subTag]` (a horoscope switch re-derives instantly by construction; nothing to invalidate or clear).
- **Behaviour — fetch lifecycle (keyed by `horoscopeId`):** on mount, and on **every `horoscopeId` change** (`useEffect` on `params.id`), in order: (1) **synchronously flush** any pending debounced save for the previous horoscope (requirement b — nothing is left in memory when switching; the flush uses the old id, never writes to the new doc), (2) reset local state to empty (no cross-horoscope bleed — requirement a), (3) `GET /api/horoscope/${id}/note` with a **stale-response guard** (an in-flight response for a previous `horoscopeId` is discarded — latest-wins ref check), (4) populate state only from the current id's response; 404 → empty notepad (first save upserts). Apply default geometry (centered/docked — UX decision) when `notepadState` is null; `isOpen` restored per horoscope from `notepadState.isOpen`.
- **Behaviour — save pipeline:** drag via header (`pointerdown`/`pointermove`/`pointerup`, clamped to viewport — never fully off-screen); resize via handle (clamped to min/max bounds). Geometry updates local state immediately. **Every mutation across all field groups goes through a single debounced save** (ShadBalaTable pattern): optimistic local state → one 500 ms timer per document → `PUT` full doc `{ notepadState, observationTags, resultNotes }`; failure → rollback + `horoscope.error.notepad.save_failed` toast; flush pending save on unmount with `keepalive: true`. The timer, flush, and rollback are all bound to the current `horoscopeId`. Multi-tab: last-write-wins per field group (each tab holds its own doc snapshot; no merge).
- **Behaviour — renders:** `NotepadTagStrip`, `NotepadObservations`, `NotepadStudentTags`, `NotepadResultNotes`.
- **Props:** `{ horoscopeId: string; calculatedDetails: CalculatedDetailsLike | null }` — observations derive from `calculatedDetails` (already held by the page; no extra fetch); `null` (still calculating or missing) → every observation section renders its not-available tag.

### `src/components/notepad/NotepadTagStrip.tsx` (NEW — "use client")

- **Responsibility:** the 13-parent radio strip + sub-tag chips from `HOUSE_PURPOSE_CATALOG` + i18n. Single-select semantics (`aria-pressed`, warga tab strip precedent); clicking the selected parent is a no-op (US-SN-002 AC2); "Other" renders no sub-tags (shows the student-tag area instead). Parent selection updates `notepadState.selectedParentTag`/`selectedSubTag` (sub-tag resets to null on parent switch); sub-tag selection updates `selectedSubTag`.

### `src/components/notepad/NotepadObservations.tsx` (NEW — "use client")

- **Responsibility:** for the selected sub-tag, `resolveNotepadObservation(calculatedDetails, parentTag, subTag)` → the seven section keys (six feature-doc groups, group 2 split into `houseLoad` + `nakshatraLoad`) with colored tags and literal `(n/m)` ratios; per-section throw-safe (a bad section degrades to a neutral not-available tag, never fails the notepad). Empty section (`tags.length === 0`) → localized empty-state text, ratio omitted or `(0/0)` per UX. Tag chips render numeric-enum labels via existing i18n maps (`astrology.planetNames`, `signNames`, `strengthNames`) and `labelKey`+`params` composition for load/not-available tags (ShadBalaya reason-object convention). "Other" parent → no observation sections (only the student-tag area). `calculatedDetails: null` → all sections render their not-available tag.

### `src/components/notepad/NotepadStudentTags.tsx` (NEW — "use client")

- **Responsibility:** the student's own observation tags for the current parent/sub-tag context (US-SN-011): list grouped by context, add form (text ≤ 500 + `TagColor` picker — provisional palette green/red/white/blue/yellow/purple), edit/delete. Optimistic updates → debounced PUT (rides the Notepad shell's save). Tags store numeric `TagColor`; never localized text.

### `src/components/notepad/NotepadResultNotes.tsx` (NEW — "use client")

- **Responsibility:** result notes (US-SN-012): newest-first list, add (text ≤ 2000) / edit / delete. Notepad-level (no per-parent grouping — BA Clarifying Assumption 11). Optimistic updates → debounced PUT.

### `src/app/horoscopes/[id]/page.tsx` (UPDATE — mount point)

- Render the notepad button + `<Notepad horoscopeId={horoscope._id} calculatedDetails={calculatedDetails} />` inside the page root (after the main content container, before/around `ConfirmDeleteModal`), passing the already-resolved `calculatedDetails` (which the page already synthesizes for manual horoscopes — the notepad observes the same resolved payload, so manual fallback values like `synthesizeOtherDetails` are consistent). No other page changes (US-SN-016: no new fetch — data ships with the page render).

### `src/app/api/horoscope/[id]/route.ts` + `src/app/api/admin/horoscope/[id]/route.ts` (UPDATE — cascade delete)

- Add `await HoroscopeNote.deleteMany({ "horoscope.id": id });` next to the existing `Chart`/`Metadata`/`CalculatedDetails` deletions in both DELETE handlers (US-SN-013 AC3: cascade delete mirrors SearchBookmark). Note: SearchBookmark itself is not yet cascade-deleted there (pre-existing gap, out of scope — flagged in Open Items).

### i18n (`src/messages/en.json` + `src/messages/si.json` — keep in sync)

- `notepad.button`, `notepad.title`, `notepad.close`, `notepad.toast.save_failed`.
- `notepad.housePurpose.{0..12}.{label|sanskrit}` (13 parents; "Other" label for 0; Sanskrit names Tanu/Lagna…Vyaya/Mokṣa).
- `notepad.housePurpose.subTags.{key}` (comma-split signification keys).
- `notepad.observation.{sectionHeader|planetsInHouse|houseLoad|nakshatraLoad|subTagPlanet|chandraLagnaHouse|suryaLagnaHouse|wargaKendara|ratio|noPlanetsInHouse|noSignificantPlanet|notAvailable}`.
- `notepad.tagColors.{1..6}` (TagColor palette names).
- Reuse existing enum-label maps (`astrology.planetNames`, `signNames`, `strengthNames`, nakshatra names) — no duplication (US-SN-015 AC4). Parity test: every `notepad.*` key exists in both locales (existing vocabulary-test pattern).

## File-Level Plan (Developer handoff)

| # | File | Action | Key contract |
| --- | --- | --- | --- |
| 1 | `src/models/HoroscopeNote.ts` | NEW | Clone `SearchBookmark.ts` pattern: uuid `id`, embedded `user: { id }` / `horoscope: { id }`, `notepadState` + `observationTags` + `resultNotes` per data model; `schema.index({ "user.id": 1, "horoscope.id": 1 }, { unique: true })` + `{ "horoscope.id": 1 }`; **no pre/post schema hooks**; export `HoroscopeNote`/`HoroscopeNoteModel` |
| 2 | `src/lib/notepadCatalogs.ts` | NEW (pure) | `HOUSE_PURPOSE_CATALOG` (13 parents, 0–12, Sanskrit + English labels), `planetsForSubTag` (signification-key → planet lists), `TAG_COLOR_CATALOG` (1–6) — static data only |
| 3 | `src/lib/notepadObservations.ts` | NEW (pure) | `CalculatedDetailsLike` / `WargaKendaraChartLike` interfaces, `ClassifyObservation` type, `classifyPlanetStrength` default, `resolveNotepadObservation` (typed signature + per-section derivation table above); throw-safe per section; consumed by tests with fixture objects (no Mongoose) |
| 4 | `src/app/api/horoscope/[id]/note/route.ts` | NEW | `GET` (404/not-viewable guard mirroring route.ts line-36 check; caller-scoped query) + `PUT` (`parseNoteBody` validation table; `findOneAndUpdate` upsert; no partial save) |
| 5 | `src/components/notepad/Notepad.tsx` | NEW | Popup shell; lifecycle/save pipeline per §Component Design |
| 6 | `src/components/notepad/NotepadTagStrip.tsx` | NEW | 13-parent radio + sub-tag chips; single-select, "Other" no-op |
| 7 | `src/components/notepad/NotepadObservations.tsx` | NEW | Renders `resolveNotepadObservation` output; null/not-available handling |
| 8 | `src/components/notepad/NotepadStudentTags.tsx` | NEW | Student tags: add/edit/delete, TagColor picker, optimistic → shell's debounced PUT |
| 9 | `src/components/notepad/NotepadResultNotes.tsx` | NEW | Result notes list: add/edit/delete, optimistic → shell's debounced PUT |
| 10 | `src/app/horoscopes/[id]/page.tsx` | UPDATE | Mount `<Notepad horoscopeId={id} calculatedDetails={...} />` (pass existing page state; nothing new fetched) |
| 11 | `src/app/api/horoscope/[id]/route.ts` | UPDATE | DELETE: add `await HoroscopeNote.deleteMany({ "horoscope.id": id });` |
| 12 | `src/app/api/admin/horoscope/[id]/route.ts` | UPDATE | DELETE: same one-line cascade |
| 13 | `src/messages/en.json` | UPDATE | Add all `notepad.*` keys |
| 14 | `src/messages/si.json` | UPDATE | Same `notepad.*` keys (parity test) |
| 15 | `src/__tests__/notepadObservations.test.ts` | NEW | Fixture-based: per-section derivation, empty/edge cases, throw-safety (bad section → not-available, no throw), classifier swap |
| 16 | `src/__tests__/notepadRoute.test.ts` | NEW | Route-level: 401/404 guards, validation table cases (400 no-write), upsert semantics, unique-index duplicate → 409-or-error handled |

Implementation order: 1 → 4 (model + route, DB contract) → 2 → 3 (+ 15) → 5–9 (+ 16) → 10 → 11–12 → 13–14. No other files change.

## Data Flow

```
Render (per horoscope):
  page.tsx → GET /api/horoscope/:id (existing) → calculatedDetails in page state
    → Notepad.tsx (mounted with horoscopeId + calculatedDetails)
        → GET /api/horoscope/:id/note → { notepadState | null, observationTags, resultNotes }
            (404 → not viewable; note is ALWAYS the caller's own doc — never another student's)
        → user selects parentTag → sub-tag chips (catalog keys) → selects subTag
        → resolveNotepadObservation(calculatedDetails, parentTag, subTag)
            [pure render-time — no API call, no spinner]
            → planetsInHouse (D1 planets in house N)
            → houseLoad / nakshatraLoad (neutral placeholder until domain confirms)
            → subTagPlanet (planetsForSubTag reverse lookup)
            → chandraLagnaHouse / suryaLagnaHouse (wargaKendara entry, house N)
            → wargaKendara (d9 default: warga lagna + house N + D1 load in warga)
            → tags colored (default classifier: strength sign) + per-section (n/m) — never stored
        → user edits geometry / selection / tags / notes
            → optimistic local state → 500ms debounce → PUT /api/horoscope/:id/note
              { notepadState, observationTags, resultNotes }
              → server: session 401 → horoscope 404/not-viewable → validate (400, no partial save)
                → findOneAndUpdate({ "user.id": userId, "horoscope.id": id }, $set, upsert)
            → failure → rollback + toast; unmount → flush pending save (keepalive)

Navigation:
  params.id change →
    1. flush pending debounced save for the OLD horoscope (writes to the old doc, keepalive)
    2. reset local notepad state to empty
    3. GET /api/horoscope/:id/note for the new (student, horoscope) pair
       (stale-response guard: discard any in-flight response whose id ≠ current params.id)
    4. observations re-derive from the new horoscope's calculatedDetails
  → observations + student data always match the currently viewed horoscope — no cross-horoscope
    bleed (US-SN-001 AC5), nothing left in memory (US-SN-013 AC5)

Recalculation (AstrologySettings job — no code change):
  recalculateOne() → recomputes CalculatedDetails only → HoroscopeNote NEVER read or written
  (student data preserved — US-SN-013 AC4)

Deletion:
  DELETE /api/horoscope/:id (and admin route) → HoroscopeNote.deleteMany({ "horoscope.id": id })
```

## API Contracts

| Method | Route | Request | Response |
| ------ | ----- | ------- | -------- |
| GET | `/api/horoscope/:id/note` | — | 200 `{ notepadState: NotepadState \| null, observationTags: ObservationTag[], resultNotes: ResultNote[] }` — empty defaults when no document (lazy creation on first save). 401 unauthenticated. 404 horoscope missing or not viewable (owner/public/super-admin check). |
| PUT | `/api/horoscope/:id/note` | `{ notepadState?: NotepadState, observationTags?: ObservationTag[], resultNotes?: ResultNote[] }` — at least one group; strict server-side validation per group, **no partial save** | 200 stored document `{ id, user, horoscope, notepadState, observationTags, resultNotes, createdAt, updatedAt }`. 400 invalid body/group (no writes). 401 unauthenticated. 404 horoscope missing or not viewable. The document is always the caller's own (`{ "user.id": session.user.id, "horoscope.id": id }` upsert). |

No changes to any existing route except the two DELETE handlers (one added line each). `/api/share/:token`, `/api/search`, `/api/search/filter`, `/api/settings` are untouched.

## Dependencies

- No new npm packages (`uuid` already used by `SearchBookmark`).
- New files: `src/models/HoroscopeNote.ts`; `src/lib/notepadCatalogs.ts`; `src/lib/notepadObservations.ts`; `src/app/api/horoscope/[id]/note/route.ts`; `src/components/notepad/{Notepad,NotepadTagStrip,NotepadObservations,NotepadStudentTags,NotepadResultNotes}.tsx`; `src/__tests__/notepadObservations.test.ts` (+ catalog i18n parity test).
- Modified files: `src/app/horoscopes/[id]/page.tsx` (mount Notepad); `src/app/api/horoscope/[id]/route.ts` + `src/app/api/admin/horoscope/[id]/route.ts` (cascade delete); `src/messages/en.json` + `src/messages/si.json` (`notepad.*` keys).
- Consumes existing: `resolveWargaKendara`/`wargaKendara` entries (`src/lib/wargaKendara.ts`), `resolveLagnaBhavaSuchika` pattern, enum-label i18n maps, `useI18n()` (`src/hooks/useI18n.tsx`), ShadBalaTable debounce/rollback/keepalive pattern.

## Migration / Compatibility

- **Legacy documents:** no migration/backfill — `HoroscopeNote` documents are created lazily on first save (a horoscope without a notepad renders an empty notepad); legacy `CalculatedDetails` without `wargaKendara` fall back to the existing render-time derivation via `resolveWargaKendara`.
- **Breaking changes:** none — the new model, routes and components are purely additive; the detail page and all existing routes behave as before.
- **Manual horoscopes:** observation sections derive from what the entered placements support — Chandra/Surya Lagna by rotation, D9 warga section `null` (manual without Navamsa) → "not available" tag (US-SN-009 edge case), Nakshatra-load sections may render neutral placeholders where Nakshatra data is lacking (BA Open Question 11).
- **Recalculation job:** no change required — and it must **stay** untouched: `HoroscopeNote` is student data and is never part of `CalculatedDetails`.
- **Cascade delete:** both horoscope DELETE routes gain `HoroscopeNote.deleteMany({ "horoscope.id": id })`; deleting a user's account cascading to their notes is the existing account-deletion path's responsibility (mirrors SearchBookmark — pre-existing gap, flagged in Open Items).

## Security Considerations

- **Caller-scoped reads/writes:** the note route reads/writes only `{ "user.id": session.user.id, "horoscope.id": id }` — no endpoint can read or write another student's `HoroscopeNote`; the horoscope viewability check (owner/public/super-admin, else 404 — the detail route's privacy posture, never 403) prevents access on non-viewable horoscopes.
- **Strict server-side validation:** every `PUT` field group is validated (parentTag 0–12, subTag from the static catalog or null, tag/note text non-empty with length caps, `TagColor` 1–6, geometry bounds, array caps) with **no partial save** on any invalid group.
- **Numeric enums only in storage:** planets/signs/strengths/houses/`TagColor`/catalog keys — no localized or free-form astrological text is ever stored on `HoroscopeNote` (student tag/note text is free-form by design, but capped and private).
- **No search/export leakage:** notepad content is never added to search text content, search result cards, public detail payloads, share-link payloads, or export outputs (US-SN-014 AC3).
- **Super Admin:** defaults to strictly private (no admin read of student notes) per BA Open Question 9; if support requires reads, that becomes a separate audited admin route — never the student route.
- **Rate limiting:** `PUT` is a small validated upsert (no ephemeris, no CPU-heavy work) — the existing per-route protections apply; no new rate-limit surface.

## Verification

1. `pnpm build` — TypeScript compile (new `IHoroscopeNote`, `NotepadObservation`/`ObservationSection`/`ObservationTagBase` types, catalogs, route).
2. `npx jest` — existing tests pass; add unit tests:
   - `notepadObservations.test.ts` (fixture-based, like `bhavaSuchika`/`shadBalaya` tests):
     - `planetsInHouse` filters stored D1 planets by house; empty house → `{ green: 0, total: 0 }`.
     - `subTagPlanet` reverse lookup: "marriage" → Venus, "father" → Sun, "children" → Jupiter; unmapped sub-tag → empty section.
     - `chandraLagnaHouse`/`suryaLagnaHouse` read `wargaKendara` entries at related house = parentTag; `null` entry → "not available" tag.
     - `wargaKendara` section: d9 default; `d9: null` (manual without Navamsa) → neutral tag; legacy doc without `wargaKendara` → `resolveWargaKendara` fallback.
     - Classification: Athi Uchcha/Uchcha/Moolatrikona/Own Sign/Mitra → green; Neecha/Athi Neecha/Shatru → red; Sama/undefined → white; custom `ClassifyObservation` overrides the default.
     - Ratios: `(green/total)` per section, literal counts.
   - Catalog parity test: every `HOUSE_PURPOSE_CATALOG` sub-tag key + `sanskritName` + `notepad.*` message key exists in both `si.json` and `en.json` (mirroring the vocabulary-test pattern).
3. Manual test scenarios:
   - Open an auto horoscope → notepad button → popup opens; drag/resize persists per horoscope (reload → geometry restores; navigate to another horoscope → that horoscope's geometry/selection restores).
   - Parent radio behavior (single select, same-tag click is a no-op); sub-tag drill-down for all 13 parents incl. "Other"; selection restores on reopen (when enabled).
   - Each observation section renders for `source: "auto"`, `source: "manual"` (with and without Navamsa data), and legacy `CalculatedDetails` (strip `wargaKendara` in a dev DB → fallback renders, no error).
   - Color boundaries + `(n/m)` ratios per section (empty/all-white/mixed); student-tag CRUD with each `TagColor`; result-notes CRUD (newest first).
   - Privacy: two students on the same public horoscope each see only their own notepad; owner's notes invisible to a second student; share-link page unaffected (no notepad in phase 1).
   - Delete the horoscope → `horoscopeNotes` docs cascade-deleted; run the AstrologySettings full recalculation → note content intact.
   - Locale switch (SI/EN) re-renders parent tags, sub-tags, Sanskrit names, section headers, ratios and tag colors immediately.

## Questions for other roles

- **UX** (next role): popup interaction design — drag handle, resize handle, min/max bounds (proposed `320×400`–`900×1200`), z-index/stacking, open/close affordance, default first-open geometry, touch/mobile behaviour; parent-tag strip layout with 13 items (wrap vs scroll) + sub-tag chips (keyboard/`aria-pressed`); the `TagColor` palette (provisional green/red/white/blue/yellow/purple) and the color picker; how the seven section slots stack inside the popup (accordion vs scroll), tag-chip styling for green/red/white, the `(n/m)` ratio placement; empty/not-available states (show `(0/0)` vs omit); restore-on-reopen interaction for `isOpen`/selection (Open Question 10); tag/note text length caps presentation (proposed 500/2000 chars).
- **QA**: test matrix from BA — drag/resize persistence per horoscope; single-parent radio behaviour; sub-tag drill-down for all 13 parents (incl. "Other"); every observation section across `source: "auto"` and `source: "manual"` (manual with/without Navamsa); legacy `CalculatedDetails` without `wargaKendara`; classification boundaries (Uchcha/Neecha/Sama); ratio counts per section (empty/all-white/mixed); student-tag CRUD with each `TagColor`; result-notes CRUD; privacy (notepad not visible cross-student, on public views and share links); cascade delete; recalculation job leaving notes untouched; locale switching.
- **Developer**: new `HoroscopeNote` model + schema; `notepad.*` i18n key sets in both locales; pure derivation functions in `notepadObservations.ts`/`notepadCatalogs.ts`; reuse of `resolveWargaKendara` fallback; debounce/rollback/keepalive in the Notepad shell; the two DELETE-route cascade additions.
- **PM/Domain** (blocking for final derivation rules, not for this design — the hooks slot in place): house-load/Nakshatra-load definitions (Open Questions 1–2), classification rules per kind (Open Questions 2–3), related-warga mapping (Open Question 3), sub-tag → planet mapping (Open Question 4), D1-load-in-warga reading (Open Question 5), Sinhala strings (Open Question 6), Super Admin visibility (Open Question 9), manual-horoscope section limits (Open Question 11).

## Open Items — Triaged

Each item is tagged **[PROVISIONAL — implement now]** (a concrete architecture-level default is locked in this spec; the domain can later swap in behind the same hook/constant without structural change), **[ASSUMED — implement now]** (an assumption needed to build; low reversal risk), or **[DEFERRED — later role]** (requires a decision or dependency outside this feature).

**Implement now (provisional defaults — shapes are locked in this spec):**

1. **House load / Nakshatra load [PROVISIONAL — implement now]** — BA Open Questions 1–2. Concrete default: one neutral tag per section, `{ kind: "load", color: "white", labelKey: "notepad.observation.houseLoad", params: { house, count, sign } }` (count = D1 planets in house N, sign = house N's sign) and `{ kind: "load", color: "white", labelKey: "notepad.observation.nakshatraLoad", params: { nakshatra, pada } }` (from stored Moon Nakshatra). The confirmed domain rule swaps in behind the same tag shape — a one-function change.
2. **D1 load in the warga chart [PROVISIONAL — implement now]** — BA Open Question 5. Concrete default: the D1 planets loading house N, each rendered at its `wargaKendara.d9.planets` position (sign/house/strength); a planet missing from the d9 row renders at its D1 placement, neutral.
3. **Geometry bounds `320×400`–`900×1200`, tag text ≤ 500 chars, note text ≤ 2000 chars, ≤ 200 tags / ≤ 100 notes [PROVISIONAL — implement now]** — BA Open Question 12. Locked as constants in `notepadCatalogs.ts` so UX/PM adjust values in one place without structural change.
4. **Sinhala catalog strings pending [PROVISIONAL — implement now with English fallback]** — US-SN-003/015 edge cases. English/Sanskrit authoritative; fallback chain Sinhala → English; both locales still get every `notepad.*` key (parity test) — only sub-tag Sanskrit-derived display strings fall back.

**Implement now (assumptions):**

5. **Color classification default = `PlanetaryStrength` sign** for planet tags; load/warga tags white (BA Clarifying Assumption 7; Open Questions 2–3). Pluggable `ClassifyObservation` — one-function change when domain rules confirm.
6. **Related house = parent-tag house number in the reference chart** (Chandra/Surya/warga) — BA Clarifying Assumption 4.
7. **Related warga chart = D9 default** — BA Clarifying Assumption 6 / Open Question 3. Per-subject mapping (Marriage → D9, Career → D10 when available) is deferred — see item 11.
8. **Sub-tag → planet = reverse catalog lookup, all matches render** — BA Clarifying Assumption 5 / Open Question 4.
9. **Selection + open state persisted in `notepadState` and restored** — US-SN-001 AC5; the restore interaction itself is UX Open Question 10 (handoff below).
10. **Super Admin visibility = strictly private by default** — BA Open Question 9. If support reads are ever needed, they become a separate audited admin route — never the student route.
11. **Result notes are notepad-level, plain text, newest-first** — BA Clarifying Assumption 11 (per-parent grouping remains an open question, non-blocking).

**Deferred — later role (do not build now):**

12. **Share-link notepad [DEFERRED]** — the share page (`src/app/share/[token]/page.tsx`) is a minimal stub with no detail content; mounting the notepad there needs the share payload to expose the horoscope id and a token-aware note access path (BA Open Question 8 assumed detail-page scope). UX must not design the share-page variant in phase 1.
13. **Per-subject warga mapping (D9/D10 per topic) [DEFERRED]** — needs domain confirmation of the subject → warga table before it can be a catalog; the `wargaKendara` section's warga chart is a constant (`"d9"`) today, so the swap is local.
14. **SearchBookmark cascade delete [DEFERRED — out of scope]** — pre-existing gap in the horoscope DELETE routes (not implemented today). `HoroscopeNote` gets its own `deleteMany` in this feature; the gap is not fixed here.

**Still blocking for PM/Domain (slot in later — no structural impact):** house-load/Nakshatra-load domain definitions, per-kind classification rules, per-subject warga mapping, sub-tag → planet mapping confirmation, D1-load-in-warga reading, Sinhala sub-tag strings, Super Admin visibility decision, manual-horoscope section limits. Each maps to a documented hook/constant/parameter.

## Handoff to UX

UX owns the interaction design; the architecture has locked the data/derivation contracts. Checklist for the UX spec (use `20260813-2011-shadbalaya-architecture.md` and the ShadBala Table for established patterns):

1. **Popup shell:** drag handle + resize handle affordances, z-index/stacking (above page content, below modals), open/close affordance, default first-open geometry (centered/docked), touch/mobile behaviour, viewport clamping (never fully off-screen). Bounds come from the constants (provisional `320×400`–`900×1200`) — adjust values in `notepadCatalogs.ts` only, never per-component.
2. **Parent-tag strip:** layout for 13 parents (wrap vs scroll), radio semantics (`aria-pressed`), same-tag click = no-op (US-SN-002 AC2); sub-tag chips (keyboard, focus management); "Other" parent shows the student-tag area with no sub-tags.
3. **Tag colors:** provisional palette green/red/white/blue/yellow/purple (`TagColor` 1–6) + picker; system tags render only green/red/white by default classifier; confirm the white-on-white edge (Sama strength) has a visible chip treatment.
4. **Observation sections:** stacking of the seven section keys (accordion vs scroll) inside the popup; tag-chip styling; `(n/m)` ratio placement; empty-state decisions (`(0/0)` vs omitted — both are already handled by the component contract); "not available" tag presentation for null sections.
5. **Restore-on-reopen interaction** (BA Open Question 10): `isOpen`/selection restore per horoscope — decide whether the popup auto-opens or shows a badge until clicked.
6. **Length caps presentation:** tag ≤ 500 / note ≤ 2000 chars — counter, truncation, or both.
7. **i18n:** copy all `notepad.*` keys into both locales (parity test enforces); Sinhala sub-tag strings may fall back to English/Sanskrit in phase 1 (provisional default #4).
8. **Out of scope for UX phase 1:** share-link notepad (stub page), per-parent result-notes grouping, per-subject warga mapping.

## Documents Updated

- `specs/architecture/overview.md` — added KAD 10 (Student Notepad), the "Student Notepad Observation Flow" data-flow block, `GET`/`PUT /api/horoscope/:id/note` rows in the API Route Design table, the `horoscopeNotes` collection shape in MongoDB Collections, two `horoscopeNotes` indexes, and two security bullets (caller-scoped note route + per-student privacy).
- `specs/architecture/20260816-1559-student-notes-architecture.md` — this document (rev. 2026-08-16 16:30: locked-in requirements made explicit, Open Items triaged, Developer handoff sharpened, Handoff to UX added).
