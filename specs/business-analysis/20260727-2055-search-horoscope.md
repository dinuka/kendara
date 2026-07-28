# User Stories — Search Horoscope (RAG-Based)

## Search Actors

### Student (Search Context)

- **Description**: An astrology student who searches horoscopes for study and research purposes.
- **Search-Specific Goals**: Find relevant horoscopes using natural language, filter by astrological conditions, configure result display, save and reuse searches, bookmark results.
- **Search Permissions**:
    - Search own horoscopes (always visible regardless of privacy)
    - Search public horoscopes from other students
    - Use natural language queries in Sinhala or English
    - Use simple astrological phrases (ascendant, planetary condition, planet-in-house)
    - Use complex multi-condition queries
    - View results ranked by semantic relevance
    - Paginate through search results
    - Configure visible result sections per session
    - Persist configuration preferences globally
    - Save and name search queries for reuse
    - View and clear own search history
    - Bookmark/unbookmark individual search results
    - View own bookmarked horoscopes
    - Export search results (CSV/JSON)

### System (RAG Search Pipeline)

- **Description**: Automated services that power the search pipeline.
- **Search-Specific Responsibilities**:
    - Generate vector embeddings from horoscope text content (async, background)
    - Parse natural language queries into structured astrological conditions (via Gemini API)
    - Generate query embeddings (via Transformers.js)
    - Execute vector similarity search against Qdrant (HNSW index)
    - Merge vector results with MongoDB structured filters for hybrid search
    - Rank and score results by semantic relevance
    - Manage embedding lifecycle on privacy changes (async queue)
    - Chunk large horoscope text content for multi-embedding support
    - Log search queries for analytics
    - Handle rate limiting on search endpoint

---

## Parent Stories

---

### US-007: Basic Horoscope Search (RAG-Based)

- **Title**: Student searches horoscopes with basic astrological filters via RAG pipeline
- **Description**: As a student, I want to search horoscopes using simple astrological phrases powered by a RAG pipeline so that I can quickly find relevant study material using natural language in Sinhala or English.
- **Priority**: High
- **Actor**: Student
- **Dependencies**: US-002 (Add Horoscope), US-006 (Privacy), US-003/004/005 (Calculations)

#### Acceptance Criteria

1. **Search Scope**:
    - Search returns all of the student's own horoscopes (regardless of `isPublic`)
    - Search returns all public horoscopes from other students (where `isPublic=true`)
    - Private horoscopes from other students are NEVER returned
    - Super Admin sees all horoscopes regardless of privacy

2. **Query Types — Simple Astrological Phrases**:
    - **Ascendant/sign filter**: "මේෂ ලග්නය" / "Aries Ascendant" → return horoscopes with Aries as the Ascendant sign
    - **Planetary condition filter**: "ශනි උච්ච" / "Saturn exaltation" → return horoscopes where Saturn is in exaltation (Uchcha)
    - **Planet-in-house filter**: "ගුරු 3" / "Jupiter 3rd" → return horoscopes where Jupiter is in the 3rd house
    - **Planet-in-sign filter**: "සිකුරු මීන" / "Venus Pisces" → return horoscopes where Venus is in Pisces
    - **Nakshatra filter**: "ජන්ම නක්ෂත්‍රය පුෂ්ය" / "Birth nakshatra Pushya" → return horoscopes with Pushya as Janma Nakshatra
    - **Dosha filter**: "මංගල දෝෂය" / "Manglik Dosha" → return horoscopes where Manglik Dosha is present
    - **Mixed simple conditions**: "කුජ 7 භාවයේ" / "Mars in 7th" (single filter, no compound multi-condition)

3. **RAG Pipeline**:
    - Query is sent to the RAG pipeline for parsing and embedding generation
    - Pipeline parses the query into a structured astrological condition (sign, planet, house, strength, etc.)
    - Generator creates a vector embedding of the query
    - Vector similarity search runs against Qdrant embedding index
    - Results are merged with MongoDB structured filters for precision
    - Results are ranked by relevance score (semantic similarity)

4. **Results Display**:
    - Results are displayed as a vertical list where each result item shows the full horoscope detail
    - Each result item renders vertically (top to bottom): name, charts section, calculations section, dashas section, etc.
    - Charts section includes: Birth Chart (Rasi), Navamsa (D9), House Chart (Bhava) — displayed horizontally within the item, scrollable horizontally if they exceed the container width
    - Each result item is independently scrollable horizontally for wide content (charts)
    - The sections within each result item are configurable via US-009 (Configurable Results Display) — users can toggle which sections appear in each result card
    - Default visible sections: Name, Birth Chart, Navamsa Chart, House Chart, Calculations, Dashas
    - Results are sorted by relevance score descending by default
    - Results show the total count of matches at the top of the list
    - If no results match, display a "no results" message with suggestions to broaden the query

5. **Language Support**:
    - Query input accepts both Sinhala (Unicode) and English (Latin) text
    - Sinhala queries use Sinhala astrological terminology (e.g., "මේෂ", "ශනි", "උච්ච")
    - English queries use English astrological terminology (e.g., "Aries", "Saturn", "exaltation")
    - Mixed-language queries are handled (e.g., "ගුරු in 3rd house")
    - The system auto-detects the language of the query

6. **Performance**:
    - Search results should load within 3 seconds for typical queries (p95)
    - Pagination loads additional results on scroll or via "Load More" button
    - Debounce input: search should not fire on every keystroke — debounce at 300-500ms after user stops typing

#### Edge Cases

- **Empty query**: Show recent/popular horoscopes or a "type to search" placeholder
- **Very short query** (< 3 characters): Treat as partial match; attempt prefix matching on planet/sign names
- **Query with typos**: RAG pipeline handles minor spelling variations via semantic similarity (e.g., "Saturm" → Saturn)
- **Query with no recognizable astrological terms**: Return results based on general text similarity (fallback to keyword matching)
- **Very long query** (> 500 characters): Truncate or reject with user-friendly message; suggest shortening
- **Special characters / emojis in query**: Strip non-alphanumeric characters (except Sinhala Unicode) before processing
- **All own horoscopes are private**: They still appear in the student's own search results
- **No public horoscopes exist yet**: Only own horoscopes returned
- **Horoscope deleted between search and view**: Show a "horoscope not found" error on detail navigation; remove from cached results

#### Business Rules

- Search MUST respect privacy settings at query time — never load private horoscopes into application memory for non-owners (defense-in-depth)
- The search endpoint MUST use MongoDB `$or` filtering: `{ "owner.id": session.user.id }` OR `{ isPublic: true }`
- Relevance score is a float between 0.0 and 1.0; only results with score > 0.3 are returned (threshold configurable)
- Results pagination: default page size 20, maximum 100 per page
- The RAG pipeline is read-only — it never modifies horoscope data
- Search queries SHALL be logged for analytics (query text, result count, latency) but NOT linked to individual user accounts in analytics (privacy-preserving)
- The search endpoint rate limit: 30 requests per minute per user (configurable)
- Super Admin search bypasses `isPublic` filter but results show a badge indicating which results are private

---

### US-008: Complex Search (RAG-Based)

- **Title**: Student performs complex multi-condition astrological searches via RAG pipeline
- **Description**: As a student, I want to combine multiple astrological conditions in a single natural language query powered by the RAG pipeline so that I can find horoscopes matching complex study criteria in Sinhala or English.
- **Priority**: High
- **Actor**: Student
- **Dependencies**: US-007 (Basic Search), US-003/004/005 (Calculations)

#### Acceptance Criteria

1. **Compound Multi-Condition Queries**:
    - Query combines 2+ conditions in natural language
    - Example (Sinhala): "මේෂ ලග්නයේ ශනි උච්චව ගුරු 3 භාවයේ ඇති ගුරුට සුබ දෘෂ්ඨි නොවැටෙන"
      → Parsed as: Ascendant=Aries AND Saturn=Exaltation AND Jupiter=House3 AND Jupiter=No Beneficial Aspects
    - Example (English): "Aries ascendant with exalted Saturn, Jupiter in 3rd house and Jupiter not receiving beneficial aspects"
    - All conditions must be satisfied (AND logic — results must match all conditions)
    - System MAY support OR logic for alternative phrasings (to be confirmed during implementation)

2. **Yoga-Based Queries**:
    - "පරිවර්තන යෝග තිබෙන" / "horoscopes with Parivartana Yoga"
    - "ධර්ම කර්මාධිපති යෝගය" / "Dharma-karmadhipati Yoga"
    - "ගජකේසරී යෝගය" / "Gajakesari Yoga"
    - Returns horoscopes where the named yoga is present (exact match on yoga name from CalculatedDetails.yogas)

3. **Career/Life-Domain Queries**:
    - "රැකියාව ගුරු වෘත්තිය විය හැකි" / "career suitable for teaching profession"
    - "ව්‍යාපාර කටයුතු සාර්ථක විය හැකි" / "likely to succeed in business"
    - "විදේශ ගමනට යෝග තිබෙන" / "yoga for foreign travel"
    - System maps life-domain concepts to astrological criteria (e.g., career → 10th house/lord, profession → planetary combinations, travel → 3rd/12th house, etc.)
    - These queries rely on the LLM's astrological knowledge to determine relevant planetary/house conditions

4. **RAG Pipeline — Query Parsing**:
    - Query is sent to the Gemini API (free tier) for structured parsing
    - API returns a JSON structure of parsed conditions:
      ```json
      {
        "conditions": [
          { "type": "ascendant", "sign": 1, "operator": "eq" },
          { "type": "planet_strength", "planet": 7, "strength": 1 },
          { "type": "planet_in_house", "planet": 5, "house": 3 },
          { "type": "aspect", "planet": 5, "aspect_condition": "no_beneficial_aspects" }
        ],
        "logicalOperator": "AND",
        "language": "si",
        "confidence": 0.92
      }
      ```
    - If LLM parsing fails or returns low confidence (< 0.5), fall back to keyword-based parsing (same as US-007)
    - Parsed conditions are combined into a structured MongoDB query + vector search

5. **RAG Pipeline — Retrieval & Ranking**:
    - Generated query embedding for vector search
    - Vector search returns top-K candidates from Qdrant (K = 100, configurable)
    - Structured MongoDB filter applies parsed conditions to refine candidates
    - Final results are ranked by a hybrid score: `0.7 * vectorSimilarity + 0.3 * structuredMatchScore`
    - Only results with hybrid score > 0.4 are returned (threshold configurable)

6. **Language Support**:
    - Complex queries in Sinhala: full compound sentences with multiple clauses
    - Complex queries in English: natural language compound sentences
    - Mixed-language queries: handled at the LLM parsing layer
    - LLM prompt includes Sinhala and English astrological terminology mappings

7. **Accuracy Requirements**:
    - For yoga-based queries: ≥ 90% precision in identifying horoscopes with the named yoga
    - For career/life-domain queries: ≥ 70% precision (inherently subjective; results are suggestions, not definitive)
    - For compound multi-condition queries: all stated conditions must be satisfied in results

#### Edge Cases

- **Unrecognized yoga name**: Fall back to keyword search on yoga description text; return results with low-relevance marking
- **Contradictory conditions** (e.g., "Aries ascendant with Pisces ascendant"): Return no results and notify user of contradictory filters
- **Query with no parseable conditions**: Treat as basic keyword search (US-007 fallback)
- **Very specific life-domain query with no astrological mapping** (e.g., "will I become a pilot?"): Return no results with suggestion to rephrase in astrological terms
- **Partial condition parsing** (e.g., 3 conditions parsed out of 5 intended): Return results matching the 3 parsed conditions, indicate in UI which conditions were understood
- **LLM API is unavailable / rate-limited**: Fall back to basic keyword parsing (US-007 fallback); log the incident
- **Query mentions non-existent astrological concepts** (e.g., "15th house"): Silently ignore invalid conditions; warn user in result banner
- **Deduplication**: Same horoscope may appear from both vector and structured matches — deduplicate by horoscope ID

#### Business Rules

- Complex search IS a superset of basic search — all basic query types work, plus multi-condition and semantic parsing
- The LLM parsing step is optional — the system MUST function without it (graceful degradation to keyword search)
- LLM API cost/rate limits: if the daily free tier is exhausted, the system automatically falls back to basic search
- All parsed conditions, confidence scores, and the raw LLM response SHALL be logged for audit and model improvement
- Confidence score threshold for accepting LLM-parsed conditions: minimum 0.5 (configurable)
- Career/life-domain query results SHALL include a disclaimer: "These results are suggestions based on astrological principles and should not be considered as professional advice"
- Super Admin complex search: all conditions apply, but search scope includes private horoscopes too

---

### US-009: Configurable Results Display

- **Title**: Student configures which horoscope sections to display in search results
- **Description**: As a student, I want to toggle specific calculation sections, charts, and astrological data on/off in the search results view so that I can focus on the information relevant to my study.
- **Priority**: Medium
- **Actor**: Student
- **Dependencies**: US-007/008 (Search), US-005 (Chart Generation)

#### Acceptance Criteria

1. **Configuration Panel**:
    - A configuration panel is accessible from the search results page (toggle/settings icon)
    - Panel lists all toggleable sections with clear labels in Sinhala and English
    - Sections are grouped by category: Charts, Calculations, Strengths, Aspects, etc.
    - Each section has a toggle switch (on/off)

2. **Toggleable Sections**:
    - **Charts** (individual chart types):
        - Birth Chart (Rasi)
        - House Chart (Bhava)
        - Navamsa (D9)
        - Drekkana (D3)
        - Dasamsa (D10)
        - Shodasha Vargas (all 16 divisional charts)
        - Chandra Lagna (Moon Ascendant)
        - Surya Lagna (Solar Ascendant)
    - **Calculations**:
        - Ascendant/Lagna
        - House details
        - Planet positions
        - Nakshatra/Pada
        - Dashas (Mahadasha, Antardasha timeline)
    - **Strengths**:
        - Planetary strengths (Uchcha/Neecha, etc.)
        - Shad Bala (if calculated)
    - **Aspects**:
        - Planetary aspects with degree details
    - **Yogas**:
        - Yoga formations list
    - **Doshas**:
        - Dosha calculations
    - **Other**:
        - Current planetary positions (overlay on House chart)
        - Metadata/tags added by the student
        - Share link (if available)

3. **Persistence**:
    - Configuration is persisted per user in the SavedFilter entity's `filterConfig` JSON field
    - Configuration survives page refreshes, session changes, and browser restarts
    - Configuration carries across different search queries (global preference)
    - Configuration CAN be overridden per-saved-filter for specific study contexts

4. **Immediate Application**:
    - Changes to the configuration take effect immediately without re-running the search
    - Toggling a section on/off shows/hides that section in the results view
    - No page reload required (client-side UI update)

5. **Default Configuration**:
    - Default visible sections for new users: Name, Birth Chart, Navamsa (D9), House Chart, Ascendant/Lagna, Planet Positions, Dashas
    - All other sections default to OFF
    - Default configuration is applied until the user makes their first change
    - Super Admin default configuration is the same as student

6. **Configuration Reset**:
    - User can reset configuration to defaults with a single "Reset to Defaults" button
    - Reset applies immediately

#### Edge Cases

- **No calculated data for a section** (e.g., no yogas present): Section toggle is shown but content area displays "No data available" — not hidden
- **Section toggled off while viewing**: Content is hidden via CSS (`display:none` or conditional render) — data is NOT re-fetched
- **Configuration conflict** (e.g., user toggles chart off but chart image is main display): Charts section hides but horoscope name and summary remain visible
- **First visit / no saved config**: Apply defaults (all sections ON)
- **Corrupt saved config** (invalid JSON or missing fields): Fall back to defaults; log warning
- **Concurrent configuration saves**: Last write wins (no merge/locking needed)

#### Business Rules

- The FilterConfig JSON structure MUST match the schema defined in data-model.md (see [FilterConfig (SavedFilter)](#filterconfig-savedfilter))
- Configuration is a user-level preference, NOT a horoscope-level preference
- The same configuration applies to both US-007 (basic) and US-008 (complex) search results
- Toggling sections off does NOT affect server-side calculation — all data is pre-calculated; toggling only affects display
- Configuration is stored in the `filterConfig` field of the SavedFilter document (if a search is saved) OR as a standalone user preference (default config)

---

## Discovered Sub-Stories

---

### US-015: Search Results Pagination

- **Title**: Student browses search results with pagination
- **Description**: As a student, I want to paginate through search results so that I can browse large result sets efficiently.
- **Priority**: Medium
- **Actor**: Student
- **Dependencies**: US-007/008 (Search)

#### Acceptance Criteria

- Results are paginated with configurable page size (default 5, max 20) — each result is a full horoscope card with charts and data
- Pagination controls show: page numbers, prev/next buttons, total pages
- Results can be loaded via "Load More" button (infinite scroll alternative) OR traditional page numbers
- Page number is reflected in the URL query parameters for shareability/browser navigation
- When filters change, pagination resets to page 1

#### Edge Cases

- **Page number exceeds available pages**: Show "no more results" and disable next button
- **Zero results**: Pagination controls are hidden; "No results found" message is displayed
- **Rapid page navigation**: Debounced page change to avoid multiple simultaneous API calls
- **Result item with many charts causes slow rendering**: Charts are lazy-rendered within each result card using IntersectionObserver (only render charts when the result item is near the viewport)

---

### US-016: Save and Manage Search Queries

- **Title**: Student saves search queries for reuse
- **Description**: As a student, I want to save my search queries with a custom name so that I can quickly re-run them later without re-entering the query.
- **Priority**: Medium
- **Actor**: Student
- **Dependencies**: US-007/008 (Search)

#### Acceptance Criteria

- A "Save Search" button/icon is available on the search results page
- Saving a search creates a SavedFilter document with the query text, current filter config, and a user-defined name
- Saved searches are listed on a dedicated "Saved Searches" page or sidebar
- From the saved searches list, the user can:
    - Click to re-run the search
    - Edit the name
    - Delete the saved search
    - See the last run timestamp and result count
- Saved search filters are editable (user can change the filter config without changing the query)
- Maximum 50 saved searches per user (configurable)

#### Edge Cases

- **Saving a search with the same name as an existing one**: Prompt to overwrite or rename
- **Saved search query references a deleted horoscope (since removed from DB)**: Ignore silently — just return fewer results
- **Saving an empty query**: Not allowed — validation message "Please enter a search query before saving"

---

### US-017: Search History

- **Title**: Student views and manages recent search history
- **Description**: As a student, I want to view my recent search queries so that I can re-run them or reference what I've been researching.
- **Priority**: Low
- **Actor**: Student
- **Dependencies**: US-007/008 (Search)

#### Acceptance Criteria

- Every search query is automatically recorded in SearchHistory
- Search history is accessible from a dedicated page or dropdown
- Each history entry shows: query text, date/time, result count, language
- User can click a history entry to re-run the search
- User can clear individual history entries or clear all history
- Maximum 50 recent entries kept per user (oldest are auto-purged)
- Duplicate consecutive queries within 5 minutes update timestamp instead of creating new entry

#### Edge Cases

- **Clearing all history**: Irreversible; confirmation dialog required
- **History entry for a saved search that was deleted**: Entry is still visible but clicking it runs the query (without saved filter metadata)

---

### US-018: Bookmark Search Results

- **Title**: Student bookmarks horoscopes from search results
- **Description**: As a student, I want to bookmark individual horoscopes from search results so that I can quickly access them later without searching again.
- **Priority**: Low
- **Actor**: Student
- **Dependencies**: US-007/008 (Search), US-009 (Configurable Display)

#### Acceptance Criteria

- A bookmark icon/button is available on each search result card
- Clicking the icon bookmarks the horoscope (icon changes to filled/bookmarked state)
- Bookmarks are saved to the SearchBookmark entity
- Bookmarked horoscopes are listed on a dedicated "Bookmarks" page
- The bookmarks page shows the horoscope name, ascendant, and the query context (if saved)
- User can remove a bookmark (from results page or bookmarks page)
- User can add optional notes to a bookmark
- Bookmarked horoscopes that are later deleted show a "horoscope no longer available" placeholder

#### Edge Cases

- **Bookmarking own horoscope vs public horoscope**: Both work identically
- **Bookmarking a horoscope that was already bookmarked**: Repeated click unbookmarks it (toggle)
- **Bookmarking a horoscope that is later made private by its owner**: Bookmark entry still exists; viewing it respects the privacy rules (private horoscope not accessible via bookmark for non-owners)
- **Bookmarking max limit**: Default max 100 bookmarks per user (configurable)

---

### US-019: Search Results Export

- **Title**: Student exports search results for external analysis
- **Description**: As a student, I want to export search results as CSV or JSON so that I can analyze horoscope data outside the platform.
- **Priority**: Low
- **Actor**: Student
- **Dependencies**: US-007/008 (Search)

#### Acceptance Criteria

- An "Export" button is available on the search results page
- Export format options: CSV, JSON
- CSV export includes: horoscope name/anonymous, ascendant, planet positions (sign, house, degree), nakshatra, key strengths
- JSON export includes the full search result data structure
- Export respects the current filter config (only visible sections are exported)
- Export respects the same privacy rules as the search view (anonymous names for hidden-name horoscopes)
- Export is limited to the current page of results (not entire result set, to avoid large file generation)
- Exported file is downloaded automatically

#### Edge Cases

- **Export with zero results**: Button is disabled with tooltip "No results to export"
- **Export large result set**: If current page exceeds 100 results, limit export to 100 rows
- **Export contains private horoscope (own)**: Name is never anonymized in export for own horoscopes

---

### US-020: Search Result Detail Navigation

- **Title**: Student navigates to full horoscope detail from search results
- **Description**: As a student, I want to click a search result to open the full horoscope detail page so that I can view complete information in a dedicated view.
- **Priority**: Low
- **Actor**: Student
- **Dependencies**: US-007/008 (Search), US-009 (Configurable Display)

#### Acceptance Criteria

- Clicking a search result item or its "Open Full Detail" button navigates to the full horoscope page (`/horoscope/:id`)
- The search result item itself already shows full horoscope detail (charts, calculations, dashas) based on the current filter config — no preview expansion needed
- A "collapse/expand" toggle on each result item minimizes it to a compact summary card (name, ascendant, relevance score) to reduce visual clutter when browsing many results
- Collapsed items can be re-expanded to show full detail
- Multiple items can be expanded simultaneously
- Result items load data eagerly (all results fetched with full detail on search)

#### Edge Cases

- **Clicking a deleted horoscope**: Navigate to full page and show "Horoscope not found" message
- **Collapse all / expand all**: Optional toggle button at the top of results list
- **Own horoscope vs public**: Same behavior, privacy rules still apply

---

### US-021: Search Result Sorting

- **Title**: Student sorts search results by different criteria
- **Description**: As a student, I want to sort search results by different criteria so that I can organize results for easier analysis.
- **Priority**: Low
- **Actor**: Student
- **Dependencies**: US-007/008 (Search)

#### Acceptance Criteria

- Sort options available:
    - Relevance (default) — by semantic similarity score
    - Name (A-Z) — by horoscope name or anonymous placeholder
    - Date Created (newest first)
    - Date Created (oldest first)
    - Ascendant sign (by zodiac order)
- Sort selection is preserved within the current search session
- Sort applies to the current result set (re-sorts client-side OR triggers server re-query)
- Sort dropdown/selector is clearly labeled

#### Edge Cases

- **Sort by name with mixed named/anonymous**: Anonymous entries sort by their placeholder text consistently
- **Sort by relevance (default)**: Always the fallback if current sort is invalidated by a new search

---

## Business Rules — Search System

### Search Indexing

1. **Embedding Generation Trigger**:
    - Embeddings are generated for a horoscope when: (a) horoscope is created, (b) horoscope changes from private → public, (c) horoscope data is recalculated/updated
    - Embeddings are generated asynchronously via a background job queue — horoscope creation/update returns immediately
    - If embedding generation fails (e.g., Transformers.js error), the horoscope is still visible in basic keyword search but NOT in RAG vector search until embeddings are successfully generated

2. **Privacy → Embedding Sync**:
    - When a horoscope changes from public → private: `isActive` flag on SearchEmbedding is set to `false` synchronously (immediate). Background job cleans up inactive embeddings.
    - When a horoscope changes from private → public: embedding generation is queued asynchronously. Horoscope is searchable via MongoDB structured filters immediately but vector search results may have a brief delay.
    - Qdrant point payloads include `horoscopeId`, `isPublic`, and `ownerId` fields for hybrid filtering.

3. **Text Content for Embedding**:
    - The text content used for embedding generation is a structured textual representation of the horoscope, including: ascendant, all planet positions with signs/houses/strengths, nakshatra, yoga names, dosha names, and dasha lord sequence
    - Text is generated in BOTH Sinhala and English for bilingual search support (separate embeddings per language)
    - Large horoscopes may be chunked into multiple SearchEmbedding records (tracked via `chunkIndex`)

4. **Model Versioning**:
    - `embeddingModel` field on SearchEmbedding tracks which model generated the embedding
    - When the embedding model is upgraded, existing embeddings SHALL be re-generated via a migration/re-indexing job
    - During re-indexing, both old and new embeddings coexist; search uses the newer version if available

### Search Query Processing

5. **Query Language Detection**:
    - Detect language by checking for Sinhala Unicode range (U+0D80–U+0DFF) characters
    - If Sinhala characters present → process as Sinhala query
    - If no Sinhala characters → process as English query
    - Mixed queries: default to the language of the majority of characters

6. **Graceful Degradation**:
    - If the RAG pipeline (LLM parsing) fails → fall back to basic keyword-based parsing (as implemented in current `src/app/api/search/route.ts`)
    - If the vector DB (Qdrant) is unreachable → fall back to MongoDB-only search with keyword parsing
    - If Transformers.js fails to generate embedding → fall back to MongoDB-only search
    - All fallback events SHALL be logged with the failure reason

7. **Rate Limiting**:
    - Search endpoint: 30 requests per minute per user
    - Export endpoint: 10 requests per minute per user
    - LLM API calls: rate-limited at the service level (Gemini API daily free tier limits apply)
    - Rate limit exceeded response: HTTP 429 with `Retry-After` header

### Search Results

8. **Relevance Thresholds**:
    - US-007 (basic search): minimum score 0.3 (configurable)
    - US-008 (complex search): minimum hybrid score 0.4 (configurable)
    - Below-threshold results are excluded entirely (not shown at bottom)

9. **Data Freshness**:
    - Search results reflect MongoDB data at query time (real-time, not cached)
    - Embedding index (Qdrant) may lag behind MongoDB by up to a few seconds (eventual consistency for embeddings)
    - This means: a just-made-public horoscope appears in structured search immediately but may not appear in vector similarity results until embedding is generated

10. **Anonymous Horoscope Names**:
    - When `isPublic=true` and `displayName=false` on a horoscope:
        - The name in search results is replaced with the anonymous placeholder from `getAnonymousPlaceholder()`
        - The horoscope owner and Super Admin always see the actual name
    - The anonymous placeholder format is defined in `src/lib/privacy.ts` — currently uses horoscope ID hash

---

## Questions for Other Roles

### For Architect

1. The current search route does keyword matching against in-memory maps. The architecture spec describes a RAG pipeline with Transformers.js + Qdrant + Gemini API. How should we stage the implementation? Should we build the full RAG pipeline in one milestone, or deliver keyword search first as MVP and enhance to RAG later?
2. Where should the embedding generation background job live? A separate worker process, a Next.js API route called via fetch, or a queue library (Bull/BullMQ with Redis)?
3. The Qdrant vector DB — should it be self-hosted (Docker) or use Qdrant Cloud? What's the expected embedding volume per horoscope?
4. For hybrid search (vector similarity + MongoDB structured filter), should we:
   - Fetch top-K from Qdrant, then filter in MongoDB with `$in` on IDs?
   - Or filter first in MongoDB, then re-rank with Qdrant?
   - Or embed the structured conditions into the Qdrant filter payload and let Qdrant handle both?

### For Developer

1. The current `SearchEmbedding` entity has no Mongoose model file yet. Where should it live — `/src/models/SearchEmbedding.ts`? Should we add `SearchHistory` and `SearchBookmark` models in the same PR?
2. What's the expected embedding dimension? If using `Xenova/all-MiniLM-L6-v2`, it's 384. If using a multilingual model, it may differ.
3. Should the embedding generation be a server action (Next.js Server Action) or a dedicated API route (`POST /api/search/embed`)?
4. For the chunking strategy: how many tokens per chunk for horoscope text content? What's the average horoscope text size?
5. The Gemini API usage — should we have a server-side API key in environment variables, and what fallback behavior when the free tier is exhausted?

### For UX/Design

1. Where should the configuration panel (US-009) live — a sidebar, a modal, or a dropdown? Should it be accessible from the search results page only, or also from the horoscope detail view?
2. How should the "match relevance" be visualized in search results? A percentage badge, a bar, stars, or just sort order?
3. For the quick preview (US-020): side panel or modal? What's the mobile behavior?
4. How should the system indicate that a query was only partially understood (e.g., "We understood 3 of 5 conditions")?
5. For search input: should we show autocomplete/suggestions as the user types? What kind of suggestions (recent searches, common astrological terms)?

### For QA

1. Test scenario: An LLM-parsed query returns high confidence but wrong conditions. How do we validate accuracy in testing? Do we need a test corpus of known query → expected conditions mappings?
2. Test scenario: Qdrant is down, MongoDB is up. Search should fall back to MongoDB-only. How do we test this gracefully in CI without a real Qdrant instance?
3. Test scenario: Rapid privacy toggling (public ↔ private three times in one second). What's the expected state of search embeddings?
4. Test scenario: Search while embedding generation is in progress for a just-made-public horoscope. Should the horoscope appear in results (via MongoDB structured filter) even before its embedding is ready?
5. Test scenario: A query that matches 2000 horoscopes. Does pagination work correctly? Performance impact?

### For PM

1. US-007 and US-008: Should these be delivered in the same release, or is basic search (US-007) the MVP and complex search (US-008) a follow-up?
2. US-009: Is the per-user global configuration sufficient, or do we also need per-search-session configuration that resets when the query changes?
3. US-017 (Search History): Is this a privacy-sensitive feature? Should we allow users to opt out of search history tracking?
4. US-019 (Export): CSV and JSON in MVP, or just CSV first?
5. What is the maximum number of horoscopes we expect in the system in year 1? This affects Qdrant sizing and embedding cost estimates.
6. Should we have a "trending/public horoscopes" landing page for students who haven't searched yet?

---

## Cross-Reference Impact Matrix

| Existing Feature | Impact from Search Stories |
|---|---|
| US-006 (Privacy) | Embedding lifecycle on privacy toggle; SearchEmbedding.isActive field; Anonymous names in search |
| US-003/004/005 (Calculations) | Text content for embeddings is derived from calculated data; re-indexing on recalculation |
| US-010 (Metadata) | Metadata tags could be included in embedding text content for richer search |
| US-011 (Share Link) | Share links bypass search but search results may show shareable indicator |
| US-012 (Download/Export) | Search export (US-019) reuses download/export infrastructure |
| US-014 (Language) | Bilingual search depends on i18n for astrological term mappings |
| SavedFilter entity | Extended with `name`, `lastRunAt`, `resultCount` fields |
| SearchEmbedding entity | Extended with `language`, `chunkIndex`, `embeddingModel`, `isActive` fields |
| New: SearchHistory | New entity for tracking search queries |
| New: SearchBookmark | New entity for bookmarking horoscopes |
