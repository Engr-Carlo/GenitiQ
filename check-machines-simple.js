const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkAll() {
  try {
    console.log('Checking database...\n');
    
    // Check machines
    const machineCount = await prisma.machine.count();
    console.log('Machines:', machineCount);
    
    if (machineCount > 0) {
      const machines = await prisma.machine.findMany({
        select: { id: true, name: true, type: true, status: true },
        orderBy: { name: 'asc' }
      });
      console.log('\nMachine details:');
      machines.forEach(m => {
        console.log(`  ${m.name} - ${m.type} - ${m.status}`);
      });
    }
    
    // Check other tables for comparison
    const userCount = await prisma.user.count();
    const partCount = await prisma.part.count();
    const queueCount = await prisma.inspectionQueue.count();
    
    console.log('\nOther tables:');
    console.log('Users:', userCount);
    console.log('Parts:', partCount);
    console.log('Queue Items:', queueCount);
    
    if (machineCount === 0) {
      console.log('\n⚠️  MACHINES ARE MISSING from database!');
      console.log('Other data exists, but machines have been deleted or never created.');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkAll();
