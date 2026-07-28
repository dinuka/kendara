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
| POST | /api/horoscope | Create horoscope (triggers calculation) |
| GET | /api/horoscope/:id | Get horoscope with all details |
| PUT | /api/horoscope/:id | Update horoscope |
| DELETE | /api/horoscope/:id | Delete horoscope (own) |
| PATCH | /api/horoscope/:id/privacy | Toggle public/private and/or show/hide name — body: `{ isPublic?: boolean, displayName?: boolean }` |
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
  birthDate: Date,
  birthTime: string,
  location: { id: UUID },
  locationName: string,
  latitude: number,
  longitude: number,
  gender: "male" | "female" | "other",
  ayanamsha: "lahiri" | "raman" | "krishnamurti" | "yukteshwar",
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
  houses: [{ houseNumber, startDegree, middleDegree, endDegree, sign, lord }],
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
- horoscopes: { "owner.id": 1 }, { isPublic: 1 }, { createdAt: -1 }
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
