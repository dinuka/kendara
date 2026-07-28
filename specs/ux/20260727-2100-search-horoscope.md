# Search Horoscope (RAG-Based) — UX Specification

**Date:** 2026-07-27 21:00
**Author:** UX (BMAD)
**Based on:** specs/business-analysis/20260727-2055-search-horoscope.md, specs/architecture/20260727-2100-search-horoscope.md, specs/architecture/overview.md, specs/ux/main-ux-spec.md, specs/ux/20260715-1230-full-app-ux-design.md, specs/ux/20260719-1500-dasha-ux.md

---

## 1. Overview

The Search Horoscope feature introduces RAG-based natural language search across all accessible horoscopes. Students type queries in Sinhala or English, the RAG pipeline parses them into astrological conditions, and results are displayed as vertical full-detail cards with configurable sections, collapse/expand, pagination, bookmarks, history, and export.

### Design Goals

1. **Natural language first** — Prominent, spacious input with no form fields or dropdowns; the user types like they'd ask a question
2. **Full-detail cards** — Each result is a complete horoscope view (charts, calculations, dashas, yogas) — not a summary card
3. **Configurable density** — Users toggle which sections appear per result card; preferences persist globally
4. **Bilingual parity** — Every label, placeholder, suggestion, error, and empty state works in both Sinhala and English
5. **Progressive disclosure** — Results start expanded; collapse/expand reduces visual clutter for scanning
6. **Zero dead ends** — Every empty state, error, and edge case includes guidance or a call to action

---

## 2. User Flows

### Flow 1: Basic Search

```
Search Page →
  → Empty state: suggestion chips + recent history shown
  → User types query (e.g., "මේෂ ලග්නයේ ශනි උච්ච") →
    → Debounce 300ms → search fires →
    → Loading skeleton appears (result cards) →
    → Results render as vertical full-detail cards →
    → User scrolls through results (each card: name → charts → calculations → dashas → yogas → doshas) →
    → User expands/collapses individual cards →
    → User toggles sections via Config Panel →
    → User paginates to next page →
    → User bookmarks a result →
    → User saves the search query →
    → User exports current page as CSV
```

### Flow 2: Complex Search

```
User types complex query (e.g., "මේෂ ලග්නයේ ශනි උච්චව ගුරු 3 භාවයේ") →
  → RAG pipeline parses → confidence indicator shown →
  → Results filtered by parsed conditions →
  → "Query understood: Aries Ascendant, Saturn Exaltation, Jupiter in 3rd House" banner →
  → Results displayed as full-detail cards
```

### Flow 3: Saved Search Reuse

```
User clicks Saved Searches panel →
  → List of saved searches with name, query, last run, result count →
  → User clicks a saved search →
    → Query prefilled in search input →
    → Config applied →
    → Search fires →
    → Results displayed
```

### Flow 4: Search History Review

```
User opens Search History dropdown →
  → Recent queries listed with date/time, result count, language indicator →
  → User clicks a history entry →
    → Query prefilled → search fires →
  → User clears individual entries or all history
```

### Flow 5: Bookmark Management

```
User clicks Bookmarks in sidebar →
  → List of bookmarked horoscopes with name, ascendant, query context →
  → User clicks a bookmark →
    → Navigates to full horoscope detail →
  → User removes a bookmark
```

---

## 3. Search Page Layout

### 3.1 Desktop Layout (> 1024px)

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Logo: Kendara]  [🔍 Search horoscopes...]  [EN|සිං]  [👤]       │
├──────────┬──────────────────────────────────────────────────────────┤
│ Sidebar  │  Search Horoscopes / ලග්න සොයන්න                      │
│          │                                                          │
│ ● මුල්   │  ┌─── Search Input ──────────────────────────────────┐  │
│   පිටුව │  │                                                     │  │
│          │  │  ┌──────────────────────────────────────────────┐   │  │
│ ● ලග්න  │  │  │ 🔍                                       ▾  │   │  │
│   එකතු │  │  │ මේෂ ලග්නයේ ශනි උච්ච                         │   │  │
│          │  │  └──────────────────────────────────────────────┘   │  │
│ ● නව    │  │                                                     │  │
│   ලග්න │  │  ┌─── Suggestions (below input, on focus) ─────┐   │  │
│          │  │  │ 💡 "Aries Ascendant with Saturn exalted"    │   │  │
│ ● සොයන │  │  │ 💡 "Jupiter in 3rd house"                   │   │  │
│  (active)│  │  │ 💡 "Parivartana yoga present"               │   │  │
│          │  │  │ 💡 "Manglik dosha horoscopes"               │   │  │
│ ● ස්ථාන │  │  └──────────────────────────────────────────────┘   │  │
│          │  └─────────────────────────────────────────────────────┘  │
│ ● සැකසුම්│                                                          │
│          │  ┌─── Actions Bar ────────────────────────────────────┐  │
│ ● සුරැකුම්│ │  [⚙️ Config]  [💾 Save Search]  [📋 History ▾]   │  │
│   පෙරහන්│ │       [📊 Export CSV]  [⬇️ Export JSON]            │  │
│          │ └─────────────────────────────────────────────────────┘  │
│          │                                                          │
│          │  ┌─── Results Header ─────────────────────────────────┐  │
│          │  │  Found 42 horoscopes (showing 1-5)                │  │
│          │  │  Sort: [Relevance ▾]    [Collapse All] [Expand All]│  │
│          │  └─────────────────────────────────────────────────────┘  │
│          │                                                          │
│          │  ┌─── Result Card 1 (expanded) ──────────────────────┐  │
│          │  │  [Name] John Doe            [Score: 87%] [🔖] [▶] │  │
│          │  │  [Ascendant] Aries (Mesha)                         │  │
│          │  │  ─────────────────────────────────────────────────  │  │
│          │  │  Charts:                                            │  │
│          │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐            │  │
│          │  │  │  Birth   │ │ Navamsa  │ │  House   │ ◄ scroll   │  │
│          │  │  │  Chart   │ │  (D9)    │ │  Chart   │            │  │
│          │  │  └──────────┘ └──────────┘ └──────────┘            │  │
│          │  │  ─────────────────────────────────────────────────  │  │
│          │  │  Calculations:                                      │  │
│          │  │  ● Ascendant: Aries (Mesha) at 5° 12'              │  │
│          │  │  ● Planets:                                         │  │
│          │  │    Sun (Ravi) in Aries, 1st House                   │  │
│          │  │    Moon (Chandra) in Cancer, 4th House              │  │
│          │  │    ...                                              │  │
│          │  │  ● Nakshatra: Ashwini, Pada 2                       │  │
│          │  │  ─────────────────────────────────────────────────  │  │
│          │  │  Dashas:                                            │  │
│          │  │  ● Mahadasha: Jupiter (1990-2006)                   │  │
│          │  │    ├─ Antardasha: Saturn (1990-1992) [CURRENT]      │  │
│          │  │    ├─ Antardasha: Mercury (1992-1994)               │  │
│          │  │    └─ ...                                           │  │
│          │  │  ─────────────────────────────────────────────────  │  │
│          │  │  Yogas:                                             │  │
│          │  │  ● Parivartana Yoga (present)                       │  │
│          │  │  ─────────────────────────────────────────────────  │  │
│          │  │  Doshas:                                            │  │
│          │  │  ● Manglik Dosha (present, medium severity)         │  │
│          │  └─────────────────────────────────────────────────────┘  │
│          │                                                          │
│          │  ┌─── Result Card 2 (expanded) ──────────────────────┐  │
│          │  │  ...                                               │  │
│          │  └─────────────────────────────────────────────────────┘  │
│          │                                                          │
│          │  ┌─── Pagination ─────────────────────────────────────┐  │
│          │  │  [← Previous]  Page 1 of 9  [Next →]              │  │
│          │  └─────────────────────────────────────────────────────┘  │
│          │                                                          │
└──────────┴──────────────────────────────────────────────────────────┘
```

### 3.2 Mobile Layout (< 640px)

```
┌─────────────────────────────────────┐
│  [← Back]  Search / සොයන්න         │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 🔍                       ▾  │   │
│  │ මේෂ ලග්නයේ ශනි උච්ච       │   │
│  └─────────────────────────────┘   │
│                                     │
│  [⚙️] [💾] [📋] [📊 CSV]           │
│                                     │
│  Found 42 (1-5)  Sort:[Relevance▾] │
│  [Collapse All]  [Expand All]       │
│                                     │
│  ┌─ Card 1 ─────────────────────┐  │
│  │ John Doe          [87%] [🔖] │  │
│  │ Aries Ascendant   [▸]        │  │
│  │                                │  │
│  │ (collapsed = only above line) │  │
│  │                                │  │
│  │ (expanded = full detail)      │  │
│  │ Charts:                       │  │
│  │ ┌──────┐┌──────┐┌──────┐     │  │
│  │ │Birth ││Navam.││House│ ←scroll│  │
│  │ └──────┘└──────┘└──────┘     │  │
│  │ ...                           │  │
│  └───────────────────────────────┘  │
│                                     │
│  [← Prev]  Page 1 of 9  [Next →]   │
└─────────────────────────────────────┘
```

---

## 4. Search Input Component

### 4.1 Purpose

A natural language text input for astrological queries in Sinhala or English. Auto-resizes, debounces, shows suggestions, and indicates query language.

### 4.2 Wireframe

```
┌──────────────────────────────────────────────────────────────┐
│  🔍                                                           │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ මේෂ ලග්නයේ ශනි උච්ච                                 │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─── Language Indicator ──────────────────────────────────┐ │
│  │  🇱🇰 Sinhala detected                                   │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─── Suggestions (on focus, when input is empty) ────────┐ │
│  │  💡 "Aries Ascendant with Saturn exalted"              │ │
│  │  💡 "Jupiter in 3rd house"                             │ │
│  │  💡 "Parivartana yoga present"                         │ │
│  │  💡 "Manglik dosha horoscopes"                         │ │
│  │  💡 "Career teaching profession"                       │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─── Recent Searches (when input is empty) ─────────────┐  │
│  │  🕐 "ගුරු 3 භාවයේ"                    Jul 27, 2:30 PM │  │
│  │  🕐 "Aries ascendant"                   Jul 27, 1:15 PM │  │
│  │  🕐 "Manglik dosha"                     Jul 26, 9:00 AM │  │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  [Search]  [Clear]                                           │
└──────────────────────────────────────────────────────────────┘
```

### 4.3 Elements

| Element | Type | Details |
|---------|------|---------|
| Search Icon | Icon | Magnifying glass, left of input, decorative |
| Input | Textarea | Auto-resize, min-height 48px, max-height 120px, 3 lines max |
| Language Indicator | Badge | Shows detected language below input: "🇱🇰 Sinhala detected" / "🇬🇧 English detected" |
| Suggestions | List | 3-5 suggestions based on common astrological phrases, shown on focus when empty |
| Recent Searches | List | Last 5 search queries from history, shown on focus when empty |
| Search Button | Primary | "Search" / "සොයන්න", fires search on click |
| Clear Button | Secondary | Clears input text |

### 4.4 Props

| Prop | Type | Description |
|------|------|-------------|
| `value` | `string` | Current query text |
| `onChange` | `(value: string) => void` | Text change handler |
| `onSearch` | `(query: string) => void` | Search submit handler |
| `onClear` | `() => void` | Clear handler |
| `isSearching` | `boolean` | Whether a search is in progress |
| `language` | `'si' \| 'en'` | Current UI language |
| `recentSearches` | `Array<{query, date, resultCount}>` | Recent search history entries |
| `suggestions` | `string[]` | Suggested query strings |

### 4.5 Behavior

| Behavior | Details |
|----------|---------|
| Debounce | Search fires 300ms after user stops typing (for auto-search); also fires on Enter key or Search button click |
| Enter key | Submit search immediately (no debounce) |
| Shift+Enter | New line (no submit) |
| Language detection | Check for Sinhala Unicode range (U+0D80–U+0DFF); update indicator in real-time |
| Suggestions | Shown when input is focused AND empty; hidden when user types |
| Recent searches | Shown when input is focused AND empty; hidden when user types |
| Click suggestion | Fills input, triggers search |
| Click recent search | Fills input, triggers search |
| Placeholder (EN) | "Search horoscopes using natural language..." |
| Placeholder (SI) | "ස්වාභාවික භාෂාවෙන් ලග්න සොයන්න..." |
| Max length | 500 characters; beyond that, show inline warning "Query too long — try a shorter phrase" / "සෙවුම දිග වැඩියි — කෙටි වාක්‍යයක් උත්සාහ කරන්න" |
| Empty search | Search button disabled when input is empty |
| Short query (< 3 chars) | Treat as partial match; search fires normally |

### 4.6 States

| State | Visual |
|-------|--------|
| Empty (unfocused) | Input with placeholder text, no suggestions |
| Empty (focused) | Input focused, suggestions + recent searches visible below |
| Typing | Input with text, suggestions hidden, debounce countdown |
| Searching | Input disabled, spinner on Search button, "Searching..." / "සොයමින්..." text |
| Results loaded | Input retains query, results shown below |
| No results | Input retains query, empty state message shown |
| Error | Input retains query, error banner below input |
| Rate limited | Input disabled, warning "Too many searches. Please wait X seconds." |
| Query too long | Inline warning below input |

### 4.7 Accessibility

- `role="searchbox"` on the textarea
- `aria-label="Search horoscopes"` / "ලග්න සොයන්න"
- `aria-autocomplete="list"` when suggestions are visible
- `aria-live="polite"` on results count region
- `aria-busy="true"` during search
- Keyboard: Tab to focus, Enter to search, Escape to close suggestions
- Language indicator has `aria-label` with detected language name

---

## 5. Config Panel

### 5.1 Purpose

Allows users to toggle which sections appear in each search result card. Changes take effect immediately without re-running the search. Configuration is persisted globally per user.

### 5.2 Wireframe — Desktop (slide-out panel)

```
┌─── Result Configuration ─────────────────────────────────┐
│                                                           │
│  Visible Sections                          [Reset ▾]     │
│                                                           │
│  ── Charts ──                                             │
│  ✅ Birth Chart (Rasi)                                    │
│  ✅ Navamsa (D9)                                          │
│  ✅ House Chart (Bhava)                                   │
│  ☐ Drekkana (D3)                                          │
│  ☐ Dasamsa (D10)                                          │
│  ☐ Shodasha Vargas (16 Vargas)                            │
│  ☐ Chandra Lagna                                          │
│  ☐ Surya Lagna                                            │
│                                                           │
│  ── Calculations ──                                       │
│  ✅ Ascendant / Lagna                                     │
│  ☐ House Details                                          │
│  ✅ Planet Positions                                      │
│  ☐ Nakshatra / Pada                                       │
│  ✅ Dashas                                                │
│                                                           │
│  ── Strengths & Aspects ──                               │
│  ☐ Planetary Strengths                                    │
│  ☐ Aspects                                                │
│                                                           │
│  ── Yogas & Doshas ──                                    │
│  ☐ Yogas                                                  │
│  ☐ Doshas                                                 │
│                                                           │
│  ── Other ──                                              │
│  ☐ Current Planetary Positions (overlay)                  │
│  ☐ Metadata / Tags                                        │
│                                                           │
│  ── Quick Actions ──                                      │
│  [Select All]  [Deselect All]  [Reset to Defaults]        │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### 5.3 Wireframe — Mobile (slide-up sheet)

```
┌──────────────────────────────────────┐
│  ─── (drag handle)                   │
│                                       │
│  Result Configuration    [Reset ▾]    │
│                                       │
│  ── Charts ──                        │
│  ✅ Birth Chart (Rasi)               │
│  ✅ Navamsa (D9)                     │
│  ✅ House Chart (Bhava)              │
│  ☐ Drekkana (D3)                     │
│  ☐ Dasamsa (D10)                     │
│  ☐ Shodasha Vargas                   │
│  ☐ Chandra Lagna                     │
│  ☐ Surya Lagna                       │
│                                       │
│  ── Calculations ──                  │
│  ✅ Ascendant / Lagna                │
│  ☐ House Details                     │
│  ✅ Planet Positions                 │
│  ☐ Nakshatra / Pada                  │
│  ✅ Dashas                           │
│                                       │
│  ── Strengths & Aspects ──          │
│  ☐ Planetary Strengths               │
│  ☐ Aspects                           │
│                                       │
│  ── Yogas & Doshas ──               │
│  ☐ Yogas                             │
│  ☐ Doshas                            │
│                                       │
│  ── Other ──                         │
│  ☐ Current Planets (overlay)         │
│  ☐ Metadata / Tags                   │
│                                       │
│  [Select All] [Deselect All]          │
│  [Reset to Defaults]                  │
│                                       │
└──────────────────────────────────────┘
```

### 5.4 Toggleable Sections

| Category | Section Key | Default | i18n Label (EN) | i18n Label (SI) |
|----------|-------------|---------|------------------|------------------|
| Charts | `birthChart` | ✅ ON | Birth Chart (Rasi) | උපත් සටහන (රාශි) |
| Charts | `navamsaD9` | ✅ ON | Navamsa (D9) | නවාංශ (D9) |
| Charts | `houseChart` | ✅ ON | House Chart (Bhava) | භාව සටහන |
| Charts | `drekkanaD3` | ☐ OFF | Drekkana (D3) | ද්‍රෙෂ්කාණ (D3) |
| Charts | `dasamsaD10` | ☐ OFF | Dasamsa (D10) | දශම්ස (D10) |
| Charts | `shodashaVargas` | ☐ OFF | Shodasha Vargas (16 Vargas) | ෂෝෂ වර්ග (16 වර්ග) |
| Charts | `chandraLagna` | ☐ OFF | Chandra Lagna | චන්ද්‍ර ලග්න |
| Charts | `suryaLagna` | ☐ OFF | Surya Lagna | සූර්‍ය ලග්න |
| Calculations | `ascendant` | ✅ ON | Ascendant / Lagna | ලග්නය |
| Calculations | `houseDetails` | ☐ OFF | House Details | භාව විස්තර |
| Calculations | `planetPositions` | ✅ ON | Planet Positions | ග්‍රහ පිහිටීම් |
| Calculations | `nakshatra` | ☐ OFF | Nakshatra / Pada | නක්ෂත්‍රය / පාද |
| Calculations | `dashas` | ✅ ON | Dashas | දශා |
| Strengths | `planetaryStrengths` | ☐ OFF | Planetary Strengths | ග්‍රහ බලය |
| Strengths | `aspects` | ☐ OFF | Aspects | දෘෂ්ටි |
| Yogas | `yogas` | ☐ OFF | Yogas | යෝග |
| Doshas | `doshas` | ☐ OFF | Doshas | දෝෂ |
| Other | `currentPlanetPositions` | ☐ OFF | Current Planetary Positions (overlay) | වත්මන් ග්‍රහ පිහිටීම් |
| Other | `metadata` | ☐ OFF | Metadata / Tags | මෙටාඩේටා / ටැග් |

### 5.5 Behavior

| Behavior | Details |
|----------|---------|
| Toggle | Each section has a checkbox toggle; click to toggle ON/OFF |
| Immediate effect | Toggling hides/shows sections in all visible result cards instantly (no re-fetch, CSS conditional render) |
| Persistence | Toggle state saved to server via POST /api/search/filter (debounced 500ms) |
| Config scope | Global preference — applies across all search queries |
| Reset to defaults | Single button restores all toggles to default values |
| Select All / Deselect All | Bulk toggle all sections |
| No data for section | If a section is ON but the horoscope has no data for it, show "No data available" / "දත්ත නොමැත" — don't hide the section |
| Config panel trigger | ⚙️ gear icon in actions bar; opens panel as slide-out (desktop) or slide-up sheet (mobile) |
| Close panel | Click outside panel, X button, or Escape key |
| Badge on config icon | Small dot indicator on ⚙️ icon when non-default config is active |

### 5.6 Accessibility

- `role="dialog"` on panel container
- `aria-modal="true"`
- `aria-label="Result configuration"` / "ප්‍රතිඵල වින්‍යාසය"
- Each toggle: `role="checkbox"` with `aria-checked`
- Toggle has `aria-label` with section name
- Keyboard: Tab through toggles, Enter/Space to toggle, Escape to close panel
- Focus trap within panel when open
- Focus returns to ⚙️ button on close

---

## 6. Result Card Component

### 6.1 Purpose

A vertical full-detail horoscope card that displays all enabled sections. Supports collapse/expand, bookmarking, and navigation to full detail.

### 6.2 Wireframe — Expanded State

```
┌──────────────────────────────────────────────────────────────┐
│  ResultHeader                                                │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  John Doe                    [Score: 87%]  [🔖] [▼]     ││
│  │  Aries Ascendant (12.5°)     [Open Full Detail →]        ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ResultChartsSection (if enabled)                            │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  Charts:                                                 ││
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                  ││
│  │  │  Birth   │ │ Navamsa  │ │  House   │ ◄── scroll →     ││
│  │  │  Chart   │ │  (D9)    │ │  Chart   │                  ││
│  │  │ [280x280]│ │ [280x280]│ │ [280x280]│                  ││
│  │  └──────────┘ └──────────┘ └──────────┘                  ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ResultCalculationsSection (if enabled)                      │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  Calculations:                                           ││
│  │  ● Ascendant: Aries (Mesha) at 5° 12'                   ││
│  │  ● Planets:                                              ││
│  │    - Sun (Ravi) in Aries, 1st House, Ashwini Pada 2     ││
│  │    - Moon (Chandra) in Cancer, 4th House, Pushya Pada 3  ││
│  │    - Mars (Kuja) in Scorpio, 8th House                   ││
│  │    - ...                                                  ││
│  │  ● Nakshatra: Ashwini, Pada 2                            ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ResultDashasSection (if enabled)                            │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  Dashas:                                                 ││
│  │  Current: Jupiter Mahadasha > Venus Antardasha           ││
│  │  ● Jupiter Mahadasha (2003-2019)                         ││
│  │    ├─ Venus AD (2017-2019) [Active]                      ││
│  │    ├─ Sun AD (2019-2020)                                 ││
│  │    └─ ...                                                ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ResultYogasSection (if enabled)                             │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  Yogas:                                                  ││
│  │  ● Parivartana Yoga — Mutual exchange (H1↔H5)           ││
│  │  ● Dharma-karmadhipati Yoga — H1 & H9 lords             ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ResultDoshasSection (if enabled)                            │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  Doshas:                                                 ││
│  │  ● Manglik Dosha — Mars in H1, H7 (Medium severity)     ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ResultActions                                               │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  [🔖 Bookmark]  [📋 Copy Link]  [📊 Export]              ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

### 6.3 Wireframe — Collapsed State

```
┌──────────────────────────────────────────────────────────────┐
│  John Doe                    [Score: 87%]  [🔖] [▶]         │
│  Aries Ascendant (12.5°)     [Open Full Detail →]            │
└──────────────────────────────────────────────────────────────┘
```

### 6.4 Props

| Prop | Type | Description |
|------|------|-------------|
| `horoscope` | `Horoscope` | Full horoscope data with calculated details |
| `score` | `number` | Relevance score (0.0–1.0) |
| `matchedConditions` | `string[]` | Conditions that matched for this result |
| `config` | `FilterConfig` | Current section visibility config |
| `isExpanded` | `boolean` | Whether card is expanded |
| `onToggleExpand` | `() => void` | Expand/collapse handler |
| `onBookmark` | `(horoscopeId: string) => void` | Bookmark handler |
| `isBookmarked` | `boolean` | Whether this horoscope is bookmarked |
| `language` | `'si' \| 'en'` | Current UI language |

### 6.5 ResultHeader Sub-Component

| Element | Details |
|---------|---------|
| Name | Horoscope name (or anonymous placeholder if displayName=false and not owner) |
| Score Badge | Pill badge showing percentage: "87% match" / "87% ගැළපීම" — color fades from green (high) to amber (low) |
| Ascendant | Ascendant sign + degree below name |
| Bookmark icon | 🔖 toggle — filled when bookmarked, outline when not |
| Expand/Collapse icon | ▼ (expanded) / ▶ (collapsed) — rotates 90° on toggle |
| Open Full Detail link | Text link "Open Full Detail →" / "සම්පූර්ණ විස්තරය →" |
| Privacy badge | 🔒 Private / 🌐 Public / 👤 Name Hidden — shown per privacy spec |

### 6.6 Score Badge Design

| Score Range | Color | Label |
|-------------|-------|-------|
| 0.8 – 1.0 | `--success` (green) bg at 15%, `--success` text | "Excellent match" / "ඉතා හොඳ ගැළපීම" |
| 0.6 – 0.79 | `--primary` (indigo) bg at 15%, `--primary` text | "Strong match" / "ශක්තිමත් ගැළපීම" |
| 0.4 – 0.59 | `--warning` (amber) bg at 15%, `--warning` text | "Moderate match" / "මධ්‍යස්ථ ගැළපීම" |
| 0.0 – 0.39 | `--text-secondary` bg at 10%, `--text-secondary` text | "Weak match" / "දුර්වල ගැළපීම" |

### 6.7 Charts Section

| Property | Value |
|----------|-------|
| Container | `overflow-x: auto` with horizontal scroll |
| Each chart | `min-width: 280px`, `aspect-ratio: 1:1` |
| Gap between charts | 16px |
| Chart rendering | Lazy via IntersectionObserver (rootMargin: "200px") — only renders when card is near viewport |
| Chart types shown | Controlled by config (birthChart, navamsaD9, houseChart, etc.) |
| Scroll indicator | Subtle shadow on right edge when content overflows |
| Scroll hint | "← scroll →" text hint on first load if charts overflow |

### 6.8 Collapse/Expand Behavior

| Behavior | Details |
|----------|---------|
| Default state | All cards expanded on fresh search |
| Toggle | Click ▼/▶ icon OR click card header area |
| Multiple expanded | Any number of cards can be expanded simultaneously (no accordion constraint) |
| Toggle-all | "Collapse All" / "Expand All" button at top of results list |
| Collapsed content | Name, ascendant, score badge, bookmark icon, expand icon only — zero chart rendering |
| Expanded content | All enabled sections visible |
| Animation | Height transition `max-height: 0 → auto` with 300ms `ease-out` for expand, 200ms `ease-in` for collapse |
| Chevron rotation | 90° rotation (▼ → ▶) with 200ms `ease-in-out` |

### 6.9 States

| State | Visual |
|-------|--------|
| Expanded | Full card with all enabled sections; ▼ icon |
| Collapsed | Compact summary: name + ascendant + score + 🔖 + ▶ icon |
| Loading (charts) | Chart skeleton placeholder (280x280 pulsing rectangle) within charts section |
| Loading (full card) | Entire card is skeleton: header skeleton + 3 chart skeletons + section skeletons |
| Error (chart render) | Inline error within chart area: "Chart failed to render" with retry icon |
| No data for section | Section header visible, content area shows "No data available" / "දත්ත නොමැත" |
| Bookmark saved | 🔖 icon changes to filled state, brief highlight flash (200ms) |
| Bookmark removed | 🔖 icon changes to outline state |

---

## 7. Search History Panel

### 7.1 Purpose

Dropdown panel showing recent search queries. Users can click to re-run or clear entries.

### 7.2 Wireframe

```
┌─── Search History ───────────────────────────────────┐
│                                                       │
│  Recent Searches                    [Clear All 🗑️]   │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │ 🕐 "මේෂ ලග්නයේ ශනි උච්ච"     Jul 27, 2:30 PM  │ │
│  │    12 results  🇱🇰 Sinhala  [complex]            │ │
│  ├─────────────────────────────────────────────────┤ │
│  │ 🕐 "Aries ascendant"            Jul 27, 1:15 PM  │ │
│  │    5 results   🇬🇧 English  [basic]              │ │
│  ├─────────────────────────────────────────────────┤ │
│  │ 🕐 "ගුරු 3 භාවයේ"                Jul 26, 9:00 AM  │ │
│  │    8 results   🇱🇰 Sinhala  [basic]              │ │
│  ├─────────────────────────────────────────────────┤ │
│  │ 🕐 "Parivartana yoga present"  Jul 25, 4:45 PM  │ │
│  │    3 results   🇬🇧 English  [complex]            │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
└───────────────────────────────────────────────────────┘
```

### 7.3 Elements

| Element | Details |
|---------|---------|
| Title | "Recent Searches" / "මෑත සෙවුම්" |
| Clear All button | "Clear All 🗑️" / "සියල්ල මකන්න 🗑️" — requires confirmation dialog |
| Entry: Query text | Truncated to 60 chars with ellipsis |
| Entry: Date/time | Relative time: "Jul 27, 2:30 PM" / "ජූලි 27, ප.ව. 2:30" |
| Entry: Result count | "12 results" / "ප්‍රතිඵල 12" |
| Entry: Language | 🇱🇰 or 🇬🇧 flag + language name |
| Entry: Source | "basic" / "complex" badge |
| Entry: Delete icon | 🗑️ per-entry delete |
| Entry: Click | Fills search input, triggers search |

### 7.4 Behavior

| Behavior | Details |
|----------|---------|
| Trigger | 📋 History icon in actions bar |
| Max entries | 50 per user (oldest auto-purged) |
| Deduplication | Consecutive identical queries within 5 minutes update timestamp instead of creating new entry |
| Clear all | Confirmation dialog required: "Clear all search history? This cannot be undone." |
| Clear single | Click 🗑️ on entry — no confirmation needed |
| Auto-record | Every search query is automatically recorded |
| Empty state | "No search history yet." / "තවම සෙවුම් ඉතිහාසය නැත." |

### 7.5 Accessibility

- `role="dialog"` on panel
- `aria-label="Search history"` / "සෙවුම් ඉතිහාසය"
- Each entry: `role="button"` with `tabindex="0"`, `aria-label` with full query text
- Clear All: `aria-label="Clear all search history"`
- Keyboard: Tab through entries, Enter to select, Escape to close

---

## 8. Saved Searches Panel

### 8.1 Purpose

List of saved search queries with names, last run time, and result count. Users can re-run, edit, or delete saved searches.

### 8.2 Wireframe

```
┌─── Saved Searches ──────────────────────────────────┐
│                                                       │
│  Saved Searches                                       │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │ 🔍 "Manglik Dasha Study"                        │ │
│  │    Query: "මංගල දෝෂය සහිත"                       │ │
│  │    Config: Birth Chart, Navamsa, Yogas           │ │
│  │    Last run: Jul 27, 2:30 PM (15 results)        │ │
│  │    [Run] [Edit Name] [Delete]                    │ │
│  ├─────────────────────────────────────────────────┤ │
│  │ 🔍 "Saturn Exaltation Research"                  │ │
│  │    Query: "ශනි උච්ච"                              │ │
│  │    Config: All charts, Strengths                  │ │
│  │    Last run: Jul 20, 10:00 AM (8 results)        │ │
│  │    [Run] [Edit Name] [Delete]                    │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  ℹ️ Maximum 50 saved searches.                        │
│                                                       │
└───────────────────────────────────────────────────────┘
```

### 8.3 Elements

| Element | Details |
|---------|---------|
| Title | "Saved Searches" / "සුරැකුම් සෙවුම්" |
| Entry: Name | User-defined label, bold text |
| Entry: Query | The saved query text |
| Entry: Config summary | Brief list of enabled sections |
| Entry: Last run | Date/time + result count |
| Entry: Run button | "Run" / "ක්‍රියාත්මක කරන්න" — re-runs the search with saved query and config |
| Entry: Edit Name | Inline edit of the saved search name |
| Entry: Delete | Removes the saved search |
| Max limit notice | "Maximum 50 saved searches." / "උපරිම සුරැකුම් සෙවුම් 50." |

### 8.4 Save Search Flow

```
User clicks "Save Search" button in actions bar →
  → Modal appears: "Save this search" / "මෙම සෙවුම සුරකින්න" →
  → Input: Name (required) →
  → Shows current query and config summary →
  → [Cancel] [Save] →
  → POST /api/search/filter →
  → Success toast: "Search saved!" / "සෙවුම සුරැකිණි!" →
  → Entry appears in saved searches list
```

### 8.5 Save Search Modal

```
┌─── Save Search ────────────────────────────────────┐
│                                                     │
│  Save this search / මෙම සෙවුම සුරකින්න            │
│                                                     │
│  Name *                                             │
│  ┌──────────────────────────────────────────────┐  │
│  │ Manglik Dasha Study                          │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  Query: "මංගල දෝෂය සහිත"                            │
│                                                     │
│  Config: Birth Chart, Navamsa, Yogas                │
│                                                     │
│  ⚠️ A saved search with this name already exists.   │
│     Overwrite?                                      │
│                                                     │
│  [Cancel]  [Save]                                   │
└─────────────────────────────────────────────────────┘
```

### 8.6 Behavior

| Behavior | Details |
|----------|---------|
| Duplicate name | Warning: "A saved search with this name already exists. Overwrite?" with [Overwrite] [Rename] options |
| Empty query | Validation: "Please enter a search query before saving" / "සුරැකීමට පෙර සෙවුම් වාක්‍යයක් ඇතුළත් කරන්න" |
| Run saved search | Fills search input, applies saved config, triggers search |
| Edit name | Inline edit: click name → input field → Enter to save, Escape to cancel |
| Delete | Confirmation: "Delete this saved search?" / "මෙම සුරැකුම් සෙවුම මකන්නද?" |

---

## 9. Bookmarks Panel

### 9.1 Purpose

List of bookmarked horoscopes from search results. Users can view bookmarks, add notes, navigate to detail, or remove bookmarks.

### 9.2 Wireframe

```
┌─── Bookmarks ────────────────────────────────────────────┐
│                                                           │
│  Bookmarks / සුරැකුම්                                     │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ 📋 John Doe                                         │ │
│  │    Aries Ascendant | Born: 1990-01-15               │ │
│  │    Query context: "මංගල දෝෂය"                       │ │
│  │    Note: "Interesting Mars placement"                │ │
│  │    Saved: Jul 27, 2:30 PM                           │ │
│  │    [Open] [Edit Note] [Remove]                      │ │
│  ├─────────────────────────────────────────────────────┤ │
│  │ 📋 Anonymous Horoscope #A3F2                        │ │
│  │    Leo Ascendant | Born: 1985-06-20                 │ │
│  │    Query context: "රැකියාව ගුරු වෘත්තිය"             │ │
│  │    No note                                          │ │
│  │    Saved: Jul 25, 10:00 AM                          │ │
│  │    [Open] [Add Note] [Remove]                       │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  ℹ️ Maximum 100 bookmarks.                                │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### 9.3 Elements

| Element | Details |
|---------|---------|
| Title | "Bookmarks" / "සුරැකුම්" |
| Entry: Name | Horoscope name (or anonymous placeholder) |
| Entry: Ascendant | Ascendant sign + birth date |
| Entry: Query context | The search query that led to bookmarking |
| Entry: Note | Optional user note (editable) |
| Entry: Saved date | Date/time bookmarked |
| Entry: Open button | "Open" / "විවෘත කරන්න" — navigates to horoscope detail |
| Entry: Edit Note | Inline edit of note |
| Entry: Remove | Removes bookmark |

### 9.4 Add Bookmark Flow

```
User clicks 🔖 on a search result card →
  → Bookmark saved (POST /api/search/bookmark) →
  → Icon fills (instant feedback) →
  → Brief highlight flash (200ms) →
  → Optional: toast "Bookmark added" / "සුරැකුම එකතු කරන ලදී"
  → Optional: inline note input appears below bookmark icon
```

### 9.5 Behavior

| Behavior | Details |
|----------|---------|
| Toggle bookmark | Click 🔖 on card → bookmark/unbookmark (toggle) |
| Max bookmarks | 100 per user |
| Bookmarked horoscope deleted | Entry shows "Horoscope no longer available" / "ලග්නය තවම නොපවතී" placeholder |
| Bookmarked horoscope made private | Entry still exists; viewing respects privacy rules |
| Note editing | Click "Edit Note" → inline textarea → Enter to save, Escape to cancel |

---

## 10. Export Functionality

### 10.1 Export Button

| Element | Details |
|---------|---------|
| Trigger | "Export CSV" / "JSON Export" buttons in actions bar |
| Dropdown | Click Export → dropdown with format options: CSV, JSON |
| Disabled state | Disabled when no results: "No results to export" / "エක්ස්පෝර්ට කිරීමට ප්‍රතිඵල නැත" |
| Scope | Exports current page only (not entire result set) |
| Max rows | 100 rows max per export |
| Download | Automatic file download: "search-results.csv" or "search-results.json" |

### 10.2 Export Behavior

| Behavior | Details |
|----------|---------|
| CSV columns | Name, Ascendant, Birth Chart, Navamsa, House Chart, Planet Positions, Dashas, Yogas, Doshas |
| JSON format | Same shape as POST /api/search response but flattened |
| Anonymous names | Export respects privacy: anonymous placeholders for non-owner displayName=false |
| Config respect | Only visible sections (per current config) are exported |
| Rate limit | 10 requests per minute per user |

---

## 11. Empty States

| Context | Message (EN) | Message (SI) | Action |
|---------|-------------|--------------|--------|
| No search query entered | "Type a natural language query to search horoscopes." | "ලග්න සොයන්න ස්වාභාවික භාෂා වාක්‍යයක් ටයිප් කරන්න." | Show suggestions + recent history |
| No results found | "No horoscopes match your query. Try broadening your search or using different terms." | "ඔබේ සෙවුමට ගැළපෙන ලග්න නැත. සෙවුම පුළුල් කරන්න හෝ වෙනත් පද භාවිතා කරන්න." | Suggest common terms or recent searches |
| Search failed | "Search failed. Please try again." | "සෙවුම අසාර්ථකයි. නැවත උත්සාහ කරන්න." | Retry button |
| Rate limited | "Too many searches. Please wait {seconds} seconds." | "සෙවුම් වැඩියි. තත්පර {seconds} ක් රැඳී සිටින්න." | Auto-retry countdown |
| No saved searches | "No saved searches yet." | "තවම සුරැකුම් සෙවුම් නැත." | "Save a search" prompt |
| No bookmarks | "No bookmarks yet. Bookmark horoscopes from search results to save them here." | "තවම සුරැකුම් නැත. සෙවුම් ප්‍රතිඵලවලින් ලග්න සුරැකින්න." | Navigate to search |
| No search history | "No search history yet." | "තවම සෙවුම් ඉතිහාසය නැත." | (No action) |
| Partial query understanding | "We understood {n} of {m} conditions. Results are based on the understood conditions." | "අපි කොන්දේසි {m} න් {n} ක් තේරුම් ගත්තෙමු. ප්‍රතිඵල තේරුම් ගත් කොන්දේසි මත පදනම් වේ." | Info banner (not blocking) |
| Contradictory conditions | "Your search conditions appear contradictory. No results found." | "ඔබේ සෙවුම් කොන්දේසි පරස්පර විරෝධී බව පෙනේ. ප්‍රතිඵල නැත." | Suggest simplifying query |
| Career query disclaimer | "These results are suggestions based on astrological principles and should not be considered as professional advice." | "මේවා ජ්‍යොතිෂ මූලධර්ම මත පදනම් වූ යෝජනා වන අතර වෘත්තීය උපදේශයක් ලෙස සැලකිය යුතු නැත." | Info banner below results |

---

## 12. Loading States

### 12.1 Search Loading Skeleton

While search is in progress, show skeleton cards matching the result card shape:

```
┌─── Skeleton Result Card ──────────────────────────────┐
│  ████████████████████████████████████████████████████  │
│  ████████████████████  ██████████████████████████████  │
├──────────────────────────────────────────────────────┤
│  ████████████████████████████████████████████████████  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│  │ ████████ │ │ ████████ │ │ ████████ │              │
│  │ ████████ │ │ ████████ │ │ ████████ │              │
│  └──────────┘ └──────────┘ └──────────┘              │
├──────────────────────────────────────────────────────┤
│  ████████████████████████████████████████████████████  │
│  ████████████████████████████████████████████████████  │
│  ████████████████████████████████████████████████████  │
├──────────────────────────────────────────────────────┤
│  ████████████████████████████████████████████████████  │
│  ████████████████████████████████████████████████████  │
└──────────────────────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| Number of skeletons | 3 (matching default page size) |
| Skeleton rows per card | Header + 3 chart placeholders + 2 section placeholders |
| Chart skeleton | 280x280 pulsing rectangle |
| Animation | `pulse` — opacity 0.4 → 1 → 0.4, 1.5s infinite |
| Color | `--surface-elevated` |
| Transition on load | Fade out skeletons (150ms) + fade in content (200ms) |

### 12.2 Config Save Loading

| State | Visual |
|-------|--------|
| Saving config | Small spinner next to ⚙️ icon; toggles remain interactive |
| Config saved | Brief checkmark flash on ⚙️ icon (200ms) |

---

## 13. Pagination

### 13.1 Wireframe

```
┌─── Pagination ─────────────────────────────────────────┐
│                                                         │
│  [← Previous]  Page 1 of 9  [Next →]                   │
│                                                         │
│  ─── or ───                                             │
│                                                         │
│  [← Previous]  [1] [2] [3] ... [9]  [Next →]           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 13.2 Elements

| Element | Details |
|---------|---------|
| Previous button | Disabled on page 1 |
| Next button | Disabled on last page |
| Page numbers | Shown on desktop; hidden on mobile (just prev/next) |
| Current page indicator | Bold, primary color background |
| Page info | "Page 1 of 9" / "පිටුව 1 න් 9" |
| Total count | "Found 42 horoscopes (showing 1-5)" / "ලග්න 42 ක් හමු විය (1-5 පෙන්වයි)" |

### 13.3 Behavior

| Behavior | Details |
|----------|---------|
| Page size | Default 5 results per page (configurable: max 20) |
| URL sync | Page number reflected in URL query params (`?page=1&query=...`) for shareability |
| Filter change | Resets to page 1 when filters/query change |
| Rapid navigation | Debounced page change to avoid multiple simultaneous API calls |
| Scroll position | Scrolls to top of results list on page change |

### 13.4 Mobile Pagination

```
┌─────────────────────────────────────┐
│  [← Prev]  Page 1 of 9  [Next →]   │
└─────────────────────────────────────┘
```

Page numbers are hidden on mobile; only prev/next with page info.

---

## 14. Query Understanding Banner

### 14.1 Purpose

When the RAG pipeline parses a complex query, a banner shows the user which conditions were understood. This addresses US-008 edge case: partial condition parsing.

### 14.2 Wireframe

```
┌─── Query Understanding ─────────────────────────────────────────┐
│                                                                   │
│  ✅ Query understood (confidence: 92%):                           │
│     Aries Ascendant, Saturn Exaltation, Jupiter in 3rd House     │
│                                                                   │
│  ─── or (partial) ───                                            │
│                                                                   │
│  ⚠️ We understood 3 of 5 conditions:                              │
│     Aries Ascendant, Saturn Exaltation, Jupiter in 3rd House     │
│     The following conditions were not recognized:                 │
│     "Jupiter not receiving beneficial aspects"                    │
│                                                                   │
│  ─── or (low confidence) ───                                     │
│                                                                   │
│  ⚠️ Query interpreted with limited confidence (45%):              │
│     Results may not fully match your intended search.            │
│     Try rephrasing for better results.                            │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

### 14.3 Design

| Element | Details |
|---------|---------|
| Icon | ✅ (high confidence ≥ 0.8), ⚠️ (medium 0.5–0.79), ❌ (low < 0.5) |
| Background | `--success` at 5% (high), `--warning` at 5% (medium), `--error` at 5% (low) |
| Border | 1px left border in matching color |
| Confidence | Shown as percentage: "confidence: 92%" |
| Parsed conditions | Listed as comma-separated items |
| Unrecognized conditions | Listed separately under "not recognized" |
| Dismiss | Auto-dismiss after 8 seconds or manual close (X) |
| Position | Below search input, above results |

### 14.4 Accessibility

- `role="status"` with `aria-live="polite"`
- Icon is decorative; text provides meaning
- Color is not sole indicator (icon + text + border)

---

## 15. Responsive Behavior

### 15.1 Desktop (> 1024px)

| Element | Behavior |
|---------|----------|
| Search input | Full width within main content area |
| Config panel | Slide-out from right (320px wide) |
| Result cards | Full width, horizontal chart scroll |
| Actions bar | Horizontal row with all action buttons |
| Pagination | Full with page numbers |
| History/Saved/Bookmarks | Dropdown panels from actions bar icons |

### 15.2 Tablet (640px – 1024px)

| Element | Behavior |
|---------|----------|
| Search input | Full width |
| Config panel | Slide-out from right (280px) or modal |
| Result cards | Full width, horizontal chart scroll |
| Actions bar | Horizontal row, icons only (labels hidden) |
| Pagination | Prev/Next + page numbers |
| History/Saved/Bookmarks | Dropdown panels |

### 15.3 Mobile (< 640px)

| Element | Behavior |
|---------|----------|
| Search input | Full width, sticky at top |
| Config panel | Slide-up bottom sheet (full width) |
| Result cards | Full width, horizontal chart scroll |
| Actions bar | Horizontal scrollable row, icons only |
| Pagination | Prev/Next only (no page numbers) |
| History/Saved/Bookmarks | Slide-up bottom sheets |
| Charts | min-width 280px, horizontal scroll within card |
| Score badge | Compact: just percentage, no label text |
| Bookmark icon | 44x44px touch target |
| Collapse/Expand icon | 44x44px touch target |
| Export dropdown | Full-width bottom sheet options |

### 15.4 Mobile Result Card

```
┌─────────────────────────────────────┐
│  John Doe              [87%] [🔖]   │
│  Aries Ascendant        [▼]         │
│                                     │
│  Charts: (horizontal scroll)        │
│  ┌──────┐┌──────┐┌──────┐          │
│  │Birth ││Navam.││House│ ← scroll   │
│  │Chart ││  D9  ││Chart│           │
│  └──────┘└──────┘└──────┘          │
│                                     │
│  Calculations:                      │
│  ● Ascendant: Aries 5° 12'         │
│  ● Planets:                         │
│    Sun in Aries, H1                 │
│    Moon in Cancer, H4               │
│    ...                              │
│                                     │
│  Dashas: (accordion)                │
│  ● Jupiter MD (2003-2019)           │
│    └─ Venus AD (active)             │
│                                     │
│  [🔖 Bookmark] [📋 Copy] [📊 CSV]   │
└─────────────────────────────────────┘
```

---

## 16. Micro-interactions

| Action | Effect |
|--------|--------|
| Type in search input | Language indicator updates in real-time (100ms transition) |
| Search fires | Input shows spinner, results skeleton fades in (200ms) |
| Results load | Skeletons fade out (150ms), cards fade in with stagger (50ms delay per card) |
| Click suggestion | Input fills with slide-in animation (150ms), search fires |
| Toggle config section | Section appears/disappears with `max-height` transition (200ms) |
| Config save | ⚙️ icon gets brief checkmark flash (200ms) |
| Collapse card | Content collapses with `max-height` transition (200ms ease-in), chevron rotates (200ms) |
| Expand card | Content expands with `max-height` transition (300ms ease-out), chevron rotates (200ms) |
| Bookmark toggle | 🔖 icon fills/empties with scale pulse (200ms), toast slides in |
| Bookmark saved | Icon scale: 1.0 → 1.2 → 1.0 (200ms) |
| Page change | Results area crossfade (150ms out, 200ms in) |
| Config panel open | Desktop: slide from right (250ms ease-out); Mobile: slide up from bottom (300ms ease-out) |
| Config panel close | Desktop: slide to right (200ms ease-in); Mobile: slide down (200ms ease-in) |
| History dropdown open | Slide down (200ms ease-out) |
| History entry hover | Background tint (100ms) |
| Export download | Brief loading spinner on export button, then file downloads |
| Error banner | Slide down from top of results area (200ms ease-out) |
| Query understanding banner | Slide down below input (200ms), auto-dismiss fade out (8s) |
| Score badge | Color transition when score changes (150ms) |

---

## 17. Accessibility

### 17.1 Keyboard Navigation

| Key | Action |
|-----|--------|
| `/` (forward slash) | Focus search input (global shortcut) |
| `Tab` | Navigate through: search input → actions bar → config button → results → pagination |
| `Enter` | Submit search, activate buttons, expand/collapse cards |
| `Escape` | Close config panel, close history dropdown, close suggestions |
| `Arrow keys` | Navigate within pagination, navigate suggestion list |
| `Space` | Toggle checkboxes in config panel, bookmark toggle |

### 17.2 Screen Reader Support

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

### 17.3 Color Contrast

- Score badges: text on tinted background meets 4.5:1 ratio
- Privacy badges: text on tinted background meets 4.5:1
- Focus rings: 2px solid `--primary` with 2px offset on all interactive elements
- Chart labels: high contrast text on chart background
- Skeleton loading: sufficient contrast for visible pulsing

### 17.4 Focus Management

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

## 18. Bilingual Content Map

### 18.1 Search Input

| Key | English | Sinhala |
|-----|---------|---------|
| `search.title` | Search Horoscopes | ලග්න සොයන්න |
| `search.placeholder` | Search horoscopes using natural language... | ස්වාභාවික භාෂාවෙන් ලග්න සොයන්න... |
| `search.button` | Search | සොයන්න |
| `search.clear` | Clear | මකන්න |
| `search.searching` | Searching... | සොයමින්... |
| `search.language_detected` | {language} detected | {language} හඳුනා ගන්නා ලදී |
| `search.suggestions_title` | Suggestions | යෝජනා |
| `search.recent_title` | Recent Searches | මෑත සෙවුම් |
| `search.query_too_long` | Query too long — try a shorter phrase | සෙවුම දිග වැඩියි — කෙටි වාක්‍යයක් උත්සාහ කරන්න |

### 18.2 Results

| Key | English | Sinhala |
|-----|---------|---------|
| `search.results_found` | Found {count} horoscopes (showing {from}-{to}) | ලග්න {count} ක් හමු විය ({from}-{to} පෙන්වයි) |
| `search.no_results` | No horoscopes match your query. | ඔබේ සෙවුමට ගැළපෙන ලග්න නැත. |
| `search.no_results_hint` | Try broadening your search or using different terms. | සෙවුම පුළුල් කරන්න හෝ වෙනත් පද භාවිතා කරන්න. |
| `search.sort_relevance` | Relevance | ගැළපීම |
| `search.sort_name_az` | Name (A-Z) | නම (A-Z) |
| `search.sort_date_newest` | Date Created (newest) | නිර්මාණ දිනය (අලුත්ම) |
| `search.sort_date_oldest` | Date Created (oldest) | නිර්මාණ දිනය (පැරණිම) |
| `search.sort_ascendant` | Ascendant Sign | ලග්න රාශිය |
| `search.collapse_all` | Collapse All | සියල්ල හකුළන්න |
| `search.expand_all` | Expand All | සියල්ල විස්තාරණය කරන්න |
| `search.score_match` | {score}% match | {score}% ගැළපීම |
| `search.open_detail` | Open Full Detail | සම්පූර්ණ විස්තරය විවෘත කරන්න |

### 18.3 Config Panel

| Key | English | Sinhala |
|-----|---------|---------|
| `search.config_title` | Result Configuration | ප්‍රතිඵල වින්‍යාසය |
| `search.config_reset` | Reset to Defaults | පෙරනිමි වලට යළි සකසන්න |
| `search.config_select_all` | Select All | සියල්ල තෝරන්න |
| `search.config_deselect_all` | Deselect All | සියල්ල අවලංගු කරන්න |
| `search.config_charts` | Charts | සටහන් |
| `search.config_calculations` | Calculations | ගණනය කිරීම් |
| `search.config_strengths` | Strengths & Aspects | බලය සහ දෘෂ්ටි |
| `search.config_yogas` | Yogas & Doshas | යෝග සහ දෝෂ |
| `search.config_other` | Other | වෙනත් |

### 18.4 Actions

| Key | English | Sinhala |
|-----|---------|---------|
| `search.save_search` | Save Search | සෙවුම සුරකින්න |
| `search.history` | History | ඉතිහාසය |
| `search.bookmarks` | Bookmarks | සුරැකුම් |
| `search.export_csv` | Export CSV | CSV එක්ස්පෝර්ට |
| `search.export_json` | Export JSON | JSON එක්ස්පෝර්ට |
| `search.bookmark_add` | Bookmark | සුරැකින්න |
| `search.bookmark_remove` | Remove Bookmark | සුරැකුම ඉවත් කරන්න |
| `search.bookmark_added` | Bookmark added | සුරැකුම එකතු කරන ලදී |
| `search.bookmark_removed` | Bookmark removed | සුරැකුම ඉවත් කරන ලදී |

### 18.5 History

| Key | English | Sinhala |
|-----|---------|---------|
| `search.history_title` | Search History | සෙවුම් ඉතිහාසය |
| `search.history_clear_all` | Clear All | සියල්ල මකන්න |
| `search.history_clear_confirm` | Clear all search history? This cannot be undone. | සියලුම සෙවුම් ඉතිහාසය මකන්නද? මෙය ආපසු හැරවිය නොහැක. |
| `search.history_results` | {count} results | ප්‍රතිඵල {count} |
| `search.history_empty` | No search history yet. | තවම සෙවුම් ඉතිහාසය නැත. |
| `search.history_basic` | basic | මූලික |
| `search.history_complex` | complex | සංකීර්ණ |

### 18.6 Saved Searches

| Key | English | Sinhala |
|-----|---------|---------|
| `search.saved_title` | Saved Searches | සුරැකුම් සෙවුම් |
| `search.saved_empty` | No saved searches yet. | තවම සුරැකුම් සෙවුම් නැත. |
| `search.saved_run` | Run | ක්‍රියාත්මක කරන්න |
| `search.saved_edit_name` | Edit Name | නම සංස්කරණය |
| `search.saved_delete` | Delete | මකන්න |
| `search.saved_delete_confirm` | Delete this saved search? | මෙම සුරැකුම් සෙවුම මකන්නද? |
| `search.saved_last_run` | Last run: {date} ({count} results) | අවසන් ක්‍රියාත්මක කිරීම: {date} (ප්‍රතිඵල {count}) |
| `search.saved_max` | Maximum 50 saved searches. | උපරිම සුරැකුම් සෙවුම් 50. |
| `search.saved_duplicate` | A saved search with this name already exists. | මෙම නමින් සුරැකුම් සෙවුමක් දැනටමත් පවතී. |
| `search.saved_overwrite` | Overwrite? | ආවරණය කරන්නද? |

### 18.7 Bookmarks

| Key | English | Sinhala |
|-----|---------|---------|
| `search.bookmarks_title` | Bookmarks | සුරැකුම් |
| `search.bookmarks_empty` | No bookmarks yet. Bookmark horoscopes from search results to save them here. | තවම සුරැකුම් නැත. සෙවුම් ප්‍රතිඵලවලින් ලග්න සුරැකින්න. |
| `search.bookmarks_open` | Open | විවෘත කරන්න |
| `search.bookmarks_edit_note` | Edit Note | සටහන සංස්කරණය |
| `search.bookmarks_remove` | Remove | ඉවත් කරන්න |
| `search.bookmarks_no_note` | No note | සටහනක් නැත |
| `search.bookmarks_max` | Maximum 100 bookmarks. | උපරිම සුරැකුම් 100. |
| `search.bookmarks_unavailable` | Horoscope no longer available | ලග්නය තවම නොපවතී |

### 18.8 Export

| Key | English | Sinhala |
|-----|---------|---------|
| `search.export_disabled` | No results to export | එක්ස්පෝර්ට කිරීමට ප්‍රතිඵල නැත |
| `search.exporting` | Exporting... | එක්ස්පෝර්ට කරමින්... |
| `search.export_success` | Export complete | එක්ස්පෝර්ට සම්පූර්ණයි |

### 18.9 Query Understanding

| Key | English | Sinhala |
|-----|---------|---------|
| `search.understood_all` | Query understood (confidence: {pct}%): | සෙවුම තේරුම් ගන්නා ලදී (විශ්වාසය: {pct}%): |
| `search.understood_partial` | We understood {n} of {m} conditions: | අපි කොන්දේසි {m} න් {n} ක් තේරුම් ගත්තෙමු: |
| `search.not_recognized` | The following conditions were not recognized: | පහත කොන්දේසි හඳුනා ගැනීමට නොහැකි විය: |
| `search.low_confidence` | Query interpreted with limited confidence ({pct}%): | සීමිත විශ්වාසයකින් සෙවුම පරිවර්තනය කරන ලදී ({pct}%): |
| `search.rephrase_hint` | Try rephrasing for better results. | හොඳ ප්‍රතිඵල සඳහා නැවත වාක්‍ය රචනය කරන්න. |

### 18.10 Pagination

| Key | English | Sinhala |
|-----|---------|---------|
| `search.pagination_prev` | Previous | පෙර |
| `search.pagination_next` | Next | ඊළඟ |
| `search.pagination_page` | Page {current} of {total} | පිටුව {current} න් {total} |

### 18.11 Errors

| Key | English | Sinhala |
|-----|---------|---------|
| `search.error_failed` | Search failed. Please try again. | සෙවුම අසාර්ථකයි. නැවත උත්සාහ කරන්න. |
| `search.error_rate_limited` | Too many searches. Please wait {seconds} seconds. | සෙවුම් වැඩියි. තත්පර {seconds} ක් රැඳී සිටින්න. |
| `search.error_empty_query` | Please enter a search query. | සෙවුම් වාක්‍යයක් ඇතුළත් කරන්න. |
| `search.error_save_failed` | Failed to save. Please try again. | සුරැකීම අසාර්ථකයි. නැවත උත්සාහ කරන්න. |
| `search.error_contradictory` | Your search conditions appear contradictory. No results found. | ඔබේ සෙවුම් කොන්දේසි පරස්පර විරෝධී බව පෙනේ. ප්‍රතිඵල නැත. |
| `search.error_save_empty` | Please enter a search query before saving. | සුරැකීමට පෙර සෙවුම් වාක්‍යයක් ඇතුළත් කරන්න. |

---

## 19. Component Architecture

### 19.1 Component Tree

```
SearchPage
├── SearchBar
│   ├── SearchInput (textarea + language indicator)
│   ├── SearchSuggestions (dropdown)
│   └── SearchButton
├── ActionsBar
│   ├── ConfigToggleButton (⚙️)
│   ├── SaveSearchButton (💾)
│   ├── HistoryDropdown (📋)
│   ├── ExportDropdown (📊)
│   └── BookmarkLink (🔖)
├── ConfigPanel (slide-out / bottom sheet)
│   ├── ConfigSection "Charts"
│   │   └── ConfigToggle (per chart type)
│   ├── ConfigSection "Calculations"
│   │   └── ConfigToggle (per calc type)
│   ├── ConfigSection "Strengths & Aspects"
│   │   └── ConfigToggle
│   ├── ConfigSection "Yogas & Doshas"
│   │   └── ConfigToggle
│   └── ConfigSection "Other"
│       └── ConfigToggle
├── QueryUnderstandingBanner
├── ResultsHeader
│   ├── ResultsCount
│   ├── SortSelector
│   └── CollapseExpandAll
├── ResultsList
│   ├── SearchResultCard (repeatable)
│   │   ├── ResultHeader
│   │   │   ├── HoroscopeName (or anonymous placeholder)
│   │   │   ├── ScoreBadge
│   │   │   ├── AscendantDisplay
│   │   │   ├── PrivacyBadge
│   │   │   ├── BookmarkToggle
│   │   │   └── ExpandCollapseToggle
│   │   ├── ResultChartsSection (horizontal scroll)
│   │   │   ├── ChartView (Birth — lazy IntersectionObserver)
│   │   │   ├── ChartView (Navamsa D9 — lazy)
│   │   │   ├── ChartView (House — lazy)
│   │   │   └── [additional charts per config]
│   │   ├── ResultCalculationsSection
│   │   │   ├── AscendantDisplay
│   │   │   ├── PlanetPositionsTable
│   │   │   └── NakshatraDisplay
│   │   ├── ResultDashasSection
│   │   │   └── DashaTimeline (compact nested accordion)
│   │   ├── ResultYogasSection
│   │   ├── ResultDoshasSection
│   │   └── ResultActions
│   │       ├── BookmarkButton
│   │       ├── CopyLinkButton
│   │       └── ExportButton
│   └── PaginationControls
├── SearchHistoryPanel (dropdown)
│   └── HistoryEntry (repeatable)
├── SavedSearchesPanel (dropdown)
│   └── SavedSearchEntry (repeatable)
├── BookmarksPanel (dropdown)
│   └── BookmarkEntry (repeatable)
├── SaveSearchModal
├── EmptyState / NoResultsMessage
└── ErrorBanner
```

### 19.2 State Management

| State | Scope | Storage |
|-------|-------|---------|
| Search query | Page-level | URL query param + React state |
| Search results | Page-level | React state (fetched from API) |
| Config (section toggles) | Global per user | Server (POST /api/search/filter) + React state |
| Expanded cards | Local per card | React state (Set of card IDs) |
| Sort order | Session-level | React state |
| Current page | URL-level | URL query param |
| History dropdown open | Local | React state (boolean) |
| Config panel open | Local | React state (boolean) |
| Bookmarked IDs | Session-level | React state (Set of horoscope IDs) |

---

## 20. i18n Considerations

### Sinhala Width Accommodation

- Search input placeholder: Sinhala is ~20% wider; textarea accommodates with min-height
- Score badge: "87% ගැළපීම" is wider than "87% match"; use `min-width` on badge
- Config panel labels: Sinhala labels are 15-25% wider; panel width accommodates
- Result card section headers: Allow wrapping for long Sinhala labels
- Anonymous placeholder: "නිර්නාමික ලග්නය #A3F2" is shorter than English equivalent
- Pagination: "පිටුව 1 න් 9" is wider than "Page 1 of 9"; use flexible layout
- Truncation: Allow 30% more space before ellipsis for Sinhala text

### Font Loading

- Noto Sans Sinhala weights 400, 600 must be preloaded
- All search-related components must use the bilingual font stack: `Inter, 'Noto Sans Sinhala', sans-serif`

---

## 21. File Index

| File | Description |
|------|-------------|
| `specs/ux/main-ux-spec.md` | Master UX reference — updated with search flow, patterns, empty states |
| `specs/ux/20260727-2100-search-horoscope.md` | This document — full Search Horoscope UX specification |

---

## Appendix A: Design Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Search input type | Textarea (auto-resize) | Natural language queries can be multi-line compound sentences; textarea accommodates without feeling cramped |
| Debounce | 300ms | Balances responsiveness with API load; matches existing location search debounce |
| Config panel placement | Slide-out (desktop) / bottom sheet (mobile) | Keeps results visible while configuring; bottom sheet is standard mobile pattern |
| Config persistence scope | Global per user | Most users have consistent display preferences; per-search config adds complexity without clear benefit |
| Result card default state | All expanded | Users expect to see full detail in search results; collapse is opt-in for scanning |
| Page size | 5 | Full-detail cards with charts are tall; 5 per page prevents overwhelming scroll |
| Score visualization | Percentage badge with color tiers | Clear, quantitative, scannable; stars are ambiguous for 0-100% scores |
| Anonymous placeholder | "Anonymous Horoscope #A3F2" | Stable, distinguishable, no PII; matches privacy spec |
| History dedup | 5-minute window | Prevents spam from rapid re-searches while preserving distinct queries |
| Export scope | Current page only | Prevents accidental bulk data extraction; respects rate limits |
| Config save debounce | 500ms | Longer than search debounce to batch rapid toggle changes |
| Collapse/expand default | All expanded | Search results are the primary content; collapsing is secondary |
| Multiple expanded cards | Yes (no accordion) | Users may compare multiple results simultaneously |
| Query understanding banner | Auto-dismiss after 8s | Informational; doesn't block results; user can read at their pace |
| Saved search max | 50 | Generous but bounded; prevents UI clutter |
| Bookmark max | 100 | Generous for research workflows |
