import { SIGN_LORD } from "@/lib/astrology";
import { Planet } from "@/lib/astrologyEnums";

/** Classical Kala values of the seven grahas used for Indu Lagna. Rahu and Ketu never rule a
 *  sign, so they have no Kala. */
export const INDU_LAGNA_KALA: Record<number, number> = {
    [Planet.SUN]: 30,
    [Planet.MOON]: 16,
    [Planet.MARS]: 6,
    [Planet.MERCURY]: 8,
    [Planet.JUPITER]: 10,
    [Planet.VENUS]: 12,
    [Planet.SATURN]: 1,
};

export interface InduLagnaResult {
    lagnaSign: number;
    lagnaNinthSign: number;
    lagnaNinthLord: number;
    lagnaNinthLordKala: number;
    moonSign: number;
    moonNinthSign: number;
    moonNinthLord: number;
    moonNinthLordKala: number;
    totalKala: number;
    remainder: number;
    countFromMoon: number;
    sign: number;
}

/** Sign `count` places from `sign`, counting inclusively (`sign` itself is 1). Signs are 1-12. */
const countSignsFrom = (sign: number, count: number) => ((sign - 1 + count - 1) % 12) + 1;

/** Indu (Dhana) Lagna from the Rāśi of the Janma Lagna and of the Moon only — never degrees,
 *  Nakshatra, Navamsa or the 9th lord's placement. Add the Kala of the 9th lord from each, take the
 *  remainder by 12 (0 counts as 12), and count that many signs inclusively from the Moon's sign. */
export const calculateInduLagna = (lagnaSign: number, moonSign: number): InduLagnaResult => {
    const lagnaNinthSign = countSignsFrom(lagnaSign, 9);
    const lagnaNinthLord = SIGN_LORD[lagnaNinthSign];
    const lagnaNinthLordKala = INDU_LAGNA_KALA[lagnaNinthLord];

    const moonNinthSign = countSignsFrom(moonSign, 9);
    const moonNinthLord = SIGN_LORD[moonNinthSign];
    const moonNinthLordKala = INDU_LAGNA_KALA[moonNinthLord];

    const totalKala = lagnaNinthLordKala + moonNinthLordKala;
    const remainder = totalKala % 12;
    const countFromMoon = remainder === 0 ? 12 : remainder;

    return {
        lagnaSign,
        lagnaNinthSign,
        lagnaNinthLord,
        lagnaNinthLordKala,
        moonSign,
        moonNinthSign,
        moonNinthLord,
        moonNinthLordKala,
        totalKala,
        remainder,
        countFromMoon,
        sign: countSignsFrom(moonSign, countFromMoon),
    };
};
