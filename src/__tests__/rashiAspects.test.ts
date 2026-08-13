import {
    AspectReason,
    DEFAULT_RASHI_ASPECTS,
    RASHI_CATEGORY,
    computeHouseAspectsByHouseWithRashi,
    computeHouseAspectsByPlanetWithRashi,
    computeRashiAspectSigns,
    computeRashiHouseCandidates,
    computeRashiPlanetCandidates,
    isRashiEnabledForSign,
    mergeRashiIntoPlanetAspects,
    validateRashiAspectsPayload,
} from "@/lib/rashiAspects";

const ARIES_HOUSES = Array.from({ length: 12 }, (_, i) => ({
    houseNumber: i + 1,
    sign: i + 1,
    middleSign: i + 1,
    middleDegree: 15,
}));

const ON = { enabled: true, overrides: {} };
const DISABLED = { enabled: false, overrides: {} };

describe("computeRashiAspectSigns (all 12 rows)", () => {
    const expected: Record<number, number[]> = {
        1: [5, 8, 11],
        2: [4, 7, 10],
        3: [6, 9, 12],
        4: [2, 8, 11],
        5: [1, 7, 10],
        6: [3, 9, 12],
        7: [2, 5, 11],
        8: [1, 4, 10],
        9: [3, 6, 12],
        10: [2, 5, 8],
        11: [1, 4, 7],
        12: [3, 6, 9],
    };
    for (const sign of Object.keys(expected)) {
        test(`sign ${sign} → ${JSON.stringify(expected[Number(sign)])}`, () => {
            expect(computeRashiAspectSigns(Number(sign))).toEqual(expected[Number(sign)]);
        });
    }
});

describe("RASHI_CATEGORY", () => {
    test("fixed categories", () => {
        expect(RASHI_CATEGORY[1]).toBe("chara");
        expect(RASHI_CATEGORY[2]).toBe("thira");
        expect(RASHI_CATEGORY[3]).toBe("ubaya");
        expect(RASHI_CATEGORY[7]).toBe("chara");
        expect(RASHI_CATEGORY[12]).toBe("ubaya");
    });
});

describe("validateRashiAspectsPayload", () => {
    test("default when absent", () => {
        expect(validateRashiAspectsPayload(undefined)).toEqual({ ok: true, value: DEFAULT_RASHI_ASPECTS });
        expect(validateRashiAspectsPayload(null)).toEqual({ ok: true, value: DEFAULT_RASHI_ASPECTS });
    });
    test("valid enabled with overrides", () => {
        const res = validateRashiAspectsPayload({ enabled: true, overrides: { "1": { enabled: false } } });
        expect(res).toEqual({ ok: true, value: { enabled: true, overrides: { "1": { enabled: false } } } });
    });
    test("rejects invalid enabled / overrides", () => {
        expect(validateRashiAspectsPayload({ enabled: "yes" }).ok).toBe(false);
        expect(validateRashiAspectsPayload({ enabled: true, overrides: { "13": { enabled: false } } }).ok).toBe(false);
        expect(validateRashiAspectsPayload({ enabled: true, overrides: { "1": { enabled: 1 } } }).ok).toBe(false);
        expect(validateRashiAspectsPayload({ enabled: true, overrides: [] }).ok).toBe(false);
    });
});

describe("isRashiEnabledForSign", () => {
    test("master off → all off; override disables a sign", () => {
        expect(isRashiEnabledForSign(1, DISABLED)).toBe(false);
        expect(isRashiEnabledForSign(1, ON)).toBe(true);
        expect(isRashiEnabledForSign(1, { enabled: true, overrides: { "1": { enabled: false } } })).toBe(false);
        expect(isRashiEnabledForSign(2, { enabled: true, overrides: { "1": { enabled: false } } })).toBe(true);
    });
});

describe("computeRashiHouseCandidates / computeRashiPlanetCandidates", () => {
    test("Aries (1) → houses/signs 5,8,11", () => {
        const houses = computeRashiHouseCandidates(1, ARIES_HOUSES, ON);
        expect(houses.map((c) => c.houseNumber).sort((a, b) => a - b)).toEqual([5, 8, 11]);
        expect(houses.every((c) => c.aspectedSign === 5 || c.aspectedSign === 8 || c.aspectedSign === 11)).toBe(true);
    });
    test("disabled → empty", () => {
        expect(computeRashiHouseCandidates(1, ARIES_HOUSES, DISABLED)).toEqual([]);
    });
    test("planet candidates by sign", () => {
        const planets = [
            { name: 1, sign: 5 },
            { name: 2, sign: 8 },
            { name: 3, sign: 7 },
        ];
        const candidates = computeRashiPlanetCandidates(1, planets, ON);
        expect(candidates.map((c) => c.planetName).sort()).toEqual([1, 2]);
    });
});

describe("mergeRashiIntoPlanetAspects", () => {
    // Sun in sign 1 (Aries, rashi-aspects 5/8/11), Moon in sign 5, no planetary degree aspect.
    const planets = [
        { name: 1, sign: 1, absoluteDegree: 15 },
        { name: 2, sign: 5, absoluteDegree: 135 },
    ];
    test("disabled → unchanged input", () => {
        const base = { 1: [] as any[], 2: [] as any[] };
        expect(mergeRashiIntoPlanetAspects(base, planets, undefined, DISABLED)).toBe(base);
    });
    test("enabled → rashi reason-only aspect to Moon (135°), delta within Sun orb 15", () => {
        const base: Record<number, any[]> = { 1: [], 2: [] };
        const out = mergeRashiIntoPlanetAspects(base, planets, undefined, ON);
        const aspect = out[1][0];
        expect(aspect.planetName).toBe(2);
        expect(aspect.aspectType).toBe(120); // 5-1 = 4 signs * 30
        expect(aspect.reasons?.[0].type).toBe("rashi");
        expect(aspect.reasons?.[0].aspectedSign).toBe(5);
        expect(typeof aspect.delta).toBe("number");
    });
    test("target also in planetary aspects keeps BOTH reasons", () => {
        const base: Record<number, any[]> = {
            1: [{ planetName: 2, aspectType: 60, reasons: [{ type: "planetary", angle: 60, delta: 0 }] }],
            2: [],
        };
        // Moon at 135 is 120 from Sun(15), so a separate planetary aspect at 60 is contrived but used
        // to verify reason composition.
        const out = mergeRashiIntoPlanetAspects(base, planets, undefined, ON);
        const reasons: AspectReason[] = out[1][0].reasons ?? [];
        expect(reasons.filter((r) => r.type === "planetary")).toHaveLength(1);
        expect(reasons.filter((r) => r.type === "rashi")).toHaveLength(1);
    });
});

describe("house aspects with rashi arm", () => {
    // Jupiter in house 1 (sign 1, Aries = chara) → rashi-aspects Thira signs {5,8,11} (nearest 2
    // excluded). House 8 (sign 8) sits at arc 5 (150°), which is NOT a default degree — so it is
    // only reachable via rashi. In Aries-lagna whole-sign houses those are houses 5,8,11.
    const planets = [{ name: 5, sign: 1, absoluteDegree: 15, house: 1 }];
    test("computeHouseAspectsByPlanetWithRashi unions rashi arm", () => {
        const out = computeHouseAspectsByPlanetWithRashi(planets, ARIES_HOUSES, undefined, undefined, ON);
        expect(out[5]).toContain(5);
        expect(out[5]).toContain(8);
        expect(out[5]).toContain(11);
    });
    test("rashi disabled → planet-arm only (no sign-8 house)", () => {
        const out = computeHouseAspectsByPlanetWithRashi(planets, ARIES_HOUSES, undefined, undefined, DISABLED);
        // Jupiter in house 1: offsets [5,7,9] → 5,7,9; degree arm reaches 5/9 but not 8 (arc-5/150°
        // is not a default degree). So house 8 must be absent without rashi.
        expect(out[5]).not.toContain(8);
    });
    test("byHouse transposes and includes rashi", () => {
        const out = computeHouseAspectsByHouseWithRashi(planets, ARIES_HOUSES, undefined, undefined, ON);
        expect(out[8]).toContain(5);
        expect(Object.keys(out).length).toBe(12);
    });
});
