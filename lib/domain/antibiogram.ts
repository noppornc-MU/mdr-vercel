// %S / %SDD antibiogram (design §4.3, MR9, MR11). Pure: config passed in as arguments.
import type { AbgCell, AstCode, DomainIsolate, Formula, OrgGroup, Tier } from './types';
import { drugKey, organismMatches } from './names';

export interface SddPair { drug: string; group: OrgGroup | string }
export interface IntrinsicPair { organism: string; drug: string }
export interface AntibiogramOptions {
  minN: number;
  formula: Formula;
  sddAllowed: readonly SddPair[];
  intrinsic: readonly IntrinsicPair[];
  drugOrder?: readonly string[];
}
export interface AntibiogramResult {
  organisms: { name: string; n: number; group: OrgGroup }[];
  drugs: string[];
  cells: AbgCell[];
}

export const TIER_LABEL_TH: Record<Tier, string> = {
  SUPPORTED: 'ข้อมูลท้องถิ่นสนับสนุน',
  CONSIDER: 'พิจารณาประกอบดุลยพินิจ',
  NOT_SUPPORTED: 'ข้อมูลท้องถิ่นไม่สนับสนุน',
  LOW_DATA: 'ข้อมูลน้อย',
  INTRINSIC: 'ดื้อโดยธรรมชาติ (intrinsic)',
};
export const FORMULA_LABEL_TH: Record<Formula, string> = {
  S_ONLY: '%S = S เท่านั้น',
  S_PLUS_SDD: '%S รวม SDD',
};

/** Percentage rounded to 1 decimal (half up). */
export function pct1(num: number, den: number): number {
  return Math.round((num * 1000) / den) / 10;
}

/** MR11 tier: intrinsic → INTRINSIC; n < minN (or no pct) → LOW_DATA; ≥90 SUPPORTED; ≥70 CONSIDER; else NOT_SUPPORTED. */
export function tierFor(pct: number | null, nTested: number, minN: number, intrinsic: boolean): Tier {
  if (intrinsic) return 'INTRINSIC';
  if (nTested < minN || pct === null) return 'LOW_DATA';
  if (pct >= 90) return 'SUPPORTED';
  if (pct >= 70) return 'CONSIDER';
  return 'NOT_SUPPORTED';
}

export function isSddAllowed(drug: string, group: string, sddAllowed: readonly SddPair[]): boolean {
  return sddAllowed.some((p) => drugKey(p.drug) === drugKey(drug) && String(p.group).toUpperCase() === String(group).toUpperCase());
}

export function isIntrinsic(organism: string, drug: string, intrinsic: readonly IntrinsicPair[]): boolean {
  return intrinsic.some((p) => drugKey(p.drug) === drugKey(drug) && organismMatches(organism, p.organism));
}

export interface AstCounts { s: number; i: number; r: number; d: number }

/** Build one cell from raw counts (exported so the counts→cell rule is testable on its own). */
export function buildCell(organism: string, group: string, drug: string, c: AstCounts, opts: AntibiogramOptions): AbgCell {
  const minN = Math.max(1, Math.floor(opts.minN || 0));
  const nTested = c.s + c.i + c.r + c.d;
  const intrinsic = isIntrinsic(organism, drug, opts.intrinsic);
  const sddApplicable = isSddAllowed(drug, group, opts.sddAllowed);
  const insufficient = !intrinsic && nTested < minN;
  const usable = !intrinsic && !insufficient && nTested > 0;
  const pctS = usable ? pct1(opts.formula === 'S_PLUS_SDD' ? c.s + c.d : c.s, nTested) : null;
  const pctSDD = usable && sddApplicable ? pct1(c.d, nTested) : null;
  const label = intrinsic ? 'IR' : insufficient || pctS === null ? `n<${minN}` : `${pctS.toFixed(1)}%`;
  return {
    organism, drug, nTested, s: c.s, i: c.i, r: c.r, d: c.d,
    pctS, pctSDD, sddApplicable, insufficient, intrinsic, label,
    tier: tierFor(pctS, nTested, minN, intrinsic),
  };
}

/**
 * Antibiogram from FIRST isolates (caller applies firstIsolates + scope first).
 * tested = S+I+R+D (blank not counted); %S = S/tested or (S+D)/tested; %SDD = D/tested only for sdd_allowed pairs.
 * Cells exist for every organism × drug with ≥1 tested result, plus intrinsic pairs (label "IR").
 */
export function computeAntibiogram(firsts: readonly DomainIsolate[], opts: AntibiogramOptions): AntibiogramResult {
  const orgs = new Map<string, { name: string; n: number; group: OrgGroup }>();
  const counts = new Map<string, Map<string, AstCounts>>(); // organism → drug → counts
  const drugSet = new Set<string>();

  for (const iso of firsts) {
    const name = iso.organism.name;
    const o = orgs.get(name) ?? { name, n: 0, group: iso.organism.group };
    o.n += 1;
    orgs.set(name, o);
    const byDrug = counts.get(name) ?? new Map<string, AstCounts>();
    counts.set(name, byDrug);
    for (const [drug, res] of Object.entries(iso.ast ?? {}) as [string, AstCode][]) {
      if (res !== 'S' && res !== 'I' && res !== 'R' && res !== 'D') continue;
      const c = byDrug.get(drug) ?? { s: 0, i: 0, r: 0, d: 0 };
      c[res.toLowerCase() as keyof AstCounts] += 1;
      byDrug.set(drug, c);
      drugSet.add(drug);
    }
  }

  const organisms = [...orgs.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  for (const o of organisms) for (const p of opts.intrinsic) if (organismMatches(o.name, p.organism)) {
    const known = [...drugSet].find((d) => drugKey(d) === drugKey(p.drug));
    drugSet.add(known ?? p.drug);
  }

  const orderIdx = new Map((opts.drugOrder ?? []).map((d, i) => [drugKey(d), i]));
  const drugs = [...drugSet].sort((a, b) => {
    const ia = orderIdx.get(drugKey(a)) ?? Number.MAX_SAFE_INTEGER;
    const ib = orderIdx.get(drugKey(b)) ?? Number.MAX_SAFE_INTEGER;
    return ia - ib || a.localeCompare(b);
  });

  const cells: AbgCell[] = [];
  for (const o of organisms) {
    const byDrug = counts.get(o.name)!;
    for (const drug of drugs) {
      const c = byDrug.get(drug);
      if (!c && !isIntrinsic(o.name, drug, opts.intrinsic)) continue;
      cells.push(buildCell(o.name, o.group, drug, c ?? { s: 0, i: 0, r: 0, d: 0 }, opts));
    }
  }
  return { organisms, drugs, cells };
}

/** Sort for MR11 drug cards: %S desc, then insufficient (by n desc), intrinsic last; ties keep drug order. */
export function sortCellsForCards(cells: readonly AbgCell[], drugOrder: readonly string[] = []): AbgCell[] {
  const idx = new Map(drugOrder.map((d, i) => [drugKey(d), i]));
  const rank = (c: AbgCell) => (c.intrinsic ? 2 : c.pctS === null ? 1 : 0);
  return [...cells].sort((a, b) =>
    rank(a) - rank(b) ||
    (b.pctS ?? -1) - (a.pctS ?? -1) ||
    b.nTested - a.nTested ||
    (idx.get(drugKey(a.drug)) ?? 1e9) - (idx.get(drugKey(b.drug)) ?? 1e9) ||
    a.drug.localeCompare(b.drug));
}
