import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/users/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
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

// PATCH /api/users/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { name, role, department, position, isActive } = body;

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(role !== undefined && { role }),
      ...(department !== undefined && { department }),
      ...(position !== undefined && { position }),
      ...(isActive !== undefined && { isActive }),
    },
    select: {
      id: true,
      accountId: true,
      name: true,
      email: true,
      role: true,
      department: true,
      position: true,
      isActive: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE_USER",
      details: `Updated user ${user.name} (${user.email})`,
    },
  });

  return NextResponse.json({ data: user });
}

// DELETE /api/users/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;

  // Soft-delete
  const user = await prisma.user.update({
    where: { id },
    data: { isActive: false },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "DEACTIVATE_USER",
      details: `Deactivated user ${user.name} (${user.email})`,
    },
  });

  return NextResponse.json({ message: "User deactivated" });
}
