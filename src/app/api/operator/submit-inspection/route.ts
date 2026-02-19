import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// POST /api/operator/submit-inspection — Operator submits accept/reject decision
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "OPERATOR") {
    return NextResponse.json({ error: "Only operators can submit inspections" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { barcodeReferenceId, result, timeIn, notes } = body;

    if (!barcodeReferenceId || !result) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (result !== "ACCEPTED" && result !== "REJECTED") {
      return NextResponse.json({ error: "Result must be ACCEPTED or REJECTED" }, { status: 400 });
    }

    // Get the barcode reference
    const reference = await prisma.partReference.findUnique({
      where: { id: barcodeReferenceId },
      include: { machine: true, inspector: true },
    });

    if (!reference) {
      return NextResponse.json({ error: "Barcode reference not found" }, { status: 404 });
    }

    if (!reference.machineId) {
      return NextResponse.json({ error: "No machine assigned to this part" }, { status: 400 });
    }

    // Get operator's active session
    const machineSession = await prisma.machineSession.findFirst({
      where: {
        operatorId: session.user.id,
        status: "ACTIVE",
      },
    });

    // Find or create Part record
    let part = await prisma.part.findFirst({
      where: { partNumber: reference.partNumber },
    });

    if (!part) {
      part = await prisma.part.create({
        data: {
          partNumber: reference.partNumber,
          description: `Part scanned from barcode ${reference.barcode}`,
          status: "PENDING",
        },
      });
    }

    // Calculate operator time (in minutes)
    const operatorStartedAt = new Date(timeIn);
    const operatorCompletedAt = new Date();
    const operatorActualTime = Math.round((operatorCompletedAt.getTime() - operatorStartedAt.getTime()) / 60000);

    // Create Inspection record
    const inspection = await prisma.inspection.create({
      data: {
        partId: part.id,
        inspectorId: reference.inspectorId || session.user.id, // Use assigned inspector or current user
        machineId: reference.machineId,
        machineSessionId: machineSession?.id,
        result: result as "ACCEPTED" | "REJECTED",
        operatorStartedAt,
        operatorCompletedAt,
        operatorActualTime,
        scannedBarcode: reference.barcode,
        notes: notes || null,
      },
      include: {
        part: true,
        inspector: { select: { id: true, name: true } },
        machine: { select: { id: true, name: true, type: true } },
      },
    });

    // Update PartReference to mark as processed and link to inspection
    await prisma.partReference.update({
      where: { id: barcodeReferenceId },
      data: {
        isScanned: true,
        scannedAt: new Date(),
        scannedById: session.user.id,
        inspectionId: inspection.id,
      },
    });

    // Update machine session items completed
    if (machineSession) {
      await prisma.machineSession.update({
        where: { id: machineSession.id },
        data: {
          itemsCompleted: { increment: 1 },
        },
      });
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "OPERATOR_INSPECTION",
        details: `Operator ${result.toLowerCase()} part ${reference.partNumber} (${reference.barcode})`,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        inspection,
        timeIn: operatorStartedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        timeOut: operatorCompletedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        duration: `${operatorActualTime} min`,
      },
    });
  } catch (error: unknown) {
    console.error("Operator submit inspection error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to submit inspection";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
