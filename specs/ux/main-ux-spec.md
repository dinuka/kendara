# Kendara — Main UX Specification

**Date:** 2026-07-15 12:30
**Author:** UX (BMAD)
**Based on:** specs/business-analysis/actors.md, specs/business-analysis/data-model.md, specs/business-analysis/20260714-1255-user-stories.md, specs/architecture/overview.md, specs/architecture/20260715-0746-architecture-spec.md, docs/spec.md

---

## Overview

Kendara is a bilingual (Sinhala/English) astrology study web app for students to manage, search, analyze, and share horoscopes. The UX prioritizes:

- **Natural language search** as the core interaction paradigm
- **Bilingual parity** — every element works in both Sinhala and English
- **Progressive disclosure** — complex astrological data shown in layers
- **Study-first design** — metadata, labels, filtering, and export for research workflows

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
  → Fill Form (Name, Date, Time, Location) →
  → Location auto-geocodes (Lat/Lon auto-filled) →
  → User can override Lat/Lon →
  → Submit → Loading spinner ("Calculating...") →
  → Horoscope Detail View (charts + calculations)
```

### Flow 3: Search Horoscopes

```
Search Page → Type natural language query (SI/EN) →
  → System parses (RAG pipeline) →
  → Results displayed as cards →
  → User configures visible sections via Config Panel →
  → Results update in real-time →
  → Click result → Horoscope Detail View
```

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

---

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

### Loading States

| State | Pattern |
|-------|---------|
| Page load | Skeleton screen (pulsing placeholders) |
| Form submit | Button spinner + disabled state |
| Search | Typing indicator + results skeleton |
| Chart render | Chart skeleton with outline |
| Calculation | Progress bar with "Calculating..." |

### Empty States

| Context | Message (EN) | Message (SI) | Action |
|---------|-------------|--------------|--------|
| No horoscopes | "No horoscopes yet. Add your first one!" | "තවම ලග්න නැත. ඔබේ පළමු ලග්නය එකතු කරන්න!" | "Add Horoscope" button |
| No search results | "No horoscopes match your query." | "ඔබේ සෙවුමට ගැළපෙන ලග්න නැත." | Adjust query suggestion |
| No metadata | "No metadata added yet." | "තවම මෙටාඩේටා එකතු කර නැත." | "Add Metadata" button |
| No saved filters | "No saved searches yet." | "තවම සුරැකුම් පෙරහන් නැත." | "Save a search" prompt |
<<<<<<< Updated upstream
=======
| No saved locations | "No saved locations yet. Add your first one!" | "තවම සුරැකි ස්ථාන නැත. ඔබේ පළමු ස්ථානය එකතු කරන්න!" | "Add Location" button |
| No locations match search | "No locations match your search." | "ඔබේ සෙවුමට ගැළපෙන ස්ථාන නැත." | Clear search suggestion |
| Dasha data not available | "Dasha data not available." | "දශා දත්ත නොමැත." | (No action — inline message only) |
| Birth details incomplete for dashas | "Complete birth details to calculate dashas." | "දශා ගණනය කිරීමට උපන් තොරතුරු සම්පූර්ණ කරන්න." | Link to edit horoscope |
>>>>>>> Stashed changes

---

## Accessibility

- **Keyboard navigation**: All interactive elements focusable, visible focus ring (2px solid primary)
- **Screen reader**: ARIA labels on all icons, role attributes on custom components, live regions for search results
- **Color contrast**: Minimum 4.5:1 for text, 3:1 for large text and UI components
- **Skip links**: "Skip to main content" link on page load
- **Alt text**: All chart images have descriptive alt text
- **Form labels**: Every input has a visible or associated label
- **Error announcements**: Errors announced via `aria-live="polite"`

---

## File Index

| File | Description |
|------|-------------|
| `specs/ux/main-ux-spec.md` | This document — master UX reference |
| `specs/ux/20260715-1230-full-app-ux-design.md` | Detailed page-by-page UX design |
