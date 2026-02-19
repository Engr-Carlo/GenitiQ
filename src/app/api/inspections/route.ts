import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/inspections
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const result = searchParams.get("result");
  const machineId = searchParams.get("machineId");
  const inspectorId = searchParams.get("inspectorId");

  const where: any = {};
  if (result) where.result = result;
  if (machineId) where.machineId = machineId;
  if (inspectorId) where.inspectorId = inspectorId;

  // Filter for items needing QA review (operator completed, inspector hasn't reviewed)
  const needsReview = searchParams.get("needsReview");
  if (needsReview === "true") {
    where.qaDecision = null;
    where.operatorCompletedAt = { not: null };
  }

  const [inspections, total] = await Promise.all([
    prisma.inspection.findMany({
      where,
      include: {
        part: true,
        machine: { select: { id: true, name: true, type: true } },
        inspector: { select: { id: true, name: true } },
        qaReviewer: { select: { id: true, name: true } },
        machineSession: {
          select: { id: true, operator: { select: { name: true } } },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.inspection.count({ where }),
  ]);

  // Enrich inspections with PartReference data (estimatedTime, deadline, quantity, priority)
  const barcodes = inspections
    .map((i) => i.scannedBarcode)
    .filter((b): b is string => !!b);

  const partRefMap: Record<string, { estimatedTime: number; deadline: Date; quantity: number; priority: string }> = {};
  if (barcodes.length > 0) {
    const refs = await prisma.partReference.findMany({
      where: { barcode: { in: barcodes } },
      select: { barcode: true, estimatedTime: true, deadline: true, quantity: true },
    });
    for (const ref of refs) {
      // Calculate GA-based priority from deadline urgency, estimatedTime, quantity
      const hoursToDeadline = (ref.deadline.getTime() - Date.now()) / (1000 * 60 * 60);
      const urgencyScore = Math.max(0, 100 - hoursToDeadline / 2);
      const complexityScore = (ref.estimatedTime / 60) * 50 + (ref.quantity / 10) * 50;
      const fitness = urgencyScore * 0.6 + complexityScore * 0.4;
      const priority = (fitness > 70 || hoursToDeadline < 24) ? "HIGH"
        : (fitness > 40 || hoursToDeadline < 72) ? "MEDIUM" : "LOW";

      partRefMap[ref.barcode] = {
        estimatedTime: ref.estimatedTime,
        deadline: ref.deadline,
        quantity: ref.quantity,
        priority,
      };
    }
  }

  const enrichedInspections = inspections.map((insp) => ({
    ...insp,
    partRef: insp.scannedBarcode ? partRefMap[insp.scannedBarcode] || null : null,
  }));

  return NextResponse.json({
    data: enrichedInspections,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

// POST /api/inspections — submit an inspection result
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { partId, machineId, result, measurements, notes, queueItemId } = body;

  if (!partId || !machineId || !result) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Create inspection
  const inspection = await prisma.inspection.create({
    data: {
      partId,
      machineId,
      inspectorId: session.user.id,
      result,
      measurements: measurements || null,
      notes: notes || null,
    },
    include: {
      part: true,
      machine: { select: { name: true } },
    },
  });

  // Update part status
  await prisma.part.update({
    where: { id: partId },
    data: {
      status: result === "ACCEPTED" ? "ACCEPTED" : result === "REJECTED" ? "REJECTED" : "FOR_REVIEW",
      currentMachineId: machineId,
    },
  });

  // Remove from queue if queue item exists
  if (queueItemId) {
    await prisma.inspectionQueue.update({
      where: { id: queueItemId },
      data: { status: "COMPLETED" },
    });
  }

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "SUBMIT_INSPECTION",
      details: `Inspection for part ${inspection.part.partNumber} on ${inspection.machine.name}: ${result}`,
    },
  });

  return NextResponse.json({ data: inspection }, { status: 201 });
}
