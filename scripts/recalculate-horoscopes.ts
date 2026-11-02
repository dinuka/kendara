import { Horoscope } from "../src/models/Horoscope";

import { getCalculationSettings } from "../src/lib/astrologySettings";
import { connectDB } from "../src/lib/db";
import logger from "../src/lib/logger";
import { recalculateHoroscope } from "../src/lib/recalculateHoroscope";

/** Recomputes everything a save produces for every existing horoscope — CalculatedDetails, Chart
 *  docs and the search index — through the same `recalculateHoroscope` pipeline as the admin bulk
 *  job, using the system-wide calculation settings (US-SAS-006). Needed because fixes to the
 *  calculation logic (e.g. the whole-sign house fix, new stored fields) only apply to horoscopes
 *  calculated after the fix — existing records keep stale data until explicitly recalculated. */
async function migrate() {
    await connectDB();

    logger.info("starting horoscope recalculation...");

    const settings = await getCalculationSettings();
    const cursor = Horoscope.find().cursor();

    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (let horoscope = await cursor.next(); horoscope != null; horoscope = await cursor.next()) {
        const id = horoscope._id.toString();
        try {
            if (await recalculateHoroscope(horoscope, settings)) {
                updated++;
                logger.info("recalculated horoscope id=%s source=%s", id, horoscope.source ?? "auto");
            } else {
                skipped++;
            }
        } catch (err) {
            failed++;
            logger.error("failed to recalculate horoscope id=%s: %s", id, (err as Error).message);
        }
    }

    logger.info("recalculation complete: %d updated, %d skipped, %d failed", updated, skipped, failed);
    process.exit(failed > 0 ? 1 : 0);
}

migrate().catch((err) => {
    logger.error("recalculation script failed: %s", err.message);
    process.exit(1);
});
