import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// POST /api/inspector/submit-review — Inspector submits accept/reject decision for operator's inspection
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "INSPECTOR") {
    return NextResponse.json({ error: "Only inspectors can submit reviews" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { inspectionId, qaDecision, qaJustification, timeIn } = body;

    if (!inspectionId || !qaDecision) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const validDecisions = ["APPROVED", "OVERRIDE_ACCEPT", "OVERRIDE_REJECT", "RE_INSPECT"];
    if (!validDecisions.includes(qaDecision)) {
      return NextResponse.json({ error: "Invalid QA decision" }, { status: 400 });
    }

    // Get the inspection
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
      include: {
        partReference: true,
        machine: true,
        inspector: { select: { name: true } },
      },
    });

    if (!inspection) {
      return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
    }

    if (inspection.qaDecision) {
      return NextResponse.json({ error: "Inspection already reviewed" }, { status: 400 });
    }

    // Calculate inspector time (in minutes)
    const inspectionStartedAt = timeIn ? new Date(timeIn) : new Date();
    const inspectionCompletedAt = new Date();
    const inspectionActualTime = Math.round((inspectionCompletedAt.getTime() - inspectionStartedAt.getTime()) / 60000);

    // Update inspection with inspector's review
    const updatedInspection = await prisma.inspection.update({
      where: { id: inspectionId },
      data: {
        qaReviewerId: session.user.id,
        qaDecision: qaDecision as "APPROVED" | "OVERRIDE_ACCEPT" | "OVERRIDE_REJECT" | "RE_INSPECT",
        qaJustification: qaJustification || null,
        qaReviewedAt: new Date(),
        inspectionStartedAt,
        inspectionCompletedAt,
        inspectionActualTime,
      },
      include: {
        machine: { select: { id: true, name: true, type: true } },
        inspector: { select: { id: true, name: true } },
        qaReviewer: { select: { id: true, name: true } },
        partReference: true,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "INSPECTOR_REVIEW",
        details: `Inspector ${qaDecision} part ${inspection.partReference?.partNumber || inspection.scannedBarcode} (Operator: ${inspection.result})`,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        inspection: updatedInspection,
        timeIn: inspectionStartedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        timeOut: inspectionCompletedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        duration: `${inspectionActualTime} min`,
      },
    });
  } catch (error: unknown) {
    console.error("Inspector submit review error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to submit review";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
