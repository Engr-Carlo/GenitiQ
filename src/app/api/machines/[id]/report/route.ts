import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { UserRole } from "@/types";

// POST /api/machines/[id]/report — Operator reports machine for shutdown
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session.user.role as UserRole, "REPORT_MACHINE_ISSUE")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: machineId } = await context.params;
  const { reason, requestShutdown } = await req.json();

  if (!reason || typeof reason !== "string") {
    return NextResponse.json({ error: "Reason is required" }, { status: 400 });
  }

  // Verify machine exists
  const machine = await prisma.machine.findUnique({ where: { id: machineId } });
  if (!machine) {
    return NextResponse.json({ error: "Machine not found" }, { status: 404 });
  }

  // Create machine report
  const report = await prisma.machineReport.create({
    data: {
      machineId,
      reportedById: session.user.id,
      reason,
      status: requestShutdown ? "Shutdown Requested" : "Pending",
    },
  });

  // If shutdown is requested, create shutdown event and update machine status
  if (requestShutdown) {
    await prisma.shutdownEvent.create({
      data: {
        machineId,
        initiatedById: session.user.id,
        reason,
      },
    });

    await prisma.machine.update({
      where: { id: machineId },
      data: { status: "SHUTDOWN" },
    });

    // If there's an active session, end it
    const activeSession = await prisma.machineSession.findFirst({
      where: { machineId, status: "ACTIVE" },
    });

    if (activeSession) {
      await prisma.machineSession.update({
        where: { id: activeSession.id },
        data: {
          status: "COMPLETED",
          endTime: new Date(),
          notes: activeSession.notes
            ? `${activeSession.notes}; Session ended due to machine shutdown request`
            : "Session ended due to machine shutdown request",
        },
      });

      await prisma.machine.update({
        where: { id: machineId },
        data: { currentSessionId: null },
      });
    }
  }

  // If shutdown requested, redistribute PENDING parts to other same-type machines
  let redistributedCount = 0;
  if (requestShutdown) {
    const pendingParts = await prisma.partReference.findMany({
      where: { machineId, status: "PENDING" },
    });

    if (pendingParts.length > 0) {
      const sameTypeMachines = await prisma.machine.findMany({
        where: {
          type: machine.type,
          id: { not: machineId },
          status: { notIn: ["SHUTDOWN", "MAINTENANCE"] },
        },
      });

      if (sameTypeMachines.length > 0) {
        const updates = pendingParts.map((part, idx) => {
          const targetMachine = sameTypeMachines[idx % sameTypeMachines.length];
          return prisma.partReference.update({
            where: { id: part.id },
            data: { machineId: targetMachine.id },
          });
        });
        await Promise.all(updates);
        redistributedCount = pendingParts.length;
      }
    }
  }

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: requestShutdown ? "REQUEST_MACHINE_SHUTDOWN" : "REPORT_MACHINE_ISSUE",
      details: `Reported issue for ${machine.name}: ${reason}${redistributedCount > 0 ? `. Redistributed ${redistributedCount} pending part(s) to other machines.` : ""}`,
    },
  });

  return NextResponse.json({
    success: true,
    report,
    redistributedCount,
    message: requestShutdown
      ? `Machine has been shut down and reported to admin${redistributedCount > 0 ? `. ${redistributedCount} pending part(s) redistributed.` : ""}`
      : "Issue reported successfully",
  });
}
