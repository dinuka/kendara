import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { CalculatedDetails } from "@/models/CalculatedDetails";
import { Horoscope } from "@/models/Horoscope";
import { HoroscopeNote } from "@/models/HoroscopeNote";
import { Metadata } from "@/models/Metadata";

import { deleteCharts } from "@/lib/chartStorage";
import { connectDB } from "@/lib/db";
import { revalidateHoroscope } from "@/lib/revalidate";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== "super-admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    await connectDB();
    const body = await req.json();

    const horoscope = await Horoscope.findById(id);
    if (!horoscope) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // SEO data has its own validated route (./seo)
    delete body.seo;
    Object.assign(horoscope, body);
    await horoscope.save();

    revalidateHoroscope(id);
    return NextResponse.json(horoscope);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== "super-admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    await connectDB();

    const horoscope = await Horoscope.findById(id);
    if (!horoscope) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (!horoscope.isPublic) {
        return NextResponse.json({ error: "Cannot delete private horoscope" }, { status: 403 });
    }

    await Horoscope.deleteOne({ _id: id });
    await CalculatedDetails.deleteOne({ "horoscope.id": id });
    await deleteCharts(id);
    await Metadata.deleteMany({ "horoscope.id": id });
    await HoroscopeNote.deleteMany({ "horoscope.id": id });

    revalidateHoroscope(id);
    return NextResponse.json({ success: true });
}
