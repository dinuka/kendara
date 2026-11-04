import type { Planet as PlanetData } from "@/lib/astrology";
import { Planet, PlanetaryStrength, ZodiacSign } from "@/lib/astrologyEnums";
import { DashaNumberReason, computeDashaNumbers } from "@/lib/dashaNumbers";

const LAGNA = ZodiacSign.ARIES;

const planet = (name: Planet, sign: ZodiacSign, nakshatra: number): PlanetData => ({
    name,
    sign,
    degree: 10,
    absoluteDegree: (sign - 1) * 30 + 10,
    house: ((sign - LAGNA + 12) % 12) + 1,
    nakshatra,
    pada: 1,
    retrograde: false,
    combustion: false,
    strength: PlanetaryStrength.SAMA,
    navamsaSign: sign,
    navamsaStrength: PlanetaryStrength.SAMA,
    aspects: [],
});

// Nakshatra ids: 1 Ashwini (Ketu), 3 Krittika (Sun), 5 Mrigashira (Mars), 8 Pushya (Saturn), 6 Ardra (Rahu).
const planets: PlanetData[] = [
    planet(Planet.SUN, ZodiacSign.LEO, 8),
    planet(Planet.MOON, ZodiacSign.CANCER, 6),
    planet(Planet.MARS, ZodiacSign.GEMINI, 1),
    planet(Planet.MERCURY, ZodiacSign.VIRGO, 3),
    planet(Planet.JUPITER, ZodiacSign.SAGITTARIUS, 3),
    planet(Planet.VENUS, ZodiacSign.LIBRA, 3),
    planet(Planet.SATURN, ZodiacSign.TAURUS, 5),
    planet(Planet.RAHU, ZodiacSign.CAPRICORN, 3),
    planet(Planet.KETU, ZodiacSign.CANCER, 3),
];

const values = (list: { value: number }[]) => list.map(({ value }) => value);

describe("computeDashaNumbers", () => {
    const numbers = computeDashaNumbers(planets, LAGNA, true);

    it("lists a two-sign planet's position followed by both owned houses", () => {
        // Mars in Gemini (3), owns Aries (1) and Scorpio (8)
        expect(values(numbers[Planet.MARS].own)).toEqual([3, 1, 8]);
        expect(numbers[Planet.MARS].own.map(({ reason }) => reason)).toEqual([
            DashaNumberReason.POSITION,
            DashaNumberReason.OWNED_HOUSE,
            DashaNumberReason.OWNED_HOUSE,
        ]);
    });

    it("lists a single owned house for the Sun", () => {
        // Sun in Leo (5), owns Leo (5)
        expect(values(numbers[Planet.SUN].own)).toEqual([5, 5]);
    });

    it("uses the sign lord's position and its other sign for Rahu", () => {
        // Rahu in Capricorn (10) → Saturn in Taurus (2) → Aquarius (11)
        const { own } = numbers[Planet.RAHU];
        expect(values(own)).toEqual([10, 2, 11]);
        expect(own[1]).toMatchObject({ reason: DashaNumberReason.DISPOSITOR_POSITION, planet: Planet.SATURN });
        expect(own[2]).toMatchObject({
            reason: DashaNumberReason.DISPOSITOR_OTHER_HOUSE,
            planet: Planet.SATURN,
            sign: ZodiacSign.AQUARIUS,
        });
    });

    it("adds no extra house when the node's sign lord owns a single sign", () => {
        // Ketu in Cancer (4) → Moon in Cancer (4), Moon owns only Cancer
        expect(values(numbers[Planet.KETU].own)).toEqual([4, 4]);
    });

    it("computes the nakshatra lord's numbers", () => {
        // Saturn in Mrigashira → Mars: in 3, owns 1 and 8
        expect(numbers[Planet.SATURN].nakshatraLord).toBe(Planet.MARS);
        expect(values(numbers[Planet.SATURN].nakshatraLordNumbers)).toEqual([3, 1, 8]);
    });

    it("applies the node rule when the nakshatra lord is Ketu", () => {
        // Mars in Ashwini → Ketu: in 4, Moon in 4
        expect(numbers[Planet.MARS].nakshatraLord).toBe(Planet.KETU);
        expect(values(numbers[Planet.MARS].nakshatraLordNumbers)).toEqual([4, 4]);
    });

    it("omits nakshatra numbers when nakshatra data is unavailable", () => {
        const withoutNakshatra = computeDashaNumbers(planets, LAGNA, false);
        expect(withoutNakshatra[Planet.MARS].nakshatraLord).toBeNull();
        expect(withoutNakshatra[Planet.MARS].nakshatraLordNumbers).toEqual([]);
    });
});
