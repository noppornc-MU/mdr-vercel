// Server: phenotype breakdown + MR11 drug cards for an organism/phenotype scope. Used by API and AI consult.
import { getConfig } from '@/lib/config';
import { computeAntibiogram, sortCellsForCards } from '@/lib/domain/antibiogram';
import type { AbgCell, DomainIsolate, OrgGroup, PhenotypeCode } from '@/lib/domain/types';
import { hasPhenotype, metaOf, resolveScope, type AntibiogramMeta, type AntibiogramScope } from './antibiogram';

const CODES: PhenotypeCode[] = ['CRE', 'ESBL_SCREEN', 'CRAB', 'CRPA', 'MRSA', 'VRE'];

export interface PhenotypeBreakdown {
  meta: AntibiogramMeta & { organismLabel: string; organisms: string[] };
  /** Over first isolates in scope (organism filter applied, phenotype filter NOT applied). */
  counts: { code: PhenotypeCode; positive: number; negative: number; unclassifiable: number }[];
  /** Drug cards for the selected organism/phenotype: %S desc, insufficient after, intrinsic last. */
  drugs: AbgCell[];
}

export async function getPhenotypeBreakdown(scope: AntibiogramScope = {}): Promise<PhenotypeBreakdown> {
  const r = await resolveScope(scope);
  const cfg = getConfig();

  const counts = CODES.map((code) => {
    let positive = 0, negative = 0, unclassifiable = 0;
    for (const iso of r.firsts) {
      const p = iso.phenotypes.find((x) => x.code === code);
      if (!p) continue;
      if (p.result === 'POSITIVE') positive++;
      else if (p.result === 'NEGATIVE') negative++;
      else unclassifiable++;
    }
    return { code, positive, negative, unclassifiable };
  });

  const subset = r.phenotype ? r.firsts.filter((i) => hasPhenotype(i, r.phenotype!)) : r.firsts;
  const organisms = [...new Set(subset.map((i) => i.organism.name))].sort();
  const organismLabel = [
    scope.organism !== null && scope.organism !== undefined && scope.organism !== '' ? (organisms.length === 1 ? organisms[0] : String(scope.organism)) : organisms.length === 1 ? organisms[0] : null,
    r.phenotype,
  ].filter(Boolean).join(' – ') || 'ทุกเชื้อ';

  // Several organisms (e.g. CRE across Enterobacterales) → aggregate into one card set.
  let input: DomainIsolate[] = subset;
  if (organisms.length > 1) {
    const groups = [...new Set(subset.map((i) => i.organism.group))];
    const group: OrgGroup = groups.length === 1 ? groups[0] : 'OTHER';
    input = subset.map((i) => ({ ...i, organism: { id: -1, name: organismLabel, orgClass: 'BACTERIA', group } }));
  }
  const abg = computeAntibiogram(input, { minN: r.minN, formula: r.formula, sddAllowed: cfg.sddAllowed, intrinsic: cfg.intrinsic, drugOrder: r.drugOrder });

  return {
    meta: { ...metaOf(r, scope, subset.length), organismLabel, organisms },
    counts,
    drugs: sortCellsForCards(abg.cells, r.drugOrder),
  };
}
