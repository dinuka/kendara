import {
    DASHA_FIELDS,
    DEFAULT_DASHA_DISPLAY,
    dashaDisplaysEqual,
    isValidDashaPreferences,
    normalizeDashaPreferences,
} from "@/lib/dashaDisplay";
import { DEFAULT_TABLE_PREFERENCES, normalizeTablePreferences, parseTablePreferences } from "@/lib/tableColumns";

const shown = (fields: Record<string, boolean>) => DASHA_FIELDS.filter((f) => fields[f]);

describe("Dasha display defaults", () => {
    it("desktop shows every field down to Prana (the historical rows)", () => {
        expect(shown(DEFAULT_DASHA_DISPLAY.desktop.fields)).toEqual([...DASHA_FIELDS]);
        expect(DEFAULT_DASHA_DISPLAY.desktop.depth).toBe(5);
    });

    it("phones start lean: house numbers, dates, duration", () => {
        expect(shown(DEFAULT_DASHA_DISPLAY.mobile.fields)).toEqual(["ownNumbers", "dates", "duration"]);
    });

    it("are part of the table preferences defaults", () => {
        expect(DEFAULT_TABLE_PREFERENCES.dasha).toEqual(DEFAULT_DASHA_DISPLAY);
    });
});

describe("normalizeDashaPreferences", () => {
    it("fills missing devices and fields from the defaults", () => {
        const result = normalizeDashaPreferences({ mobile: { fields: { age: true } } });
        expect(result.desktop).toEqual(DEFAULT_DASHA_DISPLAY.desktop);
        expect(result.mobile.fields.age).toBe(true);
        expect(result.mobile.fields.dates).toBe(true);
        expect(result.mobile.depth).toBe(DEFAULT_DASHA_DISPLAY.mobile.depth);
    });

    it("drops invalid values instead of throwing", () => {
        const result = normalizeDashaPreferences({ desktop: { depth: 9, fields: { dates: "no", bogus: true } } });
        expect(result.desktop).toEqual(DEFAULT_DASHA_DISPLAY.desktop);
        expect(normalizeDashaPreferences("junk")).toEqual(DEFAULT_DASHA_DISPLAY);
    });

    it("stored preferences without a dasha branch get the defaults", () => {
        expect(normalizeTablePreferences({ charts: {} }).dasha).toEqual(DEFAULT_DASHA_DISPLAY);
    });
});

describe("strict validation (API input)", () => {
    it("accepts partial settings and round-trips through parseTablePreferences", () => {
        const payload = { dasha: { mobile: { depth: 2, fields: { age: true } } } };
        expect(isValidDashaPreferences(payload.dasha)).toBe(true);
        const parsed = parseTablePreferences(payload);
        expect(parsed?.dasha.mobile.depth).toBe(2);
        expect(parsed?.dasha.mobile.fields.age).toBe(true);
        expect(parsed?.dasha.desktop).toEqual(DEFAULT_DASHA_DISPLAY.desktop);
    });

    it.each([
        ["non-object", []],
        ["unknown device", { tablet: {} }],
        ["unknown key", { desktop: { colour: "red" } }],
        ["depth out of range", { desktop: { depth: 0 } }],
        ["non-integer depth", { desktop: { depth: 2.5 } }],
        ["unknown field", { desktop: { fields: { bogus: true } } }],
        ["non-boolean field", { desktop: { fields: { dates: 1 } } }],
    ])("rejects %s", (_label, dasha) => {
        expect(isValidDashaPreferences(dasha)).toBe(false);
        expect(parseTablePreferences({ dasha })).toBeNull();
    });
});

describe("dashaDisplaysEqual", () => {
    it("compares depth and every field", () => {
        const base = DEFAULT_DASHA_DISPLAY.mobile;
        expect(dashaDisplaysEqual(base, { ...base, fields: { ...base.fields } })).toBe(true);
        expect(dashaDisplaysEqual(base, { ...base, depth: 3 })).toBe(false);
        expect(dashaDisplaysEqual(base, { ...base, fields: { ...base.fields, age: true } })).toBe(false);
    });
});
