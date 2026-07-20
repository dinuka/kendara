# Test Plan — Current Planetary Positions Overlay

**Date:** 2026-07-20 08:00
**Based on:**
- `specs/business-analysis/20260720-0658-current-planetary-positions.md` (User Stories US-01–US-06)
- `specs/architecture/20260720-0700-current-planetary-positions.md`
- `specs/ux/20260720-0730-current-planetary-positions.md`
- `specs/business-analysis/actors.md`
- `specs/business-analysis/data-model.md`
- `specs/architecture/overview.md`

---

## API Tests

### TC-001: Chart endpoint without param — no currentPlanets
- **User Story:** US-04
- **Priority:** High
- **Preconditions:** Authenticated user, existing horoscope with calculated house chart
- **Steps:**
  1. Send GET `/api/horoscope/:id/chart/house` (no query params)
  2. Inspect response body
- **Expected Result:** Response contains standard chart fields (`id`, `horoscope`, `type`, `data`, `imageKey`, `createdAt`). No `currentPlanets` field present. Response time <100ms.

### TC-002: Chart endpoint with `?includeCurrentPlanets=true` for house chart — returns currentPlanets
- **User Story:** US-04
- **Priority:** High
- **Preconditions:** Authenticated user, existing horoscope with calculated house chart
- **Steps:**
  1. Send GET `/api/horoscope/:id/chart/house?includeCurrentPlanets=true`
  2. Inspect response body
- **Expected Result:** Response includes all standard fields plus `currentPlanets` array at top level. Array contains exactly 9 objects (Sun through Ketu). Each object has all required fields: `name`, `sign`, `degree`, `absoluteDegree`, `house`, `nakshatra`, `pada`, `retrograde`, `combustion`, `strength`. Response time <600ms.

### TC-003: includeCurrentPlanets silently ignored for non-house chart types
- **User Story:** US-04, US-01
- **Priority:** High
- **Preconditions:** Authenticated user, existing horoscope with all chart types calculated
- **Steps:**
  1. Send GET `/api/horoscope/:id/chart/birth?includeCurrentPlanets=true`
  2. Send GET `/api/horoscope/:id/chart/navamsa-d9?includeCurrentPlanets=true`
  3. Send GET `/api/horoscope/:id/chart/drekkana-d3?includeCurrentPlanets=true`
  4. Inspect each response body
- **Expected Result:** Each response matches the normal chart response for that type. No `currentPlanets` field present. Response shape unchanged from unparameterized request.

### TC-004: Standalone /api/horoscope/:id/current-planets endpoint
- **User Story:** US-04
- **Priority:** Medium
- **Preconditions:** Authenticated user, existing horoscope
- **Steps:**
  1. Send GET `/api/horoscope/:id/current-planets`
  2. Inspect response body
- **Expected Result:** Response is `{ "currentPlanets": [...], "computedAt": "..." }`. `currentPlanets` array has 9 objects matching `CurrentPlanetRecord` interface. `computedAt` is a valid ISO 8601 timestamp within 1 second of the server time.

### TC-005: 401 when unauthenticated
- **User Story:** US-04
- **Priority:** High
- **Preconditions:** No session cookie, existing horoscope
- **Steps:**
  1. Send GET `/api/horoscope/:id/chart/house?includeCurrentPlanets=true` without auth headers/cookies
  2. Send GET `/api/horoscope/:id/current-planets` without auth headers/cookies
- **Expected Result:** Both return 401 with `{ "error": "Unauthorized" }`. No ephemeris computation performed.

### TC-006: 403 for private horoscope not owned
- **User Story:** US-04
- **Priority:** High
- **Preconditions:** User A logged in, User B owns a private horoscope
- **Steps:**
  1. Send GET `/api/horoscope/:id/chart/house?includeCurrentPlanets=true` for User B's private horoscope
  2. Send GET `/api/horoscope/:id/current-planets` for User B's private horoscope
- **Expected Result:** Both return 403 with `{ "error": "Forbidden" }`. No ephemeris computation performed.

### TC-007: 404 when horoscope not found
- **User Story:** US-04
- **Priority:** Medium
- **Preconditions:** Authenticated user, non-existent UUID
- **Steps:**
  1. Send GET `/api/horoscope/00000000-0000-0000-0000-000000000000/chart/house?includeCurrentPlanets=true`
  2. Send GET `/api/horoscope/00000000-0000-0000-0000-000000000000/current-planets`
- **Expected Result:** Both return 404 with `{ "error": "Horoscope not found" }`.

### TC-008: Ephemeris calc failure returns 422
- **User Story:** US-03, US-04
- **Priority:** Medium
- **Preconditions:** Authenticated user, existing horoscope, ephemeris library mocked to throw
- **Steps:**
  1. Mock `swisseph.getPlanetData()` to throw an error
  2. Send GET `/api/horoscope/:id/chart/house?includeCurrentPlanets=true`
  3. Send GET `/api/horoscope/:id/current-planets`
- **Expected Result:** Both return 422 with `{ "error": "Calculation failed", "detail": "<error message>" }`. Standard chart data (without currentPlanets) still returned in the chart endpoint response.

---

## Calculation Tests

### TC-009: All 9 planets in response
- **User Story:** US-03
- **Priority:** High
- **Preconditions:** Authenticated user, existing horoscope
- **Steps:**
  1. Call `computeCurrentPlanets()` or endpoint with `includeCurrentPlanets=true`
  2. Count entries in result
  3. Verify planet names cover all 9 Planet enum values (1–9)
- **Expected Result:** Exactly 9 entries returned. One for each: Sun (1), Moon (2), Mars (3), Mercury (4), Jupiter (5), Venus (6), Saturn (7), Rahu (8), Ketu (9).

### TC-010: Each planet has correct fields
- **User Story:** US-03
- **Priority:** High
- **Preconditions:** Authenticated user, existing horoscope
- **Steps:**
  1. Call endpoint with `includeCurrentPlanets=true`
  2. Inspect each entry in `currentPlanets` array
- **Expected Result:** Every entry has: `name` (number, 1–9), `sign` (number, 1–12), `degree` (number, 0–30), `absoluteDegree` (number, 0–360), `house` (number, 1–12, or null), `nakshatra` (number), `pada` (number, 1–4), `retrograde` (boolean), `combustion` (boolean), `strength` (PlanetaryStrength enum string). No missing or extra fields.

### TC-011: Same ayanamsha as birth chart
- **User Story:** US-03
- **Priority:** High
- **Preconditions:** Horoscope with ayanamsha = `raman`, fixed test timestamp
- **Steps:**
  1. Freeze `Date.now()` to known timestamp
  2. Compute birth chart with ayanamsha = `lahiri` and separately with `raman`
  3. Compute current planets with same two ayanamshas
  4. Compare sign assignments
- **Expected Result:** `lahiri` current planets have different sign/degree than `raman` current planets. The ayanamsha used for current planets matches the horoscope's `ayanamsha` field. Correction value applied consistently.

### TC-012: House mapping correctness
- **User Story:** US-03
- **Priority:** High
- **Preconditions:** Horoscope with known house cusp ranges (e.g., House 1: 0°–30°, House 2: 30°–60°, etc.)
- **Steps:**
  1. Freeze `Date.now()` to known timestamp where Sun's absolute degree is ~45°
  2. Call `computeCurrentPlanets()`
  3. Check Sun's `house` value
- **Expected Result:** Sun's `house` matches the cusp range containing its `absoluteDegree`. If `absoluteDegree` is 45° and House 2 spans 30°–60°, Sun's `house` is 2. All 9 houses are within 1–12 or null (null only if longitude falls outside all ranges — theoretically impossible).

### TC-013: Retrograde detection
- **User Story:** US-03
- **Priority:** Medium
- **Preconditions:** Fixed timestamp in a known Jupiter retrograde period (e.g., historical data)
- **Steps:**
  1. Freeze `Date.now()` to a date when Jupiter is known to be retrograde
  2. Call `computeCurrentPlanets()`
  3. Check retrograde flags for each planet
- **Expected Result:** Jupiter's `retrograde` is `true`. Rahu and Ketu have `retrograde: true`. Planets with positive speed (direct motion) have `retrograde: false`. Retrograde status matches speed sign (negative = retrograde).

### TC-014: Combustion detection
- **User Story:** US-03
- **Priority:** Medium
- **Preconditions:** Fixed timestamp where Mercury is near the Sun
- **Steps:**
  1. Freeze `Date.now()` to timestamp where Mercury is within 14° of Sun
  2. Call `computeCurrentPlanets()`
  3. Check combustion flags
- **Expected Result:** Mercury's `combustion` is `true`. Rahu and Ketu have `combustion: false`. Planets beyond their combustion orb from the Sun have `combustion: false`. Combustion detection uses correct orb per planet (Moon: 12°, Mars: 17°, Mercury: 14°, Jupiter: 11°, Venus: 10°, Saturn: 16°).

---

## UI/UX Tests

### TC-015: Toggle default OFF
- **User Story:** US-01
- **Priority:** High
- **Preconditions:** Authenticated user, horoscope with house chart, no FilterConfig saved
- **Steps:**
  1. Navigate to horoscope detail → Charts tab
  2. Select House chart type
  3. Observe toggle state
  4. Inspect chart and legend
- **Expected Result:** Toggle shows OFF position (knob left, `--border` background). Label reads "Show Current Planets" (EN) or "වත්මන් ග්‍රහ පිහිටීම් පෙන්වන්න" (SI). No current planet data loaded. Chart shows birth planets only. Legend shows only "Birth Planets" section. No API call to current-planets endpoint.

### TC-016: Toggle ON fetches and renders overlay
- **User Story:** US-01, US-02
- **Priority:** High
- **Preconditions:** Authenticated user, horoscope with house chart, toggle OFF
- **Steps:**
  1. Click toggle to turn ON
  2. Observe loading state
  3. Wait for data load
  4. Observe rendered chart
- **Expected Result:** Toggle switches to ON position (knob right, `--chart-transit` background). Loading spinner appears next to toggle label. API call fires to `GET /api/horoscope/:id/chart/house?includeCurrentPlanets=true`. After response: overlay renders 9 current planet symbols with sky-blue border and Sinhala letters. Birth planets remain visible. Legend updates to show both "Birth Planets" and "Current Planets (transit)" sections.

### TC-017: Toggle OFF hides overlay
- **User Story:** US-01
- **Priority:** High
- **Preconditions:** Overlay currently visible (toggle ON, data loaded)
- **Steps:**
  1. Click toggle to turn OFF
  2. Observe chart and legend
  3. Click toggle ON again
- **Expected Result:** Overlay hides instantly (no API call). Chart shows birth planets only. Legend reverts to birth-only view. Re-toggle ON uses cached data — overlay appears instantly, no loading spinner, no API call. Data retained in memory during OFF state.

### TC-018: Sinhala letters render for current planets
- **User Story:** US-02
- **Priority:** High
- **Preconditions:** Overlay visible, language set to Sinhala
- **Steps:**
  1. Observe each current planet symbol
  2. Compare to expected Sinhala first-letter map
- **Expected Result:** Current planet symbols are single Sinhala characters: ර (Sun), ස (Moon), ක (Mars), බ (Mercury), ග (Jupiter), ස (Venus), ශ (Saturn), ර (Rahu), ක (Ketu). Rendered in "Noto Sans Sinhala" font, bold weight. Characters are legible at 16–20px. Duplicate letters (ර for Sun/Rahu, ස for Moon/Venus, ක for Mars/Ketu) are distinguishable by position and fill color.

### TC-019: Current planet symbols have sky-blue border
- **User Story:** US-02
- **Priority:** High
- **Preconditions:** Overlay visible
- **Steps:**
  1. Inspect a current planet SVG element
  2. Compare to a birth planet SVG element
- **Expected Result:** Current planet symbols have a 2px solid stroke in `--chart-transit` color (`#0EA5E9` light mode / `#38BDF8` dark mode). Birth planet symbols have no stroke. Border does not clip or overflow the symbol bounds.

### TC-020: Birth planets use Unicode astrological glyphs
- **User Story:** US-02
- **Priority:** High
- **Preconditions:** Horoscope with calculated birth chart
- **Steps:**
  1. Toggle overlay ON
  2. Observe birth planet symbols
  3. Compare with current planet symbols
- **Expected Result:** Birth planets render as Unicode astrological glyphs: ☉ (Sun), ☽ (Moon), ♂ (Mars), ☿ (Mercury), ♃ (Jupiter), ♀ (Venus), ♄ (Saturn), ☊ (Rahu), ☋ (Ketu). No border/stroke. 100% opacity. Glyphs are visually distinct from the Sinhala letter symbols used for current planets.

### TC-021: Merged split symbol when degree difference < 2°
- **User Story:** US-02
- **Priority:** Medium
- **Preconditions:** Mock data where a current planet is within 2° of its birth counterpart in the same house
- **Steps:**
  1. Load chart with overlay ON
  2. Locate the merged planet position
  3. Inspect the merged symbol
- **Expected Result:** Merged symbol shows: left half = birth Unicode glyph, right half = current Sinhala first-letter. A sky-blue border (2px) surrounds the combined element. Tooltip on hover includes info for both planets. ARIA label announces merged state.

### TC-022: Separate symbols when degree difference >= 2° in same house
- **User Story:** US-02
- **Priority:** Medium
- **Preconditions:** Mock data where a current planet is >= 2° away from its birth counterpart in the same house
- **Steps:**
  1. Load chart with overlay ON
  2. Locate both symbols in the same house
- **Expected Result:** Two distinct symbols appear at their respective positions within the house: one Unicode glyph (birth) and one Sinhala letter (current). Each has its normal styling. They do not overlap or occlude each other.

### TC-023: Legend updates with current planet section
- **User Story:** US-02
- **Priority:** Medium
- **Preconditions:** Overlay visible
- **Steps:**
  1. Toggle overlay ON
  2. Observe legend
  3. Toggle overlay OFF
  4. Observe legend
- **Expected Result:** When ON: legend shows "Birth Planets" section with Unicode glyphs + "Current Planets (transit)" section with Sinhala letters. Current planet legend items have sky-blue border styling matching chart. When OFF: legend shows only "Birth Planets" section. Toggle state transitions match expected layout from UX spec.

### TC-024: Tooltip content for current planets
- **User Story:** US-05
- **Priority:** Medium
- **Preconditions:** Overlay visible, current planet data loaded
- **Steps:**
  1. Hover over a current planet symbol (desktop)
  2. Observe tooltip content
- **Expected Result:** Tooltip shows: planet name (localized) with "(Current)" / "(වත්මන්)" suffix, sign + degree (e.g., "Cancer 15° 32'"), house number, nakshatra + pada, strength label, retrograde/combust/direct status. Tooltip appears after 200ms delay, follows cursor with 12px offset. Max-width 280px (EN) / 320px (SI). Dismisses on mouse leave.

### TC-025: Tooltip header includes "(Current)" / "(Birth)" suffix
- **User Story:** US-02, US-05
- **Priority:** Medium
- **Preconditions:** Overlay visible
- **Steps:**
  1. Hover over a current planet → observe tooltip header
  2. Hover over a birth planet → observe tooltip header
- **Expected Result:** Current planet tooltip header: "Sun (Current)" / "රවි (වත්මන්)". Birth planet tooltip header: "Sun (Birth)" / "රවි (උපත්)". Suffix clearly distinguishes the two types.

### TC-026: Loading spinner appears during fetch
- **User Story:** US-01
- **Priority:** Medium
- **Preconditions:** API response artificially delayed (>500ms)
- **Steps:**
  1. Click toggle ON
  2. Observe toggle and chart during loading
- **Expected Result:** Small spinner (16px) appears next to toggle label. Toggle is ON but temporarily disabled (pointer-events: none, reduced opacity). Birth chart remains fully visible. No overlay shown yet. Loading label appended: "(Loading current planets...)" / "(වත්මන් ග්‍රහ බාරගනිමින්...)".

### TC-027: Error banner with retry on API failure
- **User Story:** US-01
- **Priority:** Medium
- **Preconditions:** API endpoint mocked to return 500 or timeout
- **Steps:**
  1. Click toggle ON
  2. Wait for API failure
  3. Observe error state
  4. Click "Retry"
- **Expected Result:** Error banner appears below toggle with warning icon, localized message ("Unable to load current planetary positions. Please try again." / "වත්මන් ග්‍රහ පිහිටීම් පූරණය කළ නොහැක. නැවත උත්සාහ කරන්න."), and "Retry" / "නැවත උත්සාහ කරන්න" button. Toggle reverts to OFF. Banner auto-dismisses after 10s. Clicking Retry re-fetches data. On success: banner removed, overlay shown.

### TC-028: Toggle disabled during loading
- **User Story:** US-01
- **Priority:** Medium
- **Preconditions:** API response artificially delayed
- **Steps:**
  1. Click toggle ON
  2. Immediately try clicking toggle again
  3. Wait for data load
- **Expected Result:** Second click is a no-op during loading. Toggle remains visually ON. After data loads, toggle is interactive again. No duplicate API calls fired.

---

## Persistence Tests

### TC-029: Toggle state saved to FilterConfig
- **User Story:** US-06
- **Priority:** Low
- **Preconditions:** Authenticated user, existing FilterConfig document
- **Steps:**
  1. Toggle current planets ON
  2. Wait 500ms (debounce)
  3. Check FilterConfig in database
  4. Toggle OFF
  5. Wait 500ms
  6. Check FilterConfig again
- **Expected Result:** After toggling ON: FilterConfig `currentPlanetPositions` is `true`. After toggling OFF: `currentPlanetPositions` is `false`. No duplicate FilterConfig created. Existing fields unchanged.

### TC-030: Preference restored on page reload
- **User Story:** US-06
- **Priority:** Low
- **Preconditions:** FilterConfig has `currentPlanetPositions: true`
- **Steps:**
  1. Toggle ON (saved to FilterConfig)
  2. Refresh page
  3. Navigate to House chart
- **Expected Result:** Toggle is ON on page load. Current planet data is fetched automatically (birth chart loads first, then current planet overlay appears after API response). No additional user action needed.

### TC-031: Default preference is OFF for new users
- **User Story:** US-06
- **Priority:** Low
- **Preconditions:** New user with no FilterConfig document
- **Steps:**
  1. Log in as new user
  2. Navigate to House chart
  3. Observe toggle state
- **Expected Result:** Toggle is OFF. No FilterConfig document created solely for current planets toggle. Birth chart renders normally. Toggle label reads default text.

---

## Accessibility Tests

### TC-032: Toggle has role="switch" with aria-checked
- **User Story:** US-01
- **Priority:** High
- **Preconditions:** House chart loaded, overlay not yet activated
- **Steps:**
  1. Inspect toggle element with browser devtools
  2. Toggle ON and re-inspect
  3. Toggle OFF and re-inspect
- **Expected Result:** Toggle container has `role="switch"` and dynamic `aria-checked` (`true` when ON, `false` when OFF). Toggle label has `aria-label` with descriptive text in current language. Loading state sets `aria-busy="true"`. Error state links message via `aria-describedby`.

### TC-033: Screen reader announcements for state changes
- **User Story:** US-01
- **Priority:** Medium
- **Preconditions:** Screen reader active (NVDA/JAWS), House chart loaded
- **Steps:**
  1. Toggle ON → listen to announcement
  2. Wait for data load → listen to announcement
  3. Toggle OFF → listen to announcement
- **Expected Result:** Toggle ON: "Current planetary positions enabled. Loading current planet data." / "වත්මන් ග්‍රහ පිහිටීම් සක්‍රිය කරන ලදී. වත්මන් ග්‍රහ දත්ත බාරගනිමින්." Data loaded: "Current planetary positions loaded. 9 planets displayed." / "වත්මන් ග්‍රහ පිහිටීම් බාරගනු ලැබීය. ග්‍රහයින් 9 ක් පෙන්වයි." Toggle OFF: "Current planetary positions hidden." / "වත්මන් ග්‍රහ සැඟවුණි." Error: appropriate error announcement with retry available. Announcements use `aria-live="polite"` region.

### TC-034: Keyboard navigation for toggle and tooltips
- **User Story:** US-01
- **Priority:** Medium
- **Preconditions:** House chart loaded, no mouse input
- **Steps:**
  1. Tab through page to reach toggle
  2. Press Enter/Space to toggle ON
  3. Wait for data load
  4. Tab to a current planet symbol
  5. Press Enter/Space
  6. Press Escape
- **Expected Result:** Toggle receives focus with visible focus ring. Enter/Space toggles ON/OFF. After data loads, Tab navigates through planet symbols in the chart. Enter/Space on a planet shows tooltip. Escape closes tooltip and returns focus to planet. Focus order: toggle → chart planets → legend.

### TC-035: Three independent visual channels differentiate birth vs current planets
- **User Story:** US-02
- **Priority:** High
- **Preconditions:** Overlay visible, WCAG analyzer running
- **Steps:**
  1. Inspect a birth planet and a current planet CSS/SVG properties
  2. Verify differences in symbol type, border, and opacity
- **Expected Result:** Three channels differentiate the two types: (1) Symbol type: Unicode astrological glyph (birth) vs Sinhala first-letter (current). (2) Border: none (birth) vs 2px sky-blue stroke (current). (3) Opacity: 100% (birth) vs 85% (current). This satisfies WCAG 2.1 Success Criterion 1.4.1 (Use of Color) since information is not conveyed by color alone — any single channel is sufficient for differentiation.

### TC-036: Sinhala font renders correctly for planet letters
- **User Story:** US-02
- **Priority:** Medium
- **Preconditions:** Overlay visible, language set to Sinhala
- **Steps:**
  1. Inspect current planet text elements in SVG
  2. Verify font-family property
- **Expected Result:** Text elements use `font-family="Noto Sans Sinhala"` with `font-weight="bold"`. Sinhala characters render correctly without tofu boxes or fallback font substitution. Characters are vertically and horizontally centered within their containing circle.

---

## Performance Tests

### TC-037: Ephemeris calculation completes in <500ms
- **User Story:** US-03
- **Priority:** Medium
- **Preconditions:** Jest environment with timer mocking, ephemeris library available
- **Steps:**
  1. Call `computeCurrentPlanets()` 10 times
  2. Record execution time for each call
  3. Calculate p95 latency
- **Expected Result:** p95 execution time <500ms. Individual calls complete without timeout. No memory leak across repeated calls. Cold start (first call) may be slower but still <1000ms.

### TC-038: Chart endpoint without param responds in <100ms
- **User Story:** US-04
- **Priority:** Medium
- **Preconditions:** Authenticated user, existing horoscope
- **Steps:**
  1. Send GET `/api/horoscope/:id/chart/house` 10 times
  2. Measure p95 response time
- **Expected Result:** p95 response time <100ms. No currentPlanets computation triggered.

### TC-039: Chart endpoint with param responds in <600ms
- **User Story:** US-04
- **Priority:** Medium
- **Preconditions:** Authenticated user, existing horoscope
- **Steps:**
  1. Send GET `/api/horoscope/:id/chart/house?includeCurrentPlanets=true` 10 times
  2. Measure p95 response time
- **Expected Result:** p95 response time <600ms. The additional ~200–500ms over baseline is from ephemeris computation.

### TC-040: Concurrent requests handled without errors
- **User Story:** US-03
- **Priority:** Low
- **Preconditions:** Authenticated user, existing horoscope, load testing tool (k6 or Artillery)
- **Steps:**
  1. Send 10 simultaneous GET requests to `/api/horoscope/:id/chart/house?includeCurrentPlanets=true`
  2. Measure p99 response time
  3. Check for errors
- **Expected Result:** All 10 requests complete. No 5xx errors. p99 response time <2000ms. No request timeout. Rate limiting not triggered (10 < 30 req/min). Event loop does not remain blocked for >5000ms.

---

## Bilingual Tests

### TC-041: Toggle label in English and Sinhala
- **User Story:** US-01, US-14
- **Priority:** Medium
- **Preconditions:** House chart loaded
- **Steps:**
  1. Switch language to English
  2. Observe toggle label
  3. Switch language to Sinhala
  4. Observe toggle label
- **Expected Result:** English: "Show Current Planets". Sinhala: "වත්මන් ග්‍රහ පිහිටීම් පෙන්වන්න". Label updates immediately on language switch without page reload. Sinhala text does not overflow its container (min-width accommodates ~30% wider text). Loading and error labels also localized.

### TC-042: Legend labels in English and Sinhala
- **User Story:** US-02, US-14
- **Priority:** Medium
- **Preconditions:** Overlay visible
- **Steps:**
  1. Switch language to English, toggle ON
  2. Observe legend section headers
  3. Switch language to Sinhala
  4. Observe legend section headers
- **Expected Result:** English: "Birth Planets" and "Current Planets (transit)". Sinhala: "උපත් ග්‍රහයින්" and "වත්මන් ග්‍රහයින් (ගමන්)". Section headers update immediately on language switch. Planet names in legend entries also localized.

### TC-043: Tooltip content localized
- **User Story:** US-05, US-14
- **Priority:** Medium
- **Preconditions:** Overlay visible
- **Steps:**
  1. Hover over a current planet in English mode
  2. Note all tooltip text
  3. Switch to Sinhala mode
  4. Hover over same planet
  5. Compare tooltip content
- **Expected Result:** English: header "Sun (Current)", sign "Cancer", house "House 7", nakshatra "Pushya (Pada 3)", strength "Uchcha (Exalted)", status "Direct"/"Retrograde"/"Combust". Sinhala: header "රවි (වත්මන්)", sign "කටක", house "භාව 7", nakshatra "පුෂ්ය (පාද 3)", strength "උච්ච (උත්කෘෂ්ට)", status "සෘජු"/"ප්‍රත්‍යන්ත"/"දහන". All fields translated. Tooltip width accommodates Sinhala text (320px max-width).

---

## Edge Cases

### TC-044: Full merge rendering (all planets at birth positions)
- **User Story:** US-02
- **Priority:** Low
- **Preconditions:** Mock data where all 9 current planets are within 2° of their birth counterparts
- **Steps:**
  1. Load chart with overlay ON
  2. Observe each planet position
- **Expected Result:** Each planet position shows a merged split symbol (glyph left + Sinhala letter right + sky-blue border). No separate birth/current symbols. All 9 merged symbols are legible without overlap. Tooltip on merged symbol shows both birth and current info.

### TC-045: House boundary longitude
- **User Story:** US-03
- **Priority:** Low
- **Preconditions:** Horoscope with house cusp at exact 0° Aries boundary, timestamp where a planet's longitude is exactly at a cusp
- **Steps:**
  1. Freeze `Date.now()` to timestamp where a planet's longitude equals a house cusp boundary value
  2. Call `computeCurrentPlanets()`
- **Expected Result:** Planet's `house` is assigned to the house whose range includes the boundary value (consistent with birth chart house assignment). `house` is never null for valid longitudes. No off-by-one errors at 0°/360° wrapping.

### TC-046: Network timeout during fetch
- **User Story:** US-01
- **Priority:** Low
- **Preconditions:** API endpoint mocked to hang (no response for 30s)
- **Steps:**
  1. Click toggle ON
  2. Wait for timeout
- **Expected Result:** After ~10s timeout (or Fetch API timeout), error banner appears with "Unable to load current planetary positions. Please try again." Toggle reverts to OFF. No hanging spinner. User can retry. Browser console shows fetch error (no unhandled promise rejection).

### TC-047: Very old horoscope ayanamsha
- **User Story:** US-03
- **Priority:** Low
- **Preconditions:** Horoscope created with ayanamsha = `yukteshwar` (least common), birth year = 1900
- **Steps:**
  1. Call endpoint with `includeCurrentPlanets=true`
  2. Verify current planet positions
- **Expected Result:** Current planets computed correctly using `yukteshwar` ayanamsha. Ayanamsha correction applied. House mapping works (birth house cusps were computed with same ayanamsha). No NaN or null values in any field.

### TC-048: Rate limit exceeded (429)
- **User Story:** US-04
- **Priority:** Low
- **Preconditions:** Rate limiter configured, 30 requests already sent in current window
- **Steps:**
  1. Send 31st request to `/api/horoscope/:id/current-planets` within the rate limit window
  2. Observe response
- **Expected Result:** Response is 429 with `Retry-After` header. Body contains error message. No ephemeris computation performed. Client shows error banner. After rate limit window expires, next request succeeds.

### TC-049: Combustion and retrograde visual rendering
- **User Story:** US-02, US-05
- **Priority:** Low
- **Preconditions:** Mock data where Mercury is combust and Jupiter is retrograde
- **Steps:**
  1. Load chart with overlay ON
  2. Locate Mercury (combust) and Jupiter (retrograde)
  3. Hover over each
- **Expected Result:** Combust planet: tooltip shows "Status: Combust" / "තත්වය: දහන". No special visual indicator on the symbol itself (combustion is indicated in tooltip and strength evaluation only). Retrograde planet: tooltip shows "Status: Retrograde" / "තත්වය: ප්‍රත්‍යන්ත". Symbol renders normally with sky-blue border and Sinhala letter. No retrograde indicator symbol on the chart (status is tooltip-only).

---

## Summary

| Category | Test Cases | Priority Breakdown |
|----------|-----------|-------------------|
| API Tests | TC-001 to TC-008 | High: 5, Medium: 3 |
| Calculation Tests | TC-009 to TC-014 | High: 4, Medium: 2 |
| UI/UX Tests | TC-015 to TC-028 | High: 6, Medium: 8 |
| Persistence Tests | TC-029 to TC-031 | Low: 3 |
| Accessibility Tests | TC-032 to TC-036 | High: 2, Medium: 3 |
| Performance Tests | TC-037 to TC-040 | Medium: 3, Low: 1 |
| Bilingual Tests | TC-041 to TC-043 | Medium: 3 |
| Edge Cases | TC-044 to TC-049 | Low: 6 |

**Total: 49 test cases** (TC-001 through TC-049)
