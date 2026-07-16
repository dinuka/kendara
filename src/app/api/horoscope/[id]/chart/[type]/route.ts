import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { Chart } from "@/models/Chart";

import { connectDB } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; type: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, type } = await params;
    await connectDB();

    const chart = await Chart.findOne({
        horoscope: { id },
        type: type as any,
    } as any).lean();
    if (!chart) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(chart);
}
