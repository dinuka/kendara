/**
 * Vimshottari dasha cycle — shared by the server calculation (`calculation.ts`) and the browser,
 * which derives Prana periods on demand (`pranaDasha.ts`). Pure: no native dependencies.
 */

/** Cycle order with each lord's years (planet ids per `astrologyEnums.Planet`). */
export const VIMSHOTTARI_CYCLE: readonly { planet: number; years: number }[] = [
    { planet: 9, years: 7 },
    { planet: 6, years: 20 },
    { planet: 1, years: 6 },
    { planet: 2, years: 10 },
    { planet: 3, years: 7 },
    { planet: 8, years: 18 },
    { planet: 5, years: 16 },
    { planet: 7, years: 19 },
    { planet: 4, years: 17 },
];

export const PLANET_TO_CYCLE_INDEX: Record<number, number> = {
    9: 0,
    6: 1,
    1: 2,
    2: 3,
    3: 4,
    8: 5,
    5: 6,
    7: 7,
    4: 8,
};

export const TOTAL_VIMSHOTTARI_YEARS = 120;

export function getStartPlanetIndex(planet: number): number {
    return PLANET_TO_CYCLE_INDEX[planet] ?? 0;
}

export function getPlanetYears(planet: number): number {
    const entry = VIMSHOTTARI_CYCLE.find((e) => e.planet === planet);
    return entry?.years ?? 0;
}

/** `count` lords of the cycle starting at `startIndex`. */
export function getCyclePlanets(startIndex: number, count: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < count; i++) {
        result.push(VIMSHOTTARI_CYCLE[(startIndex + i) % 9].planet);
    }
    return result;
}
