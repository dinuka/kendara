import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import logger from "@/lib/logger";
import { computeManualChartPositions } from "@/lib/manualChartDetails";

/** Compute the 9 planets' positions for a birth-date autofill on the Calculated Chart form.
 *  Uses the shared ephemeris; stateless (no DB writes). */
export async function POST(req: NextRequest) {
    logger.info("computing manual chart positions from birth date");
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        logger.warn("unauthorized manual positions request");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
    }
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
        return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }
    const b = body as Record<string, unknown>;

    const { date, lagna } = b;
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
    }
    if (typeof lagna !== "number" || !Number.isInteger(lagna) || lagna < 1 || lagna > 12) {
        return NextResponse.json({ error: "lagna must be an integer 1-12" }, { status: 400 });
    }
    let navamsaLagna: number | undefined;
    if (b.navamsaLagna !== undefined && b.navamsaLagna !== null) {
        if (
            typeof b.navamsaLagna !== "number" ||
            !Number.isInteger(b.navamsaLagna) ||
            b.navamsaLagna < 1 ||
            b.navamsaLagna > 12
        ) {
            return NextResponse.json({ error: "navamsaLagna must be an integer 1-12" }, { status: 400 });
        }
        navamsaLagna = b.navamsaLagna;
    }

    try {
        const result = computeManualChartPositions(date, lagna, navamsaLagna);
        logger.info("computed positions for %d planets on %s", result.positions.length, date);
        return NextResponse.json(result);
    } catch (err) {
        logger.error({ err }, "failed to compute manual chart positions");
        return NextResponse.json({ error: "failed to compute planetary positions" }, { status: 500 });
    }
}
