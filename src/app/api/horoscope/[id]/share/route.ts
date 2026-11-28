import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

import { Horoscope } from "@/models/Horoscope";
import { ShareLink } from "@/models/ShareLink";

import { connectDB } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    await connectDB();
    const body = await req.json();

    const horoscope = await Horoscope.findById(id);
    if (!horoscope) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (horoscope.owner.id !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const expiresInHours = body.expiresInHours || 24;
    const link = await ShareLink.create({
        horoscope: { id },
        token: uuidv4(),
        expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
    });

    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/share/${link.token}`;
    return NextResponse.json({ token: link.token, url: shareUrl, expiresAt: link.expiresAt });
}
