# Development Implementation — Location Management

**Date:** 2026-07-18

## Files Created

### Data Layer
| File | Description |
|------|-------------|
| `src/models/Location.ts` | Mongoose model: id, name, latitude, longitude, isPublic, createdBy, timestamps. Indexes on createdBy.id, isPublic, name text. |

### Service Layer
| File | Description |
|------|-------------|
| `src/lib/location.ts` | Location service: listLocations (paginated, searchable, privacy-filtered), getLocation, createLocation, updateLocation, deleteLocation, validateCoordinate. Ownership enforcement, admin boundary checks. |
| `src/lib/csvParser.ts` | Client-side CSV coordinate parser: parseCsvCoordinate with regex validation and range checking. |

### API Routes
| File | Description |
|------|-------------|
| `src/app/api/location/route.ts` | GET (paginated list, search by name, privacy filter) + POST (create with validation). |
| `src/app/api/location/[id]/route.ts` | GET (single, privacy check) + PUT (ownership check) + DELETE (ownership/admin check). |

### Frontend Pages
| File | Description |
|------|-------------|
| `src/app/locations/page.tsx` | Location list page: table (desktop) / cards (mobile), search, pagination, edit/delete actions, confirmation modal. States: loading, empty, error, loaded, deleting. |
| `src/app/locations/new/page.tsx` | Add location form: dual-mode (search by name / paste CSV). Search: Nominatim autocomplete via `/api/location/search`. CSV: parse & preview via `parseCsvCoordinate`. Validation, saving, error states. |
| `src/app/locations/[id]/edit/page.tsx` | Edit location form: pre-filled, edit independence warning, dirty detection, save/error states. |

### Components
| File | Description |
|------|-------------|
| `src/components/LocationPicker.tsx` | Searchable dropdown for horoscope form: fetches locations on mount, grouped (Public / My Locations), globe/lock badges, "Add new location" action, keyboard accessible. States: loading, empty, loaded, error, search-no-results. |
| `src/components/QuickAddLocationModal.tsx` | Compact modal for inline location creation: name, lat, lon, public/private. On save: POST → refresh picker → auto-select new location. |

### Migration
| File | Description |
|------|-------------|
| `scripts/migrate-locations.ts` | Data migration: copies string `location` → `locationName`, sets `location: null` for existing horoscopes. |

### Tests
| File | Description |
|------|-------------|
| `src/__tests__/location.test.ts` | 24 tests: parseCsvCoordinate (16), validateCoordinate (8). |
| `src/__tests__/__mocks__/uuid.ts` | Jest mock for uuid v4. |

## Files Modified

| File | Change |
|------|--------|
| `src/models/Horoscope.ts` | Added `locationName` field (String), changed `location` from `String` to `{ id: String } \| null`. |
| `src/app/api/horoscope/route.ts` | POST handles both `location: { id: UUID }` (new) and `location: "string"` (legacy). |
| `src/app/api/horoscope/[id]/route.ts` | PUT handles new location reference format. |
| `src/app/horoscopes/new/page.tsx` | Replaced LocationInput with LocationPicker; added cached name + lat/lon override fields. |
| `src/components/Nav.tsx` | Added "/locations" nav link with MapPin icon. |
| `src/messages/en.json` | Added 54 location-related i18n keys. |
| `src/messages/si.json` | Added 54 matching Sinhala translations. |
| `jest.config.js` | Added uuid module mock resolution. |

## Test Results

```
Test Suites: 4 passed, 4 total
Tests:       41 passed, 41 total
```

### Test Breakdown
| Suite | Tests | Coverage |
|-------|-------|----------|
| `calculation.test.ts` | 13 | Horoscope calculation engine |
| `search.test.ts` | 3 | Basic keyword/condition filtering |
| `auth.test.ts` | 1 | Google SSO flow |
| `location.test.ts` | 24 | CSV parsing (16), coord validation (8) |

## Known Issues
- `pnpm lint` fails on pre-existing file `.scratch-test/HouseChartTest.tsx` due to eslint-plugin-react incompatibility with ESLint 10 — not introduced by this feature.
- 24 integration tests for API endpoints are defined in the QA spec but require a running MongoDB instance — they are documented but not implemented as automated tests.
