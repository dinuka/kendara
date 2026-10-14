import { Planet, ZodiacSign } from "@/lib/astrologyEnums";
import { calculateBadhakaLevels, getBadhakaSign } from "@/lib/badhaka";

describe("getBadhakaSign", () => {
    test("movable lagna uses the 11th, fixed the 9th, dual the 7th", () => {
        expect(getBadhakaSign(ZodiacSign.ARIES)).toBe(ZodiacSign.AQUARIUS);
        expect(getBadhakaSign(ZodiacSign.TAURUS)).toBe(ZodiacSign.CAPRICORN);
        expect(getBadhakaSign(ZodiacSign.GEMINI)).toBe(ZodiacSign.SAGITTARIUS);
        expect(getBadhakaSign(ZodiacSign.PISCES)).toBe(ZodiacSign.VIRGO);
    });
});

describe("calculateBadhakaLevels", () => {
    // Aries lagna → badhaka sign Aquarius, badhaka lord Saturn.
    const planets = [
        { name: Planet.MARS, sign: ZodiacSign.AQUARIUS, nakshatra: 24 }, // Shatabhisha (Rahu)
        { name: Planet.VENUS, sign: ZodiacSign.LEO, nakshatra: 8 }, // in Saturn's nakshatra
        { name: Planet.MOON, sign: ZodiacSign.TAURUS, nakshatra: 5 }, // Mrigashira (Mars)
        { name: Planet.SATURN, sign: ZodiacSign.CANCER, nakshatra: 4 }, // Rohini (Moon)
        { name: Planet.SUN, sign: ZodiacSign.ARIES, nakshatra: 3 }, // Krittika (Sun)
    ];

    test("assigns every level a planet qualifies for", () => {
        expect(calculateBadhakaLevels(ZodiacSign.ARIES, planets)).toEqual({
            [Planet.MOON]: [1], // in Mars's nakshatra, and Mars occupies Aquarius
            [Planet.MARS]: [2],
            [Planet.VENUS]: [3],
            [Planet.SATURN]: [4],
        });
    });

    test("skips the nakshatra levels when nakshatras are placeholders", () => {
        expect(calculateBadhakaLevels(ZodiacSign.ARIES, planets, false)).toEqual({
            [Planet.MARS]: [2],
            [Planet.SATURN]: [4],
        });
    });
});
