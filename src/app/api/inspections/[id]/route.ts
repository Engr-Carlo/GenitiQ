import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// PATCH /api/inspections/[id] — QA override
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || (session.user.role !== "QA_QC" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { qaDecision, qaJustification } = body;

  if (!qaDecision || !qaJustification) {
    return NextResponse.json({ error: "Decision and justification required" }, { status: 400 });
  }

  const inspection = await prisma.inspection.update({
    where: { id },
    data: {
      qaDecision,
      qaReviewerId: session.user.id,
      qaJustification,
      qaReviewedAt: new Date(),
    },
    include: {
      part: true,
      inspector: { select: { name: true } },
    },
  });

  // Update part status based on QA decision
  const newPartStatus = qaDecision === "OVERRIDE_ACCEPT"
    ? "ACCEPTED"
    : qaDecision === "OVERRIDE_REJECT"
    ? "REJECTED"
    : qaDecision === "RE_INSPECT"
    ? "QUEUED"
    : inspection.result === "ACCEPTED"
    ? "ACCEPTED"
    : "REJECTED";

  await prisma.part.update({
    where: { id: inspection.partId },
    data: { status: newPartStatus },
  });

  // If re-inspect, add back to queue
  if (qaDecision === "RE_INSPECT") {
    await prisma.inspectionQueue.create({
      data: {
        partId: inspection.partId,
        machineId: inspection.machineId,
        priority: "HIGH",
        status: "WAITING",
        position: 1, // Top of queue
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "QA_OVERRIDE",
      details: `QA decision for part ${inspection.part.partNumber}: ${qaDecision} — ${qaJustification}`,
    },
  });

  return NextResponse.json({ data: inspection });
}
