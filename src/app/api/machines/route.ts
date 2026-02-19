import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/machines
export async function GET(req: NextRequest) {
  try {
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
          select: { partReferences: { where: { isScanned: false } } },
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

    let result = machines.map((m: typeof machines[number]) => {
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
        queueLength: m._count.partReferences,
        currentSession: activeSession,
        currentOperator: activeSession?.operator || null,
        hasActiveSession: !!activeSession,
      };
    });

    // Filter by active session if requested
    if (hasActiveSession === "true") {
      result = result.filter((m: typeof result[number]) => m.hasActiveSession);
    } else if (hasActiveSession === "false") {
      result = result.filter((m: typeof result[number]) => !m.hasActiveSession);
    }

    // For operators: only show their own machine session details
    if (session.user.role === "OPERATOR") {
      result = result.map((m: typeof result[number]) => {
        const isOwnMachine = m.currentSession?.operatorId === session.user.id;
        return {
          ...m,
          // Operators can see their own session but not others'
          currentOperator: isOwnMachine ? m.currentOperator : null,
        } as typeof m;
      });
    }

    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error("Failed to fetch machines:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch machines" },
      { status: 500 }
    );
  }
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
