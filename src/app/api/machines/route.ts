import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/machines
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type"); // VMM or CMM
  const status = searchParams.get("status");

  const where: any = {};
  if (type) where.type = type;
  if (status) where.status = status;

  const machines = await prisma.machine.findMany({
    where,
    include: {
      _count: {
        select: { inspectionQueues: { where: { status: "WAITING" } } },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    data: machines.map((m) => ({
      ...m,
      queueLength: m._count.inspectionQueues,
    })),
  });
}

// POST /api/machines — create a new machine
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const { name, type, location, specifications } = body;

  if (!name || !type) {
    return NextResponse.json({ error: "Name and type are required" }, { status: 400 });
  }

  const machine = await prisma.machine.create({
    data: {
      name,
      type,
      location: location || null,
      specifications: specifications || null,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CREATE_MACHINE",
      details: `Created machine ${machine.name} (${machine.type})`,
    },
  });

  return NextResponse.json({ data: machine }, { status: 201 });
}
