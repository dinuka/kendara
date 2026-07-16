import mongoose from "mongoose";

import logger from "@/lib/logger";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/kendara";

let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

export async function connectDB() {
    if (cached.conn) {
        logger.debug("using cached DB connection");
        return cached.conn;
    }

    if (!cached.promise) {
        logger.info("connecting to MongoDB...");
        cached.promise = mongoose.connect(MONGODB_URI);
    }

    cached.conn = await cached.promise;
    logger.info("MongoDB connected");
    return cached.conn;
}
