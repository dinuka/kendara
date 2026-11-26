import { normalizeHoroscopePayload } from "@/lib/horoscopePayload";

describe("normalizeHoroscopePayload", () => {
    it("leaves auto (ephemeris) horoscopes untouched", () => {
        const payload = { horoscope: { source: "auto" }, calculatedDetails: { planets: [] } };
        expect(normalizeHoroscopePayload(payload)).toBe(payload);
    });

    it("passes through payloads without calculated details", () => {
        const payload = { horoscope: { source: "manual" }, calculatedDetails: null };
        expect(normalizeHoroscopePayload(payload)).toBe(payload);
    });

    it("synthesises derived details for manual horoscopes and normalises null lagna fields", () => {
        const planets = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((name) => ({ name, sign: name, house: name, navamsaSign: name }));
        const payload = {
            horoscope: { source: "manual", birthDate: null },
            calculatedDetails: {
                planets,
                ascendant: { sign: 1, degree: 0 },
                nakshatra: {},
                manualHousePlacements: { lagna: 1, lagnaDegree: null, navamsaLagna: null, houses: [] },
            },
        };
        const result = normalizeHoroscopePayload(payload) as typeof payload & {
            calculatedDetails: Record<string, unknown> & { manualHousePlacements: Record<string, unknown> };
        };
        expect(result).not.toBe(payload);
        expect(result.calculatedDetails.manualHousePlacements.lagnaDegree).toBeUndefined();
        expect(result.calculatedDetails.manualHousePlacements.validation).toBeDefined();
        expect(Array.isArray(result.calculatedDetails.houses)).toBe(true);
        expect(result.calculatedDetails.derivedRanges).toHaveProperty("birthTimeRange");
    });
});
