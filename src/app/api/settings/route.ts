import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { getCalculationSettings } from "@/lib/astrologySettings";
import { connectDB } from "@/lib/db";
import logger from "@/lib/logger";

export async function GET() {
    const session = await getServerSession();
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const { planetaryOrbs, planetAspects, rashiAspects } = await getCalculationSettings();

    // Values only — admin metadata (version/updatedBy/recalcStatus/audit) is never exposed (D12).
    return NextResponse.json({ planetaryOrbs, planetAspects, rashiAspects });
}

export async function PUT() {
    const session = await getServerSession();
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // US-SAS-008 AC3: the three settings are system-wide; students can no longer write them.
    logger.warn("rejected settings PUT: managed-by-admin (user %s)", session.user.email);
    return NextResponse.json({ error: "System settings are managed by the administrator." }, { status: 403 });
}
