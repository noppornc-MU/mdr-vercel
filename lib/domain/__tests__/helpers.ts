import type { AstCode, DomainIsolate, DomainOrganism } from '../types';

export const KP: DomainOrganism = { id: 2, name: 'Klebsiella pneumoniae', orgClass: 'BACTERIA', group: 'ENTEROBACTERALES' };
export const EC: DomainOrganism = { id: 1, name: 'Escherichia coli', orgClass: 'BACTERIA', group: 'ENTEROBACTERALES' };
export const AB: DomainOrganism = { id: 6, name: 'Acinetobacter baumannii', orgClass: 'BACTERIA', group: 'ACINETOBACTER' };
export const PA: DomainOrganism = { id: 5, name: 'Pseudomonas aeruginosa', orgClass: 'BACTERIA', group: 'PSEUDOMONAS' };
export const SA: DomainOrganism = { id: 7, name: 'Staphylococcus aureus', orgClass: 'BACTERIA', group: 'STAPH' };
export const EF: DomainOrganism = { id: 8, name: 'Enterococcus faecalis', orgClass: 'BACTERIA', group: 'ENTEROCOCCUS' };
export const CA: DomainOrganism = { id: 11, name: 'Candida albicans', orgClass: 'YEAST', group: 'OTHER' };

/** Golden sample report (design §5): K. pneumoniae, 15 drugs, canonical names. */
export const GOLDEN_AST: Record<string, AstCode> = {
  Amikacin: 'S',
  'Amoxicillin/clavulanate': 'R',
  Ampicillin: 'R',
  Cefepime: 'S',
  Cefoxitin: 'R',
  Ceftriaxone: 'R',
  Cefuroxime: 'R',
  Ciprofloxacin: 'R',
  Ertapenem: 'S',
  Gentamicin: 'S',
  Imipenem: 'S',
  Meropenem: 'S',
  'Piperacillin/tazobactam': 'D',
  Tetracycline: 'R',
  'Trimethoprim/sulfamethoxazole': 'S',
};

let seq = 0;
export function iso(p: Partial<DomainIsolate> = {}): DomainIsolate {
  seq += 1;
  return {
    id: p.id ?? `id-${seq}`,
    code: p.code ?? `ISO-2026-${String(seq).padStart(6, '0')}`,
    hn: p.hn ?? '0000001',
    wardId: p.wardId === undefined ? 1 : p.wardId,
    wardName: p.wardName === undefined ? 'ICU B' : p.wardName,
    wardType: p.wardType === undefined ? 'ICU' : p.wardType,
    specimenDate: p.specimenDate ?? '2026-01-01',
    specimenType: p.specimenType ?? 'BLOOD',
    organism: p.organism ?? KP,
    status: p.status ?? 'APPROVED',
    reportStatus: p.reportStatus ?? 'FINAL',
    createdAt: p.createdAt ?? '2026-01-01T00:00:00.000Z',
    ast: p.ast ?? {},
  };
}

/** Day n (1-based) of January 2026. */
export const day = (n: number) => `2026-01-${String(n).padStart(2, '0')}`;
