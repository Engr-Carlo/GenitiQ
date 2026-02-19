import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/operator/session — Get the current operator's active session
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Find active session for the current user
  const activeSession = await prisma.machineSession.findFirst({
    where: {
      operatorId: session.user.id,
      status: { in: ["ACTIVE", "PAUSED"] },
    },
    include: {
      machine: {
        select: { id: true, name: true, type: true, status: true, location: true },
      },
      operator: { select: { id: true, name: true, accountId: true } },
    },
  });

  if (!activeSession) {
    return NextResponse.json({ data: null, message: "No active session" });
  }

  // Next PENDING PartReference for this machine
  const nextPartRef = await prisma.partReference.findFirst({
    where: { machineId: activeSession.machineId, status: "PENDING" },
    orderBy: [{ position: "asc" }, { deadline: "asc" }],
  });

  // Count pending parts for this machine
  const pendingCount = await prisma.partReference.count({
    where: { machineId: activeSession.machineId, status: "PENDING" },
  });

  return NextResponse.json({
    data: {
      session: activeSession,
      nextPartRef,
      pendingCount,
      itemsCompleted: activeSession.itemsCompleted,
    },
  });
}
