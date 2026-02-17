import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// PATCH /api/queue/[id]/start — Mark queue item as IN_PROGRESS (operator starts working)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: queueItemId } = await params;

  // Get queue item
  const queueItem = await prisma.inspectionQueue.findUnique({
    where: { id: queueItemId },
    include: { part: true, machine: true },
  });

  if (!queueItem) return NextResponse.json({ error: "Queue item not found" }, { status: 404 });
  if (queueItem.status !== "WAITING") {
    return NextResponse.json({ error: `Item is already ${queueItem.status}` }, { status: 400 });
  }

  // Verify barcode was scanned first
  if (!queueItem.scannedAt) {
    return NextResponse.json({ error: "Part must be scanned before starting inspection" }, { status: 400 });
  }

  // Get operator's active machine session
  const activeSession = await prisma.machineSession.findFirst({
    where: {
      operatorId: session.user.id,
      machineId: queueItem.machineId,
      status: "ACTIVE",
    },
  });

  if (!activeSession && session.user.role === "OPERATOR") {
    return NextResponse.json({ error: "No active session for this machine. Please check in first." }, { status: 400 });
  }

  const now = new Date();

  // Update queue item
  const updated = await prisma.inspectionQueue.update({
    where: { id: queueItemId },
    data: {
      status: "IN_PROGRESS",
      queueStartedAt: now,
      assignedOperatorId: session.user.id,
      machineSessionId: activeSession?.id || null,
    },
    include: {
      part: true,
      machine: { select: { id: true, name: true, type: true } },
    },
  });

  // Update part status
  await prisma.part.update({
    where: { id: queueItem.partId },
    data: { status: "IN_INSPECTION" },
  });

  return NextResponse.json({
    data: updated,
    message: `Started inspection for ${queueItem.part.partNumber}`,
  });
}
