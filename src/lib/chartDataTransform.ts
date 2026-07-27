import { Ascendant, CalculationResult, House, Planet } from "@/lib/astrology";
import { ChartType } from "@/lib/chartTypes";

export interface ChartInput {
    planets: Planet[];
    houses: House[];
    ascendant: Ascendant;
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
