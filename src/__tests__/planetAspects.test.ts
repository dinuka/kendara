import {
    Aspect,
    BENEFICIAL_ASPECT_ANGLES,
    DEFAULT_ASPECT_HOUSES,
    DEFAULT_ORBS,
    VALID_ASPECT_DEGREES,
    aspectPointSignedDelta,
    computeHouseAspectsByHouse,
    computeHouseAspectsByPlanet,
    computeManualHouseAspects,
    computeManualPlanetAspects,
    computePlanetAspects,
    defaultAspectDegrees,
    derivePlanetAbsoluteDegree,
    resolveAspectDegrees,
    resolveAspectHouses,
    resolveOrb,
    validatePlanetAspectsPayload,
} from "@/lib/planetAspects";

const H = (sign: number, degree = 15): { houseNumber: number; middleSign: number; middleDegree: number } => ({
    houseNumber: sign % 12 === 0 ? 12 : ((sign - 1) % 12) + 1,
    middleSign: ((sign - 1) % 12) + 1,
    middleDegree: degree,
});

describe("planetAspects constants & resolution", () => {
    test("DEFAULT_ASPECT_HOUSES covers all planets 1-9 (no 7th fallback)", () => {
        expect(Object.keys(DEFAULT_ASPECT_HOUSES).length).toBe(9);
        expect(DEFAULT_ASPECT_HOUSES[1]).toEqual([3, 5, 7, 9, 10]);
        expect(DEFAULT_ASPECT_HOUSES[3]).toEqual([4, 5, 7, 8, 9]);
        expect(DEFAULT_ASPECT_HOUSES[5]).toEqual([5, 7, 9]);
        expect(DEFAULT_ASPECT_HOUSES[8]).toEqual([5, 7, 9]);
    });

    test("degree defaults derive from default aspect houses (H → (H−1)×30)", () => {
        expect(defaultAspectDegrees(1)).toEqual([60, 120, 180, 240, 270]); // Sun houses 3,5,7,9,10
        expect(defaultAspectDegrees(3)).toEqual([90, 120, 180, 210, 240]); // Mars houses 4,5,7,8,9
        expect(defaultAspectDegrees(5)).toEqual([120, 180, 240]); // Jupiter houses 5,7,9
        expect(VALID_ASPECT_DEGREES).toEqual([30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]);
        expect(BENEFICIAL_ASPECT_ANGLES).toEqual(new Set([60, 120]));
    });

    test("DEFAULT_ORBS mirrors the model/calculation copies", () => {
        expect(DEFAULT_ORBS).toEqual({ "1": 15, "2": 12, "3": 8, "4": 7, "5": 9, "6": 7, "7": 9, "8": 0, "9": 0 });
    });

    test("resolveAspectHouses: configured absolute vs default offsets", () => {
        expect(resolveAspectHouses(5)).toEqual([5, 7, 9]);
        expect(resolveAspectHouses(5, { "5": { houses: [2, 11], degrees: [60] } })).toEqual([2, 11]);
    });

    test("resolveAspectDegrees: configured vs default derived from houses", () => {
        expect(resolveAspectDegrees(1)).toEqual([60, 120, 180, 240, 270]);
        expect(resolveAspectDegrees(1, { "1": { houses: [5], degrees: [90, 180] } })).toEqual([90, 180]);
    });

    test("resolveOrb: user > default > 0", () => {
        expect(resolveOrb(8)).toBe(0);
        expect(resolveOrb(1)).toBe(15);
        expect(resolveOrb(2, { "2": 5 })).toBe(5);
    });

    test("aspectPointSignedDelta picks the closer aspect point", () => {
        // absI=15, angle=60 → points 75 and 315. target 80 → delta +5 (closest to 75).
        expect(aspectPointSignedDelta(15, 60, 80)).toBe(5);
    });
});

describe("validatePlanetAspectsPayload", () => {
    test("null/undefined → empty map (reset)", () => {
        expect(validatePlanetAspectsPayload(null)).toEqual({ ok: true, value: {} });
        expect(validatePlanetAspectsPayload(undefined)).toEqual({ ok: true, value: {} });
    });

    test("valid payload normalized ascending", () => {
        const res = validatePlanetAspectsPayload({ "1": { houses: [7, 3], degrees: [180, 60] } });
        expect(res).toEqual({ ok: true, value: { "1": { houses: [3, 7], degrees: [60, 180] } } });
    });

    test("rejects invalid planet key", () => {
        expect(validatePlanetAspectsPayload({ "0": { houses: [5], degrees: [60] } }).ok).toBe(false);
        expect(validatePlanetAspectsPayload({ "10": { houses: [5], degrees: [60] } }).ok).toBe(false);
    });

    test("rejects non-array / empty houses or degrees", () => {
        expect(validatePlanetAspectsPayload({ "1": { houses: [], degrees: [60] } }).ok).toBe(false);
        expect(validatePlanetAspectsPayload({ "1": { houses: [5], degrees: [] } }).ok).toBe(false);
        expect(validatePlanetAspectsPayload({ "1": { houses: 5, degrees: [60] } }).ok).toBe(false);
    });

    test("rejects out-of-range / invalid / duplicate values", () => {
        expect(validatePlanetAspectsPayload({ "1": { houses: [13], degrees: [60] } }).ok).toBe(false);
        expect(validatePlanetAspectsPayload({ "1": { houses: [5], degrees: [45] } }).ok).toBe(false);
        expect(validatePlanetAspectsPayload({ "1": { houses: [5], degrees: [330, 330] } }).ok).toBe(false);
        expect(validatePlanetAspectsPayload({ "1": { houses: [5, 5], degrees: [60] } }).ok).toBe(false);
    });
});

describe("computePlanetAspects", () => {
    test("Sun in Aries, Moon in Taurus → 60 trine within orb, beneficial, reason attached", () => {
        const aspects = computePlanetAspects([
            { name: 1, absoluteDegree: 5 },
            { name: 2, absoluteDegree: 65 },
        ]);
        const a = aspects[1][0];
        expect(a.planetName).toBe(2);
        expect(a.aspectType).toBe(60);
        expect(a.degreeGap).toBe(0);
        expect(a.isBeneficial).toBe(true);
        expect(a.delta).toBe(0);
        expect(a.reasons).toEqual([{ type: "planetary", angle: 60, delta: 0 }]);
    });

    test("Rahu/Ketu (orb 0) aspect only at exact angle", () => {
        const aspects = computePlanetAspects([
            { name: 8, absoluteDegree: 100 },
            { name: 6, absoluteDegree: 220 },
        ]);
        expect(aspects[8][0].aspectType).toBe(120);
        expect(
            computePlanetAspects([
                { name: 8, absoluteDegree: 100 },
                { name: 6, absoluteDegree: 221 },
            ])[8],
        ).toHaveLength(0);
    });

    test("conjunction is not beneficial", () => {
        const aspects = computePlanetAspects([
            { name: 1, absoluteDegree: 0 },
            { name: 2, absoluteDegree: 3 },
        ]);
        expect(aspects[1][0]).toMatchObject({ aspectType: 0, isBeneficial: false });
    });

    test("no self-aspect; every key present", () => {
        const aspects = computePlanetAspects([
            { name: 1, absoluteDegree: 0 },
            { name: 2, absoluteDegree: 65 },
        ]);
        expect(Object.keys(aspects)).toEqual(["1", "2"]);
        expect(aspects[1].every((a: Aspect) => a.planetName !== 1)).toBe(true);
    });
});

describe("derivePlanetAbsoluteDegree", () => {
    test("entered degree wins", () => {
        expect(derivePlanetAbsoluteDegree(3, 1, 5, 10)).toBe(10);
    });
    test("navamsa-segment midpoint fallback (sign 1, navamsa 1 → 1.666...)", () => {
        expect(derivePlanetAbsoluteDegree(3, 1, 1)).toBeCloseTo(1.6667, 3);
    });
    test("sign midpoint fallback", () => {
        expect(derivePlanetAbsoluteDegree(3, 1)).toBe(15);
    });
});

describe("computeHouseAspectsByPlanet / ByHouse", () => {
    test("default offsets from whole-sign house; degree arm unioned", () => {
        // Jupiter in house 2 (sign 2, abs 45). Offsets [5,7,9] → houses 6,8,10. Degree arm: points
        // 45±60/90/120/180 wrapped; house mids within orb(9). Numeric union.
        const res = computeHouseAspectsByPlanet(
            [{ name: 5, absoluteDegree: 45, house: 2 }],
            Array.from({ length: 12 }, (_, i) => H(i + 1)),
        );
        expect(res[5]).toContain(6);
        expect(res[5]).toContain(8);
        expect(res[5]).toContain(10);
    });

    test("configured houses are absolute (no offset)", () => {
        const res = computeHouseAspectsByPlanet(
            [{ name: 5, absoluteDegree: 45, house: 2 }],
            Array.from({ length: 12 }, (_, i) => H(i + 1)),
            { "5": { houses: [3], degrees: [60] } },
        );
        expect(res[5]).toContain(3);
    });

    test("byHouse transposes with all 12 houses", () => {
        const res = computeHouseAspectsByHouse(
            [{ name: 5, absoluteDegree: 45, house: 2 }],
            Array.from({ length: 12 }, (_, i) => H(i + 1)),
        );
        expect(Object.keys(res).length).toBe(12);
        expect(Array.isArray(res[6])).toBe(true);
    });
});

describe("manual adapters", () => {
    test("computeManualHouseAspects delegates", () => {
        const res = computeManualHouseAspects({ 5: 2 }, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
        expect(res[5]).toContain(6);
        expect(res[5]).toContain(8);
        expect(res[5]).toContain(10);
    });

    test("computeManualPlanetAspects delegates with fallback degrees", () => {
        // Sun sign 1 abs 15, Moon sign 2 abs 45 → 30° apart; nearest 60, diff 30 > orb → none.
        const res = computeManualPlanetAspects([
            { name: 1, sign: 1, house: 1, navamsaSign: 5 },
            { name: 2, sign: 2, house: 2, navamsaSign: 6 },
        ]);
        expect(res[1]).toHaveLength(0);
    });
});
