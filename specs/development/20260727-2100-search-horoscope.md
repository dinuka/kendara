# Search Horoscope — Phase 1 (MVP) Implementation

**Date:** 2026-07-27 21:00
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

All Phase 1 (MVP) feature code has been implemented and tested.

---

## Files Created

### Models
| File | Description |
|------|-------------|
| `src/models/SearchHistory.ts` | New Mongoose model for search history tracking. Fields: id, user, query, parsedConditions, resultCount, language, source, savedFilter, createdAt. Indexes on user+createdAt, user+query+createdAt. |
| `src/models/SearchBookmark.ts` | New Mongoose model for bookmarking horoscopes. Fields: id, user, horoscope, notes, queryContext, createdAt. Unique compound index on user+horoscope.id. |

### Backend API Routes
| File | Description |
|------|-------------|
| `src/app/api/search/filter/route.ts` | GET list saved filters (excludes `__default__` from public list), POST create/overwrite saved filter. Handles duplicate name overwrite, max 50 enforcement. |
| `src/app/api/search/filter/[id]/route.ts` | PUT update saved filter name/query/config, DELETE remove saved filter. Ownership verification. |
| `src/app/api/search/history/route.ts` | GET search history (max 50, sorted by createdAt desc), POST record search (with 5-min dedup), DELETE clear all history. Auto-purge oldest when > 50 entries. |
| `src/app/api/search/history/[id]/route.ts` | DELETE single history entry. Ownership verification. |
| `src/app/api/search/bookmark/route.ts` | GET bookmarks (enriched with horoscope details), POST create bookmark. Handles duplicate check, max 100 enforcement. |
| `src/app/api/search/bookmark/[horoscopeId]/route.ts` | PUT update bookmark notes/queryContext, DELETE remove bookmark. Ownership verification. |
| `src/app/api/search/export/route.ts` | GET export as CSV or JSON. Rate-limited to 10 req/min. Privacy-respecting. Query param: format=csv|json, query, page. |

### Utility Library
| File | Description |
|------|-------------|
| `src/lib/search/utils.ts` | `detectLanguage()` — Sinhala Unicode range check; `generateAnonymousPlaceholder()` — last 4 chars of UUID; `anonymizeSearchResults()` — privacy-aware name replacement; `paginateResults()` — slice + totalPages calculation. |

### Frontend Components
| File | Description |
|------|-------------|
| `src/app/search/page.tsx` | Complete rebuild of the search page with: SearchBar (debounce 300ms, language indicator, Enter to search), ConfigPanel (slide-out sidebar, all 19 toggles grouped by category, save/reset), SearchResultCard (expand/collapse, score badge, charts, calculations, dashas, yogas, doshas, bookmark toggle), PaginationControls (page numbers, prev/next, page info), SearchHistoryPanel (recent queries, re-run, clear), SavedSearchesPanel (list, run, edit name, delete), BookmarksPanel (list, open, remove). |

### Tests
| File | Description |
|------|-------------|
| `src/__tests__/search.test.ts` | 31 unit tests covering: language detection (5), anonymous placeholder (4), anonymization logic (6), pagination (8), SavedFilter CRUD logic (4), SearchHistory dedup (4). |

## Files Updated

| File | Changes |
|------|---------|
| `src/models/SavedFilter.ts` | Added fields: `id` (UUID auto-gen), `name`, `lastRunAt`, `resultCount`, `updatedAt`. Added indexes on user+lastRunAt. Added timestamps option. |
| `src/app/api/search/route.ts` | Enhanced to support pagination (page/pageSize), full-detail result cards (includes calculatedDetails + charts), matchedConditions array, queryUnderstanding object. Score logic inspects actual calculated data (planet strengths, yogas, doshas, houses) rather than pure keyword matching. Privacy applied to names. Max query length 500 chars. |
| `src/__tests__/privacy.test.ts` | Updated search anonymization tests to mock `CalculatedDetails.findOne` and `Chart.find` with proper `.lean()` chaining to match enhanced search route. Updated mock defaults for CalculatedDetails and Chart. |

## Test Results

```
Test Suites: 7 passed, 7 total
Tests:       127 passed, 127 total
Time:        2.917 s
```

All 127 tests pass across all 7 test suites (auth, calculation, currentPlanets, dasha, location, privacy, search).

## Lint Status

ESLint has a pre-existing configuration error (`react/display-name` rule incompatibility with ESLint 10.7.0) that is NOT caused by this implementation. The error occurs even on the unmodified codebase.

## Implementation Details

### Search Route Scoring
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

## Decisions Made

1. **In-memory rate limiting** — Uses a simple Map with TTL instead of Redis or DB-based rate limiting. Suitable for MVP. Should be replaced with Redis-backed rate limiting for production.

2. **Server-side scoring** — The search route fetches `CalculatedDetails` and `Chart` for each horoscope in the result set. This is appropriate for MVP (low horoscope count) but should be optimized for production (batch loading, aggregation pipeline).

3. **Frontend panels as slide-outs** — Config, History, Saved Searches, and Bookmarks panels all use the same right slide-out pattern for consistency. This could be refactored into a shared component in the future.

4. **No SearchEmbedding model** — The Qdrant/vector search pipeline is not part of Phase 1 (MVP). See architecture spec for Phase 2 plans.

5. **No separate search parser** — The keyword parsing logic is inline in the search route. This should be extracted to `src/lib/search/parser.ts` when Phase 2 (RAG pipeline) is implemented.

## Remaining for Future Phases

### Phase 2 — RAG Pipeline
- Transformers.js integration for local embeddings
- Qdrant setup (Docker) and collection creation
- Async embedding generation on horoscope create
- Qdrant vector search in search pipeline
- Hybrid merge (vector + structured)

### Phase 3 — Complex Search
- Gemini API integration for LLM query parsing
- Complex multi-condition query support
- Graceful degradation chain

### Phase 4 — Search Management Enhancements
- Save search modal with overwrite detection
- Shareable pagination URLs
- Chart lazy loading via IntersectionObserver
- i18n for all new UI strings
