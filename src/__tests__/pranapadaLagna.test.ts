import { calculatePranapadaLagna } from "@/lib/pranapadaLagna";

// docs/done/pranapada-lagna.md: born 3 h (450 palas) after sunrise → 30 signs → 180° of time arc.
describe("calculatePranapadaLagna", () => {
    it("movable sign: Sun Aries 10° → Libra 10°", () => {
        const pl = calculatePranapadaLagna(10, 180);
        expect(pl).toMatchObject({ sign: 7, degree: 10, absoluteDegree: 190, elapsedPalas: 450, signOffset: 0 });
    });

    it("fixed sign: Sun Taurus 10° adds 240° → Cancer 10°", () => {
        expect(calculatePranapadaLagna(40, 180)).toMatchObject({ sign: 4, degree: 10, signOffset: 240 });
    });

    it("dual sign: Sun Gemini 10° adds 120° → Aries 10°", () => {
        expect(calculatePranapadaLagna(70, 180)).toMatchObject({ sign: 1, degree: 10, signOffset: 120 });
    });

    it("advances one sign per 15 palas (6 minutes)", () => {
        expect(calculatePranapadaLagna(0, 6).absoluteDegree).toBe(30);
        expect(calculatePranapadaLagna(0, 1).absoluteDegree).toBe(5);
        expect(calculatePranapadaLagna(0, 0).absoluteDegree).toBe(0);
    });

    it("rejects a birth before the sunrise", () => {
        expect(() => calculatePranapadaLagna(10, -1)).toThrow();
    });
});

describe("computePranapadaLagna (Swiss Ephemeris)", () => {
    it("is the birth Sun + sign offset + 5° per minute since sunrise", () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const swisseph = require("swisseph-v2");
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { computePranapadaLagna } = require("@/lib/calculation");
        swisseph.swe_set_sid_mode(1, 0, 0); // Lahiri
        // 2026-11-23 10:00 IST (04:30 UT), Galle — Sun in Scorpio (fixed, +240°).
        const jd = swisseph.swe_utc_to_jd(2026, 11, 23, 4, 30, 0, swisseph.SE_GREG_CAL).julianDayUT;
        const pl = computePranapadaLagna(jd, 6.0535, 80.221);

        const sun = swisseph.swe_calc_ut(jd, swisseph.SE_SUN, swisseph.SEFLG_SWIEPH | swisseph.SEFLG_SIDEREAL);
        expect(pl.signOffset).toBe(240);
        expect(pl.sunLongitude).toBeCloseTo(sun.longitude, 3);
        // Sunrise around 06:00 IST, so roughly four hours have passed.
        expect(pl.elapsedMinutes).toBeGreaterThan(220);
        expect(pl.elapsedMinutes).toBeLessThan(260);
        const expected = (sun.longitude + 240 + pl.elapsedMinutes * 5) % 360;
        expect(pl.absoluteDegree).toBeCloseTo(expected, 1);
        expect(pl.sign).toBe(Math.floor(pl.absoluteDegree / 30) + 1);
    });
});
