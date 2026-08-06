import { getChartData, isLeanChartType, toBirthChartData } from "../src/lib/chartDataTransform";
import { generateChartSvg } from "../src/lib/chartRenderer";
import { ChartType } from "../src/lib/chartTypes";
import { connectDB } from "../src/lib/db";
import logger from "../src/lib/logger";
import { compute, manualPlacementsToInput } from "../src/lib/manualChart";
import {
    getCurrentShani,
    synthesizeCalculation,
    synthesizeNavamsaCalculation,
} from "../src/lib/manualChartDetails";
import { CalculatedDetails } from "../src/models/CalculatedDetails";
import { Chart } from "../src/models/Chart";
import { Horoscope, IHoroscope } from "../src/models/Horoscope";

/** Recomputed the stored `CalculatedDetails` and `Chart` docs for one calculated (manual) horoscope,
 *  replaying the POST /api/horoscope/manual pipeline from the persisted `manualHousePlacements`
 *  (the source of truth): `compute()` → `synthesizeCalculation()` / `synthesizeNavamsaCalculation()`
 *  → chart docs. Mirrors the auto path in `recalculate-horoscopes.ts` for `source === "manual"`. */
export async function recalculateCalculatedHoroscope(horoscope: IHoroscope): Promise<void> {
    const id = horoscope._id.toString();
    const existing = await CalculatedDetails.findOne({ "horoscope.id": id }).lean();
    if (!existing?.manualHousePlacements) {
        throw new Error("manual horoscope has no manualHousePlacements to recompute from");
    }
    const input = manualPlacementsToInput(existing.manualHousePlacements);
    const currentShani = getCurrentShani(input.lagna);
    const result = compute(input, currentShani);
    const synth = synthesizeCalculation(result);
    const navSynth = synthesizeNavamsaCalculation(result);

    await CalculatedDetails.findOneAndUpdate(
        { "horoscope.id": id },
        {
            ...synth,
            manualHousePlacements: result.manualHousePlacements,
            derivedRanges: result.derivedRanges,
        },
        { upsert: true },
    );

    await Chart.deleteMany({ "horoscope.id": id });

    const chartTypes = navSynth ? [ChartType.BIRTH, ChartType.NAVAMSA_D9] : [ChartType.BIRTH];
    const chartDocs = chartTypes.map((type) => {
        const chartSource = type === ChartType.NAVAMSA_D9 && navSynth ? navSynth : synth;
        const chartData = getChartData(chartSource, type);
        return {
            horoscope: { id },
            type,
            data: isLeanChartType(type) ? toBirthChartData(chartData) : chartData,
            imageKey: "",
            svgData: generateChartSvg(chartData, type),
        };
    });
    await Chart.insertMany(chartDocs);
}

/** Recomputes every calculated (manual) horoscope in the database. */
export async function recalculateCalculatedHoroscopes(): Promise<{ updated: number; failed: number }> {
    let updated = 0;
    let failed = 0;

    const cursor = Horoscope.find({ source: "manual" }).cursor();
    for (let horoscope = await cursor.next(); horoscope != null; horoscope = await cursor.next()) {
        const id = horoscope._id.toString();
        try {
            await recalculateCalculatedHoroscope(horoscope);
            updated++;
        } catch (err) {
            failed++;
            logger.error("failed to recalculate calculated horoscope id=%s: %s", id, (err as Error).message);
        }
    }

    return { updated, failed };
}

async function main() {
    await connectDB();
    logger.info("starting calculated (manual) horoscope recalculation...");
    const { updated, failed } = await recalculateCalculatedHoroscopes();
    logger.info("calculated recalculation complete: %d updated, %d failed", updated, failed);
    process.exit(failed > 0 ? 1 : 0);
}

if (require.main === module) {
    main().catch((err) => {
        logger.error("calculated recalculation script failed: %s", err.message);
        process.exit(1);
    });
}
