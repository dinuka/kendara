/** Client-side shape fix-ups of the `/api/horoscope/[id]` payload, shared by the server-rendered
 *  horoscope page and the client fetch so both produce identical data. Manual (calculated-chart)
 *  horoscopes get their derived details (houses, nakshatras, dashas, thithi, ranges) synthesised from
 *  the entered placements. Pure — safe to import from client components. */
import type { Dashas, Planet } from "@/lib/astrology";
import { computeThithiFromPlanets } from "@/lib/astrology";
import {
    buildBhavaHouses,
    calculateManualDashas,
    computeAscendantNakshatra,
    computeMoonNakshatra,
    deriveBirthTimeRange,
    hasManualNavamsa,
    manualAscAbsDeg,
    synthesizeOtherDetails,
    synthesizeValidation,
} from "@/lib/manualChart";
import type { DerivedRanges } from "@/lib/manualChart";

export const normalizeHoroscopePayload = <T>(payload: T): T => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let d = payload as any;
    if (
        d?.horoscope?.source === "manual" &&
        d?.calculatedDetails?.manualHousePlacements &&
        d?.calculatedDetails?.planets
    ) {
        // Older records persisted `null` for absent lagnaDegree/navamsaLagna, which the
        // `!== undefined` checks below would otherwise treat as present (making the lagna
        // line point at the sign start instead of the navamsa-wedge center). Normalize
        // null -> undefined once so every derived value uses the same source of truth.
        const mhp = {
            ...d.calculatedDetails.manualHousePlacements,
            lagnaDegree: d.calculatedDetails.manualHousePlacements.lagnaDegree ?? undefined,
            navamsaLagna: d.calculatedDetails.manualHousePlacements.navamsaLagna ?? undefined,
        };
        const moon = (d.calculatedDetails.planets as Planet[]).find((p) => p.name === 2);
        const moonNakshatra = moon
            ? computeMoonNakshatra(
                  moon.sign,
                  hasManualNavamsa(mhp) ? moon.navamsaSign : undefined,
                  mhp.planetDegrees?.[2],
              )
            : undefined;
        const birthDate = d.horoscope?.birthDate ? new Date(d.horoscope.birthDate) : null;
        d = {
            ...d,
            calculatedDetails: {
                ...d.calculatedDetails,
                ...synthesizeOtherDetails(mhp, d.calculatedDetails.planets),
                manualHousePlacements: {
                    ...mhp,
                    validation: synthesizeValidation(mhp),
                },
                ascendant: {
                    ...d.calculatedDetails.ascendant,
                    degree: mhp.lagnaDegree ?? d.calculatedDetails.ascendant.degree,
                },
                houses: (() => {
                    const lagna = mhp.lagna;
                    return buildBhavaHouses(lagna, manualAscAbsDeg(mhp));
                })(),
                nakshatra: {
                    ...d.calculatedDetails.nakshatra,
                    ascendantNakshatra: computeAscendantNakshatra(mhp),
                    moonNakshatra,
                },
                dashas: moonNakshatra
                    ? calculateManualDashas(moonNakshatra.id, moonNakshatra.pada, birthDate)
                    : (d.calculatedDetails.dashas as Dashas),
                thithi: computeThithiFromPlanets(d.calculatedDetails.planets as Planet[]),
                derivedRanges: (() => {
                    const stored = d.calculatedDetails.derivedRanges as DerivedRanges | undefined;
                    const ravi = (d.calculatedDetails.planets as Planet[]).find((p) => p.name === 1);
                    const birthTimeRange = ravi ? deriveBirthTimeRange(ravi.house) : null;
                    return {
                        ...stored,
                        birthTimeRange,
                    };
                })(),
            },
        };
    }
    return d as T;
};
