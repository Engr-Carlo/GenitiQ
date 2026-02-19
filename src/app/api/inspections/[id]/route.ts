import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// PATCH /api/inspections/[id] — Inspector QA review (second line of defense)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || (session.user.role !== "INSPECTOR" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { qaDecision, qaJustification, inspectionStartedAt } = body;

  if (!qaDecision || !qaJustification) {
    return NextResponse.json({ error: "Decision and justification required" }, { status: 400 });
  }

  const now = new Date();
  const startedAt = inspectionStartedAt ? new Date(inspectionStartedAt) : null;
  const inspectionActualTime = startedAt
    ? Math.round((now.getTime() - startedAt.getTime()) / 60000)
    : null;

  const inspection = await prisma.inspection.update({
    where: { id },
    data: {
      qaDecision,
      qaReviewerId: session.user.id,
      qaJustification,
      qaReviewedAt: now,
      inspectionStartedAt: startedAt,
      inspectionCompletedAt: now,
      inspectionActualTime,
    },
    include: {
      partReference: true,
      inspector: { select: { name: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "QA_OVERRIDE",
      details: `QA decision for part ${inspection.partReference?.partNumber ?? inspection.scannedBarcode}: ${qaDecision} — ${qaJustification}`,
    },
  });

  return NextResponse.json({ data: inspection });
}
