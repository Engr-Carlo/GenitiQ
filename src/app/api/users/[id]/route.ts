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

  // Prevent self-deletion
  if (id === session.user.id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Prevent deleting admin accounts
    if (user.role === "ADMIN") {
      return NextResponse.json({ error: "Cannot delete admin accounts" }, { status: 400 });
    }

    // End any active machine sessions
    await prisma.machineSession.updateMany({
      where: { operatorId: id, status: "ACTIVE" },
      data: { status: "COMPLETED", endTime: new Date() },
    });

    // Clear machine currentSessionId and inspector assignment for this user
    await prisma.machine.updateMany({
      where: { assignedInspectorId: id },
      data: { assignedInspectorId: null },
    });

    // Disconnect from PartReferences (set nullable FKs to null)
    await prisma.partReference.updateMany({
      where: { operatorId: id },
      data: { operatorId: null },
    });
    await prisma.partReference.updateMany({
      where: { qaReviewerId: id },
      data: { qaReviewerId: null },
    });
    await prisma.partReference.updateMany({
      where: { inspectorId: id },
      data: { inspectorId: null },
    });
    // Re-assign uploaded parts to the admin so FK is not orphaned
    await prisma.partReference.updateMany({
      where: { uploadedById: id },
      data: { uploadedById: session.user.id },
    });

    // Delete user's own audit logs, machine reports, shutdown events
    await prisma.auditLog.deleteMany({ where: { userId: id } });
    await prisma.machineReport.deleteMany({ where: { reportedById: id } });
    await prisma.shutdownEvent.deleteMany({ where: { initiatedById: id } });
    await prisma.machineSession.deleteMany({ where: { operatorId: id } });

    // Hard delete the user
    await prisma.user.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE_USER",
        details: `Permanently deleted user ${user.name} (${user.email})`,
      },
    });

    return NextResponse.json({ message: "User deleted permanently" });
  } catch (error: unknown) {
    console.error("Failed to delete user:", error);
    const msg = error instanceof Error ? error.message : "Failed to delete user";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
