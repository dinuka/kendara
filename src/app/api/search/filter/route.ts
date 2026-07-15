import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectDB } from "@/lib/db";
import { SavedFilter } from "@/models/SavedFilter";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const filters = await SavedFilter.find({ "user.id": session.user.id }).sort({ createdAt: -1 }).lean();
  return NextResponse.json(filters);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const body = await req.json();

  const filter = await SavedFilter.create({
    user: { id: session.user.id },
    query: body.query,
    filterConfig: body.filterConfig || {},
  });

  return NextResponse.json(filter, { status: 201 });
}
