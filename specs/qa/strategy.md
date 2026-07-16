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
