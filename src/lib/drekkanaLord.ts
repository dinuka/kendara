import { type House, type Planet, SIGN_LORD, findHouse } from "@/lib/astrology";

/** Nth Drekkana lord (N දෙර්කාණාධිපති) of a point: count N drekkanas (10° parts) from the point's own
 *  drekkana and take the lord of that drekkana's D3 sign (1st part → same sign, 2nd → 5th, 3rd → 9th).
 *  For N = 1 + 3k the target lies k signs ahead in the same part, e.g. the 22nd drekkana is the
 *  8th/12th/4th sign for a point in its 1st (0-10°), 2nd (10-20°) or 3rd (20-30°) drekkana. */
export const getNthDrekkanaLord = (n: number, sign: number, degree: number) => {
    const drekkana = Math.min(Math.floor(degree / 10), 2);
    const target = (sign - 1) * 3 + drekkana + (n - 1);
    const targetSign = Math.floor(target / 3) % 12;
    const d3Sign = ((targetSign + (target % 3) * 4) % 12) + 1;
    return SIGN_LORD[d3Sign] || 1;
};

/** 22nd Drekkana lord (22 දෙර්කාණාධිපති): the lord of the 8th, 12th or 4th sign from the point's sign. */
export const get22ndDrekkanaLord = (sign: number, degree: number) => getNthDrekkanaLord(22, sign, degree);

/** The extra lagna drekkana lords shown beside the 22nd: 10th (4th/8th/12th sign), 16th (6th/10th/2nd)
 *  and 34th (12th/4th/8th) for a lagna in its 1st/2nd/3rd drekkana. */
export const EXTRA_DREKKANA_COUNTS = [10, 16, 34] as const;

export const getExtraDrekkanaLords = (sign: number, degree: number) => ({
    lord10thDrekkana: getNthDrekkanaLord(10, sign, degree),
    lord16thDrekkana: getNthDrekkanaLord(16, sign, degree),
    lord34thDrekkana: getNthDrekkanaLord(34, sign, degree),
});

/** 22nd Drekkana lord counted from the bhava a planet occupies (Chandra/Ravi lagna). Uses the bhava
 *  madhya sphuta of the house containing the planet — never the planet's own longitude. The house is
 *  found from the cusp-boundary ranges, falling back to the planet's whole-sign house. */
export const get22ndDrekkanaLordFromPlanet = (
    { absoluteDegree, house }: Pick<Planet, "absoluteDegree" | "house">,
    houses: House[],
) => {
    const houseNumber = findHouse(absoluteDegree, houses) ?? house;
    const bhava = houses.find((h) => h.houseNumber === houseNumber);
    if (!bhava) return undefined;
    return get22ndDrekkanaLord(bhava.middleSign, bhava.middleDegree);
};
