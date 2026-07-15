import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectDB } from "@/lib/db";
import { Metadata } from "@/models/Metadata";
import { Horoscope } from "@/models/Horoscope";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await connectDB();
  const metadata = await Metadata.find({
    "horoscope.id": id,
    $or: [{ isPublic: true }, { "createdBy.id": session.user.id }],
  }).lean();

  return NextResponse.json(metadata);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await connectDB();
  const body = await req.json();

  const metadata = await Metadata.create({
    horoscope: { id },
    key: body.key,
    value: body.value,
    isPublic: body.isPublic ?? false,
    createdBy: { id: session.user.id },
  });

  return NextResponse.json(metadata, { status: 201 });
}
