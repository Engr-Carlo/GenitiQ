/**
 * Verify database state after migration
 * 
 * Usage: node verify-database.js
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log("\n🔍 Verifying Database State\n");
  console.log("=".repeat(50));

  try {
    // Check users
    const users = await prisma.user.findMany({
      select: {
        accountId: true,
        name: true,
        email: true,
        role: true,
        department: true,
      },
    });

    console.log("\n👥 USERS:");
    users.forEach((user) => {
      console.log(`   ${user.accountId} | ${user.name.padEnd(20)} | ${user.role.padEnd(10)} | ${user.email}`);
    });

    // Check users by role
    const roleCount = await prisma.user.groupBy({
      by: ["role"],
      _count: true,
    });

    console.log("\n📊 USERS BY ROLE:");
    roleCount.forEach((group) => {
      console.log(`   ${group.role}: ${group._count}`);
    });

    // Check machines
    const machines = await prisma.machine.count();
    console.log(`\n🏭 MACHINES: ${machines}`);

    // Check parts
    const parts = await prisma.part.count();
    console.log(`📦 PARTS: ${parts}`);

    // Check inspections
    const inspections = await prisma.inspection.count();
    console.log(`🔍 INSPECTIONS: ${inspections}`);

    // Check queue
    const queueItems = await prisma.inspectionQueue.count();
    console.log(`📋 QUEUE ITEMS: ${queueItems}`);

    // Check GA Configuration
    const gaConfig = await prisma.gAConfiguration.findFirst();
    console.log(`⚙️  GA CONFIG: ${gaConfig ? "✓ Configured" : "✗ Not configured"}`);

    console.log("\n" + "=".repeat(50));
    console.log("✅ Database verification complete!\n");

  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error("\nPlease run: npx prisma db push\n");
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
