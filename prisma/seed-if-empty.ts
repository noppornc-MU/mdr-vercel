// npm run seed:if-empty  (also step 3 of `npm run vercel-build`)
// Loads the deterministic synthetic demo data ONLY when the database has no isolates.
// Never wipes existing data — on every later deploy this is a no-op. Use `npm run seed` or
// POST /api/seed (ICN) to reset the demo data on purpose.
import { PrismaClient } from '@prisma/client';
import { seedIfEmpty } from '../lib/seed/apply';

async function main() {
  const prisma = new PrismaClient();
  try {
    const res = await seedIfEmpty(prisma);
    if (res.seeded) {
      console.log(`seed-if-empty: database was empty -> seeded ${res.isolates} isolates / ${res.patients} patients / ${res.astResults} AST results in ${res.ms} ms`);
    } else {
      console.log(`seed-if-empty: ${res.existing} isolates already present -> skipped (no data changed)`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('seed-if-empty failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
