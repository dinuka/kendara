import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { CalculatedDetails } from "@/models/CalculatedDetails";
import { Chart } from "@/models/Chart";
import { Horoscope } from "@/models/Horoscope";
import { Metadata } from "@/models/Metadata";

import { calculateHoroscope } from "@/lib/calculation";
import { generateChartSvg } from "@/lib/chartRenderer";
import { ALL_CHART_TYPES } from "@/lib/chartTypes";
import { connectDB } from "@/lib/db";
import logger from "@/lib/logger";

const CALC_FIELDS = ["birthDate", "birthTime", "latitude", "longitude", "ayanamsha"];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    await connectDB();

    const horoscope = await Horoscope.findById(id).lean();
    if (!horoscope) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (horoscope.owner.id !== session.user.id && !horoscope.isPublic) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const calculatedDetails = await CalculatedDetails.findOne({ "horoscope.id": id }).lean();
    const charts = await Chart.find({ "horoscope.id": id }).lean();
    const metadata = await Metadata.find({ "horoscope.id": id }).lean();

    return NextResponse.json({ horoscope, calculatedDetails, charts, metadata });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    await connectDB();
    const body = await req.json();

    const horoscope = await Horoscope.findById(id);
    if (!horoscope) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (horoscope.owner.id !== session.user.id && session.user.role !== "super-admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const needsRecalc = CALC_FIELDS.some(
        (f) => body[f] !== undefined && String(body[f]) !== String((horoscope as any)[f]),
    );

    Object.assign(horoscope, body);
    await horoscope.save();

    if (needsRecalc) {
        logger.info("calculation fields changed, recalculating horoscope id=%s", id);
        const calculated = calculateHoroscope(horoscope);

        await CalculatedDetails.findOneAndUpdate({ "horoscope.id": id }, { ...calculated }, { upsert: true });

        await Chart.deleteMany({ "horoscope.id": id });

        const chartInput = {
            houses: calculated.houses,
            planets: calculated.planets,
            ascendant: calculated.ascendant,
        } as const;

        const chartDocs = ALL_CHART_TYPES.map((type) => ({
            horoscope: { id },
            type,
            data: chartInput,
            imageKey: "",
            svgData: generateChartSvg(
                { planets: calculated.planets, houses: calculated.houses, ascendant: calculated.ascendant },
                type,
            ),
        }));

        await Chart.insertMany(chartDocs);
        logger.info("recalculation complete for horoscope id=%s", id);
    } else {
        logger.info("no calculation fields changed, skipping recalculation for id=%s", id);
    }

    return NextResponse.json(horoscope);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    await connectDB();

    const horoscope = await Horoscope.findById(id);
    if (!horoscope) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (horoscope.owner.id !== session.user.id && session.user.role !== "super-admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (session.user.role !== "super-admin" && !horoscope.isPublic) {
        await Horoscope.deleteOne({ _id: id });
    } else if (session.user.role === "super-admin") {
        await Horoscope.deleteOne({ _id: id });
    }

    await CalculatedDetails.deleteOne({ "horoscope.id": id });
    await Chart.deleteMany({ "horoscope.id": id });
    await Metadata.deleteMany({ "horoscope.id": id });

    return NextResponse.json({ success: true });
}
