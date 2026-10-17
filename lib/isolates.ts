// Server-only isolate service (MR1–MR3):
// create (DRAFT, server-side validation, duplicate check, phenotypes) → approve (ICN only) → delete (ICN only);
// list with HN stripped at the API layer for EXECUTIVE.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getConfig } from '@/lib/config';
import type { Role } from '@/lib/role';
import { validateIsolateInput } from '@/lib/domain/validators';
import { errorSummary } from '@/lib/security/log';
import type {
  Flag,
  IsolateInput,
  OrgClass,
  OrgGroup,
  PhenotypeCode,
  PhenotypeResult,
  ReportStatus,
  SpecimenType,
} from '@/lib/domain/types';
import {
  bangkokToday,
  buildValidationCtx,
  computePhenotypes,
  type EntryConfig,
  type EntryMaster,
} from '@/components/entry/shared';

export type { EntryConfig, EntryMaster } from '@/components/entry/shared';

// ---------- errors ----------
export class IsolateError extends Error {
  readonly status: number;
  readonly flags: Flag[];
  constructor(status: number, message: string, flags: Flag[] = []) {
    super(message);
    this.name = 'IsolateError';
    this.status = status;
    this.flags = flags;
  }
}

export function isolateErrorResponse(e: unknown) {
  if (e instanceof IsolateError) {
    return NextResponse.json({ error: e.message, flags: e.flags }, { status: e.status });
  }
  console.error('[isolates]', errorSummary(e));
  return NextResponse.json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }, { status: 500 });
}

// ---------- request schema ----------
const astCode = z.enum(['S', 'I', 'R', 'D']);
export const isolateInputSchema = z.object({
  hn: z.string().max(20),
  sex: z.enum(['M', 'F']).nullish(),
  patientType: z.enum(['OPD', 'IPD']).nullable(),
  wardId: z.number().int().nullable(),
  labNo: z.string().max(40).nullish(),
  orderNo: z.string().max(40).nullish(),
  specimenDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  specimenType: z.enum(['BLOOD', 'RESPIRATORY', 'URINE', 'WOUND', 'OTHER']).nullable(),
  specimenDetail: z.string().max(200).nullish(),
  organismId: z.number().int().nullable(),
  reportStatus: z.enum(['FINAL', 'PRELIMINARY', 'UNKNOWN']),
  labComments: z.string().max(2000).nullish(),
  ast: z
    .array(
      z.object({
        drugId: z.number().int().nullable(),
        drugRaw: z.string().max(120).nullish(),
        result: astCode.nullable(),
      }),
    )
    .max(80),
  source: z.enum(['OCR', 'MANUAL', 'CSV']),
  sourceFile: z.string().max(300).nullish(),
});
export const createBodySchema = z.object({
  input: isolateInputSchema,
  confirmDuplicate: z.boolean().optional(),
});

// ---------- helpers ----------
function parseJsonArray<T>(s: string | null | undefined): T[] {
  if (!s) return [];
  try {
    const v: unknown = JSON.parse(s);
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}
/** Dates are stored as UTC midnight of the CE calendar date. */
function dayStart(d: string): Date {
  return new Date(`${d}T00:00:00.000Z`);
}
function nextDay(d: string): Date {
  const x = dayStart(d);
  x.setUTCDate(x.getUTCDate() + 1);
  return x;
}
function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function clean(s: string | null | undefined): string | null {
  const t = (s ?? '').trim();
  return t ? t : null;
}
function normalizeInput(i: IsolateInput): IsolateInput {
  return {
    ...i,
    hn: (i.hn ?? '').trim(),
    sex: i.sex ?? null,
    labNo: clean(i.labNo),
    orderNo: clean(i.orderNo),
    specimenDetail: clean(i.specimenDetail),
    labComments: clean(i.labComments),
    sourceFile: clean(i.sourceFile),
    ast: i.ast.map((a) => ({ drugId: a.drugId, drugRaw: clean(a.drugRaw), result: a.result })),
  };
}

// ---------- master + config ----------
export async function getEntryMaster(): Promise<EntryMaster> {
  const [organisms, drugs, wards] = await Promise.all([
    prisma.organism.findMany({ orderBy: { name: 'asc' } }),
    prisma.drug.findMany({ orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }] }),
    prisma.ward.findMany({ orderBy: { id: 'asc' } }),
  ]);
  return {
    organisms: organisms.map((o) => ({
      id: o.id,
      name: o.name,
      orgClass: o.orgClass as OrgClass,
      group: o.group as OrgGroup,
      aliases: parseJsonArray<unknown>(o.aliases).filter((a): a is string => typeof a === 'string'),
    })),
    drugs: drugs.map((d) => ({ id: d.id, name: d.name, drugClass: d.drugClass, displayOrder: d.displayOrder })),
    wards: wards.map((w) => ({
      id: w.id,
      code: w.code,
      name: w.name,
      wardType: w.wardType === 'ICU' ? ('ICU' as const) : ('NON_ICU' as const),
    })),
  };
}

export function getEntryConfig(): EntryConfig {
  const c = getConfig();
  return { panels: c.panels, sddAllowed: c.sddAllowed, intrinsic: c.intrinsic, phenotypeRules: c.phenotypeRules };
}

// ---------- code ----------
export async function nextIsolateCode(now: Date = new Date()): Promise<string> {
  const prefix = `ISO-${bangkokToday(now).slice(0, 4)}-`;
  const last = await prisma.isolate.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: 'desc' },
    select: { code: true },
  });
  const n = last ? Number.parseInt(last.code.slice(prefix.length), 10) || 0 : 0;
  return `${prefix}${String(n + 1).padStart(6, '0')}`;
}

// ---------- create ----------
export interface DuplicateInfo {
  id: string;
  code: string;
  hn: string;
  labNo: string | null;
  specimenDate: string;
  specimenType: string;
  organismName: string;
  wardName: string | null;
  status: string;
  matchedBy: 'LAB_NO' | 'HN_ORGANISM_SPECIMEN_DATE';
}
export type CreateIsolateResult =
  | { id: string; code: string; status: 'DRAFT'; flags: Flag[] }
  | { duplicate: DuplicateInfo };

async function findDuplicate(
  input: IsolateInput & { organismId: number; specimenDate: string; specimenType: SpecimenType },
): Promise<DuplicateInfo | null> {
  const or: Prisma.IsolateWhereInput[] = [
    {
      hn: input.hn,
      organismId: input.organismId,
      specimenType: input.specimenType,
      specimenDate: { gte: dayStart(input.specimenDate), lt: nextDay(input.specimenDate) },
    },
  ];
  if (input.labNo) or.unshift({ labNo: input.labNo });
  const dup = await prisma.isolate.findFirst({
    where: { OR: or },
    include: { organism: true, ward: true },
    orderBy: { createdAt: 'desc' },
  });
  if (!dup) return null;
  return {
    id: dup.id,
    code: dup.code,
    hn: dup.hn,
    labNo: dup.labNo,
    specimenDate: toYmd(dup.specimenDate),
    specimenType: dup.specimenType,
    organismName: dup.organism.name,
    wardName: dup.ward?.name ?? null,
    status: dup.status,
    matchedBy: input.labNo && dup.labNo === input.labNo ? 'LAB_NO' : 'HN_ORGANISM_SPECIMEN_DATE',
  };
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002';
}

export async function createIsolate(
  rawInput: IsolateInput,
  role: Role,
  opts: { confirmDuplicate?: boolean } = {},
): Promise<CreateIsolateResult> {
  if (role !== 'ICN') throw new IsolateError(403, 'เฉพาะบทบาท ICN เท่านั้นที่บันทึก/ยืนยันข้อมูลได้');
  const input = normalizeInput(rawInput);
  const master = await getEntryMaster();
  const cfg = getEntryConfig();
  const flags = validateIsolateInput(input, buildValidationCtx(master, cfg.sddAllowed, bangkokToday()));

  // Hard requirements to store a row at all (DB columns are NOT NULL).
  const hard: Flag[] = [];
  if (!input.hn) hard.push({ path: 'hn', reason: 'ต้องระบุ HN' });
  const organism = master.organisms.find((o) => o.id === input.organismId);
  if (!organism) hard.push({ path: 'organismId', reason: 'ต้องเลือกเชื้อจาก master' });
  if (!input.specimenDate) hard.push({ path: 'specimenDate', reason: 'ต้องระบุวันที่รับตรวจ' });
  if (!input.specimenType) hard.push({ path: 'specimenType', reason: 'ต้องระบุชนิด specimen' });
  if (hard.length || !organism || !input.specimenDate || !input.specimenType) {
    throw new IsolateError(400, 'ข้อมูลไม่ครบสำหรับการบันทึก', [...hard, ...flags]);
  }
  const specimenDate = input.specimenDate;
  const specimenType = input.specimenType;
  const wardId = master.wards.some((w) => w.id === input.wardId) ? input.wardId : null;

  // AST rows to store: known drug + result, first occurrence per drug.
  const drugIds = new Set(master.drugs.map((d) => d.id));
  const astRows: { drugId: number; result: string }[] = [];
  for (const a of input.ast) {
    if (a.drugId == null || a.result == null || !drugIds.has(a.drugId)) continue;
    if (astRows.some((r) => r.drugId === a.drugId)) continue;
    astRows.push({ drugId: a.drugId, result: a.result });
  }

  if (!opts.confirmDuplicate) {
    const duplicate = await findDuplicate({ ...input, organismId: organism.id, specimenDate, specimenType });
    if (duplicate) return { duplicate };
  }

  let phenotypes: PhenotypeResult[] = [];
  try {
    phenotypes = computePhenotypes(input, master, cfg.phenotypeRules, cfg.intrinsic);
  } catch (e) {
    console.error('[isolates] phenotype evaluation failed', errorSummary(e));
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = await nextIsolateCode();
    try {
      const created = await prisma.isolate.create({
        data: {
          code,
          hn: input.hn,
          sex: input.sex ?? null,
          patientType: input.patientType,
          wardId,
          labNo: input.labNo ?? null,
          orderNo: input.orderNo ?? null,
          specimenDate: dayStart(specimenDate),
          specimenType,
          specimenDetail: input.specimenDetail ?? null,
          organismId: organism.id,
          reportStatus: input.reportStatus,
          status: 'DRAFT',
          source: input.source,
          needsReview: JSON.stringify(flags),
          phenotypes: JSON.stringify(phenotypes),
          labComments: input.labComments ?? null,
          sourceFile: input.sourceFile ?? null,
          createdBy: role,
          ast: { create: astRows },
        },
        select: { id: true, code: true },
      });
      return { id: created.id, code: created.code, status: 'DRAFT', flags };
    } catch (e) {
      if (isUniqueViolation(e) && attempt < 4) continue; // code race → retry with next code
      throw e;
    }
  }
  throw new IsolateError(500, 'สร้างรหัส isolate ไม่สำเร็จ');
}

// ---------- approve ----------
export async function approveIsolate(id: string, role: Role) {
  if (role !== 'ICN') throw new IsolateError(403, 'เฉพาะบทบาท ICN เท่านั้นที่ยืนยันข้อมูลได้');
  const iso = await prisma.isolate.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      status: true,
      wardId: true,
      patientType: true,
      needsReview: true,
      approvedAt: true,
      approvedBy: true,
      _count: { select: { ast: true } },
    },
  });
  if (!iso) throw new IsolateError(404, 'ไม่พบ isolate');
  if (iso.status === 'APPROVED') {
    return { id: iso.id, code: iso.code, status: 'APPROVED' as const, approvedAt: iso.approvedAt?.toISOString() ?? null, approvedBy: iso.approvedBy };
  }
  const blocking: Flag[] = [...parseJsonArray<Flag>(iso.needsReview)];
  if (iso.wardId == null) blocking.push({ path: 'wardId', reason: 'ต้องเลือก Ward ก่อนยืนยัน' });
  if (!iso.patientType) blocking.push({ path: 'patientType', reason: 'ต้องเลือก Patient Type ก่อนยืนยัน' });
  if (iso._count.ast === 0) blocking.push({ path: 'ast', reason: 'ต้องมีผล AST อย่างน้อย 1 รายการ' });
  if (blocking.length) {
    throw new IsolateError(422, 'ยังยืนยันไม่ได้: มีธงค้างหรือฟิลด์จำเป็นไม่ครบ', blocking);
  }
  const updated = await prisma.isolate.update({
    where: { id },
    data: { status: 'APPROVED', approvedBy: role, approvedAt: new Date() },
    select: { id: true, code: true, approvedAt: true, approvedBy: true },
  });
  return {
    id: updated.id,
    code: updated.code,
    status: 'APPROVED' as const,
    approvedAt: updated.approvedAt?.toISOString() ?? null,
    approvedBy: updated.approvedBy,
  };
}

// ---------- delete ----------
export async function deleteIsolate(id: string, role: Role) {
  if (role !== 'ICN') throw new IsolateError(403, 'เฉพาะบทบาท ICN เท่านั้นที่ลบข้อมูลได้');
  const iso = await prisma.isolate.findUnique({ where: { id }, select: { id: true, code: true } });
  if (!iso) throw new IsolateError(404, 'ไม่พบ isolate');
  await prisma.$transaction([
    prisma.astResult.deleteMany({ where: { isolateId: id } }),
    prisma.isolate.delete({ where: { id } }),
  ]);
  return { ok: true as const, id: iso.id, code: iso.code };
}

// ---------- list ----------
export interface IsolateListFilter {
  hn?: string;
  organismId?: number;
  wardId?: number;
  status?: 'DRAFT' | 'APPROVED';
  reportStatus?: ReportStatus;
  from?: string;
  to?: string;
  limit?: number;
}
export interface IsolateListItem {
  id: string;
  code: string;
  hn: string | null; // null for EXECUTIVE
  sex: string | null;
  patientType: string | null;
  wardId: number | null;
  wardName: string | null;
  wardType: 'ICU' | 'NON_ICU' | null;
  labNo: string | null; // null for EXECUTIVE
  specimenDate: string;
  specimenType: SpecimenType;
  organismId: number;
  organismName: string;
  status: 'DRAFT' | 'APPROVED';
  reportStatus: ReportStatus;
  source: string;
  flags: Flag[]; // empty for EXECUTIVE (reasons may quote identifiers)
  flagCount: number;
  phenotypes: PhenotypeCode[];
  astCount: number;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
}
export interface IsolateListResponse {
  total: number;
  limit: number;
  hnHidden: boolean;
  items: IsolateListItem[];
}

export function parseListFilter(sp: URLSearchParams): IsolateListFilter {
  const int = (k: string) => {
    const v = sp.get(k);
    if (!v) return undefined;
    const n = Number(v);
    return Number.isInteger(n) ? n : undefined;
  };
  const ymd = (k: string) => {
    const v = sp.get(k);
    return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
  };
  const status = sp.get('status');
  const rs = sp.get('reportStatus');
  const hn = sp.get('hn')?.trim().slice(0, 20);
  const limit = int('limit');
  return {
    hn: hn || undefined,
    organismId: int('organismId'),
    wardId: int('wardId'),
    status: status === 'DRAFT' || status === 'APPROVED' ? status : undefined,
    reportStatus: rs === 'FINAL' || rs === 'PRELIMINARY' || rs === 'UNKNOWN' ? rs : undefined,
    from: ymd('from'),
    to: ymd('to'),
    limit: limit == null ? undefined : Math.min(Math.max(limit, 1), 500),
  };
}

export async function listIsolates(filter: IsolateListFilter, role: Role): Promise<IsolateListResponse> {
  const hideHn = role === 'EXECUTIVE';
  const limit = filter.limit ?? 200;
  const where: Prisma.IsolateWhereInput = {};
  // Postgres LIKE is case-sensitive; keep SQLite's case-insensitive search behaviour.
  if (filter.hn && !hideHn) where.hn = { contains: filter.hn, mode: 'insensitive' };
  if (filter.organismId != null) where.organismId = filter.organismId;
  if (filter.wardId != null) where.wardId = filter.wardId;
  if (filter.status) where.status = filter.status;
  if (filter.reportStatus) where.reportStatus = filter.reportStatus;
  if (filter.from || filter.to) {
    where.specimenDate = {
      ...(filter.from ? { gte: dayStart(filter.from) } : {}),
      ...(filter.to ? { lt: nextDay(filter.to) } : {}),
    };
  }
  const [total, rows] = await Promise.all([
    prisma.isolate.count({ where }),
    prisma.isolate.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { specimenDate: 'desc' }, { code: 'desc' }],
      take: limit,
      include: { organism: true, ward: true, _count: { select: { ast: true } } },
    }),
  ]);
  const items: IsolateListItem[] = rows.map((r) => {
    const flags = parseJsonArray<Flag>(r.needsReview);
    const phen = parseJsonArray<PhenotypeResult>(r.phenotypes)
      .filter((p) => p && p.result === 'POSITIVE')
      .map((p) => p.code);
    return {
      id: r.id,
      code: r.code,
      hn: hideHn ? null : r.hn,
      sex: r.sex,
      patientType: r.patientType,
      wardId: r.wardId,
      wardName: r.ward?.name ?? null,
      wardType: r.ward ? (r.ward.wardType === 'ICU' ? 'ICU' : 'NON_ICU') : null,
      labNo: hideHn ? null : r.labNo,
      specimenDate: toYmd(r.specimenDate),
      specimenType: r.specimenType as SpecimenType,
      organismId: r.organismId,
      organismName: r.organism.name,
      status: r.status === 'APPROVED' ? 'APPROVED' : 'DRAFT',
      reportStatus: (r.reportStatus as ReportStatus) ?? 'UNKNOWN',
      source: r.source,
      flags: hideHn ? [] : flags,
      flagCount: flags.length,
      phenotypes: phen,
      astCount: r._count.ast,
      approvedBy: r.approvedBy,
      approvedAt: r.approvedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    };
  });
  return { total, limit, hnHidden: hideHn, items };
}
