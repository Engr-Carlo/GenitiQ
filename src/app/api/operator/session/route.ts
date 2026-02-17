import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/operator/session — Get the current operator's active session
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Find active session for the current user
  const activeSession = await prisma.machineSession.findFirst({
    where: {
      operatorId: session.user.id,
      status: { in: ["ACTIVE", "PAUSED"] },
    },
    include: {
      machine: {
        select: { id: true, name: true, type: true, status: true, location: true },
      },
      operator: { select: { id: true, name: true, accountId: true } },
      queueItems: {
        where: { status: "COMPLETED" },
        select: { id: true, queueActualTime: true, queueCompletedAt: true },
        orderBy: { queueCompletedAt: "desc" },
      },
    },
  });

  if (!activeSession) {
    return NextResponse.json({ data: null, message: "No active session" });
  }

  // Get next queue item for this machine
  const nextQueueItem = await prisma.inspectionQueue.findFirst({
    where: {
      machineId: activeSession.machineId,
      status: "WAITING",
    },
    include: { part: true },
    orderBy: { position: "asc" },
  });

  // Get current in-progress item
  const currentItem = await prisma.inspectionQueue.findFirst({
    where: {
      machineId: activeSession.machineId,
      assignedOperatorId: session.user.id,
      status: "IN_PROGRESS",
    },
    include: { part: true },
  });

  // Queue items waiting count
  const waitingCount = await prisma.inspectionQueue.count({
    where: { machineId: activeSession.machineId, status: "WAITING" },
  });

  return NextResponse.json({
    data: {
      session: activeSession,
      currentItem,
      nextQueueItem,
      waitingCount,
      itemsCompletedCount: activeSession.queueItems.length,
    },
  });
}
