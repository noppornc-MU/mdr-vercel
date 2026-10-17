// Server: antibiogram for a scope. Used by /api/antibiogram AND AI consult (same numbers).
import { getConfig } from '@/lib/config';
import { computeAntibiogram } from '@/lib/domain/antibiogram';
import { addDays, addMonths } from '@/lib/domain/dates';
import { firstIsolates } from '@/lib/domain/firstIsolate';
import type { AbgCell, Formula, OrgGroup, PhenotypeCode, SpecimenType } from '@/lib/domain/types';
import { getDataAsOf, getPendingCount, loadDrugOrder, loadIsolates, loadWardName, type LoadedIsolate } from './load';
import { applyScope, toWardId, type ScopeFilter } from './scope';

export interface AntibiogramScope extends ScopeFilter {
  from?: string | null;
  to?: string | null;
  phenotype?: PhenotypeCode | string | null;
  minN?: number | string | null;
  formula?: Formula | string | null;
}

export interface AntibiogramMeta {
  from: string;
  to: string;
  dataAsOf: string;
  minN: number;
  formula: Formula;
  pendingCount: number;
  /** First isolates in scope (after phenotype filter). */
  firstIsolateCount: number;
  scope: { wardId: number | null; wardName: string | null; wardType: string | null; specimenType: SpecimenType | null; organism: string | null; phenotype: PhenotypeCode | null };
}

export interface AntibiogramStats {
  meta: AntibiogramMeta;
  organisms: { name: string; n: number; group: OrgGroup }[];
  drugs: string[];
  cells: AbgCell[];
}

export interface ResolvedScope {
  from: string; to: string; dataAsOf: string; minN: number; formula: Formula;
  phenotype: PhenotypeCode | null; pendingCount: number; wardName: string | null;
  /** First isolates in the period after ward/specimen/organism filters (phenotype NOT applied). */
  firsts: LoadedIsolate[];
  drugOrder: string[];
}

const PHENOS: PhenotypeCode[] = ['CRE', 'ESBL_SCREEN', 'CRAB', 'CRPA', 'MRSA', 'VRE'];

export function parsePhenotype(v: unknown): PhenotypeCode | null {
  if (v === null || v === undefined || v === '') return null;
  const c = String(v).trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (c === 'ESBL') return 'ESBL_SCREEN';
  return (PHENOS as string[]).includes(c) ? (c as PhenotypeCode) : null;
}

/** Load + scope + first-isolate (shared by getAntibiogram and getPhenotypeBreakdown). Default period = last 12 months of data. */
export async function resolveScope(scope: AntibiogramScope): Promise<ResolvedScope> {
  const [dataAsOf, pendingCount, drugOrder, wardName] = await Promise.all([
    getDataAsOf(), getPendingCount(), loadDrugOrder(), loadWardName(toWardId(scope.wardId)),
  ]);
  const to = scope.to || dataAsOf;
  const from = scope.from || addDays(addMonths(to, -12), 1);
  const minRaw = Number(scope.minN ?? 30);
  const minN = Number.isFinite(minRaw) && minRaw >= 1 ? Math.floor(minRaw) : 30;
  const formula: Formula = scope.formula === 'S_PLUS_SDD' ? 'S_PLUS_SDD' : 'S_ONLY';
  const loaded = await loadIsolates({ from, to, countableOnly: true });
  const firsts = firstIsolates(applyScope(loaded, scope), { from, to });
  return { from, to, dataAsOf, minN, formula, phenotype: parsePhenotype(scope.phenotype), pendingCount, wardName, firsts, drugOrder };
}

export function hasPhenotype(iso: LoadedIsolate, code: PhenotypeCode): boolean {
  return iso.phenotypes.some((p) => p.code === code && p.result === 'POSITIVE');
}

export function metaOf(r: ResolvedScope, scope: AntibiogramScope, firstIsolateCount: number): AntibiogramMeta {
  const spec = scope.specimenType ? String(scope.specimenType).toUpperCase() : null;
  return {
    from: r.from, to: r.to, dataAsOf: r.dataAsOf, minN: r.minN, formula: r.formula, pendingCount: r.pendingCount,
    firstIsolateCount,
    scope: {
      wardId: toWardId(scope.wardId), wardName: r.wardName,
      wardType: scope.wardType ? String(scope.wardType).toUpperCase() : null,
      specimenType: (spec as SpecimenType) || null,
      organism: scope.organism !== null && scope.organism !== undefined && scope.organism !== '' ? String(scope.organism) : null,
      phenotype: r.phenotype,
    },
  };
}

/** %S / %SDD / n per organism × drug over first isolates (APPROVED + FINAL + bacteria) in scope. */
export async function getAntibiogram(scope: AntibiogramScope = {}): Promise<AntibiogramStats> {
  const r = await resolveScope(scope);
  const subset = r.phenotype ? r.firsts.filter((i) => hasPhenotype(i, r.phenotype!)) : r.firsts;
  const cfg = getConfig();
  const abg = computeAntibiogram(subset, { minN: r.minN, formula: r.formula, sddAllowed: cfg.sddAllowed, intrinsic: cfg.intrinsic, drugOrder: r.drugOrder });
  return { meta: metaOf(r, scope, subset.length), ...abg };
}
