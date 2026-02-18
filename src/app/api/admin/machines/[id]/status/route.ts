import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { UserRole } from "@/types";

// PATCH /api/admin/machines/[id]/status — Update machine status (admin only)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 });
  }

  const { id: machineId } = await params;
  const body = await req.json();
  const { status } = body;

  if (!status) {
    return NextResponse.json({ error: "Status is required" }, { status: 400 });
  }

  // Validate status value
  const validStatuses = ["ACTIVE", "IDLE", "MAINTENANCE", "SHUTDOWN"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
  }

  try {
    // Check if machine exists
    const machine = await prisma.machine.findUnique({
      where: { id: machineId },
    });

    if (!machine) {
      return NextResponse.json({ error: "Machine not found" }, { status: 404 });
    }

    // Check if machine has active session (can't shutdown if in use)
    if (status === "SHUTDOWN") {
      const activeSession = await prisma.machineSession.findFirst({
        where: { machineId, status: "ACTIVE" },
      });

      if (activeSession) {
        return NextResponse.json(
          { error: "Cannot shutdown machine while in use. Please end the active session first." },
          { status: 400 }
        );
      }
    }

    // Update machine status
    const updatedMachine = await prisma.machine.update({
      where: { id: machineId },
      data: { status },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE_MACHINE_STATUS",
        details: `Changed machine ${machine.name} status from ${machine.status} to ${status}`,
      },
    });

    return NextResponse.json({ data: updatedMachine });
  } catch (error: any) {
    console.error("Failed to update machine status:", error);
    return NextResponse.json({ error: error.message || "Update failed" }, { status: 500 });
  }
}
