import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "7d";
  const daysBack = period === "90d" ? 90 : period === "30d" ? 30 : 7;
  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  const [
    totalCompleted,
    acceptedCount,
    rejectedCount,
    totalParts,
    pendingParts,
    activeMachines,
    totalMachines,
    recentParts,
    machineUtilization,
  ] = await Promise.all([
    prisma.partReference.count({ where: { status: "COMPLETED", updatedAt: { gte: since } } }),
    prisma.partReference.count({ where: { status: "COMPLETED", operatorResult: "ACCEPTED", updatedAt: { gte: since } } }),
    prisma.partReference.count({ where: { status: "COMPLETED", operatorResult: "REJECTED", updatedAt: { gte: since } } }),
    prisma.partReference.count(),
    prisma.partReference.count({ where: { status: "PENDING" } }),
    prisma.machine.count({ where: { status: "ACTIVE" } }),
    prisma.machine.count(),
    prisma.partReference.findMany({
      where: { status: { not: "PENDING" }, updatedAt: { gte: since } },
      include: {
        machine: { select: { name: true, type: true } },
        operator: { select: { name: true } },
        qaReviewer: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    prisma.machine.findMany({
      where: { status: "ACTIVE" },
      include: {
        _count: {
          select: {
            partReferences: { where: { status: { not: "PENDING" }, updatedAt: { gte: since } } },
          },
        },
      },
    }),
  ]);

  const defectRate = totalCompleted > 0 ? ((rejectedCount / totalCompleted) * 100).toFixed(1) : "0.0";
  const yieldRate = totalCompleted > 0 ? ((acceptedCount / totalCompleted) * 100).toFixed(1) : "0.0";

  return NextResponse.json({
    data: {
      kpis: {
        totalInspections: totalCompleted,
        acceptedCount,
        rejectedCount,
        defectRate: `${defectRate}%`,
        yieldRate: `${yieldRate}%`,
        totalParts,
        queuedParts: pendingParts,
        activeMachines,
        totalMachines,
      },
      recentInspections: recentParts,
      machineUtilization: machineUtilization.map((m) => ({
        id: m.id,
        name: m.name,
        type: m.type,
        inspectionCount: m._count.partReferences,
        unscannedCount: 0,
      })),
    },
  });
}
