const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testAPIQuery() {
  try {
    console.log('Testing the exact query from /api/machines endpoint...\n');
    
    // This is the exact query from the API
    const machines = await prisma.machine.findMany({
      where: {},
      include: {
        _count: {
          select: { inspectionQueues: { where: { status: "WAITING" } } },
        },
        sessions: {
          where: { status: "ACTIVE" },
          include: {
            operator: { select: { id: true, name: true, accountId: true } },
          },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    });
    
    console.log(`Query returned ${machines.length} machines\n`);
    
    // Transform like the API does
    const result = machines.map((m) => {
      const activeSession = m.sessions[0] || null;
      return {
        id: m.id,
        name: m.name,
        type: m.type,
        status: m.status,
        location: m.location,
        queueLength: m._count.inspectionQueues,
        hasActiveSession: !!activeSession,
        currentOperator: activeSession?.operator || null,
      };
    });
    
    console.log('Transformed results:');
    result.forEach(m => {
      console.log(`  ${m.name} - ${m.status} - Queue: ${m.queueLength} - InUse: ${m.hasActiveSession}`);
    });
    
    console.log('\n✅ API query works! If machines are not visible, issue is in frontend.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testAPIQuery();
