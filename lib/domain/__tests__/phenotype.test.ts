import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PHENOTYPE_RULES, evaluatePhenotypes, positivePhenotypes, resolvePhenotypeRules, toAstRecord } from '../phenotype';
import type { PhenotypeCode, PhenotypeResult } from '../types';
import { AB, CA, EC, EF, GOLDEN_AST, KP, PA, SA } from './helpers';

const get = (rs: PhenotypeResult[], code: PhenotypeCode) => rs.find((r) => r.code === code);

describe('golden sample (K. pneumoniae, 15 drugs)', () => {
  it('ESBL_SCREEN positive, CRE negative', () => {
    const rs = evaluatePhenotypes({ organism: KP, ast: GOLDEN_AST }, DEFAULT_PHENOTYPE_RULES);
    expect(get(rs, 'ESBL_SCREEN')?.result).toBe('POSITIVE');
    expect(get(rs, 'CRE')?.result).toBe('NEGATIVE');
    expect(positivePhenotypes(rs)).toEqual(['ESBL_SCREEN']);
    expect(rs.map((r) => r.code).sort()).toEqual(['CRE', 'ESBL_SCREEN']); // only rules applicable to the organism
  });

  it('golden result also holds with config/phenotype_rules.json (if present)', () => {
    const p = path.resolve(__dirname, '../../../config/phenotype_rules.json');
    if (!fs.existsSync(p)) return;
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    const rs = evaluatePhenotypes({ organism: KP, ast: GOLDEN_AST }, raw);
    expect(get(rs, 'ESBL_SCREEN')?.result).toBe('POSITIVE');
    expect(get(rs, 'CRE')?.result).toBe('NEGATIVE');
    expect(resolvePhenotypeRules(raw).map((r) => r.code)).toEqual(['CRE', 'ESBL_SCREEN', 'CRAB', 'CRPA', 'MRSA', 'VRE']);
  });
});

describe('phenotype rules [J]', () => {
  it('CRE when any carbapenem R; then not ESBL screen', () => {
    const rs = evaluatePhenotypes({ organism: KP, ast: { ...GOLDEN_AST, Meropenem: 'R' } });
    expect(positivePhenotypes(rs)).toEqual(['CRE']);
  });
  it('missing required drugs → UNCLASSIFIABLE (not negative)', () => {
    const rs = evaluatePhenotypes({ organism: EC, ast: { Ceftriaxone: 'R', Amikacin: 'S' } });
    expect(get(rs, 'CRE')).toMatchObject({ result: 'UNCLASSIFIABLE', missingDrugs: ['Ertapenem', 'Imipenem', 'Meropenem'] });
    expect(get(rs, 'ESBL_SCREEN')?.result).toBe('UNCLASSIFIABLE');
  });
  it('ESBL screen negative when ceftriaxone not R', () => {
    expect(get(evaluatePhenotypes({ organism: EC, ast: { Ceftriaxone: 'S' } }), 'ESBL_SCREEN')?.result).toBe('NEGATIVE');
  });
  it('CRAB / CRPA / MRSA / VRE', () => {
    expect(positivePhenotypes(evaluatePhenotypes({ organism: AB, ast: { Imipenem: 'R', Meropenem: 'R' } }))).toEqual(['CRAB']);
    expect(positivePhenotypes(evaluatePhenotypes({ organism: PA, ast: { Meropenem: 'R' } }))).toEqual(['CRPA']);
    expect(positivePhenotypes(evaluatePhenotypes({ organism: SA, ast: { Cefoxitin: 'R' } }))).toEqual(['MRSA']);
    expect(get(evaluatePhenotypes({ organism: SA, ast: { Oxacillin: 'S' } }), 'MRSA')?.result).toBe('NEGATIVE');
    expect(positivePhenotypes(evaluatePhenotypes({ organism: EF, ast: { Vancomycin: 'R' } }))).toEqual(['VRE']);
    expect(get(evaluatePhenotypes({ organism: EF, ast: {} }), 'VRE')?.result).toBe('UNCLASSIFIABLE');
  });
  it('yeast gets no phenotype; intrinsic drugs ignored by CRE rule', () => {
    expect(evaluatePhenotypes({ organism: CA, ast: { Meropenem: 'R' } })).toEqual([]);
    const proteus = { id: 3, name: 'Proteus mirabilis', orgClass: 'BACTERIA' as const, group: 'ENTEROBACTERALES' as const };
    const rs = evaluatePhenotypes({ organism: proteus, ast: { Imipenem: 'R', Ertapenem: 'S', Meropenem: 'S' } }, undefined, [{ organism: 'Proteus mirabilis', drug: 'Imipenem' }]);
    expect(get(rs, 'CRE')?.result).toBe('NEGATIVE');
  });
  it('toAstRecord maps drug ids to canonical names', () => {
    expect(toAstRecord([{ drugId: 1, result: 'S' }, { drugId: 9, result: null }, { drugId: null, result: 'R' }], [{ id: 1, name: 'Amikacin' }, { id: 9, name: 'Ertapenem' }])).toEqual({ Amikacin: 'S' });
  });
  it('resolvePhenotypeRules tolerates variants and falls back to defaults', () => {
    expect(resolvePhenotypeRules(null)).toEqual(DEFAULT_PHENOTYPE_RULES);
    const r = resolvePhenotypeRules([{ code: 'VRE', appliesTo: { group: 'ENTEROCOCCUS' }, anyResistant: ['Vancomycin', 'Teicoplanin'] }]);
    expect(r.find((x) => x.code === 'VRE')).toMatchObject({ groups: ['ENTEROCOCCUS'], anyR: ['Vancomycin', 'Teicoplanin'] });
    expect(r).toHaveLength(6);
  });
});
