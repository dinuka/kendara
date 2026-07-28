# Test Plan — Search Horoscope (RAG-Based)

**Date:** 2026-07-27 21:00
**Based on:**
- `specs/business-analysis/20260727-2055-search-horoscope.md` (User Stories US-007–US-021)
- `specs/architecture/20260727-2100-search-horoscope.md`
- `specs/ux/20260727-2100-search-horoscope.md`
- `specs/business-analysis/actors.md`
- `specs/business-analysis/data-model.md`
- `specs/architecture/overview.md`

---

## 1. API Tests

### 1.1 POST /api/search — Main Search Endpoint

#### TC-S001: Basic search by ascendant sign (Sinhala)
- **User Story:** US-007
- **Priority:** High
- **Preconditions:** Authenticated user, public horoscopes with known ascendants exist (at least 3 with Aries/Mesha ascendant)
- **Steps:**
  1. Send POST `/api/search` with body `{ "query": "මේෂ ලග්නය", "page": 1, "pageSize": 5 }`
  2. Inspect response
- **Expected Result:** 200 OK. `results` array contains horoscopes with Aries ascendant. `total` reflects count. `queryUnderstanding.mode` is `"basic"` or `"complex"`. Each result has `score` (float 0–1), `horoscope` with full detail (charts, calculatedDetails), `matchedConditions`.

#### TC-S002: Basic search by planetary condition (Sinhala)
- **User Story:** US-007
- **Priority:** High
- **Preconditions:** Public horoscopes with Saturn in Uchcha (strength=1) exist
- **Steps:**
  1. Send POST `/api/search` with `{ "query": "ශනි උච්ච" }`
- **Expected Result:** Results include horoscopes where Saturn strength is Uchcha. Relevance scores > 0.3.

#### TC-S003: Basic search by planet in house
- **User Story:** US-007
- **Priority:** High
- **Preconditions:** Public horoscopes with Jupiter in 3rd house exist
- **Steps:**
  1. Send POST `/api/search` with `{ "query": "ගුරු 3" }`
- **Expected Result:** Results include horoscopes where Jupiter house=3.

#### TC-S004: Basic search by planet in sign
- **User Story:** US-007
- **Priority:** High
- **Preconditions:** Public horoscopes with Venus in Pisces exist
- **Steps:**
  1. Send POST `/api/search` with `{ "query": "සිකුරු මීන" }`
- **Expected Result:** Results include horoscopes where Venus sign=12 (Pisces).

#### TC-S005: Basic search by nakshatra
- **User Story:** US-007
- **Priority:** Medium
- **Preconditions:** Public horoscopes with Pushya as Janma Nakshatra exist
- **Steps:**
  1. Send POST `/api/search` with `{ "query": "ජන්ම නක්ෂත්‍රය පුෂ්ය" }`
- **Expected Result:** Results include horoscopes where Moon's nakshatra is Pushya.

#### TC-S006: Basic search by dosha
- **User Story:** US-007
- **Priority:** Medium
- **Preconditions:** Public horoscopes with Manglik Dosha present exist
- **Steps:**
  1. Send POST `/api/search` with `{ "query": "මංගල දෝෂය" }`
- **Expected Result:** Results include horoscopes where Manglik Dosha is present.

#### TC-S007: Basic search in English
- **User Story:** US-007
- **Priority:** Medium
- **Preconditions:** Same horoscopes from TC-S001
- **Steps:**
  1. Send POST `/api/search` with `{ "query": "Aries Ascendant" }`
  2. Compare result IDs with TC-S001
- **Expected Result:** Same horoscope IDs returned as TC-S001 (equivalent Sinhala query). Score values may differ.

#### TC-S008: Mixed-language query
- **User Story:** US-007, US-014
- **Priority:** Medium
- **Preconditions:** Horoscopes with Jupiter in 3rd house exist
- **Steps:**
  1. Send POST `/api/search` with `{ "query": "ගුරු in 3rd house" }`
- **Expected Result:** Query parsed successfully. `queryUnderstanding.language` is `"si"` (Sinhala characters detected). Results include horoscopes with Jupiter in 3rd house.

#### TC-S009: Complex multi-condition search
- **User Story:** US-008
- **Priority:** High
- **Preconditions:** Horoscopes matching all conditions exist: Aries ascendant + Saturn exalted + Jupiter in 3rd house + no beneficial aspects to Jupiter
- **Steps:**
  1. Send POST `/api/search` with `{ "query": "මේෂ ලග්නයේ ශනි උච්චව ගුරු 3 භාවයේ ඇති ගුරුට සුබ දෘෂ්ඨි නොවැටෙන" }`
- **Expected Result:** `queryUnderstanding.mode` is `"complex"`. `queryUnderstanding.conditions` array has 4 entries. Results satisfy ALL 4 conditions (AND logic). Hybrid score > 0.4.

#### TC-S010: Complex search with compound English query
- **User Story:** US-008
- **Priority:** High
- **Preconditions:** Same as TC-S009
- **Steps:**
  1. Send POST `/api/search` with `{ "query": "Aries ascendant with exalted Saturn, Jupiter in 3rd house and Jupiter not receiving beneficial aspects" }`
- **Expected Result:** Same conditions parsed. Equivalent result set to TC-S009.

#### TC-S011: Yoga-based search
- **User Story:** US-008
- **Priority:** High
- **Preconditions:** Horoscopes with Parivartana Yoga exist
- **Steps:**
  1. Send POST `/api/search` with `{ "query": "පරිවර්තන යෝග තිබෙන" }`
- **Expected Result:** Results include horoscopes where `calculatedDetails.yogas` contains "Parivartana Yoga". Precision ≥ 90%.

#### TC-S012: Career/life-domain search
- **User Story:** US-008
- **Priority:** Medium
- **Preconditions:** Horoscopes with career-suitable indications exist
- **Steps:**
  1. Send POST `/api/search` with `{ "query": "රැකියාව ගුරු වෘත්තිය විය හැකි" }`
- **Expected Result:** Results map career query to astrological criteria (10th house, etc.). Precision ≥ 70%. Disclaimer included in response.

#### TC-S013: Query understanding — full confidence
- **User Story:** US-008
- **Priority:** Medium
- **Preconditions:** LLM parser returns confidence ≥ 0.8
- **Steps:**
  1. Send POST `/api/search` with a well-formed complex query
  2. Inspect `queryUnderstanding` object
- **Expected Result:** `queryUnderstanding.understoodAll` is `true`. `confidence` ≥ 0.8. `mode` is `"complex"`. Banner on client shows ✅ icon.

#### TC-S014: Query understanding — partial confidence
- **User Story:** US-008
- **Priority:** Medium
- **Preconditions:** LLM parser returns confidence 0.5–0.79
- **Steps:**
  1. Send POST `/api/search` with an ambiguous query
  2. Inspect `queryUnderstanding` object
- **Expected Result:** `queryUnderstanding.understoodAll` is `false`. `confidence` 0.5–0.79. `notRecognized` list provided. Client shows ⚠️ banner.

#### TC-S015: Query understanding — low confidence fallback
- **User Story:** US-008
- **Priority:** Medium
- **Preconditions:** LLM parser returns confidence < 0.5 or fails
- **Steps:**
  1. Mock LLM to return low confidence
  2. Send POST `/api/search` with complex query
- **Expected Result:** System falls back to keyword parsing. `queryUnderstanding.mode` is `"basic"`. Results returned using keyword matching.

#### TC-S016: Contradictory conditions detected
- **User Story:** US-008
- **Priority:** Medium
- **Preconditions:** LLM parser identifies contradictory conditions
- **Steps:**
  1. Send POST `/api/search` with `{ "query": "Aries ascendant with Pisces ascendant" }`
- **Expected Result:** 200 OK. `results` is empty array. `total` is 0. `queryUnderstanding` flags contradiction. Client shows "contradictory conditions" message.

#### TC-S017: Empty query
- **User Story:** US-007
- **Priority:** High
- **Steps:**
  1. Send POST `/api/search` with `{ "query": "" }`
- **Expected Result:** 400 Bad Request. Error body: `{ "error": "Query is required" }`. No search performed.

#### TC-S018: Query too long (> 500 chars)
- **User Story:** US-007
- **Priority:** Low
- **Steps:**
  1. Send POST `/api/search` with query of 501 characters
- **Expected Result:** 400 Bad Request. Error body indicates query exceeds max length.

#### TC-S019: Query with special characters / emojis
- **User Story:** US-007
- **Priority:** Low
- **Steps:**
  1. Send POST `/api/search` with `{ "query": "Aries 🔥 ascendant <script>alert(1)</script>" }`
- **Expected Result:** Query processed. Non-alphanumeric characters (except Sinhala Unicode) stripped. Results returned for "Aries ascendant".

#### TC-S020: Query with unrecognizable astrological terms
- **User Story:** US-007
- **Priority:** Low
- **Steps:**
  1. Send POST `/api/search` with `{ "query": "weather today" }`
- **Expected Result:** No specific conditions parsed. Fallback to general text similarity / keyword matching. Results ranked by text relevance. `queryUnderstanding.mode` is `"basic"`.

#### TC-S021: No results found
- **User Story:** US-007
- **Priority:** Medium
- **Preconditions:** No horoscopes match the query
- **Steps:**
  1. Send POST `/api/search` with `{ "query": "ගුරු 12 භාවයේ" }` (Jupiter in 12th — no matches in test data)
- **Expected Result:** 200 OK. `results` is empty array. `total` is 0.

#### TC-S022: Short query (< 3 characters)
- **User Story:** US-007
- **Priority:** Low
- **Steps:**
  1. Send POST `/api/search` with `{ "query": "ra" }`
- **Expected Result:** Query processed as partial match. Prefix matching attempted on planet/sign names. Results returned if partial match found.

#### TC-S023: Search with page beyond total
- **User Story:** US-015
- **Priority:** Low
- **Preconditions:** 3 total results, pageSize=5
- **Steps:**
  1. Send POST `/api/search` with `{ "query": "මේෂ ලග්නය", "page": 2, "pageSize": 5 }`
- **Expected Result:** 200 OK. `results` is empty array (not error). `total` is 3. `page` is 2, `totalPages` is 1.

#### TC-S024: Invalid page/pageSize values
- **User Story:** US-015
- **Priority:** Medium
- **Steps:**
  1. Send POST `/api/search` with `{ "page": 0, "pageSize": 0 }`
  2. Send with `{ "page": -1, "pageSize": 200 }`
- **Expected Result:** 400 Bad Request for each. Validation error for invalid values.

#### TC-S025: Search without auth
- **User Story:** US-007
- **Priority:** High
- **Steps:**
  1. Send POST `/api/search` without session/cookie
- **Expected Result:** 401 Unauthorized. No search performed.

#### TC-S026: Search rate limit exceeded
- **User Story:** US-007
- **Priority:** Medium
- **Preconditions:** 30 requests already sent in current window
- **Steps:**
  1. Send 31st POST `/api/search` within the rate limit window
- **Expected Result:** 429 Too Many Requests. `Retry-After` header present. Error body with rate limit message.

### 1.2 POST /api/search/filter — Save Filter Configuration

#### TC-S027: Save filter configuration
- **User Story:** US-009, US-016
- **Priority:** Medium
- **Preconditions:** Authenticated user
- **Steps:**
  1. Send POST `/api/search/filter` with `{ "name": "My Study", "query": "මංගල දෝෂය", "filterConfig": { "visibleSections": { "birthChart": true, "yogas": true } } }`
- **Expected Result:** 201 Created. Response contains `id`, `name`, `query`, `filterConfig`, `createdAt`.

#### TC-S028: Save filter with default name (__default__)
- **User Story:** US-009
- **Priority:** Medium
- **Preconditions:** Authenticated user
- **Steps:**
  1. Send POST `/api/search/filter` with `{ "name": "__default__", "filterConfig": { "visibleSections": { "birthChart": true } } }` (no `query` field)
- **Expected Result:** 200 OK. Config saved as user's default. Not shown in saved searches list UI.

#### TC-S029: Save filter duplicate name
- **User Story:** US-016
- **Priority:** Low
- **Preconditions:** Saved filter with name "My Study" already exists
- **Steps:**
  1. Send POST `/api/search/filter` with `{ "name": "My Study", "query": "...", "filterConfig": {} }`
- **Expected Result:** 409 Conflict. Error: "A saved search with this name already exists." Client prompts overwrite.

#### TC-S030: GET saved filters
- **User Story:** US-016
- **Priority:** Medium
- **Preconditions:** Authenticated user with 3 saved filters
- **Steps:**
  1. Send GET `/api/search/filter`
- **Expected Result:** 200 OK. Array of saved filters. Each has `id`, `name`, `query`, `filterConfig`, `lastRunAt`, `resultCount`. Sorted by `lastRunAt` desc.

#### TC-S031: PUT update saved filter
- **User Story:** US-016
- **Priority:** Medium
- **Steps:**
  1. Send PUT `/api/search/filter/:id` with `{ "name": "Updated Name", "filterConfig": { "visibleSections": { "dashas": false } } }`
- **Expected Result:** 200 OK. Updated fields persisted. Unchanged fields preserve original values.

#### TC-S032: DELETE saved filter
- **User Story:** US-016
- **Priority:** Medium
- **Steps:**
  1. Send DELETE `/api/search/filter/:id`
- **Expected Result:** 200 OK or 204 No Content. Filter no longer returned in GET.

#### TC-S033: Max saved filters (50)
- **User Story:** US-016
- **Priority:** Low
- **Preconditions:** 50 saved filters exist for user
- **Steps:**
  1. Send POST `/api/search/filter` with new filter
- **Expected Result:** 403 or 400. Error: "Maximum 50 saved searches reached." Filter not saved.

### 1.3 Search History Endpoints

#### TC-S034: GET search history
- **User Story:** US-017
- **Priority:** Medium
- **Preconditions:** Authenticated user with 5 history entries
- **Steps:**
  1. Send GET `/api/search/history`
- **Expected Result:** 200 OK. `entries` array of 5 items. Each has `id`, `query`, `resultCount`, `language`, `source`, `createdAt`. Sorted by `createdAt` desc.

#### TC-S035: GET search history — empty
- **User Story:** US-017
- **Priority:** Low
- **Preconditions:** New user with no history
- **Steps:**
  1. Send GET `/api/search/history`
- **Expected Result:** 200 OK. `entries` is empty array. `total` is 0.

#### TC-S036: DELETE all history
- **User Story:** US-017
- **Priority:** Medium
- **Steps:**
  1. Send DELETE `/api/search/history`
  2. Send GET `/api/search/history`
- **Expected Result:** DELETE returns 200. Subsequent GET returns empty entries.

#### TC-S037: DELETE single history entry
- **User Story:** US-017
- **Priority:** Low
- **Steps:**
  1. Send DELETE `/api/search/history/:id`
- **Expected Result:** 200. Entry removed. Other history entries remain.

#### TC-S038: History auto-purge at 50 entries
- **User Story:** US-017
- **Priority:** Low
- **Preconditions:** 50 history entries exist
- **Steps:**
  1. Perform a new search
  2. GET `/api/search/history`
- **Expected Result:** Still 50 items. Oldest entry removed, newest added.

#### TC-S039: Duplicate consecutive query within 5 min
- **User Story:** US-017
- **Priority:** Low
- **Preconditions:** Recent search with query "මේෂ ලග්නය" exists
- **Steps:**
  1. Send same query "මේෂ ලග්නය" within 5 minutes
  2. GET `/api/search/history`
- **Expected Result:** No new entry created. Existing entry's `createdAt` timestamp updated.

### 1.4 Search Bookmark Endpoints

#### TC-S040: Bookmark a horoscope
- **User Story:** US-018
- **Priority:** Medium
- **Preconditions:** Authenticated user, existing horoscope
- **Steps:**
  1. Send POST `/api/search/bookmark` with `{ "horoscopeId": "<id>", "notes": "Interesting", "queryContext": "මංගල දෝෂය" }`
- **Expected Result:** 201 Created. Response has `id`, `user`, `horoscope`, `notes`, `queryContext`, `createdAt`.

#### TC-S041: Bookmark duplicate
- **User Story:** US-018
- **Priority:** Low
- **Preconditions:** Horoscope already bookmarked by user
- **Steps:**
  1. Send POST `/api/search/bookmark` with same `horoscopeId`
- **Expected Result:** 409 Conflict. Error: "Horoscope already bookmarked."

#### TC-S042: GET bookmarks
- **User Story:** US-018
- **Priority:** Medium
- **Preconditions:** User has 3 bookmarks
- **Steps:**
  1. Send GET `/api/search/bookmark`
- **Expected Result:** 200 OK. Array of bookmarks with full bookmark details.

#### TC-S043: UPDATE bookmark notes
- **User Story:** US-018
- **Priority:** Low
- **Steps:**
  1. Send PUT `/api/search/bookmark/:horoscopeId` with `{ "notes": "Updated note" }`
- **Expected Result:** 200. Notes updated. Other fields unchanged.

#### TC-S044: DELETE bookmark
- **User Story:** US-018
- **Priority:** Low
- **Steps:**
  1. Send DELETE `/api/search/bookmark/:horoscopeId`
- **Expected Result:** 200. Bookmark removed.

#### TC-S045: Bookmark max limit (100)
- **User Story:** US-018
- **Priority:** Low
- **Preconditions:** 100 bookmarks exist
- **Steps:**
  1. Send POST `/api/search/bookmark`
- **Expected Result:** 403. Error: "Maximum 100 bookmarks reached."

### 1.5 Export Endpoint

#### TC-S046: Export search results as CSV
- **User Story:** US-019
- **Priority:** Medium
- **Preconditions:** Authenticated user, search results available
- **Steps:**
  1. Send GET `/api/search/export?format=csv&query=මේෂ ලග්නය&page=1`
- **Expected Result:** 200. `Content-Type: text/csv`. `Content-Disposition: attachment`. CSV has correct columns. Anonymous names respected.

#### TC-S047: Export search results as JSON
- **User Story:** US-019
- **Priority:** Low
- **Steps:**
  1. Send GET `/api/search/export?format=json&query=මේෂ ලග්නය&page=1`
- **Expected Result:** 200. JSON response matching search response shape (flattened).

#### TC-S048: Export with zero results
- **User Story:** US-019
- **Priority:** Low
- **Preconditions:** No results match
- **Steps:**
  1. Send GET `/api/search/export?format=csv&query=xyzxyz&page=1`
- **Expected Result:** 200. CSV with header row only (no data rows). Client disables export button.

#### TC-S049: Export rate limit
- **User Story:** US-019
- **Priority:** Medium
- **Preconditions:** 10 export requests already sent in current window
- **Steps:**
  1. Send 11th export request
- **Expected Result:** 429. `Retry-After` header.

#### TC-S050: Export respects filter config
- **User Story:** US-019
- **Priority:** Medium
- **Preconditions:** Config has birthChart=ON, dashas=OFF
- **Steps:**
  1. Export CSV
- **Expected Result:** CSV includes birth chart column. No dasha column.

---

## 2. Privacy & Authorization Tests

#### TC-S051: Own horoscope always visible in search
- **User Story:** US-007
- **Priority:** High
- **Preconditions:** User owns private horoscope(s)
- **Steps:**
  1. Search for own horoscope by name/ascendant
- **Expected Result:** Own private horoscopes appear in results. All own horoscopes visible regardless of isPublic.

#### TC-S052: Other's private horoscope hidden
- **User Story:** US-007
- **Priority:** High
- **Preconditions:** User A has private horoscope
- **Steps:**
  1. Log in as User B
  2. Search using conditions that match User A's private horoscope
- **Expected Result:** User A's private horoscope NEVER appears. Not even in result count.

#### TC-S053: displayName=false — anonymous name for non-owner
- **User Story:** US-007
- **Priority:** High
- **Preconditions:** User A has public horoscope with displayName=false
- **Steps:**
  1. Log in as User B
  2. Search and find User A's horoscope
  3. Inspect `horoscope.name` field
- **Expected Result:** `name` contains anonymous placeholder (e.g., "Anonymous Horoscope #A3F2"). Owner sees real name.

#### TC-S054: Super Admin sees all horoscopes
- **User Story:** US-007
- **Priority:** High
- **Preconditions:** Super Admin user, private horoscopes exist
- **Steps:**
  1. Log in as Super Admin
  2. Search without specific filters
- **Expected Result:** All horoscopes (public + private) appear. Private results have indicator badge. Real names shown.

#### TC-S055: Direct access to private horoscope returns 404
- **User Story:** US-007
- **Priority:** Medium
- **Preconditions:** User A has private horoscope
- **Steps:**
  1. Log in as User B
  2. Send GET `/api/horoscope/:id` for User A's private horoscope
- **Expected Result:** 404 Not Found (not 403). No indication horoscope exists.

#### TC-S056: Deleted horoscope removed from results
- **User Story:** US-007
- **Priority:** Medium
- **Preconditions:** Horoscope exists and appears in search results
- **Steps:**
  1. Delete the horoscope as owner
  2. Re-run the same search
- **Expected Result:** Horoscope no longer appears in results.

#### TC-S057: Bookmark respects privacy after horoscope made private
- **User Story:** US-018
- **Priority:** Medium
- **Preconditions:** User B bookmarked User A's public horoscope
- **Steps:**
  1. User A makes horoscope private
  2. User B views bookmarks list
  3. User B attempts to open bookmarked horoscope
- **Expected Result:** Bookmark entry still visible in list. Clicking navigates to horoscope detail. 404 displayed due to privacy. Bookmark shows "Horoscope no longer available" placeholder.

#### TC-S058: Bookmark of deleted horoscope
- **User Story:** US-018
- **Priority:** Low
- **Preconditions:** User B bookmarked a horoscope that is later deleted
- **Steps:**
  1. View bookmarks list
- **Expected Result:** Bookmark entry shows "Horoscope no longer available" placeholder. No data leak.

#### TC-S059: History isolation between users
- **User Story:** US-017
- **Priority:** High
- **Preconditions:** User A and User B both have search history
- **Steps:**
  1. Log in as User A
  2. GET `/api/search/history`
  3. Try accessing User B's history endpoint
- **Expected Result:** User A sees only User A's history. Cross-user history access returns empty or 403.

---

## 3. RAG Pipeline Tests

#### TC-S060: LLM parser — all query types
- **User Story:** US-008
- **Priority:** High
- **Preconditions:** Test corpus of 20+ query→expected-conditions mappings available as JSON fixture
- **Steps:**
  1. For each entry in test corpus, send query to parser (mock external dependencies)
  2. Compare parsed conditions against expected
- **Expected Result:** ≥ 90% of query types have all expected conditions parsed correctly. Report mismatches.

#### TC-S061: LLM parser failure → keyword fallback
- **User Story:** US-008
- **Priority:** High
- **Preconditions:** Mock Gemini API to throw network error
- **Steps:**
  1. Send query to search pipeline
  2. Inspect processing path
- **Expected Result:** Pipeline logs Gemini failure. Falls back to keyword parser. Results returned. `queryUnderstanding.mode` is `"basic"`.

#### TC-S062: LLM timeout → keyword fallback
- **User Story:** US-008
- **Priority:** Medium
- **Preconditions:** Mock Gemini API to hang for > 10s
- **Steps:**
  1. Send query with timeout
- **Expected Result:** After timeout, falls back to keyword parser. Results returned. Incident logged.

#### TC-S063: Transformers.js failure → skip vector search
- **User Story:** US-007
- **Priority:** Medium
- **Preconditions:** Mock Transformers.js pipeline to fail
- **Steps:**
  1. Send search query
- **Expected Result:** Pipeline logs Transformers.js failure. Skips vector search. Uses keyword parsing + MongoDB structured filters only. Results returned.

#### TC-S064: Qdrant unreachable → MongoDB-only
- **User Story:** US-007
- **Priority:** Medium
- **Preconditions:** Qdrant service stopped / network blocked
- **Steps:**
  1. Send search query
- **Expected Result:** Pipeline logs Qdrant failure. Falls back to MongoDB-only search. Results sorted by date/name (no relevance ranking). Results returned.

#### TC-S065: Full graceful degradation chain
- **User Story:** US-007, US-008
- **Priority:** Medium
- **Preconditions:** Gemini, Transformers.js, Qdrant all unavailable
- **Steps:**
  1. Send search query
- **Expected Result:** All fallbacks engaged. Keyword parsing + MongoDB-only. Results returned (no 500 error). Each fallback logged separately with reason.

#### TC-S066: Embedding generation on horoscope create
- **User Story:** US-007
- **Priority:** High
- **Preconditions:** Authenticated user
- **Steps:**
  1. Create a new public horoscope
  2. Wait for background embedding job to complete (up to 5s)
  3. Check SearchEmbedding collection in DB
  4. Search for the new horoscope
- **Expected Result:** Embedding job creates SearchEmbedding records (SI + EN). Qdrant points upserted. Horoscope appears in vector search results. Text content includes all required fields (ascendant, planets, yoga, dosha, dasha).

#### TC-S067: Embedding generation on private→public
- **User Story:** US-007, US-006
- **Priority:** High
- **Preconditions:** Existing private horoscope
- **Steps:**
  1. Toggle isPublic from false→true
  2. Check embedding job queue
  3. Wait for job completion
  4. Search as another user
- **Expected Result:** Embedding generation queued. After completion, horoscope appears in other users' search results. SearchEmbedding.isActive=true.

#### TC-S068: Embedding deactivation on public→private
- **User Story:** US-007, US-006
- **Priority:** High
- **Preconditions:** Existing public horoscope with active embeddings
- **Steps:**
  1. Toggle isPublic from true→false
  2. Immediately check SearchEmbedding
  3. Search as another user
- **Expected Result:** SearchEmbedding.isActive set to false synchronously. Qdrant payload `isPublic` updated. Horoscope immediately invisible to other users (before cleanup job runs). Owner can still find it.

#### TC-S069: Embedding re-index on horoscope update
- **User Story:** US-007
- **Priority:** Medium
- **Preconditions:** Public horoscope with existing embedding
- **Steps:**
  1. Update horoscope birth data (triggers recalculation)
  2. Check for embedding re-index queue
- **Expected Result:** Re-index job queued. Old embeddings replaced with new. Search results eventually consistent with updated data.

#### TC-S070: Chunking for large horoscope text
- **User Story:** US-007
- **Priority:** Low
- **Preconditions:** Horoscope with text content > 512 tokens
- **Steps:**
  1. Trigger embedding generation
  2. Check SearchEmbedding records
- **Expected Result:** Multiple SearchEmbedding records created with sequential `chunkIndex`. All chunks have same `horoscope.id` and `language`. Max score across chunks used for horoscope's vector similarity.

#### TC-S071: Hybrid scoring formula
- **User Story:** US-008
- **Priority:** Medium
- **Preconditions:** Known vector similarity scores and structured match scores for test data
- **Steps:**
  1. Run a search query
  2. Verify score calculation for each result
- **Expected Result:** Score = `0.7 * vectorSimilarity + 0.3 * structuredMatchScore`. Score is float 0–1. Scores sorted descending.

#### TC-S072: Minimum score threshold applied
- **User Story:** US-007, US-008
- **Priority:** Medium
- **Preconditions:** Some horoscopes have scores below threshold
- **Steps:**
  1. Run basic search — verify threshold 0.3 applied
  2. Run complex search — verify threshold 0.4 applied
  3. Check no results below threshold in response
- **Expected Result:** Results below threshold excluded. Threshold configurable server-side.

#### TC-S073: Deduplication by horoscope ID
- **User Story:** US-008
- **Priority:** Medium
- **Preconditions:** Same horoscope returned by both vector search and structured filter
- **Steps:**
  1. Run search that triggers hybrid path
  2. Inspect results for duplicate IDs
- **Expected Result:** No duplicate horoscope IDs in results. Only one entry per horoscope, using the higher score.

---

## 4. UI/UX Tests

### 4.1 Search Page — Initial State

#### TC-S074: Search page loads with empty state
- **User Story:** US-007
- **Priority:** High
- **Preconditions:** Authenticated user, no previous search session
- **Steps:**
  1. Navigate to `/search`
- **Expected Result:** Search input is empty with placeholder "Search horoscopes using natural language..." (EN) / "ස්වාභාවික භාෂාවෙන් ලග්න සොයන්න..." (SI). Suggestions chips shown. Recent searches shown (if any). Actions bar visible with config, save, history, export icons. Results area shows empty state message: "Type a natural language query to search horoscopes."

#### TC-S075: Search input auto-focus on page load
- **User Story:** US-007
- **Priority:** Medium
- **Steps:**
  1. Navigate to `/search`
- **Expected Result:** Cursor is in search input. Placeholder visible. Input ready for text entry. Keyboard shortcut `/` also focuses input.

#### TC-S076: Suggestion chips shown on empty focus
- **User Story:** US-007
- **Priority:** Medium
- **Steps:**
  1. Click/focus empty search input
- **Expected Result:** 3-5 suggestion chips appear below input. Suggestions are common astrological phrases. Clicking a suggestion fills input and triggers search.

#### TC-S077: Recent searches shown on empty focus
- **User Story:** US-017
- **Priority:** Medium
- **Preconditions:** User has search history
- **Steps:**
  1. Focus empty search input
- **Expected Result:** Recent searches listed below suggestions. Each shows query text, date/time, result count. Clicking fills input and triggers search.

### 4.2 Search Input — Interaction

#### TC-S078: Typing triggers debounce
- **User Story:** US-007
- **Priority:** High
- **Preconditions:** Search input focused, initial empty
- **Steps:**
  1. Type "මේ" (fast, 100ms)
  2. Type "ෂ" (fast, 100ms)
  3. Wait 100ms (before debounce fires)
  4. Wait 400ms (after debounce fires)
- **Expected Result:** No search fired before 300ms. Single search fired after 300ms debounce with full query "මේෂ". No intermediate searches for partial text.

#### TC-S079: Enter key submits immediately
- **User Story:** US-007
- **Priority:** High
- **Steps:**
  1. Type "මේෂ ලග්නය"
  2. Press Enter
- **Expected Result:** Search fires immediately (no debounce wait). Input shows searching state.

#### TC-S080: Shift+Enter inserts newline
- **User Story:** US-007
- **Priority:** Low
- **Steps:**
  1. Type "Aries ascendant"
  2. Press Shift+Enter
  3. Type "Saturn exalted"
- **Expected Result:** Newline inserted. Textarea height increases. Search NOT submitted.

#### TC-S081: Language indicator updates in real-time
- **User Story:** US-007, US-014
- **Priority:** Medium
- **Steps:**
  1. Type Sinhala text
  2. Observe language indicator
  3. Clear input
  4. Type English text
  5. Observe language indicator
- **Expected Result:** Typing Sinhala shows "🇱🇰 Sinhala detected". Typing English shows "🇬🇧 English detected". Indicator updates within 100ms of text change. Clear input hides indicator.

#### TC-S082: Query too long warning
- **User Story:** US-007
- **Priority:** Low
- **Steps:**
  1. Type query > 500 characters
- **Expected Result:** Inline warning appears at character 501: "Query too long — try a shorter phrase" / "සෙවුම දිග වැඩියි — කෙටි වාක්‍යයක් උත්සාහ කරන්න". Input prevents more text (500 char max). Search button still works, server rejects > 500 chars.

#### TC-S083: Search button disabled when empty
- **User Story:** US-007
- **Priority:** Medium
- **Steps:**
  1. Navigate to search page
- **Expected Result:** Search button is disabled (greyed out, pointer-events: none). After typing text, button becomes active. After clearing, button disabled again.

#### TC-S084: Clear button clears input
- **User Story:** US-007
- **Priority:** Low
- **Steps:**
  1. Type query and see results
  2. Click Clear button
- **Expected Result:** Input emptied. Results remain visible (or reset to initial state per UX spec). Language indicator hidden.

### 4.3 Results Display

#### TC-S085: Results rendered as full-detail cards
- **User Story:** US-007
- **Priority:** High
- **Preconditions:** Search returned 3+ results
- **Steps:**
  1. Submit search query
  2. Observe results
- **Expected Result:** Each result is a vertical full-detail card. Card content (top to bottom): name, ascendant, score, charts (horizontal scroll), calculations, dashas, yogas, doshas. Each card independently scrollable horizontally for charts.

#### TC-S086: Results header shows count and page info
- **User Story:** US-007, US-015
- **Priority:** Medium
- **Preconditions:** 42 total results, pageSize=5
- **Steps:**
  1. Observe results header
- **Expected Result:** "Found 42 horoscopes (showing 1-5)" / "ලග්න 42 ක් හමු විය (1-5 පෙන්වයි)". Sort dropdown visible. Collapse All / Expand All buttons visible.

#### TC-S087: All cards expanded by default
- **User Story:** US-007, US-020
- **Priority:** Medium
- **Steps:**
  1. Search → observe initial card state
- **Expected Result:** All result cards rendered in expanded state. Full detail visible for each card. ▼ icon (expanded) shown on each card header.

#### TC-S088: Charts section with horizontal scroll
- **User Story:** US-007
- **Priority:** High
- **Steps:**
  1. Scroll to charts section in an expanded card
- **Expected Result:** 3 chart SVGs displayed inline (Birth, Navamsa, House). Each chart min-width 280px, aspect-ratio 1:1. Container has `overflow-x: auto`. Horizontal scroll works. Scroll indicator (shadow/arrow) shown on overflow. Charts lazy-loaded via IntersectionObserver.

#### TC-S089: Chart lazy loading via IntersectionObserver
- **User Story:** US-007
- **Priority:** Medium
- **Preconditions:** 10 results on page, each with 3 charts = 30 charts total
- **Steps:**
  1. Scroll results list
  2. Observe chart rendering timing
- **Expected Result:** Charts only render when card is within 200px of viewport. Charts outside viewport show skeleton placeholder (280x280 pulsing rectangle). Scrolling down triggers chart rendering with no visible jank.

#### TC-S090: All default sections visible
- **User Story:** US-009
- **Priority:** High
- **Preconditions:** New user, no saved config
- **Steps:**
  1. Search → observe card sections
- **Expected Result:** Default visible sections: Name, Birth Chart, Navamsa (D9), House Chart, Ascendant, Planet Positions, Dashas. Sections not in defaults are hidden until toggled ON.

#### TC-S091: No data for section shows placeholder
- **User Story:** US-009
- **Priority:** Low
- **Preconditions:** Horoscope has no yogas calculated
- **Steps:**
  1. Enable Yogas section in config
  2. Observe result card
- **Expected Result:** Yogas section header visible. Content area shows "No data available" / "දත්ත නොමැත". Section is NOT hidden.

#### TC-S092: Loading skeleton during search
- **User Story:** US-007
- **Priority:** Medium
- **Preconditions:** API response artificially delayed (> 1s)
- **Steps:**
  1. Submit search
  2. Observe loading state
- **Expected Result:** 3 skeleton cards appear immediately. Each has header placeholder, 3 chart skeleton rectangles (pulsing), and section skeletons. Animation: opacity pulse 0.4→1→0.4, 1.5s infinite. When results load, skeletons fade out (150ms) and cards fade in with stagger (50ms per card).

### 4.4 Collapse/Expand

#### TC-S093: Collapse individual card
- **User Story:** US-020
- **Priority:** Medium
- **Steps:**
  1. Click ▼ (expand) icon on an expanded card
- **Expected Result:** Card content collapses with max-height transition (200ms ease-in). Chevron rotates 90° (▼→▶). Card shows compact summary: name, ascendant, score badge, bookmark icon. Charts and sections hidden.

#### TC-S094: Expand individual card
- **User Story:** US-020
- **Priority:** Medium
- **Steps:**
  1. Click ▶ (collapse) icon on a collapsed card
- **Expected Result:** Card content expands with max-height transition (300ms ease-out). Chevron rotates 90° (▶→▼). Full detail visible. Charts lazy-rendered if near viewport.

#### TC-S095: Multiple cards expanded simultaneously
- **User Story:** US-020
- **Priority:** Low
- **Preconditions:** 5 result cards
- **Steps:**
  1. Collapse all cards
  2. Expand cards 1, 3, 5
- **Expected Result:** Cards 1, 3, 5 are expanded. Cards 2, 4 are collapsed. No accordion constraint. All three expanded cards render full detail.

#### TC-S096: Collapse All / Expand All
- **User Story:** US-020
- **Priority:** Medium
- **Preconditions:** 5 expanded cards
- **Steps:**
  1. Click "Collapse All" / "සියල්ල හකුළන්න"
  2. Click "Expand All" / "සියල්ල විස්තාරණය කරන්න"
- **Expected Result:** Collapse All collapses all 5 cards. Button label changes to "Expand All". Expand All expands all cards. Toggle-all button visually updates.

### 4.5 Config Panel

#### TC-S097: Open config panel
- **User Story:** US-009
- **Priority:** Medium
- **Preconditions:** Search results displayed
- **Steps:**
  1. Click ⚙️ gear icon in actions bar
- **Expected Result:** Config panel opens: slide-out from right (desktop, 320px) / slide-up bottom sheet (mobile). Panel shows all toggleable sections grouped by category. Each section has a checkbox toggle. Current state reflects saved config.

#### TC-S098: Toggle section visibility
- **User Story:** US-009
- **Priority:** High
- **Steps:**
  1. Open config panel
  2. Toggle "Yogas" from OFF→ON
  3. Observe result cards
  4. Toggle "Yogas" from ON→OFF
- **Expected Result:** Toggling ON: Yogas section appears in all result cards instantly (no re-fetch, CSS conditional render). Toggling OFF: Yogas section disappears instantly. Config save debounced (500ms).

#### TC-S099: Config persists after page refresh
- **User Story:** US-009
- **Priority:** High
- **Steps:**
  1. Toggle some sections OFF
  2. Refresh page
  3. Search again
- **Expected Result:** Toggled-off sections remain hidden. Config loaded from server (GET /api/search/filter with `__default__`).

#### TC-S100: Reset to defaults
- **User Story:** US-009
- **Priority:** Medium
- **Steps:**
  1. Toggle multiple sections OFF
  2. Click "Reset to Defaults"
- **Expected Result:** All sections return to default state (Birth Chart, Navamsa, House Chart, Ascendant, Planet Positions, Dashas = ON; all others = OFF). Applied immediately.

#### TC-S101: Select All / Deselect All
- **User Story:** US-009
- **Priority:** Low
- **Steps:**
  1. Click "Deselect All"
  2. Click "Select All"
- **Expected Result:** All checkboxes cleared. All sections hidden. All checkboxes checked. All sections visible.

#### TC-S102: Non-default config indicator
- **User Story:** US-009
- **Priority:** Low
- **Steps:**
  1. Toggle any section from default
- **Expected Result:** ⚙️ config icon shows a small dot/badge indicating non-default config is active. Resetting to defaults removes the dot.

#### TC-S103: Config panel — keyboard navigation
- **User Story:** US-009
- **Priority:** Medium
- **Steps:**
  1. Open config panel
  2. Tab through toggles
  3. Press Space to toggle
  4. Press Escape to close
- **Expected Result:** Focus moves sequentially through toggles. Space toggles checkbox. Escape closes panel and returns focus to ⚙️ button. Focus trap within panel when open.

### 4.6 Score Badge

#### TC-S104: Score badge visualization
- **User Story:** US-007
- **Priority:** Medium
- **Preconditions:** Results with scores in each range
- **Steps:**
  1. Observe score badges
- **Expected Result:** 0.8–1.0: green background, "Excellent match" / "ඉතා හොඳ ගැළපීම". 0.6–0.79: indigo, "Strong match" / "ශක්තිමත් ගැළපීම". 0.4–0.59: amber, "Moderate match" / "මධ්‍යස්ථ ගැළපීම". 0.0–0.39: secondary text, "Weak match" / "දුර්වල ගැළපීම". Percentage shown: "87%".

#### TC-S105: Score badge ARIA label
- **User Story:** US-007
- **Priority:** Low
- **Steps:**
  1. Inspect score badge element
- **Expected Result:** `aria-label="Match score: 87 percent"` or equivalent localized string.

### 4.7 Query Understanding Banner

#### TC-S106: Full understanding banner
- **User Story:** US-008
- **Priority:** Medium
- **Preconditions:** LLM confidence ≥ 0.8
- **Steps:**
  1. Submit complex query
  2. Observe banner below search input
- **Expected Result:** Banner shows ✅ "Query understood (confidence: 92%): Aries Ascendant, Saturn Exaltation, Jupiter in 3rd House". Green left border. Auto-dismiss after 8s. Manual close (X) available.

#### TC-S107: Partial understanding banner
- **User Story:** US-008
- **Priority:** Medium
- **Preconditions:** LLM confidence 0.5–0.79, some conditions unrecognized
- **Steps:**
  1. Submit ambiguous complex query
  2. Observe banner
- **Expected Result:** Banner shows ⚠️ "We understood 3 of 5 conditions: ... The following conditions were not recognized: ...". Amber left border. Recognized and unrecognized conditions clearly separated.

#### TC-S108: Low confidence banner
- **User Story:** US-008
- **Priority:** Low
- **Steps:**
  1. Mock LLM confidence < 0.5
- **Expected Result:** Banner shows ❌ "Query interpreted with limited confidence (45%): Results may not fully match your intended search. Try rephrasing for better results." Red left border.

#### TC-S109: Banner accessibility
- **User Story:** US-008
- **Priority:** Medium
- **Steps:**
  1. Inspect banner element
- **Expected Result:** `role="status"` with `aria-live="polite"`. Icon is decorative (aria-hidden). Color is not sole indicator (icon + text + border used).

### 4.8 Bookmark UI

#### TC-S110: Bookmark toggle on result card
- **User Story:** US-018
- **Priority:** Medium
- **Steps:**
  1. Click 🔖 icon on a result card
  2. Click 🔖 again
- **Expected Result:** First click: icon fills (outline→filled). Scale pulse animation (1.0→1.2→1.0, 200ms). Toast "Bookmark added" / "සුරැකුම එකතු කරන ලදී". API call POST /api/search/bookmark. Second click: icon empties (filled→outline). Bookmark removed. API call DELETE.

#### TC-S111: Bookmarks panel
- **User Story:** US-018
- **Priority:** Medium
- **Preconditions:** User has bookmarks
- **Steps:**
  1. Open Bookmarks panel
- **Expected Result:** Panel shows list of bookmarked horoscopes. Each entry: name (or anonymous), ascendant, birth date, query context, note, saved date. [Open] [Edit Note] [Remove] actions per entry. Max limit notice shown.

#### TC-S112: Bookmark navigation to detail
- **User Story:** US-018
- **Priority:** Medium
- **Steps:**
  1. Click [Open] on a bookmark entry
- **Expected Result:** Navigates to `/horoscope/:id`. Full horoscope detail page opens.

#### TC-S113: Bookmarks panel — empty state
- **User Story:** US-018
- **Priority:** Low
- **Preconditions:** No bookmarks
- **Steps:**
  1. Open Bookmarks panel
- **Expected Result:** "No bookmarks yet. Bookmark horoscopes from search results to save them here." / "තවම සුරැකුම් නැත. සෙවුම් ප්‍රතිඵලවලින් ලග්න සුරැකින්න."

### 4.9 Search History UI

#### TC-S114: History dropdown
- **User Story:** US-017
- **Priority:** Low
- **Preconditions:** User has search history
- **Steps:**
  1. Click 📋 History icon in actions bar
- **Expected Result:** Dropdown shows recent searches. Each entry: query text (truncated 60 chars), date/time, result count, language flag, source badge (basic/complex). Delete icon per entry. Clear All button at top.

#### TC-S115: Click history entry re-runs search
- **User Story:** US-017
- **Priority:** Medium
- **Steps:**
  1. Click a history entry
- **Expected Result:** Panel closes. Search input prefilled with query text. Search fires. Results displayed.

#### TC-S116: Clear all history with confirmation
- **User Story:** US-017
- **Priority:** Medium
- **Steps:**
  1. Click "Clear All" / "සියල්ල මකන්න"
- **Expected Result:** Confirmation dialog: "Clear all search history? This cannot be undone." / "සියලුම සෙවුම් ඉතිහාසය මකන්නද? මෙය ආපසු හැරවිය නොහැක." [Cancel] [Confirm]. Confirm clears all entries. Panel shows empty state.

#### TC-S117: History panel — empty state
- **User Story:** US-017
- **Priority:** Low
- **Preconditions:** No history
- **Steps:**
  1. Open History panel
- **Expected Result:** "No search history yet." / "තවම සෙවුම් ඉතිහාසය නැත."

### 4.10 Saved Searches UI

#### TC-S118: Save Search flow
- **User Story:** US-016
- **Priority:** Medium
- **Preconditions:** Search has been performed with results
- **Steps:**
  1. Click 💾 Save Search button
- **Expected Result:** Save Search modal appears. Name input (required). Shows current query and config summary. [Cancel] [Save] buttons. Enter valid name → POST /api/search/filter → Success toast: "Search saved!" / "සෙවුම සුරැකිණි!".

#### TC-S119: Save Search with duplicate name
- **User Story:** US-016
- **Priority:** Low
- **Preconditions:** Saved search with same name exists
- **Steps:**
  1. Try saving with existing name
- **Expected Result:** Warning: "A saved search with this name already exists. Overwrite?" with [Overwrite] [Rename] options.

#### TC-S120: Run saved search
- **User Story:** US-016
- **Priority:** Medium
- **Preconditions:** Saved searches exist
- **Steps:**
  1. Open Saved Searches panel
  2. Click [Run] on a saved search
- **Expected Result:** Search input prefilled with saved query. Config applied (sections toggled as saved). Search fires automatically. Results displayed.

#### TC-S121: Saved searches — empty state
- **User Story:** US-016
- **Priority:** Low
- **Preconditions:** No saved searches
- **Steps:**
  1. Open Saved Searches panel
- **Expected Result:** "No saved searches yet." / "තවම සුරැකුම් සෙවුම් නැත."

### 4.11 Export UI

#### TC-S122: Export button — enabled/disabled states
- **User Story:** US-019
- **Priority:** Medium
- **Preconditions:** Search with results / search with zero results
- **Steps:**
  1. Observe export button when results exist
  2. Observe export button when no results
- **Expected Result:** With results: dropdown shows CSV/JSON options. Without results: button disabled, tooltip "No results to export" / "එක්ස්පෝර්ට කිරීමට ප්‍රතිඵල නැත".

#### TC-S123: CSV export download
- **User Story:** US-019
- **Priority:** Medium
- **Steps:**
  1. Click Export → CSV
- **Expected Result:** File download initiated. Filename: "search-results.csv". CSV has correct columns. Data matches visible results. Anonymous names respected. Downloaded file opens correctly in spreadsheet software.

---

## 5. Pagination Tests

#### TC-S124: Pagination controls visible
- **User Story:** US-015
- **Priority:** Medium
- **Preconditions:** > 5 results
- **Steps:**
  1. Observe pagination section
- **Expected Result:** Pagination shows: [← Previous] Page 1 of N [Next →]. Desktop shows page numbers. Mobile shows prev/next only.

#### TC-S125: Next page loads results
- **User Story:** US-015
- **Priority:** Medium
- **Steps:**
  1. Click [Next →]
- **Expected Result:** Page 2 results load. Page number updates. Previous button becomes active. URL updates to `?page=2&query=...`. Scroll to top of results list.

#### TC-S126: Previous page loads results
- **User Story:** US-015
- **Priority:** Medium
- **Steps:**
  1. Navigate to page 2
  2. Click [← Previous]
- **Expected Result:** Returns to page 1. Previous button disabled. URL updates.

#### TC-S127: Page number in URL is shareable
- **User Story:** US-015
- **Priority:** Medium
- **Steps:**
  1. Navigate to page 3
  2. Copy URL
  3. Open URL in new tab
- **Expected Result:** Same page 3 results loaded. Same query preserved.

#### TC-S128: Filter change resets to page 1
- **User Story:** US-015
- **Priority:** Medium
- **Steps:**
  1. Navigate to page 3
  2. Modify search query
- **Expected Result:** Pagination resets to page 1. New search results from page 1.

#### TC-S129: No results — pagination hidden
- **User Story:** US-015
- **Priority:** Low
- **Preconditions:** Search returns 0 results
- **Steps:**
  1. Observe pagination area
- **Expected Result:** Pagination controls hidden. "No horoscopes match your query" message displayed.

#### TC-S130: Last page — Next button disabled
- **User Story:** US-015
- **Priority:** Low
- **Preconditions:** On the last page of results
- **Steps:**
  1. Click [Next →]
- **Expected Result:** Next button disabled/greyed. "No more results" message or nothing happens.

---

## 6. Sort Tests

#### TC-S131: Sort by relevance (default)
- **User Story:** US-021
- **Priority:** Medium
- **Preconditions:** Search results displayed
- **Steps:**
  1. Observe sort selector
- **Expected Result:** Default sort is "Relevance" / "ගැළපීම". Results sorted by score descending.

#### TC-S132: Sort by name A-Z
- **User Story:** US-021
- **Priority:** Low
- **Steps:**
  1. Select "Name (A-Z)" / "නම (A-Z)"
- **Expected Result:** Results re-sorted alphabetically. Anonymous entries sort by placeholder consistently. Sort selection preserved during current session.

#### TC-S133: Sort by date created
- **User Story:** US-021
- **Priority:** Low
- **Steps:**
  1. Select "Date Created (newest)" / "නිර්මාණ දිනය (අලුත්ම)"
  2. Select "Date Created (oldest)" / "නිර්මාණ දිනය (පැරණිම)"
- **Expected Result:** Newest first: most recent horoscopes at top. Oldest first: oldest horoscopes at top.

#### TC-S134: Sort by ascendant sign
- **User Story:** US-021
- **Priority:** Low
- **Steps:**
  1. Select "Ascendant Sign" / "ලග්න රාශිය"
- **Expected Result:** Results sorted by ascendant sign in zodiac order (Aries→Pisces).

#### TC-S135: Sort resets to relevance on new search
- **User Story:** US-021
- **Priority:** Low
- **Steps:**
  1. Change sort to Name
  2. Submit new search query
- **Expected Result:** Sort reverts to "Relevance" (default).

---

## 7. Accessibility Tests

#### TC-S136: Search input ARIA attributes
- **User Story:** US-007
- **Priority:** High
- **Steps:**
  1. Inspect search input element
- **Expected Result:** `role="searchbox"`. `aria-label="Search horoscopes"` / "ලග්න සොයන්න". `aria-autocomplete="list"` when suggestions visible.

#### TC-S137: Results region ARIA live
- **User Story:** US-007
- **Priority:** High
- **Steps:**
  1. Submit search
- **Expected Result:** Results region has `role="region"`, `aria-label="Search results"`, `aria-live="polite"`. Results count announced: "Found 42 horoscopes, showing 1 to 5". `aria-busy="true"` during search.

#### TC-S138: Result card ARIA
- **User Story:** US-007
- **Priority:** Medium
- **Steps:**
  1. Inspect result card element
- **Expected Result:** `role="article"`. `aria-label="{name} horoscope, {score} percent match"`. Expand button has `aria-expanded="true/false"`.

#### TC-S139: Keyboard navigation — full flow
- **User Story:** US-007
- **Priority:** High
- **Steps:**
  1. Press `/` (slash) → focus search input
  2. Type query → press Enter → search fires
  3. Tab → actions bar → config button → results list → pagination
  4. Tab to result card expand/collapse → Enter toggles
  5. Tab to bookmark → Space toggles
  6. Tab to pagination → Enter navigates page
- **Expected Result:** Full keyboard flow works. Visible focus ring (2px solid --primary, 2px offset) on all interactive elements. No keyboard traps.

#### TC-S140: Focus management
- **User Story:** US-007
- **Priority:** Medium
- **Steps:**
  1. Page loads → verify focus on search input
  2. Open config panel → verify focus on first toggle
  3. Close config (Escape) → verify focus returns to ⚙️
  4. Open history → verify focus on first entry
  5. Click entry → verify focus returns to search input (query prefilled)
  6. Paginate → verify focus moves to results region top
- **Expected Result:** Focus management follows UX spec section 17.4.

#### TC-S141: Error state ARIA
- **User Story:** US-007
- **Priority:** Medium
- **Steps:**
  1. Trigger search error
- **Expected Result:** Error banner has `role="alert"`, `aria-live="assertive"`. Focus moves to error banner. Message is read by screen reader.

#### TC-S142: Config toggles ARIA
- **User Story:** US-009
- **Priority:** Medium
- **Steps:**
  1. Open config panel
  2. Inspect toggle elements
- **Expected Result:** Each toggle has `role="checkbox"`, `aria-checked="true/false"`, `aria-label="{section name}"`. Panel has `role="dialog"`, `aria-modal="true"`.

#### TC-S143: Color contrast — score badges
- **User Story:** US-007
- **Priority:** High
- **Steps:**
  1. Run axe-core or Lighthouse audit on search results page
  2. Inspect score badge color contrast
- **Expected Result:** WCAG AA 4.5:1 text contrast on all score badges. WCAG AA 3:1 for non-text elements (badge backgrounds). No contrast failures.

#### TC-S144: Color not sole differentiator
- **User Story:** US-007
- **Priority:** High
- **Steps:**
  1. Inspect score badge visual differentiation
- **Expected Result:** Score badges differ by: (1) color, (2) label text ("Excellent"/"Strong"/etc.), (3) score percentage. Satisfies WCAG 1.4.1 (Use of Color).

#### TC-S145: Query understanding banner ARIA
- **User Story:** US-008
- **Priority:** Medium
- **Steps:**
  1. Inspect query understanding banner
- **Expected Result:** `role="status"`, `aria-live="polite"`. Color not sole indicator (icon + text + border used).

---

## 8. Performance Tests

#### TC-S146: Search endpoint response time — basic query
- **User Story:** US-007
- **Priority:** Medium
- **Preconditions:** 500 horoscopes in DB, LLM and Qdrant mocked/available
- **Steps:**
  1. Execute 10 basic search queries (single condition)
  2. Measure p95 response time
  3. Break down by stage (language detection, parsing, embedding, vector search, DB query, enrichment)
- **Expected Result:** p95 < 3s for basic query. LLM parsing stage < 1s. MongoDB query < 200ms. Total end-to-end acceptable.

#### TC-S147: Search endpoint response time — complex query
- **User Story:** US-008
- **Priority:** Medium
- **Steps:**
  1. Execute 10 complex multi-condition queries
  2. Measure p95 response time
- **Expected Result:** p95 < 5s for complex query. Additional time from LLM parsing and multi-condition filtering.

#### TC-S148: Chart rendering in result cards
- **User Story:** US-007
- **Priority:** Medium
- **Steps:**
  1. Load search with 5 results (15 charts)
  2. Measure time to render all charts (from page load to all charts visible)
- **Expected Result:** 3 charts per card render within 500ms after card enters viewport. 15 charts total: no jank, 60fps scroll.

#### TC-S149: Collapsed vs expanded memory usage
- **User Story:** US-020
- **Priority:** Low
- **Steps:**
  1. Load 20 results
  2. Measure heap memory with all expanded
  3. Collapse all
  4. Measure heap memory
- **Expected Result:** Collapsed state uses significantly less memory (no chart SVG DOM nodes, no section content rendered). No memory leak from repeated expand/collapse.

#### TC-S150: Concurrent search requests
- **User Story:** US-007, US-008
- **Priority:** Low
- **Preconditions:** k6 or Artillery configured
- **Steps:**
  1. Send 10 simultaneous search requests
  2. Measure p99 latency
- **Expected Result:** All 10 complete. No 5xx errors. p99 < 10s. No server crash or OOM.

#### TC-S151: Response payload size
- **User Story:** US-007
- **Priority:** Low
- **Steps:**
  1. Measure POST /api/search response size for 1, 5, 20 results
- **Expected Result:** Per result: < 15KB JSON. Per page (5 results): < 100KB. Per page (20 results): < 400KB. Chart data JSON is largest contributor.

#### TC-S152: Cold vs warm search latency
- **User Story:** US-007
- **Priority:** Low
- **Steps:**
  1. First search after server boot (cold start)
  2. Second search (warm)
- **Expected Result:** Cold start latency < 8s (includes loading ephemeris files, connecting to MongoDB/Qdrant). Warm latency < 3s.

---

## 9. Bilingual Tests

#### TC-S153: All UI strings in Sinhala
- **User Story:** US-014
- **Priority:** High
- **Preconditions:** Language set to Sinhala
- **Steps:**
  1. Navigate to search page
  2. Walk through all UI elements: input, placeholder, suggestions, config panel, results, pagination, history, bookmarks, export, errors
- **Expected Result:** Every UI string appears in Sinhala. No English fallback text visible. Astrological terms correctly translated.

#### TC-S154: All UI strings in English
- **User Story:** US-014
- **Priority:** High
- **Preconditions:** Language set to English
- **Steps:**
  1. Walk through all UI elements
- **Expected Result:** Every UI string appears in English.

#### TC-S155: Language switch doesn't reset search
- **User Story:** US-014
- **Priority:** Medium
- **Preconditions:** Search results displayed in Sinhala
- **Steps:**
  1. Switch language to English while results are shown
- **Expected Result:** Results remain visible. Input text unchanged. Language indicator updates. Results count, sort labels, card section headers all switch to English immediately.

#### TC-S156: Sinhala text accommodation
- **User Story:** US-014
- **Priority:** Medium
- **Preconditions:** Language set to Sinhala
- **Steps:**
  1. Observe all Sinhala text elements
- **Expected Result:** No text overflow or clipping. Sinhala text (15-30% wider than English) fits within containers. Config panel labels not truncated. Score badge accommodates "87% ගැළපීම". Pagination "පිටුව 1 න් 9" fits.

#### TC-S157: i18n key completeness
- **User Story:** US-014
- **Priority:** High
- **Steps:**
  1. Compare `en.json` and `si.json` for all search-related i18n keys
- **Expected Result:** Every search i18n key in `en.json` has a corresponding entry in `si.json`. No missing translations. No hardcoded English strings in search components.

#### TC-S158: Sinhala font rendering for astrological terms
- **User Story:** US-014
- **Priority:** Medium
- **Steps:**
  1. Inspect rendered Sinhala astrological terms (e.g., "මේෂ ලග්නය", "ශනි උච්ච")
- **Expected Result:** Terms render in "Noto Sans Sinhala" font. No tofu boxes (missing glyph rectangles). Bold weight used where specified. Characters legible at all sizes (12px–20px).

---

## 10. Mobile/Responsive Tests

#### TC-S159: Mobile layout — search page
- **User Story:** US-007
- **Priority:** High
- **Preconditions:** Viewport < 640px
- **Steps:**
  1. Navigate to `/search`
- **Expected Result:** Search input full width, sticky at top. Actions bar is horizontally scrollable row, icons only (no labels). History/Saved/Bookmarks panels open as slide-up bottom sheets (full width). Config panel opens as slide-up bottom sheet.

#### TC-S160: Mobile result cards
- **User Story:** US-007
- **Priority:** High
- **Preconditions:** < 640px viewport, results displayed
- **Steps:**
  1. Observe result cards
- **Expected Result:** Cards full width. Charts min-width 280px, horizontal scroll within card. Score badge compact (percentage only, no label text). Bookmark icon 44x44px touch target. Collapse/expand icon 44x44px touch target.

#### TC-S161: Mobile config panel
- **User Story:** US-009
- **Priority:** Medium
- **Preconditions:** < 640px viewport
- **Steps:**
  1. Click ⚙️ icon
- **Expected Result:** Config panel opens as slide-up bottom sheet (full width). Drag handle at top. Sheet covers ~70% of viewport height. Toggle items visible without scroll. Close by dragging down or tapping backdrop.

#### TC-S162: Mobile pagination
- **User Story:** US-015
- **Priority:** Medium
- **Preconditions:** < 640px viewport, multiple pages
- **Steps:**
  1. Observe pagination
- **Expected Result:** Only [← Prev] and [Next →] buttons shown. No page numbers. Page info text: "Page 1 of 9" / "පිටුව 1 න් 9".

#### TC-S163: Tablet layout (640–1024px)
- **User Story:** US-007
- **Priority:** Medium
- **Steps:**
  1. Resize viewport to 768px
  2. Observe layout
- **Expected Result:** Search input full width. Config panel slide-out (280px) or modal. Actions bar icons only (labels hidden). Pagination shows page numbers + prev/next.

#### TC-S164: Touch targets on mobile
- **User Story:** US-007
- **Priority:** High
- **Steps:**
  1. Audit all interactive elements on mobile viewport
- **Expected Result:** All touch targets ≥ 44x44px: search button, bookmark icon, expand/collapse icon, config gear, pagination buttons, action bar items.

---

## 11. Edge Cases

#### TC-S165: All own horoscopes are private
- **User Story:** US-007
- **Priority:** Medium
- **Preconditions:** User owns 5 horoscopes, all private. No public horoscopes in DB.
- **Steps:**
  1. Search by name/ascendant
- **Expected Result:** Only user's own 5 horoscopes returned. All visible because owner can see own horoscopes regardless of isPublic.

#### TC-S166: No public horoscopes in system
- **User Story:** US-007
- **Priority:** Low
- **Preconditions:** All horoscopes are private. User has no horoscopes.
- **Steps:**
  1. Search any query
- **Expected Result:** Zero results returned. Empty state message shown.

#### TC-S167: Horoscope deleted between search and click
- **User Story:** US-020
- **Priority:** Medium
- **Preconditions:** Horoscope exists, search returns it in results
- **Steps:**
  1. Note horoscope ID in search results
  2. Delete horoscope (separate session)
  3. Click result card or "Open Full Detail"
- **Expected Result:** Navigates to `/horoscope/:id`. Page shows "Horoscope not found" / "ලග්නය හමු නොවීය". No crash. Error message localized.

#### TC-S168: Rapid pagination
- **User Story:** US-015
- **Priority:** Low
- **Steps:**
  1. Rapidly click Next → Next → Next (3 clicks in 500ms)
- **Expected Result:** Only 1 API call fired (debounced). Final page loaded. No race condition on results state.

#### TC-S169: Rapid config toggling
- **User Story:** US-009
- **Priority:** Low
- **Steps:**
  1. Rapidly toggle 5 sections ON/OFF in 1 second
- **Expected Result:** Only 1 debounced save API call (500ms debounce). Final state saved correctly. No intermediate states persisted.

#### TC-S170: Corrupt saved config
- **User Story:** US-009
- **Priority:** Low
- **Preconditions:** SavedFilter has invalid filterConfig JSON
- **Steps:**
  1. Load search page
- **Expected Result:** System falls back to default config. Warning logged. User sees default sections. Config panel shows defaults. Correcting and saving overwrites corrupt value.

#### TC-S171: Embedding model migration
- **User Story:** US-007
- **Priority:** Low
- **Preconditions:** Old embeddings exist with `embeddingModel: "v1"`, new model "v2" deployed
- **Steps:**
  1. Run search
- **Expected Result:** Search uses newer model embeddings if available. Old and new coexist during migration. Re-indexing job eventually migrates all.

#### TC-S172: Qdrant payload filtering correctness
- **User Story:** US-007
- **Priority:** High
- **Preconditions:** Qdrant has points with isPublic:true and isPublic:false for same horoscope
- **Steps:**
  1. Search as non-owner user
- **Expected Result:** Only points with isPublic:true are returned in vector search results. Private horoscope points filtered out by Qdrant payload filter.

#### TC-S173: History dedup — same query different case
- **User Story:** US-017
- **Priority:** Low
- **Preconditions:** Recent search "Aries Ascendant" exists
- **Steps:**
  1. Search "aries ascendant" (lowercase) within 5 minutes
- **Expected Result:** Query match is case-insensitive for dedup. Timestamp updated, no new entry.

#### TC-S174: Export with displayName=false results
- **User Story:** US-019
- **Priority:** Medium
- **Preconditions:** Search results include a horoscope with displayName=false, owned by another user
- **Steps:**
  1. Export CSV
- **Expected Result:** CSV contains anonymous placeholder for that horoscope, not real name. Owner's own horoscopes show real name in export.

#### TC-S175: Career query disclaimer
- **User Story:** US-008
- **Priority:** Low
- **Steps:**
  1. Submit career/life-domain query
- **Expected Result:** Results include disclaimer banner: "These results are suggestions based on astrological principles and should not be considered as professional advice." / Localized Sinhala equivalent.

---

## Summary

| Category | Test Cases | Priority Breakdown |
|----------|-----------|-------------------|
| API — POST /api/search | TC-S001 to TC-S026 | High: 13, Medium: 10, Low: 3 |
| API — Filter Config | TC-S027 to TC-S033 | Medium: 5, Low: 2 |
| API — Search History | TC-S034 to TC-S039 | Medium: 3, Low: 3 |
| API — Bookmarks | TC-S040 to TC-S045 | Medium: 3, Low: 3 |
| API — Export | TC-S046 to TC-S050 | Medium: 4, Low: 1 |
| Privacy & Authorization | TC-S051 to TC-S059 | High: 5, Medium: 3, Low: 1 |
| RAG Pipeline | TC-S060 to TC-S073 | High: 4, Medium: 8, Low: 2 |
| UI/UX — Search & Input | TC-S074 to TC-S084 | High: 3, Medium: 6, Low: 2 |
| UI/UX — Results Display | TC-S085 to TC-S092 | High: 2, Medium: 4, Low: 2 |
| UI/UX — Collapse/Expand | TC-S093 to TC-S096 | Medium: 3, Low: 1 |
| UI/UX — Config Panel | TC-S097 to TC-S103 | High: 2, Medium: 4, Low: 1 |
| UI/UX — Score Badge | TC-S104 to TC-S105 | Medium: 1, Low: 1 |
| UI/UX — Query Banner | TC-S106 to TC-S109 | Medium: 3, Low: 1 |
| UI/UX — Bookmark | TC-S110 to TC-S113 | Medium: 3, Low: 1 |
| UI/UX — History | TC-S114 to TC-S117 | Medium: 2, Low: 2 |
| UI/UX — Saved Searches | TC-S118 to TC-S121 | Medium: 2, Low: 2 |
| UI/UX — Export | TC-S122 to TC-S123 | Medium: 2 |
| Pagination | TC-S124 to TC-S130 | Medium: 4, Low: 3 |
| Sort | TC-S131 to TC-S135 | Medium: 1, Low: 4 |
| Accessibility | TC-S136 to TC-S145 | High: 5, Medium: 5 |
| Performance | TC-S146 to TC-S152 | Medium: 4, Low: 3 |
| Bilingual | TC-S153 to TC-S158 | High: 4, Medium: 2 |
| Mobile/Responsive | TC-S159 to TC-S164 | High: 3, Medium: 2, Low: 1 |
| Edge Cases | TC-S165 to TC-S175 | High: 1, Medium: 6, Low: 8 |

**Total: 175 test cases** (TC-S001 through TC-S175)
