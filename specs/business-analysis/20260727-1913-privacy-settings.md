# User Stories — Privacy Settings

## Parent Story

### US-006: Horoscope Privacy Settings

- **Title**: Student marks horoscope as public or private
- **Description**: As a student, I want to mark my horoscope as public or private and choose whether to show the name so that I can control visibility.
- **Priority**: Medium
- **Actor**: Student
- **Dependencies**: US-002 (Add Horoscope), US-007/US-008 (Search)

## Sub-Stories

---

### US-006-1: Default Privacy on Horoscope Creation

- **Title**: New horoscopes default to private
- **Description**: As a student, I want newly created horoscopes to default to private so that I can review details before deciding to share.
- **Acceptance Criteria**:
  - When creating a horoscope via US-002, the `isPublic` flag defaults to `false`
  - The privacy toggle is visible on the creation form with "Private" pre-selected
  - The student can optionally set the horoscope to "Public" during creation
  - The `displayName` field defaults to `true` (show name) when creating
- **Business Rules**:
  - Privacy field is NOT a required field for form submission — it always has a default value
  - displayName is only relevant when isPublic is true; it is ignored for private horoscopes
  - A private horoscope with displayName=false is valid but displayName has no effect until isPublic becomes true
- **Priority**: Medium
- **Actor**: Student

---

### US-006-2: Toggle Horoscope Visibility

- **Title**: Student changes privacy setting on an existing horoscope
- **Description**: As a student, I want to change my horoscope's visibility between public and private at any time so that I can adjust who can see it.
- **Acceptance Criteria**:
  - Privacy toggle is available on the horoscope detail/settings page
  - Student can switch from Private → Public and Public → Private
  - Change takes effect immediately after save/confirm
  - No confirmation dialog required (single-action toggle)
  - Toggle persists across sessions and refreshes
- **Edge Cases**:
  - **Public → Private**: Horoscope immediately disappears from other students' search results. Existing share links for this horoscope are NOT invalidated — they still work for accessing the horoscope via direct link.
  - **Private → Public**: Horoscope becomes visible in search results for all students. If `displayName` is `false`, the horoscope appears in search but the name is hidden.
  - **Rapid toggling**: Rapid consecutive privacy changes are allowed (no cooldown). Each change takes effect independently.
- **Business Rules**:
  - Super Admin can always see the horoscope regardless of `isPublic` (see US-013, actors.md)
  - Changing from Public → Private does NOT automatically delete search embeddings; search indexing is handled separately (see US-006-4)
  - Changing from Private → Public does NOT retroactively show the horoscope in searches performed while it was private
- **Priority**: Medium
- **Actor**: Student

---

### US-006-3: Show/Hide Name on Public Horoscopes

- **Title**: Student controls whether their name is shown on public horoscopes
- **Description**: As a student, I want to show or hide the person's name on public horoscopes so that I can share astrological data anonymously.
- **Acceptance Criteria**:
  - Toggle/switch for `displayName` is visible when `isPublic` is true
  - When `displayName` is `false`, the name field is replaced with a generic label (e.g., "Anonymous Horoscope #1234" or similar placeholder) in:
    - Search result cards
    - Public horoscope detail view
    - Share link view
    - Any aggregated/public listing
  - The actual name is always visible to the owner and Super Admin
  - The toggle can be changed independently of the `isPublic` toggle
  - Changes take effect immediately
- **Edge Cases**:
  - **displayName toggled while isPublic is false**: The setting is saved but has no visible effect until the horoscope is made public
  - **displayName false + isPublic true → toggle isPublic false**: The displayName preference is preserved. If later toggled back to public, the name remains hidden until explicitly shown.
  - **displayName false + Metadata**: Metadata added by other students on a public horoscope with hidden name is not affected — metadata may still indirectly identify the person. This is an accepted limitation (not a bug).
  - **displayName false + Share Link**: The share link still accesses the full horoscope (owner intended recipient). The name is visible to anyone with the share link since the link is shared intentionally.
- **Business Rules**:
  - `displayName` applies to all public-facing surfaces except share links (share links imply intentional sharing)
  - `displayName` does NOT affect the horoscope owner's own view — the owner always sees the name
  - `displayName` does NOT affect Super Admin's view — Super Admin always sees the name (per US-013)
  - The generic label for anonymous horoscopes should not reveal any identifiable information
- **Priority**: Medium
- **Actor**: Student

---

### US-006-4: Public Horoscope Visibility in Search Results

- **Title**: Public horoscopes appear in other students' search results
- **Description**: As a student, I want public horoscopes from other students to appear in my search results so that I can discover and study a wider range of horoscopes.
- **Acceptance Criteria**:
  - Search results include:
    - All of the student's own horoscopes (regardless of `isPublic`)
    - All public horoscopes from other students (where `isPublic` is true)
  - Private horoscopes from other students are never returned in search results
  - When `displayName` is `false` on a public horoscope, the name field is replaced with the anonymous placeholder in search result cards
  - Search filters (astrological conditions) work identically on both owned and public horoscopes
- **Edge Cases**:
  - **Own horoscope is private**: It still appears in the owner's own search results but NOT in other students' results
  - **Public horoscope hidden name**: Search filtering still works on all astrological fields. Only the name display is affected, not the searchability.
  - **Horoscope made private while search results are displayed**: If the student has an active search results view and another student changes a horoscope from public to private, the cached result may briefly show the horoscope until the next search refresh. This is acceptable (eventual consistency).
- **Business Rules**:
  - Search indexing MUST respect the `isPublic` flag. When indexing/search embeddings are generated, only public horoscopes should have searchable embeddings visible to other students.
  - When a horoscope changes from public to private, its search embeddings should be removed from the shared search index (or marked as inaccessible to non-owners) within a reasonable time window.
  - When a horoscope changes from private to public, its search embeddings should be generated (if not already present) and made available in the shared search index.
- **Priority**: Medium
- **Actor**: Student

---

### US-006-5: Super Admin Access to Private Horoscopes

- **Title**: Super Admin can view any horoscope regardless of privacy
- **Description**: As a super admin, I want to access all horoscopes (public and private) so that I can manage the platform and assist students.
- **Acceptance Criteria**:
  - Super Admin can view any horoscope regardless of its `isPublic` value
  - Super Admin always sees the actual name regardless of `displayName`
  - Super Admin sees private horoscopes in admin search results
  - Super Admin can delete public horoscopes per US-013
- **Business Rules**:
  - Super Admin's ability to view private horoscopes does NOT grant them the ability to change the `isPublic` or `displayName` fields (unless it's part of an approved support action)
  - All Super Admin views of private horoscopes are logged for audit trail
- **Priority**: Medium
- **Actor**: Super Admin

---

### US-006-6: Privacy Setting Persistence

- **Title**: Privacy settings persist across sessions and updates
- **Description**: As a student, I want my privacy settings to remain in effect across sessions and horoscope updates so that I don't have to reconfigure them.
- **Acceptance Criteria**:
  - `isPublic` and `displayName` values persist in the database
  - Values survive page refreshes, session changes, and browser restarts
  - Values survive horoscope detail recalculations (if applicable)
  - Values do not change when other horoscope fields are updated
- **Edge Cases**:
  - If the system is restored from a backup, privacy settings are restored with it
  - Deleting a horoscope removes all privacy settings with it (cascade delete)
- **Priority**: Medium
- **Actor**: Student

---

## Cross-Reference Impact Matrix

| Feature | Impact of isPublic=false | Impact of isPublic=true |
|---------|------------------------|------------------------|
| Search (own view) | Visible | Visible |
| Search (other students) | Hidden | Visible |
| Share Link | Works (intentional) | Works |
| Super Admin | Visible | Visible |
| Metadata (by owner) | Allowed | Allowed |
| Metadata (by others) | Not applicable (private) | Allowed on public |
| Download | Allowed (owner only) | Allowed (any viewer) |
| displayName=false effect | No effect (already private) | Name hidden in public surfaces |

## Questions for Other Roles

### For UX/Design
1. Where should the privacy toggle live in the UI? On the horoscope creation form, the horoscope detail page, a settings page, or all of the above?
2. What should the anonymous placeholder label look like for horoscopes with hidden names? (e.g., "Anonymous Horoscope #1234", "Hidden Name", random ID?)
3. Should there be a visual indicator on the horoscope card/detail page showing the current privacy status?
4. For the Public → Private transition, should there be a brief info message/notification about what changed (e.g., "Your horoscope is now private. It has been removed from search results.")?

### For QA
1. Test scenario: Rapid toggling between public and private. What is the expected behavior for search indexing? Should there be a debounce/rate limit?
2. Test scenario: A horoscope with `displayName=false` is shared via share link. The recipient sees the name — is this the intended behavior per the business rules? Need confirmation.
3. Test scenario: Multiple students have metadata on a public horoscope with a hidden name. Should the metadata creator names still be visible?

### For Developer
1. Search embedding rebuild: When a horoscope changes from public → private, should the search embeddings be deleted immediately (synchronous) or queued for background processing?
2. Should the change from public → private invalidate any cached search results on the client side, or is eventual consistency acceptable?
3. The existing SearchEmbedding entity has no `isPublic` field — should we add one, or should the search layer check the Horoscope's `isPublic` at query time?

### For Architect
1. Should the search service filter public/private at the database query level or at the application level after retrieving results?
2. Is there a plan for an audit log table for tracking privacy changes and Super Admin access to private horoscopes?

### For PM
1. Is the anonymous placeholder for hidden names a priority for MVP, or can it be simplified to just showing "Anonymous" initially?
2. Should changing privacy settings trigger any notification to the horoscope owner (e.g., "Your horoscope XYZ is now public/shareable")?
