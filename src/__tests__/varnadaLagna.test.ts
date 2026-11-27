import { calculateVarnadaLagna } from "@/lib/varnadaLagna";

describe("calculateVarnadaLagna", () => {
    it("subtracts when one lagna is in an odd sign and the other in an even sign", () => {
        // Capricorn lagna (Pisces → Capricorn = 3), Libra HL (Aries → Libra = 7): 7 − 3 = 4 → 4th
        // backward from Pisces = Sagittarius.
        expect(calculateVarnadaLagna(10, 7)).toEqual({
            natalLagna: 10,
            horaLagna: 7,
            natalCount: 3,
            horaCount: 7,
            operation: "SUBTRACT",
            finalCount: 4,
            direction: "BACKWARD_FROM_PISCES",
            sign: 9,
        });
    });

    it("stays on Pisces when an even lagna gives a 0 (equal counts subtracted)", () => {
        // Capricorn lagna (3) and Gemini HL (3): 3 − 3 = 0 → Pisces.
        expect(calculateVarnadaLagna(10, 3)).toMatchObject({
            operation: "SUBTRACT",
            finalCount: 0,
            direction: "BACKWARD_FROM_PISCES",
            sign: 12,
        });
    });

    it("stays on Aries when an odd lagna gives a 0", () => {
        // Gemini lagna (3) and Capricorn HL (3): 0 → Aries.
        expect(calculateVarnadaLagna(3, 10)).toMatchObject({ direction: "FORWARD_FROM_ARIES", sign: 1 });
    });

    it("adds when both lagnas are in odd signs and counts forward from Aries for an odd lagna", () => {
        // Libra (7) + Leo (5) = 12 → 12th from Aries = Pisces.
        expect(calculateVarnadaLagna(7, 5)).toMatchObject({ operation: "ADD", finalCount: 12, sign: 12 });
    });

    it("adds when both lagnas are in even signs and counts backward from Pisces for an even lagna", () => {
        // Taurus (11) + Cancer (9) = 20 → 20th backward from Pisces (wraps once) = Leo.
        expect(calculateVarnadaLagna(2, 4)).toMatchObject({ operation: "ADD", finalCount: 20, sign: 5 });
    });

    it("uses the counting table from the docs", () => {
        const expected = [1, 11, 3, 9, 5, 7, 7, 5, 9, 3, 11, 1];
        expected.forEach((count, i) => expect(calculateVarnadaLagna(i + 1, 1).natalCount).toBe(count));
    });

    it("rejects out-of-range signs", () => {
        expect(() => calculateVarnadaLagna(0, 5)).toThrow();
        expect(() => calculateVarnadaLagna(5, 13)).toThrow();
    });
});
