import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyBarcodes() {
  console.log('🔍 Verifying barcode synchronization...\n');

  // Get all parts with their barcode references
  const parts = await prisma.part.findMany({
    select: {
      partNumber: true,
      barcodeData: true,
    },
    orderBy: {
      partNumber: 'asc',
    },
  });

  const references = await prisma.partReference.findMany({
    select: {
      partNumber: true,
      barcode: true,
    },
    orderBy: {
      partNumber: 'asc',
    },
  });

  // Check for mismatches
  const mismatches: Array<{partNumber: string; partBarcode: string | null; refBarcode: string}> = [];
  
  for (const ref of references) {
    const part = parts.find(p => p.partNumber === ref.partNumber);
    if (part && part.barcodeData !== ref.barcode) {
      mismatches.push({
        partNumber: ref.partNumber,
        partBarcode: part.barcodeData,
        refBarcode: ref.barcode,
      });
    }
  }

  // Display results
  console.log(`✅ Total Parts: ${parts.length}`);
  console.log(`✅ Total Barcode References: ${references.length}`);
  console.log(`\n${mismatches.length === 0 ? '✅' : '❌'} Barcode Mismatches: ${mismatches.length}\n`);

  if (mismatches.length > 0) {
    console.log('❌ MISMATCHES FOUND:');
    for (const mismatch of mismatches) {
      console.log(`  ${mismatch.partNumber}: Part="${mismatch.partBarcode}" vs Ref="${mismatch.refBarcode}"`);
    }
  } else {
    console.log('🎉 All barcodes are synchronized!');
    console.log('\n📋 Sample verified barcodes:');
    for (let i = 0; i < Math.min(5, references.length); i++) {
      const ref = references[i];
      const part = parts.find(p => p.partNumber === ref.partNumber);
      console.log(`  ${ref.partNumber}: ${ref.barcode} ${part?.barcodeData === ref.barcode ? '✅' : '❌'}`);
    }
  }

  await prisma.$disconnect();
}

verifyBarcodes().catch(console.error);
