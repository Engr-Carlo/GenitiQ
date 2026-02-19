import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/barcode-scanned — Get all scanned barcodes (for operators and inspectors)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only operators, inspectors, and admins can view scanned barcodes
  if (!["OPERATOR", "INSPECTOR", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const partNumber = searchParams.get("partNumber");
  const barcode = searchParams.get("barcode");

  const where: any = { status: { not: "PENDING" } };
  if (partNumber) where.partNumber = { contains: partNumber, mode: "insensitive" };
  if (barcode) where.barcode = { contains: barcode, mode: "insensitive" };

  const [scannedRefs, total] = await Promise.all([
    prisma.partReference.findMany({
      where,
      include: {
        machine: { select: { id: true, name: true, type: true, status: true } },
        inspector: { select: { id: true, name: true, email: true } },
        uploadedBy: { select: { id: true, name: true, email: true } },
        operator: { select: { id: true, name: true, email: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.partReference.count({ where }),
  ]);

  return NextResponse.json({
    data: scannedRefs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
