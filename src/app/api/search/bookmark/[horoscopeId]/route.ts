import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { SearchBookmark } from "@/models/SearchBookmark";

import { connectDB } from "@/lib/db";
import logger from "@/lib/logger";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ horoscopeId: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { horoscopeId } = await params;
    await connectDB();
    const body = await req.json();

    const bookmark = await SearchBookmark.findOne({
        "user.id": session.user.id,
        "horoscope.id": horoscopeId,
    });

    if (!bookmark) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (body.notes !== undefined) bookmark.notes = body.notes;
    if (body.queryContext !== undefined) bookmark.queryContext = body.queryContext;

    await bookmark.save();

    logger.info(
        "bookmark updated horoscopeId=%s user=%s",
        horoscopeId,
        session.user.id,
    );

    return NextResponse.json(bookmark);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ horoscopeId: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { horoscopeId } = await params;
    await connectDB();

    const bookmark = await SearchBookmark.findOne({
        "user.id": session.user.id,
        "horoscope.id": horoscopeId,
    });

    if (!bookmark) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await SearchBookmark.deleteOne({
        "user.id": session.user.id,
        "horoscope.id": horoscopeId,
    });

    logger.info(
        "bookmark deleted horoscopeId=%s user=%s",
        horoscopeId,
        session.user.id,
    );

    return NextResponse.json({ success: true });
}
