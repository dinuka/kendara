import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { CalculatedDetails } from "@/models/CalculatedDetails";
import { Chart } from "@/models/Chart";
import { Horoscope } from "@/models/Horoscope";

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
import { indexHoroscope } from "@/lib/search/indexer";

export async function POST(req: NextRequest) {
    logger.info("creating manual horoscope");
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        logger.warn("unauthorized manual horoscope POST attempt");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
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
    if (typeof b.name !== "string" || b.name.trim() === "") {
        return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const parsed = parseManualChartBody(body);
    if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const currentShani = getCurrentShani(parsed.value.lagna);
    const result = compute(parsed.value, currentShani);

    let birthDate: Date | undefined;
    if (typeof b.birthDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.birthDate)) {
        birthDate = new Date(`${b.birthDate}T00:00:00Z`);
    }

    const horoscope = await Horoscope.create({
        owner: { id: session.user.id },
        name: b.name,
        displayName: typeof b.displayName === "boolean" ? b.displayName : true,
        gender: "other",
        ayanamsha: "lahiri",
        source: "manual",
        isPublic: false,
        birthDate,
    });
    logger.info("manual horoscope saved: id=%s", horoscope.id);

    const synth = synthesizeCalculation(result, birthDate);
    await CalculatedDetails.create({
        horoscope: { id: horoscope.id },
        ...synth,
        manualHousePlacements: sanitizeManualHousePlacements(result.manualHousePlacements),
        derivedRanges: result.derivedRanges,
    });

    const navSynth = synthesizeNavamsaCalculation(result, birthDate);
    const chartTypes = navSynth ? [ChartType.BIRTH, ChartType.NAVAMSA_D9] : [ChartType.BIRTH];
    const chartDocs = chartTypes.map((type) => {
        const chartSource = type === ChartType.NAVAMSA_D9 && navSynth ? navSynth : synth;
        const chartData = getChartData(chartSource, type);
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
    logger.info("manual horoscope creation complete: id=%s", horoscope.id);

    return NextResponse.json(
        {
            horoscope,
            manualHousePlacements: result.manualHousePlacements,
            derivedRanges: result.derivedRanges,
        },
        { status: 201 },
    );
}
