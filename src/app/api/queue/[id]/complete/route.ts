import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { runGAOptimization, shouldReoptimize } from "@/lib/ga";

// PATCH /api/queue/[id]/complete — Operator completes inspection on queue item
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: queueItemId } = await params;
  const body = await req.json();
  const { result, measurements, notes } = body;

  if (!result || !["ACCEPTED", "REJECTED"].includes(result)) {
    return NextResponse.json({ error: "Result must be ACCEPTED or REJECTED" }, { status: 400 });
  }

  // Get queue item
  const queueItem = await prisma.inspectionQueue.findUnique({
    where: { id: queueItemId },
    include: { part: true, machine: true },
  });

  if (!queueItem) return NextResponse.json({ error: "Queue item not found" }, { status: 404 });
  if (queueItem.status !== "IN_PROGRESS") {
    return NextResponse.json({ error: "Item must be IN_PROGRESS to complete" }, { status: 400 });
  }

  const now = new Date();
  const startedAt = queueItem.queueStartedAt || now;
  const actualTimeMs = now.getTime() - startedAt.getTime();
  const actualTimeMinutes = Math.round(actualTimeMs / 60000);

  // 1. Complete the queue item
  const completedItem = await prisma.inspectionQueue.update({
    where: { id: queueItemId },
    data: {
      status: "COMPLETED",
      queueCompletedAt: now,
      queueActualTime: actualTimeMinutes,
    },
  });

  // 2. Create inspection record (operator's first-line inspection)
  const inspection = await prisma.inspection.create({
    data: {
      partId: queueItem.partId,
      machineId: queueItem.machineId,
      inspectorId: session.user.id,
      result,
      measurements: measurements || null,
      notes: notes || null,
      operatorStartedAt: queueItem.queueStartedAt,
      operatorCompletedAt: now,
      operatorActualTime: actualTimeMinutes,
      scannedBarcode: queueItem.scannedBarcode,
      machineSessionId: queueItem.machineSessionId,
    },
    include: {
      part: true,
      machine: { select: { id: true, name: true, type: true } },
    },
  });

  // 3. Update part status — goes to FOR_REVIEW so inspector can double check
  await prisma.part.update({
    where: { id: queueItem.partId },
    data: {
      status: "FOR_REVIEW",
      currentMachineId: queueItem.machineId,
    },
  });

  // 4. Update session items count
  if (queueItem.machineSessionId) {
    await prisma.machineSession.update({
      where: { id: queueItem.machineSessionId },
      data: { itemsCompleted: { increment: 1 } },
    });
  }

  // 5. Create audit log
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "OPERATOR_INSPECTION",
      details: `Operator inspection for ${queueItem.part.partNumber} on ${queueItem.machine.name}: ${result} (${actualTimeMinutes} min)`,
    },
  });

  // 6. Trigger GA re-optimization if needed
  const machineType = queueItem.machine.type as "VMM" | "CMM";
  if (await shouldReoptimize(machineType)) {
    runGAOptimization(machineType).catch(console.error);
  }

  return NextResponse.json({
    data: {
      queueItem: completedItem,
      inspection,
      timing: {
        startedAt: queueItem.queueStartedAt,
        completedAt: now,
        actualTimeMinutes,
        estimatedTime: queueItem.estimatedTime,
      },
    },
    message: `Inspection completed for ${queueItem.part.partNumber}: ${result}`,
  });
}
