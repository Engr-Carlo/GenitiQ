import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { UserRole } from "@/types";

// POST /api/admin/machines/assign-inspector — Assign inspector to a machine
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session.user.role as UserRole, "MANAGE_ACCESS")) {
    return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { machineId, inspectorId } = body;

    if (!machineId) {
      return NextResponse.json({ error: "machineId is required" }, { status: 400 });
    }

    // Validate machine exists
    const machine = await prisma.machine.findUnique({
      where: { id: machineId },
    });

    if (!machine) {
      return NextResponse.json({ error: "Machine not found" }, { status: 404 });
    }

    // If inspectorId is provided, validate it
    if (inspectorId) {
      const inspector = await prisma.user.findUnique({
        where: { id: inspectorId },
        select: { id: true, role: true, name: true },
      });

      if (!inspector) {
        return NextResponse.json({ error: "Inspector not found" }, { status: 404 });
      }

      if (inspector.role !== "INSPECTOR") {
        return NextResponse.json({ error: "User is not an inspector" }, { status: 400 });
      }
    }

    // Update machine with assigned inspector (or null to unassign)
    const updatedMachine = await prisma.machine.update({
      where: { id: machineId },
      data: {
        assignedInspectorId: inspectorId || null,
      } as any,
      include: {
        assignedInspector: {
          select: { id: true, name: true, email: true, role: true },
        },
      } as any,
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: inspectorId ? "ASSIGN_INSPECTOR_TO_MACHINE" : "UNASSIGN_INSPECTOR_FROM_MACHINE",
        details: `${inspectorId ? "Assigned" : "Unassigned"} inspector ${inspectorId ? `(ID: ${inspectorId})` : ""} ${inspectorId ? "to" : "from"} machine ${machine.name}`,
      },
    });

    return NextResponse.json({
      success: true,
      message: inspectorId 
        ? `Inspector assigned to ${machine.name}` 
        : `Inspector unassigned from ${machine.name}`,
      machine: updatedMachine,
    });
  } catch (error: any) {
    console.error("Failed to assign inspector:", error);
    return NextResponse.json({ error: error.message || "Assignment failed" }, { status: 500 });
  }
}

// GET /api/admin/machines/assign-inspector — Get all machines with their assigned inspectors
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session.user.role as UserRole, "MANAGE_ACCESS")) {
    return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 });
  }

  try {
    const machines = await prisma.machine.findMany({
      include: {
        assignedInspector: {
          select: { id: true, name: true, email: true, role: true },
        },
      } as any,
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ data: machines });
  } catch (error: any) {
    console.error("Failed to fetch machines:", error);
    return NextResponse.json({ error: error.message || "Fetch failed" }, { status: 500 });
  }
}
