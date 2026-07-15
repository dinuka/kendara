import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "super-admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectDB();
  const users = await User.find().sort({ createdAt: -1 }).lean();
  return NextResponse.json(users);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "super-admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectDB();
  const body = await req.json();
  const user = await User.findById(body.id);

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (body.role) user.role = body.role;
  await user.save();

  return NextResponse.json(user);
}
