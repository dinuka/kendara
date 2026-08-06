# QA Strategy

## Testing Approach

### Levels of Testing

| Level | Scope | Tool/Framework | Responsibility |
|-------|-------|----------------|----------------|
| Unit | Individual functions, utils, API route handlers | Jest + Vitest | Developer |
| Integration | API endpoints, MongoDB operations, calculation engine | Jest + Supertest | Developer |
| E2E | Full user flows (browser-based) | Playwright | QA |
| Visual | Chart rendering, UI component snapshots | Storybook + Chromatic | QA |
| Accessibility | WCAG 2.1 compliance | axe-core + Lighthouse | QA |
| Performance | Load testing, RAG pipeline latency | k6 | QA |

### Test Environment Requirements

| Environment | Configuration | Purpose |
|-------------|---------------|---------|
| Local Dev | Next.js dev server, local MongoDB, local Qdrant, Gemini API key | Development testing |
| CI | GitHub Actions, MongoDB memory server, Qdrant in-memory, mocks for Gemini | Automated PR checks |
| Staging | Full stack with test data | Pre-release validation |
| Production | Live environment | Smoke tests + monitoring |

### Bug Reporting Template

```md
## Bug Report

**Title:** [Short description]

**Severity:** Critical / Major / Minor / Trivial
**Priority:** High / Medium / Low
**Environment:** Local / CI / Staging / Production

**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Result:** 
**Actual Result:** 

**Screenshots/Logs:** 
**Additional Context:** 
```

## Test Data Strategy

- Use mock horoscope data with known astrological values for calculation testing
- Pre-seeded public horoscopes for search testing
- Test users: student (default), super-admin
- Sinhala and English test queries for bilingual verification

## Location Management — Testing Considerations

### Geocoding API Testing (Nominatim)

| Consideration | Strategy |
|---------------|----------|
| External dependency | Mock Nominatim API responses in unit/integration tests; use Playwright route interception for E2E |
| Rate limiting | Test frontend handles 429 with "Search temporarily unavailable" message; test CSV/fallback input still works |
| Network failures | Verify error banner + retry button on list load failure; inline error + retry link in picker |
| Response shape | Mock Nominatim response with `display_name`, `lat`, `lon` fields; test parsing of edge values (Antarctic stations: lat=-90, lon=0) |
| Empty results | Test "No results found" state when Nominatim returns empty array |
| Debounce | Verify 300ms debounce before API call; test rapid typing doesn't flood requests |
| Timeout | Test frontend gracefully handles Nominatim timeout (no hanging spinner) |

### CSV Parsing Testing

| Consideration | Strategy |
|---------------|----------|
| Valid formats | `6.9271,79.8612`, `-33.8688,151.2093`, `90.0,180.0`, `-90.0,-180.0`, `0,0` |
| Invalid formats | Missing comma, non-numeric, single value, triple values, whitespace-only |
| Boundary values | lat=90, lat=-90, lon=180, lon=-180 (valid); lat=90.0001, lon=180.0001 (invalid) |
| Whitespace handling | Leading/trailing spaces; spaces after comma; tabs |
| Negative coordinates | Both negative, one negative, integer negative values |
| Client-side only | Server does NOT accept CSV format — only parsed lat/lon; test server rejects raw CSV fields |
| Preview panel | Verify parsed values display correctly before save; multi-parse with different values |

### Pagination Testing

| Consideration | Strategy |
|---------------|----------|
| Default page size | Verify default limit=20; test max limit is enforced at 100 |
| Page boundaries | Page 1 with 0 results (empty), page beyond total (empty array, not error) |
| Sort order | Results sorted by name ascending; verify across paginated pages |
| Search + pagination | Search filters applied correctly across pages; verify total count updates with search |
| Concurrent data changes | Page count changes if items added/deleted between page loads (graceful handling) |

### Privacy & Authorization Testing

| Consideration | Strategy |
|---------------|----------|
| Location visibility | Verify public locations visible to all; private visible only to creator |
| Super Admin visibility | Admin sees all locations (public + private) |
| Ownership enforcement | Non-owner gets 403 on PUT/DELETE; admin can delete public but not private |
| Toggle privacy | Change from public→private and verify visibility change for other users |
| Edge: empty createdBy | Graceful handling of orphaned locations (if user deleted) |

### Client-Side vs Server-Side Validation

| Consideration | Strategy |
|---------------|----------|
| Dual validation | Client validates before submission; server validates as backup |
| Bypass attempt | Submit malformed data via curl/Postman; verify server rejects with 400 |
| XSS in name | Test name with `<script>` tags is stored safely (Mongoose strips or encodes) |
| Long name | Test name > 200 chars is rejected or truncated |

### Data Migration Testing

| Consideration | Strategy |
|---------------|----------|
| Legacy horoscopes | Verify horoscopes with `location: string` migrate correctly: locationName ← location, location ← null |
| Rollback | Migration script is idempotent; re-running doesn't corrupt data |
| No auto-creation | Migration does NOT create Location documents from existing horoscope names |
| Old API backward compat | Verify POST/PUT horoscope still accepts `location` as string (treated as legacy)

## Current Planetary Positions — Testing Considerations

### Real-Time Ephemeris Calculation Testing

| Consideration | Strategy |
|---------------|----------|
| Time-dependent output | Freeze `Date.now()` in unit/integration tests via Jest mock (`jest.useFakeTimers()` + `jest.setSystemTime()`). Compare computed planet positions against known Swiss Ephemeris values for a fixed UTC timestamp (e.g., 2026-07-20T12:00:00Z). Store expected position snapshots as JSON fixtures. |
| Ayanamsha variation | Test with each supported ayanamsha (`lahiri`, `raman`, `krishnamurti`, `yukteshwar`) using the same fixed timestamp. Verify corrected longitudes differ across ayanamshas but each is internally consistent. |
| Combustion orbs | Unit-test `isCombust()` with planets at boundary distances (e.g., Moon at 11.9° vs 12.1° from Sun). Verify each planet orb table is correctly applied. |
| Retrograde detection | Unit-test with known retrograde periods (historical data). Verify Rahu/Ketu are always retrograde. Verify speed-negative → retrograde, speed-positive → direct. |
| House mapping edge cases | Test planets at exact cusp boundaries (0° of next sign), at 359.999° longitude wrapping. Verify `house` is never null for valid longitudes. |

### API Testing Strategy

| Consideration | Strategy |
|---------------|----------|
| `includeCurrentPlanets` param | Test GET `/api/horoscope/:id/chart/house` with and without the param. Without: verify `currentPlanets` field is absent. With `true`: verify array of 9 objects with required fields. |
| Non-house chart types | Test param on birth, navamsa, drekkana endpoints. Verify param is silently ignored — response shape unchanged, no `currentPlanets` field. |
| Standalone endpoint | Test GET `/api/horoscope/:id/current-planets`. Verify returns `{ currentPlanets: [...], computedAt: "..." }`. Verify `computedAt` is ISO timestamp. |
| Auth | Test without session (401), with wrong-owner private horoscope (403), non-existent id (404). Verify error responses match spec. |
| Ephemeris failure | Mock ephemeris library to throw. Verify API returns 422 with `{ error: "Calculation failed", detail: "..." }`. |
| Rate limiting | Test 30 req/min/user limit. Verify 429 with `Retry-After` header. |

### Client-Side Rendering Testing

| Consideration | Strategy |
|---------------|----------|
| Toggle default state | Verify toggle is OFF on initial render. Birth chart renders normally. No currentPlanets data loaded. Legend shows only birth planets. |
| Toggle ON flow | Click toggle → verify loading spinner appears → API call fires with `includeCurrentPlanets=true` → data arrives → overlay renders → legend updates. Verify no redundant API calls on re-toggle (cached data). |
| Toggle OFF | Click toggle OFF → overlay hidden instantly → data retained in memory → re-toggle ON uses cached data without API call. |
| Merged position rendering | Mock two scenarios: (a) current Sun within 2° of birth Sun in same house → verify split symbol (glyph left + Sinhala letter right + sky-blue border). (b) degree difference ≥ 2° → verify separate symbols. |
| Sinhala letter rendering | Verify each planet's Sinhala first-letter symbol renders correctly. Verify font-family: "Noto Sans Sinhala", bold weight. Verify duplicate letters (රවි/රාහු → ර, සඳු/සිකුරු → ස) appear in correct positions. |
| Legend update | Verify "Birth Planets" and "Current Planets (transit)" sections appear when overlay is ON, hide when OFF. Verify current planet legend items show Sinhala letter + sky-blue border. |
| Tooltip | Hover on current planet → verify content includes: planet name + "(Current)" suffix, sign+degree, house, nakshatra+pada, strength, status. Hover on birth planet → verify "(Birth)" suffix. |
| Loading state | Verify spinner appears during API call, toggle disabled (pointer-events: none), birth planets remain visible. Verify no flicker on fast responses (<100ms). |
| Error state | API failure → verify banner shown with localized error message + "Retry" button. Toggle reverts to OFF. Verify retry re-fetches. Verify auto-dismiss after 10s. |

### Visual Regression Testing

| Consideration | Strategy |
|---------------|----------|
| Chart screenshots | Use Storybook + Chromatic to capture House chart in all states: toggle OFF, toggle ON (birth + current), merged position, loading, error. Compare against baseline on every PR. |
| Cross-browser | Verify overlay rendering in Chrome, Firefox, Safari, Edge. Pay attention to SVG text rendering for Sinhala letters (Noto Sans Sinhala font loading). |
| Responsive | Capture screenshots at desktop (1200px), tablet (768px), mobile (375px). Verify toggle placement, legend layout, tooltip positioning. |
| Dark mode | Verify sky-blue border color `#38BDF8` (dark) vs `#0EA5E9` (light). Verify planet fill colors remain readable. |

### Bilingual Testing

| Consideration | Strategy |
|---------------|----------|
| Toggle label | Verify "Show Current Planets" in English, "වත්මන් ග්‍රහ පිහිටීම් පෙන්වන්න" in Sinhala. Verify no text overflow — Sinhala text can be 30% wider. |
| Legend labels | Verify "Birth Planets" / "උපත් ග්‍රහයින්" and "Current Planets (transit)" / "වත්මන් ග්‍රහයින් (ගමන්)" render correctly in both languages. |
| Tooltip content | Verify all fields (house, nakshatra, strength, retrograde, combust, direct) are localized. Verify "(Current)" / "(වත්මන්)" and "(Birth)" / "(උපත්)" suffixes. |
| Loading/error messages | Verify all announcements in both languages. Verify Sinhala error message fits in 320px tooltip. |

### Performance Testing

| Consideration | Strategy |
|---------------|----------|
| Ephemeris latency | Measure `computeCurrentPlanets()` execution time for 9 planets. Target: <500ms p95. Use `performance.now()` or Jest timing. Test with cold start (first call after server boot) vs warm. |
| Chart API without param | Measure baseline endpoint latency. Target: <100ms p95. |
| Chart API with param | Measure combined latency (DB + ephemeris). Target: <600ms p95. |
| Concurrent requests | Send 10 simultaneous requests with `includeCurrentPlanets=true`. Measure p99 latency. Verify no request timeout or 5xx errors. |
| Payload size | Verify `currentPlanets` array is ~500–600 bytes. Use compression middleware. |

### Accessibility Testing

| Consideration | Strategy |
|---------------|----------|
| Toggle role | Verify `role="switch"` with dynamic `aria-checked`. Verify keyboard activation via Enter/Space. |
| Screen reader | Test with NVDA/JAWS: verify "Current planetary positions enabled" announcement on toggle ON, planet descriptions when focused. Verify `aria-live="polite"` regions for loading/error states. |
| Keyboard navigation | Verify Tab order: toggle → chart planets → legend. Verify Enter/Space on planet → tooltip opens, Escape → closes. Verify toggle remains focusable during loading. |
| Visual differentiation | Verify 3 independent channels differentiate birth vs current: (1) symbol type — glyph vs Sinhala letter, (2) border — none vs sky-blue 2px, (3) opacity — 100% vs 85%. This satisfies WCAG 2.1 Success Criterion 1.4.1 (Use of Color) since information is not conveyed by color alone. |
| Color contrast | Verify sky-blue border (`#0EA5E9` light / `#38BDF8` dark) against chart background meets WCAG AA (3:1 for non-text). Verify planet fill colors maintain contrast over all backgrounds. |
| Sinhala font rendering | Verify Noto Sans Sinhala loads correctly. Verify Sinhala letters are not replaced with fallback fonts that change meaning. |

## Calculated Horoscope (Manual Entry) — Testing Considerations

> Full test plan: `specs/qa/20260805-1514-calculated-horoscope-test-plan.md`

### Pure Derivation Testing (`src/lib/manualChart.ts`)

| Consideration | Strategy |
|---------------|----------|
| No I/O, no ephemeris | All derivation functions are pure — test directly with numeric enum inputs; no mocking needed |
| House sign derivation | Whole-sign mod-12: test Lagna 1, 7, 12 (wrap), reject 0/13/NaN |
| Validation rules | Budha ±1, Sikuru ±2, Rahu/Ketu opposite (gap 6) — test same-house, in-range, out-of-range, house-wrap (Ravi 12→1), missing planets (skipped/incomplete), multiple simultaneous violations |
| Special aspects | Mars 4/8/12, Jupiter 5/9/11, Saturn 3/7/10, Rahu/Ketu 5/9, others 7th-house; verify mod-12 wrap |
| Navamsa enrichment | Degree range from navamsa index (1st → 00:00–03:20), 12th navamsa mod-30 wrap, nakshatra/pada from midpoint, boundary at exactly 13°20' |
| Config tables | Birth-time (12 rows contiguous 2h windows), birth-month (12 rows, +1 month, 15th anchor, Meena wrap), birth-date formula (12+n×3, 17+n×7), age formula (clamp negatives) |
| Determinism | Same input → identical output every run (snapshot-style assertions for table lookups) |

### API Testing

| Consideration | Strategy |
|---------------|----------|
| `POST /api/horoscope/manual` | Create with name+lagna+houses; minimal body (no navamsa); with navamsaHouses; assert `source: "manual"` persisted and derivedRanges returned |
| Validation failures | Missing name/lagna, invalid enums (0/13), invalid house key, duplicate planet → 400 |
| Auth | No session → 401; owner-only PUT → 403 for non-owner; 404 not found |
| `PUT /api/horoscope/[id]/manual-chart` | Update on auto horoscope → 409; recompute validation + derivedRanges on update |
| Legacy regression | Existing `POST /api/horoscope` (auto) behavior unchanged |

### Component / E2E Testing

| Consideration | Strategy |
|---------------|----------|
| Mode toggle | Defaults Birth Details; switching renders manual form; state preserved across switch |
| Live derivation | Lagna change re-derives house signs; planet add/remove updates chips + derived tables instantly (client uses same shared module) |
| Picker | Only unplaced planets listed; all 9 placed → Add disabled; duplicate prevention |
| Validation badges | Live valid/invalid/skipped/incomplete states; tooltips; save allowed with violations (advisory) |
| Navamsa table | Collapsed by default; planets enrich planets table columns 8–11 |
| Derived ranges | Render time/month/date/age; hints when Ravi/Shani missing |
| Detail page | Calculated Chart badge; Edit Chart prefilled; dual birth+navamsa charts; dasha "not available" empty state |
| Bilingual | Full SI/EN parity across all new strings; en.json ↔ si.json in sync; Sinhala 30% width allowance |
| Accessibility | tablist/tab roles, menu role, aria-live validation, table headers, keyboard flow, color+text not color alone |

### Data Integrity

| Consideration | Strategy |
|---------------|----------|
| Single source of truth | House placements are the source; planets table/derivedRanges always recomputed (verify on update) |
| Schema safety | Legacy horoscopes default `source: "auto"`; manual fields absent on auto horoscopes |
| Concurrency | Two-tab edit → last write wins, no corruption |

## Horoscope Privacy — Testing Considerations

### API Testing

| Consideration | Strategy |
|---------------|----------|
| PATCH /privacy — valid updates | Test with both fields, partial updates, empty body. Verify 200, audit log written. |
| PATCH /privacy — auth errors | Test without session (401), non-owner (403), Super Admin (403). |
| GET /search — privacy filtering | Test own private visible, other's private hidden, public visible. |
| GET /horoscope/:id — privacy | Test owner sees all, non-owner sees public only (404 for private), Super Admin sees all. |
| GET /share/:token — bypass | Test share link works for private horoscope, shows actual name. |
| Audit logging | Verify all 7 action types created correctly. Test async fire-and-forget for admin reads. |

### Component Testing

| Consideration | Strategy |
|---------------|----------|
| PrivacyToggle states | Verify all 6 states (private, public+show, public+hide, loading, error, read-only) render correctly. |
| PrivacyBadge variants | Verify 3 badge variants (Private, Public, Name Hidden) with correct icons, colors, labels. |
| Conditional displayName | Verify displayName toggle slides in/out when isPublic toggles. Verify value preserved across states. |
| Save feedback | Verify toast messages for each transition. Verify error state with retry. |
| Anonymous placeholder | Verify placeholder generated from last 4 UUID chars. Verify deterministic per horoscope. |

### Edge Cases

| Consideration | Strategy |
|---------------|----------|
| displayName=false while isPublic=false | Verify setting saved but has no visible effect. Verify preserved when public enabled. |
| Public→Private → Share link | Verify share link still works. Verify search immediately hides horoscope. |
| Concurrent privacy edits | Two tabs editing same horoscope. Last write wins. No data corruption. |
| Horoscope deletion with privacy | Verify cascade delete removes all related data. Verify audit log entry created. |
| UUID probing | Verify 404 returned for private horoscope (not 403). Verify 404 for non-existent UUID. |
| Rapid toggling | Verify each toggle creates audit entry. Verify debounce prevents API flood. 30 req/min rate limit enforced. |

## Search Horoscope (RAG-Based) — Testing Considerations

### RAG/LLM-Based Search Testing

| Consideration | Strategy |
|---------------|----------|
| LLM query parsing accuracy | Build a test corpus of 20+ query→expected-conditions mappings covering all query types (ascendant, planet-in-house, yoga, career, compound). Run each query through the parser and compare parsed conditions against expected. Accept parsing when conditions match ≥ 90% of expected fields. Store corpus as JSON fixture in `src/__tests__/fixtures/search-queries.json`. |
| LLM parsing fallback | Mock Gemini API to throw/timeout/return low-confidence. Verify keyword parser is invoked. Verify endpoint still returns results. Verify `queryUnderstanding.mode` reflects fallback. |
| LLM rate limit | Mock Gemini 429 response. Verify automatic fallback to keyword parser. Verify no crash. Verify incident logged. |
| LLM wrong output schema | Mock Gemini to return malformed JSON / missing fields. Verify parser handles gracefully, falls back to keyword parsing, logs error. |
| Embedding generation | Mock Transformers.js pipeline. Verify embedding service generates 384-dim vector. Verify text content includes both SI/EN versions. Verify chunking when content > 512 tokens. |
| Embedding storage failure | Mock Qdrant upsert to fail. Verify error logged. Verify horoscope still indexed in MongoDB for keyword search. |
| Vector search accuracy | Seed Qdrant with known embedding vectors for 10 horoscopes. Query with known embedding. Verify top-K results include expected horoscopes. Verify cosine similarity scores are correct. |
| Hybrid ranking | Verify hybrid score formula: `0.7 * vectorSimilarity + 0.3 * structuredMatchScore`. Verify results sorted by hybrid score descending. Verify min score threshold (0.3 basic, 0.4 complex) applied. |
| Relevance threshold filtering | Verify results below threshold are excluded entirely. Verify threshold is configurable. Verify changing threshold re-filters results. |
| Query language detection | Test with pure Sinhala (U+0D80–U+0DFF), pure English, mixed (e.g., "ගුරු in 3rd house"), empty/whitespace-only. Verify detection matches majority character set. |
| Background embedding lifecycle | Test embed queue on horoscope create, recalculate, privacy toggle. Verify async job completes. Verify DB state after job. Verify searchability before and after. |

### Bilingual (SI/EN) Search Testing

| Consideration | Strategy |
|---------------|----------|
| Query parity | For each query type, create equivalent SI and EN queries. Run both through the full pipeline. Verify result sets are equivalent (same horoscope IDs, similar scores). |
| Mixed-language queries | "ගුරු in 3rd house", "Saturn උච්ච". Verify language detection picks majority. Verify query is parsed correctly regardless of detected language. |
| Sinhala-specific terms | Test all 12 zodiac signs, 9 planets, 27 nakshatras, strength types in Sinhala. Verify maps (ZODIAC_SIGN_NAMES, PLANET_NAMES) resolve correctly. |
| English astrological terms | Test all equivalent English terms. Verify same numeric enum values resolved as Sinhala counterparts. |
| Language indicator in UI | Verify language detection badge updates in real-time as user types. Verify badge shows correct flag and language name. |
| Sinhala font rendering | Verify Noto Sans Sinhala loads for all search UI components. Verify no tofu boxes for Sinhala astrological terms. Verify 30% extra width accommodation. |
| i18n key coverage | Walk all UI strings in search feature. Verify both `en.json` and `si.json` have corresponding entries. Verify no hardcoded English strings in JSX. |

### Graceful Degradation Testing

| Consideration | Strategy |
|---------------|----------|
| Full chain: Gemini → Keyword → MongoDB-only | Test all six degradation combinations independently: (1) Gemini fails → keyword works, (2) Gemini fails + no keyword match → date-sorted results, (3) Transformers.js fails → skip vector search, (4) Qdrant unreachable → MongoDB-only, (5) Gemini + Qdrant both down → keyword + MongoDB, (6) everything fails → graceful error response. |
| Partial chain recovery | Mock intermittent failures. Verify system recovers when service comes back. Verify no cascading failures. |
| Degradation logging | Each fallback event must be logged with: component failed, reason, timestamp. Verify no PII in logs. Verify log level (warn for fallback, error for total failure). |
| Degradation UX indicators | Verify queryUnderstanding banner reflects parsing mode (complex vs basic). Verify no technical error messages shown to user. Verify "Search failed" banner only when all paths fail. |
| Embedding job failure | Mock Transformers.js to hang/timeout. Verify queue retry logic (3 retries with backoff). Verify horoscope remains in keyword search index. Verify admin notification of persistent failure. |

### Performance Testing for Full-Detail Result Cards with Charts

| Consideration | Strategy |
|---------------|----------|
| Search response payload size | Measure POST /api/search response size for 1, 5, 20 results per page. Target: <15KB per result, <100KB per page at default 5. Verify chart data (SVG JSON) is the largest contributor. |
| Search endpoint latency | Time POST /api/search p95: basic query <3s, complex query <5s with all pipeline stages (LLM + embedding + Qdrant + MongoDB + enrichment). Measure each stage independently. |
| Chart SVG rendering per card | Measure time to render 3 charts (birth, navamsa, house) per result card. Target: <500ms for 3 charts on desktop. Test with 5 cards visible (15 charts total). Verify lazy rendering via IntersectionObserver doesn't cause jank. |
| IntersectionObserver lazy loading | Verify charts only render when card is within 200px of viewport. Verify scrolling down triggers chart rendering with no visible delay. Verify scrolling up reuses rendered charts (no re-render). |
| Horizontal scroll performance | Verify CSS `overflow-x: auto` per card doesn't cause layout thrashing. Verify 3+ charts per card scroll at 60fps. Test with 10 results (30 charts visible). |
| Collapse/expand animation | Verify 300ms expand / 200ms collapse animation doesn't drop frames. Verify max-height transition doesn't cause layout shift. |
| Concurrent search requests | 10 simultaneous POST /api/search requests. Measure p99 latency. Target: no timeout, no 5xx, p99 <10s. |
| Memory usage with large result sets | Load 50 results across 10 pages. Measure browser memory. Target: <50MB additional heap. Verify collapsed cards use significantly less memory than expanded. |

### Privacy/Security Testing for Search

| Consideration | Strategy |
|---------------|----------|
| Privacy filtering at query level | Verify MongoDB `$or: [{ "owner.id": userId }, { isPublic: true }]` is always applied. Verify private horoscopes never loaded into app memory for non-owners. Bypass frontend and send raw API requests with modified userIds. |
| Anonymous name enforcement | Verify `displayName=false` horoscopes show anonymous placeholder for non-owners. Verify owner and Super Admin always see real name. Verify placeholder is deterministic per horoscope ID. |
| Qdrant payload filtering | Verify Qdrant search includes `isPublic: true OR ownerId: userId` filter. Verify private horoscope points are not returned for non-owners. |
| Embedding lifecycle on privacy toggle | Verify public→private: synchronous `isActive=false` set. Verify private→public: embedding generation queued. Verify race condition: search while embedding job is in progress. |
| Search history isolation | Verify user A cannot access user B's search history. Verify API returns 403 or empty for cross-user access. Verify history not exposed in any other API response. |
| Bookmark isolation | Verify bookmarks are user-scoped. Verify bookmarking does not grant additional access. Verify deleted horoscope shows placeholder, not data leak. |
| Export data limits | Verify export limited to current page (max 20 results). Verify rate limit 10 req/min/user. Verify export respects anonymous names. |
| Rate limiting (all endpoints) | Verify 429 with `Retry-After` header for each endpoint at its limit. Verify rate limit resets after window. Verify rate limit per-user, not per-IP or global. |
| IDOR / UUID guessing | Verify non-owner accessing private horoscope returns 404 (not 403). Verify non-existent UUID returns 404. Verify no timing side-channel on UUID existence. |
| XSS in query input | Test `<script>`, `onerror=`, `javascript:` payloads in search query. Verify stored safely in search history. Verify no XSS in any rendered output (result cards, history list, etc.). |
| LLM prompt injection | Test query containing "Ignore previous instructions" / "System prompt: ...". Verify no prompt leakage. Verify query is parsed as astrological search, not executed as instructions. |
