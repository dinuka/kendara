import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { Horoscope } from "@/models/Horoscope";

import { connectDB } from "@/lib/db";
import logger from "@/lib/logger";
import { revalidateHoroscope } from "@/lib/revalidate";
import { isObjectId, parseSeoInput } from "@/lib/seo";

const EMPTY_SEO = { aliases: [], indexed: true };

const requireSuperAdmin = async (): Promise<NextResponse | null> => {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "super-admin") {
        logger.warn("rejected horoscope seo request: role=%s", session.user.role);
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return null;
};

/** GET /api/admin/horoscope/[id]/seo — the horoscope's search-engine data. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const denied = await requireSuperAdmin();
    if (denied) return denied;

    const { id } = await params;
    if (!isObjectId(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await connectDB();

    const horoscope = await Horoscope.findById(id).select({ seo: 1, isPublic: 1 }).lean();
    if (!horoscope) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ seo: horoscope.seo ?? EMPTY_SEO, isPublic: horoscope.isPublic });
}

/** PUT /api/admin/horoscope/[id]/seo — replaces title, description, aliases and the index flag. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const denied = await requireSuperAdmin();
    if (denied) return denied;

    const { id } = await params;
    if (!isObjectId(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
    }
    const parsed = parseSeoInput(body);
    if (!parsed.ok) return NextResponse.json({ error: "invalid", errors: parsed.errors }, { status: 400 });

    await connectDB();

    const taken = await Horoscope.find({ _id: { $ne: id }, "seo.aliases": { $in: parsed.seo.aliases } })
        .select({ "seo.aliases": 1 })
        .lean();
    if (taken.length > 0) {
        const conflicts = parsed.seo.aliases.filter((a) => taken.some((h) => h.seo?.aliases?.includes(a)));
        return NextResponse.json({ error: "alias_taken", aliases: conflicts }, { status: 409 });
    }

    const horoscope = await Horoscope.findByIdAndUpdate(id, { $set: { seo: parsed.seo } }, { new: true })
        .select({ seo: 1, isPublic: 1 })
        .lean();
    if (!horoscope) return NextResponse.json({ error: "Not found" }, { status: 404 });

    logger.info("seo updated for horoscope id=%s aliases=%d", id, parsed.seo.aliases.length);
    revalidateHoroscope(id);
    return NextResponse.json({ seo: horoscope.seo, isPublic: horoscope.isPublic });
}
