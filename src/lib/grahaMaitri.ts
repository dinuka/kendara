/** Graha Maitri (ග්‍රහ මෛත්‍රී) — planetary friendship per BPHS ශ්ලෝක 55–58.
 *
 *  1. නෛසර්ගික (natural): fixed per planet pair — precomputed once at module load from
 *     NATURAL_FRIENDS / NATURAL_ENEMIES; every other classical planet is සම (neutral).
 *  2. තත්කාලික (temporary): from the chart — B is A's temporary friend when B sits in the
 *     2nd, 3rd, 4th, 10th, 11th or 12th sign counted from A (A's own sign = 1st); otherwise enemy.
 *  3. සංයුක්ත (compound): friend+friend → අධි මිතුරු, enemy+enemy → අධි සතුරු,
 *     friend+enemy → සම, neutral+friend → මිතුරු, neutral+enemy → සතුරු.
 *
 *  Only sign positions are used (D1 rashi), never degrees. Rahu/Ketu are excluded.
 *  All inputs/outputs are numeric enums (Planet 1–9, ZodiacSign 1–12). */
import { NATURAL_ENEMIES, NATURAL_FRIENDS } from "@/lib/astrology";
import { Planet } from "@/lib/astrologyEnums";

export enum Relationship {
    FRIEND = 1,
    NEUTRAL = 0,
    ENEMY = -1,
}

/** Compound relationship, ordered strongest friendship → strongest enmity. */
export enum CompoundRelationship {
    ADHI_MITRA = 2,
    MITRA = 1,
    SAMA = 0,
    SHATRU = -1,
    ADHI_SHATRU = -2,
}

export const MAITRI_PLANETS: readonly number[] = [
    Planet.SUN,
    Planet.MOON,
    Planet.MARS,
    Planet.MERCURY,
    Planet.JUPITER,
    Planet.VENUS,
    Planet.SATURN,
];

/** Sign distances (inclusive count, own sign = 1) that make a temporary friend. */
const TEMPORARY_FRIEND_HOUSES: ReadonlySet<number> = new Set([2, 3, 4, 10, 11, 12]);

/** Precomputed natural relationship matrix: NATURAL_RELATIONSHIP[a][b] = how a regards b. */
export const NATURAL_RELATIONSHIP: Readonly<Record<number, Readonly<Record<number, Relationship>>>> =
    Object.fromEntries(
        MAITRI_PLANETS.map((a) => [
            a,
            Object.fromEntries(
                MAITRI_PLANETS.filter((b) => b !== a).map((b) => [
                    b,
                    NATURAL_FRIENDS[a].includes(b)
                        ? Relationship.FRIEND
                        : NATURAL_ENEMIES[a].includes(b)
                          ? Relationship.ENEMY
                          : Relationship.NEUTRAL,
                ]),
            ),
        ]),
    );

/** Sign count from `signA` to `signB`, inclusive (same sign = 1). */
export function signDistance(signA: number, signB: number): number {
    return ((((signB - signA) % 12) + 12) % 12) + 1;
}

/** Temporary relationship of a planet in `signA` towards one in `signB` (signs 1–12). */
export function temporaryRelationship(signA: number, signB: number): Relationship.FRIEND | Relationship.ENEMY {
    return TEMPORARY_FRIEND_HOUSES.has(signDistance(signA, signB)) ? Relationship.FRIEND : Relationship.ENEMY;
}

/** Natural + temporary → compound. Temporary is never neutral, so the sum maps 1:1 onto the five
 *  compound grades. */
export function compoundRelationship(natural: Relationship, temporary: Relationship): CompoundRelationship {
    return (natural + temporary) as CompoundRelationship;
}

export interface GrahaMaitriEntry {
    planet: number;
    natural: Relationship;
    temporary: Relationship;
    /** Sign count from the regarding planet to `planet` (1–12) — the reason for `temporary`. */
    distance: number;
    compound: CompoundRelationship;
}

/** How each classical planet regards every other, for one chart. Keyed by the regarding planet;
 *  each list holds the other planets in Planet order. Planets missing from `signs` are skipped. */
export function computeGrahaMaitri(signs: Readonly<Record<number, number>>): Record<number, GrahaMaitriEntry[]> {
    const present = MAITRI_PLANETS.filter((p) => signs[p] !== undefined);
    return Object.fromEntries(
        present.map((a) => [
            a,
            present
                .filter((b) => b !== a)
                .map((b) => {
                    const natural = NATURAL_RELATIONSHIP[a][b];
                    const distance = signDistance(signs[a], signs[b]);
                    const temporary = TEMPORARY_FRIEND_HOUSES.has(distance) ? Relationship.FRIEND : Relationship.ENEMY;
                    return { planet: b, natural, temporary, distance, compound: compoundRelationship(natural, temporary) };
                }),
        ]),
    );
}
