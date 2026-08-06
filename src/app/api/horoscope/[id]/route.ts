import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { CalculatedDetails } from "@/models/CalculatedDetails";
import { Chart } from "@/models/Chart";
import { Horoscope } from "@/models/Horoscope";
import { Metadata } from "@/models/Metadata";
import { User } from "@/models/User";

import { calculateHoroscope } from "@/lib/calculation";
import { getChartData, isLeanChartType, toBirthChartData } from "@/lib/chartDataTransform";
import { generateChartSvg } from "@/lib/chartRenderer";
import { ALL_CHART_TYPES } from "@/lib/chartTypes";
import { connectDB } from "@/lib/db";
import logger from "@/lib/logger";
import { deriveAgeRanges, navamsaIndexForSign } from "@/lib/manualChart";
import { getCurrentShani } from "@/lib/manualChartDetails";
import { getAnonymousPlaceholder } from "@/lib/privacy";

const CALC_FIELDS = ["birthDate", "birthTime", "latitude", "longitude", "ayanamsha"];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = session.user.id;
    const userRole = session.user.role;

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

    const accessibleFilter = { $or: [{ "owner.id": userId }, { isPublic: true }] };

    const sortBy = req.nextUrl.searchParams.get("sortBy") ?? "name";
    const sortDir = req.nextUrl.searchParams.get("sortDir") === "desc" ? -1 : 1;
    const locale = req.cookies.get("NEXT_LOCALE")?.value ?? "si";

    let sort: Record<string, 1 | -1>;
    let collation: { locale: string; strength: number } | undefined;

    switch (sortBy) {
        case "birthDate":
            sort = { birthDate: sortDir };
            break;
        case "locationName":
            sort = { locationName: sortDir };
            collation = { locale, strength: 2 };
            break;
        case "isPublic":
            sort = { isPublic: sortDir };
            break;
        default:
            sort = { name: sortDir };
            collation = { locale, strength: 2 };
    }

    let orderedQuery = Horoscope.find(accessibleFilter)
        .select({ _id: 1, name: 1, isPublic: 1, displayName: 1, "owner.id": 1 })
        .sort({ ...sort, createdAt: -1 });
    if (collation) orderedQuery = orderedQuery.collation(collation);
    const orderedHoroscopes = await orderedQuery.lean();

    const toNavItem = (h: (typeof orderedHoroscopes)[number] | undefined) => {
        if (!h) return null;
        let name = h.name;
        if (h.owner.id !== userId && userRole !== "super-admin" && !h.displayName) {
            name = getAnonymousPlaceholder(h._id.toString());
        }
        return { id: h._id.toString(), name };
    };

    const currentIndex = orderedHoroscopes.findIndex((h) => h._id.toString() === id);
    const navigation = {
        prev: toNavItem(orderedHoroscopes[currentIndex - 1]),
        next: toNavItem(orderedHoroscopes[currentIndex + 1]),
        position: currentIndex === -1 ? 1 : currentIndex + 1,
        total: orderedHoroscopes.length,
    };

    const calculatedDetails = await CalculatedDetails.findOne({ "horoscope.id": id }).lean();
    const charts = await Chart.find({ "horoscope.id": id }).lean();
    const metadata = await Metadata.find({ "horoscope.id": id }).lean();

    if (horoscope.source === "manual" && calculatedDetails?.planets) {
        const planets = calculatedDetails.planets as Array<{ name: number; sign: number; navamsaSign?: number }>;
        const shani = planets.find((p) => p.name === 7);
        const lagna = calculatedDetails.manualHousePlacements?.lagna ?? 1;
        const currentShani = getCurrentShani(lagna);

        if (shani && currentShani && calculatedDetails.derivedRanges) {
            const navamsaIndex = shani.navamsaSign
                ? navamsaIndexForSign(shani.sign, shani.navamsaSign)
                : 1;
            calculatedDetails.derivedRanges.ageRanges = deriveAgeRanges(
                navamsaIndex,
                currentShani.degree,
                currentShani.sign,
                shani.sign,
            );
        }
    }

    return NextResponse.json({ horoscope, calculatedDetails, charts, metadata, navigation });
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

    const isManual = (horoscope as any).source === "manual";
    if (isManual) {
        logger.info("manual horoscope update: skipping ephemeris recalculation id=%s", id);
    }

    if (body.location !== undefined) {
        if (body.location && typeof body.location === "object" && body.location.id) {
            body.location = { id: body.location.id };
        } else if (typeof body.location === "string") {
            body.locationName = body.location;
            body.location = null;
        }
    }

    const needsRecalc =
        !isManual &&
        CALC_FIELDS.some((f) => body[f] !== undefined && String(body[f]) !== String((horoscope as any)[f]));

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
                data: isLeanChartType(type) ? toBirthChartData(chartData) : chartData,
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
