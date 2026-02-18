import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...\n");

  // ──────────────────────────────────────────────
  // 1. Users
  // ──────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("password123", 12);

  const users = await Promise.all([
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
  ]);

  console.log(`✅ Created ${users.length} users`);

  // ──────────────────────────────────────────────
  // 2. Machines
  // ──────────────────────────────────────────────
  const machines = await Promise.all([
    // VMMs
    prisma.machine.upsert({
      where: { name: "VMM-1" },
      update: {},
      create: { name: "VMM-1", type: "VMM", status: "ACTIVE", location: "Bay A - Station 1" },
    }),
    prisma.machine.upsert({
      where: { name: "VMM-2" },
      update: {},
      create: { name: "VMM-2", type: "VMM", status: "ACTIVE", location: "Bay A - Station 2" },
    }),
    prisma.machine.upsert({
      where: { name: "VMM-3" },
      update: {},
      create: { name: "VMM-3", type: "VMM", status: "IDLE", location: "Bay A - Station 3" },
    }),
    prisma.machine.upsert({
      where: { name: "VMM-4" },
      update: {},
      create: { name: "VMM-4", type: "VMM", status: "MAINTENANCE", location: "Bay A - Station 4" },
    }),
    prisma.machine.upsert({
      where: { name: "VMM-5" },
      update: {},
      create: { name: "VMM-5", type: "VMM", status: "ACTIVE", location: "Bay B - Station 1" },
    }),
    prisma.machine.upsert({
      where: { name: "VMM-6" },
      update: {},
      create: { name: "VMM-6", type: "VMM", status: "ACTIVE", location: "Bay B - Station 2" },
    }),
    // CMMs
    prisma.machine.upsert({
      where: { name: "CMM-1" },
      update: {},
      create: { name: "CMM-1", type: "CMM", status: "ACTIVE", location: "Bay C - Station 1" },
    }),
    prisma.machine.upsert({
      where: { name: "CMM-2" },
      update: {},
      create: { name: "CMM-2", type: "CMM", status: "ACTIVE", location: "Bay C - Station 2" },
    }),
    prisma.machine.upsert({
      where: { name: "CMM-3" },
      update: {},
      create: { name: "CMM-3", type: "CMM", status: "IDLE", location: "Bay C - Station 3" },
    }),
    prisma.machine.upsert({
      where: { name: "CMM-4" },
      update: {},
      create: { name: "CMM-4", type: "CMM", status: "SHUTDOWN", location: "Bay C - Station 4" },
    }),
  ]);

  console.log(`✅ Created ${machines.length} machines`);

  // ──────────────────────────────────────────────
  // 3. Parts
  // ──────────────────────────────────────────────
  const partNumbers = Array.from({ length: 30 }, (_, i) => `PN${(1001 + i).toString()}`);

  const parts = await Promise.all(
    partNumbers.map((pn, i) => {
      // Generate deterministic barcode based on part number for consistency
      const partIndex = parseInt(pn.replace('PN', ''));
      const barcode = String(1000000000 + partIndex); // Deterministic: PN1001 -> 1000001001
      
      return prisma.part.upsert({
        where: { partNumber: pn },
        update: {
          barcodeData: barcode, // Always sync to deterministic barcode
        },
        create: {
          partNumber: pn,
          name: `Component ${pn}`,
          description: `Test component for inspection`,
          status: i < 10 ? "QUEUED" : i < 20 ? "IN_INSPECTION" : i < 23 ? "FOR_REVIEW" : "ACCEPTED",
          currentMachineId: i < 10 ? machines[i % machines.length].id : null,
          barcodeData: barcode,
        },
      });
    })
  );

  console.log(`✅ Created ${parts.length} parts (with deterministic barcodes)`);

  // ──────────────────────────────────────────────
  // 3.5. Barcode References (all parts)
  // ──────────────────────────────────────────────
  // Clear existing barcode references to avoid duplicates
  await prisma.partReference.deleteMany({});
  
  const barcodeReferences = await Promise.all(
    parts
      .filter((part) => part.barcodeData) // Only create references for parts with barcodes
      .map((part: typeof parts[number], i: number) => {
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + 30 + Math.floor(Math.random() * 60)); // 30-90 days from now
        const estimatedTime = 15 + Math.floor(Math.random() * 30); // 15-45 minutes
        
        return prisma.partReference.create({
          data: {
            partNumber: part.partNumber,
            barcode: part.barcodeData!,
            estimatedTime: estimatedTime,
            deadline: deadline,
            quantity: 1,
            uploadedById: users[0].id, // Admin user
          },
        });
      })
  );

  console.log(`✅ Created ${barcodeReferences.length} barcode references`);

  // ──────────────────────────────────────────────
  // 4. Queue items (first 10 parts)
  // ──────────────────────────────────────────────
  const priorities = ["HIGH", "MEDIUM", "LOW"] as const;
  const activeMachines = machines.filter((m: typeof machines[number]) => m.status === "ACTIVE");

  const queueItems = await Promise.all(
    parts.slice(0, 10).map((part: typeof parts[number], i: number) => {
      const now = Date.now();
      // Make some items COMPLETED with timing data for historical analytics
      const isCompleted = i >= 7;
      const startOffset = (10 - i) * 3600000; // hours ago
      const duration = 10 + Math.floor(Math.random() * 15); // 10-25 min

      return prisma.inspectionQueue.create({
        data: {
          partId: part.id,
          machineId: activeMachines[i % activeMachines.length].id,
          priority: priorities[i % 3],
          position: Math.floor(i / activeMachines.length) + 1,
          estimatedTime: 10 + Math.floor(Math.random() * 20),
          status: isCompleted ? "COMPLETED" : "WAITING",
          scannedAt: isCompleted ? new Date(now - startOffset) : null,
          scannedBarcode: isCompleted ? part.barcodeData : null,
          queueStartedAt: isCompleted ? new Date(now - startOffset) : null,
          queueCompletedAt: isCompleted ? new Date(now - startOffset + duration * 60000) : null,
          queueActualTime: isCompleted ? duration : null,
          assignedOperatorId: isCompleted ? users[3].id : null,
        },
      });
    })
  );

  console.log(`✅ Created ${queueItems.length} queue items (with timing data)`);

  // ──────────────────────────────────────────────
  // 5. Sample inspections (last 10 parts)
  // ──────────────────────────────────────────────
  const results = ["ACCEPTED", "REJECTED", "ACCEPTED", "ACCEPTED", "REJECTED",
                    "ACCEPTED", "ACCEPTED", "ACCEPTED", "REJECTED", "ACCEPTED"] as const;

  const inspections = await Promise.all(
    parts.slice(20).map((part: typeof parts[number], i: number) => {
      const dayOffset = (10 - i) * 24 * 60 * 60 * 1000;
      const createdAt = new Date(Date.now() - dayOffset);
      const opDuration = 8 + Math.floor(Math.random() * 20); // 8-28 min
      const revDuration = 2 + Math.floor(Math.random() * 8); // 2-10 min
      const hasQA = i < 7; // First 7 have QA decisions

      return prisma.inspection.create({
        data: {
          partId: part.id,
          machineId: machines[i % machines.length].id,
          inspectorId: users[3].id, // operator1 did the initial inspection
          result: results[i],
          notes: results[i] === "REJECTED" ? "Dimensional deviation detected" : "Within tolerance",
          createdAt,
          operatorStartedAt: new Date(createdAt.getTime() - opDuration * 60000),
          operatorCompletedAt: createdAt,
          operatorActualTime: opDuration,
          scannedBarcode: part.barcodeData,
          // Inspector review data
          inspectionStartedAt: hasQA ? new Date(createdAt.getTime() + 600000) : null,
          inspectionCompletedAt: hasQA ? new Date(createdAt.getTime() + 600000 + revDuration * 60000) : null,
          inspectionActualTime: hasQA ? revDuration : null,
          qaDecision: hasQA
            ? results[i] === "ACCEPTED" ? "APPROVED" : (i % 3 === 0 ? "OVERRIDE_ACCEPT" : "OVERRIDE_REJECT")
            : null,
          qaJustification: hasQA
            ? results[i] === "ACCEPTED" ? "Verified and approved" : (i % 3 === 0 ? "Re-measured, within spec" : "Confirmed reject")
            : null,
        },
      });
    })
  );

  console.log(`✅ Created ${inspections.length} inspections (with timing + QA data)`);

  // ──────────────────────────────────────────────
  // 6. GA Configuration
  // ──────────────────────────────────────────────
  const gaConfig = await prisma.gAConfiguration.upsert({
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
      updatedById: users[0].id, // admin
    },
  });

  console.log(`✅ Created GA configuration`);

  // ──────────────────────────────────────────────
  // 7. Sample Machine Sessions
  // ──────────────────────────────────────────────
  const sessionData = [
    { machineId: machines[0].id, operatorId: users[3].id, hoursAgo: 48, durationMin: 240, items: 14, status: "COMPLETED" as const },
    { machineId: machines[1].id, operatorId: users[4].id, hoursAgo: 24, durationMin: 180, items: 10, status: "COMPLETED" as const },
    { machineId: machines[6].id, operatorId: users[3].id, hoursAgo: 12, durationMin: 120, items: 7, status: "COMPLETED" as const },
  ];

  const sessions = await Promise.all(
    sessionData.map((s) =>
      prisma.machineSession.create({
        data: {
          machineId: s.machineId,
          operatorId: s.operatorId,
          startTime: new Date(Date.now() - s.hoursAgo * 3600000),
          endTime: new Date(Date.now() - s.hoursAgo * 3600000 + s.durationMin * 60000),
          status: s.status,
          itemsCompleted: s.items,
          notes: `Completed ${s.items} items in ${s.durationMin} min`,
        },
      })
    )
  );

  console.log(`✅ Created ${sessions.length} sample machine sessions`);

  // ──────────────────────────────────────────────
  // 8. Sample audit logs
  // ──────────────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      { userId: users[0].id, action: "SYSTEM_INIT", details: "System initialized with seed data" },
      { userId: users[0].id, action: "CREATE_MACHINE", details: "Created 10 machines (6 VMM, 4 CMM)" },
      { userId: users[0].id, action: "UPDATE_GA_CONFIG", details: "Set default GA configuration" },
      { userId: users[1].id, action: "SUBMIT_INSPECTION", details: "Inspected PN1021 on VMM-1: ACCEPTED" },
      { userId: users[5].id, action: "QA_OVERRIDE", details: "Overrode inspection for PN1025: OVERRIDE_ACCEPT" },
    ],
  });

  console.log(`✅ Created sample audit logs`);

  console.log("\n🎉 Database seeded successfully!");
  console.log("\n📋 Login Credentials:");
  console.log("   Admin:     admin@xyz.com / password123");
  console.log("   Inspector: inspector1@xyz.com / password123");
  console.log("   Operator:  operator1@xyz.com / password123");
  console.log("   QA/QC:     qa1@xyz.com / password123");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
