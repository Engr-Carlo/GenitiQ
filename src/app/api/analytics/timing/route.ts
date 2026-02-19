import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "OPERATOR") {
    return NextResponse.json({ error: "Operators cannot access timing analytics" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") || "30");

  const since = new Date();
  since.setDate(since.getDate() - days);

  // Parts with operator timing
  const withOperatorTime = await prisma.partReference.findMany({
    where: { operatorActualTime: { not: null }, operatorTimeOut: { gte: since } },
    select: {
      operatorActualTime: true,
      inspectorActualTime: true,
      machineId: true,
      machine: { select: { name: true, type: true } },
    },
  });

  // Parts with inspector timing
  const withInspectorTime = await prisma.partReference.findMany({
    where: { inspectorActualTime: { not: null }, inspectorTimeOut: { gte: since } },
    select: { inspectorActualTime: true, machineId: true },
  });

  const operatorTimes = withOperatorTime.map((p) => p.operatorActualTime!);
  const inspectorTimes = withInspectorTime.map((p) => p.inspectorActualTime!);
  const avgOperatorTime = operatorTimes.length > 0
    ? operatorTimes.reduce((a, b) => a + b, 0) / operatorTimes.length : 0;
  const avgInspectionTime = inspectorTimes.length > 0
    ? inspectorTimes.reduce((a, b) => a + b, 0) / inspectorTimes.length : 0;

  // Per-machine breakdown
  const machineMap: Record<string, { name: string; opTimes: number[]; insTimes: number[] }> = {};
  withOperatorTime.forEach((p) => {
    if (!machineMap[p.machineId!]) machineMap[p.machineId!] = { name: p.machine!.name, opTimes: [], insTimes: [] };
    if (p.operatorActualTime) machineMap[p.machineId!].opTimes.push(p.operatorActualTime);
  });
  withInspectorTime.forEach((p) => {
    if (!p.machineId) return;
    if (!machineMap[p.machineId]) machineMap[p.machineId] = { name: p.machineId, opTimes: [], insTimes: [] };
    if (p.inspectorActualTime) machineMap[p.machineId].insTimes.push(p.inspectorActualTime);
  });
  const perMachine = Object.entries(machineMap).map(([id, d]) => ({
    machineId: id,
    machineName: d.name,
    avgOperatorTime: d.opTimes.length > 0 ? Math.round(d.opTimes.reduce((a, b) => a + b) / d.opTimes.length) : 0,
    avgInspectionTime: d.insTimes.length > 0 ? Math.round(d.insTimes.reduce((a, b) => a + b) / d.insTimes.length) : 0,
    itemsCompleted: d.opTimes.length,
  }));

  // Active sessions
  const activeSessions = await prisma.machineSession.findMany({
    where: { status: "ACTIVE" },
    include: {
      machine: { select: { id: true, name: true, type: true } },
      operator: { select: { id: true, name: true, accountId: true } },
    },
  });

  return NextResponse.json({
    data: {
      summary: {
        avgOperatorTime: Math.round(avgOperatorTime * 10) / 10,
        avgInspectionTime: Math.round(avgInspectionTime * 10) / 10,
        totalCycleTime: Math.round((avgOperatorTime + avgInspectionTime) * 10) / 10,
        totalItemsCompleted: operatorTimes.length,
      },
      perMachine,
      activeSessions: activeSessions.map((s) => ({
        id: s.id,
        machineId: s.machine.id,
        machineName: s.machine.name,
        machineType: s.machine.type,
        operatorId: s.operator.id,
        operatorName: s.operator.name,
        operatorAccountId: s.operator.accountId,
        startTime: s.startTime,
        itemsCompleted: s.itemsCompleted,
        status: s.status,
      })),
    },
  });
}
