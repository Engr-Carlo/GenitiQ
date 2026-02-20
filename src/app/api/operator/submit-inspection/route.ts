import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// POST /api/operator/submit-inspection — Operator submits accept/reject on PartReference
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "OPERATOR") {
    return NextResponse.json({ error: "Only operators can submit inspections" }, { status: 403 });
  }

  try {
    const body = await req.json();
    // Accept both partReferenceId (new) and barcodeReferenceId (legacy) 
    const partRefId = body.partReferenceId || body.barcodeReferenceId;
    const { result, timeIn, notes } = body;

    if (!partRefId || !result) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (result !== "ACCEPTED" && result !== "REJECTED") {
      return NextResponse.json({ error: "Result must be ACCEPTED or REJECTED" }, { status: 400 });
    }

    // Find PartReference
    const ref = await prisma.partReference.findUnique({
      where: { id: partRefId },
      include: { machine: true, inspector: true },
    });

    if (!ref) {
      return NextResponse.json({ error: "Part not found" }, { status: 404 });
    }
    if (ref.status !== "PENDING" && ref.status !== "RE_INSPECT") {
      return NextResponse.json({ error: `Part already processed (status: ${ref.status})` }, { status: 400 });
    }

    // Get operator's active session (optional)
    const machineSession = await prisma.machineSession.findFirst({
      where: { operatorId: session.user.id, status: "ACTIVE" },
    });

    // Machine restriction: part must be scanned on its designated machine
    if (ref.machineId && machineSession) {
      if (ref.machineId !== machineSession.machineId) {
        const partMachineName = ref.machine?.name || ref.machineId;
        return NextResponse.json(
          { error: `This part is assigned to ${partMachineName}. You are checked into a different machine. Please use the correct machine.` },
          { status: 400 }
        );
      }
    } else if (ref.machineId && !machineSession) {
      const partMachineName = ref.machine?.name || ref.machineId;
      return NextResponse.json(
        { error: `This part is assigned to ${partMachineName}. Please check into that machine first.` },
        { status: 400 }
      );
    }

    const operatorTimeIn = new Date(timeIn);
    const operatorTimeOut = new Date();
    // Store in SECONDS for sub-minute accuracy
    const operatorActualTime = Math.round((operatorTimeOut.getTime() - operatorTimeIn.getTime()) / 1000);

    // Update PartReference with operator fields — no separate Inspection record
    const updated = await prisma.partReference.update({
      where: { id: partRefId },
      data: {
        status: "OPERATOR_DONE",
        operatorId: session.user.id,
        operatorResult: result,
        operatorTimeIn,
        operatorTimeOut,
        operatorActualTime,
        operatorNotes: notes || null,
        machineSessionId: machineSession?.id ?? null,
      },
      include: {
        machine: { select: { name: true } },
        inspector: { select: { name: true } },
      },
    });

    // Increment session counter
    if (machineSession) {
      await prisma.machineSession.update({
        where: { id: machineSession.id },
        data: { itemsCompleted: { increment: 1 } },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "OPERATOR_INSPECTION",
        details: `Operator ${result.toLowerCase()} part ${ref.partNumber} (${ref.barcode})`,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        partNumber: updated.partNumber,
        barcode: updated.barcode,
        result,
        machineName: updated.machine?.name ?? null,
        inspectorName: updated.inspector?.name ?? null,
        timeIn: operatorTimeIn.toISOString(),
        timeOut: operatorTimeOut.toISOString(),
        duration: operatorActualTime >= 60 ? `${(operatorActualTime / 60).toFixed(1)} min` : `${operatorActualTime}s`,
      },
    });
  } catch (error: unknown) {
    console.error("Operator submit inspection error:", error);
    const msg = error instanceof Error ? error.message : "Failed to submit inspection";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
