# System-Wide Astrology Settings (Shared Source of Truth) — Architecture Specification

**Date:** 2026-08-12 22:00
**Author:** Architect
**Based on:** `specs/business-analysis/20260812-2111-system-astrology-settings.md` (US-SAS-001..011), `specs/business-analysis/data-model.md` (`### AstrologySettings`, `### PlanetAspects (System Setting)`, `### RashiAspects (System Setting)`), `specs/architecture/overview.md`, `specs/architecture/20260809-2145-planet-aspects.md` (**superseded** for the three settings), `src/app/api/settings/route.ts`, `src/app/api/admin/route.ts`, `src/models/User.ts`, `src/models/CalculatedDetails.ts`, `src/lib/planetAspects.ts`, `src/lib/rashiAspects.ts`, `src/lib/calculation.ts`, `src/lib/manualChart.ts`, `src/lib/manualChartDetails.ts`, `src/lib/logger.ts`, `scripts/recalculate-horoscopes.ts`, `scripts/recalculate-calculated-horoscopes.ts`

---

## 1. Overview

The three astrological calculation settings are currently **per-user** values stored on each `User` document (`planetaryOrbs`, `planetAspects`, `rashiAspects`) and writable by any student via `GET`/`PUT /api/settings`. Because they are per-user, the same horoscope can produce different house/planet aspects for the owner, public viewers, and share-link recipients. This feature moves the three settings to a **single system-wide `AstrologySettings` document** — the shared source of truth:

- **Only super-admin** can view/update them (admin-only routes under `/api/admin/**`; 401 unauthenticated, 403 non-admin).
- **Students** view the shared values read-only via the existing `GET /api/settings`; student writes are removed.
- Any real settings update **bumps `version`, records an audit entry, and triggers a background bulk recalculation** of ALL stored `CalculatedDetails` snapshots — both `source: "auto"` (recomputed from stored birth details) and `source: "manual"` (recomputed from stored `manualHousePlacements`, which is never overwritten).
- The bulk job is **batched, idempotent (per `version`), resumable (from `lastProcessedHoroscopeId`), progress-tracked, and partial-failure-safe**; per-horoscope writes are atomic document updates.
- The legacy per-user fields on `User` remain as **inert data** — no calculation path reads them (US-SAS-006).

The recalculation job runs as a **dependency-free in-process background task** (D4) — the repo has no Redis/BullMQ and the RAG pipeline is unimplemented — and the admin PUT returns immediately while the run progresses asynchronously, monitored via a polling endpoint. This supersedes the per-user settings model of `20260809-2145-planet-aspects.md` for the three settings; the aspect **algorithms** (union of explicit `houses` ∪ degree arm, orb tolerance, Rashi Aspects rules) are unchanged — only their **source** changes from `User` to `AstrologySettings`.

## 2. Non-Goals / Explicitly Out of Scope

- **No destructive migration** of legacy `User.planetaryOrbs` / `User.planetAspects` / `User.rashiAspects`. The fields remain inert; removal is a separate optional cleanup (data-model note, US-SAS-006 AC2).
- **No student edit capability.** Students never write any of the three settings; `PUT /api/settings` stops accepting them (403).
- **No change to the aspect algorithms.** The union semantics (explicit `houses` ∪ degree arm), orb tolerance, and Rashi Aspects rules from `20260809-2145-planet-aspects.md` are preserved verbatim — only the settings source changes.
- **No `Chart` (SVG) regeneration in the bulk job.** Verified: `src/lib/chartRenderer.ts` and `src/lib/chartDataTransform.ts` contain no aspect references — rendered charts are positional only (houses + planets at degrees). A settings change alters aspect **data** (`planets[].aspects`, `houses[].aspectingPlanets`, manual per-house `aspects`), never chart art. `CalculatedDetails`-only refresh is sufficient (BA Open Question 4 → D8).
- **No search re-indexing.** The RAG pipeline (`SearchEmbedding`, Qdrant, Transformers.js) is not implemented — `src/app/api/search/route.ts` is in-memory keyword scoring. Re-indexing after a settings change is deferred until the RAG pipeline lands (D9).
- **No new infrastructure.** No Redis, BullMQ, cron, or worker processes for v1 (D4).
- **No multi-document transactions.** Every horoscope is persisted with its own atomic document write (US-SAS-004 business rules).
- **No queueing of concurrent settings updates.** While a recalculation is running, a new PUT is rejected with 409 ("recalculation in progress") rather than queued (Open Question 7 → D7).
- **No admin metadata in student responses.** `GET /api/settings` exposes only the three value maps (Open Question 9 → D12).
- **No edit/delete of audit entries.** The change log and recalculation history are append-only (US-SAS-002/011).

## 3. Design Decisions

### D1. Single-document `AstrologySettings` collection, fixed `_id: "system"`

**Decision:** one Mongoose collection (`astrologysettings`) holding exactly one document whose `_id` is the fixed string `"system"` — satisfying the data-model's `id: "system"` singleton convention. All reads/writes use `findById("system")`-style operations. The `User` model's three fields are left in place but never read.

Rationale:
- The data-model already specifies this shape; the singleton key makes seeding idempotent by construction (upsert on the same `_id` can only ever produce one document).
- Using `_id` (rather than a second `id`/`key` field) avoids a secondary unique index and reuses Mongoose's `id` virtual getter.

### D2. Shared `getAstrologySettings()` loader with lazy idempotent seeding

**Decision (US-SAS-007):** all readers — admin routes, student read, every calculation entry point, and the recalculation job — obtain settings through a single helper `src/lib/astrologySettings.ts` that seeds on miss:

```
getAstrologySettings(forceFresh = false):
    doc = AstrologySettings.findById("system")
    if !doc:
        doc = AstrologySettings.findByIdAndUpdate(
            "system",
            { $setOnInsert: SEED_DOC },        // real values only — no nulls/empty placeholders (D2)
            { upsert: true, new: true },
        )
    return doc
```

- Seeding is lazy (first read triggers it), covering both "first boot" and "first admin hit" without build-time side effects or a boot hook.
- `$setOnInsert` makes concurrent seed attempts safe: the fixed `_id` + upsert guarantee exactly one document (US-SAS-007 AC3).
- No in-memory cache in v1 — every call is one `findById` on a one-document collection (negligible cost) and guarantees reads always see the latest settings, which is the point of the feature (a cached copy would defeat US-SAS-006 convergence). A short-TTL cache is noted as a future optimization only.
- **Storage policy — no `null`s, no empty placeholders (refinement 2026-08-12):** the persisted `AstrologySettings` document never stores `null` values or empty-object/empty-array placeholder fields. Fields that are not (yet) set are **omitted** from the document — never written as `null`, `{}`, or `[]` — and readers normalize absent fields to code-level defaults. Concretely:
  - `updatedBy`, `lastRecalculatedAt`, `recalcStatus`, `auditLog`, `recalcHistory` are **absent** until an update/run actually sets them. No `updatedBy: null`, no `recalcStatus: { status: "idle" }`, no `auditLog: []` / `recalcHistory: []` at seed.
  - `planetAspects` is **absent while empty** (no per-planet overrides ⇒ every planet uses its per-planet default houses/degrees); the `{}` form exists only as the read-time fallback, never in the DB.
  - `rashiAspects` is stored as `{ enabled: false }` — the empty `overrides` map is omitted (the `RashiAspectsSetting.overrides?` field is already optional in `src/lib/rashiAspects.ts`). `overrides` is written only when a real per-sign override exists.
  - Code-level defaults `DEFAULT_PLANET_ASPECTS = {}` and `DEFAULT_RASHI_ASPECTS = { enabled: false, overrides: {} }` remain **read-time fallbacks only** — `getCalculationSettings()`/`getAstrologySettings()` synthesize the full consumer shapes; they are never persisted.
  - Seed document (real values only, must match current code defaults exactly):
    ```
    { _id: "system",
      planetaryOrbs: { "1": 15, "2": 12, "3": 8, "4": 7, "5": 9, "6": 7, "7": 9, "8": 0, "9": 0 },
      rashiAspects: { enabled: false },
      version: 1,
      createdAt / updatedAt }
    ```

Alternatives considered:
| Alternative | Rejected because |
|---|---|
| Seed on `connectDB()` | Touches every DB connection path and runs during `next build` imports; lazy-on-read is equivalent and simpler |
| Module-level singleton with TTL cache | Settings changes must be instantly visible to the recalc job and student reads; cache adds invalidation complexity with no win for a one-doc collection |

### D3. All calculation paths switch from `User` to `AstrologySettings`

**Decision (US-SAS-006):** the four calculation entry points — auto create (`src/app/api/horoscope/route.ts`), manual create (`src/app/api/horoscope/manual/route.ts`), single recalc (`src/app/api/horoscope/[id]/route.ts`), and the bulk job — each replace their `User.findOne(...)` settings read with:

```
{ planetaryOrbs, planetAspects, rashiAspects } = await getCalculationSettings()
```

(`getCalculationSettings()` = `getAstrologySettings()` destructured to the three maps; defensive defaults identical to D2 when a field is somehow absent.) `User.planetaryOrbs` / `User.planetAspects` / `User.rashiAspects` are no longer read by any calculation path. The manual route builds `parsed.value.aspectOptions` from the system settings exactly as it does from the user's today.

Convergence: after this change every snapshot is produced from the identical settings document, so the same horoscope yields the same aspects for every owner/viewer (US-SAS-006 AC4).

### D4. Bulk recalculation runs as a dependency-free in-process background job

**Decision (Open Question 1):** the bulk recalculation is a module-level in-process runner (`src/lib/recalculationJob.ts`) started from the admin PUT handler with `void startRecalculation(newVersion)` (not awaited). No Redis/BullMQ/cron for v1.

Rationale:
- The repo has **no background-job infrastructure**; the only background-work reference is the unimplemented RAG embedding queue. Adding Redis for one job is disproportionate.
- The deployment is a self-hosted Node server (`pnpm dev` / `pnpm start` — long-lived process), so an un-awaited async task keeps running after the HTTP response returns. `jyotish-calculations`/`swisseph-v2` are CJS/native and pinned in `next.config.ts` `serverExternalPackages`; route handlers default to the Node runtime — so `calculateHoroscope` (ephemeris) can run in-process.
- The job is **resumable and re-triggerable** (D5): if the process is killed mid-run (deploy, crash, serverless freeze), the persisted `recalcStatus.status === "running"` + `lastProcessedHoroscopeId` let the admin resume via `POST /api/admin/astrology-settings/recalc` — no data loss and at-most-once per horoscope across resume boundaries.
- A killed process simply leaves `recalcStatus` `"running"`; the next trigger verifies `settingsVersion` against the current document and resumes (or supersedes when the version moved on).

Rejected alternatives:
| Alternative | Rejected because |
|---|---|
| Redis/BullMQ job queue | New infra + deployment burden for one job; nothing in the repo consumes Redis today; revisit when a second background workload appears |
| Route-triggered worker + periodic sweep | Needs a cron/keep-alive self-hosted Next.js does not provide out of the box; the in-process runner plus an explicit resume endpoint covers restarts without a scheduler |
| Synchronous inline recalc in the PUT handler | Blocks the admin request for minutes/hours at 10k+ horoscopes — untenable (Open Question 2) |
| Separate Node worker process | Adds process management/IPC/deploy complexity; the long-lived server makes it unnecessary for v1 |

### D5. Job contract: batched, idempotent, resumable, progress-tracked, partial-failure-safe

**Decision (US-SAS-004 / US-SAS-009 / US-SAS-010):** the runner's contract, specified precisely:

- **Run snapshot fixed at start:** the id set is `CalculatedDetails.find({}, { "horoscope.id": 1, _id: 0 }).lean()` → unique id strings, captured once at run start (`total = ids.length`). Horoscopes with no `CalculatedDetails` are never visited (US-SAS-003 AC2 / Open Question 13 → skipped by construction, not counted as failures). A horoscope created mid-run is calculated with the new settings at creation and is simply outside the fixed snapshot (documented behavior, US-SAS-003 edge case).
- **Batching:** process `RECALC_BATCH_SIZE` ids per iteration (default 100, configurable via `process.env.RECALC_BATCH_SIZE`). After each batch persist `recalcStatus` progress (`processed`, `succeeded`, `failed`, `lastProcessedHoroscopeId`) to the settings document.
- **Idempotency key:** `settingsVersion` (the doc `version` when the run started). A `startRecalculation` for a version already `completed` does nothing; a persisted `running` state for the **same** version resumes from `lastProcessedHoroscopeId`; a `running` state for a **different** version is superseded (the newer update owns the recalc now) and replaced by the fresh run's state.
- **Single-flight guard:** a module-level `activeRun` flag prevents two in-process runs executing concurrently; the persisted `recalcStatus.status === "running"` guard prevents two jobs writing snapshots concurrently across process restarts (US-SAS-010 AC2).
- **Stale-run guard:** before each batch the runner reads the current document fresh (`getAstrologySettings(true)`); if `current.version !== runVersion` the run stops immediately and writes nothing further — a superseded run must never overwrite snapshots produced by a newer version's run (US-SAS-010 AC3). It leaves `recalcStatus` alone (the superseding update already set its own `running` state).
- **Per-horoscope processing:** for each id:
  - Load the `Horoscope`. If `source === "auto"`: `calculateHoroscope(horoscope, systemOrbs, systemAspects, systemRashiAspects)` then `CalculatedDetails.findOneAndUpdate({ "horoscope.id": id }, { ...calculated }, { upsert: true })`.
  - If `source === "manual"`: replay the manual pipeline like `scripts/recalculate-calculated-horoscopes.ts` (`recalculateCalculatedHoroscope`), **but** thread the system settings into `compute`: `compute(manualPlacementsToInput(stored.manualHousePlacements), getCurrentShani(...), { planetaryOrbs: systemOrbs, planetAspects: systemAspects, rashiAspects: systemRashiAspects })`, then `synthesizeCalculation` / `synthesizeNavamsaCalculation`, persisting `manualHousePlacements: sanitizeManualHousePlacements(...)` and `derivedRanges: result.derivedRanges`. The entered placements (source of truth) survive the sanitize round-trip unchanged (US-SAS-009 AC1).
  - If a manual horoscope has missing/corrupt stored `manualHousePlacements`: record it as **failed** (cannot be recomputed deterministically) — never write a partial/empty snapshot (US-SAS-009 AC4).
  - A thrown error per horoscope: increment `failed`, record `{ id, error }` in a run-local failures map, and **continue** — the existing snapshot is left untouched (never half-written); already-succeeded snapshots are not rolled back (US-SAS-004 AC5).
- **Completion:** on success set `recalcStatus = { status: "completed", settingsVersion, startedAt, finishedAt, total, processed, succeeded, failed, lastProcessedHoroscopeId }` (plus `failedHoroscopeIds` only when `failed > 0`, and `error` only on a run-level failure — omitted, never `[]`/`null`, otherwise), set `lastRecalculatedAt = finishedAt`, and push a `recalcHistory` entry (D6). An unexpected run-level error sets `recalcStatus.status = "failed"` with `error` recorded. Zero horoscopes ⇒ immediate completion with 0/0 counts and `lastRecalculatedAt` set (US-SAS-003 edge case).
- **Retry of failed subset (Open Question 11):** `POST /api/admin/astrology-settings/recalc` accepts an optional `{ horoscopeIds: string[] }` body — a targeted run over exactly those ids (`total` = id count) sharing the same progress/reporting/guard machinery. A body-less POST performs a full (resumable) run.

### D6. Audit trail and recalculation history embedded on the settings document

**Decision (US-SAS-002/011):** embed two capped arrays on `AstrologySettings`:

- `auditLog: AuditEntry[]` — append-only change log, capped at the last 100 (`$push` + `$slice: -100`). The array is **created by the first push** (never seeded as `[]`); a fresh document has no `auditLog` field. Entry: `{ id, version (new), changedBy: { id, name? }, changedAt, changes: { planetaryOrbs?: { from, to }, planetAspects?: { from, to }, rashiAspects?: { from, to } } }` — only the actually-changed fields; `name` omitted when the admin's display name is unknown.
- `recalcHistory: RecalcRunEntry[]` — capped at the last 20, **created on first completed run**. Entry: `{ id, settingsVersion, triggeredBy: { id, name? }, startedAt, finishedAt?, total, succeeded, failed, failedHoroscopeIds }` — `failedHoroscopeIds` present only when `failed > 0`, capped at the first 100 per run; `finishedAt` present only on completion.

Embedding co-locates the trail with the settings it describes and makes appends atomic with the settings write (single document). A separate collection is not needed until history volume demands pagination/retention beyond the caps (Open Question 10 → resolved: caps above are the v1 retention policy).

### D7. Update semantics: no-op detection, optimistic lock, single-flight guard

**Decision (US-SAS-002/010):**

- **Subset PUT:** a PUT may carry any subset of `planetaryOrbs` / `planetAspects` / `rashiAspects`; unspecified fields keep their current values (document-level `$set` of only the provided fields). An empty subset → 400 ("no valid setting provided").
- **All-or-nothing validation:** each provided field is validated with the existing validators (`validatePlanetAspectsPayload` / `validateRashiAspectsPayload`; orbs validated with the same 0–30 finite-number rule as today's settings route). Any invalid field → 400 with a localized message; nothing is persisted (US-SAS-002 AC2).
- **No-op detection:** after validation, deep-compare each provided field against the current document (`JSON.stringify` equality per field). If every provided field is unchanged → 200 `{ noChange: true, ...current }`; no `version` bump, no audit entry, no recalculation (US-SAS-002 AC4 — no spurious runs).
- **Optimistic lock (US-SAS-010 AC1):** the PUT body MUST include `version` — the admin's known current version. If `body.version !== current.version` → 409 with "settings have changed — refresh and retry". This makes last-write-wins impossible without a fresh version.
- **Single in-flight run (US-SAS-010 AC2, option (a)):** if `current.recalcStatus.status === "running"` → 409 with "a recalculation is in progress — retry after it completes". Reject-with-retry (not queueing) is the v1 choice (Open Question 7).
- **On a real, locked, validated change:** `$set` the provided fields, `$inc: { version: 1 }`, `updatedBy = { id: session.user.id }`, `updatedAt = now`, `recalcStatus = { status: "running", settingsVersion: version+1, startedAt: now, ... }`, and `$push` the audit entry — all in one atomic update. Then `void startRecalculation(version+1)`.

### D8. Chart regeneration: not required (view-time derivation confirmed)

**Decision (Open Question 4):** the bulk job does **not** regenerate `Chart` documents. Verified by grep: `chartRenderer.ts` / `chartDataTransform.ts` have zero aspect references — chart SVGs/data are purely positional (house divisions + planet placements at degrees) and are already regenerated by the existing per-horoscope recalc paths only when positions change. Aspects are consumed by the planets table / house aspect lists / tooltips from `CalculatedDetails`, which the job does refresh. Regenerating charts on every settings change would be pure write amplification with no observable difference.

### D9. Search index refresh: deferred (RAG not implemented)

**Decision (Open Question 5):** no re-indexing in this feature. The `SearchEmbedding`/Qdrant/Transformers.js pipeline described in `specs/architecture/overview.md` is not implemented; `src/app/api/search/route.ts` performs in-memory keyword scoring against `CalculatedDetails`-derived text (which the job refreshes). When the RAG pipeline lands, its indexing path must subscribe to the same "settings version changed" trigger (documented gap, no code today).

### D10. Manual `ageRanges` / dashas: recomputed via the existing pipeline (time-dependent by design)

**Decision (Open Question 6):** the manual recalc path recomputes `derivedRanges` (`ageRanges`) and dasha dates from the **current** Shani transit at run time, exactly as the manual-create flow and the existing `recalculateCalculatedHoroscope` script do today. Preserving stored ranges would require a code path the manual pipeline does not have (there is no "recompute aspects only" mode). This keeps US-SAS-009 AC3 true — recalculation produces the same result as re-entering the identical placements on the manual-create flow — at the cost of `ageRanges` drifting with the real Shani position per run. Documented, accepted behavior; a domain decision to preserve ranges would be a follow-up change.

### D11. Student write path removed

**Decision (US-SAS-005/008 AC3):** `PUT /api/settings` returns **403** ("system settings are managed by the administrator") for authenticated students — the endpoint previously managed exactly these three fields, so it has nothing else to accept. `GET /api/settings` is unchanged in shape but reads from `AstrologySettings`. No new student route is introduced (Open Question 8 → reuse `GET /api/settings`).

### D12. Admin metadata hidden from students

**Decision (Open Question 9):** `GET /api/settings` returns only `{ planetaryOrbs, planetAspects, rashiAspects }` — never `updatedBy` / `updatedAt` / `version` / `lastRecalculatedAt` / `recalcStatus` / `auditLog` / `recalcHistory`. Admin metadata is admin-route-only (US-SAS-005 business rules).

### D13. AuthZ distinguishes 401 vs 403

**Decision (US-SAS-008):** the existing `checkAdmin()` in `src/app/api/admin/route.ts` returns 403 for both unauthenticated and non-admin. The new routes return **401 when `getServerSession(authOptions)` yields no user id** and **403 when the role is not `super-admin`**; both non-admin (403) and unauthenticated (401) rejections are logged at warn via the shared `logger` with printf-style args. The check runs on every request server-side; there is no client-side-only gating.

## 4. System Context Diagram

```
┌──────────────────────────────────────────────┐
│           Super Admin (SI/EN)                │
│  views settings · edits settings ·           │
│  monitors recalc progress · audits history   │
└──────────────┬───────────────────────────────┘
               │ HTTPS (REST, super-admin only)
               ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Next.js App Layer                           │
│                                                                  │
│  ┌─────────────────────────────┐    ┌────────────────────────┐   │
│  │ Admin routes (new)          │    │ Student settings UI    │   │
│  │  GET/PUT /api/admin/        │    │  GET /api/settings     │   │
│  │    astrology-settings       │    │  (read-only, system    │   │
│  │  GET  /api/admin/           │    │   values + managed-    │   │
│  │    astrology-settings/recalc│    │   by-admin notice)     │   │
│  │  POST /api/admin/           │    └───────────┬────────────┘   │
│  │    astrology-settings/recalc│                │                │
│  └────────────┬────────────────┘                │                │
│               ▼                                 ▼                │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │                  Calculation / Job Layer                 │   │
│  │  src/lib/astrologySettings.ts  (read/seed/update helper) │   │
│  │  src/lib/recalculationJob.ts   (in-process bulk runner)  │   │
│  │  src/lib/calculation.ts        (auto calc — unchanged)   │   │
│  │  src/lib/manualChart.ts        (manual calc — unchanged) │   │
│  └──────────────┬───────────────────────────────────────────┘   │
│                 ▼                                               │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │              Data Layer (MongoDB)                        │   │
│  │  astrologysettings  (singleton _id:"system", values +    │   │
│  │    version, updatedBy/At, lastRecalculatedAt, recalcStatus│   │
│  │    auditLog[], recalcHistory[])                           │   │
│  │  calculateddetails  (refreshed in place by the job —     │   │
│  │    planets[].aspects, houses[].aspectingPlanets, manual  │   │
│  │    per-house aspects, manualHousePlacements preserved)   │   │
│  │  users  (legacy per-user settings — inert, never read)   │   │
│  └───────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

## 5. Architecture Decisions

| # | Decision | Choice | Rationale | Alternatives evaluated |
|---|----------|--------|-----------|------------------------|
| AD-1 | Settings source of truth | **Single `AstrologySettings` document** (`_id: "system"`); `User` legacy fields inert | US-SAS-006; one shared snapshot ⇒ identical aspects for every viewer; mirrors data-model | Keep per-user (rejected: divergence between owner/viewer/share); per-user + system override (rejected: complexity, no requirement) |
| AD-2 | Seeding | **Lazy upsert-on-miss** via `getAstrologySettings()` using `$setOnInsert` of a minimal seed (real values only — no nulls/empty placeholders, D2) | US-SAS-007; concurrency-safe; no boot hook; defaults equal current code defaults | Seed in `connectDB()` (rejected: build-time imports); boot cron (rejected: extra infra) |
| AD-3 | Admin routes | **`GET`/`PUT /api/admin/astrology-settings`** + `GET`/`POST /api/admin/astrology-settings/recalc`, super-admin only | US-SAS-008; mirrors existing admin pattern with 401/403 distinction | Under `/api/settings` (rejected: student route, wrong AuthZ surface) |
| AD-4 | Student read | **Reuse `GET /api/settings`** with the same response shape, values from `AstrologySettings` | Open Question 8; minimal UI change; matches what students consume today | New read-only route (rejected: splits one settings concern) |
| AD-5 | Student write | **`PUT /api/settings` → 403** (managed-by-admin message) | US-SAS-008 AC3; endpoint has nothing else to accept | Keep PUT for students (rejected: breaks AuthZ); repurpose for other settings (rejected: none exist) |
| AD-6 | Update semantics | Subset `$set`, all-or-nothing validation, no-op detection, `version++`, `updatedBy`/`updatedAt`, atomic + audit push | US-SAS-002; no spurious recalc runs | Always bump (rejected: spurious runs); partial saves (rejected: all-or-nothing rule) |
| AD-7 | Concurrency | Required `version` in PUT → 409 on mismatch; 409 while `recalcStatus.status === "running"`; stale-run guard per batch | US-SAS-010; reject-with-retry (Open Question 7); one in-flight run | Queue-and-apply (rejected: complexity); blind last-write-wins (rejected: silent clobber) |
| AD-8 | Bulk job infra | **In-process module-level runner**, no new infra; resumable via persisted state + `POST .../recalc` | Open Question 1; repo has no queue; self-hosted Node keeps the task alive; resumability covers restarts | Redis/BullMQ (rejected: infra cost); periodic sweep (rejected: no cron); inline (rejected: blocking); worker process (rejected: ops cost) |
| AD-9 | Recalc contract | Batched (100 default), idempotent per `version`, resume from `lastProcessedHoroscopeId`, progress persisted per batch, per-horoscope atomic writes, partial-failure-safe | US-SAS-004/009/010 | All-at-once (rejected: memory/time); two-phase commit (rejected: no multi-doc txn) |
| AD-10 | Manual recalc | Recompute via `manualPlacementsToInput` + `compute` with system `aspectOptions`; `manualHousePlacements` sanitized round-trip, never rewritten | US-SAS-009; same as create flow; placements preserved | Derive aspects only (rejected: no such pipeline); overwrite placements (rejected: violates source of truth) |
| AD-11 | Chart regeneration | **None** — charts are positional, view-time derived from `CalculatedDetails` | Open Question 4; verified no aspect refs in chart modules | Regenerate per chart type (rejected: write amplification, no visible change) |
| AD-12 | Search re-index | **Deferred** until the RAG pipeline is implemented | Open Question 5; current search reads refreshed `CalculatedDetails` | Build re-index now (rejected: no embeddings exist) |
| AD-13 | Manual `ageRanges` | Recompute with current Shani (matches create flow + existing script) | Open Question 6; no aspect-only path exists; documented time-dependence | Preserve stored ranges (rejected: needs a new pipeline mode) |
| AD-14 | Audit trail | Embedded `auditLog[]` (cap 100) + `recalcHistory[]` (cap 20) on the settings doc | US-SAS-011; atomic with writes; caps = v1 retention (Open Question 10) | Separate collections (rejected: joins + lifecycle; revisit if volume grows) |
| AD-15 | Failure retry | **Targeted `horoscopeIds` POST** (retry failed subset) or body-less full rerun | Open Question 11; both share one runner | Retry-failed button only (rejected: full-rerun idempotency also valuable); new dedicated collection (rejected: over-engineering) |
| AD-16 | Admin metadata for students | Hidden; `GET /api/settings` returns values only | Open Question 9; US-SAS-005 | Expose updatedAt/version (rejected: student confusion, no requirement) |

## 6. Component Design

### 6.1 `src/models/AstrologySettings.ts` (new)

```ts
interface RecalcStatus {
    status: "idle" | "running" | "completed" | "failed";
    settingsVersion?: number;          // settings version this run targets
    startedAt?: Date;
    finishedAt?: Date;
    total?: number;                    // id set size (fixed at run start)
    processed?: number;
    succeeded?: number;
    failed?: number;
    lastProcessedHoroscopeId?: string; // resume cursor
    failedHoroscopeIds?: string[];     // set at completion when failed > 0
    error?: string;                    // run-level failure message (status "failed")
}

interface AuditEntry {
    id: string;                        // uuid
    version: number;                   // settings version AFTER the change
    changedBy: { id: string; name?: string };
    changedAt: Date;
    changes: {
        planetaryOrbs?: { from: unknown; to: unknown };
        planetAspects?: { from: unknown; to: unknown };
        rashiAspects?: { from: unknown; to: unknown };
    };
}

interface RecalcRunEntry {
    id: string;
    settingsVersion: number;
    triggeredBy: { id: string; name?: string };
    startedAt: Date;
    finishedAt?: Date;
    total: number;
    succeeded: number;
    failed: number;
    failedHoroscopeIds?: string[];    // present only when failed > 0 (capped at 100 per run)
}
```

Schema notes (storage policy from D2 — no `null`s, no empty placeholders):
- `_id: { type: String, default: "system" }` — fixed singleton key; `versionKey: false` (we have our own `version`, don't collide with Mongoose `__v`).
- `planetaryOrbs` / `planetAspects` / `rashiAspects`: `Schema.Types.Mixed` (same convention as `User`). No `default` on `planetAspects` or `rashiAspects.overrides` — they are written only when non-empty.
- `recalcStatus`: `Schema.Types.Mixed`, **no persisted default** — the field is absent until a run starts (readers treat absence as "no run yet"). Never seeded as `{ status: "idle" }`.
- `auditLog` / `recalcHistory`: `[Schema.Types.Mixed]`, **no `default: []`** — created by the first `$push` (capped with `$slice`). A fresh document has neither field.
- `version: { type: Number, default: 1 }` (real value, always present); `updatedBy: { type: Object }` **no default** (absent until first admin update, never `null`); `lastRecalculatedAt`: Date, **absent until a run completes**; `createdAt`/`updatedAt` via `timestamps: true` (always real Dates).
- Model registration: `mongoose.models.AstrologySettings || mongoose.model("AstrologySettings", schema)` (dev-reload-safe, same pattern as `User`).

### 6.2 `src/lib/astrologySettings.ts` (new)

Pure-ish DB helpers (no astro logic):

```ts
export const DEFAULT_PLANETARY_ORBS: Record<string, number>;   // same values as User's DEFAULT_ORBS
export const DEFAULT_PLANET_ASPECTS = {};                        // every planet falls back to per-planet defaults
export const DEFAULT_RASHI_ASPECTS: RashiAspectsSetting;         // re-export from @/lib/rashiAspects

export interface CalculationSettings {
    planetaryOrbs: Record<string, number>;
    planetAspects: PlanetAspectsMap;
    rashiAspects?: RashiAspectsSetting;
}

getAstrologySettings(forceFresh = false): Promise<IAstrologySettings>;
//   findById("system"); upsert-on-miss with $setOnInsert of the minimal seed document (D2).
//   forceFresh is accepted now for symmetry; no cache exists, so every call is fresh.

getCalculationSettings(): Promise<CalculationSettings>;
//   destructure getAstrologySettings(); synthesize DEFAULT_* fallbacks per field so consumers
//   always receive the full shapes ({ planetAspects: {} } / { enabled: false, overrides: {} })
//   even though those empty forms are never persisted (D2 storage policy).

applySettingsUpdate(input: {
    version: number;
    planetaryOrbs?: Record<string, number>;
    planetAspects?: PlanetAspectsMap;
    rashiAspects?: RashiAspectsSetting;
    changedBy: { id: string; name?: string };
}): Promise<{ outcome: "no-op" } | { outcome: "updated"; doc: IAstrologySettings; newVersion: number } | { outcome: "conflict"; reason: "stale" | "running" }>;
//   Validates version lock + single-flight guard, validates payload (all-or-nothing), deep-compares
//   normalized values for no-op, and applies the atomic update (fields + version++ + updatedBy/At +
//   recalcStatus running + audit $push with $slice). Does NOT start the job — the caller (route)
//   calls startRecalculation.
//   Empty-normalization on write: a provided setting that normalizes to empty is $unset, never
//   stored as {} — e.g. planetAspects: {} ⇒ $unset planetAspects; rashiAspects: { enabled: false,
//   overrides: {} } ⇒ $set { enabled: false } (overrides key omitted). No-op comparison compares the
//   normalized incoming values against the stored values resolved to the same normalized form.
```

`DEFAULT_ORBS` currently lives in `src/models/User.ts` and is imported by call sites. Keep `DEFAULT_ORBS` exported there (re-export `DEFAULT_PLANETARY_ORBS`) to avoid breaking existing imports; new code imports from `astrologySettings.ts`.

### 6.3 `src/lib/recalculationJob.ts` (new)

```ts
export const RECALC_BATCH_SIZE = Number(process.env.RECALC_BATCH_SIZE ?? 100);

let activeRun: { settingsVersion: number } | null = null;   // module-level single-flight guard

export function isRecalculationRunning(): boolean;           // activeRun !== null || persisted status === "running"

export async function startRecalculation(opts?: {
    settingsVersion?: number;      // when resumed from a PUT; otherwise resolved from the doc
    horoscopeIds?: string[];       // targeted retry of a failed subset
}): Promise<void>;
```

`startRecalculation` algorithm:
1. `const doc = await getAstrologySettings(true)`; `const version = opts.settingsVersion ?? doc.version`.
2. If `opts.horoscopeIds` present → targeted run: `total = ids.length`, skip resume logic, begin at batch 0. Else:
   - If `activeRun` is set → return (single-flight; a run is already active in-process).
   - If `doc.recalcStatus?.status === "completed"` and `doc.recalcStatus.settingsVersion === version` → return (already done — idempotency, US-SAS-004 AC2).
   - If `doc.recalcStatus?.status === "running"` and `doc.recalcStatus.settingsVersion === version` → resume from `doc.recalcStatus.lastProcessedHoroscopeId`.
   - Else start fresh: snapshot ids = `(await CalculatedDetails.find({}, { "horoscope.id": 1, _id: 0 }).lean()).map(d => d.horoscope.id)` deduped; `total = ids.length`.
3. `activeRun = { settingsVersion: version }`; persist initial `recalcStatus = { status: "running", settingsVersion: version, startedAt: now, total, processed: 0, succeeded: 0, failed: 0 }`.
4. Loop over ids in batches of `RECALC_BATCH_SIZE` (skipping up to the resume cursor when resuming):
   a. **Stale-run guard:** `const current = await getAstrologySettings(true)`; if `current.version !== version` → `logger.warn` and **return** (do not touch `recalcStatus`; the newer update owns it).
   b. For each id in the batch: load `Horoscope.findById(id)`; load existing `CalculatedDetails` (to read `manualHousePlacements` for manual, and to skip nothing — the snapshot guarantees presence); recompute per `source` (D5); persist with `findOneAndUpdate({ "horoscope.id": id }, payload, { upsert: true })`; `succeeded++` / `failed++` with `{ id, error }` captured. Never catch-and-continue a failure into a half-written snapshot — a thrown error before the write leaves the old snapshot intact.
   c. After the batch: `findByIdAndUpdate("system", { $set: { "recalcStatus.processed": ..., "recalcStatus.succeeded": ..., "recalcStatus.failed": ..., "recalcStatus.lastProcessedHoroscopeId": lastId } })`.
5. On completion: `findByIdAndUpdate("system", { $set: { lastRecalculatedAt: finishedAt, "recalcStatus.status": "completed", ... counts } + (failed > 0 ? { "recalcStatus.failedHoroscopeIds": [...] } : {}) }, { $push: { recalcHistory: entryWithCap } })`; `logger.info` summary. On run-level error: set `recalcStatus.status = "failed"` + `error`. `failedHoroscopeIds` / `error` are **set only when non-empty** (never `[]`/`null`).
6. Finally: `activeRun = null`.

Guarantees: at-most-once per horoscope per resume boundary (cursor is persisted after each batch and only advanced past persisted successes); idempotent per version; no multi-doc transactions; failure isolation per horoscope.

### 6.4 Calculation call sites (modified)

- `src/app/api/horoscope/route.ts` (auto create): replace the `User.findOne` block with `const { planetaryOrbs, planetAspects, rashiAspects } = await getCalculationSettings();` then the existing `calculateHoroscope(horoscope, planetaryOrbs, planetAspects, rashiAspects)` call.
- `src/app/api/horoscope/manual/route.ts` (manual create): replace the `User.findOne` block; build `parsed.value.aspectOptions = { planetaryOrbs, planetAspects, rashiAspects }` from system settings.
- `src/app/api/horoscope/[id]/route.ts` (recalc on edit): same replacement at the recalc branch (currently lines ~157-159).
- The `User` model/`IUser` are unchanged (legacy fields kept).

### 6.5 Admin routes (new)

- `src/app/api/admin/astrology-settings/route.ts`:
  - `GET`: 401 no session / 403 non-admin / 200 with the full document (`planetaryOrbs`, `planetAspects`, `rashiAspects`, `version`, `updatedAt`, and — **only when set** — `updatedBy`, `lastRecalculatedAt`, `recalcStatus`, `auditLog`, `recalcHistory`; absent fields are omitted, never `null`/`[]`). Lazy-seeds via `getAstrologySettings()` first (US-SAS-001 edge case: admin never sees a 404).
  - `PUT`: body = `{ version, planetaryOrbs?, planetAspects?, rashiAspects? }`. Reject empty subset (400), validate all-or-nothing (400), enforce `version` (409 stale), enforce not-running (409), no-op (200 noChange), else persist via `applySettingsUpdate` then `void startRecalculation({ settingsVersion: newVersion })` and return 200 with the updated doc + `recalcStarted: true`.
- `src/app/api/admin/astrology-settings/recalc/route.ts`:
  - `GET`: 200 `{ recalcStatus }` (polling endpoint — Open Question 3 resolved to polling, simplest for v1). `recalcStatus` is the stored field when present; `{}` when no run has ever started (client treats absence as idle).
  - `POST`: optional `{ horoscopeIds?: string[] }` → `void startRecalculation({ horoscopeIds })` (or full run when absent); 200 `{ recalcStatus }`. Used for resume-after-restart and retry-of-failed-subset.
- AuthZ helper: inline per-route (mirror `checkAdmin` but distinguish 401/403), or a small shared `requireAdmin()` — Developer's choice; both routes must return 401 (no session) / 403 (non-admin) and `logger.warn` the rejection.

### 6.6 `src/app/api/settings/route.ts` (modified)

- `GET`: `const { planetaryOrbs, planetAspects, rashiAspects } = await getCalculationSettings();` return `{ planetaryOrbs, planetAspects, rashiAspects }` (values only — D12). 401 when unauthenticated (unchanged).
- `PUT`: 401 unauthenticated; otherwise **403** `{ error: "System settings are managed by the administrator." }`. The `validatePlanetAspectsPayload` / `validateRashiAspectsPayload` imports are removed.

## 7. Data Flows

### 7.1 Fresh system boot / first request (US-SAS-007)

```
first request hits any reader (admin GET, GET /api/settings, horoscope create)
  → connectDB() → getAstrologySettings()
  → findById("system") → null
  → findByIdAndUpdate("system",
        { $setOnInsert: { planetaryOrbs: {...9 values}, rashiAspects: { enabled: false }, version: 1 } },
        { upsert: true, new: true })
  → exactly one document (concurrent boots can't duplicate — fixed _id + $setOnInsert)
  → no nulls / no empty placeholders: no planetAspects, no recalcStatus, no auditLog/recalcHistory,
    no updatedBy/lastRecalculatedAt on the fresh document
  → defaults immediately effective for the first calculation (readers synthesize the empty forms)
```

### 7.2 Super-admin updates settings (US-SAS-002/003/008)

```
Admin → admin settings UI → edit → PUT /api/admin/astrology-settings
  body: { version: 3, rashiAspects: { enabled: true, overrides: {} } }
  → getServerSession → no session → 401 (warn log)
  → role !== "super-admin" → 403 (warn log)
  → connectDB() → getAstrologySettings()
  → validate payload (all-or-nothing) → invalid → 400 (nothing persisted)
  → version mismatch → 409 "refresh and retry"
  → recalcStatus.status === "running" → 409 "recalculation in progress"
  → deep-compare normalized values vs current → identical → 200 { noChange: true } (no bump, no run)
  → atomic update: $set rashiAspects { enabled: true } (no empty overrides key), $inc version → 4,
    updatedBy { id }, updatedAt, recalcStatus { status: "running", settingsVersion: 4, startedAt },
    auditLog $push + $slice -100
  → void startRecalculation({ settingsVersion: 4 })        // not awaited
  → 200 { message, recalcStarted: true, ...updatedDoc }
```

### 7.3 Bulk recalculation run (US-SAS-003/004/009/010)

```
startRecalculation({ settingsVersion: 4 })
  → guard: activeRun? return · completed for v4? return · running for v4? resume cursor
  → snapshot ids from CalculatedDetails (fixed at run start) → total = N
  → recalcStatus { status: "running", settingsVersion: 4, startedAt, total, processed: 0 }
  → per batch (100):
        stale guard: current.version === 4 ? continue : stop (warn, leave recalcStatus)
        per id: Horoscope → source "auto":
            calculateHoroscope(horoscope, orbs, aspects, rashi)
            CalculatedDetails.findOneAndUpdate({ "horoscope.id": id }, { ...calculated }, { upsert: true })
            → succeeded++ | catch → failed++ (snapshot untouched, error recorded)
                source "manual":
            read stored manualHousePlacements (missing/corrupt → failed)
            compute(manualPlacementsToInput(mhp), getCurrentShani, { orbs, aspects, rashi })
            synth = synthesizeCalculation(result, birthDate); navSynth = synthesizeNavamsaCalculation(...)
            findOneAndUpdate({ "horoscope.id": id },
                { ...synth, manualHousePlacements: sanitizeManualHousePlacements(result.manualHousePlacements),
                  derivedRanges: result.derivedRanges }, { upsert: true })
            → succeeded++ | catch → failed++
        persist progress (processed/succeeded/failed/lastProcessedHoroscopeId)
  → completion: recalcStatus { status: "completed", finishedAt, counts } + (failedHoroscopeIds only
    when failed > 0) + lastRecalculatedAt + recalcHistory $push (cap 20)
  → admin polls GET /api/admin/astrology-settings/recalc → live progress
  → process restart mid-run → recalcStatus still "running" v4 → admin POST .../recalc (no body)
    → resumes from lastProcessedHoroscopeId
```

### 7.4 Student reads (US-SAS-005)

```
Student → settings UI → GET /api/settings
  → session check (unchanged) → getCalculationSettings() → { planetaryOrbs, planetAspects, rashiAspects }
  → UI renders read-only values + "managed by the administrator" notice (i18n si/en)
Student attempts write → PUT /api/settings → 403 managed-by-admin message
```

## 8. API Contracts

### 8.1 `GET /api/admin/astrology-settings`

- 401 no session · 403 non-super-admin · 200 otherwise.
- The response reflects the stored document: fields that are not set are **omitted**, never `null`/`{}`/`[]`. Absent optional fields are normalized for display by the admin UI ("no recalculation run yet" for a missing `recalcStatus`, empty states for missing `auditLog`/`recalcHistory`).

Freshly-seeded document (no update or run has happened yet):
```json
{
    "planetaryOrbs": { "1": 15, "2": 12, "3": 8, "4": 7, "5": 9, "6": 7, "7": 9, "8": 0, "9": 0 },
    "rashiAspects": { "enabled": false },
    "version": 1,
    "updatedAt": "2026-08-12T22:00:00.000Z"
}
```
`planetAspects`, `updatedBy`, `lastRecalculatedAt`, `recalcStatus`, `auditLog`, `recalcHistory` are absent.

After an update + a completed run, the present fields look like:
```json
{
    "planetaryOrbs": { "1": 15, "2": 12, "3": 8, "4": 7, "5": 9, "6": 7, "7": 9, "8": 0, "9": 0 },
    "rashiAspects": { "enabled": true, "overrides": { "1": { "enabled": false } } },
    "version": 2,
    "updatedBy": { "id": "user-uuid" },
    "updatedAt": "2026-08-12T22:05:00.000Z",
    "lastRecalculatedAt": "2026-08-12T22:06:00.000Z",
    "recalcStatus": {
        "status": "completed",
        "settingsVersion": 2,
        "startedAt": "2026-08-12T22:05:00.000Z",
        "finishedAt": "2026-08-12T22:06:00.000Z",
        "total": 120,
        "processed": 120,
        "succeeded": 119,
        "failed": 1,
        "failedHoroscopeIds": ["horoscope-uuid"]
    },
    "auditLog": [
        {
            "id": "entry-uuid",
            "version": 2,
            "changedBy": { "id": "user-uuid" },
            "changedAt": "2026-08-12T22:05:00.000Z",
            "changes": { "rashiAspects": { "from": { "enabled": false }, "to": { "enabled": true } } }
        }
    ],
    "recalcHistory": [
        {
            "id": "run-uuid",
            "settingsVersion": 2,
            "triggeredBy": { "id": "user-uuid" },
            "startedAt": "2026-08-12T22:05:00.000Z",
            "finishedAt": "2026-08-12T22:06:00.000Z",
            "total": 120,
            "succeeded": 119,
            "failed": 1,
            "failedHoroscopeIds": ["horoscope-uuid"]
        }
    ]
}
```

### 8.2 `PUT /api/admin/astrology-settings`

Request (subset; `version` required):
```json
{
    "version": 1,
    "rashiAspects": { "enabled": true, "overrides": {} },
    "planetaryOrbs": { "1": 15, "2": 12, "3": 8, "4": 7, "5": 9, "6": 7, "7": 9, "8": 0, "9": 0 }
}
```

Responses:
- 200 updated — body is the full updated document (as in 8.1) + `"recalcStarted": true`.
- 200 no-op — `{ "noChange": true, ...currentDoc }` (no `version` bump, no run, no audit entry).
- 400 — empty subset (`"no valid setting provided"`) or validation failure (`"Invalid planetaryOrbs: ..."` / `"Invalid planetAspects: ..."` / `"Invalid rashiAspects: ..."`), localized; nothing persisted.
- 409 stale — `{ "error": "Settings have changed. Refresh and retry." }` (body `version` ≠ current).
- 409 running — `{ "error": "A recalculation is in progress. Retry after it completes." }`.
- 401/403 as in 8.1.

Validation rules (identical to today's settings route semantics):
- `planetaryOrbs`: keys `"1"`…`"9"`; finite numbers 0–30.
- `planetAspects`: `validatePlanetAspectsPayload` — keys `"1"`…`"9"`; `houses` integers 1–12, non-empty, unique, ascending; `degrees` multiples of 30 in 30–330, non-empty, unique, ascending.
- `rashiAspects`: `validateRashiAspectsPayload` — `enabled` boolean; `overrides` keyed by ZodiacSign enum strings `"1"`…`"12"` with boolean `enabled` (+ optional per-target overrides).

### 8.3 `GET` / `POST /api/admin/astrology-settings/recalc`

- `GET` → 200 `{ "recalcStatus": { ... } }` (polling; 401/403 as above).
- `POST` → body optional `{ "horoscopeIds": ["id1", "id2"] }`; 200 `{ "recalcStatus": { ... } }`. A body-less POST starts/resumes a full run; a `horoscopeIds` POST is a targeted retry of the failed subset (Open Question 11).

### 8.4 `GET /api/settings` (unchanged shape, new source)

```json
{
    "planetaryOrbs": { "1": 15, "2": 12, "3": 8, "4": 7, "5": 9, "6": 7, "7": 9, "8": 0, "9": 0 },
    "planetAspects": {},
    "rashiAspects": { "enabled": false, "overrides": {} }
}
```
No admin metadata. 401 when unauthenticated (unchanged). The empty `planetAspects` / `overrides` shown here are **read-time synthesized** shapes (D2 storage policy) — the DB itself stores neither.

### 8.5 `PUT /api/settings`

- 401 no session; otherwise **403** `{ "error": "System settings are managed by the administrator." }` (US-SAS-008 AC3).

## 9. Testing Strategy

- **Unit (`src/__tests__/*.test.ts`, Jest + ts-jest, node env):**
  - `astrologySettings.test.ts` — seeding idempotency (second call no-ops), concurrent upsert produces one doc, `getCalculationSettings` fallbacks, `applySettingsUpdate` no-op detection, stale-version conflict, running conflict, audit append/cap. Mock the model layer (or use an in-memory Mongo if `mongodb-memory-server` is acceptable — otherwise mock `findByIdAndUpdate`).
  - `recalculationJob.test.ts` — idempotent rerun (completed v4 → no-op), resume from `lastProcessedHoroscopeId` (cursor respected, no double-processing), stale-run guard stops a v3 run when doc is v4, partial failure (one throwing horoscope counted, others persisted, snapshot of the failed one untouched), targeted `horoscopeIds` run, zero-horoscope run completes with 0/0.
  - Storage policy (D2): seeded/updated documents never contain `null` values or empty `{}`/`[]` placeholder fields — assert in `astrologySettings.test.ts` and the integration tests.
- **Integration (admin routes):** 401 unauthenticated, 403 student role, PUT validation all-or-nothing (400, nothing persisted), version 409, running 409, no-op 200 without bump, successful PUT bumps version + writes audit + sets `recalcStatus` running, `GET /api/settings` returns system values and no metadata, `PUT /api/settings` → 403.
- **Determinism (US-SAS-003):** with a fixed settings document, recomputing the same auto horoscope twice yields identical `planets[].aspects` and `houses[].aspectingPlanets`; manual horoscopes round-trip `manualHousePlacements` unchanged through a recalc.
- **QA golden data (Open Question 12):** provide fixtures for (a) one auto horoscope, (b) one manual horoscope, across a settings change (flip `rashiAspects.enabled`, change an orb, change a planet's `houses`/`degrees`) — expected before/after snapshots to verify the bulk output deterministically.

## 10. File-by-File Change List

**New files**
- `src/models/AstrologySettings.ts` — singleton model (§6.1).
- `src/lib/astrologySettings.ts` — `getAstrologySettings` / `getCalculationSettings` / `applySettingsUpdate` + defaults (§6.2).
- `src/lib/recalculationJob.ts` — in-process bulk runner (§6.3).
- `src/app/api/admin/astrology-settings/route.ts` — GET/PUT (§6.5).
- `src/app/api/admin/astrology-settings/recalc/route.ts` — GET (poll) / POST (start/resume/retry) (§6.5).
- Tests: `src/__tests__/astrologySettings.test.ts`, `src/__tests__/recalculationJob.test.ts`, plus admin-route integration tests.

**Modified files**
- `src/app/api/settings/route.ts` — GET reads `AstrologySettings`; PUT → 403 (§6.6).
- `src/app/api/horoscope/route.ts` — system settings instead of `User` (§6.4).
- `src/app/api/horoscope/manual/route.ts` — system settings into `aspectOptions` (§6.4).
- `src/app/api/horoscope/[id]/route.ts` — system settings in the recalc branch (§6.4).
- `src/models/User.ts` — only the `DEFAULT_ORBS` re-export to alias `DEFAULT_PLANETARY_ORBS` (legacy fields untouched).
- `src/messages/en.json` / `src/messages/si.json` — admin UI labels + student "managed by administrator" notice (kept in sync).

## 11. Developer Action Items / Risks

- **`activeRun` is process-local.** On a multi-instance deploy, two instances could each run the same resume; the persisted `status === "running"` + idempotent per-horoscope `findOneAndUpdate` makes this benign (same result either way). True cross-instance locking is out of scope for v1 (single self-hosted instance assumed).
- **Un-awaited `void startRecalculation()`** may be cut short by a process restart; the resume mechanism (8.3 POST) is the recovery path — document it in the admin UI ("resume recalculation").
- **Do not import `recalculationJob` in `next build`-reachable modules at top level** — it must never start a run during static analysis/build.
- **Orb/aspect validators** stay in `src/lib/planetAspects.ts` / `src/lib/rashiAspects.ts` (unchanged); `astrologySettings.ts` only orchestrates.
- **`recalcStatus` schema is `Mixed`** — the Developer should still freeze the field set in the TS interfaces (§6.1) so consumers never read a half-written shape.

## 12. Traceability

| User Story | Delivered by |
|---|---|
| US-SAS-001 (admin views settings) | §6.5 GET route, §8.1 |
| US-SAS-002 (admin updates, audited) | §6.5 PUT route, D6/D7, §8.2 |
| US-SAS-003 (update → recalc all) | D4/D5, §6.3, §7.3 |
| US-SAS-004 (idempotent/resumable, progress, partial failure) | D5, §6.3 |
| US-SAS-005 (student read-only) | D11/D12, §6.6, §8.4/8.5 |
| US-SAS-006 (system settings = source of truth) | D3, §6.4 |
| US-SAS-007 (seed defaults) | D2, §6.2, §7.1 |
| US-SAS-008 (AuthZ 401/403) | D13, §6.5, §8.2/8.3 |
| US-SAS-009 (manual from stored placements) | D5/D10, §6.3 |
| US-SAS-010 (concurrency safety) | D7, §6.2/6.3 |
| US-SAS-011 (audit + recalc history) | D6, §8.1 |

## 13. Open Questions Left for Developer/UX/QA

- i18n message keys for the new admin UI (si/en) and the student notice.
- Admin UI placement/navigation (Open Question 15) — UX phase.
- Whether `mongodb-memory-server` is acceptable for job tests vs mocking (Developer).
- `RECALC_BATCH_SIZE` default 100 sanity-check against a real 10k+ DB (QA).

