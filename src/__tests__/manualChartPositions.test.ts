import { Planet } from "@/lib/astrologyEnums";
import { computeManualChartPositions } from "@/lib/manualChartDetails";

let siderealMode = 0;

jest.mock("swisseph-v2", () => {
    const mockCalcResults: Record<number, { longitude: number; latitude: number; speed: number }> = {
        0: { longitude: 100, latitude: 0, speed: 1 },
        1: { longitude: 200, latitude: 0, speed: 13.2 },
        4: { longitude: 150, latitude: 0, speed: 0.7 },
        2: { longitude: 180, latitude: 0, speed: -1.2 },
        5: { longitude: 300, latitude: 0, speed: 0.1 },
        3: { longitude: 240, latitude: 0, speed: 1.1 },
        6: { longitude: 50, latitude: 0, speed: 0.2 },
        10: { longitude: 90, latitude: 0, speed: -2.5 },
    };
    return {
        SEFLG_SIDEREAL: 65536,
        SEFLG_SPEED: 256,
        SE_GREG_CAL: 1,
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
    };
});

describe("computeManualChartPositions", () => {
    beforeEach(() => {
        siderealMode = 0;
    });

    test("computes 9 positions (all planets, no gaps)", () => {
        const result = computeManualChartPositions("2026-07-20", 1);
        expect(result.positions).toHaveLength(9);
        const names = result.positions.map((p) => p.planet);
        [
            Planet.SUN,
            Planet.MOON,
            Planet.MARS,
            Planet.MERCURY,
            Planet.JUPITER,
            Planet.VENUS,
            Planet.SATURN,
            Planet.RAHU,
            Planet.KETU,
        ].forEach((n) => expect(names).toContain(n));
    });

    test("maps each planet to its whole-sign birth house from lagna 1", () => {
        const result = computeManualChartPositions("2026-07-20", 1);
        expect(result.houses["4"]).toEqual(expect.arrayContaining([Planet.SUN, Planet.RAHU]));
        expect(result.houses["7"]).toEqual(expect.arrayContaining([Planet.MOON, Planet.MERCURY]));
        expect(result.houses["11"]).toEqual(expect.arrayContaining([Planet.JUPITER]));
        expect(result.houses["2"]).toEqual(expect.arrayContaining([Planet.SATURN]));
        expect(result.houses[10]).toEqual(expect.arrayContaining([Planet.KETU]));
    });

    test("houses object contains every planet exactly once", () => {
        const result = computeManualChartPositions("2026-07-20", 1);
        const flat = Object.values(result.houses).flat();
        expect(flat).toHaveLength(9);
        expect(new Set(flat).size).toBe(9);
    });

    test("navamsa houses populate when a navamsa lagna is given and house is relative to it", () => {
        const navamsaLagna = 1;
        const result = computeManualChartPositions("2026-07-20", 1, navamsaLagna);
        const flat = Object.values(result.navamsaHouses).flat();
        expect(flat).toHaveLength(9);
        expect(new Set(flat).size).toBe(9);
        result.positions.forEach((p) => {
            expect(p.navamsaHouse).not.toBeNull();
            const count = (result.navamsaHouses[p.navamsaHouse!] ?? []).filter((n) => n === p.planet).length;
            expect(count).toBe(1);
        });
    });

    test("no navamsa houses when navamsa lagna is absent", () => {
        const result = computeManualChartPositions("2026-07-20", 1);
        expect(result.navamsaHouses).toEqual({});
        result.positions.forEach((p) => expect(p.navamsaHouse).toBeNull());
    });
});
