import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { SavedFilter } from "@/models/SavedFilter";

import { connectDB } from "@/lib/db";
import logger from "@/lib/logger";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();
    const body = await req.json();

    const filter = await SavedFilter.findById(id);
    if (!filter) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (filter.user.id !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (body.name !== undefined) filter.name = body.name;
    if (body.query !== undefined) filter.query = body.query;
    if (body.filterConfig !== undefined) filter.filterConfig = body.filterConfig;

    await filter.save();

    logger.info("saved filter updated id=%s user=%s", id, session.user.id);

    return NextResponse.json(filter);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();

    const filter = await SavedFilter.findById(id);
    if (!filter) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (filter.user.id !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await SavedFilter.deleteOne({ _id: id });

    logger.info("saved filter deleted id=%s user=%s", id, session.user.id);

    return NextResponse.json({ success: true });
}
