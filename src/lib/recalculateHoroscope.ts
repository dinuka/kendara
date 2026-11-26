import { CalculatedDetails } from "@/models/CalculatedDetails";
import type { IHoroscope } from "@/models/Horoscope";

import type { CalculationSettings } from "@/lib/astrologySettings";
import { calculateHoroscope } from "@/lib/calculation";
import { replaceCharts } from "@/lib/chartStorage";
import { ALL_CHART_TYPES, ChartType } from "@/lib/chartTypes";
import logger from "@/lib/logger";
import { compute, manualPlacementsToInput } from "@/lib/manualChart";
import {
    getCurrentShani,
    sanitizeManualHousePlacements,
    synthesizeCalculation,
    synthesizeNavamsaCalculation,
} from "@/lib/manualChartDetails";
import { reindexHoroscope } from "@/lib/search/indexer";
import { mergeShadBalaya } from "@/lib/shadBalaya";

/** Recomputes everything a horoscope save produces, against the given system-wide settings — the
 *  same pipeline as the create/edit routes (POST/PUT /api/horoscope, POST /api/horoscope/manual,
 *  PUT /api/horoscope/[id]/manual-chart):
 *  1. `CalculatedDetails` — auto: `calculateHoroscope`; manual: `compute` → `synthesizeCalculation`
 *     replayed from the stored `manualHousePlacements` (the source of truth) with the system aspect
 *     settings. Student Shad Bala toggles (overridden: true) survive (US-SB-013).
 *  2. `Chart` docs — every chart type for auto; Birth (+ Navamsa D9 when entered) for manual.
 *  3. The search index entry (failures are logged by the indexer and never fail the recalculation).
 *  Shared by the admin bulk job (src/lib/recalculationJob.ts) and `pnpm recalculate-horoscopes`.
 *  Returns `false` for a manual horoscope with no stored `manualHousePlacements` to recompute from
 *  (nothing is written). */
export const recalculateHoroscope = async (
    horoscope: IHoroscope,
    { planetaryOrbs, planetAspects, rashiAspects }: CalculationSettings,
): Promise<boolean> => {
    const id = horoscope._id.toString();
    const existing = await CalculatedDetails.findOne({ "horoscope.id": id }).lean();

    if (horoscope.source === "manual") {
        if (!existing?.manualHousePlacements) {
            logger.warn("recalc: manual horoscope id=%s has no manualHousePlacements to recompute from", id);
            return false;
        }
        const input = manualPlacementsToInput(existing.manualHousePlacements);
        input.aspectOptions = { planetaryOrbs, planetAspects, rashiAspects };
        const result = compute(input, getCurrentShani(input.lagna));
        const synth = synthesizeCalculation(result, horoscope.birthDate);
        const manualHousePlacements = sanitizeManualHousePlacements(result.manualHousePlacements);
        await CalculatedDetails.findOneAndUpdate(
            { "horoscope.id": id },
            {
                ...synth,
                shadbalaya: mergeShadBalaya(synth.shadbalaya ?? {}, existing?.shadbalaya),
                manualHousePlacements,
                derivedRanges: result.derivedRanges,
            },
            { upsert: true },
        );
        const navSynth = synthesizeNavamsaCalculation(result, horoscope.birthDate);
        await replaceCharts(id, navSynth ? [ChartType.BIRTH, ChartType.NAVAMSA_D9] : [ChartType.BIRTH], (type) =>
            type === ChartType.NAVAMSA_D9 && navSynth ? navSynth : synth,
            { isManual: true, manualHousePlacements },
        );
    } else {
        const calculated = calculateHoroscope(horoscope, planetaryOrbs, planetAspects, rashiAspects);
        await CalculatedDetails.findOneAndUpdate(
            { "horoscope.id": id },
            {
                ...calculated,
                shadbalaya: mergeShadBalaya(calculated.shadbalaya ?? {}, existing?.shadbalaya),
            },
            { upsert: true },
        );
        await replaceCharts(id, ALL_CHART_TYPES, () => calculated, { isManual: false });
    }

    await reindexHoroscope(id);
    return true;
};
