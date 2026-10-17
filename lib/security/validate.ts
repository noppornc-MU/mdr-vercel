// Zod validation of API query strings and route params (SECURITY.md §4).
// Bodies are validated next to their handlers (createBodySchema, ConsultRequestSchema, extract schemas).
// Query values that pass here are then mapped by the existing allow-list parsers (components/*/params.ts).
import { NextResponse } from 'next/server';
import { z } from 'zod';

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const smallInt = z.string().regex(/^\d{1,9}$/);
const wardType = z.enum(['ICU', 'NON_ICU']);
const specimenType = z.enum(['BLOOD', 'RESPIRATORY', 'URINE', 'WOUND', 'OTHER']);

/** GET /api/dashboard */
export const dashboardQuerySchema = z
  .object({
    from: ymd,
    to: ymd,
    wardType,
    wardId: z.string().regex(/^\d{1,6}$/),
    specimenType,
    organism: z.string().max(120),
  })
  .partial()
  .strict();

/** GET /api/antibiogram */
export const antibiogramQuerySchema = dashboardQuerySchema
  .extend({
    phenotype: z.enum(['CRE', 'ESBL_SCREEN', 'CRAB', 'CRPA', 'MRSA', 'VRE']),
    minN: z.string().regex(/^\d{1,4}$/),
    formula: z.enum(['S_ONLY', 'S_PLUS_SDD']),
    view: z.enum(['overview', 'phenotype']),
    group: z.string().max(40),
  })
  .partial()
  .strict();

/** GET /api/isolates */
export const isolatesQuerySchema = z
  .object({
    hn: z.string().max(20),
    organismId: smallInt,
    wardId: smallInt,
    status: z.enum(['DRAFT', 'APPROVED']),
    reportStatus: z.enum(['FINAL', 'PRELIMINARY', 'UNKNOWN']),
    from: ymd,
    to: ymd,
    limit: z.string().regex(/^\d{1,4}$/),
  })
  .partial()
  .strict();

/**
 * GET /api/extract/file — only names this server generates (24 hex + allowed extension) or the sample.
 * Anything else (../, ..\, %2e%2e, absolute paths, NUL, other extensions) fails validation.
 */
export const fileQuerySchema = z
  .object({ name: z.string().regex(/^(?:[a-f0-9]{24}\.(?:png|jpg|pdf)|sample_report\.png)$/) })
  .strict();

/** Isolate ids are UUIDs (Prisma @default(uuid()) and the seed generator). */
export const isolateIdSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

export type QueryResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

/**
 * Validate URLSearchParams with a Zod object schema. Empty values count as absent; repeated keys
 * (parameter pollution) and unknown keys are rejected with 400.
 */
export function parseQuery<S extends z.ZodType>(sp: URLSearchParams, schema: S): QueryResult<z.infer<S>> {
  const obj: Record<string, string> = {};
  const seen = new Set<string>();
  for (const [k, v] of sp) {
    if (seen.has(k)) return { ok: false, response: badRequest('พารามิเตอร์ซ้ำกัน') };
    seen.add(k);
    if (v !== '') obj[k] = v;
  }
  const r = schema.safeParse(obj);
  if (!r.success) {
    // Name only schema fields (never echo client-supplied keys or values).
    const fields = [...new Set(r.error.issues.filter((i) => i.code !== 'unrecognized_keys').map((i) => String(i.path[0])))];
    const unknown = r.error.issues.some((i) => i.code === 'unrecognized_keys');
    const detail = [fields.length ? fields.join(', ') : '', unknown ? 'มีพารามิเตอร์ที่ไม่รู้จัก' : ''].filter(Boolean).join(' ; ');
    return { ok: false, response: badRequest(`พารามิเตอร์ไม่ถูกต้อง: ${detail}`) };
  }
  return { ok: true, data: r.data };
}

export function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}
