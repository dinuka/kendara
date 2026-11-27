import { NextRequest, NextResponse } from "next/server";

import { Chart } from "@/models/Chart";
import { ShareLink } from "@/models/ShareLink";

import { chartImageResponse } from "@/lib/chartStorage";
import { ALL_CHART_TYPES, ChartType } from "@/lib/chartTypes";
import { connectDB } from "@/lib/db";
import logger from "@/lib/logger";
import { chartImageCacheControl } from "@/lib/seo";

/** GET /api/share/[token]/chart/[type]/image?download=1 — public, gated by the share token
 *  so the URL works as an og:image or in chat apps without a session. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string; type: string }> }) {
    const { token, type } = await params;

    if (!ALL_CHART_TYPES.includes(type as ChartType)) {
        return NextResponse.json({ error: "Unknown chart type" }, { status: 400 });
    }

    await connectDB();

    const link = await ShareLink.findOne({ token });
    if (!link) return NextResponse.json({ error: "Link not found" }, { status: 404 });
    if (new Date() > link.expiresAt) return NextResponse.json({ error: "Link expired" }, { status: 410 });

    const chart = await Chart.findOne({ "horoscope.id": link.horoscope.id, type: type as ChartType }, { imageKey: 1, type: 1 }).lean();
    logger.debug("serving shared chart image: horoscope=%s type=%s", link.horoscope.id, type);

    return chartImageResponse(chart, {
        cacheControl: chartImageCacheControl(req.nextUrl.searchParams.get("v"), chart?.imageKey, true),
        download: req.nextUrl.searchParams.get("download") === "1",
    });
}
