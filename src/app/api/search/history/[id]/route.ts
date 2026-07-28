import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { SearchHistory } from "@/models/SearchHistory";

import { connectDB } from "@/lib/db";
import logger from "@/lib/logger";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();

    const entry = await SearchHistory.findById(id);
    if (!entry) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (entry.user.id !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await SearchHistory.deleteOne({ _id: id });

    logger.info("history entry deleted id=%s user=%s", id, session.user.id);

    return NextResponse.json({ success: true });
}
