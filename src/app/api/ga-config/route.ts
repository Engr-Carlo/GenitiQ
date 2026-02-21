import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

const DEFAULT_THRESHOLDS = {
  highFitnessThreshold: 70,
  highHoursThreshold: 24,
  mediumFitnessThreshold: 45,
  mediumHoursThreshold: 72,
};

// GET /api/ga-config — readable by any authenticated user
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await prisma.gAConfiguration.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    data: config
      ? {
          ...config,
          highFitnessThreshold:   config.highFitnessThreshold   ?? 70,
          highHoursThreshold:     config.highHoursThreshold     ?? 24,
          mediumFitnessThreshold: config.mediumFitnessThreshold ?? 45,
          mediumHoursThreshold:   config.mediumHoursThreshold   ?? 72,
        }
      : DEFAULT_THRESHOLDS,
  });
}

// PUT /api/ga-config — Admin only
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const {
    populationSize, generations, crossoverRate, mutationRate,
    elitismCount, waitTimeWeight, utilizationWeight, priorityWeight,
    highFitnessThreshold, highHoursThreshold,
    mediumFitnessThreshold, mediumHoursThreshold,
  } = body;

  const highF = Number(highFitnessThreshold ?? 70);
  const highH = Number(highHoursThreshold   ?? 24);
  const medF  = Number(mediumFitnessThreshold ?? 45);
  const medH  = Number(mediumHoursThreshold   ?? 72);

  if (highF <= medF) {
    return NextResponse.json({ error: "HIGH fitness threshold must be greater than MEDIUM fitness threshold" }, { status: 400 });
  }
  if (highH >= medH) {
    return NextResponse.json({ error: "HIGH hours threshold must be less than MEDIUM hours threshold (hours to deadline)" }, { status: 400 });
  }

  await prisma.gAConfiguration.updateMany({ where: { isActive: true }, data: { isActive: false } });

  const config = await prisma.gAConfiguration.create({
    data: {
      populationSize:         populationSize   || 50,
      generations:            generations      || 100,
      crossoverRate:          crossoverRate    || 0.8,
      mutationRate:           mutationRate     || 0.15,
      elitismCount:           elitismCount     || 2,
      waitTimeWeight:         waitTimeWeight   || 0.4,
      utilizationWeight:      utilizationWeight || 0.3,
      priorityWeight:         priorityWeight   || 0.3,
      highFitnessThreshold:   highF,
      highHoursThreshold:     highH,
      mediumFitnessThreshold: medF,
      mediumHoursThreshold:   medH,
      isActive:               true,
      updatedById:            session.user.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId:  session.user.id,
      action:  "UPDATE_GA_CONFIG",
      details: `GA thresholds updated — HIGH: f>${highF} or h<${highH}h | MEDIUM: f>${medF} or h<${medH}h`,
    },
  });

  return NextResponse.json({ data: config, success: true });
}

