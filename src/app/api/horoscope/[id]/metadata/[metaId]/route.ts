import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectDB } from "@/lib/db";
import { Metadata } from "@/models/Metadata";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; metaId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, metaId } = await params;
  await connectDB();
  const body = await req.json();

  const metadata = await Metadata.findById(metaId);
  if (!metadata) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (metadata.createdBy.id !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (body.key !== undefined) metadata.key = body.key;
  if (body.value !== undefined) metadata.value = body.value;
  if (body.isPublic !== undefined) metadata.isPublic = body.isPublic;
  await metadata.save();

  return NextResponse.json(metadata);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; metaId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, metaId } = await params;
  await connectDB();

  const metadata = await Metadata.findById(metaId);
  if (!metadata) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (metadata.createdBy.id !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await Metadata.deleteOne({ _id: metaId });
  return NextResponse.json({ success: true });
}
