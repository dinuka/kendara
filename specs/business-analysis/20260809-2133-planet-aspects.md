# User Stories — Planet Aspects (දෘෂ්ඨි) Setting

**Date:** 2026-08-09
**Source:** `docs/aspects.md`
**Status:** Draft

---

## Background / Context

Currently, aspect calculation is driven by a fixed internal rule set:
- **Aspect angles** are hardcoded as `[0, 60, 90, 120, 180]` (`ASPECT_TYPES` in `src/lib/calculation.ts`), and for manually-entered charts the default aspect houses are hardcoded per planet — SUN/MOON/SATURN 3,5,7,9,10; MARS/MERCURY 4,5,7,8,9; JUPITER/VENUS/RAHU/KETU 5,7,9 (applied as offsets from the planet's own house; see the [Default Aspect Houses](#default-aspect-houses-authoritative) table under the Validation Rules Summary below).
- **Orb tolerance** comes from the per-user `planetaryOrbs` setting stored on the `User` document (Record keyed by numeric Planet enum string, managed via `/api/settings`).

This feature introduces a new per-user setting, **"Planets Aspects houses and degrees"** (ප්ලැනට් ඇස්පෙක්ට්ස් හවුස් ඇන්ඩ් ඩිග්රීස්). It lets a student configure, per planet, which houses the planet aspects and which aspect degree angles are used. The system must then use these configured values for calculating **house aspects** and **planet aspects**, while continuing to use the **Planetary Orbs** values as the orb tolerance.

Example from the feature document:

| Planet | Houses | Degrees |
|--------|--------|---------|
| Ravi | 3, 7, 10 | 60, 180, 240 |

**Relationship to Rashi Aspects (රාශි දෘෂ්ඨි):** The companion feature `20260810-0800-rashi-aspects.md` adds a second aspect mechanism — fixed Chara/Thira/Ubaya sign-to-sign drishti, toggled by a per-user setting. Rashi drishti is an **additional (union) source** of house and planet aspects on top of this setting (see US-RA-004 / US-RA-005 interplay notes under US-PA-005 and US-PA-006 below), and the aspect tooltip must support **multiple reason lines** (one per reason — see the tooltip note under US-PA-006 and US-RA-006).

**Clarification (2026-08-11):** both aspect mechanisms — this Planet Aspects setting **and** the Rashi Aspects setting — apply to **BOTH** manually-entered horoscopes (`source: "manual"`) and birth-time/auto horoscopes (`source: "auto"`). Manual charts therefore carry per-planet degrees (`ManualHousePlacements.planetDegrees`, see `data-model.md`) so the degree-based arms (planet-to-planet aspects, the house-aspect degree arm, and the rashi degree+orb check) run identically on both sources. US-PA-005 / US-PA-006 below are updated accordingly; the manual-degree input dependency is tracked in Open Questions.

---

## Planet Aspects Actors

### Student (Settings Context)

- **Description**: An astrology student who customizes how aspects are computed for their study workflow.
- **Aspects-Setting-Specific Goals**: Configure which houses and aspect degrees each planet uses for house/planet aspect calculation.
- **Aspects-Setting-Specific Permissions**:
    - Open the "Planets Aspects houses and degrees" (දෘෂ්ඨි) setting
    - Select a planet (by English/Sinhala name, mapped to the numeric Planet enum)
    - Add/update the aspect houses for that planet (integers 1-12)
    - Add/update the aspect degrees for that planet (multiples of 30, from 30 to 330)
    - Remove individual houses/degrees from a planet's configuration
    - Reset a planet's houses/degrees to the system defaults
    - See the aspects recomputed from their configured values on horoscope calculations
    - Persist the setting for later sessions

### System (Calculation Engine)

- **Description**: Automated services that compute house aspects and planet aspects.
- **Aspects-Setting-Specific Responsibilities**:
    - Read the per-user `planetAspects` setting and apply its degree values when calculating house aspects and planet aspects
    - Apply the user's `planetaryOrbs` values as the orb tolerance when matching aspects
    - Recompute the relevant house/planet aspects whenever a planet's aspect houses or degrees are added or updated
    - Fall back to the default aspect houses/degrees for planets that have no entry in the setting

---

## Parent Stories

---

### US-PA-001: Configure Planet Aspects Setting

- **Title**: Student configures the "Planets Aspects houses and degrees" setting per planet
- **Description**: As a student, I want to configure the aspect houses and aspect degrees per planet so that the system computes house aspects and planet aspects the way I study them.
- **Priority**: High
- **Actor**: Student
- **Dependencies**: None (independent setting UI)

#### Acceptance Criteria

1. **Setting Location**:
    - The settings area includes an entry labeled "Planets Aspects houses and degrees" (ප්ලැනට් ඇස්පෙක්ට්ස් හවුස් ඇන්ඩ් ඩිග්රීස්)
    - The setting is available to students in both Sinhala and English

2. **Form Layout**:
    - The form contains a planet selector (all 9 planets, English/Sinhala names), a houses input, and a degrees input
    - Example row from the feature document: Planet - Ravi, Houses - 3, 7, 10, Degrees - 60, 180, 240
    - The student can add multiple planets and edit/remove each planet's houses and degrees

3. **Persistence**:
    - Saving stores the configuration per user (survives logout/login and browser refresh)
    - Existing per-planet entries are pre-filled on reopen for later editing

#### Edge Cases

- **No configuration yet**: The form shows the system defaults (or empty entries) and does not block saving
- **Unrecognized planet name**: Non-planet text is rejected; only the 9 Planet enum values (EN/SI) are accepted
- **Only partial data**: A planet entry requires at least one house and at least one degree to be saved

#### Business Rules

- The setting is stored per user on the `User` document as `planetAspects`, following the existing `planetaryOrbs` settings pattern
- Planet, houses, and degrees are stored as numeric values (numeric Planet enum / integers / degree values), never display strings

---

### US-PA-002: Validate Houses Input

- **Title**: System validates aspect houses as integers from 1 to 12
- **Description**: As a student, I want the system to validate that my aspect houses are integers between 1 and 12 so that I cannot enter invalid house numbers.
- **Priority**: High
- **Actor**: Student
- **Dependencies**: US-PA-001

#### Acceptance Criteria

1. **Valid Values**:
    - Given a house value that is an integer in 1-12, When I save the planet entry, Then the house is accepted and stored
    - Multiple houses (e.g., 3, 7, 10) are supported per planet

2. **Invalid Values Rejected**:
    - Given a house value of 0, 13, or a non-integer (e.g., 3.5), When I attempt to save, Then the entry is rejected with a localized validation error and nothing is partially saved

3. **Uniqueness Within Planet**:
    - Given a duplicate house (e.g., 7 entered twice for the same planet), When I attempt to save, Then the duplicate is rejected (or deduplicated with a warning)

#### Edge Cases

- **Empty houses**: A planet with no houses cannot be saved (at least one house required)
- **House 12 (boundary)**: 12 is accepted; 13 is rejected
- **House 1 (boundary)**: 1 is accepted; 0 is rejected

#### Business Rules

- Houses are integers in the closed range [1, 12]
- Houses are unique within a planet and sorted ascending for storage
- At least one house is required per planet entry

---

### US-PA-003: Validate Degrees Input

- **Title**: System validates aspect degrees as multiples of 30 from 30 to 330
- **Description**: As a student, I want the system to validate that my aspect degrees are multiples of 30 between 30 and 330 so that only supported aspect angles are used in calculation.
- **Priority**: High
- **Actor**: Student
- **Dependencies**: US-PA-001

#### Acceptance Criteria

1. **Valid Values**:
    - Given a degree value from the set 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, When I save the planet entry, Then the degree is accepted and stored
    - Multiple degrees (e.g., 60, 180, 240) are supported per planet

2. **Invalid Values Rejected**:
    - Given a degree value that is not a multiple of 30 (e.g., 45), outside the range (e.g., 25 or 360), or a non-number, When I attempt to save, Then the entry is rejected with a localized validation error and nothing is partially saved

3. **Uniqueness Within Planet**:
    - Given a duplicate degree (e.g., 60 entered twice for the same planet), When I attempt to save, Then the duplicate is rejected (or deduplicated with a warning)

#### Edge Cases

- **Empty degrees**: A planet with no degrees cannot be saved (at least one degree required)
- **Degree 30 (lower boundary)**: 30 is accepted; 0 and 15 are rejected
- **Degree 330 (upper boundary)**: 330 is accepted; 360 is rejected (0° conjunction is not a configurable aspect angle)

#### Business Rules

- Degrees are multiples of 30 in the closed range [30, 330]
- Degrees are unique within a planet and sorted ascending for storage
- At least one degree is required per planet entry
- Conjunction (0°) is NOT part of this setting — conjunctions (co-location) remain computed separately

---

### US-PA-004: Recalculate Aspects on Setting Change

- **Title**: System recomputes the relevant house/planet aspects when a house or degree is added or updated
- **Description**: As a student, I want the house/degree aspects to change when I add or update a house or degree in the setting so that my saved charts reflect my configuration.
- **Priority**: High
- **Actor**: System
- **Dependencies**: US-PA-001, US-PA-002, US-PA-003

#### Acceptance Criteria

1. **House Update Recomputes House Aspects**:
    - Given a planet whose aspect houses change (e.g., Ravi houses 3, 7, 10), When the setting is saved, Then the houses that planet aspects are recomputed to match the new values

2. **Degree Update Recomputes Planet Aspects**:
    - Given a planet whose aspect degrees change (e.g., Ravi degrees 60, 180, 240), When the setting is saved, Then the planet aspects for that planet are recomputed against the new degree values

3. **Apply on Next Calculation**:
    - Given an existing or new horoscope, When the horoscope is calculated (or recalculated) after the setting change, Then the house/planet aspects in the output use the updated configuration

4. **Orb Tolerance Unchanged**:
    - The Planetary Orbs values (per-user `planetaryOrbs`) continue to act as the orb tolerance for determining whether an aspect is effective

#### Edge Cases

- **Planet removed from the setting**: The planet falls back to the system defaults
- **House removed from a planet**: That house is no longer listed as aspected by the planet
- **Degree removed from a planet**: That angle is no longer considered for the planet's planet aspects
- **Setting changed while a chart is open**: The current view reflects the updated aspects on next refresh/recalculation (stale cached values are invalidated)

#### Business Rules

- Aspect recalculation is deterministic and derived from the stored setting — aspects are never hand-edited
- Only the aspects affected by the changed planet need to recompute; unaffected planets' aspects remain stable where feasible (incremental recompute)

---

### US-PA-005: Apply Setting to House Aspects Calculation

- **Title**: System uses the setting's houses for calculating house aspects
- **Description**: As a student, I want the system to use my configured aspect houses when calculating house aspects so that the houses a planet aspects match my configuration.
- **Priority**: High
- **Actor**: System
- **Dependencies**: US-PA-004

#### Acceptance Criteria

1. **Configured Houses Applied (absolute + degree-based union)**:
    - Given a planet with configured houses (e.g., Ravi - 3, 7, 10), When house aspects are computed, Then houses 3, 7 and 10 are always aspected (the configured `houses` apply as **absolute** house numbers)
    - The configured `degrees` also drive house aspects: a house whose absolute middle degree falls within the planet's orb of any aspect point (planet ± configured degree, both directions) is aspected too
    - The final aspected-houses set is the **union** of the explicit `houses` arm and the degree arm, deduplicated and sorted ascending (architect D4/§6.2)

2. **Manual Chart House Aspects (both chart sources — clarified 2026-08-11)**:
    - Given a manually-entered chart, When its house aspects are derived, Then the per-house `aspects` lists use the configured aspect houses per planet (applied as **absolute** house numbers) instead of the default aspect-house rules
    - The **degree arm runs on manual charts too**: a house is aspected when an aspect point derived from the planet's degree falls within the planet's orb of the house's whole-sign sign midpoint `(sign−1)*30+15` (the manual house-middle reference), so the final aspected-houses set is the **union** of the explicit `houses` arm and the degree arm — exactly as on auto charts
    - The degree arm uses each planet's **stored per-planet degree** (`ManualHousePlacements.planetDegrees`, entered by the student) or the engine's **deterministic fallback degree** (navamsa segment midpoint when the planet's navamsa sign is recorded, else sign midpoint 15° — same estimation pattern as the lagna degree); see `data-model.md` for the field shape

3. **Default Fallback**:
    - Given a planet with no entry in the setting, When house aspects are computed, Then the default aspect houses apply per planet — SUN/MOON/SATURN 3,5,7,9,10; MARS/MERCURY 4,5,7,8,9; JUPITER/VENUS/RAHU/KETU 5,7,9 — resolved as **offsets from the planet's whole-sign house**, and the degree arm runs with the default degrees `[60, 90, 120, 180]` and default orbs; the aspected houses are the union of both arms (architect D4/§6.2)

#### Edge Cases

- **Aspect houses overlap with a house containing the planet itself**: No special handling; the configured list is applied literally
- **All 12 houses configured**: The planet aspects every house
- **Houses configured out of ascending order**: The system normalizes to ascending order for display

#### Business Rules

- Configured `houses` are applied as **absolute** house numbers and are always aspected; the configured/default `degrees` additionally drive house aspects via degree-based matching against each house's absolute middle degree within the planet's orb — the aspected-houses set is the **union** of the two arms, deduplicated and sorted ascending (architect D4/§6.2)
- House aspect derivation is deterministic and pure — no ephemeris dependency
- **Both chart sources:** house aspects (both arms) apply to `source: "auto"` and `source: "manual"` horoscopes. On manual charts the degree arm matches against the house's whole-sign sign midpoint `(sign−1)*30+15` (the manual house-middle reference) using each planet's stored or fallback-derived degree (see `data-model.md` `ManualHousePlacements.planetDegrees`)
- **Interplay with Rashi Aspects (US-RA-004):** when the student's `rashiAspects.enabled` is true, a third arm is added — a planet also aspects every house whose whole-sign `sign` is in its rashi-aspect set (Chara→Thira, Thira→Chara, Ubaya→Ubaya, nearest excluded). The aspected-houses set is the union of all three arms; a house aspected by both the Planet-Aspects arm and the rashi arm retains **both** reasons (rendered as separate tooltip lines, US-RA-006). The architect's union semantics (§6.2 D4) extend naturally to include the rashi arm.

---

### US-PA-006: Apply Setting to Planet Aspects Calculation

- **Title**: System uses the setting's degree values with Planetary Orbs for calculating planet aspects
- **Description**: As a student, I want the system to use my configured aspect degrees together with the Planetary Orbs values when calculating planet aspects so that planet-to-planet aspects reflect my study settings.
- **Priority**: High
- **Actor**: System
- **Dependencies**: US-PA-004

#### Acceptance Criteria

1. **Configured Degrees Applied**:
    - Given a planet with configured degrees (e.g., Ravi - 60, 180, 240), When planet aspects are computed, Then only these degree values (plus conjunction where applicable) are considered as candidate aspect angles for that planet

2. **Planetary Orbs Tolerance**:
    - Given a pair of planets within the orb of a configured aspect angle, When planet aspects are computed, Then the aspect is recorded with the matched angle
    - Given a pair of planets outside the orb of every configured angle, When planet aspects are computed, Then no aspect is recorded between them
    - The orb tolerance used is the user's `planetaryOrbs` value for the aspecting planet (current behavior unchanged)

3. **Output Fields**:
    - `aspectType` / `exactAspectDegree` reflect the matched configured degree value (e.g., 240)
    - `degreeGap` = longitudinal distance minus the nearest configured aspect angle; the aspect is effective only when the gap is within the orb

#### Edge Cases

- **Non-classical angles (e.g., 240, 270, 330)**: Supported and stored as their numeric degree value
- **No configured degrees match**: The planet has no planet aspects against that target (unless conjunction applies)
- **Configured degrees include 60 and 240**: Both angles are evaluated independently; a target planet within orb of either is recorded
- **Planet with no entry in the setting**: Falls back to the default degrees `[60, 90, 120, 180]`
- **Both chart sources (clarified 2026-08-11)**: planet-to-planet aspects apply to `source: "manual"` horoscopes too, using each planet's stored or fallback-derived degree (`ManualHousePlacements.planetDegrees`); a manual-chart planet without an entered degree uses its deterministic fallback degree (navamsa segment midpoint when known, else sign midpoint 15°)

#### Business Rules

- Candidate aspect angles for planet-to-planet aspects come from the per-planet configured `degrees` list (plus conjunction where applicable)
- Orb tolerance comes from `planetaryOrbs`, never hardcoded
- Aspect values use the numeric Aspect Type enum (degrees as numbers)
- **Both chart sources:** planet-to-planet aspects are computed for `source: "auto"` and `source: "manual"` horoscopes alike; manual charts require a per-planet degree (entered or engine-derived) to run the degree matching — see the manual-degree input dependency in Open Questions
- **Interplay with Rashi Aspects (US-RA-005):** when the student's `rashiAspects.enabled` is true, a planet additionally aspects every other planet whose `sign` is in its rashi-aspect set, using the same degree + orb ("rashmi") matching as the configured-degree arm. A target aspected both ways keeps **both** reasons.
- **Tooltip supports multiple reason lines (US-RA-006):** an aspect may have more than one reason (e.g. the configured-degree planetary drishti AND a rashi drishti). Each distinct reason renders as its own line — the single compact line (UX §8.1.1) becomes one of possibly several lines, e.g. `ග්‍රහ දෘෂ්ඨි 7 (180) (+02:05:00)` / `රාශි දෘෂ්ඨි මේෂ රාශිය මිථුනය දකී (+02:05:00)`. This is a follow-up to UX §8.1.1 (flagged for the UX phase).

---

### US-PA-007: Reset Planet Aspects to Defaults

- **Title**: Student resets a planet's aspect houses and degrees to the system defaults
- **Description**: As a student, I want to reset a planet's aspect configuration back to the system defaults so that I can undo my customization easily.
- **Priority**: Medium
- **Actor**: Student
- **Dependencies**: US-PA-001

#### Acceptance Criteria

1. **Per-Planet Reset**:
    - The form offers a reset action per planet
    - Given a planet with customized houses/degrees, When the student resets it, Then the planet's entry is cleared and the system defaults are used for that planet

2. **Reset Confirmation**:
    - The reset requires confirmation before applying (destructive action)

3. **Effect on Calculation**:
    - After reset, the planet's house/planet aspects are computed from the default aspect houses — SUN/MOON/SATURN 3,5,7,9,10; MARS/MERCURY 4,5,7,8,9; JUPITER/VENUS/RAHU/KETU 5,7,9 — and the default degrees `[60, 90, 120, 180]` (unchanged)

#### Edge Cases

- **Reset all planets**: Bulk reset to defaults is supported (or performed per planet)
- **Already-default planet**: Reset is a no-op with a confirmation message

#### Business Rules

- Defaults per planet: houses — SUN/MOON/SATURN 3,5,7,9,10; MARS/MERCURY 4,5,7,8,9; JUPITER/VENUS/RAHU/KETU 5,7,9 (see the [Default Aspect Houses](#default-aspect-houses-authoritative) table); degrees — `[60, 90, 120, 180]` (unchanged)
- A reset planet behaves exactly like a planet with no entry in the setting

---

## Validation Rules Summary

| Rule | Requirement |
|------|-------------|
| Houses | Integers in the closed range [1, 12] |
| Houses uniqueness | No duplicates within a planet |
| Houses minimum | At least one house per planet |
| Degrees | Multiples of 30 in the closed range [30, 330] (30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330) |
| Degrees uniqueness | No duplicates within a planet |
| Degrees minimum | At least one degree per planet |
| Conjunction (0°) | NOT configurable in this setting — conjunctions (co-location) are computed separately |
| Update behavior | Adding/updating a house or degree changes the relevant house/planet aspect calculation; aspects are recomputed on next calculation |
| Calculation input | House aspects and planet aspects use the setting's degree/house values |
| Orb tolerance | Planetary Orbs values (`planetaryOrbs`) are used as the orb tolerance (current behavior) |
| Defaults | Planets without an entry use the default aspect houses per planet (see [Default Aspect Houses](#default-aspect-houses-authoritative) below) and default degrees `[60, 90, 120, 180]` (unchanged); default houses apply as offsets from the planet's whole-sign house and are unioned with degree-based matching |

### Default Aspect Houses (authoritative)

Defaults for any planet without a configured entry (degree defaults unchanged: `[60, 90, 120, 180]` for all planets).

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

These defaults replace the previously documented table (Mars 4/8/12, Jupiter 5/9/11, Saturn 3/7/10, Rahu 5/9/Ketu 5/9, others 7th-house full aspect). For an unconfigured planet the default houses are resolved **relative to the planet's whole-sign house** (`((house_i − 1 + offset − 1) % 12) + 1`), and the default degrees additionally drive degree-based house-aspect matching; the aspected-houses set is the **union** of the two arms (architect D4/§6.2).

---

## Clarifying Assumptions

1. **Per-user setting**: `planetAspects` is a per-user setting stored on the `User` document, mirroring the existing `planetaryOrbs` pattern (`/api/settings`). Each student's charts are calculated with their own setting.
2. **Stored keyed by planet**: The setting is a Record keyed by numeric Planet enum string (`"1"`…`"9"`); `planetName` is implied by the key and selected in the form by EN/SI name.
3. **Defaults per planet use the authoritative default table**: For any planet without a configured entry, house aspects use the default aspect houses — SUN/MOON/SATURN 3,5,7,9,10; MARS/MERCURY 4,5,7,8,9; JUPITER/VENUS/RAHU/KETU 5,7,9 — applied as offsets from the planet's whole-sign house, plus degree-based matching from the default degrees `[60, 90, 120, 180]`; planet aspects use degrees `[60, 90, 120, 180]` (degree defaults unchanged). This replaces the previously documented table (Mars 4/8/12, Jupiter 5/9/11, Saturn 3/7/10, Rahu/Ketu 5/9, others 7th-house full aspect).
4. **Degrees drive BOTH planet-to-planet aspects and degree-based house aspects**: both lists are stored per planet. Configured `houses` are aspected as **absolute** house numbers (explicit arm); configured `degrees` drive planet-to-planet aspects AND degree-based house aspects — a house is aspected when an aspect point derived from the degrees falls within the planet's orb of the house's absolute middle degree. The aspected-houses set is the **union** of both arms (architect D4/§6.2). There is **no degree ÷ 30 → house-number mapping**.
5. **Orb tolerance**: The orb for matching a configured degree stays the aspecting planet's `planetaryOrbs` value (current code uses a fixed `gap < 30`; the requirement clarifies orbs should be used).
6. **Both chart sources (clarified 2026-08-11)**: Both aspect mechanisms apply to `source: "manual"` and `source: "auto"` horoscopes. Manual charts carry per-planet degrees (`ManualHousePlacements.planetDegrees`, see `data-model.md`) so the same pure aspect functions run on both sources; the manual house-middle reference for the degree arm is the house's whole-sign sign midpoint `(sign−1)*30+15`, and a manual-chart planet without an entered degree uses a deterministic fallback degree (navamsa segment midpoint when known, else sign midpoint 15°).

## Open Questions

1. Should the aspects setting be **per-user** (mirrors `planetaryOrbs`) or **global**? If per-user, how should a shared/public horoscope's aspects be represented for other students (computed per-viewer vs stored once from the creator's setting)?
2. How are aspects represented in **chart rendering** (aspect lines/colors)? Does changing the setting alter rendered charts, or only the aspects data (planets table / house table columns)?
3. For **auto horoscopes**, current `planetaryOrbs` is passed into `calculateHoroscope`. Should `planetAspects` be passed the same way, and should a setting change trigger a recalculation of existing stored `CalculatedDetails` (migration) or only future calculations?
4. **RESOLVED (2026-08-09, architect D4/AD-5/§6.2):** Configured `degrees` drive both planet-to-planet aspects and degree-based house aspects — a house is aspected when an aspect point derived from the degrees falls within the planet's orb of the house's absolute middle degree, unioned with the explicitly configured `houses` list. There is **no degree ÷ 30 → house-number mapping** (the previous framing — `degrees` only for planet-to-planet aspects — is superseded).
5. When a student's aspects setting changes, are previously **saved `CalculatedDetails`** re-derived, or is the setting applied only at calculation/view time?
6. **How do `planetAspects` and `rashiAspects` compose at the data level?** The Rashi Aspects feature (`20260810-0800-rashi-aspects.md`) adds a second, independent source of house/planet aspects plus a multi-line reason tooltip. Decide whether each aspect entry carries a `reason: "planetary" | "rashi"` marker (or a `reasons[]` list) so the UI can render one tooltip line per reason, and confirm the union semantics across the two settings (see US-RA-004/US-RA-005 and US-RA-006).
7. **Manual-chart degree input (new — from the 2026-08-11 clarification):** both aspect mechanisms now apply to manual charts, which requires per-planet degrees. Confirm: (a) the proposed `planetAspects`-style `ManualHousePlacements.planetDegrees` field shape and the deterministic fallback degree for planets without an entered degree (navamsa segment midpoint → sign midpoint 15°); (b) whether per-planet degree entry in the manual-chart form is **required or optional** (recommended: optional, with the fallback so existing charts and partial entries still produce aspects); (c) how **existing stored manual horoscopes with no degrees** behave (recommended: fallback degrees apply at view/calculation time — no migration, consistent with the no-migration stance in US-PA-004); (d) golden/manual fixtures for manual-chart aspects.

## Feature-to-Story Traceability

| Feature Document Requirement | User Story |
|------------------------------|------------|
| New setting "Planets Aspects houses and degrees" with planet name, houses, degrees form | US-PA-001 |
| User can change the houses and degrees | US-PA-001 |
| Validate houses — integers 1-12 | US-PA-002 |
| Validate degrees — multiples of 30 from 30 to 330 | US-PA-003 |
| If a user adds/updates a house or degree, the relevant house/degree calculation changes | US-PA-004 |
| System uses the aspects setting degree values for calculating house aspects | US-PA-005 |
| System uses the aspects setting degree values for calculating planet aspects | US-PA-006 |
| Uses Planetary Orbs values for calculating aspects (current behavior) | US-PA-006 |
| Defaults/reset for unconfigured planets | US-PA-007 |
