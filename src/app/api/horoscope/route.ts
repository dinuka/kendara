import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { CalculatedDetails } from "@/models/CalculatedDetails";
import { Chart } from "@/models/Chart";
import { Horoscope } from "@/models/Horoscope";

import { getCalculationSettings } from "@/lib/astrologySettings";
import { calculateHoroscope } from "@/lib/calculation";
import { getChartData, isLeanChartType, toBirthChartData } from "@/lib/chartDataTransform";
import { generateChartSvg } from "@/lib/chartRenderer";
import { ALL_CHART_TYPES } from "@/lib/chartTypes";
import { connectDB } from "@/lib/db";
import logger from "@/lib/logger";
import { indexHoroscope } from "@/lib/search/indexer";

export async function GET(req: NextRequest) {
    logger.info("fetching horoscopes");
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        logger.warn("unauthorized horoscope GET attempt");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const { searchParams } = new URL(req.url);
    const publicOnly = searchParams.get("public") === "true";

    const filter = publicOnly ? { isPublic: true } : { $or: [{ "owner.id": session.user.id }, { isPublic: true }] };

    const horoscopes = await Horoscope.find(filter).sort({ createdAt: -1 }).lean();

    logger.info("found %d horoscopes for user %s", horoscopes.length, session.user.id);
    return NextResponse.json(horoscopes);
}

export async function POST(req: NextRequest) {
    logger.info("creating horoscope");
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        logger.warn("unauthorized horoscope POST attempt");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const body = await req.json();
    logger.info("received birth data: name=%s date=%s time=%s", body.name, body.birthDate, body.birthTime);

    const locationRef =
        body.location && typeof body.location === "object" && body.location.id
            ? { id: body.location.id }
            : body.location && typeof body.location === "string"
              ? null
              : null;

    const horoscope = await Horoscope.create({
        owner: { id: session.user.id },
        name: body.name,
        displayName: body.displayName ?? true,
        birthDate: new Date(body.birthDate),
        birthTime: body.birthTime,
        location: locationRef,
        locationName: body.locationName || (typeof body.location === "string" ? body.location : "") || "",
        latitude: body.latitude || 0,
        longitude: body.longitude || 0,
        gender: body.gender,
        ayanamsha: body.ayanamsha || "lahiri",
        isPublic: body.isPublic ?? false,
    });
    logger.info("horoscope saved: id=%s", horoscope.id);

    // US-SAS-006: every calculation reads the system-wide settings — the single source of truth.
    const { planetaryOrbs, planetAspects, rashiAspects } = await getCalculationSettings();

    logger.info("running astrological calculation...");
    const calculated = calculateHoroscope(horoscope, planetaryOrbs, planetAspects, rashiAspects);

    logger.info("saving calculated details...");
    await CalculatedDetails.create({
        horoscope: { id: horoscope.id },
        ...calculated,
    });

    logger.info("saving %d chart records...", ALL_CHART_TYPES.length);

    const chartDocs = ALL_CHART_TYPES.map((type) => {
        const chartData = getChartData(calculated, type);
        return {
            horoscope: { id: horoscope.id },
            type,
            data: isLeanChartType(type) ? toBirthChartData(chartData) : chartData,
            imageKey: "",
            svgData: generateChartSvg(chartData, type),
        };
    });

    await Chart.insertMany(chartDocs);

    indexHoroscope(horoscope.id);
    logger.info("horoscope creation complete: id=%s", horoscope.id);

    return NextResponse.json(horoscope, { status: 201 });
}
