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

  const [inspections, total] = await Promise.all([
    prisma.inspection.findMany({
      where,
      include: {
        part: true,
        machine: { select: { id: true, name: true, type: true } },
        inspector: { select: { id: true, name: true } },
        qaReviewer: { select: { id: true, name: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.inspection.count({ where }),
  ]);

  return NextResponse.json({
    data: inspections,
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
