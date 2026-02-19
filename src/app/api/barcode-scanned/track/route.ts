import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// POST /api/barcode-scanned/track — Mark barcode as scanned by operator
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "OPERATOR") {
    return NextResponse.json({ error: "Forbidden - Operators only" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { barcodeReferenceId } = body;

    if (!barcodeReferenceId) {
      return NextResponse.json({ error: "Missing barcodeReferenceId" }, { status: 400 });
    }

    // Mark the PartReference as scanned — status moves to PENDING (already is, tracking only)
    const updated = await prisma.partReference.update({
      where: { id: barcodeReferenceId },
      data: {
        operatorId: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    console.error("Error tracking barcode scan:", error);
    return NextResponse.json(
      { error: error.message || "Failed to track scan" },
      { status: 500 }
    );
  }
}
