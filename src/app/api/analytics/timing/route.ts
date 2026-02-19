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

  // Operator timing — from Inspection.operatorActualTime
  const operatorTimingWhere: any = {
    operatorCompletedAt: { not: null },
    operatorStartedAt: { gte: since },
  };
  if (machineId) operatorTimingWhere.machineId = machineId;

  const completedOperatorItems = await prisma.inspection.findMany({
    where: operatorTimingWhere,
    select: {
      operatorActualTime: true,
      machineId: true,
      machineSession: { select: { operator: { select: { name: true } } } },
      machine: { select: { name: true, type: true } },
      operatorCompletedAt: true,
      operatorStartedAt: true,
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
  const operatorTimes = completedOperatorItems.map((q: typeof completedOperatorItems[number]) => q.operatorActualTime || 0).filter(Boolean);
  const inspectionTimes = completedInspections.map((i: typeof completedInspections[number]) => i.inspectionActualTime || 0).filter(Boolean);
  const avgOperatorTime = operatorTimes.length > 0 ? operatorTimes.reduce((a: number, b: number) => a + b, 0) / operatorTimes.length : 0;
  const avgInspectionTime = inspectionTimes.length > 0 ? inspectionTimes.reduce((a: number, b: number) => a + b, 0) / inspectionTimes.length : 0;
  const totalCycleTime = avgOperatorTime + avgInspectionTime;

  // Per-machine breakdown
  const machineMap: Record<string, { name: string; operatorTimes: number[]; inspectionTimes: number[] }> = {};
  completedOperatorItems.forEach((q: typeof completedOperatorItems[number]) => {
    if (!machineMap[q.machineId]) machineMap[q.machineId] = { name: q.machine.name, operatorTimes: [], inspectionTimes: [] };
    if (q.operatorActualTime) machineMap[q.machineId].operatorTimes.push(q.operatorActualTime);
  });
  completedInspections.forEach((i: typeof completedInspections[number]) => {
    if (!machineMap[i.machineId]) machineMap[i.machineId] = { name: i.machine.name, operatorTimes: [], inspectionTimes: [] };
    if (i.inspectionActualTime) machineMap[i.machineId].inspectionTimes.push(i.inspectionActualTime);
  });

  const perMachine = Object.entries(machineMap).map(([id, data]) => ({
    machineId: id,
    machineName: data.name,
    avgOperatorTime: data.operatorTimes.length > 0 ? Math.round(data.operatorTimes.reduce((a, b) => a + b, 0) / data.operatorTimes.length) : 0,
    avgInspectionTime: data.inspectionTimes.length > 0 ? Math.round(data.inspectionTimes.reduce((a, b) => a + b, 0) / data.inspectionTimes.length) : 0,
    itemsCompleted: data.operatorTimes.length,
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
        avgOperatorTime: Math.round(avgOperatorTime * 10) / 10,
        avgInspectionTime: Math.round(avgInspectionTime * 10) / 10,
        totalCycleTime: Math.round(totalCycleTime * 10) / 10,
        totalItemsCompleted: operatorTimes.length,
        totalSessions: sessions.length,
      },
      perMachine,
      activeSessions: activeSessions.map((s: typeof activeSessions[number]) => ({
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
