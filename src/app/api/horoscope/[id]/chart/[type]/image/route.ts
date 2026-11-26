import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { Chart } from "@/models/Chart";
import { Horoscope } from "@/models/Horoscope";

import { chartImageResponse } from "@/lib/chartStorage";
import { ALL_CHART_TYPES, ChartType } from "@/lib/chartTypes";
import { connectDB } from "@/lib/db";
import logger from "@/lib/logger";
import { canViewHoroscope } from "@/lib/privacy";
import { chartImageCacheControl } from "@/lib/seo";

/** GET /api/horoscope/[id]/chart/[type]/image?download=1 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; type: string }> }) {
    const session = await getServerSession(authOptions);
    const { id, type } = await params;

    if (!ALL_CHART_TYPES.includes(type as ChartType)) {
        return NextResponse.json({ error: "Unknown chart type" }, { status: 400 });
    }

    await connectDB();

    const horoscope = await Horoscope.findById(id).lean();
    if (!horoscope) return NextResponse.json({ error: "Horoscope not found" }, { status: 404 });
    if (!canViewHoroscope(horoscope, session?.user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const chart = await Chart.findOne({ "horoscope.id": id, type: type as ChartType }, { imageKey: 1, type: 1 }).lean();
    logger.debug("serving chart image: horoscope=%s type=%s", id, type);

    return chartImageResponse(chart, {
        cacheControl: chartImageCacheControl(
            req.nextUrl.searchParams.get("v"),
            chart?.imageKey,
            horoscope.isPublic,
        ),
        download: req.nextUrl.searchParams.get("download") === "1",
    });
}
