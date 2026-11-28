import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { Horoscope } from "@/models/Horoscope";
import { Metadata } from "@/models/Metadata";

import { connectDB } from "@/lib/db";
import { revalidateHoroscope } from "@/lib/revalidate";
import { canViewHoroscope } from "@/lib/privacy";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);

    const { id } = await params;
    await connectDB();

    const horoscope = await Horoscope.findById(id).lean();
    if (!horoscope) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!canViewHoroscope(horoscope, session?.user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const userId = session?.user?.id;
    const metadata = await Metadata.find({
        "horoscope.id": id,
        ...(userId ? { $or: [{ isPublic: true }, { "createdBy.id": userId }] } : { isPublic: true }),
    }).lean();

    return NextResponse.json(metadata);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    await connectDB();
    const body = await req.json();

    const metadata = await Metadata.create({
        horoscope: { id },
        key: body.key,
        value: body.value,
        isPublic: body.isPublic ?? false,
        createdBy: { id: session.user.id },
    });

    revalidateHoroscope(id);
    return NextResponse.json(metadata, { status: 201 });
}
