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

## Planet Aspects (ග්‍රහ දෘෂ්ඨි) & Rashi Aspects (රාශි දෘෂ්ඨි) — Testing Considerations

> Full test plan: `specs/qa/20260810-1245-planet-rashi-aspects-test-plan.md`

Two related features are in scope: the per-user **Planet Aspects houses and degrees** setting (`User.planetAspects` — configured per-planet aspect houses and degree angles that drive house/planet aspect calculation with `planetaryOrbs` as the orb tolerance) and the per-user **Rashi Aspects** setting (`User.rashiAspects` — an on/off switch for the fixed Chara/Thira/Ubaya sign-to-sign drishti rules, composed as an additional union source of house/planet aspects). The calculation output must carry enough per-reason source data for the tooltip to render one line per reason (planetary + rashi) with the signed delta exactly once.

### Settings Payload Validation

| Consideration | Strategy |
|---------------|----------|
| Houses must be integers 1–12 | Unit-test the pure `validatePlanetAspectsPayload` (new `src/lib/planetAspects.ts`): 0/13/3.5 rejected; 1 and 12 accepted (closed range boundaries); non-number rejected |
| Degrees must be multiples of 30 in 30–330 | 0/15/45/360 rejected; 30 and 330 accepted (boundaries); the full set 30,60,90,120,150,180,210,240,270,300,330 accepted — incl. extended non-classical angles 210/240/270/300/330 |
| Uniqueness | Duplicate houses or duplicate degrees within a planet rejected |
| Non-empty | Empty `houses` and empty `degrees` arrays rejected — a planet cannot be emptied to nothing (≥1 house + ≥1 degree required) |
| Key domain | Only keys `"1"`–`"9"` (numeric Planet enum strings) accepted; `"0"`/`"10"`/non-planet keys rejected |
| All-or-nothing | A single invalid entry rejects the WHOLE payload — nothing partially saved (server returns 400; stored setting unchanged) |
| Normalization | Out-of-order arrays normalized to ascending on storage |

### Pure-Function Calculation Tests (`src/lib/planetAspects.ts`, `src/lib/manualChart.ts`)

| Consideration | Strategy |
|---------------|----------|
| Defaults resolution | New authoritative 9-planet table — SUN/MOON/SATURN 3,5,7,9,10; MARS/MERCURY 4,5,7,8,9; JUPITER/VENUS/RAHU/KETU 5,7,9 — every planet 1–9 resolves a default, so the legacy `?? [7]` "others" fallback is unreachable; default degrees `[60,90,120,180]` for all planets |
| Offsets-from-house semantics | Default aspect houses resolve relative to the planet's whole-sign house `((house−1+offset−1)%12)+1` (auto + manual); configured `houses` apply as **absolute** house numbers |
| Planet-to-planet matching | Only the planet's configured `degrees` (+ conjunction 0) are candidates; orb = `planetaryOrbs[aspectingPlanet]` with inclusive `degreeGap <= orb`; orb=0 still records an exact match; equal-distance tie-break prefers the smaller angle; extended angles (210/240/270/300/330) recorded with correct `aspectType`/`exactAspectDegree` |
| Degree-based house aspects (auto) | Aspect points `abs ± d` in BOTH directions with mod-360 wrap (planet 350° + 60° → 50°); house matched via absolute middle `(middleSign−1)*30 + middleDegree` within the planet's orb of any aspect point; orb boundary at the house middle inclusive (`≤`), rejected just beyond; result = union of the explicit `houses` arm and the degree arm, deduplicated + sorted; legacy house without a usable `middleDegree` skips the degree arm (explicit arm still applies) |
| Manual degree arm + fallback (both sources — 2026-08-11) | Manual charts run the SAME two arms (explicit `houses` ∪ degree arm) plus rashi when enabled, feeding the shared pure functions with each planet's absolute degree = entered `ManualHousePlacements.planetDegrees` (0 ≤ d < 30, keys `"1"`–`"9"`) else the deterministic fallback (navamsa segment midpoint when the navamsa sign is recorded, else sign midpoint 15°); the manual house-middle reference is the whole-sign sign midpoint `(sign−1)*30+15` (open: bhava cusps when a `lagnaDegree` is recorded — flagged); entered degrees always take precedence |
| Rashi rule encoding | Chara→Thira, Thira→Chara, Ubaya→Ubaya with nearest-rashi exclusion; full 12-row lookup matches the authoritative table (Aries excl Taurus; Taurus excl Aries; Gemini excl Pisces); zodiac wrap 12↔1; self-exclusion; aspected set never empty; deterministic pure derivation |
| Rashi composition | Rashi drishti unions with the Planet-Aspects-setting reasons; degree + orb (`planetaryOrbs` as "rashmi") always govern effectiveness for both house and planet rashi aspects; houses/planets in non-aspected signs get no rashi reason; manual charts use whole-sign signs for the candidate set and stored/fallback degrees for the degree+orb check |
| Setting disabled | `rashiAspects.enabled=false` (the default) leaves output identical to Planet-Aspects-only — backward compatible |

### Settings API Round-Trips (`GET`/`PUT /api/settings`)

| Consideration | Strategy |
|---------------|----------|
| GET shape | Returns `{ planetaryOrbs, planetAspects, rashiAspects }`; unconfigured `planetAspects` returned as `{}` (planets absent ⇒ defaults) |
| PUT valid | `{ planetAspects: {...} }` and/or `{ planetaryOrbs }` and/or `{ rashiAspects: { enabled } }` persisted atomically; echoed back in the response |
| PUT rejections | 400 for invalid houses/degrees/keys/duplicates/empty arrays; no partial save — a `GET` after a 400 reflects the pre-existing state |
| Reset | Omit a planet's key to reset that planet; `planetAspects: {}` bulk-resets to defaults (US-PA-007); `rashiAspects` reset → `{ enabled: false, overrides: {} }` (US-RA-007) |
| Auth | Unauthenticated GET/PUT → 401 |

### Owner View Re-Derivation (no migration)

| Consideration | Strategy |
|---------------|----------|
| Setting change reflects on owner view | Owner (BOTH `source:"auto"` and `source:"manual"`) → `GET /api/horoscope/[id]` re-derives `planets[].aspects` and `houses[].aspectingPlanets` (auto, from stored absolute degrees/middles) or the per-house `aspects`/`planets[].aspects` (manual, from stored `planetDegrees` or fallback-derived degrees + whole-sign sign midpoints) with the CURRENT `planetAspects` + `planetaryOrbs` (+ `rashiAspects` when enabled) — pure, not persisted |
| Non-owner snapshot | Non-owner/share/search/export always receive the stored `CalculatedDetails` snapshot computed from the owner's setting at calculation time — unchanged artifacts |
| No migration | Saving the setting never rewrites stored `CalculatedDetails`; legacy auto charts lacking `aspectingPlanets` render empty and re-derive for the owner only; legacy manual charts (no `planetDegrees`) re-derive via fallback degrees for the owner only; shared/non-owner views always show the stored snapshot |
| Recalc path | `POST /api/horoscope` / `PUT /api/horoscope/[id]` / `PUT /api/horoscope/[id]/manual-chart` apply the latest setting and persist fresh aspects; the manual-chart path also accepts/validates `planetDegrees` |

### Tooltip Multi-Line Rendering (§8.1.1)

| Consideration | Strategy |
|---------------|----------|
| Single planetary reason | `{label} {house} ({angle}) ({delta})` — SI `ග්‍රහ දෘෂ්ඨි 7 (180) (+02:05:00)` / EN `Planet drishti 7 (180) (+02:05:00)`; `{house}` omitted for conjunction/legacy (`{label} (0) ({delta})`) |
| Single rashi reason | `{rashiLabel} {aspectingSign} → {aspectedSign} ({delta})` — SI `රාශි දෘෂ්ඨි මේෂ → මිථුන (+02:05:00)` / EN `Rashi drishti Aries → Gemini (+02:05:00)` (no matched angle on rashi lines) |
| Multi-reason | ≥2 reasons render one line per reason WITHOUT deltas plus a single hairline-separated `Δ {delta}` footer — the signed delta appears EXACTLY once (never per line); test both `planetary + 1 rashi` and `planetary + 2 rashi` cases |
| Ordering | Planetary reason line(s) render before rashi reason line(s) |
| Table chips | Aspects chips render the aspecting planet's NAME ONLY — no angle/delta text outside the tooltip |
| Accessibility | `aria-describedby` on the chip → `role="tooltip"`; `title` fallback carries the SAME full text (delta exactly once); footer and reason lines are real text nodes (screen reader announces the delta once); `→` announced via sr-only localized verb `astrology.drishti.rashiVerbAria` (EN `aspects` / SI `දකී`) |

### Golden-Data Regeneration (New Defaults + Orb Semantics)

| Consideration | Strategy |
|---------------|----------|
| Orb semantic change | Replacing the fixed `gap < 30` cutoff with per-planet `planetaryOrbs` as the aspect orb alters existing default-path aspect outputs (Rahu/Ketu at orb 0 become strict exact-matches; other planets' default orbs 7–15 are tighter than 30) |
| New default table | The new 9-planet default aspect-houses table replaces the old MARS 4/8/12/JUPITER 5/9/11/SATURN 3/7/10/RAHU 5,9/KETU 5,9/others 7 table → house-aspect golden outputs change |
| New house-aspect output | Auto charts previously computed NO house aspects; now `houses[].aspectingPlanets` is populated degree-based for every auto chart — surfacing new data on existing owned auto charts is a visible behavior change (Architect §11/§13) |
| Manual-chart aspect output | Manual per-house `aspects` are now the union (explicit ∪ degree, plus rashi) — not list-only; fixture per degree source: entered `planetDegrees`, fallback navamsa midpoint, fallback sign midpoint 15°, rashi-on; assert cross-source parity with the auto golden for matching degrees |
| Regeneration recipe | Re-freeze golden fixtures that assert `planets[].aspects`/`houses[].aspectingPlanets` (calculation.test.ts, birthChart.test.ts, search textContent if it includes aspects) for a fixed birth chart against the NEW engine; store era-versioned fixtures (e.g. `fixtures/aspects-default-2026-08.json`); add a golden assertion that fails loudly if defaults change again; add separate goldens for rashi enabled/disabled |
| Extended angles | New values 210/240/270/300/330 may appear in `aspectType`/`exactAspectDegree`; require display labels in both locales (§2.2 UX table) and confirm the 210° "7 signs" vs "6 signs" discrepancy with BA/PM |
| Rashi golden dependence | Final golden expectations for rashi output depend on open decisions (Ubaya tie-break for Virgo/Sagittarius/Pisces, per-reason vs shared `degreeGap`, mobile reason marker shape) — regenerate goldens AFTER those are resolved (see test plan "What cannot be tested") |

## Shad Bala (ෂඩ් බලය) — Testing Considerations

> Full test plan: `specs/qa/20260813-2052-shadbalaya-test-plan.md`

The Shad Bala feature (US-SB-001…014) adds a 8-column × 9-row ෂඩ් බලය table to the calculations tab: six per-planet bala checkboxes (Sthana, Cheshta, Kala, Dig, Drishti, Naisargika) with reason tooltips, an `(n/6)` ratio column, optimistic toggles with 500 ms debounced auto-save via `PATCH /api/horoscope/[id]/shadbalaya`, and `overridden: true` semantics that survive the AstrologySettings full recalculation. New pure module `src/lib/shadBalaya.ts` (`computeShadBalaya(planets, houses, ctx)` + `mergeShadBalaya(computed, stored)`), new `CalculatedDetails.shadbalaya` Map field, new `ShadBalaTable.tsx` client component.

### Scope of Shad Bala testing

| Level | Scope | Key files |
|-------|-------|-----------|
| Unit (Jest, pure) | Per-bala rules for both `source: "auto"` and `source: "manual"`; enemy-sign helper; paksha boundary; merge semantics | `src/lib/shadBalaya.ts` (new), `src/__tests__/shadBalaya.test.ts` (new) |
| Integration / API | `PATCH /api/horoscope/[id]/shadbalaya` auth (401/403/404/400), sparse-write on legacy docs, super-admin path; recalculation merge | `src/app/api/horoscope/[id]/shadbalaya/route.ts` (new), `src/lib/recalculationJob.ts` |
| Component / UI | Table render (8 cols × 9 rows, desktop table + mobile cards), optimistic toggle → debounce → PATCH → revert+toast on failure, override dot, tooltip states, read-only mode, legacy no-flicker render | `src/components/ShadBalaTable.tsx` (new), `src/app/horoscopes/[id]/page.tsx` |
| E2E | Manual test scripts (no Playwright installed — flagged as Developer/PM decision) | — |
| Bilingual | `astrology.shadbalaya.*` key parity SI/EN, reason params resolution, no hardcoded strings | `src/messages/en.json`, `src/messages/si.json` |

### Key risk areas (prioritised)

1. **Sthana enemy-sign detection** — `computePlanetStrength` collapses a debilitated planet to `NEECHA` before the enemy check, so `p.strength` can never report `SHATRU` for it. The Sthana rule needs a **separate** `NATURAL_ENEMIES[p.name]?.includes(SIGN_LORD[p.sign])` check. NOTE: `NATURAL_ENEMIES` is **not exported** from `src/lib/manualChart.ts` today (only `SIGN_LORD` is) — Developer must export it or add a shared map (architect spec says both are exported; verified false).
2. **Override preservation across recalculation** — `recalculateOne` in `src/lib/recalculationJob.ts` currently overwrites `CalculatedDetails` wholesale (auto and manual paths); `mergeShadBalaya(computed, existing.shadbalaya)` must be applied before every persist (job + both recalc scripts + PATCH route must never touch `overridden: true` entries).
3. **Sparse records from the PATCH route** — first toggle on a legacy document writes only `shadbalaya.<planet>.<bala>.*`; `mergeShadBalaya` must tolerate per-bala partial planet entries and fill the other 53 cells from computed at render.
4. **Debounce / navigation race** — 500 ms per-key last-write-wins debounce; UX recommends a keep-alive flush on unmount, the architect marks it unnecessary — QA verifies no silently-lost last toggle (flag in test plan §What cannot be tested).
5. **Deferred v1 conditions** — planet-war Cheshta (no graha-yuddha module), Hora/Panchama/Sukshama varga-load Kala (formula unconfirmed), Drishti (never computed): all render unchecked with the manual reason and remain toggleable.
6. **Legacy documents** — no migration: page lazily recomputes Shad Bala at render (`getThithi()` / `resolvedMaranakaraka` pattern) — must never flash an all-unchecked table.

### Environment & data setup

| Item | Setup |
|------|-------|
| Unit fixtures | Minimal `planet(name, house, absoluteDegree, sign, strength, retrograde)` helper + `ctx { source, thithi, day, maranakaraka }`; known-bala fixtures (see test plan §8) — e.g. Sun(1) in Libra sign 7 strength NEECHA → Sthana false (`neecheShatru`); Moon(2) in house 8 → Naisargika false (`maranakaraka {house:8}`); Saturn(7) in Aries sign 1 strength NEECHA → Sthana false (second enemy combo) |
| API tests | Mocked `getServerSession` + mocked `connectDB` (reuse `auth.test.ts`/`privacy.test.ts` patterns); assert the exact `$set` dotted paths and that no computation runs in the route |
| Recalc tests | Extend `recalculationJob.test.ts` mock style: `mergeShadBalaya` called with computed + stored; `overridden: true` balas keep stored value, `overridden: false` recomputed |
| E2E/manual | Two owned horoscopes (auto with birth time + location, manual without birth time), one non-owned public horoscope, one share link; SI + EN sessions; network-throttle for failure paths |
| Golden integration | `calculateHoroscope(baseData)` (1990-06-15 08:30 Colombo) must now include `shadbalaya` with 9 planet keys × 6 balas, Drishti `false` everywhere — add to `calculation.test.ts` |

### Shad Bala acceptance-criteria traceability

| User story | QA test IDs (see test plan) |
|-----------|------------------------------|
| US-SB-001 | UT-SB-001/056/066, IT-SB-100/106/109, UI-SB-140/141/142/143/144/145, E2E-SB-160/161, RE-SB-220 |
| US-SB-002 | UT-SB-001..010, UI-SB-150, E2E-SB-162 |
| US-SB-003 | UT-SB-011..024, UI-SB-150, E2E-SB-163 |
| US-SB-004 | UT-SB-025..038, E2E-SB-164, RE-SB-219 |
| US-SB-005 | UT-SB-039..046, E2E-SB-165, RE-SB-210 |
| US-SB-006 | UT-SB-047..054, E2E-SB-166 |
| US-SB-007 | UT-SB-055/057, E2E-SB-167 |
| US-SB-008 | IT-SB-100..112, UI-SB-146/147/148/149, E2E-SB-168/169/170, RE-SB-213/214/217/221/222 |
| US-SB-009 | UI-SB-150/151/152/153, AX-SB-192/193, BI-SB-181/182 |
| US-SB-010 | UI-SB-154, RE-SB-211/212 |
| US-SB-011 | BI-SB-180..185, RE-SB-218 |
| US-SB-012 | UT-SB-012/013/037/038/064, E2E-SB-161, RE-SB-219 |
| US-SB-013 | IT-SB-120..127, E2E-SB-171, RE-SB-220/221 |
| US-SB-014 | IT-SB-101/102/103, UI-SB-145, AX-SB-193, E2E-SB-172, RE-SB-216 |

## Bhava Suchika (භාව සුචික) — Testing Considerations

> Full test plan: `specs/qa/20260814-2210-bhava-suchika-test-plan.md`

The Bhava Suchika feature (US-BS-001…008, incl. search) adds the Navamsa house index (1–12) for the Lagna and all 9 planets — `((navamsaSign − lagnaSign) mod 12) + 1`, whole-sign. New pure module `src/lib/bhavaSuchika.ts` (`computeNavamsaLagnaSign`, `computeLagnaBhavaSuchika`, `computePlanetBhavaSuchika`, `computeBhavaSuchika`), new optional `CalculatedDetails.lagnaBhavaSuchika` + `CalculatedDetails.bhavaSuchika` fields that ride the existing `...calculated` / `...synth` spreads (NO merge — no overrides exist), Lagna-section tag (first, indigo) + planets-table column after Nakshatra (desktop + mobile + search card), i18n keys `astrology.bhavaSuchika.*`, and two new search exact conditions (`bhava_suchika`, `planet_bhava_suchika`) with guarded SI/EN textContent sentences.

### Scope of Bhava Suchika testing

| Level | Scope | Key files |
|-------|-------|-----------|
| Unit (Jest, pure) | Mod-12 rule identity + wrap, degree→navamsa wedge boundaries (3°20′, 6°40′), Wargoththama invariant, 9-planet output contract, determinism, D9-lagna no-drift vs `deriveNavamsaLagnaFromDegree` | `src/lib/bhavaSuchika.ts` (new), `src/__tests__/bhavaSuchika.test.ts` (new) |
| Integration / API | No new routes (D8); POST /api/horoscope + manual routes + recalc job persist via existing spreads; legacy docs untouched (no migration); Shad Bala PATCH never touches the fields | `src/app/api/horoscope/route.ts`, `src/lib/recalculationJob.ts`, `src/lib/manualChartDetails.ts` |
| Search | `bhava_suchika` / `planet_bhava_suchika` exact conditions, +1.0/+0.5 scoring, SI/EN 12-name maps + vocabulary pool, guarded textContent sentences, manual-without-navamsa never matches | `src/app/api/search/route.ts`, `src/lib/search/vocabulary.ts`, `src/lib/search/textContent.ts`, `src/lib/search/indexer.ts` |
| Component / UI | Tag position/styling/tooltip, desktop `<th>`/`<td>` + mobile span after Nakshatra, `—` blank, legacy no-flicker, read-only everywhere | `src/app/horoscopes/[id]/page.tsx`, `src/app/search/page.tsx` |
| E2E | Manual test scripts (no Playwright installed — flagged) | — |
| Bilingual | `astrology.bhavaSuchika.*` key parity SI/EN; 12 SI names authoritative (EN provisional, OQ1) | `src/messages/en.json`, `src/messages/si.json` |

### Key risk areas (prioritised)

1. **`src/lib/bhavaSuchika.ts` does not exist yet** (verified) — Developer must create it; `navamsaSign` is exported at `astrology.ts:31` and the D9-lagna expression matches the 5 existing inline sites (`calculation.ts:505, 523, 559, 593, 606`).
2. **Manual gating (D5)** — `synthesizePlanets` falls back `navamsaSign ?? row.sign` (`manualChartDetails.ts:173`); a manual chart without navamsa data must NEVER produce values (would use the birth sign, wrong). Gating also applies to search text (no sentence emitted) and the search route (never matches).
3. **textContent guard subtleties** — follow the yogakaraka guarded pattern (`textContent.ts:81-86`/`:179-184`); handle `undefined` / `{}` / missing keys; manual-without-navamsa emits NO sentence.
4. **Search route testability** — `getExactMatch`/`scoreHoroscope`/`getAstroKeywords` are module-private; route tests must mock session/DB **and** `@/lib/search/embedding` + `@/lib/search/qdrant` (Transformers.js model download otherwise). No Gemini exists in `src/` (unused dependency) — the vector leg is Transformers.js + Qdrant.
5. **`synthesizeNavamsaCalculation` must NOT gain the fields** (`manualChartDetails.ts:233-269`) — Bhava Suchika is a D1-chart value, never D9.
6. **jest `testMatch` excludes `.tsx`** — RTL component tests need the config extended; E2E needs Playwright (Developer/PM decision).
7. **Mobile header button lacks `flex-wrap`** (`page.tsx:1818`) — wider row may wrap badly; UX question to Developer, unresolved.

### Environment & data setup

| Item | Setup |
|------|-------|
| Unit fixtures | Pure numeric-enum inputs — no mocks; boundary degrees 0, `30/9`, `30/9 − ε`, `2*(30/9)`, 29.999; full 12×12 `(lagna, navamsaLagna)` sweep |
| API tests | Mocked `getServerSession` + `connectDB` (reuse `privacy.test.ts` patterns); assert the payload rides `...calculated`/`...synth` with no new persist code |
| Search tests | Mock `@/lib/search/embedding` (`generateEmbedding → null`) + `@/lib/search/qdrant`; reuse existing `search-*.test.ts` pure-helper pattern where possible |
| Golden | `calculateHoroscope(baseData)` (1990-06-15 08:30 Colombo) must now include both fields — era-stamped fixture `fixtures/bhava-suchika-default-2026-08.json` |
| E2E/manual | One auto horoscope, one manual with navamsa data, one manual without navamsa, one legacy doc (`$unset` both fields), one share link; SI + EN sessions |

### Bhava Suchika acceptance-criteria traceability

| User story | QA test IDs (see test plan) |
|-----------|------------------------------|
| US-BS-001 | UT-BS-061/062/063, UI-BS-300..305/311, E2E-BS-400/408, AX-BS-350, RE-BS-453 |
| US-BS-002 | UT-BS-021/022, UI-BS-306..310/313/314, E2E-BS-400/402, RE-BS-454/455/456/458 |
| US-BS-003 | UT-BS-001..007/012..018/053/064/083, RE-BS-450/451/452 |
| US-BS-004 | UT-BS-008..011/019..023/052/054/084 |
| US-BS-005 | BI-BS-380..387, UI-BS-312, AX-BS-356 |
| US-BS-006 | UT-BS-055..059/063, IT-BS-103/104/105/110, UI-BS-304/308/310, E2E-BS-401/402, RE-BS-457 |
| US-BS-007 | UT-BS-051/061/062, IT-BS-100..113, UI-BS-305/311, E2E-BS-403/408/410, RE-BS-460/461/462 |
| US-BS-008 | SR-BS-200..228, E2E-BS-404..407, RE-BS-459/463/464/465/466 |
