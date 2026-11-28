import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { CalculatedDetails } from "@/models/CalculatedDetails";
import { Chart } from "@/models/Chart";
import type { ChartType } from "@/lib/chartTypes";
import { Horoscope } from "@/models/Horoscope";

import { computeCurrentPlanets } from "@/lib/currentPlanets";
import { connectDB } from "@/lib/db";
import logger from "@/lib/logger";
import { canViewHoroscope } from "@/lib/privacy";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; type: string }> }) {
    const session = await getServerSession(authOptions);

    const { id, type } = await params;
    const includeCurrentPlanets = req.nextUrl.searchParams.get("includeCurrentPlanets") === "true";
    const dateParam = req.nextUrl.searchParams.get("date");
    const timeParam = req.nextUrl.searchParams.get("time");

    await connectDB();

    const horoscope = await Horoscope.findById(id).lean();
    if (!horoscope) return NextResponse.json({ error: "Horoscope not found" }, { status: 404 });
    if (!canViewHoroscope(horoscope, session?.user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const chart = await Chart.findOne({ horoscope: { id }, type: type as ChartType }).lean();
    if (!chart) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const response: Record<string, unknown> = { ...chart };

    if (includeCurrentPlanets && type === "house") {
        const calculatedDetails = await CalculatedDetails.findOne({ "horoscope.id": id }).lean();
        if (!calculatedDetails) return NextResponse.json({ error: "Horoscope not calculated" }, { status: 422 });

        let forDate: Date | undefined;
        if (dateParam) {
            forDate = new Date(`${dateParam}T${timeParam ?? "12:00"}:00`);
            if (isNaN(forDate.getTime())) {
                return NextResponse.json({ error: "Invalid date or time format" }, { status: 422 });
            }
        }

        try {
            const currentPlanets = computeCurrentPlanets(horoscope.ayanamsha, calculatedDetails.houses, forDate);
            response.currentPlanets = currentPlanets;
        } catch (err) {
            logger.error({ err }, "current planet calculation failed");
            return NextResponse.json({ error: "Calculation failed", detail: (err as Error).message }, { status: 422 });
        }

        return NextResponse.json(response, {
            headers: { "Cache-Control": "private, no-cache, no-store, must-revalidate" },
        });
    }

    return NextResponse.json(chart);
}
