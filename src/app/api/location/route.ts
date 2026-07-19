import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/db";
import { createLocation, listLocations, validateCoordinate } from "@/lib/location";
import logger from "@/lib/logger";

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const search = searchParams.get("search") || undefined;

    await connectDB();

    try {
        const result = await listLocations(session.user.id, session.user.role, page, limit, search);
        return NextResponse.json(result);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        logger.error("location list failed: %s", message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    try {
        const body = await req.json();
        const errors: Record<string, string> = {};

        if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
            errors.name = "Name is required";
        } else if (body.name.trim().length > 200) {
            errors.name = "Name must be 200 characters or fewer";
        }

        const lat = parseFloat(body.latitude);
        const lon = parseFloat(body.longitude);

        if (body.latitude === undefined || body.latitude === null || isNaN(lat)) {
            errors.latitude = "Latitude is required";
        } else {
            const latResult = validateCoordinate(lat, lon);
            if (!latResult.valid) {
                errors.latitude = latResult.error!;
            }
        }

        if (body.longitude === undefined || body.longitude === null || isNaN(lon)) {
            errors.longitude = "Longitude is required";
        } else {
            const lonResult = validateCoordinate(lat, lon);
            if (!lonResult.valid) {
                errors.longitude = lonResult.error!;
            }
        }

        if (Object.keys(errors).length > 0) {
            return NextResponse.json({ error: "Validation failed", fields: errors }, { status: 400 });
        }

        const location = await createLocation(
            {
                name: body.name.trim(),
                latitude: lat,
                longitude: lon,
                isPublic: body.isPublic ?? false,
            },
            session.user.id,
        );

        return NextResponse.json(location, { status: 201 });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        logger.error("location save failed: %s", message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
