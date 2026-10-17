// Scope filtering shared by antibiogram / dashboard stats (server; pure helpers over loaded isolates).
import { organismMatches } from '@/lib/domain/names';
import type { DomainIsolate, OrgGroup, SpecimenType } from '@/lib/domain/types';

const ORG_GROUPS: OrgGroup[] = ['ENTEROBACTERALES', 'PSEUDOMONAS', 'ACINETOBACTER', 'STAPH', 'ENTEROCOCCUS', 'OTHER'];
const SPECIMENS: SpecimenType[] = ['BLOOD', 'RESPIRATORY', 'URINE', 'WOUND', 'OTHER'];

export interface ScopeFilter {
  wardId?: number | string | null;
  wardType?: 'ICU' | 'NON_ICU' | string | null;
  specimenType?: SpecimenType | string | null;
  /** Organism name (full or "K. pneumoniae"), organism id, or an OrgGroup code (e.g. ENTEROBACTERALES). */
  organism?: string | number | null;
}

const blank = (v: unknown) => v === null || v === undefined || v === '' || v === 'ALL' || v === 'all';

export function toWardId(v: ScopeFilter['wardId']): number | null {
  if (blank(v)) return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

export function organismFilter(v: ScopeFilter['organism']): ((iso: DomainIsolate) => boolean) | null {
  if (blank(v)) return null;
  const s = String(v).trim();
  if (/^\d+$/.test(s)) { const id = Number(s); return (iso) => iso.organism.id === id; }
  const g = s.toUpperCase();
  if ((ORG_GROUPS as string[]).includes(g)) return (iso) => iso.organism.group === g;
  return (iso) => organismMatches(iso.organism.name, s);
}

export function applyScope<T extends DomainIsolate>(isolates: readonly T[], f: ScopeFilter): T[] {
  const wardId = toWardId(f.wardId);
  const wardType = blank(f.wardType) ? null : String(f.wardType).toUpperCase().replace('-', '_');
  const spec = blank(f.specimenType) ? null : String(f.specimenType).toUpperCase();
  const org = organismFilter(f.organism);
  return isolates.filter((iso) =>
    (wardId === null || iso.wardId === wardId) &&
    (wardType === null || iso.wardType === wardType) &&
    (spec === null || !(SPECIMENS as string[]).includes(spec) || iso.specimenType === spec) &&
    (org === null || org(iso)));
}
