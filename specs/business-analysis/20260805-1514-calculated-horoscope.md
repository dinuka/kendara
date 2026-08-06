# User Stories — Calculated Horoscope (Manual Entry)

## Calculated Horoscope Actors

### Student (Manual Entry Context)

- **Description**: An astrology student who has an already-calculated horoscope (printed chart or from an external source) WITHOUT birth information, and wants to enter it into the system for study.
- **Manual-Entry-Specific Goals**: Enter the Lagna and planet placements manually, have the system validate placements, derive aspects, and compute probable birth ranges.
- **Manual-Entry-Specific Permissions**:
    - Create a horoscope from already-calculated chart data without providing birth date/time/location
    - Enter the Lagna (ascendant sign)
    - View the 12-house table with signs derived from the entered Lagna
    - Add/update planets (Grahas) in house locations within the house table
    - Trigger placement validation for Budha (Mercury), Sikuru (Venus), Rahu, and Kethu
    - View the planets table (Planet, Sign, Strength, House, Conjunctions, Aspects, Other) derived from house placements
    - Enter the Navamsa (D9) Lagna sign to view the Navamsa house table
    - View the enriched planets table (Navamsa, Navamsa Strength, Degree range, Nakshatra/Pada, Conjunctions, Aspects, Other)
    - View derived probable birth ranges: birth time (from Ravi's house), birth month (from Ravi's sign), birth date candidates (from Ravi's degree range), and probable age ranges (from Shani's position)
    - Save the manually-entered horoscope for later study
    - Apply the same existing features (metadata, share, search, privacy) to manually-entered horoscopes

### System (Manual Entry Calculation Engine)

- **Description**: Automated services that perform validation and derivation for manually-entered horoscopes.
- **Manual-Entry-Specific Responsibilities**:
    - Derive the 12 house signs from the entered Lagna (whole-sign houses)
    - Validate Budha placement: must be in Ravi's (Sun's) house, Ravi's house -1, or Ravi's house +1
    - Validate Sikuru (Venus) placement: must be in Ravi's house, Ravi's house -2, or Ravi's house +2
    - Validate Rahu/Kethu axis: Rahu and Kethu must be in opposite houses (6 houses apart, mod 12)
    - Compute aspects (Drishti) from the entered house placements
    - Compute conjunctions (co-located planets) from the entered house placements
    - Derive the planets table (Planet, Sign, Str, House, Conjunctions, Aspects, Other) including 22nd Drekkana Lord, 64th Navamsa Lord, and Atmakaraka
    - Derive the Navamsa house table from the entered Navamsa Lagna
    - Enrich the planets table with Navamsa, Navamsa Strength, Degree range, and Nakshatra (Pada) values
    - Derive probable birth time range from Ravi's (Sun's) house
    - Derive probable birth month range from Ravi's sign
    - Derive probable birth date candidates from Ravi's degree/Navamsa range
    - Derive probable age ranges from Shani's birth position and current Shani position

---

## Parent Stories

---

### US-CH-001: Create Horoscope from Calculated Chart (No Birth Details)

- **Title**: Student creates a horoscope by entering already-calculated chart data instead of birth details
- **Description**: As a student, I want to create a horoscope from an already-calculated chart by entering the Lagna instead of birth date/time/location so that I can study charts I received from another source.
- **Priority**: High
- **Actor**: Student
- **Dependencies**: US-002 (Add Horoscope), US-003 (Calculations)

#### Acceptance Criteria

1. **Entry Mode Selection**:
    - The Add Horoscope flow offers two modes: "Birth Details" (existing flow) and "Calculated Chart" (new flow)
    - In "Calculated Chart" mode, birth date, birth time, and location fields are NOT required and may be omitted
    - The system marks the horoscope as manually-entered (`source: "manual"`)

2. **Lagna Input**:
    - The system shows an input for adding the Lagna (ascendant sign)
    - The Lagna input accepts both English and Sinhala sign names and maps to the numeric ZodiacSign enum
    - A Lagna is required before the house table can be derived

3. **Persistence**:
    - The horoscope is saved with `source: "manual"` and the entered Lagna
    - Saving without birth details does not trigger ephemeris calculation
    - The student can reopen the horoscope later and continue editing the manual chart

#### Edge Cases

- **User switches modes mid-flow**: Switching from "Calculated Chart" back to "Birth Details" keeps the Lagna input but requires birth details before saving
- **Invalid Lagna value**: Non-sign text is rejected with a localized error; the numeric enum mapping is used
- **Empty Lagna on save**: Save is blocked until a valid Lagna is provided

#### Business Rules

- A manually-entered horoscope MUST NOT have ephemeris-calculated `houses`/`planets` overwritten by automatic calculation
- The numeric ZodiacSign enum is used for Lagna storage (never display strings)
- The horoscope is private by default (same as existing horoscope creation rules)

---

### US-CH-002: Derive 12 Houses from Lagna

- **Title**: System derives the 12 house signs from the entered Lagna and shows a house table
- **Description**: As a student, I want the system to calculate all 12 houses' signs from my entered Lagna so that I can see the house layout at a glance.
- **Priority**: High
- **Actor**: Student
- **Dependencies**: US-CH-001

#### Acceptance Criteria

1. **House Sign Derivation**:
    - Given Lagna = sign N, the 12 house signs are derived using whole-sign houses: house 1 = sign N, house 2 = sign N+1, ..., house 12 = sign N+11 (mod 12)
    - House signs are stored as numeric ZodiacSign enum values

2. **House Table Display**:
    - The house table shows: House number, Planets (Graha), Aspects
    - The table renders one row per house (1-12)
    - Initially all planet columns are empty (user populates them)
    - The table is bilingual (EN/SI)

3. **Refresh on Lagna Change**:
    - If the student edits the Lagna, the house signs re-derive and the house table resets accordingly

#### Edge Cases

- **Lagna = 12 (Pisces)**: House 12 wraps to sign 11 (Aquarius) correctly (mod-12 arithmetic)
- **Lagna changed after planets entered**: Planet placements are preserved but re-validated against the new house layout; out-of-range placements flag a warning

#### Business Rules

- Whole-sign house system is used (no cuspal degrees are needed in manual mode)
- House sign derivation is deterministic and pure (no ephemeris dependency)

---

### US-CH-003: Add and Update Planets in House Table

- **Title**: Student adds planets to relevant house locations in the house table
- **Description**: As a student, I want to update the house table by adding planets to relevant locations so that the chart matches my already-calculated chart.
- **Priority**: High
- **Actor**: Student
- **Dependencies**: US-CH-002

#### Acceptance Criteria

1. **Planet Entry**:
    - The student can add any of the 9 planets (Sun-Rahu, Ketu) to any house row
    - The student can remove a planet from a house row
    - The student can move a planet between houses
    - Multiple planets may occupy the same house (conjunctions)

2. **Uniqueness**:
    - A planet can appear only once in the chart (no duplicates)
    - Attempting to add a planet already placed elsewhere either moves it or is rejected with a clear message

3. **Planet Selection UI**:
    - Planet picker accepts English and Sinhala names, mapped to the numeric Planet enum
    - The picker shows which planets are already placed and where

#### Edge Cases

- **All 9 planets placed**: The picker shows no remaining unplaced planets
- **Removing a planet from a conjunction**: Other planets in the house remain
- **Sun placement drives validation**: The house containing Ravi (Sun) is the reference for Budha/Sikuru validation (US-CH-004)

#### Business Rules

- The Planet numeric enum is used for storage
- Each planet exists exactly once in the chart
- A house may contain 0-9 planets

---

### US-CH-004: Validate Budha, Sikuru, Rahu, and Kethu Placements

- **Title**: System validates Budha, Sikuru, and Rahu/Kethu placements against Ravi
- **Description**: As a student, I want the system to validate that Budha, Sikuru, Rahu, and Kethu are placed consistently with Ravi so that I can catch entry errors in the manual chart.
- **Priority**: High
- **Actor**: Student
- **Dependencies**: US-CH-003

#### Acceptance Criteria

1. **Budha (Mercury) Rule**:
    - Budha MUST be in Ravi's (Sun's) house, Ravi's house -1, or Ravi's house +1
    - Example: Ravi in house 3 → Budha valid in houses 2, 3, or 4

2. **Sikuru (Venus) Rule**:
    - Sikuru MUST be in Ravi's house, Ravi's house -2, or Ravi's house +2
    - Example: Ravi in house 3 → Sikuru valid in houses 1, 3, or 5

3. **Rahu/Kethu Axis Rule**:
    - Rahu and Kethu MUST be in opposite houses (gap == 6, mod 12)
    - Example: Rahu in house 4 → Kethu in house 11 (or vice-versa)

4. **Validation Feedback**:
    - Each rule is validated on entry (after a planet is placed or when the user triggers validation)
    - Violations are shown inline per rule with a localized message identifying the planet and expected range
    - Validation state is displayed in the house table (e.g., valid/invalid badge per rule)
    - Validation is advisory — the student may save with violations, but violations are clearly flagged

#### Edge Cases

- **Ravi not yet placed**: Budha/Sikuru validation is skipped with a "place Ravi first" hint
- **Rahu or Kethu missing**: The axis rule shows "incomplete" rather than a hard error
- **House wrap**: Ravi in house 12 → +1 wraps to house 1, -1 wraps to house 11 (mod-12 arithmetic)
- **Both Budha and Sikuru rules violated simultaneously**: Both violations are reported

#### Business Rules

- House arithmetic wraps mod 12
- Validation is non-blocking (advisory) — the manual chart can be saved with violations
- Validation results are persisted with the manual chart for display on later visits

---

### US-CH-005: Recalculate Aspects and Conjunctions

- **Title**: System computes aspects (Drishti) and conjunctions from the entered house placements
- **Description**: As a student, I want the system to update the aspects using my given input so that I don't have to compute drishti manually.
- **Priority**: High
- **Actor**: Student
- **Dependencies**: US-CH-003

#### Acceptance Criteria

1. **Aspect Derivation**:
    - The system computes special (Vedic) aspects for each planet based on its house:
        - Mars aspects houses 4, 8, 12 from itself
        - Jupiter aspects houses 5, 9, 11 from itself
        - Saturn aspects houses 3, 7, 10 from itself
        - Rahu and Kethu aspect houses 5, 9 from themselves (and opposite house for Rahu)
        - Moon, Mercury, Venus, Sun: full aspect (7th house) only
    - Aspects update automatically whenever a planet is placed or moved

2. **Conjunction Derivation**:
    - Planets in the same house are flagged as conjunct
    - The planets table lists conjunction partners per planet

3. **Display**:
    - The house table "Aspects" column reflects the computed aspects
    - The planets table "Aspects" column lists which houses/planets each planet aspects

#### Edge Cases

- **No planets entered yet**: Aspect columns are empty
- **Planet moved**: Aspects recompute for that planet only (dependent planets unchanged)
- **All 9 planets in same house**: Each planet aspects the same houses; conjunction list has 8 partners

#### Business Rules

- Aspect derivation is deterministic and pure — no ephemeris needed
- Aspects are recalculated on every placement change (incremental where feasible)
- Special aspects (Jupiter/Saturn/Mars) take precedence over the 7th-house full aspect

---

### US-CH-006: Derive Planets Table

- **Title**: System creates the planets table with derived sign, strength, house, conjunctions, aspects, and special lords
- **Description**: As a student, I want a planets table derived from the house placements showing Planet, Sign, Str (strength), House, Conjunctions, Aspects, and Other (22nd Drekkana Lord, 64th Navamsa Lord, Atmakaraka) so that I have a complete reference of the chart.
- **Priority**: High
- **Actor**: Student
- **Dependencies**: US-CH-003, US-CH-005

#### Acceptance Criteria

1. **Planets Table Columns**:
    - Planet (numeric Planet enum)
    - Sign (derived from the house the planet occupies; house N = sign Lagna+N-1)
    - Str (strength) — derived where possible; defaults to neutral (Sama) until Navamsa is provided
    - House (house number the planet occupies)
    - Conjunctions (planets co-located in the same house)
    - Aspects (computed in US-CH-005)
    - Other (22nd Drekkana Lord, 64th Navamsa Lord, Atmakaraka, etc.)

2. **Sign Derivation**:
    - A planet's sign is derived from its house: house number + (Lagna - 1), mod 12

3. **Special Lords (Other)**:
    - 22nd Drekkana Lord, 64th Navamsa Lord, and Atmakaraka are computed from the derived placements
    - Atmakaraka = the planet with the highest degree in the chart; in manual mode (no degrees entered yet) it is deferred until degree/Navamsa data exists (US-CH-008) or flagged as "not enough data"

4. **Display Position**:
    - The planets table appears AFTER the Navamsa sign input (per the feature workflow: "Before the planets table the system should show another input for adding Navansaka sign")

#### Edge Cases

- **Planet without Navamsa data**: Strength shows "not calculated" placeholder; degree-dependent fields deferred
- **Planet placed in house 12 with Lagna 1**: Sign = 12 (Pisces) computed correctly
- **Atmakaraka ambiguity**: Two planets with equal degrees — flagged for user resolution

#### Business Rules

- The planets table is derived from the house table, never stored independently (single source of truth = house placements)
- Strength uses the existing PlanetaryStrength numeric enum
- Special lords use the existing numeric Planet enum

---

### US-CH-007: Enter Navamsa Houses and View Navamsa House Table

- **Title**: Student enters the Navamsa (D9) house placements directly and views the Navamsa house table
- **Description**: As a student, I want to enter Navamsa house placements directly so that the system shows the Navamsa house table and enriches my planets table with Navamsa data.
- **Priority**: High
- **Actor**: Student
- **Dependencies**: US-CH-006

#### Acceptance Criteria

1. **Navamsa Input**:
    - Before the planets table, the system shows an input area for adding Navamsa (Navansaka) house placements
    - The student places planets into Navamsa houses directly (house number → planets), using the same planet picker as the birth house table
    - Navamsa data is optional — the planets table renders without it

2. **Navamsa House Table**:
    - The Navamsa house table shows (House number, Planets/Graha) with one row per house (1-12)
    - Each planet appears at most once across all Navamsa houses
    - Navamsa house signs are derived from the Navamsa Lagna implied by the placements (the house containing the Navamsa Lagna reference planet, or via the standard navamsa wedge mapping)

3. **Planet Navamsa Mapping**:
    - Each planet's Navamsa sign (D9 placement) comes from the house it is placed into
    - The Navamsa house table lists planets per Navamsa house

#### Edge Cases

- **No Navamsa data entered**: Navamsa section hidden, planets table shows no Navamsa column data
- **Navamsa placements changed**: Navamsa house signs re-derive; planet Navamsa placements re-validate
- **No birth degree data**: Navamsa values come from the entered Navamsa house placements directly

#### Business Rules

- Navamsa data is optional and does not block saving
- Navamsa house signs use the same whole-sign mod-12 derivation as the birth chart
- Navamsa values use the numeric ZodiacSign enum

---

### US-CH-008: Enrich Planets Table with Navamsa, Degree Range, and Nakshatra

- **Title**: System updates the planets table with Navamsa, Navamsa Str, Degree range, Nakshatra (Pada), Conjunctions, Aspects, and Other
- **Description**: As a student, I want the planets table updated with Navamsa placement, Navamsa strength, degree range, and Nakshatra (Pada) once Navamsa data is provided so that the chart reference is complete.
- **Priority**: High
- **Actor**: Student
- **Dependencies**: US-CH-006, US-CH-007

#### Acceptance Criteria

1. **Enriched Planets Table Columns**:
    - Navamsa (planet's Navamsa sign, numeric ZodiacSign enum)
    - Navamsa Str (Navamsa strength — derived where possible)
    - Degree range (from the planet's Navamsa-derived degree range, see US-CH-011 mapping)
    - Nakshatra (Pada) (from degree range — numeric Nakshatra enum + pada)
    - Conjunctions (recomputed for Navamsa co-locations)
    - Aspects (Navamsa aspects)
    - Other (22nd Drekkana Lord, 64th Navamsa Lord, Atmakaraka — now resolvable with degree data)

2. **Degree Range Derivation**:
    - A planet's degree range within its sign is inferred from its Navamsa placement (each Navamsa = 3°20' segment of the sign)
    - Example: 1st Navamsa → degree range 00°00'–03°20'; 2nd Navamsa → 03°20'–06°40'; ...; 12th Navamsa → 36°40'–40°00' (wrapping the 30° sign as 33°20'–36°40' for the 11th and 36°40'–40°00' for the 12th, i.e. mod 30°)

3. **Nakshatra (Pada) Derivation**:
    - Nakshatra and Pada are derived from the planet's absolute degree within the 360° zodiac
    - Each Nakshatra spans 13°20' and has 4 Padas of 3°20' each

4. **Atmakaraka Resolution**:
    - With degree data available, Atmakaraka = planet with the highest absolute degree
    - The 22nd Drekkana Lord and 64th Navamsa Lord are computed from sign/degree positions

#### Edge Cases

- **Navamsa provided but no degree entered**: Degree range derived from Navamsa segment; Nakshatra/Pada computed from that midpoint
- **Planet in 12th Navamsa**: Degree range wraps (36°40'–40°00', effectively 6°40'–10°00' into the sign as a value >30° handled by mod-30 logic)
- **Nakshatra boundary**: A degree exactly at 13°20' boundary belongs to the next Nakshatra

#### Business Rules

- Navamsa-based degree ranges are inferred ranges, not exact — display as a range, never a single precise value
- Nakshatra/Pada are derived from the inferred degree midpoint
- The enriched table is the source for Atmakaraka and special lords

---

### US-CH-009: Derive Probable Birth Time Range

- **Title**: System derives the probable birth time range from Ravi's (Sun's) house
- **Description**: As a student, I want the system to give me the range of probable birth times based on Ravi's house location so that I can narrow down the actual birth time of an unknown horoscope.
- **Priority**: Medium
- **Actor**: Student
- **Dependencies**: US-CH-003

#### Acceptance Criteria

1. **Birth Time Range Mapping**:
    - The system derives a probable birth time range from Ravi's (Sun's) house:
        - Ravi in 1st house → 05:00 – 07:00
        - Ravi in 2nd house → 07:00 – 09:00
        - Ravi in 3rd house → 09:00 – 11:00
        - Ravi in 4th house → 11:00 – 13:00
        - (Extend the same 2-hour pattern across the remaining houses as defined by the business rule below)

2. **Derived Range Display**:
    - The probable birth time range is displayed as a labeled result (start time – end time)
    - The range is shown in both languages

#### Edge Cases

- **Ravi not placed**: Range not shown; hint "place Ravi first"
- **House 12 (Ravi in 12th)**: Follows the extended pattern (03:00 – 05:00)

#### Business Rules

- The feature document specifies the first 4 houses explicitly (1st → 05:00–07:00, 2nd → 07:00–09:00, 3rd → 09:00–11:00, 4th → 11:00–13:00). The pattern is a 2-hour window starting at 05:00 for the 1st house and increasing by 2 hours per house. Houses 5–12 follow: 5th → 13:00–15:00, 6th → 15:00–17:00, 7th → 17:00–19:00, 8th → 19:00–21:00, 9th → 21:00–23:00, 10th → 23:00–01:00, 11th → 01:00–03:00, 12th → 03:00–05:00
- The mapping table MUST be configurable (single source of truth for the mapping)

---

### US-CH-010: Derive Probable Birth Month Range

- **Title**: System derives the probable birth month range from Ravi's (Sun's) sign
- **Description**: As a student, I want the system to give me the range of probable birth months based on Ravi's sign so that I can narrow down the birth month of an unknown horoscope.
- **Priority**: Medium
- **Actor**: Student
- **Dependencies**: US-CH-003

#### Acceptance Criteria

1. **Birth Month Range Mapping**:
    - The system derives a probable birth month range from Ravi's sign:
        - Mesha (Aries) → April 15 – May 15
        - Wrushaba (Taurus) → May 15 – June 15
        - (Extend per the pattern: each subsequent sign shifts +1 month with a 15th-day anchor)

2. **Derived Range Display**:
    - The probable birth month range is displayed as a labeled result (e.g., "April 15 – May 15")
    - The range is shown in both languages

#### Edge Cases

- **Ravi not placed**: Range not shown; hint "place Ravi first"
- **Meena (Pisces)**: Last range → March 15 – April 15 (wraps to start of the year)

#### Business Rules

- The feature document specifies the pattern for Mesha (April 15 – May 15) and Wrushaba (May 15 – June 15); the pattern continues: Mithuna → June 15 – July 15, Karka → July 15 – Aug 15, Simha → Aug 15 – Sep 15, Kanya → Sep 15 – Oct 15, Tula → Oct 15 – Nov 15, Vruschika → Nov 15 – Dec 15, Dhanu → Dec 15 – Jan 15, Makara → Jan 15 – Feb 15, Kumbha → Feb 15 – Mar 15, Meena → Mar 15 – Apr 15
- The mapping table MUST be configurable (single source of truth)

---

### US-CH-011: Derive Probable Birth Date Candidates

- **Title**: System derives probable birth date candidates from Ravi's degree range (Navamsa)
- **Description**: As a student, I want the system to give me probable birth date candidates based on Ravi's degree range so that I can narrow down the birth date of an unknown horoscope.
- **Priority**: Medium
- **Actor**: Student
- **Dependencies**: US-CH-008

#### Acceptance Criteria

1. **Birth Date Candidate Derivation**:
    - The system derives probable birth date candidates from Ravi's Navamsa-based degree range:
        - Ravi in 1st Navamsa (degree range 00°00'–03°20') → Birth date candidates 12 and 21 (12+0, 17+4)
        - Ravi in 2nd Navamsa (degree range 03°20'–06°40') → Birth date candidates 15 and 24 (12+3, 17+7)
        - (Pattern: 12 + (navamsaIndex × 3) and 17 + (navamsaIndex × 7) for the first two navamsas as specified)

2. **Candidate Display**:
    - Probable birth dates are shown as a list of candidate dates
    - Each candidate is labeled with the reasoning (base + offset)

#### Edge Cases

- **Ravi's Navamsa not derivable**: Candidates not shown; hint to provide Ravi's degree or Navamsa
- **Navamsa index 0 (1st Navamsa)**: 12+0=12, 17+4=21 per the feature document
- **Navamsa index 1 (2nd Navamsa)**: 12+3=15, 17+7=24 per the feature document

#### Business Rules

- The formula and constants (base 12 / 17, increments 3 / 7) MUST be configurable, as the feature document defines only the first two Navamsa rows explicitly; the general pattern is applied to remaining Navamsas (index n: 12 + n×3 and 17 + n×7)
- Candidates are inferred probabilities, presented as ranges/candidates — never as a single guaranteed date

---

### US-CH-012: Derive Probable Age Ranges

- **Title**: System derives probable age ranges from Shani's birth position and current position
- **Description**: As a student, I want the system to give me probable age ranges based on Shani's location in the birth chart and Shani's current location so that I can estimate the person's age.
- **Priority**: Medium
- **Actor**: Student
- **Dependencies**: US-CH-003, US-CH-008

#### Acceptance Criteria

1. **Age Range Derivation**:
    - The system derives probable age ranges from Shani's birth Navamsa and current Shani position:
        - If Shani is in the 1st Navamsa at birth (degree range 00°00'–03°20'), Shani needs 30 or 27 months to move to the next sign
        - If the current Shani degree is 18:00 (18°), then 18 months are completed
        - 1st age = (30 + 18 + 30 × (birth chart's Shani sign − current Shani sign − 1)) months
        - 2nd age = previous age + 30 years
        - 3rd age = 2nd age + 30 years

2. **Derived Range Display**:
    - The system shows the 1st, 2nd, and 3rd probable age values
    - Each age is labeled (e.g., "Probable age 1", "Probable age 2", "Probable age 3")
    - Values are shown in both languages

#### Edge Cases

- **Shani not placed**: Age ranges not shown; hint "place Shani first"
- **Current Shani degree not available**: Age ranges not shown; hint to provide current Shani degree
- **Negative intermediate result**: The formula is evaluated modulo appropriate sign cycles to avoid negative month values; a negative result is clamped to 0 months with a warning

#### Business Rules

- The Shani movement constants (30 or 27 months) and the age formula MUST be configurable
- The 1st age is in months; the 2nd and 3rd ages add 30-year increments
- All derivations are advisory estimates, clearly labeled as probable ranges

---

### US-CH-013: Save and Manage Manually-Entered Horoscope

- **Title**: Student saves and manages a manually-entered horoscope with all existing features
- **Description**: As a student, I want to save my manually-entered horoscope and manage it with the existing features (search, share, metadata, privacy) so that it integrates with my study workflow.
- **Priority**: Medium
- **Actor**: Student
- **Dependencies**: US-CH-001 through US-CH-012

#### Acceptance Criteria

1. **Save and Reopen**:
    - The manually-entered chart (Lagna, house placements, Navamsa, derived tables, validation state) is persisted and restored on reopen
    - Editing is allowed after save; derived tables recompute on each edit

2. **Searchability**:
    - Manually-entered horoscopes participate in search with the same privacy rules
    - The `source` field (`manual`) is searchable/filterable

3. **Existing Features**:
    - Metadata, share links, privacy toggles, and export all work for manually-entered horoscopes
    - Dasha charts, birth-chart rendering, and ephemeris-dependent features show a "not available" state when birth details are absent

4. **Charts Display**:
    - Charts that can be derived from the manual data (birth chart from Lagna + placements, Navamsa from Navamsa Lagna) render normally
    - Charts requiring birth details (e.g., varga charts that need exact degrees/times) show the "insufficient data" empty state

#### Edge Cases

- **Legacy horoscopes**: Horoscopes created before this feature have `source: "auto"` and behave exactly as before
- **Deletion**: Deleting a manual horoscope removes all its derived data and child records (existing cascade behavior)

#### Business Rules

- The `source` field is an enum: `auto` (birth-details calculation) or `manual` (entered chart)
- Derived tables are recomputed on edit, never hand-edited after save
- Manual horoscopes without birth details MUST NOT attempt ephemeris calculation for dasha/varga data — they show the appropriate empty state

---

## Feature-to-Story Traceability

| Feature Document Requirement | User Story |
|------------------------------|------------|
| System shows input for adding Lagna | US-CH-001 |
| Calculate 12 houses' signs from Lagna, show as table | US-CH-002 |
| User can update house table by adding planets | US-CH-003 |
| Validate Budha, Sikuru, Rahu/Kethu locations | US-CH-004 |
| System updates the Aspects using given input | US-CH-005 |
| System creates the planets table (Planet, Sign, Str, House, Conjunctions, Aspects, Other) | US-CH-006 |
| Show input for adding Navansaka sign before planets table | US-CH-007 |
| Show Navamsa house table | US-CH-007 |
| Update planets table with Navamsa, Navamsa Str, Degree range, Nakshathra (pada), Conjunctions, Aspects, Other | US-CH-008 |
| Give range of birth time using Ravi's location | US-CH-009 |
| Give range of birth month using Ravi's sign | US-CH-010 |
| Give birth date using Ravi's degree range | US-CH-011 |
| Give age using Shani location and current Shani location | US-CH-012 |
| Persistence and integration of the whole workflow | US-CH-013 |
