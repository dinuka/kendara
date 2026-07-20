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
