import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/machine-reports — fetch all machine reports
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const reports = await prisma.machineReport.findMany({
    include: {
      machine: { select: { id: true, name: true, type: true, status: true } },
      reportedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ data: reports });
}

// POST /api/machine-reports — create a new report
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { machineId, reason } = body;

  if (!machineId || !reason) {
    return NextResponse.json({ error: "Machine and reason are required" }, { status: 400 });
  }

  const report = await prisma.machineReport.create({
    data: {
      machineId,
      reportedById: session.user.id,
      reason,
    },
    include: {
      machine: { select: { id: true, name: true, type: true, status: true } },
      reportedBy: { select: { id: true, name: true, email: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "MACHINE_REPORT",
      details: `Report submitted for ${report.machine.name}: ${reason}`,
    },
  });

  return NextResponse.json({ data: report });
}

// PATCH /api/machine-reports — resolve a report
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "INSPECTOR")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const { id, status } = body;

  if (!id || !status) {
    return NextResponse.json({ error: "Report ID and status are required" }, { status: 400 });
  }

  const report = await prisma.machineReport.update({
    where: { id },
    data: { status },
    include: {
      machine: { select: { id: true, name: true, type: true, status: true } },
      reportedBy: { select: { id: true, name: true, email: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "MACHINE_REPORT_UPDATE",
      details: `Report for ${report.machine.name} marked as ${status}`,
    },
  });

  return NextResponse.json({ data: report });
}
