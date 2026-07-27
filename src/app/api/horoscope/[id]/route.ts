import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { CalculatedDetails } from "@/models/CalculatedDetails";
import { Chart } from "@/models/Chart";
import { Horoscope } from "@/models/Horoscope";
import { Metadata } from "@/models/Metadata";
import { User } from "@/models/User";

import { calculateHoroscope } from "@/lib/calculation";
import { getChartData } from "@/lib/chartDataTransform";
import { generateChartSvg } from "@/lib/chartRenderer";
import { ALL_CHART_TYPES } from "@/lib/chartTypes";
import { connectDB } from "@/lib/db";
import logger from "@/lib/logger";
import { getAnonymousPlaceholder } from "@/lib/privacy";

const CALC_FIELDS = ["birthDate", "birthTime", "latitude", "longitude", "ayanamsha"];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    await connectDB();

    const horoscope = await Horoscope.findById(id).lean();
    if (!horoscope) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (horoscope.owner.id !== session.user.id && !horoscope.isPublic && session.user.role !== "super-admin") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (horoscope.owner.id !== session.user.id && session.user.role !== "super-admin" && !horoscope.displayName) {
        horoscope.name = getAnonymousPlaceholder(horoscope._id.toString());
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

    if (body.location !== undefined) {
        if (body.location && typeof body.location === "object" && body.location.id) {
            body.location = { id: body.location.id };
        } else if (typeof body.location === "string") {
            body.locationName = body.location;
            body.location = null;
        }
    }

    const needsRecalc = CALC_FIELDS.some(
        (f) => body[f] !== undefined && String(body[f]) !== String((horoscope as any)[f]),
    );

    Object.assign(horoscope, body);
    await horoscope.save();

    if (needsRecalc) {
        logger.info("calculation fields changed, recalculating horoscope id=%s", id);
        const user = await User.findOne({
            googleId: session.user.id,
        }).lean();
        const planetaryOrbs = (user?.planetaryOrbs ?? {}) as Record<string, number>;
        const calculated = calculateHoroscope(horoscope, planetaryOrbs);

        await CalculatedDetails.findOneAndUpdate({ "horoscope.id": id }, { ...calculated }, { upsert: true });

        await Chart.deleteMany({ "horoscope.id": id });

        const chartDocs = ALL_CHART_TYPES.map((type) => {
            const chartData = getChartData(calculated, type);
            return {
                horoscope: { id },
                type,
                data: chartData,
                imageKey: "",
                svgData: generateChartSvg(chartData, type),
            };
        });

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
