# Horoscope Privacy Settings — Architecture Specification

**Date:** 2026-07-27
**Author:** Architecture Agent
**Based on:** specs/business-analysis/20260727-1913-privacy-settings.md, specs/business-analysis/data-model.md, specs/architecture/overview.md

---

## 1. Overview

The Horoscope Privacy Settings system controls visibility of horoscopes across the platform. It introduces two boolean fields on the `horoscopes` collection (`isPublic`, `displayName`) — both already exist in the schema — and defines the enforcement rules across all surfaces: search, detail view, share links, and admin access.

### Scope

| Aspect | In Scope | Out of Scope |
|--------|----------|--------------|
| Visibility control | `isPublic` (public/private toggle), `displayName` (show/hide name) | Per-field granular privacy, group-based access control |
| Enforcement surfaces | Search, detail view, share links, admin panel | PDF export, chart image metadata (handled separately per content type) |
| Audit | Privacy changes, Super Admin views of private horoscopes | General access logging, rate-limit logging |
| Embedding lifecycle | Trigger embedding generate/remove on privacy toggle | Embedding recalculation for data changes |

### Privacy Rules Summary

| Surface | Owner | Other Student | Share Link Recipient | Super Admin |
|---------|-------|---------------|---------------------|-------------|
| Own search results | All horoscopes | N/A | N/A | All horoscopes |
| Other's search results | N/A | Only `isPublic=true` | N/A | All horoscopes |
| Name in search | Actual name | `isPublic=true` + `displayName=true` → actual name; `displayName=false` → anonymous placeholder | N/A | Actual name |
| Detail view | Always accessible | Only if `isPublic=true` | Via valid token | Always accessible |
| Name in detail view | Actual name | Actual name if `isPublic=true` + `displayName=true`; anonymous if `displayName=false` | Actual name | Actual name |
| Share link creation | Allowed (survives public→private) | N/A | N/A | N/A |

---

## 2. Data Flow Diagrams

### 2.1 Privacy Toggle Sequence (End-to-End)

```
┌─────┐     ┌──────────┐    ┌──────────────┐    ┌────────┐    ┌───────────┐    ┌──────────┐
│User │     │Frontend  │    │API: /privacy │    │MongoDB │    │Audit Log  │    │Job Queue │
│     │     │          │    │              │    │        │    │           │    │(async)   │
└──┬──┘     └───┬──────┘    └──────┬───────┘    └────┬───┘    └─────┬─────┘    └────┬─────┘
   │            │                  │                 │              │               │
   │ Toggle     │                  │                 │              │               │
   │ isPublic   │                  │                 │              │               │
   │───────────>│                  │                 │              │               │
   │            │ PATCH /privacy   │                 │              │               │
   │            │ { isPublic: bool }│                 │              │               │
   │            │─────────────────>│                 │              │               │
   │            │                  │ Auth check      │              │               │
   │            │                  │ (owner or 403)  │              │               │
   │            │                  │                 │              │               │
   │            │                  │ Update horoscope│              │               │
   │            │                  │────────────────>│              │               │
   │            │                  │<────────────────│              │               │
   │            │                  │                 │              │               │
   │            │                  │ Write audit log │              │               │
   │            │                  │─────────────────────────────>│               │
   │            │                  │                 │              │               │
   │            │                  │ [If public→private]           │               │
   │            │                  │ Queue embedding removal       │               │
   │            │                  │─────────────────────────────────────────────>│
   │            │                  │                 │              │               │
   │            │                  │ [If private→public]           │               │
   │            │                  │ Queue embedding generate      │               │
   │            │                  │─────────────────────────────────────────────>│
   │            │                  │                 │              │               │
   │            │ Return updated  │                 │              │               │
   │            │ horoscope       │                 │              │               │
   │            │<─────────────────│                 │              │               │
   │ Update UI  │                  │                 │              │               │
   │<───────────│                  │                 │              │               │
```

### 2.2 Search Query Privacy Enforcement

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│Session   │     │API:      │     │MongoDB   │
│User      │     │/search   │     │          │
└─────┬────┘     └────┬─────┘     └────┬─────┘
      │               │                │
      │ POST /search  │                │
      │──────────────>│                │
      │               │ MongoDB query  │
      │               │ $or: [         │
      │               │   {owner.id:   │
      │               │    session.id},│
      │               │   {isPublic:   │
      │               │    true}       │
      │               │ ]              │
      │               │───────────────>│
      │               │                │
      │               │<───────────────│
      │               │ (filtered      │
      │               │  results)      │
      │               │                │
      │               │ Post-process   │
      │               │ displayName:   │
      │               │ if !displayName│
      │               │ → overwrite    │
      │               │   name field   │
      │               │   with anonym. │
      │               │   placeholder  │
      │               │                │
      │ Return results│                │
      │<──────────────│                │
```

### 2.3 Super Admin Private Horoscope Access

```
┌──────────┐     ┌──────────────┐    ┌────────┐    ┌───────────┐
│Super     │     │API: /admin   │    │MongoDB │    │Audit Log  │
│Admin     │     │              │    │        │    │           │
└────┬─────┘     └──────┬───────┘    └────┬───┘    └─────┬─────┘
     │                  │                 │              │
     │ GET /admin/horoscope/:id           │              │
     │─────────────────>│                 │              │
     │                  │ Auth: role check│              │
     │                  │ (super-admin)   │              │
     │                  │                 │              │
     │                  │ Fetch horoscope │              │
     │                  │ (no isPublic    │              │
     │                  │  filter)        │              │
     │                  │────────────────>│              │
     │                  │<────────────────│              │
     │                  │                 │              │
     │                  │ Log access      │              │
     │                  │ action:         │              │
     │                  │ admin_view_     │              │
     │                  │ private         │              │
     │                  │──────────────────────────────>│
     │                  │                 │              │
     │ Return full data │                 │              │
     │ (actual name)   │                 │              │
     │<─────────────────│                 │              │
```

---

## 3. API Contracts

### 3.1 PATCH /api/horoscope/:id/privacy — Update Privacy Settings

**Current implementation:** `src/app/api/horoscope/[id]/privacy/route.ts`

**Request Body:**

```json
{
    "isPublic": true,
    "displayName": false
}
```

**Validation Rules:**

| Field | Type | Required | Default | Rule |
|-------|------|----------|---------|------|
| isPublic | boolean | No | Current value | When omitted, field is not changed |
| displayName | boolean | No | Current value | When omitted, field is not changed. Only meaningful when `isPublic=true`; setting it when `isPublic=false` is valid but has no visible effect until horoscope is made public |

**Response (200):**

```json
{
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "owner": { "id": "660e8400-e29b-41d4-a716-446655440001" },
    "name": "John Doe",
    "displayName": false,
    "isPublic": true,
    "birthDate": "1990-01-15",
    "birthTime": "14:30",
    ...
}
```

**Error Responses:**

| Status | Condition | Response |
|--------|-----------|----------|
| 401 | No valid session | `{ "error": "Unauthorized" }` |
| 403 | Not the owner | `{ "error": "Forbidden" }` |
| 404 | Horoscope not found | `{ "error": "Not found" }` |
| 500 | Server error | `{ "error": "Internal server error" }` |

**Behavior on success:**
1. Validates session and ownership
2. Updates only provided fields in MongoDB
3. Writes audit log entry with action `"privacy_change"` — captures `field`, `oldValue`, `newValue` for each changed field
4. If `isPublic` changed:
   - `false → true`: Queues an async job to generate search embedding (if not already present) and add to shared index
   - `true → false`: Queues an async job to remove search embedding from shared index
5. Returns updated horoscope document

### 3.2 POST /api/search — Search Horoscopes (Privacy-Aware)

**Current implementation:** `src/app/api/search/route.ts`

The search endpoint already enforces privacy at the database query level:

```typescript
const horoscopes = await Horoscope.find({
    $or: [{ "owner.id": session.user.id }, { isPublic: true }],
}).lean();
```

**Post-processing for displayName:**

After retrieving results and computing relevance scores, the response must anonymize names:

```typescript
const results = horoscopes
    .map((h) => {
        // ... existing scoring logic ...
        return { horoscope: h, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => ({
        ...r,
        horoscope: {
            ...r.horoscope,
            // Anonymize name for non-owners if displayName is false
            name:
                r.horoscope.owner.id !== session.user.id &&
                !r.horoscope.displayName
                    ? generateAnonymousPlaceholder(r.horoscope.id)
                    : r.horoscope.name,
        },
    }));
```

**Response (200):**

```json
{
    "results": [
        {
            "horoscope": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "owner": { "id": "660e8400-e29b-41d4-a716-446655440001" },
                "name": "Anonymous Horoscope #A3F2",
                "displayName": false,
                "isPublic": true,
                ...
            },
            "score": 1.5
        }
    ],
    "total": 1
}
```

### 3.3 GET /api/horoscope/:id — Get Single Horoscope (Privacy-Aware)

**Privacy check logic:**

```typescript
async function getHoroscope(id: string, session: Session) {
    const horoscope = await Horoscope.findById(id).lean();

    if (!horoscope) return null;
    if (horoscope.owner.id === session.user.id) return horoscope; // Owner always sees all
    if (session.user.role === "super-admin") return horoscope;    // Admin sees all

    // Other students: only if public
    if (!horoscope.isPublic) return null;

    // Anonymize name if displayName is false
    if (!horoscope.displayName) {
        horoscope.name = generateAnonymousPlaceholder(horoscope.id);
    }

    return horoscope;
}
```

### 3.4 GET /api/share/:token — Shared Horoscope Access

**Behavior:** Bypasses `isPublic` and `displayName` checks — share link recipients see the full horoscope including the actual name.

```typescript
// In share route, after validating token:
const horoscope = await Horoscope.findById(shareLink.horoscope.id).lean();
// Return full horoscope with actual name — no privacy filtering
```

### 3.5 GET /api/admin/horoscope — Admin List (Privacy-Bypass)

**Behavior:**
- Returns ALL horoscopes regardless of `isPublic`
- Always returns actual names (ignores `displayName`)
- Each returned private horoscope view is logged to `auditLogs`

```typescript
// Admin route
const horoscopes = await Horoscope.find({}).lean();

// Log each private horoscope access asynchronously (fire-and-forget)
for (const h of horoscopes) {
    if (!h.isPublic) {
        AuditLog.create({
            action: "admin_view_private",
            actor: { id: session.user.id },
            target: { id: h.id, type: "horoscope" },
            timestamp: new Date(),
            details: { viewedInList: true },
        }).catch((err) => logger.error("audit log write failed: %s", err.message));
    }
}
```

### 3.6 Anonymous Placeholder Generation

**Recommendation for UX:**

The anonymous placeholder format is TBD by UX but should meet these requirements:
- Does not reveal any identifiable information (name, birth date, location)
- Allows distinguishing between different anonymous horoscopes in the same search result
- Consistent across sessions for the same horoscope (so the user can refer to it)

**Suggested format:** Generate a short hash from the horoscope ID:

```typescript
function generateAnonymousPlaceholder(horoscopeId: string): string {
    // Take last 4 characters of UUID, make uppercase
    const shortId = horoscopeId.slice(-4).toUpperCase();
    return `Anonymous Horoscope #${shortId}`;
}
```

This produces stable identifiers like "Anonymous Horoscope #A3F2" without leaking any private data.

---

## 4. Audit Logging Design

### 4.1 Audit Log Model

The `auditLogs` MongoDB collection captures all privacy-sensitive operations for compliance and transparency.

**Schema:**

```typescript
interface IAuditLog {
    id: string;                    // UUID
    action: AuditAction;           // The type of audited action
    actor: { id: string };         // User who performed the action
    target: {                      // Resource that was acted upon
        id: string;
        type: "horoscope" | "user";
    };
    details?: {
        field?: string;            // For privacy_change: "isPublic" or "displayName"
        oldValue?: any;            // Previous value
        newValue?: any;            // New value
        description?: string;      // Human-readable context
    };
    timestamp: Date;
    ip?: string;                   // Request IP (for admin access audit)
    userAgent?: string;            // Browser user agent
}

type AuditAction =
    | "privacy_change"           // isPublic or displayName toggled
    | "admin_view_private"       // Super Admin viewed a private horoscope
    | "admin_view_list_private"  // Super Admin list query included private horoscopes
    | "share_link_created"       // Share link generated
    | "share_link_revoked"       // Share link deleted
    | "horoscope_deleted";       // Horoscope deleted (privacy-sensitive)
```

**Mongoose Schema (conceptual):**

```typescript
const AuditLogSchema = new Schema({
    id: { type: String, required: true, unique: true, default: uuidv4 },
    action: {
        type: String,
        enum: [
            "privacy_change",
            "admin_view_private",
            "admin_view_list_private",
            "share_link_created",
            "share_link_revoked",
            "horoscope_deleted",
        ],
        required: true,
    },
    actor: { id: { type: String, required: true } },
    target: {
        id: { type: String, required: true },
        type: { type: String, enum: ["horoscope", "user"], required: true },
    },
    details: {
        field: { type: String },
        oldValue: { type: Schema.Types.Mixed },
        newValue: { type: Schema.Types.Mixed },
        description: { type: String },
    },
    timestamp: { type: Date, default: Date.now },
    ip: { type: String },
    userAgent: { type: String },
});
```

### 4.2 Audit Points

| Trigger | Action | Details | Async/Sync |
|---------|--------|---------|------------|
| `PATCH /api/horoscope/:id/privacy` modifies `isPublic` | `privacy_change` | `{ field: "isPublic", oldValue: false, newValue: true }` | Sync (creates audit log in same request) |
| `PATCH /api/horoscope/:id/privacy` modifies `displayName` | `privacy_change` | `{ field: "displayName", oldValue: true, newValue: false }` | Sync |
| Super Admin views single private horoscope via admin API | `admin_view_private` | `{ description: "Admin viewed private horoscope" }` | Fire-and-forget (non-blocking) |
| Super Admin lists horoscopes that include private ones | `admin_view_list_private` | `{ description: "Admin list included N private horoscopes", count: N }` | Fire-and-forget |
| Share link created | `share_link_created` | `{ description: "Share link created" }` | Sync |
| Share link revoked | `share_link_revoked` | `{ description: "Share link revoked" }` | Sync |
| Horoscope deleted (with privacy context) | `horoscope_deleted` | `{ description: "Horoscope deleted. wasPublic: true" }` | Sync |

### 4.3 Audit Log Indexes

| Index | Type | Purpose |
|-------|------|---------|
| `{ timestamp: -1 }` | Standard | Time-ordered queries for audit trail |
| `{ "actor.id": 1, timestamp: -1 }` | Compound | Query audit trail by specific user |
| `{ action: 1, timestamp: -1 }` | Compound | Filter by action type (e.g., all privacy changes) |
| `{ "target.id": 1, "target.type": 1 }` | Compound | Query audit trail by resource |

### 4.4 Retention Policy

- Audit logs are append-only (never modified or deleted by application code)
- Production retention: minimum 90 days (configurable via `AUDIT_LOG_RETENTION_DAYS` env var)
- Cleanup: a scheduled job (cron or serverless function) deletes logs older than the retention period
- Temporary: for MVP, no automatic cleanup — manual purging via MongoDB admin interface

---

## 5. Search Visibility Enforcement

### 5.1 Answer to BA Question #1: DB Query Level vs Application Level

**Recommendation: Filter at the Database Query Level**

The search endpoint must filter at the MongoDB query level, not at the application level after retrieving results. This is already the implemented approach:

```typescript
// Correct approach (current implementation):
const horoscopes = await Horoscope.find({
    $or: [{ "owner.id": session.user.id }, { isPublic: true }],
}).lean();
```

**Rationale:**

| Concern | DB Query Level | Application Level |
|---------|---------------|-------------------|
| Performance | Only loads authorized documents into memory | Loads ALL documents, then filters — wastes memory and bandwidth |
| Security | Data never leaves the storage layer for unauthorized documents | Risk of accidentally exposing data in logs, error messages, or serialization |
| Pagination | Can paginate on filtered set directly | Must paginate on filtered set, but already loaded all documents — defeats pagination |
| Index utilization | Uses `{ "owner.id": 1, isPublic: 1 }` compound index | No index benefit — scans entire collection |
| Network | Minimal data transfer from DB to app server | Transfers all documents to app server first |

**Edge case:** When querying for "my own horoscopes" specifically (e.g., dashboard view), the query can skip the `isPublic` filter entirely:

```typescript
// Dashboard: user's own horoscopes (regardless of visibility)
Horoscope.find({ "owner.id": session.user.id });
```

### 5.2 Qdrant Vector Search Integration (Future)

When the Qdrant vector search pipeline is operational, the embedding lifecycle must respect privacy:

**Qdrant Point Payload:**

```json
{
    "horoscopeId": "550e8400-e29b-41d4-a716-446655440000",
    "ownerId": "660e8400-e29b-41d4-a716-446655440001",
    "isPublic": true,
    "embeddingText": "..."
}
```

**Qdrant Search Filter (for non-owner student searches):**

```typescript
// When searching as a non-owner student:
const results = await qdrantClient.search(COLLECTION_NAME, {
    vector: queryEmbedding,
    filter: {
        must: [
            {
                key: "isPublic",
                match: { value: true },
            },
        ],
    },
    limit: 100,
});
```

**Owner searches bypass the filter:**

```typescript
// Owner searches their own horoscopes — optionally filter by ownerId
// (If including own horoscopes in the same search, use $or equivalent in Qdrant)
const results = await qdrantClient.search(COLLECTION_NAME, {
    vector: queryEmbedding,
    filter: {
        should: [
            {
                key: "ownerId",
                match: { value: session.user.id },
            },
            {
                key: "isPublic",
                match: { value: true },
            },
        ],
    },
    limit: 100,
});
```

---

## 6. Search Embedding Lifecycle

### 6.1 Current State (MongoDB-Only Search)

Currently, search operates entirely via MongoDB `$or` queries. No Qdrant embeddings exist. Privacy enforcement at the query level (as described in Section 5.1) provides correct filtering. The privacy toggle endpoint does NOT need to trigger any embedding operations until the Qdrant pipeline is built.

### 6.2 Future State (With Qdrant Vector Search)

When Qdrant is operational, the embedding lifecycle on privacy change is:

**Privacy Change: Private → Public (`isPublic: false → true`)**

```
PATCH /privacy { isPublic: true }
    │
    ├── Update horoscope.isPublic = true in MongoDB (sync)
    ├── Write audit log (sync)
    ├── Return 200 to client (immediate)
    │
    └── Queue async job: EMBEDDING_SYNC (fire-and-forget)
        │
        ├── Check if Qdrant point exists for this horoscopeId
        │   ├── Yes → Update point payload: { isPublic: true }
        │   └── No  → Generate embedding text from calculatedDetails
        │           → Generate vector via Transformers.js
        │           → Upsert to Qdrant with { isPublic: true }
        └── Log success/failure
```

**Privacy Change: Public → Private (`isPublic: true → false`)**

```
PATCH /privacy { isPublic: false }
    │
    ├── Update horoscope.isPublic = false in MongoDB (sync)
    ├── Write audit log (sync)
    ├── Return 200 to client (immediate)
    │
    └── Queue async job: EMBEDDING_SYNC (fire-and-forget)
        │
        ├── Update Qdrant point: { isPublic: false }
        │    (Do NOT delete — owner still needs search access)
        └── Log success/failure
```

**Key Design Decisions for Embedding Lifecycle:**

| Decision | Rationale |
|----------|-----------|
| **Async, not sync** | Privacy toggle should be instant (~50ms DB write). Embedding generation (Transformers.js) takes 100–500ms and should not block the response. |
| **Update isPublic on point, don't delete** | Deleting the point would require regenerating it when the horoscope is made public again. Updating the `isPublic` flag on the existing point preserves the embedding data without redundant computation. The Qdrant search filter handles access control. |
| **Owner always finds own horoscopes** | Because owner searches include `ownerId` in the Qdrant filter's `should` clause (not `isPublic`), the owner can always find their horoscopes in vector search even when `isPublic=false`. |
| **No automatic re-embedding** | When `displayName` changes, the embedding text does not change (the embedding is based on astrological data, not the name). No re-generation needed. |

### 6.3 Job Queue Implementation

The async embedding job queue can be implemented using one of these approaches (in order of preference):

| Approach | Pros | Cons | Recommendation |
|----------|------|------|---------------|
| **BullMQ** (Redis-backed) | Reliable, retry, delayed jobs, observability | Requires Redis infrastructure | **Preferred** — Redis is likely already in the stack for other purposes |
| **In-process microtask** | Zero infrastructure, simple | Lost on server restart, no retry | Acceptable for MVP |
| **DB-backed queue** | Durable, no Redis dependency | More code, polling overhead | Fallback if Redis not available |

**Recommended approach for MVP:** In-process microtask (fire-and-forget Promise) for simplicity, with BullMQ as the production target when infrastructure is available.

```typescript
// In-process approach (MVP):
async function handlePrivacyChange(horoscopeId: string, oldIsPublic: boolean, newIsPublic: boolean) {
    if (oldIsPublic === newIsPublic) return;

    // Fire async job — don't await
    syncEmbeddingForPrivacyChange(horoscopeId, newIsPublic).catch((err) => {
        logger.error("embedding sync failed for horoscope %s: %s", horoscopeId, err.message);
    });
}
```

---

## 7. Database Changes

### 7.1 New Collection: auditLogs

See Section 4.1 for full schema.

### 7.2 New Indexes

| Collection | Index | Type | Purpose |
|------------|-------|------|---------|
| horoscopes | `{ "owner.id": 1, isPublic: 1, displayName: 1 }` | Compound | Efficient query for search (filter by owner + visibility + name visibility) |
| auditLogs | `{ timestamp: -1 }` | Standard | Time-ordered audit trail queries |
| auditLogs | `{ "actor.id": 1, timestamp: -1 }` | Compound | Audit trail per user |
| auditLogs | `{ action: 1, timestamp: -1 }` | Compound | Filter by action type |
| auditLogs | `{ "target.id": 1, "target.type": 1 }` | Compound | Audit trail per resource |

### 7.3 Existing Indexes (No Change Needed)

The existing `{ isPublic: 1 }` and `{ "owner.id": 1 }` indexes on horoscopes already support the current search query:

```javascript
// Current query uses:
// - { "owner.id": session.user.id } → uses { "owner.id": 1 } index
// - { isPublic: true } → uses { isPublic: 1 } index
// MongoDB can use index intersection for the $or query
```

### 7.4 Mongoose Model Changes

**Horoscope model** — No schema changes needed; `isPublic` and `displayName` already exist with correct defaults.

**New AuditLog model** — Add `src/models/AuditLog.ts`:

```typescript
import mongoose, { Model, Schema } from "mongoose";

export interface IAuditLog {
    id: string;
    action: string;
    actor: { id: string };
    target: { id: string; type: string };
    details?: Record<string, any>;
    timestamp: Date;
    ip?: string;
    userAgent?: string;
}

const AuditLogSchema = new Schema<IAuditLog>({
    id: { type: String, required: true, unique: true },
    action: { type: String, required: true, enum: [
        "privacy_change",
        "admin_view_private",
        "admin_view_list_private",
        "share_link_created",
        "share_link_revoked",
        "horoscope_deleted",
    ]},
    actor: { id: { type: String, required: true } },
    target: {
        id: { type: String, required: true },
        type: { type: String, enum: ["horoscope", "user"], required: true },
    },
    details: { type: Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now },
    ip: { type: String },
    userAgent: { type: String },
});

AuditLogSchema.index({ timestamp: -1 });
AuditLogSchema.index({ "actor.id": 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });
AuditLogSchema.index({ "target.id": 1, "target.type": 1 });

export const AuditLog: Model<IAuditLog> =
    mongoose.models.AuditLog || mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
```

---

## 8. Component Architecture

### 8.1 Frontend Components

**PrivacyToggle** (new component, used in horoscope creation form and detail page):

```
Props:
- isPublic: boolean
- displayName: boolean
- onChange: (settings: { isPublic?: boolean; displayName?: boolean }) => void
- disabled: boolean (optional, for loading state)

States:
1. Default: Two toggle switches:
   ┌──────────────────────────────┐
   │  Privacy                      │
   │  ┌─────┐                      │
   │  │ OFF │  Private             │
   │  └─────┘                      │
   │                               │
   │  ┌─────┐  (only visible       │
   │  │ ON  │   when Public)       │
   │  └─────┘  Show name on        │
   │           public horoscope    │
   └──────────────────────────────┘

2. Toggle Public ON:
   ┌──────────────────────────────┐
   │  Privacy                      │
   │  ┌─────┐                      │
   │  │ ON  │  Public              │
   │  └─────┘                      │
   │                               │
   │  ┌─────┐                      │
   │  │ ON  │  Show person's name  │
   │  └─────┘  on public horoscope │
   └──────────────────────────────┘

3. Error: Same as default but with error message
4. Loading: Disabled state with spinner during save

Behavior:
- displayName toggle is CONDITIONALLY RENDERED — only when isPublic is true
- When isPublic toggles OFF while displayName is visible, displayName toggle disappears
  (preserving its value in state/DB for when public is re-enabled)
- Changes are saved immediately via PATCH /api/horoscope/:id/privacy
- Debounce save (300ms) to avoid multiple rapid-fire API calls
```

**HoroscopeForm** (updated):

- Add `isPublic` toggle switch at the bottom of the form (default: Private)
- Add `displayName` toggle conditionally when `isPublic` is toggled ON
- Pre-populate from existing values on edit

**HoroscopeDetailPage** (updated):

- Add privacy settings section within the detail view
- Show current status badges: "Public" / "Private" / "Name Hidden"
- PrivacyToggle component in the settings area
- Owner-only visibility (other students see a read-only privacy badge if they have access)

**SearchResultCard** (updated):

- Check `displayName` before showing `name` field
- Show anonymous placeholder if `displayName=false` and viewer is not the owner
- Show privacy badge ("Public") on public horoscopes

**AdminHoroscopeList** (updated):

- Always show actual names (bypass `displayName`)
- Show privacy status badges for all horoscopes
- Include audit log access (fire logging)

### 8.2 Backend Module Updates

**Privacy Module** (`src/lib/privacy.ts`) — new file, exported functions:

| Function | Input | Output | Description |
|----------|-------|--------|-------------|
| `updatePrivacy(horoscopeId, userId, data)` | horoscopeId, userId, `{ isPublic?, displayName? }` | Updated horoscope or error | Updates privacy fields, writes audit log, triggers embedding sync |
| `getAnonymousPlaceholder(horoscopeId)` | horoscopeId (string) | string | Returns stable anonymous placeholder string |
| `anonymizeIfNeeded(horoscope, viewerId)` | horoscope doc, viewerId | Modified horoscope doc with potentially anonymized name | Applies displayName rules for viewing |

---

## 9. Error Handling

| Error Type | HTTP Code | Response Shape | Trigger |
|------------|-----------|----------------|---------|
| Missing auth | 401 | `{ "error": "Unauthorized" }` | No valid session token |
| Not found | 404 | `{ "error": "Not found" }` | Invalid horoscope ID |
| Forbidden (not owner) | 403 | `{ "error": "Forbidden" }` | Non-owner attempting PATCH /privacy |
| Forbidden (private) | 403 | `{ "error": "Forbidden" }` | Non-owner accessing private horoscope detail |
| Validation | 400 | `{ "error": "Validation failed", "fields": { "isPublic": "Must be boolean" } }` | Invalid field types |
| Server error | 500 | `{ "error": "Internal server error" }` | Unexpected failure |

### 9.1 Logging Guidelines

Use the shared `logger` (pino) following existing conventions:

- `logger.info("privacy changed: horoscope %s isPublic %s->%s by user %s", id, old, new, userId)` — on privacy toggle
- `logger.warn("privacy access denied: horoscope %s by user %s", id, userId)` — on 403
- `logger.info("admin viewed private horoscope: %s by admin %s", horoscopeId, adminId)` — on admin access
- `logger.error("embedding sync failed for horoscope %s: %s", id, err.message)` — on async embedding failure
- `logger.debug("audit log written: %s for horoscope %s", action, horoscopeId)` — on audit log write

---

## 10. Testing Strategy

### 10.1 Unit Tests

| Test | Description |
|------|-------------|
| `updatePrivacy` — toggle isPublic | Verify field updated, audit log written |
| `updatePrivacy` — toggle displayName | Verify field updated independently |
| `updatePrivacy` — non-owner forbidden | Verify 403 returned |
| `getAnonymousPlaceholder` — consistency | Same ID returns same placeholder |
| `getAnonymousPlaceholder` — uniqueness | Different IDs return different placeholders |
| `anonymizeIfNeeded` — owner sees name | Owner always sees actual name |
| `anonymizeIfNeeded` — other sees placeholder | Non-owner sees placeholder when displayName=false |
| `anonymizeIfNeeded` — displayName=true | Non-owner sees actual name when displayName=true |

### 10.2 Integration Tests

| Test | Description |
|------|-------------|
| `PATCH /api/horoscope/:id/privacy` — update both fields | Both fields saved, audit log created |
| `PATCH /api/horoscope/:id/privacy` — update only isPublic | displayName unchanged |
| `PATCH /api/horoscope/:id/privacy` — non-owner | 403 returned |
| `POST /api/search` — private horoscope not returned | Other student cannot find private horoscope |
| `POST /api/search` — displayName=false | Anonymous placeholder returned |
| `POST /api/search` — owner finds own private | Owner can find own private horoscope in search |
| `GET /api/horoscope/:id` — private, non-owner | 404 (not found, not 403 — prevents existence probing) |
| `GET /api/horoscope/:id` — public, displayName=false | Name anonymized |
| `GET /api/share/:token` — private horoscope | Full horoscope with actual name returned |
| `GET /api/admin/horoscope` — includes private | Private horoscopes returned with actual name, audit log written |

### 10.3 Edge Cases

| Edge Case | Expected Behavior |
|-----------|-------------------|
| Rapid privacy toggling (10x in 1 second) | Each toggle writes to DB independently; audit log captures each transition. Search results may cache briefly; eventual consistency is acceptable. |
| displayName=false while isPublic=false | Setting saved but has no visible effect until isPublic becomes true; no embedding regeneration needed. |
| Horoscope created private → shared via share link → made public | Share link still works throughout; after making public, horoscope becomes searchable by other students. |
| Super Admin views private horoscope list | Each private horoscope in the list view should generate ONE audit log entry (not per-horoscope) to avoid log spam. Use `admin_view_list_private` action with a count instead. |
| Horoscope deleted with privacy settings | Cascade delete removes horoscope, calculatedDetails, charts, metadata, share links, and audit log entries should be written with `horoscope_deleted` action before deletion. |
| Concurrent privacy edits (same horoscope, two tabs) | Last write wins (standard MongoDB behavior). No locking needed — privacy is a simple boolean toggle. |
| Anonymous placeholder length | Must not exceed the name field's display width in search cards (recommend max 35 chars). |

---

## 11. Security Considerations

### 11.1 Access Control Matrix

| Endpoint | Student (Own) | Student (Other) | Super Admin | Share Token |
|----------|--------------|-----------------|-------------|-------------|
| `PATCH /privacy` | ✅ (owner only) | ❌ 403 | ❌ (read-only) | ❌ |
| `GET /horoscope/:id` | ✅ (full) | ✅ (if public, anonymized if !displayName) | ✅ (full) | ✅ (full) |
| `POST /search` | ✅ (own, all) | ✅ (only public) | ✅ (all) | N/A |
| `GET /share/:token` | N/A | N/A | N/A | ✅ (full) |
| `GET /admin/horoscope` | ❌ | ❌ | ✅ (full, logged) | ❌ |

### 11.2 Privacy by Design

- **Query-level filtering**: Private horoscopes never leave the database layer for unauthorized users
- **Audit trail**: Every privacy-sensitive operation is logged
- **Minimal data exposure**: Search results only expose name when explicitly allowed; anonymous placeholder reveals no PII
- **Share link isolation**: Share links are the only mechanism by which a non-owner non-admin can see a private horoscope, and they require a unique cryptographic token
- **No existence probing**: `GET /api/horoscope/:id` returns 404 (not 403) for private horoscopes when accessed by a non-owner — this prevents attackers from probing whether a given UUID is a valid horoscope
- **displayName limited scope**: Only affects surface display — does not affect API responses for owners/admins; does not affect share link responses; does not affect metadata, chart images, or PDF exports

### 11.3 Embedding Security

- Qdrant points for private horoscopes retain their payload data but have `isPublic: false` — vector search queries filter them out for non-owner searches
- Owner searches include `ownerId` in the filter's `should` clause, allowing the owner to find their private horoscopes via vector search
- Embedding generation uses only astrological data (planetary positions, houses, strengths) — never the person's name, birth date, or location name
- Embedding text content is derived from calculatedDetails only, minimizing PII in the vector search index

### 11.4 Rate Limiting

| Endpoint | Rate Limit | Rationale |
|----------|------------|-----------|
| `PATCH /api/horoscope/:id/privacy` | 30 req/min/user | Prevent rapid automated toggling (though audit log makes this detectable) |
| `POST /api/search` | 60 req/min/user | Existing rate limit maintained |

---

## 12. Key Design Decisions

### 1. Query-Level Privacy Filtering (DB Level, Not Application Level)

The search endpoint filters horoscopes at the MongoDB query level using `$or: [{ "owner.id": session.user.id }, { isPublic: true }]`. This ensures private horoscopes are never loaded into application memory for unauthorized users. See Section 5.1 for full rationale.

### 2. Async Embedding Lifecycle

Privacy toggles are instant (~50ms DB write + audit log). Embedding sync (generate/update Qdrant points) is deferred to an async job. The 200–500ms Transformers.js embedding computation does not block the toggle response. See Section 6.2 for sequence.

### 3. Qdrant Point Update Instead of Delete

When a horoscope goes private, the Qdrant point's `isPublic` payload is updated to `false` rather than deleting the point. This avoids redundant embedding regeneration when the horoscope is later made public again. The Qdrant search filter handles access control.

### 4. displayName Is the Name Field, Not a Separate Anonymous Entity

Rather than creating a separate "anonymous name" field, the system overwrites the `name` field at serialization time for non-owner, non-admin viewers when `displayName=false`. This keeps the data model simple and ensures the actual name is always stored in one canonical place. The anonymous placeholder is generated on-the-fly from the horoscope UUID, is deterministic, and requires no additional storage.

### 5. 404 for Private Horoscope Detail (Not 403)

Returning 404 instead of 403 for unauthorized single-horoscope access prevents UUID probing. An attacker cannot distinguish between "this UUID doesn't exist" and "this UUID exists but is private." This is a standard security practice for resource identifiers.

### 6. Share Links Survive Public → Private Transition

Share links represent intentional sharing — the owner generated the link while the horoscope was public and presumably shared it with specific recipients. Revoking share links on public→private transition would break those shared links, which is worse than allowing continued access. If the owner wants to prevent share link access, they can revoke individual share links. This behavior matches common patterns (Google Drive, Notion, etc.).

### 7. Audit Logging Is Synchronous for Writes, Fire-and-Forget for Reads

Privacy changes (`PATCH /privacy`) write audit logs synchronously in the same request — this ensures the audit trail is never lost. Super Admin views of private horoscopes use fire-and-forget logging (non-blocking) because the main request should not be delayed by a secondary log write. If the log write fails, the admin still sees the data — the failure is logged via pino.

---

## 13. Questions for Other Roles

### For BA
1. When a Super Admin modifies a horoscope (as part of an approved support action), should this also be audited with a specific action type?

### For UX
1. What is the exact format for the anonymous placeholder? The suggested format is "Anonymous Horoscope #A3F2" — please confirm or provide alternative.
2. Where should the privacy toggle be placed in the UI? Options: horoscope creation form, horoscope detail page settings section, or a dedicated settings page?
3. Should there be a visual indicator (badge/banner) on the horoscope detail page showing the current privacy status?

### For QA
1. Confirm test scenario: A private horoscope is shared via share link. The recipient sees the name and full data. Is this the intended behavior? (Per business rules, yes — share links imply intentional sharing.)
2. Should rapid toggling (e.g., 10 public/private switches in 1 second) be debounced client-side, or is the 30 req/min rate limit sufficient?

### For Developer
1. The existing `PATCH /api/horoscope/[id]/privacy/route.ts` checks owner but does NOT check for Super Admin attempting to modify privacy. Should Super Admin be explicitly forbidden (403) or silently ignored?
2. The async embedding queue is currently unimplemented (the CLAUDE.md note says Transformers.js/Qdrant integration is not yet built). Should the privacy route swallow the embedding sync step until the queue infra is ready, or should it throw an error if the embedding module is unavailable?

### For PM
1. Is the `displayName` default of `true` (showing name) the correct choice? It means new horoscopes default to showing the name if made public — which could be a privacy concern for unaware users.
2. Should the `auditLogs` collection retention period be configurable? Suggested default: 90 days.
