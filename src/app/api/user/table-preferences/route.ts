import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { User } from "@/models/User";

import { connectDB } from "@/lib/db";
import logger from "@/lib/logger";
import { normalizeTablePreferences, parseTablePreferences } from "@/lib/tableColumns";

/** The signed-in user's Houses/Planets table column layouts. They are a personal display
 *  preference applied to every horoscope the user views — the target is always the caller's own
 *  User document (keyed on `session.user.id`). */

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const user = await User.findById(session.user.id).select("tablePreferences").lean();
    if (!user) {
        logger.warn("table preferences GET: user %s not found", session.user.id);
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    logger.debug("table preferences GET for user %s", session.user.id);
    return NextResponse.json({ tablePreferences: normalizeTablePreferences(user.tablePreferences) });
}

export async function PUT(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const tablePreferences = parseTablePreferences((body as { tablePreferences?: unknown } | null)?.tablePreferences);
    if (!tablePreferences) {
        logger.warn("table preferences PUT rejected: invalid payload (user %s)", session.user.id);
        return NextResponse.json({ error: "Invalid table preferences" }, { status: 400 });
    }

    await connectDB();
    const user = await User.findByIdAndUpdate(session.user.id, { $set: { tablePreferences } }, { new: true })
        .select("tablePreferences")
        .lean();
    if (!user) {
        logger.warn("table preferences PUT: user %s not found", session.user.id);
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    logger.info("table preferences saved for user %s", session.user.id);
    return NextResponse.json({ tablePreferences });
}
