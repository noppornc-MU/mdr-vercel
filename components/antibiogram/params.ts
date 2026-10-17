// Query-string parsing shared by /antibiogram page and GET /api/antibiogram.
import type { Formula, PhenotypeCode, SpecimenType } from '@/lib/domain/types';
import {
  parseDate, parseSpecimen, parseText, parseWardId, parseWardType, type ParamGetter,
} from '@/components/dashboard/params';

export type AbgView = 'overview' | 'phenotype';

export interface AbgScopeInput {
  from?: string;
  to?: string;
  wardId?: number;
  wardType?: 'ICU' | 'NON_ICU';
  specimenType?: SpecimenType;
  organism?: string;
  phenotype?: PhenotypeCode;
  minN: number;
  formula: Formula;
}

export interface AbgParams {
  view: AbgView;
  scope: AbgScopeInput;
  /** organism group filter for the overview matrix (display-level column filter) */
  group?: string;
}

const PHENOTYPES: PhenotypeCode[] = ['CRE', 'ESBL_SCREEN', 'CRAB', 'CRPA', 'MRSA', 'VRE'];

export function parsePhenotype(v: string | null | undefined): PhenotypeCode | undefined {
  return v && (PHENOTYPES as string[]).includes(v) ? (v as PhenotypeCode) : undefined;
}

export function parseMinN(v: string | null | undefined): number {
  const n = v && /^\d{1,4}$/.test(v) ? Number(v) : 30;
  return n >= 1 ? n : 30;
}

export function parseFormula(v: string | null | undefined): Formula {
  return v === 'S_PLUS_SDD' ? 'S_PLUS_SDD' : 'S_ONLY';
}

export function parseAbgParams(get: ParamGetter): AbgParams {
  const scope: AbgScopeInput = { minN: parseMinN(get('minN')), formula: parseFormula(get('formula')) };
  const from = parseDate(get('from'));
  const to = parseDate(get('to'));
  const wardId = parseWardId(get('wardId'));
  const wardType = parseWardType(get('wardType'));
  const specimenType = parseSpecimen(get('specimenType'));
  const organism = parseText(get('organism'));
  const phenotype = parsePhenotype(get('phenotype'));
  if (from) scope.from = from;
  if (to) scope.to = to;
  if (wardId !== undefined) scope.wardId = wardId;
  if (wardType) scope.wardType = wardType;
  if (specimenType) scope.specimenType = specimenType;
  if (organism) scope.organism = organism;
  if (phenotype) scope.phenotype = phenotype;
  const view: AbgView = get('view') === 'phenotype' ? 'phenotype' : 'overview';
  const group = parseText(get('group'), 40);
  return { view, scope, ...(group ? { group } : {}) };
}
