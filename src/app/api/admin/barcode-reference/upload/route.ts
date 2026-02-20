import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { UserRole } from "@/types";

// POST /api/admin/barcode-reference/upload — Upload CSV with barcode references
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session.user.role as UserRole, "MANAGE_ACCESS")) {
    return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.name.endsWith(".csv")) {
      return NextResponse.json({ error: "File must be a CSV" }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

    if (lines.length < 2) {
      return NextResponse.json({ error: "CSV file is empty or has no data rows" }, { status: 400 });
    }

    // Parse CSV
    const header = lines[0].split(",").map((h) => h.trim());
    const requiredHeaders = ["partNumber", "barcode", "estimatedTime", "deadline", "quantity"];
    const optionalHeaders = ["machine", "productionMachine"];

    const VALID_PRODUCTION_MACHINES = ["Micron", "Brother", "Okuma"];

    const missingHeaders = requiredHeaders.filter((h) => !header.includes(h));
    if (missingHeaders.length > 0) {
      return NextResponse.json({
        error: `Missing required columns: ${missingHeaders.join(", ")}`,
        requiredHeaders,
        optionalHeaders,
      }, { status: 400 });
    }

    const data = [];
    const errors = [];

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(",").map((c) => c.trim());
      if (row.length !== header.length) {
        errors.push({ row: i + 1, error: "Column count mismatch" });
        continue;
      }

      const rowData: Record<string, string> = {};
      header.forEach((h, idx) => {
        rowData[h] = row[idx];
      });

      // Validate
      if (!rowData.partNumber || !rowData.barcode) {
        errors.push({ row: i + 1, error: "partNumber and barcode are required" });
        continue;
      }

      const estimatedTime = parseInt(rowData.estimatedTime);
      const quantity = parseInt(rowData.quantity || "1");

      if (isNaN(estimatedTime) || estimatedTime < 1) {
        errors.push({ row: i + 1, error: "estimatedTime must be a positive number" });
        continue;
      }

      if (isNaN(quantity) || quantity < 1) {
        errors.push({ row: i + 1, error: "quantity must be a positive number" });
        continue;
      }

      const deadline = new Date(rowData.deadline);
      if (isNaN(deadline.getTime())) {
        errors.push({ row: i + 1, error: "Invalid deadline format (use YYYY-MM-DD or ISO date)" });
        continue;
      }

      // Validate machine if provided
      let machineId: string | undefined;
      if (rowData.machine && rowData.machine.trim()) {
        const machine = await prisma.machine.findUnique({
          where: { name: rowData.machine.trim() },
          select: { id: true },
        });
        if (!machine) {
          errors.push({ row: i + 1, error: `Machine '${rowData.machine}' not found` });
          continue;
        }
        machineId = machine.id;
      }

      // Parse productionMachine — optional, free text with known-brand validation
      let productionMachine: string | undefined;
      if (rowData.productionMachine && rowData.productionMachine.trim()) {
        // Normalise capitalisation: "micron" -> "Micron"
        const input = rowData.productionMachine.trim();
        const matched = VALID_PRODUCTION_MACHINES.find(
          (b) => b.toLowerCase() === input.toLowerCase()
        );
        // Accept known brands (normalised) or unknown brands as-is (fallback speed 0.50)
        productionMachine = matched ?? input;
      }

      data.push({
        partNumber: rowData.partNumber,
        barcode: rowData.barcode,
        estimatedTime,
        deadline,
        quantity,
        machineId,
        productionMachine,
      });
    }

    if (errors.length > 0) {
      return NextResponse.json({
        error: "CSV validation failed",
        errors,
        validRowsCount: data.length,
      }, { status: 400 });
    }

    // Upsert to database
    const results = {
      created: 0,
      updated: 0,
      errors: [] as any[],
    };

    for (const item of data) {
      try {
        await prisma.partReference.upsert({
          where: { barcode: item.barcode },
          update: {
            partNumber: item.partNumber,
            estimatedTime: item.estimatedTime,
            deadline: item.deadline,
            quantity: item.quantity,
            machineId: item.machineId ?? null,
            productionMachine: item.productionMachine ?? null,
            uploadedById: session.user.id,
          } as any,
          create: {
            partNumber: item.partNumber,
            barcode: item.barcode,
            estimatedTime: item.estimatedTime,
            deadline: item.deadline,
            quantity: item.quantity,
            machineId: item.machineId ?? null,
            productionMachine: item.productionMachine ?? null,
            uploadedById: session.user.id,
          } as any,
        });

        // Check if it was an update or create by checking if barcode existed
        const existing = await prisma.partReference.findUnique({
          where: { barcode: item.barcode },
          select: { createdAt: true, updatedAt: true },
        });

        if (existing && existing.createdAt.getTime() !== existing.updatedAt.getTime()) {
          results.updated++;
        } else {
          results.created++;
        }
      } catch (error: any) {
        results.errors.push({
          barcode: item.barcode,
          error: error.message,
        });
      }
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPLOAD_BARCODE_REFERENCE",
        details: `Uploaded ${data.length} barcode references: ${results.created} created, ${results.updated} updated`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Barcode references uploaded successfully",
      results,
    });
  } catch (error: any) {
    console.error("Failed to upload barcode references:", error);
    return NextResponse.json({ error: error.message || "Upload failed" }, { status: 500 });
  }
}
