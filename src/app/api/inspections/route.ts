import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/inspections — reads PartReference (Inspection model removed)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const machineId = searchParams.get("machineId");
  const operatorResult = searchParams.get("result");
  const needsReview = searchParams.get("needsReview") === "true";

  const where: any = { status: { not: "PENDING" } };
  if (operatorResult) where.operatorResult = operatorResult;
  if (needsReview) {
    where.status = "OPERATOR_DONE";
    // Inspectors scoped to their checked-in machine
    if (session.user.role === "INSPECTOR") {
      const inspectorSession = await prisma.machineSession.findFirst({
        where: { operatorId: session.user.id, status: "ACTIVE" },
      });
      // Also check if inspector is directly assigned to a machine
      const assignedMachine = await prisma.machine.findFirst({
        where: { assignedInspectorId: session.user.id },
      });
      const restrictMachineId = inspectorSession?.machineId ?? assignedMachine?.id ?? machineId ?? null;
      if (restrictMachineId) where.machineId = restrictMachineId;
    } else if (machineId) {
      where.machineId = machineId;
    }
  } else if (machineId) {
    where.machineId = machineId;
  }

  const [parts, total] = await Promise.all([
    prisma.partReference.findMany({
      where,
      include: {
        machine: { select: { id: true, name: true, type: true } },
        operator: { select: { id: true, name: true } },
        inspector: { select: { id: true, name: true } },
        qaReviewer: { select: { id: true, name: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.partReference.count({ where }),
  ]);

  const data = parts.map((p) => {
    const hoursToDeadline = (p.deadline.getTime() - Date.now()) / (1000 * 60 * 60);
    const urgencyScore = Math.max(0, 100 - hoursToDeadline / 2);
    const complexityScore = (p.estimatedTime / 60) * 50 + (p.quantity / 10) * 50;
    const fitness = urgencyScore * 0.6 + complexityScore * 0.4;
    const priority = (fitness > 70 || hoursToDeadline < 24) ? "HIGH"
      : (fitness > 40 || hoursToDeadline < 72) ? "MEDIUM" : "LOW";

    return {
      id: p.id,
      partNumber: p.partNumber,
      operatorName: p.operator?.name ?? null,
      result: p.operatorResult,
      machine: p.machine,
      operatorStartedAt: p.operatorTimeIn,
      operatorCompletedAt: p.operatorTimeOut,
      operatorActualTime: p.operatorActualTime,
      scannedBarcode: p.barcode,
      notes: p.operatorNotes,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      qaDecision: p.qaDecision,
      qaJustification: p.qaJustification,
      qaReviewedAt: p.qaReviewedAt,
      qaReviewerName: p.qaReviewer?.name ?? null,
      inspectionStartedAt: p.inspectorTimeIn,
      inspectionCompletedAt: p.inspectorTimeOut,
      inspectionActualTime: p.inspectorActualTime,
      status: p.status,
      estimatedTime: p.estimatedTime,
      deadline: p.deadline,
      quantity: p.quantity,
      priority,
    };
  });

  return NextResponse.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}
