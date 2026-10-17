// Raw extraction JSON → IsolateInput + field-level flags (design §5, MR1.5–MR1.8).
// Matching to master, BE/CE conversion and flagging happen here (never in the LLM).
import { parseThaiOrCeDate } from '@/lib/domain/dates';
import type { AstCode, DomainOrganism, Flag, IsolateInput, OrgGroup, SpecimenType } from '@/lib/domain/types';
import { validateIsolateInput } from '@/lib/domain/validators';
import type { Extraction } from './schema';

export interface MasterEntry {
  id: number;
  name: string;
  aliases?: string[];
}

export interface NormalizeContext {
  organisms: (DomainOrganism & { aliases?: string[] })[];
  drugs: MasterEntry[];
  wardIds: number[];
  sddAllowed: { drug: string; group: OrgGroup }[];
  aliases?: {
    organism?: Record<string, string>;
    drug?: Record<string, string>;
    specimen?: Record<string, SpecimenType | string>;
  };
  today: string; // YYYY-MM-DD (Asia/Bangkok)
  sourceFile?: string | null;
}

export interface NormalizeResult {
  input: IsolateInput;
  flags: Flag[];
  raw: Extraction;
}

const key = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const loose = (s: string) => key(s).replace(/\([^)]*\)/g, '').replace(/[^a-z0-9\u0E00-\u0E7F]+/g, '');

/** Build a resolver: raw text → master entry (by name, record aliases, config alias map). */
function buildResolver<T extends MasterEntry>(entries: T[], aliasMap?: Record<string, string>) {
  const exact = new Map<string, T>();
  const fuzzy = new Map<string, T>();
  const add = (label: string, e: T) => {
    if (!label) return;
    if (!exact.has(key(label))) exact.set(key(label), e);
    const l = loose(label);
    if (l && !fuzzy.has(l)) fuzzy.set(l, e);
  };
  for (const e of entries) add(e.name, e);
  for (const e of entries) for (const a of e.aliases ?? []) add(a, e);
  if (aliasMap) {
    for (const [alias, canonical] of Object.entries(aliasMap)) {
      const target = entries.find((e) => key(e.name) === key(String(canonical)));
      if (target) add(alias, target);
    }
  }
  return (raw: string | null | undefined): T | null => {
    if (!raw || !raw.trim()) return null;
    return exact.get(key(raw)) ?? fuzzy.get(loose(raw)) ?? null;
  };
}

function resolveSpecimen(raw: string | null, aliasMap?: Record<string, string>): SpecimenType | null {
  if (!raw) return null;
  const valid: SpecimenType[] = ['BLOOD', 'RESPIRATORY', 'URINE', 'WOUND', 'OTHER'];
  if (aliasMap) {
    for (const [alias, type] of Object.entries(aliasMap)) {
      if (key(alias) === key(raw) && valid.includes(type as SpecimenType)) return type as SpecimenType;
    }
  }
  const s = raw.toLowerCase();
  if (/hemo|haemo|blood|เลือด/.test(s)) return 'BLOOD';
  if (/sputum|tracheal|bronch|bal\b|respir|เสมหะ/.test(s)) return 'RESPIRATORY';
  if (/urine|ปัสสาวะ/.test(s)) return 'URINE';
  if (/pus|wound|tissue|swab|แผล|หนอง/.test(s)) return 'WOUND';
  return null;
}

function resolveDate(isoField: string | null, rawField: string | null): string | null {
  const fromRaw = parseThaiOrCeDate(rawField).iso;
  if (fromRaw) return fromRaw;
  return parseThaiOrCeDate(isoField).iso;
}

export function normalizeExtraction(raw: Extraction, ctx: NormalizeContext): NormalizeResult {
  const own: Flag[] = [];
  const findOrganism = buildResolver(ctx.organisms, ctx.aliases?.organism);
  const findDrug = buildResolver(ctx.drugs, ctx.aliases?.drug);

  const hn = (raw.hn ?? '').trim();
  if (!hn) own.push({ path: 'hn', reason: 'อ่าน HN ไม่ได้ — กรุณากรอก' });

  const specimenDate = resolveDate(raw.lab_received_at, raw.lab_received_raw);
  if (!specimenDate) own.push({ path: 'specimenDate', reason: 'อ่านวันที่รับตรวจไม่ได้ — กรุณากรอก' });

  const specimenType = resolveSpecimen(raw.specimen_raw, ctx.aliases?.specimen as Record<string, string> | undefined);
  if (!specimenType) own.push({ path: 'specimenType', reason: `จับคู่ชนิด specimen ไม่ได้ (“${raw.specimen_raw ?? '-'}”) — กรุณาเลือก` });

  const iso0 = raw.isolates[0];
  const organism = findOrganism(iso0?.organism_raw ?? null);
  if (!iso0) own.push({ path: 'organismId', reason: 'ไม่พบเชื้อในใบผล — กรุณาเลือก' });
  else if (!organism) own.push({ path: 'organismId', reason: `จับคู่ชื่อเชื้อกับ master ไม่ได้ (“${iso0.organism_raw ?? '-'}”)` });
  if (raw.isolates.length > 1) {
    own.push({ path: 'organismId', reason: `ใบนี้มี ${raw.isolates.length} เชื้อ — MVP บันทึกเฉพาะเชื้อแรก` });
  }

  const seen = new Set<number>();
  const ast: IsolateInput['ast'] = (iso0?.ast ?? []).map((row, i) => {
    const drug = findDrug(row.drug_raw);
    const result: AstCode | null = row.result ?? null;
    if (!drug) own.push({ path: `ast[${i}].drugId`, reason: `ไม่พบยา “${row.drug_raw}” ใน master` });
    else if (seen.has(drug.id)) own.push({ path: `ast[${i}].drugId`, reason: `ยา ${drug.name} ซ้ำ` });
    if (drug) seen.add(drug.id);
    if (!result) own.push({ path: `ast[${i}].result`, reason: `อ่านผลของ ${row.drug_raw} ไม่ได้` });
    return { drugId: drug?.id ?? null, drugRaw: row.drug_raw, result };
  });
  if (ast.length === 0) own.push({ path: 'ast', reason: 'ไม่พบผล AST — กรุณากรอก' });

  if (raw.report_status === 'UNKNOWN') own.push({ path: 'reportStatus', reason: 'อ่านสถานะรายงานไม่ได้ (Final/Preliminary)' });

  const input: IsolateInput = {
    hn,
    sex: raw.sex ?? null,
    patientType: null, // never printed on the report → user must choose
    wardId: null, // never printed on the report → user must choose (flag)
    labNo: raw.lab_no,
    orderNo: raw.order_no,
    specimenDate,
    specimenType,
    specimenDetail: raw.specimen_raw,
    organismId: organism?.id ?? null,
    reportStatus: raw.report_status,
    labComments: raw.lab_comments,
    ast,
    source: 'OCR',
    sourceFile: ctx.sourceFile ?? null,
  };

  // Ward / patient type are always missing on the report.
  own.push({ path: 'wardId', reason: 'ใบผลไม่มี Ward — กรุณาเลือก Ward' });
  own.push({ path: 'patientType', reason: 'กรุณาเลือกประเภทผู้ป่วย (OPD/IPD)' });

  const shared = validateIsolateInput(input, {
    organisms: ctx.organisms,
    drugs: ctx.drugs.map((d) => ({ id: d.id, name: d.name })),
    wardIds: ctx.wardIds,
    sddAllowed: ctx.sddAllowed,
    today: ctx.today,
  });

  // Merge: shared validator flags first, then ours for paths not yet flagged.
  const flags: Flag[] = [];
  const paths = new Set<string>();
  for (const f of [...shared, ...own]) {
    const k = `${f.path}|${f.reason}`;
    if (paths.has(f.path) && !f.path.startsWith('organismId')) continue;
    if (flags.some((x) => `${x.path}|${x.reason}` === k)) continue;
    flags.push(f);
    paths.add(f.path);
  }
  return { input, flags, raw };
}
