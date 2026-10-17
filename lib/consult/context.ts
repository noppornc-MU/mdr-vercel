// Fill missing consult context (organism / ward / specimen / phenotype) from the free-text question.
// Only fills fields the user did not choose explicitly. Pure.
import type { PhenotypeCode, SpecimenType } from '@/lib/domain/types';

export interface NamedEntry {
  id: number;
  name: string;
  aliases?: string[];
}
export interface WardEntry extends NamedEntry {
  wardType: 'ICU' | 'NON_ICU';
}

function longestMatch<T extends NamedEntry>(text: string, entries: T[]): T | null {
  const t = text.toLowerCase();
  let best: { e: T; len: number } | null = null;
  for (const e of entries) {
    for (const label of [e.name, ...(e.aliases ?? [])]) {
      const l = label.toLowerCase().trim();
      if (l.length < 3) continue;
      const idx = t.indexOf(l);
      if (idx < 0) continue;
      // avoid matching inside a longer latin word
      const before = t[idx - 1] ?? ' ';
      const after = t[idx + l.length] ?? ' ';
      if (/[a-z0-9]/.test(before) || /[a-z0-9]/.test(after)) continue;
      if (!best || l.length > best.len) best = { e, len: l.length };
    }
  }
  return best?.e ?? null;
}

export function inferSpecimen(text: string): SpecimenType | null {
  const s = text.toLowerCase();
  if (/blood|hemoculture|haemoculture|เลือด/.test(s)) return 'BLOOD';
  if (/sputum|respirat|tracheal|เสมหะ|ทางเดินหายใจ|ปอด/.test(s)) return 'RESPIRATORY';
  if (/urine|ปัสสาวะ/.test(s)) return 'URINE';
  if (/wound|pus|แผล|หนอง/.test(s)) return 'WOUND';
  return null;
}

export function inferPhenotype(text: string): PhenotypeCode | null {
  const m = text.match(/\b(CRE|CRAB|CRPA|MRSA|VRE|ESBL)\b/i);
  if (!m) return null;
  const code = m[1].toUpperCase();
  return (code === 'ESBL' ? 'ESBL_SCREEN' : code) as PhenotypeCode;
}

export function inferContext(
  question: string,
  organisms: NamedEntry[],
  wards: WardEntry[],
): { organismId: number | null; wardId: number | null; wardType: 'ICU' | 'NON_ICU' | null; specimenType: SpecimenType | null; phenotype: PhenotypeCode | null } {
  const q = question || '';
  const org = longestMatch(q, organisms);
  const ward = longestMatch(q, wards);
  const wardType = !ward && /\bICU\b/i.test(q) ? 'ICU' : null;
  return {
    organismId: org?.id ?? null,
    wardId: ward?.id ?? null,
    wardType,
    specimenType: inferSpecimen(q),
    phenotype: inferPhenotype(q),
  };
}
