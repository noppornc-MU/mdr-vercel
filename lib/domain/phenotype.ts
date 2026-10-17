// Phenotype classification (design §4.4). Rules are a CLINICAL DRAFT [J] pending ICN/microbiology sign-off.
// Pure: rules (and optional intrinsic table) are passed in.
import type { AstCode, DomainIsolate, OrgGroup, PhenotypeCode, PhenotypeResult } from './types';
import { drugKey, organismMatches } from './names';

export const PHENOTYPE_CODES: PhenotypeCode[] = ['CRE', 'ESBL_SCREEN', 'CRAB', 'CRPA', 'MRSA', 'VRE'];
/** Phenotypes counted as "resistant / watch-list" for KPIs and cluster detection (ESBL is a screen only). */
export const WATCH_PHENOTYPES: PhenotypeCode[] = ['CRE', 'CRAB', 'CRPA', 'MRSA', 'VRE'];

export const PHENOTYPE_LABEL_TH: Record<PhenotypeCode, string> = {
  CRE: 'CRE (ดื้อ carbapenem กลุ่ม Enterobacterales)',
  ESBL_SCREEN: 'ESBL (ผลคัดกรอง)',
  CRAB: 'CRAB (A. baumannii ดื้อ carbapenem)',
  CRPA: 'CRPA (P. aeruginosa ดื้อ carbapenem)',
  MRSA: 'MRSA',
  VRE: 'VRE',
};
export const PHENOTYPE_RESULT_LABEL_TH = { POSITIVE: 'ใช่', NEGATIVE: 'ไม่ใช่', UNCLASSIFIABLE: 'ไม่สามารถจัดกลุ่มได้' } as const;
export const DRAFT_RULE_NOTICE_TH = '[J] กฎฉบับร่าง รอ ICN/จุลชีววิทยารับรอง';

/**
 * Normalised rule. Conditions are AND-ed:
 *  - anyR:       POSITIVE part if any listed drug = R; false if ≥1 tested and none R; unknown if none tested
 *  - requireR:   every listed drug must be R (missing → unknown; any tested non-R → false)
 *  - allTestedS: ≥1 listed drug tested and every tested one = S (none tested → unknown)
 * Any false → NEGATIVE; else any unknown → UNCLASSIFIABLE; else POSITIVE.
 */
export interface PhenotypeRule {
  code: PhenotypeCode;
  // Applies when organism.group ∈ groups OR organism name matches one of organisms
  // (same semantics as config/phenotype_rules.json `appliesTo`). Both empty → all bacteria.
  groups?: OrgGroup[];
  organisms?: string[];
  anyR?: string[];
  requireR?: string[];
  allTestedS?: string[];
}

const CARBAPENEMS = ['Ertapenem', 'Imipenem', 'Meropenem'];

export const DEFAULT_PHENOTYPE_RULES: PhenotypeRule[] = [
  { code: 'CRE', groups: ['ENTEROBACTERALES'], anyR: CARBAPENEMS },
  { code: 'ESBL_SCREEN', organisms: ['Escherichia coli', 'Klebsiella pneumoniae', 'Proteus mirabilis'], requireR: ['Ceftriaxone'], allTestedS: CARBAPENEMS },
  { code: 'CRAB', organisms: ['Acinetobacter baumannii'], anyR: ['Imipenem', 'Meropenem'] },
  { code: 'CRPA', organisms: ['Pseudomonas aeruginosa'], anyR: ['Imipenem', 'Meropenem'] },
  { code: 'MRSA', organisms: ['Staphylococcus aureus'], anyR: ['Cefoxitin', 'Oxacillin'] },
  { code: 'VRE', groups: ['ENTEROCOCCUS'], anyR: ['Vancomycin'] },
];

// ---------- tolerant config parsing ----------
const ORG_GROUPS: OrgGroup[] = ['ENTEROBACTERALES', 'PSEUDOMONAS', 'ACINETOBACTER', 'STAPH', 'ENTEROCOCCUS', 'OTHER'];
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

function strArr(v: unknown): string[] | undefined {
  if (typeof v === 'string' && v.trim()) return [v.trim()];
  if (Array.isArray(v)) {
    const out = v.flatMap((x) => (typeof x === 'string' ? [x.trim()] : isObj(x) && typeof x.drug === 'string' ? [String(x.drug).trim()] : [])).filter(Boolean);
    return out.length ? out : undefined;
  }
  return undefined;
}

function pick(objs: Obj[], keys: string[]): string[] | undefined {
  for (const o of objs) for (const k of keys) { const v = strArr(o[k]); if (v) return v; }
  return undefined;
}

function toCode(v: unknown): PhenotypeCode | null {
  if (typeof v !== 'string') return null;
  const c = v.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if ((PHENOTYPE_CODES as string[]).includes(c)) return c as PhenotypeCode;
  if (c === 'ESBL' || c === 'ESBL_SCR') return 'ESBL_SCREEN';
  return null;
}

/**
 * Accepts config/phenotype_rules.json content in the PhenotypeRule shape (or close variants)
 * and returns normalised rules. Unparseable parts fall back to DEFAULT_PHENOTYPE_RULES per code;
 * codes missing from the config use the default rule.
 */
export function resolvePhenotypeRules(raw: unknown): PhenotypeRule[] {
  const items: unknown[] = Array.isArray(raw) ? raw : isObj(raw) && Array.isArray(raw.rules) ? (raw.rules as unknown[]) : [];
  const parsed = new Map<PhenotypeCode, PhenotypeRule>();
  for (const it of items) {
    if (!isObj(it)) continue;
    const code = toCode(it.code ?? it.id ?? it.phenotype);
    if (!code || parsed.has(code)) continue;
    const def = DEFAULT_PHENOTYPE_RULES.find((r) => r.code === code)!;
    const scopes = [it, ...['appliesTo', 'applies_to', 'scope', 'applies'].map((k) => it[k]).filter(isObj)];
    const conds = [it, ...['condition', 'conditions', 'criteria', 'when', 'logic'].map((k) => it[k]).filter(isObj)];
    const groupsRaw = pick(scopes, ['groups', 'group', 'orgGroups', 'organismGroups', 'organismGroup']);
    const groups = groupsRaw?.map((g) => g.toUpperCase()).filter((g): g is OrgGroup => (ORG_GROUPS as string[]).includes(g));
    const organisms = pick(scopes, ['organisms', 'organism', 'species']);
    const anyR = pick(conds, ['anyR', 'anyResistant', 'any_r', 'anyOfR', 'resistantToAny', 'anyOf']);
    const requireR = pick(conds, ['requireR', 'allR', 'requiredR', 'allResistant', 'all_r', 'mustBeR']);
    const allTestedS = pick(conds, ['allTestedS', 'testedAllS', 'allTestedSusceptible', 'all_tested_s', 'carbapenemsAllS', 'requireTestedS']);
    const hasCond = !!(anyR || requireR || allTestedS);
    const hasScope = !!((groups && groups.length) || organisms);
    parsed.set(code, {
      code,
      groups: hasScope ? (groups && groups.length ? groups : undefined) : def.groups,
      organisms: hasScope ? organisms : def.organisms,
      ...(hasCond ? { anyR, requireR, allTestedS } : { anyR: def.anyR, requireR: def.requireR, allTestedS: def.allTestedS }),
    });
  }
  return DEFAULT_PHENOTYPE_RULES.map((d) => parsed.get(d.code) ?? d);
}

const resolvedCache = new WeakMap<object, PhenotypeRule[]>();
function rulesOf(rules: readonly unknown[] | undefined): PhenotypeRule[] {
  if (!rules || rules === DEFAULT_PHENOTYPE_RULES) return DEFAULT_PHENOTYPE_RULES;
  let r = resolvedCache.get(rules);
  if (!r) { r = resolvePhenotypeRules(rules); resolvedCache.set(rules, r); }
  return r;
}

// ---------- evaluation ----------
export function ruleApplies(rule: PhenotypeRule, organism: DomainIsolate['organism']): boolean {
  if (organism.orgClass !== 'BACTERIA') return false;
  const groups = rule.groups ?? [];
  const orgs = rule.organisms ?? [];
  if (!groups.length && !orgs.length) return true;
  return groups.includes(organism.group) || orgs.some((p) => organismMatches(organism.name, p));
}

type Tri = 'T' | 'F' | 'U';

/**
 * Evaluate phenotype rules applicable to the isolate's organism.
 * `rules` may be raw config JSON (resolved leniently) or PhenotypeRule[]; defaults when omitted.
 * Drugs intrinsic for the organism (if an intrinsic table is given) are ignored by the rule.
 */
export function evaluatePhenotypes(
  iso: Pick<DomainIsolate, 'organism' | 'ast'>,
  rules?: readonly unknown[],
  intrinsic?: readonly { organism: string; drug: string }[],
): PhenotypeResult[] {
  const ast = new Map<string, AstCode>();
  for (const [k, v] of Object.entries(iso.ast ?? {})) if (v === 'S' || v === 'I' || v === 'R' || v === 'D') ast.set(drugKey(k), v);
  const isIntrinsic = (drug: string) => !!intrinsic?.some((p) => drugKey(p.drug) === drugKey(drug) && organismMatches(iso.organism.name, p.organism));

  const out: PhenotypeResult[] = [];
  for (const rule of rulesOf(rules)) {
    if (!ruleApplies(rule, iso.organism)) continue;
    const missing = new Set<string>();
    const lists = (l?: string[]) => (l ?? []).filter((d) => !isIntrinsic(d));
    const res = (d: string) => { const r = ast.get(drugKey(d)); if (!r) missing.add(d); return r; };
    const conds: Tri[] = [];
    if (rule.anyR) {
      const rs = lists(rule.anyR).map(res);
      conds.push(rs.some((r) => r === 'R') ? 'T' : rs.some((r) => r) ? 'F' : 'U');
    }
    if (rule.requireR) {
      const rs = lists(rule.requireR).map(res);
      conds.push(rs.some((r) => r && r !== 'R') ? 'F' : rs.some((r) => !r) || rs.length === 0 ? 'U' : 'T');
    }
    if (rule.allTestedS) {
      const rs = lists(rule.allTestedS).map(res);
      conds.push(rs.some((r) => r && r !== 'S') ? 'F' : rs.some((r) => r) ? 'T' : 'U');
    }
    if (!conds.length) continue;
    const result = conds.includes('F') ? 'NEGATIVE' : conds.includes('U') ? 'UNCLASSIFIABLE' : 'POSITIVE';
    out.push({ code: rule.code, result, missingDrugs: [...missing] });
  }
  return out;
}

export function positivePhenotypes(results: readonly PhenotypeResult[]): PhenotypeCode[] {
  return results.filter((r) => r.result === 'POSITIVE').map((r) => r.code);
}

/** Convert input AST rows (drugId → canonical name via master list) into the record used by evaluatePhenotypes. */
export function toAstRecord(
  rows: readonly { drugId: number | null; result: AstCode | null }[],
  drugs: readonly { id: number; name: string }[],
): Record<string, AstCode> {
  const out: Record<string, AstCode> = {};
  for (const r of rows) {
    const name = drugs.find((d) => d.id === r.drugId)?.name;
    if (name && (r.result === 'S' || r.result === 'I' || r.result === 'R' || r.result === 'D')) out[name] = r.result;
  }
  return out;
}
