import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyMachineInspector() {
  console.log('🔍 Verifying machine and inspector assignments...\n');

  const references = await prisma.partReference.findMany({
    include: {
      machine: { select: { name: true, type: true, status: true } },
      inspector: { select: { name: true, email: true, role: true } },
    },
    orderBy: { partNumber: 'asc' },
    take: 10,
  });

  console.log(`✅ Total References: ${references.length}\n`);

  console.log('📋 Sample References with Machine & Inspector:\n');
  for (const ref of references) {
    console.log(`${ref.partNumber} (${ref.barcode}):`);
    console.log(`  Machine: ${ref.machine?.name || 'Not assigned'} ${ref.machine ? `(${ref.machine.type})` : ''}`);
    console.log(`  Inspector: ${ref.inspector?.name || 'Available'} ${ref.inspector ? `(${ref.inspector.email})` : ''}`);
    console.log('');
  }

  // Count statistics
  const stats = {
    withMachine: references.filter(r => r.machine).length,
    withInspector: references.filter(r => r.inspector).length,
    withBoth: references.filter(r => r.machine && r.inspector).length,
  };

  console.log('📊 Statistics:');
  console.log(`  With Machine: ${stats.withMachine}/${references.length}`);
  console.log(`  With Inspector: ${stats.withInspector}/${references.length}`);
  console.log(`  With Both: ${stats.withBoth}/${references.length}`);

  await prisma.$disconnect();
}

verifyMachineInspector().catch(console.error);
