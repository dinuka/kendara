import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { Horoscope } from "@/models/Horoscope";
import { SavedFilter } from "@/models/SavedFilter";

import { PLANET_NAMES, ZODIAC_SIGN_NAMES } from "@/lib/astrologyEnums";
import { connectDB } from "@/lib/db";
import logger from "@/lib/logger";
import { getAnonymousPlaceholder } from "@/lib/privacy";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        logger.warn("unauthorized search attempt");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const { query } = await req.json();

    if (!query || typeof query !== "string") {
        return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    logger.info("search query: %s", query);

    const horoscopes = await Horoscope.find({
        $or: [{ "owner.id": session.user.id }, { isPublic: true }],
    }).lean();

    logger.debug("searching through %d horoscopes", horoscopes.length);

    const results = horoscopes
        .map((h) => {
            let score = 0;
            const q = query.toLowerCase();

            for (const [word] of Object.entries(ZODIAC_SIGN_NAMES)) {
                if (q.includes(word)) {
                    score += 0.5;
                }
            }

            for (const [word] of Object.entries(PLANET_NAMES)) {
                if (q.includes(word)) {
                    score += 0.3;
                }
            }

            if (q.includes("උච්ච") || q.includes("exaltation")) score += 0.5;
            if (q.includes("නීච") || q.includes("debilitation")) score += 0.5;
            if (q.includes("යෝග") || q.includes("yoga")) score += 0.4;

            const isOwner = h.owner.id === session?.user?.id;
            const name = isOwner || h.displayName ? h.name : getAnonymousPlaceholder(h._id.toString());

            return { horoscope: { ...h, name }, score: +score.toFixed(2) };
        })
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score);

    logger.info("search returned %d results for query: %s", results.length, query);
    return NextResponse.json({ results, total: results.length });
}
