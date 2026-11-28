import { navamsaSign } from "@/lib/astrology";
import type { Aspect, Planet } from "@/lib/astrology";

export interface PlanetAspectSetting {
    /** Integers 1-12, unique, ascending. Aspect houses counted from the planet's own house
     *  (Kuja 4, 5, 7, 8, 9 in house 3 → houses 6, 7, 9, 10, 11); house N is the angle (N − 1) × 30. */
    houses: number[];
    /** Multiples of 30 in [30, 330], unique, ascending. Kept paired with `houses` by the settings
     *  form; the engine derives each angle from its house (src/lib/chartAspects.ts). */
    degrees: number[];
}

export type PlanetAspectsMap = Record<string, PlanetAspectSetting>;

/** Authoritative default aspect houses per planet (replaces the old special-aspect table). Every
 *  planet 1-9 has an explicit entry, so there is no "others → 7th" fallback (houses counted from
 *  the planet's own house):
 *    SUN (1) / MOON (2) / SATURN (7) = 3, 5, 7, 9, 10
 *    MARS (3) / MERCURY (4)         = 4, 5, 7, 8, 9
 *    JUPITER (5) / VENUS (6) / RAHU (8) / KETU (9) = 5, 7, 9 */
export const DEFAULT_ASPECT_HOUSES: Record<number, number[]> = {
    1: [3, 5, 7, 9, 10],
    2: [3, 5, 7, 9, 10],
    3: [4, 5, 7, 8, 9],
    4: [4, 5, 7, 8, 9],
    5: [5, 7, 9],
    6: [5, 7, 9],
    7: [3, 5, 7, 9, 10],
    8: [5, 7, 9],
    9: [5, 7, 9],
};

export const VALID_ASPECT_DEGREES = [30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

/** Default aspect degrees derived from a planet's default aspect houses: house H maps to angle
 *  (H − 1) × 30 (2 → 30, 5 → 120, 7 → 180, 10 → 270). This replaces the old flat default list so
 *  the shown defaults and the calculation defaults stay identical per planet. */
export function defaultAspectDegrees(planet: number): number[] {
    return (DEFAULT_ASPECT_HOUSES[planet] ?? []).map((house) => (house - 1) * 30);
}

/** Only the classical trine/sextile are classified beneficial in v1 (AD-10). */
export const BENEFICIAL_ASPECT_ANGLES = new Set([60, 120]);

const VALID_PLANET_KEYS = new Set(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);

/** Default per-planet orbs (Rāśmi) used when the user has no stored value. Mirrors the planet
 *  tables in `src/models/User.ts` and `src/lib/calculation.ts`; kept here so the pure module stays
 *  free of a Mongoose import. */
export const DEFAULT_ORBS: Record<string, number> = {
    "1": 15,
    "2": 12,
    "3": 8,
    "4": 7,
    "5": 9,
    "6": 7,
    "7": 9,
    "8": 0,
    "9": 0,
};

/** The aspecting planet's orb tolerance: the user's `planetaryOrbs` value, else the default orb,
 *  else 0. Same fallback ordering as the combustion code path (`planetaryOrbs["1"] ?? 15`). */
export function resolveOrb(planet: number, planetaryOrbs?: Record<string, number>): number {
    return planetaryOrbs?.[String(planet)] ?? DEFAULT_ORBS[String(planet)] ?? 0;
}

/** Resolve the aspect houses for a planet (counted from its own house): the configured `houses`
 *  when an entry exists, else the planet's default aspect houses. */
export function resolveAspectHouses(planet: number, planetAspects?: PlanetAspectsMap): number[] {
    return planetAspects?.[String(planet)]?.houses ?? DEFAULT_ASPECT_HOUSES[planet] ?? [];
}

/** Strict server-side validation of the `planetAspects` payload. All-or-nothing: a single invalid
 *  entry rejects the whole payload. Keys must be Planet enum strings "1".."9"; `houses` integers in
 *  [1, 12] and `degrees` multiples of 30 in [30, 330], both non-empty, unique, normalized ascending. */
export function validatePlanetAspectsPayload(
    raw: unknown,
): { ok: true; value: PlanetAspectsMap } | { ok: false; error: string } {
    if (raw === null || raw === undefined) {
        return { ok: true, value: {} };
    }
    if (typeof raw !== "object" || Array.isArray(raw)) {
        return { ok: false, error: "planetAspects must be an object keyed by planet (1-9)" };
    }
    const result: PlanetAspectsMap = {};
    for (const [key, entry] of Object.entries(raw as Record<string, unknown>)) {
        if (!VALID_PLANET_KEYS.has(key)) {
            return { ok: false, error: `invalid planet key: ${key}` };
        }
        if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
            return { ok: false, error: `planet ${key} must be an object with houses and degrees` };
        }
        const { houses, degrees } = entry as Record<string, unknown>;
        if (!Array.isArray(houses) || houses.length === 0) {
            return { ok: false, error: `planet ${key}: at least one house (1-12) is required` };
        }
        if (!Array.isArray(degrees) || degrees.length === 0) {
            return { ok: false, error: `planet ${key}: at least one degree (multiple of 30) is required` };
        }
        const parsedHouses: number[] = [];
        for (const h of houses) {
            if (typeof h !== "number" || !Number.isInteger(h) || h < 1 || h > 12) {
                return { ok: false, error: `planet ${key}: house must be an integer 1-12` };
            }
            if (parsedHouses.includes(h)) {
                return { ok: false, error: `planet ${key}: duplicate house ${h}` };
            }
            parsedHouses.push(h);
        }
        const parsedDegrees: number[] = [];
        for (const d of degrees) {
            if (typeof d !== "number" || !Number.isInteger(d) || !VALID_ASPECT_DEGREES.includes(d)) {
                return { ok: false, error: `planet ${key}: degree must be a multiple of 30 in [30, 330]` };
            }
            if (parsedDegrees.includes(d)) {
                return { ok: false, error: `planet ${key}: duplicate degree ${d}` };
            }
            parsedDegrees.push(d);
        }
        result[key] = {
            houses: parsedHouses.sort((a, b) => a - b),
            degrees: parsedDegrees.sort((a, b) => a - b),
        };
    }
    return { ok: true, value: result };
}

const NAVAMSA_ARC = 30 / 9;

function navamsaIndexForSign(birthSign: number, navamsaSignValue: number): number {
    for (let idx = 1; idx <= 9; idx++) {
        if (navamsaSign(birthSign, idx) === navamsaSignValue) return idx;
    }
    return 1;
}

/** Per-planet absolute degree used by the aspect arms on manual charts (and their owner view-time
 *  re-derivation). Entered `planetDegrees` wins; otherwise a deterministic fallback mirroring the
 *  existing manual degree-estimation pattern: the navamsa-segment midpoint
 *  `(birthSign−1)*30 + (navamsaIndex−0.5)*NAVAMSA_ARC` when the planet's navamsa sign is recorded
 *  (≡ `deriveNavamsaData.absoluteDegreeMidpoint`), else the sign midpoint `(birthSign−1)*30 + 15`. */
export function derivePlanetAbsoluteDegree(
    planet: number,
    birthSign: number,
    navamsaSignValue?: number,
    enteredDegree?: number,
): number {
    void planet;
    if (enteredDegree !== undefined) {
        return (birthSign - 1) * 30 + enteredDegree;
    }
    if (navamsaSignValue !== undefined) {
        const index = navamsaIndexForSign(birthSign, navamsaSignValue);
        return (birthSign - 1) * 30 + (index - 0.5) * NAVAMSA_ARC;
    }
    return (birthSign - 1) * 30 + 15;
}

/** Degree-based planet conjunctions — the authoritative conjunction list shared by the
 *  calculation-tab planet tables and the D1 (Lagna) warga planets table. Two planets are conjunct
 *  when their shortest angular separation is strictly below the pair's highest orb (`<`, mirroring
 *  the calculation-tab rule); Rahu/Ketu (orbs 0) only ever qualify through the other planet's orb.
 *  Every record carries the signed `delta` and `degreeGap` so chips/tooltips show the true
 *  separation — never a placeholder 0°. */
export function computePlanetConjunctions(
    planets: Array<Pick<Planet, "name" | "absoluteDegree">>,
    planetaryOrbs?: Record<number, number>,
): Record<number, Aspect[]> {
    const orbOf = (name: number): number => planetaryOrbs?.[name] ?? DEFAULT_ORBS[String(name)] ?? 0;
    const result: Record<number, Aspect[]> = {};
    for (const p of planets) {
        const conjunctions: Aspect[] = [];
        for (const q of planets) {
            if (q.name === p.name) continue;
            const dist = Math.abs(p.absoluteDegree - q.absoluteDegree);
            const angularDist = Math.min(dist, 360 - dist);
            if (angularDist >= Math.max(orbOf(p.name), orbOf(q.name))) continue;
            let diff = q.absoluteDegree - p.absoluteDegree;
            if (diff > 180) diff -= 360;
            if (diff < -180) diff += 360;
            conjunctions.push({
                planetName: q.name,
                aspectType: 0,
                planetAbsoluteDegree: q.absoluteDegree,
                degreeGap: angularDist,
                exactAspectDegree: 0,
                isBeneficial: false,
                delta: diff,
                reasons: [{ type: "planetary", angle: 0, delta: diff }],
            });
        }
        result[p.name] = conjunctions;
    }
    return result;
}
