# User Stories — Location Management

## Manage Locations

### US-015: Location Management Page
- **Title**: Student views and manages all saved locations
- **Description**: As a student, I want a dedicated Location page where I can browse all saved locations so that I can manage them in one place.
- **Acceptance Criteria**:
  - Page shows all public locations
  - Page shows the student's own private locations
  - Each location displays name, Lat/Lon, and visibility badge (public/private)
  - "Add Location" button opens the add form
  - Student can edit or delete their own locations
  - Pagination or search when the list is large
- **Priority**: High
- **Actor**: Student

### US-016: Add Location with Name Suggestion via API
- **Title**: Student adds a location with geocoding API suggestions
- **Description**: As a student, I want to type a location name and get suggestions from a geocoding API so that I can quickly select the correct place and auto-populate Lat/Lon.
- **Acceptance Criteria**:
  - Location name input shows autocomplete suggestions from geocoding API
  - Selecting a suggestion auto-populates latitude and longitude
  - User can manually edit name, latitude, or longitude after selection
  - Location is saved to the database with all three fields
  - Saved location is available for future horoscope entries
- **Priority**: High
- **Actor**: Student

### US-017: Add Location via CSV Lat/Lon Paste
- **Title**: Student adds a location by pasting CSV-formatted coordinates
- **Description**: As a student, I want to paste a latitude,longitude pair directly so that I can add locations without relying on the geocoding API.
- **Acceptance Criteria**:
  - Text input accepts "latitude,longitude" format (e.g., "6.9271,79.8612")
  - Pasting or entering coordinates auto-fills the Lat/Lon fields
  - Latitude and longitude values are validated (latitude -90 to 90, longitude -180 to 180)
  - User must provide a name for the location
  - Invalid format displays a clear error message
- **Priority**: Medium
- **Actor**: Student

### US-018: Location Privacy Toggle
- **Title**: Student controls location visibility with public/private toggle
- **Description**: As a student, I want to mark my locations as public or private so that public places (e.g., hospitals) benefit all users while personal places remain private.
- **Acceptance Criteria**:
  - Public/private toggle available when adding a new location
  - Toggle accessible when editing an existing location
  - Public locations are visible to all students in the location list and horoscope form
  - Private locations are visible only to the student who added them
  - Different visual badges indicate public vs. private status in the list
- **Priority**: Medium
- **Actor**: Student

### US-020: Edit Saved Location
- **Title**: Student edits an existing saved location
- **Description**: As a student, I want to edit the name, latitude, longitude, or visibility of a location I own so that I can correct errors or update details without re-creating it.
- **Acceptance Criteria**:
  - Edit button available on each owned location in the list
  - Clicking edit opens the add/edit form pre-filled with existing data
  - Name field editable with geocoding API suggestions
  - Latitude and longitude fields editable
  - Public/private toggle accessible on edit
  - Saving updates the location record without creating a duplicate
  - Changes to a location do not affect existing horoscopes that reference it (lat/lng overrides on horoscope are independent)
  - Cancel discards changes and returns to the location list
- **Priority**: High
- **Actor**: Student

## Horoscope Integration

### US-019: Select Saved Location When Adding Horoscope
- **Title**: Student selects a saved location for horoscope birth details
- **Description**: As a student, I want to pick a location from the saved locations database instead of calling an external geocoding API so that the horoscope creation flow is faster and uses curated data.
- **Acceptance Criteria**:
  - Location field in the horoscope form shows a dropdown/selector of saved locations
  - Dropdown includes all public locations and the student's own private locations
  - Selecting a location auto-populates Lat/Lon fields from the saved data
  - Student can override Lat/Lon values manually after selection
  - Location reference (ID) is stored on the horoscope record
  - If no saved locations exist, prompt the student to add one first
- **Priority**: High
- **Actor**: Student
