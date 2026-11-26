import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { CalculatedDetails } from "@/models/CalculatedDetails";
import { Horoscope } from "@/models/Horoscope";

import { getCalculationSettings } from "@/lib/astrologySettings";
import { calculateHoroscope } from "@/lib/calculation";
import { createCharts } from "@/lib/chartStorage";
import { ALL_CHART_TYPES } from "@/lib/chartTypes";
import { connectDB } from "@/lib/db";
import logger from "@/lib/logger";
import { anonymizeIfNeeded, visibleHoroscopeFilter } from "@/lib/privacy";
import { indexHoroscope } from "@/lib/search/indexer";

export async function GET(req: NextRequest) {
    logger.info("fetching horoscopes");
    // Signed-out guests may list public horoscopes only.
    const session = await getServerSession(authOptions);
    const viewer = session?.user;

    await connectDB();
    const { searchParams } = new URL(req.url);
    const publicOnly = searchParams.get("public") === "true";

    const filter = publicOnly ? { isPublic: true } : visibleHoroscopeFilter(viewer);

    const horoscopes = await Horoscope.find(filter).sort({ createdAt: -1 }).lean();
    const visible = horoscopes.map((h) => anonymizeIfNeeded(h, viewer?.id, viewer?.role));

    logger.info("found %d horoscopes for user %s", visible.length, viewer?.id ?? "guest");
    return NextResponse.json(visible);
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

    await createCharts(horoscope.id, ALL_CHART_TYPES, () => calculated, { isManual: false });

    indexHoroscope(horoscope.id);
    logger.info("horoscope creation complete: id=%s", horoscope.id);

    return NextResponse.json(horoscope, { status: 201 });
}
