import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// POST /api/machines/[id]/checkout — Operator or Inspector checks into a machine
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "OPERATOR" && session.user.role !== "INSPECTOR") {
    return NextResponse.json({ error: "Only operators and inspectors can checkout machines" }, { status: 403 });
  }

  const { id: machineId } = await params;

  // 1. Check if machine exists and is available
  const machine = await prisma.machine.findUnique({ where: { id: machineId } });
  if (!machine) return NextResponse.json({ error: "Machine not found" }, { status: 404 });
  if (machine.status === "SHUTDOWN" || machine.status === "MAINTENANCE") {
    return NextResponse.json({ error: `Machine is ${machine.status.toLowerCase()} and cannot be used` }, { status: 400 });
  }

  // 2. Check if machine already has an active session
  const existingMachineSession = await prisma.machineSession.findFirst({
    where: { machineId, status: "ACTIVE" },
    include: { operator: { select: { name: true } } },
  });
  if (existingMachineSession) {
    return NextResponse.json(
      { error: `Machine is already in use by ${existingMachineSession.operator.name}` },
      { status: 409 }
    );
  }

  // 3. Check if user already has an active session on another machine
  const existingUserSession = await prisma.machineSession.findFirst({
    where: { operatorId: session.user.id, status: "ACTIVE" },
    include: { machine: { select: { name: true } } },
  });
  if (existingUserSession) {
    return NextResponse.json(
      { error: `You are already checked into ${existingUserSession.machine.name}. Please check out first.` },
      { status: 409 }
    );
  }

  // 4. Create session and update machine
  const machineSession = await prisma.machineSession.create({
    data: {
      machineId,
      operatorId: session.user.id,
      status: "ACTIVE",
    },
    include: {
      machine: { select: { id: true, name: true, type: true, status: true, location: true } },
      operator: { select: { id: true, name: true } },
    },
  });

  // Update machine to track current session
  await prisma.machine.update({
    where: { id: machineId },
    data: { currentSessionId: machineSession.id, status: "ACTIVE" },
  });

  // Fetch next queue item for this machine
  const nextQueueItem = await prisma.inspectionQueue.findFirst({
    where: { machineId, status: "WAITING" },
    include: { part: true },
    orderBy: { position: "asc" },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "MACHINE_CHECKOUT",
      details: `Checked into ${machine.name} (${machine.type})`,
    },
  });

  return NextResponse.json({
    data: {
      session: machineSession,
      nextQueueItem,
    },
    message: `Checked into ${machine.name}`,
  });
}
