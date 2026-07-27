# Horoscope Privacy Settings — UX Specification

**Date:** 2026-07-27 19:26
**Author:** UX Agent
**Based on:** specs/business-analysis/20260727-1913-privacy-settings.md, specs/business-analysis/data-model.md, specs/architecture/20260727-1926-privacy-settings.md, specs/architecture/overview.md, specs/ux/main-ux-spec.md, specs/ux/20260715-1230-full-app-ux-design.md

---

## 1. Overview

The Horoscope Privacy Settings feature allows students to control the visibility of their horoscopes through two boolean fields: `isPublic` (public/private) and `displayName` (show/hide the person's name on public surfaces). This spec defines every interaction, state, and visual treatment for the privacy subsystem.

### Design Goals

1. **Privacy-first default** — New horoscopes default to private; displayName defaults to showing name
2. **Instant feedback** — Every toggle saves immediately and updates the UI within 300ms
3. **Clear state communication** — The current privacy status is always visible via badges, with no ambiguity
4. **Conditional disclosure** — displayName toggle only appears when it is meaningful (isPublic=true)
5. **Bilingual parity** — All labels, toasts, errors, and placeholders render in both Sinhala and English
6. **Consistent enforcement** — Privacy rules are applied uniformly across all surfaces (search, detail, share, admin)

### Scope

| Aspect | In Scope | Out of Scope |
|--------|----------|--------------|
| Visibility control | isPublic toggle, displayName toggle | Per-field granular privacy, group-based access control |
| Surfaces | Search results, detail header, detail content, share links, admin panel | PDF export metadata, chart image metadata |
| States | Default, public, private, name hidden, loading, error, saving | Offline mode conflicts |

---

## 2. Answers to Architecture's UX Questions

### Q1: Anonymous Placeholder Format

**Confirmed: "Anonymous Horoscope #A3F2"**

| Property | Value |
|----------|-------|
| English format | "Anonymous Horoscope #A3F2" |
| Sinhala format | "නිර්නාමික ලග්නය #A3F2" |
| Hash source | Last 4 characters of horoscope UUID, uppercased |
| Determinism | Same horoscope ID → same placeholder (cross-session stable) |
| Distinguishability | Different horoscopes → different IDs → different placeholders |
| Max length | 27 chars (EN), 22 chars (SI) — fits within existing SearchResultCard name field |
| PII leakage | None — UUID fragment reveals no name, birth data, or location |

### Q2: Privacy Toggle Placement

**Both: Horoscope creation form AND detail page settings section**

| Surface | Location | Behavior |
|---------|----------|----------|
| Creation form (`/horoscopes/new`) | Below birth details, above submit button | Pre-submit configuration; defaults: isPublic=false, displayName=true |
| Detail page (`/horoscopes/[id]`) | Summary section (header area) or dedicated settings panel | Post-creation adjustment; reflects current saved values |
| Edit form (`/horoscopes/[id]/edit`) | Same position as creation form | Pre-populated from existing values |

### Q3: Visual Privacy Indicator

**Yes — a colored badge in the horoscope detail page header**

| Badge | Color | Icon | Condition |
|-------|-------|------|-----------|
| Private | `--text-secondary` | 🔒 lock | isPublic=false (owner view) |
| Public | `--success` (green) | 🌐 globe | isPublic=true, displayName=true |
| Name Hidden | `--warning` (amber) | 👤 eye-off | isPublic=true, displayName=false |

The badge is visible to the owner on the detail page header and to any viewer who has access (including Super Admin). For non-owner viewers of a public horoscope, the badge shows "Public" or "Name Hidden" as appropriate.

---

## 3. User Flows

### 3.1 Flow: Set Privacy on Creation

```
User opens Add Horoscope form →
  → Fills birth details →
  → Scrolls to Privacy section at bottom of form →
    → Privacy toggle default: "Private" (isPublic=false) →
    → displayName toggle: NOT visible (hidden because isPublic=false) →
  → User may toggle to "Public" →
    → displayName toggle slides into view (animation: 200ms ease-out) →
    → User may toggle displayName ON (name shown) or OFF (name hidden) →
  → Submits form → isPublic and displayName saved with horoscope →
  → Redirect to detail page → header shows privacy badge
```

### 3.2 Flow: Toggle Privacy on Detail Page

```
User opens Horoscope Detail page →
  → Sees current privacy badge in header →
  → Clicks settings gear icon OR clicks privacy badge →
  → PrivacyToggle panel opens (inline or slide-down) →
  → Toggle isPublic:
    → If Public→Private: 
      → Toggle to OFF → displayName toggle disappears (if visible) →
      → PATCH call → Success → Badge updates to "Private" →
      → Info toast: "Horoscope is now private. Removed from search results." →
    → If Private→Public:
      → Toggle to ON → displayName toggle slides in →
      → PATCH call → Success → Badge updates per displayName →
      → Success toast: "Horoscope is now public. Visible to other students." →
  → Toggle displayName (only visible when isPublic=true):
    → If ON→OFF:
      → PATCH call → Success → Badge updates to "Name Hidden" →
      → Success toast: "Name hidden on public horoscope" →
    → If OFF→ON:
      → PATCH call → Success → Badge updates to "Public" →
      → Success toast: "Name shown on public horoscope" →
  → Owner sees actual name always (no change to header name) →
  → Other student viewers see updated name/placeholder on next page load
```

### 3.3 Flow: Anonymous Name in Search

```
Student B searches for horoscopes →
  → API returns results filtered by isPublic (other students' public horoscopes only) →
  → For each result where displayName=false and viewer is not owner:
    → Name field displays "Anonymous Horoscope #A3F2" →
    → Card otherwise shows full astrological data (ascendant, planets, etc.) →
    → Click card → navigates to horoscope detail →
    → Detail page header shows "Anonymous Horoscope #A3F2" (not real name) →
  → For own horoscopes (regardless of settings): actual name shown →
  → Share link recipients: actual name shown (link implies intentional sharing)
```

---

## 4. Wireframes

### 4.1 PrivacyToggle Component — Creation Form

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  ┌─── Visibility ─────────────────────────────────────────┐ │
│  │  [🔒 Private]  [🌐 Public]                              │ │
│  │                                                         │ │
│  │  Private horoscopes are visible only to you, Super      │ │
│  │  Admin, and anyone with a share link.                   │ │
│  │                                                         │ │
│  │  ┌────────────────────────────────────────────────────┐ │ │
│  │  │                                                 ▾  │ │ │
│  │  └────────────────────────────────────────────────────┘ │ │
│  │  (displayName toggle — hidden when Private selected)    │ │
│  │                                                         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ... when toggled to Public:                                 │
│                                                              │
│  ┌─── Visibility ─────────────────────────────────────────┐ │
│  │  [🔒 Private]  [🌐 Public]                              │ │
│  │                                                         │ │
│  │  Public horoscopes are visible to all students in       │ │
│  │  search results and can be shared via link.             │ │
│  │                                                         │ │
│  │  ┌────────────────────────────────────────────────────┐ │ │
│  │  │  ● Show person's name on public horoscope          │ │ │
│  │  └────────────────────────────────────────────────────┘ │ │
│  │  ┌────────────────────────────────────────────────────┐ │ │
│  │  │  ○ Hide name (show as "Anonymous")                 │ │ │
│  │  └────────────────────────────────────────────────────┘ │ │
│  │                                                         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │     Calculate & Save Horoscope                       │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 PrivacyToggle Component — Detail Page Settings

```
┌─── Ravi Kumar's Horoscope ───────────────────────────────┐
│  Born: 1990-01-15, 06:30 AM | Colombo                    │
│  Ascendant: Aries (Mesh) 12.5°                            │
│                                                           │
│  [ 🔒 Private ]                    [Edit] [⚙️] [Share]  │
│                                                           │
└───────────────────────────────────────────────────────────┘
        ↓ click ⚙️ settings icon
┌─── Ravi Kumar's Horoscope ───────────────────────────────┐
│  Born: 1990-01-15, 06:30 AM | Colombo                    │
│  Ascendant: Aries (Mesh) 12.5°                            │
│                                                           │
│  [ 🔒 Private ]                    [Edit] [⚙️] [Share]  │
├───────────────────────────────────────────────────────────┤
│  ┌─── Privacy Settings ────────────────────────────────┐ │
│  │                                                      │ │
│  │  Horoscope Visibility                                │ │
│  │  [🔒 Private]  [🌐 Public]                           │ │
│  │                                                      │ │
│  │  Show Name on Public Horoscope                       │ │
│  │  [● Show name  ○ Hide name]  (visible when Public)   │ │
│  │                                                      │ │
│  │  ℹ️ Share links remain valid even if you switch to    │ │
│  │     private. You can revoke individual share links.  │ │
│  │                                                      │ │
│  └──────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

### 4.3 SearchResultCard — Anonymous Name Display

```
┌──────────────────────────────────────────────────────────────┐
│  [★★★★☆]  Score: 85% match                                  │
│                                                               │
│  Anonymous Horoscope #A3F2                                    │
│  Born: 1990-01-15, 06:30 AM                                  │
│  Location: Colombo                                            │
│                                                               │
│  Key Findings:                                                │
│  • Aries Ascendant (12.5°)                                    │
│  • Saturn Exalted in Libra (H7)                               │
│  • Parivartana Yoga present                                   │
│                                                               │
│  [🌐 Public — Name Hidden]  (badge shown for non-owner)      │
│                                                               │
│  Labels: [job: Engineer] [skills: Programming]                │
│                                                               │
│  [View Full Horoscope →]                                      │
└──────────────────────────────────────────────────────────────┘
```

### 4.4 Dashboard Horoscope List — With Privacy Badges

```
┌─────────────────────────────────────────────────────────────────────┐
│  Name                  │ Birth Date  │ Location  │ Privacy          │
├─────────────────────────────────────────────────────────────────────┤
│  Ravi Kumar            │ 1990-01-15  │ Colombo   │ 🌐 Public       │
│                        │ 06:30 AM    │           │ 👤 Name shown   │
├─────────────────────────────────────────────────────────────────────┤
│  Sunitha Perera        │ 1985-06-20  │ Kandy     │ 🔒 Private      │
│                        │ 10:15 AM    │           │                 │
├─────────────────────────────────────────────────────────────────────┤
│  Anonymous Horoscope   │ 1992-11-03  │ Galle     │ 🌐 Public       │
│  #B7F4                 │ 08:45 AM    │           │ 👤 Name hidden  │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.5 AdminHoroscopeList — With Privacy Badges

```
┌───────────────────────────────────────────────────────────────────────┐
│  Name                  │ Owner    │ Privacy        │ Date      │ Del  │
├───────────────────────────────────────────────────────────────────────┤
│  Ravi Kumar            │ user123  │ 🌐 Public      │ 2026-07-15│  🗑️  │
│  Sunitha Perera        │ user456  │ 🔒 Private     │ 2026-07-10│  —   │
│  Chaminda Silva        │ user789  │ 🌐 Public      │ 2026-07-08│  🗑️  │
│                        │          │ 👤 Name hidden  │           │      │
└───────────────────────────────────────────────────────────────────────┘

Admin notes:
- All horoscopes visible (bypasses isPublic)
- Actual names always shown (bypasses displayName)
- Private horoscopes have lock icon badge
- Name hidden horoscopes show "👤 Name hidden" sub-badge
- Delete only available for public horoscopes (per admin API rules)
- Each view of a private horoscope is logged to auditLogs
```

### 4.6 Shared Horoscope View — Name Always Visible

```
┌─────────────────────────────────────────────────────────────────────┐
│  ℹ️ This horoscope was shared with you. Link expires: 2026-08-01   │
└─────────────────────────────────────────────────────────────────────┘

┌─── Ravi Kumar's Horoscope (shared) ──────────────────────────────┐
│  Born: 1990-01-15, 06:30 AM | Colombo                             │
│  Ascendant: Aries (Mesh) 12.5°                                    │
│                                                                   │
│  (Full horoscope content — charts, calculations, dashas)          │
│  (No Edit, Share, Export, or Metadata tabs)                       │
│  (Actual name shown regardless of displayName setting)            │
└───────────────────────────────────────────────────────────────────┘
```

---

## 5. PrivacyToggle Component Specification

### 5.1 Props

| Prop | Type | Description |
|------|------|-------------|
| `isPublic` | `boolean` | Current public/private state |
| `displayName` | `boolean` | Current show/hide name state |
| `onChange` | `(settings: { isPublic?: boolean; displayName?: boolean }) => void` | Called when user changes a toggle; parent handles API call |
| `saving` | `boolean` | Whether an API save is in progress |
| `error` | `string \| null` | Error message from failed save |
| `disabled` | `boolean` | Disable entire component (e.g., non-owner viewing) |
| `language` | `'si' \| 'en'` | Current UI language |
| `context` | `'create' \| 'detail'` | Determines layout variant (form vs settings panel) |

### 5.2 Component States

**State 1: Private (Default)**

```
┌─── Visibility ─────────────────────────────────────────┐
│                                                         │
│  [🔒 Private]  [🌐 Public]                              │
│                                                         │
│  Private horoscopes are visible only to you, Super      │
│  Admin, and anyone with a share link.                   │
│                                                         │
│  (displayName toggle — not shown)                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**State 2: Public — Name Shown**

```
┌─── Visibility ─────────────────────────────────────────┐
│                                                         │
│  [🔒 Private]  [🌐 Public]                              │
│                                                         │
│  Public horoscopes are visible to all students in       │
│  search results and can be shared via link.             │
│                                                         │
│  👤 Name Display                                        │
│  [● Show name  ○ Hide name]                             │
│                                                         │
│  When shown, the person's name appears in search        │
│  results, detail pages, and public listings.            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**State 3: Public — Name Hidden**

```
┌─── Visibility ─────────────────────────────────────────┐
│                                                         │
│  [🔒 Private]  [🌐 Public]                              │
│                                                         │
│  Public horoscopes are visible to all students in       │
│  search results and can be shared via link.             │
│                                                         │
│  👤 Name Display                                        │
│  [○ Show name  ● Hide name]                             │
│                                                         │
│  When hidden, the name is replaced with "Anonymous      │
│  Horoscope #A3F2" in all public surfaces.               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**State 4: Loading (Saving)**

```
┌─── Visibility ─────────────────────────────────────────┐
│                                                         │
│  [🔒 Private]  [🌐 Public]                              │
│              ◌ (spinner)                                │
│                                                         │
│  (all toggles disabled — pointer-events: none)          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**State 5: Error**

```
┌─── Visibility ─────────────────────────────────────────┐
│                                                         │
│  [🔒 Private]  [🌐 Public]                              │
│                                                         │
│  👤 Name Display                                        │
│  [● Show name  ○ Hide name]                             │
│                                                         │
│  ⚠️ Failed to update privacy settings.                  │
│     [Retry]                                             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**State 6: Read-only (non-owner view)**

```
┌─── Visibility ─────────────────────────────────────────┐
│                                                         │
│  🌐 This horoscope is public.                           │
│  👤 Name is hidden on public surfaces.                  │
│                                                         │
│  (no interactive toggles — info only)                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 5.3 Edge Cases

| Edge Case | Visual Behavior | Data Behavior |
|-----------|----------------|---------------|
| displayName=false while isPublic=false | displayName toggle not visible; no visual effect | displayName value saved but ignored until isPublic becomes true |
| Toggle isPublic OFF while displayName visible | displayName toggle slides out (200ms); badge updates to "Private" | displayName value preserved in DB |
| Toggle isPublic back ON | displayName toggle slides in with previous value restored | No change to displayName in DB |
| Rapid toggling (5x in 1 second) | Each toggle triggers save; debounce 300ms batches rapid changes | Each change writes to DB independently; audit log captures each transition |
| Concurrent edits (two tabs) | Last tab's save wins; no conflict UI | Last write wins (MongoDB); no locking needed |
| displayName=false + share link | On share link view, name is shown (bypasses displayName) | No change to displayName; share route returns full data |

### 5.4 Interaction Behaviors

| Behavior | Details |
|----------|---------|
| Save trigger | Immediate PATCH on every toggle (no "Save" button required) |
| Debounce | 300ms after last toggle change before firing API call |
| Conditional displayName | displayName toggle rendered when isPublic=true only; uses CSS `max-height` transition (200ms, ease-out) on show/hide |
| Toast on Public→Private | Info toast: "Horoscope is now private. Removed from search results." (4s duration) |
| Toast on Private→Public | Success toast: "Horoscope is now public. Visible to other students." (3s duration) |
| Toast on displayName change | Success toast with appropriate message (3s duration) |
| Error recovery | Error display below component with "Retry" link; retry re-sends the last PATCH |
| Privacy badge update | Badge in detail header updates immediately on success response |
| Search result update | Search results update on next query (no live refresh of cached results) |

---

## 6. PrivacyBadge Component Specification

### 6.1 Props

| Prop | Type | Description |
|------|------|-------------|
| `isPublic` | `boolean` | Current public/private state |
| `displayName` | `boolean` | Current show/hide name state |
| `isOwner` | `boolean` | Whether the viewer is the horoscope owner |
| `size` | `'sm' \| 'md'` | Small (search cards) or medium (detail header) |
| `language` | `'si' \| 'en'` | Current UI language |

### 6.2 Badge Variants

| Variant | Icon | Label (EN) | Label (SI) | Background | Text Color | Condition |
|---------|------|------------|------------|------------|------------|-----------|
| Private | 🔒 | Private | පුද්ගලික | `--text-secondary` at 15% opacity | `--text-secondary` | isPublic=false |
| Public | 🌐 | Public | පොදු | `--success` at 15% opacity | `--success` | isPublic=true, displayName=true |
| Name Hidden | 👤 | Name Hidden | නම සඟවා ඇත | `--warning` at 15% opacity | `--warning` | isPublic=true, displayName=false |

When `isOwner=false` and `isPublic=true`:

- Non-owner viewer sees the badge appropriate to the displayName setting
- The badge text is information-only (not interactive)

---

## 7. Privacy-Related UI Updates to Existing Pages

### 7.1 Add Horoscope Form (`/horoscopes/new`)

The creation form gains a new "Visibility" section between birth details and submit button:

```
│  Ayanamsha *                               │
│  ┌────────────────────────────────────┐    │
│  │ Lahiri (default)              ▾    │    │
│  └────────────────────────────────────┘    │
│                                            │
│  ┌─── Visibility ───────────────────────┐  │
│  │  [🔒 Private]  [🌐 Public]           │  │
│  │  (default: Private)                   │  │
│  │                                       │  │
│  │  👤 Name Display                      │  │
│  │  [● Show name  ○ Hide name]          │  │
│  │  (default: Show name)                 │  │
│  │  (visible only when Public selected)  │  │
│  └───────────────────────────────────────┘  │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │     Calculate & Save Horoscope       │  │
│  └──────────────────────────────────────┘  │
```

### 7.2 Horoscope Detail Page (`/horoscopes/[id]`)

Summary section header adds:

- Privacy badge (as described in section 6)
- Settings gear icon (⚙️) that toggles the PrivacySettings panel
- Privacy settings panel appears as an inline expandable section below the summary

```
┌─────────────────────────────────────────────────────────────┐
│  [← Back]  Ravi Kumar's Horoscope           [Edit] [⚙️]    │
│                                            [Share] [Export] │
│  Born: 1990-01-15, 06:30 AM | Colombo                       │
│  Ascendant: Aries (Mesh) 12.5°                              │
│                                                             │
│  [🌐 Public]  [👤 Name shown]   (privacy badges)            │
└─────────────────────────────────────────────────────────────┘
```

### 7.3 Search Result Card (`/search`)

Existing `SearchResultCard` component gains:

- Name anonymization: Replace `name` field with anonymous placeholder when `displayName=false` and viewer is not owner
- Privacy badge: Show badge (🌐 Public with Name Hidden / 👤 Name Shown) when horoscope is public
- Own horoscopes: Always show actual name (even if private); show 🔒 Private badge

```
┌──────────────────────────────────────────────────┐
│  [★★★★★]  Score: 98% match                      │
│                                                  │
│  Anonymous Horoscope #A3F2          [🌐 Name Hid]│
│  Born: 1990-01-15, 06:30 AM                     │
│  Location: Colombo                               │
│                                                  │
│  Key Findings:                                   │
│  • Aries Ascendant (12.5°)                       │
│  • Saturn Exalted in Libra (H7)                  │
│                                                  │
│  [View Full Horoscope →]                         │
└──────────────────────────────────────────────────┘
```

### 7.4 Dashboard List (`/`)

Existing horoscope list items gain:

- Privacy badge: Show 🔒/🌐 + "Public"/"Private" badge per row
- Anonymous name: For own horoscopes with displayName=false, the owner still sees the actual name (owner always sees name)

```
│  📋 Anonymous Horoscope #A3F2   1992-11-03  Galle         │
│     Scorpio Asc.     |  🌐 Public  👤 Name Hidden         │
```

### 7.5 Admin Page (`/admin`)

Existing admin table gains:

- Privacy column: Shows badge for each horoscope: 🌐 Public / 🔒 Private / 👤 Name Hidden
- Actual names always shown (bypasses displayName)
- Private horoscope label includes "Private" badge
- Each private horoscope in list view generates one audit log entry

---

## 8. Responsive Adaptations

### 8.1 PrivacyToggle on Mobile (< 640px)

| Element | Behavior |
|---------|----------|
| Layout | Stacked vertically, full-width |
| Options | Radio buttons become full-width tappable rows |
| displayName toggle | Slides in below visibility options |
| Touch targets | Minimum 44x44px for each option |
| Font size | 13px (down from 14px desktop) |
| Padding | 16px internal card padding |
| Context help text | Shown below options (not hidden) |

```
┌─────────────────────────────────┐
│  Visibility                     │
│                                 │
│  [🔒 Private]                   │
│  Private horoscopes are visible │
│  only to you and Super Admin.   │
│                                 │
│  [🌐 Public]                    │
│  Public horoscopes are visible  │
│  to all students.               │
│                                 │
│  ── Name Display ──            │
│  [● Show name]                  │
│  [○ Hide name]                  │
│                                 │
└─────────────────────────────────┘
```

### 8.2 PrivacyBadge on Mobile

| Size | Mobile |
|------|--------|
| sm (search cards) | 11px font, 4px padding, no icon text |
| md (detail header) | 12px font, 6px padding, icon + text |

Search card badges on mobile can be icon-only (🌐 or 🔒 or 👤) to save horizontal space, with the full text in `aria-label`.

### 8.3 Detail Privacy Settings Panel on Mobile

On mobile (< 640px), clicking the settings gear opens a slide-up bottom sheet instead of an inline expandable section:

```
┌──────────────────────────────────────┐
│  ─── (drag handle)                   │
│                                       │
│  Privacy Settings                     │
│                                       │
│  Horoscope Visibility                 │
│                                       │
│  [🔒 Private]                         │
│                                       │
│  Private horoscopes are visible only  │
│  to you and Super Admin.             │
│                                       │
│  [🌐 Public]                          │
│                                       │
│  👤 Name Display                      │
│  [● Show name]  [○ Hide name]         │
│                                       │
│  ℹ️ Share links remain valid even     │
│  if you switch to private.            │
│                                       │
│  [Close]                              │
└──────────────────────────────────────┘
```

### 8.4 Tablet Adaptations (640px – 1024px)

| Element | Behavior |
|---------|----------|
| PrivacyToggle | Side-by-side radio buttons (same as desktop) |
| Privacy settings panel | Inline expandable (same as desktop) |
| Badge size | md: standard, sm: icon-only or compact text |
| Search card badges | Icon + abbreviated text: "Public" / "Private" |

---

## 9. Bilingual Content Map

### 9.1 PrivacyToggle Labels

| Key | English | Sinhala |
|-----|---------|---------|
| `privacy.title` | Visibility | දෘශ්‍යතාව |
| `privacy.private_label` | Private | පුද්ගලික |
| `privacy.public_label` | Public | පොදු |
| `privacy.private_description` | Private horoscopes are visible only to you, Super Admin, and anyone with a share link. | පුද්ගලික ලග්න ඔබට පමණක් දෘශ්‍යමාන වේ. |
| `privacy.public_description` | Public horoscopes are visible to all students in search results. | පොදු ලග්න සියලුම සිසුන්ට සෙවුම් ප්‍රතිඵලවල දෘශ්‍යමාන වේ. |
| `privacy.display_name_title` | Name Display | නම දර්ශනය |
| `privacy.display_name_show` | Show name | නම පෙන්වන්න |
| `privacy.display_name_hide` | Hide name | නම සඟවන්න |
| `privacy.display_name_show_description` | The person's name appears in search results, detail pages, and public listings. | පුද්ගලයාගේ නම සෙවුම් ප්‍රතිඵලවල සහ පොදු ලැයිස්තුගත කිරීම්වල පෙන්වයි. |
| `privacy.display_name_hide_description` | The name is replaced with "Anonymous Horoscope #XXXX" in all public surfaces. | පොදු ස්ථානවල නම "නිර්නාමික ලග්නය #XXXX" ලෙස ප්‍රතිස්ථාපනය වේ. |
| `privacy.share_link_note` | Share links remain valid even if you switch to private. | ඔබ පුද්ගලිකයට මාරු වුවද බෙදාගැනීමේ සබැඳි වලංගු වේ. |

### 9.2 PrivacyBadge Labels

| Key | English | Sinhala |
|-----|---------|---------|
| `badge.private` | Private | පුද්ගලික |
| `badge.public` | Public | පොදු |
| `badge.name_hidden` | Name Hidden | නම සඟවා ඇත |
| `badge.name_shown` | Name Shown | නම පෙන්වයි |
| `badge.private_tooltip` | Only you and Super Admin can view this horoscope. | ඔබට සහ පරිපාලකට පමණක් මෙම ලග්නය නැරඹිය හැක. |
| `badge.public_tooltip` | This horoscope is visible to all students. | මෙම ලග්නය සියලුම සිසුන්ට දෘශ්‍යමාන වේ. |
| `badge.name_hidden_tooltip` | The person's name is hidden in public surfaces. | පොදු ස්ථානවල පුද්ගලයාගේ නම සඟවා ඇත. |

### 9.3 Anonymous Placeholder

| Key | English | Sinhala |
|-----|---------|---------|
| `anonymous.label` | Anonymous Horoscope #{id} | නිර්නාමික ලග්නය #{id} |
| `anonymous.aria_label` | Anonymous Horoscope | නිර්නාමික ලග්නය |

The `{id}` is replaced with the last 4 characters of the horoscope UUID, uppercased.

### 9.4 Toast Messages

| Key | Type | Duration | English | Sinhala |
|-----|------|----------|---------|---------|
| `toast.privacy.updated` | Success | 3s | Privacy updated | රහස්‍යතාව යාවත්කාලීන කළා |
| `toast.privacy.now_private` | Info | 4s | Horoscope is now private. Removed from search results. | ලග්නය දැන් පුද්ගලිකයි. සෙවුම් ප්‍රතිඵලවලින් ඉවත් කරන ලදී. |
| `toast.privacy.now_public` | Success | 3s | Horoscope is now public. Visible to other students. | ලග්නය දැන් පොදුයි. අනෙකුත් සිසුන්ට දෘශ්‍යමානයි. |
| `toast.privacy.name_hidden` | Success | 3s | Name hidden on public horoscope | පොදු ලග්නයේ නම සඟවන ලදී |
| `toast.privacy.name_shown` | Success | 3s | Name shown on public horoscope | පොදු ලග්නයේ නම පෙන්වයි |
| `toast.privacy.name_hidden_warning` | Warning | 4s | Public horoscope: Name hidden. Toggle 'Show Name' to display it. | පොදු ලග්නය: නම සඟවා ඇත. එය පෙන්වීමට 'නම පෙන්වන්න' සක්‍රිය කරන්න. |

### 9.5 Error Messages

| Key | English | Sinhala |
|-----|---------|---------|
| `error.privacy.save_failed` | Failed to update privacy settings. Please try again. | රහස්‍යතා සැකසුම් යාවත්කාලීන කිරීම අසාර්ථකයි. නැවත උත්සාහ කරන්න. |
| `error.privacy.not_owner` | You can only change privacy settings for your own horoscopes. | ඔබට ඔබේම ලග්නවල රහස්‍යතා සැකසුම් පමණක් වෙනස් කළ හැක. |
| `error.privacy.not_found` | Horoscope not found. It may have been deleted. | ලග්නය හමු නොවීය. එය මකා දමා තිබිය හැක. |
| `error.privacy.rate_limited` | Too many privacy changes. Please wait a moment. | රහස්‍යතා වෙනස්කම් වැඩියි. කරුණාකර මොහොතක් රැඳී සිටින්න. |

### 9.6 Empty States

| Key | English | Sinhala |
|-----|---------|---------|
| `empty.private_horoscope_404` | Horoscope not found | ලග්නය හමු නොවීය |
| `empty.no_public_results` | No public horoscopes match your query. | ඔබේ සෙවුමට ගැළපෙන පොදු ලග්න නැත. |
| `empty.privacy_settings_error` | Could not load privacy settings. Please try again. | රහස්‍යතා සැකසුම් පූරණය කළ නොහැකි විය. කරුණාකර නැවත උත්සාහ කරන්න. |

---

## 10. Accessibility

### 10.1 PrivacyToggle ARIA

| Element | ARIA |
|---------|------|
| PrivaryToggle container | `role="group"`, `aria-label="Horoscope visibility settings"` / "ලග්නයේ දෘශ්‍යතා සැකසුම්" |
| Privary radio group | `role="radiogroup"`, `aria-label="Horoscope visibility"` / "ලග්නයේ දෘශ්‍යතාව" |
| Private radio option | `role="radio"`, `aria-checked="true"` or `"false"` |
| Public radio option | `role="radio"`, `aria-checked="true"` or `"false"` |
| displayName radio group | `role="radiogroup"`, `aria-label="Name display on public horoscope"` / "පොදු ලග්නයේ නම දර්ශනය" |
| Show name radio | `role="radio"`, `aria-checked` |
| Hide name radio | `role="radio"`, `aria-checked` |
| Saving spinner | `aria-busy="true"` on container during save |
| Error message | `role="alert"` on error banner |

### 10.2 Screen Reader Announcements

| Action | Announcement |
|--------|--------------|
| Toggle Public ON | "Horoscope set to public. Name display options now available." / "ලග්නය පොදු කරන ලදී. නම දර්ශන විකල්ප දැන් තිබේ." |
| Toggle Private | "Horoscope set to private. Removed from search results." / "ලග්නය පුද්ගලික කරන ලදී. සෙවුම් ප්‍රතිඵලවලින් ඉවත් කරන ලදී." |
| displayName ON | "Name will be shown on public horoscope." / "පොදු ලග්නයේ නම පෙන්වනු ඇත." |
| displayName OFF | "Name will be hidden on public horoscope." / "පොදු ලග්නයේ නම සඟවනු ඇත." |
| Save success | "Privacy settings saved." / "රහස්‍යතා සැකසුම් සුරැකිණි." |
| Save error | "Failed to save privacy settings. Please try again." / "රහස්‍යතා සැකසුම් සුරැකීම අසාර්ථකයි. නැවත උත්සාහ කරන්න." |

### 10.3 Keyboard Navigation

| Key | Action |
|-----|--------|
| `Tab` | Navigate between radio groups and options |
| `Arrow keys` | Navigate between options within a radio group |
| `Enter` / `Space` | Activate the focused radio option |
| `Escape` | Close privacy settings panel (detail page) or dismiss error |

### 10.4 Focus Management

| Event | Focus |
|-------|-------|
| Privacy panel opens | Focus moves to the first radio option (Privacy: first selected or default) |
| Public selected | Focus moves to displayName group (first option) |
| displayName toggled | Focus stays on the toggled option |
| Error appears | Focus moves to error banner (`role="alert"`) |
| Error dismissed | Focus returns to the last toggled option |
| Panel closes | Focus returns to the trigger (⚙️ button or badge) |

### 10.5 Visual Differentiation (Not Color Alone)

Privacy badges use **three independent channels**:

1. **Icon**: 🔒 lock (private), 🌐 globe (public), 👤 person (name hidden)
2. **Label text**: "Private" / "Public" / "Name Hidden" and Sinhala equivalents
3. **Color**: gray (private), green (public), amber (name hidden)

### 10.6 Anonymous Placeholder for Screen Readers

The anonymous placeholder `<span>` has:
- `aria-label="Anonymous Horoscope #A3F2"` / "නිර්නාමික ලග්නය #A3F2"
- The `#` symbol is read as "number" by screen readers (correct for both EN and SI)
- Each character of the ID is read individually (e.g., "A three F two")

---

## 11. Micro-interactions

| Action | Effect |
|--------|--------|
| Toggle isPublic ON | Radio selection changes instantly; displayName panel slides down (200ms, ease-out); PATCH fires (debounced 300ms) |
| Toggle isPublic OFF | Radio selection changes; displayName panel slides up (200ms, ease-in); PATCH fires |
| Toggle displayName | Radio selection changes instantly; PATCH fires |
| Save in progress | Spinner appears (16px, 1s linear infinite rotation); toggles disabled (50% opacity, `pointer-events: none`) |
| Save success | Spinner removed; toggles re-enabled; toast slides in (200ms, ease-out) |
| Save error | Spinner removed; error banner slides down (200ms, ease-out) below component; toggles re-enabled |
| Privacy badge changes | Badge crossfades between states (150ms opacity transition) |
| Anonymous placeholder appears | Text crossfades from name to placeholder (150ms) — but only on page load/refresh, not in-place |
| Panel open (detail) | Settings panel expands with `max-height` transition (300ms, ease-out) |
| Panel close (detail) | Settings panel collapses (200ms, ease-in) |

---

## 12. Component Architecture

### 12.1 Component Tree

```
PrivacyToggle (container)
├── RadioGroup "Horoscope Visibility"
│   ├── Radio "Private"
│   └── Radio "Public"
└── ConditionalPanel "Name Display" (visible when isPublic=true)
    └── RadioGroup "Name Display"
        ├── Radio "Show name"
        └── Radio "Hide name"

PrivacyBadge (display-only)
└── Icon + Label (varies by state)
```

### 12.2 Props Interface

```typescript
interface PrivacyToggleProps {
    isPublic: boolean;
    displayName: boolean;
    onChange: (settings: { isPublic?: boolean; displayName?: boolean }) => void;
    saving: boolean;
    error: string | null;
    disabled?: boolean;
    language: 'si' | 'en';
    context: 'create' | 'detail';
}

interface PrivacyBadgeProps {
    isPublic: boolean;
    displayName: boolean;
    isOwner: boolean;
    size: 'sm' | 'md';
    language: 'si' | 'en';
}
```

### 12.3 State Management

PrivacyToggle state is **managed by the parent** (horoscope form or detail page). The component is a controlled component:

- Parent holds `isPublic` and `displayName` in its state
- On toggle change, parent calls `onChange` with the changed field
- Parent debounces the PATCH call (300ms)
- Parent passes `saving` and `error` back to the component
- On successful save, parent updates its state with the response

```
Parent state:
  isPublic: boolean (default: false)
  displayName: boolean (default: true)

On user toggle:
  → Update local state immediately (optimistic)
  → Debounce 300ms
  → PATCH /api/horoscope/:id/privacy
  → On success: update badge, show toast
  → On error: revert local state, show error
```

---

## 13. File Index

| File | Description |
|------|-------------|
| `specs/ux/main-ux-spec.md` | Master UX reference — updated with Flow 11, Flow 12, PrivacyToggle pattern, privacy toasts and empty states |
| `specs/ux/20260727-1926-privacy-settings.md` | This document — full Horoscope Privacy Settings UX specification |
| `src/components/PrivacyToggle.tsx` | PrivacyToggle component (isPublic + displayName toggles) |
| `src/components/PrivacyBadge.tsx` | Privacy status badge component |

---

## Appendix A: Design Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Anonymous placeholder format | "Anonymous Horoscope #A3F2" | Stable, distinguishable, no PII leakage; matches common anonymous posting patterns |
| Toggle placement | Both creation form and detail page | Creation form sets initial value; detail page allows later changes; consistent with "set and forget" privacy model |
| Privacy badge in header | Yes | Gives immediate awareness of current status; owner can quickly verify before sharing |
| displayName conditional rendering | Slide in/out on isPublic toggle | Reduces cognitive load (only show relevant options); preserves value across states |
| Save on toggle (no save button) | Immediate PATCH | Single-action interaction; no "forgot to save" errors |
| Debounce | 300ms | Balances responsiveness with API load; matches existing patterns |
| 404 for private horoscope (not 403) | 404 | Prevents UUID probing; architecture decision confirmed |
| Radio buttons (not switches) for displayName | Radio group | Two mutually exclusive options (show/hide) are clearer as radio buttons; matches creation form pattern |
| Radio buttons (not segmented control) for isPublic | Radio group | Consistent with displayName pattern; clearer labeling with descriptions |

---

## Appendix B: Cross-Reference to Architecture Decisions

| Architecture Decision | UX Implementation |
|-----------------------|-------------------|
| Query-level privacy filtering | No UX impact — transparent to user; search results simply exclude private horoscopes |
| Async embedding lifecycle | No UX impact — toggle is instant; async embedding sync is invisible to user |
| Qdrant point update instead of delete | No UX impact — embedding lifecycle is backend-only |
| displayName overwrites name field at serialization | UX sees anonymous placeholder in all public surfaces; owner always sees actual name |
| 404 for private horoscope detail | UX shows standard 404 page (not a custom "private" message) — consistent with architecture's security design |
| Share links survive public→private | UX shows info note in PrivacyToggle: "Share links remain valid even if you switch to private" |
| Audit logging sync for writes, fire-and-forget for reads | No UX impact — logging is invisible to user |
| Rate limiting: 30 req/min for privacy endpoint | UX shows error message "Too many privacy changes. Please wait a moment." when rate limited |

---

## Appendix C: Mobile PrivacySettings Bottom Sheet

When the privacy settings panel opens on mobile (< 640px), it renders as a bottom sheet:

```
┌────────────────────────────────────────┐
│  ─── (drag handle, 40px wide, center) │
│                                        │
│  Privacy Settings                      │
│  ──────────────────────────────        │
│                                        │
│  Visibility                            │
│                                        │
│  ┌────────────────────────────────┐   │
│  │ 🔒 Private                     │   │
│  │ Private horoscopes are visible │   │
│  │ only to you and Super Admin.   │   │
│  └────────────────────────────────┘   │
│                                        │
│  ┌────────────────────────────────┐   │
│  │ 🌐 Public                      │   │
│  │ Public horoscopes are visible  │   │
│  │ to all students in search.     │   │
│  └────────────────────────────────┘   │
│                                        │
│  ── Name Display ──                   │
│                                        │
│  [● Show name]  [○ Hide name]         │
│                                        │
│  ℹ️ Share links remain valid even      │
│  if you switch to private.            │
│                                        │
│  ┌──────────────────────────────┐     │
│  │          Close               │     │
│  └──────────────────────────────┘     │
└────────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| Open trigger | Click ⚙️ gear icon or privacy badge |
| Open animation | Slides up from bottom (300ms, ease-out) |
| Close trigger | Tap "Close" button, swipe down on handle, tap backdrop |
| Close animation | Slides down (200ms, ease-in) |
| Max height | 75% of viewport (scrollable if content exceeds) |
| Drag handle | 40px wide, 4px tall, centered, `--border` color |
| Backdrop | `bg-black/50` behind sheet, tap to close |
| Z-index | `z-50` (above all page content) |

---

## Appendix D: Color Tokens (Privacy-Specific)

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `--privacy-private-bg` | `#64748B` at 15% opacity | `#64748B` at 20% opacity | Private badge background |
| `--privacy-private-text` | `#64748B` | `#94A3B8` | Private badge text |
| `--privacy-public-bg` | `#10B981` at 15% opacity | `#34D399` at 20% opacity | Public badge background |
| `--privacy-public-text` | `#10B981` | `#34D399` | Public badge text |
| `--privacy-hidden-bg` | `#F59E0B` at 15% opacity | `#FBBF24` at 20% opacity | Name Hidden badge background |
| `--privacy-hidden-text` | `#F59E0B` | `#FBBF24` | Name Hidden badge text |
| `--privacy-card-bg` | `#F8FAFC` | `#2A2A3C` | Privacy settings card background |
| `--privacy-card-border` | `#E2E8F0` | `#334155` | Privacy settings card border |
| `--privacy-section-divider` | `#E2E8F0` | `#334155` | Divider between isPublic and displayName sections |

(End of file)
