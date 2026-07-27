import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { AuditLog } from "@/models/AuditLog";
import { Horoscope } from "@/models/Horoscope";

import { connectDB } from "@/lib/db";
import logger from "@/lib/logger";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (session.user.role === "super-admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    await connectDB();
    const body = await req.json();

    const horoscope = await Horoscope.findById(id);
    if (!horoscope) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (horoscope.owner.id !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const changes: Array<{
        field: string;
        oldValue: unknown;
        newValue: unknown;
    }> = [];

    if (body.isPublic !== undefined) {
        changes.push({
            field: "isPublic",
            oldValue: horoscope.isPublic,
            newValue: body.isPublic,
        });
        horoscope.isPublic = body.isPublic;
    }
    if (body.displayName !== undefined) {
        changes.push({
            field: "displayName",
            oldValue: horoscope.displayName,
            newValue: body.displayName,
        });
        horoscope.displayName = body.displayName;
    }

    await horoscope.save();

    await AuditLog.create({
        action: "privacy_change",
        actor: { id: session.user.id },
        target: { id, type: "horoscope" },
        details: changes.length > 0 ? changes : null,
        ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
        userAgent: req.headers.get("user-agent") || null,
    });

    logger.info("privacy changed for horoscope id=%s by user=%s", id, session.user.id);

    return NextResponse.json(horoscope);
}
