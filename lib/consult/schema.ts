// AI Consult output schema (design §6.2) + toolResults shapes passed to the model and verify().
import { z } from 'zod';
import type { AbgCell, AstCode, Formula, PhenotypeCode, SpecimenType } from '@/lib/domain/types';

export const TIERS = ['SUPPORTED', 'CONSIDER', 'NOT_SUPPORTED', 'LOW_DATA', 'INTRINSIC'] as const;

export const FactSchema = z.object({
  id: z.string(),
  statement: z.string(),
  organism: z.string(),
  drug: z.string(),
  pct_s: z.number().nullable(),
  n_tested: z.number().nullable(),
  call_id: z.string(),
  tier: z.enum(TIERS).nullable().optional(),
  /** Only for facts taken from the isolate's own lab result (MR14.3). */
  result: z.enum(['S', 'I', 'R', 'D']).nullable().optional(),
});

export const ConsultOutputSchema = z.object({
  scope: z.object({
    organism: z.string(),
    ward: z.string(),
    specimen_category: z.string(),
    period: z.string(),
    data_as_of: z.string(),
    min_n: z.number(),
  }),
  facts: z.array(FactSchema),
  reasoning: z.array(z.object({ statement: z.string(), depends_on: z.array(z.string()) })),
  needs_clinician_judgment: z.array(z.string()),
  abstentions: z.array(
    z.object({
      reason: z.enum(['n_below_minimum', 'no_data', 'out_of_scope', 'dose_requested']),
      detail: z.string(),
    }),
  ),
  disclaimer_shown: z.boolean(),
});

export type ConsultFact = z.infer<typeof FactSchema>;
export type ConsultOutput = z.infer<typeof ConsultOutputSchema>;

// ---- toolResults (deterministic numbers from lib/stats, each block has a call_id) ----

export interface AbgToolCall {
  call_id: string;
  tool: 'getAntibiogram' | 'getPhenotypeBreakdown';
  label: string; // human-readable scope of this call
  phenotype?: PhenotypeCode | null;
  counts?: { code: PhenotypeCode; positive: number; negative: number; unclassifiable: number }[];
  cells: AbgCell[];
}

export interface IsolateToolCall {
  call_id: string;
  tool: 'isolate';
  organism: string;
  phenotypes: PhenotypeCode[];
  ward: string | null;
  specimenType: SpecimenType | null;
  ast: { drug: string; result: AstCode }[];
}

export type ToolCall = AbgToolCall | IsolateToolCall;

export interface ConsultScope {
  organism: string | null;
  phenotype: PhenotypeCode | null;
  wardId: number | null;
  wardName: string | null;
  wardType: 'ICU' | 'NON_ICU' | null;
  specimenType: SpecimenType | null;
  site: string | null;
}

export interface ConsultToolResults {
  scope: ConsultScope;
  meta: { from: string; to: string; dataAsOf: string; minN: number; formula: Formula; pendingCount: number };
  calls: ToolCall[];
}
