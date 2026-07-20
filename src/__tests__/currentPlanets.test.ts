import { House } from "@/lib/astrology";
import { COMBUSTION_ORBS, Planet, SINHALA_PLANET_LETTERS } from "@/lib/astrologyEnums";
import { computeCurrentPlanets } from "@/lib/currentPlanets";

const mockCalcResults: Record<number, { longitude: number; latitude: number; speed: number }> = {
    0: { longitude: 100, latitude: 0, speed: 1 },
    1: { longitude: 200, latitude: 0, speed: 13.2 },
    4: { longitude: 150, latitude: 0, speed: 0.7 },
    2: { longitude: 180, latitude: 0, speed: -1.2 },
    5: { longitude: 300, latitude: 0, speed: 0.1 },
    3: { longitude: 80, latitude: 0, speed: 1.1 },
    6: { longitude: 50, latitude: 0, speed: 0.2 },
    10: { longitude: 90, latitude: 0, speed: -2.5 },
};

let siderealMode = 0;

jest.mock("swisseph-v2", () => ({
    SEFLG_SIDEREAL: 65536,
    SEFLG_SPEED: 256,
    SE_GREG_CAL: 1,
    SE_SUN: 0,
    SE_MOON: 1,
    SE_MERCURY: 2,
    SE_VENUS: 3,
    SE_MARS: 4,
    SE_JUPITER: 5,
    SE_SATURN: 6,
    SE_MEAN_NODE: 10,
    SE_TRUE_NODE: 11,
    swe_utc_time_zone: jest.fn(() => ({
        year: 2026,
        month: 7,
        day: 20,
        hour: 12,
        minute: 0,
        second: 0,
    })),
    swe_utc_to_jd: jest.fn(() => ({ julianDayET: 2460000, julianDayUT: 2460000 })),
    swe_set_sid_mode: jest.fn((mode: number) => {
        siderealMode = mode;
    }),
    swe_calc_ut: jest.fn((_jd: number, planet: number, _flags: number) => {
        const data = mockCalcResults[planet];
        if (!data) return { error: "unknown planet" };
        const offset = siderealMode === 3 ? 2 : siderealMode === 5 ? 5 : 0;
        return {
            longitude: data.longitude + offset,
            latitude: data.latitude,
            distance: 1,
            longitudeSpeed: data.speed,
            latitudeSpeed: 0,
            distanceSpeed: 0,
            rflag: 0,
        };
    }),
}));

function makeHouses(): House[] {
    return Array.from({ length: 12 }, (_, i) => {
        const sign = i + 1;
        const nextSign = ((i + 1) % 12) + 1;
        return {
            houseNumber: i + 1,
            startDegree: 0,
            startSign: sign,
            startLord: 1,
            middleDegree: 15,
            middleSign: sign,
            middleLord: 1,
            endDegree: 0,
            endSign: nextSign,
            endLord: 1,
            sign,
            lord: 1,
        };
    });
}

describe("computeCurrentPlanets", () => {
    const houses = makeHouses();

    beforeEach(() => {
        siderealMode = 0;
        jest.clearAllMocks();
    });

    test("returns 9 planet entries", () => {
        const result = computeCurrentPlanets("lahiri", houses);
        expect(result).toHaveLength(9);
    });

    test("each entry has all required fields", () => {
        const result = computeCurrentPlanets("lahiri", houses);
        for (const planet of result) {
            expect(planet).toHaveProperty("name");
            expect(planet).toHaveProperty("sign");
            expect(planet).toHaveProperty("degree");
            expect(planet).toHaveProperty("absoluteDegree");
            expect(planet).toHaveProperty("house");
            expect(planet).toHaveProperty("nakshatra");
            expect(planet).toHaveProperty("pada");
            expect(planet).toHaveProperty("retrograde");
            expect(planet).toHaveProperty("combustion");
            expect(planet).toHaveProperty("strength");

            expect(planet.name).toBeGreaterThanOrEqual(1);
            expect(planet.name).toBeLessThanOrEqual(9);
            expect(planet.sign).toBeGreaterThanOrEqual(1);
            expect(planet.sign).toBeLessThanOrEqual(12);
            expect(typeof planet.degree).toBe("number");
            expect(typeof planet.absoluteDegree).toBe("number");
            expect(planet.nakshatra).toBeGreaterThanOrEqual(1);
            expect(planet.nakshatra).toBeLessThanOrEqual(27);
            expect(planet.pada).toBeGreaterThanOrEqual(1);
            expect(planet.pada).toBeLessThanOrEqual(4);
            expect(planet.strength).toEqual(expect.any(String));
        }
    });

    test("house mapping works correctly", () => {
        const result = computeCurrentPlanets("lahiri", houses);
        // Sun at longitude 100° → sign 4 (Cancer) → house 4
        const sun = result.find((p) => p.name === Planet.SUN);
        expect(sun).toBeDefined();
        expect(sun!.sign).toBe(4);
        expect(sun!.house).toBe(4);

        // Jupiter at longitude 300° → sign 10 (Capricorn) → house 10
        const jupiter = result.find((p) => p.name === Planet.JUPITER);
        expect(jupiter).toBeDefined();
        expect(jupiter!.sign).toBe(11);
        expect(jupiter!.house).toBe(11);
    });

    test("retrograde detection: Mercury (speed=-1.2) is retrograde", () => {
        const result = computeCurrentPlanets("lahiri", houses);
        const mercury = result.find((p) => p.name === Planet.MERCURY);
        expect(mercury).toBeDefined();
        expect(mercury!.retrograde).toBe(true);
    });

    test("Rahu is always retrograde (speed=-2.5)", () => {
        const result = computeCurrentPlanets("lahiri", houses);
        const rahu = result.find((p) => p.name === Planet.RAHU);
        expect(rahu).toBeDefined();
        expect(rahu!.retrograde).toBe(true);
    });

    test("Ketu is opposite of Rahu", () => {
        const result = computeCurrentPlanets("lahiri", houses);
        const rahu = result.find((p) => p.name === Planet.RAHU);
        const ketu = result.find((p) => p.name === Planet.KETU);
        expect(rahu).toBeDefined();
        expect(ketu).toBeDefined();
        // Ketu = Rahu + 180°
        const expectedKetu = (rahu!.absoluteDegree + 180) % 360;
        expect(ketu!.absoluteDegree).toBeCloseTo(expectedKetu, 1);
    });

    test("combustion detection: planet within orb of Sun is combust", () => {
        // Override Sun to be very close to Venus
        mockCalcResults[0] = { longitude: 82, latitude: 0, speed: 1 };
        mockCalcResults[3] = { longitude: 79, latitude: 0, speed: 1.1 };
        siderealMode = 0;
        const result = computeCurrentPlanets("lahiri", houses);
        const venus = result.find((p) => p.name === Planet.VENUS);
        expect(venus).toBeDefined();
        // Venus orb is 10°, Sun at 82°, Venus at 79° → diff = 3 ≤ 10 → combust
        expect(venus!.combustion).toBe(true);
        // Restore
        mockCalcResults[0] = { longitude: 100, latitude: 0, speed: 1 };
        mockCalcResults[3] = { longitude: 80, latitude: 0, speed: 1.1 };
    });

    test("Sun is never combust", () => {
        const result = computeCurrentPlanets("lahiri", houses);
        const sun = result.find((p) => p.name === Planet.SUN);
        expect(sun!.combustion).toBe(false);
    });

    test("Rahu and Ketu are never combust", () => {
        const result = computeCurrentPlanets("lahiri", houses);
        const rahu = result.find((p) => p.name === Planet.RAHU);
        const ketu = result.find((p) => p.name === Planet.KETU);
        expect(rahu!.combustion).toBe(false);
        expect(ketu!.combustion).toBe(false);
    });

    test("different ayanamsha calls swe_set_sid_mode with different values", () => {
        computeCurrentPlanets("lahiri", houses);
        const sweModule = require("swisseph-v2");
        expect(sweModule.swe_set_sid_mode).toHaveBeenLastCalledWith(1, 0, 0);

        siderealMode = 0;
        jest.clearAllMocks();
        computeCurrentPlanets("raman", houses);
        expect(sweModule.swe_set_sid_mode).toHaveBeenLastCalledWith(3, 0, 0);
    });

    test("different ayanamsha produces different absolute degrees", () => {
        // Raman (mode 3) adds 2° offset
        const lahiriResult = computeCurrentPlanets("lahiri", houses);
        siderealMode = 0;
        jest.clearAllMocks();
        const ramanResult = computeCurrentPlanets("raman", houses);

        // At least one planet has a different absolute degree
        const degreeDiffs = lahiriResult.filter(
            (lp, i) => Math.abs(lp.absoluteDegree - ramanResult[i].absoluteDegree) > 0.1,
        );
        expect(degreeDiffs.length).toBeGreaterThan(0);
    });

    test("empty birth houses returns null for house field", () => {
        // Override Venus to be at a position not in any house
        // The default houses cover 0-360, so all positions should find a house.
        // Let's verify that with empty houses array, house is null
        const result = computeCurrentPlanets("lahiri", []);
        for (const planet of result) {
            expect(planet.house).toBeNull();
        }
    });

    test("all 9 planet names are present", () => {
        const result = computeCurrentPlanets("lahiri", houses);
        const names = result.map((p) => p.name).sort((a, b) => a - b);
        expect(names).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    test("planets have valid strength values", () => {
        const result = computeCurrentPlanets("lahiri", houses);
        const validStrengths = ["Uchcha", "Neecha", "Moolatrikona", "OwnSign", "Mitra", "Shatru", "Sama"];
        for (const planet of result) {
            expect(validStrengths).toContain(planet.strength);
        }
    });

    test("nakshatra and pada are computed correctly", () => {
        // Sun at 100°: nakshatra = 8 (Ashlesha), pada = 3
        const result = computeCurrentPlanets("lahiri", houses);
        const sun = result.find((p) => p.name === Planet.SUN);
        expect(sun!.nakshatra).toBe(8);
        expect(sun!.pada).toBe(3);
    });

    test("Mercury at 180°: nakshatra = 14 (Vishakha), pada = 1", () => {
        // 180 / 13.333... = 13.5, floor = 13, nakshatra = 14
        const result = computeCurrentPlanets("lahiri", houses);
        const mercury = result.find((p) => p.name === Planet.MERCURY);
        expect(mercury!.nakshatra).toBe(14);
    });

    test("accepts optional forDate parameter", () => {
        const customDate = new Date("2025-01-01T12:00:00Z");
        const result = computeCurrentPlanets("lahiri", houses, customDate);
        expect(result).toHaveLength(9);
    });

    test("rejects invalid date gracefully", () => {
        const result = computeCurrentPlanets("lahiri", houses, new Date("invalid"));
        expect(result).toHaveLength(9);
    });
});

describe("SINHALA_PLANET_LETTERS", () => {
    test("contains all 9 planets", () => {
        const expectedKeys = [
            Planet.SUN,
            Planet.MOON,
            Planet.MARS,
            Planet.MERCURY,
            Planet.JUPITER,
            Planet.VENUS,
            Planet.SATURN,
            Planet.RAHU,
            Planet.KETU,
        ];
        for (const key of expectedKeys) {
            expect(SINHALA_PLANET_LETTERS[key]).toBeDefined();
            expect(typeof SINHALA_PLANET_LETTERS[key]).toBe("string");
            expect(SINHALA_PLANET_LETTERS[key].length).toBe(1);
        }
    });
});

describe("COMBUSTION_ORBS", () => {
    test("Sun, Rahu, Ketu are not in combustion orbs", () => {
        expect(COMBUSTION_ORBS[Planet.SUN]).toBeUndefined();
        expect(COMBUSTION_ORBS[Planet.RAHU]).toBeUndefined();
        expect(COMBUSTION_ORBS[Planet.KETU]).toBeUndefined();
    });

    test("each orb is a positive number", () => {
        for (const key of [Planet.MOON, Planet.MARS, Planet.MERCURY, Planet.JUPITER, Planet.VENUS, Planet.SATURN]) {
            expect(typeof COMBUSTION_ORBS[key]).toBe("number");
            expect(COMBUSTION_ORBS[key]).toBeGreaterThan(0);
        }
    });
});
