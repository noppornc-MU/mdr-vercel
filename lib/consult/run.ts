// Server-side AI Consult pipeline (design §6.1):
// redact → toolResults (same lib/stats functions as the Antibiogram page) → LLM/cached → verify (retry once) → log.
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { evaluatePhenotypes, positivePhenotypes } from '@/lib/domain/phenotype';
import type { AstCode, DomainIsolate, Formula, PhenotypeCode, SpecimenType } from '@/lib/domain/types';
import { getConfig } from '@/lib/config';
import { generateJsonWithMeta, LlmError, resolveProvider } from '@/lib/llm';
import { getAntibiogram, getPhenotypeBreakdown } from '@/lib/stats';
import { composeCachedConsult } from './cached';
import { inferContext } from './context';
import { buildConsultUserPrompt, CONSULT_PROMPT_VERSION, CONSULT_SYSTEM_PROMPT } from './prompt';
import { redact } from './redact';
import {
  ConsultOutputSchema,
  type AbgToolCall,
  type ConsultOutput,
  type ConsultToolResults,
  type IsolateToolCall,
} from './schema';
import { verify, type VerifyResult } from './verify';

const PHENOS = ['CRE', 'ESBL_SCREEN', 'CRAB', 'CRPA', 'MRSA', 'VRE'] as const;
const SPECIMENS = ['BLOOD', 'RESPIRATORY', 'URINE', 'WOUND', 'OTHER'] as const;
const emptyToNull = (v: unknown) => (v === '' || v === undefined ? null : v);

export const ConsultRequestSchema = z.object({
  organism: z.preprocess(emptyToNull, z.union([z.string().max(200), z.number()]).nullable()).optional(),
  phenotype: z.preprocess(emptyToNull, z.enum(PHENOS).nullable()).optional(),
  wardId: z.preprocess(emptyToNull, z.coerce.number().int().nullable()).optional(),
  wardType: z.preprocess(emptyToNull, z.enum(['ICU', 'NON_ICU']).nullable()).optional(),
  specimenType: z.preprocess(emptyToNull, z.enum(SPECIMENS).nullable()).optional(),
  site: z.preprocess(emptyToNull, z.string().max(200).nullable()).optional(),
  question: z.preprocess(emptyToNull, z.string().max(1000).nullable()).optional(),
  isolateId: z.preprocess(emptyToNull, z.string().max(64).nullable()).optional(),
  minN: z.preprocess(emptyToNull, z.coerce.number().int().min(1).max(1000).nullable()).optional(),
  formula: z.preprocess(emptyToNull, z.enum(['S_ONLY', 'S_PLUS_SDD']).nullable()).optional(),
});
export type ConsultRequest = z.infer<typeof ConsultRequestSchema>;

export interface WidenOption {
  label: string;
  wardId: number | null;
  wardType: 'ICU' | 'NON_ICU' | null;
  specimenType: SpecimenType | null;
}

export interface ConsultResponse {
  ok: boolean;
  answer: ConsultOutput | null;
  verify: VerifyResult;
  toolResults: ConsultToolResults | null;
  retried: boolean;
  mode: 'live' | 'cached';
  model: string;
  redacted: boolean;
  question: string;
  context: {
    organism: string | null;
    phenotype: PhenotypeCode | null;
    wardId: number | null;
    wardName: string | null;
    wardType: 'ICU' | 'NON_ICU' | null;
    specimenType: SpecimenType | null;
    isolateCode: string | null;
  };
  widen: WidenOption[];
  error?: string;
}

export class ConsultError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const parseJson = <T,>(s: string | null | undefined, fallback: T): T => {
  try {
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
};

export async function runConsult(body: unknown, role: string): Promise<ConsultResponse> {
  const req = ConsultRequestSchema.parse(body ?? {});
  const q = redact(req.question);
  const site = redact(req.site);
  const minN = req.minN ?? 30;
  const formula: Formula = req.formula ?? 'S_ONLY';

  const [organisms, wards] = await Promise.all([
    prisma.organism.findMany(),
    prisma.ward.findMany(),
  ]);
  const orgEntries = organisms.map((o) => ({ ...o, aliases: parseJson<string[]>(o.aliases, []) }));
  const wardEntries = wards.map((w) => ({
    ...w,
    wardType: (w.wardType === 'ICU' ? 'ICU' : 'NON_ICU') as 'ICU' | 'NON_ICU',
    aliases: parseJson<string[]>(w.aliases, []),
  }));

  // Explicit context first, then fill gaps from the (redacted) question.
  let organismName: string | null = null;
  if (req.organism !== null && req.organism !== undefined) {
    const v = String(req.organism).trim();
    const byId = /^\d+$/.test(v) ? organisms.find((o) => o.id === Number(v)) : undefined;
    const byName = orgEntries.find(
      (o) => o.name.toLowerCase() === v.toLowerCase() || o.aliases.some((a) => a.toLowerCase() === v.toLowerCase()),
    );
    organismName = byId?.name ?? byName?.name ?? v;
  }
  let phenotype: PhenotypeCode | null = req.phenotype ?? null;
  let wardId: number | null = req.wardId ?? null;
  let wardType: 'ICU' | 'NON_ICU' | null = req.wardType ?? null;
  let specimenType: SpecimenType | null = req.specimenType ?? null;

  // MR14: consult from an isolate — send organism + phenotype + AST + ward only (no HN / dates).
  let isolateCall: IsolateToolCall | null = null;
  let isolateCode: string | null = null;
  if (req.isolateId) {
    if (role === 'EXECUTIVE') throw new ConsultError(403, 'บทบาทผู้บริหารไม่สามารถปรึกษา AI จาก isolate ได้');
    const iso = await prisma.isolate.findUnique({
      where: { id: req.isolateId },
      include: { organism: true, ward: true, ast: { include: { drug: true } } },
    });
    if (!iso) throw new ConsultError(404, 'ไม่พบ isolate');
    isolateCode = iso.code;
    organismName = iso.organism.name;
    wardId = iso.wardId ?? wardId;
    specimenType = (iso.specimenType as SpecimenType) ?? specimenType;
    const astMap: Record<string, AstCode> = {};
    for (const a of iso.ast) astMap[a.drug.name] = a.result as AstCode;
    let phenos = positivePhenotypes(parseJson(iso.phenotypes, []));
    if (phenos.length === 0) {
      try {
        const domainIso: DomainIsolate = {
          id: iso.id,
          code: iso.code,
          hn: '',
          wardId: iso.wardId,
          wardName: iso.ward?.name ?? null,
          wardType: (iso.ward?.wardType as 'ICU' | 'NON_ICU' | undefined) ?? null,
          specimenDate: iso.specimenDate.toISOString().slice(0, 10),
          specimenType: iso.specimenType as SpecimenType,
          organism: {
            id: iso.organism.id,
            name: iso.organism.name,
            orgClass: iso.organism.orgClass as DomainIsolate['organism']['orgClass'],
            group: iso.organism.group as DomainIsolate['organism']['group'],
          },
          status: iso.status as 'DRAFT' | 'APPROVED',
          reportStatus: iso.reportStatus as DomainIsolate['reportStatus'],
          createdAt: iso.createdAt.toISOString(),
          ast: astMap,
        };
        const cfg = getConfig();
        phenos = positivePhenotypes(evaluatePhenotypes(domainIso, cfg.phenotypeRules, cfg.intrinsic));
      } catch {
        phenos = [];
      }
    }
    isolateCall = {
      call_id: 'iso_1',
      tool: 'isolate',
      organism: iso.organism.name,
      phenotypes: phenos,
      ward: iso.ward?.name ?? null,
      specimenType: (iso.specimenType as SpecimenType) ?? null,
      ast: Object.entries(astMap).map(([drug, result]) => ({ drug, result })),
    };
  } else {
    const inferred = inferContext(q.text, orgEntries, wardEntries);
    if (!organismName && inferred.organismId) organismName = organisms.find((o) => o.id === inferred.organismId)?.name ?? null;
    if (!phenotype && inferred.phenotype) phenotype = inferred.phenotype;
    if (wardId === null && !wardType) {
      wardId = inferred.wardId;
      wardType = inferred.wardType;
    }
    if (!specimenType) specimenType = inferred.specimenType;
  }

  const ward = wardId !== null ? wards.find((w) => w.id === wardId) ?? null : null;
  if (wardId !== null && !ward) wardId = null;

  // Deterministic numbers — same functions as /api/antibiogram.
  const scopeArgs = {
    wardId: wardId ?? undefined,
    wardType: wardId === null ? wardType ?? undefined : undefined,
    specimenType: specimenType ?? undefined,
    minN,
    formula,
  };
  const abg = await getAntibiogram({ ...scopeArgs, organism: organismName ?? undefined });
  const scopeLabel = [organismName ?? '-', ward?.name ?? wardType ?? 'ทั้งโรงพยาบาล', specimenType ?? 'ทุก specimen'].join(' · ');
  const calls: ConsultToolResults['calls'] = [];
  const abgCall: AbgToolCall = {
    call_id: 'abg_1',
    tool: 'getAntibiogram',
    label: scopeLabel,
    cells: organismName ? abg.cells.filter((c) => c.organism.toLowerCase() === organismName!.toLowerCase()) : abg.cells,
  };
  if (organismName && abgCall.cells.length === 0) abgCall.cells = abg.cells; // name mismatch → keep, composer filters loosely
  calls.push(abgCall);
  if (phenotype) {
    const pb = await getPhenotypeBreakdown({ ...scopeArgs, organism: organismName ?? undefined, phenotype });
    calls.push({
      call_id: 'pheno_1',
      tool: 'getPhenotypeBreakdown',
      label: `${scopeLabel} · ${phenotype}`,
      phenotype,
      counts: pb.counts,
      cells: pb.drugs,
    });
  }
  if (isolateCall) calls.push(isolateCall);

  const toolResults: ConsultToolResults = {
    scope: {
      organism: organismName,
      phenotype,
      wardId,
      wardName: ward?.name ?? null,
      wardType: ward ? ((ward.wardType === 'ICU' ? 'ICU' : 'NON_ICU') as 'ICU' | 'NON_ICU') : wardType,
      specimenType,
      site: site.text || null,
    },
    meta: {
      from: abg.meta.from,
      to: abg.meta.to,
      dataAsOf: abg.meta.dataAsOf,
      minN: abg.meta.minN ?? minN,
      formula: abg.meta.formula ?? formula,
      pendingCount: abg.meta.pendingCount ?? 0,
    },
    calls,
  };

  const question = q.text;
  const resolved = resolveProvider('consult');
  let answer: ConsultOutput | null = null;
  let result: VerifyResult = { passed: false, errors: [] };
  let retried = false;
  let model = `${resolved.name}:${resolved.model}`;
  let error: string | undefined;
  let lastRaw: unknown = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    retried = attempt > 0;
    try {
      const gen = await generateJsonWithMeta<ConsultOutput>({
        task: 'consult',
        system: CONSULT_SYSTEM_PROMPT,
        user: buildConsultUserPrompt({ question, toolResults, previousErrors: attempt > 0 ? result.errors : undefined }),
        schema: ConsultOutputSchema,
        cached: () => composeCachedConsult({ question, toolResults }),
      });
      model = `${gen.provider}:${gen.model}`;
      lastRaw = gen.data;
      result = verify(gen.data, toolResults);
      if (result.passed) {
        answer = gen.data;
        break;
      }
    } catch (e) {
      error = e instanceof LlmError ? e.message : 'เรียก AI ไม่สำเร็จ';
      result = { passed: false, errors: [error] };
      break; // provider/network failure: readable error, no second attempt (MR16)
    }
  }
  if (!answer && !error) error = 'ไม่สามารถสร้างคำตอบที่ตรวจสอบได้';

  const widen: WidenOption[] = [];
  if (answer?.abstentions.some((a) => a.reason === 'n_below_minimum' || a.reason === 'no_data')) {
    if (ward) {
      if (ward.wardType === 'ICU') widen.push({ label: 'ขยายเป็น ICU รวม', wardId: null, wardType: 'ICU', specimenType });
      widen.push({ label: 'ขยายเป็นระดับโรงพยาบาล', wardId: null, wardType: null, specimenType });
    } else if (wardType) {
      widen.push({ label: 'ขยายเป็นระดับโรงพยาบาล', wardId: null, wardType: null, specimenType });
    }
    if (specimenType) widen.push({ label: 'รวมทุกชนิด specimen', wardId, wardType: ward ? null : wardType, specimenType: null });
  }

  try {
    await prisma.aiConsultLog.create({
      data: {
        role,
        input: JSON.stringify({
          organism: organismName,
          phenotype,
          wardId,
          wardType,
          specimenType,
          site: site.text || null,
          question,
          isolateId: req.isolateId ?? null,
          redacted: q.redacted || site.redacted,
        }),
        toolResults: JSON.stringify(toolResults),
        output: JSON.stringify(answer ?? lastRaw),
        verify: JSON.stringify({ ...result, retried }),
        model,
        promptVersion: CONSULT_PROMPT_VERSION,
      },
    });
  } catch {
    /* logging must not break the answer */
  }

  return {
    ok: Boolean(answer),
    answer,
    verify: answer ? result : { passed: false, errors: result.errors },
    toolResults,
    retried,
    mode: resolved.mode,
    model,
    redacted: q.redacted || site.redacted,
    question,
    context: {
      organism: organismName,
      phenotype,
      wardId,
      wardName: ward?.name ?? null,
      wardType: toolResults.scope.wardType,
      specimenType,
      isolateCode,
    },
    widen,
    ...(error ? { error } : {}),
  };
}
