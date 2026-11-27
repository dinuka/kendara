# Kendara — Location Management UX Design

**Date:** 2026-07-18 21:45
**Author:** UX (BMAD)
**Based on:** specs/ux/main-ux-spec.md, specs/ux/20260715-1230-full-app-ux-design.md, specs/architecture/20260718-2145-location-management-architecture.md, specs/business-analysis/20260718-1400-location-management.md

---

## Overview

This document defines the UX for Kendara's Location Management feature, which allows students to save, organize, and reuse geographic locations for horoscope birth details. The feature covers a dedicated location management page, add/edit forms with geocoding and CSV paste, a picker component for horoscope form integration, and privacy controls.

### Design Goals

1. **Dual-input parity** — Geocoding search and CSV paste are equally accessible, no mode hidden
2. **Privacy clarity** — Public/private badge differences are immediately obvious
3. **Edit independence** — Clear visual cues that editing a location does not cascade to horoscopes
4. **Bilingual** — All labels, errors, and empty states in Sinhala and English
5. **Progressive disclosure** — Location list shows summary info; details visible on hover/tap

---

## Page 1: Location Management (`/locations`)

### Purpose
Browse, search, add, edit, and delete saved locations in one place.

### Wireframe — Desktop

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Logo: Kendara]  [🔍 Search horoscopes...]  [EN|සිං]  [👤]       │
├──────────┬──────────────────────────────────────────────────────────┤
│ Sidebar  │  Locations / ස්ථාන                                       │
│          │                                                            │
│ ● මුල්   │  ┌─── Search & Add ──────────────────────────────────────┐│
│   පිටුව │  │                                                       ││
│          │  │  [🔍 Search locations...       ]  [+ Add Location]    ││
│ ● ලග්න  │  └───────────────────────────────────────────────────────┘│
│   එකතු │                                                            │
│          │  ┌─── Location List ────────────────────────────────────┐ │
│ ● නව    │  │                                                     │ │
│   ලග්න │  │  ┌──────┬──────────────┬──────────┬────────┬──────┐ │ │
│          │  │  │ Name │ Coordinates  │ Added    │ Vis.   │      │ │ │
│ ● සොයන │  │  ├──────┼──────────────┼──────────┼────────┼──────┤ │ │
│          │  │  │ 📍   │ 6.9271,     │ 2026-07- │ 🌐    │ ✏️ 🗑️ │ │ │
│ ● ස්ථාන │  │  │ Col- │ 79.8612     │ 18       │ Public │ │  │ │ │
│          │  │  │ ombo │              │          │        │ │  │ │ │
│ ● සැකසුම්│  │  ├──────┼──────────────┼──────────┼────────┼──────┤ │ │
│          │  │  │ 📍   │ 7.2906,     │ 2026-07- │ 🔒    │ ✏️ 🗑️ │ │ │
│ ● සුරැකුම්│ │  │ Kandy│ 80.6337     │ 17       │ Private│ │  │ │ │
│   පෙරහන් │  │  ├──────┼──────────────┼──────────┼────────┼──────┤ │ │
│          │  │  │ 📍   │ -33.8688,   │ 2026-07- │ 🌐    │ ✏️ 🗑️ │ │ │
│ ● සැකසුම්│  │  │ Syd- │ 151.2093    │ 15       │ Public │ │  │ │ │
│          │  │  │ ney  │              │          │        │ │  │ │ │
│          │  │  └──────┴──────────────┴──────────┴────────┴──────┘ │ │
│          │  │                                                     │ │
│          │  │  [← Previous]  Page 1 of 3  [Next →]               │ │
│          │  └────────────────────────────────────────────────────┘ │ │
│          │                                                           │
└──────────┴──────────────────────────────────────────────────────────┘
```

### Wireframe — Mobile

```
┌─────────────────────────────────────┐
│  [← Back]  Locations / ස්ථාන       │
├─────────────────────────────────────┤
│                                     │
│  [🔍 Search locations...       ]   │
│                                     │
│  [+ Add Location]                   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 📍 Colombo, Sri Lanka       │   │
│  │ 6.9271, 79.8612             │   │
│  │ 🌐 Public   Added Jul 18    │   │
│  │                     [✏️ 🗑️] │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 📍 Kandy, Sri Lanka         │   │
│  │ 7.2906, 80.6337             │   │
│  │ 🔒 Private  Added Jul 17    │   │
│  │                     [✏️ 🗑️] │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 📍 Sydney, Australia        │   │
│  │ -33.8688, 151.2093          │   │
│  │ 🌐 Public   Added Jul 15    │   │
│  │                     [✏️ 🗑️] │   │
│  └─────────────────────────────┘   │
│                                     │
│  [← Prev]  Page 1 of 3  [Next →]   │
└─────────────────────────────────────┘
```

### Elements

| Element | Type | Details |
|---------|------|---------|
| Page Title | H1 | "Locations" / "ස්ථාන" |
| Search Input | Text | Placeholder: "Search locations..." / "ස්ථාන සොයන්න...", debounce 300ms |
| Add Button | CTA | Icon + "Add Location" / "ස්ථානයක් එකතු කරන්න", primary color |
| Location Table/Cards | List | Name, coordinates, date added, visibility badge, actions |
| Visibility Badge | Tag | Globe icon + "Public" for public, Lock icon + "Private" for private |
| Edit Button | Icon | Pencil icon, only visible on user's own locations |
| Delete Button | Icon | Trash icon, only visible on user's own locations |
| Pagination | Nav | Previous/Next + page indicator |
| Location Icon | Icon | Map pin emoji/icon before location name |

### States

| State | Behavior |
|-------|----------|
| Loading | Skeleton table (3-5 rows of pulsing placeholders) |
| Empty | "No saved locations yet. Add your first one!" / "තවම සුරැකි ස්ථාන නැත. ඔබේ පළමු ස්ථානය එකතු කරන්න!" with "Add Location" CTA |
| Loaded | Location list with pagination |
| Search active | Filtered results; "No locations match your search." if none found |
| Error | Error banner: "Failed to load locations. Please try again." with retry button |
| Deleting | Spinner on delete icon; row fades out on success |

### Interactions
- Click search input → filters list client-side (or via `?search=` param)
- Click "Add Location" → navigate to `/locations/new`
- Click Edit (pencil) → navigate to `/locations/[id]/edit`
- Click Delete (trash) → confirmation modal → DELETE → row removed + success toast
- Click location row → (future) view location detail or no action
- Click pagination → fetch next/prev page
- Click globe/lock badge → (future) tooltip explaining visibility

### Responsive

| View | Layout |
|------|--------|
| Desktop (>= 1024px) | Sidebar visible, table layout with columns |
| Tablet (640-1024px) | Collapsible sidebar, table with horizontal scroll or card layout |
| Mobile (< 640px) | Stacked cards, full-width action buttons, search full-width |

---

## Page 2: Add Location (`/locations/new`)

### Purpose
Create a new saved location using either geocoding autocomplete or CSV lat/lon paste.

### Wireframe — Desktop

```
┌─────────────────────────────────────────────────────────────────────┐
│  [← Back to Locations]  Add Location / ස්ථානයක් එකතු කරන්න        │
├──────────┬──────────────────────────────────────────────────────────┤
│ Sidebar  │                                                          │
│          │  ┌─── Add Location ───────────────────────────────────┐ │
│          │  │                                                    │ │
│          │  │  ┌─── Input Mode ────────────────────────────────┐ │ │
│          │  │  │  [● Search by name]  [○ Paste CSV]            │ │ │
│          │  │  └───────────────────────────────────────────────┘ │ │
│          │  │                                                    │ │
│          │  │  ┌─── Search Mode (default) ─────────────────────┐ │ │
│          │  │  │                                                │ │ │
│          │  │  │  Search for a place                             │ │ │
│          │  │  │  ┌──────────────────────────────────────────┐  │ │ │
│          │  │  │  │ 🔍 Type a location name...               │  │ │ │
│          │  │  │  └──────────────────────────────────────────┘  │ │ │
│          │  │  │                                                │ │ │
│          │  │  │  Suggestions (from Nominatim):                  │ │ │
│          │  │  │  ┌──────────────────────────────────────────┐  │ │ │
│          │  │  │  │ 📍 Colombo, Sri Lanka                     │  │ │ │
│          │  │  │  │ 📍 Colombo District, Sri Lanka            │  │ │ │
│          │  │  │  │ 📍 Colombo Municipal Council, Sri Lanka   │  │ │ │
│          │  │  │  │ 📍 Colombo 01, Sri Lanka                  │  │ │ │
│          │  │  │  │ 📍 Colombo 02, Sri Lanka                  │  │ │ │
│          │  │  │  └──────────────────────────────────────────┘  │ │ │
│          │  │  └────────────────────────────────────────────────┘ │ │
│          │  │                                                    │ │
│          │  │  ┌─── CSV Mode (alternate) ──────────────────────┐ │ │
│          │  │  │                                                │ │ │
│          │  │  │  Paste coordinates                              │ │ │
│          │  │  │  ┌──────────────────────────────────────────┐  │ │ │
│          │  │  │  │ 6.9271,79.8612                           │  │ │ │
│          │  │  │  └──────────────────────────────────────────┘  │ │ │
│          │  │  │  Expected format: latitude,longitude            │ │ │
│          │  │  │  e.g. 6.9271,79.8612                           │ │ │
│          │  │  │                                                │ │ │
│          │  │  │  [Parse & Preview]                             │ │ │
│          │  │  │                                                │ │ │
│          │  │  │  ┌─── Preview ───────────────────────────┐     │ │ │
│          │  │  │  │  ✅ Latitude: 6.9271                   │     │ │ │
│          │  │  │  │  ✅ Longitude: 79.8612                 │     │ │ │
│          │  │  │  └────────────────────────────────────────┘     │ │ │
│          │  │  └────────────────────────────────────────────────┘ │ │
│          │  │                                                    │ │
│          │  │  ┌─── Details ───────────────────────────────────┐ │ │
│          │  │  │                                                │ │ │
│          │  │  │  Location Name *                               │ │ │
│          │  │  │  ┌──────────────────────────────────────────┐  │ │ │
│          │  │  │  │ Colombo, Sri Lanka                       │  │ │ │
│          │  │  │  └──────────────────────────────────────────┘  │ │ │
│          │  │  │                                                │ │ │
│          │  │  │  Latitude *             Longitude *            │ │ │
│          │  │  │  ┌────────────────┐     ┌────────────────┐    │ │ │
│          │  │  │  │ 6.9271         │     │ 79.8612        │    │ │ │
│          │  │  │  └────────────────┘     └────────────────┘    │ │ │
│          │  │  │                                                │ │ │
│          │  │  │  Visibility                                    │ │ │
│          │  │  │  [🔒 Private]  [🌐 Public]                     │ │ │
│          │  │  │  (Private by default)                          │ │ │
│          │  │  │                                                │ │ │
│          │  │  │  ┌──────────┐  ┌──────────────────────┐       │ │ │
│          │  │  │  │  Cancel  │  │   Save Location      │       │ │ │
│          │  │  │  └──────────┘  └──────────────────────┘       │ │ │
│          │  │  └────────────────────────────────────────────────┘ │ │
│          │  └────────────────────────────────────────────────────┘ │
│          │                                                          │
└──────────┴──────────────────────────────────────────────────────────┘
```

### Wireframe — Mobile (slide-up sheet)

```
┌─────────────────────────────────────┐
│  ← Add Location / ස්ථානයක්        │
│     එකතු කරන්න                     │
├─────────────────────────────────────┤
│                                     │
│  Input Mode:                        │
│  [● Search by name] [○ Paste CSV]   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 🔍 Type a location name... │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─ Suggestions ───────────────┐   │
│  │ 📍 Colombo, Sri Lanka       │   │
│  │ 📍 Kandy, Sri Lanka         │   │
│  │ 📍 Galle, Sri Lanka         │   │
│  └─────────────────────────────┘   │
│                                     │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                     │
│  Location Name *                    │
│  ┌─────────────────────────────┐   │
│  │ Colombo, Sri Lanka          │   │
│  └─────────────────────────────┘   │
│                                     │
│  Latitude *    Longitude *          │
│  ┌─────────┐  ┌─────────┐          │
│  │ 6.9271  │  │ 79.8612 │          │
│  └─────────┘  └─────────┘          │
│                                     │
│  Visibility                         │
│  [🔒 Private]  [🌐 Public]           │
│                                     │
│  [Cancel]  [Save Location]          │
└─────────────────────────────────────┘
```

### Elements

| Element | Type | Details |
|---------|------|---------|
| Back Link | Text | Navigate to `/locations` |
| Page Title | H1 | "Add Location" / "ස්ථානයක් එකතු කරන්න" |
| Mode Toggle | Segmented Control | "Search by name" / "Paste CSV" — mutually exclusive |
| Search Input (Search mode) | Autocomplete | Debounce 300ms, fetches Nominatim suggestions |
| Suggestions Dropdown | List | Up to 5 suggestions, click to select |
| CSV Input (CSV mode) | Text | Accepts "lat,lon" format, validates inline |
| Parse Button (CSV mode) | Button | "Parse & Preview" / "විග්‍රහ කරන්න", runs client-side validation |
| Preview Panel (CSV mode) | Panel | Shows parsed lat/lon with validation status per field |
| Name Input | Text | Required, trimmed, pre-filled from geocoding selection |
| Latitude Input | Number | Required, -90 to 90, step 0.0001 |
| Longitude Input | Number | Required, -180 to 180, step 0.0001 |
| Visibility Toggle | Toggle Group | Private (default, lock icon) / Public (globe icon) |
| Cancel Button | Secondary | Navigate back, discard changes |
| Save Button | Primary | "Save Location" / "ස්ථානය සුරකින්න" |

### States

| State | Behavior |
|-------|----------|
| Default (Search mode) | Search input empty, suggestions hidden, name/lat/lon empty, Save disabled |
| Searching | Spinner in search input, "Searching..." / "සොයමින්..." |
| Suggestions visible | Dropdown shows up to 5 results, keyboard navigable (arrow keys, enter) |
| Suggestion selected | Name auto-filled, lat/lon auto-filled, green checkmark appears |
| Default (CSV mode) | CSV input empty, Preview hidden, lat/lon empty |
| CSV parsing | "Validating..." / "වලංගු කරමින්..." on parse button |
| CSV valid | Preview shows ✅ lat + ✅ lon, fields auto-filled, parse button changes to "Parsed ✓" |
| CSV invalid | Preview shows ❌ with error message, fields remain empty, parse button re-enabled |
| Name empty | Red border on save attempt, "Name is required" |
| Lat/Lon out of range | Inline error: "Latitude must be between -90 and 90" |
| Saving | Button spinner + "Saving..." / "සුරකිමින්..." text, form disabled |
| Success | Toast: "Location saved!" / "ස්ථානය සුරැකිණි!" → redirect to `/locations` |
| Error (server) | Error banner: "Failed to save location. Please try again." |
| Duplicate | Warning: "A location with similar coordinates already exists." |

### Interactions
- Mode toggle switches between Search and CSV input; lat/lon fields reset on switch
- In Search mode: type → debounce 300ms → fetch Nominatim → show dropdown
- Dropdown suggestion click → fill name + lat/lon → hide dropdown
- In CSV mode: paste text → click "Parse & Preview" → validate → show preview
- After parsing CSV: lat/lon auto-filled, Name field must be entered manually
- Lat/Lon fields editable in both modes (user can fine-tune after selection/parse)
- Visibility toggles independently at any time
- Cancel with unsaved changes → confirmation: "Discard changes?" / "වෙනස්කම් අවලංගු කරන්නද?"
- Save button disabled until all required fields valid

### Form Validation

| Field | Rule | Error (EN) | Error (SI) |
|-------|------|-----------|------------|
| Name | Required, 1-200 chars | "Name is required" | "නම අවශ්‍යයි" |
| Latitude | Required, -90 to 90 | "Invalid latitude" | "අවලංගු අක්ෂාංශ" |
| Longitude | Required, -180 to 180 | "Invalid longitude" | "අවලංගු දේශාංශ" |
| CSV Format | Match `^\-?\d+(\.\d+)?,\-?\d+(\.\d+)?$` | "Invalid CSV format. Expected 'latitude,longitude'" | "අවලංගු CSV ආකෘතිය" |

### CSV Validation Algorithm (Client-Side)

```
On "Parse & Preview" click:
  1. Strip whitespace from input
  2. Test pattern: /^\-?\d+(\.\d+)?,\-?\d+(\.\d+)?$/
     → Fail: show ❌ "Invalid format. Use lat,lon (e.g. 6.9271,79.8612)"
  3. Split by comma → parseFloat each part
  4. Check latitude -90..90
     → Fail: show ❌ "Latitude must be between -90 and 90"
  5. Check longitude -180..180
     → Fail: show ❌ "Longitude must be between -180 and 180"
  6. Pass: show ✅ preview → auto-fill lat/lon fields → change button to "Parsed ✓"
```

---

## Page 3: Edit Location (`/locations/[id]/edit`)

### Purpose
Edit an existing saved location's name, coordinates, or visibility.

### Wireframe

Same layout as Add Location (`/locations/new`), with the following differences:

```
┌─────────────────────────────────────────────────────────────────────┐
│  [← Back to Locations]  Edit Location / ස්ථානය සංස්කරණය           │
├──────────┬──────────────────────────────────────────────────────────┤
│ Sidebar  │                                                          │
│          │  ┌─── Edit Location ──────────────────────────────────┐ │
│          │  │                                                    │ │
│          │  │  ┌─── Input Mode ────────────────────────────────┐ │ │
│          │  │  │  [● Search by name]  [○ Paste CSV]            │ │ │
│          │  │  └───────────────────────────────────────────────┘ │ │
│          │  │                                                    │ │
│          │  │  (Same form as Add Location, pre-filled)           │ │
│          │  │                                                    │ │
│          │  │  ⚠️ Editing this location won't affect existing     │ │
│          │  │     horoscopes that use it. Each horoscope keeps   │ │
│          │  │     its own copy of the name and coordinates.      │ │
│          │  │                                                    │ │
│          │  │  [Cancel]  [Save Changes]                          │ │
│          │  └────────────────────────────────────────────────────┘ │
│          │                                                          │
└──────────┴──────────────────────────────────────────────────────────┘
```

### Differences from Add Location

| Aspect | Add Location | Edit Location |
|--------|-------------|---------------|
| Title | "Add Location" | "Edit Location" |
| Name | Pre-filled from geocoding or empty | Pre-filled from saved location |
| Lat/Lon | Auto-filled from geocoding/CSV | Pre-filled from saved location |
| Visibility | Defaults to Private | Set to current saved value |
| Save button | "Save Location" | "Save Changes" / "වෙනස්කම් සුරකින්න" |
| Warning banner | None | ⚠️ Edit independence notice |
| Cancel behavior | Go back (discard if empty) | Go back (confirm if dirty) |

### States

| State | Behavior |
|-------|----------|
| Loading | Skeleton form (same layout) |
| Pre-filled | All fields populated with current data |
| Dirty | One or more fields changed from saved values |
| Saving | Button spinner + "Saving..." / "සුරකිමින්..." |
| Success | Toast: "Location updated!" / "ස්ථානය යාවත්කාලීන කළා!" → redirect to `/locations` |
| Error | Error banner: "Failed to update location. Please try again." |

---

## Component: LocationPicker

### Purpose
A searchable dropdown component used in the Horoscope Form to select a saved location from the database.

### Wireframe — Dropdown (Closed)

```
Location *
┌──────────────────────────────────────────────┐
│  📍 Select a saved location...           ▾  │
└──────────────────────────────────────────────┘
```

### Wireframe — Dropdown (Open)

```
┌──────────────────────────────────────────────┐
│  🔍 Search locations...                      │
├──────────────────────────────────────────────┤
│  ─── Public Locations ───                    │
│  📍 🌐 Colombo, Sri Lanka                   │
│  📍 🌐 Kandy, Sri Lanka                     │
│  📍 🌐 Galle, Sri Lanka                     │
│                                              │
│  ─── My Locations ───                       │
│  📍 🔒 My Home                              │
│  📍 🔒 Office                               │
│                                              │
│  ➕ Add new location...                      │
└──────────────────────────────────────────────┘
```

### Wireframe — After Selection

```
Location *
┌──────────────────────────────────────────────┐
│  📍 Colombo, Sri Lanka              [Change]│
└──────────────────────────────────────────────┘

Location Name (cached)
┌──────────────────────────────────────────────┐
│  Colombo, Sri Lanka                          │
└──────────────────────────────────────────────┘

Latitude *             Longitude *
┌──────────────────┐  ┌──────────────────┐
│ 6.9271           │  │ 79.8612          │
└──────────────────┘  └──────────────────┘
(Overrides — editable independently)
```

### Props

| Prop | Type | Description |
|------|------|-------------|
| `selectedLocationId` | `string \| null` | Currently selected location ID |
| `onChange` | `(location: { id: string; name: string; latitude: number; longitude: number } \| null) => void` | Selection handler |
| `disabled` | `boolean` | Disable the picker (form submitting state) |

### States

| State | Behavior |
|-------|----------|
| Loading | Skeleton placeholder: 2 pulsing lines with dropdown chevron |
| Empty | "No saved locations yet." / "තවම සුරැකි ස්ථාන නැත." with "Add Location" button |
| Loaded | Dropdown with grouped options: Public Locations → My Locations |
| Error | Inline error: "Could not load locations." with "Retry" link |
| Search no results | "No locations match your search." with clear search suggestion |
| After selection | Show selected name with "Change" button, lat/lon fields visible below |

### Interactions
- Click dropdown trigger → opens dropdown panel
- Search within dropdown → filters list in real-time (no debounce needed, client-side filter)
- Arrow keys navigate options; Enter selects; Escape closes
- Click "Add new location..." → opens quick-add modal (inline) or navigates to `/locations/new`
- After selection → close dropdown, show selected item with "Change" link
- Click "Change" → re-open dropdown to select a different location
- Clear selection → revert to dropdown trigger state
- After adding location via modal → auto-refresh list and select the new location

### Accessibility
- `role="combobox"` on the trigger
- `aria-expanded` on the trigger
- `role="listbox"` on the dropdown
- `role="option"` on each location item
- `aria-label` on groups: "Public Locations" / "My Locations"
- Keyboard: Tab to focus, Enter/Space to open, Esc to close, Arrow keys to navigate
- Screen reader announces selection when location is chosen

---

## Updated Add Horoscope Page (`/horoscopes/new`)

### Location Section Changes

The Location field in the Add/Edit Horoscope form changes from a free-text geocoding input to the LocationPicker component.

Old wireframe (current):

```
│  Location *                                │
│  ┌──────────────────────────────────────┐  │
│  │ 🔍 Colombo...                         │  │
│  │ ┌────────────────────────────────┐    │  │
│  │ │ Colombo, Sri Lanka             │    │  │
│  │ │ Colombo District               │    │  │
│  │ └────────────────────────────────┘    │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  Latitude *             Longitude *        │
│  ┌──────────────┐     ┌──────────────┐    │
│  │ 6.9271       │     │ 79.8612      │    │
│  └──────────────┘     └──────────────┘    │
```

New wireframe (with LocationPicker):

```
│  Location *                                │
│  ┌──────────────────────────────────────┐  │
│  │ 📍 Select a saved location...     ▾  │  │
│  └──────────────────────────────────────┘  │
│  (or)                                      │
│  ┌──────────────────────────────────────┐  │
│  │ 📍 Colombo, Sri Lanka     [Change]   │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  Location Name (cached)                    │
│  ┌──────────────────────────────────────┐  │
│  │ Colombo, Sri Lanka                   │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  Latitude *             Longitude *        │
│  ┌──────────────┐     ┌──────────────┐    │
│  │ 6.9271       │     │ 79.8612      │    │
│  └──────────────┘     └──────────────┘    │
│                                            │
│  (Koordinat overrides — editable)          │
```

### Behavior Changes

| Aspect | Before | After |
|--------|--------|-------|
| Location input | Free-text geocoding autocomplete (Nominatim) | LocationPicker dropdown (DB-backed) |
| Lat/Lon source | From geocoding API response | From saved Location document |
| Location reference | None (just text coordinates) | `location.id` stored on horoscope |
| Name caching | None | `locationName` cached on horoscope |
| Edit independence | N/A | Editing saved location doesn't cascade |
| Fallback | None (must use geocoding) | If no saved locations, prompts to add one |
| "No locations" state | N/A | Shows "Add Location" button in picker |

### Quick-Add Modal

When user clicks "Add new location..." from the LocationPicker dropdown, a compact modal opens:

```
┌─── Quick Add Location ────────────────────┐
│                                           │
│  Name *                                   │
│  ┌─────────────────────────────────────┐  │
│  │                                     │  │
│  └─────────────────────────────────────┘  │
│                                           │
│  Latitude *        Longitude *            │
│  ┌──────────────┐  ┌──────────────┐       │
│  │              │  │              │       │
│  └──────────────┘  └──────────────┘       │
│                                           │
│  [🔒 Private]  [🌐 Public]                │
│                                           │
│  ┌──────────┐  ┌──────────────────┐       │
│  │  Cancel  │  │  Add & Select    │       │
│  └──────────┘  └──────────────────┘       │
└───────────────────────────────────────────┘
```

- Quick-add modal is a simplified version of the full `/locations/new` form
- No geocoding/CSV toggle — just name + lat/lon inputs
- After save: modal closes, LocationPicker refreshes, new location auto-selected
- On mobile: full-screen slide-up sheet instead of modal

---

## Responsive Adaptations

### Location Management Page (`/locations`)

| Breakpoint | Layout |
|------------|--------|
| < 640px (Mobile) | Stacked cards, search full-width, "Add Location" full-width button beneath search, pagination as "Load More" button or numbered |
| 640-1024px (Tablet) | Cards in 2-column grid or table with horizontal scroll, sidebar collapsible |
| > 1024px (Desktop) | Table layout with fixed sidebar, inline search + add button row |

### Add/Edit Location Form (`/locations/new`, `/locations/[id]/edit`)

| Breakpoint | Layout |
|------------|--------|
| < 640px (Mobile) | Full-width form with stacked inputs, slide-up keyboard handling, suggestions as full-width list |
| 640-1024px (Tablet) | Form max-width 600px centered, side-by-side lat/lon inputs |
| > 1024px (Desktop) | Form max-width 640px, side-by-side lat/lon, inline mode toggle |

### LocationPicker Component

| Breakpoint | Layout |
|------------|--------|
| < 640px (Mobile) | Dropdown opens as bottom sheet (drawer from bottom), full-width, "Add new location" at bottom of sheet |
| >= 640px | Dropdown opens as overlay panel below trigger, max-height 300px with scroll |

---

## i18n Considerations

### All New Components

Every label, placeholder, error message, empty state, tooltip, and badge must render in both English and Sinhala. Key additions to the Bilingual Content Map:

| Key | English | Sinhala |
|-----|---------|---------|
| `nav.locations` | Locations | ස්ථාන |
| `locations.title` | Locations | ස්ථාන |
| `locations.add` | Add Location | ස්ථානයක් එකතු කරන්න |
| `locations.edit` | Edit Location | ස්ථානය සංස්කරණය |
| `locations.search_placeholder` | Search locations... | ස්ථාන සොයන්න... |
| `locations.empty` | No saved locations yet. Add your first one! | තවම සුරැකි ස්ථාන නැත. ඔබේ පළමු ස්ථානය එකතු කරන්න! |
| `locations.search_empty` | No locations match your search. | ඔබේ සෙවුමට ගැළපෙන ස්ථාන නැත. |
| `locations.load_error` | Failed to load locations. Please try again. | ස්ථාන පූරණය කිරීම අසාර්ථකයි. නැවත උත්සාහ කරන්න. |
| `locations.save_error` | Failed to save location. Please try again. | ස්ථානය සුරැකීම අසාර්ථකයි. නැවත උත්සාහ කරන්න. |
| `locations.duplicate` | A location with similar coordinates already exists. | සමාන ඛණ්ඩාංක සහිත ස්ථානයක් දැනටමත් පවතී. |
| `locations.saved` | Location saved! | ස්ථානය සුරැකිණි! |
| `locations.updated` | Location updated! | ස්ථානය යාවත්කාලීන කළා! |
| `locations.deleted` | Location deleted. | ස්ථානය මකා දමන ලදී. |
| `locations.delete_confirm` | Delete this location? | මෙම ස්ථානය මකන්නද? |
| `locations.delete_warning` | This action cannot be undone. Horoscopes using this location will keep their current data. | මෙම ක්‍රියාව ආපසු හැරවිය නොහැක. මෙම ස්ථානය භාවිතා කරන ලග්නවල දත්ත එලෙසම පවතී. |
| `locations.badge_public` | Public | පොදු |
| `locations.badge_private` | Private | පුද්ගලික |
| `locations.coordinates` | Coordinates | ඛණ්ඩාංක |
| `locations.added_date` | Added | එකතු කළ දිනය |
| `locations.edit_independence` | Editing this location won't affect existing horoscopes that use it. | මෙම ස්ථානය සංස්කරණය කිරීමෙන් එය භාවිතා කරන පවතින ලග්නවලට බලපාන්නේ නැත. |
| `location_picker.title` | Location | ස්ථානය |
| `location_picker.placeholder` | Select a saved location... | සුරැකි ස්ථානයක් තෝරන්න... |
| `location_picker.search` | Search locations... | ස්ථාන සොයන්න... |
| `location_picker.change` | Change | වෙනස් කරන්න |
| `location_picker.add_new` | + Add new location... | + නව ස්ථානයක් එකතු කරන්න... |
| `location_picker.empty` | No saved locations yet. | තවම සුරැකි ස්ථාන නැත. |
| `location_picker.group_public` | Public Locations | පොදු ස්ථාන |
| `location_picker.group_mine` | My Locations | මගේ ස්ථාන |
| `location_picker.loading` | Loading locations... | ස්ථාන පූරණය වෙමින්... |
| `location_picker.error` | Could not load locations. | ස්ථාන පූරණය කළ නොහැකි විය. |
| `location_picker.retry` | Retry | නැවත උත්සාහ කරන්න |
| `location_picker.cached_name` | Location Name (cached) | ස්ථානයේ නම (හැඹිලිගත) |
| `location_picker.override_hint` | Coordinates overrides — editable | ඛණ්ඩාංක අභිබවන — සංස්කරණය කළ හැකි |
| `location_form.mode_search` | Search by name | නමෙන් සොයන්න |
| `location_form.mode_csv` | Paste CSV | CSV පාඨය අලවන්න |
| `location_form.search_placeholder` | Type a location name... | ස්ථානයේ නම ඇතුළත් කරන්න... |
| `location_form.csv_placeholder` | Enter latitude,longitude (e.g., 6.9271,79.8612) | අක්ෂාංශ,දේශාංශ ඇතුළත් කරන්න (උදා: 6.9271,79.8612) |
| `location_form.csv_parse` | Parse & Preview | විග්‍රහ කරන්න |
| `location_form.csv_parsed` | Parsed ✓ | විග්‍රහ කළා ✓ |
| `location_form.csv_invalid` | Invalid CSV format. Expected 'latitude,longitude' | අවලංගු CSV ආකෘතිය |
| `location_form.latitude` | Latitude | අක්ෂාංශ |
| `location_form.longitude` | Longitude | දේශාංශ |
| `location_form.name` | Location Name | ස්ථානයේ නම |
| `location_form.visibility` | Visibility | දෘශ්‍යතාව |
| `location_form.save` | Save Location | ස්ථානය සුරකින්න |
| `location_form.save_changes` | Save Changes | වෙනස්කම් සුරකින්න |
| `location_form.cancel` | Cancel | අවලංගු කරන්න |
| `location_form.discard` | Discard changes? | වෙනස්කම් අවලංගු කරන්නද? |
| `location_form.saving` | Saving... | සුරකිමින්... |
| `location_form.name_required` | Name is required | නම අවශ්‍යයි |
| `location_form.lat_invalid` | Invalid latitude | අවලංගු අක්ෂාංශ |
| `location_form.lon_invalid` | Invalid longitude | අවලංගු දේශාංශ |
| `quick_add.title` | Quick Add Location | ඉක්මන් ස්ථාන එකතු කිරීම |
| `quick_add.add_and_select` | Add & Select | එකතු කර තෝරන්න |

### Width Accommodation

- Sinhala translations for location-related text are 15-25% wider than English equivalents
- The location name field in the picker should use `min-width: 200px` or truncate with ellipsis
- Badge text ("Public" / "පොදු", "Private" / "පුද්ගලික") should have sufficient padding — the Sinhala "පුද්ගලික" is approximately 60% wider than "Private"
- Table columns with Sinhala headers should allocate extra width (e.g., "ඛණ්ඩාංක" for "Coordinates" is ~80% wider)

---

## Accessibility Considerations

### Location Management Page

- **Search input**: `aria-label="Search locations"` with `aria-live="polite"` for results count
- **Location rows**: Each row is a `<section>` with `aria-label="Location: {name}"` or `<tr>` with proper scope
- **Visibility badges**: Include `aria-label="Public location"` / "Private location" on badge elements
- **Action icons**: Edit/Delete buttons have `aria-label="Edit {name}"` and `aria-label="Delete {name}"`
- **Pagination**: `aria-label="Page {n} of {m}"`, `aria-current="page"` on current page
- **Empty state**: `role="status"` with `aria-live="polite"` to announce when list loads empty
- **Error state**: `role="alert"` on error banner, focus moved to it on error

### Add/Edit Form

- **Mode toggle**: Segmented control with `role="radiogroup"` and `aria-label="Input method"`
- **Search autocomplete**: `role="combobox"` with `aria-expanded`, `aria-autocomplete="list"`
- **Suggestions list**: `role="listbox"` with `aria-label="Location suggestions"`
- **CSV input**: `aria-describedby` linking to format hint text
- **Validation messages**: `aria-live="polite"` on each field's error container
- **Form fields**: All inputs have visible labels and `aria-required="true"` for required fields
- **Save button**: `aria-busy="true"` when saving
- **Edit independence notice**: `<aside>` with `role="note"` and `aria-label` explaining edit independence

### LocationPicker (Dropdown)

- **Trigger button**: `role="combobox"`, `aria-haspopup="listbox"`, `aria-expanded`, `aria-controls`
- **Dropdown list**: `role="listbox"` with `aria-labelledby="location-picker-label"`
- **Options**: `role="option"` with `aria-selected`
- **Groups**: `role="group"` with `aria-label="Public Locations"` / `"My Locations"`
- **"Add new location" option**: `role="option"` with distinct `aria-label`
- **Keyboard**: Tab to enter picker, Enter/Space to open, Arrow keys to navigate options, Enter to select, Escape to close, Tab to move to next field
- **After selection**: Screen reader announces "{name} selected"
- **Empty state**: Announce "No saved locations yet" when list is empty
- **Error state**: Announce "Could not load locations. Retry." with `role="alert"`

### Focus Management

- After opening dropdown → focus moves to search input inside dropdown
- After selecting option → focus returns to trigger button
- After closing dropdown → focus stays on trigger button
- After adding location via quick-add modal → focus returns to picker trigger
- After saving form → focus moves to success toast or page title
- Tab order: Form fields flow top-to-bottom, no unexpected jumps

### Color and Contrast

- Public badge: Green `--success` background at 15% opacity, `--success` text
- Private badge: Gray `--text-secondary` background at 15% opacity, `--text-secondary` text
- Validation success: Green checkmark with `--success` color
- Validation error: Red text with `--error` color, meets 4.5:1 contrast against background
- Focus ring: 2px solid `--primary` with 2px offset on all interactive elements
- Selected dropdown item: `--primary` background at 10% opacity

---

## Micro-interactions

### Location List

| Action | Effect |
|--------|--------|
| Add location | Button ripple → navigate → form appears with fade (150ms) |
| Edit location | Button ripple → navigate → form pre-filled with fade (150ms) |
| Delete location | Confirmation modal slides down (200ms) → confirm → row fades out (300ms) → toast slides in |
| Search | Results filter in real-time with 100ms opacity transition on rows |
| Pagination | New page fades in (150ms), old page fades out |

### Location Picker

| Action | Effect |
|--------|--------|
| Open dropdown | Dropdown slides down (200ms, ease-out) |
| Close dropdown | Dropdown slides up (150ms, ease-in) |
| Select location | Brief highlight flash on selected row (200ms), dropdown closes |
| Search in dropdown | Results filter instantly (no animation, for performance) |
| Hover on option | Background tint transition (100ms) |
| Hover on "Change" | Underline appears (100ms) |

### Form Transitions

| Action | Effect |
|--------|--------|
| Mode toggle | Crossfade between Search and CSV panels (200ms) |
| CSV parse | Preview panel slides down (200ms) |
| Validation error | Red border appears with shake (100ms) |
| Validation success | Green checkmark fades in (150ms) |
| Save button | Text → spinner (no width jump, icon replacement) |

---

## Component Design

### LocationTableRow

| Prop | Type | Description |
|------|------|-------------|
| `location` | `{ id, name, latitude, longitude, isPublic, createdAt, createdBy }` | Location data |
| `isOwner` | `boolean` | Whether current user is the creator |
| `onEdit` | `(id: string) => void` | Edit handler |
| `onDelete` | `(id: string) => void` | Delete handler |
| `language` | `'en' \| 'si'` | Current locale |

### LocationCard (mobile)

Same props as LocationTableRow but renders as a card layout.

### LocationForm

| Prop | Type | Description |
|------|------|-------------|
| `mode` | `'create' \| 'edit'` | Form mode |
| `initialData` | `{ name?, latitude?, longitude?, isPublic? }` | Pre-filled data (edit mode) |
| `locationId` | `string \| null` | Location ID (edit mode) |
| `onSave` | `(data) => void` | Save callback |
| `onCancel` | `() => void` | Cancel callback |
| `language` | `'en' \| 'si'` | Current locale |

### LocationPicker

| Prop | Type | Description |
|------|------|-------------|
| `selectedLocationId` | `string \| null` | Currently selected |
| `onChange` | `(location: \| null) => void` | Selection change |
| `disabled` | `boolean` | Disable component |
| `language` | `'en' \| 'si'` | Current locale |

---

## Error Scenarios

| Error | UI Handling |
|-------|-------------|
| Network failure (list) | Error banner + "Retry" button |
| Network failure (picker) | Inline error + "Retry" link |
| Network failure (form save) | Error banner at form top + keep form data |
| Nominatim rate limit | "Search temporarily unavailable. Try CSV paste or enter coordinates manually." |
| CSV parse failure | Inline error on CSV field with format hint |
| Duplicate location | Warning toast: "A location with similar coordinates already exists." |
| Delete while referenced | No error — horoscope keeps snapshot data; allow deletion with info note |
| Session expired | 401 → redirect to sign-in page |
| Form validation on blur | Inline error below each invalid field |
| Save conflict (stale data) | "Location was modified by another session. Reload and try again." |

---

## File Index

| File | Description |
|------|-------------|
| `specs/ux/main-ux-spec.md` | Master UX reference — design system, navigation, flows |
| `specs/ux/20260715-1230-full-app-ux-design.md` | Full app UX design |
| `specs/ux/20260717-1400-mobile-table-layouts.md` | Mobile responsive table layouts |
| `specs/ux/20260718-2145-location-management-ux.md` | This document — location management UX design |
