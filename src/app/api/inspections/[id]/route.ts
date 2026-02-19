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

  if (!qaDecision || !qaJustification) {
    return NextResponse.json({ error: "Decision and justification required" }, { status: 400 });
  }

  const now = new Date();
  const startedAt = inspectionStartedAt ? new Date(inspectionStartedAt) : null;
  const inspectorActualTime = startedAt
    ? Math.round((now.getTime() - startedAt.getTime()) / 60000)
    : null;

  const isReInspect = qaDecision === "RE_INSPECT";
  const newStatus = isReInspect ? "RE_INSPECT" : "COMPLETED";

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
      ...(isReInspect && {
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

  return NextResponse.json({ data: part });
}
