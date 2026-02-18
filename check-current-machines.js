// Quick check to see current machines in database
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  try {
    const machines = await prisma.machine.findMany({
      orderBy: { name: 'asc' },
      select: { name: true, type: true, status: true }
    });
    
    console.log(`\nTotal machines: ${machines.length}\n`);
    machines.forEach(m => {
      console.log(`  ${m.name} - ${m.type} - ${m.status}`);
    });
    
    console.log(`\n✅ Should have exactly 5 machines: VMM-1, VMM-2, VMM-3, CMM-1, CMM-2\n`);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
