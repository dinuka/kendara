import fs from "fs";
import path from "path";

import { Location } from "../src/models/Location";

import { connectDB } from "../src/lib/db";
import logger from "../src/lib/logger";

interface SeedCity {
    name: string;
    latitude: number;
    longitude: number;
}

/** Owner id recorded on seeded locations — not a real user, marks them as system-provided. */
const SYSTEM_OWNER_ID = "system";

/** Seeds public Sri Lankan city locations from `scripts/data/sri-lanka-cities.json` (sourced from
 *  OpenStreetMap place=city|town nodes). Idempotent: upserts on name + system owner, so re-running
 *  updates coordinates instead of creating duplicates, and never touches user-created locations. */
async function seed() {
    const file = path.join(__dirname, "data", "sri-lanka-cities.json");
    const cities: SeedCity[] = JSON.parse(fs.readFileSync(file, "utf8"));

    await connectDB();
    logger.info("seeding %d locations...", cities.length);

    const result = await Location.bulkWrite(
        cities.map((city) => ({
            updateOne: {
                filter: { name: city.name, "createdBy.id": SYSTEM_OWNER_ID },
                update: {
                    $set: {
                        latitude: city.latitude,
                        longitude: city.longitude,
                        isPublic: true,
                    },
                    $setOnInsert: {
                        id: crypto.randomUUID(),
                        name: city.name,
                        createdBy: { id: SYSTEM_OWNER_ID },
                    },
                },
                upsert: true,
            },
        })),
    );

    logger.info(
        "seed complete: %d inserted, %d updated",
        result.upsertedCount,
        result.modifiedCount,
    );
    process.exit(0);
}

seed().catch((err) => {
    logger.error("seed failed: %s", err.message);
    process.exit(1);
});
