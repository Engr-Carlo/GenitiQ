import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// POST /api/inspector/submit-review — Inspector QA decision on PartReference
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "INSPECTOR" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Only inspectors can submit reviews" }, { status: 403 });
  }

  try {
    const body = await req.json();
    // Accept both partReferenceId (new) and inspectionId (legacy key)
    const partRefId = body.partReferenceId || body.inspectionId;
    const { qaDecision, qaJustification, timeIn } = body;

    if (!partRefId || !qaDecision) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const validDecisions = ["APPROVED", "OVERRIDE_ACCEPT", "CONFIRMED_REJECT", "RE_INSPECT"];
    if (!validDecisions.includes(qaDecision)) {
      return NextResponse.json({ error: "Invalid QA decision" }, { status: 400 });
    }

    const part = await prisma.partReference.findUnique({
      where: { id: partRefId },
      include: { machine: true },
    });

    if (!part) {
      return NextResponse.json({ error: "Part not found" }, { status: 404 });
    }
    if (part.status !== "OPERATOR_DONE") {
      return NextResponse.json({ error: `Can only review OPERATOR_DONE parts (current: ${part.status})` }, { status: 400 });
    }

    const inspectorTimeIn = timeIn ? new Date(timeIn) : new Date();
    const inspectorTimeOut = new Date();
    const inspectorActualTime = Math.round((inspectorTimeOut.getTime() - inspectorTimeIn.getTime()) / 60000);

    const isReInspect = qaDecision === "RE_INSPECT";
    const newStatus = isReInspect ? "RE_INSPECT" : "COMPLETED";

    const updated = await prisma.partReference.update({
      where: { id: partRefId },
      data: {
        qaDecision,
        qaReviewerId: session.user.id,
        qaJustification: qaJustification || null,
        qaReviewedAt: inspectorTimeOut,
        inspectorTimeIn,
        inspectorTimeOut,
        inspectorActualTime,
        status: newStatus,
        ...(isReInspect && {
          operatorResult: null,
          operatorTimeIn: null,
          operatorTimeOut: null,
          operatorActualTime: null,
          operatorNotes: null,
        }),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "INSPECTOR_REVIEW",
        details: `Inspector ${qaDecision} part ${part.partNumber} (${part.barcode})`,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        part: updated,
        partNumber: part.partNumber,
        timeIn: inspectorTimeIn.toISOString(),
        timeOut: inspectorTimeOut.toISOString(),
        duration: `${inspectorActualTime} min`,
      },
    });
  } catch (error: unknown) {
    console.error("Inspector submit review error:", error);
    const msg = error instanceof Error ? error.message : "Failed to submit review";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
