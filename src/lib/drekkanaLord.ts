import { type House, type Planet, SIGN_LORD, findHouse } from "@/lib/astrology";

/** 22nd Drekkana lord (22 දෙර්කාණාධිපති) of a point: the lord of the 8th, 12th or 4th sign from the
 *  point's sign when the point falls in its 1st (0-10°), 2nd (10-20°) or 3rd (20-30°) drekkana. */
export const get22ndDrekkanaLord = (sign: number, degree: number) => {
    const drekkana = Math.min(Math.floor(degree / 10), 2);
    const houseOffset = [8, 12, 4][drekkana];
    return SIGN_LORD[((sign - 1 + houseOffset - 1) % 12) + 1] || 1;
};

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
