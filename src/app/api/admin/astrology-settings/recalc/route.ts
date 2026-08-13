import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { getAstrologySettings } from "@/lib/astrologySettings";
import { connectDB } from "@/lib/db";
import logger from "@/lib/logger";
import { startRecalculation } from "@/lib/recalculationJob";

async function requireAdmin(): Promise<{ id: string } | { error: NextResponse }> {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        logger.warn("rejected astrology-settings/recalc request: unauthenticated");
        return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }
    if (session.user.role !== "super-admin") {
        logger.warn("rejected astrology-settings/recalc request: role=%s", session.user.role);
        return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
    return { id: session.user.id };
}

async function statusBody(): Promise<NextResponse> {
    const doc = await getAstrologySettings();
    return NextResponse.json({ recalcStatus: doc.recalcStatus ?? {} });
}

export async function GET() {
    const admin = await requireAdmin();
    if ("error" in admin) return admin.error;

    await connectDB();
    return statusBody();
}

export async function POST(req: NextRequest) {
    const admin = await requireAdmin();
    if ("error" in admin) return admin.error;

    await connectDB();

    let horoscopeIds: string[] | undefined;
    try {
        const body = await req.json();
        if (body && typeof body === "object" && !Array.isArray(body) && body.horoscopeIds !== undefined) {
            if (
                !Array.isArray(body.horoscopeIds) ||
                !body.horoscopeIds.every((id: unknown) => typeof id === "string")
            ) {
                return NextResponse.json({ error: "horoscopeIds must be an array of strings" }, { status: 400 });
            }
            horoscopeIds = body.horoscopeIds as string[];
        }
    } catch {
        // body-less POST → full (resumable) run
    }

    void startRecalculation(horoscopeIds ? { horoscopeIds } : undefined);
    return statusBody();
}
