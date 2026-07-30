import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { Horoscope } from "@/models/Horoscope";
import { SearchBookmark } from "@/models/SearchBookmark";

import { connectDB } from "@/lib/db";
import logger from "@/lib/logger";

const MAX_BOOKMARKS = 100;

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const bookmarks = await SearchBookmark.find({ "user.id": session.user.id }).sort({ createdAt: -1 }).lean();

    const enrichedBookmarks = [];

    for (const bookmark of bookmarks) {
        const horoscope = await Horoscope.findOne({
            _id: bookmark.horoscope.id,
        })
            .select("name displayName isPublic owner birthDate")
            .lean();

        enrichedBookmarks.push({
            ...bookmark,
            horoscopeDetail: horoscope || null,
            isAvailable: !!horoscope,
        });
    }

    logger.debug("found %d bookmarks for user=%s", bookmarks.length, session.user.id);

    return NextResponse.json({ bookmarks: enrichedBookmarks, total: bookmarks.length });
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const body = await req.json();
    const { horoscopeId, notes, queryContext } = body;

    if (!horoscopeId) {
        return NextResponse.json({ error: "horoscopeId is required" }, { status: 400 });
    }

    const bookmarkCount = await SearchBookmark.countDocuments({
        "user.id": session.user.id,
    });

    if (bookmarkCount >= MAX_BOOKMARKS) {
        logger.warn("max bookmarks reached for user=%s count=%d", session.user.id, bookmarkCount);
        return NextResponse.json({ error: `Maximum ${MAX_BOOKMARKS} bookmarks reached.` }, { status: 400 });
    }

    const existing = await SearchBookmark.findOne({
        "user.id": session.user.id,
        "horoscope.id": horoscopeId,
    });

    if (existing) {
        return NextResponse.json({ error: "Horoscope already bookmarked." }, { status: 409 });
    }

    const bookmark = await SearchBookmark.create({
        user: { id: session.user.id },
        horoscope: { id: horoscopeId },
        notes: notes || "",
        queryContext: queryContext || "",
    });

    logger.info("bookmark created horoscopeId=%s user=%s", horoscopeId, session.user.id);

    return NextResponse.json(bookmark, { status: 201 });
}
