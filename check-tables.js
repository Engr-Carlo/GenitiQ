const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkTables() {
  try {
    const result = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    
    console.log('\n📋 Tables in public schema:');
    if (result.length === 0) {
      console.log('  ⚠️  No tables found!');
    } else {
      result.forEach(row => {
        console.log(`  - ${row.table_name}`);
      });
    }
    console.log('');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkTables();
