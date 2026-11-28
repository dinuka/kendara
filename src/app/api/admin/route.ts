import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { Horoscope } from "@/models/Horoscope";
import { User } from "@/models/User";

import { connectDB } from "@/lib/db";

async function checkAdmin() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== "super-admin") {
        return null;
    }
    return session;
}

export async function GET(req: NextRequest) {
    const session = await checkAdmin();
    if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await connectDB();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    if (type === "users") {
        const users = await User.find().sort({ createdAt: -1 }).lean();
        return NextResponse.json(users);
    }

    const horoscopes = await Horoscope.find().sort({ createdAt: -1 }).lean();
    return NextResponse.json(horoscopes);
}

export async function PATCH(req: NextRequest) {
    const session = await checkAdmin();
    if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await connectDB();
    const body = await req.json();

    if (body.type === "user") {
        const user = await User.findById(body.userId);
        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
        if (body.role) user.role = body.role;
        await user.save();
        return NextResponse.json(user);
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}
