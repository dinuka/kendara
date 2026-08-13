# User Stories — System-Wide Astrology Settings (Shared Source of Truth)

**Date:** 2026-08-12
**Status:** Draft
**Related:** `20260809-2133-planet-aspects.md` (Planet Aspects / දෘෂ්ඨි), `20260810-0800-rashi-aspects.md` (Rashi Aspects / රාශි දෘෂ්ඨි) — this feature **supersedes the per-user settings model** of both. Those docs are historical and are not rewritten; this spec is the new source of truth.

---

## Background / Context

The three astrological calculation settings are currently **per-user** settings stored on each `User` document (`src/models/User.ts`: `planetaryOrbs`, `planetAspects?`, `rashiAspects?`) and editable by any student via `GET/PUT /api/settings`:

1. **Planetary Orbs (Rāśmi)** — per-planet orb tolerance (`Record<string, number>` keyed by numeric Planet enum string; defaults `{"1":15,"2":12,"3":8,"4":7,"5":9,"6":7,"7":9,"8":0,"9":0}`).
2. **Planet Aspects (දෘෂ්ඨි)** — "Planets Aspects houses and degrees": per-planet aspect houses (1-12) and aspect degree angles (multiples of 30 in 30-330).
3. **Rashi Aspects (රාශි දෘෂ්ඨි)** — enabled toggle + optional per-sign overrides for the fixed Chara/Thira/Ubaya rules.

Because these are per-user, the same horoscope could produce different house/planet aspects for different students (owner, viewers of public horoscopes, share-link recipients). This feature changes the model to **system-wide common settings** — a single shared source of truth for the whole system:

- **Only super-admin** can update them. Other user can view it. But cannot update.
- On update, the system **recalculates ALL horoscopes' `CalculatedDetails`** in the DB — both `source: "auto"` and `source: "manual"` — so every stored snapshot reflects the new system settings.
- Students view the shared values **read-only**.
- Legacy per-user fields on `User` are **deprecated/ignored**.

Codebase touchpoints (verified 2026-08-12): `src/models/User.ts`, `src/app/api/settings/route.ts`, validators `src/lib/planetAspects.ts` / `src/lib/rashiAspects.ts`, `src/lib/calculation.ts` (`calculateHoroscope(horoscope, planetaryOrbs, planetAspects, rashiAspects)`), `src/app/api/horoscope/route.ts` (auto create), `src/app/api/horoscope/manual/route.ts` (manual create via `src/lib/manualChart.ts`), `src/app/api/horoscope/[id]/route.ts` (recalc), admin pattern `src/app/api/admin/route.ts` (`checkAdmin()` — `role === "super-admin"` else 403), `src/models/CalculatedDetails.ts`, `src/lib/logger.ts`.

---

## System Astrology Settings Actors

### Super Admin (Settings Context)

- **Description**: The system administrator who manages the platform-wide astrological calculation settings.
- **Settings-Specific Goals**: View and update the three system-wide settings; trigger and monitor the full recalculation.
- **Settings-Specific Permissions**:
  - View the three system-wide astrology settings (Planetary Orbs, Planet Aspects, Rashi Aspects) and their metadata (who/when updated, last recalculation, current run status)
  - Update each of the three settings with strict validation (all-or-nothing save)
  - Trigger the full recalculation of ALL horoscopes' `CalculatedDetails` and view its progress and result (success/failure counts)
  - View the audit trail of settings changes and recalculation runs

### Student (Settings Context)

- **Description**: An astrology student who studies horoscopes whose calculations are driven by the system-wide settings.
- **Settings-Specific Permissions**:
  - View the shared system astrology settings **read-only** (values, and the informational Chara/Thira/Ubaya logic summary)
  - See aspects on horoscopes computed from the system-wide settings
  - **Cannot** modify, enable/disable, or reset any of the three settings

### System (Calculation Engine + Background Services)

- **Settings-Specific Responsibilities**:
  - Read all three settings from the single system-wide `AstrologySettings` document as the source of truth for every calculation (auto and manual); legacy per-user copies on `User` are ignored
  - Recompute ALL stored `CalculatedDetails` when the system settings change (both `source: "auto"` and `source: "manual"`), via a bulk recalculation job that is **idempotent, batched, and progress-tracked**
  - Never overwrite the manual chart's source of truth (`CalculatedDetails.manualHousePlacements`) during recalculation
  - Report per-run progress and result (total/processed/succeeded/failed) and survive partial failures without corrupting data

---

## Parent Stories

---

### US-SAS-001: Super-admin views the three system settings

- **Title**: Super Admin views the system-wide astrology settings
- **Description**: As a super admin, I want to view the three system-wide astrology settings (Planetary Orbs, Planet Aspects, Rashi Aspects) so that I can review what the whole system currently uses for aspect calculation.
- **Priority**: High
- **Actor**: Super Admin
- **Dependencies**: None (new admin route; settings document seeded per US-SAS-007)

#### Acceptance Criteria

1. **Admin Endpoint**:
    - `GET /api/admin/astrology-settings` returns the system-wide settings document: `planetaryOrbs`, `planetAspects`, `rashiAspects`, plus metadata `updatedBy`, `updatedAt`, `lastRecalculatedAt`, `version`, and `recalcStatus` (when present)
    - Only `role: "super-admin"` may call it — students and non-admin roles get 403, unauthenticated requests get 401

2. **Full Settings Display**:
    - The admin UI shows all three settings:
        - Planetary Orbs — per-planet orb values (0-30) for all 9 planets, bilingual labels
        - Planet Aspects — per-planet aspect houses (1-12) and aspect degrees (multiples of 30 in 30-330), bilingual
        - Rashi Aspects — the enabled/disabled state, any per-sign overrides, and the fixed Chara/Thira/Ubaya rule summary
    - The display is fully populated even when a map entry is absent (the per-planet defaults are shown as the effective values)

3. **Metadata Display**:
    - The admin can see who last updated the settings, when, the current settings `version`, when the last full recalculation completed (`lastRecalculatedAt`), and the status/progress of any in-flight or last run (`recalcStatus`)

#### Edge Cases

- **Fresh system, no settings document yet**: The endpoint (or the seed) creates the document with defaults (US-SAS-007); the admin never sees a 404 for settings that should exist
- **`recalcStatus` absent**: Fields render as "no recalculation run yet" rather than erroring
- **Bilingual**: All labels render in the admin's locale (si/en) via i18n messages

#### Business Rules

- The system-wide `AstrologySettings` document is a single-document collection (`id: "system"`) — see `data-model.md`
- Display values are numeric enums resolved to localized names at render time, never stored as display strings
- Admin routes follow the existing `checkAdmin()` pattern (`role: "super-admin"` else 403)

---

### US-SAS-002: Super-admin updates each setting with strict validation and audit logging

- **Title**: Super Admin updates the system-wide astrology settings (all-or-nothing, audited)
- **Description**: As a super admin, I want to update the three system-wide settings with strict validation so that the system always has a coherent, fully-valid settings snapshot, and every change is recorded for accountability.
- **Priority**: High
- **Actor**: Super Admin
- **Dependencies**: US-SAS-001

#### Acceptance Criteria

1. **Admin Endpoint**:
    - `PUT /api/admin/astrology-settings` accepts any subset of `planetaryOrbs` / `planetAspects` / `rashiAspects`
    - Only `role: "super-admin"` may call it — students/non-admin roles get 403, unauthenticated requests get 401 (see US-SAS-008)

2. **Strict Validation (all-or-nothing)**:
    - `planetaryOrbs` — keys must be Planet enum strings `"1"`…`"9"`; values must be finite numbers 0-30 (same rules as today's `/api/settings`)
    - `planetAspects` — validated with the existing `validatePlanetAspectsPayload`: keys `"1"`…`"9"`; `houses` integers 1-12, non-empty, unique, ascending; `degrees` multiples of 30 in 30-330, non-empty, unique, ascending
    - `rashiAspects` — validated with the existing `validateRashiAspectsPayload`: `enabled` boolean; `overrides` keyed by ZodiacSign enum strings `"1"`…`"12"` with boolean `enabled` (and optional per-target overrides)
    - A single invalid field rejects the **entire** payload with a localized error — nothing is partially saved

3. **Audit Logging**:
    - Every successful update is recorded: who (admin user id), when, the previous `version` → new `version`, and the changed fields/values
    - The audit trail is queryable by the super admin (US-SAS-011)

4. **No-op Update**:
    - Given a PUT whose values are identical to the current document, When submitted, Then either it is rejected as a no-op with a message, or it succeeds without bumping `version`/triggering a recalculation (no spurious recalculation runs)

#### Edge Cases

- **Empty payload**: A PUT with none of the three recognized fields returns 400 ("no valid setting provided")
- **Partial update semantics**: A PUT that changes only `planetaryOrbs` keeps the current `planetAspects`/`rashiAspects` unchanged (document-level replace of the given fields only)
- **Concurrent updates**: Two admins updating simultaneously — the `version`-based optimistic lock means the second writer cannot silently overwrite the first (US-SAS-010)

#### Business Rules

- Updates are all-or-nothing; validation failures never leave a partially-updated document
- Every successful update bumps `version`, sets `updatedBy` (`{ id }` of the admin) and `updatedAt`
- Audit entries are write-only for admins (immutable history) — no in-place editing of past entries
- A successful settings update automatically triggers the full recalculation (US-SAS-003)

---

### US-SAS-003: Updating triggers recalculation of ALL horoscopes (auto + manual)

- **Title**: System recalculates all `CalculatedDetails` snapshots when the system settings change
- **Description**: As a super admin, I want every saved horoscope to reflect the new system settings so that all stored snapshots in the DB are recomputed with the latest values, not just future calculations.
- **Priority**: High
- **Actor**: System
- **Dependencies**: US-SAS-002

#### Acceptance Criteria

1. **Automatic Trigger**:
    - Given a successful `PUT /api/admin/astrology-settings` that actually changed a value, When the settings document is updated, Then the bulk recalculation job is started automatically

2. **All Horoscopes Recomputed**:
    - The job processes EVERY horoscope with a stored `CalculatedDetails`:
        - `source: "auto"` — recomputed via `calculateHoroscope` from the stored birth details (birthDate/birthTime/latitude/longitude/ayanamsha) using the new system-wide `planetaryOrbs` / `planetAspects` / `rashiAspects`
        - `source: "manual"` — recomputed from the stored `manualHousePlacements` (single source of truth) through the manual derivation path (`src/lib/manualChart.ts`) using the new system settings
    - Horoscopes with no `CalculatedDetails` (e.g. create failures) are skipped without error

3. **Snapshots Updated In Place**:
    - After the run, every `CalculatedDetails` snapshot's aspect-derived fields (houses' `aspectingPlanets`, planets' `aspects` with reason lines, etc.) reflect the new system settings
    - The recomputed values are stored (persisted), not just applied at view time — all consumers (owner, public viewers, share-link recipients) see the same snapshot

4. **Completion Marker**:
    - On successful completion, `AstrologySettings.lastRecalculatedAt` is set and `recalcStatus` records the run result

#### Edge Cases

- **Settings changed back to previous values**: The recalc still runs (the trigger is on any value change); the resulting snapshots match the previous ones — harmless and expected
- **Zero horoscopes in the DB**: The job completes immediately with 0/0 counts and sets `lastRecalculatedAt`
- **New horoscope created mid-run**: It is calculated with the new settings from creation; the run's snapshot list is fixed at run start (documented batching behavior)

#### Business Rules

- The recalculation is a **background job**, not done inline in the PUT request handler (see Open Questions for infra decision)
- Auto recalculation is deterministic — same birth details + same system settings ⇒ same snapshot (aspect derivation is pure)
- Manual recalculation is deterministic — same stored placements + same system settings ⇒ same snapshot; `manualHousePlacements` and `derivedRanges` source data are never overwritten (US-SAS-009)

---

### US-SAS-004: Recalculation is idempotent/resumable, reports progress and result, handles partial failure

- **Title**: System runs the bulk recalculation idempotently, resumably, with progress and failure reporting
- **Description**: As a super admin, I want the recalculation to be reliable at scale — idempotent, resumable, and transparent about progress and failures — so that a large DB is recomputed safely without corrupting data.
- **Priority**: High
- **Actor**: System (job) / Super Admin (observation)
- **Dependencies**: US-SAS-003

#### Acceptance Criteria

1. **Batched Processing**:
    - Horoscopes are processed in configurable batches (e.g. N per iteration) rather than all-at-once, so memory/resource usage stays bounded
    - Progress (`processed` / `total`) is persisted in `recalcStatus` after each batch

2. **Idempotency**:
    - Given the recalculation triggered for settings `version` V, When the job is (re)started for the same version V, Then it either does nothing (already completed) or resumes from the last unprocessed horoscope — rerunning never double-processes in a way that corrupts snapshots
    - Rerunning the job with no settings change is a no-op (see US-SAS-002 no-op rule)

3. **Resumability**:
    - If the job is interrupted (process restart, crash), a restart resumes from the last processed horoscope id (persisted in `recalcStatus.lastProcessedHoroscopeId`) instead of starting over

4. **Progress Reporting**:
    - `recalcStatus` exposes `status` (`idle | running | completed | failed`), `settingsVersion`, `startedAt`, `finishedAt`, `total`, `processed`, `succeeded`, `failed`, `lastProcessedHoroscopeId`
    - The admin can view live progress while a run is in flight (polling endpoint; SSE/WebSocket per Open Questions)

5. **Partial Failure Without Corruption**:
    - Given a horoscope whose recalculation throws, When the job continues, Then that horoscope is recorded in the failure count (with its id/error) and the job proceeds to the next one
    - A failed horoscope's existing snapshot is left untouched (never half-written); the run completes and reports `failed > 0` with a retry list
    - Successful horoscopes are persisted independently — a failure never rolls back already-completed snapshots

6. **Result Reporting**:
    - On completion, the admin sees the run result: total, succeeded, failed, and the list of failed horoscope ids (for retry)

#### Edge Cases

- **All horoscopes fail**: The run completes with `failed = total`, `succeeded = 0`; the admin can retry the failed set
- **DB write failure mid-batch**: The batch boundary guarantees at-most-once per horoscope persistence; a crash between batches resumes cleanly
- **Retry of failed subset**: A follow-up run targets only the failed horoscope ids (or re-runs the whole set idempotently)
- **Large DB (10k+ horoscopes)**: The job stays within memory/time constraints via batching and can be split across processes (Open Questions)

#### Business Rules

- The job is idempotent per `version` snapshot and resumable from `lastProcessedHoroscopeId`
- Every horoscope is persisted atomically on its own (document-level write); there is no cross-document transaction requirement for the bulk run
- Failure of one horoscope never corrupts another's snapshot and never aborts the run
- `recalcStatus` is persisted on the `AstrologySettings` document (see `data-model.md`)

---

### US-SAS-005: Students see the shared settings read-only

- **Title**: Student views the system-wide settings read-only
- **Description**: As a student, I want to see the shared system astrology settings and understand that they are system-wide and managed by the admin, so that I know what rules drive my calculations.
- **Priority**: High
- **Actor**: Student
- **Dependencies**: US-SAS-001, US-SAS-002 (values exist)

#### Acceptance Criteria

1. **Read-Only View**:
    - The student settings UI shows the three system-wide settings (Planetary Orbs, Planet Aspects, Rashi Aspects) populated with the shared values
    - All controls are display-only — no edit, toggle, reset, or add/remove actions are available to students

2. **Managed-by-Admin Notice**:
    - The UI clearly communicates (in si and en) that these settings are system-wide and managed by the administrator, so students understand their values are not personal
    - The Rashi Aspects Chara/Thira/Ubaya rule summary remains informational and read-only

3. **Read API**:
    - `GET /api/settings` returns the system-wide values (from `AstrologySettings`), e.g. `{ planetaryOrbs, planetAspects, rashiAspects }` — matching the shape students consume today so the UI change is minimal

4. **Write Rejected**:
    - Any student attempt to write these settings is rejected — via removal of the student-write capability, and/or explicit 403 (see US-SAS-008)

#### Edge Cases

- **Planet with no `planetAspects` entry**: The UI shows the effective defaults (per-planet default aspect houses/degrees) as informational text
- **Student UI previously had per-user controls**: The controls are replaced by the read-only shared display; no stale per-user values leak from the legacy `User` fields

#### Business Rules

- Students always read from the system-wide document — the legacy per-user fields are never surfaced
- The read API never exposes `updatedBy`/`version`/`recalcStatus` admin metadata to students unless explicitly decided (Open Questions)

---

### US-SAS-006: Legacy per-user fields deprecated/ignored; fresh calculations use system settings

- **Title**: System ignores the legacy per-user settings and always calculates with system settings
- **Description**: As a developer-facing/system behavior, I want fresh calculations to use the system-wide settings as the single source of truth so that per-user divergence is impossible.
- **Priority**: High
- **Actor**: System
- **Dependencies**: US-SAS-001, US-SAS-002, US-SAS-003

#### Acceptance Criteria

1. **Calculation Input**:
    - Every calculation entry point (auto create `src/app/api/horoscope/route.ts`, manual create `src/app/api/horoscope/manual/route.ts`, recalc `src/app/api/horoscope/[id]/route.ts`, and the bulk recalc job) passes the **system-wide** `planetaryOrbs` / `planetAspects` / `rashiAspects` into the calculation functions
    - `User.planetaryOrbs` / `User.planetAspects` / `User.rashiAspects` are no longer read by any calculation path

2. **Legacy Data Untouched**:
    - Existing `User` documents keep their stale per-user fields (no destructive migration required); they are simply ignored
    - A cleanup migration that removes the fields is optional and non-blocking (data-model.md notes this)

3. **No Fallback to Per-User Values**:
    - Given a user whose legacy fields hold custom values, When a horoscope is calculated, Then the calculation uses the system-wide values, not the legacy per-user values

4. **Convergence**:
    - After the change, every horoscope snapshot is produced from the identical settings document — the same horoscope yields the same aspects for every viewer/owner

#### Edge Cases

- **User with no legacy fields at all**: Behavior identical to a user with legacy fields — system settings always apply
- **Settings document missing (shouldn't happen after US-SAS-007)**: The seed defaults are used (defensive fallback identical to US-SAS-007 defaults)

#### Business Rules

- `AstrologySettings` is the single source of truth for calculation settings
- Calculation behavior must be identical regardless of which student owns/views the horoscope

---

### US-SAS-007: Defaults seeded on a fresh system

- **Title**: System seeds the AstrologySettings document with defaults on first boot
- **Description**: As the system, I want a fresh install to automatically have a valid system-wide settings document so that no calculation path ever runs without settings.
- **Priority**: High
- **Actor**: System
- **Dependencies**: None

#### Acceptance Criteria

1. **Seeding on First Boot**:
    - Given an empty DB (no `AstrologySettings` document), When the application boots (or the admin endpoint is first hit), Then the document is created with the default values

2. **Default Values**:
    - `planetaryOrbs` = `{"1":15,"2":12,"3":8,"4":7,"5":9,"6":7,"7":9,"8":0,"9":0}` (unchanged defaults)
    - `planetAspects` = `{}` (every planet uses its per-planet default aspect houses/degrees)
    - `rashiAspects` = `{ "enabled": false, "overrides": {} }` (aspect calculation unchanged until an admin enables it — backward compatible with existing snapshots)

3. **Idempotent Seeding**:
    - The seed never overwrites an existing document; if a document is present, seeding is a no-op
    - Concurrent boot/seed attempts produce exactly one document (upsert guarded by the fixed singleton key)

4. **Defaults Immediately Effective**:
    - A fresh system's first horoscope calculations use the seeded defaults; the read APIs (admin + student) return the seeded values

#### Edge Cases

- **Seed fails transiently (DB down)**: The system retries on next boot/request rather than leaving calculations broken
- **Settings document accidentally deleted in production**: The next boot re-seeds with defaults (documented behavior; admin may then restore desired values)

#### Business Rules

- Exactly one `AstrologySettings` document exists (fixed singleton `id: "system"`)
- Seed defaults match the current code defaults exactly
- Seeding is idempotent and concurrency-safe

---

### US-SAS-008: AuthZ — non-admin writes rejected 403; admin-only route under `/api/admin`

- **Title**: System enforces super-admin-only write access to the system settings
- **Description**: As the system, I want only super admins to be able to change the system-wide settings so that students and other roles cannot alter global calculation behavior.
- **Priority**: High
- **Actor**: System
- **Dependencies**: US-SAS-001, US-SAS-002, US-SAS-005

#### Acceptance Criteria

1. **Admin Route Placement**:
    - The settings view/update live under `/api/admin/**` (e.g. `GET/PUT /api/admin/astrology-settings`), following the existing admin pattern (`checkAdmin()` — `role: "super-admin"` else 403)

2. **Non-Admin Write Rejected**:
    - Given a student (or any non-`super-admin` role) PUT to the admin settings route, When attempted, Then a 403 is returned and nothing is persisted
    - Given an unauthenticated request, When attempted, Then a 401 is returned

3. **Student Write Path Removed**:
    - Students can no longer write these three settings via `PUT /api/settings` — the endpoint either stops accepting the three fields (removed) or returns 403/400 for them
    - Students can still read the shared values (US-SAS-005)

4. **Admin GET Guarded**:
    - `GET /api/admin/astrology-settings` returns 403 for non-admin roles and 401 unauthenticated (the read for admins is distinct from the read-only student view)

#### Edge Cases

- **Role changed mid-session**: A user whose role was demoted from super-admin loses write access on the next request (role is checked per-request from the session)
- **Manually crafted requests**: AuthZ is enforced server-side on every request; it is never client-side-only

#### Business Rules

- Role check happens on the server for every settings request (`getServerSession(authOptions)` + role check, mirroring `src/app/api/admin/route.ts`)
- Non-admin write attempts are rejected with 403 (401 when unauthenticated), and are logged at warn level via the existing `logger`

---

### US-SAS-009: Manual horoscopes recomputed from stored manualHousePlacements

- **Title**: System recomputes manual horoscopes from their stored placements without overwriting them
- **Description**: As a super admin, I want manual horoscopes to be recalculated from their source-of-truth `manualHousePlacements` so that their aspects/planets table update to the new system settings while the entered chart data is never lost.
- **Priority**: High
- **Actor**: System
- **Dependencies**: US-SAS-003

#### Acceptance Criteria

1. **Source of Truth Preserved**:
    - During recalculation, `CalculatedDetails.manualHousePlacements` (lagna, house placements, navamsa placements, validation, `planetDegrees`) is read for the recompute and is **never overwritten** by the job
    - The recompute feeds the stored placements through the manual derivation path (`src/lib/manualChart.ts` `compute()`) with the new system-wide settings, exactly as the manual create route does today

2. **Manual Snapshot Updated**:
    - The manual horoscope's derived fields update with the new settings: house aspects, planet-to-planet aspects, rashi-drishti aspects, planets table (via `derivePlanetsTable`), and the planets/houses stored in `CalculatedDetails`

3. **Same Behavior as Create**:
    - Recalculation of a manual horoscope produces the same derived result as re-entering the identical placements with the new system settings on the manual create flow

4. **Missing Placements Guard**:
    - Given a manual horoscope whose stored `manualHousePlacements` is missing/corrupt, When the job reaches it, Then it is recorded as failed (or skipped with a warning) rather than writing a partial/empty snapshot

#### Edge Cases

- **Manual horoscope with `derivedRanges.ageRanges` dependent on current Shani transit**: The recalc recomputes age ranges with the current transit at run time (values are time-dependent by design — see Open Questions on whether this is desired for a settings-driven recalc)
- **Manual horoscope with no `birthDate`**: Recalculated identically; dasha dates remain empty as in the create flow (duration-only dashas)

#### Business Rules

- `manualHousePlacements` is the single source of truth for manual charts and is never overwritten by any recalculation
- Manual recalculation is deterministic for the aspect-derived fields (pure functions); only current-transit-dependent fields (age ranges) vary with time
- Manual horoscopes without birth details never trigger ephemeris calculation (existing rule preserved)

---

### US-SAS-010: Concurrency-safe updates and recalculation

- **Title**: System prevents stale/racing settings updates from corrupting recalculations
- **Description**: As a super admin, I want concurrent settings updates and recalculation runs handled safely so that a stale snapshot never overwrites a newer one.
- **Priority**: Medium
- **Actor**: System
- **Dependencies**: US-SAS-002, US-SAS-003, US-SAS-004

#### Acceptance Criteria

1. **Optimistic Locking**:
    - `PUT /api/admin/astrology-settings` uses the `version` field: an update that targets an older `version` than the current document is rejected (409) with a message asking the admin to refresh
    - Two near-simultaneous updates cannot silently clobber each other — the last write wins only via a fresh `version`

2. **Single In-Flight Recalculation**:
    - Given a recalculation already running, When a new settings update arrives, Then either (a) the update is rejected with "recalculation in progress, retry later", or (b) it is queued and applied after the current run completes, followed by a new run
    - The `recalcStatus.status === "running"` guard prevents two jobs from writing snapshots concurrently

3. **Stale-Job Guard**:
    - A job resumed from an old `settingsVersion` cannot overwrite snapshots produced by a newer version's run; the job checks the current document `version` before writing each batch

#### Edge Cases

- **Admin retries after 409**: A refresh returns the current values; the retry bumps to the latest version
- **Process restart mid-run with a newer settings change**: The resumed job validates its `settingsVersion` against the current document and stops if superseded

#### Business Rules

- `version` is the optimistic-lock token; every settings write bumps it
- Only one recalculation job runs at a time per system settings snapshot; concurrent triggers are serialized (reject or queue — decision in Open Questions)
- A running job only writes snapshots while its `settingsVersion` equals the current document's `version`

---

### US-SAS-011: Super-admin views the audit trail and recalculation history

- **Title**: Super Admin views the audit trail of settings changes and recalculation runs
- **Description**: As a super admin, I want to review who changed the system settings, when, and how each recalculation run fared, so that I can audit and troubleshoot the platform-wide configuration.
- **Priority**: Medium
- **Actor**: Super Admin
- **Dependencies**: US-SAS-002, US-SAS-003

#### Acceptance Criteria

1. **Change History**:
    - The admin can view a chronological list of settings updates: admin id/name, timestamp, `version` before → after, and the fields that changed (e.g. `rashiAspects.enabled: false → true`)

2. **Recalculation History**:
    - The admin can view past recalculation runs: triggered-by update, settings `version`, started/finished timestamps, total/succeeded/failed counts

3. **Failure Drill-Down**:
    - Failed runs expose the failed horoscope ids (and errors) so the admin can retry or inspect

#### Edge Cases

- **Very long history**: History is paginated (or pruned — retention policy is an Open Question)
- **No history yet**: The view shows an empty state

#### Business Rules

- Audit entries are append-only and never editable
- History is admin-only (never exposed to students)

---

## Validation Rules Summary

| Rule | Requirement |
| ------ | ------------- |
| Admin view | `GET /api/admin/astrology-settings` — super-admin only (403 otherwise, 401 unauthenticated) |
| Admin update | `PUT /api/admin/astrology-settings` — super-admin only; accepts any subset of the three settings |
| planetaryOrbs values | Keys Planet enum `"1"`…`"9"`; values finite numbers 0-30 |
| planetAspects values | Keys `"1"`…`"9"`; `houses` integers 1-12 (non-empty, unique, ascending); `degrees` multiples of 30 in 30-330 (non-empty, unique, ascending) |
| rashiAspects values | `enabled` boolean; `overrides` keys ZodiacSign `"1"`…`"12"` with boolean `enabled` (+ optional per-target overrides) |
| All-or-nothing | One invalid field rejects the entire payload; no partial save |
| No-op update | Identical values ⇒ no `version` bump, no recalculation |
| Trigger | Any real value change ⇒ `version++`, `updatedBy`, `updatedAt`, audit entry, full recalculation started |
| Recalculation scope | ALL horoscopes with `CalculatedDetails` — `source: "auto"` (from birth details) and `source: "manual"` (from stored `manualHousePlacements`) |
| Idempotency | Rerun for the same `version` = no-op; resumable from `lastProcessedHoroscopeId` |
| Partial failure | Failing horoscope leaves its snapshot untouched, is counted, and does not abort the run |
| Manual integrity | `manualHousePlacements` is never overwritten by recalculation |
| Student view | Read-only via `GET /api/settings`; student writes of the three settings are removed/rejected |
| Legacy fields | `User.planetaryOrbs`/`planetAspects`/`rashiAspects` deprecated, ignored by all calculations |
| Seeding | Fresh system seeds defaults idempotently (single-document, fixed `id: "system"`) |
| Concurrency | `version` optimistic lock; one in-flight recalculation run at a time; stale runs stop before writing |

---

## Clarifying Assumptions

1. **Single shared source of truth**: The three settings move to a single system-wide `AstrologySettings` document (single-document collection). All calculations — auto, manual, view-time derivations — read from it exclusively.
2. **Defaults unchanged**: The seeded defaults match the current code defaults exactly (`planetaryOrbs` `{"1":15,"2":12,"3":8,"4":7,"5":9,"6":7,"7":9,"8":0,"9":0}`; `planetAspects` `{}` → per-planet defaults; `rashiAspects` `{ enabled: false }`). This keeps the first-boot behavior identical to today.
3. **Legacy fields ignored, not deleted**: The per-user fields remain on existing `User` documents as inert data; a cleanup migration is optional. No destructive migration runs on deploy.
4. **Recalculation is a background job**: The bulk recalculation does not run inline in the PUT handler. Batching, resumability, and progress reporting are part of the job contract (US-SAS-004); the exact job-runner infrastructure is an Architect/Developer decision (Open Questions).
5. **Deterministic snapshots**: Recalculation is deterministic for aspect-derived fields; only manual-chart `ageRanges` depend on the current Shani transit at run time (Open Question whether those should be recomputed or left).
6. **Recalculation scope = CalculatedDetails**: The requirement and this spec scope the bulk recompute to the `CalculatedDetails` collection. Whether the `Chart` collection (SVG data) and search embeddings must also be regenerated is an Open Question.
7. **All-or-nothing update semantics**: An admin PUT is validated as a whole before persist — mirroring the current `/api/settings` behavior. A partial subset of the three settings may be sent; unspecified fields keep their current values.
8. **AuthZ mirrors the existing admin pattern**: `getServerSession(authOptions)` + `role === "super-admin"` (403) per request, as in `src/app/api/admin/route.ts`.

## Open Questions

1. **Job-runner infrastructure (Architect/Developer)**: The repo currently has no background job framework — the only background-work references are the (unimplemented) RAG embedding queue. Should the bulk recalculation run on an in-process scheduler, a Next.js route-triggered worker, a DB-backed job queue (Redis/BullMQ-style — see the `infra-setup` skill), or a periodic sweep that picks up `recalcStatus.status === "pending"`? Confirm whether new infra (Redis) is acceptable for this feature or whether a dependency-free in-process job is preferred for v1.
2. **Synchronous vs async semantics (Architect/Developer/UX)**: When the admin PUTs settings, does the API return immediately (202 Accepted, recalc runs in background) or block until completion? Given a large DB, blocking is impractical; recommend 202 + progress polling. Confirm the contract.
3. **Progress transport (Architect/UX)**: Polling a status endpoint vs SSE/WebSocket push for live progress in the admin UI. Recommend polling for v1 (simplest); confirm.
4. **Chart regeneration (Architect/Developer/QA)**: The `Chart` collection stores per-type `data`/`svgData`. Aspects appear in chart rendering — must the bulk recalculation also regenerate the `Chart` docs, or is refreshing `CalculatedDetails` sufficient (charts derive from snapshots at view time)? If charts are derived at view time, no regeneration is needed; if cached, it must be included. Confirm.
5. **Search index refresh (Architect/Developer)**: Aspect values are embedded in horoscope searchable text/embeddings. Does a settings-triggered recalculation need to re-index (regenerate `SearchEmbedding`s) for all affected horoscopes, or is a later re-index acceptable? Note the RAG pipeline is not yet implemented — this question is about keeping future-proof consistency.
6. **Manual-chart `ageRanges` (Domain/PM)**: For manual horoscopes, `derivedRanges.ageRanges` uses the *current* Shani transit at computation time. Should the settings-triggered recalculation recompute age ranges (making them time-of-run dependent) or preserve the stored ranges and only recompute aspect-derived fields?
7. **Version/optimistic-lock semantics (Architect/Developer)**: Confirm `version` semantics: bumped on every real change only; used as the optimistic-lock token and as the recalculation idempotency key. Should a PUT that changes settings mid-run be rejected (409) or queued (auto-apply after current run)? Recommend reject-with-retry for v1 simplicity.
8. **Student read endpoint (Developer/UX)**: Keep the values flowing through `GET /api/settings` (same shape as today, so the student UI change is minimal) or introduce a separate read-only endpoint? Recommend reusing `GET /api/settings`.
9. **Admin metadata exposure (UX/Developer)**: Should the student-facing read view include admin metadata (`updatedBy`, `updatedAt`, `version`, `lastRecalculatedAt`)? Recommend hiding it (only values + a "managed by administrator" notice).
10. **Audit/history retention (PM/Developer)**: How long is the settings-change/recalculation audit trail retained, and is pagination required? Recommend keeping the last N runs + full append-only change log for v1.
11. **Failure retry UX (UX/QA)**: How should the admin retry failed horoscopes — a "retry failed" button on the run result, or a full re-run? Recommend a targeted retry of the failed subset.
12. **QA golden data (QA)**: Provide golden fixtures for at least one auto and one manual horoscope across a settings change (e.g. flip `rashiAspects.enabled`, change an orb, change a planet's aspect houses/degrees) so the recalc output can be verified deterministically.
13. **No-CalculatedDetails horoscopes (Developer/QA)**: Confirm the job skips horoscopes without a `CalculatedDetails` snapshot (counted separately or silently skipped) rather than failing.
14. **Batching parameters (Architect/Developer)**: What is the default batch size and are batch size / concurrency configurable? Confirm that per-horoscope writes are atomic document updates (no multi-doc transactions).
15. **UI placement (UX)**: Where does the admin settings screen live in the admin navigation, and how is the read-only student view presented in the existing student settings UI (e.g. "System settings — managed by admin" panel)?
16. **rashiAspects default state (PM/Domain)**: Confirm the seeded default stays `enabled: false` (opt-in, backward compatible) rather than `enabled: true` (opt-out) — this spec assumes `false` per the current code default.

## Feature-to-Story Traceability

| Requirement | User Story |
| ------------- | ------------ |
| Settings become system-wide (single shared source of truth) | US-SAS-001, US-SAS-006 |
| Only super-admin can update them; all other users (students) can view them read-only | US-SAS-001, US-SAS-002, US-SAS-005, US-SAS-008 |
| Update triggers recalculation of ALL CalculatedDetails (auto + manual) | US-SAS-003 |
| Idempotent/resumable recalculation with progress + result reporting and partial-failure safety | US-SAS-004 |
| Students see shared settings read-only | US-SAS-005 |
| Legacy per-user fields deprecated/ignored; fresh calculations use system settings | US-SAS-006 |
| Defaults/seed on fresh boot | US-SAS-007 |
| AuthZ — non-admin PUT rejected 403; admin-only route under /api/admin | US-SAS-008 |
| Manual horoscopes recomputed from stored manualHousePlacements (never overwritten) | US-SAS-009 |
| Idempotency/partial-failure/progress + concurrency safety (version lock, single in-flight run) | US-SAS-004, US-SAS-010 |
| Audit logging of updates and recalculation runs | US-SAS-002, US-SAS-011 |
