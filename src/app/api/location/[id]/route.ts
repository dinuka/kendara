import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/db";
import { deleteLocation, getLocation, updateLocation, validateCoordinate } from "@/lib/location";
import logger from "@/lib/logger";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();

    try {
        const location = await getLocation(id, session.user.id, session.user.role);

        if (!location) {
            return NextResponse.json({ error: "Location not found" }, { status: 404 });
        }

        if (!location.isPublic && location.createdBy.id !== session.user.id && session.user.role !== "super-admin") {
            logger.warn("location access denied: %s by user %s", id, session.user.id);
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        return NextResponse.json(location);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        logger.error("location fetch failed: %s", message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();

    try {
        const body = await req.json();
        const errors: Record<string, string> = {};

        if (body.name !== undefined && (!body.name || !body.name.trim())) {
            errors.name = "Name is required";
        } else if (body.name && body.name.trim().length > 200) {
            errors.name = "Name must be 200 characters or fewer";
        }

        if (body.latitude !== undefined && body.latitude !== null) {
            const lat = parseFloat(body.latitude);
            if (isNaN(lat)) {
                errors.latitude = "Latitude must be a number";
            } else {
                const latResult = validateCoordinate(lat, body.longitude ?? 0);
                if (!latResult.valid) errors.latitude = latResult.error!;
            }
        }

        if (body.longitude !== undefined && body.longitude !== null) {
            const lon = parseFloat(body.longitude);
            if (isNaN(lon)) {
                errors.longitude = "Longitude must be a number";
            } else {
                const lonResult = validateCoordinate(body.latitude ?? 0, lon);
                if (!lonResult.valid) errors.longitude = lonResult.error!;
            }
        }

        if (Object.keys(errors).length > 0) {
            return NextResponse.json({ error: "Validation failed", fields: errors }, { status: 400 });
        }

        const updateData: Record<string, unknown> = {};
        if (body.name !== undefined) updateData.name = body.name;
        if (body.latitude !== undefined) updateData.latitude = parseFloat(body.latitude);
        if (body.longitude !== undefined) updateData.longitude = parseFloat(body.longitude);
        if (body.isPublic !== undefined) updateData.isPublic = body.isPublic;

        const updated = await updateLocation(
            id,
            updateData as { name?: string; latitude?: number; longitude?: number; isPublic?: boolean },
            session.user.id,
            session.user.role,
        );

        if (!updated) {
            const existing = await getLocation(id, session.user.id, session.user.role);
            if (!existing) {
                return NextResponse.json({ error: "Location not found" }, { status: 404 });
            }
            logger.warn("location edit denied: %s by user %s", id, session.user.id);
            return NextResponse.json({ error: "Only the creator can edit this location" }, { status: 403 });
        }

        return NextResponse.json(updated);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        logger.error("location update failed: %s", message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();

    try {
        const result = await deleteLocation(id, session.user.id, session.user.role);

        if (!result.success) {
            const status = result.error === "Location not found" ? 404 : 403;
            return NextResponse.json({ error: result.error }, { status });
        }

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        logger.error("location delete failed: %s", message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
