// npm run seed  → resets isolates and loads the deterministic synthetic demo data (design §8).
import { PrismaClient } from '@prisma/client';
import { seedDatabase } from '../lib/seed/apply';

async function main() {
  const prisma = new PrismaClient();
  try {
    const res = await seedDatabase(prisma);
    console.log(`Seeded ${res.isolates} isolates / ${res.patients} patients / ${res.astResults} AST results in ${res.ms} ms`);
    console.log(`  approved+final: ${res.approvedFinal}, pending (draft/preliminary): ${res.pending}, period ${res.from} → ${res.to}`);
    console.log(`  slices: ${JSON.stringify(res.byTag)}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
