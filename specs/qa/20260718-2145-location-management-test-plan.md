# Test Plan — Location Management

**Date:** 2026-07-18
**Based on:**
- `specs/business-analysis/20260718-1400-location-management.md` (User Stories US-015–US-020)
- `specs/architecture/20260718-2145-location-management-architecture.md`
- `specs/ux/20260718-2145-location-management-ux.md`
- `specs/business-analysis/actors.md`
- `specs/business-analysis/data-model.md`
- `specs/architecture/overview.md`

## Test Cases

---

### US-015: Location Management Page

#### TC-041: List locations shows public + own private
- **Reference:** US-015
- **Title:** Location list includes all public locations and user's own private locations
- **Preconditions:** Multiple locations exist: public (User A, User B), private (own User A, private other User B)
- **Test Steps:**
  1. Log in as User A
  2. Navigate to `/locations`
  3. Observe location list
- **Expected Results:** List shows all public locations (from any user) and User A's own private locations. Private locations owned by User B are NOT visible.
- **Priority:** High

#### TC-042: Pagination works correctly
- **Reference:** US-015
- **Title:** Location list pagination with default 20 per page
- **Preconditions:** 25+ locations exist
- **Test Steps:**
  1. Navigate to `/locations`
  2. Observe first page (default 20 items)
  3. Click "Next" to go to page 2
  4. Click "Previous" to return to page 1
- **Expected Results:** Page 1 shows first 20 locations sorted by name. Page 2 shows remaining 5. Previous/Next navigation works. Page indicator shows correct (e.g., "Page 1 of 2").
- **Priority:** Medium

#### TC-043: Search filters locations by name
- **Reference:** US-015
- **Title:** Search input filters location list by name
- **Preconditions:** Locations with distinct names exist (e.g., "Colombo", "Kandy", "Sydney")
- **Test Steps:**
  1. Navigate to `/locations`
  2. Type "Colombo" in search input
  3. Observe filtered results
  4. Clear search
- **Expected Results:** Only locations containing "Colombo" appear. After clearing, all locations return. Empty state shown when no match.
- **Priority:** Medium

#### TC-044: Empty state when no locations
- **Reference:** US-015
- **Title:** Location list shows empty state with add prompt
- **Preconditions:** No locations exist in database
- **Test Steps:**
  1. Log in as a new user with no locations
  2. Navigate to `/locations`
- **Expected Results:** Empty state displayed: "No saved locations yet. Add your first one!" with a visible "Add Location" CTA button.
- **Priority:** Medium

---

### US-016: Add Location via Geocoding

#### TC-045: Add location with valid data
- **Reference:** US-016
- **Title:** Student adds location with valid name, lat, lon, and visibility
- **Preconditions:** User logged in
- **Test Steps:**
  1. Navigate to `/locations/new`
  2. Enter name "Colombo, Sri Lanka"
  3. Enter latitude 6.9271
  4. Enter longitude 79.8612
  5. Toggle visibility to "Public"
  6. Click "Save Location"
- **Expected Results:** Location created with 201. Form redirects to `/locations`. New location visible in list with "Public" badge.
- **Priority:** High

#### TC-046: Validation catches missing name
- **Reference:** US-016
- **Title:** Form prevents submission when name is empty
- **Preconditions:** User logged in
- **Test Steps:**
  1. Navigate to `/locations/new`
  2. Enter valid latitude and longitude
  3. Leave name empty
  4. Click "Save Location"
- **Expected Results:** Inline error shown: "Name is required". Form not submitted. Server also rejects with 400 if bypassed.
- **Priority:** High

#### TC-047: Validation catches invalid lat/lon range
- **Reference:** US-016
- **Title:** Form rejects out-of-range latitude and longitude
- **Preconditions:** User logged in
- **Test Steps:**
  1. Navigate to `/locations/new`
  2. Enter name "Test"
  3. Enter latitude 91.0 (invalid)
  4. Enter longitude 200.0 (invalid)
  5. Click "Save Location"
- **Expected Results:** Inline errors: "Latitude must be between -90 and 90", "Longitude must be between -180 and 180". Form not submitted. Server returns 400 if bypassed.
- **Priority:** High

#### TC-048: Geocoding autocomplete shows suggestions
- **Reference:** US-016
- **Title:** Nominatim geocoding returns suggestions as user types
- **Preconditions:** User logged in, network access to Nominatim (or mock active)
- **Test Steps:**
  1. Navigate to `/locations/new`
  2. Select "Search by name" mode
  3. Type "Colombo" in geocoding search input
  4. Wait for debounce (300ms)
  5. Observe autocomplete dropdown
  6. Click a suggestion
- **Expected Results:** Dropdown shows up to 5 suggestions after debounce. Selecting a suggestion auto-fills name, latitude, and longitude fields. Fields are editable after selection.
- **Priority:** High

---

### US-017: Add Location via CSV Paste

#### TC-049: Client-side CSV parsing valid input
- **Reference:** US-017
- **Title:** Pasting valid CSV coordinates parses correctly
- **Preconditions:** User logged in
- **Test Steps:**
  1. Navigate to `/locations/new`
  2. Select "Paste CSV" mode
  3. Paste "6.9271,79.8612"
  4. Click "Parse & Preview"
- **Expected Results:** Preview shows ✅ Latitude: 6.9271, ✅ Longitude: 79.8612. Lat/Lon fields auto-filled. Button changes to "Parsed ✓". User can enter name and save.
- **Priority:** Medium

#### TC-050: Client-side CSV parsing invalid formats
- **Reference:** US-017
- **Title:** Invalid CSV input shows clear error messages
- **Preconditions:** User logged in
- **Test Steps:**
  1. Navigate to `/locations/new`
  2. Select "Paste CSV" mode
  3. Test each invalid input:
     - "6.9271" (missing longitude)
     - "abc,def" (non-numeric)
     - "91.0,79.0" (lat out of range)
     - "6.9271,181.0" (lon out of range)
     - " , " (whitespace only)
  4. Click "Parse & Preview" for each
- **Expected Results:** Each invalid format shows appropriate inline error: "Invalid CSV format", "Latitude must be between -90 and 90", or "Longitude must be between -180 and 180". Fields NOT auto-filled.
- **Priority:** Medium

#### TC-051: Server rejects CSV field
- **Reference:** US-017
- **Title:** Server does not accept CSV format in request body
- **Preconditions:** User logged in
- **Test Steps:**
  1. Send POST /api/location with body: `{ csv: "6.9271,79.8612", name: "Test" }`
  2. Send POST /api/location with body: `{ name: "Test", latitude: "6.9271,79.8612", longitude: "" }`
- **Expected Results:** Server ignores or rejects CSV fields. Only `name`, `latitude`, `longitude`, `isPublic` accepted. Validation errors for missing/invalid lat/lon.
- **Priority:** Medium

---

### US-018: Location Privacy

#### TC-052: Public location visible to all users
- **Reference:** US-018
- **Title:** Public location appears in all users' location lists
- **Preconditions:** User A has a public location "Colombo"
- **Test Steps:**
  1. Log in as User B (different user)
  2. Navigate to `/locations`
  3. Search for "Colombo"
- **Expected Results:** User A's public "Colombo" location is visible. "Public" badge displayed.
- **Priority:** High

#### TC-053: Private location visible only to creator
- **Reference:** US-018
- **Title:** Private location hidden from other users
- **Preconditions:** User A has a private location "My Home"
- **Test Steps:**
  1. Log in as User B
  2. Navigate to `/locations`
  3. Search for "My Home"
- **Expected Results:** "My Home" location NOT visible to User B. User A can see it in their own list with "Private" badge.
- **Priority:** High

#### TC-054: Super Admin sees all locations
- **Reference:** US-018
- **Title:** Super Admin can view both public and private locations
- **Preconditions:** User A has a private location, User B has a public location
- **Test Steps:**
  1. Log in as Super Admin
  2. Navigate to `/locations`
- **Expected Results:** All locations visible — both public and private. Private locations show "Private" badge.
- **Priority:** Medium

#### TC-055: Toggle privacy on existing location
- **Reference:** US-018
- **Title:** Student toggles location from public to private
- **Preconditions:** User A owns a public location "Colombo"
- **Test Steps:**
  1. Log in as User A
  2. Navigate to `/locations/[id]/edit` for "Colombo"
  3. Toggle visibility from Public to Private
  4. Click "Save Changes"
  5. Log out and log in as User B
  6. Search for "Colombo"
- **Expected Results:** Location updated. After toggling, User B no longer sees "Colombo". User A still sees it with "Private" badge.
- **Priority:** Medium

---

### US-019: Location Picker in Horoscope Form

#### TC-056: Location picker loads saved locations
- **Reference:** US-019
- **Title:** Horoscope form LocationPicker loads public + own private locations
- **Preconditions:** Multiple public locations exist. User A has private locations.
- **Test Steps:**
  1. Log in as User A
  2. Navigate to `/horoscopes/new`
  3. Click the LocationPicker dropdown trigger
- **Expected Results:** Dropdown opens showing "Public Locations" group (all public) and "My Locations" group (User A's private). Results can be searched within the dropdown.
- **Priority:** High

#### TC-057: Selecting location populates horoscope form
- **Reference:** US-019
- **Title:** Selecting a saved location auto-fills lat/lon/name
- **Preconditions:** Saved locations exist
- **Test Steps:**
  1. Navigate to `/horoscopes/new`
  2. Open LocationPicker dropdown
  3. Select "Colombo, Sri Lanka"
- **Expected Results:** Picker shows selected name with "Change" button. Latitude and longitude fields auto-populated from saved location. Location Name field shows cached name. Fields are editable independently.
- **Priority:** High

#### TC-058: Override lat/lon on horoscope doesn't affect saved location
- **Reference:** US-019
- **Title:** Editing lat/lon on horoscope does not modify the saved location record
- **Preconditions:** User owns a saved location "Colombo" with lat=6.9271, lon=79.8612
- **Test Steps:**
  1. Navigate to `/horoscopes/new`
  2. Select "Colombo" from LocationPicker
  3. Override latitude to 6.9344
  4. Override longitude to 79.8428
  5. Complete and submit horoscope
  6. Navigate to `/locations` and check "Colombo"
- **Expected Results:** Horoscope stores overridden lat/lon. Saved location "Colombo" retains original lat=6.9271, lon=79.8612. No cascade effect.
- **Priority:** High

#### TC-059: No locations state shows "Add Location" prompt
- **Reference:** US-019
- **Title:** LocationPicker shows empty state with add prompt when no locations exist
- **Preconditions:** User has zero saved locations
- **Test Steps:**
  1. Log in as a new user with no locations
  2. Navigate to `/horoscopes/new`
  3. Click the LocationPicker dropdown
- **Expected Results:** Dropdown shows "No saved locations yet." message with an "Add Location" button. Clicking navigates to `/locations/new` or opens quick-add modal.
- **Priority:** Medium

---

### US-020: Edit Location

#### TC-060: Edit location name, lat, lon, visibility
- **Reference:** US-020
- **Title:** Student edits all fields of own location
- **Preconditions:** User A owns location "Colombo" (lat=6.9271, lon=79.8612, public)
- **Test Steps:**
  1. Log in as User A
  2. Navigate to `/locations`
  3. Click Edit (pencil) on "Colombo"
  4. Change name to "Colombo 01"
  5. Change latitude to 6.9344
  6. Change longitude to 79.8428
  7. Toggle to Private
  8. Click "Save Changes"
- **Expected Results:** Location updated. Redirect to `/locations`. List shows updated name and coordinates with "Private" badge. No duplicate created.
- **Priority:** High

#### TC-061: Non-owner cannot edit location
- **Reference:** US-020
- **Title:** Non-owner gets error when trying to edit another user's location
- **Preconditions:** User A owns a location. User B is different.
- **Test Steps:**
  1. Log in as User B
  2. Navigate directly to `/locations/[id]/edit` for User A's location
  3. Submit changes via PUT /api/location/[id]
- **Expected Results:** Frontend: Edit button not visible for non-owned locations. Direct API call returns 403: "Only the creator can edit this location".
- **Priority:** High

#### TC-062: Edit doesn't cascade to existing horoscopes
- **Reference:** US-020
- **Title:** Editing location leaves existing horoscope data unchanged
- **Preconditions:** User has horoscope referencing "Colombo" with lat=6.9271, lon=79.8612, locationName="Colombo, Sri Lanka"
- **Test Steps:**
  1. Edit "Colombo" location: change name to "Colombo 01", lat to 6.9344
  2. Navigate to the existing horoscope
- **Expected Results:** Horoscope still shows original locationName="Colombo, Sri Lanka" and original lat=6.9271, lon=79.8612. LocationPicker shows updated name for new horoscopes.
- **Priority:** High

---

### General / Edge Cases

#### TC-063: Delete own location
- **Reference:** US-015
- **Title:** Student can delete their own location
- **Preconditions:** User A owns a location
- **Test Steps:**
  1. Log in as User A
  2. Navigate to `/locations`
  3. Click Delete (trash) on own location
  4. Confirm deletion in confirmation modal
- **Expected Results:** Confirmation modal shows warning. After confirming, location removed from list. Toast: "Location deleted." Horoscopes that reference it render correctly with snapshot data.
- **Priority:** Medium

#### TC-064: Non-owner cannot delete
- **Reference:** US-015
- **Title:** Non-owner cannot delete another user's location
- **Preconditions:** User A owns a public location. User B is different.
- **Test Steps:**
  1. Log in as User B
  2. Attempt DELETE /api/location/[id] for User A's location
- **Expected Results:** Frontend: Delete button not visible for non-owned locations. Direct API call returns 403: "Only the creator can delete this location".
- **Priority:** Medium

#### TC-065: Admin can delete public location but not private
- **Reference:** US-018
- **Title:** Super Admin can delete public locations but not private ones belonging to others
- **Preconditions:** User A has a public location and a private location
- **Test Steps:**
  1. Log in as Super Admin
  2. DELETE /api/location/[publicId]
  3. DELETE /api/location/[privateId]
- **Expected Results:** Public location deleted successfully. Private location returns 403: "Cannot delete a private location owned by another user".
- **Priority:** Medium

#### TC-066: Location with special characters in name
- **Reference:** US-016
- **Title:** Location names with special characters are handled safely
- **Preconditions:** User logged in
- **Test Steps:**
  1. Create location with name: `Saõ Paulo, Brázil`
  2. Create location with name: `<script>alert('xss')</script>`
  3. Create location with name: `東京, 日本`
- **Expected Results:** Unicode names stored and displayed correctly. XSS payload stored as text, not executed. List renders all names safely.
- **Priority:** Medium

#### TC-067: Concurrent operations
- **Reference:** US-015, US-020
- **Title:** Concurrent edit/view does not cause data corruption
- **Preconditions:** Location exists, two users logged in
- **Test Steps:**
  1. User A opens edit form for location
  2. User B (or second tab) simultaneously edits and saves the same location
  3. User A submits their changes
- **Expected Results:** Last write wins. No data corruption. If stale data detected, show conflict warning: "Location was modified by another session. Reload and try again."
- **Priority:** Low

---

## Summary

| Category | Test Cases | Priority Breakdown |
|----------|-----------|-------------------|
| US-015: Location List | TC-041 to TC-044 | High: 1, Medium: 3 |
| US-016: Add via Geocoding | TC-045 to TC-048 | High: 3, Medium: 1 |
| US-017: Add via CSV | TC-049 to TC-051 | Medium: 3 |
| US-018: Privacy | TC-052 to TC-055 | High: 2, Medium: 2 |
| US-019: Location Picker | TC-056 to TC-059 | High: 2, Medium: 2 |
| US-020: Edit Location | TC-060 to TC-062 | High: 3 |
| General / Edge Cases | TC-063 to TC-067 | Medium: 4, Low: 1 |

**Total: 27 test cases** (TC-041 through TC-067)
