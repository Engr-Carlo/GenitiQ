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
  const hasActiveSession = searchParams.get("hasActiveSession");

  const where: any = {};
  if (type) where.type = type;
  if (status) where.status = status;

  const machines = await prisma.machine.findMany({
    where,
    include: {
      _count: {
        select: { inspectionQueues: { where: { status: "WAITING" } } },
      },
      sessions: {
        where: { status: "ACTIVE" },
        include: {
          operator: { select: { id: true, name: true, accountId: true } },
        },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  });

  let result = machines.map((m) => {
    const activeSession = m.sessions[0] || null;
    return {
      id: m.id,
      name: m.name,
      type: m.type,
      status: m.status,
      location: m.location,
      specifications: m.specifications,
      currentSessionId: m.currentSessionId,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      queueLength: m._count.inspectionQueues,
      currentSession: activeSession,
      currentOperator: activeSession?.operator || null,
      hasActiveSession: !!activeSession,
    };
  });

  // Filter by active session if requested
  if (hasActiveSession === "true") {
    result = result.filter((m) => m.hasActiveSession);
  } else if (hasActiveSession === "false") {
    result = result.filter((m) => !m.hasActiveSession);
  }

  // For operators: only show their own machine session details
  if (session.user.role === "OPERATOR") {
    result = result.map((m) => ({
      ...m,
      // Operators can see their own session but not others'
      currentOperator: m.currentSession?.operatorId === session.user.id ? m.currentOperator : null,
      // Only show status of their own machine
      status: m.currentSession?.operatorId === session.user.id ? m.status : m.status,
    }));
  }

  return NextResponse.json({ data: result });
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
