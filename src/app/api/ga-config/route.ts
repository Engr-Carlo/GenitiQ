import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/ga-config
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const config = await prisma.gAConfiguration.findFirst({
    where: { isActive: true },
  });

  return NextResponse.json({ data: config });
}

// PUT /api/ga-config — update GA configuration
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const {
    populationSize,
    generations,
    crossoverRate,
    mutationRate,
    elitismCount,
    waitTimeWeight,
    utilizationWeight,
    priorityWeight,
  } = body;

  // Deactivate existing
  await prisma.gAConfiguration.updateMany({
    where: { isActive: true },
    data: { isActive: false },
  });

  const config = await prisma.gAConfiguration.create({
    data: {
      populationSize: populationSize || 50,
      generations: generations || 100,
      crossoverRate: crossoverRate || 0.8,
      mutationRate: mutationRate || 0.15,
      elitismCount: elitismCount || 2,
      waitTimeWeight: waitTimeWeight || 0.4,
      utilizationWeight: utilizationWeight || 0.3,
      priorityWeight: priorityWeight || 0.3,
      isActive: true,
      updatedById: session.user.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE_GA_CONFIG",
      details: `Updated GA config: pop=${config.populationSize}, gen=${config.generations}, cr=${config.crossoverRate}, mr=${config.mutationRate}`,
    },
  });

  return NextResponse.json({ data: config });
}
