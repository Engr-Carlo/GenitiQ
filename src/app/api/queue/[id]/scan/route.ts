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

  // Get queue item with part
  const queueItem = await prisma.inspectionQueue.findUnique({
    where: { id: queueItemId },
    include: { part: true, machine: { select: { name: true } } },
  });

  if (!queueItem) {
    return NextResponse.json({ error: "Queue item not found" }, { status: 404 });
  }

  // Check if barcode matches the part (if part has existing barcode data)
  const part = queueItem.part;
  let verified = true;
  let message = "Barcode scanned successfully";

  if (part.barcodeData && part.barcodeData !== barcode) {
    // Barcode doesn't match — could be wrong part
    verified = false;
    message = `Barcode mismatch: Expected ${part.barcodeData}, scanned ${barcode}`;
  }

  // Update queue item with scan data
  const now = new Date();
  await prisma.inspectionQueue.update({
    where: { id: queueItemId },
    data: {
      scannedAt: now,
      scannedBarcode: barcode,
    },
  });

  // Update part's barcode data if first scan
  if (!part.barcodeData) {
    await prisma.part.update({
      where: { id: part.id },
      data: {
        barcodeData: barcode,
        scannedAt: now,
        scannedById: session.user.id,
      },
    });
  }

  return NextResponse.json({
    data: {
      verified,
      queueItemId,
      part: {
        id: part.id,
        partNumber: part.partNumber,
        name: part.name,
        barcodeData: barcode,
      },
      machineName: queueItem.machine.name,
    },
    message,
  });
}
