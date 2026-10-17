// Thai labels and date formatting for entry / isolate screens (pure, client-safe).
import type { OrgGroup, PhenotypeCode, ReportStatus, SpecimenType } from '@/lib/domain/types';

export const SPECIMEN_LABEL: Record<SpecimenType, string> = {
  BLOOD: 'เลือด (Blood)',
  RESPIRATORY: 'ทางเดินหายใจ (Respiratory)',
  URINE: 'ปัสสาวะ (Urine)',
  WOUND: 'แผล/หนอง (Wound)',
  OTHER: 'อื่น ๆ',
};

export const GROUP_LABEL: Record<OrgGroup, string> = {
  ENTEROBACTERALES: 'Enterobacterales',
  PSEUDOMONAS: 'Pseudomonas',
  ACINETOBACTER: 'Acinetobacter',
  STAPH: 'Staphylococcus',
  ENTEROCOCCUS: 'Enterococcus',
  OTHER: 'อื่น ๆ',
};

export const PHENOTYPE_LABEL: Record<PhenotypeCode, string> = {
  CRE: 'CRE',
  ESBL_SCREEN: 'ESBL (screen)',
  CRAB: 'CRAB',
  CRPA: 'CRPA',
  MRSA: 'MRSA',
  VRE: 'VRE',
};

export const PHENOTYPE_DESC: Record<PhenotypeCode, string> = {
  CRE: 'Enterobacterales ดื้อ carbapenem',
  ESBL_SCREEN: 'คัดกรอง ESBL (ไม่ใช่ผลยืนยัน)',
  CRAB: 'A. baumannii ดื้อ carbapenem',
  CRPA: 'P. aeruginosa ดื้อ carbapenem',
  MRSA: 'S. aureus ดื้อ methicillin',
  VRE: 'Enterococcus ดื้อ vancomycin',
};

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  FINAL: 'Final',
  PRELIMINARY: 'Preliminary',
  UNKNOWN: 'ไม่ทราบสถานะ',
};

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'DRAFT รอยืนยัน',
  APPROVED: 'ยืนยันแล้ว',
};

export const J_LABEL = '[J] กฎฉบับร่าง รอ ICN/จุลชีววิทยารับรอง';

export const FIELD_LABEL: Record<string, string> = {
  hn: 'HN',
  sex: 'เพศ',
  patientType: 'Patient Type',
  wardId: 'Ward',
  labNo: 'Lab No',
  orderNo: 'Order No',
  specimenDate: 'วันที่รับตรวจ',
  specimenType: 'ชนิด specimen',
  specimenDetail: 'รายละเอียด specimen',
  organismId: 'เชื้อ',
  reportStatus: 'สถานะรายงาน',
  labComments: 'หมายเหตุแล็บ',
  ast: 'ผล AST',
  other: 'อื่น ๆ',
};

/** "2023-05-13" → "13 พ.ค. 2566" */
export function thaiDate(iso?: string | null): string {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return new Intl.DateTimeFormat('th-TH', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

/** ISO timestamp → Thai date + time (Asia/Bangkok). */
export function thaiDateTime(ts?: string | null): string {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}
