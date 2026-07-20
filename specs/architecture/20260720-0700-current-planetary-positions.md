# Current Planetary Positions — Architecture Specification

**Date:** 2026-07-20
**Author:** Architecture Agent
**Based on:** specs/business-analysis/20260720-0658-current-planetary-positions.md, specs/architecture/overview.md, specs/architecture/20260719-1045-dasha-architecture.md

---

## 1. Overview

The Current Planetary Positions feature overlays real-time transit positions of the nine planets (Sun through Ketu) onto the House (Rasi) chart, computed server-side at request time via Swiss Ephemeris. Unlike all other chart data — which is pre-calculated at horoscope creation and stored in MongoDB — current planetary positions are computed ephemerally on every request, never persisted, and returned as overlay data alongside the existing chart response. The client renders them with a distinct visual style (different color, outline, or symbol) to differentiate transiting planets from natal planets on the same chart.

This feature is exclusive to the House chart type. Other chart types (birth, navamsa, drekkana, etc.) ignore the `includeCurrentPlanets` parameter, preserving the existing behavior.

### Scope

| Aspect | In Scope | Out of Scope |
|--------|----------|--------------|
| Chart types | House (Rasi) chart only | Birth chart, Navamsa D9, Drekkana D3, Dasamsa D10, Chandra Lagna, Surya Lagna |
| Planets | Sun through Ketu (9 planets, matching Planet enum) | None |
| Calculation | Current ecliptic longitude, sign, degree, absolute degree, house mapping (by birth cusps), nakshatra, pada, retrograde, combustion, strength | Aspect calculations, yoga detection, lord analysis — transit aspects between current and birth planets are a future feature |
| Storage | None — computed in real-time | No MongoDB persistence, no caching layer beyond HTTP caching headers |

---

## 2. Data Flow

```
                                  ┌──────────────────────┐
                                  │  House Chart View    │
                                  │  (D3.js SVG Chart)   │
                                  └──────────┬───────────┘
                                             │ User toggles "Show Current Planets"
                                             ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                    Client: CurrentPlanetToggle + ChartView                │
│                                                                           │
│  1. Toggle ON → check if currentPlanets data already in memory           │
│     ├─ If cached → instant re-render overlay                             │
│     └─ If not → fetch from API                                            │
│                                                                           │
│  2. Fetch: GET /api/horoscope/:id/chart/house?includeCurrentPlanets=true │
│     ├─ Normal chart data unchanged                                       │
│     └─ Additional top-level key: "currentPlanets": [...]                 │
│                                                                           │
│  3. Render overlay:                                                       │
│     ├─ Current planets in distinct color/stroke                          │
│     ├─ Birth planets remain as-is                                        │
│     ├─ Merged indicator if same position                                 │
│     └─ Legend updated with "Birth Planet" / "Current Planet" labels      │
│                                                                           │
│  4. Toggle OFF → hide overlay (keep data in memory for instant re-show)  │
│  5. FilterConfig persisted (if user has saved filters)                    │
└───────────────────────────────────────────────────────────────────────────┘
                                             │
                                             ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                    API Route: GET /api/horoscope/:id/chart/:type           │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  Request Pipeline:                                                  │  │
│  │                                                                     │  │
│  │  1. getServerSession(authOptions) → 401 if missing                  │  │
│  │  2. connectDB()                                                     │  │
│  │  3. Load horoscope document                                         │  │
│  │  4. Load calculatedDetails (houses, cusps, planets for birth data)  │  │
│  │  5. Load chart document for :type                                   │  │
│  │  6. If type === "house" && includeCurrentPlanets === true:          │  │
│  │     → computeCurrentPlanets(horoscope.ayanamsha, calculatedDetails) │  │
│  │  7. Return chart data + currentPlanets (if computed)                 │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  computeCurrentPlanets(ayanamsha, birthHouses):                     │  │
│  │                                                                     │  │
│  │  1. Get current system timestamp (new Date())                       │  │
│  │  2. For each planet in Planet enum (1..9):                         │  │
│  │     a. Get current ecliptic longitude from swisseph                 │  │
│  │     b. Apply ayanamsha correction                                   │  │
│  │     c. Determine zodiac sign from corrected longitude               │  │
│  │     d. Determine degree within sign                                 │  │
│  │     e. Determine absolute degree (0..360)                           │  │
│  │     f. Map to birth house: find which house cusp range contains     │  │
│  │        the current longitude                                        │  │
│  │     g. Compute nakshatra and pada from longitude                    │  │
│  │     h. Determine retrograde status from speed (negative = retro)    │  │
│  │     i. Determine combustion status (if within orb of Sun)           │  │
│  │     j. Determine strength (dig bala, uchcha/neecha based on sign)   │  │
│  │  3. Return CurrentPlanetRecord[]                                    │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────┘
```

### Sequence Diagram

```
┌─────┐     ┌──────────┐    ┌──────────────┐    ┌────────┐    ┌──────────────┐
│User │     │Frontend  │    │API: chart/   │    │MongoDB │    │Ephemeris     │
│     │     │          │    │:type         │    │        │    │(swisseph)    │
└──┬──┘     └───┬──────┘    └──────┬───────┘    └────┬───┘    └──────┬───────┘
   │            │                  │                 │                │
   │ Toggle ON  │                  │                 │                │
   │───────────>│                  │                 │                │
   │            │ GET chart/house  │                 │                │
   │            │ ?includeCurrent  │                 │                │
   │            │ Planets=true     │                 │                │
   │            │─────────────────>│                 │                │
   │            │                  │ Fetch horoscope │                │
   │            │                  │ + houses        │                │
   │            │                  │────────────────>│                │
   │            │                  │<────────────────│                │
   │            │                  │                 │                │
   │            │                  │ Compute current │                │
   │            │                  │ planet positions│                │
   │            │                  │─────────────────────────────────>│
   │            │                  │<─────────────────────────────────│
   │            │                  │                 │                │
   │            │ Return chart +  │                 │                │
   │            │ currentPlanets[]│                 │                │
   │            │<─────────────────│                 │                │
   │ Render     │                  │                 │                │
   │ overlay    │                  │                 │                │
   │<───────────│                  │                 │                │
   │            │                  │                 │                │
   │ Toggle OFF │                  │                 │                │
   │───────────>│                  │                 │                │
   │            │ (hide overlay,   │                 │                │
   │            │  keep data)      │                 │                │
   │<───────────│                  │                 │                │
   │            │                  │                 │                │
```

---

## 3. API Design

### Chart Endpoint Extension

- **GET /api/horoscope/:id/chart/house?includeCurrentPlanets=true**
- **Query parameter:** `includeCurrentPlanets` — boolean. When `true` and chart type is `house`, the response includes a `currentPlanets` array at the top level.
- For non-house chart types, the parameter is silently ignored.

**Response shape (additional top-level key):**

```json
{
    "id": "chart-uuid",
    "horoscope": { "id": "horoscope-uuid" },
    "type": "house",
    "data": { ... },
    "imageKey": "chart-image-key",
    "createdAt": "2026-07-20T10:00:00.000Z",
    "currentPlanets": [
        {
            "name": 1,
            "sign": 4,
            "degree": 15.5,
            "absoluteDegree": 105.5,
            "house": 7,
            "nakshatra": 8,
            "pada": 3,
            "retrograde": false,
            "combustion": false,
            "strength": "Uchcha"
        }
    ]
}
```

**Response without param (unchanged):**

```json
{
    "id": "chart-uuid",
    "horoscope": { "id": "horoscope-uuid" },
    "type": "house",
    "data": { ... },
    "imageKey": "chart-image-key",
    "createdAt": "2026-07-20T10:00:00.000Z"
}
```

### Standalone Current Planets Endpoint (Optional)

- **GET /api/horoscope/:id/current-planets** — Returns only the current planets array without the chart data
- **Use case:** When the UI has already loaded the chart but needs to refresh current positions (e.g., after a long idle period, or when the user explicitly requests a refresh)
- **Response shape:**

```json
{
    "currentPlanets": [
        {
            "name": 1,
            "sign": 4,
            "degree": 15.5,
            "absoluteDegree": 105.5,
            "house": 7,
            "nakshatra": 8,
            "pada": 3,
            "retrograde": false,
            "combustion": false,
            "strength": "Uchcha"
        }
    ],
    "computedAt": "2026-07-20T10:05:00.000Z"
}
```

### Error Responses

| Status | Condition | Response |
|--------|-----------|----------|
| 401 | No valid session | `{ "error": "Unauthorized" }` |
| 404 | Horoscope not found | `{ "error": "Horoscope not found" }` |
| 403 | Private horoscope, not owner | `{ "error": "Forbidden" }` |
| 422 | Ephemeris calculation failure | `{ "error": "Calculation failed", "detail": "<error message>" }` |
| 500 | Server error | `{ "error": "Internal server error" }` |

---

## 4. Calculation Strategy

### Core Algorithm

```
function computeCurrentPlanets(
    ayanamsha: Ayanamsha,
    birthHouses: House[]
): CurrentPlanetRecord[] {
    const now = new Date();
    const julianDay = toJulianDay(now);

    return Object.values(Planet)
        .filter(p => typeof p === 'number')
        .map((planet: Planet) => {
            // 1. Get raw ephemeris data
            const { longitude, latitude, speed } =
                swisseph.getPlanetData(planet, julianDay, ayanamsha);

            // 2. Determine retrograde from speed
            const retrograde = speed < 0;

            // 3. Determine sign and degree
            const sign = Math.floor(longitude / 30) + 1;
            const degree = longitude % 30;

            // 4. Map to birth house
            const house = birthHouses.find(h =>
                longitude >= h.startDegree && longitude < h.endDegree
            );

            // 5. Compute nakshatra
            const { nakshatra, pada } = computeNakshatra(longitude);

            // 6. Determine combustion (planet within orb of Sun)
            const combustion = isCombust(planet, sunLongitude);

            // 7. Determine strength
            const strength = computeStrength(planet, sign);

            return {
                name: planet,
                sign,
                degree,
                absoluteDegree: longitude,
                house: house?.houseNumber ?? null,
                nakshatra,
                pada,
                retrograde,
                combustion,
                strength
            };
        });
}
```

### Ayanamsha Consistency

The current planet calculation MUST use the **same ayanamsha** as the horoscope's birth chart. The `horoscope.ayanamsha` field (one of `"lahiri"`, `"raman"`, `"krishnamurti"`, `"yukteshwar"`) is passed to the ephemeris calculation engine. This ensures that transit positions are referenced to the same sidereal zodiac as the natal chart, making house mapping and comparison valid.

### House Mapping

Each current planet is placed into the house whose cusp range (`startDegree` to `endDegree`, stored per `House` in `calculatedDetails.houses`) contains the planet's current ecliptic longitude. House boundaries are sidereal (already ayanamsha-corrected). If a planet falls outside all house ranges (theoretically impossible with contiguous 360° coverage), `house` is set to `null`.

### Combustion Detection

A planet is combust if it is within a certain angular distance from the Sun. Standard combustion orbs:

| Planet | Combustion Orb (degrees from Sun) |
|--------|----------------------------------|
| Moon | 12 |
| Mars | 17 |
| Mercury | 14 |
| Jupiter | 11 |
| Venus | 10 |
| Saturn | 16 |
| Rahu | N/A (not combust) |
| Ketu | N/A (not combust) |

These orbs are defined as constants in the calculation module and can be adjusted per astrological tradition.

### Retrograde Detection

Retrograde status is determined by the planet's ecliptic speed (degrees/day) returned by Swiss Ephemeris. A negative speed indicates retrograde motion. Rahu and Ketu are always retrograde by definition (their nodes move backwards through the zodiac).

### Strength Calculation

Current planet strength follows the same logic as birth planet strength: planetary dignity (exaltation, debilitation, own sign, moolatrikona, mitra, shatru, sama) based on the planet's current sign placement. The same `computeStrength()` function used during horoscope creation is reused for current planets, ensuring consistent strength evaluation.

---

## 5. Caching Strategy

### No Persistent Caching

Current planet positions are **never stored in MongoDB**. This is a deliberate design decision — transit data is inherently ephemeral and time-sensitive. Storing it would require:
- A background job to refresh all stored positions daily (or more frequently)
- Cache invalidation logic tied to server time
- Additional storage for data that is only meaningful at the moment of access

### In-Memory Request Scoping

- Current planets are computed per-request and returned in the API response
- The client may cache the result in memory (React state) for the duration of the user's session on that chart view
- Toggling the overlay off/on does NOT re-fetch — the data is preserved in memory

### HTTP Caching Headers

The API response for chart data with `includeCurrentPlanets=true` should set:
```
Cache-Control: private, no-cache, no-store, must-revalidate
```
This prevents intermediate caches from serving stale transit data. The chart portion of the response could theoretically be cached separately, but the mixed nature of the response (static chart + dynamic current planets) makes splitting impractical. When performance becomes a concern, two separate endpoints (one for chart data, one for current planets) would allow independent caching of the static chart data.

### Client-Side Refresh

- The standalone `GET /api/horoscope/:id/current-planets` endpoint allows the client to refresh current positions without re-fetching the entire chart
- A typical refresh strategy: re-fetch current planets every 5–10 minutes if the chart view is open and the overlay is enabled
- On page load, always fetch fresh data — never restore from local storage (positions change continuously)

---

## 6. Component Architecture

```
ChartView (props: horoscopeId: string, chartData: ChartData, isHouseChart: boolean)
│
├── ChartSVG
│   Props: chartData, chartType, birthPlanets, currentPlanets?, showOverlay
│   Renders: D3.js SVG chart with houses, planets, signs
│   │
│   ├── BirthPlanetLayer
│   │   Props: planets: PlanetRecord[], houseMap: HouseMap
│   │   Renders: Natal planet symbols at birth positions
│   │
│   └── CurrentPlanetOverlay (conditional)
│       Props: planets: CurrentPlanetRecord[], birthPlanets: PlanetRecord[],
│              onPlanetHover: (planet) => void, onPlanetClick: (planet) => void
│       Renders: Transit planet symbols in distinct style,
│                merged symbols for coincident positions,
│                interactive tooltips
│
├── ChartLegend
│   Props: showCurrentPlanets: boolean
│   Renders: Legend with symbol mappings for birth + current planets
│
├── CurrentPlanetToggle
│   Props: enabled: boolean, loading: boolean,
│          onToggle: (enabled: boolean) => void
│   Renders: Toggle button/switch with localized label
│   └── If loading: show spinner or disabled state
│
└── PlanetTooltip (shown on hover/click)
    Props: planet: CurrentPlanetRecord | null,
           isCurrentPlanet: boolean, language: "si" | "en"
    Renders: Detail panel with planet name (localized),
             sign + degree, nakshatra + pada,
             retrograde/combustion status, strength
```

### Component Responsibilities

| Component | Key Responsibility |
|-----------|-------------------|
| `ChartView` | Orchestrates chart rendering; manages currentPlanets fetched state, overlay toggle state |
| `CurrentPlanetToggle` | Renders on/off switch; calls parent `onToggle`; shows loading indicator during fetch |
| `CurrentPlanetOverlay` | Renders overlay SVG layer on top of birth chart; handles merged positions |
| `PlanetTooltip` | Shows detailed info on hover/click for both birth and current planets |
| `ChartLegend` | Shows both "Birth Planet" and "Current Planet" legend entries when overlay is active |

### Merged Position Rendering

When a current planet occupies the same house and approximate degree as its birth counterpart, the overlay renders a **split symbol** that combines both indicators. The strategy:

1. If `abs(currentDegree - birthDegree) < 2°`: render a split symbol (left half: birth Unicode glyph, right half: current Sinhala first-letter symbol) with a sky-blue border around the combined element
2. If the same house but degree difference ≥ 2°: render both symbols separately at their respective positions within the house
3. If different houses: render both at their respective house positions (normal case)

---

## 7. TypeScript Interfaces

```typescript
// Core type returned by the calculation engine
interface CurrentPlanetRecord {
    name: Planet;               // Planet enum (1..9)
    sign: ZodiacSign;           // ZodiacSign enum (1..12)
    degree: number;             // Degrees within sign (0..30)
    absoluteDegree: number;     // Ecliptic longitude (0..360)
    house: number | null;       // Mapped birth house number (1..12), null if unmappable
    nakshatra: Nakshatra;       // Nakshatra enum value
    pada: number;               // 1..4
    retrograde: boolean;        // true if planet is retrograde
    combustion: boolean;        // true if planet is combust (within orb of Sun)
    strength: PlanetaryStrength; // PlanetaryStrength enum
}

// Response envelope when includeCurrentPlanets=true
interface ChartWithCurrentPlanetsResponse {
    id: string;
    horoscope: { id: string };
    type: string;
    data: ChartData;
    imageKey: string;
    createdAt: string;
    currentPlanets?: CurrentPlanetRecord[];  // Only present when requested and type=house
}

// Standalone current planets endpoint response
interface CurrentPlanetsResponse {
    currentPlanets: CurrentPlanetRecord[];
    computedAt: string;  // ISO timestamp of calculation
}

// Client-side state for the overlay
interface CurrentPlanetOverlayState {
    enabled: boolean;           // Toggle state
    data: CurrentPlanetRecord[] | null;  // Fetched data (null = not yet fetched)
    loading: boolean;           // Fetch in progress
    error: string | null;       // Fetch error message
    lastFetchedAt: number | null;  // Timestamp of last successful fetch (for refresh decisions)
    hoveredPlanet: CurrentPlanetRecord | null;  // Currently hovered planet for tooltip
}

// FilterConfig addition for persistence
interface FilterConfig {
    // ... existing fields ...
    currentPlanetPositions: boolean;  // Default: false
}
```

### Helper Types

```typescript
// Combustion orbs configuration
interface CombustionOrbConfig {
    [Planet.SUN]: never;      // Sun is never combust
    [Planet.MOON]: number;    // 12
    [Planet.MARS]: number;    // 17
    [Planet.MERCURY]: number; // 14
    [Planet.JUPITER]: number; // 11
    [Planet.VENUS]: number;   // 10
    [Planet.SATURN]: number;  // 16
    [Planet.RAHU]: never;     // Not combust
    [Planet.KETU]: never;     // Not combust
}

// Merged position descriptor (for rendering coincident birth + current planets)
interface MergedPlanetPosition {
    house: number;
    birthPlanet: PlanetRecord;
    currentPlanet: CurrentPlanetRecord;
    degreeDelta: number;  // Absolute difference in degrees
    renderMode: 'split' | 'separate';  // Split symbol if delta < threshold, separate if >= threshold
}

// Function signature for the calculation engine
type ComputeCurrentPlanetsFn = (
    ayanamsha: Ayanamsha,
    birthHouses: House[]
) => CurrentPlanetRecord[];
```

---

## 8. Frontend State

### State Shape

```typescript
// Managed within ChartView or a dedicated CurrentPlanetsProvider
interface CurrentPlanetsState {
    // Toggle state
    overlayEnabled: boolean;        // Current UI toggle state
    
    // Data
    currentPlanets: CurrentPlanetRecord[] | null;
    
    // Fetch lifecycle
    fetchStatus: 'idle' | 'loading' | 'success' | 'error';
    fetchError: string | null;
    lastFetchTimestamp: number | null;
    
    // Interaction
    hoveredPlanetName: Planet | null;
    selectedPlanetName: Planet | null;
}
```

### State Flow

```
Component Mount
    │
    ├── Read FilterConfig.currentPlanetPositions
    │   ├── true  → set overlayEnabled = true
    │   ├── false → set overlayEnabled = false
    │   └── null  → set overlayEnabled = false (default)
    │
    └── If overlayEnabled && !currentPlanets → fetchCurrentPlanets()

Toggle ON
    │
    ├── set overlayEnabled = true
    ├── set fetchStatus = 'loading'
    ├── Fetch GET /api/horoscope/:id/current-planets (or re-fetch chart with param)
    │   ├── Success → set currentPlanets, fetchStatus = 'success', lastFetchTimestamp = now
    │   └── Error   → set fetchError, fetchStatus = 'error', overlayEnabled = false
    └── Save preference: if FilterConfig exists → update currentPlanetPositions = true

Toggle OFF
    │
    ├── set overlayEnabled = false
    └── Save preference: if FilterConfig exists → update currentPlanetPositions = false

Refresh (periodic or manual)
    │
    ├── If overlayEnabled && (now - lastFetchTimestamp > REFRESH_INTERVAL)
    │   → fetchCurrentPlanets() (silent refresh — no loading state change)
    └── Update currentPlanets, lastFetchTimestamp
```

### FilterConfig Persistence

The `currentPlanetPositions` boolean is stored in the user's `FilterConfig` document (MongoDB collection: `savedFilters`). The save is debounced (300ms) and only fires if the user has an existing `FilterConfig` — new users do not automatically get one created by this toggle.

### Memory-Only Cache

When the overlay is toggled OFF, the `currentPlanets` data is retained in React state. If the user toggles back ON within the same session, the cached data is used immediately without re-fetching. The data is discarded when:
- The component unmounts (user navigates away)
- A manual "refresh" action is triggered
- The data exceeds `MAX_CACHE_AGE` (default: 10 minutes)

---

## 9. Key Design Decisions

### 1. Real-Time Computation Over Storage

Current planet positions are computed at request time rather than stored in MongoDB. This avoids:
- Stale transit data (positions change continuously)
- A background cron job to refresh stored positions
- Storage bloat for time-series transit data
- Cache invalidation complexity

The trade-off is increased per-request latency (~200–500ms for the ephemeris calculation). This is acceptable because:
- The calculation runs only when explicitly requested (`?includeCurrentPlanets=true`)
- The user has a toggle switch — they opt into the extra latency
- Results can be cached client-side for the session duration

### 2. Same Ayanamsha, Same Strength Logic

Current planet strength and sign determination use the **identical** logic and ayanamsha as the birth chart calculation. This ensures that a planet in "exaltation" in the transit chart means the same thing as in the natal chart. The `computeStrength()` function is shared code, not duplicated.

### 3. Exclusive to House Chart

The current planet overlay is limited to the House (Rasi) chart because:
- The House chart is the primary chart used for transit analysis in Vedic astrology
- Birth house cusps are the reference frame for mapping current planet positions
- Other chart types (Navamsa, Drekkana, Dasamsa) are divisional charts used for specific life areas — overlaying transits on them adds complexity without clear user benefit in v1
- Future iterations may extend the overlay to other chart types based on user feedback

### 4. Standalone Refresh Endpoint

The `GET /api/horoscope/:id/current-planets` endpoint exists to refresh transit data without re-fetching the entire chart. This is important for:
- Users who keep a chart open for extended periods (study sessions)
- Periodic auto-refresh (every 5–10 minutes) in the background
- Avoiding re-download of the complete chart SVG/chart data JSON when only the overlay changed

### 5. Client-Side Merge for Coincident Positions

When a current planet and its birth counterpart occupy the same house at a similar degree, the rendering layer must visually indicate both positions at once. The decision to handle this client-side (rather than having the server return a "merged" flag) keeps the API simple — the server returns independent arrays, and the client determines overlap during rendering. This also allows the rendering strategy to evolve without API changes. The merged rendering uses a split symbol (left: birth Unicode glyph, right: current Sinhala first-letter) so both are simultaneously visible.

### 6. Preference Persistence via FilterConfig

The toggle state is persisted using the existing `FilterConfig` mechanism (MongoDB `savedFilters` collection) rather than creating a new user preference collection. This leverages the existing CRUD pattern and ensures that the preference is available across sessions and devices. The default value is `false` — current planets are opt-in.

### 7. No Aspect Calculations in v1

Transit aspects (angular relationships between current planets and birth planets) are deliberately excluded from this feature. The v1 scope is limited to positional overlay — showing *where* each planet is now relative to the birth chart houses. Aspect analysis between transiting and natal planets is a natural future extension but adds significant complexity (aspect orbs, applying/separating aspects, house rulership analysis).

---

## 10. Performance Considerations

### 10.1 Calculation Latency

The ephemeris calculation for 9 planets (Sun through Ketu) using `jyotish-calculations` + `swisseph-v2` is expected to complete in **200–500ms** under normal server load. This includes:
- Julian day computation: <1ms
- Per-planet ephemeris lookup: ~20–50ms each
- Sign/degree/house/nakshatra/strength computation: <5ms each
- Total: ~200–500ms for 9 planets

### 10.2 Impact on Chart API Latency

The existing chart API endpoint (without current planets) typically responds in **50–100ms** (mostly DB lookup + JSON serialization). Adding `includeCurrentPlanets=true` adds 200–500ms of ephemeris computation, bringing the total to **250–600ms**. This is acceptable for an opt-in feature that the user activates via toggle.

### 10.3 Mitigation Strategies

| Concern | Mitigation |
|---------|------------|
| CPU-intensive ephemeris calls under concurrent load | Rate limiting on the endpoint (max 30 requests/min/user); consider a simple in-memory cache with 1-second TTL to deduplicate identical requests in rapid succession |
| Slow response on low-end servers | The calculation is synchronous and single-threaded — if latency exceeds 1s, consider moving to a dedicated `/api/horoscope/:id/current-planets` endpoint that can be scaled independently |
| Mobile data usage | The current planets payload is ~500 bytes for 9 planets — negligible |
| Backend thundering herd | If many users toggle on simultaneously (e.g., at a specific astrological event), each request triggers independent ephemeris calls. Mitigated by rate limiting and the per-request nature (no shared cache, so no cache-stampede risk) |

### 10.4 Payload Size

The `currentPlanets` array for 9 planets is approximately **450–600 bytes** of JSON:

```json
"currentPlanets": [
    {"name":1,"sign":4,"degree":15.5,"absoluteDegree":105.5,"house":7,"nakshatra":8,"pada":3,"retrograde":false,"combustion":false,"strength":"Uchcha"},
    // ... 8 more entries
]
```

This negligible overhead means no pagination or compression concerns.

### 10.5 Concurrent Request Handling

Each current planet calculation is CPU-bound (~200–500ms of ephemeris computation). Under concurrent load (e.g., 10 simultaneous requests), the event loop will be blocked for:
- 10 × 500ms = 5 seconds worst-case (single core)

**Mitigations for production:**
- Add Node.js worker threads or a dedicated ephemeris service if concurrent usage grows
- Rate limiting (as described above) to prevent abuse
- Monitor p99 latency and add horizontal scaling (more Node.js instances) if needed
- Consider a lightweight in-memory LRU cache (TTL: 60 seconds) keyed by `ayanamsha` to serve near-identical results without recomputation — the planetary positions change negligibly within a 60-second window

---

## 11. Security Considerations

### 11.1 Access Control

Current planet data follows the same access rules as the chart it overlays:

| Visibility | Accessible To |
|------------|---------------|
| Public horoscope | Any authenticated user |
| Private horoscope | Owner only |
| Private horoscope + Share link | Anyone with valid share token |
| Any horoscope | Super Admin |

**API enforcement:**
- `GET /api/horoscope/:id/chart/:type` with `includeCurrentPlanets=true` applies the same session/ownership checks as the base chart endpoint
- `GET /api/horoscope/:id/current-planets` standalone endpoint enforces identical checks
- Shared horoscope access via `/api/share/:token` includes current planet data if the client requests it — no separate sharing logic needed

### 11.2 Ephemeris Security

- The Swiss Ephemeris library (`swisseph-v2`) is bundled with the application — no external API is called
- Ephemeris files are read-only and version-pinned in `package.json`
- The calculation function accepts only the `ayanamsha` string (validated against the enum) and reads the server clock — no user-controlled time input is accepted, preventing time-manipulation attacks
- The ephemeris library runs in the Node.js process sandbox — no filesystem access beyond its bundled ephemeris files (`$HOME/.se_files/` or bundled WASM)

### 11.3 Rate Limiting

The current planet calculation endpoint is CPU-intensive and should be rate-limited:
- **Per-user:** 30 requests per minute (prevents a single user from saturating the CPU)
- **Per-IP:** 60 requests per minute (for unauthenticated share-token access)
- Rate limit headers returned: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- Exceeding the limit returns `429 Too Many Requests` with a `Retry-After` header

### 11.4 CSRF

Both chart endpoints (with and without current planets) are read-only GET requests, so CSRF is not a concern. The toggle preference write (FilterConfig update) goes through the existing FilterConfig mutation endpoint, which requires authentication and is protected by NextAuth.js SameSite cookie handling.

### 11.5 No Additional PII Exposure

Current planetary positions reveal no personally identifiable information. They are computed from the horoscope's birth location (which is already visible to anyone who can view the horoscope) and the server's system clock. No additional user data is accessed or exposed by this feature.
