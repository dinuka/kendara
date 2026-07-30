import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { CalculatedDetails } from "@/models/CalculatedDetails";
import { Horoscope } from "@/models/Horoscope";

import { connectDB } from "@/lib/db";
import logger from "@/lib/logger";

interface CountByKey {
    id: number;
    count: number;
}

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        logger.warn("unauthorized horoscope stats attempt");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const visibleHoroscopeIds = await Horoscope.find({
        $or: [{ "owner.id": session.user.id }, { isPublic: true }],
    })
        .distinct("_id")
        .lean();

    const visibleIds = visibleHoroscopeIds.map((id) => id.toString());

    const [bySign, byNakshatra]: [CountByKey[], CountByKey[]] = await Promise.all([
        CalculatedDetails.aggregate([
            { $match: { "horoscope.id": { $in: visibleIds } } },
            { $group: { _id: "$ascendant.sign", count: { $sum: 1 } } },
            { $match: { _id: { $ne: null } } },
            { $sort: { count: -1 } },
            { $project: { _id: 0, id: "$_id", count: 1 } },
        ]),
        CalculatedDetails.aggregate([
            { $match: { "horoscope.id": { $in: visibleIds } } },
            { $group: { _id: "$nakshatra.moonNakshatra.id", count: { $sum: 1 } } },
            { $match: { _id: { $ne: null } } },
            { $sort: { count: -1 } },
            { $project: { _id: 0, id: "$_id", count: 1 } },
        ]),
    ]);

    logger.info(
        "horoscope stats computed for user %s: %d signs, %d nakshatras",
        session.user.id,
        bySign.length,
        byNakshatra.length,
    );

    return NextResponse.json({ bySign, byNakshatra });
}
