import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { applySettingsUpdate, getAstrologySettings } from "@/lib/astrologySettings";
import { connectDB } from "@/lib/db";
import logger from "@/lib/logger";
import type { RashiAspectsSetting } from "@/lib/rashiAspects";
import { startRecalculation } from "@/lib/recalculationJob";

/** Admin-only guard (D13): 401 when unauthenticated, 403 for any non-`super-admin` role. */
async function requireAdmin(): Promise<{ id: string; name?: string } | { error: NextResponse }> {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        logger.warn("rejected astrology-settings request: unauthenticated");
        return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }
    if (session.user.role !== "super-admin") {
        logger.warn("rejected astrology-settings request: role=%s", session.user.role);
        return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
    return { id: session.user.id, name: session.user.name ?? undefined };
}

/** Reflect the stored document — absent fields are omitted, never null/[]/{} placeholders (D2). */
function toResponseBody(doc: Awaited<ReturnType<typeof getAstrologySettings>>): Record<string, unknown> {
    const body: Record<string, unknown> = {
        planetaryOrbs: doc.planetaryOrbs,
        rashiAspects: doc.rashiAspects,
        version: doc.version,
        updatedAt: doc.updatedAt,
    };
    if (doc.planetAspects) body.planetAspects = doc.planetAspects;
    if (doc.updatedBy) body.updatedBy = doc.updatedBy;
    if (doc.lastRecalculatedAt) body.lastRecalculatedAt = doc.lastRecalculatedAt;
    if (doc.recalcStatus) body.recalcStatus = doc.recalcStatus;
    if (doc.auditLog) body.auditLog = doc.auditLog;
    if (doc.recalcHistory) body.recalcHistory = doc.recalcHistory;
    return body;
}

export async function GET() {
    const admin = await requireAdmin();
    if ("error" in admin) return admin.error;

    await connectDB();
    const doc = await getAstrologySettings();
    return NextResponse.json(toResponseBody(doc));
}

export async function PUT(req: NextRequest) {
    const admin = await requireAdmin();
    if ("error" in admin) return admin.error;

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

    const doc = await getAstrologySettings();
    const version = doc.version ?? 1;

    if (typeof b.version !== "number" || !Number.isInteger(b.version)) {
        return NextResponse.json({ error: "version is required" }, { status: 400 });
    }
    if (b.version !== version) {
        logger.warn("astrology-settings PUT rejected: stale version %d (current %d)", b.version, version);
        return NextResponse.json({ error: "Settings have changed. Refresh and retry." }, { status: 409 });
    }
    if (doc.recalcStatus?.status === "running") {
        logger.warn("astrology-settings PUT rejected: recalculation in progress");
        return NextResponse.json(
            { error: "A recalculation is in progress. Retry after it completes." },
            { status: 409 },
        );
    }

    try {
        const result = await applySettingsUpdate({
            version,
            changedBy: admin,
            ...(b.planetaryOrbs !== undefined ? { planetaryOrbs: b.planetaryOrbs as Record<string, number> } : {}),
            ...(b.planetAspects !== undefined
                ? { planetAspects: b.planetAspects as Record<string, { houses: number[]; degrees: number[] }> }
                : {}),
            ...(b.rashiAspects !== undefined ? { rashiAspects: b.rashiAspects as unknown as RashiAspectsSetting } : {}),
        });

        if (result.outcome === "no-op") {
            logger.info("astrology-settings PUT: no-op (values unchanged), version %d", version);
            return NextResponse.json({ noChange: true, ...toResponseBody(doc) });
        }
        if (result.outcome === "conflict") {
            const stale = result.reason === "stale";
            logger.warn("astrology-settings PUT rejected: %s", stale ? "stale version" : "recalculation running");
            return NextResponse.json(
                {
                    error: stale
                        ? "Settings have changed. Refresh and retry."
                        : "A recalculation is in progress. Retry after it completes.",
                },
                { status: 409 },
            );
        }

        void startRecalculation({ settingsVersion: result.newVersion });
        logger.info("astrology-settings PUT: updated to version %d, recalculation started", result.newVersion);
        return NextResponse.json({ recalcStarted: true, ...toResponseBody(result.doc) });
    } catch (err) {
        const message = (err as Error).message;
        logger.warn("astrology-settings PUT rejected: %s", message);
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
