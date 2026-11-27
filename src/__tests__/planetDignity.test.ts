import { Planet, PlanetaryStrength, ZodiacSign } from "@/lib/astrologyEnums";
import { DEBILITATION_SIGN, EXALTATION_DEGREE, EXALTATION_SIGN, computePlanetStrength } from "@/lib/planetDignity";

const S = PlanetaryStrength;

describe("planetDignity — uccha/neecha signs and degrees (ශ්ලෝක 49–50)", () => {
    test("uccha signs", () => {
        expect(EXALTATION_SIGN).toEqual({
            [Planet.SUN]: ZodiacSign.ARIES,
            [Planet.MOON]: ZodiacSign.TAURUS,
            [Planet.MARS]: ZodiacSign.CAPRICORN,
            [Planet.MERCURY]: ZodiacSign.VIRGO,
            [Planet.JUPITER]: ZodiacSign.CANCER,
            [Planet.VENUS]: ZodiacSign.PISCES,
            [Planet.SATURN]: ZodiacSign.LIBRA,
        });
    });

    test("deep uccha degrees", () => {
        expect(EXALTATION_DEGREE).toEqual({
            [Planet.SUN]: 10,
            [Planet.MOON]: 3,
            [Planet.MARS]: 28,
            [Planet.MERCURY]: 15,
            [Planet.JUPITER]: 5,
            [Planet.VENUS]: 27,
            [Planet.SATURN]: 20,
        });
    });

    test("neecha sign is the 7th from the uccha sign", () => {
        expect(DEBILITATION_SIGN).toEqual({
            [Planet.SUN]: ZodiacSign.LIBRA,
            [Planet.MOON]: ZodiacSign.SCORPIO,
            [Planet.MARS]: ZodiacSign.CANCER,
            [Planet.MERCURY]: ZodiacSign.PISCES,
            [Planet.JUPITER]: ZodiacSign.CAPRICORN,
            [Planet.VENUS]: ZodiacSign.VIRGO,
            [Planet.SATURN]: ZodiacSign.ARIES,
        });
    });

    test.each(Object.keys(EXALTATION_SIGN).map(Number))(
        "planet %d: athi at the deep degree, uccha/neecha elsewhere",
        (p) => {
            const deep = EXALTATION_DEGREE[p];
            expect(computePlanetStrength(p, EXALTATION_SIGN[p], deep - 0.5)).toBe(S.ATHI_UCHCHA);
            expect(computePlanetStrength(p, DEBILITATION_SIGN[p], deep)).toBe(S.ATHI_NEECHA);
            const far = deep >= 15 ? 0 : 29;
            expect(computePlanetStrength(p, DEBILITATION_SIGN[p], far)).toBe(S.NEECHA);
        },
    );
});

describe("planetDignity — trikona / svakshetra splits (ශ්ලෝක 51–54)", () => {
    test.each([
        // [planet, sign, degree, expected]
        [Planet.SUN, ZodiacSign.LEO, 0, S.MOOLATRIKONA],
        [Planet.SUN, ZodiacSign.LEO, 19.99, S.MOOLATRIKONA],
        [Planet.SUN, ZodiacSign.LEO, 20, S.OWN_SIGN],
        [Planet.MOON, ZodiacSign.TAURUS, 1, S.UCHCHA],
        [Planet.MOON, ZodiacSign.TAURUS, 2.5, S.ATHI_UCHCHA],
        [Planet.MOON, ZodiacSign.TAURUS, 3, S.MOOLATRIKONA],
        [Planet.MOON, ZodiacSign.TAURUS, 29.9, S.MOOLATRIKONA],
        [Planet.MOON, ZodiacSign.CANCER, 10, S.OWN_SIGN],
        [Planet.MARS, ZodiacSign.ARIES, 11.99, S.MOOLATRIKONA],
        [Planet.MARS, ZodiacSign.ARIES, 12, S.OWN_SIGN],
        [Planet.MARS, ZodiacSign.SCORPIO, 5, S.OWN_SIGN],
        [Planet.MERCURY, ZodiacSign.VIRGO, 5, S.UCHCHA],
        [Planet.MERCURY, ZodiacSign.VIRGO, 14.5, S.ATHI_UCHCHA],
        [Planet.MERCURY, ZodiacSign.VIRGO, 15, S.MOOLATRIKONA],
        [Planet.MERCURY, ZodiacSign.VIRGO, 19.99, S.MOOLATRIKONA],
        [Planet.MERCURY, ZodiacSign.VIRGO, 20, S.OWN_SIGN],
        [Planet.MERCURY, ZodiacSign.GEMINI, 10, S.OWN_SIGN],
        [Planet.JUPITER, ZodiacSign.SAGITTARIUS, 9.99, S.MOOLATRIKONA],
        [Planet.JUPITER, ZodiacSign.SAGITTARIUS, 10, S.OWN_SIGN],
        [Planet.VENUS, ZodiacSign.LIBRA, 14.99, S.MOOLATRIKONA],
        [Planet.VENUS, ZodiacSign.LIBRA, 15, S.OWN_SIGN],
        [Planet.SATURN, ZodiacSign.AQUARIUS, 19.99, S.MOOLATRIKONA],
        [Planet.SATURN, ZodiacSign.AQUARIUS, 20, S.OWN_SIGN],
        [Planet.SATURN, ZodiacSign.CAPRICORN, 5, S.OWN_SIGN],
    ])("planet %d in sign %d at %d° → %d", (planet, sign, degree, expected) => {
        expect(computePlanetStrength(planet, sign, degree)).toBe(expected);
    });
});
