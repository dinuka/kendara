# Search Horoscope — Implementation

**Date:** 2026-07-27 21:00 (Phase 1), 2026-07-28 (Phase 2)
**Developer:** Opencode
**Based on:**
- specs/business-analysis/20260727-2055-search-horoscope.md
- specs/architecture/20260727-2100-search-horoscope.md
- specs/ux/20260727-2100-search-horoscope.md
- specs/qa/20260727-2100-search-horoscope.md
- specs/business-analysis/data-model.md
- specs/architecture/overview.md

---

## Status

- **Phase 1 (MVP):** All feature code implemented and tested.
- **Phase 2 (RAG Pipeline):** All feature code implemented and tested.

---

## Files Created

### Phase 1

#### Models
| File | Description |
|------|-------------|
| `src/models/SearchHistory.ts` | New Mongoose model for search history tracking. Fields: id, user, query, parsedConditions, resultCount, language, source, savedFilter, createdAt. Indexes on user+createdAt, user+query+createdAt. |
| `src/models/SearchBookmark.ts` | New Mongoose model for bookmarking horoscopes. Fields: id, user, horoscope, notes, queryContext, createdAt. Unique compound index on user+horoscope.id. |

#### Backend API Routes
| File | Description |
|------|-------------|
| `src/app/api/search/filter/route.ts` | GET list saved filters (excludes `__default__` from public list), POST create/overwrite saved filter. Handles duplicate name overwrite, max 50 enforcement. |
| `src/app/api/search/filter/[id]/route.ts` | PUT update saved filter name/query/config, DELETE remove saved filter. Ownership verification. |
| `src/app/api/search/history/route.ts` | GET search history (max 50, sorted by createdAt desc), POST record search (with 5-min dedup), DELETE clear all history. Auto-purge oldest when > 50 entries. |
| `src/app/api/search/history/[id]/route.ts` | DELETE single history entry. Ownership verification. |
| `src/app/api/search/bookmark/route.ts` | GET bookmarks (enriched with horoscope details), POST create bookmark. Handles duplicate check, max 100 enforcement. |
| `src/app/api/search/bookmark/[horoscopeId]/route.ts` | PUT update bookmark notes/queryContext, DELETE remove bookmark. Ownership verification. |
| `src/app/api/search/export/route.ts` | GET export as CSV or JSON. Rate-limited to 10 req/min. Privacy-respecting. Query param: format=csv\|json, query, page. |

#### Utility Library
| File | Description |
|------|-------------|
| `src/lib/search/utils.ts` | `detectLanguage()` — Sinhala Unicode range check; `generateAnonymousPlaceholder()` — last 4 chars of UUID; `anonymizeSearchResults()` — privacy-aware name replacement; `paginateResults()` — slice + totalPages calculation. |

#### Frontend Components
| File | Description |
|------|-------------|
| `src/app/search/page.tsx` | Complete rebuild of the search page with: SearchBar (debounce 300ms, language indicator, Enter to search), ConfigPanel (slide-out sidebar, all 19 toggles grouped by category, save/reset), SearchResultCard (expand/collapse, score badge, charts, calculations, dashas, yogas, doshas, bookmark toggle), PaginationControls (page numbers, prev/next, page info), SearchHistoryPanel (recent queries, re-run, clear), SavedSearchesPanel (list, run, edit name, delete), BookmarksPanel (list, open, remove). |

### Phase 2 — RAG Pipeline

#### Models
| File | Description |
|------|-------------|
| `src/models/SearchEmbedding.ts` | New Mongoose model for tracking embedding state. Fields: id, horoscope, embedding, textContent, language (si\|en), chunkIndex, embeddingModel, isActive, timestamps. Indexed on horoscope.id+language and isActive. |

#### Search Library Modules
| File | Description |
|------|-------------|
| `src/lib/search/embedding.ts` | Transformers.js pipeline wrapper. Lazy-loads `@xenova/transformers` with `all-MiniLM-L6-v2` model. `generateEmbedding(text)` returns 384-dim vector or null on failure. `generateEmbeddings(texts)` for batch. `isEmbeddingAvailable()` checks pipeline state. |
| `src/lib/search/qdrant.ts` | Qdrant REST client (lazy singleton). Collection auto-creation (384-dim, Cosine distance, HNSW ef_construct=100, M=16). Payload indexes on horoscopeId, ownerId, isPublic, language. Functions: `ensureCollection()`, `upsertPoint()` with wait=true, `deletePoints()` by horoscopeId, `searchPoints()` with should-filter on ownerId or isPublic. |
| `src/lib/search/textContent.ts` | Generates bilingual searchable text from `CalculationResult`. English path produces structured astrological descriptions (ascendant, planet positions + strengths + retrograde/combustion, nakshatras, house lords, dasha sequences, yoga names, doshas, atmakaraka, badhaka/maraka). Sinhala path mirrors the same structure in Sinhala using lookup tables for signs, planets, nakshatras, strengths. |
| `src/lib/search/indexer.ts` | Orchestrates the full embedding lifecycle. `indexHoroscope()` — fetches horoscope + calculated details, generates text for both languages, generates embeddings via Transformers.js, saves SearchEmbedding records, upserts Qdrant points. `reindexHoroscope()` — deletes existing embeddings then re-indexes. `updateHoroscopeVisibility()` — bulk-updates SearchEmbedding.isActive and upserts Qdrant points with updated isPublic payload. |

#### Infrastructure
| File | Description |
|------|-------------|
| `docker-compose.yml` | Qdrant service definition. Exposes ports 6333 (REST) and 6334 (gRPC). Persistent volume at `qdrant_storage`. |

#### Tests
| File | Description |
|------|-------------|
| `src/__tests__/search-rag.test.ts` | 38 unit tests covering: textContent English (12), textContent Sinhala (10), textContent edge cases (3), hybrid scoring logic (5), Qdrant point ID format (2), SearchEmbedding model fields (3), graceful degradation (3), query understanding vector flag (2). |

## Files Updated

### Phase 1
| File | Changes |
|------|---------|
| `src/models/SavedFilter.ts` | Added fields: `id` (UUID auto-gen), `name`, `lastRunAt`, `resultCount`, `updatedAt`. Added indexes on user+lastRunAt. Added timestamps option. |
| `src/app/api/search/route.ts` | Enhanced to support pagination (page/pageSize), full-detail result cards (includes calculatedDetails + charts), matchedConditions array, queryUnderstanding object. Score logic inspects actual calculated data (planet strengths, yogas, doshas, houses) rather than pure keyword matching. Privacy applied to names. Max query length 500 chars. |
| `src/__tests__/privacy.test.ts` | Updated search anonymization tests to mock `CalculatedDetails.findOne` and `Chart.find` with proper `.lean()` chaining to match enhanced search route. Updated mock defaults for CalculatedDetails and Chart. |

### Phase 2
| File | Changes |
|------|---------|
| `src/app/api/search/route.ts` | Integrated vector search pipeline. Generates query embedding via Transformers.js, searches Qdrant for semantically similar horoscopes. Hybrid scoring: `score = 0.7 * vectorScore + 0.3 * normalizedKeywordScore`. Graceful degradation: if Qdrant/Transformers unavailable, falls back to MongoDB-only keyword scoring. Response includes `queryUnderstanding.vectorSearchUsed`. |
| `src/app/api/horoscope/route.ts` | Added fire-and-forget call to `indexHoroscope()` after horoscope creation + chart save. Embedding generation runs asynchronously so the API response is not blocked. |
| `src/lib/search/utils.ts` | No changes (Phase 1 utils remain compatible). |
| `next.config.ts` | Added `@xenova/transformers` and `@qdrant/js-client-rest` to `serverExternalPackages` to prevent Next.js bundling of native/CJS modules. |
| `src/__tests__/privacy.test.ts` | Added mocks for `@/lib/search/embedding` (generateEmbedding returns null) and `@/lib/search/qdrant` (ensureCollection returns false) to keep existing search anonymization tests working with new imports. |

## Test Results

### Phase 1
```
Test Suites: 7 passed, 7 total
Tests:       127 passed, 127 total
Time:        2.917 s
```

### Phase 2
```
Test Suites: 8 passed, 8 total
Tests:       165 passed, 165 total
Time:        2.493 s
```

All 165 tests pass across all 8 test suites (auth, calculation, currentPlanets, dasha, location, privacy, search, search-rag).

## Lint Status

ESLint has a pre-existing configuration error (`react/display-name` rule incompatibility with ESLint 10.7.0) that is NOT caused by this implementation. The error occurs even on the unmodified codebase.

---

## Phase 1 Implementation Details

### Search Route Scoring (Phase 1)
The enhanced search route (`POST /api/search`) uses a multi-factor scoring algorithm:
1. **Ascendant match** (1.0) — if query mentions a sign name that matches the horoscope's ascendant sign
2. **Planet-in-sign** (0.3) — if query mentions a sign name and a planet is in that sign
3. **Planet name match** (0.3) — if query mentions a planet name present in the horoscope
4. **Exaltation** (0.5 per planet + 0.3 bonus) — if query mentions exaltation and planets have Uchcha strength
5. **Debilitation** (0.5 per planet) — if query mentions debilitation and planets have Neecha strength
6. **Yoga** (0.4) — if query mentions yoga and horoscope has yoga formations
7. **Dosha** (0.4) — if query mentions dosha and horoscope has present doshas
8. **Planet-in-house** (0.6) — if query matches planet + house number pattern

Results are sorted by score descending and paginated (default 5 per page, max 20).

### Pagination
The `paginateResults()` utility handles edge cases:
- Page values clamped to valid range (1 to totalPages)
- Empty arrays return totalPages=1 (not 0)
- Partial last pages handled correctly

### Privacy
Privacy is enforced at multiple layers:
1. MongoDB `$or` filter on `owner.id` or `isPublic` at query time
2. Name anonymization via `anonymizeSearchResults()` for non-owners with `displayName=false`
3. Super-admin bypasses anonymization

### Search History Dedup
Consecutive identical queries within 5 minutes update the existing entry's timestamp instead of creating a new entry. When total exceeds 50, the oldest entries are purged.

### Rate Limiting
The export endpoint implements in-memory rate limiting: 10 requests per minute per user, HTTP 429 with Retry-After header when exceeded.

### Saved Filters
- `__default__` named filters store the user's global config preference and are excluded from the saved searches list
- Regular named filters support overwrite on duplicate name
- Max 50 saved filters per user

### Bookmarks
- Unique constraint on user+horoscope (prevent duplicates)
- Max 100 bookmarks per user
- GET endpoint enriches bookmarks with horoscope detail and availability status

---

## Phase 2 Implementation Details

### RAG Pipeline Architecture

```
User Query (SI/EN)
    │
    ├── Language detection + keyword extraction (Phase 1 logic preserved)
    │
    ├── Transformers.js → generate query embedding (384-dim all-MiniLM-L6-v2)
    │   └── Graceful fallback: null → skip Qdrant
    │
    ├── Qdrant search: collection "horoscopes", filter: ownerId OR isPublic
    │   └── Graceful fallback: empty results → skip vector scoring
    │
    ├── Hybrid score: 0.7 × vectorSimilarity + 0.3 × (keywordScore / 4.0 capped at 1.0)
    │   - Horoscopes with only vector match (no keyword) get non-zero scores
    │   - Horoscopes with only keyword match (no vector) use pure keyword score
    │   - Horoscopes with both are boosted by vector similarity
    │
    ├── Enrich with full detail (charts, calculatedDetails)
    ├── Apply privacy
    └── Paginate + return
```

### Embedding Lifecycle

**Horoscope creation:**
1. Horoscope + calculatedDetails + charts saved (sync, blocking)
2. `indexHoroscope()` called (fire-and-forget, non-blocking)
3. Inside indexer: fetch horoscope + calculated details
4. Generate bilingual text content (SI + EN) via `textContent.ts`
5. Generate embeddings via Transformers.js (384-dim vectors)
6. Save `SearchEmbedding` records to MongoDB
7. Upsert Qdrant points (2 per horoscope: SI + EN)

**Graceful degradation chain:**
- Transformers.js fails → embedding generation returns null → SearchEmbedding saved without vector → Qdrant upsert skipped
- Qdrant unavailable → `ensureCollection()` returns false → upsert/skip silently → MongoDB-only search
- Qdrant search fails → empty results returned → falls back to Phase 1 keyword scoring

### Docker Setup
`docker-compose.yml` provides a Qdrant container with:
- REST API on port 6333
- gRPC on port 6334
- Persistent storage via named volume `qdrant_storage`

### Qdrant Collection Schema

| Property | Value |
|----------|-------|
| Collection name | `horoscopes` |
| Vector size | 384 |
| Distance | Cosine |
| HNSW ef_construct | 100 |
| HNSW M | 16 |
| Payload indexes | horoscopeId (keyword), ownerId (keyword), isPublic (bool), language (keyword) |

#### Point Payload
```json
{
    "horoscopeId": "550e8400-e29b-41d4-a716-446655440000",
    "ownerId": "user-123",
    "isPublic": true,
    "language": "si"
}
```

Point ID format: `{horoscopeId}_{language}` (e.g. `550e...0000_si`)

### SearchEmbedding Database Schema

```typescript
interface ISearchEmbedding {
    id: string;                    // UUID
    horoscope: { id: string };     // reference
    embedding: number[];           // 384-dim vector (empty array if generation failed)
    textContent: string;           // full text for re-embedding
    language: "si" | "en";
    chunkIndex: number;            // 0 = single chunk (MVP), >0 for chunked content
    embeddingModel: string;        // "all-MiniLM-L6-v2"
    isActive: boolean;             // false if horoscope made private
    createdAt: Date;
    updatedAt: Date;
}
```

### Text Content Structure (per language)

Each horoscope generates text containing:
1. Ascendant sign
2. For each planet: position (sign + house), strength, retrograde/combustion status
3. Moon nakshatra + pada
4. Ascendant nakshatra + pada
5. House lord sequence (house 1-12)
6. Mahadasha sequence (lord + date range)
7. Yoga names
8. Present doshas
9. Atmakaraka, Badhaka planets, Maraka planets

Total text per language: ~500-2000 chars (well within 512-token chunk size).

### Hybrid Scoring

When vector search is available:
```
combinedScore = 0.7 × vectorSimilarity + 0.3 × min(keywordScore / 4.0, 1.0)
```

The keyword score is normalized to [0, 1] by dividing by the theoretical max (4.0) and capping at 1.0. This ensures neither component dominates unreasonably.

When vector search is unavailable:
```
combinedScore = keywordScore  (unweighted, same as Phase 1)
```

Response includes both raw scores for debugging:
```json
{
    "score": 0.745,
    "vectorScore": 0.850,
    "keywordScore": 2.000,
    "matchedConditions": [...]
}
```

And `queryUnderstanding.vectorSearchUsed` indicates whether Qdrant contributed.

---

## Decisions Made

1. **In-memory rate limiting** — Uses a simple Map with TTL instead of Redis or DB-based rate limiting. Suitable for MVP. Should be replaced with Redis-backed rate limiting for production.

2. **Server-side scoring** — The search route fetches `CalculatedDetails` and `Chart` for each horoscope in the result set. This is appropriate for MVP (low horoscope count) but should be optimized for production (batch loading, aggregation pipeline).

3. **Frontend panels as slide-outs** — Config, History, Saved Searches, and Bookmarks panels all use the same right slide-out pattern for consistency. This could be refactored into a shared component in the future.

4. **Fire-and-forget indexing** — Embedding generation on horoscope create uses `indexHoroscope()` without awaiting. This keeps API response latency low. Generation runs as a background microtask. For production this should be replaced with a proper job queue (BullMQ).

5. **Lazy Transformers.js initialization** — The embedding pipeline loads `@xenova/transformers` on first call, not at server startup. This avoids blocking Next.js cold starts. Model weights are cached in `~/.cache/huggingface/` after first download (~90MB for all-MiniLM-L6-v2).

6. **Separate SI and EN Qdrant points** — Each horoscope generates two Qdrant points (one per language). The query language is detected at search time; the embedding is generated from the query text directly, which naturally matches against embeddings of the same language. No language filtering on Qdrant search needed.

## Remaining for Future Phases

### Phase 3 — Complex Search
- Gemini API integration for LLM query parsing
- Complex multi-condition query support
- Yoga-based and career/life-domain query support
- Embedding lifecycle on privacy change

### Phase 4 — Search Management Enhancements
- Save search modal with overwrite detection
- Shareable pagination URLs
- Chart lazy loading via IntersectionObserver
- i18n for all new UI strings
