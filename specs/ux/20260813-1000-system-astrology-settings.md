# System-Wide Astrology Settings (Shared Source of Truth) — UX Design

**Date:** 2026-08-13 10:00
**Author:** UX (BMAD)
**Based on:** `specs/business-analysis/20260812-2111-system-astrology-settings.md` (US-SAS-001..011), `specs/architecture/20260812-2200-system-astrology-settings.md` (D1..D13), `specs/ux/main-ux-spec.md`, `specs/ux/20260809-2215-planet-aspects.md`, `specs/business-analysis/20260810-0800-rashi-aspects.md`, `src/app/settings/page.tsx`, `src/app/admin/page.tsx`, `src/app/api/settings/route.ts`, `src/hooks/useI18n.tsx`, `src/messages/en.json`, `src/messages/si.json`

---

## 1. Overview

The three astrological calculation settings — **Planetary Orbs (Rāśmi)**, **Planet Aspects (දෘෂ්ඨි)**, **Rashi Aspects (රාශි දෘෂ්ඨි)** — move from per-user values on `User` to a single system-wide `AstrologySettings` document. This is the **single source of truth**: only a **super-admin** can change them, students view them **read-only**, and any real change triggers a **background bulk recalculation** of every stored `CalculatedDetails` snapshot.

**UX decision (confirmed 2026-08-13):** there is **no new admin screen**. The existing Settings page (`/settings`) serves both roles — the UI shape is unchanged; only **editability is role-gated**:

| Role | What they see on `/settings` |
|------|------------------------------|
| Student | The full three sections **read-only** (values, pills, badges) + a "managed by the administrator" notice; Save/Reset hidden; PUT is rejected by the API (403) |
| Super-admin | The **same editable sections** (existing controls unchanged) + a metadata strip + **single bulk Save** (all three sections, includes `version`) + a **recalculation status panel** + collapsible **audit log** and **recalc history** |

Internally the page branches on `session.user.role`:

- **Students** — `GET /api/settings` (values only, shape unchanged) for display.
- **Super-admin** — `GET /api/admin/astrology-settings` (full document including `version`, `updatedBy`, `updatedAt`, `lastRecalculatedAt`, `recalcStatus`, `auditLog`, `recalcHistory`) and `PUT /api/admin/astrology-settings` (subset, `version` required) on Save.

**UX goals:**

1. **One page, two modes** — no navigation or screen changes; the existing layout is preserved for both roles (per PM/UX confirmation 2026-08-13).
2. **Role clarity** — students immediately understand the values are system-wide and not theirs to change (managed-by-admin notice, no edit affordances); admins see everything they need (editable values, save feedback, progress, history) in place.
3. **Trust in the bulk recalculation** — the admin is told *when* a change triggers a recalculation, can watch live progress, and can retry failures — the trigger is never silent.
4. **No silent data loss** — the `version` optimistic lock surfaces as an explicit conflict with a refresh path; edits are staged locally and never lost on a failed save.
5. **Bilingual parity** — every new string ships in Sinhala and English, reusing the existing `astrology.planetNames.*` / `astrology.signNames.*` / `settings.*` keys where they exist.

---

## 2. Role-Based Behavior Matrix

| Capability | Student | Super-admin |
|------------|---------|-------------|
| Route | `/settings` | `/settings` (same) |
| Fetch | `GET /api/settings` → values only | `GET /api/admin/astrology-settings` → full doc incl. `version` + metadata |
| Planetary Orbs | static values (no inputs) | editable number inputs (0–30, step 0.5) |
| Planet Aspects | rows + `[Default]`/`[Custom]` pills + values text | expandable rows + house/degree chip editors (existing controls) |
| Rashi Aspects | enabled badge + override badges + rule summary | toggle + per-sign override chips (existing controls) |
| Chara/Thira/Ubaya rule summary | informational, read-only | informational, read-only (rules are fixed, not editable) |
| Save | hidden (API 403 anyway) | single bulk Save (all three sections, includes current `version`) |
| Reset to defaults | hidden | visible (bulk reset → Save → triggers recalc) |
| Metadata strip (version/updated-by/last recalc) | hidden (D12) | visible |
| Recalculation status panel | hidden | visible (idle/running/completed/failed + retry) |
| Audit log / recalc history | hidden | visible (default-collapsed) |
| Language toggles | visible (unchanged) | visible (unchanged) |

---

## 3. Answers to Architecture / BA Open Questions (UX-relevant)

| OQ | Decision (source) | UX consequence |
|----|-------------------|----------------|
| OQ2 Sync vs async | Return immediately; recalc runs in background (arch D4) | Save shows "Settings saved — recalculation started"; the status panel activates and polls |
| OQ3 Progress transport | Polling (arch D4/D5) | Status panel polls `GET /api/admin/astrology-settings/recalc` every ~3s while `status === "running"`; stops on completion/failure |
| OQ8 Student read endpoint | Reuse `GET /api/settings` (arch D11) | Student branch of the page reads the same endpoint it reads today — no new route |
| OQ9 Admin metadata exposure | Hidden from students (arch D12) | Metadata strip, status panel, audit/history render only for `super-admin` |
| OQ11 Failure retry | Targeted `horoscopeIds` POST + body-less full rerun (arch D5/D6) | Completed/failed panel offers **Retry failed** (targeted) and **Run full recalc** (full) |
| OQ15 UI placement | **Same `/settings` page** (confirmed 2026-08-13); no new admin screen | This spec is entirely about role-gating the existing page + the admin-only additions on it |
| OQ16 rashiAspects default | `enabled: false` (BA US-SAS-007) | Student read-only shows "Disabled" until an admin enables it; backward compatible |

---

## 4. User Flows

### 4.1 Flow: Student views the system settings (read-only)

```
Student → /settings →
  → useSession: role "student" →
  → GET /api/settings → { planetaryOrbs, planetAspects, rashiAspects } →
  → Sections render read-only:
      · Managed-by-admin notice banner at the top of the card
      · Orbs: 9 static rows (planet label + value + °)
      · Planet Aspects: 9 rows, [Default]/[Custom] pills + houses/degrees as text
      · Rashi Aspects: Enabled/Disabled badge + per-sign override badges +
        Chara/Thira/Ubaya rule summary
  → No Save, no Reset, no inputs, no dirty indicator →
  → Language toggles still work
Student attempts write (hand-crafted PUT /api/settings) → 403 "managed by the administrator"
  → page never offers a write path, so the 403 is defensive only
```

### 4.2 Flow: Super-admin edits and saves (triggers recalculation)

```
Super-admin → /settings →
  → GET /api/admin/astrology-settings → full doc; page stores `version` + metadata →
  → Metadata strip renders: "Version 3 · Updated by Dinuka · 2026-08-12 · Last recalculated 2026-08-12" →
  → Edit any subset of the three sections (existing controls) →
  → "● Unsaved changes" indicator appears →
  → Save →
      · Client sends the current `version` + all three sections
        (planetaryOrbs, planetAspects, rashiAspects) — single bulk PUT
      · PUT /api/admin/astrology-settings →
        · 200 updated → "Settings saved — recalculation started"
          → page stores the new `version` from the response
          → status panel enters "running" and starts polling
        · 200 noChange → "Settings saved" (no recalc triggered)
        · 409 running → inline banner "A recalculation is in progress…" (Save was disabled,
          so this is defensive)
        · 409 stale → conflict banner with [Reload] (see §6.2)
        · 400 → localized section banner, edits preserved, nothing saved
```

### 4.3 Flow: Admin watches a recalculation run

```
Save triggered a run (or a run was resumed via reload / a prior save) →
  → Status panel state "running":
      · Progress bar: processed / total ("Recalculating… 320 of 1,204 horoscopes")
      · Succeeded / failed live counts
      · Poll GET /api/admin/astrology-settings/recalc every ~3s
  → Save is disabled while running; the form is still editable but cannot be submitted
     ("A recalculation is in progress. Saving resumes when it completes.")
  → Panel completes → "completed":
      · finishedAt timestamp; total / succeeded / failed counts
      · failed > 0 → collapsible failed id list (first 100) + [Retry failed]
      · [Run full recalc] available at all times
  → Admin leaves the page mid-run → polling stops (component unmount); returning re-fetches
    the persisted recalcStatus and resumes polling if still running (US-SAS-004 resumability)
```

### 4.4 Flow: Retry failed horoscopes (OQ11)

```
Status panel → "completed" with failed > 0 →
  → [Retry failed] →
      · POST /api/admin/astrology-settings/recalc { horoscopeIds: [...] } (the failed subset)
      · Panel re-enters "running" over exactly those ids → polls → new completed result
  → [Run full recalc] (body-less POST) → full resumable run over all horoscopes
  → Both share the same panel/progress/reporting; a run already in progress is a no-op
    (single-flight guard, D7) — the panel simply keeps showing the live run
```

### 4.5 Flow: Conflict — stale version (409)

```
Two admins edit simultaneously →
  · Admin A saves → version 4, recalc running
  · Admin B has version 3 open and hits Save →
      · 409 "Settings have changed. Refresh and retry."
      · Conflict banner: "Settings were changed by another admin."
        [Reload] → re-fetches the current doc (discards local edits, after a
        "Discard your changes?" confirm when dirty) → admin re-applies edits
        against the new version (Save now disabled if a recalc is running)
```

---

## 5. Wireframes

### 5.1 Settings page shell (both roles — unchanged chrome)

```
┌─ Settings (සැකසුම්) ──────────────────────────────────────────────┐
│  ┌─ Language (භාෂාව) ──────────────────────────────────────────┐  │
│  │  [සිංහල] [English]                                         │  │
│  └─────────────────────────────────────────────────────────────┘  │
│  ─────────────────────────────────────────────────────────────    │
│  [ STUDENT ]  ▸ Managed-by-admin notice banner                    │
│  [ ADMIN    ] ▸ Metadata strip (version · updated by · last recalc)│
│  ─────────────────────────────────────────────────────────────    │
│  ┌─ Planetary Orbs (ග්‍රහ රාශ්මි) ──────────────────────────────┐  │
│  │  student: 9 read-only rows · admin: 9 number inputs          │  │
│  └─────────────────────────────────────────────────────────────┘  │
│  ─────────────────────────────────────────────────────────────    │
│  ┌─ Planet Aspects (දෘෂ්ඨි) ────────────────────────────────────┐  │
│  │  student: 9 rows + pills + values text · admin: expandable   │  │
│  │  chip editors (existing controls)                            │  │
│  └─────────────────────────────────────────────────────────────┘  │
│  ─────────────────────────────────────────────────────────────    │
│  ┌─ Rashi Aspects (රාශි දෘෂ්ඨි) ────────────────────────────────┐  │
│  │  student: badge + override badges + rule summary             │  │
│  │  admin: toggle + per-sign chips (existing controls)          │  │
│  └─────────────────────────────────────────────────────────────┘  │
│  [ ADMIN ONLY ]                                                   │
│  · Save + Reset to defaults footer (with unsaved-changes badge)   │
│  · Recalculation status panel (below the sections)                │
│  · ▸ Audit log (collapsible)                                      │
│  · ▸ Recalculation history (collapsible)                          │
└───────────────────────────────────────────────────────────────────┘
```

### 5.2 Managed-by-admin notice (student only)

```
┌──────────────────────────────────────────────────────────────────┐
│  ℹ These astrology settings are system-wide and managed by the   │
│    administrator. All horoscopes are calculated with these shared │
│    values.                                                        │
└──────────────────────────────────────────────────────────────────┘
```

- Info-tone banner (`--primary` at 10% bg, indigo icon), rendered above the first settings section, inside the white card.
- **Never renders for super-admin** — the admin already knows they manage it (the Save button is the affordance).

### 5.3 Metadata strip (admin only)

```
  Version 4   ·   Updated by Dinuka  ·   Aug 12, 2026 22:05   ·   Last recalculated Aug 12, 2026 22:06
```

| Token | Source | Rendering |
|-------|--------|-----------|
| `Version {n}` | `doc.version` | Always present (seed = 1); `monospace` value |
| `Updated by {name}` | `doc.updatedBy.name` → fallback `doc.updatedBy.id` (last 6 chars) | Omitted entirely when `updatedBy` is absent (fresh seed) |
| `Updated {datetime}` | `doc.updatedAt` | `formatDate`; omitted when absent |
| `Last recalculated {datetime}` | `doc.lastRecalculatedAt` | Absent → renders `Last recalculated — never` (gray, never errors) |

### 5.4 Student read-only sections

**Planetary Orbs** (student):

```
Planetary Orbs (ග්‍රහ රාශ්මි)
  ☉ රවි / Sun   15°     ♂ කුජ / Mars   7°      ♃ ගුරු / Jupiter   9°
  ☽ සඳු / Moon  12°     ☿ බුධ / Mercury 8°     ♀ සිකුරු / Venus  9°
  ♄ ශනි / Saturn 7°     ☊ රාහු / Rahu  0°      ☋ කේතු / Ketu   0°
```

- Static rows; the existing 2-per-row grid pattern retained; value + `°`; no inputs, no focus, no `aria-pressed`.

**Planet Aspects** (student):

```
Planet (ග්‍රහයා)        Status      Houses (භාව)          Degrees (අංශක)
☉ රවි / Sun            [Custom]    3, 7, 10              60, 180, 240
☽ සඳු / Moon           [Default]   3, 5, 7, 9, 10        60, 90, 120, 180
… (all 9 planets)
```

- Identical to the admin collapsed list: `[Default]` gray / `[Custom]` indigo pills (existing semantics — Custom = absolute houses, Default = offsets), comma-separated values.
- **No chevrons, no expand, no Reset** — rows are non-interactive text.
- A planet with no stored entry still shows its effective defaults (the existing `effectiveEntry` behavior) — there is never an empty cell.

**Rashi Aspects** (student):

```
Rashi Aspects (රාශි දෘෂ්ඨි)
  Status: ● Enabled          ← or "○ Disabled" when rashiAspects.enabled === false

  [Aspecting sign → aspected signs — disabled overrides shown struck-through]
  මේෂ Aries   [සිංහ] [වෘශ්චික] [කුම්භ]        ← no override
  වෘෂභ Taurus [සිංහ~~] [වෘශ්චික] [කුම්භ]     ← Leo override disabled (struck-through)
  … (all 12 aspecting signs)

  ℹ How the fixed rules work (read-only):
    · Chara rashis (මේෂ, කටක, තුලා, මකර) aspect Thira rashis, excluding the nearest.
    · Thira rashis (වෘෂභ, සිංහ, වෘශ්චික, කුම්භ) aspect Chara rashis, excluding the nearest.
    · Ubaya rashis (මිථුන, කන්‍යා, ධනු, මීන) aspect the other Ubaya rashis.
    These rules are fixed and not configurable.
```

- When `enabled === false`: show the **Disabled** badge and collapse the 12-sign grid; keep the rule summary visible (informational per US-SAS-005 AC2).
- Overrides render as struck-through badges (existing red/line-through visual) exactly as the admin editor shows disabled signs, but **without toggle buttons**.

### 5.5 Admin editable sections

Identical to the current page's editable controls — **reused unchanged**:

- **Orbs**: number inputs (min 0, max 30, step 0.5), existing layout.
- **Planet Aspects**: expandable rows with house chips (1–12) + degree chips (30–330 step 30), `[Default]`/`[Custom]` pills, per-planet Reset, jump context preserved (`effectiveEntry` logic unchanged).
- **Rashi Aspects**: enabled toggle + per-sign aspecting-sign chips + target override chips (existing `toggleSignOverride` / `toggleTargetOverride` behavior).
- **Footer**: `● Unsaved changes` indicator + **Save** (single bulk) + **Reset to defaults** (existing confirm modal pattern from `20260809-2215-planet-aspects.md`).

**Save behavior (admin only):**

| State | Visual / behavior |
|-------|-------------------|
| Clean | Save disabled (nothing to save) |
| Dirty | amber dot + "Unsaved changes" ; Save enabled (primary) |
| Saving | spinner + `aria-busy`; all controls disabled; single bulk PUT in flight |
| 200 updated | green "Settings saved — recalculation started" (replaces `settings.saved` for admins) + toast; `version` updated from response; status panel → running |
| 200 noChange | green "Settings saved" (no recalc) |
| 409 running | banner (defensive — Save is disabled while running) |
| 409 stale | conflict banner + [Reload] (§6.2) |
| 400 | localized section banner; edits preserved |

> **Why single bulk Save (confirmed 2026-08-13):** one Save persists all three sections in a single PUT — the same interaction students had before the feature. The API's subset semantics remain valid; the UI simply always sends all three (subset is a server-side feature, not a UI requirement).

### 5.6 Recalculation status panel (admin only)

Placed directly below the three sections, above the audit/history panels, inside the white card. Renders **only for super-admin**.

**State: never run** (`recalcStatus` absent — fresh seed):

```
┌─ Recalculation (නැවත ගණනය කිරීම) ───────────────────────────┐
│  No recalculation has been run yet.                          │
│  Saving settings changes will recalculate every horoscope.   │
│                                              [Run full recalc] │
└──────────────────────────────────────────────────────────────┘
```

**State: running**

```
┌─ Recalculation (නැවත ගණනය කිරීම) ───────────────────────────┐
│  ● Recalculating…  320 of 1,204 horoscopes                   │
│  ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░  27%                        │
│  Succeeded 318 · Failed 2          (Settings version 4)      │
│  ↻ Updates automatically                                        │
└──────────────────────────────────────────────────────────────┘
```

- Progress bar: `processed / total`, percentage label; counts under the bar.
- Polls `GET /api/admin/astrology-settings/recalc` every **3s** while `status === "running"`; stops on `completed`/`failed`; a small `role="status"` live region announces completion.
- The three settings sections remain **editable but Save is disabled** while running (409-running contract, D7) with the banner from §6.3.

**State: completed**

```
┌─ Recalculation (නැවත ගණනය කිරීම) ───────────────────────────┐
│  ✓ Completed · Aug 12, 2026 22:06                             │
│  Total 1,204 · Succeeded 1,202 · Failed 2                     │
│  ▸ View 2 failed horoscopes          [Retry failed] [Run full recalc] │
└──────────────────────────────────────────────────────────────┘
```

- `failed === 0` → no failure row, no Retry button.
- `failed > 0` → "View N failed horoscopes" expands a capped list (first 100 ids, monospace, scrollable max-h); **Retry failed** → `POST /recalc { horoscopeIds }` (§4.4).
- `status === "failed"` (run-level) → error tone: "Recalculation failed: {error}" + [Retry] (full run).

**Counts are color-coded but never color-only:** succeeded green, failed red, both with text labels (`--success` / `--error` tokens, ≥ 4.5:1).

### 5.7 Audit log panel (admin only)

Default-collapsed `<details>`-style panel ("▸ Audit log / සැකසුම් වෙනස්කම් ඉතිහාසය"). Capped at 100 entries; newest first.

```
┌─ Audit log (සැකසුම් වෙනස්කම් ඉතිහාසය) ────────────────────────┐
│  ▸ Audit log                                    (3)         │
└────────────────────────────────────────────────────────────┘
  (expanded)
┌──────────────────────────────────────────────────────────────┐
│  v3 → v4   Dinuka      Aug 12, 2026 22:05                     │
│            rashiAspects.enabled: false → true                 │
│  v2 → v3   Priyanka    Aug 12, 2026 21:40                     │
│            planetaryOrbs["1"]: 15 → 10                        │
│            planetAspects["4"].houses: [4,7] → [4,7,9]         │
└──────────────────────────────────────────────────────────────┘
```

- Each entry: version chip (`v{from}`→`v{to}` — new version from `entry.version`), admin name (fallback id suffix), `changedAt` (`formatDate`), and one line per changed field as `field.path: from → to` (localized field labels; `JSON.stringify` for object values).
- Empty state: "No settings changes recorded yet."

### 5.8 Recalculation history panel (admin only)

Default-collapsed. Capped at 20 runs; newest first.

```
┌─ Recalculation history (නැවත ගණනය කිරීම් ඉතිහාසය) ────────────┐
│  Settings v4   Dinuka      Aug 12 22:05 → 22:06  1,204 / 1,202 / 2   ▸ failed ids │
│  Settings v2   Priyanka    Aug 11 09:00 → 09:02    850 / 850 / 0                │
└──────────────────────────────────────────────────────────────────────────────────┘
```

- Columns: settings version, triggered-by name (fallback id suffix), started→finished timestamps (finished empty for an in-flight/failed run), `total / succeeded / failed` counts, and an expandable failed-id list when `failed > 0`.
- Empty state: "No recalculation runs yet."

---

## 6. Validation & Error States

### 6.1 Validation (server-driven, mirrored from existing settings route)

The admin controls are structurally safe (chips constrain houses 1–12 and degrees 30–330 step 30; orb inputs constrain 0–30). Server-side validation is all-or-nothing (US-SAS-002 AC2): a 400 renders a **section-level banner** with the localized message and **no partial save** — the local edits remain staged.

| Trigger | Surface |
|---------|---------|
| 400 invalid orbs/aspects/rashi | banner: "Could not save settings: {message}" (reuses existing `settings.planetAspects.errSave` pattern) |
| Empty/partial success | never — a 200 always carries the updated doc |

### 6.2 409 — stale version (conflict)

```
┌─ ⚠ Settings were changed by another administrator. ──────────┐
│  Your copy is out of date (version 3).                        │
│  [Reload current settings]                                    │
│  (if dirty: "Reloading discards your unsaved changes.")       │
└──────────────────────────────────────────────────────────────┘
```

- Rendered above the footer when Save returns 409 stale.
- **Reload current settings** → re-fetches the doc (new `version` + values + any running recalc), replaces the form state. If the form is dirty, a confirm first: "Discard your unsaved changes?" `[Discard and reload] [Cancel]`.
- After reload, if a recalc is running, Save stays disabled (§6.3) until it completes — the other admin's update owns the recalc.

### 6.3 409 — recalculation in progress

```
┌─ ℹ A recalculation is in progress. ──────────────────────────┐
│  Saving resumes when it completes. Progress is shown below.   │
└──────────────────────────────────────────────────────────────┘
```

- Save button **disabled** while `recalcStatus.status === "running"` (proactive, not wait-for-409). The status panel shows the live run. The form stays editable (staged), so the admin can prepare the next change — but cannot submit until the run finishes.

### 6.4 Loading / load error

| State | Surface |
|-------|---------|
| Loading | existing skeleton rows (page loader pattern) for the sections; metadata strip hidden until load |
| Load error | inline banner + [Retry] (existing pattern); nothing is shown as stale defaults |
| `recalcStatus` / `auditLog` / `recalcHistory` absent | treated as "never run" / empty states — never an error, never a placeholder `{}` |

---

## 7. Component Design

| Component | Purpose | States | Props |
|-----------|---------|--------|-------|
| `SettingsPage` (modified) | Role-gated container: branches fetch/save endpoints, renders the shared three sections + admin-only panels | `loading`, `loaded`, `dirty`, `saving`, `conflict`, `role` | session-driven; no new props |
| `ManagedByAdminNotice` (new) | Student-only info banner | `visible` | `locale` |
| `SettingsMetadataStrip` (new) | Admin-only version/updated-by/last-recalc strip | `seeded`, `updated`, `neverRecalculated` | `doc` (`version`, `updatedBy?`, `updatedAt?`, `lastRecalculatedAt?`) |
| `PlanetaryOrbsSection` | **Extracted** shared section; `readOnly` prop toggles inputs vs static rows | `readOnly`, `dirty`, `error` | `orbs`, `onChange?` (absent when read-only), `locale` |
| `PlanetAspectsSection` | **Extracted** shared section (from `settings/page.tsx` logic); `readOnly` disables chips/expand/Reset | `readOnly`, `dirty`, `error` | `planetAspects`, `onChange?`, `locale` |
| `RashiAspectsSection` | **Extracted** shared section; `readOnly` renders badge/override badges/rule summary | `readOnly`, `enabled`, `dirty` | `rashiAspects`, `onChange?`, `locale` |
| `RecalcStatusPanel` (new) | Admin-only progress/result + retry | `neverRun`, `running`, `completed`, `failed`, `polling` | `recalcStatus?`, `onPoll` (interval manager), `onRetryFailed(ids)`, `onRunFull()`, `locale` |
| `FailedHoroscopeList` (new) | Collapsible capped list of failed ids | `collapsed`, `expanded` | `ids` (≤100), `locale` |
| `AuditLogPanel` (new) | Default-collapsed change log | `collapsed`, `empty` | `entries` (≤100), `locale` |
| `RecalcHistoryPanel` (new) | Default-collapsed run history | `collapsed`, `empty` | `runs` (≤20), `locale` |
| `ConflictBanner` (new) | 409-stale recovery | `idle`, `confirmingDiscard` | `onReload`, `dirty` |

All are client-side; the numeric Planet/ZodiacSign enum values flow to the API — never display strings (repo convention). `readOnly` is passed down so the shared section components are pure presentational switches, not role branches inside.

**Polling implementation note (flag for Developer):** the panel owns a `setInterval` (3s) that fires `GET /api/admin/astrology-settings/recalc`, cleared on unmount/completion. To avoid double-polling under Strict Mode, use a ref-guarded interval or an effect that keys off `status === "running"`.

---

## 8. Accessibility

| Requirement | Design |
|-------------|--------|
| Keyboard | Existing chip/toggle patterns unchanged (focusable `<button>`, `aria-pressed`). New panels use native `<details>`/`<summary>` or `role="region"` + `aria-expanded` toggles; Save/reset reachable via normal Tab order |
| Screen readers | Managed-by-admin notice `role="status"`; recalc progress bar `role="progressbar"` + `aria-valuenow`/`aria-valuemax` + `aria-valuetext` ("320 of 1,204"); completion announced via `aria-live="polite"`; conflict banner `role="alert"`; Save button `aria-busy` while saving |
| Status pills / badges | never color-only — text always present (`[Default]`, `[Custom]`, `Enabled`, `Disabled`, `✓ Completed`, `● Running`) |
| Contrast | counts use `--success`/`--error` at ≥ 4.5:1; info banners use text ≥ 4.5:1 |
| Focus management | On conflict reload, focus moves to the metadata strip or first section; on Save error, focus moves to the banner; on retry, focus returns to the Retry button |
| Motion | Progress bar and panel transitions 150–200ms; disabled under `prefers-reduced-motion` |

---

## 9. Responsive Behavior

| Breakpoint | Behavior |
|------------|----------|
| Desktop (≥1024px) | Full layout as wireframed; status panel inline; audit/history panels side-by-side allowed |
| Tablet (640–1023px) | Sections stack; metadata strip wraps to 2 lines; status panel full-width |
| Mobile (<640px) | Existing single-column section behavior; metadata strip collapses to "v4 · by Dinuka" / "recalculated Aug 12"; Save + dirty indicator become a sticky bottom bar within the card (existing pattern); status panel full-width; failed-id list full-height scroll |

---

## 10. Micro-interactions

| Interaction | Behavior |
|-------------|----------|
| Save → running | Footer success text swaps to "Settings saved — recalculation started"; the status panel fades in with a progress bar animating from 0 |
| Progress tick (3s poll) | Bar width + counts update with a 300ms ease; no page jump; `aria-live` only announces transitions (running→completed) |
| Completed | Progress bar turns green (or the panel switches to the completed summary); success tone |
| Retry failed | Panel re-enters running with a subtle re-open animation; counts reset to the targeted total |
| Conflict | Banner slides in (120ms); confirm dialog uses the existing modal pattern |

---

## 11. i18n Message Keys (EN + SI, both synced)

Reuses existing keys where possible: `settings.title`, `settings.planetaryOrbs`, `settings.planetAspects`, `settings.rashiAspects`, `settings.rashiAspectsDescription`, `settings.housesColon`, `settings.degreesColon`, `settings.customStatus`, `settings.defaultStatus`, `settings.enable`, `settings.resetDefaults`, `settings.saved`, `settings.planetAspects.*`, `astrology.planetNames.*`, `astrology.signNames.*`.

New keys (SI proposals for BA/PM review — Appendix B of the BA spec):

| Key | EN | SI (proposal) |
|-----|----|----------------|
| `settings.system.managedByAdminTitle` | System-wide settings | පද්ධති-පුළුල් සැකසුම් |
| `settings.system.managedByAdminBody` | These astrology settings are system-wide and managed by the administrator. All horoscopes are calculated with these shared values. | මෙම ජ්‍යෝතිෂ සැකසුම් පද්ධතියටම පොදු වන අතර පරිපාලක විසින් කළමනාකරණය කරනු ලැබේ. සියලුම කේන්දර ගණනය කෙරෙන්නේ මෙම පොදු අගයන් භාවිතයෙනි. |
| `settings.system.version` | Version | අනුවාදය |
| `settings.system.updatedBy` | Updated by | විසින් යාවත්කාලීන කරන ලදී |
| `settings.system.updatedAt` | Updated | යාවත්කාලීන කළේ |
| `settings.system.lastRecalculated` | Last recalculated | අවසන් වරට නැවත ගණනය කළේ |
| `settings.system.neverRecalculated` | never | කිසි දිනෙක නැත |
| `settings.system.saveRecalcStarted` | Settings saved — recalculation started | සැකසුම් සුරැකිණි — නැවත ගණනය කිරීම ආරම්භ විය |
| `settings.recalc.title` | Recalculation | නැවත ගණනය කිරීම |
| `settings.recalc.neverRun` | No recalculation has been run yet. | තවම කිසිදු නැවත ගණනය කිරීමක් සිදු වී නැත. |
| `settings.recalc.neverRunHint` | Saving settings changes will recalculate every horoscope. | සැකසුම් වෙනස් කිරීම් සුරැකීම සියලුම කේන්දර නැවත ගණනය කරයි. |
| `settings.recalc.running` | Recalculating… | නැවත ගණනය කරමින්… |
| `settings.recalc.processedOf` | {processed} of {total} horoscopes | කේන්දර {total} න් {processed} ක් |
| `settings.recalc.succeeded` | Succeeded | සාර්ථකයි |
| `settings.recalc.failed` | Failed | අසාර්ථකයි |
| `settings.recalc.completed` | Completed | සම්පූර්ණයි |
| `settings.recalc.runFailed` | Recalculation failed: {error} | නැවත ගණනය කිරීම අසාර්ථකයි: {error} |
| `settings.recalc.updatesAutomatically` | Updates automatically | ස්වයංක්‍රීයව යාවත්කාලීන වේ |
| `settings.recalc.viewFailed` | View {count} failed horoscopes | අසාර්ථක කේන්දර {count} ක් බලන්න |
| `settings.recalc.hideFailed` | Hide failed horoscopes | අසාර්ථක කේන්දර සඟවන්න |
| `settings.recalc.retryFailed` | Retry failed | අසාර්ථක ඒවා නැවත උත්සාහ කරන්න |
| `settings.recalc.runFull` | Run full recalc | සම්පූර්ණ නැවත ගණනය කරන්න |
| `settings.recalc.inProgress` | A recalculation is in progress. Saving resumes when it completes. | නැවත ගණනය කිරීමක් ක්‍රියාත්මක වේ. එය අවසන් වූ පසු සුරැකීම නැවත ලබා ගත හැක. |
| `settings.recalc.settingsVersion` | Settings version {version} | සැකසුම් අනුවාදය {version} |
| `settings.conflict.title` | Settings were changed by another administrator. | සැකසුම් වෙනත් පරිපාලකයෙකු විසින් වෙනස් කර ඇත. |
| `settings.conflict.body` | Your copy is out of date (version {version}). | ඔබගේ පිටපත යල් පැන ගොස් ඇත (අනුවාදය {version}). |
| `settings.conflict.reload` | Reload current settings | වත්මන් සැකසුම් නැවත පූරණය කරන්න |
| `settings.conflict.discardConfirmTitle` | Discard your unsaved changes? | සුරැකීමට ඇති වෙනස්කම් ඉවත දමන්නද? |
| `settings.conflict.discardConfirmBody` | Reloading discards your unsaved changes. | නැවත පූරණය කිරීම ඔබගේ සුරැකීමට ඇති වෙනස්කම් ඉවත දමයි. |
| `settings.audit.title` | Audit log | සැකසුම් වෙනස්කම් ඉතිහාසය |
| `settings.audit.empty` | No settings changes recorded yet. | තවම සැකසුම් වෙනස්කම් සටහන් වී නැත. |
| `settings.audit.versionFromTo` | v{from} → v{to} | v{from} → v{to} |
| `settings.history.title` | Recalculation history | නැවත ගණනය කිරීම් ඉතිහාසය |
| `settings.history.empty` | No recalculation runs yet. | තවම නැවත ගණනය කිරීම් නොමැත. |
| `settings.history.triggeredBy` | Triggered by | මගින් ආරම්භ කරන ලදී |
| `settings.history.settingsVersion` | Settings v{version} | සැකසුම් v{version} |

Notes:
- Numerals are Western in both locales (app convention); `→` (U+2192) is language-neutral.
- Student copy for the Rashi rule summary reuses the existing `settings.rashiAspectsDescription` (it already describes Chara→Thira, Thira→Chara, Ubaya→Ubaya, nearest excluded) — no new rule-summary key needed.
- `settings.saved` remains the no-change success text; `settings.system.saveRecalcStarted` is used only when the PUT reports a real change.

---

## 12. Files Created/Updated (context for QA)

**Created:**
- `specs/ux/20260813-1000-system-astrology-settings.md` — this spec

**Updated (UX main documents):**
- `specs/ux/main-ux-spec.md` — settings page section (role-gated read-only vs editable; managed-by-admin notice; admin metadata strip + recalc status panel + audit/history), interaction patterns, file index row

**Pending (Development)** — per architecture `20260812-2200-system-astrology-settings.md`:
- `src/app/settings/page.tsx` — role branch (student read-only / admin editable), extract the three sections with a `readOnly` prop, metadata strip, status panel + 3s polling, audit/history panels, conflict banner
- API wiring — students: `GET /api/settings` unchanged; admins: `GET`/`PUT /api/admin/astrology-settings`, `GET`/`POST /api/admin/astrology-settings/recalc`
- i18n keys in `src/messages/en.json` + `src/messages/si.json` (keep in sync)

**Flags for QA:**
1. **Student regression:** every control is inert for students — no inputs, no chips, no Save/Reset, no dirty indicator; orbs show static values; a hand-crafted `PUT /api/settings` returns 403 and nothing persists.
2. **Role branch is server-truthful:** the UI disables editing client-side for students, but the API must enforce it too (401/403 per US-SAS-008) — QA verifies both, including 401 for unauthenticated `GET /api/admin/astrology-settings`.
3. **Admin save → recalc:** a real change returns 200 + `recalcStarted`; the panel enters "running" and polls to completion; counts match the run summary; `lastRecalculatedAt` and a `recalcHistory` entry appear.
4. **No-op save:** identical values → `noChange: true`, no version bump, no recalc, no audit entry, panel untouched (US-SAS-002 AC4).
5. **409 running:** Save is disabled while `recalcStatus.status === "running"`; a forced concurrent PUT returns the localized 409 message.
6. **409 stale:** two-admin race — second save shows the conflict banner; Reload re-fetches; dirty reload prompts before discarding.
7. **Progress states:** never-run (absent), running (bar + counts), completed with `failed > 0` (id list + Retry failed), completed `failed === 0` (no retry), run-level `failed` (error + Retry). Polling stops on completion and on unmount (no stray intervals).
8. **Resume-after-restart:** a mid-run kill leaves `running`; the panel re-fetches the persisted status and resumes polling / the POST body-less resumes from `lastProcessedHoroscopeId`.
9. **Read-only parity:** the student view shows exactly the same effective values the admin editor would — `[Custom]` rows show stored values, `[Default]` rows show the authoritative defaults (never empty cells).
10. **SI/EN parity:** all new keys exist in both message files; Sinhala renders without overflow (15–20% wider — check the metadata strip and failed-id list on mobile).
11. **No admin metadata leak:** student responses never include `version`/`updatedBy`/`updatedAt`/`recalcStatus`/`auditLog`/`recalcHistory` (D12); QA inspects the wire response, not just the UI.
