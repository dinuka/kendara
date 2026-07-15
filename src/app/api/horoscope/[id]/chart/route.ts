import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectDB } from "@/lib/db";
import { Horoscope } from "@/models/Horoscope";
import { Chart } from "@/models/Chart";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await connectDB();

  const horoscope = await Horoscope.findById(id);
  if (!horoscope) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (horoscope.owner.id !== session.user.id && !horoscope.isPublic) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const charts = await Chart.find({ "horoscope.id": id }).lean();
  return NextResponse.json(charts);
}
