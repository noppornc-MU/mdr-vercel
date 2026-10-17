// Extraction schema (design §5). Unknown keys (e.g. a patient name) are stripped by Zod.
import { z } from 'zod';

const nstr = z.string().nullable().optional().transform((v) => (v === undefined ? null : v));

export const AstRowSchema = z.object({
  drug_raw: z.string(),
  result: z
    .union([z.enum(['S', 'I', 'R', 'D']), z.null()])
    .optional()
    .transform((v) => (v === undefined ? null : v)),
});

export const ExtractionSchema = z.object({
  lab_no: nstr,
  order_no: nstr,
  hn: nstr,
  sex: z
    .union([z.enum(['M', 'F']), z.null()])
    .optional()
    .transform((v) => (v === undefined ? null : v)),
  lab_received_at: nstr,
  lab_received_raw: nstr,
  reported_at: nstr,
  report_status: z.enum(['FINAL', 'PRELIMINARY', 'UNKNOWN']).catch('UNKNOWN'),
  specimen_raw: nstr,
  lab_comments: nstr,
  isolates: z
    .array(
      z.object({
        organism_raw: nstr,
        ast: z.array(AstRowSchema).default([]),
      }),
    )
    .default([]),
});

export type Extraction = z.infer<typeof ExtractionSchema>;
