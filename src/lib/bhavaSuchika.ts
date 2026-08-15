import { navamsaSign } from "@/lib/astrology";
import type { Planet } from "@/lib/astrology";

// Bhava Suchika (භාව සුචික) — the house (1–12) that a point's Navamsa sign occupies in the
// birth (Lagna) chart, computed on the whole-sign basis:
//
//     Bhava Suchika = ((navamsaSign − lagnaSign) mod 12) + 1
//
// Values are always numeric enum values (ZodiacSign for signs, houses as plain 1–12 integers);
// display names are resolved per-locale at render time via i18n messages.

/**
 * Derives the Navamsa (D9) Lagna sign from the birth ascendant. The D9 wedge containing the
 * ascendant degree advances the Navamsa lagna by one sign per 3°20′ (30/9 degrees) of the
 * birth ascendant's position within its sign; the wedge is resolved into a D9 sign via the
 * shared movable/fixed/dual offset table (`astrology.navamsaSign`) so this function always
 * agrees with the calculation pipeline.
 */
export function computeNavamsaLagnaSign(ascSign: number, ascDegree: number): number {
    const inSign = ((ascDegree % 30) + 30) % 30;
    // +1e-9 pins exact boundary multiples (e.g. 2*(30/9) lands ~1.9999999999999998 in doubles)
    // to the upper wedge, matching the mathematical boundary semantics of UT-BS-013/015.
    const wedge = Math.floor(inSign / (30 / 9) + 1e-9) + 1;
    return navamsaSign(ascSign, wedge);
}

/** Bhava Suchika of the Lagna point: the house its Navamsa sign occupies in the Lagna chart. */
export function computeLagnaBhavaSuchika(lagnaSign: number, navamsaLagnaSign: number): number {
    return ((((navamsaLagnaSign - lagnaSign) % 12) + 12) % 12) + 1;
}

/** Bhava Suchika of a single planet: the house its Navamsa sign occupies in the Lagna chart. */
export function computePlanetBhavaSuchika(navamsaSignValue: number, lagnaSign: number): number {
    return ((((navamsaSignValue - lagnaSign) % 12) + 12) % 12) + 1;
}

/** Bhava Suchika for every planet, keyed by planet enum value ("1".."9"). */
export function computeBhavaSuchika(
    planets: Array<Pick<Planet, "name" | "navamsaSign">>,
    lagnaSign: number,
): Record<string, number> {
    const result: Record<string, number> = {};
    for (const { name, navamsaSign: navamsaSignValue } of planets) {
        result[String(name)] = computePlanetBhavaSuchika(navamsaSignValue, lagnaSign);
    }
    return result;
}

// ---------------------------------------------------------------------------
// Resolution helpers shared by the render path (horoscope page, search page)
// and the search route. They treat the persisted CalculatedDetails doc as an
// opaque record so the same rules apply everywhere:
//
//   - stored valid (integer 1–12) value wins;
//   - stored corrupt value/record → undefined + console.warn (never guessed);
//   - stored empty/sparse record → undefined (renders "—"), no fallback;
//   - absent fields → pure-function fallback UNLESS the chart is manual without
//     entered Navamsa data (D5 matrix: manual charts never derive Navamsa from
//     birth-sign positions).
// ---------------------------------------------------------------------------

export function isValidBhavaSuchikaValue(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 12;
}

function isValidSign(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 12;
}

type CalcLike = Record<string, unknown>;

interface ManualPlacementsLike {
    navamsaLagna?: unknown;
    navamsaHouses?: unknown[] | null;
}

function manualPlacements(doc: CalcLike): ManualPlacementsLike | null {
    const raw = doc.manualHousePlacements;
    if (!raw || typeof raw !== "object") return null;
    return raw as ManualPlacementsLike;
}

/** Resolves the Lagna Bhava Suchika for a persisted CalculatedDetails doc (may be null/undefined). */
export function resolveLagnaBhavaSuchika(calculatedDetails: unknown): number | undefined {
    if (!calculatedDetails || typeof calculatedDetails !== "object") return undefined;
    const doc = calculatedDetails as CalcLike;

    const stored = doc.lagnaBhavaSuchika;
    if (stored !== undefined && stored !== null) {
        if (isValidBhavaSuchikaValue(stored)) return stored;
        console.warn("Invalid stored lagnaBhavaSuchika value:", stored);
        return undefined;
    }

    const ascendant = doc.ascendant;
    if (!ascendant || typeof ascendant !== "object") return undefined;
    const { sign, degree } = ascendant as CalcLike;
    if (!isValidSign(sign) || typeof degree !== "number") return undefined;

    const manual = manualPlacements(doc);
    if (manual !== null) {
        // Manual charts only ever use entered data (D5 matrix) — never derive the
        // Navamsa Lagna from the birth ascendant degree.
        if (!isValidSign(manual.navamsaLagna)) return undefined;
        return computeLagnaBhavaSuchika(sign, manual.navamsaLagna);
    }
    return computeLagnaBhavaSuchika(sign, computeNavamsaLagnaSign(sign, degree));
}

/** Resolves the Bhava Suchika of a single planet (planetName is the numeric Planet enum value). */
export function resolvePlanetBhavaSuchika(calculatedDetails: unknown, planetName: number): number | undefined {
    // Planet enum values are integers 1..9 — anything else is never a valid key (RE-BS-455).
    if (!Number.isInteger(planetName) || planetName < 1 || planetName > 9) return undefined;
    if (!calculatedDetails || typeof calculatedDetails !== "object") return undefined;
    const doc = calculatedDetails as CalcLike;

    const record = doc.bhavaSuchika;
    if (record !== undefined && record !== null) {
        if (!record || typeof record !== "object") {
            console.warn("Invalid stored bhavaSuchika record:", record);
            return undefined;
        }
        const value = (record as CalcLike)[String(planetName)];
        if (value === undefined) return undefined;
        if (!isValidBhavaSuchikaValue(value)) {
            console.warn(`Invalid stored bhavaSuchika value for planet ${planetName}:`, value);
            return undefined;
        }
        return value;
    }

    const ascendant = doc.ascendant;
    if (!ascendant || typeof ascendant !== "object") return undefined;
    const { sign } = ascendant as CalcLike;
    if (!isValidSign(sign)) return undefined;

    const manual = manualPlacements(doc);
    if (manual !== null) {
        // D5 matrix: per-planet values require entered Navamsa houses — never derive
        // them from a planet's birth-sign position on manual charts. Use the entered
        // Navamsa house signs (a planet's Navamsa sign = the sign of the D9 house it
        // was placed in); planets not placed in any Navamsa house have no value.
        if (!Array.isArray(manual.navamsaHouses) || manual.navamsaHouses.length === 0) return undefined;
        const navamsaSignOfPlanet: Record<number, number> = {};
        for (const house of manual.navamsaHouses) {
            if (!house || typeof house !== "object") continue;
            const { sign: houseSign, planets: housePlanets } = house as CalcLike;
            if (!isValidSign(houseSign) || !Array.isArray(housePlanets)) continue;
            for (const planet of housePlanets) {
                if (typeof planet === "number") navamsaSignOfPlanet[planet] = houseSign;
            }
        }
        const navamsaSignValue = navamsaSignOfPlanet[planetName];
        if (!isValidSign(navamsaSignValue)) return undefined;
        return computePlanetBhavaSuchika(navamsaSignValue, sign);
    }

    const planets = doc.planets;
    if (!Array.isArray(planets)) return undefined;
    const planet = planets.find((p) => p && typeof p === "object" && (p as CalcLike).name === planetName);
    if (!planet || typeof planet !== "object") return undefined;
    const navamsaSignValue = (planet as CalcLike).navamsaSign;
    if (!isValidSign(navamsaSignValue)) return undefined;
    return computePlanetBhavaSuchika(navamsaSignValue, sign);
}
