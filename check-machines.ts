import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkMachines() {
  try {
    console.log("Checking machines in database...\n");
    
    const machines = await prisma.machine.findMany({
      include: {
        _count: {
          select: {
            sessions: true,
            inspectionQueues: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });
    
    console.log(`Total machines found: ${machines.length}\n`);
    
    if (machines.length === 0) {
      console.log("❌ NO MACHINES FOUND IN DATABASE!");
      console.log("This is why operators and admins cannot see any machines.");
      console.log("\nSuggested fix: Run the seed script to populate machines:");
      console.log("  npm run db:seed");
    } else {
      console.log("✅ Machines found:\n");
      machines.forEach((m) => {
        console.log(`- ${m.name} (${m.type})`);
        console.log(`  Status: ${m.status}`);
        console.log(`  Location: ${m.location || "N/A"}`);
        console.log(`  Sessions: ${m._count.sessions}, Queue Items: ${m._count.inspectionQueues}`);
        console.log("");
      });
    }
    
    // Check if machines have proper statuses
    const activeMachines = machines.filter((m) => m.status === "ACTIVE");
    console.log(`\nActive machines: ${activeMachines.length}`);
    console.log(`Shutdown machines: ${machines.filter((m) => m.status === "SHUTDOWN").length}`);
    console.log(`Maintenance machines: ${machines.filter((m) => m.status === "MAINTENANCE").length}`);
    
  } catch (error) {
    console.error("Error checking machines:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMachines();
