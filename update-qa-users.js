/**
 * Update QA_QC users to INSPECTOR role
 * Run this script to update existing users in production
 * 
 * Usage: node update-qa-users.js
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function main() {
  console.log("🔄 Updating QA_QC users to INSPECTOR role...\n");
  console.log("Using database:", process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] || "unknown");
  console.log("");

  try {
    // Update all QA_QC users to INSPECTOR
    const result = await prisma.user.updateMany({
      where: {
        role: "QA_QC",
      },
      data: {
        role: "INSPECTOR",
      },
    });

    console.log(`✅ Updated ${result.count} user(s) from QA_QC to INSPECTOR\n`);

    // List all INSPECTOR users
    const inspectors = await prisma.user.findMany({
      where: {
        role: "INSPECTOR",
      },
      select: {
        accountId: true,
        name: true,
        email: true,
        department: true,
        position: true,
      },
    });

    console.log("📋 Current INSPECTOR users:");
    inspectors.forEach((user) => {
      console.log(`   - ${user.name} (${user.email}) - ${user.position || "N/A"}`);
    });
    console.log("");

    // Summary of all users by role
    const allUsers = await prisma.user.groupBy({
      by: ["role"],
      _count: true,
    });

    console.log("📊 Users by role:");
    allUsers.forEach((group) => {
      console.log(`   - ${group.role}: ${group._count} user(s)`);
    });
    
  } catch (error) {
    console.error("❌ Error updating users:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
