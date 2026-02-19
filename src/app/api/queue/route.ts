import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/queue — returns unscanned PartReferences (replaces old InspectionQueue)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const machineType = searchParams.get("machineType") as "VMM" | "CMM" | null;
  const machineId = searchParams.get("machineId");
  const scanned = searchParams.get("scanned"); // "true" | "false" | null (all)

  const where: any = {};
  if (machineId) where.machineId = machineId;
  if (machineType) where.machine = { type: machineType };
  if (scanned === "true") where.status = { not: "PENDING" };
  else if (scanned === "false" || scanned === null) where.status = "PENDING";

  const refs = await prisma.partReference.findMany({
    where,
    include: {
      machine: { select: { id: true, name: true, type: true } },
      inspector: { select: { id: true, name: true } },
      operator: { select: { id: true, name: true } },
    },
    orderBy: [{ position: "asc" }, { deadline: "asc" }],
  });

  return NextResponse.json({ data: refs });
}
