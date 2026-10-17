// Pure display helpers (safe for server and client components).
import type { PhenotypeCode, SpecimenType, Tier } from '@/lib/domain/types';

const TZ = 'Asia/Bangkok';

/** 'YYYY-MM-DD' (CE) → Thai date with Buddhist year, e.g. "16 ต.ค. 2569". */
export function thaiDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00+07:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ });
}

/** 'YYYY-MM' → short Thai month, e.g. "ต.ค. 69". */
export function thaiMonth(ym: string): string {
  const d = new Date(`${ym.slice(0, 7)}-15T00:00:00+07:00`);
  if (Number.isNaN(d.getTime())) return ym;
  return d.toLocaleDateString('th-TH', { month: 'short', year: '2-digit', timeZone: TZ });
}

export function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toLocaleString('en-US');
}

export function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${n.toFixed(1)}%`;
}

/** % change vs previous period; null when the previous period is 0. */
export function pctChange(value: number, prev: number): number | null {
  if (!prev) return null;
  return Math.round(((value - prev) / prev) * 1000) / 10;
}

export const PHENOTYPE_ORDER: PhenotypeCode[] = ['CRE', 'CRAB', 'CRPA', 'MRSA', 'VRE', 'ESBL_SCREEN'];

export const PHENOTYPE_LABEL: Record<PhenotypeCode, string> = {
  CRE: 'CRE',
  ESBL_SCREEN: 'ESBL (screen)',
  CRAB: 'CRAB',
  CRPA: 'CRPA',
  MRSA: 'MRSA',
  VRE: 'VRE',
};

/** Phenotypes that can apply to each organism group (design §4.4). */
export const PHENOTYPES_BY_GROUP: Record<string, PhenotypeCode[]> = {
  ENTEROBACTERALES: ['CRE', 'ESBL_SCREEN'],
  ACINETOBACTER: ['CRAB'],
  PSEUDOMONAS: ['CRPA'],
  STAPH: ['MRSA'],
  ENTEROCOCCUS: ['VRE'],
  OTHER: [],
};

export const SPECIMEN_TYPES: SpecimenType[] = ['BLOOD', 'RESPIRATORY', 'URINE', 'WOUND', 'OTHER'];

export const SPECIMEN_LABEL: Record<SpecimenType, string> = {
  BLOOD: 'เลือด (Blood)',
  RESPIRATORY: 'ทางเดินหายใจ',
  URINE: 'ปัสสาวะ',
  WOUND: 'แผล/หนอง',
  OTHER: 'อื่น ๆ',
};

export function specimenLabel(code: string): string {
  return (SPECIMEN_LABEL as Record<string, string>)[code] ?? code;
}

export const WARD_TYPE_LABEL: Record<string, string> = { ICU: 'ICU', NON_ICU: 'Non-ICU' };

export const ORG_GROUP_LABEL: Record<string, string> = {
  ENTEROBACTERALES: 'Enterobacterales',
  PSEUDOMONAS: 'Pseudomonas',
  ACINETOBACTER: 'Acinetobacter',
  STAPH: 'Staphylococcus',
  ENTEROCOCCUS: 'Enterococcus',
  OTHER: 'อื่น ๆ',
};

/** MR11 wording — never "first-line" / "แนะนำให้ใช้". */
export const TIER_LABEL: Record<Tier, string> = {
  SUPPORTED: 'ข้อมูลท้องถิ่นสนับสนุน',
  CONSIDER: 'พิจารณาประกอบดุลยพินิจ',
  NOT_SUPPORTED: 'ข้อมูลท้องถิ่นไม่สนับสนุน',
  LOW_DATA: 'ข้อมูลน้อย',
  INTRINSIC: 'ดื้อโดยธรรมชาติ (IR)',
};

export const TIER_CLASS: Record<Tier, string> = {
  SUPPORTED: 'bg-green-100 text-green-900 border-green-400',
  CONSIDER: 'bg-yellow-100 text-yellow-900 border-yellow-400',
  NOT_SUPPORTED: 'bg-red-100 text-red-900 border-red-400',
  LOW_DATA: 'bg-slate-100 text-slate-700 border-slate-300',
  INTRINSIC: 'bg-slate-200 text-slate-700 border-slate-400',
};

/** MR9.5 cell colour bins: ≥90 green · 70–89 yellow · 50–69 orange · <50 red · grey = not enough n. */
export function pctCellClass(pct: number | null, insufficient: boolean, intrinsic: boolean): string {
  if (intrinsic) return 'bg-slate-200 text-slate-600';
  if (insufficient || pct === null) return 'bg-slate-100 text-slate-600';
  if (pct >= 90) return 'bg-green-100 text-green-900';
  if (pct >= 70) return 'bg-yellow-100 text-yellow-900';
  if (pct >= 50) return 'bg-orange-100 text-orange-900';
  return 'bg-red-100 text-red-900';
}

export type SearchParams = Record<string, string | string[] | undefined>;

export function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
