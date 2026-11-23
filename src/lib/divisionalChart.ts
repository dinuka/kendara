/** Shared builder for sign-mapped divisional (varga) charts such as Drekkana (D3) and Trimshamsha
 *  (D30): every planet and the lagna move to the varga sign their D1 sign + in-sign degree map to,
 *  houses are whole-sign from the varga lagna and strengths are re-derived from the varga sign.
 *  Only the varga sign is derived — no varga degree longitude. */
import type { Ascendant, Planet } from "@/lib/astrology";
import { ZodiacSign } from "@/lib/astrologyEnums";
import type { ChartInput } from "@/lib/chartDataTransform";
import { SIGN_LORD, buildWholeSignHouses, computePlanetStrength } from "@/lib/manualChart";

/** Varga sign (1-12) for a D1 sign (1-12) and the degree within that sign. */
export type VargaSignFn = (sign: number, degreeInSign: number | undefined) => ZodiacSign;

/** Degree within a sign normalized into [0, 30) so absolute longitudes and missing values degrade
 *  gracefully. */
export const normalizeDegreeInSign = (degreeInSign: number | undefined): number =>
    (((degreeInSign ?? 0) % 30) + 30) % 30;

export const buildDivisionalChart = (
    { planets, ascendant }: Pick<ChartInput, "planets" | "ascendant">,
    toVargaSign: VargaSignFn,
): ChartInput => {
    const lagnaSign = toVargaSign(ascendant.sign, ascendant.degree);
    const vargaPlanets: Planet[] = planets.map((p) => {
        const sign = toVargaSign(p.sign, p.degree);
        return {
            ...p,
            sign,
            house: ((sign - lagnaSign + 12) % 12) + 1,
            strength: computePlanetStrength(p.name, sign, 0),
        };
    });
    const vargaAscendant: Ascendant = {
        sign: lagnaSign,
        degree: 0,
        lord: SIGN_LORD[lagnaSign] ?? 1,
    };
    return {
        planets: vargaPlanets,
        houses: buildWholeSignHouses(lagnaSign),
        ascendant: vargaAscendant,
    };
};
