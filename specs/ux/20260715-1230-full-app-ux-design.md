# Kendara — Full App UX Design

**Date:** 2026-07-15 12:30
**Author:** UX (BMAD)
**Based on:** specs/business-analysis/actors.md, specs/business-analysis/data-model.md, specs/business-analysis/20260714-1255-user-stories.md, specs/architecture/overview.md, specs/architecture/20260715-0746-architecture-spec.md, docs/spec.md

---

## Overview

This document provides comprehensive, page-by-page UX design for the Kendara astrology study app. Every screen is described with wireframe layouts, component inventories, state variations, interaction behaviors, and responsive adaptations.

### Design Principles

1. **Bilingual first** — Every UI element must render correctly in both Sinhala and English
2. **Progressive disclosure** — Show summary first, let users drill into detail
3. **Keyboard-friendly** — All core flows completable without a mouse
4. **Instant feedback** — Every action produces visible results within 300ms
5. **Empty states guide** — No dead ends; every empty state includes a call to action

---

## Page 1: Sign-In (`/signin`)

### Purpose
Authenticate the user via Google SSO.

### Wireframe

```
┌─────────────────────────────────────────────────────┐
│  [Logo: Kendara]                    [EN | සිං]      │
├─────────────────────────────────────────────────────┤
│                                                     │
│              ┌─────────────────────┐                │
│              │                     │                │
│              │    ✦ Kendara ✦      │                │
│              │                     │                │
│              │  Vedic Astrology    │                │
│              │  Study Platform     │                │
│              │                     │                │
│              │  ┌─────────────────┐│                │
│              │  │ G  Sign in with ││                │
│              │  │    Google       ││                │
│              │  └─────────────────┘│                │
│              │                     │                │
│              │  By signing in, you │                │
│              │  agree to our terms  │                │
│              └─────────────────────┘                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Elements

| Element | Type | Details |
|---------|------|---------|
| Logo | Image + Text | "Kendara" wordmark |
| Language Switcher | Toggle | EN / සිං — positioned top-right |
| Google Sign-In Button | Button | Standard Google branding, full-width within card |
| Terms text | Paragraph | Small, secondary text color |

### States

| State | Behavior |
|-------|----------|
| Default | Button enabled, ready to click |
| Loading | Button shows spinner, text changes to "Signing in..." / "පිවිසෙමින්..." |
| Error | Error banner below button: "Sign-in failed. Please try again." / "පිවිසීම අසාර්ථක විය. නැවත උත්සාහ කරන්න." |
| Already signed in | Redirect to dashboard immediately |

### Interactions
- Click Google button → Google OAuth popup/redirect
- Language switcher changes button text and terms text
- After successful auth → redirect to `/` (Dashboard)

### Responsive
- Mobile: Card takes full width with 16px padding
- Desktop: Card centered, max-width 400px

---

## Page 2: Dashboard (`/`)

### Purpose
Show the user's horoscopes and provide quick access to core actions.

### Wireframe

```
┌─────────────────────────────────────────────────────────────┐
│  [Logo: Kendara]  [🔍 Search horoscopes...]  [EN|සිං] [👤] │
├──────────┬──────────────────────────────────────────────────┤
│ Sidebar  │  Dashboard                                       │
│          │                                                  │
│ ● මුල්   │  Welcome back, [Name]! 👋                        │
│   පිටුව │                                                  │
│          │  ┌──────────────┐ ┌──────────────┐               │
│ ● ලග්න  │  │ Total        │ │ This Month   │               │
│   එකතු │  │ Horoscopes   │ │ Added        │               │
│          │  │     42       │ │      7       │               │
│ ● නව    │  └──────────────┘ └──────────────┘               │
│   ලග්න │                                                  │
│          │  [ + Add New Horoscope ]                         │
│ ● සොයන │                                                  │
│          │  Recent Horoscopes                               │
│ ● සැකසුම්│  ┌────────────────────────────────────────────┐  │
│          │  │ 📋 Ravi Kumar     1990-01-15  Colombo      │  │
│          │  │    Aries Ascendant  |  Public               │  │
│          │  │────────────────────────────────────────────│  │
│          │  │ 📋 Sunitha Perera  1985-06-20  Kandy       │  │
│          │  │    Leo Ascendant    |  Private              │  │
│          │  │────────────────────────────────────────────│  │
│          │  │ 📋 Chaminda Silva  1992-11-03  Galle       │  │
│          │  │    Scorpio Asc.     |  Public               │  │
│          │  └────────────────────────────────────────────┘  │
│          │                                                  │
│          │  [View All Horoscopes →]                         │
└──────────┴──────────────────────────────────────────────────┘
```

### Elements

| Element | Type | Details |
|---------|------|---------|
| Global Search Bar | Input | Placeholder: "Search horoscopes..." / "ලග්න සොයන්න..." |
| Language Switcher | Toggle | EN / සිං |
| User Avatar Menu | Dropdown | Profile, Settings, Sign Out |
| Stats Cards | Card | 2-column grid: total count, monthly count |
| Add Button | CTA Button | Primary, with plus icon |
| Horoscope List | Table/Cards | Name, date, location, ascendant, visibility |
| View All Link | Text Link | Navigates to full list |

### States

| State | Behavior |
|-------|----------|
| Loading | Skeleton cards (3 pulsing placeholders) |
| Empty | "No horoscopes yet" with Add button |
| Has data | Stats + recent horoscopes list |
| Error | Error banner: "Failed to load horoscopes" |

### Horoscope List Item

```
┌────────────────────────────────────────────────────┐
│  [Avatar/Icon]  Ravi Kumar                         │
│                1990-01-15  06:30 AM                │
│                Colombo, Sri Lanka                  │
│                Aries Ascendant (12.5°)             │
│                                                    │
│  [Public]  [Edit]  [Share]  [⋮]                    │
└────────────────────────────────────────────────────┘
```

### Interactions
- Click horoscope row → navigate to `/horoscopes/[id]`
- Click Edit → navigate to `/horoscopes/[id]/edit`
- Click Share → opens Share Modal
- Click ⋮ → context menu (Download PDF, Delete, Toggle Privacy)
- Click global search → navigates to `/search` with query prefilled

### Responsive
- Mobile: Sidebar → bottom tab bar, stats stack vertically, list items full-width cards
- Tablet: Stats 2-column, list items as cards
- Desktop: Stats 2-column, list items as table rows

---

## Page 3: Add Horoscope (`/horoscopes/new`)

### Purpose
Input birth details to create a new horoscope.

### Wireframe

```
┌─────────────────────────────────────────────────────────────┐
│  [← Back]  Add New Horoscope / නව ලග්නයක් එකතු කරන්න     │
├──────────┬──────────────────────────────────────────────────┤
│ Sidebar  │                                                  │
│          │  ┌─── Birth Details ──────────────────────────┐  │
│          │  │                                            │  │
│          │  │  Name *                                    │  │
│          │  │  ┌──────────────────────────────────────┐  │  │
│          │  │  │                                      │  │  │
│          │  │  └──────────────────────────────────────┘  │  │
│          │  │                                            │  │
│          │  │  Birth Date *          Birth Time *        │  │
│          │  │  ┌──────────────┐     ┌──────────────┐    │  │
│          │  │  │ 1990-01-15   │     │ 06:30 AM     │    │  │
│          │  │  └──────────────┘     └──────────────┘    │  │
│          │  │                                            │  │
│          │  │  Location *                                │  │
│          │  │  ┌──────────────────────────────────────┐  │  │
│          │  │  │ 🔍 Colombo...                         │  │  │
│          │  │  │ ┌────────────────────────────────┐    │  │  │
│          │  │  │ │ Colombo, Sri Lanka             │    │  │  │
│          │  │  │ │ Colombo District               │    │  │  │
│          │  │  │ └────────────────────────────────┘    │  │  │
│          │  │  └──────────────────────────────────────┘  │  │
│          │  │                                            │  │
│          │  │  Latitude *             Longitude *        │  │
│          │  │  ┌──────────────┐     ┌──────────────┐    │  │
│          │  │  │ 6.9271       │     │ 79.8612      │    │  │
│          │  │  └──────────────┘     └──────────────┘    │  │
│          │  │  (Auto-filled from location — editable)   │  │
│          │  │                                            │  │
│          │  │  Gender *                                  │  │
│          │  │  ┌──────┐ ┌────────┐ ┌───────┐            │  │
│          │  │  │ Male │ │ Female │ │ Other │            │  │
│          │  │  └──────┘ └────────┘ └───────┘            │  │
│          │  │                                            │  │
│          │  │  Ayanamsha *                               │  │
│          │  │  ┌────────────────────────────────────┐    │  │
│          │  │  │ Lahiri (default)              ▾    │    │  │
│          │  │  └────────────────────────────────────┘    │  │
│          │  │                                            │  │
│          │  │  Visibility                                │  │
│          │  │  ○ Private  ● Public                       │  │
│          │  │                                            │  │
│          │  │  Show Name in Public                       │  │
│          │  │  [Toggle]                                  │  │
│          │  │                                            │  │
│          │  │  ┌──────────────────────────────────────┐  │  │
│          │  │  │     Calculate & Save Horoscope       │  │  │
│          │  │  └──────────────────────────────────────┘  │  │
│          │  └────────────────────────────────────────────┘  │
│          │                                                  │
└──────────┴──────────────────────────────────────────────────┘
```

### Elements

| Element | Type | Props/Details |
|---------|------|---------------|
| Name Input | Text | Required, placeholder: "Person's name" / "පුද්ගලයාගේ නම" |
| Birth Date | Date Picker | Required, format: YYYY-MM-DD |
| Birth Time | Time Picker | Required, 12-hour with AM/PM |
| Location | Autocomplete | Required, geocodes on selection, shows suggestions |
| Latitude | Number Input | Auto-populated, editable, step=0.0001 |
| Longitude | Number Input | Auto-populated, editable, step=0.0001 |
| Gender | Radio Group | Male/Female/Other, button-style radios |
| Ayanamsha | Select | Lahiri (default), Raman, Krishnamurti, Yukteshwar |
| Visibility | Radio Group | Private/Public |
| Show Name | Toggle | Only visible when Public selected |
| Submit Button | CTA | Full-width, primary color |

### States

| State | Behavior |
|-------|----------|
| Default | All fields empty, Submit disabled |
| Validating | Inline errors below invalid fields |
| Location searching | Spinner in location field, Lat/Lon show "Locating..." |
| Location found | Lat/Lon auto-filled, green checkmark |
| Location not found | Error: "Location not found. Enter coordinates manually." |
| Submitting | Button spinner + "Calculating..." text, form disabled |
| Success | Redirect to `/horoscopes/[id]` with success toast |
| Error | Error banner at top: "Failed to save. Please check inputs." |
| Calculation error | Error: "Unable to calculate. Verify birth details." |

### Location Autocomplete Behavior
- Debounce: 300ms after typing stops
- Show dropdown with suggestions below input
- On selection: auto-fill Lat/Lon, show green checkmark
- On clear: reset Lat/Lon fields
- Max suggestions: 5

### Form Validation

| Field | Rule | Error Message (EN) | Error Message (SI) |
|-------|------|--------------------|--------------------|
| Name | Required, 1-200 chars | "Name is required" | "නම අවශ්‍යයි" |
| Birth Date | Required, valid date | "Valid date required" | "වලංගු දිනයක් අවශ්‍යයි" |
| Birth Time | Required | "Time is required" | "වේලාව අවශ්‍යයි" |
| Location | Required | "Location is required" | "ස්ථානය අවශ්‍යයි" |
| Latitude | Required, -90 to 90 | "Invalid latitude" | "අවලංගු අක්ෂාංශ" |
| Longitude | Required, -180 to 180 | "Invalid longitude" | "අවලංගු දේශාංශ" |

---

## Page 4: Horoscope Detail (`/horoscopes/[id]`)

### Purpose
Display all calculated details, charts, and metadata for a single horoscope.

### Wireframe

```
┌─────────────────────────────────────────────────────────────┐
│  [← Back]  Ravi Kumar's Horoscope    [Edit] [Share] [Export]│
├──────────┬──────────────────────────────────────────────────┤
│ Sidebar  │  ┌─── Summary ─────────────────────────────────┐│
│          │  │  Born: 1990-01-15, 06:30 AM                 ││
│          │  │  Location: Colombo (6.9271°N, 79.8612°E)    ││
│          │  │  Ascendant: Aries (Mesh) 12.5°              ││
│          │  │  Moon: Cancer (Kataka) — Pushya Nakshatra   ││
│          │  │  [Public]  [3 Labels]                        ││
│          │  └─────────────────────────────────────────────┘│
│          │                                                  │
│          │  ┌─── Tabs ───────────────────────────────────┐│
│          │  │ [Charts] [Calculations] [Dashas] [Metadata]││
│          │  └────────────────────────────────────────────┘│
│          │                                                  │
│          │  ┌─── Charts Tab (active) ────────────────────┐│
│          │  │                                            ││
│          │  │  Chart Type Selector:                      ││
│          │  │  [Birth] [House] [Navamsa] [Drekkana]     ││
│          │  │  [Dasamsa] [Vargas] [Chandra] [Surya]     ││
│          │  │                                            ││
│          │  │  ┌──────────────────────────────────────┐  ││
│          │  │  │                                      │  ││
│          │  │  │         Birth Chart (Rasi)           │  ││
│          │  │  │                                      │  ││
│          │  │  │    ┌───┬───┬───┐                     │  ││
│          │  │  │    │12 │ 1 │ 2 │                     │  ││
│          │  │  │    ├───┼───┼───┤                     │  ││
│          │  │  │    │11 │   │ 3 │                     │  ││
│          │  │  │    ├───┤ ☉ ├───┤  ← Sun in house 1  │  ││
│          │  │  │    │10 │   │ 4 │                     │  ││
│          │  │  │    ├───┼───┼───┤                     │  ││
│          │  │  │    │ 9 │ 8 │ 5 │                     │  ││
│          │  │  │    │   │   │ 6 │ 7 │                 │  ││
│          │  │  │    └───┴───┴───┘                     │  ││
│          │  │  │                                      │  ││
│          │  │  │  [Zoom In] [Zoom Out] [Download]     │  ││
│          │  │  └──────────────────────────────────────┘  ││
│          │  │                                            ││
│          │  │  Planet Summary:                           ││
│          │  │  ☉ Sun 12.5° Aries (H1)  🔥 Uchcha       ││
│          │  │  ☽ Moon 5.0° Cancer (H4)  💧 Own Sign     ││
│          │  │  ♂ Mars 28.3° Scorpio (H8)  💧 Exalted    ││
│          │  │  ☿ Mercury 15.2° Gemini (H3)  🌬 Friend   ││
│          │  │  ♃ Jupiter 8.7° Libra (H7)  🌬 Enemy      ││
│          │  │  ♀ Venus 22.1° Virgo (H6)  🌍 Neutral     ││
│          │  │  ♄ Saturn 14.8° Aquarius (H11) 🌬 Own Sign ││
│          │  │  ☊ Rahu 5.3° Pisces (H12)                  ││
│          │  │  ☋ Ketu 5.3° Virgo (H6)                    ││
│          │  └────────────────────────────────────────────┘│
│          │                                                  │
└──────────┴──────────────────────────────────────────────────┘
```

### Tab: Calculations

```
┌─── Calculations Tab ──────────────────────────────────────┐
│                                                           │
│  ┌─── Planetary Strengths ───────────────────────────┐    │
│  │  Planet      | Sign      | Strength | Status      │    │
│  │  Sun         | Aries     | 1.0      | Uchcha 🔼   │    │
│  │  Moon        | Cancer    | 0.5      | Own Sign    │    │
│  │  Mars        | Scorpio   | 0.5      | Own Sign    │    │
│  │  Mercury     | Gemini    | 0.5      | Own Sign    │    │
│  │  Jupiter     | Libra     | -0.1     | Shatru 🔽   │    │
│  │  Venus       | Virgo     | -0.1     | Shatru 🔽   │    │
│  │  Saturn      | Aquarius  | 0.5      | Own Sign    │    │
│  └───────────────────────────────────────────────────┘    │
│                                                           │
│  ┌─── Aspects ───────────────────────────────────────┐    │
│  │  Sun → Mercury: Sextile (60°) gap 2.5° ✅        │    │
│  │  Sun → Saturn: Opposition (180°) gap 0.0° ⚠️      │    │
│  │  Mars → Jupiter: Square (90°) gap 5.2° ⚠️        │    │
│  └───────────────────────────────────────────────────┘    │
│                                                           │
│  ┌─── Special Values ────────────────────────────────┐    │
│  │  Lord of 22nd Drekkana: Mars                      │    │
│  │  Lord of 64th Navamsa: Venus                      │    │
│  │  Badhaka Planet: Saturn                           │    │
│  │  Maraka Planets: Saturn, Venus, Mars              │    │
│  │  Atmakaraka: Sun                                  │    │
│  └───────────────────────────────────────────────────┘    │
│                                                           │
│  ┌─── Yogas ─────────────────────────────────────────┐    │
│  │  ✅ Parivartana Yoga — Mutual exchange (H1↔H5)   │    │
│  │  ✅ Dharma-karmadhipati Yoga — H1 & H9 lords     │    │
│  │  ⚠️ Kemadruma Yoga — No planets near Moon        │    │
│  └───────────────────────────────────────────────────┘    │
│                                                           │
│  ┌─── Doshas ────────────────────────────────────────┐    │
│  │  ⚠️ Manglik Dosha — Mars in H1, H7 (Medium)      │    │
│  │  ✅ No Sadesati currently                         │    │
│  └───────────────────────────────────────────────────┘    │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### Tab: Dashas

```
┌─── Dashas Tab ────────────────────────────────────────────┐
│                                                           │
│  Current Period: Jupiter Mahadasha / Venus Antardasha     │
│                                                           │
│  ┌─── Mahadasha Timeline ────────────────────────────┐    │
│  │  ┌──────────────────────────────────────────────┐  │    │
│  │  │ Saturn  │ Jupiter    │ Rahu       │ Ketu     │  │    │
│  │  │1984-2003│ 2003-2019  │ 2019-2037  │ 2037-2054│  │    │
│  │  │         │ ◄─current─►│            │          │  │    │
│  │  └──────────────────────────────────────────────┘  │    │
│  └───────────────────────────────────────────────────┘    │
│                                                           │
│  Jupiter Mahadasha (2003-2019):                          │
│  ┌─────────────────────────────────────────────────┐     │
│  │ Jupiter-Venus:    2017-05 to 2019-11  ◄ current │     │
│  │ Jupiter-Sun:      2019-11 to 2020-09            │     │
│  │ Jupiter-Moon:     2020-09 to 2022-01            │     │
│  │ Jupiter-Mars:     2022-01 to 2022-12            │     │
│  │ Jupiter-Rahu:     2022-12 to 2025-08            │     │
│  │ Jupiter-Jupiter:  2025-08 to 2027-11            │     │
│  │ Jupiter-Saturn:   2027-11 to 2030-06            │     │
│  │ Jupiter-Mercury:  2030-06 to 2033-03            │     │
│  │ Jupiter-Ketu:     2033-03 to 2034-11            │     │
│  └─────────────────────────────────────────────────┘     │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### Tab: Metadata

```
┌─── Metadata Tab ──────────────────────────────────────────┐
│                                                           │
│  [+ Add Metadata]                                         │
│                                                           │
│  ┌─── Personal Labels ──────────────────────────────┐    │
│  │  Key          | Value         | Visibility | Actions│    │
│  │  job          | Engineer      | Private    | ✏️ 🗑️  │    │
│  │  children     | 2             | Private    | ✏️ 🗑️  │    │
│  │  skills       | Programming   | Public     | ✏️ 🗑️  │    │
│  └───────────────────────────────────────────────────┘    │
│                                                           │
│  ┌─── System Calculated ────────────────────────────┐    │
│  │  (Read-only)                                      │    │
│  │  Parivartana Yoga         | ✅ Present            │    │
│  │  Manglik Dosha            | ⚠️ Medium             │    │
│  │  Atmakaraka               | Sun                   │    │
│  └───────────────────────────────────────────────────┘    │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### Add Metadata Modal

```
┌─── Add Metadata ───────────────────────┐
│                                        │
│  Key *                                 │
│  ┌──────────────────────────────────┐  │
│  │ e.g., job, children, skills     │  │
│  └──────────────────────────────────┘  │
│                                        │
│  Value *                               │
│  ┌──────────────────────────────────┐  │
│  │                                  │  │
│  └──────────────────────────────────┘  │
│                                        │
│  Visibility                             │
│  ○ Private  ● Public                   │
│                                        │
│  ┌──────────┐  ┌──────────┐           │
│  │  Cancel  │  │   Save   │           │
│  └──────────┘  └──────────┘           │
└────────────────────────────────────────┘
```

### Chart Component Design

| Property | Value |
|----------|-------|
| Renderer | D3.js SVG |
| Min size | 280×280px |
| Default size | 400×400px |
| Max size | 600×600px |
| Zodiac colors | Fire=#EF4444, Earth=#10B981, Air=#3B82F6, Water=#8B5CF6 |
| Planet symbols | Unicode astrological glyphs |
| House labels | 1-12 numeric |
| Aspect lines | Solid=beneficial, Dashed=challenging |

### Chart Type Selector

| Type | English | Sinhala | Short Label |
|------|---------|---------|-------------|
| birth | Birth Chart | උපත් සටහන | Rasi |
| house | House Chart | භාව සටහන | Bhava |
| navamsa-d9 | Navamsa (D9) | නවාංශ (D9) | D9 |
| drekkana-d3 | Drekkana (D3) | ද්‍රෙෂ්කාණ (D3) | D3 |
| dasamsa-d10 | Dasamsa (D10) | දශම්ස (D10) | D10 |
| shodasha-vargas | Shodasha Vargas | ෂෝෂ වර්ග | 16 Vargas |
| chandra-lagna | Chandra Lagna | චන්ද්‍ර ලග්න | Chandra |
| surya-lagna | Surya Lagna | සූර්‍ය ලග්න | Surya |

### States

| State | Behavior |
|-------|----------|
| Loading | Skeleton for each tab content area |
| Calculating (new) | Progress bar with "Calculating horoscope details..." |
| Error | Error card with retry button |
| Not found | 404 page with "Horoscope not found" |

---

## Page 5: Search (`/search`)

### Purpose
Natural language search across all accessible horoscopes.

### Wireframe

```
┌─────────────────────────────────────────────────────────────┐
│  [← Back]  Search Horoscopes / ලග්න සොයන්න                │
├──────────┬──────────────────────────────────────────────────┤
│ Sidebar  │                                                  │
│          │  ┌─── Search Input ─────────────────────────┐   │
│          │  │  🔍                                       │   │
│          │  │  ┌──────────────────────────────────────┐ │   │
│          │  │  │ මේෂ ලග්නයේ ශනි උච්චව              │ │   │
│          │  │  └──────────────────────────────────────┘ │   │
│          │  │                                            │   │
│          │  │  Suggestions:                              │   │
│          │  │  💡 "Aries Ascendant with Saturn exalted"  │   │
│          │  │  💡 "Jupiter in 3rd house"                 │   │
│          │  │  💡 "Parivartana yoga present"             │   │
│          │  │                                            │   │
│          │  │  [Search]  [Save Filter]  [Load Filter ▾]  │   │
│          │  └────────────────────────────────────────────┘  │
│          │                                                  │
│          │  ┌─── Config Panel ─────────────────────────┐   │
│          │  │  Visible Sections:                        │   │
│          │  │  ✅ Birth Chart      ☐ House Chart       │   │
│          │  │  ✅ Navamsa D9       ☐ Drekkana D3       │   │
│          │  │  ☐ Dasamsa D10      ☐ Shodasha Vargas   │   │
│          │  │  ☐ Chandra Lagna    ☐ Surya Lagna       │   │
│          │  │  ✅ Planetary Strengths                   │   │
│          │  │  ☐ Aspects                                 │   │
│          │  │  ✅ Yogas                                  │   │
│          │  │  ☐ Doshas                                  │   │
│          │  │  ───────────────────────────────────────  │   │
│          │  │  [Select All]  [Deselect All]  [Apply]    │   │
│          │  └────────────────────────────────────────────┘  │
│          │                                                  │
│          │  ┌─── Results ──────────────────────────────┐   │
│          │  │  Found 12 horoscopes (showing 1-5)       │   │
│          │  │                                           │   │
│          │  │  ┌─ Result 1 ──────────────────────────┐ │   │
│          │  │  │ ★★★★★  Ravi Kumar                    │ │   │
│          │  │  │ Score: 98% match                     │ │   │
│          │  │  │ ☉ Aries Ascendant  ♄ Saturn Exalted  │ │   │
│          │  │  │ 📊 Birth Chart thumbnail             │ │   │
│          │  │  │ [View Full] [Labels: job, skills]    │ │   │
│          │  │  └──────────────────────────────────────┘ │   │
│          │  │                                           │   │
│          │  │  ┌─ Result 2 ──────────────────────────┐ │   │
│          │  │  │ ★★★★☆  Sunitha Perera                │ │   │
│          │  │  │ Score: 85% match                     │ │   │
│          │  │  │ ☉ Aries Ascendant  ♄ Saturn Exalted  │ │   │
│          │  │  │ 📊 Birth Chart thumbnail             │ │   │
│          │  │  │ [View Full] [Labels: children]       │ │   │
│          │  │  └──────────────────────────────────────┘ │   │
│          │  │                                           │   │
│          │  │  [← Previous]  Page 1 of 3  [Next →]     │   │
│          │  └───────────────────────────────────────────┘  │
│          │                                                  │
└──────────┴──────────────────────────────────────────────────┘
```

### Search Input Component

| Property | Value |
|----------|-------|
| Type | Textarea (auto-resize, max 3 lines) |
| Min height | 48px |
| Max height | 120px |
| Debounce | 500ms after typing stops (for suggestions) |
| Enter key | Submit search |
| Shift+Enter | New line |
| Placeholder (EN) | "Search horoscopes using natural language..." |
| Placeholder (SI) | "ස්වාභාවික භාෂාවෙන් ලග්න සොයන්න..." |

### Search Suggestions
- Shown below input as user types
- 3-5 suggestions based on common query patterns
- Click suggestion → fills input and triggers search
- Suggestions rotate based on popular queries

### Config Panel (Toggle Visibility)

| Section | Default | Toggleable |
|---------|---------|------------|
| Birth Chart | ✅ | Yes |
| House Chart | ☐ | Yes |
| Navamsa D9 | ✅ | Yes |
| Drekkana D3 | ☐ | Yes |
| Dasamsa D10 | ☐ | Yes |
| Shodasha Vargas | ☐ | Yes |
| Chandra Lagna | ☐ | Yes |
| Surya Lagna | ☐ | Yes |
| Planetary Strengths | ✅ | Yes |
| Aspects | ☐ | Yes |
| Yogas | ✅ | Yes |
| Doshas | ☐ | Yes |

### Result Card

```
┌──────────────────────────────────────────────────┐
│  [★★★★★]  Score: 98% match                      │
│                                                  │
│  Ravi Kumar                                      │
│  Born: 1990-01-15, 06:30 AM                     │
│  Location: Colombo                               │
│                                                  │
│  Key Findings:                                   │
│  • Aries Ascendant (12.5°)                       │
│  • Saturn Exalted in Libra (H7)                  │
│  • Parivartana Yoga present                      │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Birth    │  │ Navamsa  │  │ ...more  │       │
│  │ Chart    │  │ D9       │  │          │       │
│  │ [thumb]  │  │ [thumb]  │  │          │       │
│  └──────────┘  └──────────┘  └──────────┘       │
│                                                  │
│  Labels: [job: Engineer] [skills: Programming]   │
│                                                  │
│  [View Full Horoscope →]                         │
└──────────────────────────────────────────────────┘
```

### States

| State | Behavior |
|-------|----------|
| Empty query | Show suggestion chips and popular searches |
| Searching | Skeleton results (3 cards) with typing indicator |
| No results | "No horoscopes match your query. Try adjusting your search." |
| Results found | Result cards with relevance scores |
| Error | "Search failed. Please try again." with retry |
| Rate limited | "Too many searches. Please wait X seconds." |
| Loading config save | Spinner on "Save" button |

---

## Page 6: Horoscope Edit (`/horoscopes/[id]/edit`)

### Purpose
Edit birth details of an existing horoscope.

### Wireframe

```
┌─────────────────────────────────────────────────────────────┐
│  [← Back]  Edit Horoscope / ලග්නය සංස්කරණය               │
├──────────┬──────────────────────────────────────────────────┤
│ Sidebar  │                                                  │
│          │  Same form as Add Horoscope (Page 3)             │
│          │  Pre-filled with existing data                   │
│          │                                                  │
│          │  ⚠️ Warning: Editing will recalculate            │
│          │  all horoscope details and charts.               │
│          │                                                  │
│          │  [Cancel]  [Save & Recalculate]                  │
│          │                                                  │
└──────────┴──────────────────────────────────────────────────┘
```

### States

| State | Behavior |
|-------|----------|
| Loading | Skeleton form |
| Dirty | "Unsaved changes" warning on browser back |
| Submitting | "Recalculating..." with progress |
| Success | Redirect to detail page with success toast |

---

## Page 7: Saved Filters (`/search/filters`)

### Purpose
Manage saved search filter configurations.

### Wireframe

```
┌─────────────────────────────────────────────────────────────┐
│  [← Back]  Saved Filters / සුරැකුම් පෙරහන්                │
├──────────┬──────────────────────────────────────────────────┤
│ Sidebar  │                                                  │
│          │  Saved Filters                                   │
│          │                                                  │
│          │  ┌────────────────────────────────────────────┐  │
│          │  │ 🔍 "මේෂ ලග්නයේ ශනි උච්ච"               │  │
│          │  │    Config: Birth Chart, Navamsa, Yogas     │  │
│          │  │    Saved: 2026-07-10                       │  │
│          │  │    [Use] [Edit Name] [Delete]              │  │
│          │  │────────────────────────────────────────────│  │
│          │  │ 🔍 "ගුරු 3 භාවයේ"                          │  │
│          │  │    Config: All charts, Strengths           │  │
│          │  │    Saved: 2026-07-05                       │  │
│          │  │    [Use] [Edit Name] [Delete]              │  │
│          │  └────────────────────────────────────────────┘  │
│          │                                                  │
└──────────┴──────────────────────────────────────────────────┘
```

---

## Page 8: Settings (`/settings`)

### Purpose
User preferences and account settings.

### Wireframe

```
┌─────────────────────────────────────────────────────────────┐
│  [← Back]  Settings / සැකසුම්                               │
├──────────┬──────────────────────────────────────────────────┤
│ Sidebar  │                                                  │
│          │  ┌─── Profile ──────────────────────────────┐   │
│          │  │  [Avatar]  Ravi Kumar                     │   │
│          │  │           ravi@email.com                  │   │
│          │  │           Role: Student                   │   │
│          │  └──────────────────────────────────────────┘   │
│          │                                                  │
│          │  ┌─── Preferences ──────────────────────────┐   │
│          │  │                                           │   │
│          │  │  Language                                  │   │
│          │  │  ○ English  ● Sinhala                      │   │
│          │  │                                           │   │
│          │  │  Default Ayanamsha                         │   │
│          │  │  [Lahiri ▾]                                │   │
│          │  │                                           │   │
│          │  │  Default Chart Visibility                  │   │
│          │  │  [Configure...]                            │   │
│          │  │                                           │   │
│          │  └──────────────────────────────────────────┘   │
│          │                                                  │
└──────────┴──────────────────────────────────────────────────┘
```

---

## Page 9: Shared Horoscope (`/share/[token]`)

### Purpose
View a shared private horoscope via temporary link.

### Wireframe

```
┌─────────────────────────────────────────────────────────────┐
│  [Logo: Kendara]                    [EN | සිං]              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ℹ️ This horoscope was shared with you.              │   │
│  │  Link expires: 2026-07-20 12:30 AM                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─── Horoscope Detail (read-only) ───────────────────┐   │
│  │  Same layout as Horoscope Detail (Page 4)           │   │
│  │  BUT: No Edit, Share, Export, Metadata tabs          │   │
│  │  Only: Charts + Calculations tabs visible            │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### States

| State | Behavior |
|-------|----------|
| Valid token | Show horoscope (read-only) |
| Expired token | "This share link has expired." with explanation |
| Invalid token | "Invalid or revoked share link." |
| Loading | Skeleton page |

---

## Page 10: Admin Dashboard (`/admin`)

### Purpose
Super Admin manages all horoscopes and users.

### Wireframe

```
┌─────────────────────────────────────────────────────────────┐
│  [← Back]  Admin Dashboard / පරිපාලක උපකරණ පුවරුව        │
├──────────┬──────────────────────────────────────────────────┤
│ Sidebar  │                                                  │
│ (admin)  │  ┌─── Stats ────────────────────────────────┐   │
│          │  │  Total Users: 156  |  Total Horoscopes: 2,847│
│          │  │  Public: 1,203  |  Private: 1,644         │   │
│          │  └──────────────────────────────────────────┘   │
│          │                                                  │
│          │  Tabs: [Horoscopes] [Users]                      │
│          │                                                  │
│          │  ┌─── Horoscopes Tab ──────────────────────┐    │
│          │  │  Filter: [All ▾] [Owner ▾] [Search...]   │    │
│          │  │                                          │    │
│          │  │  ┌─────┬──────────┬────────┬──────┬────┐ │    │
│          │  │  │Name │ Owner    │ Date   │ Vis. │ Act│ │    │
│          │  │  ├─────┼──────────┼────────┼──────┼────┤ │    │
│          │  │  │Ravi │ Ravi K.  │1990-01 │ Pub  │ ✏️🗑│ │    │
│          │  │  │Sun. │ Sunitha  │1985-06 │ Priv │ ✏️  │ │    │
│          │  │  └─────┴──────────┴────────┴──────┴────┘ │    │
│          │  │  [← Prev] Page 1 of 57 [Next →]          │    │
│          │  └───────────────────────────────────────────┘    │
│          │                                                  │
│          │  ┌─── Users Tab ────────────────────────────┐   │
│          │  │  ┌─────┬──────────┬────────┬────────────┐ │   │
│          │  │  │Name │ Email    │ Role   │ Status     │ │   │
│          │  │  ├─────┼──────────┼────────┼────────────┤ │   │
│          │  │  │Ravi │ r@em.    │Student │ Active [▾] │ │   │
│          │  │  │Admin│ a@em.    │Admin   │ Active [▾] │ │   │
│          │  │  └─────┴──────────┴────────┴────────────┘ │   │
│          │  └──────────────────────────────────────────┘   │
│          │                                                  │
└──────────┴──────────────────────────────────────────────────┘
```

---

## Component Design

### HoroscopeCard

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | Person's name |
| `birthDate` | string | Formatted birth date |
| `location` | string | Location name |
| `ascendant` | string | Ascendant sign + degree |
| `isPublic` | boolean | Visibility badge |
| `ownerName` | string | Owner name (admin view) |
| `onClick` | function | Navigate to detail |
| `onEdit` | function | Navigate to edit |
| `onShare` | function | Open share modal |
| `onDelete` | function | Delete confirmation |
| `onTogglePrivacy` | function | Toggle public/private |
| `variant` | 'default' \| 'compact' \| 'admin' | Display variant |

### ChartViewer

| Property | Type | Description |
|----------|------|-------------|
| `chartType` | ChartType | Which chart to render |
| `data` | object | Chart data JSON |
| `size` | 'sm' \| 'md' \| 'lg' | Display size |
| `interactive` | boolean | Enable zoom/pan |
| `showPlanetSummary` | boolean | Show planet table below |
| `onDownload` | function | Export chart as image |
| `language` | 'si' \| 'en' | Label language |

### SearchBar

| Property | Type | Description |
|----------|------|-------------|
| `value` | string | Current query text |
| `onChange` | function | Text change handler |
| `onSearch` | function | Submit handler |
| `onSaveFilter` | function | Save current query |
| `suggestions` | string[] | Auto-suggestions |
| `isLoading` | boolean | Show loading indicator |
| `placeholder` | string | Localized placeholder |

### ConfigPanel

| Property | Type | Description |
|----------|------|-------------|
| `visibleSections` | object | Map of section → boolean |
| `onChange` | function | Toggle handler |
| `onApply` | function | Apply config |
| `onSelectAll` | function | Select all sections |
| `onDeselectAll` | function | Deselect all |
| `variant` | 'sidebar' \| 'drawer' \| 'modal' | Display variant |

### MetadataEditor

| Property | Type | Description |
|----------|------|-------------|
| `metadata` | Metadata[] | List of metadata items |
| `onAdd` | function | Add new metadata |
| `onUpdate` | function | Update existing |
| `onDelete` | function | Remove metadata |
| `onToggleVisibility` | function | Toggle public/private |
| `isReadOnly` | boolean | Disable editing |

---

## Export/Share UI Patterns

### Share Modal

```
┌─── Share Horoscope ─────────────────────────────┐
│                                                  │
│  Generate a temporary link to share this         │
│  horoscope with others.                          │
│                                                  │
│  Link Expiration:                                │
│  ┌────────────────────────────────────┐          │
│  │ [24 hours ▾]                       │          │
│  └────────────────────────────────────┘          │
│  Options: 24h, 48h, 7 days, 30 days, Custom     │
│                                                  │
│  ┌──────────────────────────────────────┐        │
│  │ https://kendara.app/share/abc123...  │        │
│  │                              [Copy]  │        │
│  └──────────────────────────────────────┘        │
│                                                  │
│  Active Links: 1                                 │
│  ┌──────────────────────────────────────┐        │
│  │ 🔗 Link 1 — Expires Jul 20  [Revoke]│        │
│  └──────────────────────────────────────┘        │
│                                                  │
│  [Close]                                         │
└──────────────────────────────────────────────────┘
```

### Export Modal

```
┌─── Export Horoscope ────────────────────────────┐
│                                                  │
│  Choose export format:                           │
│                                                  │
│  ┌──────────────────┐  ┌──────────────────┐     │
│  │  📄 PDF          │  │  🖼️ Image        │     │
│  │  Full report     │  │  Chart only      │     │
│  │  with all visible│  │  PNG format      │     │
│  │  sections        │  │                  │     │
│  │                  │  │  Chart Type:     │     │
│  │                  │  │  [Birth ▾]       │     │
│  └──────────────────┘  └──────────────────┘     │
│                                                  │
│  Include in PDF:                                 │
│  ☐ Birth details    ☐ Charts                     │
│  ☐ Calculations     ☐ Dashas                     │
│  ☐ Yogas            ☐ Metadata                   │
│                                                  │
│  [Cancel]  [Download]                            │
└──────────────────────────────────────────────────┘
```

---

## Language Switching UX

### Language Switcher Component

```
┌──────────────────┐
│  EN  │  සිං       │
│  ─── │  ───       │
└──────────────────┘
```

### Behavior
- Toggle between English and Sinhala
- Applies immediately to all visible text
- Saves preference to user profile (persisted)
- Remembers across sessions
- Astrological terms update: planet names, sign names, nakshatra names
- Chart labels update (planet symbols remain universal)
- Search placeholder updates
- Error messages update
- Date format: remains YYYY-MM-DD (universal) or locale-specific if preferred

### Bilingual Content Map

| Element | English | Sinhala |
|---------|---------|---------|
| Nav: Dashboard | Dashboard | මුල් පිටුව |
| Nav: My Horoscopes | My Horoscopes | මගේ ලග්න |
| Nav: Add Horoscope | Add Horoscope | නව ලග්න |
| Nav: Search | Search | සොයන්න |
| Nav: Saved Filters | Saved Filters | සුරැකුම් පෙරහන් |
| Nav: Settings | Settings | සැකසුම් |
| Nav: Locations | Locations | ස්ථාන |
| Nav: Admin | Admin | පරිපාලක |
| Nav: Add Location | Add Location | ස්ථානයක් එකතු කරන්න |
| Nav: Edit Location | Edit Location | ස්ථානය සංස්කරණය |
| Button: Save | Save | සුරකින්න |
| Button: Cancel | Cancel | අවලංගු |
| Button: Delete | Delete | මකන්න |
| Button: Edit | Edit | සංස්කරණය |
| Button: Search | Search | සොයන්න |
| Button: Export | Export | අපනයනය |
| Button: Share | Share | බෙදාගන්න |
| Label: Required | Required | අවශ්‍යයි |
| Status: Public | Public | පොදු |
| Status: Private | Private | පුද්ගලික |
| Error: Not found | Not found | සොයාගත නොහැක |
| Loading: Calculating | Calculating... | ගණනය කරමින් |
| Loading: Locating | Locating... | ස්ථානගත කරමින්... |
| Loading: Validating CSV | Validating... | වලංගු කරමින්... |
| Loading: Saving location | Saving location... | ස්ථානය සුරකිමින්... |
| Success: Saved | Saved successfully | සාර්ථකව සුරැකිණි |
| Status: Location | Location | ස්ථානය |
| Field: Latitude | Latitude | අක්ෂාංශ |
| Field: Longitude | Longitude | දේශාංශ |
| Field: Location Name | Location Name | ස්ථානයේ නම |
| Toggle: Public | Public | පොදු |
| Toggle: Private | Private | පුද්ගලික |
| Action: Add Location | Add Location | ස්ථානයක් එකතු කරන්න |
| Action: Edit Location | Edit | සංස්කරණය |
| Action: Delete Location | Delete | මකන්න |
| Action: Search Locations | Search locations... | ස්ථාන සොයන්න... |
| Action: Paste CSV | Paste CSV | CSV පාඨය අලවන්න |
| Action: Search by name | Search by name | නමෙන් සොයන්න |
| Hint: CSV format | Enter latitude,longitude (e.g., 6.9271,79.8612) | අක්ෂාංශ,දේශාංශ ඇතුළත් කරන්න (උදා: 6.9271,79.8612) |
| Empty: No locations | No saved locations yet. Add your first one! | තවම සුරැකි ස්ථාන නැත. ඔබේ පළමු ස්ථානය එකතු කරන්න! |
| Badge: Public | Public | පොදු |
| Badge: Private | Private | පුද්ගලික |
| Group: Public Locations | Public Locations | පොදු ස්ථාන |
| Group: My Locations | My Locations | මගේ ස්ථාන |
| Option: Add new location | + Add new location... | + නව ස්ථානයක් එකතු කරන්න... |
| Confirm: Delete location | Delete this location? | මෙම ස්ථානය මකන්නද? |
| Confirm: Delete body | This action cannot be undone. Horoscopes using this location will keep their current data. | මෙම ක්‍රියාව ආපසු හැරවිය නොහැක. මෙම ස්ථානය භාවිතා කරන ලග්නවල දත්ත එලෙසම පවතී. |

---

## Error States & Recovery

### Error Banner

```
┌─── Error ──────────────────────────────────────┐
│  ⚠️ Failed to load horoscope details.          │
│     Please try again.                           │
│                                                 │
│  [Retry]  [Go to Dashboard]                     │
└─────────────────────────────────────────────────┘
```

### Error Types

| Error | Title (EN) | Title (SI) | Recovery Action |
|-------|-----------|------------|-----------------|
| Network | "Connection lost" | "සම්බන්ධතාවය නැත" | Auto-retry, manual retry button |
| Auth | "Session expired" | "සැසිය කල් ඉකුත් විය" | Redirect to sign-in |
| Validation | "Invalid input" | "අවලංගු ආදානය" | Highlight invalid fields |
| Calculation | "Calculation failed" | "ගණනය කිරීම අසාර්ථකයි" | Check birth data |
| 404 | "Not found" | "සොයාගත නොහැක" | Go to dashboard |
| Rate limit | "Too many requests" | "ඉල්ලීම් බොහෝ වැඩියි" | Wait and retry |
| Server | "Something went wrong" | "යමක් වැරදී ඇත" | Retry, contact support |

---

## Loading States & Skeleton Screens

### Skeleton Patterns

| Context | Pattern |
|---------|---------|
| Page load | Full page skeleton matching layout |
| List items | 3-5 skeleton cards with pulsing animation |
| Charts | Square outline with pulsing fill |
| Forms | Input field skeletons with labels |
| Search results | Result card skeletons with star placeholders |

### Skeleton Animation
- Animation: `pulse` (opacity 0.4 → 1 → 0.4, 1.5s infinite)
- Color: `var(--surface-elevated)` with slight border
- Duration per pulse: 1.5 seconds
- Transition: Fade in when real content loads (200ms)

### Progress Indicators

| Task | Indicator |
|------|-----------|
| Horoscope calculation | Linear progress bar: "Calculating horoscope..." / "ලග්නය ගණනය කරමින්..." |
| Chart generation | Spinner: "Generating charts..." / "සටහන් සාදමින්..." |
| Search | Inline spinner in search bar |
| PDF export | Progress bar: "Generating PDF..." / "PDF සාදමින්..." |
| Embedding (background) | Toast: "Horoscope indexing in background..." / "බ්‍රැක්ග්‍රවුන්ඩ් ඉන්ඩෙක්සිං..." |

---

## Micro-interactions

### Transitions

| Element | Property | Duration | Easing |
|---------|----------|----------|--------|
| Page navigation | opacity | 150ms | ease-in-out |
| Sidebar collapse | width | 200ms | ease-out |
| Modal open | opacity + transform | 200ms | ease-out |
| Modal close | opacity + transform | 150ms | ease-in |
| Tooltip show | opacity | 100ms | ease-out |
| Card hover | box-shadow | 150ms | ease-out |
| Button press | transform | 50ms | ease-out |
| Tab switch | opacity | 150ms | ease-in-out |
| Chart type switch | crossfade | 200ms | ease-in-out |
| Toast enter | transform + opacity | 300ms | spring |
| Toast exit | opacity | 200ms | ease-in |

### Hover Effects

| Element | Effect |
|---------|--------|
| Horoscope card | Subtle shadow elevation (`0 4px 12px rgba(0,0,0,0.1)`) |
| Button | Background darken 10%, cursor pointer |
| Icon button | Background tint, tooltip |
| Chart thumbnail | Border color change to primary |
| Search suggestion | Background tint |
| Config checkbox | Scale(1.05) on check |

### Feedback Patterns

| Action | Feedback |
|--------|----------|
| Form submit | Button spinner → success toast → redirect |
| Copy to clipboard | Toast: "Copied!" / "පිටපත් කළා!" |
| Delete | Confirmation modal → delete → toast |
| Toggle privacy | Immediate badge change + toast |
| Add metadata | Inline add animation → toast |
| Search | Results fade in |
| Save filter | Toast: "Filter saved!" / "පෙරහන සුරැකිණි!" |
| Language switch | All text crossfade (no page reload) |

---

## File Index

| File | Description |
|------|-------------|
| `specs/ux/main-ux-spec.md` | Master UX reference — design system, navigation, flows |
| `specs/ux/20260715-1230-full-app-ux-design.md` | This document — detailed page-by-page UX spec |
