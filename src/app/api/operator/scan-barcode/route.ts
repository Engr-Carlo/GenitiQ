import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { runGAOptimization } from "@/lib/ga";

/**
 * GET /api/operator/scan-barcode?barcode=<barcode>
 *
 * Called by the operator when they scan a barcode.
 * 1. Look up the PartReference by barcode.
 * 2. If the part has no assigned machine yet (machineId = null) but has a
 *    machineType scalar, run GA optimisation synchronously — this distributes
 *    ALL pending parts of that type across the available active/idle machines
 *    (vmm1 / vmm2 / vmm3 / cmm1 / cmm2).  Shutdown machines are automatically
 *    excluded by the GA because it only queries status IN (ACTIVE, IDLE).
 * 3. Re-fetch the part so the newly-assigned machine is included in the response.
 * 4. Return the part data to the operator UI.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "OPERATOR") {
    return NextResponse.json({ error: "Operator access only" }, { status: 403 });
  }

  const barcode = new URL(req.url).searchParams.get("barcode");
  if (!barcode) {
    return NextResponse.json({ error: "barcode query parameter is required" }, { status: 400 });
  }

  try {
    // 1. Find the part
    const part = await prisma.partReference.findFirst({
      where: { barcode },
      include: {
        machine: { select: { id: true, name: true, type: true, status: true } },
        inspector: { select: { id: true, name: true, email: true } },
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!part) {
      return NextResponse.json({ error: "Barcode not found in system. Please contact admin." }, { status: 404 });
    }

    if (part.status !== "PENDING" && part.status !== "RE_INSPECT") {
      return NextResponse.json(
        {
          error: `This part (${part.partNumber}) is already processed (status: ${part.status}). Contact inspector if re-work is needed.`,
        },
        { status: 400 }
      );
    }

    // 2. If no specific machine assigned yet, run GA to assign one now.
    //    The GA handles all pending parts of the same type, distributes them
    //    optimally across active/idle machines and writes machineId back to DB.
    if (!part.machineId) {
      const machineType = (part as any).machineType as "VMM" | "CMM" | null;
      if (machineType) {
        try {
          await runGAOptimization(machineType);
        } catch (e) {
          // Non-fatal — if GA fails (e.g. no active machines) the scan can still proceed
          console.error("[GA] scan-time optimisation failed:", e);
        }
      }
    }

    // 3. Re-fetch so the GA-assigned machineId / machine relation is fresh
    const updated = await prisma.partReference.findUnique({
      where: { id: part.id },
      include: {
        machine: { select: { id: true, name: true, type: true, status: true } },
        inspector: { select: { id: true, name: true, email: true } },
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to look up barcode";
    console.error("scan-barcode error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
