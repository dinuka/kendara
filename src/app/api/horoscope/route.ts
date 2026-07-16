import { connectDB } from "@/lib/db";
import { Horoscope } from "@/models/Horoscope";
import { CalculatedDetails } from "@/models/CalculatedDetails";
import { Chart } from "@/models/Chart";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextRequest, NextResponse } from "next/server";
import { calculateHoroscope } from "@/lib/calculation";
import { ALL_CHART_TYPES } from "@/lib/chartTypes";
import { generateChartSvg } from "@/lib/chartRenderer";
import logger from "@/lib/logger";

export async function GET(req: NextRequest) {
  logger.info("fetching horoscopes");
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    logger.warn("unauthorized horoscope GET attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const { searchParams } = new URL(req.url);
  const publicOnly = searchParams.get("public") === "true";

  const filter = publicOnly
    ? { isPublic: true }
    : { $or: [{ "owner.id": session.user.id }, { isPublic: true }] };

  const horoscopes = await Horoscope.find(filter)
    .sort({ createdAt: -1 })
    .lean();

  logger.info("found %d horoscopes for user %s", horoscopes.length, session.user.id);
  return NextResponse.json(horoscopes);
}

export async function POST(req: NextRequest) {
  logger.info("creating horoscope");
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    logger.warn("unauthorized horoscope POST attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const body = await req.json();
  logger.info("received birth data: name=%s date=%s time=%s", body.name, body.birthDate, body.birthTime);

  const horoscope = await Horoscope.create({
    owner: { id: session.user.id },
    name: body.name,
    displayName: body.displayName ?? true,
    birthDate: new Date(body.birthDate),
    birthTime: body.birthTime,
    location: body.location || "",
    latitude: body.latitude || 0,
    longitude: body.longitude || 0,
    gender: body.gender,
    ayanamsha: body.ayanamsha || "lahiri",
    isPublic: body.isPublic ?? false,
  });
  logger.info("horoscope saved: id=%s", horoscope.id);

  logger.info("running astrological calculation...");
  const calculated = calculateHoroscope(horoscope);

  logger.info("saving calculated details...");
  await CalculatedDetails.create({
    horoscope: { id: horoscope.id },
    ...calculated,
  });

  logger.info("saving %d chart records...", ALL_CHART_TYPES.length);

  const chartInput = {
    houses: calculated.houses,
    planets: calculated.planets,
    ascendant: calculated.ascendant
  };

  const chartDocs = ALL_CHART_TYPES.map((type) => ({
    horoscope: { id: horoscope.id },
    type,
    data: chartInput,
    imageKey: "",
    svgData: generateChartSvg(
      { planets: calculated.planets, houses: calculated.houses, ascendant: calculated.ascendant },
      type,
    ),
  }));

  await Chart.insertMany(chartDocs);
  logger.info("horoscope creation complete: id=%s", horoscope.id);

  return NextResponse.json(horoscope, { status: 201 });
}
