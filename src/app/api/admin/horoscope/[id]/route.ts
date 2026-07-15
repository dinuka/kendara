import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectDB } from "@/lib/db";
import { Horoscope } from "@/models/Horoscope";
import { CalculatedDetails } from "@/models/CalculatedDetails";
import { Chart } from "@/models/Chart";
import { Metadata } from "@/models/Metadata";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "super-admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await connectDB();
  const body = await req.json();

  const horoscope = await Horoscope.findById(id);
  if (!horoscope) return NextResponse.json({ error: "Not found" }, { status: 404 });

  Object.assign(horoscope, body);
  await horoscope.save();

  return NextResponse.json(horoscope);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
  await Chart.deleteMany({ "horoscope.id": id });
  await Metadata.deleteMany({ "horoscope.id": id });

  return NextResponse.json({ success: true });
}
