# Dasha Periods — Architecture Specification

**Date:** 2026-07-19
**Author:** Architecture Agent
**Based on:** specs/business-analysis/actors.md, specs/business-analysis/data-model.md, specs/business-analysis/20260719-1024-dasha-user-stories.md, docs/dashas.md

---

## 1. Overview

The Dasha Periods system renders Vimshottari Dasha timelines — hierarchical planetary periods that govern major life themes (Mahadasha), sub-periods (Antardasha), and finer subdivisions (Vidasa, Sukshama, Prana). Calculated server-side by the Astrology Calculation Engine during horoscope creation, dasha data is stored as nested JSON in `calculatedDetails.dashas`. The client reads this data and renders a fully client-side nested accordion that auto-expands the currently active period chain and allows free exploration of past and future periods. No additional server computation is required at view time — all period boundaries are pre-calculated and stored at horoscope creation.

## 2. Data Flow

```
                               ┌──────────────────┐
                               │  Horoscope Form  │
                               │  (Birth Details) │
                               └────────┬─────────┘
                                        │ Submit
                                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    API Route: POST /api/horoscope                    │
│                                                                     │
│  ┌─────────────────────┐                                            │
│  │  Astrology Calc     │  Calculates:                               │
│  │  Engine (Server)    │  - Vimshottari Dasha balance at birth      │
│  │                     │  - Mahadasha sequence (9 planets × years)  │
│  │  jyotish-           │  - Antardasha sub-periods per Mahadasha    │
│  │  calculations +     │  - Vidasa sub-sub-periods per Antardasha   │
│  │  swisseph           │  - Sukshama per Vidasa                    │
│  │                     │  - Prana per Sukshama (optional)           │
│  │                     │  - Current period based on birth + now     │
│  └──────────┬──────────┘                                            │
│             │                                                        │
│             ▼                                                        │
│  ┌─────────────────────┐                                            │
│  │  calculatedDetails  │  Stored as nested JSON in MongoDB          │
│  │  .dashas            │                                            │
│  └─────────────────────┘                                            │
└──────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Client: Horoscope Detail Page                     │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  GET /api/horoscope/:id → response.calculatedDetails.dashas  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  DashaSection Component                                      │   │
│  │                                                              │   │
│  │  1. Mount → read dashas from props                           │   │
│  │  2. Compute currentDate = new Date()                         │   │
│  │  3. Walk mahadasha[] → find where startDate <= now < endDate │   │
│  │     → Same for antardasha[], vidasa[], sukshama[], prana[]   │   │
│  │  4. Build expandedPaths = Set<"md-1/ad-2/vd-1/sk-0/...">    │   │
│  │  5. Render nested accordion:                                 │   │
│  │     MahadashaAccordion (defaultExpanded if active)            │   │
│  │       └─ AntardashaAccordion (defaultExpanded if active)     │   │
│  │            └─ VidasaAccordion (defaultExpanded if active)    │   │
│  │                 └─ SukshamaAccordion (defaultExpanded if active)│
│  │                      └─ PranaRow (if prana exists)           │   │
│  │  6. User toggles → add/remove from expandedPaths             │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

### Period Hierarchy

| Level | Name | Contained Within | Typical Duration | Rendered As |
|-------|------|-----------------|-----------------|-------------|
| 1 | Mahadasha | Root | Years | Top-level accordion |
| 2 | Antardasha | Mahadasha | Months | Nested accordion (level 2) |
| 3 | Vidasa | Antardasha | Days–Weeks | Nested accordion (level 3) |
| 4 | Sukshama | Vidasa | Days | Nested accordion (level 4) |
| 5 | Prana | Sukshama | Hours | Flat row (no sub-periods) |

### Current Period Detection Algorithm

```
function findCurrentPeriod(dashas: Dashas, now: Date): CurrentPeriodPath {
    const path: CurrentPeriodPath = {};

    for (const md of dashas.mahadasha) {
        if (isWithin(md, now)) {
            path.mahadashaLord = md.planet;
            path.mahadashaIndex = dashas.mahadasha.indexOf(md);

            for (const ad of md.antardasha) {
                if (isWithin(ad, now)) {
                    path.antardashaLord = ad.planet;
                    path.antardashaIndex = md.antardasha.indexOf(ad);

                    for (const vd of ad.vidasa) {
                        if (isWithin(vd, now)) {
                            path.vidasaLord = vd.planet;
                            path.vidasaIndex = ad.vidasa.indexOf(vd);

                            for (const sk of vd.sukshama) {
                                if (isWithin(sk, now)) {
                                    path.sukshamaLord = sk.planet;
                                    path.sukshamaIndex = vd.sukshama.indexOf(sk);

                                    if (sk.prana && sk.prana.length > 0) {
                                        for (const pr of sk.prana) {
                                            if (isWithin(pr, now)) {
                                                path.pranaLord = pr.planet;
                                                path.pranaIndex = sk.prana.indexOf(pr);
                                                break;
                                            }
                                        }
                                    }
                                    break;
                                }
                            }
                            break;
                        }
                    }
                    break;
                }
            }
            break;
        }
    }

    return path;
}

function isWithin(period: { startDate: string; endDate: string }, now: Date): boolean {
    const start = new Date(period.startDate);
    const end = new Date(period.endDate);
    return start <= now && now < end;
}
```

## 3. API Design

### Main Endpoint

- **GET /api/horoscope/:id** — Returns full horoscope including `calculatedDetails.dashas`
- The dasha data is embedded within the `calculatedDetails` object under `dashas`

**Response shape showing dashas context:**

```json
{
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "owner": { "id": "660e8400-e29b-41d4-a716-446655440001" },
    "name": "John Doe",
    "birthDate": "1990-01-15",
    "birthTime": "14:30",
    "latitude": 6.9271,
    "longitude": 79.8612,
    "isPublic": true,
    "calculatedDetails": {
        "id": "770e8400-e29b-41d4-a716-446655440002",
        "ascendant": { "sign": 1, "degree": 5.0, "lord": 3 },
        "houses": [...],
        "planets": [...],
        "dashas": {
            "mahadasha": [...],
            "currentPeriod": {
                "mahadashaLord": 5,
                "antardashaLord": 6,
                "vidasaLord": 2,
                "sukshamaLord": 8,
                "pranaLord": 4
            }
        },
        "yogas": [...],
        "doshas": { "doshas": [...] }
    },
    "charts": [...]
}
```

### Standalone Dasha Endpoint

- **GET /api/horoscope/:id/dasha** — Returns only the dashas JSON
- **Use case:** When the UI needs to refresh only dasha data (e.g., a user has left the page open for days and period boundaries may have shifted; or after recalculation if the horoscope birth time is edited)
- **Response shape:**

```json
{
    "mahadasha": [
        {
            "planet": 1,
            "startDate": "1990-01-15",
            "endDate": "1996-01-15",
            "durationYears": 6,
            "remainingYearsAtBirth": 6.0,
            "antardasha": [
                {
                    "planet": 2,
                    "startDate": "1990-01-15",
                    "endDate": "1990-10-10",
                    "durationMonths": 9,
                    "vidasa": [
                        {
                            "planet": 3,
                            "startDate": "1990-01-15",
                            "endDate": "1990-02-05",
                            "durationDays": 21,
                            "sukshama": [
                                {
                                    "planet": 4,
                                    "startDate": "1990-01-15",
                                    "endDate": "1990-01-18",
                                    "durationDays": 3,
                                    "prana": [
                                        {
                                            "planet": 5,
                                            "startDate": "1990-01-15T00:00:00",
                                            "endDate": "1990-01-15T12:00:00",
                                            "durationHours": 12
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    ],
    "currentPeriod": {
        "mahadashaLord": 5,
        "antardashaLord": 6,
        "vidasaLord": 2,
        "sukshamaLord": 8,
        "pranaLord": 4
    }
}
```

**Error responses:**

| Status | Condition | Response |
|--------|-----------|----------|
| 401 | No valid session | `{ "error": "Unauthorized" }` |
| 404 | Horoscope not found | `{ "error": "Horoscope not found" }` |
| 403 | Private horoscope, not owner | `{ "error": "Forbidden" }` |
| 500 | Server error | `{ "error": "Internal server error" }` |

## 4. TypeScript Interfaces

```typescript
interface Prana {
    planet: number;
    startDate: string;
    endDate: string;
    durationHours: number;
}

interface Sukshama {
    planet: number;
    startDate: string;
    endDate: string;
    durationDays: number;
    prana: Prana[];
}

interface Vidasa {
    planet: number;
    startDate: string;
    endDate: string;
    durationDays: number;
    sukshama: Sukshama[];
}

interface Antardasha {
    planet: number;
    startDate: string;
    endDate: string;
    durationMonths: number;
    vidasa: Vidasa[];
}

interface Mahadasha {
    planet: number;
    startDate: string;
    endDate: string;
    durationYears: number;
    remainingYearsAtBirth: number;
    antardasha: Antardasha[];
}

interface CurrentPeriod {
    mahadashaLord: number;
    antardashaLord: number;
    vidasaLord?: number;
    sukshamaLord?: number;
    pranaLord?: number;
}

interface Dashas {
    mahadasha: Mahadasha[];
    currentPeriod: CurrentPeriod;
}
```

### Helper Types

```typescript
interface PeriodicElement {
    planet: number;
    startDate: string;
    endDate: string;
}

type PeriodType = 'mahadasha' | 'antardasha' | 'vidasa' | 'sukshama' | 'prana';

interface PeriodPath {
    type: PeriodType;
    index: number;
    planet: number;
    startDate: string;
    endDate: string;
}

// Used to track which periods are currently expanded in the accordion
// Format: "md:<index>/ad:<index>/vd:<index>/sk:<index>"
type ExpandedPath = string;

// Result of findCurrentPeriod()
interface CurrentPeriodPath {
    mahadashaLord: number;
    mahadashaIndex: number;
    antardashaLord: number;
    antardashaIndex: number;
    vidasaLord?: number;
    vidasaIndex?: number;
    sukshamaLord?: number;
    sukshamaIndex?: number;
    pranaLord?: number;
    pranaIndex?: number;
}
```

## 5. Component Architecture

```
DashaSection (props: dashas: Dashas)
├── CurrentPeriodBadge
│   Props: currentPeriod: CurrentPeriod
│   Renders: Compact badge line showing active Mahadasha/Antardasha/
│            Vidasa/Sukshama/Prana lords with planet names and dates
│
└── DashaTimeline
    Props: mahadasha: Mahadasha[], expandedPaths: Set<string>,
           onToggle: (path: string) => void, currentDate: Date
    └── MahadashaAccordion (for each mahadasha)
        Props: mahadasha: Mahadasha, defaultExpanded: boolean,
               isActive: boolean, expandedPaths: Set<string>,
               onToggle: (path: string) => void
        ├── MahadashaHeader
        │   Props: planet: number, startDate: string, endDate: string,
        │          durationYears: number, isActive: boolean, isExpanded: boolean
        │   Renders: Planet name, date range "1990-01-15 — 1996-01-15",
        │            "6 years", active badge (if active), expand/collapse chevron
        │
        └── MahadashaBody
            └── AntardashaAccordion (for each antardasha)
                Props: antardasha: Antardasha, defaultExpanded: boolean,
                       isActive: boolean, depth: number,
                       expandedPaths: Set<string>, onToggle: (path) => void
                ├── AntardashaHeader
                │   Props: planet, startDate, endDate, durationMonths,
                │          isActive, isExpanded
                │   Renders: Indented planet name, date range, "9 months",
                │            active badge, chevron
                │
                └── AntardashaBody
                    └── VidasaAccordion (for each vidasa)
                        Props: vidasa: Vidasa, defaultExpanded: boolean,
                               isActive: boolean, depth: number,
                               expandedPaths: Set<string>, onToggle: (path) => void
                        ├── VidasaHeader
                        │   Props: planet, startDate, endDate, durationDays,
                        │          isActive, isExpanded
                        │   Renders: Further indented planet name, date range,
                        │            "21 days", active badge, chevron
                        │
                        └── VidasaBody
                            └── SukshamaAccordion (for each sukshama)
                                Props: sukshama: Sukshama,
                                       defaultExpanded: boolean,
                                       isActive: boolean, depth: number,
                                       expandedPaths: Set<string>,
                                       onToggle: (path) => void
                                ├── SukshamaHeader
                                │   Props: planet, startDate, endDate,
                                │          durationDays, isActive, isExpanded
                                │   Renders: Deepest indentation, date range,
                                │            "3 days", active badge, chevron
                                │
                                └── SukshamaBody
                                    └── PranaRow (for each prana, if exists)
                                        Props: prana: Prana, isActive: boolean
                                        Renders: Flat row (no sub-accordion),
                                                 planet name, datetime range,
                                                 "12 hours", active indicator
```

### State Management

```typescript
// DashaSection state
interface DashaSectionState {
    expandedPaths: Set<string>;  // tracks which period chains are open
    currentDate: Date;           // "now" used for active period detection
}

// On mount:
// 1. Determine current period chain via findCurrentPeriod(dashas, new Date())
// 2. Build expandedPaths string: "md:<index>/ad:<index>/vd:<index>/sk:<index>"
// 3. Add active path(s) to expandedPaths (only the currently active chain)
// 4. All other periods remain collapsed by default

// On toggle:
// 1. User clicks header → generate period path string from component position
// 2. If path is in expandedPaths → remove (collapse)
// 3. If path is not in expandedPaths → add (expand)
// 4. When expanding a parent, child periods remain in their previous state
//    (do NOT auto-expand children unless they are active)

// Generate path string helper:
function buildPath(mdIndex: number, adIndex?: number, vdIndex?: number, skIndex?: number): string {
    let path = `md:${mdIndex}`;
    if (adIndex !== undefined) path += `/ad:${adIndex}`;
    if (vdIndex !== undefined) path += `/vd:${vdIndex}`;
    if (skIndex !== undefined) path += `/sk:${skIndex}`;
    return path;
}

// Parse path string:
function parsePath(path: string): { md: number; ad?: number; vd?: number; sk?: number } {
    const parts = path.split('/');
    const result: any = {};
    for (const part of parts) {
        const [key, val] = part.split(':');
        result[key] = parseInt(val, 10);
    }
    return result;
}
```

### Active Period Determination

The active period chain is computed entirely client-side by comparing the current date against each period's `startDate`/`endDate` range. The algorithm walks the hierarchy from top to bottom:

1. Find the Mahadasha where `startDate <= now < endDate`. If none found (all periods in the past), no period is active and nothing is auto-expanded.
2. Within that Mahadasha, find the Antardasha containing `now`. If none (data gap — should not happen per contiguity rules), the active chain stops at Mahadasha level.
3. Within that Antardasha, find the Vidasa containing `now`.
4. Within that Vidasa, find the Sukshama containing `now`.
5. Within that Sukshama, find the Prana containing `now` (if prana array exists and is non-empty).

The active chain is visually highlighted at each level with a colored badge or background. Non-active ancestors of active periods are NOT expanded — only the direct active chain is auto-expanded.

### Animation

Expand/collapse transitions use CSS-based smooth height animations:

```css
.dasha-accordion-body {
    overflow: hidden;
    transition: max-height 0.3s ease-in-out;
    max-height: 0;
}

.dasha-accordion-body.expanded {
    max-height: var(--content-height); /* set via JS measurement or auto */
}
```

Alternatively, use a lightweight animation library or the native `details`/`summary` HTML elements with CSS transitions for zero-JS collapse behavior. Given the deep nesting (up to 5 levels), a CSS-based approach is preferred over JS animation libraries to avoid performance overhead.

## 6. Key Design Decisions

### 1. All Dasha Data Pre-Calculated at Creation Time
Dasha periods are fully computed during horoscope creation (server-side, via `jyotish-calculations`) and stored as JSON. No runtime calculation is needed at view time. This means the client only needs to compare dates, not perform any astrological computations — keeping the frontend lightweight and the view instantaneous.

### 2. Client-Side Current Period Detection
The current active period is determined entirely on the client by comparing `new Date()` against the stored date ranges. This avoids an API call on every view and makes the dasha section fully offline-capable once the horoscope data is loaded. The `currentPeriod` object in the API response can be used as a quick-reference shortcut but is not required for the UI to function — the client can compute it independently.

### 3. Path-Based Accordion State Tracking
Using a `Set<string>` with path strings like `"md:0/ad:2/vd:1/sk:0"` to track expanded periods is simple, serializable, and allows direct lookup of any period's expansion state without nested state objects. This avoids deeply nested React state that would be difficult to update immutably.

### 4. CSS Transitions Over JS Animation Libraries
For a deeply nested accordion (up to 5 levels), CSS `max-height` transitions are preferred over JS animation libraries to avoid the performance cost of running multiple simultaneous JS animations. The `max-height` approach is well-supported, GPU-accelerated, and zero-dependency.

### 5. Separate Dasha Endpoint for Targeted Refetching
The standalone `GET /api/horoscope/:id/dasha` endpoint exists so the UI can refresh dasha data without reloading the entire horoscope. This is useful when a user keeps a horoscope open across midnight (period boundaries don't shift — but if recalculation is triggered by a birth time edit, only dasha data may need updating). The endpoint also enables partial cache invalidation scenarios.

### 6. Prana as Optional Deepest Level
Prana periods use hours as their duration unit, making them the finest granularity. They are nested under Sukshama and are rendered as flat rows (not another accordion level) because they have no sub-periods. Their arrays MAY be empty (if the calculation engine does not compute Prana) without breaking the UI — the component only renders PranaRow when `prana.length > 0`.

### 7. Empty Arrays for Missing Sub-Periods
Every period type's sub-period array MUST be present (even if empty `[]`) rather than missing from the JSON. This allows the component to unconditionally map over child arrays without null-checking at every level. The contract is enforced by the calculation engine and validated at the API boundary.

### 8. No Server-Side Pagination for Dasha Data
The complete dasha timeline for a human lifespan typically contains ~9 Mahadashas, ~81 Antardashas, and sub-periods scaling geometrically. Even with Vidasa/Sukshama/Prana, the total JSON payload is well under 100 KB for a full 120-year timeline. No pagination or lazy loading is needed — the entire dataset is sent in a single response and rendered client-side.

## 7. Performance Considerations

### 7.1 JSON Payload Size
The dasha payload for a full 120-year timeline (all Mahadasha, Antardasha, Vidasa) is approximately:
- 9 Mahadasha entries (one per planet)
- 9 Antardasha per Mahadasha = ~81 entries
- 9 Vidasa per Antardasha = ~729 entries (with Sukshama Prana this grows but remains manageable)
- Estimated total: 15–50 KB depending on Sukshama/Prana inclusion

This is negligible compared to typical page payloads and requires no pagination.

### 7.2 Client-Side Processing
Period detection requires iterating through arrays with up to ~800 entries in the worst case (all levels populated). This is a linear O(n) operation on arrays totaling < 1000 elements — negligible even on mobile devices. No virtualization or windowing is needed.

### 7.3 Render Performance
With up to 5 levels of nesting, the worst-case rendered DOM is:
- All Mahadasha expanded: 9 visible
- All Antardasha expanded: 9 × 9 = 81 visible
- All Vidasa expanded: 9 × 81 = 729 visible
- All Sukshama expanded: 9 × 729 = ~6,500 visible

This many DOM nodes could cause jank. **Mitigations:**
- Default to only the active chain expanded (typically 4 periods, not thousands)
- User must manually expand to see deeper levels
- If performance issues arise in testing, add a "collapse all" button or limit expand depth to 3 levels by default
- Use `React.memo` on accordion components to prevent re-renders when toggling unrelated periods

### 7.4 Animation Performance
CSS `max-height` transitions can cause layout thrashing if many elements animate simultaneously. **Mitigations:**
- Stagger collapse animations (e.g., 50ms delay per level) to avoid simultaneous transitions
- Use `transform` and `opacity` for chevron rotation (GPU-composited, no layout trigger)
- Consider `content-visibility: auto` on collapsed bodies to skip off-screen rendering

### 7.5 Data Freshness
The `currentDate` used for active period detection is captured once on component mount. If a user leaves a horoscope page open across midnight, the active period check remains stale. **Mitigations:**
- Low-priority: Re-check every 60 seconds via `setInterval` — if the active period changed, highlight the new one
- Practical: Most sessions are shorter than the minimum sub-period duration (hours for Prana, days for Sukshama+), so this edge case is rare
- The standalone dasha endpoint allows programmatic refetching if needed

## 8. Security Considerations

Dasha data access follows the same visibility rules as the horoscope it belongs to:

| Visibility | Accessible To |
|------------|---------------|
| Public horoscope | Any authenticated user |
| Private horoscope | Owner only |
| Private horoscope + Share link | Anyone with valid share token (via GET /api/share/:token) |
| Any horoscope | Super Admin |

**API enforcement:**
- `GET /api/horoscope/:id/dasha` checks `getServerSession(authOptions)` — returns 401 if unauthenticated
- For private horoscopes, checks `horoscope.owner.id === session.user.id` — returns 403 if mismatch
- Super Admin bypasses ownership check
- Shared horoscopes accessed via the share token route embed dasha data in the response — no special dasha-only share endpoint is needed

**No additional dasha-specific security rules.** Dasha periods are astrological calculation results — they contain no PII beyond what is already in the horoscope (birth date/time, which is visible to anyone who can view the horoscope). The `currentPeriod` object reveals no additional private information.

**CSRF:** All dasha endpoints are read-only (GET), so CSRF is not a concern. If a future endpoint recalculates dashas (POST/PUT/PATCH), standard CSRF protections (SameSite cookies, CSRF tokens) must be applied.

## 9. Database Schema Update

### calculatedDetails Collection — Expanded Dashas Field

The `dashas` field in `calculatedDetails` is a nested JSON object. Below is the complete schema for this field:

```
dashas: {
    mahadasha: [{
        planet: number,              // enum value from Planet (1=Sun..9=Ketu)
        startDate: string,           // ISO date YYYY-MM-DD
        endDate: string,             // ISO date YYYY-MM-DD
        durationYears: number,       // years (e.g., 6, 10, 20)
        remainingYearsAtBirth: number, // balance of dasha at birth (first period only)
        antardasha: [{
            planet: number,
            startDate: string,
            endDate: string,
            durationMonths: number,  // months
            vidasa: [{
                planet: number,
                startDate: string,
                endDate: string,
                durationDays: number, // days
                sukshama: [{
                    planet: number,
                    startDate: string,
                    endDate: string,
                    durationDays: number,
                    prana: [{
                        planet: number,
                        startDate: string,   // ISO datetime YYYY-MM-DDTHH:mm:ss
                        endDate: string,     // ISO datetime YYYY-MM-DDTHH:mm:ss
                        durationHours: number
                    }]
                }]
            }]
        }]
    }],
    currentPeriod: {
        mahadashaLord: number,
        antardashaLord: number,
        vidasaLord: number | null,    // optional — null if not in a vidasa
        sukshamaLord: number | null,  // optional — null if not in a sukshama
        pranaLord: number | null      // optional — null if not in a prana
    }
}
```

### Mongoose Schema (conceptual)

```typescript
const PranaSchema = new Schema({
    planet: { type: Number, required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    durationHours: { type: Number, required: true }
});

const SukshamaSchema = new Schema({
    planet: { type: Number, required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    durationDays: { type: Number, required: true },
    prana: { type: [PranaSchema], default: [] }
});

const VidasaSchema = new Schema({
    planet: { type: Number, required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    durationDays: { type: Number, required: true },
    sukshama: { type: [SukshamaSchema], default: [] }
});

const AntardashaSchema = new Schema({
    planet: { type: Number, required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    durationMonths: { type: Number, required: true },
    vidasa: { type: [VidasaSchema], default: [] }
});

const MahadashaSchema = new Schema({
    planet: { type: Number, required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    durationYears: { type: Number, required: true },
    remainingYearsAtBirth: { type: Number, required: true },
    antardasha: { type: [AntardashaSchema], default: [] }
});

const CurrentPeriodSchema = new Schema({
    mahadashaLord: { type: Number, required: true },
    antardashaLord: { type: Number, required: true },
    vidasaLord: { type: Number, default: null },
    sukshamaLord: { type: Number, default: null },
    pranaLord: { type: Number, default: null }
});

// Applied to the main calculatedDetails schema
const CalculatedDetailsSchema = new Schema({
    id: { type: String, required: true, unique: true, default: uuidv4 },
    horoscope: { id: { type: String, required: true } },
    ascendant: { sign: Number, degree: Number, lord: Number },
    houses: [HouseSchema],
    planets: [PlanetSchema],
    nakshatra: NakshatraSchema,
    dashas: {
        mahadasha: { type: [MahadashaSchema], default: [] },
        currentPeriod: { type: CurrentPeriodSchema, required: true }
    },
    lord22ndDrekkana: Number,
    lord64thNavamsa: Number,
    badhakaPlanet: [Number],
    marakaPlanets: [Number],
    atmakaraka: Number,
    yogas: [YogaSchema],
    doshas: { doshas: [DoshaSchema] },
    createdAt: { type: Date, default: Date.now }
});
```

### Date Format Validation Rules

| Field | Format | Example |
|-------|--------|---------|
| Prana startDate/endDate | ISO datetime | `"1990-01-15T00:00:00"` |
| All other startDate/endDate | ISO date | `"1990-01-15"` |

### Contiguity Validation (Enforced at Calculation Time)

- Parent `startDate` === first child `startDate`
- Parent `endDate` === last child `endDate`
- Children within same parent are contiguous (no gaps, no overlaps)
- Arrays are present even if empty

### Indexes

Existing `calculatedDetails` index:
- `{ "horoscope.id": 1 }` (unique) — primary lookup by horoscope

New index for dasha search:
- `{ "dashas.currentPeriod.mahadashaLord": 1 }` — enables efficient querying of horoscopes currently governed by a specific planet's Mahadasha (future feature: "Show all horoscopes currently in Saturn Mahadasha")
