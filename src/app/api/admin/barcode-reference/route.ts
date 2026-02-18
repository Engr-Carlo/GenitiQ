import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { UserRole } from "@/types";

// GET /api/admin/barcode-reference — Get all barcode references
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session.user.role as UserRole, "MANAGE_ACCESS")) {
    return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const partNumber = searchParams.get("partNumber");
  const download = searchParams.get("download");

  const where: any = {};
  if (partNumber) where.partNumber = partNumber;

  const references = await prisma.partReference.findMany({
    where,
    include: {
      uploadedBy: {
        select: { id: true, name: true, email: true },
      },
      machine: {
        select: { id: true, name: true, type: true, status: true },
      },
      inspector: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: [{ partNumber: "asc" }, { barcode: "asc" }],
  });

  // If download=template, return CSV template
  if (download === "template") {
    const csv = [
      "partNumber,barcode,estimatedTime,deadline,quantity,machine,inspector",
      "PN1001,1000001001,45,2026-12-31,1,VMM1,inspector1@xyz.com",
      "PN1002,1000001002,30,2026-12-30,1,VMM2,",
      "PN1003,1000001003,60,2027-01-15,1,CMM1,inspector2@xyz.com",
    ].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=barcode-reference-template.csv",
      },
    });
  }

  // If download=current, export current data as CSV
  if (download === "current") {
    const rows = references.map((r: typeof references[number]) => [
      r.partNumber,
      r.barcode,
      r.estimatedTime,
      r.deadline.toISOString().split("T")[0],
      r.quantity,
      r.machine?.name || "",
      r.inspector?.email || "",
    ].join(","));

    const csv = [
      "partNumber,barcode,estimatedTime,deadline,quantity,machine,inspector",
      ...rows,
    ].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=barcode-reference-current.csv",
      },
    });
  }

  return NextResponse.json({ data: references });
}

// DELETE /api/admin/barcode-reference — Delete barcode reference(s)
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session.user.role as UserRole, "MANAGE_ACCESS")) {
    return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const barcode = searchParams.get("barcode");

  if (!id && !barcode) {
    return NextResponse.json({ error: "id or barcode required" }, { status: 400 });
  }

  const where: any = {};
  if (id) where.id = id;
  else if (barcode) where.barcode = barcode;

  await prisma.partReference.delete({ where });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "DELETE_BARCODE_REFERENCE",
      details: `Deleted barcode reference: ${id || barcode}`,
    },
  });

  return NextResponse.json({ success: true, message: "Barcode reference deleted" });
}
