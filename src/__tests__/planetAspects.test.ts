import {
    BENEFICIAL_ASPECT_ANGLES,
    DEFAULT_ASPECT_HOUSES,
    DEFAULT_ORBS,
    VALID_ASPECT_DEGREES,
    computePlanetConjunctions,
    defaultAspectDegrees,
    derivePlanetAbsoluteDegree,
    resolveAspectHouses,
    resolveOrb,
    validatePlanetAspectsPayload,
} from "@/lib/planetAspects";

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

    test("resolveAspectHouses: configured vs default aspect houses", () => {
        expect(resolveAspectHouses(5)).toEqual([5, 7, 9]);
        expect(resolveAspectHouses(5, { "5": { houses: [2, 11], degrees: [60] } })).toEqual([2, 11]);
    });

    test("resolveOrb: user > default > 0", () => {
        expect(resolveOrb(8)).toBe(0);
        expect(resolveOrb(1)).toBe(15);
        expect(resolveOrb(2, { "2": 5 })).toBe(5);
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

describe("computePlanetConjunctions", () => {
    test("pair uses the highest orb of the two planets (both rows)", () => {
        // Sun orb 15, Mars orb 8: a 10° gap is inside max(15, 8) on both rows, with the signed delta.
        const conjunctions = computePlanetConjunctions([
            { name: 1, absoluteDegree: 0 },
            { name: 3, absoluteDegree: 10 },
        ]);
        expect(conjunctions[1][0]).toMatchObject({ planetName: 3, aspectType: 0, degreeGap: 10, delta: 10 });
        expect(conjunctions[3][0]).toMatchObject({ planetName: 1, aspectType: 0, degreeGap: 10, delta: -10 });
    });

    test("custom orb override keeps a wide pair out", () => {
        const conjunctions = computePlanetConjunctions(
            [
                { name: 1, absoluteDegree: 0 },
                { name: 4, absoluteDegree: 12 },
            ],
            { 1: 9 },
        );
        expect(conjunctions[1]).toHaveLength(0);
        expect(conjunctions[4]).toHaveLength(0);
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
