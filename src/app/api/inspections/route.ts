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
        partReference: true,
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

  // Compute GA priority from partReference data
  const enrichedInspections = inspections.map((insp) => {
    const ref = insp.partReference;
    let priority: string | null = null;
    if (ref) {
      const hoursToDeadline = (ref.deadline.getTime() - Date.now()) / (1000 * 60 * 60);
      const urgencyScore = Math.max(0, 100 - hoursToDeadline / 2);
      const complexityScore = (ref.estimatedTime / 60) * 50 + (ref.quantity / 10) * 50;
      const fitness = urgencyScore * 0.6 + complexityScore * 0.4;
      priority = (fitness > 70 || hoursToDeadline < 24) ? "HIGH"
        : (fitness > 40 || hoursToDeadline < 72) ? "MEDIUM" : "LOW";
    }
    return { ...insp, priority };
  });

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
  const { machineId, result, notes, scannedBarcode } = body;

  if (!machineId || !result) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Create inspection
  const inspection = await prisma.inspection.create({
    data: {
      machineId,
      inspectorId: session.user.id,
      result,
      notes: notes || null,
      scannedBarcode: scannedBarcode || null,
    },
    include: {
      machine: { select: { name: true } },
    },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "SUBMIT_INSPECTION",
      details: `Inspection on ${inspection.machine.name}: ${result}`,
    },
  });

  return NextResponse.json({ data: inspection }, { status: 201 });
}
