import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { CalculatedDetails } from "@/models/CalculatedDetails";
import { Chart } from "@/models/Chart";
import { Horoscope } from "@/models/Horoscope";

import { getCalculationSettings } from "@/lib/astrologySettings";
import { getChartData, isLeanChartType, toBirthChartData } from "@/lib/chartDataTransform";
import { generateChartSvg } from "@/lib/chartRenderer";
import { ChartType } from "@/lib/chartTypes";
import { connectDB } from "@/lib/db";
import logger from "@/lib/logger";
import { compute } from "@/lib/manualChart";
import {
    getCurrentShani,
    parseManualChartBody,
    sanitizeManualHousePlacements,
    synthesizeCalculation,
    synthesizeNavamsaCalculation,
} from "@/lib/manualChartDetails";
import { reindexHoroscope } from "@/lib/search/indexer";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    logger.info("updating manual horoscope chart");
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        logger.warn("unauthorized manual chart PUT attempt");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();

    const horoscope = await Horoscope.findById(id);
    if (!horoscope) {
        logger.warn("manual chart update: horoscope not found id=%s", id);
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (horoscope.owner.id !== session.user.id) {
        logger.warn("manual chart update: forbidden id=%s", id);
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (horoscope.source !== "manual") {
        logger.warn("manual chart update: not a manual horoscope id=%s", id);
        return NextResponse.json({ error: "Not a manual horoscope" }, { status: 409 });
    }

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
    }

    const b = (body ?? {}) as Record<string, unknown>;
    let birthDate = horoscope.birthDate ?? undefined;
    if (typeof b.birthDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.birthDate)) {
        birthDate = new Date(`${b.birthDate}T00:00:00Z`);
        await Horoscope.updateOne({ _id: id }, { birthDate });
    }
    if (typeof b.name === "string" && b.name.trim() !== "") {
        await Horoscope.updateOne({ _id: id }, { name: b.name.trim() });
    }

    const parsed = parseManualChartBody(body);
    if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const currentShani = getCurrentShani(parsed.value.lagna);
    // System-wide aspect settings (US-SAS-006): the same union source as auto charts. The legacy
    // per-user copies on the User document are deprecated and never read.
    const { planetaryOrbs, planetAspects, rashiAspects } = await getCalculationSettings();
    parsed.value.aspectOptions = { planetaryOrbs, planetAspects, rashiAspects };
    const result = compute(parsed.value, currentShani);

    const synth = synthesizeCalculation(result, birthDate);
    await CalculatedDetails.findOneAndUpdate(
        { "horoscope.id": id },
        {
            ...synth,
            manualHousePlacements: sanitizeManualHousePlacements(result.manualHousePlacements),
            derivedRanges: result.derivedRanges,
        },
        { upsert: true },
    );

    await Chart.deleteMany({ "horoscope.id": id });
    const navSynth = synthesizeNavamsaCalculation(result, birthDate);
    const chartTypes = navSynth ? [ChartType.BIRTH, ChartType.NAVAMSA_D9] : [ChartType.BIRTH];
    const chartDocs = chartTypes.map((type) => {
        const chartSource = type === ChartType.NAVAMSA_D9 && navSynth ? navSynth : synth;
        const chartData = getChartData(chartSource, type);
        return {
            horoscope: { id },
            type,
            data: isLeanChartType(type) ? toBirthChartData(chartData) : chartData,
            imageKey: "",
            svgData: generateChartSvg(chartData, type),
        };
    });
    await Chart.insertMany(chartDocs);

    reindexHoroscope(id);
    logger.info("manual chart update complete: id=%s", id);

    return NextResponse.json({
        manualHousePlacements: result.manualHousePlacements,
        derivedRanges: result.derivedRanges,
    });
}
