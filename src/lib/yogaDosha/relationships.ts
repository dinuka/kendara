/**
 * Yoga / Dosha — planet relationship helpers.
 * US-YD-002 Edge: aspect math is NEVER recomputed here — the engine reuses the stored graha
 * drishti records (`PlanetFact.aspects`), the same records the D1 aspects column renders.
 */
import { ChartFacts, PlanetFact } from "@/lib/yogaDosha/types";

/** Whole-sign rulers (Rāśi lords) — parivartana / sign-ownership checks only. */
export const SIGN_LORDS: Record<number, number> = {
    1: 3, // Mesha – Mars
    2: 5, // Vrishabha – Venus
    3: 4, // Mithuna – Mercury
    4: 2, // Karka – Moon
    5: 1, // Simha – Sun
    6: 4, // Kanya – Mercury
    7: 5, // Tula – Venus
    8: 3, // Vrishchika – Mars
    9: 5, // Dhanus – Jupiter
    10: 7, // Makara – Saturn
    11: 7, // Kumbha – Saturn
    12: 5, // Meena – Jupiter
};

/** Vimshottari nakshatra lords (id 1..27 → ruling planet incl. Rahu 8 / Ketu 9) — Agni Marutha
 *  AM-06/AM-07 (nakshatra ownership) basis. */
export const NAKSHATRA_LORDS: Record<number, number> = {
    1: 9, // Ashwini – Ketu
    2: 6, // Bharani – Venus
    3: 1, // Krittika – Sun
    4: 2, // Rohini – Moon
    5: 3, // Mrigashira – Mars
    6: 8, // Ardra – Rahu
    7: 5, // Punarvasu – Jupiter
    8: 7, // Pushya – Saturn
    9: 4, // Ashlesha – Mercury
    10: 9, // Magha – Ketu
    11: 6, // Purva Phalguni – Venus
    12: 1, // Uttara Phalguni – Sun
    13: 2, // Hasta – Moon
    14: 3, // Chitra – Mars
    15: 8, // Swati – Rahu
    16: 5, // Vishakha – Jupiter
    17: 7, // Anuradha – Saturn
    18: 4, // Jyeshtha – Mercury
    19: 9, // Mula – Ketu
    20: 6, // Purva Ashadha – Venus
    21: 1, // Uttara Ashadha – Sun
    22: 2, // Shravana – Moon
    23: 3, // Dhanishta – Mars
    24: 8, // Shatabhisha – Rahu
    25: 5, // Purva Bhadrapada – Jupiter
    26: 7, // Uttara Bhadrapada – Saturn
    27: 4, // Revati – Mercury
};

export function nakshatraLord(nakshatra: number): number | undefined {
    return NAKSHATRA_LORDS[nakshatra];
}

/** Whole-sign houses occupied by a planet. */
export function planetFact(facts: ChartFacts, name: number): PlanetFact | undefined {
    return facts.planets.find((p) => p.planetName === name);
}

/** Graha drishti: `from` aspects `to` in the stored aspect records (any angle, within orb). */
export function aspectsTheOther(from: PlanetFact, to: number): boolean {
    return from.aspects.some((a) => a.planetName === to);
}

/** Mutual graha drishti (SM-02 basis). */
export function hasMutualAspect(a: PlanetFact, b: PlanetFact): boolean {
    return aspectsTheOther(a, b.planetName) && aspectsTheOther(b, a.planetName);
}

/** Mutual drishti at a specific aspect angle (within orb tolerance). */
export function hasMutualAspectAngle(a: PlanetFact, b: PlanetFact, angle: number, orb = 8): boolean {
    const aToB = a.aspects.find((x) => x.planetName === b.planetName);
    const bToA = b.aspects.find((x) => x.planetName === a.planetName);
    if (!aToB || !bToA) return false;
    const near = (value: number) => Math.abs(value - angle) <= orb;
    return near(aToB.aspectType) && near(bToA.aspectType);
}

/**
 * Mutual 4-10 drishti (SM-3 basis): BOTH planets aspect each other via the 90°/270° points of the
 * 4/10 relationship family. A one-directional drishti (e.g. Mars–Saturn sample 6a68e773 where Mars
 * reaches Saturn at 8th while Saturn does not reciprocate) must NOT satisfy this.
 */
export function hasMutualFourTenAspect(a: PlanetFact, b: PlanetFact, orb = 8): boolean {
    const aToB = a.aspects.find((x) => x.planetName === b.planetName);
    const bToA = b.aspects.find((x) => x.planetName === a.planetName);
    if (!aToB || !bToA) return false;
    const inFourTen = (value: number) => Math.abs(value - 90) <= orb || Math.abs(value - 270) <= orb;
    return inFourTen(aToB.aspectType) && inFourTen(bToA.aspectType);
}

/** Smaller angular separation between two planets (for the 7th-house gap check). */
export function degreeGapBetween(a: PlanetFact, b: PlanetFact): number {
    const raw = Math.abs(a.absoluteDegree - b.absoluteDegree) % 360;
    return raw > 180 ? 360 - raw : raw;
}

/**
 * Whole-sign conjunction (SM-01/AM-01 basis): same sign AND same whole-sign house, PLUS both stored
 * conjunction (0°) records. A 0° record exists only when the pair lies within the aspecting planet's
 * orb — e.g. sample 6a74b291 (Saturn+Mars both Vrishchika/7th, 13.57° apart, beyond Saturn 9°/Mars
 * 8° orbs) carries no 0° records and is NOT conjunct.
 */
export function areConjunct(a: PlanetFact, b: PlanetFact): boolean {
    if (a.sign !== b.sign || a.house !== b.house) return false;
    const aToB = a.aspects.find((x) => x.planetName === b.planetName);
    const bToA = b.aspects.find((x) => x.planetName === a.planetName);
    return aToB?.aspectType === 0 && bToA?.aspectType === 0;
}

/** Parivartana: each planet sits in the other's own (whole) sign — SM-05. */
export function isParivartana(a: PlanetFact, b: PlanetFact): boolean {
    return SIGN_LORDS[a.sign] === b.planetName && SIGN_LORDS[b.sign] === a.planetName;
}

/** Relative whole-sign separation of `b` from `a` (0..11; 6 = opposite 7th house). */
export function relativeHouseGap(a: PlanetFact, b: PlanetFact): number {
    return ((b.house - a.house + 12) % 12) as number;
}