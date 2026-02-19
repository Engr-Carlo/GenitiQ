import { NextResponse } from "next/server";

// Deprecated  InspectionQueue removed. Operators work directly through barcode scanning.
export async function PATCH() {
  return NextResponse.json(
    { error: "Deprecated. Use POST /api/operator/submit-inspection instead." },
    { status: 410 }
  );
}
