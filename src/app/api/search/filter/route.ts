import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { SavedFilter } from "@/models/SavedFilter";

import { connectDB } from "@/lib/db";
import logger from "@/lib/logger";

const MAX_SAVED_FILTERS = 50;

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const filters = await SavedFilter.find({ "user.id": session.user.id })
        .sort({ lastRunAt: -1 })
        .lean();

    const publicFilters = filters.filter((f) => f.name !== "__default__");
    const defaultFilter = filters.find((f) => f.name === "__default__") || null;

    logger.debug("found %d saved filters for user=%s", filters.length, session.user.id);

    return NextResponse.json({
        filters: publicFilters,
        defaultFilter,
        total: publicFilters.length,
    });
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const body = await req.json();
    const { name, query, filterConfig } = body;

    if (!name || typeof name !== "string") {
        return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (name !== "__default__") {
        const count = await SavedFilter.countDocuments({
            "user.id": session.user.id,
            name: { $ne: "__default__" },
        });

        if (count >= MAX_SAVED_FILTERS) {
            logger.warn(
                "max saved filters reached for user=%s count=%d",
                session.user.id,
                count,
            );
            return NextResponse.json(
                { error: `Maximum ${MAX_SAVED_FILTERS} saved searches reached.` },
                { status: 400 },
            );
        }

        const existing = await SavedFilter.findOne({
            "user.id": session.user.id,
            name,
        });

        if (existing) {
            logger.info(
                "overwriting saved filter name=%s for user=%s",
                name,
                session.user.id,
            );
            existing.query = query || "";
            existing.filterConfig = filterConfig || {};
            existing.lastRunAt = null;
            existing.resultCount = 0;
            await existing.save();

            return NextResponse.json(existing);
        }
    }

    const savedFilter = await SavedFilter.create({
        user: { id: session.user.id },
        name,
        query: query || "",
        filterConfig: filterConfig || {},
        lastRunAt: null,
        resultCount: 0,
    });

    logger.info(
        "saved filter created name=%s for user=%s",
        name,
        session.user.id,
    );

    return NextResponse.json(savedFilter, { status: 201 });
}
