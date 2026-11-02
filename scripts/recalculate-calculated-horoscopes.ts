import { Horoscope } from "../src/models/Horoscope";

import { getCalculationSettings } from "../src/lib/astrologySettings";
import { connectDB } from "../src/lib/db";
import logger from "../src/lib/logger";
import { recalculateHoroscope } from "../src/lib/recalculateHoroscope";

/** Recomputes every calculated (manual) horoscope in the database through `recalculateHoroscope`
 *  (replayed from the persisted `manualHousePlacements` with the system-wide aspect settings).
 *  `skipped` counts manual horoscopes with no stored `manualHousePlacements` to recompute from. */
export async function recalculateCalculatedHoroscopes(): Promise<{ updated: number; failed: number; skipped: number }> {
    let updated = 0;
    let failed = 0;
    let skipped = 0;

    const settings = await getCalculationSettings();
    const cursor = Horoscope.find({ source: "manual" }).cursor();
    for (let horoscope = await cursor.next(); horoscope != null; horoscope = await cursor.next()) {
        const id = horoscope._id.toString();
        try {
            if (await recalculateHoroscope(horoscope, settings)) {
                updated++;
            } else {
                skipped++;
            }
        } catch (err) {
            failed++;
            logger.error("failed to recalculate calculated horoscope id=%s: %s", id, (err as Error).message);
        }
    }

    return { updated, failed, skipped };
}

async function main() {
    await connectDB();
    logger.info("starting calculated (manual) horoscope recalculation...");
    const { updated, failed, skipped } = await recalculateCalculatedHoroscopes();
    logger.info("calculated recalculation complete: %d updated, %d skipped, %d failed", updated, skipped, failed);
    process.exit(failed > 0 ? 1 : 0);
}

if (require.main === module) {
    main().catch((err) => {
        logger.error("calculated recalculation script failed: %s", err.message);
        process.exit(1);
    });
}
