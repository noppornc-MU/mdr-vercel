import { describe, expect, it } from 'vitest';
import { buildCell, computeAntibiogram, pct1, sortCellsForCards, tierFor, type AntibiogramOptions } from '../antibiogram';
import type { AstCode } from '../types';
import { EC, KP, PA, iso } from './helpers';

const SDD = [{ drug: 'Cefepime', group: 'ENTEROBACTERALES' }, { drug: 'Piperacillin/tazobactam', group: 'ENTEROBACTERALES' }];
const INTRINSIC = [{ organism: 'Klebsiella pneumoniae', drug: 'Ampicillin' }, { organism: 'Pseudomonas aeruginosa', drug: 'Ceftriaxone' }];
const opts = (p: Partial<AntibiogramOptions> = {}): AntibiogramOptions => ({ minN: 30, formula: 'S_ONLY', sddAllowed: SDD, intrinsic: INTRINSIC, ...p });

/** Test vector 1: tested=10, S=6, D=2, I=1, R=1 (Pip/tazo × K. pneumoniae). */
function vector1() {
  const results: AstCode[] = ['S', 'S', 'S', 'S', 'S', 'S', 'D', 'D', 'I', 'R'];
  const firsts = results.map((r, i) => iso({ hn: `10${i}`, organism: KP, ast: { 'Piperacillin/tazobactam': r } }));
  firsts.push(iso({ hn: '999', organism: KP, ast: {} })); // untested: not in denominator
  return firsts;
}

describe('test vector 1 (%S / %SDD)', () => {
  it('S only = 60%, %SDD = 20% when n ≥ minN', () => {
    const cell = computeAntibiogram(vector1(), opts({ minN: 10 })).cells.find((c) => c.drug === 'Piperacillin/tazobactam')!;
    expect(cell).toMatchObject({ nTested: 10, s: 6, d: 2, i: 1, r: 1, pctS: 60, pctSDD: 20, sddApplicable: true, insufficient: false, label: '60.0%', tier: 'NOT_SUPPORTED' });
  });
  it('S + SDD = 80%', () => {
    const cell = computeAntibiogram(vector1(), opts({ minN: 10, formula: 'S_PLUS_SDD' })).cells.find((c) => c.drug === 'Piperacillin/tazobactam')!;
    expect(cell.pctS).toBe(80);
    expect(cell.pctSDD).toBe(20);
    expect(cell.tier).toBe('CONSIDER');
  });
  it('minN = 30 → n<30, no percentage, LOW_DATA', () => {
    const cell = computeAntibiogram(vector1(), opts()).cells.find((c) => c.drug === 'Piperacillin/tazobactam')!;
    expect(cell).toMatchObject({ nTested: 10, insufficient: true, pctS: null, pctSDD: null, label: 'n<30', tier: 'LOW_DATA' });
  });
  it('organism n counts first isolates, untested excluded from denominator', () => {
    const r = computeAntibiogram(vector1(), opts({ minN: 10 }));
    expect(r.organisms).toEqual([{ name: 'Klebsiella pneumoniae', n: 11, group: 'ENTEROBACTERALES' }]);
  });
});

describe('cells', () => {
  it('%SDD only for sdd_allowed pairs; D outside the table still counts as tested', () => {
    const c = buildCell('Escherichia coli', 'ENTEROBACTERALES', 'Amikacin', { s: 30, i: 0, r: 0, d: 0 }, opts());
    expect(c).toMatchObject({ pctS: 100, pctSDD: null, sddApplicable: false, tier: 'SUPPORTED', label: '100.0%' });
  });
  it('intrinsic pairs → IR, no %S, INTRINSIC tier, even if untested', () => {
    const firsts = [iso({ organism: KP, ast: { Amikacin: 'S' } }), iso({ hn: '2', organism: PA, ast: { Amikacin: 'S' } })];
    const r = computeAntibiogram(firsts, opts({ minN: 1 }));
    const amp = r.cells.find((c) => c.organism === KP.name && c.drug === 'Ampicillin')!;
    expect(amp).toMatchObject({ intrinsic: true, pctS: null, label: 'IR', tier: 'INTRINSIC', nTested: 0 });
    expect(r.cells.find((c) => c.organism === PA.name && c.drug === 'Ceftriaxone')?.label).toBe('IR');
    expect(r.cells.find((c) => c.organism === KP.name && c.drug === 'Ceftriaxone')).toBeUndefined();
  });
  it('rounds to 1 decimal: 33/34 = 97.1%', () => {
    expect(pct1(33, 34)).toBe(97.1);
    expect(pct1(2, 3)).toBe(66.7);
  });
  it('drug order follows drugOrder then name', () => {
    const r = computeAntibiogram([iso({ organism: EC, ast: { Meropenem: 'S', Amikacin: 'S', Zeta: 'S' } })], opts({ minN: 1, drugOrder: ['Meropenem', 'Amikacin'] }));
    expect(r.drugs).toEqual(['Meropenem', 'Amikacin', 'Zeta']);
  });
  it('card sort: %S desc, insufficient after, intrinsic last', () => {
    const o = opts();
    const cells = [
      buildCell('K', 'ENTEROBACTERALES', 'A', { s: 20, i: 0, r: 10, d: 0 }, o),
      buildCell('K', 'ENTEROBACTERALES', 'B', { s: 5, i: 0, r: 0, d: 0 }, o),
      buildCell('K', 'ENTEROBACTERALES', 'C', { s: 30, i: 0, r: 0, d: 0 }, o),
      buildCell('Klebsiella pneumoniae', 'ENTEROBACTERALES', 'Ampicillin', { s: 0, i: 0, r: 40, d: 0 }, o),
    ];
    expect(sortCellsForCards(cells).map((c) => c.drug)).toEqual(['C', 'A', 'B', 'Ampicillin']);
  });
});

describe('tierFor (MR11)', () => {
  it('thresholds', () => {
    expect(tierFor(90, 30, 30, false)).toBe('SUPPORTED');
    expect(tierFor(89.9, 30, 30, false)).toBe('CONSIDER');
    expect(tierFor(70, 30, 30, false)).toBe('CONSIDER');
    expect(tierFor(69.9, 30, 30, false)).toBe('NOT_SUPPORTED');
    expect(tierFor(100, 29, 30, false)).toBe('LOW_DATA');
    expect(tierFor(null, 50, 30, true)).toBe('INTRINSIC');
  });
});
