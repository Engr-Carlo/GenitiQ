import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// POST /api/machines/[id]/checkin — Operator checks out of a machine (ends session)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: machineId } = await params;

  // Find active session for this operator + machine
  const activeSession = await prisma.machineSession.findFirst({
    where: {
      machineId,
      operatorId: session.user.id,
      status: "ACTIVE",
    },
    include: {
      machine: { select: { name: true, type: true } },
      inspections: { where: { result: { not: undefined } } },
    },
  });

  if (!activeSession) {
    return NextResponse.json({ error: "No active session found for this machine" }, { status: 404 });
  }

  const endTime = new Date();
  const durationMs = endTime.getTime() - activeSession.startTime.getTime();
  const durationMinutes = Math.round(durationMs / 60000);
  const itemsCompleted = activeSession.inspections.length;

  // End the session
  const completedSession = await prisma.machineSession.update({
    where: { id: activeSession.id },
    data: {
      endTime,
      status: "COMPLETED",
      itemsCompleted,
    },
  });

  // Clear machine's current session
  await prisma.machine.update({
    where: { id: machineId },
    data: { currentSessionId: null, status: "IDLE" },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "MACHINE_CHECKIN",
      details: `Checked out of ${activeSession.machine.name} — Session: ${durationMinutes} min, ${itemsCompleted} items completed`,
    },
  });

  return NextResponse.json({
    data: {
      session: completedSession,
      summary: {
        duration: durationMinutes,
        itemsCompleted,
        machineName: activeSession.machine.name,
      },
    },
    message: `Checked out of ${activeSession.machine.name}`,
  });
}
