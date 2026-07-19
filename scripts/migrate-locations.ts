import mongoose from "mongoose";

import { connectDB } from "../src/lib/db";
import logger from "../src/lib/logger";

async function migrate() {
    await connectDB();

    const db = mongoose.connection.db;
    if (!db) {
        logger.error("no database connection");
        process.exit(1);
    }

    const collection = db.collection("horoscopes");

    logger.info("starting location migration...");

    const cursor = collection.find({
        location: { $type: "string" },
    });

    let updated = 0;

    while (await cursor.hasNext()) {
        const doc = await cursor.next();
        if (!doc) continue;

        const locValue = doc.location as string;

        await collection.updateOne(
            { _id: doc._id },
            {
                $set: {
                    locationName: locValue,
                    location: null,
                },
            },
        );

        updated++;
    }

    logger.info("migration complete: %d horoscopes updated", updated);
    process.exit(0);
}

migrate().catch((err) => {
    logger.error("migration failed: %s", err.message);
    process.exit(1);
});
