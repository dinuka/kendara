import { PLANET_PARAMS } from "@/lib/yogaDosha/ruleEngine";
import { FormationInfo } from "@/lib/yogaDosha/types";

/** How much of a yoga/dosha a planet takes part in, by the share of "why it forms" reasons naming it. */
export enum PlanetReasonShare {
    /** In at most a quarter of the reasons (or the entry has a single reason). */
    MINOR = "minor",
    /** In more than a quarter of the reasons. */
    MAJOR = "major",
    /** In more than half the reasons. */
    DOMINANT = "dominant",
}

const MAJOR_ABOVE = 0.25;
const DOMINANT_ABOVE = 0.5;

const reasonPlanets = ({ params }: FormationInfo["reasons"][number]): number[] =>
    PLANET_PARAMS.map((key) => params?.[key]).filter((value): value is number => typeof value === "number");

/** Share per formation planet. Only an entry with more than one reason is graded. A reason naming no
 *  planet (Dhana Yoga's Indu Lagna line) still counts toward the total; when no reason names any
 *  planet (Kuja Dosha, Kala Sarpa), every formation planet forms every reason. */
const planetReasonShares = ({ reasons, planets }: FormationInfo): Map<number, PlanetReasonShare> => {
    const shares = new Map<number, PlanetReasonShare>();
    if (reasons.length <= 1) {
        planets.forEach((planet) => shares.set(planet, PlanetReasonShare.MINOR));
        return shares;
    }

    const counts = new Map<number, number>();
    reasons.forEach((reason) => {
        new Set(reasonPlanets(reason)).forEach((planet) => counts.set(planet, (counts.get(planet) ?? 0) + 1));
    });
    const namesNone = counts.size === 0;

    planets.forEach((planet) => {
        const ratio = namesNone ? 1 : (counts.get(planet) ?? 0) / reasons.length;
        shares.set(
            planet,
            ratio > DOMINANT_ABOVE
                ? PlanetReasonShare.DOMINANT
                : ratio > MAJOR_ABOVE
                  ? PlanetReasonShare.MAJOR
                  : PlanetReasonShare.MINOR,
        );
    });
    return shares;
};

export default planetReasonShares;
