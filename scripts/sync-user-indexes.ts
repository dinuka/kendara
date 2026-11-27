import { User } from "../src/models/User";

import { connectDB } from "../src/lib/db";
import logger from "../src/lib/logger";

/**
 * Rebuilds the User collection's indexes to match the schema. Needed once after adding Facebook
 * SSO: the old `googleId_1` unique index is not sparse, so a second user without a googleId
 * (Facebook-only) would collide on null. `syncIndexes` drops it and recreates it as sparse, and
 * adds the sparse unique `facebookId_1` index.
 */
async function main() {
    await connectDB();
    const dropped = await User.syncIndexes();
    logger.info("user indexes synced: dropped=%s", dropped.join(",") || "none");
    const indexes = await User.listIndexes();
    for (const index of indexes) {
        logger.info("index %s sparse=%s unique=%s", index.name, String(index.sparse), String(index.unique));
    }
    process.exit(0);
}

main().catch((err) => {
    logger.error(err, "user index sync failed");
    process.exit(1);
});
