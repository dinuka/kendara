import { PLANET_COLORS, PLANET_SYMBOLS } from "@/lib/astrology";

export const SIGN_SYMBOLS: Record<number, string> = {
    1: "♈",
    2: "♉",
    3: "♊",
    4: "♋",
    5: "♌",
    6: "♍",
    7: "♎",
    8: "♏",
    9: "♐",
    10: "♑",
    11: "♒",
    12: "♓",
};

export const SIGN_LORDS: Record<number, number> = {
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

export { PLANET_COLORS, PLANET_SYMBOLS };

export function planetGlyph(planet: number): string {
    return PLANET_SYMBOLS[planet] ?? "?";
}

export function planetColor(planet: number): string {
    return PLANET_COLORS[planet] ?? "#666";
}

export function signGlyph(sign: number): string {
    return SIGN_SYMBOLS[sign] ?? "?";
}
