// Golden extraction: synthetic sample report → 15/15 drug-result pairs + Ward flag (DoD 1).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import drugsJson from '@/config/drugs.json';
import organismsJson from '@/config/organisms.json';
import sddJson from '@/config/sdd_allowed.json';
import wardsJson from '@/config/wards.json';
import type { DomainOrganism, OrgGroup } from '@/lib/domain/types';
import { normalizeExtraction, type NormalizeContext } from '@/lib/extract/normalize';
import { ExtractionSchema } from '@/lib/extract/schema';

const GOLDEN: [string, string][] = [
  ['Amikacin', 'S'],
  ['Amoxicillin/clavulanate', 'R'],
  ['Ampicillin', 'R'],
  ['Cefepime', 'S'],
  ['Cefoxitin', 'R'],
  ['Ceftriaxone', 'R'],
  ['Cefuroxime', 'R'],
  ['Ciprofloxacin', 'R'],
  ['Ertapenem', 'S'],
  ['Gentamicin', 'S'],
  ['Imipenem', 'S'],
  ['Meropenem', 'S'],
  ['Piperacillin/tazobactam', 'D'],
  ['Tetracycline', 'R'],
  ['Trimethoprim/sulfamethoxazole', 'S'],
];

const drugs = (drugsJson as { name: string; aliases?: string[] }[]).map((d, i) => ({ id: i + 1, name: d.name, aliases: d.aliases ?? [] }));
const organisms = (organismsJson as { name: string; orgClass: string; group: string; aliases?: string[] }[]).map((o, i) => ({
  id: i + 1,
  name: o.name,
  orgClass: o.orgClass as DomainOrganism['orgClass'],
  group: o.group as OrgGroup,
  aliases: o.aliases ?? [],
}));

const ctx: NormalizeContext = {
  organisms,
  drugs,
  wardIds: (wardsJson as unknown[]).map((_, i) => i + 1),
  sddAllowed: sddJson as { drug: string; group: OrgGroup }[],
  today: '2026-10-16',
  sourceFile: 'sample_report.png',
};

const raw = ExtractionSchema.parse(
  JSON.parse(readFileSync(path.join(process.cwd(), 'fixtures', 'sample_report.expected.json'), 'utf8')),
);

describe('golden extraction (synthetic sample report)', () => {
  const { input, flags } = normalizeExtraction(raw, ctx);
  const nameById = new Map(drugs.map((d) => [d.id, d.name]));

  it('maps all 15 drug-result pairs to master', () => {
    expect(input.ast).toHaveLength(15);
    const got = input.ast.map((a) => [a.drugId === null ? null : nameById.get(a.drugId), a.result]);
    expect(got).toEqual(GOLDEN);
    expect(flags.filter((f) => f.path.startsWith('ast'))).toEqual([]);
  });

  it('reads organism, specimen, BE date, status and fictional ids', () => {
    expect(organisms.find((o) => o.id === input.organismId)?.name).toBe('Klebsiella pneumoniae');
    expect(input.specimenType).toBe('BLOOD');
    expect(input.specimenDetail).toBe('Hemoculture');
    expect(input.specimenDate).toBe('2026-10-12'); // printed 12/10/2569 (BE)
    expect(input.reportStatus).toBe('FINAL');
    expect(input.hn).toBe('0000123');
    expect(input.labNo).toBe('9900000001');
    expect(input.source).toBe('OCR');
  });

  it('flags Ward (not on the report) until the user chooses one', () => {
    expect(input.wardId).toBeNull();
    expect(flags.some((f) => f.path === 'wardId')).toBe(true);
    expect(flags.some((f) => /organism|specimen|hn|reportStatus/.test(f.path))).toBe(false);
  });

  it('never extracts a patient name', () => {
    const withName = ExtractionSchema.parse({ ...raw, patient_name: 'SHOULD-NOT-SURVIVE' });
    expect(JSON.stringify(withName)).not.toContain('SHOULD-NOT-SURVIVE');
  });
});
