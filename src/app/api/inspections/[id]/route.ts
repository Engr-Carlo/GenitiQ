import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// PATCH /api/inspections/[id] — Inspector QA review on PartReference
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || (session.user.role !== "INSPECTOR" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { qaDecision, qaJustification, inspectionStartedAt } = body;

  // If only setting start time (review timer started), just record it
  if (!qaDecision && inspectionStartedAt) {
    await prisma.partReference.update({
      where: { id },
      data: { inspectorTimeIn: new Date(inspectionStartedAt) },
    });
    return NextResponse.json({ success: true });
  }

  if (!qaDecision || (!qaJustification && qaDecision !== "APPROVED")) {
    return NextResponse.json({ error: "Decision and justification required" }, { status: 400 });
  }

  const now = new Date();
  const startedAt = inspectionStartedAt ? new Date(inspectionStartedAt) : null;
  // Store in SECONDS for sub-minute accuracy
  const inspectorActualTime = startedAt
    ? Math.round((now.getTime() - startedAt.getTime()) / 1000)
    : null;

  const isRework = qaDecision === "RE_INSPECT" || qaDecision === "REWORK";
  const newStatus = isRework ? "RE_INSPECT" : "COMPLETED";

  const part = await prisma.partReference.update({
    where: { id },
    data: {
      qaDecision,
      qaReviewerId: session.user.id,
      qaJustification,
      qaReviewedAt: now,
      inspectorTimeIn: startedAt ?? undefined,
      inspectorTimeOut: now,
      inspectorActualTime: inspectorActualTime ?? undefined,
      status: newStatus,
      ...(isRework && {
        operatorResult: null,
        operatorTimeIn: null,
        operatorTimeOut: null,
        operatorActualTime: null,
        operatorNotes: null,
      }),
    },
    include: {
      machine: { select: { name: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "QA_REVIEW",
      details: `QA ${qaDecision} for part ${part.partNumber} — ${qaJustification}`,
    },
  });

  // Increment inspector's active session itemsCompleted counter
  const inspectorSession = await prisma.machineSession.findFirst({
    where: { operatorId: session.user.id, status: "ACTIVE" },
  });
  if (inspectorSession) {
    await prisma.machineSession.update({
      where: { id: inspectorSession.id },
      data: { itemsCompleted: { increment: 1 } },
    });
  }

  return NextResponse.json({ data: part });
}
