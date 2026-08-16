# Data Model

## Entities

### User

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| googleId | String | Google SSO ID |
| email | String | Email address |
| name | String | Display name |
| role | Enum(student, super-admin) | System role |
| preferredLanguage | Enum(si, en) | UI language (si=Sinhala, en=English) |
| planetaryOrbs | JSON | DEPRECATED — legacy per-user Planetary Orbs setting (`Record<string, number>` keyed by numeric Planet enum string, e.g., `"1": 15`). No longer read for calculations; the system-wide `AstrologySettings.planetaryOrbs` is the source of truth (see [AstrologySettings](#astrologysettings)). Existing values are ignored |
| planetAspects | JSON | DEPRECATED — legacy per-user "Planets Aspects houses and degrees" (දෘෂ්ඨි) setting (see [PlanetAspects (System Setting)](#planetaspects-system-setting)). No longer read; existing values are ignored |
| rashiAspects | JSON | DEPRECATED — legacy per-user "Rashi Aspects" (රාශි දෘෂ්ඨි) setting (see [RashiAspects (System Setting)](#rashiaspects-system-setting)). No longer read; existing values are ignored |
| createdAt | DateTime | Account created |
| updatedAt | DateTime | Last updated |

**Notes:**
- **Migration (2026-08-12):** the three astrological calculation settings (`planetaryOrbs`, `planetAspects`, `rashiAspects`) moved from per-user to system-wide. The fields remain on the `User` document only as inert legacy data — calculations never read them. The system-wide `AstrologySettings` document is the single source of truth (see US-SAS-006). Removal of the legacy fields is a cleanup migration and is optional (they are simply ignored).

**Relationships**:

- User 1---* Horoscope (owner)
- User 1---* Metadata (creator)
- User 1---* Location (creator)
- User 1---1 AstrologySettings (last updated by, via `updatedBy` — optional)

### AstrologySettings

**System-wide (shared) astrological calculation settings** — a single source of truth for the whole system. Replaces the per-user `planetaryOrbs` / `planetAspects` / `rashiAspects` settings formerly stored on each `User`. View/update restricted to Super Admin; students view the values read-only. An update triggers a full recalculation of ALL horoscopes' `CalculatedDetails`.

| Field | Type | Description |
|-------|------|-------------|
| id | String | Fixed singleton key — this collection holds exactly one document (`id: "system"`) |
| planetaryOrbs | JSON | System-wide Planetary Orbs setting — `Record<string, number>` keyed by numeric Planet enum string (e.g., `"1": 15`); the orb tolerance used when calculating aspects. Defaults `{"1":15,"2":12,"3":8,"4":7,"5":9,"6":7,"7":9,"8":0,"9":0}` |
| planetAspects | JSON | System-wide "Planets Aspects houses and degrees" (දෘෂ්ඨි) setting — see [PlanetAspects (System Setting)](#planetaspects-system-setting) structure |
| rashiAspects | JSON | System-wide "Rashi Aspects" (රාශි දෘෂ්ඨි) setting — see [RashiAspects (System Setting)](#rashiaspects-system-setting) structure |
| updatedBy | Object | `{ id: UUID }` — reference to the User (super-admin) who last updated the settings |
| updatedAt | DateTime | When the settings were last updated |
| lastRecalculatedAt | DateTime | When the full recalculation of all `CalculatedDetails` last completed for the current settings |
| recalcStatus | JSON | Optional — status/progress/result of the latest (or in-flight) full recalculation run, see [RecalculationStatus](#recalculationstatus) structure |
| version | Integer | Optional — monotonically increasing revision counter bumped on every settings update; used for optimistic locking and to make the recalculation idempotent per settings snapshot |

**Business rules:**
- **Single-document collection**: exactly one system-wide `AstrologySettings` document exists (fixed `id`); it holds the shared values for the whole system
- **Seeded on first boot**: if the document is absent, it is created with the default values (see [Defaults](#astrologysettings-defaults)) — seeding is idempotent (US-SAS-007)
- **Super-admin-only writes**: only `role: "super-admin"` users may create/update the document; student or non-admin write attempts are rejected (403), unauthenticated attempts are rejected (401) (US-SAS-008)
- **All-or-nothing updates**: a settings update is fully validated before persist — a single invalid field rejects the whole payload with no partial save (US-SAS-002)
- **Update triggers full recalculation**: every successful update bumps `version`, sets `updatedBy`/`updatedAt`, and triggers a background job that recomputes ALL horoscopes' `CalculatedDetails` — both `source: "auto"` and `source: "manual"` (US-SAS-003)
- **Idempotent rerun**: rerunning the recalculation for the same `version` is a no-op; the job is resumable and reports progress plus per-run success/failure counts; a failing horoscope does not abort the run or corrupt other snapshots (US-SAS-004)
- **Read-only for students**: students read the shared values (read-only) — e.g. via `GET /api/settings` or the settings UI; they can never write them (US-SAS-005)
- **Source of truth**: fresh calculations (auto and manual) always use these system-wide values; legacy per-user copies on `User` are ignored (US-SAS-006)

<a name="astrologysettings-defaults"></a>
**Defaults** (seeded on a fresh system):

| Setting | Default |
|---------|---------|
| planetaryOrbs | `{"1":15,"2":12,"3":8,"4":7,"5":9,"6":7,"7":9,"8":0,"9":0}` |
| planetAspects | `{}` (empty map — every planet uses the per-planet default aspect houses/degrees, see [PlanetAspects (System Setting)](#planetaspects-system-setting)) |
| rashiAspects | `{ "enabled": false, "overrides": {} }` |

**Relationships**:

- AstrologySettings 1---1 User (last updated by, via `updatedBy`)

### Horoscope

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| owner | Object | `{ id: UUID }` — reference to User |
| name | String | Person's name |
| displayName | Boolean | Show/hide name in public |
| birthDate | Date | Date of birth |
| birthTime | Time | Time of birth |
| location | Object | `{ id: UUID }` — reference to Location (saved location selected by user) |
| locationName | String | Human-readable location name (display/cache from selected location) |
| latitude | Float | Latitude (auto-populated from saved location, user can override) |
| longitude | Float | Longitude (auto-populated from saved location, user can override) |
| gender | Enum(male, female, other) | Gender |
| ayanamsha | Enum(lahiri, raman, krishnamurti, yukteshwar) | Ayanamsha system (default: lahiri) |
| source | Enum(auto, manual) | How the chart data was produced: `auto` = calculated from birth details via ephemeris; `manual` = entered by the student from an already-calculated chart (no birth details required) |
| isPublic | Boolean | Visibility flag — `true` = visible to all students in search; `false` = visible only to owner and Super Admin (and via share link) |
| displayName | Boolean | Show/hide actual name on public-facing surfaces (search cards, public detail view) — only meaningful when `isPublic=true`; owner and Super Admin always see the name |
| createdAt | DateTime | Record created |
| updatedAt | DateTime | Last updated |

**Privacy rules**:
- **Owner**: Always sees the horoscope and the actual name, regardless of `isPublic` or `displayName`
- **Other students**: See the horoscope in search only if `isPublic=true`; see the name only if `isPublic=true AND displayName=true`
- **Share link recipients**: See full horoscope (including name) regardless of `isPublic`/`displayName` — share links imply intentional sharing
- **Super Admin**: Sees all horoscopes and actual names, regardless of privacy settings (see US-013)
- When `isPublic` changes from `true` → `false`, search embeddings must be removed from the shared search index (or filtered at query time)
- When `isPublic` changes from `false` → `true`, search embeddings must be generated and made available in the shared search index

**Relationships**:

- Horoscope *---1 User (owner)
- Horoscope *---1 Location
- Horoscope 1---1 CalculatedDetails
- Horoscope 1---* Metadata
- Horoscope 1---* ShareLink
- Horoscope 1---* Chart

### CalculatedDetails

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| horoscope | Object | `{ id: UUID }` — reference to Horoscope |
| ascendant | String | Ascendant sign with degree |
| houses | JSON | House details — see [Houses](#houses) structure |
| planets | JSON | Planet positions with strengths/aspects — see [Planets](#planets) structure |
| nakshatra | JSON | Lunar Mansion / Nakshatra and Pada — see [Nakshatra](#nakshatra) structure |
| dashas | JSON | Mahadasha, Antardasha, Vidasa, Sukshama, and optional Prana sub-periods — see [Dashas](#dashas) structure |
| lord22ndDrekkana | String | Lord of 22nd Drekkana |
| lord64thNavamsa | String | Lord of 64th Navamsa |
| badhakaPlanet | String | Badhaka planet |
| marakaPlanets | JSON | Maraka planets — see [MarakaPlanets](#marakaplanets) structure |
| atmakaraka | String | Atmakaraka planet |
| maranakaraka | JSON | Maranakaraka planets (`number[]`, numeric Planet enums) — each planet occupying its designated death house (lagna chart only, never D9); legacy docs stored a single `0`/`n` and are normalized at read time |
| yogas | JSON | Yoga formations — see [Yogas](#yogas) structure |
| doshas | JSON | Dosha calculations — see [Doshas](#doshas) structure |
| manualHousePlacements | JSON | Manual chart input for `source: "manual"` horoscopes — see [ManualHousePlacements](#manualhouseplacements) structure |
| derivedRanges | JSON | Derived probable birth ranges for manual horoscopes — see [DerivedRanges](#derivedranges) structure |
| shadbalaya | JSON | Shad Bala (ෂඩ් බලය) — the six strengths per planet (Sthana, Cheshta, Kala, Dig, Drishti, Naisargika) with tooltip reasons and user overrides — see [ShadBalaya](#shadbalaya) structure |
| lagnaBhavaSuchika | Integer (1-12) | Lagna's භාව සුචික (Bhava Suchika) — the house (1-12) that the Navamsa (D9) lagna sign (the sign of the 1st house of the Navamsa chart) occupies in the Lagna (D1) chart. Absent on manual horoscopes without entered Navamsa data |
| bhavaSuchika | JSON | Per-planet භාව සුචික (Bhava Suchika) — `Record<string, number>` keyed by numeric Planet enum string (`"1"`…`"9"`), each value the house (1-12) that the planet's Navamsa sign occupies in the Lagna chart — see [Bhava Suchika (House Index)](#bhava-suchika-house-index) structure |
| wargaKendara | JSON | Per-chart Warga Kendara (වර්ග කේනදර) data — for each available divisional chart (phase 1: `d1`, `d9`, `suryaLagna`, `chandraLagna`) the chart's houses/planets and per-chart planet details (D1-only flags for D1; Maraka/Maranakaraka/Dig Bala for every chart) — see [WargaKendara](#wargakendara) structure |
| createdAt | DateTime | Record created |

**Notes:**
- `manualHousePlacements` and `derivedRanges` are only present on horoscopes with `source: "manual"` (no ephemeris calculation)
- For `source: "auto"` horoscopes, these fields are absent; for `source: "manual"` horoscopes, ephemeris-derived fields (dashas, vargas) may be absent
- `shadbalaya` is stored for **both** `source: "auto"` and `source: "manual"` horoscopes. For manual horoscopes the balas the system cannot derive are left unset until the student sets them manually (Drishti bala always; Cheshta Uttarayana/planet-war states and Kala varga loads on manual charts) — see [ShadBalaya](#shadbalaya)
- Both aspect mechanisms (Planet Aspects houses + degrees, and Rashi Aspects when enabled) are computed for **both** `source: "auto"` and `source: "manual"` horoscopes; the manual chart feeds the same pure aspect functions via each planet's stored or fallback-derived degree (see [ManualHousePlacements](#manualhouseplacements))
- The bulk recalculation job (triggered by an `AstrologySettings` update) overwrites the computed fields of every stored snapshot using the current system-wide settings. For `source: "auto"` horoscopes it re-runs `calculateHoroscope` from the stored birth details; for `source: "manual"` horoscopes it recomputes from the stored `manualHousePlacements` — which is the single source of truth for the manual chart and is **never overwritten** by the job (US-SAS-009). The same job recomputes `shadbalaya`, but a bala flagged `overridden: true` (a user's manual checkbox toggle) is **never overwritten** — the user's value is preserved exactly as `manualHousePlacements` is never overwritten (US-SB-013)
- `lagnaBhavaSuchika` and `bhavaSuchika` are stored for **both** `source: "auto"` and `source: "manual"` horoscopes (manual only when Navamsa data has been entered — `navamsaLagna` / `navamsaHouses`). The AstrologySettings recalculation job recomputes them like any other derived value — there are **no user overrides** for Bhava Suchika (see `20260814-2055-bhava-suchika.md`). Legacy documents missing the fields fall back to a render-time derivation from the always-stored `ascendant`, `houses` and per-planet navamsa sign (or entered Navamsa data), mirroring the `computeAscendantSpecialFlags` fallback pattern
- `wargaKendara` is stored for **both** `source: "auto"` and `source: "manual"` horoscopes (manual limited to the chart data derivable from the entered placements — see `20260815-1129-warga-kendara.md`). The AstrologySettings recalculation job recomputes it like any other derived value — there are **no user overrides**. Legacy documents missing the field fall back to a render-time pure-function derivation from the stored D1 data plus the derived D9 / Surya Lagna / Chandra Lagna charts

**Relationships**:

- CalculatedDetails *---1 Horoscope

### Chart

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| horoscope | Object | `{ id: UUID }` — reference to Horoscope |
| type | Enum(birth, house, navamsa-d9, drekkana-d3, dasamsa-d10, shodasha-vargas, chandra-lagna, surya-lagna) | Chart type |
| data | JSON | Chart data (planet positions, houses, etc.) |
| imageUrl | String | Rendered chart image URL (optional) |
| createdAt | DateTime | Record created |

**Relationships**:

- Chart *---1 Horoscope

**Notes:**
- The `type` enum currently covers the phase-1 Warga Kendara tabs — `birth` (D1 Rāśi), `navamsa-d9` (D9 Navāṁśa), `surya-lagna`, `chandra-lagna` — plus `house`, `drekkana-d3`, `dasamsa-d10`, `shodasha-vargas`. The remaining varga chart types (D2 Horā, D3 Drekkāṇa, D4 Chaturthāṁśa, D7 Saptāṁśa, D10 Daśāṁśa, D12 Dvādaśāṁśa, D16 Ṣoḍaśāṁśa, D20 Viṁśāṁśa, D24 Siddhāṁśa, D27 Bhāṁśa, D30 Triṁśāṁśa, D40 Khavedāṁśa, D45 Akṣavedāṁśa, D60 Ṣaṣṭiāṁśa) are added when those charts become calculable (later Warga Kendara phases — see `20260815-1129-warga-kendara.md`)

### Metadata

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| horoscope | Object | `{ id: UUID }` — reference to Horoscope |
| key | String | Label/tag name |
| value | String | Label/tag value |
| isPublic | Boolean | Visible to others |
| createdBy | Object | `{ id: UUID }` — reference to User |
| createdAt | DateTime | Record created |
| updatedAt | DateTime | Last updated |

**Relationships**:

- Metadata *---1 Horoscope
- Metadata *---1 User (creator)

### ShareLink

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| horoscope | Object | `{ id: UUID }` — reference to Horoscope |
| token | String | Unique share token |
| expiresAt | DateTime | Expiration time |
| createdAt | DateTime | Record created |

**Relationships**:

- ShareLink *---1 Horoscope

### SavedFilter

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| user | Object | `{ id: UUID }` — reference to User |
| name | String | User-defined label for the saved search (e.g., "Career study: Jupiter in 10th") |
| query | String | Search query text |
| filterConfig | JSON | Configured visible sections — see [FilterConfig (SavedFilter)](#filterconfig-savedfilter) structure |
| lastRunAt | DateTime | Timestamp of the last time this saved filter was executed |
| resultCount | Integer | Number of results returned on last run (for display in list) |
| createdAt | DateTime | Record created |
| updatedAt | DateTime | Last updated |

**Relationships**:

- SavedFilter *---1 User

### SearchHistory

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| user | Object | `{ id: UUID }` — reference to User |
| query | String | Original search query text entered by the user |
| parsedConditions | JSON | Structured conditions extracted from the query by the RAG pipeline (debugging & analytics) |
| resultCount | Integer | Number of results returned |
| language | Enum(si, en) | Detected language of the query |
| source | Enum(manual, saved-filter, bookmark) | How the search was initiated |
| savedFilter | Object | `{ id: UUID }` — reference to SavedFilter if the search originated from a saved filter (optional) |
| createdAt | DateTime | Record created |

**Business rules**:
- Search history is kept per-user for the most recent N entries (configurable, default 50)
- Duplicate consecutive queries (same query text within 5 minutes) should NOT create a new history entry — update the timestamp of the existing entry instead
- Users can clear their own search history
- Search history is NEVER visible to other users
- `parsedConditions` is for debugging/analytics only — not displayed to the user

**Relationships**:

- SearchHistory *---1 User
- SearchHistory *---1 SavedFilter (optional)

### SearchBookmark

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| user | Object | `{ id: UUID }` — reference to User |
| horoscope | Object | `{ id: UUID }` — reference to Horoscope |
| queryContext | String | The search query that led to this bookmark (optional, for context) |
| notes | String | User's personal note about why this bookmark was saved (optional) |
| createdAt | DateTime | Record created |

**Business rules**:
- A user can bookmark a horoscope only once (unique constraint on `user` + `horoscope`)
- Bookmarking a horoscope does NOT grant any additional access — the same privacy rules apply when viewing
- If the bookmarked horoscope is deleted, the bookmark is cascade-deleted
- Bookmarks are visible only to the user who created them

**Relationships**:

- SearchBookmark *---1 User
- SearchBookmark *---1 Horoscope

### Location

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| name | String | Place name (e.g., "Colombo, Sri Lanka") |
| latitude | Float | Latitude coordinate |
| longitude | Float | Longitude coordinate |
| isPublic | Boolean | Visibility flag — public locations visible to all, private only to creator |
| createdBy | Object | `{ id: UUID }` — reference to User (creator) |
| createdAt | DateTime | Record created |
| updatedAt | DateTime | Last updated |

**Relationships**:

- Location *---1 User (creator)
- Location 1---* Horoscope

### SearchEmbedding

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| horoscope | Object | `{ id: UUID }` — reference to Horoscope |
| embedding | Vector | Vector embedding for RAG search (dimensions depend on model, typically 384 or 768) |
| textContent | Text | Full text content for search (the text from which the embedding was generated) |
| language | Enum(si, en) | Language of the textContent (single embedding per language per horoscope) |
| chunkIndex | Integer | Index of this chunk when a horoscope's text content is split into multiple chunks (0-based) |
| embeddingModel | String | Identifier of the embedding model used (e.g., `"Xenova/all-MiniLM-L6-v2"`) |
| isActive | Boolean | Soft-deactivation flag — `false` when horoscope is made private without deleting the row; embedding is excluded from search queries |
| createdAt | DateTime | Record created |
| updatedAt | DateTime | Last updated |

**Privacy note**: Search queries MUST filter out embeddings for private horoscopes (`isPublic=false`) when serving results to non-owners. This can be done either by:
1. Setting `isActive=false` on the embedding when privacy changes (async, queued)
2. Joining with the Horoscope collection at query time to check `isPublic` on every search (slower but always consistent)

The recommended approach is a hybrid: set `isActive=false` immediately (synchronous) on privacy toggle for consistency, then clean up inactive embeddings via a background job.

**Relationships**:

- SearchEmbedding *---1 Horoscope

## Enums

All enums use numeric values for easy i18n. Display names are mapped separately per language.

### Planet

| Value | English | Sinhala |
|-------|---------|---------|
| 1 | Sun | රවි |
| 2 | Moon | සඳු |
| 3 | Mars | කුජ |
| 4 | Mercury | බුධ |
| 5 | Jupiter | ගුරු |
| 6 | Venus | සිකුරු |
| 7 | Saturn | ශනි |
| 8 | Rahu | රාහු |
| 9 | Ketu | කේතු |

### Zodiac Sign

| Value | English | Sinhala |
|-------|---------|---------|
| 1 | Aries | මේෂ |
| 2 | Taurus | වෘෂභ |
| 3 | Gemini | මිථුන |
| 4 | Cancer | කටක |
| 5 | Leo | සිංහ |
| 6 | Virgo | කන්යා |
| 7 | Libra | තුලා |
| 8 | Scorpio | වෘශ්චික |
| 9 | Sagittarius | ධනු |
| 10 | Capricorn | මකර |
| 11 | Aquarius | කුම්භ |
| 12 | Pisces | මීන |

### Rashi Category

Every Zodiac Sign belongs to exactly one fixed category. Used by the Rashi Aspects (රාශි දෘෂ්ඨි) setting to determine which rashis a sign aspects (see [RashiAspects (System Setting)](#rashiaspects-system-setting)). The setting itself is system-wide (see [AstrologySettings](#astrologysettings)); the category mapping is identical for every calculation.

| Category | Signs (ZodiacSign enum) | Sinhala |
|----------|-------------------------|---------|
| Chara (movable) | 1, 4, 7, 10 | මේෂ, කටක, තුලා, මකර |
| Thira (fixed) | 2, 5, 8, 11 | වෘෂභ, සිංහ, වෘශ්චික, කුම්භ |
| Ubaya (dual) | 3, 6, 9, 12 | මිථුන, කන්‍යා, ධනු, මීන |

**Rashi-aspect rule summary:** Chara rashis aspect other Thira rashis except the nearest (adjacent) one; Thira rashis aspect other Chara rashis except the nearest (adjacent) one; Ubaya rashis aspect other Ubaya rashis excluding the nearest (tie-break rule in the RashiAspects structure). The full authoritative 12-row lookup is in [Rashi Aspects Rules](#rashi-aspect-rules).

### Nakshatra

| Value | English | Sinhala |
|-------|---------|---------|
| 1 | Ashwini | අශ්විනි |
| 2 | Bharani | භරණී |
| 3 | Krittika | කෘත්තිකා |
| 4 | Rohini | රෝහිණී |
| 5 | Mrigashira | මෘගශීර්ෂ |
| 6 | Ardra | ආර්ද්රා |
| 7 | Punarvasu | පුනර්වසු |
| 8 | Pushya | පුෂ්ය |
| 9 | Ashlesha | ආශ්ලේෂා |
| 10 | Magha | මාඝ |
| 11 | Purva Phalguni | පූර්ව ඵල්ගුනී |
| 12 | Uttara Phalguni | උත්තර ඵල්ගුනී |
| 13 | Hasta | හස්ත |
| 14 | Chitra | චිත්රා |
| 15 | Swati | ස්වාති |
| 16 | Vishakha | විශාඛා |
| 17 | Anuradha | අනුරාධා |
| 18 | Jyeshtha | ජ්‍යෙෂ්ඨා |
| 19 | Mula | මූල |
| 20 | Purva Ashadha | පූර්ව ආෂාඪ |
| 21 | Uttara Ashadha | උත්තර ආෂාඪ |
| 22 | Shravana | ශ්‍රවණ |
| 23 | Dhanishta | ධනිෂ්ඨා |
| 24 | Shatabhisha | ශතභිෂා |
| 25 | Purva Bhadrapada | පූර්ව භාද්‍රපද |
| 26 | Uttara Bhadrapada | උත්තර භාද්‍රපද |
| 27 | Revati | රේවතී |

### Planetary Strength

| Value | Name | Description |
|-------|------|-------------|
| 1.25  | Athi Uchcha | අති උච්ච |
| 1 | Uchcha (Exaltation) | උච්ච |
| -1 | Neecha (Debilitation) | නීච |
| -1.25  | Athi Neecha (Debilitation) | අති නීච |
| 0.75 | මූලත්‍රිකෝණ ‍| මූල ත්‍රිකෝණ |
| 0.5 | Own Sign ‍| ස්වක්ෂේත්‍ර |
| 0.1 | Mitra (Friend) | මිත්‍ර |
| -0.1 | Shatru (Enemy) | සතුරු |
| 0 | Sama (Neutral) | සම |

### Aspect Type

| Value | Name |
|-------|------|
| 0 | Conjunction |
| 30 | Semisextile |
| 60 | Sextile |
| 90 | Square |
| 120 | Trine |
| 150 | Quincunx |
| 180 | Opposition |
| 210 | Sesquiquadrate (Quincunx, 6 signs) |
| 240 | Trine (8 signs) |
| 270 | Square (9 signs) |
| 300 | Sextile (10 signs) |
| 330 | Semisextile (11 signs) |

**Notes:**
- `0` remains reserved for Conjunction (co-location), which is not part of the configurable aspects setting
- The aspects setting (see [PlanetAspects (System Setting)](#planetaspects-system-setting)) allows any multiple of 30 from 30 to 330 as a configurable aspect degree per planet — `aspectType` / `exactAspectDegree` on a planet's aspects can therefore be any of these values (including non-classical angles such as 210, 240, 270, 300, 330)
- Display names for the non-classical angles are descriptive placeholders; the numeric degree value is the source of truth for calculation

## JSON Structures

### Houses

```json
[
  {
    "houseNumber": 1,
    "startDegree": 0.0,
    "middleDegree": 15.5,
    "endDegree": 30.0,
    "sign": 1,
    "lord": 3
  },
  {
    "houseNumber": 2,
    "startDegree": 30.0,
    "middleDegree": 45.0,
    "endDegree": 60.0,
    "sign": 2,
    "lord": 6
  }
]
```

### Planets

```json
[
  {
    "name": 1,
    "sign": 1,
    "degree": 12.5,
    "house": 1,
    "nakshatra": 1,
    "pada": 2,
    "retrograde": false,
    "combustion": false,
    "strength": 1,
    "absoluteDegree": 12.5,
    "aspects": [
      {
        "planetName": 4,
        "aspectType": 60,
        "planetAbsoluteDegree": 75.0,
        "degreeGap": 2.5,
        "exactAspectDegree": 60.0,
        "isBeneficial": true
      },
      {
        "planetName": 7,
        "aspectType": 180,
        "planetAbsoluteDegree": 192.5,
        "degreeGap": 0.0,
        "exactAspectDegree": 180.0,
        "isBeneficial": false
      }
    ]
  },
  {
    "name": 2,
    "sign": 4,
    "degree": 5.0,
    "house": 4,
    "nakshatra": 8,
    "pada": 1,
    "retrograde": false,
    "combustion": false,
    "strength": 0,
    "absoluteDegree": 95.0,
    "aspects": []
  }
]
```

**Note:** `degreeGap` = longitudinal distance between two planets minus the nearest major aspect angle (Conjunction 0°, Sextile 60°, Square 90°, Trine 120°, Opposition 180°). Maximum valid `degreeGap` is < 30° — beyond this, the aspect is not considered effective. In the example above, Sun (12.5°) to Mercury (75.0°) has a raw distance of 62.5°, and the nearest major aspect is Sextile (60°), so `degreeGap` = 2.5°.

**Note (aspects setting):** The candidate aspect angles considered for each planet are NOT fixed — they come from the system-wide [PlanetAspects (System Setting)](#planetaspects-system-setting) `degrees` list for that planet (any multiple of 30 in 30–330, e.g. 60/180/240). The orb tolerance that decides whether an aspect is effective uses the system-wide `planetaryOrbs` value for the aspecting planet (see [AstrologySettings](#astrologysettings)). `aspectType` / `exactAspectDegree` reflect the configured degree value.

**Note (navamsa enrichment):** the stored `planets` entries additionally carry `navamsaSign` and `navamsaStrength` (numeric ZodiacSign / PlanetaryStrength enums) — present on auto horoscopes and on manual horoscopes once the student enters Navamsa data. These feed the භාව සුචික (Bhava Suchika) computation (see [Bhava Suchika (House Index)](#bhava-suchika-house-index)).

<a name="planetaspects-user-setting"></a><a name="planetaspects-system-setting"></a>
### PlanetAspects (System Setting)

System-wide (shared) aspects setting "Planets Aspects houses and degrees" (ප්ලැනට් ඇස්පෙක්ට්ස් හවුස් ඇන්ඩ් ඩිග්රීස්). Stored on the single system-wide `AstrologySettings` document as the `planetAspects` field, following the `planetaryOrbs` Record convention keyed by numeric Planet enum string (see [AstrologySettings](#astrologysettings)). It defines, for each planet, which houses it aspects and which aspect degree angles are used in house/planet aspect calculation. The values are shared by the whole system (managed by Super Admin) and apply to every calculation — **this section was previously documented as a per-user setting; it is now system-wide** (2026-08-12, US-SAS-001/002/005). The section heading was renamed from "PlanetAspects (User Setting)" — the old `#planetaspects-user-setting` anchor is kept working via the anchor tags above.

```json
{
    "1": { "houses": [3, 5, 7, 9, 10], "degrees": [60, 90, 120, 180] },
    "3": { "houses": [4, 5, 7, 8, 9], "degrees": [60, 90, 120, 180] },
    "7": { "houses": [3, 5, 7, 9, 10], "degrees": [60, 180, 240] }
}
```

**Field meanings (per planet entry):**

| Field | Type | Description |
|-------|------|-------------|
| houses | JSON | Array of integers 1-12 — the houses this planet aspects. Non-empty; each value unique; ascending order |
| degrees | JSON | Array of aspect degree values — multiples of 30 from 30 to 330 (30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330). Non-empty; each value unique; ascending order |

**Notes:**
- Keyed by numeric Planet enum string (`"1"`…`"9"`), same convention as `planetaryOrbs`; a planet absent from the map uses the system defaults (see defaults below)
- `planetName` is implied by the record key — it is not stored redundantly; the form selects the planet by English/Sinhala name mapped to the numeric Planet enum

**Defaults:** when a planet has no entry, the system uses the default aspect houses per planet (see table below) and default aspect degrees `[60, 90, 120, 180]` (unchanged). For an unconfigured planet the default houses are applied as **offsets from the planet's whole-sign house**, and the default degrees additionally drive degree-based house-aspect matching (a planet aspects a house when an aspect point derived from its degrees falls within the planet's orb of the house's absolute middle degree) — the aspected-houses set is the **union** of both arms (see US-PA-005 / architect D4). This union applies to **both** `source: "auto"` and `source: "manual"` horoscopes; on manual charts the degree arm uses each planet's stored or fallback-derived degree (see [ManualHousePlacements](#manualhouseplacements)) against the house's whole-sign sign midpoint `(sign−1)*30+15` as the house-middle reference. Default aspect houses:

| Planet enum | Planet | Name (SI) | Default aspect houses |
|-------------|--------|-----------|------------------------|
| 1 | SUN | ඉර | 3, 5, 7, 9, 10 |
| 2 | MOON | සඳු | 3, 5, 7, 9, 10 |
| 3 | MARS | කුජ | 4, 5, 7, 8, 9 |
| 4 | MERCURY | බුද | 4, 5, 7, 8, 9 |
| 5 | JUPITER | ගුරු | 5, 7, 9 |
| 6 | VENUS | සිකුරු | 5, 7, 9 |
| 7 | SATURN | ශනි | 3, 5, 7, 9, 10 |
| 8 | RAHU | රාහු | 5, 7, 9 |
| 9 | KETU | කේතු | 5, 7, 9 |

These defaults replace the previously documented table (Mars 4/8/12, Jupiter 5/9/11, Saturn 3/7/10, Rahu/Kethu 5/9, all others 7th-house full aspect; Sun/Moon/Mercury/Venus under "others").

- **Calculation effect:** adding/updating a planet's `houses` or `degrees` changes that planet's house aspects and planet aspects. Because the setting is system-wide, any change triggers the full recalculation of ALL horoscopes' `CalculatedDetails` (both sources) — not just the next calculation (see [AstrologySettings](#astrologysettings) business rules, US-SAS-003)
- **Planetary Orbs:** the orb tolerance used when matching planets against the configured degree values is the system-wide `planetaryOrbs` per-planet value from the same `AstrologySettings` document (unchanged values, now shared; see [AstrologySettings](#astrologysettings))

**Validation rules:**

| Field | Allowed values | Rules |
|-------|----------------|-------|
| houses | 1-12 | Each value MUST be an integer in 1-12; duplicates rejected; at least one house required |
| degrees | 30-330 (step 30) | Each value MUST be a multiple of 30 within 30-330 (i.e. 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330); duplicates rejected; at least one degree required |

- Values outside the allowed set are rejected with a localized validation error (no partial save)
- An empty `houses` or `degrees` array is invalid — the planet's setting cannot be emptied to nothing

<a name="rashiaspects-user-setting"></a><a name="rashiaspects-system-setting"></a>
### RashiAspects (System Setting)

System-wide (shared) "Rashi Aspects" (රාශි දෘෂ්ඨි) setting. Stored on the single system-wide `AstrologySettings` document as the `rashiAspects` field, following the `planetAspects` JSON-map pattern (see [AstrologySettings](#astrologysettings)). The rashi-aspect **rules themselves are fixed system rules** — identical for every calculation; the setting only controls **whether** the rules are applied to house/planet aspect calculations, plus any per-sign opt-outs. See [Rashi Aspects Rules](#rashi-aspect-rules) for the authoritative 12-row lookup. The values are shared by the whole system (managed by Super Admin) — **this section was previously documented as a per-user setting; it is now system-wide** (2026-08-12, US-SAS-001/002/005). The section heading was renamed from "RashiAspects (User Setting)" — the old `#rashiaspects-user-setting` anchor is kept working via the anchor tags above.

```json
{
    "enabled": true,
    "overrides": {
        "1": { "enabled": false },
        "8": { "enabled": false }
    }
}
```

**Field meanings:**

| Field | Type | Description |
|-------|------|-------------|
| enabled | Boolean | Master switch — `true` applies the fixed rashi-aspect rules to house/planet aspect calculation; `false` (default) leaves aspect calculation unchanged (Planet Aspects setting only) |
| overrides | JSON | Optional Record keyed by numeric ZodiacSign enum string (`"1"`…`"12"`), each value `{ "enabled": false }` — disables rashi drishti for that specific **aspecting sign**. A sign absent from the map follows the global `enabled` state. Empty object `{}` = no overrides |

**Notes:**
- Default `rashiAspects` = `{ "enabled": false, "overrides": {} }` — aspect calculation is unchanged until a Super Admin enables Rashi Aspects system-wide (backward compatible with existing charts/snapshots)
- The rashi-aspect rules are **not stored** in `AstrologySettings` — they are fixed system rules; the setting only switches them on/off
- `overrides` is optional and phase-gated: v1 may ship the `enabled` toggle only; per-sign overrides are added only if the domain confirms a need (see Open Questions in the Rashi Aspects user stories)

<a name="rashi-aspect-rules-fixed-system-rules"></a>
#### Rashi Aspects Rules (fixed system rules, applied when `enabled = true`)

Each rashi belongs to exactly one category and aspects rashis of a specific target category, excluding its nearest rashi (see [Rashi Category](#rashi-category)):

| Aspecting sign | Category | Aspected signs (numeric ZodiacSign) | Excluded (nearest) |
|----------------|----------|--------------------------------------|--------------------|
| මේෂ Aries (1) | Chara | 5, 8, 11 | වෘෂභ Taurus (2) |
| කටක Cancer (4) | Chara | 2, 8, 11 | සිංහ Leo (5) |
| තුලා Libra (7) | Chara | 2, 5, 11 | වෘශ්චික Scorpio (8) |
| මකර Capricorn (10) | Chara | 2, 5, 8 | කුම්භ Aquarius (11) |
| වෘෂභ Taurus (2) | Thira | 4, 7, 10 | මේෂ Aries (1) |
| සිංහ Leo (5) | Thira | 1, 7, 10 | කටක Cancer (4) |
| වෘශ්චික Scorpio (8) | Thira | 1, 4, 10 | තුලා Libra (7) |
| කුම්භ Aquarius (11) | Thira | 1, 4, 7 | මකර Capricorn (10) |
| මිථුන Gemini (3) | Ubaya | 6, 9 | මීන Pisces (12) |
| කන්‍යා Virgo (6) | Ubaya | 3, 12 | ධනු Sagittarius (9) |
| ධනු Sagittarius (9) | Ubaya | 3, 6 | මීන Pisces (12) |
| මීන Pisces (12) | Ubaya | 3, 6 | ධනු Sagittarius (9) |

**Nearest-rashi exclusion (precise rule):**
- **Chara → Thira**: aspect every Thira sign EXCEPT the one adjacent to the aspecting sign (±1 in the zodiac). The two categories strictly alternate around the zodiac, so the excluded sign is the unique Thira sign at the minimum zodiacal arc distance (always the adjacent one). Example: මේෂ Aries (1) aspects සිංහ Leo (5), වෘශ්චික Scorpio (8), කුම්භ Aquarius (11) but NOT වෘෂභ Taurus (2).
- **Thira → Chara**: aspect every Chara sign EXCEPT the one adjacent to the aspecting sign. Example: වෘෂභ Taurus (2) aspects කටක Cancer (4), තුලා Libra (7), මකර Capricorn (10) but NOT මේෂ Aries (1).
- **Ubaya → Ubaya**: aspect the other Ubaya signs excluding the nearest. Because Ubaya signs are 3 apart, every Ubaya sign has a **two-way tie** for nearest (e.g. මිථුන Gemini (3) is 3 signs from both කන්‍යා Virgo (6) and මීන Pisces (12)); the tie is resolved by excluding the rashi with the **higher sign number** (the one closer to Pisces/12). So මිථුන Gemini aspects කන්‍යා Virgo (6) and ධනු Sagittarius (9) and excludes මීන Pisces (12) — matches `docs/rash_aspects.md`. The tie-break outcome for කන්‍යා/ධනු/මීන as aspecting signs is not pinned by the source doc — flagged as an open question for domain confirmation.

**Application to house and planet aspects (when `enabled = true`):**
- **Both chart sources (clarified 2026-08-11):** rashi drishti applies to `source: "auto"` AND `source: "manual"` horoscopes. On manual charts the whole-sign house/planet `sign` supplies the rashi candidate set exactly as on auto charts, and the degree + orb ("rashmi") check uses each planet's stored or fallback-derived degree (see [ManualHousePlacements](#manualhouseplacements)); the house-middle reference for the manual house-aspect check is the house's whole-sign sign midpoint `(sign−1)*30+15` (open question: whether bhava cusps should be used when a `lagnaDegree` is recorded)
- **House aspects:** a planet in sign S aspects every house whose whole-sign `sign` is in S's aspected-signs set (the houses of the aspected rashis)
- **Planet aspects:** a planet in sign S aspects every other planet whose `sign` is in S's aspected-signs set
- **Degree + orb still apply** (as in other aspect calculations): the aspect is effective only when the aspected body/house-middle degree is within the aspecting planet's orb ("rashmi") — the system-wide `planetaryOrbs` value for the aspecting planet (see [AstrologySettings](#astrologysettings)) — of the relevant aspect point derived from the aspecting planet's degree; the degree gap (`+dd:mm:ss`) is reported in the reason line
- Rashi-aspect reasons **combine with** (union) the Planet-Aspects-setting reasons for the same aspected house/planet; each distinct reason is retained and rendered on its own line

**Two-line aspect-reason output (multiple reasons per aspect):**

An aspect (house or planet) may have more than one reason. Each reason renders as its own tooltip line. Example from `docs/rash_aspects.md`:

```
ග්‍රහ දෘෂ්ඨි 7 (180) (+02:05:00)
රාශි දෘෂ්ඨි මේෂ රාශිය මිථුනය දකී (+02:05:00)
```

- Line 1 — planetary drishti reason (existing single-line format; `ග්‍රහ දෘෂ්ඨි` / `Planet drishti`)
- Line 2+ — rashi drishti reason(s): `රාශි දෘෂ්ඨි {aspectingSign} රාශිය {aspectedSign} දකී ({delta})` ("Rashi drishti: {aspectingSign} rashi looks at {aspectedSign}"); the source doc also shows the shorter form `රාශි දෘෂ්ඨි {sign} ({delta})` — see Open Questions for which template applies
- Reason lines are composed in the UI from numeric fields + i18n keys, never stored as text
- To distinguish reasons, the aspect output should carry a per-entry reason/source marker (e.g. `"planetary" | "rashi"` or a `reasons[]` list) — exact shape to be decided in the Architecture phase (see Open Questions)

### ManualHousePlacements

Stored on a manually-entered horoscope (`source: "manual"`). This is the **single source of truth** for the manual chart — the planets table and all derived values are recomputed from it, never stored independently.

```json
{
  "lagna": 1,
  "lagnaDegree": 5.0,
  "planetDegrees": {
    "1": 12.5,
    "4": 20.25
  },
  "houses": [
    {
      "houseNumber": 1,
      "sign": 1,
      "planets": [1, 4],
      "aspects": []
    },
    {
      "houseNumber": 2,
      "sign": 2,
      "planets": [],
      "aspects": [5]
    }
  ],
  "navamsaHouses": [
    {
      "houseNumber": 1,
      "sign": 6,
      "planets": [1]
    }
  ],
  "validation": {
    "budha": { "status": "valid", "message": "Mercury in Sun's house or ±1" },
    "sikuru": { "status": "invalid", "message": "Venus must be in Sun's house or ±2" },
    "rahuKethuAxis": { "status": "incomplete", "message": "Kethu not placed" }
  }
}
```

**Notes:**
- `houses` always has exactly 12 entries (house 1–12), one per house
- `sign` uses the numeric ZodiacSign enum; `planets` uses the numeric Planet enum
- `planets` may be empty (no planet placed); a planet appears exactly once across all houses
- `aspects` (per-house) lists which planets aspect this house. For manual charts the aspected-houses set is the **union of both arms**, exactly as on auto charts (see [PlanetAspects (System Setting)](#planetaspects-system-setting)): the explicit `houses` arm (configured list as **absolute** house numbers, or the default aspect-house rules per planet — SUN/MOON/SATURN 3,5,7,9,10; MARS/MERCURY 4,5,7,8,9; JUPITER/VENUS/RAHU/KETU 5,7,9 — applied as offsets from the planet's own house) **plus** the degree arm (each planet's degree vs. the aspected house's whole-sign sign midpoint `(sign−1)*30+15` within the planet's orb). When the system-wide Rashi Aspects setting is enabled, houses whose whole-sign `sign` is in the planet's rashi-aspect set are aspected too (see [RashiAspects (System Setting)](#rashiaspects-system-setting))
- `lagnaDegree` (optional) — ascendant degree within the birth sign (0 ≤ d < 30); drives the bhava-cusp/degree estimates on the manual chart
- `planetDegrees` (optional) — per-planet degree **within the planet's birth sign** (0 ≤ d < 30), keyed by numeric Planet enum string (`"1"`…`"9"`), following the embedded-Record convention of the (now system-wide) `planetaryOrbs`/`planetAspects` settings. Drives the degree-based arms of the aspect settings on manual charts (planet-to-planet aspects, the house-aspect degree arm, and the rashi-aspect degree+orb check)
- **Fallback degree for a planet with no `planetDegrees` entry:** derived deterministically, mirroring the existing degree-estimation pattern on manual charts (navamsa segment midpoint when the planet's navamsa sign is recorded, else the sign midpoint `15°`). Entered degrees always take precedence; the derived fallback keeps the aspect functions pure and deterministic
- `navamsaHouses` is optional; present only when the student enters Navamsa placements directly (no separate Navamsa Lagna field — house signs derived whole-sign from the placements)
- `validation` is advisory (non-blocking) and persisted for display on later visits

**Aspect application — both chart sources (clarified 2026-08-11):** both aspect mechanisms (Planet Aspects houses + degrees and Rashi Aspects) apply to **BOTH** `source: "manual"` and `source: "auto"` horoscopes. The manual chart feeds the same pure aspect functions as the auto chart, using each planet's stored or fallback-derived degree (`planetDegrees`). See `20260809-2133-planet-aspects.md` (US-PA-005 / US-PA-006) and `20260810-0800-rashi-aspects.md` (US-RA-004 / US-RA-005).

### DerivedRanges

Computed (and persisted) probable birth ranges derived from Ravi's and Shani's placements on a manual horoscope.

```json
{
  "birthTimeRange": {
    "start": "05:00",
    "end": "07:00"
  },
  "birthMonthRange": {
    "start": { "month": 4, "day": 15 },
    "end": { "month": 5, "day": 15 }
  },
  "birthDateCandidates": [
    { "navamsaIndex": 0, "candidateDay": 12, "reasoning": "12 + 0" },
    { "navamsaIndex": 0, "candidateDay": 21, "reasoning": "17 + 4" }
  ],
  "ageRanges": [
    { "ageIndex": 1, "valueMonths": 48, "label": "1st age" },
    { "ageIndex": 2, "valueYears": 78, "label": "2nd age" },
    { "ageIndex": 3, "valueYears": 108, "label": "3rd age" }
  ]
}
```

**Notes:**
- `birthTimeRange` maps from Ravi's house (1st → 05:00–07:00, 2nd → 07:00–09:00, ..., configurable table)
- `birthMonthRange` maps from Ravi's sign (Mesha → Apr 15–May 15, ..., configurable table)
- `birthDateCandidates` derive from Ravi's Navamsa index: base 12 + index×3 and base 17 + index×7 (configurable)
- `ageRanges` derive from Shani's birth Navamsa and current Shani degree: 1st age in months, 2nd/3rd ages add 30-year increments
- All values are advisory estimates, clearly labeled as probable ranges

### Nakshatra

```json
{
  "moonNakshatra": {
    "id": 8,
    "pada": 1,
    "lord": 7,
    "startDegree": 93.33,
    "endDegree": 106.66
  },
  "ascendantNakshatra": {
    "id": 1,
    "pada": 2,
    "lord": 9,
    "startDegree": 0.0,
    "endDegree": 13.33
  }
}
```

### Dashas

**Calculation note:** The first Mahadasha period uses the remaining portion of the Moon's Nakshatra (balance of dasha at birth). The starting planet and duration are determined by the Nakshatra lord and the degrees remaining in the Moon's Nakshatra at the time of birth.

```json
{
  "mahadasha": [
    {
      "planet": 1,
      "startDate": "1990-01-15",
      "endDate": "1996-01-15",
      "durationYears": 6,
      "remainingYearsAtBirth": 6.0,
      "antardasha": [
        {
          "planet": 2,
          "startDate": "1990-01-15",
          "endDate": "1990-10-10",
          "durationMonths": 9,
          "vidasa": [
            {
              "planet": 3,
              "startDate": "1990-01-15",
              "endDate": "1990-02-05",
              "durationDays": 21,
              "sukshama": [
                {
                  "planet": 4,
                  "startDate": "1990-01-15",
                  "endDate": "1990-01-18",
                  "durationDays": 3,
                  "prana": [
                    {
                      "planet": 5,
                      "startDate": "1990-01-15",
                      "endDate": "1990-01-16",
                      "durationHours": 12
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          "planet": 3,
          "startDate": "1990-10-10",
          "endDate": "1991-07-05",
          "durationMonths": 9,
          "vidasa": [
            {
              "planet": 4,
              "startDate": "1990-10-10",
              "endDate": "1990-11-01",
              "durationDays": 22,
              "sukshama": []
            }
          ]
        }
      ]
    }
  ],
  "currentPeriod": {
    "mahadashaLord": 5,
    "antardashaLord": 6,
    "vidasaLord": 2,
    "sukshamaLord": 8,
    "pranaLord": 4
  }
}
```

**Period hierarchy:**

| Level | Name | Contained Within | Typical Duration |
|-------|------|-----------------|-----------------|
| 1 | Mahadasha | Root | Years |
| 2 | Antardasha | Mahadasha | Months |
| 3 | Vidasa | Antardasha | Days–Weeks |
| 4 | Sukshama | Vidasa | Days |
| 5 | Prana (optional) | Sukshama | Hours |

**Date range rules:**
- Every period at every level must have both `startDate` and `endDate` in ISO date (or ISO datetime for Prana) format
- For a given parent period, the first child period's `startDate` equals the parent's `startDate`
- The last child period's `endDate` equals the parent's `endDate`
- Child periods within the same parent must be contiguous (no gaps, no overlaps)
- Prana periods use `durationHours`; all other levels use the coarsest unit that fits (years for Mahadasha, months for Antardasha, days for Vidasa/Sukshama)

**Empty arrays:** If a period has no sub-periods calculated, the corresponding array MUST be present as an empty array `[]` (not omitted).

### MarakaPlanets

```json
[7, 6, 3]
```

### Yogas

```json
[
  {
    "name": "Parivartana Yoga",
    "description": "Mutual exchange between 1st and 5th lords",
    "planetsInvolved": [1, 5],
    "housesInvolved": [1, 5],
    "isBeneficial": true
  },
  {
    "name": "Dharma-karmadhipati Yoga",
    "description": "Lord of 1st and 9th in mutual aspect",
    "planetsInvolved": [3, 5],
    "housesInvolved": [1, 9],
    "isBeneficial": true
  }
]
```

### ShadBalaya

ෂඩ් බලය (Shad Bala) — the six strengths of each planet: Sthana (ස්ථාන බල), Cheshta (චේෂ්ටා බලය), Kala (කාල බලය), Dig (දිග් බලය), Drishti (දෘෂ්ඨි බලය), Naisargika (නෛසර්ගික බලය). Stored on `CalculatedDetails` as the `shadbalaya` field, keyed by numeric Planet enum string (`"1"`…`"9"`) following the `planetaryOrbs`/`planetAspects` Record convention. Each planet entry holds one per-bala object carrying the effective `value` (Boolean), whether the student manually toggled it (`overridden`), and the `reasons` used to compose the checkbox tooltip. The අනුපාතය (ratio) column is **not stored** — it is derived at render time as `count of true values / 6`, displayed as `(n/6)`.

```json
{
  "1": {
    "sthanaBala": {
      "value": true,
      "overridden": false,
      "reasons": [{ "key": "shadbalaya.sthana.reason.uchcha" }]
    },
    "cheshtaBala": {
      "value": true,
      "overridden": false,
      "reasons": [{ "key": "shadbalaya.cheshta.reason.uttarayana" }]
    },
    "kalaBala": {
      "value": true,
      "overridden": false,
      "reasons": [{ "key": "shadbalaya.kala.reason.day" }]
    },
    "digBala": {
      "value": true,
      "overridden": false,
      "reasons": [{ "key": "shadbalaya.dig.reason.house", "params": { "house": 10 } }]
    },
    "drishtiBala": {
      "value": true,
      "overridden": true,
      "reasons": [{ "key": "shadbalaya.drishti.reason.manual" }]
    },
    "naisargikaBala": {
      "value": true,
      "overridden": false,
      "reasons": [{ "key": "shadbalaya.naisargika.reason.notMaranakaraka" }]
    }
  },
  "2": {
    "sthanaBala": {
      "value": false,
      "overridden": false,
      "reasons": [{ "key": "shadbalaya.sthana.reason.neecheShatru", "params": { "strength": -1, "sign": 10 } }]
    },
    "cheshtaBala": {
      "value": false,
      "overridden": false,
      "reasons": [{ "key": "shadbalaya.cheshta.reason.krushnaPaksha" }]
    },
    "naisargikaBala": {
      "value": false,
      "overridden": false,
      "reasons": [{ "key": "shadbalaya.naisargika.reason.maranakaraka", "params": { "house": 8 } }]
    }
  }
}
```

**Field meanings:**

| Field | Type | Description |
|-------|------|-------------|
| sthanaBala / cheshtaBala / kalaBala / digBala / drishtiBala / naisargikaBala | Object | Per-bala entry for one planet (each object has `value`, `overridden`, `reasons`) |
| value | Boolean | Effective bala state — `true` = checkbox checked (planet has the bala); `false` = unchecked. Reflects the user's value once `overridden` is set |
| overridden | Boolean | `true` when the student manually toggled `value`. The AstrologySettings recalculation job preserves this value and never recomputes it — mirroring `manualHousePlacements`, which is never overwritten (US-SB-013) |
| reasons | JSON | Array of reason objects used to compose the checkbox tooltip. A single bala may carry several reasons (e.g. Cheshta for both Vakra and a Shukla-paksha Chandra conjunction). Empty `[]` when the bala is not system-computed and has not been toggled (e.g. Drishti bala before the student sets it) |

**Reason object (`reasons[]` entries):**

| Field | Type | Description |
|-------|------|-------------|
| key | String | i18n message key (e.g. `shadbalaya.sthana.reason.uchcha`, `shadbalaya.kala.reason.shuklaChandra`) — resolved per locale (si/en) at render time, never stored as localized text |
| params | JSON | Optional map of numeric enum fields used as template parameters by the i18n message, e.g. `{ "planet": 3 }`, `{ "house": 10 }`, `{ "sign": 10 }`, `{ "strength": -1 }` |

**Notes:**
- All numeric fields follow existing enum conventions: planet = numeric `Planet` (1-9), house = 1-12, sign = numeric `ZodiacSign`, strength = numeric `PlanetaryStrength`
- **Sthana bala** (ස්ථාන බල): `true` unless the planet is in a Shatru (enemy) sign (strength `-0.1`); the Neecha-and-Shatru combination (strength `-1`/`-1.25` in an enemy sign) also removes the bala with the dedicated `neecheShatru` reason, while Neecha-but-not-Shatru stays `true` with the `debilitated` reason; Uchcha/Own-sign/Moolatrikona planets are `true` (reason e.g. "Uchcha")
- **Cheshta bala** (චේෂ්ටා බලය): `true` when any of — Ravi in Uttarayana (auto only); Ravi in Makara/Kumba/Meena/Mesha/Wrushaba (manual fallback); Moon in Shukla paksha; Kuja/Buda/Sikuru/Guru/Shani combined with a Shukla-paksha Chandra (Rahu/Ketu excluded); planet is Vakra — for Rahu/Ketu their natural retrograde is NOT vakra, only the opposite (direct) motion is; planet won a planet war (holds until 48h after the war; auto only)
- **Kala bala** (කාල බලය): `true` when any of — Chandra/Kuja/Shani for a night birth; Ravi/Guru/Sikuru for a day birth (Ravi's day condition is suppressed while Moon is in Shukla paksha — Ravi then has no Kala bala); Budha/Guru/Sikuru/Rahu when Moon is in Shukla paksha; Kuja/Shani/Rahu when Moon is in Krushna paksha (Ravi is not in the Krushna list — his only Kala source is a Krushna-paksha day birth); planets carrying Hora/Panchama/Sukshama varga loads (auto only — not calculable for manual horoscopes)
- **Dig bala** (දිග් බලය): `true` only when Guru/Budha is in 1st, Kuja/Ravi in 10th, Chandra/Shukra in 4th, or Shani in 7th house. Rahu (8) and Ketu (9) have no mapping — their `digBala` is always `false` with an empty `reasons` array (or omitted)
- **Drishti bala** (දෘෂ්ඨි බලය): never computed by the system — `value` stays `false` with the manual reason until the student toggles it, on both chart sources
- **Naisargika bala** (නෛසර්ගික බලය): `true` for every planet except a Maranakaraka planet — the planet occupying its designated death house (Chandra in 8th, Rahu in 9th, Shani in 1st, Ravi in 5th, Shukra in 6th, Kuja in 7th, Budha in 4th, Guru in 3rd; lagna/rasi chart only, never D9; multiple planets can qualify — `computeMaranakaraka` in `src/lib/astrology.ts`, rule documented in `docs/done/maranakaraka.md`). `CalculatedDetails.maranakaraka` is `number[]`.
- The house used for Dig/Sthana/Naisargika evaluation is the cusp-based calculated house on auto charts and the entered house on manual charts (the same house shown in the chart)
- On a full recalculation (AstrologySettings change), every bala with `overridden: false` is recomputed from the current chart data; every bala with `overridden: true` keeps the stored user value

<a name="bhava-suchika-house-index"></a>
### Bhava Suchika (House Index)

භාව සුචික නවාංශක ක්‍රමය — the "house index" of a point (the Lagna or a planet) computed from the Navamsa (D9) chart: take the point's Navamsa sign, then find which house that sign occupies in the Lagna (D1) chart; that house number (1-12) is the point's Bhava Suchika. Stored on `CalculatedDetails` as `lagnaBhavaSuchika` (single Integer 1-12 for the Lagna) plus `bhavaSuchika` (Record keyed by numeric Planet enum string `"1"`…`"9"`, following the `planetaryOrbs`/`shadbalaya` Record convention).

```json
{
  "lagnaBhavaSuchika": 7,
  "bhavaSuchika": {
    "1": 2,
    "2": 7,
    "3": 10,
    "4": 5,
    "5": 12,
    "6": 1,
    "7": 3,
    "8": 6,
    "9": 11
  }
}
```

**Calculation rule:**

- **Lagna**: `navamsaLagnaSign` = the sign of the 1st house of the Navamsa (D9) chart (auto: the D9 chart's ascendant sign; manual: the entered `navamsaLagna`). Then `lagnaBhavaSuchika` = the house of `navamsaLagnaSign` in the D1 chart.
- **Planets**: for each planet, `bhavaSuchika[planet]` = the house of the planet's Navamsa sign in the D1 chart (auto: the computed `planet.navamsaSign`; manual: the planet's navamsa sign derived from the entered Navamsa chart).
- **"House of sign S in the D1 chart"** = the house whose whole-sign `sign` equals S, equivalently `((S − lagnaSign) mod 12) + 1` (whole-sign counting from the Lagna). All 9 planets (including Rahu/Ketu) always have a value in 1-12 when computed.
- Values are stored as the numeric house index (1-12) only — the 12 display names (below) are resolved per locale via i18n at render time, never stored as localized text.

**Display names (per house-index value):**

| Value | Sinhala name | English name (proposed transliteration) |
|-------|--------------|------------------------------------------|
| 1 | ලග්නාංශකය | Lagnamshaka |
| 2 | ධනාංශකය | Dhanamshaka |
| 3 | වික්‍රමාංශකය | Vikramamshaka |
| 4 | සුඛාංශකය | Sukhamshaka |
| 5 | පූර්වපුන්‍යාංශකය | Purvapunyamshaka |
| 6 | ශෂ්ඨාංශකය | Shashthamshaka |
| 7 | සප්තමාංශකය | Saptamamshaka |
| 8 | නිධානාංශකය | Nidhanamshaka |
| 9 | භාග්‍යාංශකය | Bhagyamshaka |
| 10 | අභිමානාංශකය | Abhimanamshaka |
| 11 | ලාභාංශකය | Labhamshaka |
| 12 | ව්‍යාංශකය | Vyamshaka |

**Notes:**
- The Sinhala names are authoritative (from `docs/bhava-suchika.md`); the English column is a proposed transliteration pending domain confirmation (see Open Questions in `20260814-2055-bhava-suchika.md`).
- Present on both chart sources when the source data exists; **absent on manual horoscopes without entered Navamsa data** (no `navamsaLagna` / `navamsaHouses` → the Lagna value and the per-planet values are omitted, mirroring the existing navamsa enrichment behaviour of the planets table).
- Legacy documents missing the fields fall back to a render-time pure-function derivation from the always-stored `ascendant`, `houses` and per-planet navamsa sign (auto) or entered Navamsa data (manual) — the same fallback pattern as the ascendant Wargoththama/Gandamula flags.

<a name="wargakendara"></a>
### WargaKendara

වර්ග කේනදර (Warga Kendara) — per-chart data for the divisional (varga) charts shown in the horoscope detail page's chart section. Stored on `CalculatedDetails` as the `wargaKendara` field, keyed by warga chart key. Phase 1 covers `d1` (Rāśi), `d9` (Navāṁśa), `suryaLagna` (Surya Lagna) and `chandraLagna` (Chandra Lagna); later phases add `d2`…`d60` as per-chart calculation guidance is provided (see `20260815-1129-warga-kendara.md`).

Each chart entry holds the chart's whole-sign houses and per-planet rows (sign/strength/house per that chart, nakshatra+pada for D1 only) plus the per-chart planet-detail flags. **D1-only flags** (Wargoththama, Pushkara, Gandantha, Gandamula, 64th Navamsa Lord, 22nd Drekkana Lord, Cheshta Bala, Ashtamansha, Kala Bala, Atmakaraka, Combust, Badhaka) exist **only in the `d1` entry**; **Maraka, Maranakaraka and Dig Bala** are present in **every** chart entry.

```json
{
  "d1": {
    "lagnaSign": 1,
    "houses": [
      { "houseNumber": 1, "sign": 1, "planets": [7], "aspects": [5] },
      { "houseNumber": 2, "sign": 2, "planets": [], "aspects": [] }
    ],
    "planets": [
      {
        "name": 7,
        "sign": 10,
        "strength": 0.5,
        "house": 1,
        "nakshatra": 19,
        "pada": 3,
        "conjunctions": [6],
        "aspects": [{ "planetName": 5, "aspectType": 120 }]
      }
    ],
    "wargoththamaPlanets": [5],
    "pushkaraPlanets": [],
    "gandanthaPlanets": [],
    "gandamulaPlanets": [],
    "lord22ndDrekkana": 4,
    "lord64thNavamsa": 6,
    "cheshtaBalaPlanets": [1, 2, 5],
    "ashtamanshaPlanets": [],
    "kalaBalaPlanets": [1, 5],
    "atmakaraka": 5,
    "combustPlanets": [7],
    "badhakaPlanets": [7],
    "marakaPlanets": [7, 6, 3],
    "maranakaraka": [2],
    "digBalaPlanets": [5]
  },
  "d9": {
    "lagnaSign": 6,
    "houses": [
      { "houseNumber": 1, "sign": 6, "planets": [1], "aspects": [] },
      { "houseNumber": 2, "sign": 7, "planets": [], "aspects": [] }
    ],
    "planets": [
      {
        "name": 7,
        "sign": 4,
        "strength": -0.1,
        "house": 11,
        "conjunctions": [],
        "aspects": []
      }
    ],
    "marakaPlanets": [],
    "maranakaraka": [],
    "digBalaPlanets": [1]
  },
  "suryaLagna": {
    "lagnaSign": 1,
    "houses": [],
    "planets": [],
    "marakaPlanets": [],
    "maranakaraka": [],
    "digBalaPlanets": []
  },
  "chandraLagna": {
    "lagnaSign": 4,
    "houses": [],
    "planets": [],
    "marakaPlanets": [],
    "maranakaraka": [],
    "digBalaPlanets": []
  }
}
```

**Field meanings (per chart entry):**

| Field | Type | Description |
|-------|------|-------------|
| lagnaSign | Integer | Numeric `ZodiacSign` of the chart's lagna (whole-sign) |
| houses | JSON | The chart's 12 whole-sign houses: `houseNumber` (1-12), `sign` (numeric ZodiacSign), `planets` (numeric Planet enums placed in the house), `aspects` (numeric Planet enums aspecting the house — display without degree difference) |
| planets | JSON | The chart's per-planet rows: `name` (numeric Planet), `sign` (ZodiacSign per this chart), `strength` (numeric `PlanetaryStrength` per this chart), `house` (1-12 in this chart), `nakshatra`/`pada` (D1 entry only), `conjunctions` (numeric Planet enums), `aspects` (`{ planetName, aspectType }` numeric enums — no degree fields, the cells render without degree differences) |
| wargoththamaPlanets … badhakaPlanets | JSON | D1-only planet-detail flags, keyed as on the top-level `CalculatedDetails` (numeric Planet enum arrays / single planet / boolean) — present only in the `d1` entry |
| marakaPlanets / maranakaraka / digBalaPlanets | JSON | Per-chart planet details — present in **every** chart entry, computed relative to that chart's own lagna/houses (per-chart rule pending domain confirmation for Maraka/Maranakaraka — see Open Questions in `20260815-1129-warga-kendara.md`) |

**Notes:**
- **Numeric-enum conventions** apply throughout: planets = numeric `Planet` (1-9), signs = numeric `ZodiacSign`, strength = numeric `PlanetaryStrength`, houses = 1-12. Display names resolve per locale via i18n — no localized text is stored.
- **Only the `d1` entry carries `nakshatra`/`pada` and the D1-only flag arrays** — the feature doc is explicit that Nakshatra (Pada) and Bhava Suchika columns exist only on the D1 table, and the twelve D1-only details belong only to the D1 chart.
- **Bhava Suchika** is not duplicated here — the D1 table's Bhava Suchika column reads the existing top-level `lagnaBhavaSuchika`/`bhavaSuchika` fields.
- **Manual horoscopes**: `d1` derives from the entered `manualHousePlacements`; `d9` requires entered Navamsa data (else the tab shows the existing "no chart data" placeholder); `suryaLagna`/`chandraLagna` derive by rotating the entered chart to the Sun/Moon lagna. `manualHousePlacements` remains the single source of truth — never overwritten.
- **Legacy documents** missing `wargaKendara` fall back to a render-time pure-function derivation from the always-stored D1 data plus the derived D9 / Surya Lagna / Chandra Lagna charts.
- **Recalculation**: the AstrologySettings full recalculation job recomputes `wargaKendara` like any other derived value; there are no user overrides.

### Varga Chart Catalog (static reference data)

The 16-varga catalog that supplies each displayed chart's **main-indication tags** (phase 1 renders tags for D1, D9, Surya Lagna and Chandra Lagna only; D2–D60 are not shown anywhere yet — product decision 2026-08-15). This is **static, system-wide display data** — a fixed catalog resolved via i18n message keys (chart name + main indication per locale); it is **not stored per horoscope** and is not user-editable. English names and indications are authoritative (from `docs/warga-kendara.md`); Sinhala translations are pending domain confirmation (see Open Questions in `20260815-1129-warga-kendara.md`).

| Key | D# | Chart name (EN) | Main indication (EN) | Chart name (SI) | Main indication (SI) |
|-----|----|------------------|----------------------|------------------|----------------------|
| d1 | 1 | Rāśi | Overall life, body, general circumstances | (pending) | (pending) |
| d2 | 2 | Horā | Wealth, resources | (pending) | (pending) |
| d3 | 3 | Drekkāṇa | Siblings, courage | (pending) | (pending) |
| d4 | 4 | Chaturthāṁśa | Property, fortune | (pending) | (pending) |
| d7 | 7 | Saptāṁśa | Children | (pending) | (pending) |
| d9 | 9 | Navāṁśa | Marriage, dharma, strength of planets | (pending) | (pending) |
| d10 | 10 | Daśāṁśa | Career/profession | (pending) | (pending) |
| d12 | 12 | Dvādaśāṁśa | Parents, ancestry | (pending) | (pending) |
| d16 | 16 | Ṣoḍaśāṁśa | Vehicles, comforts | (pending) | (pending) |
| d20 | 20 | Viṁśāṁśa | Spirituality | (pending) | (pending) |
| d24 | 24 | Siddhāṁśa | Education | (pending) | (pending) |
| d27 | 27 | Bhāṁśa | Strength/weakness | (pending) | (pending) |
| d30 | 30 | Triṁśāṁśa | Misfortunes, difficulties | (pending) | (pending) |
| d40 | 40 | Khavedāṁśa | Auspicious/inauspicious effects | (pending) | (pending) |
| d45 | 45 | Akṣavedāṁśa | General indications | (pending) | (pending) |
| d60 | 60 | Ṣaṣṭiāṁśa | Very subtle karmic indications | (pending) | (pending) |

### Doshas

```json
{
  "doshas": [
    {
      "name": "Manglik Dosha",
      "description": "Mars in 1st, 4th, 7th, 8th, or 12th house",
      "isPresent": true,
      "severity": "Medium",
      "affectingHouses": [1, 7],
      "planetsInvolved": [3]
    }
  ]
}
```

### Chart Data

```json
{
  "houses": [
    {
      "houseNumber": 1,
      "sign": 1,
      "startDegree": 340.0,
      "endDegree": 10.0,
      "planets": [
        {
          "name": 1,
          "degree": 12.5,
          "sign": 1,
          "retrograde": false
        }
      ],
      "lord": 3
    }
  ],
  "currentPlanets": [
    {
      "name": 1,
      "sign": 4,
      "degree": 95.0,
      "absoluteDegree": 95.0,
      "house": 4,
      "nakshatra": 8,
      "pada": 1,
      "retrograde": false,
      "combustion": false,
      "strength": 0
    },
    {
      "name": 7,
      "sign": 9,
      "degree": 200.0,
      "absoluteDegree": 200.0,
      "house": 7,
      "nakshatra": 19,
      "pada": 3,
      "retrograde": true,
      "combustion": false,
      "strength": -1
    }
  ],
  "ascendant": {
    "sign": 1,
    "degree": 5.0,
    "lord": 3,
    "nakshatra": 1
  },
  "lagna": 1,
  "chartType": "Rasi"
}
```

**Notes:**
- `currentPlanets` is an optional array at the top level, present only when the chart supports (and the user has toggled) current planetary position overlay
- Each current planet object uses the same numeric enum fields as birth planets (Planet enum for `name`, Zodiac Sign enum for `sign`, Planetary Strength enum for `strength`, Nakshatra enum for `nakshatra`)
- `house` is determined by which house the current planet falls into based on the birth chart's house cusps
- `currentPlanets` is computed server-side in real-time via ephemeris calculations — it is NOT stored in the database
- The House chart is the primary chart that supports this overlay; other chart types may be extended in the future

### FilterConfig (SavedFilter)

```json
{
  "visibleSections": {
    "birthChart": true,
    "houseChart": false,
    "navamsaD9": true,
    "drekkanaD3": false,
    "dasamsaD10": false,
    "shodashaVargas": false,
    "chandraLagna": false,
    "suryaLagna": false,
    "planetaryStrengths": true,
    "aspects": false,
    "yogas": true,
    "doshas": false,
    "currentPlanetPositions": false
  }
}
```

**Notes:**
- `currentPlanetPositions` controls whether current planetary positions are shown on the House chart when toggled on
- This preference is persisted per user in the SavedFilter config

## Entity Relationship Diagram

```
User (1) ---< (N) Horoscope
User (1) ---< (N) Metadata
User (1) ---< (N) SavedFilter
User (1) ---< (N) SearchHistory
User (1) ---< (N) SearchBookmark
User (1) ---< (N) Location

AstrologySettings (1) --- (1) User (last updated by, via updatedBy)

Location (1) ---< (N) Horoscope

Horoscope (1) --- (1) CalculatedDetails
Horoscope (1) ---< (N) Chart
Horoscope (1) ---< (N) Metadata
Horoscope (1) ---< (N) ShareLink
Horoscope (1) ---< (N) SearchEmbedding
Horoscope (1) ---< (N) SearchBookmark

SavedFilter (1) ---< (N) SearchHistory
```
