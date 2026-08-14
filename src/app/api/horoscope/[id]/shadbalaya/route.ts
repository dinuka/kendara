import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { CalculatedDetails } from "@/models/CalculatedDetails";
import { Horoscope } from "@/models/Horoscope";

import { connectDB } from "@/lib/db";
import logger from "@/lib/logger";
import { SHADBALAYA_KEYS, ShadBalayaKey } from "@/lib/shadBalaya";

interface ToggleBody {
    planet: number;
    bala: ShadBalayaKey;
    value: boolean;
}

/** Strict body validation (mirrors parseManualChartBody's manual style — no schema lib used in
 *  this repo). planet must be an integer 1-9, bala one of the six ShadBalaKeys, value a boolean. */
function parseToggleBody(body: unknown): { ok: true; value: ToggleBody } | { ok: false } {
    if (body === null || typeof body !== "object" || Array.isArray(body)) return { ok: false };
    const b = body as Record<string, unknown>;
    const { planet, bala, value } = b;
    if (typeof planet !== "number" || !Number.isInteger(planet) || planet < 1 || planet > 9) {
        return { ok: false };
    }
    if (typeof bala !== "string" || !SHADBALAYA_KEYS.includes(bala as ShadBalayaKey)) return { ok: false };
    if (typeof value !== "boolean") return { ok: false };
    return { ok: true, value: { planet, bala: bala as ShadBalayaKey, value } };
}

/** PATCH one Shad Bala toggle. Persists ONLY the dotted path `shadbalaya.<planet>.<bala>.*` plus
 *  `overridden: true` — no computation runs here; the page/recalc job merge the sparse stored
 *  record against the freshly-computed table (US-SB-008, US-SB-013). Super-admin may mutate any
 *  horoscope's Shad Bala (unlike the privacy route, which 403s admins). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    await connectDB();

    const horoscope = await Horoscope.findById(id);
    if (!horoscope) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (horoscope.owner.id !== session.user.id && session.user.role !== "super-admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const calculatedDetails = await CalculatedDetails.findOne({ "horoscope.id": id });
    if (!calculatedDetails) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const parsed = parseToggleBody(await req.json());
    if (!parsed.ok) {
        return NextResponse.json(
            {
                error: "Invalid body: planet must be an integer 1-9, bala one of the six Shad Bala keys, value a boolean",
            },
            { status: 400 },
        );
    }
    const { planet, bala, value } = parsed.value;

    const set: Record<string, unknown> = {
        [`shadbalaya.${planet}.${bala}.value`]: value,
        [`shadbalaya.${planet}.${bala}.overridden`]: true,
    };
    await CalculatedDetails.findOneAndUpdate({ "horoscope.id": id }, { $set: set });

    logger.info("shadbalaya toggle planet=%d bala=%s value=%s horoscopeId=%s", planet, bala, value, id);

    return NextResponse.json({ planet, bala, value, overridden: true });
}
