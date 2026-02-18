const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function check() {
  try {
    const count = await prisma.machine.count();
    console.log('Total machines in database:', count);
    
    if (count === 0) {
      console.log('\n❌ NO MACHINES FOUND!');
      console.log('Run: npm run db:seed');
    } else {
      const machines = await prisma.machine.findMany({
        select: { name: true, type: true, status: true }
      });
      console.log('\n✅ Machines:');
      machines.forEach(m => console.log(`  - ${m.name} (${m.type}) - ${m.status}`));
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
