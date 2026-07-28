# Search Horoscope (RAG-Based) — Architecture Specification

**Date:** 2026-07-27
**Based on:** specs/business-analysis/20260727-2055-search-horoscope.md, specs/business-analysis/actors.md, specs/business-analysis/data-model.md, specs/architecture/overview.md

---

## 1. Overview

The Search Horoscope feature introduces a RAG-based natural language search pipeline that allows students to find horoscopes using astrological queries in Sinhala or English. Results are displayed as vertical full-detail cards with configurable sections.

### Scope

| Aspect | In Scope | Out of Scope |
|--------|----------|--------------|
| Search types | Basic (single-condition), Complex (multi-condition + yoga + career) | Image-based search, audio search |
| Query parsing | Gemini API (free tier) + keyword fallback | Custom-trained ML models |
| Vector search | Qdrant (self-hosted via Docker) | Qdrant Cloud, Pinecone, Weaviate |
| Embeddings | Transformers.js (local Node.js) | External embedding API services |
| Results display | Vertical full-detail cards, configurable sections, collapse/expand | Custom chart layout per user |
| Search management | History, bookmarks, saved searches | Shared/public search collections |

---

## 2. RAG Pipeline Architecture

### 2.1 High-Level Pipeline

```
User Query (SI/EN)
    │
    ├── Language Detection (check Sinhala Unicode range)
    │
    ▼
┌──────────────────────┐
│   Query Router       │
│                      │
│  ┌─────────────────┐ │
│  │ Gemini API      │ │ ← Free online LLM (rate-limited)
│  │ (primary path)  │ │
│  └────────┬────────┘ │
│           │ fail     │
│           ▼          │
│  ┌─────────────────┐ │
│  │ Keyword Parser  │ │ ← Local regex-based fallback
│  │ (fallback path) │ │
│  └────────┬────────┘ │
└───────────┼──────────┘
            │
            ▼
    Parsed Structured Conditions
    { type, planet, sign, house, strength, ... }
            │
            ├──────────────────────┐
            ▼                      ▼
    ┌──────────────┐      ┌──────────────┐
    │ Transformers │      │ MongoDB      │
    │ .js          │      │ $match       │
    │ Embed Query  │      │ Structured   │
    └──────┬───────┘      │ Filters      │
           │              └──────┬───────┘
           ▼                     │
    ┌──────────────┐            │
    │ Qdrant       │            │
    │ HNSW Search  │            │
    │ top-K=100    │            │
    └──────┬───────┘            │
           │                    │
           └────────┬───────────┘
                    ▼
          ┌──────────────────┐
          │ Hybrid Merge     │
          │ & Rank           │
          │ score = 0.7*vs   │
          │      + 0.3*sms   │
          └────────┬─────────┘
                   │
                   ▼
          ┌──────────────────┐
          │ Privacy Filter   │
          │ $or: owner OR    │
          │ isPublic         │
          └────────┬─────────┘
                   │
                   ▼
          ┌──────────────────┐
          │ Enrich with      │
          │ Full Detail Data │
          │ (charts, planets,│
          │  dashas, etc.)   │
          └────────┬─────────┘
                   │
                   ▼
          Return paginated
          full-detail cards
```

### 2.2 Graceful Degradation Chain

```
Gemini API (primary LLM parser)
    │
    ├── Success → Use parsed structured conditions
    │
    └── Fail (timeout/rate-limit/error) →Keyword Parser
        │
        ├── Parsed conditions exist → Use conditions
        │
        └── No parseable conditions → Return all matching horoscopes sorted by date

Qdrant (primary vector search)
    │
    ├── Success → Return vector similarity results
    │
    └── Fail (unreachable/error) →MongoDB-only search
        │
        └── Use structured filters only, no relevance ranking

Transformers.js (primary embedding)
    │
    ├── Success → Generate query embedding for Qdrant
    │
    └── Fail → Skip vector search, use MongoDB-only
```

### 2.3 Embedding Generation (Async Background Job)

```
Horoscope Created / Made Public
    │
    ▼
┌──────────────────────────┐
│ Queue Embedding Job      │
│ (in-process microtask    │
│  for MVP, BullMQ for     │
│  production)             │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ Generate Text Content    │
│                          │
│ For each language (SI/EN)│
│ - Ascendant + sign      │
│ - All planets: sign,     │
│   house, strength        │
│ - Nakshatra (moon/asc)   │
│ - Yoga names             │
│ - Dosha names            │
│ - Dasha lord sequence    │
│ - House lord sequence    │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ Generate Embedding       │
│ (Transformers.js)        │
│                          │
│ Model: all-MiniLM-L6-v2  │
│ Dimensions: 384          │
│ per language             │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ Upsert to Qdrant         │
│                          │
│ Collection: "horoscopes" │
│ Payload: {               │
│   horoscopeId,           │
│   ownerId,               │
│   isPublic,              │
│   language               │
│ }                        │
└──────────────────────────┘
```

**Chunking Strategy:**
- Horoscope text content is typically 500-2000 characters per language
- Chunk size: 512 tokens (approx 2000 chars)
- If content exceeds chunk size -> split into multiple SearchEmbedding records with sequential `chunkIndex`
- During search, all chunks for a horoscope are retrieved; max score across chunks is used as the horoscope's vector similarity score

---

## 3. API Contracts

### 3.1 POST /api/search — Search Horoscopes

**Request:**
```json
{
    "query": "මේෂ ලග්නයේ ශනි උච්චව ගුරු 3 භාවයේ",
    "page": 1,
    "pageSize": 5
}
```

**Response (200):**
```json
{
    "results": [
        {
            "horoscope": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "name": "John Doe",
                "displayName": true,
                "isPublic": true,
                "birthDate": "1990-01-15",
                "birthTime": "14:30",
                "gender": "male",
                "ayanamsha": "lahiri",
                "locationName": "Colombo, Sri Lanka",
                "calculatedDetails": {
                    "ascendant": { "sign": 1, "degree": 5.0, "lord": 3 },
                    "houses": [...],
                    "planets": [...],
                    "nakshatra": { ... },
                    "dashas": { ... },
                    "yogas": [...],
                    "doshas": { ... }
                },
                "charts": {
                    "birth": { "type": "birth", "data": { ... } },
                    "navamsaD9": { "type": "navamsa-d9", "data": { ... } },
                    "house": { "type": "house", "data": { ... } }
                }
            },
            "score": 0.87,
            "matchedConditions": ["ascendant=Aries", "Saturn=Exaltation", "Jupiter=House3"]
        }
    ],
    "total": 42,
    "page": 1,
    "pageSize": 5,
    "totalPages": 9,
    "queryUnderstanding": {
        "mode": "complex",
        "conditions": [
            { "type": "ascendant", "sign": 1, "operator": "eq" },
            { "type": "planet_strength", "planet": 7, "strength": 1 },
            { "type": "planet_in_house", "planet": 5, "house": 3 }
        ],
        "language": "si",
        "confidence": 0.92,
        "understoodAll": true
    }
}
```

**Privacy post-processing:**
```typescript
results.forEach((r) => {
    // Anonymize name for non-owners with displayName=false
    if (r.horoscope.owner.id !== session.user.id && !r.horoscope.displayName) {
        r.horoscope.name = generateAnonymousPlaceholder(r.horoscope.id);
    }
});
```

**Error Responses:**

| Status | Condition |
|--------|-----------|
| 400 | Empty query or invalid page/pageSize |
| 401 | No valid session |
| 429 | Rate limit exceeded (30 req/min/user) |
| 500 | Server error |

### 3.2 POST /api/search/filter — Save Filter Configuration

**Request:**
```json
{
    "name": "Manglik Dasha Study",
    "query": "මංගල දෝෂය සහිත",
    "filterConfig": {
        "visibleSections": {
            "birthChart": true,
            "navamsaD9": true,
            "houseChart": false,
            "planetaryStrengths": true,
            "dashas": true,
            "yogas": true,
            "doshas": true,
            "aspects": false
        }
    }
}
```

**Response (200):**
```json
{
    "id": "660e8400-e29b-41d4-a716-446655440010",
    "name": "Manglik Dasha Study",
    "query": "මංගල දෝෂය සහිත",
    "filterConfig": { ... },
    "lastRunAt": "2026-07-27T21:00:00Z",
    "resultCount": 15,
    "createdAt": "2026-07-27T21:00:00Z"
}
```

### 3.3 GET /api/search/history — Get Search History

**Response (200):**
```json
{
    "entries": [
        {
            "id": "770e8400-e29b-41d4-a716-446655440020",
            "query": "මේෂ ලග්නයේ ශනි උච්ච",
            "parsedConditions": [...],
            "resultCount": 12,
            "language": "si",
            "source": "complex",
            "createdAt": "2026-07-27T20:55:00Z"
        }
    ],
    "total": 1
}
```

### 3.4 POST /api/search/bookmark — Bookmark a Horoscope

**Request:**
```json
{
    "horoscopeId": "550e8400-e29b-41d4-a716-446655440000",
    "notes": "Interesting Mars placement",
    "queryContext": "මංගල දෝෂය"
}
```

**Response (200):**
```json
{
    "id": "880e8400-e29b-41d4-a716-446655440030",
    "user": { "id": "660e8400-e29b-41d4-a716-446655440001" },
    "horoscope": { "id": "550e8400-e29b-41d4-a716-446655440000" },
    "notes": "Interesting Mars placement",
    "queryContext": "මංගල දෝෂය",
    "createdAt": "2026-07-27T21:00:00Z"
}
```

### 3.5 GET /api/search/export — Export Search Results

**Query params:** `?format=csv&query=මේෂ ලග්නය&filterConfig=...&page=1`

**Response (200):** Content-Disposition: attachment; filename="search-results.csv"
- CSV columns: Name, Ascendant, Birth Chart URL, Navamsa URL, House Chart URL, Planet Positions, Dashas, Yogas, Doshas
- JSON format: Same shape as POST /api/search response but flattened

---

## 4. Component Architecture

### 4.1 Frontend Components

```
SearchPage
├── SearchBar (natural language input + search button)
├── ConfigPanel (section toggle sidebar/modal)
├── ResultsList
│   ├── SearchResultCard (repeatable)
│   │   ├── ResultHeader (name, ascendant, score, collapse/expand toggle)
│   │   ├── ResultChartsSection (horizontally scrollable)
│   │   │   ├── ChartView (Birth Chart — lazy rendered)
│   │   │   ├── ChartView (Navamsa D9 — lazy rendered)
│   │   │   └── ChartView (House Chart — lazy rendered)
│   │   ├── ResultCalculationsSection
│   │   │   ├── AscendantDisplay
│   │   │   ├── PlanetPositionsTable
│   │   │   └── NakshatraDisplay
│   │   ├── ResultDashasSection
│   │   │   └── DashaTimeline (nested accordion)
│   │   ├── ResultYogasSection
│   │   ├── ResultDoshasSection
│   │   └── ResultActions (bookmark, open detail, export)
│   └── PaginationControls
├── SearchHistoryPanel (dropdown/sidebar)
│   └── HistoryEntry (repeatable)
├── SavedSearchesPanel
│   └── SavedSearchEntry (repeatable)
├── BookmarksPanel
│   └── BookmarkEntry (repeatable)
└── EmptyState / NoResultsMessage
```

### 4.2 Backend Modules

| Module | File Path | Responsibility |
|--------|-----------|----------------|
| Search Router | `src/app/api/search/route.ts` | POST /api/search — orchestrates full search pipeline |
| Filter Router | `src/app/api/search/filter/route.ts` | CRUD for saved filters |
| History Router | `src/app/api/search/history/route.ts` | GET/DELETE search history |
| Bookmark Router | `src/app/api/search/bookmark/route.ts` | CRUD for bookmarks |
| Export Router | `src/app/api/search/export/route.ts` | GET search results as CSV/JSON |
| Embedding Service | `src/lib/search/embedding.ts` | Transformers.js embedding generation |
| Search Parser | `src/lib/search/parser.ts` | Query parsing (Gemini API + keyword fallback) |
| Search Indexer | `src/lib/search/indexer.ts` | Background job for embedding lifecycle |
| Search Utils | `src/lib/search/utils.ts` | Shared utilities (language detection, ranking, chunking) |

### 4.3 Route File Structure

```
src/app/api/search/
├── route.ts              # POST /api/search
├── filter/
│   ├── route.ts          # GET /api/search/filter, POST /api/search/filter
│   └── [id]/route.ts     # PUT, DELETE /api/search/filter/:id
├── history/
│   ├── route.ts          # GET, DELETE /api/search/history
│   └── [id]/route.ts     # DELETE /api/search/history/:id
├── bookmark/
│   ├── route.ts          # GET, POST /api/search/bookmark
│   └── [horoscopeId]/route.ts  # PUT, DELETE /api/search/bookmark/:horoscopeId
└── export/
    └── route.ts          # GET /api/search/export
```

---

## 5. Data Flow Diagrams

### 5.1 Basic Search Flow

```
User → type query "මේෂ ලග්නය" → debounce 300ms →
    POST /api/search { query: "මේෂ ලග්නය", page: 1 }
        │
        ├── getServerSession → 401 if missing
        ├── connectDB()
        ├── Language detection: Sinhala (U+0D80 range detected)
        ├── Gemini API parse → { conditions: [{ type: "ascendant", sign: 1 }], confidence: 0.95 }
        │   └── Fallback: Keyword parser (split into "මේෂ" → sign 1, "ලග්නය" → ascendant)
        ├── Transformers.js → generate query embedding (384-dim vector)
        │   └── Fallback: Skip vector search
        ├── Qdrant search: Collection "horoscopes", filter: isPublic=true OR ownerId=session.user.id
        │   └── Fallback: Skip to MongoDB
        ├── MongoDB query:
        │   $or: [{ "owner.id": userId }, { isPublic: true }]
        │   If parsed conditions exist: add structured filters
        │
        ├── Hybrid merge: interleave Qdrant results (ranked by vector similarity) with MongoDB results
        │   Score = 0.7 * vectorSimilarity + 0.3 * structuredMatchScore
        │   Filter out scores below threshold (0.3 for basic, 0.4 for complex)
        │
        ├── Deduplicate by horoscope ID
        ├── Enrich with full detail data (charts, calculatedDetails)
        │
        ├── Apply privacy: anonymize names for non-owners with displayName=false
        │
        ├── Record search history (async, fire-and-forget)
        ├── Paginate (slice results for requested page)
        │
        └── Return { results: [...], total, page, pageSize, totalPages, queryUnderstanding }
```

### 5.2 Complex Search Flow

```
User → type "මේෂ ලග්නයේ ශනි උච්චව ගුරු 3 භාවයේ ඇති ගුරුට සුබ දෘෂ්ඨි නොවැටෙන" →
    POST /api/search
        │
        ├── Gemini API parse (complex prompt with astrological knowledge):
        │   {
        │     conditions: [
        │       { type: "ascendant", sign: 1 },
        │       { type: "planet_strength", planet: 7, strength: 1 },
        │       { type: "planet_in_house", planet: 5, house: 3 },
        │       { type: "aspect", planet: 5, aspect_condition: "no_beneficial_aspects" }
        │     ],
        │     logicalOperator: "AND",
        │     confidence: 0.88
        │   }
        │
        ├── Generate query embedding
        ├── Qdrant vector search (top-K=100)
        ├── MongoDB structured query for each condition:
        │   - "calculatedDetails.ascendant.sign": 1
        │   - "calculatedDetails.planets": { $elemMatch: { name: 7, strength: 1 } }
        │   - "calculatedDetails.planets": { $elemMatch: { name: 5, house: 3 } }
        │   - Aspect condition: post-filter on planets array (MongoDB can't easily query nested sub-sub arrays)
        │
        ├── Hybrid merge + rank
        ├── Deduplicate
        ├── Enrich with full detail
        ├── Apply privacy
        └── Return results
```

### 5.3 Embedding Lifecycle Flow

```
Horoscope Privacy Change (public ↔ private)
    │
    ▼
PATCH /api/horoscope/:id/privacy
    │
    ├── Sync: Update MongoDB isPublic field
    ├── Sync: Write audit log
    ├── Sync: Return 200 to client
    │
    └── Async: Queue EMBEDDING_SYNC job
        │
        ├── private → public:
        │   ├── Check if Qdrant point exists
        │   ├── Exists → Update payload: { isPublic: true }
        │   ├── Not exists → Generate text (SI + EN)
        │   │   → Transformers.js embedding (SI)
        │   │   → Transformers.js embedding (EN)
        │   │   → Upsert to Qdrant (2 points per horoscope)
        │   └── Update SearchEmbedding.isActive = true in MongoDB
        │
        └── public → private:
            ├── Update Qdrant payload: { isPublic: false }
            └── Update SearchEmbedding.isActive = false in MongoDB

Horoscope Created:
    ├── Sync: Create horoscope + calculatedDetails + charts
    ├── Sync: Return 200
    └── Async: Queue EMBEDDING_GENERATE job
        └── (same as private→public generation)

Horoscope Recalculated:
    ├── Sync: Update calculatedDetails
    └── Async: Queue EMBEDDING_REINDEX job
        ├── Regenerate text content
        ├── Regenerate embeddings (SI + EN)
        ├── Upsert to Qdrant (overwrite existing points)
        └── Update SearchEmbedding records
```

### 5.4 Config Persistence Flow

```
User → Open search page
    │
    ├── GET /api/search/filter (fetch saved filters for user)
    │   └── Apply default config (from SavedFilter with name="__default__" or hardcoded defaults)
    │
    ├── User toggles section ON/OFF in ConfigPanel
    │   │
    │   ├── Client: Update local state immediately
    │   ├── Client: Hide/show sections in all result cards (no re-fetch)
    │   │
    │   └── Async: POST /api/search/filter
    │       { name: "__default__", filterConfig: { ...updated config... } }
    │       (debounced 500ms to batch rapid toggles)
    │
    └── User saves search as named filter
        └── POST /api/search/filter
            { name: "My Study Set", query: "...", filterConfig: { ... } }
```

---

## 6. Search Result Display Architecture

### 6.1 Result Card Layout

Each search result card is a vertical stack of configurable sections:

```
┌──────────────────────────────────────────────────────┐
│  [Name] John Doe                  [Score: 87%] [🔖]  │
│  [Ascendant] Aries (Mesha)     [Collapse ▲]          │
├──────────────────────────────────────────────────────┤
│  Charts:                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│  │  Birth   │ │ Navamsa  │ │  House   │  ◄──────     │
│  │  Chart   │ │  (D9)    │ │  Chart   │  horizontal  │
│  │          │ │          │ │          │  scroll       │
│  └──────────┘ └──────────┘ └──────────┘              │
├──────────────────────────────────────────────────────┤
│  Calculations:                                        │
│  ● Ascendant: Aries (Mesha) at 5° 12'                 │
│  ● Planets:                                            │
│    - Sun (Ravi) in Aries, 1st House                   │
│    - Moon (Chandra) in Cancer, 4th House              │
│    - ...                                               │
│  ● Nakshatra: Ashwini, Pada 2                          │
├──────────────────────────────────────────────────────┤
│  Dashas:                                               │
│  ● Mahadasha: Jupiter (1990-2006)                      │
│    ├─ Antardasha: Saturn (1990-1992) [CURRENT]         │
│    ├─ Antardasha: Mercury (1992-1994)                  │
│    └─ ...                                              │
├──────────────────────────────────────────────────────┤
│  Yogas:                                                │
│  ● Parivartana Yoga (present)                          │
├──────────────────────────────────────────────────────┤
│  Doshas:                                               │
│  ● Manglik Dosha (present, medium severity)            │
└──────────────────────────────────────────────────────┘
```

### 6.2 Collapse/Expand Behavior

- **Expanded state**: Full card as shown above — all enabled sections visible
- **Collapsed state**: Compact summary — Name, Ascendant sign, Score badge, Expand button
- **Default**: All cards expanded on fresh search (user sees full detail immediately)
- **Multiple expanded**: Any number of cards can be expanded simultaneously (no accordion constraint)
- **Toggle-all**: "Collapse All" / "Expand All" button at top of results list

### 6.3 Chart Rendering within Result Cards

Charts are rendered inline within the result card using SVG (D3.js). Since each result card may show 3-8 charts, rendering is optimized:

```
├── Result Charts Section (container with overflow-x: auto)
│   ├── ChartView: Birth Chart (lazy — IntersectionObserver)
│   ├── ChartView: Navamsa D9 (lazy — IntersectionObserver)
│   ├── ChartView: House Chart (lazy — IntersectionObserver)
│   └── [additional chart types if enabled in config]
│
│   Horizontal scroll: CSS overflow-x: auto on the container
│   Each chart: min-width: 280px, aspect-ratio: 1:1
│   Gap between charts: 16px
```

**Lazy rendering**: Charts within a result card are not rendered until the card itself is within 200px of the viewport (IntersectionObserver rootMargin: "200px"). This prevents performance degradation when loading multiple result cards.

---

## 7. Database Changes

### 7.1 New Mongoose Models

**SearchEmbedding** — `src/models/SearchEmbedding.ts`
```typescript
interface ISearchEmbedding {
    id: string;
    horoscope: { id: string };
    embedding: number[];
    textContent: string;
    language: "si" | "en";
    chunkIndex: number;
    embeddingModel: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
```

**SearchHistory** — `src/models/SearchHistory.ts`
```typescript
interface ISearchHistory {
    id: string;
    user: { id: string };
    query: string;
    parsedConditions?: object;
    resultCount: number;
    language: "si" | "en";
    source: "basic" | "complex";
    createdAt: Date;
}
```

**SearchBookmark** — `src/models/SearchBookmark.ts`
```typescript
interface ISearchBookmark {
    id: string;
    user: { id: string };
    horoscope: { id: string };
    notes?: string;
    queryContext?: string;
    createdAt: Date;
}
```

### 7.2 Updated Models

**SavedFilter** — Add fields to existing schema:
- `name: string` (user-defined label)
- `lastRunAt: Date`
- `resultCount: number`

### 7.3 Qdrant Collection Schema

```
Collection name: "horoscopes"
Vector size: 384 (all-MiniLM-L6-v2)
Distance: Cosine

Payload schema:
{
    horoscopeId: string (indexed),
    ownerId: string (indexed),
    isPublic: boolean (indexed),
    language: "si" | "en" (indexed)
}

Index: HNSW (ef_construct=100, M=16)
```

---

## 8. Rate Limiting

| Endpoint | Limit | Window | Scope |
|----------|-------|--------|-------|
| POST /api/search | 30 | per minute | per user |
| GET /api/search/export | 10 | per minute | per user |
| GET/POST/DELETE /api/search/history | 60 | per minute | per user |
| CRUD /api/search/bookmark | 60 | per minute | per user |
| CRUD /api/search/filter | 30 | per minute | per user |
| Gemini API calls | 60 | per minute | global (free tier limit) |

Rate limit exceeded → HTTP 429 with `Retry-After` header.

---

## 9. Implementation Phasing

### Phase 1 — MVP (Current milestone)
- Basic keyword search (existing in-memory keyword matching)
- Search history recording
- Configurable results display (filterConfig persistence)
- Pagination for full-detail cards
- Collapse/expand on result cards
- Search result export (CSV)

### Phase 2 — RAG Pipeline
- Transformers.js integration for local embeddings
- Qdrant setup (Docker) and collection creation
- Async embedding generation on horoscope create
- Qdrant vector search in search pipeline
- Hybrid merge (vector + structured)

### Phase 3 — Complex Search
- Gemini API integration for LLM query parsing
- Complex multi-condition query support
- Yoga-based and career/life-domain query support
- Graceful degradation chain
- Embedding lifecycle on privacy change

### Phase 4 — Search Management
- Saved queries (named filters)
- Bookmarks
- Search history management (view, clear)
- Search result quick preview (collapse/expand achieved in Phase 1)

---

## 10. Questions for Other Roles

### For Developer
1. Should the Qdrant client be initialized lazily (first search request) or at server startup in Next.js? Lazy is preferred to avoid blocking cold starts.
2. For the embedding text content: should we include metadata keys/values in the text that gets embedded? This would make metadata searchable but increases embedding size.

### For QA
1. Test scenario: A query matches via vector similarity but fails all structured conditions — should it still appear in results with a lower score? (Yes, per hybrid scoring — vector similarity alone produces non-zero score.)
2. Test scenario: 500 horoscopes in the system, each with SI+EN embeddings = 1000 Qdrant points. Search latency targets?

### For PM
1. Should saved searches with `name="__default__"` be hidden from the saved searches list UI (they're just config persistence, not user-intended saved searches)?
2. The default page size of 5 full-detail cards — should this be configurable by the user?
