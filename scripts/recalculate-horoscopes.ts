import mongoose from "mongoose";

import { calculateHoroscope } from "../src/lib/calculation";
import { getChartData } from "../src/lib/chartDataTransform";
import { generateChartSvg } from "../src/lib/chartRenderer";
import { ALL_CHART_TYPES } from "../src/lib/chartTypes";
import { connectDB } from "../src/lib/db";
import logger from "../src/lib/logger";
import { CalculatedDetails } from "../src/models/CalculatedDetails";
import { Chart } from "../src/models/Chart";
import { Horoscope } from "../src/models/Horoscope";
import { User } from "../src/models/User";

/** Recomputes CalculatedDetails and Chart docs for every existing horoscope, using the same
 *  calculateHoroscope/getChartData/generateChartSvg pipeline as the PUT /api/horoscope/[id]
 *  recalculation path. Needed because fixes to the calculation logic (e.g. the whole-sign house
 *  fix) only apply to horoscopes calculated after the fix — existing records keep stale data
 *  until explicitly recalculated. */
async function migrate() {
    await connectDB();

    logger.info("starting horoscope recalculation...");

    const orbsByOwnerId = new Map<string, Record<string, number>>();

    const cursor = Horoscope.find().cursor();

    let updated = 0;
    let failed = 0;

    for (let horoscope = await cursor.next(); horoscope != null; horoscope = await cursor.next()) {
        const id = horoscope._id.toString();
        try {
            let planetaryOrbs = orbsByOwnerId.get(horoscope.owner.id);
            if (!planetaryOrbs) {
                const user = await User.findOne({ googleId: horoscope.owner.id }).lean();
                planetaryOrbs = (user?.planetaryOrbs ?? {}) as Record<string, number>;
                orbsByOwnerId.set(horoscope.owner.id, planetaryOrbs);
            }

            const calculated = calculateHoroscope(horoscope, planetaryOrbs);

            await CalculatedDetails.findOneAndUpdate({ "horoscope.id": id }, { ...calculated }, { upsert: true });

            await Chart.deleteMany({ "horoscope.id": id });

            const chartDocs = ALL_CHART_TYPES.map((type) => {
                const chartData = getChartData(calculated, type);
                return {
                    horoscope: { id },
                    type,
                    data: chartData,
                    imageKey: "",
                    svgData: generateChartSvg(chartData, type),
                };
            });

            await Chart.insertMany(chartDocs);

            updated++;
        } catch (err) {
            failed++;
            logger.error("failed to recalculate horoscope id=%s: %s", id, (err as Error).message);
        }
    }

    logger.info("recalculation complete: %d updated, %d failed", updated, failed);
    process.exit(failed > 0 ? 1 : 0);
}

migrate().catch((err) => {
    logger.error("recalculation script failed: %s", err.message);
    process.exit(1);
});
