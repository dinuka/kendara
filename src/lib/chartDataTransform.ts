import { Ascendant, CalculationResult, House, Planet } from "@/lib/astrology";
import { ChartType } from "@/lib/chartTypes";

export interface ChartInput {
    planets: Planet[];
    houses: House[];
    ascendant: Ascendant;
}

export interface ChartHouse {
    houseNumber: number;
    sign: number;
    lord: number;
}

export interface ChartPlanet {
    name: number;
    house: number;
    degree: number;
    retrograde: boolean;
}

export interface ChartAscendant {
    sign: number;
    degree: number;
}

export interface BirthChartData {
    planets: ChartPlanet[];
    houses: ChartHouse[];
    ascendant: ChartAscendant;
}

/** Projects full or already-lean chart data down to the minimal shape the square North-Indian
 *  birth chart needs (houses -> {houseNumber, sign, lord}, planets -> {name, house, degree,
 *  retrograde}, ascendant -> {sign, degree}). Used both for a lean input contract at render time
 *  and for persisting only the minimal `data` on birth-type `Chart` documents. */
export function toBirthChartData(input: {
    planets: Array<Pick<Planet, "name" | "house" | "degree" | "retrograde">>;
    houses: Array<Pick<House, "houseNumber" | "sign" | "lord">>;
    ascendant: Pick<Ascendant, "sign" | "degree">;
}): BirthChartData {
    return {
        planets: input.planets.map(({ name, house, degree, retrograde }) => ({ name, house, degree, retrograde })),
        houses: input.houses.map(({ houseNumber, sign, lord }) => ({ houseNumber, sign, lord })),
        ascendant: { sign: input.ascendant.sign, degree: input.ascendant.degree },
    };
}

const SIGN_LORD: Record<number, number> = {
    1: 3,
    2: 6,
    3: 4,
    4: 2,
    5: 1,
    6: 4,
    7: 6,
    8: 3,
    9: 5,
    10: 7,
    11: 7,
    12: 5,
};

function rotateToLagna(
    houses: House[],
    planets: Planet[],
    currentAsc: Ascendant,
    targetSign: number,
    targetDegree: number,
): ChartInput {
    const signOffset = (targetSign - currentAsc.sign + 12) % 12;

    const newHouses = houses.map((_, i) => {
        const oldIndex = (signOffset + i) % 12;
        return { ...houses[oldIndex], houseNumber: i + 1 };
    });

    const newPlanets = planets.map((p) => ({
        ...p,
        house: ((p.sign - targetSign + 12) % 12) + 1,
    }));

    const newAscendant: Ascendant = {
        sign: targetSign,
        degree: targetDegree,
        lord: SIGN_LORD[targetSign] || 1,
    };

    return { houses: newHouses, planets: newPlanets, ascendant: newAscendant };
}

/** Chart types that render as the square North-Indian birth chart. Their persisted `data` only
 *  needs the lean shape (minimal houses/planets/ascendant); all other chart types keep the full
 *  calculated data (e.g. the wheel `house` chart needs real Placidus cusps). */
const LEAN_CHART_TYPES: ReadonlySet<ChartType> = new Set([
    ChartType.BIRTH,
    ChartType.NAVAMSA_D9,
    ChartType.CHANDRA_LAGNA,
    ChartType.SURYA_LAGNA,
]);

export function isLeanChartType(type: ChartType): boolean {
    return LEAN_CHART_TYPES.has(type);
}

export function getChartData(result: CalculationResult, type: ChartType): ChartInput {
    if (type === ChartType.CHANDRA_LAGNA) {
        const moon = result.planets.find((p) => p.name === 2);
        if (!moon) {
            return { houses: result.houses, planets: result.planets, ascendant: result.ascendant };
        }
        return rotateToLagna(result.houses, result.planets, result.ascendant, moon.sign, moon.degree);
    }

    if (type === ChartType.SURYA_LAGNA) {
        const sun = result.planets.find((p) => p.name === 1);
        if (!sun) {
            return { houses: result.houses, planets: result.planets, ascendant: result.ascendant };
        }
        return rotateToLagna(result.houses, result.planets, result.ascendant, sun.sign, sun.degree);
    }

    return { houses: result.houses, planets: result.planets, ascendant: result.ascendant };
}
