import { navamsaSign } from "@/lib/astrology";
import type { Aspect, House, Planet } from "@/lib/astrology";

export interface PlanetAspectSetting {
    /** Integers 1-12, unique, ascending. Absolute house numbers the planet aspects (direct). */
    houses: number[];
    /** Multiples of 30 in [30, 330], unique, ascending. Candidate aspect angles. */
    degrees: number[];
}

export type PlanetAspectsMap = Record<string, PlanetAspectSetting>;

/** Authoritative default aspect houses per planet (replaces the old special-aspect table). Every
 *  planet 1-9 has an explicit entry, so there is no "others → 7th" fallback:
 *    SUN (1) / MOON (2) / SATURN (7) = 3, 5, 7, 9, 10
 *    MARS (3) / MERCURY (4)         = 4, 5, 7, 8, 9
 *    JUPITER (5) / VENUS (6) / RAHU (8) / KETU (9) = 5, 7, 9
 *  Defaults act as OFFSETS from the planet's whole-sign house; a configured `houses` list applies
 *  as absolute house numbers. */
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

const wrap360 = (x: number): number => ((x % 360) + 360) % 360;

const signedShortest = (target: number, point: number): number => ((target - point + 540) % 360) - 180;

/** Signed delta (degrees) of a target absolute longitude relative to the closest of the two aspect
 *  points (`absI + angle` / `absI − angle`, wrapped). Positive when the target is ahead (east) of
 *  the aspect point. Shared by the planetary and rashi arms for tooltip reason lines. */
export function aspectPointSignedDelta(absI: number, angle: number, targetAbs: number): number {
    const plus = signedShortest(targetAbs, wrap360(absI + angle));
    const minus = signedShortest(targetAbs, wrap360(absI - angle));
    if (Math.abs(plus) <= Math.abs(minus)) return plus;
    return minus;
}

/** The aspecting planet's orb tolerance: the user's `planetaryOrbs` value, else the default orb,
 *  else 0. Same fallback ordering as the combustion code path (`planetaryOrbs["1"] ?? 15`). */
export function resolveOrb(planet: number, planetaryOrbs?: Record<string, number>): number {
    return planetaryOrbs?.[String(planet)] ?? DEFAULT_ORBS[String(planet)] ?? 0;
}

/** Resolve the aspect houses for a planet: the configured `houses` (absolute) when an entry exists,
 *  else the planet's default aspect houses. Covers all planets 1-9 — no `[7]` fallback. */
export function resolveAspectHouses(planet: number, planetAspects?: PlanetAspectsMap): number[] {
    return planetAspects?.[String(planet)]?.houses ?? DEFAULT_ASPECT_HOUSES[planet] ?? [];
}

/** Resolve the candidate aspect degrees for a planet: the configured `degrees` when an entry
 *  exists, else the default `[60, 90, 120, 180]`. */
export function resolveAspectDegrees(planet: number, planetAspects?: PlanetAspectsMap): number[] {
    return planetAspects?.[String(planet)]?.degrees ?? defaultAspectDegrees(planet);
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

/** Planet-to-planet aspects. For each aspecting planet `i`, candidates = [0, ...configured degrees];
 *  orb = aspecting planet's `planetaryOrbs` value. An aspect to planet `j` is recorded when the minor
 *  arc distance is within orb of the nearest candidate angle (`degreeGap <= orb`, inclusive). Ties
 *  between equidistant candidate angles resolve to the smaller angle. `isBeneficial` only for 60/120. */
export function computePlanetAspects(
    planets: Array<Pick<Planet, "name" | "absoluteDegree">>,
    planetAspects?: PlanetAspectsMap,
    planetaryOrbs?: Record<string, number>,
): Record<number, Aspect[]> {
    const result: Record<number, Aspect[]> = {};
    for (const aspecter of planets) {
        const i = aspecter.name;
        const absI = aspecter.absoluteDegree;
        const candidates = [0, ...resolveAspectDegrees(i, planetAspects)];
        const orb = resolveOrb(i, planetaryOrbs);
        const aspects: Aspect[] = [];
        for (const target of planets) {
            if (target.name === i) continue;
            const rawDist = Math.min(
                Math.abs(absI - target.absoluteDegree),
                360 - Math.abs(absI - target.absoluteDegree),
            );
            let nearest = candidates[0];
            let bestDiff = Math.abs(rawDist - nearest);
            for (let k = 1; k < candidates.length; k++) {
                const diff = Math.abs(rawDist - candidates[k]);
                if (diff < bestDiff) {
                    bestDiff = diff;
                    nearest = candidates[k];
                }
            }
            if (bestDiff <= orb) {
                const delta = aspectPointSignedDelta(absI, nearest, target.absoluteDegree);
                aspects.push({
                    planetName: target.name,
                    aspectType: nearest,
                    planetAbsoluteDegree: target.absoluteDegree,
                    degreeGap: +bestDiff.toFixed(2),
                    exactAspectDegree: nearest,
                    isBeneficial: BENEFICIAL_ASPECT_ANGLES.has(nearest),
                    delta: +delta.toFixed(2),
                    reasons: [{ type: "planetary", angle: nearest, delta: +delta.toFixed(2) }],
                });
            }
        }
        result[i] = aspects;
    }
    return result;
}

/** Degree-based house aspects. A planet `i` aspects a house when:
 *   - the house is in the explicit arm — the configured `houses` (absolute numbers), or — for an
 *     unconfigured planet — the default aspect houses resolved as OFFSETS from the planet's whole-sign
 *     house; OR
 *   - the degree arm — one of the planet's aspect points (`abs_i ± d`, wrapped to 360°) is within the
 *     planet's orb of the house's absolute middle degree `(middleSign−1)*30 + middleDegree`.
 *  The two arms union (dedup, sorted ascending). Houses without a usable stored middle degree are
 *  skipped by the degree arm (the explicit arm still applies). Conjunction (0°) is never a degree-arm
 *  point. There is no `degree ÷ 30` → house-number mapping. */
export function computeHouseAspectsByPlanet(
    planets: Array<Pick<Planet, "name" | "absoluteDegree" | "house">>,
    houses: Array<Pick<House, "houseNumber" | "middleSign" | "middleDegree">>,
    planetAspects?: PlanetAspectsMap,
    planetaryOrbs?: Record<string, number>,
): Record<number, number[]> {
    const result: Record<number, number[]> = {};
    for (const planet of planets) {
        const i = planet.name;
        const entry = planetAspects?.[String(i)];
        const degrees = entry?.degrees ?? defaultAspectDegrees(i);
        const orb = resolveOrb(i, planetaryOrbs);

        let explicit: number[];
        if (entry) {
            explicit = entry.houses;
        } else {
            explicit = (DEFAULT_ASPECT_HOUSES[i] ?? []).map((o) => ((planet.house - 1 + o - 1) % 12) + 1);
        }

        const points: number[] = [];
        for (const d of degrees) {
            points.push(wrap360(planet.absoluteDegree + d), wrap360(planet.absoluteDegree - d));
        }

        const aspected = new Set<number>(explicit);
        for (const h of houses) {
            if (
                !Number.isFinite(h.middleDegree) ||
                !Number.isInteger(h.middleSign) ||
                h.middleSign < 1 ||
                h.middleSign > 12
            ) {
                continue;
            }
            const midAbs = (h.middleSign - 1) * 30 + h.middleDegree;
            for (const p of points) {
                const diff = Math.min(Math.abs(midAbs - p), 360 - Math.abs(midAbs - p));
                if (diff <= orb) {
                    aspected.add(h.houseNumber);
                    break;
                }
            }
        }
        result[i] = [...aspected].sort((a, b) => a - b);
    }
    return result;
}

/** Transpose of `computeHouseAspectsByPlanet`: house number -> aspecting planet numbers, sorted
 *  ascending, with every house 1-12 present (empty array when no planet aspects it). */
export function computeHouseAspectsByHouse(
    planets: Array<Pick<Planet, "name" | "absoluteDegree" | "house">>,
    houses: Array<Pick<House, "houseNumber" | "middleSign" | "middleDegree">>,
    planetAspects?: PlanetAspectsMap,
    planetaryOrbs?: Record<string, number>,
): Record<number, number[]> {
    const byPlanet = computeHouseAspectsByPlanet(planets, houses, planetAspects, planetaryOrbs);
    const result: Record<number, number[]> = {};
    for (let h = 1; h <= 12; h++) result[h] = [];
    for (const [planetKey, aspectedHouses] of Object.entries(byPlanet)) {
        const planet = Number(planetKey);
        for (const h of aspectedHouses) {
            (result[h] ??= []).push(planet);
        }
    }
    for (let h = 1; h <= 12; h++) result[h].sort((a, b) => a - b);
    return result;
}

/** Manual-chart planet-to-planet aspects: thin adapter that resolves each planet's absolute degree
 *  (stored `planetDegrees` else deterministic fallback) then delegates to `computePlanetAspects`
 *  with the identical algorithm — no duplicated matching logic. */
export function computeManualPlanetAspects(
    planets: Array<Pick<Planet, "name" | "sign" | "house" | "navamsaSign">>,
    planetDegrees?: Record<string, number>,
    planetAspects?: PlanetAspectsMap,
    planetaryOrbs?: Record<string, number>,
): Record<number, Aspect[]> {
    const absPlanets = planets.map((pl) => ({
        name: pl.name,
        absoluteDegree: derivePlanetAbsoluteDegree(pl.name, pl.sign, pl.navamsaSign, planetDegrees?.[String(pl.name)]),
    }));
    return computePlanetAspects(absPlanets, planetAspects, planetaryOrbs);
}

/** Manual-chart house aspects: same two arms as auto charts. The explicit arm is the configured
 *  `houses` (absolute) or — for an unconfigured planet — the default aspect houses as offsets from
 *  the planet's whole-sign house. The degree arm matches each planet's aspect points `abs_i ± d`
 *  against the house's whole-sign sign midpoint `(sign−1)*30 + 15` within the planet's orb. The
 *  planet's whole-sign sign is derived from `houseSigns` (house → sign). Delegates to
 *  `computeHouseAspectsByPlanet` — no duplicated matching logic. */
export function computeManualHouseAspects(
    houseOfPlanet: Record<number, number>,
    houseSigns: number[],
    planetDegrees?: Record<string, number>,
    planetAspects?: PlanetAspectsMap,
    planetaryOrbs?: Record<string, number>,
    navamsaSigns?: Record<number, number>,
): Record<number, number[]> {
    const planets: Array<Pick<Planet, "name" | "absoluteDegree" | "house">> = [];
    for (const [planetKey, house] of Object.entries(houseOfPlanet)) {
        const planet = Number(planetKey);
        const sign = houseSigns[house - 1];
        planets.push({
            name: planet,
            house,
            absoluteDegree: derivePlanetAbsoluteDegree(
                planet,
                sign,
                navamsaSigns?.[planet],
                planetDegrees?.[String(planet)],
            ),
        });
    }
    const houses = houseSigns.map((sign, i) => ({
        houseNumber: i + 1,
        middleSign: sign,
        middleDegree: 15,
    }));
    return computeHouseAspectsByPlanet(planets, houses, planetAspects, planetaryOrbs);
}
