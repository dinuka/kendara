/** Kendrasthana (කේන්ද්‍රස්ථාන) — the planets in the 4th, 7th and 10th houses counted from a house
 *  or a planet's house (the house itself is not counted). Calculated the same way as the planet aspect arm of `computeChartAspects`,
 *  only with the fixed kendra offsets instead of the configured aspect houses:
 *
 *    - for a planet Q in whole-sign house h and a target in a kendra from h, the kendra point is
 *      `Q.absoluteDegree + ((targetHouse − h) mod 12) × 30` (90 / 180 / 270).
 *    - house target: always listed; the record carries the house middle's difference from the point
 *      (no orb check).
 *    - planet target: listed only when its difference from the point is lower than Q's orb (Rāśmi),
 *      so Rahu/Ketu (orb 0) never list a planet themselves.
 *
 *  Records use the `Aspect` shape (one `"kendra"` reason) so they render with `AspectChip`;
 *  `planetName` is always the kendra planet Q. */
import type { Aspect, House, Planet } from "@/lib/astrology";
import { resolveOrb } from "@/lib/planetAspects";

export const KENDRA_HOUSES = [4, 7, 10];

export type KendraPlanet = Pick<Planet, "name" | "house" | "absoluteDegree">;

export type KendraHouse = Pick<House, "houseNumber" | "middleSign" | "middleDegree">;

export interface KendrasthanaRecords {
    /** Planet → the planets in its kendras whose kendra point it falls within (by their orb). */
    byPlanet: Record<number, Aspect[]>;
    /** House number → every planet in its kendras, with the house middle's difference. */
    byHouse: Record<number, Aspect[]>;
}

/** Signed shortest difference of a target from a point, in (−180, 180]. */
const signedDelta = (targetAbs: number, pointAbs: number): number => ((targetAbs - pointAbs + 540) % 360) - 180;

/** Kendra angle from house `from` to house `to`, or null when `to` is not a kendra of `from`. */
const kendraAngle = (from: number, to: number): number | null => {
    const offset = (((to - from) % 12) + 12) % 12;
    return KENDRA_HOUSES.includes(offset + 1) ? offset * 30 : null;
};

const kendraRecord = (planet: KendraPlanet, angle: number, delta: number): Aspect => ({
    planetName: planet.name,
    aspectType: angle,
    planetAbsoluteDegree: planet.absoluteDegree,
    degreeGap: Math.abs(delta),
    exactAspectDegree: angle,
    isBeneficial: false,
    delta,
    reasons: [{ type: "kendra", angle, delta }],
});

const byName = (a: Aspect, b: Aspect): number => a.planetName - b.planetName;

export const computeKendrasthana = (
    planets: KendraPlanet[],
    houses: KendraHouse[],
    planetaryOrbs?: Record<string, number>,
): KendrasthanaRecords => {
    const byHouse: Record<number, Aspect[]> = {};
    houses.forEach(({ houseNumber, middleSign, middleDegree }) => {
        const middle = (middleSign - 1) * 30 + middleDegree;
        byHouse[houseNumber] = planets
            .flatMap((q) => {
                const angle = kendraAngle(q.house, houseNumber);
                if (angle === null) return [];
                return [kendraRecord(q, angle, signedDelta(middle, q.absoluteDegree + angle))];
            })
            .sort(byName);
    });

    const byPlanet: Record<number, Aspect[]> = {};
    planets.forEach((target) => {
        byPlanet[target.name] = planets
            .flatMap((q) => {
                if (q.name === target.name) return [];
                const angle = kendraAngle(q.house, target.house);
                if (angle === null) return [];
                const delta = signedDelta(target.absoluteDegree, q.absoluteDegree + angle);
                if (Math.abs(delta) >= resolveOrb(q.name, planetaryOrbs)) return [];
                return [kendraRecord(q, angle, delta)];
            })
            .sort(byName);
    });

    return { byPlanet, byHouse };
};
