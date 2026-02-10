import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runGAOptimization } from "@/lib/ga";

// POST /api/queue/optimize — trigger GA re-optimization
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { machineType, configOverride } = body;

  if (!machineType || !["VMM", "CMM"].includes(machineType)) {
    return NextResponse.json({ error: "Valid machineType (VMM | CMM) required" }, { status: 400 });
  }

  try {
    const result = await runGAOptimization(machineType, configOverride);
    return NextResponse.json({
      data: result,
      message: `Queue optimized in ${result.executionTimeMs}ms over ${result.generations} generations`,
    });
  } catch (error: any) {
    console.error("GA optimization error:", error);
    return NextResponse.json(
      { error: "Optimization failed", details: error.message },
      { status: 500 }
    );
  }
}
