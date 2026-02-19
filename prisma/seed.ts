import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// â”€â”€ GA priority calculation (same algorithm used in the app) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function calcPriority(
  deadline: Date,
  estimatedTime: number,
  quantity: number
): "HIGH" | "MEDIUM" | "LOW" {
  const hoursToDeadline = (deadline.getTime() - Date.now()) / (1000 * 60 * 60);
  const urgencyScore = Math.max(0, 100 - hoursToDeadline / 2);
  const complexityScore = (estimatedTime / 60) * 50 + (quantity / 10) * 50;
  const fitness = urgencyScore * 0.6 + complexityScore * 0.4;
  if (fitness > 70 || hoursToDeadline < 24) return "HIGH";
  if (fitness > 40 || hoursToDeadline < 72) return "MEDIUM";
  return "LOW";
}

function hoursFromNow(h: number): Date {
  return new Date(Date.now() + h * 3_600_000);
}

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 3_600_000);
}

async function main() {
  console.log("ðŸŒ± Seeding database (current workflow)â€¦\n");

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 0. CLEAN SLATE â€” clear dependent tables first
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  await prisma.auditLog.deleteMany({});
  await prisma.inspection.deleteMany({});
  await prisma.partReference.deleteMany({});
  await prisma.machineSession.deleteMany({});
  await prisma.machineReport.deleteMany({});
  await prisma.shutdownEvent.deleteMany({});
  console.log("âœ… Cleared old data");

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 1. USERS
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const passwordHash = await bcrypt.hash("password123", 12);

  const [admin, inspector1, inspector2, inspector3, operator1, operator2, operator3] =
    await Promise.all([
      prisma.user.upsert({
        where: { email: "admin@xyz.com" },
        update: {},
        create: {
          accountId: "ACC-ADMIN-001",
          name: "System Admin",
          email: "admin@xyz.com",
          password: passwordHash,
          role: "ADMIN",
          department: "IT",
          position: "System Administrator",
        },
      }),
      prisma.user.upsert({
        where: { email: "inspector1@xyz.com" },
        update: {},
        create: {
          accountId: "ACC-INS-001",
          name: "Juan Dela Cruz",
          email: "inspector1@xyz.com",
          password: passwordHash,
          role: "INSPECTOR",
          department: "Quality",
          position: "Senior Inspector",
        },
      }),
      prisma.user.upsert({
        where: { email: "inspector2@xyz.com" },
        update: {},
        create: {
          accountId: "ACC-INS-002",
          name: "Ana Santos",
          email: "inspector2@xyz.com",
          password: passwordHash,
          role: "INSPECTOR",
          department: "Quality",
          position: "Inspector",
        },
      }),
      prisma.user.upsert({
        where: { email: "qa1@xyz.com" },
        update: {},
        create: {
          accountId: "ACC-INS-003",
          name: "Victoria De Jose",
          email: "qa1@xyz.com",
          password: passwordHash,
          role: "INSPECTOR",
          department: "Quality Assurance",
          position: "QA Inspector",
        },
      }),
      prisma.user.upsert({
        where: { email: "operator1@xyz.com" },
        update: {},
        create: {
          accountId: "ACC-OPR-001",
          name: "Pedro Reyes",
          email: "operator1@xyz.com",
          password: passwordHash,
          role: "OPERATOR",
          department: "Production",
          position: "Machine Operator",
        },
      }),
      prisma.user.upsert({
        where: { email: "operator2@xyz.com" },
        update: {},
        create: {
          accountId: "ACC-OPR-002",
          name: "Maria Garcia",
          email: "operator2@xyz.com",
          password: passwordHash,
          role: "OPERATOR",
          department: "Production",
          position: "Machine Operator",
        },
      }),
      prisma.user.upsert({
        where: { email: "operator3@xyz.com" },
        update: {},
        create: {
          accountId: "ACC-OPR-003",
          name: "Carlo Mendoza",
          email: "operator3@xyz.com",
          password: passwordHash,
          role: "OPERATOR",
          department: "Production",
          position: "Machine Operator",
        },
      }),
    ]);

  console.log("âœ… 7 users upserted (1 admin, 3 inspectors, 3 operators)");

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 2. MACHINES (5 total)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [vmm1, vmm2, vmm3, cmm1, cmm2] = await Promise.all([
    prisma.machine.upsert({
      where: { name: "VMM-1" },
      update: { status: "ACTIVE", assignedInspectorId: inspector1.id },
      create: { name: "VMM-1", type: "VMM", status: "ACTIVE", location: "Bay A - Station 1", assignedInspectorId: inspector1.id },
    }),
    prisma.machine.upsert({
      where: { name: "VMM-2" },
      update: { status: "ACTIVE", assignedInspectorId: inspector1.id },
      create: { name: "VMM-2", type: "VMM", status: "ACTIVE", location: "Bay A - Station 2", assignedInspectorId: inspector1.id },
    }),
    prisma.machine.upsert({
      where: { name: "VMM-3" },
      update: { status: "ACTIVE", assignedInspectorId: inspector2.id },
      create: { name: "VMM-3", type: "VMM", status: "ACTIVE", location: "Bay A - Station 3", assignedInspectorId: inspector2.id },
    }),
    prisma.machine.upsert({
      where: { name: "CMM-1" },
      update: { status: "ACTIVE", assignedInspectorId: inspector2.id },
      create: { name: "CMM-1", type: "CMM", status: "ACTIVE", location: "Bay C - Station 1", assignedInspectorId: inspector2.id },
    }),
    prisma.machine.upsert({
      where: { name: "CMM-2" },
      update: { status: "ACTIVE", assignedInspectorId: inspector3.id },
      create: { name: "CMM-2", type: "CMM", status: "ACTIVE", location: "Bay C - Station 2", assignedInspectorId: inspector3.id },
    }),
  ]);

  const machines = [vmm1, vmm2, vmm3, cmm1, cmm2];
  console.log("âœ… 5 machines upserted + inspectors assigned");

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 3. GA CONFIGURATION
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  await prisma.gAConfiguration.upsert({
    where: { id: "default-ga-config" },
    update: {},
    create: {
      id: "default-ga-config",
      populationSize: 50,
      generations: 100,
      crossoverRate: 0.8,
      mutationRate: 0.15,
      elitismCount: 2,
      waitTimeWeight: 0.4,
      utilizationWeight: 0.3,
      priorityWeight: 0.3,
      isActive: true,
      updatedById: admin.id,
    },
  });
  console.log("âœ… GA configuration upserted");

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 4. PART REFERENCES
  //    8 unscanned  (waiting for operators to scan)
  //    7 scanned    â†’ pending QA review by inspector
  //    5 scanned    â†’ fully reviewed (QA decision recorded)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // deadline helper already defined above
  // Each barcode is a unique 10-digit string starting with 2

  const refDefs = [
    // â”€â”€ 8 UNSCANNED â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    { pn: "PN2001", bc: "2000001001", est: 20, dl: hoursFromNow(18),  qty: 5,  mi: 0, ii: 0, scanned: false },
    { pn: "PN2002", bc: "2000001002", est: 35, dl: hoursFromNow(20),  qty: 2,  mi: 1, ii: 0, scanned: false },
    { pn: "PN2003", bc: "2000001003", est: 45, dl: hoursFromNow(50),  qty: 8,  mi: 2, ii: 1, scanned: false },
    { pn: "PN2004", bc: "2000001004", est: 30, dl: hoursFromNow(60),  qty: 3,  mi: 3, ii: 1, scanned: false },
    { pn: "PN2005", bc: "2000001005", est: 25, dl: hoursFromNow(96),  qty: 6,  mi: 4, ii: 2, scanned: false },
    { pn: "PN2006", bc: "2000001006", est: 15, dl: hoursFromNow(120), qty: 1,  mi: 0, ii: 0, scanned: false },
    { pn: "PN2007", bc: "2000001007", est: 60, dl: hoursFromNow(168), qty: 10, mi: 1, ii: 0, scanned: false },
    { pn: "PN2008", bc: "2000001008", est: 40, dl: hoursFromNow(200), qty: 4,  mi: 2, ii: 1, scanned: false },

    // â”€â”€ 7 SCANNED â€” PENDING QA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    { pn: "PN2009", bc: "2000001009", est: 22, dl: hoursFromNow(12),  qty: 3,  mi: 0, ii: 0, scanned: true, opResult: "ACCEPTED" as const, opHA: 2 },
    { pn: "PN2010", bc: "2000001010", est: 18, dl: hoursFromNow(16),  qty: 2,  mi: 1, ii: 0, scanned: true, opResult: "REJECTED" as const, opHA: 3 },
    { pn: "PN2011", bc: "2000001011", est: 30, dl: hoursFromNow(48),  qty: 5,  mi: 2, ii: 1, scanned: true, opResult: "ACCEPTED" as const, opHA: 4 },
    { pn: "PN2012", bc: "2000001012", est: 45, dl: hoursFromNow(55),  qty: 7,  mi: 3, ii: 1, scanned: true, opResult: "ACCEPTED" as const, opHA: 5 },
    { pn: "PN2013", bc: "2000001013", est: 25, dl: hoursFromNow(65),  qty: 4,  mi: 4, ii: 2, scanned: true, opResult: "REJECTED" as const, opHA: 6 },
    { pn: "PN2014", bc: "2000001014", est: 50, dl: hoursFromNow(100), qty: 1,  mi: 0, ii: 0, scanned: true, opResult: "ACCEPTED" as const, opHA: 7 },
    { pn: "PN2015", bc: "2000001015", est: 35, dl: hoursFromNow(140), qty: 6,  mi: 1, ii: 0, scanned: true, opResult: "ACCEPTED" as const, opHA: 8 },

    // â”€â”€ 5 SCANNED â€” FULLY REVIEWED â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    { pn: "PN2016", bc: "2000001016", est: 20, dl: hoursFromNow(72),  qty: 2,  mi: 2, ii: 1, scanned: true, opResult: "ACCEPTED" as const, opHA: 24,  qa: "APPROVED" as const },
    { pn: "PN2017", bc: "2000001017", est: 30, dl: hoursFromNow(80),  qty: 3,  mi: 3, ii: 1, scanned: true, opResult: "REJECTED" as const, opHA: 48,  qa: "OVERRIDE_ACCEPT" as const },
    { pn: "PN2018", bc: "2000001018", est: 40, dl: hoursFromNow(120), qty: 5,  mi: 4, ii: 2, scanned: true, opResult: "ACCEPTED" as const, opHA: 72,  qa: "APPROVED" as const },
    { pn: "PN2019", bc: "2000001019", est: 25, dl: hoursFromNow(150), qty: 1,  mi: 0, ii: 0, scanned: true, opResult: "REJECTED" as const, opHA: 96,  qa: "OVERRIDE_REJECT" as const },
    { pn: "PN2020", bc: "2000001020", est: 15, dl: hoursFromNow(200), qty: 4,  mi: 1, ii: 0, scanned: true, opResult: "ACCEPTED" as const, opHA: 120, qa: "APPROVED" as const },
  ];

  const inspectors = [inspector1, inspector2, inspector3];
  const operators  = [operator1, operator2, operator3];
  let scannedCount = 0;

  for (const def of refDefs) {
    const machine   = machines[def.mi];
    const inspector = inspectors[def.ii];

    if (!def.scanned) {
      // Unscanned â€” just create the PartReference
      await prisma.partReference.create({
        data: {
          partNumber:    def.pn,
          barcode:       def.bc,
          estimatedTime: def.est,
          deadline:      def.dl,
          quantity:      def.qty,
          machineId:     machine.id,
          inspectorId:   inspector.id,
          uploadedById:  admin.id,
          isScanned:     false,
        },
      });
    } else {
      const opHA = def.opHA ?? 2;
      const opStart = hoursAgo(opHA + def.est / 60);
      const opEnd   = hoursAgo(opHA);
      const opMin   = Math.max(1, Math.round(def.est * (0.85 + Math.random() * 0.3)));
      const operator = operators[scannedCount % operators.length];
      scannedCount++;

      // Inspector review timing (only if QA decision exists)
      let inspStartedAt:    Date | null = null;
      let inspCompletedAt:  Date | null = null;
      let inspActualTime:   number | null = null;
      let qaReviewedAt:     Date | null = null;

      if (def.qa) {
        inspStartedAt   = new Date(opEnd.getTime() + 30 * 60_000);
        const revMin    = 3 + Math.floor(Math.random() * 8);
        inspCompletedAt = new Date(inspStartedAt.getTime() + revMin * 60_000);
        inspActualTime  = revMin;
        qaReviewedAt    = inspCompletedAt;
      }

      const qaJustMap: Record<string, string> = {
        APPROVED:        "Verified and approved â€” within tolerance",
        OVERRIDE_ACCEPT: "Re-measured; dimensions within acceptable range",
        OVERRIDE_REJECT: "Confirmed reject â€” deviation exceeds limit",
      };

      // Create Inspection record
      const inspection = await prisma.inspection.create({
        data: {
          inspectorId:          inspector.id,
          machineId:            machine.id,
          result:               def.opResult!,
          notes:                def.opResult === "REJECTED" ? "Dimensional deviation detected" : "Within tolerance",
          operatorStartedAt:    opStart,
          operatorCompletedAt:  opEnd,
          operatorActualTime:   opMin,
          scannedBarcode:       def.bc,
          qaDecision:           def.qa ?? null,
          qaJustification:      def.qa ? (qaJustMap[def.qa] ?? null) : null,
          qaReviewedAt,
          qaReviewerId:         def.qa ? inspector.id : null,
          inspectionStartedAt:  inspStartedAt,
          inspectionCompletedAt: inspCompletedAt,
          inspectionActualTime: inspActualTime,
          createdAt:            opEnd,
        },
      });

      // Create PartReference linked to inspection
      await prisma.partReference.create({
        data: {
          partNumber:    def.pn,
          barcode:       def.bc,
          estimatedTime: def.est,
          deadline:      def.dl,
          quantity:      def.qty,
          machineId:     machine.id,
          inspectorId:   inspector.id,
          uploadedById:  admin.id,
          isScanned:     true,
          scannedAt:     opEnd,
          scannedById:   operator.id,
          inspectionId:  inspection.id,
        },
      });
    }
  }

  const unscannedCount = refDefs.filter(d => !d.scanned).length;
  const pendingQA      = refDefs.filter(d => d.scanned && !d.qa).length;
  const reviewed       = refDefs.filter(d => d.scanned && d.qa).length;

  console.log(`âœ… ${refDefs.length} PartReferences created:`);
  console.log(`   â€¢ ${unscannedCount} unscanned  (waiting for operators)`);
  console.log(`   â€¢ ${pendingQA} pending QA (awaiting inspector review)`);
  console.log(`   â€¢ ${reviewed} fully reviewed`);

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 5. MACHINE SESSIONS (all COMPLETED â€” no active ones by default)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const sessionDefs = [
    { machine: vmm1, operator: operator1, ha: 8,   durMin: 180, items: 6 },
    { machine: vmm2, operator: operator2, ha: 16,  durMin: 240, items: 9 },
    { machine: cmm1, operator: operator3, ha: 24,  durMin: 120, items: 4 },
    { machine: vmm3, operator: operator1, ha: 32,  durMin: 200, items: 7 },
    { machine: cmm2, operator: operator2, ha: 48,  durMin: 160, items: 5 },
  ];

  await Promise.all(
    sessionDefs.map(({ machine, operator, ha, durMin, items }) =>
      prisma.machineSession.create({
        data: {
          machineId:      machine.id,
          operatorId:     operator.id,
          startTime:      hoursAgo(ha + durMin / 60),
          endTime:        hoursAgo(ha),
          status:         "COMPLETED",
          itemsCompleted: items,
          notes:          `Completed ${items} items in ${durMin} min`,
        },
      })
    )
  );
  console.log(`âœ… ${sessionDefs.length} machine sessions created (all COMPLETED)`);

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 6. AUDIT LOGS
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  await prisma.auditLog.createMany({
    data: [
      { userId: admin.id,      action: "SYSTEM_INIT",         details: "System reseeded for barcode-scan workflow" },
      { userId: admin.id,      action: "UPLOAD_BARCODE_REF",  details: `Uploaded ${refDefs.length} barcode references` },
      { userId: operator1.id,  action: "OPERATOR_INSPECTION", details: "Accepted PN2009 on VMM-1" },
      { userId: operator2.id,  action: "OPERATOR_INSPECTION", details: "Rejected PN2010 on VMM-2" },
      { userId: inspector1.id, action: "QA_REVIEW",           details: "Approved PN2016 â€” within tolerance" },
      { userId: inspector2.id, action: "QA_OVERRIDE",         details: "Override-accepted PN2017 â€” re-measured within spec" },
      { userId: inspector3.id, action: "QA_REVIEW",           details: "Approved PN2018" },
    ],
  });
  console.log("âœ… Audit logs created");

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // SUMMARY
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log("\nðŸŽ‰ Database seeded successfully!\n");
  console.log("â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”");
  console.log("â”‚                   Login Credentials                    â”‚");
  console.log("â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤");
  console.log("â”‚  Admin:      admin@xyz.com       / password123         â”‚");
  console.log("â”‚  Inspector:  inspector1@xyz.com  / password123         â”‚");
  console.log("â”‚  Inspector:  inspector2@xyz.com  / password123         â”‚");
  console.log("â”‚  Inspector:  qa1@xyz.com         / password123         â”‚");
  console.log("â”‚  Operator:   operator1@xyz.com   / password123         â”‚");
  console.log("â”‚  Operator:   operator2@xyz.com   / password123         â”‚");
  console.log("â”‚  Operator:   operator3@xyz.com   / password123         â”‚");
  console.log("â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜");

  console.log("\nðŸ“‹ Unscanned barcodes (operators can scan these):");
  refDefs.filter(d => !d.scanned).forEach(d => {
    const p = calcPriority(d.dl, d.est, d.qty);
    console.log(`   ${d.bc}  â†’  ${d.pn}  [${p}]`);
  });
}

main()
  .catch((e) => {
    console.error("âŒ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
