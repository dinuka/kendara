# Architecture Specification — Location Management

Date: 2026-07-18
Status: Draft
Related User Stories: US-015, US-016, US-017, US-018, US-019, US-020

## 1. Location Service Overview

The Location Service manages saved geographic places that users can associate with horoscopes. It provides CRUD operations, geocoding autocomplete, CSV Lat/Lon parsing, and privacy controls. It is a server-side service within the Next.js API Routes layer, accessed via REST endpoints.

### Location Service Responsibilities

- **CRUD**: Create, read, update, delete saved Location documents in MongoDB
- **Geocoding Autocomplete**: Proxy to Nominatim (OpenStreetMap) for name-based location suggestions with auto-populated Lat/Lon (existing `/api/location/search` route)
- **CSV Parsing**: Accept "latitude,longitude" text input, validate coordinates, create location
- **Privacy Enforcement**: Filter locations based on `isPublic` flag and requesting user's identity
- **Ownership Enforcement**: Only the creator (or Super Admin for public locations) may edit/delete a location
- **Horoscope Integration**: Provide a queryable set of locations for the horoscope form dropdown

### Service Dependencies

| Dependency | Purpose |
|------------|---------|
| MongoDB / Mongoose | Location document persistence |
| Nominatim API | Geocoding name → Lat/Lon suggestions |
| NextAuth.js session | User identity for ownership/privacy checks |
| UUID generation | Primary key for location documents |

## 2. Component Design

### 2.1 Location Model (MongoDB Schema)

Field-level specification following the conventions in `specs/business-analysis/data-model.md`:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| id | UUID (string) | Yes | Auto-generated | Primary key |
| name | String | Yes | — | Place name (e.g., "Colombo, Sri Lanka") |
| latitude | Number (Float) | Yes | — | Latitude coordinate (-90 to 90) |
| longitude | Number (Float) | Yes | — | Longitude coordinate (-180 to 180) |
| isPublic | Boolean | Yes | false | Visibility flag |
| createdBy | Object: `{ id: UUID }` | Yes | — | Reference to the User who created it |
| createdAt | Date | Yes | Auto | Timestamp of creation |
| updatedAt | Date | Yes | Auto | Timestamp of last update |

**Mongoose Schema (conceptual):**

```
{
  id:        { type: String, required: true, unique: true, default: uuidv4 },
  name:      { type: String, required: true, trim: true },
  latitude:  { type: Number, required: true, min: -90, max: 90 },
  longitude: { type: Number, required: true, min: -180, max: 180 },
  isPublic:  { type: Boolean, required: true, default: false },
  createdBy: { id: { type: String, required: true } },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}
```

**Indexes:**

| Index | Type | Purpose |
|-------|------|---------|
| `{ "createdBy.id": 1 }` | Standard | Query user's own locations |
| `{ isPublic: 1 }` | Standard | Query public locations |
| `{ name: "text" }` | Text | Text search on location name |
| `{ id: 1 }` | Unique (default _id) | Primary key lookup |

### 2.2 Location Service Module (`src/lib/location.ts`)

Exported functions:

| Function | Input | Output | Description |
|----------|-------|--------|-------------|
| `listLocations(userId, page, limit)` | userId (string), page (number), limit (number) | `{ locations, total, page, totalPages }` | Returns public locations + user's own private locations, paginated |
| `getLocation(id, userId)` | id (string), userId (string) | Location document or null | Single location fetch; enforces visibility |
| `createLocation(data, userId)` | `{ name, latitude, longitude, isPublic }`, userId | Created Location | Creates and returns new location |
| `updateLocation(id, data, userId)` | id, `{ name?, latitude?, longitude?, isPublic? }`, userId | Updated Location or null | Updates fields; ownership check |
| `deleteLocation(id, userId, role)` | id, userId, role | boolean | Deletes location; ownership or admin check |
| `parseCsvCoordinate(input)` | input (string) | `{ latitude, longitude }` or error | Parses "lat,lon" CSV format |
| `validateCoordinate(lat, lon)` | lat (number), lon (number) | `{ valid, error? }` | Range validation |

### 2.3 API Route Structure

```
src/app/api/location/
├── route.ts                  # GET (list) + POST (create)
├── [id]
│   └── route.ts              # GET + PUT + DELETE
└── search
    └── route.ts              # GET (Nominatim geocoding) — existing
```

## 3. API Contracts

### 3.1 GET /api/location — List Locations

**Query Parameters:**

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| page | number | No | 1 | Page number (1-indexed) |
| limit | number | No | 20 | Items per page (max 100) |
| search | string | No | — | Text search filter on name |

**Response (200):**

```json
{
  "locations": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Colombo, Sri Lanka",
      "latitude": 6.9271,
      "longitude": 79.8612,
      "isPublic": true,
      "createdBy": { "id": "660e8400-e29b-41d4-a716-446655440001" },
      "createdAt": "2026-07-18T10:00:00Z",
      "updatedAt": "2026-07-18T10:00:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "totalPages": 3
}
```

**Error (401):** `{ "error": "Unauthorized" }`

**Behavior:**
- Returns all `isPublic: true` locations
- PLUS locations where `createdBy.id` matches the authenticated user (even if private)
- Super Admin sees all locations (public and private)
- Results sorted by `name` ascending
- `search` parameter performs a case-insensitive regex match on `name` (or text index)

### 3.2 POST /api/location — Create Location

**Request Body — Name + Coordinates (standard):**

```json
{
  "name": "Colombo, Sri Lanka",
  "latitude": 6.9271,
  "longitude": 79.8612,
  "isPublic": true
}
```

**Request Body:**

```json
{
  "name": "Colombo, Sri Lanka",
  "latitude": 6.9271,
  "longitude": 79.8612,
  "isPublic": true
}
```

**Validation Rules:**

| Field | Rule |
|-------|------|
| name | Required, non-empty string, trimmed |
| latitude | Required, number, -90 ≤ value ≤ 90 |
| longitude | Required, number, -180 ≤ value ≤ 180 |
| isPublic | Optional boolean, defaults to false |

**Response (201):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Colombo, Sri Lanka",
  "latitude": 6.9271,
  "longitude": 79.8612,
  "isPublic": true,
  "createdBy": { "id": "660e8400-e29b-41d4-a716-446655440001" },
  "createdAt": "2026-07-18T10:00:00Z",
  "updatedAt": "2026-07-18T10:00:00Z"
}
```

**Error (400) — Validation Failure:**

```json
{
  "error": "Validation failed",
  "fields": {
    "latitude": "Latitude must be between -90 and 90",
    "csv": "Invalid CSV format. Expected 'latitude,longitude' (e.g., 6.9271,79.8612)"
  }
}
```

**Error (409) — Duplicate (optional, based on name + lat/lon proximity check):**

```json
{
  "error": "A location with similar coordinates already exists"
}
```

### 3.3 GET /api/location/[id] — Get Single Location

**Response (200):** Same shape as list item

**Error (404):** `{ "error": "Location not found" }`

**Error (403):** `{ "error": "Forbidden" }` — if location is private and user is not the creator or Super Admin

### 3.4 PUT /api/location/[id] — Update Location

**Request Body (all fields optional):**

```json
{
  "name": "Colombo 01, Sri Lanka",
  "latitude": 6.9344,
  "longitude": 79.8428,
  "isPublic": false
}
```

**Validation:** Same as POST, applied only to provided fields.

**Response (200):** Updated location object

**Error (403):** `{ "error": "Only the creator can edit this location" }`

**Error (404):** `{ "error": "Location not found" }`

**Important:** Updating a location does NOT cascade changes to existing horoscopes that reference it. Horoscopes store their own `locationName`, `latitude`, and `longitude` as independent overrides. Only the `location.id` reference remains stable.

### 3.5 DELETE /api/location/[id] — Delete Location

**Response (200):** `{ "success": true }`

**Error (403):**
- Student: `{ "error": "Only the creator can delete this location" }`
- Admin trying to delete private location: `{ "error": "Cannot delete a private location owned by another user" }`

**Behavior:**
- Students can delete their own locations (public or private)
- Super Admin can delete any public location
- Deleting a location does NOT cascade to horoscopes — horoscopes keep their `location.id` reference (it becomes a soft dangling reference; the horoscope's `locationName`/`latitude`/`longitude` fields remain intact for display and calculation)

## 4. Data Flows

### 4.1 Create Location — Name with Geocoding Suggestion

```
User → Location Management Page → "Add Location" →
  → Type location name in input →
    → GET /api/location/search?q=<typed-text> (Nominatim proxy)
    → Autocomplete dropdown shows suggestions (label, lat, lng)
  → User selects a suggestion →
    → Name field filled with display_name
    → Lat/Lon fields auto-filled from selection
  → User adjusts name (optional) →
  → User toggles isPublic (optional) →
  → User clicks "Save" →
    → POST /api/location { name, latitude, longitude, isPublic }
    → Server validates → Create MongoDB document → Return 201
  → List refreshes with new location visible
```

### 4.2 Create Location — CSV Lat/Lon Paste

```
User → Location Management Page → "Add Location" →
  → Clicks "Paste CSV" toggle/option →
  → Text field appears: "Enter latitude,longitude" →
  → User pastes "6.9271,79.8612" →
    → Client-side validation:
      → Pattern match /^\-?\d+(\.\d+)?,\-?\d+(\.\d+)?$/
      → Lat range -90..90, Lon range -180..180
    → If valid: auto-fills hidden Lat/Lon fields, enables Name field
    → If invalid: shows inline error "Invalid CSV format"
  → User enters name →
  → User toggles isPublic →
  → User clicks "Save" →
    → POST /api/location { name, latitude, longitude, isPublic }
    → (CSV parsing only occurs client-side; server receives parsed values)
  → Location saved and list refreshes
```

### 4.3 Location Picker in Horoscope Form

```
User → New Horoscope Form → Location field →
  → Dropdown/selector renders:
    ┌────────────────────────────────┐
    │ 🔍 Search locations...         │ (search input)
    ├────────────────────────────────┤
    │ 📍 Colombo, Sri Lanka    (pub) │
    │ 📍 Kandy, Sri Lanka      (pub) │
    │ 🔒 My Home               (priv)│
    │ 📍 Galle, Sri Lanka      (pub) │
    ├────────────────────────────────┤
    │ ➕ Add new location...          │ (opens location creation modal)
    └────────────────────────────────┘
  → User selects a location →
    → horoscope.location = { id: selectedLocation.id }
    → horoscope.locationName = selectedLocation.name
    → horoscope.latitude = selectedLocation.latitude
    → horoscope.longitude = selectedLocation.longitude
  → User can override Lat/Lon fields manually (independent of saved location) →
  → User fills remaining fields → Submits horoscope
  → Server stores all fields including the location reference

Note: The dropdown fetches from GET /api/location (returns public + own private).
Search within the dropdown filters results client-side or via the ?search= param.
```

### 4.4 Edit Location — Independence from Horoscopes

```
User → Location Management Page → Click "Edit" on "Colombo, Sri Lanka" →
  → Pre-filled form with current name, lat, lon, isPublic →
  → User changes name to "Colombo 01" and lat to 6.9344 →
  → Clicks "Save" →
    → PUT /api/location/<id> { name: "Colombo 01", latitude: 6.9344 }
    → Location updated in MongoDB
  → Existing horoscopes referencing this location remain unchanged:
    Horoscope A: { location: { id: "<location-id>" }, locationName: "Colombo, Sri Lanka", latitude: 6.9271, longitude: 79.8612 }
    Horoscope B: { location: { id: "<location-id>" }, locationName: "Colombo, Sri Lanka", latitude: 6.9344, longitude: 79.8428 }
    — Both still reference the same Location UUID
    — Each keeps its own lat/lon overrides (the values used at horoscope creation time)
    — locationName is cached and not auto-updated (design choice: horoscope data is immutable snapshots)
```

### 4.5 Modified Add Horoscope Flow (Full Sequence)

```
┌─────┐     ┌──────────┐    ┌──────────────┐    ┌────────────┐    ┌──────────┐    ┌────────┐
│User │     │Frontend  │    │Location API  │    │Horoscope   │    │Calc      │    │MongoDB │
│     │     │          │    │              │    │API         │    │Engine    │    │        │
└──┬──┘     └───┬──────┘    └──────┬───────┘    └─────┬──────┘    └───┬────┘    └────┬───┘
   │            │                  │                  │               │               │
   │ Open form  │                  │                  │               │               │
   │───────────>│                  │                  │               │               │
   │            │ GET /api/location                  │               │               │
   │            │───────────────────────────────────>│               │               │
   │            │                  │                  │               │               │
   │            │<────────────────────────────────────│               │               │
   │            │ Location list    │                  │               │               │
   │            │ (public + own)   │                  │               │               │
   │            │                  │                  │               │               │
   │ Select loc │                  │                  │               │               │
   │───────────>│                  │                  │               │               │
   │            │ Auto-fill fields │                  │               │               │
   │            │ (name, lat, lon) │                  │               │               │
   │            │                  │                  │               │               │
   │ Override?  │                  │                  │               │               │
   │───────────>│ (edit lat/lon)   │                  │               │               │
   │            │                  │                  │               │               │
   │ Submit     │                  │                  │               │               │
   │───────────>│                  │                  │               │               │
   │            │                  │  POST /api/horoscope           │               │
   │            │                  │  { location: { id },           │               │
   │            │                  │    locationName, lat, lon... } │               │
   │            │                  │────────────────>│               │               │
   │            │                  │                  │ Calculate    │               │
   │            │                  │                  │─────────────>│               │
   │            │                  │                  │<─────────────│               │
   │            │                  │                  │               │               │
   │            │                  │                  │ Save horoscope               │
   │            │                  │                  │───────────────>              │
   │            │                  │                  │<──────────────│              │
   │            │                  │                  │               │               │
   │            │<────────────────────────────────────│               │               │
   │ Show view  │                  │                  │               │               │
   │<───────────│                  │                  │               │               │
```

## 5. CSV Lat/Long Parsing Specification

### 5.1 Client-Side Parsing (Recommended)

The CSV parsing is primarily a client-side UX concern — the input field accepts raw "latitude,longitude" text and auto-fills the numeric fields before submission.

**Input Format:**

```
<latitude>,<longitude>
```

**Examples:**

| Input | Latitude | Longitude | Valid |
|-------|----------|-----------|-------|
| `6.9271,79.8612` | 6.9271 | 79.8612 | ✓ |
| `-33.8688,151.2093` | -33.8688 | 151.2093 | ✓ |
| `90.0,180.0` | 90.0 | 180.0 | ✓ |
| `-90.0,-180.0` | -90.0 | -180.0 | ✓ |
| `6.9271` | — | — | ✗ (missing longitude) |
| `abc,def` | — | — | ✗ (non-numeric) |
| `91.0,79.0` | — | — | ✗ (lat out of range) |
| `6.9271,181.0` | — | — | ✗ (lon out of range) |

**Validation Algorithm:**

```
function parseCsvCoordinate(input: string): { latitude: number; longitude: number } | Error {
    // Strip whitespace
    const trimmed = input.trim();

    // Match pattern: optional negative sign, digits, optional decimal part
    const pattern = /^\-?\d+(\.\d+)?,\-?\d+(\.\d+)?$/;
    if (!pattern.test(trimmed)) {
        return new Error("Invalid CSV format. Expected 'latitude,longitude' (e.g., 6.9271,79.8612)");
    }

    const parts = trimmed.split(",");
    const lat = parseFloat(parts[0]);
    const lon = parseFloat(parts[1]);

    if (lat < -90 || lat > 90) {
        return new Error("Latitude must be between -90 and 90");
    }
    if (lon < -180 || lon > 180) {
        return new Error("Longitude must be between -180 and 180");
    }

    return { latitude: lat, longitude: lon };
}
```

## 6. Frontend Integration

### 6.1 New Routes

| Route | Component | Auth | Description |
|-------|-----------|------|-------------|
| `/locations` | LocationListPage | Required | List, search, paginate locations |
| `/locations/new` | LocationFormPage | Required | Add new location (geocoding or CSV) |
| `/locations/[id]/edit` | LocationFormPage | Required | Edit existing location |

### 6.2 Updated Components

**LocationPicker** (new component, used in HoroscopeForm):

```
Props:
- selectedLocationId: string | null
- onChange: (location: { id, name, lat, lon } | null) => void
- disabled: boolean (optional)

States:
1. Loading: Skeleton placeholder while fetching locations
2. Empty: "No saved locations yet. Add one first." + "Add Location" button
3. Loaded: Dropdown with locations grouped [Public | My Locations]
4. Error: Inline error with retry

Behavior:
- Fetches from GET /api/location on mount
- Shows search input at top of dropdown for filtering the list
- On selection: calls onChange with location data
- "Add Location" button at bottom opens a modal or navigates to /locations/new
- After adding a location via modal, refreshes the list and auto-selects the new one
```

**LocationForm** (shared between /locations/new and /locations/[id]/edit):

```
Modes:
- Create: Empty form, geocoding autocomplete + CSV paste option
- Edit: Pre-filled form, same fields editable

Fields:
- Name (text input, required)
- Geocoding Autocomplete (search input that shows Nominatim suggestions)
  - OR CSV Paste (text input that parses "lat,lon" format, mutually exclusive with autocomplete)
- Latitude (number input, -90 to 90)
- Longitude (number input, -180 to 180)
- isPublic (toggle switch)

Validation:
- All validation runs client-side before submission
- Server-side validation as backup
- Coordinate fields show inline error if out of range
```

**HoroscopeForm** (updated):

- Location field changed from free-text input with geocoding autocomplete to:
  - LocationPicker dropdown (primary selection from DB)
  - Latitude/Longitude fields remain editable (overrides) — shown after selection
  - locationName auto-filled from selection, editable as display name override
  - All three fields (lat, lon, name) are pre-filled when a location is selected
  - If user clears the location selection, the form reverts to manual entry mode

## 7. Data Migration Strategy

### 7.1 Existing Horoscopes with String Location

Current horoscopes have `location: string` (a free-text place name). The migration must:

1. **Add new fields** to existing horoscope documents (no backfill needed):
   - `locationName` ← copy existing `location` value
   - `location` ← set to `null` (no DB reference)
   - `latitude` / `longitude` ← keep existing values (already present)

2. **Migration script** (`scripts/migrate-locations.ts`):

```
For each horoscope where location is a string:
  - Set locationName = location
  - Set location = null
  - Keep latitude and longitude as-is
```

3. **Schema update**: Change Mongoose schema field `location` from `String` to `{ id: String }` with a nullable/optional constraint to handle existing records.

4. **No automatic creation** of Location documents from existing horoscope locations — deduplication is ambiguous (same name may have different coords, same coords may have different names). Users can manually add locations as needed.

### 7.2 Code Migration

- Update `src/app/api/horoscope/route.ts` (POST): if `body.location` is an object with `id`, treat as DB reference; if `body.location` is a string (old clients), treat as legacy and set `location: null`.
- Update `src/app/api/horoscope/[id]/route.ts` (PUT): Same dual-handling for backward compatibility.
- Update frontend horoscope form to use `LocationPicker` component.
- Old API clients (e.g., manual curl, external scripts) can still send `location` as a string — non-null `locationName` on the document will preserve display.

## 8. Error Handling

| Error Type | HTTP Code | Response Shape | Trigger |
|------------|-----------|----------------|---------|
| Missing auth | 401 | `{ error: "Unauthorized" }` | No valid session token |
| Location not found | 404 | `{ error: "Location not found" }` | Invalid ID or deleted |
| Forbidden (private) | 403 | `{ error: "This location is private" }` | Non-owner accessing private location |
| Forbidden (edit) | 403 | `{ error: "Only the creator can edit this location" }` | Non-owner attempting PUT |
| Forbidden (delete) | 403 | `{ error: "Only the creator can delete this location" }` | Non-owner attempting DELETE |
| Admin delete private | 403 | `{ error: "Cannot delete a private location owned by another user" }` | Admin trying to delete non-public location |
| Validation (name) | 400 | `{ error: "Validation failed", fields: { name: "Name is required" } }` | Empty name |
| Validation (lat) | 400 | `{ error: "Validation failed", fields: { latitude: "Latitude must be between -90 and 90" } }` | Out of range |
| Validation (lon) | 400 | `{ error: "Validation failed", fields: { longitude: "Longitude must be between -180 and 180" } }` | Out of range |
| Server error | 500 | `{ error: "Internal server error" }` | Unexpected failure |

### 8.1 Logging Guidelines

Use the shared `logger` (pino) following existing conventions:

- `logger.info("location created: %s by user %s", locationId, userId)` — on create
- `logger.info("location deleted: %s by user %s", locationId, userId)` — on delete
- `logger.warn("location access denied: %s by user %s", locationId, userId)` — on 403
- `logger.debug("locations listed: page %d, %d results for user %s", page, count, userId)` — on list
- `logger.error("location save failed: %s", error.message)` — on DB failure

## 9. Testing Strategy

### 9.1 Unit Tests (`src/__tests__/location.test.ts`)

- `parseCsvCoordinate` — valid inputs, invalid formats, edge cases (boundary values, whitespace)
- `validateCoordinate` — boundary values, out of range
- Location model validation — name required, lat/lon range, isPublic default
- Ownership checks — creator can edit, non-creator forbidden

### 9.2 Integration Tests

- `GET /api/location` — returns public + own private; admin sees all; pagination; search filter
- `POST /api/location` — standard create; CSV create; validation errors; duplicate detection
- `GET /api/location/[id]` — existing location; not found; private location forbidden
- `PUT /api/location/[id]` — update own; forbid non-owner; verify no cascade to horoscopes
- `DELETE /api/location/[id]` — delete own; forbid non-owner; admin delete public; forbid admin delete private

### 9.3 Edge Cases

- Creating a location with name too long (truncate or reject at > 200 chars)
- Searching with special characters (SQL injection-safe via Mongoose)
- Race condition: delete location while horoscope references it (soft reference — horoscope still renders correctly)
- Pagination: page beyond total returns empty array, not error
- CSV with negative coordinates (both negative; one negative)
- CSV with trailing/leading whitespace
- User with no locations sees empty state correctly
- Super Admin role boundary: can view private location but not edit/delete it

## 10. Configuration

No new environment variables are needed. The existing Nominatim configuration in `src/app/api/location/search/route.ts` handles geocoding.

Potential enhancements (future):
- `NOMINATIM_BASE_URL` — if self-hosting Nominatim
- `MAX_LOCATIONS_PER_USER` — rate limit on location creation (default: unlimited)
