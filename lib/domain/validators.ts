// Shared validators for OCR / Key in / CSV (design §4.5, MR1.7, MR2.3). Pure; return Flag[].
// Flag paths: 'hn' | 'patientType' | 'wardId' | 'specimenDate' | 'specimenType' | 'organismId' | 'reportStatus'
//             | 'ast' | `ast[${i}].drugId` | `ast[${i}].result`
import type { DomainOrganism, Flag, IsolateInput } from './types';
import { isValidIsoDate } from './dates';
import { isSddAllowed, type SddPair } from './antibiogram';

type AstRow = IsolateInput['ast'][number];
const AST_SET = ['S', 'I', 'R', 'D'];
const SPECIMEN_SET = ['BLOOD', 'RESPIRATORY', 'URINE', 'WOUND', 'OTHER'];
const hasDrug = (r: AstRow) => r.drugId !== null && r.drugId !== undefined || !!(r.drugRaw && String(r.drugRaw).trim());
const hasResult = (r: AstRow) => r.result !== null && r.result !== undefined && String(r.result).trim() !== '';

export const HN_PATTERN = /^\d{1,10}$/;

/** 1. count_match — every drug has a result and every result has a drug. */
export function countMatch(ast: readonly AstRow[]): Flag[] {
  const flags: Flag[] = [];
  ast.forEach((r, i) => {
    if (hasDrug(r) && !hasResult(r)) flags.push({ path: `ast[${i}].result`, reason: 'จำนวนชื่อยาและผลไม่ตรงกัน: ยานี้ไม่มีผล' });
    else if (!hasDrug(r) && hasResult(r)) flags.push({ path: `ast[${i}].drugId`, reason: 'จำนวนชื่อยาและผลไม่ตรงกัน: มีผลแต่ไม่มีชื่อยา' });
  });
  return flags;
}

/** 2. drug_in_master — drug matched to the master list. */
export function drugInMaster(ast: readonly AstRow[], drugs: readonly { id: number; name: string }[]): Flag[] {
  const flags: Flag[] = [];
  ast.forEach((r, i) => {
    if (r.drugId === null || r.drugId === undefined) {
      if (r.drugRaw && String(r.drugRaw).trim()) flags.push({ path: `ast[${i}].drugId`, reason: `ไม่พบยา "${String(r.drugRaw).trim()}" ใน master — โปรดเลือกยา` });
    } else if (!drugs.some((d) => d.id === r.drugId)) {
      flags.push({ path: `ast[${i}].drugId`, reason: 'ยาไม่อยู่ใน master' });
    }
  });
  return flags;
}

/** 3. result_in_set — result ∈ {S, I, R, D}. */
export function resultInSet(ast: readonly AstRow[]): Flag[] {
  const flags: Flag[] = [];
  ast.forEach((r, i) => {
    if (hasResult(r) && !AST_SET.includes(String(r.result))) flags.push({ path: `ast[${i}].result`, reason: `ผล "${String(r.result)}" ไม่อยู่ใน S/I/R/D` });
  });
  return flags;
}

/** 4. sdd_allowed_pair — result D only for drug × organism-group pairs in sdd_allowed [J]. */
export function sddAllowedPair(
  ast: readonly AstRow[],
  organism: DomainOrganism | null | undefined,
  drugs: readonly { id: number; name: string }[],
  sddAllowed: readonly SddPair[],
): Flag[] {
  const flags: Flag[] = [];
  ast.forEach((r, i) => {
    if (r.result !== 'D') return;
    const drug = drugs.find((d) => d.id === r.drugId)?.name;
    if (!drug) return; // reported by drugInMaster / countMatch
    if (!organism) flags.push({ path: `ast[${i}].result`, reason: 'ผล D (SDD) ตรวจสอบไม่ได้เพราะยังไม่ระบุเชื้อ' });
    else if (!isSddAllowed(drug, organism.group, sddAllowed)) flags.push({ path: `ast[${i}].result`, reason: `ผล D (SDD) ไม่อนุญาตสำหรับ ${drug} × ${organism.name} (ตาราง sdd_allowed [J])` });
  });
  return flags;
}

/** 5. organism_in_master. */
export function organismInMaster(organismId: number | null | undefined, organisms: readonly DomainOrganism[]): Flag[] {
  if (organismId === null || organismId === undefined) return [{ path: 'organismId', reason: 'ไม่พบเชื้อใน master — โปรดเลือกเชื้อ' }];
  if (!organisms.some((o) => o.id === organismId)) return [{ path: 'organismId', reason: 'เชื้อไม่อยู่ใน master' }];
  return [];
}

/** 6. hn_pattern — HN is text of 1–10 digits (leading zeros kept). */
export function hnPattern(hn: unknown): Flag[] {
  if (typeof hn !== 'string' || hn === '') return [{ path: 'hn', reason: 'ต้องระบุ HN' }];
  if (!HN_PATTERN.test(hn)) return [{ path: 'hn', reason: 'HN ต้องเป็นตัวเลข 1–10 หลัก (เก็บเป็นข้อความ คงเลข 0 นำหน้า)' }];
  return [];
}

/** 7. report_status_known — FINAL or PRELIMINARY. */
export function reportStatusKnown(status: unknown): Flag[] {
  if (status === 'FINAL' || status === 'PRELIMINARY') return [];
  return [{ path: 'reportStatus', reason: 'อ่านสถานะรายงานไม่ได้ — โปรดเลือก Final หรือ Preliminary' }];
}

/** 8. ward_and_patient_type_present — both required from the user (reports rarely print them). */
export function wardAndPatientTypePresent(wardId: number | null | undefined, patientType: unknown, wardIds?: readonly number[]): Flag[] {
  const flags: Flag[] = [];
  if (wardId === null || wardId === undefined) flags.push({ path: 'wardId', reason: 'ต้องเลือก Ward (ใบผลไม่มีข้อมูลนี้)' });
  else if (wardIds && !wardIds.includes(wardId)) flags.push({ path: 'wardId', reason: 'Ward ไม่อยู่ใน master' });
  if (patientType !== 'OPD' && patientType !== 'IPD') flags.push({ path: 'patientType', reason: 'ต้องเลือกประเภทผู้ป่วย (OPD/IPD)' });
  return flags;
}

/** 9. date_not_future — specimen date present, valid, and ≤ today. */
export function dateNotFuture(date: string | null | undefined, today: string): Flag[] {
  if (!date) return [{ path: 'specimenDate', reason: 'ไม่มีวันที่รับตรวจ' }];
  if (!isValidIsoDate(date)) return [{ path: 'specimenDate', reason: 'รูปแบบวันที่ไม่ถูกต้อง' }];
  if (date > today.slice(0, 10)) return [{ path: 'specimenDate', reason: 'วันที่รับตรวจอยู่ในอนาคต' }];
  return [];
}

// ---- extra checks from MR2.3 used by validateIsolateInput ----
export function astNotEmpty(ast: readonly AstRow[]): Flag[] {
  return ast.some((r) => hasDrug(r) && hasResult(r)) ? [] : [{ path: 'ast', reason: 'ต้องมีผล AST อย่างน้อย 1 ผล' }];
}

export function noDuplicateDrug(ast: readonly AstRow[]): Flag[] {
  const seen = new Set<number>();
  const flags: Flag[] = [];
  ast.forEach((r, i) => {
    if (r.drugId === null || r.drugId === undefined) return;
    if (seen.has(r.drugId)) flags.push({ path: `ast[${i}].drugId`, reason: 'ยาซ้ำ' });
    seen.add(r.drugId);
  });
  return flags;
}

export function specimenTypePresent(t: unknown): Flag[] {
  return typeof t === 'string' && SPECIMEN_SET.includes(t) ? [] : [{ path: 'specimenType', reason: 'ต้องระบุชนิด specimen' }];
}

export interface ValidateContext {
  organisms: readonly DomainOrganism[];
  drugs: readonly { id: number; name: string }[];
  wardIds: readonly number[];
  sddAllowed: readonly SddPair[];
  today: string; // YYYY-MM-DD (Asia/Bangkok)
}

/** Run all validators; returns de-duplicated flags (empty = ready to approve). */
export function validateIsolateInput(input: IsolateInput, ctx: ValidateContext): Flag[] {
  const ast = Array.isArray(input.ast) ? input.ast : [];
  const organism = ctx.organisms.find((o) => o.id === input.organismId) ?? null;
  const all: Flag[] = [
    ...hnPattern(input.hn),
    ...wardAndPatientTypePresent(input.wardId, input.patientType, ctx.wardIds),
    ...dateNotFuture(input.specimenDate, ctx.today),
    ...specimenTypePresent(input.specimenType),
    ...organismInMaster(input.organismId, ctx.organisms),
    ...reportStatusKnown(input.reportStatus),
    ...astNotEmpty(ast),
    ...countMatch(ast),
    ...drugInMaster(ast, ctx.drugs),
    ...resultInSet(ast),
    ...noDuplicateDrug(ast),
    ...sddAllowedPair(ast, organism, ctx.drugs, ctx.sddAllowed),
  ];
  const seen = new Set<string>();
  return all.filter((f) => { const k = `${f.path}\u0000${f.reason}`; if (seen.has(k)) return false; seen.add(k); return true; });
}
