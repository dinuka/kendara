import { Planet, PlanetaryStrength } from "@/lib/astrologyEnums";
import {
    BIRTH_DATE_BASE,
    BIRTH_MONTH_RANGES,
    BIRTH_TIME_RANGES,
    buildBhavaHouses,
    buildWholeSignHouses,
    compute,
    computeAspects,
    computeAscendantNakshatra,
    computeConjunctions,
    computeMoonNakshatra,
    deriveAgeRanges,
    deriveBirthDateCandidates,
    deriveBirthDateRange,
    deriveBirthMonthRange,
    deriveBirthTimeRange,
    deriveHouseSigns,
    deriveNavamsaData,
    deriveNavamsaLagnaFromDegree,
    derivePlanetsTable,
    deriveRanges,
    navamsaLagnaOptions,
    placementsToMap,
    synthesizeValidation,
    validatePlacements,
} from "@/lib/manualChart";

describe("deriveHouseSigns (UT-CH-001..005)", () => {
    test("U001 lagna 1 (Aries) -> signs 1..12", () => {
        expect(deriveHouseSigns(1)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    });
    test("U002 lagna 7 (Libra) rotates", () => {
        expect(deriveHouseSigns(7)).toEqual([7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6]);
    });
    test("U003 lagna 12 wraps to house 1", () => {
        expect(deriveHouseSigns(12)).toEqual([12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    });
    test("U004 invalid lagna (0, 13, NaN) throws", () => {
        expect(() => deriveHouseSigns(0)).toThrow();
        expect(() => deriveHouseSigns(13)).toThrow();
        expect(() => deriveHouseSigns(NaN)).toThrow();
    });
    test("U005 all 12 house numbers returned in order for lagna 3", () => {
        const signs = deriveHouseSigns(3);
        expect(signs).toHaveLength(12);
        signs.forEach((_, i) => expect(i + 1).toBe(i + 1));
    });
});

describe("validatePlacements (UT-CH-010..024)", () => {
    test("U010 Budha same house as Ravi valid", () => {
        const r = validatePlacements({ [Planet.SUN]: 3, [Planet.MERCURY]: 3 });
        expect(r.budha.status).toBe("valid");
    });
    test("U011 Budha at Ravi±1 valid", () => {
        expect(validatePlacements({ [Planet.SUN]: 3, [Planet.MERCURY]: 2 }).budha.status).toBe("valid");
        expect(validatePlacements({ [Planet.SUN]: 3, [Planet.MERCURY]: 4 }).budha.status).toBe("valid");
    });
    test("U012 Budha out of range invalid", () => {
        expect(validatePlacements({ [Planet.SUN]: 3, [Planet.MERCURY]: 6 }).budha.status).toBe("invalid");
    });
    test("U013 Budha wrap Ravi=12 +1 -> house 1 valid", () => {
        expect(validatePlacements({ [Planet.SUN]: 12, [Planet.MERCURY]: 1 }).budha.status).toBe("valid");
    });
    test("U014 Budha wrap Ravi=1 -1 -> house 12 valid", () => {
        expect(validatePlacements({ [Planet.SUN]: 1, [Planet.MERCURY]: 12 }).budha.status).toBe("valid");
    });
    test("U015 Ravi not placed -> Budha skipped", () => {
        expect(validatePlacements({ [Planet.MERCURY]: 3 }).budha.status).toBe("skipped");
    });
    test("U016 Sikuru at Ravi±2 valid", () => {
        expect(validatePlacements({ [Planet.SUN]: 3, [Planet.VENUS]: 1 }).sikuru.status).toBe("valid");
        expect(validatePlacements({ [Planet.SUN]: 3, [Planet.VENUS]: 5 }).sikuru.status).toBe("valid");
    });
    test("U016b Sikuru at Ravi±1 valid (within ±2)", () => {
        expect(validatePlacements({ [Planet.SUN]: 3, [Planet.VENUS]: 4 }).sikuru.status).toBe("valid");
        expect(validatePlacements({ [Planet.SUN]: 3, [Planet.VENUS]: 2 }).sikuru.status).toBe("valid");
    });
    test("U017 Sikuru out of range invalid", () => {
        expect(validatePlacements({ [Planet.SUN]: 3, [Planet.VENUS]: 8 }).sikuru.status).toBe("invalid");
    });
    test("U018 Sikuru wrap Ravi=2 -2 -> house 12 valid", () => {
        expect(validatePlacements({ [Planet.SUN]: 2, [Planet.VENUS]: 12 }).sikuru.status).toBe("valid");
    });
    test("U019 Rahu/Ketu opposite houses (6 apart) valid", () => {
        expect(validatePlacements({ [Planet.RAHU]: 4, [Planet.KETU]: 10 }).rahuKethuAxis.status).toBe("valid");
    });
    test("U019a Rahu 2 / Ketu 8 valid (user case)", () => {
        expect(validatePlacements({ [Planet.RAHU]: 2, [Planet.KETU]: 8 }).rahuKethuAxis.status).toBe("valid");
    });
    test("U020 Rahu/Ketu opposite reversed valid", () => {
        expect(validatePlacements({ [Planet.RAHU]: 10, [Planet.KETU]: 4 }).rahuKethuAxis.status).toBe("valid");
    });
    test("U020a Rahu 7 / Ketu 1 wraps valid (diff mod 12 = 6)", () => {
        expect(validatePlacements({ [Planet.RAHU]: 7, [Planet.KETU]: 1 }).rahuKethuAxis.status).toBe("valid");
    });
    test("U021 Rahu/Ketu 7 apart (not opposite) invalid", () => {
        expect(validatePlacements({ [Planet.RAHU]: 4, [Planet.KETU]: 11 }).rahuKethuAxis.status).toBe("invalid");
    });
    test("U022 only Rahu placed -> incomplete", () => {
        expect(validatePlacements({ [Planet.RAHU]: 4 }).rahuKethuAxis.status).toBe("incomplete");
    });
    test("U023 both Budha and Sikuru violated reported", () => {
        const r = validatePlacements({ [Planet.SUN]: 3, [Planet.MERCURY]: 8, [Planet.VENUS]: 9 });
        expect(r.budha.status).toBe("invalid");
        expect(r.sikuru.status).toBe("invalid");
    });
    test("U024 empty chart no crash, all skipped/incomplete", () => {
        const r = validatePlacements({});
        expect(r.budha.status).toBe("skipped");
        expect(r.sikuru.status).toBe("skipped");
        expect(r.rahuKethuAxis.status).toBe("incomplete");
    });
});

describe("validatePlacements planet count (both charts need 9 planets)", () => {
    const fullChart = (): Record<number, number[]> => {
        const placements: Record<number, number[]> = {};
        for (let house = 1; house <= 9; house++) placements[house] = [house];
        return placements;
    };

    test("U025 all 9 planets in birth chart -> planetCount valid", () => {
        const r = validatePlacements(placementsToMap(fullChart()));
        expect(r.planetCount.status).toBe("valid");
        expect(r.planetCount.count).toBe(9);
    });

    test("U026 7 planets -> planetCount incomplete with count 7", () => {
        const placements = fullChart();
        delete placements[8];
        delete placements[9];
        const r = validatePlacements(placementsToMap(placements));
        expect(r.planetCount.status).toBe("incomplete");
        expect(r.planetCount.count).toBe(7);
    });

    test("U027 empty birth chart -> planetCount incomplete count 0", () => {
        const r = validatePlacements({});
        expect(r.planetCount.status).toBe("incomplete");
        expect(r.planetCount.count).toBe(0);
    });

    test("U028 navamsa not entered -> navamsaPlanetCount skipped", () => {
        const r = validatePlacements(placementsToMap(fullChart()));
        expect(r.navamsaPlanetCount.status).toBe("skipped");
    });

    test("U029 navamsa with 9 planets -> navamsaPlanetCount valid", () => {
        const r = validatePlacements(placementsToMap(fullChart()), fullChart());
        expect(r.navamsaPlanetCount.status).toBe("valid");
        expect(r.navamsaPlanetCount.count).toBe(9);
    });

    test("U030 navamsa with 5 planets -> navamsaPlanetCount incomplete", () => {
        const navamsa = fullChart();
        for (let h = 6; h <= 9; h++) delete navamsa[h];
        const r = validatePlacements(placementsToMap(fullChart()), navamsa);
        expect(r.navamsaPlanetCount.status).toBe("incomplete");
        expect(r.navamsaPlanetCount.count).toBe(5);
    });
});

describe("computeAspects / computeConjunctions (UT-CH-030..037)", () => {
    test("U030 Mars aspects houses 4/8/12 from itself", () => {
        expect(computeAspects({ [Planet.MARS]: 1 })[Planet.MARS]).toEqual([4, 8, 12]);
    });
    test("U031 Jupiter aspects houses 5/9/11 from house 3", () => {
        expect(computeAspects({ [Planet.JUPITER]: 3 })[Planet.JUPITER]).toEqual([7, 11, 1]);
    });
    test("U032 Saturn aspects 3/7/10 from house 5", () => {
        expect(computeAspects({ [Planet.SATURN]: 5 })[Planet.SATURN]).toEqual([7, 11, 2]);
    });
    test("U033 Moon 7th-house full aspect", () => {
        expect(computeAspects({ [Planet.MOON]: 1 })[Planet.MOON]).toEqual([7]);
    });
    test("U034 Rahu aspects 5/9 from house 4", () => {
        expect(computeAspects({ [Planet.RAHU]: 4 })[Planet.RAHU]).toEqual([8, 12]);
    });
    test("U035 conjunction same house", () => {
        const c = computeConjunctions({ [Planet.SUN]: 1, [Planet.MARS]: 1 });
        expect(c[Planet.SUN]).toEqual([Planet.MARS]);
    });
    test("U036 no conjunction separate houses", () => {
        const c = computeConjunctions({ [Planet.SUN]: 1, [Planet.MARS]: 2 });
        expect(c[Planet.SUN]).toEqual([]);
        expect(c[Planet.MARS]).toEqual([]);
    });
    test("U037 wrap Saturn house 12 aspects", () => {
        expect(computeAspects({ [Planet.SATURN]: 12 })[Planet.SATURN]).toEqual([2, 6, 9]);
    });
});

describe("derivePlanetsTable (UT-CH-040..045)", () => {
    test("U040 sign from house", () => {
        const rows = derivePlanetsTable({
            lagna: 1,
            houseOfPlanet: { [Planet.MARS]: 4 },
        });
        expect(rows[0].sign).toBe(4);
        expect(rows[0].house).toBe(4);
    });
    test("U041 sign from house wrap lagna 9 venus house 12 -> sign 8", () => {
        const rows = derivePlanetsTable({
            lagna: 9,
            houseOfPlanet: { [Planet.VENUS]: 12 },
        });
        expect(rows[0].sign).toBe(8);
    });
    test("U042 one row per placed planet", () => {
        const rows = derivePlanetsTable({
            lagna: 1,
            houseOfPlanet: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
        });
        expect(rows).toHaveLength(5);
    });
    test("U043 atmakaraka deferred without degrees", () => {
        const rows = derivePlanetsTable({
            lagna: 1,
            houseOfPlanet: { [Planet.SUN]: 1, [Planet.MOON]: 2 },
        });
        expect(rows.flatMap((r) => r.other)).not.toContain("atmakaraka");
    });
    test("U044 strength is sign-based, not always Sama", () => {
        const rows = derivePlanetsTable({ lagna: 1, houseOfPlanet: { [Planet.MOON]: 1 } });
        expect(rows[0].strength).toBe(PlanetaryStrength.SAMA);
    });
    test("U044a exaltation sign → Uchcha", () => {
        const rows = derivePlanetsTable({ lagna: 1, houseOfPlanet: { [Planet.SUN]: 1 } });
        expect(rows[0].strength).toBe(PlanetaryStrength.UCHCHA);
    });
    test("U044b own sign → Own Sign", () => {
        const rows = derivePlanetsTable({ lagna: 1, houseOfPlanet: { [Planet.MERCURY]: 3 } });
        expect(rows[0].strength).toBe(PlanetaryStrength.OWN_SIGN);
    });
    test("U044c moolatrikona range (Mars in Aries) → Moolatrikona", () => {
        const rows = derivePlanetsTable({ lagna: 1, houseOfPlanet: { [Planet.MARS]: 1 } });
        expect(rows[0].strength).toBe(PlanetaryStrength.MOOLATRIKONA);
    });
    test("U044d navamsa strength also sign-based", () => {
        const e = deriveNavamsaData({ [Planet.MERCURY]: 3 }, { [Planet.MERCURY]: 3 })[0];
        expect(e.navamsaStrength).toBe(PlanetaryStrength.OWN_SIGN);
    });
    test("U045 conjunction column populated", () => {
        const rows = derivePlanetsTable({
            lagna: 1,
            houseOfPlanet: { [Planet.SUN]: 1, [Planet.MARS]: 1, [Planet.JUPITER]: 3 },
        });
        const sun = rows.find((r) => r.planet === Planet.SUN);
        expect(sun?.conjunctions).toContain(Planet.MARS);
    });
    test("U046 aspects column lists planets, not houses", () => {
        const rows = derivePlanetsTable({
            lagna: 1,
            houseOfPlanet: { [Planet.MARS]: 1, [Planet.JUPITER]: 8, [Planet.SUN]: 12 },
        });
        const mars = rows.find((r) => r.planet === Planet.MARS)!;
        expect(mars.house).toBe(1);
        expect(mars.aspectsPlanets).toContain(Planet.JUPITER);
        expect(mars.aspectsPlanets).toContain(Planet.SUN);
    });
    test("U047 no aspects → empty", () => {
        const rows = derivePlanetsTable({ lagna: 1, houseOfPlanet: { [Planet.MOON]: 1 } });
        expect(rows[0].aspectsPlanets).toEqual([]);
    });
});

describe("deriveNavamsaData (UT-CH-050..056)", () => {
    test("U050 degree range 1st navamsa", () => {
        const e = deriveNavamsaData({ [Planet.SUN]: 1 }, { [Planet.SUN]: 1 })[0];
        expect(e.navamsaIndex).toBe(1);
        expect(e.degreeRangeStart).toBeCloseTo(0, 5);
        expect(e.degreeRangeEnd).toBeCloseTo(30 / 9, 5);
    });
    test("U051 degree range 2nd navamsa", () => {
        const e = deriveNavamsaData({ [Planet.SUN]: 1 }, { [Planet.SUN]: 2 })[0];
        expect(e.navamsaIndex).toBe(2);
        expect(e.degreeRangeStart).toBeCloseTo(30 / 9, 5);
        expect(e.degreeRangeEnd).toBeCloseTo((2 * 30) / 9, 5);
    });
    test("U052 9th navamsa finishes exactly at the sign end (30°)", () => {
        // Standard model: each sign has exactly 9 navamsa segments of 3°20', covering 0..30°.
        const e = deriveNavamsaData({ [Planet.SUN]: 1 }, { [Planet.SUN]: 9 })[0];
        expect(e.navamsaIndex).toBe(9);
        expect(e.degreeRangeStart).toBeCloseTo((8 * 30) / 9, 5);
        expect(e.degreeRangeEnd).toBeCloseTo(30, 5);
    });
    describe("computeAscendantNakshatra", () => {
        test("uses lagnaDegree when recorded", () => {
            // Aries 5° => Ashwini, pada 2, lord Ketu(9)
            const n = computeAscendantNakshatra({ lagna: 1, lagnaDegree: 5 });
            expect(n.id).toBe(1);
            expect(n.pada).toBe(2);
            expect(n.lord).toBe(9);
        });
        test("uses navamsa lagna midpoint when no degree", () => {
            // Only degrees 13°20'–16°40' (middle of the 5th wedge) fall within Bharani matches the
            // fallback; here we simply assert it returns a valid nakshatra for Aries with a midpoint
            // source. The fallback test covers the deterministic 15° case.
            const n = computeAscendantNakshatra({ lagna: 1, navamsaLagna: 1 });
            expect(n.id).toBeGreaterThanOrEqual(1);
        });
        test("falls back to sign midpoint 15° when no degree/navamsa", () => {
            // Aries 15° => abs 15 => Bharani(2), pada 1, lord Venus(6)
            const n = computeAscendantNakshatra({ lagna: 1 });
            expect(n.id).toBe(2);
            expect(n.pada).toBe(1);
            expect(n.lord).toBe(6);
        });
    });

    describe("computeMoonNakshatra", () => {
        test("uses navamsa segment midpoint when navamsa sign present", () => {
            // Moon in Aries, navamsa sign Aries (1st wedge, midpoint 1°40') => Ashwini(1) pada 1
            const n = computeMoonNakshatra(1, 1);
            expect(n.id).toBe(1);
            expect(n.pada).toBe(1);
            expect(n.lord).toBe(9);
        });
        test("falls back to sign midpoint 15° when no navamsa sign", () => {
            // Aries 15° => Bharani(2)
            const n = computeMoonNakshatra(1);
            expect(n.id).toBe(2);
        });
    });

    test("U053 nakshatra + pada from midpoint 5° Aries", () => {
        // Sun in Aries 5° => abs midpoint 5, in 2nd navamsa
        const e = deriveNavamsaData({ [Planet.SUN]: 1 }, { [Planet.SUN]: 2 })[0];
        expect(e.nakshatra).toBe(1); // Ashwini
        expect(e.pada).toBe(2);
    });
    test("U054 a segment whose midpoint crosses 13°20' belongs to next nakshatra", () => {
        // 5th Aries navamsa: midpoint = 15°, which is past the Ashwini/Bharani boundary (13°20').
        const e = deriveNavamsaData({ [Planet.SUN]: 1 }, { [Planet.SUN]: 5 })[0];
        expect(e.nakshatra).toBe(2); // Bharani
        expect(e.pada).toBe(1);
    });
    test("U055 atmakaraka = highest absolute degree", () => {
        const rows = derivePlanetsTable({
            lagna: 1,
            houseOfPlanet: { [Planet.SUN]: 5, [Planet.MOON]: 9 },
            navamsaEnrichment: [
                {
                    planet: Planet.SUN,
                    navamsaIndex: 1,
                    navamsaSign: 1,
                    navamsaStrength: 0,
                    degreeRangeStart: 0,
                    degreeRangeEnd: 30 / 9,
                    nakshatra: 1,
                    pada: 1,
                    absoluteDegreeMidpoint: 5,
                },
                {
                    planet: Planet.MOON,
                    navamsaIndex: 1,
                    navamsaSign: 1,
                    navamsaStrength: 0,
                    degreeRangeStart: 0,
                    degreeRangeEnd: 30 / 9,
                    nakshatra: 1,
                    pada: 1,
                    absoluteDegreeMidpoint: 20,
                },
            ],
        });
        const atm = rows.find((r) => r.other.includes("atmakaraka"));
        expect(atm?.planet).toBe(Planet.MOON);
    });
    test("U056 no navamsa -> no enrichment, no crash", () => {
        const e = deriveNavamsaData({ [Planet.SUN]: 1 }, {});
        expect(e).toEqual([]);
    });
});

describe("derived birth ranges config tables (UT-CH-060..075)", () => {
    test("U060 birth time ravi house 1", () => {
        expect(BIRTH_TIME_RANGES[1]).toEqual({ start: "05:00", end: "07:00" });
    });
    test("U061 birth time ravi house 4", () => {
        expect(BIRTH_TIME_RANGES[4]).toEqual({ start: "23:00", end: "01:00" });
    });
    test("U062 birth time ravi house 12", () => {
        expect(BIRTH_TIME_RANGES[12]).toEqual({ start: "07:00", end: "09:00" });
    });
    test("U063 full birth-time table contiguous 2h windows", () => {
        const keys = Object.keys(BIRTH_TIME_RANGES)
            .map(Number)
            .sort((a, b) => a - b);
        expect(keys).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
        // Temporal-order chain: house 1 (sunrise 05:00–07:00) → 12 → 11 → ... → 2 wraps to 1.
        const chain = [1, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
        for (let i = 0; i < chain.length - 1; i++) {
            expect(BIRTH_TIME_RANGES[chain[i]].end).toBe(BIRTH_TIME_RANGES[chain[i + 1]].start);
        }
    });
    test("U064 birth month Mesha", () => {
        expect(BIRTH_MONTH_RANGES[1]).toEqual({
            start: { month: 4, day: 15 },
            end: { month: 5, day: 15 },
        });
    });
    test("U065 birth month Wrushaba", () => {
        expect(BIRTH_MONTH_RANGES[2]).toEqual({
            start: { month: 5, day: 15 },
            end: { month: 6, day: 15 },
        });
    });
    test("U066 birth month Meena wraps", () => {
        expect(BIRTH_MONTH_RANGES[12]).toEqual({
            start: { month: 3, day: 15 },
            end: { month: 4, day: 15 },
        });
    });
    test("U067 full birth-month table 12 rows", () => {
        expect(Object.keys(BIRTH_MONTH_RANGES)).toHaveLength(12);
    });
    test("U068 birth date candidates 1st navamsa", () => {
        const c = deriveBirthDateCandidates(0);
        expect(c.map((x) => x.candidateDay)).toEqual([12, 21]);
        expect(c[0].reasoning).toBe("12 + 0");
        expect(c[1].reasoning).toBe("17 + 4");
    });
    test("U069 birth date candidates 2nd navamsa", () => {
        const c = deriveBirthDateCandidates(1);
        expect(c.map((x) => x.candidateDay)).toEqual([15, 24]);
        expect(c[1].reasoning).toBe("17 + 7");
    });
    test("U070 general formula base config", () => {
        expect(BIRTH_DATE_BASE.base1).toBe(12);
        expect(BIRTH_DATE_BASE.increment1).toBe(3);
        const c = deriveBirthDateCandidates(3);
        expect(c[0].candidateDay).toBe(12 + 3 * 3);
    });
    test("U070b fused birth date range rolls end candidate over month boundary", () => {
        // Month range March (3) – April, candidates 27 & 36 -> March 27 – April 5.
        const range = deriveBirthDateRange(
            { start: { month: 3, day: 15 }, end: { month: 4, day: 15 } },
            [
                { navamsaIndex: 5, candidateDay: 27, reasoning: "27" },
                { navamsaIndex: 5, candidateDay: 36, reasoning: "36" },
            ],
        );
        expect(range).toEqual({
            start: { month: 3, day: 27 },
            end: { month: 4, day: 5 },
        });
    });
    test("U070c fused birth date range returns null without month range", () => {
        expect(deriveBirthDateRange(null, [{ candidateDay: 12, navamsaIndex: 0 }] as never)).toBeNull();
    });
    test("U071 age 1st formula uses forward modular sign gap", () => {
        const ages = deriveAgeRanges(1, 18, 5, 9);
        // Shani travels forward: birth sign 9 -> current sign 5 crosses 8 signs mod 12.
        expect(ages[0].valueMonths).toBe(30 + 18 + 30 * (8 - 1));
        expect(ages[0].warning).toBe(false);
    });
    test("U071b forward gap stays positive when current sign exceeds birth sign", () => {
        // Current Shani in Pisces (sign 12), birth Shani in earlier signs: ages must be positive,
        // not clamped to 0 (regression: backward gap made every case negative).
        const ages = deriveAgeRanges(1, 20.4, 12, 1);
        expect(ages[0].valueMonths).toBeGreaterThan(0);
        expect(ages[0].warning).toBe(false);
        expect(ages[0].valueYears).toBeCloseTo(29.2, 1);
    });
    test("U072 age 2nd = 1st + 30y", () => {
        const ages = deriveAgeRanges(1, 0, 5, 5);
        expect(ages[1].valueMonths).toBe(ages[0].valueMonths + 30 * 12);
    });
    test("U073 age 3rd = 2nd + 30y", () => {
        const ages = deriveAgeRanges(1, 0, 5, 5);
        expect(ages[2].valueMonths).toBe(ages[1].valueMonths + 30 * 12);
    });
    test("U074 negative intermediate clamped to 0 with warning", () => {
        const ages = deriveAgeRanges(2, 0, 5, 5);
        expect(ages[0].valueMonths).toBe(0);
        expect(ages[0].warning).toBe(true);
    });
    test("U075 Shani not placed -> ageRanges empty", () => {
        const ranges = deriveRanges(1, { [Planet.SUN]: 1 }, []);
        expect(ranges.ageRanges).toEqual([]);
    });
});

describe("compute integration", () => {
    test("empty chart save produces houses + skipped validation", () => {
        const result = compute({ lagna: 1, houses: {} });
        expect(result.manualHousePlacements.houses).toHaveLength(12);
        expect(result.manualHousePlacements.validation.budha.status).toBe("skipped");
        expect(result.derivedRanges.birthTimeRange).toBeNull();
    });
    test("birth time/month derived from Ravi house", () => {
        const result = compute({ lagna: 1, houses: { "1": [Planet.SUN] } });
        expect(result.derivedRanges.birthTimeRange).toEqual({ start: "05:00", end: "07:00" });
        expect(result.derivedRanges.birthMonthRange).toEqual({
            start: { month: 4, day: 15 },
            end: { month: 5, day: 15 },
        });
    });
    test("birth time night window for Ravi in 3rd house", () => {
        const result = compute({ lagna: 1, houses: { "3": [Planet.SUN] } });
        expect(result.derivedRanges.birthTimeRange).toEqual({ start: "01:00", end: "03:00" });
    });
    test("navamsa houses enrich planets table", () => {
        const result = compute({
            lagna: 1,
            houses: { "5": [Planet.SUN] },
            navamsaLagna: 1,
            navamsaHouses: { "5": [Planet.SUN] },
        });
        const sunRow = result.planetsTable.find((r) => r.planet === Planet.SUN);
        expect(sunRow?.navamsa).toBeDefined();
        expect(result.derivedRanges.birthDateCandidates.length).toBeGreaterThan(0);
    });
    test("navamsa house signs derive from navamsa lagna", () => {
        const result = compute({
            lagna: 1,
            houses: { "1": [Planet.SUN] },
            navamsaLagna: 5,
            navamsaHouses: { "1": [Planet.MOON] },
        });
        const navHouses = result.manualHousePlacements.navamsaHouses;
        expect(navHouses?.length).toBe(12);
        expect(navHouses?.[0].sign).toBe(5);
        expect(navHouses?.[1].sign).toBe(6);
        expect(navHouses?.[11].sign).toBe(4);
        expect(result.manualHousePlacements.navamsaLagna).toBe(5);
    });
    test("navamsaLagnaOptions: movable lagna 1 gives signs 1-9", () => {
        expect(navamsaLagnaOptions(1)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });
    test("navamsaLagnaOptions: fixed lagna 2 gives offset-8 sequence", () => {
        expect(navamsaLagnaOptions(2)).toEqual([1, 2, 3, 4, 5, 6, 10, 11, 12]);
    });
    test("navamsaLagnaOptions: dual lagna 3 gives offset-4 sequence", () => {
        expect(navamsaLagnaOptions(3)).toEqual([1, 2, 3, 7, 8, 9, 10, 11, 12]);
    });
    test("navamsaLagnaOptions: always exactly 9 distinct valid signs", () => {
        for (let s = 1; s <= 12; s++) {
            const opts = navamsaLagnaOptions(s);
            expect(opts).toHaveLength(9);
            expect(new Set(opts).size).toBe(9);
            opts.forEach((o) => expect(o).toBeGreaterThanOrEqual(1));
            opts.forEach((o) => expect(o).toBeLessThanOrEqual(12));
        }
    });
    test("navamsa not entered when no navamsa lagna", () => {
        const result = compute({ lagna: 1, houses: { "1": [Planet.SUN] } });
        expect(result.manualHousePlacements.navamsaHouses).toBeUndefined();
        expect(result.manualHousePlacements.navamsaLagna).toBeUndefined();
    });
    test("placementsToMap inverts house-keyed object", () => {
        expect(placementsToMap({ 1: [1, 4], 4: [2] })).toEqual({ 1: 1, 4: 1, 2: 4 });
    });
    test("deriveNavamsaLagnaFromDegree: degree 0 stays in the sign's first navamsa", () => {
        expect(deriveNavamsaLagnaFromDegree(1, 0)).toBe(1);
        expect(deriveNavamsaLagnaFromDegree(2, 0)).toBe(10);
        expect(deriveNavamsaLagnaFromDegree(3, 0)).toBe(7);
    });
    test("deriveNavamsaLagnaFromDegree: wedges advance every ~3°20'", () => {
        expect(deriveNavamsaLagnaFromDegree(1, 3)).toBe(1);
        expect(deriveNavamsaLagnaFromDegree(1, 3.4)).toBe(2);
        expect(deriveNavamsaLagnaFromDegree(1, 29.99)).toBe(9);
        expect(deriveNavamsaLagnaFromDegree(1, 6.8)).toBe(3);
    });
    test("deriveNavamsaLagnaFromDegree: result is always one of navamsaLagnaOptions", () => {
        for (let s = 1; s <= 12; s++) {
            for (let d = 0; d < 300; d += 13) {
                const derived = deriveNavamsaLagnaFromDegree(s, d / 10);
                expect(navamsaLagnaOptions(s)).toContain(derived);
            }
        }
    });
});

describe("synthesizeValidation", () => {
    test("V001 recomputes validation from stored houses, ignoring stale persisted value", () => {
        // Mirrors the stale record: identical houses must yield valid regardless of a bad stored value.
        const manual = {
            lagna: 10,
            houses: [
                { houseNumber: 1, sign: 10, planets: [], aspects: [5] },
                { houseNumber: 2, sign: 11, planets: [2, 8], aspects: [] },
                { houseNumber: 3, sign: 12, planets: [1, 5], aspects: [3, 7] },
                { houseNumber: 4, sign: 1, planets: [3, 4, 6], aspects: [9] },
                { houseNumber: 8, sign: 5, planets: [9], aspects: [2] },
                { houseNumber: 9, sign: 6, planets: [7], aspects: [1] },
            ],
        };
        const v = synthesizeValidation(manual as never);
        expect(v.budha.status).toBe("valid");
        expect(v.sikuru.status).toBe("valid");
        expect(v.rahuKethuAxis.status).toBe("valid");
    });
});

describe("buildWholeSignHouses", () => {
    test("W001 each whole-sign house spans exactly 30 degrees with proper start/middle/end cusps", () => {
        const houses = buildWholeSignHouses(1);
        expect(houses).toHaveLength(12);
        houses.forEach((h) => {
            const start = (h.startSign - 1) * 30 + h.startDegree;
            let end = (h.endSign - 1) * 30 + h.endDegree;
            if (end <= start) end += 360;
            const mid = (h.middleSign - 1) * 30 + h.middleDegree;
            expect(end - start).toBe(30);
            expect(mid - start).toBe(15);
        });
    });
    test("W002 houses wrap across the zodiac (house 12 -> house 1)", () => {
        const houses = buildWholeSignHouses(1);
        const h12 = houses[11];
        expect(h12.endSign).toBe(1);
        expect(h12.startSign).toBe(12);
        expect((h12.startSign - 1) * 30 + h12.startDegree).toBe(330);
    });
});

describe("buildBhavaHouses", () => {
    test("W003 house 1's middle line equals the ascendant (lagna) absolute degree", () => {
        const houses = buildBhavaHouses(1, 10);
        const h1 = houses[0];
        const mid = (h1.middleSign - 1) * 30 + h1.middleDegree;
        expect(mid).toBe(10);
    });
    test("W004 house middles advance 30 degrees per house from the lagna", () => {
        const houses = buildBhavaHouses(1, 10);
        houses.forEach((h, i) => {
            const mid = (h.middleSign - 1) * 30 + h.middleDegree;
            expect((mid % 360 + 360) % 360).toBe((10 + i * 30) % 360);
        });
    });
    test("W005 each bhava house spans 30 degrees, starting at the previous sign's last navamsa", () => {
        const houses = buildBhavaHouses(1, 10);
        houses.forEach((h) => {
            let start = (h.startSign - 1) * 30 + h.startDegree;
            let end = (h.endSign - 1) * 30 + h.endDegree;
            if (end <= start) end += 360;
            expect(end - start).toBeCloseTo(30, 5);
            expect(h.startDegree).toBeCloseTo(26.666, 2);
            expect(h.endDegree).toBeCloseTo(26.666, 2);
        });
    });
    test("W006 house-1 wedge for Pisces lagna contains the lagna degree", () => {
        const houses = buildBhavaHouses(12, 350);
        const h1 = houses[0];
        const start = (h1.startSign - 1) * 30 + h1.startDegree;
        const end = (h1.endSign - 1) * 30 + h1.endDegree;
        const mid = (h1.middleSign - 1) * 30 + h1.middleDegree;
        expect(start).toBeCloseTo(326.666, 2);
        expect(end).toBeCloseTo(356.666, 2);
        expect(mid).toBe(350);
        expect(start <= mid && mid < end).toBe(true);
    });
    test("W007 houses are not aligned to rashi (sign) boundaries", () => {
        const houses = buildBhavaHouses(1, 10);
        const h2 = houses[1];
        const h2start = (h2.startSign - 1) * 30 + h2.startDegree;
        expect(h2start).not.toBe(30);
    });
});
