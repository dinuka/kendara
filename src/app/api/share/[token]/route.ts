import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { ShareLink } from "@/models/ShareLink";
import { Horoscope } from "@/models/Horoscope";
import { CalculatedDetails } from "@/models/CalculatedDetails";
import { Chart } from "@/models/Chart";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  await connectDB();

  const link = await ShareLink.findOne({ token });
  if (!link) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  if (new Date() > link.expiresAt) {
    return NextResponse.json({ error: "Link expired" }, { status: 410 });
  }

  const horoscope = await Horoscope.findById(link.horoscope.id).lean();
  if (!horoscope) return NextResponse.json({ error: "Horoscope not found" }, { status: 404 });

  const details = await CalculatedDetails.findOne({ "horoscope.id": link.horoscope.id }).lean();
  const charts = await Chart.find({ "horoscope.id": link.horoscope.id }).lean();

  return NextResponse.json({ horoscope, calculatedDetails: details, charts });
}
