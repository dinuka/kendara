import { CalculatedDetails } from "../src/models/CalculatedDetails";
import { Chart } from "../src/models/Chart";
import { Horoscope } from "../src/models/Horoscope";

import type { CalculationResult } from "../src/lib/astrology";
import { deleteChartImages, renderAndStoreChartImage } from "../src/lib/chartStorage";
import { ChartType } from "../src/lib/chartTypes";
import { connectDB } from "../src/lib/db";
import logger from "../src/lib/logger";

/** Re-renders every stored chart's PNG with the current chart components and saves the new
 *  key into `imageKey` — without recalculating anything. Also removes the legacy inline `svgData`
 *  field and the old images (including legacy `.svg` files). Re-run whenever the chart components change. `pnpm regenerate-chart-images` builds the
 *  chart renderer first; pass a horoscope id to regenerate just that one. */
async function regenerate() {
    await connectDB();

    // raw collection: `svgData` is no longer in the schema, so Mongoose would drop the $unset
    const charts = Chart.collection;
    const onlyId = process.argv[2];
    const cursor = Horoscope.find(onlyId ? { _id: onlyId } : {}, { source: 1 })
        .lean()
        .cursor();

    let rendered = 0;
    let noFigure = 0;
    let skipped = 0;

    for (let horoscope = await cursor.next(); horoscope != null; horoscope = await cursor.next()) {
        const id = horoscope._id.toString();
        const details = await CalculatedDetails.findOne({ "horoscope.id": id }).lean();
        if (!details) {
            skipped++;
            logger.warn("no calculated details, skipping horoscope id=%s", id);
            continue;
        }
        const d1 = details as unknown as CalculationResult;
        const ctx = { isManual: horoscope.source === "manual", manualHousePlacements: details.manualHousePlacements };

        const docs = await charts.find({ "horoscope.id": id }, { projection: { type: 1, imageKey: 1 } }).toArray();
        const oldKeys: string[] = [];
        for (const doc of docs) {
            const imageKey = await renderAndStoreChartImage(id, doc.type as ChartType, d1, ctx);
            await charts.updateOne({ _id: doc._id }, { $set: { imageKey }, $unset: { svgData: "" } });
            if (doc.imageKey) oldKeys.push(doc.imageKey as string);
            if (imageKey) rendered++;
            else noFigure++;
        }
        await deleteChartImages(oldKeys);
        logger.info("regenerated %d chart images for horoscope id=%s", docs.length, id);
    }

    logger.info(
        "chart image regeneration complete: %d rendered, %d without image (no figure / failed), %d horoscopes skipped",
        rendered,
        noFigure,
        skipped,
    );
}

regenerate()
    .then(() => process.exit(0))
    .catch((err) => {
        logger.error({ err }, "chart image regeneration failed");
        process.exit(1);
    });
