// Pure helpers shared by the entry UI (client) and lib/isolates.ts (server).
// No Prisma / fetch / fs here — only pure lib/domain imports.
import type {
  AstCode,
  DomainIsolate,
  DomainOrganism,
  IsolateInput,
  OrgGroup,
  PhenotypeResult,
} from '@/lib/domain/types';
import { validateIsolateInput } from '@/lib/domain/validators';
import { evaluatePhenotypes } from '@/lib/domain/phenotype';

export interface MasterOrganism extends DomainOrganism {
  aliases: string[];
}
export interface MasterDrug {
  id: number;
  name: string;
  drugClass: string;
  displayOrder: number;
}
export interface MasterWard {
  id: number;
  code: string;
  name: string;
  wardType: 'ICU' | 'NON_ICU';
}
export interface EntryMaster {
  organisms: MasterOrganism[];
  drugs: MasterDrug[];
  wards: MasterWard[];
}
export interface EntryConfig {
  panels: Partial<Record<OrgGroup, string[]>>;
  sddAllowed: { drug: string; group: OrgGroup }[];
  intrinsic: { organism: string; drug: string }[];
  phenotypeRules: unknown[];
}

export type ValidationCtx = Parameters<typeof validateIsolateInput>[1];
type PhenotypeRulesArg = Parameters<typeof evaluatePhenotypes>[1];

/** Today's date (YYYY-MM-DD) in Asia/Bangkok. */
export function bangkokToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function buildValidationCtx(
  master: EntryMaster,
  sddAllowed: EntryConfig['sddAllowed'],
  today: string,
): ValidationCtx {
  const ctx: ValidationCtx = {
    organisms: master.organisms.map(({ id, name, orgClass, group }) => ({ id, name, orgClass, group })),
    drugs: master.drugs.map(({ id, name }) => ({ id, name })),
    wardIds: master.wards.map((w) => w.id),
    sddAllowed,
    today,
  };
  return ctx;
}

/** "ast.3.result" → "ast[3].result" so both path styles compare equal. */
export function normalizeFlagPath(path: string): string {
  return String(path ?? '').replace(/\.(\d+)(?=\.|\[|$)/g, '[$1]');
}

/** Row index of an AST flag path ("ast[3].result" → 3), else null. */
export function astRowIndex(path: string): number | null {
  const m = /^ast\[(\d+)\]/.exec(normalizeFlagPath(path));
  return m ? Number(m[1]) : null;
}

/** Drug ids of the standard panel for an organism's group (config/panels.json). */
export function panelDrugIds(organismId: number | null, master: EntryMaster, config: EntryConfig): number[] {
  const org = master.organisms.find((o) => o.id === organismId);
  if (!org) return [];
  const names = config.panels[org.group] ?? [];
  const byName = new Map(master.drugs.map((d) => [d.name.toLowerCase(), d.id]));
  const ids: number[] = [];
  for (const n of names) {
    const id = byName.get(String(n).toLowerCase());
    if (id != null && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** Build a DomainIsolate from form input (for phenotype evaluation). Null when organism unknown. */
export function toDomainIsolate(
  input: IsolateInput,
  master: EntryMaster,
  meta: Partial<Pick<DomainIsolate, 'id' | 'code' | 'status' | 'createdAt'>> = {},
): DomainIsolate | null {
  const org = master.organisms.find((o) => o.id === input.organismId);
  if (!org) return null;
  const ward = master.wards.find((w) => w.id === input.wardId) ?? null;
  const ast: Record<string, AstCode> = {};
  for (const a of input.ast) {
    if (a.drugId == null || a.result == null) continue;
    const d = master.drugs.find((x) => x.id === a.drugId);
    if (d && !(d.name in ast)) ast[d.name] = a.result;
  }
  return {
    id: meta.id ?? 'preview',
    code: meta.code ?? '',
    hn: input.hn,
    wardId: ward?.id ?? null,
    wardName: ward?.name ?? null,
    wardType: ward?.wardType ?? null,
    specimenDate: input.specimenDate ?? '',
    specimenType: input.specimenType ?? 'OTHER',
    organism: { id: org.id, name: org.name, orgClass: org.orgClass, group: org.group },
    status: meta.status ?? 'DRAFT',
    reportStatus: input.reportStatus,
    createdAt: meta.createdAt ?? '',
    ast,
  };
}

/** Phenotypes via lib/domain (never chosen by the user — MR2.4). */
export function computePhenotypes(
  input: IsolateInput,
  master: EntryMaster,
  rules: unknown[],
  intrinsic: EntryConfig['intrinsic'] = [],
): PhenotypeResult[] {
  const iso = toDomainIsolate(input, master);
  if (!iso) return [];
  return evaluatePhenotypes(iso, rules as PhenotypeRulesArg, intrinsic);
}
