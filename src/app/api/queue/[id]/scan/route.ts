import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// POST /api/queue/[id]/scan — Scan barcode to verify part before starting
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: queueItemId } = await params;
  const body = await req.json();
  const { barcode } = body;

  if (!barcode) {
    return NextResponse.json({ error: "Barcode is required" }, { status: 400 });
  }

  // STRICT VALIDATION: Check if barcode exists in PartReference
  const barcodeRef = await prisma.partReference.findUnique({
    where: { barcode },
  });

  if (!barcodeRef) {
    return NextResponse.json({
      error: "Barcode not found",
      message: "This barcode is not registered in the system. Please contact admin.",
      verified: false,
    }, { status: 404 });
  }

  // Get queue item with part
  const queueItem = await prisma.inspectionQueue.findUnique({
    where: { id: queueItemId },
    include: { part: true, machine: { select: { name: true } } },
  });

  if (!queueItem) {
    return NextResponse.json({ error: "Queue item not found" }, { status: 404 });
  }

  const part = queueItem.part;

  // Verify part number matches
  if (part.partNumber !== barcodeRef.partNumber) {
    return NextResponse.json({
      error: "Part number mismatch",
      message: `Scanned barcode is for ${barcodeRef.partNumber}, but queue item is for ${part.partNumber}`,
      verified: false,
    }, { status: 400 });
  }

  // Update queue item with scan data and reference info
  const now = new Date();
  await prisma.inspectionQueue.update({
    where: { id: queueItemId },
    data: {
      scannedAt: now,
      scannedBarcode: barcode,
      estimatedTime: barcodeRef.estimatedTime, // Auto-populate from reference
    },
  });

  // Update part's barcode data
  await prisma.part.update({
    where: { id: part.id },
    data: {
      barcodeData: barcode,
      scannedAt: now,
      scannedById: session.user.id,
    },
  });

  return NextResponse.json({
    data: {
      verified: true,
      queueItemId,
      part: {
        id: part.id,
        partNumber: part.partNumber,
        name: part.name,
        barcodeData: barcode,
      },
      reference: {
        estimatedTime: barcodeRef.estimatedTime,
        deadline: barcodeRef.deadline,
        quantity: barcodeRef.quantity,
      },
      machineName: queueItem.machine.name,
    },
    message: "Barcode verified successfully",
  });
}
