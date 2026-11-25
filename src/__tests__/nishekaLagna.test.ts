import {
    angleToElapsed,
    angularDistance,
    buildNishekaChart,
    calculateNishekaOffset,
    isBelowHorizon,
    subtractElapsed,
} from "@/lib/nishekaLagna";

describe("nisheka arc helpers", () => {
    it("Saturn–Mandi is the shorter arc", () => {
        expect(angularDistance(10, 350)).toBeCloseTo(20);
        expect(angularDistance(350, 10)).toBeCloseTo(20);
        expect(angularDistance(0, 180)).toBeCloseTo(180);
    });

    it("houses 1–6 are the invisible half, 7–12 the visible half", () => {
        expect(isBelowHorizon(100, 90)).toBe(true);
        expect(isBelowHorizon(260, 90)).toBe(true);
        expect(isBelowHorizon(280, 90)).toBe(false);
        expect(isBelowHorizon(80, 90)).toBe(false);
        expect(isBelowHorizon(270, 90)).toBeNull();
        expect(isBelowHorizon(90, 90)).toBeNull();
    });

    it("reads 8 signs 13°30′ as 8 months, 13 days, 12 hours (docs example)", () => {
        expect(angleToElapsed(8 * 30 + 13.5)).toEqual({ months: 8, days: 13, hours: 12, minutes: 0, seconds: 0 });
        // 1′ = 24 minutes
        expect(angleToElapsed(1 / 60)).toEqual({ months: 0, days: 0, hours: 0, minutes: 24, seconds: 0 });
    });

    it("subtracts calendar months, then days, then the time (docs example)", () => {
        const birth = Date.UTC(2026, 10, 25, 6, 0);
        const nisheka = subtractElapsed(birth, { months: 8, days: 13, hours: 12, minutes: 0, seconds: 0 });
        expect(new Date(nisheka).toISOString()).toBe("2026-03-11T18:00:00.000Z");
    });

    it("clamps to the month's last day", () => {
        const birth = Date.UTC(2026, 4, 31, 10, 0); // 31 May
        const nisheka = subtractElapsed(birth, { months: 3, days: 0, hours: 0, minutes: 0, seconds: 0 });
        expect(new Date(nisheka).toISOString()).toBe("2026-02-28T10:00:00.000Z");
    });
});

describe("calculateNishekaOffset", () => {
    const base = { ascendant: 10, ninthCusp: 250, saturn: 100, mandi: 40, moon: 75.5 };

    it("X = A + B when the Lagna lord is visible", () => {
        const r = calculateNishekaOffset({ ...base, lagnaLord: 300 });
        expect(r.saturnMandiDistance).toBeCloseTo(60);
        expect(r.lagnaNinthDistance).toBeCloseTo(240);
        expect(r.lagnaLordInvisible).toBe(false);
        expect(r.moonCorrection).toBe(0);
        expect(r.totalAngle).toBeCloseTo(300);
        expect(r.elapsed).toMatchObject({ months: 10, days: 0 });
    });

    it("adds the Moon's in-sign degree when the Lagna lord is invisible", () => {
        const r = calculateNishekaOffset({ ...base, lagnaLord: 120 });
        expect(r.lagnaLordInvisible).toBe(true);
        expect(r.moonCorrection).toBeCloseTo(15.5);
        expect(r.totalAngle).toBeCloseTo(315.5);
        expect(r.elapsed).toEqual({ months: 10, days: 15, hours: 12, minutes: 0, seconds: 0 });
    });
});

describe("buildNishekaChart", () => {
    it("builds whole-sign houses from the Nisheka Lagna", () => {
        const chart = buildNishekaChart({
            ascendant: { sign: 4, degree: 12.3456, absoluteDegree: 102.3456 },
            planets: [
                { name: 7, sign: 7, degree: 21, absoluteDegree: 201, nakshatra: 16, pada: 1, retrograde: false },
            ],
        });
        expect(chart.ascendant).toMatchObject({ sign: 4, degree: 12.35, lord: 2 });
        expect(chart.houses[0].sign).toBe(4);
        expect(chart.planets[0]).toMatchObject({ name: 7, house: 4 });
    });
});

describe("computeNisheka (Swiss Ephemeris)", () => {
    it("goes back by the computed arc and casts the ascendant at that moment", () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const swisseph = require("swisseph-v2");
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { computeGulikaLagna, computeNisheka } = require("@/lib/calculation");
        swisseph.swe_set_sid_mode(1, 0, 0); // Lahiri
        // 2026-11-23 10:00 IST (04:30 UT), Galle.
        const jd = swisseph.swe_utc_to_jd(2026, 11, 23, 4, 30, 0, swisseph.SE_GREG_CAL).julianDayUT;
        const gulika = computeGulikaLagna(jd, 6.0535, 80.221);
        const n = computeNisheka(jd, Date.UTC(2026, 10, 23, 10, 0), 6.0535, 80.221, 5.5, 1, gulika.absoluteDegree);

        expect(n.mandiLongitude).toBeCloseTo(gulika.absoluteDegree, 3);
        expect(n.totalAngle).toBeCloseTo(n.saturnMandiDistance + n.lagnaNinthDistance + n.moonCorrection, 6);
        expect(n.moonCorrection === 0).toBe(!n.lagnaLordInvisible);

        // Elapsed time between nisheka and birth matches the arc (calendar months make it approximate).
        const birthMs = Date.parse("2026-11-23T04:30:00Z");
        const days = (birthMs - Date.parse(n.dateTime)) / 86_400_000;
        expect(Math.abs(days - (n.elapsed.months * 30.44 + n.totalAngle - n.elapsed.months * 30))).toBeLessThan(3);

        // The Nisheka Lagna is the sidereal ascendant at that moment.
        const t = new Date(n.dateTime);
        const jdN = swisseph.swe_utc_to_jd(
            t.getUTCFullYear(),
            t.getUTCMonth() + 1,
            t.getUTCDate(),
            t.getUTCHours(),
            t.getUTCMinutes(),
            t.getUTCSeconds(),
            swisseph.SE_GREG_CAL,
        ).julianDayUT;
        const asc = swisseph.swe_houses_ex(jdN, swisseph.SEFLG_SIDEREAL, 6.0535, 80.221, "P").ascendant;
        expect(n.ascendant.absoluteDegree).toBeCloseTo(asc, 1);
        expect(n.planets).toHaveLength(9);
    });
});
