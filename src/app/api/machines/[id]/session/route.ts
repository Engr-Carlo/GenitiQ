import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/machines/[id]/session — Get active session for a machine
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: machineId } = await params;

  const activeSession = await prisma.machineSession.findFirst({
    where: { machineId, status: "ACTIVE" },
    include: {
      machine: { select: { id: true, name: true, type: true, status: true, location: true } },
      operator: { select: { id: true, name: true, accountId: true } },
      partReferences: {
        orderBy: { updatedAt: "desc" },
        take: 10,
      },
    },
  });

  return NextResponse.json({ data: activeSession });
}

// PATCH /api/machines/[id]/session — Pause or resume a session
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: machineId } = await params;
  const body = await req.json();
  const { status } = body;

  if (!status || !["ACTIVE", "PAUSED"].includes(status)) {
    return NextResponse.json({ error: "Status must be ACTIVE or PAUSED" }, { status: 400 });
  }

  const activeSession = await prisma.machineSession.findFirst({
    where: {
      machineId,
      operatorId: session.user.id,
      status: { in: ["ACTIVE", "PAUSED"] },
    },
  });

  if (!activeSession) {
    return NextResponse.json({ error: "No active session found" }, { status: 404 });
  }

  const updatedSession = await prisma.machineSession.update({
    where: { id: activeSession.id },
    data: { status },
    include: {
      machine: { select: { id: true, name: true, type: true } },
      operator: { select: { id: true, name: true } },
    },
  });

  // Update machine status accordingly
  await prisma.machine.update({
    where: { id: machineId },
    data: { status: status === "PAUSED" ? "IDLE" : "ACTIVE" },
  });

  return NextResponse.json({ data: updatedSession });
}
