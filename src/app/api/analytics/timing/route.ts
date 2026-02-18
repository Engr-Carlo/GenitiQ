import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/analytics/timing — Timing analytics for queue and inspections
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "OPERATOR") {
    return NextResponse.json({ error: "Operators cannot access timing analytics" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const machineId = searchParams.get("machineId");
  const operatorId = searchParams.get("operatorId");
  const days = parseInt(searchParams.get("days") || "30");

  const since = new Date();
  since.setDate(since.getDate() - days);

  // Queue timing (operator work)
  const queueTimingWhere: any = {
    queueCompletedAt: { not: null },
    queueStartedAt: { gte: since },
  };
  if (machineId) queueTimingWhere.machineId = machineId;
  if (operatorId) queueTimingWhere.assignedOperatorId = operatorId;

  const completedQueueItems = await prisma.inspectionQueue.findMany({
    where: queueTimingWhere,
    select: {
      queueActualTime: true,
      estimatedTime: true,
      machineId: true,
      assignedOperatorId: true,
      machine: { select: { name: true, type: true } },
      assignedOperator: { select: { name: true } },
      queueStartedAt: true,
      queueCompletedAt: true,
    },
  });

  // Inspection timing (inspector review)
  const inspectionTimingWhere: any = {
    inspectionCompletedAt: { not: null },
    inspectionStartedAt: { gte: since },
  };
  if (machineId) inspectionTimingWhere.machineId = machineId;

  const completedInspections = await prisma.inspection.findMany({
    where: inspectionTimingWhere,
    select: {
      inspectionActualTime: true,
      operatorActualTime: true,
      machineId: true,
      machine: { select: { name: true, type: true } },
      inspector: { select: { name: true } },
      qaReviewer: { select: { name: true } },
      inspectionStartedAt: true,
      inspectionCompletedAt: true,
    },
  });

  // Session stats
  const sessions = await prisma.machineSession.findMany({
    where: { startTime: { gte: since }, status: "COMPLETED" },
    select: {
      startTime: true,
      endTime: true,
      itemsCompleted: true,
      operator: { select: { name: true } },
      machine: { select: { name: true } },
    },
  });

  // Calculate aggregates
  // @ts-ignore
  const queueTimes = completedQueueItems.map((q: any) => q.queueActualTime || 0).filter(Boolean);
  // @ts-ignore
  const inspectionTimes = completedInspections.map((i: any) => i.inspectionActualTime || 0).filter(Boolean);
  // @ts-ignore
  const avgQueueTime = queueTimes.length > 0 ? queueTimes.reduce((a: number, b: number) => a + b, 0) / queueTimes.length : 0;
  // @ts-ignore
  const avgInspectionTime = inspectionTimes.length > 0 ? inspectionTimes.reduce((a: number, b: number) => a + b, 0) / inspectionTimes.length : 0;
  const totalCycleTime = avgQueueTime + avgInspectionTime;

  // Per-machine breakdown
  const machineMap: Record<string, { name: string; queueTimes: number[]; inspectionTimes: number[] }> = {};
  // @ts-ignore
  completedQueueItems.forEach((q: any) => {
    if (!machineMap[q.machineId]) machineMap[q.machineId] = { name: q.machine.name, queueTimes: [], inspectionTimes: [] };
    if (q.queueActualTime) machineMap[q.machineId].queueTimes.push(q.queueActualTime);
  });
  // @ts-ignore
  completedInspections.forEach((i: any) => {
    if (!machineMap[i.machineId]) machineMap[i.machineId] = { name: i.machine.name, queueTimes: [], inspectionTimes: [] };
    if (i.inspectionActualTime) machineMap[i.machineId].inspectionTimes.push(i.inspectionActualTime);
  });

  const perMachine = Object.entries(machineMap).map(([id, data]) => ({
    machineId: id,
    machineName: data.name,
    avgQueueTime: data.queueTimes.length > 0 ? Math.round(data.queueTimes.reduce((a, b) => a + b, 0) / data.queueTimes.length) : 0,
    avgInspectionTime: data.inspectionTimes.length > 0 ? Math.round(data.inspectionTimes.reduce((a, b) => a + b, 0) / data.inspectionTimes.length) : 0,
    itemsCompleted: data.queueTimes.length,
  }));

  // Active sessions
  const activeSessions = await prisma.machineSession.findMany({
    where: { status: "ACTIVE" },
    include: {
      machine: { select: { name: true, type: true } },
      operator: { select: { name: true, accountId: true } },
    },
  });

  return NextResponse.json({
    data: {
      summary: {
        avgQueueTime: Math.round(avgQueueTime * 10) / 10,
        avgInspectionTime: Math.round(avgInspectionTime * 10) / 10,
        totalCycleTime: Math.round(totalCycleTime * 10) / 10,
        totalItemsCompleted: queueTimes.length,
        totalSessions: sessions.length,
      },
      perMachine,
      // @ts-ignore
      activeSessions: activeSessions.map((s: any) => ({
        id: s.id,
        machineName: s.machine.name,
        machineType: s.machine.type,
        operatorName: s.operator.name,
        operatorAccountId: s.operator.accountId,
        startTime: s.startTime,
        itemsCompleted: s.itemsCompleted,
      })),
    },
  });
}
