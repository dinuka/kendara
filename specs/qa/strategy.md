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
