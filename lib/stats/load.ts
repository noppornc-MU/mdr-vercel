// Server-only: load isolates from Prisma into domain objects. All statistics are computed by lib/domain.
import { prisma } from '@/lib/db';
import { getConfig } from '@/lib/config';
import { addDays, toIsoDateInTz } from '@/lib/domain/dates';
import { evaluatePhenotypes } from '@/lib/domain/phenotype';
import type { AstCode, DomainIsolate, OrgClass, OrgGroup, PhenotypeResult, ReportStatus, SpecimenType } from '@/lib/domain/types';

export interface LoadFilter {
  from?: string | null;      // YYYY-MM-DD inclusive (specimen date, Asia/Bangkok)
  to?: string | null;
  countableOnly?: boolean;   // APPROVED + FINAL only (default true)
}

/** DomainIsolate plus phenotypes evaluated live from config/phenotype_rules.json [J]. */
export interface LoadedIsolate extends DomainIsolate { phenotypes: PhenotypeResult[] }

const AST_CODES = new Set(['S', 'I', 'R', 'D']);
const isoStart = (d: string) => new Date(`${d}T00:00:00.000Z`);

export async function loadIsolates(filter: LoadFilter = {}): Promise<LoadedIsolate[]> {
  const { from, to } = filter;
  const countableOnly = filter.countableOnly ?? true;
  // DB filter with a 1-day margin (storage may be UTC or Bangkok midnight); exact filter below.
  const specimenDate: { gte?: Date; lt?: Date } = {};
  if (from) specimenDate.gte = isoStart(addDays(from, -1));
  if (to) specimenDate.lt = isoStart(addDays(to, 2));
  const rows = await prisma.isolate.findMany({
    where: {
      ...(countableOnly ? { status: 'APPROVED', reportStatus: 'FINAL' } : {}),
      ...(from || to ? { specimenDate } : {}),
    },
    include: { ward: true, organism: true, ast: { include: { drug: true } } },
  });
  const cfg = getConfig();
  const out: LoadedIsolate[] = [];
  for (const r of rows) {
    const date = toIsoDateInTz(r.specimenDate);
    if ((from && date < from) || (to && date > to)) continue;
    const ast: Record<string, AstCode> = {};
    for (const a of r.ast) if (AST_CODES.has(a.result)) ast[a.drug.name] = a.result as AstCode;
    const iso: DomainIsolate = {
      id: r.id,
      code: r.code,
      hn: r.hn,
      wardId: r.wardId ?? null,
      wardName: r.ward?.name ?? null,
      wardType: r.ward ? (r.ward.wardType === 'ICU' ? 'ICU' : 'NON_ICU') : null,
      specimenDate: date,
      specimenType: r.specimenType as SpecimenType,
      organism: { id: r.organism.id, name: r.organism.name, orgClass: r.organism.orgClass as OrgClass, group: r.organism.group as OrgGroup },
      status: r.status === 'APPROVED' ? 'APPROVED' : 'DRAFT',
      reportStatus: r.reportStatus as ReportStatus,
      createdAt: r.createdAt.toISOString(),
      ast,
    };
    out.push({ ...iso, phenotypes: evaluatePhenotypes(iso, cfg.phenotypeRules, cfg.intrinsic) });
  }
  return out;
}

/** Records not counted in statistics (DRAFT or report not FINAL). */
export async function getPendingCount(): Promise<number> {
  return prisma.isolate.count({ where: { OR: [{ status: { not: 'APPROVED' } }, { reportStatus: { not: 'FINAL' } }] } });
}

/** Latest specimen date of approved FINAL data (Asia/Bangkok), or today when the DB is empty. */
export async function getDataAsOf(): Promise<string> {
  const last = await prisma.isolate.findFirst({
    where: { status: 'APPROVED', reportStatus: 'FINAL' },
    orderBy: { specimenDate: 'desc' },
    select: { specimenDate: true },
  });
  return toIsoDateInTz(last?.specimenDate ?? new Date());
}

/** Canonical drug names in master display order. */
export async function loadDrugOrder(): Promise<string[]> {
  const drugs = await prisma.drug.findMany({ orderBy: { displayOrder: 'asc' }, select: { name: true } });
  return drugs.length ? drugs.map((d) => d.name) : getConfig().drugs.map((d) => d.name);
}

export async function loadWardName(wardId: number | null | undefined): Promise<string | null> {
  if (wardId === null || wardId === undefined) return null;
  const w = await prisma.ward.findUnique({ where: { id: wardId }, select: { name: true } });
  return w?.name ?? null;
}
