// Cleanup script to remove extra machines from production database
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const machinesToRemove = ['VMM-4', 'VMM-5', 'VMM-6', 'CMM-3', 'CMM-4'];

async function cleanup() {
  console.log('\n⚠️  WARNING: This will permanently delete the following machines:');
  machinesToRemove.forEach(m => console.log(`   - ${m}`));
  console.log('\n✅ Starting cleanup in 3 seconds...\n');
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  try {
    // Get machine IDs to delete
    const machines = await prisma.machine.findMany({
      where: { name: { in: machinesToRemove } },
      select: { id: true, name: true }
    });
    
    console.log(`Found ${machines.length} machines to delete\n`);
    
    for (const machine of machines) {
      console.log(`Deleting ${machine.name}...`);
      
      // Delete related data first
      const deletedQueues = await prisma.inspectionQueue.deleteMany({
        where: { machineId: machine.id }
      });
      console.log(`  - Deleted ${deletedQueues.count} queue items`);
      
      const deletedSessions = await prisma.machineSession.deleteMany({
        where: { machineId: machine.id }
      });
      console.log(`  - Deleted ${deletedSessions.count} sessions`);
      
      const deletedInspections = await prisma.inspection.deleteMany({
        where: { machineId: machine.id }
      });
      console.log(`  - Deleted ${deletedInspections.count} inspections`);
      
      const deletedRefs = await prisma.partReference.deleteMany({
        where: { machineId: machine.id }
      });
      console.log(`  - Deleted ${deletedRefs.count} part references`);
      
      const deletedShutdownEvents = await prisma.shutdownEvent.deleteMany({
        where: { machineId: machine.id }
      });
      console.log(`  - Deleted ${deletedShutdownEvents.count} shutdown events`);
      
      // Delete the machine itself
      await prisma.machine.delete({
        where: { id: machine.id }
      });
      console.log(`  ✅ ${machine.name} deleted\n`);
    }
    
    // Verify remaining machines
    const remaining = await prisma.machine.findMany({
      orderBy: { name: 'asc' },
      select: { name: true, type: true }
    });
    
    console.log(`\n✅ Cleanup complete! Remaining machines: ${remaining.length}\n`);
    remaining.forEach(m => console.log(`   ${m.name} (${m.type})`));
    
  } catch (error) {
    console.error('\n❌ Cleanup failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();
