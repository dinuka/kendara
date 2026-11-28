import { calculateHoraLagna } from "@/lib/horaLagna";

describe("calculateHoraLagna", () => {
    it("matches the docs example: Sun 72° at a 06:00 sunrise, birth 09:30 → Virgo 27°", () => {
        expect(calculateHoraLagna(72, 210)).toEqual({
            absoluteDegree: 177,
            sign: 6,
            degree: 27,
            sunriseSunLongitude: 72,
            elapsedMinutes: 210,
        });
    });

    it("equals the sunrise Sun longitude at sunrise itself", () => {
        const result = calculateHoraLagna(123.5, 0);
        expect(result.absoluteDegree).toBe(123.5);
        expect(result.sign).toBe(5);
    });

    it("wraps past 360°", () => {
        // 350° + 20h × 30° = 950° → 230° (Scorpio 20°)
        const result = calculateHoraLagna(350, 20 * 60);
        expect(result.absoluteDegree).toBe(230);
        expect(result.sign).toBe(8);
        expect(result.degree).toBe(20);
    });

    it("rejects a birth before the sunrise", () => {
        expect(() => calculateHoraLagna(10, -1)).toThrow();
    });
});
