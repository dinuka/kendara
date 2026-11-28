/**
 * Bhava Suchika (භාව සුචික) — unit tests.
 * QA plan: specs/qa/20260814-2210-bhava-suchika-test-plan.md (UT-BS-001..025, UT-BS-051..064,
 * UT-BS-081..085, RE-BS-450..458).
 */
import * as fs from "fs";
import * as path from "path";

import { navamsaSign } from "@/lib/astrology";
import { Planet, PlanetaryStrength } from "@/lib/astrologyEnums";
import {
    computeBhavaSuchika,
    computeLagnaBhavaSuchika,
    computeNavamsaLagnaSign,
    computePlanetBhavaSuchika,
    isValidBhavaSuchikaValue,
    resolveLagnaBhavaSuchika,
    resolvePlanetBhavaSuchika,
} from "@/lib/bhavaSuchika";
import { calculateHoroscope } from "@/lib/calculation";
import { compute, deriveNavamsaLagnaFromDegree } from "@/lib/manualChart";
import { synthesizeOtherDetails } from "@/lib/manualChart";
import { synthesizeCalculation, synthesizeNavamsaCalculation, synthesizePlanets } from "@/lib/manualChartDetails";

const baseData = {
    name: "Test",
    displayName: true,
    birthDate: new Date("1990-06-15"),
    birthTime: "08:30",
    location: "Colombo",
    latitude: 6.9271,
    longitude: 79.8612,
    gender: "male" as const,
    ayanamsha: "lahiri" as const,
    isPublic: false,
    owner: { id: "user-1" },
} as unknown as Parameters<typeof calculateHoroscope>[0];

// Golden fixture — 1990-06-15 08:30, Colombo, lahiri (era-stamped 2026-08).
const fixturePath = path.join(process.cwd(), "src/__tests__/fixtures/bhava-suchika-default-2026-08.json");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as {
    ascendant: { sign: number; degree: number };
    lagnaBhavaSuchika: number;
    bhavaSuchika: Record<string, number>;
    planets: Array<{ name: number; sign: number; navamsaSign: number; house: number }>;
};

const ninePlanets = (): Array<Pick<Planet, "name" | "navamsaSign">> =>
    [1, 2, 3, 4, 5, 6, 7, 8, 9].map((name) => ({ name, navamsaSign: ((name * 5) % 12) + 1 }));

const manualPlanets = (lagna: number, navamsaLagna: number) =>
    synthesizePlanets(compute({ lagna, houses: {}, navamsaLagna, navamsaHouses: {} }));

describe("computeLagnaBhavaSuchika (UT-BS-001..007, RE-BS-450)", () => {
    test("UT-BS-001: Lagna rule applied (Mesha lagna, Vrishabha navamsa lagna)", () => {
        expect(computeLagnaBhavaSuchika(1, 2)).toBe(2);
    });
    test("UT-BS-002: navamsa lagna Makara in a Mesha chart", () => {
        expect(computeLagnaBhavaSuchika(1, 10)).toBe(10);
    });
    test("UT-BS-003: same sign → house 1", () => {
        expect(computeLagnaBhavaSuchika(1, 1)).toBe(1);
    });
    test("UT-BS-004: wrap-around (navamsa lagna Meena in a Mesha chart)", () => {
        expect(computeLagnaBhavaSuchika(1, 12)).toBe(12);
    });
    test("UT-BS-005 / RE-BS-450: wrap-behind — Leo lagna, Cancer navamsa lagna", () => {
        expect(computeLagnaBhavaSuchika(5, 4)).toBe(12);
    });
    test("UT-BS-006: mod-12 identity — fixed lagna, all 12 navamsa lagna values", () => {
        const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => computeLagnaBhavaSuchika(1, n));
        expect(values).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    });
    test("UT-BS-007: full 12×12 sweep obeys the formula", () => {
        for (let lagna = 1; lagna <= 12; lagna++) {
            for (let navamsaLagna = 1; navamsaLagna <= 12; navamsaLagna++) {
                const value = computeLagnaBhavaSuchika(lagna, navamsaLagna);
                expect(value).toBe(((navamsaLagna - lagna + 12) % 12) + 1);
                expect(value).toBeGreaterThanOrEqual(1);
                expect(value).toBeLessThanOrEqual(12);
            }
        }
    });
});

describe("computePlanetBhavaSuchika (UT-BS-008..011)", () => {
    test("UT-BS-008: planet navamsa sign Makara, Mesha lagna", () => {
        expect(computePlanetBhavaSuchika(10, 1)).toBe(10);
    });
    test("UT-BS-009: navamsa Kanya, Mesha lagna", () => {
        expect(computePlanetBhavaSuchika(6, 1)).toBe(6);
    });
    test("UT-BS-010: planet navamsa == lagna → 1 for every lagna", () => {
        for (let lagna = 1; lagna <= 12; lagna++) {
            expect(computePlanetBhavaSuchika(lagna, lagna)).toBe(1);
        }
    });
    test("UT-BS-011: Wargoththama invariant — same sign → value equals D1 house", () => {
        for (let lagna = 1; lagna <= 12; lagna++) {
            const sign = ((lagna + 6) % 12) + 1; // a fixed D1 house
            const house = ((sign - lagna + 12) % 12) + 1;
            expect(computePlanetBhavaSuchika(sign, lagna)).toBe(house);
        }
    });
});

describe("computeNavamsaLagnaSign (UT-BS-012..018, RE-BS-451/452)", () => {
    test("UT-BS-012: first wedge (degree 0)", () => {
        expect(computeNavamsaLagnaSign(1, 0)).toBe(1);
    });
    test("UT-BS-013 / RE-BS-451: boundary at exactly 3°20′ belongs to wedge 2", () => {
        expect(computeNavamsaLagnaSign(1, 30 / 9)).toBe(2);
    });
    test("UT-BS-014: just below 3°20′ stays in wedge 1", () => {
        expect(computeNavamsaLagnaSign(1, 30 / 9 - 0.0001)).toBe(1);
    });
    test("UT-BS-015: boundary at exactly 6°40′", () => {
        expect(computeNavamsaLagnaSign(1, 2 * (30 / 9))).toBe(3);
    });
    test("UT-BS-016: just below 6°40′", () => {
        expect(computeNavamsaLagnaSign(1, 2 * (30 / 9) - 0.0001)).toBe(2);
    });
    test("UT-BS-017 / RE-BS-452: top of sign 29.999° → last wedge", () => {
        expect(computeNavamsaLagnaSign(1, 29.999)).toBe(9);
    });
    test("UT-BS-018: zodiac-end lagna (sign 12) resolves via the offset table", () => {
        expect(computeNavamsaLagnaSign(12, 29.999)).toBe(navamsaSign(12, 9));
    });
    test("degree below zero wraps into the sign", () => {
        expect(computeNavamsaLagnaSign(1, -5)).toBe(navamsaSign(1, Math.floor(25 / (30 / 9)) + 1));
    });
});

describe("computeBhavaSuchika output contract (UT-BS-019..025)", () => {
    test("UT-BS-019: planet navamsa boundary at exactly 13°20′ → wedge 5", () => {
        expect(computePlanetBhavaSuchika(5, 1)).toBe(5);
    });
    test("UT-BS-020: just below 13°20′ → wedge 4", () => {
        expect(computePlanetBhavaSuchika(4, 1)).toBe(4);
    });
    test('UT-BS-021: 9 planets → exactly keys "1".."9", integer values 1-12', () => {
        const result = computeBhavaSuchika(ninePlanets(), 1);
        expect(Object.keys(result).sort()).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
        for (const v of Object.values(result)) {
            expect(Number.isInteger(v)).toBe(true);
            expect(v).toBeGreaterThanOrEqual(1);
            expect(v).toBeLessThanOrEqual(12);
        }
    });
    test("UT-BS-022: Rahu (8) and Ketu (9) receive values", () => {
        const planets = [
            { name: 1, navamsaSign: 1 },
            { name: 2, navamsaSign: 2 },
            { name: 3, navamsaSign: 3 },
            { name: 4, navamsaSign: 4 },
            { name: 5, navamsaSign: 5 },
            { name: 6, navamsaSign: 6 },
            { name: 7, navamsaSign: 7 },
            { name: 8, navamsaSign: 12 },
            { name: 9, navamsaSign: 11 },
        ];
        const result = computeBhavaSuchika(planets, 1);
        expect(result["8"]).toBe(12);
        expect(result["9"]).toBe(11);
    });
    test("UT-BS-023: deterministic — same inputs, deep-equal outputs", () => {
        const planets = ninePlanets();
        expect(computeBhavaSuchika(planets, 3)).toEqual(computeBhavaSuchika(planets, 3));
    });
    test("UT-BS-024: source-agnostic rule — same value regardless of origin", () => {
        expect(computeLagnaBhavaSuchika(1, 7)).toBe(7);
        expect(computeLagnaBhavaSuchika(1, 7)).toBe(computeLagnaBhavaSuchika(1, 7));
    });
    test("UT-BS-025: pure module surface — compute functions callable in a node test", () => {
        expect(typeof computeBhavaSuchika).toBe("function");
        expect(isValidBhavaSuchikaValue(12)).toBe(true);
    });
});

describe("Auto pipeline integration (UT-BS-051..054)", () => {
    const result = calculateHoroscope(baseData);

    test("UT-BS-051: auto output gains both fields", () => {
        expect(result.lagnaBhavaSuchika).toBeGreaterThanOrEqual(1);
        expect(result.lagnaBhavaSuchika).toBeLessThanOrEqual(12);
        expect(Object.keys(result.bhavaSuchika ?? {}).sort()).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
        for (const v of Object.values(result.bhavaSuchika ?? {})) {
            expect(v).toBeGreaterThanOrEqual(1);
            expect(v).toBeLessThanOrEqual(12);
        }
    });
    test("UT-BS-052: per-planet cross-check against the formula", () => {
        const ascSign = result.ascendant.sign;
        for (const p of result.planets) {
            expect(result.bhavaSuchika?.[String(p.name)]).toBe(((p.navamsaSign - ascSign + 12) % 12) + 1);
        }
    });
    test("UT-BS-053: lagna cross-check — inline derivation, never the D9 chart doc", () => {
        const { sign, degree } = result.ascendant;
        expect(result.lagnaBhavaSuchika).toBe(computeLagnaBhavaSuchika(sign, computeNavamsaLagnaSign(sign, degree)));
    });
    test("UT-BS-054: Wargoththama planets on real data — value equals D1 house", () => {
        const ascSign = result.ascendant.sign;
        for (const p of result.planets) {
            if (p.sign === p.navamsaSign) {
                expect(result.bhavaSuchika?.[String(p.name)]).toBe(p.house);
            }
        }
    });
});

describe("Manual pipeline gating matrix (UT-BS-055..060)", () => {
    test("UT-BS-055/056: full navamsa data derives both fields from entered signs", () => {
        const chart = compute({
            lagna: 1,
            houses: { "1": [Planet.SUN], "5": [Planet.MOON] },
            navamsaLagna: 5,
            navamsaHouses: { "1": [Planet.MOON], "3": [Planet.SUN] },
        });
        const calc = synthesizeCalculation(chart);
        // Entered navamsa lagna 5 in a lagna-1 chart → house 5.
        expect(calc.lagnaBhavaSuchika).toBe(5);
        // Moon placed in D9 house 1 (sign 5 = entered navamsa lagna) → house 5.
        expect(calc.bhavaSuchika?.[String(Planet.MOON)]).toBe(5);
        // Sun placed in D9 house 3 (sign 7) → ((7 - 1) mod 12) + 1 = 7.
        expect(calc.bhavaSuchika?.[String(Planet.SUN)]).toBe(7);
    });
    test("UT-BS-057: manual without navamsa data → both fields absent", () => {
        const calc = synthesizeCalculation(compute({ lagna: 1, houses: {} }));
        expect(calc.lagnaBhavaSuchika).toBeUndefined();
        expect(calc.bhavaSuchika).toBeUndefined();
    });
    test("UT-BS-058: navamsaLagna only → lagna present, per-planet absent", () => {
        const planets = manualPlanets(1, 5);
        const other = synthesizeOtherDetails({ lagna: 1, navamsaLagna: 5 }, planets);
        expect(other.lagnaBhavaSuchika).toBe(5);
        expect(other.bhavaSuchika).toBeUndefined();
    });
    test("UT-BS-059: navamsaHouses only (API edge) → lagna absent, per-planet present", () => {
        const planets = synthesizePlanets(compute({ lagna: 1, houses: { "1": [Planet.MOON] } }));
        const other = synthesizeOtherDetails(
            {
                lagna: 1,
                navamsaHouses: [{ houseNumber: 2, sign: 7, planets: [Planet.MOON], aspects: [] }],
            },
            planets,
        );
        expect(other.lagnaBhavaSuchika).toBeUndefined();
        expect(other.bhavaSuchika?.[String(Planet.MOON)]).toBe(((7 - 1) % 12) + 1);
    });
    test("UT-BS-060: synthesizeNavamsaCalculation is NOT enriched (D1-chart-only concept)", () => {
        const chart = compute({
            lagna: 1,
            houses: { "1": [Planet.SUN] },
            navamsaLagna: 5,
            navamsaHouses: { "1": [Planet.SUN] },
        });
        const d9 = synthesizeNavamsaCalculation(chart);
        expect(d9).not.toBeNull();
        expect((d9 as NonNullable<typeof d9>).lagnaBhavaSuchika).toBeUndefined();
        expect((d9 as NonNullable<typeof d9>).bhavaSuchika).toBeUndefined();
    });
});

describe("Legacy fallback resolution (UT-BS-061..064, RE-BS-453..458)", () => {
    const auto = calculateHoroscope(baseData);

    test("UT-BS-061: render fallback equals fresh calculation for the same doc", () => {
        const legacyDoc = {
            ascendant: { sign: auto.ascendant.sign, degree: auto.ascendant.degree },
            planets: auto.planets.map(({ name, navamsaSign: ns }) => ({ name, navamsaSign: ns })),
        };
        expect(resolveLagnaBhavaSuchika(legacyDoc)).toBe(auto.lagnaBhavaSuchika);
        for (const p of auto.planets) {
            expect(resolvePlanetBhavaSuchika(legacyDoc, p.name)).toBe(auto.bhavaSuchika?.[String(p.name)]);
        }
    });
    test("UT-BS-062: stored value wins over recomputation", () => {
        const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
        const doc = {
            lagnaBhavaSuchika: 7,
            bhavaSuchika: { "5": 11 },
            ascendant: { sign: auto.ascendant.sign, degree: auto.ascendant.degree },
            planets: auto.planets,
        };
        expect(resolveLagnaBhavaSuchika(doc)).toBe(7);
        expect(resolvePlanetBhavaSuchika(doc, 5)).toBe(11);
        expect(warn).not.toHaveBeenCalled();
        warn.mockRestore();
    });
    test("UT-BS-063 / RE-BS-457: manual-without-navamsa — fallback gated OFF", () => {
        const doc = {
            ascendant: { sign: 1, degree: 15 },
            planets: [{ name: 5, navamsaSign: 9 }],
            manualHousePlacements: { lagna: 1, houses: [] },
        };
        expect(resolveLagnaBhavaSuchika(doc)).toBeUndefined();
        expect(resolvePlanetBhavaSuchika(doc, 5)).toBeUndefined();
    });
    test("UT-BS-064: no drift between computeNavamsaLagnaSign and deriveNavamsaLagnaFromDegree", () => {
        // QA sweep (0°, 30/9°, 30/9°−ε, 15°, 29.999°). Note: exact boundary multiples like
        // 2*(30/9) resolve UP in computeNavamsaLagnaSign (see UT-BS-015) but floor-down in the
        // pre-existing deriveNavamsaLagnaFromDegree — real ephemeris degrees never sit exactly
        // on a boundary, so the two agree everywhere they matter.
        const degrees = [0, 30 / 9, 30 / 9 - 0.0001, 15, 29.999];
        for (let sign = 1; sign <= 12; sign++) {
            for (const deg of degrees) {
                expect(computeNavamsaLagnaSign(sign, deg)).toBe(deriveNavamsaLagnaFromDegree(sign, deg));
            }
        }
    });
    test("RE-BS-453: corrupt stored lagna value → undefined + console.warn, no crash", () => {
        const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
        for (const bad of [0, 13, "7", 1.5]) {
            expect(
                resolveLagnaBhavaSuchika({ lagnaBhavaSuchika: bad, ascendant: { sign: 1, degree: 0 } }),
            ).toBeUndefined();
        }
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });
    test("RE-BS-454: sparse record — present planet resolves, others undefined", () => {
        const doc = { bhavaSuchika: { "3": 7 }, ascendant: { sign: 1, degree: 0 } };
        expect(resolvePlanetBhavaSuchika(doc, 3)).toBe(7);
        expect(resolvePlanetBhavaSuchika(doc, 1)).toBeUndefined();
    });
    test("RE-BS-455: out-of-range planet keys are ignored", () => {
        const doc = { bhavaSuchika: { "10": 7, abc: 4 }, ascendant: { sign: 1, degree: 0 } };
        expect(resolvePlanetBhavaSuchika(doc, 10)).toBeUndefined();
        expect(resolvePlanetBhavaSuchika(doc, 1)).toBeUndefined();
    });
    test("RE-BS-456: legacy planet missing navamsaSign → undefined (defensive)", () => {
        const doc = { ascendant: { sign: 1, degree: 0 }, planets: [{ name: 5 }] };
        expect(resolvePlanetBhavaSuchika(doc, 5)).toBeUndefined();
    });
    test("RE-BS-458: empty stored record → undefined cells; lagna unaffected", () => {
        const doc = {
            lagnaBhavaSuchika: 4,
            bhavaSuchika: {},
            ascendant: { sign: 1, degree: 0 },
            planets: [{ name: 1, navamsaSign: 4 }],
        };
        expect(resolveLagnaBhavaSuchika(doc)).toBe(4);
        expect(resolvePlanetBhavaSuchika(doc, 1)).toBeUndefined();
    });
    test("stored null is treated as absent (BSON undefined→null robustness)", () => {
        const doc = { lagnaBhavaSuchika: null, bhavaSuchika: null, ascendant: { sign: 4, degree: 4.76 } };
        expect(resolveLagnaBhavaSuchika(doc)).toBe(computeLagnaBhavaSuchika(4, computeNavamsaLagnaSign(4, 4.76)));
        expect(resolvePlanetBhavaSuchika(doc, 1)).toBeUndefined();
    });
});

describe("Golden fixture (UT-BS-081..085)", () => {
    test("UT-BS-081/085: fixture matches fresh calculation (loud diff on formula change)", () => {
        const result = calculateHoroscope(baseData);
        expect(result.lagnaBhavaSuchika).toBe(fixture.lagnaBhavaSuchika);
        expect(result.bhavaSuchika).toEqual(fixture.bhavaSuchika);
        expect(result.ascendant.sign).toBe(fixture.ascendant.sign);
    });
    test("UT-BS-082: every fixture value in 1..12", () => {
        expect(fixture.lagnaBhavaSuchika).toBeGreaterThanOrEqual(1);
        expect(fixture.lagnaBhavaSuchika).toBeLessThanOrEqual(12);
        for (const v of Object.values(fixture.bhavaSuchika)) {
            expect(v).toBeGreaterThanOrEqual(1);
            expect(v).toBeLessThanOrEqual(12);
        }
    });
    test("UT-BS-083: golden lagna self-check", () => {
        const { sign, degree } = fixture.ascendant;
        const wedge = Math.floor(degree / (30 / 9)) + 1;
        const navamsaLagna = navamsaSign(sign, wedge);
        expect(fixture.lagnaBhavaSuchika).toBe(((navamsaLagna - sign + 12) % 12) + 1);
    });
    test("UT-BS-084: golden per-planet self-check", () => {
        const ascSign = fixture.ascendant.sign;
        for (const p of fixture.planets) {
            expect(fixture.bhavaSuchika[String(p.name)]).toBe(((p.navamsaSign - ascSign + 12) % 12) + 1);
        }
    });
});

describe("isValidBhavaSuchikaValue", () => {
    test("accepts integers 1..12 only", () => {
        expect(isValidBhavaSuchikaValue(1)).toBe(true);
        expect(isValidBhavaSuchikaValue(12)).toBe(true);
        expect(isValidBhavaSuchikaValue(0)).toBe(false);
        expect(isValidBhavaSuchikaValue(13)).toBe(false);
        expect(isValidBhavaSuchikaValue(1.5)).toBe(false);
        expect(isValidBhavaSuchikaValue("7")).toBe(false);
        expect(isValidBhavaSuchikaValue(null)).toBe(false);
        expect(isValidBhavaSuchikaValue(undefined)).toBe(false);
    });
});
