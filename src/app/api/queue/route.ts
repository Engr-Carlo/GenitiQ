import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { runGAOptimization, shouldReoptimize } from "@/lib/ga";

// GET /api/queue — get queue items
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const machineType = searchParams.get("machineType") as "VMM" | "CMM" | null;
  const machineId = searchParams.get("machineId");
  const status = searchParams.get("status") || "WAITING";

  const where: any = { status };
  if (machineId) where.machineId = machineId;
  if (machineType) where.machine = { type: machineType };

  const queueItems = await prisma.inspectionQueue.findMany({
    where,
    include: {
      part: true,
      machine: { select: { id: true, name: true, type: true } },
    },
    orderBy: { position: "asc" },
  });

  return NextResponse.json({ data: queueItems });
}

// POST /api/queue — add part to queue
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { partId, machineId, priority, estimatedTime } = body;

  if (!partId || !machineId) {
    return NextResponse.json({ error: "partId and machineId required" }, { status: 400 });
  }

  // Get current max position for this machine
  const maxPos = await prisma.inspectionQueue.aggregate({
    where: { machineId, status: "WAITING" },
    _max: { position: true },
  });

  const queueItem = await prisma.inspectionQueue.create({
    data: {
      partId,
      machineId,
      priority: priority || "MEDIUM",
      estimatedTime: estimatedTime || 15,
      position: (maxPos._max.position || 0) + 1,
      status: "WAITING",
    },
    include: { part: true, machine: { select: { name: true, type: true } } },
  });

  // Update part status
  await prisma.part.update({
    where: { id: partId },
    data: { status: "QUEUED", currentMachineId: machineId },
  });

  // Check if re-optimization should be triggered
  const machineType = queueItem.machine.type as "VMM" | "CMM";
  if (await shouldReoptimize(machineType)) {
    // Fire and forget — don't block the response
    runGAOptimization(machineType).catch(console.error);
  }

  return NextResponse.json({ data: queueItem }, { status: 201 });
}
