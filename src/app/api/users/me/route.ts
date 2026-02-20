import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/users/me — fetch own profile
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      accountId: true,
      name: true,
      email: true,
      role: true,
      department: true,
      position: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json({ data: user });
}

// PATCH /api/users/me — update own profile
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, department, position, currentPassword, newPassword } = body;

  // Validate at least one field provided
  if (!name && !department && !position && !newPassword) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  // If changing password, verify current password first
  if (newPassword) {
    if (!currentPassword) {
      return NextResponse.json({ error: "Current password is required to set a new password" }, { status: 400 });
    }
    const bcrypt = await import("bcryptjs");
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { password: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
    }
  }

  const bcrypt = newPassword ? await import("bcryptjs") : null;
  const hashedPassword = newPassword && bcrypt ? await bcrypt.hash(newPassword, 10) : undefined;

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ...(name && { name: name.trim() }),
      ...(department !== undefined && { department: department?.trim() || null }),
      ...(position !== undefined && { position: position?.trim() || null }),
      ...(hashedPassword && { password: hashedPassword }),
    },
    select: {
      id: true,
      accountId: true,
      name: true,
      email: true,
      role: true,
      department: true,
      position: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE_PROFILE",
      details: `User updated their own profile${newPassword ? " (including password)" : ""}`,
    },
  });

  return NextResponse.json({ data: updated });
}
