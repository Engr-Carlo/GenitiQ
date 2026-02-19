import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database (users + machines only, no parts)...\n");

  // Clean slate
  await prisma.auditLog.deleteMany({});
  await prisma.partReference.deleteMany({});
  await prisma.machineSession.deleteMany({});
  await prisma.machineReport.deleteMany({});
  await prisma.shutdownEvent.deleteMany({});
  await prisma.gAConfiguration.deleteMany({});
  console.log("Cleared old data");

  const pw = await bcrypt.hash("password123", 12);

  const [admin, i1, i2, i3, op1, op2, op3] = await Promise.all([
    prisma.user.upsert({ where: { email: "admin@xyz.com" }, update: {}, create: { accountId: "ACC-ADMIN-001", name: "System Admin", email: "admin@xyz.com", password: pw, role: "ADMIN" } }),
    prisma.user.upsert({ where: { email: "inspector1@xyz.com" }, update: {}, create: { accountId: "ACC-INS-001", name: "Inspector Alice", email: "inspector1@xyz.com", password: pw, role: "INSPECTOR" } }),
    prisma.user.upsert({ where: { email: "inspector2@xyz.com" }, update: {}, create: { accountId: "ACC-INS-002", name: "Inspector Bob", email: "inspector2@xyz.com", password: pw, role: "INSPECTOR" } }),
    prisma.user.upsert({ where: { email: "qa1@xyz.com" }, update: {}, create: { accountId: "ACC-INS-003", name: "QA Carol", email: "qa1@xyz.com", password: pw, role: "INSPECTOR" } }),
    prisma.user.upsert({ where: { email: "operator1@xyz.com" }, update: {}, create: { accountId: "ACC-OP-001", name: "Operator Dan", email: "operator1@xyz.com", password: pw, role: "OPERATOR" } }),
    prisma.user.upsert({ where: { email: "operator2@xyz.com" }, update: {}, create: { accountId: "ACC-OP-002", name: "Operator Eve", email: "operator2@xyz.com", password: pw, role: "OPERATOR" } }),
    prisma.user.upsert({ where: { email: "operator3@xyz.com" }, update: {}, create: { accountId: "ACC-OP-003", name: "Operator Frank", email: "operator3@xyz.com", password: pw, role: "OPERATOR" } }),
  ]);
  console.log("7 users created");

  const [vmm1, vmm2, vmm3, cmm1, cmm2] = await Promise.all([
    prisma.machine.upsert({ where: { name: "VMM-1" }, update: { assignedInspectorId: i1.id }, create: { name: "VMM-1", type: "VMM", status: "ACTIVE", location: "Bay A", assignedInspectorId: i1.id } }),
    prisma.machine.upsert({ where: { name: "VMM-2" }, update: { assignedInspectorId: i2.id }, create: { name: "VMM-2", type: "VMM", status: "ACTIVE", location: "Bay B", assignedInspectorId: i2.id } }),
    prisma.machine.upsert({ where: { name: "VMM-3" }, update: { assignedInspectorId: i3.id }, create: { name: "VMM-3", type: "VMM", status: "ACTIVE", location: "Bay C", assignedInspectorId: i3.id } }),
    prisma.machine.upsert({ where: { name: "CMM-1" }, update: { assignedInspectorId: i1.id }, create: { name: "CMM-1", type: "CMM", status: "ACTIVE", location: "Lab A", assignedInspectorId: i1.id } }),
    prisma.machine.upsert({ where: { name: "CMM-2" }, update: { assignedInspectorId: i2.id }, create: { name: "CMM-2", type: "CMM", status: "ACTIVE", location: "Lab B", assignedInspectorId: i2.id } }),
  ]);
  console.log("5 machines created");

  await prisma.gAConfiguration.create({ data: { populationSize: 50, generations: 100, crossoverRate: 0.8, mutationRate: 0.15, elitismCount: 2, waitTimeWeight: 0.4, utilizationWeight: 0.3, priorityWeight: 0.3, updatedById: admin.id } });
  console.log("GA config created");

  await prisma.auditLog.create({ data: { userId: admin.id, action: "SEED", details: "Database seeded  ready for CSV upload" } });

  console.log("\nDatabase seeded successfully!");
  console.log("\nLogin Credentials:");
  console.log("  Admin:     admin@xyz.com       / password123");
  console.log("  Inspector: inspector1@xyz.com  / password123");
  console.log("  Inspector: inspector2@xyz.com  / password123");
  console.log("  Inspector: qa1@xyz.com         / password123");
  console.log("  Operator:  operator1@xyz.com   / password123");
  console.log("  Operator:  operator2@xyz.com   / password123");
  console.log("  Operator:  operator3@xyz.com   / password123");
  console.log("\nNo parts loaded  download the CSV template from admin and upload to add parts.");
  void [vmm1, vmm2, vmm3, cmm1, cmm2, op1, op2, op3];
}

main().catch(console.error).finally(async () => { await prisma.$disconnect(); });
