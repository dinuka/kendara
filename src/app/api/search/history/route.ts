import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { SearchHistory } from "@/models/SearchHistory";

import { connectDB } from "@/lib/db";
import logger from "@/lib/logger";

const MAX_HISTORY_ENTRIES = 50;
const DEDUP_WINDOW_MS = 5 * 60 * 1000;

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const entries = await SearchHistory.find({ "user.id": session.user.id })
        .sort({ createdAt: -1 })
        .limit(MAX_HISTORY_ENTRIES)
        .lean();

    logger.debug("found %d history entries for user=%s", entries.length, session.user.id);

    return NextResponse.json({ entries, total: entries.length });
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const body = await req.json();
    const { query, parsedConditions, resultCount, language, source } = body;

    if (!query || typeof query !== "string") {
        return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const dedupEntry = await SearchHistory.findOne({
        "user.id": session.user.id,
        query,
        createdAt: { $gte: new Date(Date.now() - DEDUP_WINDOW_MS) },
    }).sort({ createdAt: -1 });

    if (dedupEntry) {
        dedupEntry.createdAt = new Date();
        dedupEntry.resultCount = resultCount ?? dedupEntry.resultCount;
        await dedupEntry.save();

        logger.debug("updated existing history entry for query=%s user=%s", query, session.user.id);

        return NextResponse.json({ entry: dedupEntry, deduped: true });
    }

    const entry = await SearchHistory.create({
        user: { id: session.user.id },
        query,
        parsedConditions: parsedConditions || null,
        resultCount: resultCount || 0,
        language: language || "en",
        source: source || "manual",
    });

    const count = await SearchHistory.countDocuments({ "user.id": session.user.id });

    if (count > MAX_HISTORY_ENTRIES) {
        const oldest = await SearchHistory.find({ "user.id": session.user.id })
            .sort({ createdAt: 1 })
            .limit(count - MAX_HISTORY_ENTRIES);

        const oldestIds = oldest.map((o) => o._id);
        await SearchHistory.deleteMany({ _id: { $in: oldestIds } });

        logger.debug("auto-purged %d old history entries for user=%s", oldestIds.length, session.user.id);
    }

    logger.info("search history recorded query=%s user=%s", query, session.user.id);

    return NextResponse.json({ entry, deduped: false }, { status: 201 });
}

export async function DELETE() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const result = await SearchHistory.deleteMany({ "user.id": session.user.id });

    logger.info(
        "cleared %d history entries for user=%s",
        result.deletedCount,
        session.user.id,
    );

    return NextResponse.json({ success: true });
}
