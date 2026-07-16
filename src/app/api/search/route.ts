import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { Horoscope } from "@/models/Horoscope";
import { SavedFilter } from "@/models/SavedFilter";

import { connectDB } from "@/lib/db";
import logger from "@/lib/logger";

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

            const signMap: Record<string, number> = {
                මේෂ: 1,
                aries: 1,
                වෘෂභ: 2,
                taurus: 2,
                මිථුන: 3,
                gemini: 3,
                කටක: 4,
                cancer: 4,
                සිංහ: 5,
                leo: 5,
                කන්යා: 6,
                virgo: 6,
                තුලා: 7,
                libra: 7,
                වෘශ්චික: 8,
                scorpio: 8,
                ධනු: 9,
                sagittarius: 9,
                මකර: 10,
                capricorn: 10,
                කුම්භ: 11,
                aquarius: 11,
                මීන: 12,
                pisces: 12,
            };

            const planetMap: Record<string, number> = {
                ඉර: 1,
                රවි: 1,
                sun: 1,
                හඳ: 2,
                සඳ: 2,
                moon: 2,
                කුජ: 3,
                mars: 3,
                අඟහරු: 3,
                බුධ: 4,
                mercury: 4,
                ගුරු: 5,
                jupiter: 5,
                සිකුරු: 6,
                venus: 6,
                ශනි: 7,
                saturn: 7,
                රාහු: 8,
                rahu: 8,
                කේතු: 9,
                ketu: 9,
            };

            for (const [word] of Object.entries(signMap)) {
                if (q.includes(word)) {
                    score += 0.5;
                }
            }

            for (const [word] of Object.entries(planetMap)) {
                if (q.includes(word)) {
                    score += 0.3;
                }
            }

            if (q.includes("උච්ච") || q.includes("exaltation")) score += 0.5;
            if (q.includes("නීච") || q.includes("debilitation")) score += 0.5;
            if (q.includes("යෝග") || q.includes("yoga")) score += 0.4;

            return { horoscope: h, score: +score.toFixed(2) };
        })
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score);

    logger.info("search returned %d results for query: %s", results.length, query);
    return NextResponse.json({ results, total: results.length });
}
