import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { Horoscope } from "@/models/Horoscope";
import { Metadata } from "@/models/Metadata";

import { connectDB } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    await connectDB();
    const metadata = await Metadata.find({
        "horoscope.id": id,
        $or: [{ isPublic: true }, { "createdBy.id": session.user.id }],
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

    return NextResponse.json(metadata, { status: 201 });
}
