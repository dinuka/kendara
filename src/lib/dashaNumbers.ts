import { SIGN_LORD, getNakshatraLord } from "@/lib/astrology";
import type { Planet as PlanetData } from "@/lib/astrology";
import { Planet } from "@/lib/astrologyEnums";

export enum DashaNumberReason {
    POSITION = "position",
    OWNED_HOUSE = "ownedHouse",
    DISPOSITOR_POSITION = "dispositorPosition",
    DISPOSITOR_OTHER_HOUSE = "dispositorOtherHouse",
}

export interface DashaNumber {
    /** House number shown on the tag. */
    value: number;
    reason: DashaNumberReason;
    /** The planet whose position / sign ownership produced this number. */
    planet: number;
    /** The planet the group is about (differs from `planet` for Rahu/Ketu dispositor numbers). */
    source: number;
    /** The owned sign, for the house-ownership reasons. */
    sign?: number;
}

export interface PlanetDashaNumbers {
    own: DashaNumber[];
    /** Nakshatra lord of the planet; null when nakshatra data is unavailable. */
    nakshatraLord: number | null;
    nakshatraLordNumbers: DashaNumber[];
}

const NODES = new Set<number>([Planet.RAHU, Planet.KETU]);

/** Whole-sign house number of a sign counted from the lagna. */
const houseOfSign = (lagnaSign: number, sign: number): number => ((sign - lagnaSign + 12) % 12) + 1;

/** Signs ruled by the planet, in zodiac order. */
const signsOwnedBy = (planet: number): number[] => {
    const signs: number[] = [];

    for (let sign = 1; sign <= 12; sign += 1) {
        if (SIGN_LORD[sign] === planet) signs.push(sign);
    }

    return signs;
};

/** Position + house numbers for one planet. Rahu/Ketu own no houses, so their sign lord's position
 *  and the sign lord's other sign(s) are used in place of owned houses. */
const numbersFor = (planetId: number, planetById: Map<number, PlanetData>, lagnaSign: number): DashaNumber[] => {
    const planet = planetById.get(planetId);
    if (!planet) return [];

    const numbers: DashaNumber[] = [
        { value: planet.house, reason: DashaNumberReason.POSITION, planet: planetId, source: planetId },
    ];

    if (!NODES.has(planetId)) {
        signsOwnedBy(planetId).forEach((sign) => {
            numbers.push({
                value: houseOfSign(lagnaSign, sign),
                reason: DashaNumberReason.OWNED_HOUSE,
                planet: planetId,
                source: planetId,
                sign,
            });
        });
        return numbers;
    }

    const dispositorId = SIGN_LORD[planet.sign];
    const dispositor = planetById.get(dispositorId);
    if (!dispositor) return numbers;

    numbers.push({
        value: dispositor.house,
        reason: DashaNumberReason.DISPOSITOR_POSITION,
        planet: dispositorId,
        source: planetId,
    });

    signsOwnedBy(dispositorId).forEach((sign) => {
        if (sign === planet.sign) return;

        numbers.push({
            value: houseOfSign(lagnaSign, sign),
            reason: DashaNumberReason.DISPOSITOR_OTHER_HOUSE,
            planet: dispositorId,
            source: planetId,
            sign,
        });
    });

    return numbers;
};

/** Dasha label numbers (e.g. ශනි මහ දශා (3 4 10 | 5 8 4)) for every planet in the chart, keyed by
 *  planet id: the planet's position and houses, then its nakshatra lord's position and houses. */
const computeDashaNumbers = (
    planets: PlanetData[],
    lagnaSign: number,
    includeNakshatra: boolean,
): Record<number, PlanetDashaNumbers> => {
    const planetById = new Map(planets.map((planet) => [planet.name, planet]));
    const result: Record<number, PlanetDashaNumbers> = {};

    planets.forEach(({ name, nakshatra }) => {
        const nakshatraLord = includeNakshatra && nakshatra ? getNakshatraLord(nakshatra) : null;

        result[name] = {
            own: numbersFor(name, planetById, lagnaSign),
            nakshatraLord,
            nakshatraLordNumbers: nakshatraLord === null ? [] : numbersFor(nakshatraLord, planetById, lagnaSign),
        };
    });

    return result;
};

export { computeDashaNumbers };
