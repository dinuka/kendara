import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { CalculatedDetails } from "@/models/CalculatedDetails";
import { Horoscope } from "@/models/Horoscope";

import { computeCurrentPlanets } from "@/lib/currentPlanets";
import { connectDB } from "@/lib/db";
import logger from "@/lib/logger";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const dateParam = req.nextUrl.searchParams.get("date");
    const timeParam = req.nextUrl.searchParams.get("time");

    await connectDB();

    const horoscope = await Horoscope.findById(id).lean();
    if (!horoscope) return NextResponse.json({ error: "Horoscope not found" }, { status: 404 });

    if (!horoscope.isPublic && horoscope.owner.id !== session.user.id)
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const calculatedDetails = await CalculatedDetails.findOne({ "horoscope.id": id }).lean();
    if (!calculatedDetails) return NextResponse.json({ error: "Horoscope not calculated" }, { status: 422 });

    let forDate: Date | undefined;
    if (dateParam) {
        forDate = new Date(`${dateParam}T${timeParam ?? "12:00"}:00`);
        if (isNaN(forDate.getTime())) {
            return NextResponse.json({ error: "Invalid date or time format" }, { status: 422 });
        }
    }

    let currentPlanets: import("@/lib/astrology").CurrentPlanetRecord[];
    try {
        currentPlanets = computeCurrentPlanets(horoscope.ayanamsha, calculatedDetails.houses, forDate);
    } catch (err) {
        logger.error({ err }, "current planet calculation failed");
        return NextResponse.json({ error: "Calculation failed", detail: (err as Error).message }, { status: 422 });
    }

    return NextResponse.json(
        { currentPlanets, computedAt: (forDate ?? new Date()).toISOString() },
        {
            headers: { "Cache-Control": "private, no-cache, no-store, must-revalidate" },
        },
    );
}
