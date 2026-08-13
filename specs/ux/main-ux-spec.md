# Kendara — Main UX Specification

**Date:** 2026-07-15 12:30
**Last Updated:** 2026-08-13 (rev: System-Wide Astrology Settings — the three settings (Orbs / Planet Aspects / Rashi Aspects) are now system-wide on the same `/settings` page: super-admin edits + sees version metadata, recalculation progress, and audit/history; students view read-only with a "managed by the administrator" notice; see `specs/ux/20260813-1000-system-astrology-settings.md`)
**Author:** UX (BMAD)
**Based on:** specs/business-analysis/actors.md, specs/business-analysis/data-model.md, specs/business-analysis/20260714-1255-user-stories.md, specs/architecture/overview.md, specs/architecture/20260715-0746-architecture-spec.md, docs/spec.md

---

## Overview

Kendara is a bilingual (Sinhala/English) astrology study web app for students to manage, search, analyze, and share horoscopes. The UX prioritizes:

- **Natural language search** as the core interaction paradigm
- **Bilingual parity** — every element works in both Sinhala and English
- **Progressive disclosure** — complex astrological data shown in layers
- **Study-first design** — metadata, labels, filtering, and export for research workflows

> **Search UX:** The Search Horoscope feature has a dedicated UX spec at `specs/ux/20260727-2100-search-horoscope.md` covering RAG-based natural language search, config panel, result cards, history, saved searches, bookmarks, export, and all associated states/accessibility/responsive behavior. The summary below references that spec for full details.

> **Calculated Horoscope UX:** The Calculated Chart (manual entry) feature has a dedicated UX spec at `specs/ux/20260805-1514-calculated-horoscope.md` covering the mode toggle, house table editor, navamsa editor, live validation badges, derived planets table, probable birth-range derivation, and detail-page integration for `source: "manual"` horoscopes.

> **Planet Aspects UX:** The Planet Aspects houses and degrees (දෘෂ්ඨි) settings feature has a dedicated UX spec at `specs/ux/20260809-2215-planet-aspects.md` covering the per-planet house (1–12) and degree (30–330 step 30) chip selectors, Default-vs-Custom status pills, absolute-vs-offset house semantics, staged save with unsaved-changes indicator, reset-to-defaults, validation rules, and the data-only horoscope detail view updates (planets/houses table aspect columns).

> **System Astrology Settings UX:** The System-Wide Astrology Settings feature (Orbs / Planet Aspects / Rashi Aspects moved to a single system-wide document) has a dedicated UX spec at `specs/ux/20260813-1000-system-astrology-settings.md`. The same `/settings` page serves both roles: **super-admin** edits the three sections (single bulk Save, `version` optimistic lock), sees a metadata strip (version / updated-by / last recalculated), a live recalculation status panel (polling + retry-failed), and collapsible audit-log / recalc-history panels; **students** view the full sections **read-only** with a "managed by the administrator" notice and no edit affordances. Admin metadata is never exposed to students.

---

## Design System

### Color Palette

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `--primary` | `#6366F1` (Indigo) | `#818CF8` | Primary actions, CTAs |
| `--primary-hover` | `#4F46E5` | `#6366F1` | Hover states |
| `--surface` | `#FFFFFF` | `#1E1E2E` | Card backgrounds |
| `--surface-elevated` | `#F8FAFC` | `#2A2A3C` | Elevated panels |
| `--background` | `#F1F5F9` | `#121220` | Page background |
| `--text-primary` | `#0F172A` | `#E2E8F0` | Headings, body |
| `--text-secondary` | `#64748B` | `#94A3B8` | Labels, hints |
| `--border` | `#E2E83F` → `#E2E8F0` | `#334155` | Borders, dividers |
| `--success` | `#10B981` | `#34D399` | Positive feedback |
| `--warning` | `#F59E0B` | `#FBBF24` | Caution states |
| `--error` | `#EF4444` | `#F87171` | Error states |
| `--chart-fire` | `#EF4444` | `#F87171` | Fire signs (Aries, Leo, Sagittarius) |
| `--chart-earth` | `#10B981` | `#34D399` | Earth signs (Taurus, Virgo, Capricorn) |
| `--chart-air` | `#3B82F6` | `#60A5FA` | Air signs (Gemini, Libra, Aquarius) |
| `--chart-water` | `#8B5CF6` | `#A78BFA` | Water signs (Cancer, Scorpio, Pisces) |

### Typography

| Role | Font | Size | Weight | Sinhala Fallback |
|------|------|------|--------|------------------|
| H1 | Inter | 28px | 700 | Noto Sans Sinhala |
| H2 | Inter | 22px | 600 | Noto Sans Sinhala |
| H3 | Inter | 18px | 600 | Noto Sans Sinhala |
| Body | Inter | 14px | 400 | Noto Sans Sinhala |
| Label | Inter | 12px | 500 | Noto Sans Sinhala |
| Monospace | JetBrains Mono | 13px | 400 | — |

### Spacing Scale

`4px` base unit: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 6px | Tags, badges |
| `--radius-md` | 8px | Cards, inputs |
| `--radius-lg` | 12px | Modals, panels |
| `--radius-full` | 9999px | Avatars, pills |

---

## Navigation Structure

### Layout: Authenticated

```
┌─────────────────────────────────────────────────────┐
│  Header                                             │
│  [Logo: Kendara]   [Search Bar (global)]   [Lang]  │
│                                       [Avatar ▾]    │
├──────────┬──────────────────────────────────────────┤
│ Sidebar  │  Main Content Area                       │
│          │                                          │
│ ● මුල්   │                                          │
│   පිටුව │                                          │
│          │                                          │
│ ● ලග්න  │                                          │
│   එකතු │                                          │
│          │                                          │
│ ● නව    │                                          │
│   ලග්න │                                          │
│          │                                          │
│ ● සොයන │                                          │
│          │                                          │
│ ● ස්ථාන │                                          │
│          │                                          │
│ ● සැකසුම්│                                          │
│          │                                          │
├──────────┴──────────────────────────────────────────┤
│  Footer (optional)                                  │
└─────────────────────────────────────────────────────┘
```

**Sidebar Navigation Items:**

| Icon | English | Sinhala | Route |
|------|---------|---------|-------|
| Home | Dashboard | මුල් පිටුව | `/` |
| Book | My Horoscopes | මගේ ලග්න | `/dashboard` |
| Plus | Add Horoscope | නව ලග්න | `/horoscopes/new` |
| Search | Search | සොයන්න | `/search` |
| Bookmark | Saved Filters | සුරැකුම් පෙරහන් | `/search/filters` |
| MapPin | Locations | ස්ථාන | `/locations` |
| Settings | Settings | සැකසුම් | `/settings` |
| Shield | Admin (if admin) | පරිපාලක | `/admin` |

### Layout: Unauthenticated

```
┌─────────────────────────────────────────────────────┐
│  Header                                             │
│  [Logo: Kendara]          [Language Switcher]       │
├─────────────────────────────────────────────────────┤
│                                                     │
│              ┌─────────────────────┐                │
│              │  Kendara Logo       │                │
│              │  "astrology study"  │                │
│              │                     │                │
│              │  [Login with Google]│                │
│              │                     │                │
│              │  Sinhala | English  │                │
│              └─────────────────────┘                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Key User Flows

### Flow 1: Login

```
Landing Page → Click "Login with Google" → Google OAuth →
  → New User? Auto-assign Student role → Dashboard
  → Existing User? → Dashboard
```

### Flow 2: Add Horoscope

```
Dashboard → Click "Add Horoscope" →
  → Choose entry mode (Birth Details | Calculated Chart) →
  → [Birth Details] Fill Form (Name, Date, Time) →
  → Location field shows LocationPicker dropdown (saved locations) →
  → Select location → Name auto-fills → Lat/Lon auto-fill from saved data →
  → Or type to search an existing location →
  → Or click "Add new location..." to open quick-add modal →
  → User can override Lat/Lon fields manually if needed →
  → Submit → Loading spinner ("Calculating...") →
  → Horoscope Detail View (charts + calculations)
  → [Calculated Chart] Enter name + Lagna →
  → Place planets in the derived 12-house table (+ optional Navamsa table) →
  → Derived tables/ranges update live →
  → Submit → POST /api/horoscope/manual →
  → Horoscope Detail View (Calculated Chart badge, editable chart)
```

> Full calculated-chart flow: `specs/ux/20260805-1514-calculated-horoscope.md`

### Flow 3: Search Horoscopes

> Full spec: `specs/ux/20260727-2100-search-horoscope.md`

```
Search Page → Empty state: suggestions + recent history shown →
  → User types natural language query (SI/EN) →
  → Language detected (Unicode U+0D80–U+0DFF) → indicator updates →
  → Debounce 300ms → search fires →
  → Loading skeleton cards appear →
  → Query Understanding Banner shows parsed conditions + confidence →
  → Results render as vertical full-detail cards (all expanded by default) →
  → Each card: Name → Score Badge → Charts (horizontal scroll) → Calculations → Dashas → Yogas → Doshas →
  → User configures visible sections via Config Panel (slide-out desktop / bottom sheet mobile) →
  → Sections toggle ON/OFF instantly across all cards (no re-fetch) →
  → Config persisted to server (POST /api/search/filter, debounced 500ms) →
  → User expands/collapses individual cards (any number simultaneously) →
  → User bookmarks results (🔖 toggle on card) →
  → User saves the search query with name →
  → User paginates (5 per page) →
  → User exports current page as CSV/JSON →
  → Click "Open Full Detail" → Horoscope Detail View
```

**Key search patterns:**

| Pattern | Details |
|---------|---------|
| Search input | Auto-resize textarea, max 500 chars, suggestions on focus when empty |
| Config panel | 19 toggleable sections across Charts, Calculations, Strengths, Yogas, Doshas, Other |
| Result cards | Full-detail vertical cards with lazy-loaded charts (IntersectionObserver) |
| Score badge | Color-tiered: green (80-100%), indigo (60-79%), amber (40-59%), gray (0-39%) |
| Collapse/expand | All cards expanded by default; any number can be expanded; toggle-all button |
| Pagination | 5 results per page, URL-synced (`?page=1&query=...`) |
| History | Last 50 queries, auto-recorded, deduplicated within 5-minute window |
| Saved searches | Max 50, user-named, includes query + config snapshot |
| Bookmarks | Max 100, with optional notes, query context preserved |
| Export | Current page only, CSV or JSON, respects config visibility |
| Query understanding | Banner shows parsed conditions + confidence %; auto-dismiss 8s |

### Flow 4: Edit Metadata

```
Horoscope Detail → Click "Metadata" tab →
  → Add key-value pair (e.g., "job" → "Engineer") →
  → Toggle public/private per item →
  → Save → Success toast
```

### Flow 5: Share Horoscope

```
Horoscope Detail → Click "Share" →
  → Modal: Configure expiration →
  → Generate Link → Copy to clipboard →
  → Success toast "Link copied!"
```

### Flow 6: Export Horoscope

```
Horoscope Detail → Click "Export" →
  → Choose: PDF | Image →
  → PDF: Renders all visible sections → Download
  → Image: Renders chart as PNG → Download
```

### Flow 7: Location Management

```
Sidebar → Click "Locations" → Location Management Page →
  → List shows all public + own private locations →
  → Search/filter by name →
  → Click "+ Add Location" →
    → Toggle: "Search by name" (geocoding autocomplete) or "Paste CSV" (lat,lon) →
    → Fill name, lat/lon (auto or manual), toggle public/private →
    → Save → Location appears in list → Success toast
  → Click Edit on own location → Pre-filled form → Save →
  → Click Delete on own location → Confirmation modal → Confirm → Removed from list → Success toast
  → Paginate through results
```

### Flow 8: Select Location in Horoscope Form

```
Add/Edit Horoscope → Location field →
  → LocationPicker dropdown loads saved locations from DB →
  → Grouped: "Public Locations" section → "My Locations" section →
  → Search within dropdown to filter →
  → Select location → locationName, latitude, longitude auto-filled →
  → User may override lat/lon (independent of saved location) →
  → Submit horoscope → lat/lon/name cached on horoscope document →
  → Future edits to saved location don't cascade to this horoscope
```

### Flow 9: View Dasha Timeline

```
Horoscope Detail → Navigate to Dashas tab/section →
  → Dasha timeline loads from calculatedDetails.dashas →
  → Client detects current date → matches against period date ranges →
  → Summary bar appears: "Current Period" badge chain →
  → Mahadasha list renders as nested accordion →
  → Currently active Mahadasha is auto-expanded → reveals Antardasha periods →
  → Currently active Antardasha is auto-expanded → reveals Vidasa periods →
  → Currently active Vidasa is auto-expanded → reveals Sukshama periods →
  → Currently active Sukshama is auto-expanded → reveals Prana periods (if any) →
  → Active periods highlighted with left-border accent + "Active" badge →
  → User expands/collapses periods at any level to explore →
  → User clicks Current Period badge → scrolls to that period in accordion →
  → Smooth CSS animations on expand/collapse
```

### Flow 10: Toggle Current Planetary Positions on House Chart

```
Horoscope Detail → Navigate to Charts tab → Select House chart →
  → Current Planet Toggle visible below chart (default: OFF) →
  → User clicks toggle to ON →
    → Loading spinner appears next to toggle →
    → API call: GET /api/horoscope/:id/chart/house?includeCurrentPlanets=true →
    → Server computes current planet positions via Swiss Ephemeris →
    → Response includes currentPlanets[] array →
    → Chart re-renders: birth planets (solid) + current planets (outline/stroke, sky blue) →
    → Legend updates to show "Birth Planets" and "Current Planets (transit)" sections →
  → User hovers/taps current planet → tooltip shows detailed info (sign, degree, nakshatra, etc.) →
  → User clicks/taps current planet → expanded info panel →
  → User toggles OFF → overlay hidden instantly (data kept in memory) →
  → Toggle preference persisted to FilterConfig for next session
```

### Flow 11: Toggle Privacy Settings

```
Dashboard / Horoscope Detail → Open privacy settings →
  → Locate PrivacyToggle component →
  → Toggle isPublic (Public/Private) →
    → If Public: displayName toggle slides into view → Toggle show/hide name →
  → Changes saved instantly via PATCH /api/horoscope/:id/privacy →
  → Success toast → UI updates with new privacy badge →
  → If Public→Private: info toast "Removed from search results" →
  → Owner always sees full horoscope and name regardless of settings →
  → Share links remain valid through public→private transitions →
  → Super Admin sees all horoscopes with actual names →
  → Non-owner, non-admin accessing private horoscope detail → 404
```

### Flow 12: Anonymous Name Display

```
Search → Results load →
  → For each result, system checks viewer→horoscope relationship:
    → Viewer is owner? → Show actual name
    → Viewer is not owner AND displayName=true? → Show actual name
    → Viewer is not owner AND displayName=false? → Show anonymous placeholder
  → Placeholder format: "Anonymous Horoscope #A3F2" (from last 4 UUID chars) →
  → Placeholder is stable across sessions for same horoscope →
  → Placeholder is different for each horoscope → distinguishable →
  → Placeholder reveals no PII →
  → Click result → Horoscope Detail →
    → If displayName=false (non-owner): header shows anonymous placeholder →
    → Owner/Admin/Share link recipient: see actual name in detail view
```

### Flow 13: Configure Planet Aspects (දෘෂ්ඨි)

```
Settings → "Planets Aspects houses and degrees" section →
  → All 9 planet rows load from GET /api/settings (planetAspects + planetaryOrbs) →
  → Unconfigured planets show the authoritative 9-planet defaults (gray [Default] pill);
     configured planets show stored values (indigo [Custom] pill) →
  → Expand a planet row (or use the jump-to-planet select on desktop) →
  → Toggle house chips (1–12) and degree chips (30–330 step 30) →
  → Status pill flips Default → Custom; "● Unsaved changes (n planets)" indicator appears →
  → Save →
    → Client validates (every customized planet has ≥1 house and ≥1 degree) →
    → PUT /api/settings { planetAspects: { "1": { houses: [...], degrees: [...] } } } →
    → Success toast + green "Settings saved"; dirty indicator clears →
  → Next horoscope calculation uses the new values; owner-auto detail views re-derive
     planets[].aspects / houses[].aspectingPlanets on refresh (data-only, no chart changes)
```

> Full spec: `specs/ux/20260809-2215-planet-aspects.md`

## Responsive Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | < 640px | Collapsed sidebar (hamburger), single column |
| Tablet | 640px – 1024px | Collapsible sidebar, 2-column grid |
| Desktop | > 1024px | Fixed sidebar, multi-column grid |
| Wide | > 1440px | Extended sidebar, max-width content |

### Mobile Considerations

- Sidebar collapses to bottom tab bar or hamburger menu
- Chart views stack vertically
- Config panel becomes a slide-up sheet
- Search bar moves to top with prominent placement
- Forms use full-width inputs

### Search-Specific Responsive Behavior

> Full spec: `specs/ux/20260727-2100-search-horoscope.md` §15

| Breakpoint | Search Input | Config Panel | Result Cards | Actions Bar | Pagination | Panels |
|------------|-------------|-------------|-------------|-------------|------------|--------|
| Desktop (> 1024px) | Full width within main content | Slide-out from right (320px) | Full width, horizontal chart scroll | Horizontal row with all buttons | Full with page numbers | Dropdown panels |
| Tablet (640-1024px) | Full width | Slide-out (280px) or modal | Full width, horizontal chart scroll | Icons only (labels hidden) | Prev/Next + page numbers | Dropdown panels |
| Mobile (< 640px) | Full width, sticky at top | Slide-up bottom sheet (full width) | Full width, horizontal chart scroll | Horizontal scrollable row, icons only | Prev/Next only (no page numbers) | Slide-up bottom sheets |

**Mobile search-specific adaptations:**
- Charts: min-width 280px, horizontal scroll within card
- Score badge: Compact — just percentage, no label text
- Bookmark icon: 44x44px touch target
- Collapse/expand icon: 44x44px touch target
- Export dropdown: Full-width bottom sheet options

### Bilingual (Sinhala) Considerations

- Sinhala text is typically 15-20% wider than English — use `min-width` on labels
- Sinhala numerals not used — Western numerals for all data
- Sinhala font loading: preload Noto Sans Sinhala weights 400, 600
- RTL not needed — Sinhala is LTR
- Text truncation: Sinhala words are longer, allow 30% more space before ellipsis

---

## Interaction Patterns

### Toast Notifications

| Type | Duration | Usage |
|------|----------|-------|
| Success | 3s | Saved, copied, deleted |
| Error | 5s | Validation, server errors |
| Warning | 4s | Expiring links, rate limits |
| Info | 3s | Background jobs completed |

### Modal Dialogs

- Used for: Share link, Delete confirmation, Export options
- Max width: 480px (mobile: full-width with padding)
- Close: Click outside, X button, Escape key
- Focus trap: First focusable element receives focus

### Current Planetary Positions Toggle

- **Placement**: Below the House chart, above the chart legend
- **Toggle type**: Pill-style on/off switch with label text
- **Label (EN)**: "Show Current Planets"
- **Label (SI)**: "වත්මන් ග්‍රහ පිහිටීම් පෙන්වන්න"
- **Toggle ON**: Triggers API call to fetch current planet positions (`?includeCurrentPlanets=true`); loading spinner appears; current planets rendered with Sinhala first-letter symbols and sky-blue border
- **Toggle OFF**: Hides overlay instantly (data kept in memory for instant re-show)
- **Visual differentiation**: Birth planets = Unicode glyphs (☉, ☽, ♂...) with solid fill; Current planets = first letter of Sinhala name (ර, ස, ක...) with same fill color + 2px sky-blue border (`#0EA5E9`, 85% opacity)
- **Merged positions**: When current + birth planet at same house within < 2°, render split symbol (left half: birth glyph, right half: current Sinhala letter)
- **Legend update**: When overlay ON, legend shows "Birth Planets" and "Current Planets (transit)" sections
- **Hover tooltip**: Shows planet name (localized), sign + degree, house, nakshatra + pada, retrograde/combustion status, strength — header includes "(Birth)" or "(Current)" suffix
- **Preference persistence**: Toggle state saved to `FilterConfig.currentPlanetPositions` (debounced 300ms)
- **Scope**: House chart only in v1; other chart types may be extended in the future (per-chart toggle, not global)
- **Loading state**: Spinner next to toggle label + "(loading...)" suffix; birth chart remains visible
- **Error state**: Inline error banner below toggle with "Retry" button; toggle reverts to OFF
- **Accessibility**: `role="switch"` with `aria-checked`, `aria-busy` during loading, `aria-live` announcements for state changes; visual differentiation uses fill vs outline + color + opacity (not color alone)
- **Keyboard**: Tab to toggle, Enter/Space to activate; Tab into chart for planet navigation
- **Touch targets**: Toggle minimum 44x44px tap area on mobile

### PrivacyToggle

- **Placement**: Horoscope creation form (below birth details, above submit) AND horoscope detail page settings section
- **Structure**: Card with two toggle switches:
  - Toggle 1: Privacy (Public/Private) — always visible
  - Toggle 2: Show Name (displayName) — conditionally visible when Public selected
- **Label (EN)**: "Privacy" / "Show person's name on public horoscope"
- **Label (SI)**: "රහස්‍යතාව" / "පොදු ලග්නයේ පුද්ගලයාගේ නම පෙන්වන්න"
- **Save behavior**: Immediate save via PATCH on every toggle (no separate Save button)
- **Debounce**: 300ms to prevent rapid-fire API calls
- **displayName conditional rules**:
  - Only rendered when isPublic=true (smooth slide-down animation on toggling Public ON)
  - When isPublic toggles OFF while displayName visible → toggle disappears, value preserved in DB
  - When isPublic toggles back ON → toggle reappears with preserved value
  - displayName=false while isPublic=false is valid but has no visible effect
- **Loading state**: Both toggles disabled + small spinner during save
- **Error state**: Inline error below card with "Retry" link
- **Anonymous placeholder**: "Anonymous Horoscope #A3F2" / "නිර්නාමික ලග්නය #A3F2" — generated from last 4 chars of UUID, uppercase
- **Privacy badge**: Badge in detail header showing "Public" / "Private" / "Name Hidden"
- **Accessibility**: `role="switch"` with `aria-checked` on each toggle; `aria-live="polite"` announcements; `aria-disabled` during loading
- **Keyboard**: Tab to toggle, Enter/Space to activate
- **Touch targets**: Minimum 44x44px per toggle

### Nested Accordion (Dasha Timeline)

- **Tab**: Move focus through accordion headers (tree items)
- **Enter/Space**: Expand or collapse the focused period
- **Up/Down arrows**: Navigate between periods at the same hierarchy level
- **Left arrow**: Collapse the focused period (if expanded); move to parent (if collapsed)
- **Right arrow**: Expand the focused period (if collapsed); move to first child (if expanded)
- **Escape**: Collapse the deepest expanded level in the active chain
- **Home**: Jump to the first period at the top level
- **End**: Jump to the last period at the top level
- ARIA: `role="tree"` on container, `role="treeitem"` on each period, `aria-expanded` on toggle, `aria-current="true"` on active period

### Manual Chart Editor

> Full spec: `specs/ux/20260805-1514-calculated-horoscope.md`

- **Mode toggle**: Segmented control on the Add Horoscope page (`role="tablist"`, two `role="tab"` options: Birth Details / Calculated Chart); default Birth Details
- **House table editor**: 12-row editable table (House | Sign | Planets | Aspects); each row has `[+ Add]` opening a popover of unplaced planets; placed planets render as removable chips
- **Planet picker**: Popover `role="menu"` listing all unplaced planets (glyph + EN + SI name); a planet exists once across the chart
- **Validation badges**: Slim bar below the house table with Budha ✓/✗, Sikuru ✓/✗, Rahu–Ketu ✓/⏳/✗; `role="status"` + `aria-live="polite"`; advisory (non-blocking) with tooltips explaining the rule
- **Navamsa house table**: Optional, collapsed by default; same planet picker; enriches the planets table with Navamsa columns
- **Planets table**: Read-only, live-derived (Planet, Sign, Str, House, Conjunctions, Aspects, Other + Navamsa columns); mobile → card-per-planet
- **Derived ranges**: Read-only card with birth time/month/date/age probable ranges + estimate disclaimer
- **Detail page**: `source: "manual"` horoscopes show a "Calculated Chart" badge, an "Edit Chart" button, dual birth+navamsa charts, and "not available" empty states for dasha/varga data

### Planet Aspects Setting (දෘෂ්ඨි)

> **Superseded (2026-08-13):** the three settings (including Planet Aspects) are now **system-wide** — editable by super-admin only, read-only for students, on the same `/settings` page. See `specs/ux/20260813-1000-system-astrology-settings.md`. The interactions below describe the editor surface that super-admins still use; for students the same sections render read-only (pills + values, no chips/expand/Reset, no Save).

> Full spec: `specs/ux/20260809-2215-planet-aspects.md`

- **Placement**: Settings page, below the Planetary Orbs section, inside the same card, separated by `<hr>`; keeps the page's per-section Save pattern (orbs section untouched)
- **List**: All 9 planets always listed (collapsed rows); summary columns = Status pill + Houses + Degrees; jump-to-planet select on desktop/tablet (`role="select"`, EN/SI names)
- **Status pill semantics**: `[Custom]` (indigo) = stored entry, houses are ABSOLUTE house numbers; `[Default]` (gray) = authoritative 9-planet table, houses are OFFSETS from the planet's house in each horoscope — communicates the absolute-vs-offset asymmetry
- **Expanded row editor**: House chip group (1–12) + Degree chip group (30–330 step 30) — `role="group"` per group, chips are `<button aria-pressed>`; structural range validation (impossible to enter out-of-domain values)
- **Degree labels**: Numeric degree is source of truth; non-classical angles (210, 240, 270, 300, 330) render "N°" with label in tooltip/aria on all screens, full "60° Sextile" style labels on lg+ screens
- **Save behavior**: Staged, reversible — edits marked with amber "● Unsaved changes (n planets)" indicator; Save enabled only when dirty; saving spinner + `aria-busy`; success = green "Settings saved" + toast
- **Validation**: ≥1 house and ≥1 degree per customized planet; inline errors under the offending group (`role="alert"` + `aria-describedby`), Save disabled until fixed, focus moves to first offending row
- **Reset**: Per-planet Reset (staged, no modal — reversible) and "Reset all to defaults" (confirmation modal, destructive tone, `aria-modal` + focus trap); reset on an already-default row → info toast
- **Error/loading**: Loading = skeleton rows; load error = inline banner + Retry; save error = section banner with localized message, no partial save
- **Horoscope view impact (data-only)**: Owner-auto detail views re-derive `planets[].aspects` / `houses[].aspectingPlanets` on refresh (pure, no migration); planets table Aspects chips render **planet names only** (`{Planet}` — glyph + localized name, e.g. `සිකුරු / Venus` — no angle/delta inline) and each chip shows a hover/focus/tap **aspect tooltip** (`AspectReasonTooltip` — compact reason lines: a single reason keeps the inline signed delta, e.g. SI `ග්‍රහ දෘෂ්ඨි 7 (180) (+02:05:00)` / EN `Planet drishti 7 (180) (+02:05:00)`, while ≥2 reasons (e.g. planetary + rashi drishti) render one line per reason plus a single shared `Δ {delta}` footer so the delta appears exactly once, e.g. SI `ග්‍රහ දෘෂ්ඨි 7 (180)` + `රාශි දෘෂ්ඨි මේෂ → මිථුන` + `Δ +02:05:00`; see `specs/ux/20260809-2215-planet-aspects.md` §8.1.1); houses table Aspects chips render localized planet names with the same tooltip; charts/art, exports, shared views, and search cards unchanged in v1
- **Accessibility**: chips keyboard-focusable with `aria-pressed`; status pills never color-only; 40px touch targets; `Esc` closes expanded row/modal; `beforeunload` guard on dirty navigation

### Search Input

> Full spec: `specs/ux/20260727-2100-search-horoscope.md` §4

- **Type**: Auto-resize textarea (min-height 48px, max-height 120px, 3 lines max)
- **Debounce**: Search fires 300ms after user stops typing; also fires on Enter key or Search button click
- **Language detection**: Unicode range U+0D80–U+0DFF for Sinhala; indicator updates in real-time
- **Suggestions**: Shown when input is focused AND empty; hidden when user types
- **Recent searches**: Shown when input is focused AND empty; hidden when user types
- **Max length**: 500 characters; beyond that, inline warning shown
- **Placeholder (EN)**: "Search horoscopes using natural language..."
- **Placeholder (SI)**: "ස්වාභාවික භාෂාවෙන් ලග්න සොයන්න..."
- **Accessibility**: `role="searchbox"`, `aria-label`, `aria-autocomplete="list"` when suggestions visible, `aria-busy` during search
- **Keyboard**: Tab to focus, Enter to search, Escape to close suggestions, `/` global shortcut to focus

### Search Config Panel

> Full spec: `specs/ux/20260727-2100-search-horoscope.md` §5

- **Purpose**: Toggle which sections appear in search result cards
- **Desktop**: Slide-out panel from right (320px wide)
- **Mobile**: Slide-up bottom sheet (full width)
- **Sections**: 19 toggleable sections across Charts (8), Calculations (4), Strengths & Aspects (2), Yogas & Doshas (2), Other (3)
- **Persistence**: POST /api/search/filter, debounced 500ms
- **Immediate effect**: Toggling hides/shows sections in all visible cards instantly (no re-fetch)
- **Reset**: "Reset to Defaults" button restores all toggles
- **Badge**: Small dot on ⚙️ icon when non-default config is active
- **Accessibility**: `role="dialog"`, `aria-modal`, focus trap, Escape to close

### Search Result Card

> Full spec: `specs/ux/20260727-2100-search-horoscope.md` §6

- **Type**: Vertical full-detail card (not summary card)
- **Default state**: All cards expanded on fresh search
- **Collapse/expand**: Any number of cards can be expanded simultaneously (no accordion constraint)
- **Toggle-all**: "Collapse All" / "Expand All" button at top of results list
- **Score badge**: Color-tiered percentage badge (green 80-100%, indigo 60-79%, amber 40-59%, gray 0-39%)
- **Charts**: Horizontal scroll container, min-width 280px per chart, aspect-ratio 1:1, lazy-rendered via IntersectionObserver
- **Bookmark**: 🔖 toggle on card header, filled when bookmarked
- **Animation**: Height transition 300ms ease-out (expand), 200ms ease-in (collapse), chevron rotation 200ms

### Search Pagination

> Full spec: `specs/ux/20260727-2100-search-horoscope.md` §13

- **Page size**: Default 5 results per page
- **URL sync**: Page number in URL query params (`?page=1&query=...`)
- **Mobile**: Prev/Next only (no page numbers)
- **Desktop**: Full with page numbers
- **Filter change**: Resets to page 1 when filters/query change

### Query Understanding Banner

> Full spec: `specs/ux/20260727-2100-search-horoscope.md` §14

- **Purpose**: Shows which conditions were understood by the RAG pipeline
- **Confidence levels**: High (≥80%) green, Medium (50-79%) amber, Low (<50%) red
- **Partial parsing**: Lists understood and unrecognized conditions separately
- **Auto-dismiss**: 8 seconds or manual close (X)
- **Accessibility**: `role="status"`, `aria-live="polite"`

### Loading States

| State | Pattern |
|-------|---------|
| Page load | Skeleton screen (pulsing placeholders) |
| Form submit | Button spinner + disabled state |
| Search | Typing indicator + results skeleton |
| Chart render | Chart skeleton with outline |
| Calculation | Progress bar with "Calculating..." |

### Location Picker

- Dropdown/searchable selector used in Horoscope Form and Location Picker component
- Fetches from `GET /api/location` on mount (public + own private)
- Grouped sections: "Public Locations" first, then "My Locations"
- Search input within dropdown filters the list client-side
- "Add new location..." action at bottom (opens quick-add modal or navigates to `/locations/new`)
- Visual badges: globe icon for public, lock icon for private
- States: loading (skeleton), empty (no saved locations + CTA), loaded, error (inline + retry)

### Empty States

| Context | Message (EN) | Message (SI) | Action |
|---------|-------------|--------------|--------|
| No horoscopes | "No horoscopes yet. Add your first one!" | "තවම ලග්න නැත. ඔබේ පළමු ලග්නය එකතු කරන්න!" | "Add Horoscope" button |
| No search results | "No horoscopes match your query." | "ඔබේ සෙවුමට ගැළපෙන ලග්න නැත." | Adjust query suggestion |
| No metadata | "No metadata added yet." | "තවම මෙටාඩේටා එකතු කර නැත." | "Add Metadata" button |
| No saved filters | "No saved searches yet." | "තවම සුරැකුම් පෙරහන් නැත." | "Save a search" prompt |
| No saved locations | "No saved locations yet. Add your first one!" | "තවම සුරැකි ස්ථාන නැත. ඔබේ පළමු ස්ථානය එකතු කරන්න!" | "Add Location" button |
| No locations match search | "No locations match your search." | "ඔබේ සෙවුමට ගැළපෙන ස්ථාන නැත." | Clear search suggestion |
| Dasha data not available | "Dasha data not available." | "දශා දත්ත නොමැත." | (No action — inline message only) |
| Birth details incomplete for dashas | "Complete birth details to calculate dashas." | "දශා ගණනය කිරීමට උපන් තොරතුරු සම්පූර්ණ කරන්න." | Link to edit horoscope |
| Current planets calculation failed | "Unable to load current planetary positions. Please try again." | "වත්මන් ග්‍රහ පිහිටීම් පූරණය කළ නොහැක. නැවත උත්සාහ කරන්න." | "Retry" button |
| Aspects setting load failed | "Could not load your aspects setting. Please try again." | "ඔබගේ දෘෂ්ඨි සැකසුම පූරණය කළ නොහැක. නැවත උත්සාහ කරන්න." | "Retry" button |
| Private horoscope page (non-owner) | "Horoscope not found" | "ලග්නය හමු නොවීය" | (404 — no action; prevents existence probing) |
| Privacy toggle save error | "Failed to update privacy settings. Please try again." | "රහස්‍යතා සැකසුම් යාවත්කාලීන කිරීම අසාර්ථකයි. නැවත උත්සාහ කරන්න." | "Retry" link |
| **Search: No query entered** | "Type a natural language query to search horoscopes." | "ලග්න සොයන්න ස්වාභාවික භාෂා වාක්‍යයක් ටයිප් කරන්න." | Show suggestions + recent history |
| **Search: No results found** | "No horoscopes match your query. Try broadening your search or using different terms." | "ඔබේ සෙවුමට ගැළපෙන ලග්න නැත. සෙවුම පුළුල් කරන්න හෝ වෙනත් පද භාවිතා කරන්න." | Suggest common terms or recent searches |
| **Search: Search failed** | "Search failed. Please try again." | "සෙවුම අසාර්ථකයි. නැවත උත්සාහ කරන්න." | Retry button |
| **Search: Rate limited** | "Too many searches. Please wait {seconds} seconds." | "සෙවුම් වැඩියි. තත්පර {seconds} ක් රැඳී සිටින්න." | Auto-retry countdown |
| **Search: No saved searches** | "No saved searches yet." | "තවම සුරැකුම් සෙවුම් නැත." | "Save a search" prompt |
| **Search: No bookmarks** | "No bookmarks yet. Bookmark horoscopes from search results to save them here." | "තවම සුරැකුම් නැත. සෙවුම් ප්‍රතිඵලවලින් ලග්න සුරැකින්න." | Navigate to search |
| **Search: No search history** | "No search history yet." | "තවම සෙවුම් ඉතිහාසය නැත." | (No action) |
| **Search: Partial query understanding** | "We understood {n} of {m} conditions. Results are based on the understood conditions." | "අපි කොන්දේසි {m} න් {n} ක් තේරුම් ගත්තෙමු. ප්‍රතිඵල තේරුම් ගත් කොන්දේසි මත පදනම් වේ." | Info banner (not blocking) |
| **Search: Contradictory conditions** | "Your search conditions appear contradictory. No results found." | "ඔබේ සෙවුම් කොන්දේසි පරස්පර විරෝධී බව පෙනේ. ප්‍රතිඵල නැත." | Suggest simplifying query |
| **Search: Career query disclaimer** | "These results are suggestions based on astrological principles and should not be considered as professional advice." | "මේවා ජ්‍යොතිෂ මූලධර්ම මත පදනම් වූ යෝජනා වන අතර වෘත්තීය උපදේශයක් ලෙස සැලකිය යුතු නැත." | Info banner below results |

### Privacy-Related Toast Extensions

| Type | Duration | Message (EN) | Message (SI) | Trigger |
|------|----------|-------------|--------------|---------|
| Success | 3s | "Privacy updated" | "රහස්‍යතාව යාවත්කාලීන කළා" | Any privacy toggle change |
| Info | 4s | "Horoscope is now private. Removed from search results." | "ලග්නය දැන් පුද්ගලිකයි. සෙවුම් ප්‍රතිඵලවලින් ඉවත් කරන ලදී." | Public → Private transition |
| Success | 3s | "Horoscope is now public. Visible to other students." | "ලග්නය දැන් පොදුයි. අනෙකුත් සිසුන්ට දෘශ්‍යමානයි." | Private → Public transition |
| Success | 3s | "Name hidden on public horoscope" | "පොදු ලග්නයේ නම සඟවන ලදී" | displayName set to false |
| Success | 3s | "Name shown on public horoscope" | "පොදු ලග්නයේ නම පෙන්වයි" | displayName set to true |
| Warning | 4s | "Public horoscope: Name hidden. Toggle 'Show Name' to display it." | "පොදු ලග්නය: නම සඟවා ඇත. එය පෙන්වීමට 'නම පෙන්වන්න' සක්‍රිය කරන්න." | displayName=false while isPublic=true (initial flow) |

---

## Accessibility

- **Keyboard navigation**: All interactive elements focusable, visible focus ring (2px solid primary)
- **Screen reader**: ARIA labels on all icons, role attributes on custom components, live regions for search results
- **Color contrast**: Minimum 4.5:1 for text, 3:1 for large text and UI components
- **Skip links**: "Skip to main content" link on page load
- **Alt text**: All chart images have descriptive alt text
- **Form labels**: Every input has a visible or associated label
- **Error announcements**: Errors announced via `aria-live="polite"`

### Search-Specific Accessibility

> Full spec: `specs/ux/20260727-2100-search-horoscope.md` §17

| Element | ARIA |
|---------|------|
| Search input | `role="searchbox"`, `aria-label="Search horoscopes"` |
| Results region | `role="region"`, `aria-label="Search results"`, `aria-live="polite"` |
| Results count | "Found 42 horoscopes, showing 1 to 5" announced on load |
| Result card | `role="article"`, `aria-label="{name} horoscope, {score}% match"` |
| Collapse/expand | `aria-expanded="true/false"` on toggle button |
| Config panel | `role="dialog"`, `aria-modal="true"`, `aria-label="Result configuration"` |
| Config toggles | `role="checkbox"`, `aria-checked`, `aria-label="{section name}"` |
| Bookmark toggle | `role="button"`, `aria-pressed="true/false"`, `aria-label="Bookmark {name}"` |
| Score badge | `aria-label="Match score: 87 percent"` |
| Pagination | `role="navigation"`, `aria-label="Search results pagination"`, `aria-current="page"` |
| History panel | `role="dialog"`, `aria-label="Search history"` |
| Saved searches panel | `role="dialog"`, `aria-label="Saved searches"` |
| Bookmarks panel | `role="dialog"`, `aria-label="Bookmarks"` |
| Empty state | `role="status"`, `aria-live="polite"` |
| Error state | `role="alert"`, `aria-live="assertive"` |
| Query understanding | `role="status"`, `aria-live="polite"` |

**Keyboard shortcuts:**

| Key | Action |
|-----|--------|
| `/` (forward slash) | Focus search input (global shortcut) |
| `Tab` | Navigate through: search input → actions bar → config button → results → pagination |
| `Enter` | Submit search, activate buttons, expand/collapse cards |
| `Escape` | Close config panel, close history dropdown, close suggestions |
| `Arrow keys` | Navigate within pagination, navigate suggestion list |
| `Space` | Toggle checkboxes in config panel, bookmark toggle |

**Focus management:**

| Event | Focus Behavior |
|-------|----------------|
| Page load | Focus on search input |
| Search submitted | Focus stays on search input; results announced via `aria-live` |
| Config panel opens | Focus moves to first toggle in panel |
| Config panel closes | Focus returns to ⚙️ button |
| History panel opens | Focus moves to first history entry |
| History entry selected | Panel closes, focus returns to search input (query prefilled) |
| Card collapsed/expanded | Focus stays on collapse/expand button |
| Bookmark toggled | Focus stays on bookmark button |
| Page changed | Focus moves to results region top |
| Error occurs | Focus moves to error banner |

---

## File Index

| File | Description |
|------|-------------|
| `specs/ux/main-ux-spec.md` | This document — master UX reference |
| `specs/ux/20260715-1230-full-app-ux-design.md` | Detailed page-by-page UX design |
| `specs/ux/20260717-1400-mobile-table-layouts.md` | Mobile responsive table layouts |
| `specs/ux/20260718-2145-location-management-ux.md` | Location management UX design |
| `specs/ux/20260719-1500-dasha-ux.md` | Dasha periods UX specification |
| `specs/ux/20260720-0730-current-planetary-positions.md` | Current planetary positions overlay UX specification |
| `specs/ux/20260727-1926-privacy-settings.md` | Horoscope privacy settings UX specification |
| `specs/ux/20260727-2100-search-horoscope.md` | Search Horoscope (RAG-based) UX specification |
| `specs/ux/20260805-1514-calculated-horoscope.md` | Calculated Horoscope (manual entry) UX specification |
| `specs/ux/20260809-2215-planet-aspects.md` | Planet Aspects houses and degrees (දෘෂ්ඨි) settings UX specification |
| `specs/ux/20260813-1000-system-astrology-settings.md` | System-wide astrology settings UX specification (role-gated `/settings`: admin edit + recalc progress + audit/history; student read-only) |
| `src/components/PrivacyToggle.tsx` | PrivacyToggle component (isPublic + displayName toggles) |
| `src/components/PrivacyBadge.tsx` | Privacy status badge (Public / Private / Name Hidden) |
| `src/components/ManualChart/` | Manual Chart editor components (ModeToggle, HouseTableEditor, NavamsaHouseTableEditor, PlanetPicker, ValidationBadges, PlanetsTable, DerivedRanges, ManualChartEditor, ManualChartDetailPanel) |
