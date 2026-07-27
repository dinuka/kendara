# Development Implementation — US-006: Horoscope Privacy Settings

**Date:** 2026-07-27

## Files Created

| File | Description |
|------|-------------|
| `src/lib/privacy.ts` | Privacy utility module: `getAnonymousPlaceholder(horoscopeId)` returns "Anonymous Horoscope #<last-4-chars-uppercased>"; `anonymizeIfNeeded(horoscope, viewerId, viewerRole)` returns anonymized copy when viewer is non-owner, not super-admin, and displayName is false. |
| `src/models/AuditLog.ts` | Mongoose model: id (UUID), action (enum: privacy_change, admin_view_private, admin_view_list_private, share_link_created, share_link_revoked, horoscope_deleted), actor.id, target.id/type, details (Mixed), timestamp, ip, userAgent. Indexes on timestamp, actor.id+timestamp, action+timestamp, target.id+target.type. |
| `src/__tests__/privacy.test.ts` | 30 test cases across 6 describe blocks: `getAnonymousPlaceholder` (5), `anonymizeIfNeeded` (6), PATCH privacy endpoint (8), GET horoscope endpoint (7), Search anonymization (4). |

## Files Modified

| File | Description |
|------|-------------|
| `src/app/api/horoscope/[id]/privacy/route.ts` | Added Super Admin 403 check (read-only), audit logging on successful privacy change with field/oldValue/newValue details, IP and user-agent capture. |
| `src/app/api/horoscope/[id]/route.ts` | Changed non-owner private horoscope response from 403 to 404 (prevents UUID probing). Added `getAnonymousPlaceholder` for non-owner viewers when displayName=false. Super Admin always sees actual name. |
| `src/app/api/search/route.ts` | Added `getAnonymousPlaceholder` in results mapping: non-owner viewers with displayName=false see anonymized name. |
| `src/messages/en.json` | Added `horoscope.privacy` (title, labels, descriptions, display name), `badge` (private, public, name_hidden), `anonymous.label`, `toast.privacy` (now_private, now_public, name_hidden, name_shown), `error.privacy` (save_failed, not_owner). |
| `src/messages/si.json` | Same keys translated to Sinhala. |

## Key Design Decisions

1. **404 vs 403 for private horoscope detail**: Changed to 404 (as specified by BA) to prevent attackers from probing valid UUIDs through error code differentiation.
2. **Super Admin read-only on privacy**: PATCH returns 403 if session user role is "super-admin". Super Admin still sees all horoscopes via GET.
3. **Anonymization is non-destructive**: `anonymizeIfNeeded` returns a new object (spread + name override) — does not mutate the original.
4. **Fire-and-forget audit**: Audit log writes happen synchronously after save (not awaited separately in a fire-and-forget pattern since the spec says "sync for writes").
5. **Placeholder ID source**: Uses the horoscope's own `_id` (ObjectId hex string), taking the last 4 characters uppercased. Consistent per horoscope across all viewers.
6. **Share links unaffected**: The share link route (`src/app/api/share/[token]/route.ts`) returns full horoscope data including actual name — no changes needed per BA spec.

## Skipped per Instructions

- Qdrant/Transformers.js embedding sync (not yet implemented in codebase)
- Audit logging in admin route (`src/app/api/admin/horoscope/[id]/route.ts`)

## Test Results

```
Test Suites: 7 passed, 7 total
Tests:       100 passed, 100 total  (30 new privacy tests + 70 existing)
```

Privacy test coverage:
- `getAnonymousPlaceholder`: format, consistency, uniqueness, short IDs, uppercase
- `anonymizeIfNeeded`: owner bypass, super admin bypass, displayName=true pass-through, displayName=false anonymization, non-mutation, owner-override
- PATCH route: 401, 403 super admin, 404 not found, 403 non-owner, isPublic update, displayName update, partial update with audit details
- GET route: 401, 404 not found, owner sees name, 404 for private non-owner, anonymized public+displayName=false, actual name when displayName=true, super admin bypass
- Search: 401, 400 empty query, anonymized for non-owner+displayName=false, actual name for owner, actual name for non-owner+displayName=true
