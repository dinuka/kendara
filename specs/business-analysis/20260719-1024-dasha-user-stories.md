# Dasha Periods — User Stories

**Date:** 2026-07-19
**Source:** `docs/dashas.md`
**Status:** Draft

---

## Story 1: View Mahadasha Periods

- **Title:** Mahadasha Timeline
- **As a** Student **I want** to see the full Mahadasha timeline for a horoscope **so that** I can understand the major planetary periods governing the native's life.
- **Acceptance Criteria:**
  - The dasha section displays a chronological list of all Mahadasha periods for the horoscope
  - Each Mahadasha entry shows: planet lord (by name), start date, end date, and duration in years
  - The first Mahadasha period's starting planet and duration are calculated from the remaining portion of the Moon's Nakshatra at birth (balance of dasha)
  - Mahadasha periods are ordered chronologically from birth onward
  - All date fields use ISO date format (YYYY-MM-DD)
- **Priority:** High

---

## Story 2: View Antardasha Periods Within Each Mahadasha

- **Title:** Antardasha Sub-Periods
- **As a** Student **I want** to see the Antardasha (Bhukti) sub-periods within each Mahadasha **so that** I can analyze the finer planetary influences during a major period.
- **Acceptance Criteria:**
  - Each Mahadasha can be expanded to reveal its Antardasha sub-periods
  - Each Antardasha entry shows: planet lord, start date, end date, and duration in months
  - Antardasha periods within a Mahadasha are contiguous (no gaps, no overlaps)
  - The first Antardasha's start date matches the parent Mahadasha's start date
  - The last Antardasha's end date matches the parent Mahadasha's end date
  - If no Antardasha data exists, an empty array is returned (not omitted)
- **Priority:** High

---

## Story 3: View Vidasa Periods Within Each Antardasha

- **Title:** Vidasa Sub-Sub-Periods
- **As a** Student **I want** to see the Vidasa (Pratyantardasha) sub-periods within each Antardasha **so that** I can study even finer-grained planetary influences.
- **Acceptance Criteria:**
  - Each Antardasha can be expanded to reveal its Vidasa sub-periods
  - Each Vidasa entry shows: planet lord, start date, end date, and duration in days
  - Vidasa periods within an Antardasha are contiguous
  - The first Vidasa's start date matches the parent Antardasha's start date
  - The last Vidasa's end date matches the parent Antardasha's end date
  - If no Vidasa data exists, an empty array is returned (not omitted)
- **Priority:** Medium

---

## Story 4: View Sukshama Periods Within Each Vidasa

- **Title:** Sukshama Sub-Sub-Sub-Periods
- **As a** Student **I want** to see the Sukshama periods within each Vidasa **so that** I can access the most detailed level of dasha timing.
- **Acceptance Criteria:**
  - Each Vidasa can be expanded to reveal its Sukshama sub-periods
  - Each Sukshama entry shows: planet lord, start date, end date, and duration in days
  - Sukshama periods within a Vidasa are contiguous
  - The first Sukshama's start date matches the parent Vidasa's start date
  - The last Sukshama's end date matches the parent Vidasa's end date
  - If no Sukshama data exists, an empty array is returned (not omitted)
  - Optional Prana (sub-sub-sub-sub) periods may be displayed at an additional nesting level if calculated, using duration in hours
- **Priority:** Medium

---

## Story 5: Nested Collapse/Expand UI for Dasha Hierarchy

- **Title:** Hierarchical Dasha Accordion
- **As a** Student **I want** to navigate the dasha hierarchy using nested collapsible sections **so that** I can explore periods at my desired level of detail without information overload.
- **Acceptance Criteria:**
  - The dasha section uses a nested accordion/collapse pattern: Mahadasha (level 1) > Antardasha (level 2) > Vidasa (level 3) > Sukshama (level 4) > Prana (level 5, optional)
  - Each level can be independently expanded or collapsed
  - Expanding a parent period reveals its child sub-periods
  - The UI clearly indicates which periods can be expanded (have sub-periods) vs. leaf periods
  - Each period row shows the planet lord, date range, and duration at minimum
  - The hierarchy indentation increases with each level to visually indicate nesting depth
  - Smooth expand/collapse animation for usability
- **Priority:** High

---

## Story 6: Auto-Expand Current Active Periods

- **Title:** Current Period Auto-Expansion
- **As a** Student **I want** the currently active dasha period at every hierarchy level to be expanded by default **so that** I immediately see which periods are influencing the native right now.
- **Acceptance Criteria:**
  - On page load, the system identifies the current active Mahadasha, Antardasha, Vidasa, Sukshama (and Prana if applicable) based on the current date
  - The active Mahadasha is expanded by default, revealing its Antardasha periods
  - The active Antardasha within that Mahadasha is also expanded, revealing its Vidasa periods
  - The active Vidasa within that Antardasha is also expanded, revealing its Sukshama periods
  - The active Sukshama (and Prana) are expanded accordingly
  - All non-active periods at every level remain collapsed by default
  - The active periods are visually highlighted or marked (e.g., with a badge or different background color)
  - If no period is currently active (e.g., all periods have passed), no period is auto-expanded
- **Priority:** High

---

## Future Considerations

- Search/filter within dasha periods by planet lord
- Side-by-side comparison of dashas between two horoscopes
- Printable dasha timeline view
