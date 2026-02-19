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
        part: true,
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
        part: true,
        machine: { select: { id: true, name: true, type: true } },
        inspector: { select: { id: true, name: true } },
        qaReviewer: { select: { id: true, name: true } },
      },
    });

    // Update part status based on final decision
    let partStatus = inspection.part.status;
    if (qaDecision === "APPROVED") {
      // Keep operator's original decision
      partStatus = inspection.result === "ACCEPTED" ? "ACCEPTED" : "REJECTED";
    } else if (qaDecision === "OVERRIDE_ACCEPT") {
      partStatus = "ACCEPTED";
    } else if (qaDecision === "OVERRIDE_REJECT") {
      partStatus = "REJECTED";
    } else if (qaDecision === "RE_INSPECT") {
      partStatus = "FOR_REVIEW";
    }

    await prisma.part.update({
      where: { id: inspection.partId },
      data: { status: partStatus },
    });

    // Update inspector's machine session items completed (if they have an active session)
    const inspectorSession = await prisma.machineSession.findFirst({
      where: {
        operatorId: session.user.id,
        status: "ACTIVE",
      },
    });

    if (inspectorSession) {
      await prisma.machineSession.update({
        where: { id: inspectorSession.id },
        data: {
          itemsCompleted: { increment: 1 },
        },
      });
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "INSPECTOR_REVIEW",
        details: `Inspector ${qaDecision} part ${inspection.part.partNumber} (Operator: ${inspection.result})`,
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
