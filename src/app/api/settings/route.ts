import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { DEFAULT_ORBS, User } from "@/models/User";

import { connectDB } from "@/lib/db";

export async function GET() {
    const session = await getServerSession();
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
        planetaryOrbs: user.planetaryOrbs || DEFAULT_ORBS,
    });
}

export async function PUT(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { planetaryOrbs } = body;

    if (!planetaryOrbs || typeof planetaryOrbs !== "object") {
        return NextResponse.json({ error: "Invalid planetaryOrbs" }, { status: 400 });
    }

    for (const key of Object.keys(planetaryOrbs)) {
        const val = planetaryOrbs[key];
        if (typeof val !== "number" || val < 0 || val > 30 || !Number.isFinite(val)) {
            return NextResponse.json({ error: `Invalid orb value for planet ${key}: must be 0-30` }, { status: 400 });
        }
    }

    await connectDB();
    const user = await User.findOneAndUpdate({ email: session.user.email }, { $set: { planetaryOrbs } }, { new: true });

    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
        message: "Settings saved",
        planetaryOrbs: user.planetaryOrbs,
    });
}
