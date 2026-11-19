import { SIGN_LORD, getNakshatraLord } from "@/lib/astrology";
import type { Planet as PlanetData } from "@/lib/astrology";
import { Planet } from "@/lib/astrologyEnums";

export enum DashaNumberReason {
    POSITION = "position",
    OWNED_HOUSE = "ownedHouse",
    DISPOSITOR_POSITION = "dispositorPosition",
    DISPOSITOR_HOUSE = "dispositorHouse",
    NODE_NAKSHATRA_LORD_POSITION = "nodeNakshatraLordPosition",
    NODE_NAKSHATRA_LORD_HOUSE = "nodeNakshatraLordHouse",
}

/** Reasons that open a new sub-group inside a Rahu/Ketu number list (rendered with a separator). */
export const DASHA_NUMBER_GROUP_STARTS = new Set<DashaNumberReason>([
    DashaNumberReason.DISPOSITOR_POSITION,
    DashaNumberReason.NODE_NAKSHATRA_LORD_POSITION,
]);

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

/** A planet's position followed by every house it owns, attributed to `source`. */
const positionAndHouses = (
    planet: PlanetData,
    source: number,
    lagnaSign: number,
    positionReason: DashaNumberReason,
    houseReason: DashaNumberReason,
): DashaNumber[] => [
    { value: planet.house, reason: positionReason, planet: planet.name, source },
    ...signsOwnedBy(planet.name).map((sign) => ({
        value: houseOfSign(lagnaSign, sign),
        reason: houseReason,
        planet: planet.name,
        source,
        sign,
    })),
];

/** Position + house numbers for one planet. Rahu/Ketu own no houses, so after their own position
 *  they take their sign lord's position and houses, then their nakshatra lord's position and houses
 *  (only the position when that lord is itself a node; skipped when it is the node itself). */
const numbersFor = (
    planetId: number,
    planetById: Map<number, PlanetData>,
    lagnaSign: number,
    includeNakshatra: boolean,
): DashaNumber[] => {
    const planet = planetById.get(planetId);
    if (!planet) return [];

    if (!NODES.has(planetId)) {
        return positionAndHouses(
            planet,
            planetId,
            lagnaSign,
            DashaNumberReason.POSITION,
            DashaNumberReason.OWNED_HOUSE,
        );
    }

    const numbers: DashaNumber[] = [
        {
            value: planet.house,
            reason: DashaNumberReason.POSITION,
            planet: planetId,
            source: planetId,
        },
    ];

    const dispositor = planetById.get(SIGN_LORD[planet.sign]);
    if (dispositor) {
        numbers.push(
            ...positionAndHouses(
                dispositor,
                planetId,
                lagnaSign,
                DashaNumberReason.DISPOSITOR_POSITION,
                DashaNumberReason.DISPOSITOR_HOUSE,
            ),
        );
    }

    const nakshatraLordId = includeNakshatra && planet.nakshatra ? getNakshatraLord(planet.nakshatra) : null;
    const nakshatraLord = nakshatraLordId === null ? undefined : planetById.get(nakshatraLordId);
    if (!nakshatraLord || nakshatraLord.name === planetId) return numbers;

    if (NODES.has(nakshatraLord.name)) {
        numbers.push({
            value: nakshatraLord.house,
            reason: DashaNumberReason.NODE_NAKSHATRA_LORD_POSITION,
            planet: nakshatraLord.name,
            source: planetId,
        });
        return numbers;
    }

    numbers.push(
        ...positionAndHouses(
            nakshatraLord,
            planetId,
            lagnaSign,
            DashaNumberReason.NODE_NAKSHATRA_LORD_POSITION,
            DashaNumberReason.NODE_NAKSHATRA_LORD_HOUSE,
        ),
    );

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
            own: numbersFor(name, planetById, lagnaSign, includeNakshatra),
            nakshatraLord,
            nakshatraLordNumbers:
                nakshatraLord === null ? [] : numbersFor(nakshatraLord, planetById, lagnaSign, includeNakshatra),
        };
    });

    return result;
};

export { computeDashaNumbers };
