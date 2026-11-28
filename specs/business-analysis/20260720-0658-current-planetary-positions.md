# Current Planetary Positions — User Stories

**Date:** 2026-07-20
**Source:** `docs/current-planatary-positions.md`
**Status:** Draft

---

## Story 1: Current Planetary Positions Overlay on House Chart

- **Title:** Current Planetary Positions Toggle
- **As a** Student **I want** to toggle the display of current planetary positions on the House chart **so that** I can compare where the planets are right now against where they were at the native's birth.
- **Acceptance Criteria:**
  - The House chart view includes a toggle button labeled "Show Current Planetary Positions" (or similar, localized to Sinhala/English)
  - Toggling the button on overlays current planet positions on the same House chart
  - Toggling the button off removes the current planet overlay, showing only birth planets
  - The toggle state is preserved during the current session
  - The toggle does not affect other chart types (birth, navamsa, etc.) — only the House chart
  - The chart remains interactive and zoomable/pannable in both states
- **Priority:** High

---

## Story 2: Visual Differentiation of Birth vs Current Planets

- **Title:** Distinguishable Current Planet Rendering
- **As a** Student **I want** current planetary positions to look visually different from birth planetary positions on the chart **so that** I can instantly tell which planets are transiting and which are natal.
- **Acceptance Criteria:**
  - Current planets use a distinct visual style (different color, outline, or symbol) compared to birth planets
  - The visual difference is clearly explained in a chart legend or tooltip
  - Both birth and current planets for the same celestial body (e.g., birth Sun and current Sun) are visible simultaneously in their respective positions
  - When a current planet occupies the same position as a birth planet, the combined state is indicated (e.g., a merged symbol or dual-label)
  - The legend differentiates between "Birth Planet" and "Current Planet" labels in the user's selected language (Sinhala or English)
- **Priority:** High

---

## Story 3: Auto-Calculation of Current Planetary Positions

- **Title:** Real-Time Current Planet Calculation
- **As a** System **I want** to calculate current planetary positions in real-time based on the current date/time and ephemeris data **so that** students always see accurate transit positions.
- **Acceptance Criteria:**
  - Current planetary positions are computed server-side using the Swiss Ephemeris (via `jyotish-calculations` and `swisseph-v2`)
  - Calculation uses the current system date/time at the moment of the API request
  - All planets (Sun through Ketu, including Rahu) are computed for current positions
  - The same ayanamsha system used for the horoscope's birth chart is applied to current positions for consistency
  - Each current planet record includes: `name` (Planet enum), `sign` (Zodiac Sign enum), `degree`, `absoluteDegree`, `house` (mapped to birth chart house cusps), `nakshatra` (Nakshatra enum), `pada`, `retrograde`, `combustion`, and `strength` (Planetary Strength enum)
  - The `house` field for each current planet is determined by which birth chart house cusp the planet's current ecliptic longitude falls within
  - Results are served via the existing chart API endpoint (or a dedicated sub-endpoint) as overlay data — not stored in the database
  - Calculation completes within acceptable latency (under 2 seconds) for a responsive UI
- **Priority:** High

---

## Story 4: Current Planet Positions in Chart API Response

- **Title:** API Integration for Current Planet Data
- **As a** System **I want** to serve current planetary positions through the chart API when requested **so that** the UI can render them without additional client-side computation.
- **Acceptance Criteria:**
  - The existing chart API endpoint (`/api/horoscope/[id]/chart/[type]`) accepts an optional query parameter `includeCurrentPlanets=true`
  - When `includeCurrentPlanets=true` and the chart type is `house`, the response includes a `currentPlanets` array at the top level of the chart data JSON
  - The `currentPlanets` array follows the structure defined in the data model (each entry has `name`, `sign`, `degree`, `absoluteDegree`, `house`, `nakshatra`, `pada`, `retrograde`, `combustion`, `strength`)
  - When `includeCurrentPlanets` is absent or `false`, the response does not include the `currentPlanets` field
  - For non-house chart types, `includeCurrentPlanets` is silently ignored (returns normal chart data without current planets)
  - The API response time with current planets is within acceptable limits (under 2 seconds additional)
- **Priority:** High

---

## Story 5: Current Planet Details on Hover/Select

- **Title:** Current Planet Information Display
- **As a** Student **I want** to see detailed information about each current planet when I hover over or select it **so that** I can understand its current astrological state.
- **Acceptance Criteria:**
  - Hovering over or selecting a current planet shows a tooltip or info panel
  - The tooltip includes: planet name (in user's language), current sign and degree, current nakshatra and pada, retrograde/combustion status, current strength
  - Birth and current planets show separate tooltips specific to their type
  - The tooltip follows the same style as existing tooltip patterns on the chart
- **Priority:** Medium

---

## Story 6: Configurable Default State for Current Planets

- **Title:** Persistent Toggle Preference
- **As a** Student **I want** my preference for showing current planetary positions to be remembered across sessions **so that** I don't have to toggle it on every time I view a chart.
- **Acceptance Criteria:**
  - The toggle state (show/hide current planets) is persisted as part of the user's FilterConfig
  - The `currentPlanetPositions` field in FilterConfig defaults to `false` for new users
  - Changing the toggle updates the FilterConfig for that user
  - The persisted preference applies consistently across all House chart views for that user
  - If the user has no FilterConfig saved, a default preference is used
- **Priority:** Low

---

## Future Considerations

- Extend current planetary position overlay to other chart types (Birth chart, Navamsa, etc.)
- Side-by-side comparison mode showing birth chart and current positions in parallel views
- Time-travel feature to view planetary positions at any past or future date
- Transit analysis — aspect calculations between birth planets and current (transiting) planets
- Push notifications when significant current planetary events occur (e.g., major planet enters a new sign, retrograde starts/ends)
