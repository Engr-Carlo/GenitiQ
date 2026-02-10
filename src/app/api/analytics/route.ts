import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/analytics — aggregated analytics data
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "7d"; // 7d, 30d, 90d

  const daysBack = period === "90d" ? 90 : period === "30d" ? 30 : 7;
  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  // Parallel queries
  const [
    totalInspections,
    acceptedCount,
    rejectedCount,
    totalParts,
    queuedParts,
    activeMachines,
    totalMachines,
    recentInspections,
    machineUtilization,
  ] = await Promise.all([
    prisma.inspection.count({ where: { createdAt: { gte: since } } }),
    prisma.inspection.count({ where: { createdAt: { gte: since }, result: "ACCEPTED" } }),
    prisma.inspection.count({ where: { createdAt: { gte: since }, result: "REJECTED" } }),
    prisma.part.count(),
    prisma.part.count({ where: { status: "QUEUED" } }),
    prisma.machine.count({ where: { status: "ACTIVE" } }),
    prisma.machine.count(),
    prisma.inspection.findMany({
      where: { createdAt: { gte: since } },
      include: {
        machine: { select: { name: true, type: true } },
        inspector: { select: { name: true } },
        part: { select: { partNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.machine.findMany({
      where: { status: "ACTIVE" },
      include: {
        _count: {
          select: {
            inspections: { where: { createdAt: { gte: since } } },
            inspectionQueues: { where: { status: "WAITING" } },
          },
        },
      },
    }),
  ]);

  const defectRate = totalInspections > 0 ? ((rejectedCount / totalInspections) * 100).toFixed(1) : "0.0";
  const yieldRate = totalInspections > 0 ? ((acceptedCount / totalInspections) * 100).toFixed(1) : "0.0";

  return NextResponse.json({
    data: {
      kpis: {
        totalInspections,
        acceptedCount,
        rejectedCount,
        defectRate: `${defectRate}%`,
        yieldRate: `${yieldRate}%`,
        totalParts,
        queuedParts,
        activeMachines,
        totalMachines,
      },
      recentInspections,
      machineUtilization: machineUtilization.map((m) => ({
        id: m.id,
        name: m.name,
        type: m.type,
        inspectionCount: m._count.inspections,
        queuedCount: m._count.inspectionQueues,
      })),
    },
  });
}
