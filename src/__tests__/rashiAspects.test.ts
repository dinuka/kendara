import {
    DEFAULT_RASHI_ASPECTS,
    RASHI_CATEGORY,
    computeRashiAspectSigns,
    isRashiEnabledForSign,
    isRashiTargetEnabled,
    validateRashiAspectsPayload,
} from "@/lib/rashiAspects";

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

describe("isRashiTargetEnabled", () => {
    test("per-target override disables one aspected sign only", () => {
        const setting = { enabled: true, overrides: { "1": { targets: { "8": false } } } };
        expect(isRashiTargetEnabled(1, 8, setting)).toBe(false);
        expect(isRashiTargetEnabled(1, 5, setting)).toBe(true);
    });
});
