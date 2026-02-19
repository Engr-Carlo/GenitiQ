import { NextResponse } from "next/server";

// This endpoint is deprecated — InspectionQueue has been removed.
// Operators now scan barcodes via POST /api/operator/submit-inspection
export async function POST() {
  return NextResponse.json(
    { error: "This endpoint is deprecated. Use POST /api/operator/submit-inspection instead." },
    { status: 410 }
  );
}
