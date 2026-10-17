// Query-string parsing shared by /dashboard page and GET /api/dashboard.
import type { SpecimenType } from '@/lib/domain/types';
import { SPECIMEN_TYPES } from './format';

export interface DashboardFilterInput {
  from?: string;
  to?: string;
  wardType?: 'ICU' | 'NON_ICU';
  wardId?: number;
  specimenType?: SpecimenType;
  organism?: string;
}

export type ParamGetter = (key: string) => string | null | undefined;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDate(v: string | null | undefined): string | undefined {
  return v && ISO_DATE.test(v) ? v : undefined;
}

export function parseWardType(v: string | null | undefined): 'ICU' | 'NON_ICU' | undefined {
  return v === 'ICU' || v === 'NON_ICU' ? v : undefined;
}

export function parseWardId(v: string | null | undefined): number | undefined {
  if (!v || !/^\d{1,6}$/.test(v)) return undefined;
  return Number(v);
}

export function parseSpecimen(v: string | null | undefined): SpecimenType | undefined {
  return v && (SPECIMEN_TYPES as string[]).includes(v) ? (v as SpecimenType) : undefined;
}

export function parseText(v: string | null | undefined, max = 120): string | undefined {
  const t = v?.trim();
  return t ? t.slice(0, max) : undefined;
}

export function parseDashboardFilters(get: ParamGetter): DashboardFilterInput {
  const f: DashboardFilterInput = {};
  const from = parseDate(get('from'));
  const to = parseDate(get('to'));
  const wardType = parseWardType(get('wardType'));
  const wardId = parseWardId(get('wardId'));
  const specimenType = parseSpecimen(get('specimenType'));
  const organism = parseText(get('organism'));
  if (from) f.from = from;
  if (to) f.to = to;
  if (wardType) f.wardType = wardType;
  if (wardId !== undefined) f.wardId = wardId;
  if (specimenType) f.specimenType = specimenType;
  if (organism) f.organism = organism;
  return f;
}
