import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/machines/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const machine = await prisma.machine.findUnique({
    where: { id },
    include: {
      inspectionQueues: {
        where: { status: "WAITING" },
        include: { part: true },
        orderBy: { position: "asc" },
      },
      shutdownEvents: {
        orderBy: { startTime: "desc" },
        take: 5,
      },
    },
  });

  if (!machine) return NextResponse.json({ error: "Machine not found" }, { status: 404 });
  return NextResponse.json({ data: machine });
}

// PATCH /api/machines/[id] — update status, etc.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { status, location, specifications } = body;

  const oldMachine = await prisma.machine.findUnique({ where: { id } });
  if (!oldMachine) return NextResponse.json({ error: "Machine not found" }, { status: 404 });

  const machine = await prisma.machine.update({
    where: { id },
    data: {
      ...(status !== undefined && { status }),
      ...(location !== undefined && { location }),
      ...(specifications !== undefined && { specifications }),
    },
  });

  // If shutting down, create a shutdown event
  if (status === "SHUTDOWN" && oldMachine.status !== "SHUTDOWN") {
    await prisma.shutdownEvent.create({
      data: {
        machineId: id,
        reason: body.reason || "Manual shutdown",
        initiatedById: session.user.id,
      },
    });
  }

  // If reactivating from shutdown, close the event
  if (status === "ACTIVE" && oldMachine.status === "SHUTDOWN") {
    const openEvent = await prisma.shutdownEvent.findFirst({
      where: { machineId: id, endTime: null },
      orderBy: { startTime: "desc" },
    });
    if (openEvent) {
      await prisma.shutdownEvent.update({
        where: { id: openEvent.id },
        data: { endTime: new Date() },
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE_MACHINE",
      details: `Updated machine ${machine.name}: status → ${machine.status}`,
    },
  });

  return NextResponse.json({ data: machine });
}
