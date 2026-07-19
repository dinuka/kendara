# Delete Horoscope — UX Design

**Date:** 2026-07-19 14:00
**Author:** UX (BMAD)
**Based on:** specs/ux/main-ux-spec.md, specs/ux/20260715-1230-full-app-ux-design.md, specs/architecture/overview.md, src/app/page.tsx, src/app/horoscopes/[id]/page.tsx, src/app/admin/page.tsx, src/app/api/horoscope/[id]/route.ts, src/app/api/admin/horoscope/[id]/route.ts

---

## Overview

### Problem

The "Delete Horoscope" feature is broken across the application:

1. **Dashboard** (`src/app/page.tsx`) — A delete confirmation modal exists (lines 108-136) but the task reports it is missing or non-functional. The current implementation actually has the correct markup (Cancel + Delete buttons), but it lacks visual polish: no warning icon, no backdrop blur, no focus trap, no keyboard dismissal, and the modal doesn't match the app's design language (e.g., the `QuickAddLocationModal` component).
2. **Horoscope Detail** (`src/app/horoscopes/[id]/page.tsx`) — No delete functionality at all. The header only has Edit and Visibility toggle icons.
3. **Admin** (`src/app/admin/page.tsx`) — No delete functionality. The admin DELETE API route exists at `src/app/api/admin/horoscope/[id]/route.ts` but the UI has no trigger.

### Design Goals

1. **Consistent confirmation pattern** — A single, reusable delete confirmation modal used across Dashboard, Detail, and Admin pages
2. **Danger clarity** — Red delete button, explicit warning icon, unambiguous language
3. **Safety by default** — Requires explicit confirmation, backdrop click dismisses, Escape key dismisses
4. **No new i18n keys** — Use only existing translation keys
5. **Match existing design** — Indigo primary, clean whites, subtle shadows, consistent with `QuickAddLocationModal` pattern

---

## Reusable Component: `ConfirmDeleteModal`

### Purpose

A confirmation dialog for destructive delete actions. Rendered as a fixed overlay with a centered modal panel. Used identically on Dashboard, Horoscope Detail, and Admin pages.

### Props

| Prop | Type | Description |
|------|------|-------------|
| `open` | `boolean` | Whether the modal is visible |
| `onConfirm` | `() => void` | Called when user clicks the Delete button |
| `onCancel` | `() => void` | Called when user clicks Cancel, backdrop, or presses Escape |
| `loading` | `boolean` | Whether a delete operation is in progress |
| `error` | `string \| null` | Error message to display inside the modal |

### i18n Keys Used (no new keys)

| Key | English | Sinhala |
|-----|---------|---------|
| `horoscope.deleteConfirm` | "Delete this horoscope?" | "මෙම කේන්දරය මකන්නද?" |
| `horoscope.deleteWarning` | "This action cannot be undone. All charts, calculations, and metadata for this horoscope will be permanently removed." | "මෙම ක්‍රියාව ආපසු හැරවිය නොහැක. මෙම කේන්දරයේ සියලුම සටහන්, ගණනය කිරීම් සහ පාර-දත්ත ස්ථිරවම ඉවත් කරනු ලැබේ." |
| `common.cancel` | "Cancel" | "අවලංගු කරන්න" |
| `common.delete` | "Delete" | "මකන්න" |
| `common.loading` | "Loading..." | "පූරණය වෙමින්..." |
| `common.error` | "An error occurred" | "දෝෂයක් සිදු විය" |

### Wireframe

```
┌─────────────────────────────────────────────────────────┐
│  ████████████████████████████████████████████████████    │
│  ████████████ Backdrop (bg-black/50) ████████████████    │
│  ████████████ Click → onCancel     ████████████████    │
│  ████████████████████████████████████████████████████    │
│         ┌──────────────────────────────────┐             │
│         │  ⚠️  Delete this horoscope?      │             │
│         │                                  │             │
│         │  This action cannot be undone.   │             │
│         │  All charts, calculations, and   │             │
│         │  metadata for this horoscope     │             │
│         │  will be permanently removed.    │             │
│         │                                  │             │
│         │  ┌──────────────────────────┐    │             │
│         │  │  ⛔ Error message here   │    │             │
│         │  └──────────────────────────┘    │             │
│         │                                  │             │
│         │        [Cancel]  [Delete]        │             │
│         └──────────────────────────────────┘             │
└─────────────────────────────────────────────────────────┘
```

### Modal Markup (Tailwind-only)

```tsx
{open && (
    <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
        onClick={onCancel}
        role="dialog"
        aria-modal="true"
        aria-label={t("horoscope.deleteConfirm")}
        onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
    >
        <div
            className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
        >
            {/* Warning icon + title */}
            <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-5 h-5 text-red-600"
                    >
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                    {t("horoscope.deleteConfirm")}
                </h3>
            </div>

            {/* Warning text */}
            <p className="text-sm text-gray-600 mb-4 pl-[52px]">
                {t("horoscope.deleteWarning")}
            </p>

            {/* Error banner (conditional) */}
            {error && (
                <div
                    className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-sm text-red-700"
                    role="alert"
                >
                    {error}
                </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 justify-end">
                <button
                    onClick={onCancel}
                    disabled={loading}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                    {t("common.cancel")}
                </button>
                <button
                    onClick={onConfirm}
                    disabled={loading}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                    {loading ? t("common.loading") : t("common.delete")}
                </button>
            </div>
        </div>
    </div>
)}
```

### Interaction States

| State | Delete Button | Cancel Button | Backdrop | Description |
|-------|--------------|---------------|----------|-------------|
| **Default** | `bg-red-600 text-white` | `border-gray-300 text-gray-700` | `bg-black/50` | Modal open, ready for user decision |
| **Hover** | `hover:bg-red-700` | `hover:bg-gray-50` | — | Visual feedback on interactive elements |
| **Focus** | `focus:ring-2 focus:ring-red-500` | `focus:ring-2 focus:ring-indigo-500` | — | Keyboard focus indicator, 2px ring with offset |
| **Loading** | `disabled:opacity-50`, text = `t("common.loading")` | `disabled:opacity-50` | — | Both buttons disabled, delete shows "Loading..." |
| **Error** | Enabled (retry possible) | Enabled | — | Error banner appears above buttons |
| **Disabled (during load)** | `cursor-not-allowed` | `cursor-not-allowed` | `pointer-events-none` on backdrop | Prevents accidental dismissal during deletion |

### Keyboard Handling

| Key | Action |
|-----|--------|
| `Escape` | Closes modal, calls `onCancel` |
| `Tab` | Focus cycles: Cancel → Delete → (loop within modal) |
| `Enter` / `Space` | Activates focused button |

### Focus Management

- When modal opens → focus moves to the **Cancel** button (safe default, prevents accidental delete)
- When modal closes → focus returns to the element that triggered it (the delete icon button)
- Focus trap: Tab and Shift+Tab cycle within the modal only (no focus escaping to background)

### Accessibility

- `role="dialog"` on the outer container
- `aria-modal="true"` to indicate modal behavior
- `aria-label={t("horoscope.deleteConfirm")}` for screen reader announcement
- Error banner has `role="alert"` for live announcement
- All buttons have visible text (no icon-only buttons in the modal)
- Color contrast: red-600 on white = 4.6:1 (meets AA for normal text), white on red-600 = 4.6:1
- Warning icon is decorative (aria-hidden), title text provides meaning

### Responsive Behavior

| Viewport | Layout |
|----------|--------|
| Desktop (>640px) | Centered modal, `max-w-sm` (384px), padding 24px |
| Mobile (<640px) | Centered modal, full width with 16px horizontal margin, padding 24px |

---

## Placement 1: Dashboard Page (`src/app/page.tsx`)

### Current State

Lines 108-136 render the inline modal. Lines 182-198 render a trash icon button per table row (only for owners).

### Required Changes

1. **Replace inline modal** with the `ConfirmDeleteModal` component import
2. **Keep the existing trash icon buttons** in the table row actions — they already work correctly (set `confirmDelete` state)
3. **Add error banner** above the table (already exists at lines 102-106, keep as-is)
4. **After successful deletion** — remove row from local state (already implemented at line 60)

### Table Row Actions (existing, no change needed)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Name         │  Birth Date  │  Location  │  Public  │  Actions    │
├─────────────────────────────────────────────────────────────────────┤
│  Ravi Kumar   │  1990-01-15  │  Colombo   │  Public  │  ✏️  🗑️      │
│               │  06:30 AM    │            │          │             │
├─────────────────────────────────────────────────────────────────────┤
│  Sunitha P.   │  1985-06-20  │  Kandy     │  Private │  ✏️  🗑️      │
│               │  10:15 AM    │            │          │             │
└─────────────────────────────────────────────────────────────────────┘

Trash icon button:
- aria-label="{t("common.delete")} {h.name}"  (e.g., "Delete Ravi Kumar")
- class: "p-1.5 text-gray-400 hover:text-red-600 transition-colors rounded hover:bg-red-50"
- Only visible when isOwner(h) is true
- onClick: setConfirmDelete(h._id)  → opens ConfirmDeleteModal
```

### State Flow

```
User clicks 🗑️ on row → setConfirmDelete(h._id) →
  → ConfirmDeleteModal renders with open={true} →
    → User clicks "Cancel" or backdrop → setConfirmDelete(null) → modal closes
    → User clicks "Delete" → handleDelete(id) →
      → loading state shown → DELETE /api/horoscope/{id} →
        → Success: row removed from state, modal closes
        → Error: error banner shown at top, modal stays open
```

---

## Placement 2: Horoscope Detail Page (`src/app/horoscopes/[id]/page.tsx`)

### Current State

Lines 320-379 render the header action area with Edit (pencil) and Visibility (globe/lock) icons. No delete button exists.

### Required Changes

1. **Add a delete icon button** in the header action area, after the visibility toggle
2. **Add state** for `confirmDelete` and `deleting`
3. **Add handler** `handleDelete` that calls `DELETE /api/horoscope/{id}` and navigates to `/` on success
4. **Render `ConfirmDeleteModal`** at the end of the component

### Updated Header Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Ravi Kumar's Horoscope                                             │
│  1990-01-15 06:30 AM | Colombo                                     │
│                                                                     │
│                                            ┌──────┬──────┬──────┐  │
│                                            │ ✏️   │ 🌐/🔒│  🗑️  │  │
│                                            │Edit  │ Pub  │ Del  │  │
│                                            └──────┴──────┴──────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Delete Icon Button (in header)

```tsx
<button
    onClick={() => setConfirmDelete(true)}
    aria-label={t("common.delete")}
    title={t("common.delete")}
    className="w-8 h-8 flex items-center justify-center border rounded hover:bg-red-50 text-gray-600 hover:text-red-600 transition-colors"
>
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-4 h-4"
    >
        <path d="M3 6h18" />
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
</button>
```

### State Additions

```tsx
const [confirmDelete, setConfirmDelete] = useState(false);
const [deleting, setDeleting] = useState(false);
const [deleteError, setDeleteError] = useState<string | null>(null);
```

### Delete Handler

```tsx
const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
        const res = await fetch(`/api/horoscope/${params.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Delete failed");
        router.push("/");
    } catch {
        setDeleteError(t("common.error"));
        setDeleting(false);
    }
};
```

### State Flow

```
User clicks 🗑️ in header → setConfirmDelete(true) →
  → ConfirmDeleteModal renders →
    → User clicks "Cancel" → setConfirmDelete(false) → modal closes
    → User clicks "Delete" → handleDelete() →
      → loading state shown → DELETE /api/horoscope/{id} →
        → Success: redirect to "/" (dashboard)
        → Error: error displayed inside modal, modal stays open
```

---

## Placement 3: Admin Page (`src/app/admin/page.tsx`)

### Current State

Lines 66-134 render the admin table with columns: Name, Owner, Public, Date. No delete action column exists.

### Required Changes

1. **Add a delete column** to the horoscopes table header
2. **Add delete icon buttons** in each row (only on horoscopes tab)
3. **Add state** for `confirmDelete` (string | null), `deletingId`, and `deleteError`
4. **Add handler** `handleDelete` that calls `DELETE /api/admin/horoscope/{id}`
5. **Render `ConfirmDeleteModal`** at the end of the component
6. **Only show delete for public horoscopes** (admin DELETE API rejects private horoscopes with 403)

### Updated Table Wireframe (Horoscopes Tab)

```
┌───────────────────────────────────────────────────────────────────┐
│  Name            │  Owner      │  Public  │  Date      │  Actions │
├───────────────────────────────────────────────────────────────────┤
│  Ravi Kumar      │  a3f2c1    │  Yes     │  2026-07-15│  🔗  🗑️  │
│  Sunitha Perera  │  b7d4e2    │  No      │  2026-07-10│  🔗       │
│  Chaminda Silva  │  c9a1b3    │  Yes     │  2026-07-08│  🔗  🗑️  │
└───────────────────────────────────────────────────────────────────┘

Trash icon button:
- Only rendered when item.isPublic === true
  (admin DELETE API returns 403 for private horoscopes)
- aria-label="{t("common.delete")} {item.name}"
- class: "p-1.5 text-gray-400 hover:text-red-600 transition-colors rounded hover:bg-red-50"
- onClick: setConfirmDelete(item._id as string) → opens ConfirmDeleteModal

Link icon button:
- Navigates to /horoscopes/{id}
```

### State Additions

```tsx
const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
const [deletingId, setDeletingId] = useState<string | null>(null);
const [deleteError, setDeleteError] = useState<string | null>(null);
```

### Delete Handler

```tsx
const handleDelete = async (id: string) => {
    setDeletingId(id);
    setDeleteError(null);
    try {
        const res = await fetch(`/api/admin/horoscope/${id}`, { method: "DELETE" });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Delete failed");
        }
        setItems((prev) => prev.filter((item) => item._id !== id));
        setConfirmDelete(null);
    } catch (err) {
        setDeleteError(err instanceof Error ? err.message : t("common.error"));
    } finally {
        setDeletingId(null);
    }
};
```

### State Flow

```
Admin clicks 🗑️ on row → setConfirmDelete(item._id) →
  → ConfirmDeleteModal renders →
    → User clicks "Cancel" → setConfirmDelete(null) → modal closes
    → User clicks "Delete" → handleDelete(id) →
      → loading state shown → DELETE /api/admin/horoscope/{id} →
        → Success: row removed from state, modal closes
        → Error: error shown inside modal, modal stays open, retry possible
```

---

## Component Design Summary

### `ConfirmDeleteModal` Component

| Property | Value |
|----------|-------|
| File location | `src/components/ConfirmDeleteModal.tsx` |
| Export | `export default ConfirmDeleteModal` |
| Props interface | `{ open: boolean; onConfirm: () => void; onCancel: () => void; loading: boolean; error: string \| null }` |
| Rendering | Portal not needed — `fixed inset-0 z-50` handles stacking |
| Animation | None required (matches existing `QuickAddLocationModal` pattern — instant show/hide) |
| Backdrop | `bg-black/50 backdrop-blur-sm` |
| Panel | `bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl` |

### Visual Tokens

| Element | Tailwind Classes |
|---------|-----------------|
| Backdrop | `bg-black/50 backdrop-blur-sm` |
| Modal panel | `bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl` |
| Warning icon container | `w-10 h-10 rounded-full bg-red-100 flex items-center justify-center` |
| Warning icon | `w-5 h-5 text-red-600` (triangle alert SVG) |
| Title | `text-lg font-semibold text-gray-900` |
| Warning text | `text-sm text-gray-600 pl-[52px]` (aligned with title after icon) |
| Error banner | `bg-red-50 border border-red-200 rounded p-3 mb-4 text-sm text-red-700` |
| Cancel button | `px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500` |
| Delete button | `px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500` |
| Button container | `flex gap-3 justify-end` |

---

## Error Handling

### Dashboard

| Scenario | Behavior |
|----------|----------|
| Network failure | Error banner above table (existing `error` state), modal stays open |
| 401 Unauthorized | Redirect to `/signin` |
| 403 Forbidden | Error displayed inside modal |
| 404 Not found | Row removed from local state, modal closes |
| Server error (500) | Error displayed inside modal |

### Horoscope Detail

| Scenario | Behavior |
|----------|----------|
| Network failure | Error displayed inside modal, user can retry |
| 401 Unauthorized | Redirect to `/signin` |
| 403 Forbidden | Error displayed inside modal |
| 404 Not found | Redirect to `/` (horoscope no longer exists) |
| Success | Redirect to `/` (dashboard) |

### Admin

| Scenario | Behavior |
|----------|----------|
| Network failure | Error displayed inside modal |
| 401 Unauthorized | Redirect to `/signin` |
| 403 Forbidden (not admin) | Redirect to `/` |
| 403 "Cannot delete private" | Error message from API displayed inside modal |
| 404 Not found | Row removed from state, modal closes |
| Success | Row removed from state, modal closes |

---

## Accessibility Checklist

| Requirement | Implementation |
|-------------|---------------|
| Modal has `role="dialog"` | ✅ On outer `div` |
| `aria-modal="true"` | ✅ On outer `div` |
| `aria-label` on modal | ✅ Uses `t("horoscope.deleteConfirm")` |
| Focus trap within modal | ⚠️ Developer must implement `Tab`/`Shift+Tab` cycling |
| Escape closes modal | ✅ `onKeyDown` handler on outer div |
| Focus returns to trigger | ⚠️ Developer must store ref to trigger button, focus it on close |
| Error announced to screen readers | ✅ `role="alert"` on error banner |
| Delete button has accessible name | ✅ Text content `t("common.delete")` |
| Cancel button has accessible name | ✅ Text content `t("common.cancel")` |
| Color contrast ratios | ✅ All pass WCAG AA (4.5:1 minimum) |
| Keyboard-only completion | ✅ Tab to focus, Enter/Space to activate |
| Visual focus indicator | ✅ `focus:ring-2` with offset on both buttons |

---

## Micro-interactions

| Action | Effect |
|--------|--------|
| Click trash icon | Modal appears instantly (no animation, matches existing pattern) |
| Hover trash icon | `text-red-600` + `bg-red-50` background tint (100ms transition) |
| Hover Cancel button | `bg-gray-50` background (100ms transition) |
| Hover Delete button | `bg-red-700` darker shade (100ms transition) |
| Click backdrop | Modal disappears instantly |
| Press Escape | Modal disappears instantly |
| Delete in progress | Button text changes to "Loading...", both buttons disabled, backdrop click disabled |
| Delete succeeds (dashboard) | Modal closes, row remains (already removed by state update) |
| Delete succeeds (detail) | Modal closes, page navigates to `/` |
| Delete succeeds (admin) | Modal closes, row fades out (removed from state) |
| Delete fails | Error banner appears inside modal with `role="alert"` |

---

## Implementation Notes

### File Changes Required

| File | Change |
|------|--------|
| `src/components/ConfirmDeleteModal.tsx` | **Create** — new reusable modal component |
| `src/app/page.tsx` | **Modify** — import `ConfirmDeleteModal`, replace inline modal (lines 108-136) |
| `src/app/horoscopes/[id]/page.tsx` | **Modify** — add delete button in header (after line 377), add state + handler, render `ConfirmDeleteModal` |
| `src/app/admin/page.tsx` | **Modify** — add Actions column, add delete buttons for public horoscopes, add state + handler, render `ConfirmDeleteModal` |

### Component Import Pattern

```tsx
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
```

### Usage Pattern (same across all three pages)

```tsx
<ConfirmDeleteModal
    open={confirmDelete !== null}
    onConfirm={() => {
        if (confirmDelete) handleDelete(confirmDelete);
    }}
    onCancel={() => setConfirmDelete(null)}
    loading={deletingId !== null}
    error={deleteError}
/>
```

For the detail page (boolean state):

```tsx
<ConfirmDeleteModal
    open={confirmDelete}
    onConfirm={handleDelete}
    onCancel={() => {
        setConfirmDelete(false);
        setDeleteError(null);
    }}
    loading={deleting}
    error={deleteError}
/>
```

---

## Summary of UX Decisions

| Decision | Rationale |
|----------|-----------|
| Warning triangle icon (not skull/bomb) | Non-threatening, universally understood caution symbol |
| Red-100 circle behind icon | Softens the danger signal while maintaining visibility |
| Title + warning text layout | Icon + title on one line, text below with left padding aligned to title — clear hierarchy |
| Error inside modal (not page-level) | Keeps context — user sees what they tried to do and why it failed |
| Cancel on left, Delete on right | Follows platform convention (macOS, web apps) — destructive action is the rightmost, final action |
| Focus starts on Cancel | Prevents accidental deletion — user must intentionally Tab to Delete |
| `backdrop-blur-sm` on overlay | Modern touch, reduces background distraction, matches app's clean aesthetic |
| No animation on open/close | Matches existing `QuickAddLocationModal` pattern — instant feedback, no delay |
| `rounded-lg` on modal and buttons | Matches existing component patterns (`QuickAddLocationModal`, stat cards, table containers) |
| `max-w-sm` (384px) for modal | Consistent with main-ux-spec: "Max width: 480px" — slightly narrower for confirmation dialogs |
