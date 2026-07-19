import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { CalculatedDetails } from "@/models/CalculatedDetails";
import { Horoscope } from "@/models/Horoscope";

import { connectDB } from "@/lib/db";
import logger from "@/lib/logger";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    await connectDB();

    const horoscope = await Horoscope.findById(id).lean();
    if (!horoscope) return NextResponse.json({ error: "Horoscope not found" }, { status: 404 });

    if (horoscope.owner.id !== session.user.id && !horoscope.isPublic) {
        if (session.user.role !== "super-admin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
    }

    const calculatedDetails = await CalculatedDetails.findOne({ "horoscope.id": id }).lean();
    if (!calculatedDetails) return NextResponse.json({ error: "Horoscope not found" }, { status: 404 });

    const dashas = (calculatedDetails as any).dashas;
    if (!dashas) return NextResponse.json({ error: "Dasha data not available" }, { status: 404 });

    logger.info("returning dasha data for horoscope id=%s", id);

    return NextResponse.json(dashas);
}
