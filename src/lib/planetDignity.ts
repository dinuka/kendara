/** Sign dignity (ස්ථාන බලය) of the seven classical planets — the single source for
 *  උච්ච / නීච / ත්‍රිකෝණ / ස්වක්ෂේත්‍ර classification (ශ්ලෝක 49–54).
 *
 *  - Uccha signs (49): Sun Aries, Moon Taurus, Mars Capricorn, Mercury Virgo, Jupiter Cancer,
 *    Venus Pisces, Saturn Libra. The deep-exaltation degree (50) is 10°, 3°, 28°, 15°, 5°, 27°, 20°.
 *  - Neecha sign = 7th from the uccha sign; the deep-debilitation degree equals the uccha degree.
 *  - Where the uccha sign is also the moolatrikona / own sign (Moon in Taurus, Mercury in Virgo),
 *    the sign is split by degree: uccha only up to the deep degree, then trikona, then own sign.
 *  - Trikona / own-sign splits (51–54): Sun Leo 0–20 / 20–30; Moon Taurus 3–30 trikona;
 *    Mars Aries 0–12 / 12–30; Mercury Virgo 15–20 trikona, 20–30 own; Jupiter Sagittarius 0–10 / 10–30;
 *    Venus Libra 0–15 / 15–30; Saturn Aquarius 0–20 / 20–30.
 *
 *  Rahu/Ketu have no entries and fall through to the friend/enemy/sama check.
 *  All inputs/outputs are numeric enums (Planet 1–9, ZodiacSign 1–12). */
import { NATURAL_ENEMIES, NATURAL_FRIENDS, SIGN_LORD } from "@/lib/astrology";
import { Planet, PlanetaryStrength } from "@/lib/astrologyEnums";

interface DegreeRange {
    sign: number;
    start: number;
    end: number;
}

/** Uccha sign per planet (ශ්ලෝක 49). */
export const EXALTATION_SIGN: Record<number, number> = {
    [Planet.SUN]: 1,
    [Planet.MOON]: 2,
    [Planet.MARS]: 10,
    [Planet.MERCURY]: 6,
    [Planet.JUPITER]: 4,
    [Planet.VENUS]: 12,
    [Planet.SATURN]: 7,
};

/** Deep uccha / neecha degree within the sign (ශ්ලෝක 50). */
export const EXALTATION_DEGREE: Record<number, number> = {
    [Planet.SUN]: 10,
    [Planet.MOON]: 3,
    [Planet.MARS]: 28,
    [Planet.MERCURY]: 15,
    [Planet.JUPITER]: 5,
    [Planet.VENUS]: 27,
    [Planet.SATURN]: 20,
};

/** Neecha sign = 7th sign from the uccha sign. */
export const DEBILITATION_SIGN: Record<number, number> = Object.fromEntries(
    Object.entries(EXALTATION_SIGN).map(([planet, sign]) => [planet, ((sign + 5) % 12) + 1]),
);

/** Own signs (ස්වක්ෂේත්‍ර) per planet. */
export const OWN_SIGNS: Record<number, number[]> = {
    [Planet.SUN]: [5],
    [Planet.MOON]: [4],
    [Planet.MARS]: [1, 8],
    [Planet.MERCURY]: [3, 6],
    [Planet.JUPITER]: [9, 12],
    [Planet.VENUS]: [2, 7],
    [Planet.SATURN]: [10, 11],
};

/** Moolatrikona (ත්‍රිකෝණ) degree range per planet (ශ්ලෝක 51–54), end exclusive. */
export const MOOLATRIKONA_RANGE: Record<number, DegreeRange> = {
    [Planet.SUN]: { sign: 5, start: 0, end: 20 },
    [Planet.MOON]: { sign: 2, start: 3, end: 30 },
    [Planet.MARS]: { sign: 1, start: 0, end: 12 },
    [Planet.MERCURY]: { sign: 6, start: 15, end: 20 },
    [Planet.JUPITER]: { sign: 9, start: 0, end: 10 },
    [Planet.VENUS]: { sign: 7, start: 0, end: 15 },
    [Planet.SATURN]: { sign: 11, start: 0, end: 20 },
};

/** Within this many degrees of the deep point, uccha/neecha becomes athi-uccha/athi-neecha. */
const DEEP_ORB = 1;

/** Planets whose uccha sign is also their moolatrikona sign: uccha holds only up to the deep
 *  degree (Moon Taurus 0–3°, Mercury Virgo 0–15°); past it the trikona/own-sign split applies. */
function isWithinUcchaPortion(planet: number, sign: number, degree: number): boolean {
    if (EXALTATION_SIGN[planet] !== sign) return false;
    const sharesTrikona = MOOLATRIKONA_RANGE[planet]?.sign === sign;
    return !sharesTrikona || degree < EXALTATION_DEGREE[planet];
}

function inRange(range: DegreeRange | undefined, sign: number, degree: number): boolean {
    return !!range && range.sign === sign && degree >= range.start && degree < range.end;
}

/** Sign-based planetary strength for a planet at `degree` (0–30) within `sign`.
 *  Pass degree 0 when only the sign is known (e.g. divisional charts) — that resolves to the
 *  sign's opening portion (uccha / trikona where those start at 0°). */
export function computePlanetStrength(planet: number, sign: number, degree = 0): PlanetaryStrength {
    const deepDeg = EXALTATION_DEGREE[planet];
    const nearDeep = deepDeg !== undefined && Math.abs(degree - deepDeg) < DEEP_ORB;

    if (isWithinUcchaPortion(planet, sign, degree))
        return nearDeep ? PlanetaryStrength.ATHI_UCHCHA : PlanetaryStrength.UCHCHA;
    if (DEBILITATION_SIGN[planet] === sign) return nearDeep ? PlanetaryStrength.ATHI_NEECHA : PlanetaryStrength.NEECHA;
    if (inRange(MOOLATRIKONA_RANGE[planet], sign, degree)) return PlanetaryStrength.MOOLATRIKONA;
    if (OWN_SIGNS[planet]?.includes(sign)) return PlanetaryStrength.OWN_SIGN;

    const signLord = SIGN_LORD[sign];
    if (NATURAL_FRIENDS[planet]?.includes(signLord)) return PlanetaryStrength.MITRA;
    if (NATURAL_ENEMIES[planet]?.includes(signLord)) return PlanetaryStrength.SHATRU;
    return PlanetaryStrength.SAMA;
}
