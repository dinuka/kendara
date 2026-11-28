import { computeThithi, computeThithiFromPlanets } from "@/lib/astrology";
import { THITHI_LABELS_EN, THITHI_LABELS_SI } from "@/lib/astrologyEnums";

describe("computeThithi", () => {
    test("same longitude (new moon) is thithi 1", () => {
        expect(computeThithi(10, 10)).toBe(1);
    });

    test("12° elongation is thithi 2", () => {
        expect(computeThithi(10, 22)).toBe(2);
    });

    test("just under 12° is thithi 1", () => {
        expect(computeThithi(10, 21.9)).toBe(1);
    });

    test("180° elongation (full moon) is thithi 15", () => {
        expect(computeThithi(10, 190)).toBe(16);
    });

    test("360° elongation wraps back to thithi 1", () => {
        expect(computeThithi(10, 370)).toBe(1);
    });

    test("moon behind sun wraps to a high thithi", () => {
        expect(computeThithi(20, 5)).toBe(29);
    });

    test("covers the full 1-30 range across the cycle", () => {
        const values = new Set<number>();
        for (let i = 0; i < 30; i++) {
            values.add(computeThithi(0, i * 12));
        }
        expect(values.size).toBe(30);
    });
});

describe("computeThithiFromPlanets", () => {
    test("uses stored Sun and Moon absolute degrees", () => {
        const planets = [
            { name: 1, absoluteDegree: 10 },
            { name: 2, absoluteDegree: 25 },
        ];
        expect(computeThithiFromPlanets(planets)).toBe(2);
    });

    test("falls back to thithi 1 when Sun or Moon is missing", () => {
        expect(computeThithiFromPlanets([{ name: 1, absoluteDegree: 10 }])).toBe(1);
        expect(computeThithiFromPlanets([])).toBe(1);
    });
});

describe("THITHI label maps", () => {
    test("both locales define all 30 thithis", () => {
        expect(Object.keys(THITHI_LABELS_EN)).toHaveLength(30);
        expect(Object.keys(THITHI_LABELS_SI)).toHaveLength(30);
        expect(THITHI_LABELS_SI[1]).toBe("පුර පෑලවිය");
        expect(THITHI_LABELS_SI[30]).toBe("අමාවක");
        expect(THITHI_LABELS_EN[1]).toBe("Shukla Pratipada");
        expect(THITHI_LABELS_EN[30]).toBe("Amavasya");
    });
});
