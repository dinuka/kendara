import { SIGN_LORD, getNakshatraLord } from "@/lib/astrology";

export interface BadhakaPlanetInput {
    name: number;
    sign: number;
    nakshatra: number;
}

/** Badhaka house counted from the lagna: 11th for a movable (chara) lagna, 9th for a fixed
 *  (sthira) lagna and 7th for a dual (ubhaya) lagna. */
export const getBadhakaHouse = (ascSign: number) => {
    if ([1, 4, 7, 10].includes(ascSign)) return 11;
    if ([2, 5, 8, 11].includes(ascSign)) return 9;
    return 7;
};

export const getBadhakaSign = (ascSign: number) => ((ascSign + getBadhakaHouse(ascSign) - 2) % 12) + 1;

/** Badhaka planets in four levels, keyed by planet with every level it qualifies for (ascending):
 *  1 — planets in the nakshatras of the planets occupying the badhaka sign
 *  2 — planets occupying the badhaka sign
 *  3 — planets in the nakshatras of the badhaka lord
 *  4 — the badhaka lord
 *  Levels 1 and 3 need a real nakshatra, so callers pass `useNakshatra: false` when the planets'
 *  nakshatras are placeholders (manual charts without Navamsa data). */
export const calculateBadhakaLevels = (
    ascSign: number,
    planets: BadhakaPlanetInput[],
    useNakshatra = true,
): Record<number, number[]> => {
    const badhakaSign = getBadhakaSign(ascSign);
    const badhakaLord = SIGN_LORD[badhakaSign];
    const occupants = new Set<number>();
    planets.forEach(({ name, sign }) => {
        if (sign === badhakaSign) occupants.add(name);
    });

    const levels: Record<number, number[]> = {};
    const addLevel = (planet: number, level: number) => {
        if (!levels[planet]) levels[planet] = [];
        levels[planet].push(level);
    };

    planets.forEach(({ name, nakshatra }) => {
        const nakshatraLord = useNakshatra ? getNakshatraLord(nakshatra) : undefined;
        if (nakshatraLord !== undefined && occupants.has(nakshatraLord)) addLevel(name, 1);
        if (occupants.has(name)) addLevel(name, 2);
        if (nakshatraLord === badhakaLord) addLevel(name, 3);
        if (name === badhakaLord) addLevel(name, 4);
    });

    return levels;
};
