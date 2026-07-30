import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { CalculatedDetails } from "@/models/CalculatedDetails";
import { Chart } from "@/models/Chart";
import { Horoscope } from "@/models/Horoscope";

import { PLANET_NAMES, ZODIAC_SIGN_NAMES } from "@/lib/astrologyEnums";
import { connectDB } from "@/lib/db";
import logger from "@/lib/logger";
import { getAnonymousPlaceholder } from "@/lib/privacy";

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const checkRateLimit = (userId: string): boolean => {
    const now = Date.now();
    const entry = rateLimitMap.get(userId);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return true;
    }

    if (entry.count >= RATE_LIMIT_MAX) {
        return false;
    }

    entry.count++;
    return true;
};

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!checkRateLimit(session.user.id)) {
        logger.warn("export rate limit exceeded for user=%s", session.user.id);
        return NextResponse.json(
            { error: "Rate limit exceeded. Try again later." },
            {
                status: 429,
                headers: { "Retry-After": "60" },
            },
        );
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "csv";
    const query = searchParams.get("query") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const pageSize = 20;

    if (!query) {
        return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const horoscopes = await Horoscope.find({
        $or: [{ "owner.id": session.user.id }, { isPublic: true }],
    }).lean();

    const results = [];

    for (const h of horoscopes) {
        const isOwner = h.owner.id === session.user.id;
        const name = isOwner || h.displayName ? h.name : getAnonymousPlaceholder(h._id.toString());

        const calculatedDetails = await CalculatedDetails.findOne({
            "horoscope.id": h._id.toString(),
        }).lean();

        const charts = await Chart.find({
            "horoscope.id": h._id.toString(),
        }).lean();

        results.push({
            horoscope: {
                ...h,
                name,
                calculatedDetails,
                charts: charts.reduce(
                    (acc, c) => {
                        acc[c.type] = c;
                        return acc;
                    },
                    {} as Record<string, unknown>,
                ),
            },
            score: 0,
        });
    }

    const start = (page - 1) * pageSize;
    const pageResults = results.slice(start, start + pageSize);

    if (format === "json") {
        logger.info("exported %d results as JSON for user=%s", pageResults.length, session.user.id);

        return NextResponse.json({
            results: pageResults,
            total: results.length,
            page,
            pageSize,
            totalPages: Math.ceil(results.length / pageSize),
        });
    }

    const csvRows = [];
    const headers = [
        "Name",
        "Ascendant Sign",
        "Ascendant Degree",
        "Birth Date",
        "Gender",
        "Planet Positions",
        "Nakshatra",
        "Yogas",
        "Doshas",
    ];
    csvRows.push(headers.join(","));

    for (const r of pageResults) {
        const h = r.horoscope;
        const cd = h.calculatedDetails as Record<string, unknown> | null;

        const ascendantSign = cd?.ascendant ? String((cd.ascendant as Record<string, unknown>).sign || "") : "";
        const ascendantDegree = cd?.ascendant ? String((cd.ascendant as Record<string, unknown>).degree || "") : "";

        const planetPositions = cd?.planets
            ? (cd.planets as Array<Record<string, unknown>>)
                  .map((p: Record<string, unknown>) => {
                      const planetName = Object.entries(PLANET_NAMES).find(([, v]) => v === p.name)?.[0] || p.name;
                      const signName = Object.entries(ZODIAC_SIGN_NAMES).find(([, v]) => v === p.sign)?.[0] || p.sign;
                      return `${planetName} in ${signName} House ${p.house}`;
                  })
                  .join("; ")
            : "";

        const nakshatra = cd?.nakshatra ? JSON.stringify(cd.nakshatra) : "";

        const yogas = cd?.yogas ? (cd.yogas as Array<Record<string, unknown>>).map((y) => y.name).join("; ") : "";

        const doshas = cd?.doshas
            ? (cd.doshas as Record<string, unknown>).doshas
                ? ((cd.doshas as Record<string, unknown>).doshas as Array<Record<string, unknown>>)
                      .map((d) => d.name)
                      .join("; ")
                : ""
            : "";

        const row = [
            `"${h.name}"`,
            `"${ascendantSign}"`,
            `"${ascendantDegree}"`,
            `"${h.birthDate ? new Date(h.birthDate).toISOString().split("T")[0] : ""}"`,
            `"${h.gender || ""}"`,
            `"${planetPositions}"`,
            `"${nakshatra}"`,
            `"${yogas}"`,
            `"${doshas}"`,
        ];

        csvRows.push(row.join(","));
    }

    const csvContent = csvRows.join("\n");

    logger.info("exported %d results as CSV for user=%s", pageResults.length, session.user.id);

    return new NextResponse(csvContent, {
        headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="search-results.csv"`,
        },
    });
}
