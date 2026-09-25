import { Planet, ZodiacSign } from "@/lib/astrologyEnums";
import { calculateInduLagna } from "@/lib/induLagna";

describe("calculateInduLagna", () => {
    test("Aries lagna with Taurus Moon gives Pisces (reference example)", () => {
        expect(calculateInduLagna(ZodiacSign.ARIES, ZodiacSign.TAURUS)).toEqual({
            lagnaSign: ZodiacSign.ARIES,
            lagnaNinthSign: ZodiacSign.SAGITTARIUS,
            lagnaNinthLord: Planet.JUPITER,
            lagnaNinthLordKala: 10,
            moonSign: ZodiacSign.TAURUS,
            moonNinthSign: ZodiacSign.CAPRICORN,
            moonNinthLord: Planet.SATURN,
            moonNinthLordKala: 1,
            totalKala: 11,
            remainder: 11,
            countFromMoon: 11,
            sign: ZodiacSign.PISCES,
        });
    });

    test("a remainder of 0 counts 12 signs from the Moon", () => {
        // Leo lagna and Leo Moon: 9th is Aries (Mars, 6) from both → 12 % 12 = 0 → 12th from Leo.
        const result = calculateInduLagna(ZodiacSign.LEO, ZodiacSign.LEO);
        expect(result.totalKala).toBe(12);
        expect(result.remainder).toBe(0);
        expect(result.countFromMoon).toBe(12);
        expect(result.sign).toBe(ZodiacSign.CANCER);
    });

    test("wraps past Pisces when counting from the Moon", () => {
        // Scorpio lagna: 9th Cancer (Moon, 16). Libra Moon: 9th Gemini (Mercury, 8). 24 % 12 = 0.
        expect(calculateInduLagna(ZodiacSign.SCORPIO, ZodiacSign.LIBRA).sign).toBe(ZodiacSign.VIRGO);
        // Cancer lagna: 9th Pisces (Jupiter, 10). Pisces Moon: 9th Scorpio (Mars, 6). 16 % 12 = 4.
        expect(calculateInduLagna(ZodiacSign.CANCER, ZodiacSign.PISCES).sign).toBe(ZodiacSign.GEMINI);
    });
});
