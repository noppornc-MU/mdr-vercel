// Writes master tables + synthetic isolates to the DB (server only). Used by prisma/seed.ts and POST /api/seed.
import type { PrismaClient } from '@prisma/client';
import { getConfig } from '@/lib/config';
import { evaluatePhenotypes } from '@/lib/domain/phenotype';
import type { DomainOrganism, OrgClass, OrgGroup } from '@/lib/domain/types';
import { generateSeed, summarizeSeed, SEED_NUMBER } from './generate';

/** Upsert wards / organisms / drugs from config/*.json (ids stay stable across reseeds). */
export async function upsertMasters(prisma: PrismaClient) {
  const cfg = getConfig();
  // Missing rows are inserted in one batch per table; only changed rows are updated one by one
  // (keeps POST /api/seed fast on a remote Postgres, where every round trip costs latency).
  const same = (a: Record<string, unknown>, b: Record<string, unknown>) => Object.keys(b).every((k) => a[k] === b[k]);
  const [wards, organisms, drugs] = await Promise.all([prisma.ward.findMany(), prisma.organism.findMany(), prisma.drug.findMany()]);

  const wardRows = cfg.wards.map((w) => ({ code: w.code, name: w.name, wardType: w.wardType, aliases: JSON.stringify(w.aliases) }));
  const newWards = wardRows.filter((w) => !wards.some((x) => x.code === w.code));
  if (newWards.length) await prisma.ward.createMany({ data: newWards, skipDuplicates: true });
  for (const { code, ...data } of wardRows) {
    const cur = wards.find((x) => x.code === code);
    if (cur && !same(cur, data)) await prisma.ward.update({ where: { code }, data });
  }

  const orgRows = cfg.organisms.map((o) => ({ name: o.name, orgClass: o.orgClass, group: o.group, aliases: JSON.stringify(o.aliases) }));
  const newOrgs = orgRows.filter((o) => !organisms.some((x) => x.name === o.name));
  if (newOrgs.length) await prisma.organism.createMany({ data: newOrgs, skipDuplicates: true });
  for (const { name, ...data } of orgRows) {
    const cur = organisms.find((x) => x.name === name);
    if (cur && !same(cur, data)) await prisma.organism.update({ where: { name }, data });
  }

  const drugRows = cfg.drugs.map((d) => ({ name: d.name, drugClass: d.drugClass, displayOrder: d.displayOrder, aliases: JSON.stringify(d.aliases) }));
  const newDrugs = drugRows.filter((d) => !drugs.some((x) => x.name === d.name));
  if (newDrugs.length) await prisma.drug.createMany({ data: newDrugs, skipDuplicates: true });
  for (const { name, ...data } of drugRows) {
    const cur = drugs.find((x) => x.name === name);
    if (cur && !same(cur, data)) await prisma.drug.update({ where: { name }, data });
  }
}

/**
 * Deploy-time seeding (vercel-build): load the synthetic data set only when there are no isolates.
 * Never deletes anything — once data exists this is a read-only no-op.
 */
export async function seedIfEmpty(prisma: PrismaClient) {
  const existing = await prisma.isolate.count();
  if (existing > 0) return { seeded: false as const, existing };
  const res = await seedDatabase(prisma, { onlyIfEmpty: true });
  return res.ok ? { seeded: true as const, ...res } : { seeded: false as const, existing: res.existing };
}

/**
 * Reset ALL isolates and reload the deterministic synthetic data set.
 * With `onlyIfEmpty`, nothing is deleted: the emptiness check runs inside the insert transaction
 * (under an advisory lock) and no isolates are written if any appeared in the meantime.
 */
export async function seedDatabase(prisma: PrismaClient, opts: { seed?: number; onlyIfEmpty: true }): Promise<SeedResult | SeedSkipped>;
export async function seedDatabase(prisma: PrismaClient, opts?: { seed?: number; onlyIfEmpty?: false }): Promise<SeedResult>;
export async function seedDatabase(prisma: PrismaClient, opts: { seed?: number; onlyIfEmpty?: boolean } = {}): Promise<SeedResult | SeedSkipped> {
  const t0 = Date.now();
  const cfg = getConfig();
  await upsertMasters(prisma);

  const [wards, organisms, drugs] = await Promise.all([prisma.ward.findMany(), prisma.organism.findMany(), prisma.drug.findMany()]);
  const wardId = new Map(wards.map((w) => [w.code, w.id]));
  const orgByName = new Map(organisms.map((o) => [o.name, o]));
  const drugId = new Map(drugs.map((d) => [d.name, d.id]));

  const rows = generateSeed(opts.seed ?? SEED_NUMBER);

  const isolateData = rows.map((r) => {
    const org = orgByName.get(r.organism);
    if (!org) throw new Error(`seed: organism not in master: ${r.organism}`);
    const domOrg: DomainOrganism = { id: org.id, name: org.name, orgClass: org.orgClass as OrgClass, group: org.group as OrgGroup };
    const phenotypes = evaluatePhenotypes({ organism: domOrg, ast: r.ast }, cfg.phenotypeRules, cfg.intrinsic);
    return {
      id: r.id,
      code: r.code,
      hn: r.hn,
      sex: r.sex,
      patientType: r.patientType,
      wardId: r.wardCode ? (wardId.get(r.wardCode) ?? null) : null,
      labNo: r.labNo,
      orderNo: r.orderNo,
      specimenDate: new Date(`${r.specimenDate}T00:00:00.000Z`),
      specimenType: r.specimenType,
      specimenDetail: r.specimenDetail,
      organismId: org.id,
      reportStatus: r.reportStatus,
      status: r.status,
      source: 'SEED',
      needsReview: '[]',
      phenotypes: JSON.stringify(phenotypes),
      labComments: null,
      sourceFile: null,
      createdBy: 'seed',
      approvedBy: r.approvedBy,
      approvedAt: r.approvedAt ? new Date(r.approvedAt) : null,
      createdAt: new Date(r.createdAt),
    };
  });
  const astData = rows.flatMap((r) =>
    Object.entries(r.ast).map(([drug, result]) => {
      const id = drugId.get(drug);
      if (!id) throw new Error(`seed: drug not in master: ${drug}`);
      return { isolateId: r.id, drugId: id, result };
    }),
  );

  const existing = await prisma.$transaction(
    async (tx) => {
      // Serialize concurrent seeders (two deploys, or a deploy + POST /api/seed). Transaction-scoped,
      // so it is released on commit/rollback and works through Neon's PgBouncer (transaction mode).
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(74260116)`;
      if (opts.onlyIfEmpty) {
        // Deploy path: insert only — never delete, even if rows appear after this check.
        const n = await tx.isolate.count();
        if (n > 0) return n;
      } else {
        await tx.astResult.deleteMany();
        await tx.isolate.deleteMany();
      }
      // Batched inserts: 1,000 isolates in 5 statements, ~10k AST rows in a handful more.
      for (let i = 0; i < isolateData.length; i += 200) await tx.isolate.createMany({ data: isolateData.slice(i, i + 200) });
      for (let i = 0; i < astData.length; i += 2000) await tx.astResult.createMany({ data: astData.slice(i, i + 2000) });
      return 0;
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
  if (existing > 0) return { ok: false as const, skipped: true as const, existing };

  return { ok: true as const, ms: Date.now() - t0, ...summarizeSeed(rows) };
}

export type SeedResult = { ok: true; ms: number } & ReturnType<typeof summarizeSeed>;
export type SeedSkipped = { ok: false; skipped: true; existing: number };
