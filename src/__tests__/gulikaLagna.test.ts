import { Planet } from "@/lib/astrologyEnums";
import { findGulikaPeriod, weekdayOfJulianDay } from "@/lib/gulikaLagna";

// Hours on one scale: sunrise 06:00, sunset 18:00, next sunrise 30:00 (06:00 next day).
const times = { sunrise: 6, sunset: 18, nextSunrise: 30 };

describe("findGulikaPeriod", () => {
    // Standard Gulika Kalam parts (1-8) for Sunday … Saturday.
    const DAY_PARTS = [7, 6, 5, 4, 3, 2, 1];
    const NIGHT_PARTS = [3, 2, 1, 7, 6, 5, 4];

    it.each(DAY_PARTS.map((part, weekday) => [weekday, part]))("day, weekday %d → part %d", (weekday, part) => {
        const p = findGulikaPeriod({ ...times, birth: 12, weekday });
        expect(p.isNight).toBe(false);
        expect(p.part).toBe(part);
        expect(p.start).toBe(6 + (part - 1) * 1.5);
        expect(p.end).toBe(6 + part * 1.5);
    });

    it.each(NIGHT_PARTS.map((part, weekday) => [weekday, part]))("night, weekday %d → part %d", (weekday, part) => {
        const p = findGulikaPeriod({ ...times, birth: 20, weekday });
        expect(p.isNight).toBe(true);
        expect(p.part).toBe(part);
        expect(p.start).toBe(18 + (part - 1) * 1.5);
    });

    it("Monday day: starts from the Moon, Gulika 13:30–15:00", () => {
        const p = findGulikaPeriod({ ...times, birth: 7, weekday: 1 });
        expect(p.startLord).toBe(Planet.MOON);
        expect([p.start, p.end]).toEqual([13.5, 15]);
    });

    it("Sunday night: starts from the 5th lord, Jupiter", () => {
        expect(findGulikaPeriod({ ...times, birth: 29, weekday: 0 }).startLord).toBe(Planet.JUPITER);
    });

    it("treats a birth exactly at sunset as night", () => {
        expect(findGulikaPeriod({ ...times, birth: 18, weekday: 0 }).isNight).toBe(true);
    });

    it("rejects a birth outside the sunrise → next sunrise window", () => {
        expect(() => findGulikaPeriod({ ...times, birth: 5, weekday: 0 })).toThrow();
        expect(() => findGulikaPeriod({ ...times, birth: 31, weekday: 0 })).toThrow();
        expect(() => findGulikaPeriod({ ...times, birth: 12, weekday: 7 })).toThrow();
    });
});

describe("weekdayOfJulianDay", () => {
    it("2000-01-01 12:00 UT is a Saturday", () => {
        expect(weekdayOfJulianDay(2451545.0, 0)).toBe(6);
    });

    it("uses local mean time: 2000-01-01 00:30 UT is Saturday at Greenwich, Friday far west", () => {
        expect(weekdayOfJulianDay(2451544.5208, 0)).toBe(6);
        expect(weekdayOfJulianDay(2451544.5208, -90)).toBe(5);
    });
});

describe("computeGulikaLagna (Swiss Ephemeris)", () => {
    it("is the sidereal ascendant at the start of Saturn's part", () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const swisseph = require("swisseph-v2");
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { computeGulikaLagna } = require("@/lib/calculation");
        swisseph.swe_set_sid_mode(1, 0, 0); // Lahiri
        // Monday 2026-11-23 10:00 IST (04:30 UT), Galle.
        const jd = swisseph.swe_utc_to_jd(2026, 11, 23, 4, 30, 0, swisseph.SE_GREG_CAL).julianDayUT;
        const gl = computeGulikaLagna(jd, 6.0535, 80.221);

        expect(gl).toMatchObject({ isNight: false, weekday: 1, part: 6 });
        // Near the equator the day is ~12h, so Gulika starts around 13:30 IST (08:00 UT).
        const start = new Date(gl.start);
        expect(start.getUTCHours()).toBe(7);
        expect(new Date(gl.end).getTime() - start.getTime()).toBeGreaterThan(80 * 60_000);

        const startJd = new Date(gl.start).getTime() / 86_400_000 + 2440587.5;
        const asc = swisseph.swe_houses_ex(startJd, swisseph.SEFLG_SIDEREAL, 6.0535, 80.221, "P").ascendant;
        expect(gl.absoluteDegree).toBeCloseTo(asc, 2);
        expect(gl.sign).toBe(Math.floor(asc / 30) + 1);
        expect(gl.degree).toBeCloseTo(asc % 30, 3);
    });
});
