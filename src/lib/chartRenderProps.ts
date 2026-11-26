import { type CalculationResult, type House, type Planet, SIGN_LORD, formatDegree, navamsaSign } from "@/lib/astrology";
import { Planet as PlanetId, PlanetaryStrength } from "@/lib/astrologyEnums";
import type { ChartInput } from "@/lib/chartDataTransform";
import {
    type ManualHousePlacements,
    buildWholeSignHouses,
    formatNavamsaDegreeRange,
    hasManualNavamsa,
    manualAscAbsDeg,
    navamsaIndexForSign,
} from "@/lib/manualChart";

/** Display props shared by the horoscope page and the server-side chart image renderer
 *  (src/lib/chartSvg.tsx), so an exported chart image always matches the chart on the page. */

type Placements = ManualHousePlacements | null | undefined;

const NAVAMSA_ARC = 30 / 9;

/** True when the planet's degree is real: always for auto charts, only for entered degrees on manual ones. */
export const hasExactPlanetDegree = (p: Pick<Planet, "name">, isManual: boolean, mhp: Placements): boolean =>
    !isManual || mhp?.planetDegrees?.[p.name] !== undefined;

/** Ascendant degree label for a manual birth chart: the entered lagna degree, else the navamsa
 *  segment range implied by the navamsa lagna. Auto charts show their real degree (undefined). */
export const birthChartAscendantDegreeLabel = (isManual: boolean, mhp: Placements): string | undefined => {
    if (!isManual || !mhp) return undefined;
    const { lagna, lagnaDegree, navamsaLagna } = mhp;
    if (lagnaDegree !== undefined) return formatDegree(lagnaDegree);
    if (navamsaLagna !== undefined) {
        const index = navamsaIndexForSign(lagna, navamsaLagna);
        return formatNavamsaDegreeRange((index - 1) * NAVAMSA_ARC, index * NAVAMSA_ARC);
    }
    return undefined;
};

/** Sun's sidereal longitude for the Upagrahas — only when its degree is known. */
export const exactSunLongitude = (planets: Planet[], isManual: boolean, mhp: Placements): number | undefined => {
    const sun = planets.find((p) => p.name === PlanetId.SUN);
    return sun && hasExactPlanetDegree(sun, isManual, mhp) ? sun.absoluteDegree : undefined;
};

/** Navamsa wedge (1-9) of the ASC sign to highlight on the house chart. For manual horoscopes this
 *  must come from the entered lagna degree (else the stored navamsa lagna), not from
 *  ascendant.degree (always 0 for manual charts, which would select navamsa #1 spuriously). */
export const houseChartAscNavamsaNum = (isManual: boolean, mhp: Placements): number | undefined => {
    if (!isManual || !mhp) return undefined;
    const { lagna, lagnaDegree, navamsaLagna } = mhp;
    if (lagnaDegree !== undefined) return Math.floor(lagnaDegree / NAVAMSA_ARC) + 1;
    if (navamsaLagna === undefined) return undefined;
    return navamsaIndexForSign(lagna, navamsaLagna);
};

/** Absolute degree (0-360) anchoring the house chart's lagna line. For manual horoscopes it points
 *  through the CENTER of the selected navamsa wedge (see `manualAscAbsDeg`). */
export const houseChartAscAbsDeg = (isManual: boolean, mhp: Placements): number | undefined =>
    isManual && mhp ? manualAscAbsDeg(mhp) : undefined;

/** Planets with degree re-synthesized to the midpoint of each planet's navamsa segment for manual
 *  horoscopes, so planet lines point at the middle of the navamsa wedge (stored planets use the
 *  segment start). Manual charts WITHOUT Navamsa data have no segments — every planet sits at the
 *  house (sign) middle degree 15°, matching `synthesizePlanets`. */
export const houseChartPlanets = (planets: Planet[], isManual: boolean, mhp: Placements): Planet[] => {
    if (!isManual || !mhp) return planets;
    if (!hasManualNavamsa(mhp)) {
        return planets.map((p) =>
            hasExactPlanetDegree(p, isManual, mhp) ? p : { ...p, degree: 15, absoluteDegree: (p.sign - 1) * 30 + 15 },
        );
    }
    return planets.map((p) => {
        if (hasExactPlanetDegree(p, isManual, mhp)) return p;
        const index = navamsaIndexForSign(p.sign, p.navamsaSign ?? p.sign);
        const degree = (index - 0.5) * NAVAMSA_ARC;
        return { ...p, degree, absoluteDegree: (p.sign - 1) * 30 + degree };
    });
};

const navamsaSignOf = (sign: number, degree: number): number => navamsaSign(sign, Math.floor(degree / NAVAMSA_ARC) + 1);

/** Navamsa (D9) chart figure data, derived from the D1 calculation. Manual charts use their entered
 *  Navamsa placements, and have no D9 chart (null) when none were entered — never a fake one from a
 *  0° ascendant. */
export const navamsaChartData = (
    d1: Pick<CalculationResult, "planets" | "ascendant"> & { manualHousePlacements?: ManualHousePlacements | null },
    isManual: boolean,
): ChartInput | null => {
    const mhp = d1.manualHousePlacements;
    if (isManual && mhp) {
        if (!hasManualNavamsa(mhp)) return null;
        // hasManualNavamsa guarantees navamsaLagna is present (1-12) — the fallback only satisfies the type checker.
        const lagna = mhp.navamsaLagna ?? mhp.lagna;
        const planets: Planet[] = [];
        mhp.navamsaHouses?.forEach(({ houseNumber, sign, planets: housePlanets }) => {
            housePlanets.forEach((name) => {
                planets.push({
                    name,
                    sign,
                    degree: 0,
                    absoluteDegree: 0,
                    house: houseNumber,
                    nakshatra: 0,
                    pada: 0,
                    retrograde: false,
                    combustion: false,
                    strength: PlanetaryStrength.SAMA,
                    navamsaSign: sign,
                    navamsaStrength: PlanetaryStrength.SAMA,
                    aspects: [],
                });
            });
        });
        return {
            planets,
            houses: buildWholeSignHouses(lagna),
            ascendant: { sign: lagna, degree: 0, lord: SIGN_LORD[lagna] ?? 1 },
        };
    }

    const ascNavSign = navamsaSignOf(d1.ascendant.sign, d1.ascendant.degree);
    const houses: House[] = Array.from({ length: 12 }, (_, i) => {
        const sign = ((ascNavSign - 1 + i) % 12) + 1;
        const lord = SIGN_LORD[sign] ?? 1;
        return {
            houseNumber: i + 1,
            startDegree: 0,
            startSign: sign,
            startLord: lord,
            middleDegree: 0,
            middleSign: sign,
            middleLord: lord,
            endDegree: 0,
            endSign: sign,
            endLord: lord,
            sign,
            lord,
        };
    });
    const planets: Planet[] = d1.planets.map((p) => {
        const navSign = p.navamsaSign ?? navamsaSignOf(p.sign, p.degree);
        return { ...p, sign: navSign, house: ((navSign - ascNavSign + 12) % 12) + 1 };
    });
    return { planets, houses, ascendant: { sign: ascNavSign, degree: 0, lord: SIGN_LORD[ascNavSign] ?? 1 } };
};
