/**
 * Production Database Seeder
 * Run this to seed your production Neon database with test accounts
 * 
 * Usage: node seed-production.js
 */

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

// Use the production DATABASE_URL from environment
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function main() {
  console.log("🌱 Seeding PRODUCTION database...\n");
  console.log("Using database:", process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] || "unknown");
  console.log("");

  const passwordHash = await bcrypt.hash("password123", 12);

  // Create users
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

  console.log(`✅ Created ${users.length} users\n`);

  // Create GA Configuration
  await prisma.gAConfiguration.upsert({
    where: { id: "default-config" },
    update: {},
    create: {
      id: "default-config",
      populationSize: 50,
      generations: 100,
      mutationRate: 0.01,
      crossoverRate: 0.7,
      elitismCount: 2,
      waitTimeWeight: 0.4,
      utilizationWeight: 0.3,
      priorityWeight: 0.3,
    },
  });

  console.log("✅ Created GA configuration\n");

  console.log("🎉 Production database seeded successfully!\n");
  console.log("📋 Login Credentials:");
  console.log("   Admin:     admin@xyz.com / password123");
  console.log("   Inspector: inspector1@xyz.com / password123");
  console.log("   Operator:  operator1@xyz.com / password123");
  console.log("   QA/QC:     qa1@xyz.com / password123");
  console.log("");
  console.log("⚠️  IMPORTANT: Change these default passwords immediately after first login!");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
