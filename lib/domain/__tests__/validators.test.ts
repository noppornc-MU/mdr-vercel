import { describe, expect, it } from 'vitest';
import {
  countMatch, dateNotFuture, drugInMaster, hnPattern, organismInMaster, reportStatusKnown,
  resultInSet, sddAllowedPair, validateIsolateInput, wardAndPatientTypePresent, type ValidateContext,
} from '../validators';
import type { IsolateInput } from '../types';
import { GOLDEN_AST, KP, PA } from './helpers';

const DRUGS = Object.keys(GOLDEN_AST).map((name, i) => ({ id: i + 1, name }));
const id = (name: string) => DRUGS.find((d) => d.name === name)!.id;
const SDD = [{ drug: 'Cefepime', group: 'ENTEROBACTERALES' }, { drug: 'Piperacillin/tazobactam', group: 'ENTEROBACTERALES' }];
const CTX: ValidateContext = { organisms: [KP, PA], drugs: DRUGS, wardIds: [1, 2, 3], sddAllowed: SDD, today: '2026-10-16' };

function golden(p: Partial<IsolateInput> = {}): IsolateInput {
  return {
    hn: '0000123', sex: null, patientType: 'IPD', wardId: 2, labNo: '9900000001',
    specimenDate: '2023-05-13', specimenType: 'BLOOD', organismId: KP.id, reportStatus: 'FINAL',
    ast: Object.entries(GOLDEN_AST).map(([name, result]) => ({ drugId: id(name), drugRaw: name, result })),
    source: 'OCR', ...p,
  };
}

describe('validateIsolateInput', () => {
  it('golden sample with ward + patient type → no flags (Pip/tazo D accepted)', () => {
    expect(validateIsolateInput(golden(), CTX)).toEqual([]);
  });
  it('golden sample as extracted (ward null) → ward flag only', () => {
    expect(validateIsolateInput(golden({ wardId: null }), CTX)).toEqual([{ path: 'wardId', reason: expect.stringContaining('Ward') }]);
  });
  it('empty AST and missing specimen type are flagged', () => {
    const flags = validateIsolateInput(golden({ ast: [], specimenType: null }), CTX).map((f) => f.path);
    expect(flags).toEqual(expect.arrayContaining(['ast', 'specimenType']));
  });
});

describe('the 9 validators', () => {
  it('1 count_match', () => {
    expect(countMatch([{ drugId: 1, result: null }, { drugId: null, drugRaw: null, result: 'S' }, { drugId: 2, result: 'S' }]).map((f) => f.path)).toEqual(['ast[0].result', 'ast[1].drugId']);
  });
  it('2 drug_in_master', () => {
    expect(drugInMaster([{ drugId: null, drugRaw: 'Fosfomycin', result: 'S' }, { drugId: 999, result: 'S' }, { drugId: 1, result: 'S' }], DRUGS).map((f) => f.path)).toEqual(['ast[0].drugId', 'ast[1].drugId']);
  });
  it('3 result_in_set', () => {
    expect(resultInSet([{ drugId: 1, result: 'X' as never }, { drugId: 2, result: 'R' }])).toHaveLength(1);
  });
  it('4 sdd_allowed_pair: Pip/tazo D ok for K. pneumoniae, Ampicillin D and P. aeruginosa D flagged', () => {
    const rows = [{ drugId: id('Piperacillin/tazobactam'), result: 'D' as const }, { drugId: id('Ampicillin'), result: 'D' as const }];
    expect(sddAllowedPair(rows, KP, DRUGS, SDD).map((f) => f.path)).toEqual(['ast[1].result']);
    expect(sddAllowedPair(rows, PA, DRUGS, SDD)).toHaveLength(2);
    expect(sddAllowedPair(rows, null, DRUGS, SDD)).toHaveLength(2);
  });
  it('5 organism_in_master', () => {
    expect(organismInMaster(KP.id, CTX.organisms)).toEqual([]);
    expect(organismInMaster(null, CTX.organisms)).toHaveLength(1);
    expect(organismInMaster(404, CTX.organisms)).toHaveLength(1);
  });
  it('6 hn_pattern (text, leading zeros kept)', () => {
    expect(hnPattern('0000123')).toEqual([]);
    expect(hnPattern('1234567890')).toEqual([]);
    expect(hnPattern('12345678901')).toHaveLength(1);
    expect(hnPattern('12-345')).toHaveLength(1);
    expect(hnPattern(123)).toHaveLength(1);
    expect(hnPattern('')).toHaveLength(1);
  });
  it('7 report_status_known', () => {
    expect(reportStatusKnown('FINAL')).toEqual([]);
    expect(reportStatusKnown('PRELIMINARY')).toEqual([]);
    expect(reportStatusKnown('UNKNOWN')).toHaveLength(1);
  });
  it('8 ward_and_patient_type_present', () => {
    expect(wardAndPatientTypePresent(1, 'OPD', [1])).toEqual([]);
    expect(wardAndPatientTypePresent(null, null).map((f) => f.path)).toEqual(['wardId', 'patientType']);
    expect(wardAndPatientTypePresent(9, 'IPD', [1])).toHaveLength(1);
  });
  it('9 date_not_future', () => {
    expect(dateNotFuture('2026-10-16', '2026-10-16')).toEqual([]);
    expect(dateNotFuture('2026-10-17', '2026-10-16')).toHaveLength(1);
    expect(dateNotFuture(null, '2026-10-16')).toHaveLength(1);
    expect(dateNotFuture('2026-02-30', '2026-10-16')).toHaveLength(1);
  });
});
