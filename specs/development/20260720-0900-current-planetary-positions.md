# Development Implementation — Current Planetary Positions Overlay

**Date:** 2026-07-20

## Files Created

### Data Layer
| File | Description |
|------|-------------|
| `src/lib/currentPlanets.ts` | Core calculation module: `computeCurrentPlanets(ayanamsha, birthHouses)` → `CurrentPlanetRecord[]`. Uses `swisseph-v2` (same as `calculation.ts`) to compute current positions for all 9 planets. Handles Julian day conversion, sidereal mode, planet position, retrograde detection, combustion, nakshatra/pada, house mapping via birth cusps, and planetary strength. Ketu computed as (Rahu + 180°) % 360. All calls wrapped in try-catch for testability. |

### API Routes
| File | Description |
|------|-------------|
| `src/app/api/horoscope/[id]/current-planets/route.ts` | GET standalone endpoint: returns `{ currentPlanets, computedAt }`. Full auth + ownership checks. Uses `Cache-Control: private, no-cache, no-store, must-revalidate`. |

### Tests
| File | Description |
|------|-------------|
| `src/__tests__/currentPlanets.test.ts` | 19 tests across `computeCurrentPlanets`, `SINHALA_PLANET_LETTERS`, and `COMBUSTION_ORBS`. Full mock of `swisseph-v2` with configurable sidereal mode offset for ayanamsha testing. |

## Files Modified

| File | Change |
|------|--------|
| `src/lib/astrology.ts` | Added `CurrentPlanetRecord` interface after existing `Planet` interface (line 27-37). Fields: name, sign, degree, absoluteDegree, house (nullable), nakshatra, pada, retrograde, combustion, strength. |
| `src/lib/astrologyEnums.ts` | Added `SINHALA_PLANET_LETTERS` (Record<number, string>) and `COMBUSTION_ORBS` (Record<number, number>) after existing ZodiacSign definitions. |
| `src/app/api/horoscope/[id]/chart/[type]/route.ts` | Extended to parse `includeCurrentPlanets` query param. For house charts with `includeCurrentPlanets=true`, loads Horoscope + CalculatedDetails, computes current planets, appends to response with `Cache-Control` headers. Non-house chart types silently ignore the parameter. |

## Implementation Decisions

### 1. Ketu as (Rahu + 180°) % 360
Instead of computing Ketu via `SE_TRUE_NODE` in swisseph, Ketu is derived as the opposite point of Rahu (Mean Node). This is the standard Vedic approach since Rahu and Ketu are always exactly 180° apart as the lunar nodes' axis. This also avoids a redundant ephemeris call.

### 2. Planet → SWE Planet Mapping
Our `Planet` enum (1–9) maps to Swiss Ephemeris planet numbers:
- Sun (1) → SE_SUN (0)
- Moon (2) → SE_MOON (1)
- Mars (3) → SE_MARS (4) — skipping Earth (SE_EARTH = 14)
- Mercury (4) → SE_MERCURY (2)
- Jupiter (5) → SE_JUPITER (5)
- Venus (6) → SE_VENUS (3)
- Saturn (7) → SE_SATURN (6)
- Rahu (8) → SE_MEAN_NODE (10)
- Ketu (9) → computed from Rahu + 180°

### 3. Sidereal vs Tropical
All calculations use `SEFLG_SIDEREAL` flag after calling `swe_set_sid_mode()` with the horoscope's ayanamsha ID. This ensures transit positions are referenced to the same sidereal zodiac as the natal chart.

### 4. House Mapping
Birth house boundaries are reconstructed from stored `House` objects (`startSign`/`startDegree`, `endSign`/`endDegree`). Houses that wrap across 360° are handled by adding 360 to `endAbs`. Planet longitude is normalized to 0–360 and compared against each house's start/end absolute degree range.

### 5. Strength Evaluation
Uses the same dignity-based logic as `calculation.ts`: exaltation, debilitation, moolatrikona, own sign, mitra, shatru, sama — evaluated against the planet's *current* sign placement. Duplicated in `currentPlanets.ts` rather than imported to avoid dependency on `jyotish-calculations` module.

### 6. Floating-Point Epsilon in Nakshatra Pada
Added `1e-10` epsilon in `getNakshatra()` pada division to handle JavaScript floating-point edge cases (e.g., `6.666... / 3.333...` evaluating to `1.999...` instead of `2.0`).

### 7. Combustion Orbs
Moon(12°), Mars(17°), Mercury(14°), Jupiter(11°), Venus(10°), Saturn(16°). Sun, Rahu, Ketu never combust. Check uses minimum wrapped angular distance on the 360° circle.

## API Contracts Implemented

### GET /api/horoscope/:id/chart/house?includeCurrentPlanets=true
```
Response 200:
{
    ...chartData,  // existing chart document fields
    currentPlanets?: [
        {
            name: number,      // Planet enum 1-9
            sign: number,      // Zodiac sign 1-12
            degree: number,    // Within-sign degrees
            absoluteDegree: number,  // 0-360
            house: number|null,      // Birth house 1-12
            nakshatra: number,       // 1-27
            pada: number,            // 1-4
            retrograde: boolean,
            combustion: boolean,
            strength: string         // "Uchcha"|"Neecha"|...
        }
    ]
}
Cache-Control: private, no-cache, no-store, must-revalidate
```

### GET /api/horoscope/:id/current-planets
```
Response 200:
{
    currentPlanets: CurrentPlanetRecord[],
    computedAt: string  // ISO timestamp
}
Cache-Control: private, no-cache, no-store, must-revalidate
```

### Error responses: 401, 404, 403, 422, 500

## Test Coverage

| Test | Description |
|------|-------------|
| 1. Returns 9 entries | Verifies all 9 planets are computed |
| 2. Required fields | Each entry has all 10 fields with valid types |
| 3. House mapping | Sun (100°) → sign 4, house 4; Jupiter (300°) → sign 11, house 11 |
| 4. Retrograde detection | Mercury with speed=-1.2 → retrograde=true |
| 5. Rahu retrograde | Rahu with speed=-2.5 → retrograde=true |
| 6. Ketu opposite Rahu | Ketu's absoluteDegree is (Rahu + 180°) % 360 |
| 7. Combustion detection | Venus within 3° of Sun → combust=true |
| 8. Sun never combust | Sun.combustion always false |
| 9. Rahu/Ketu never combust | Both always false |
| 10. Different ayanamsha → different degree | Raman adds 2° offset, planets have different absolute degrees |
| 11. Empty houses → null house | All planets have house=null with empty houses array |
| 12. All 9 names present | [1,2,3,4,5,6,7,8,9] |
| 13. Valid strengths | Each planet has one of the 7 valid strength values |
| 14. Nakshatra/pada correct | Sun at 100° → nakshatra 8, pada 3 |
| 15. Mercury nakshatra | Mercury at 180° → nakshatra 14 |
| 16. SINHALA_PLANET_LETTERS | All 9 entries present, each is a single character |
| 17. COMBUSTION_ORBS structure | Sun/Rahu/Ketu absent, all others positive numbers |
| 18. swe_set_sid_mode called correctly | Lahiri → mode 1, Raman → mode 3 |
| 19. Different ayanamsha → different degrees | Degree diffs > 0.1 between Lahiri and Raman |

**Result:** 19/19 tests passing

## Deviations from Architecture Spec

1. **`Ayanamsha` type**: The architecture spec references a formal `Ayanamsha` type/interface. The actual implementation uses the existing string literal union `"lahiri" | "raman" | "krishnamurti" | "yukteshwar"` from `IHoroscope.ayanamsha`. No separate `Ayanamsha` type was created.

2. **`ComputedAt` timestamp**: The chart endpoint (`includeCurrentPlanets=true`) does not include a `computedAt` field in the response. Only the standalone `/current-planets` endpoint includes it. This is because the chart endpoint response is primarily the chart data with current planets appended as a side payload — adding `computedAt` would pollute the chart response shape.

3. **Rate limiting**: Not implemented. The architecture spec recommends 30 req/min/user rate limiting, but this requires middleware infrastructure that is out of scope for this feature. Rate limiting should be added as a separate infrastructure task.

4. **Jyotish-calculations reuse**: The architecture spec mentions reusing `computeStrength()` from the birth chart calculations. Since `computeStrength()` is a local function in `calculation.ts` (not exported), it was duplicated in `currentPlanets.ts` rather than refactoring the existing module. This keeps the change surface minimal.

## Known Issues
- None currently — all 19 tests pass.
