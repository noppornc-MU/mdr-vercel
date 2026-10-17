// Typed loaders for config/*.json (design §4.2, §4.4).
// Pure: JSON imports only (no fs / Prisma) — safe for server AND client components.
import type { OrgClass, OrgGroup, PhenotypeCode, SpecimenType } from '@/lib/domain/types';
import panelsJson from '@/config/panels.json';
import sddJson from '@/config/sdd_allowed.json';
import intrinsicJson from '@/config/intrinsic.json';
import aliasesJson from '@/config/aliases.json';
import phenotypeRulesJson from '@/config/phenotype_rules.json';
import wardsJson from '@/config/wards.json';
import organismsJson from '@/config/organisms.json';
import drugsJson from '@/config/drugs.json';

/** Label required wherever phenotype rules / SDD / intrinsic tables are used. */
export const CLINICAL_DRAFT_LABEL = '[J] กฎฉบับร่าง รอ ICN/จุลชีววิทยารับรอง';
export const DEMO_BANNER = 'ข้อมูลสังเคราะห์ — ไม่ใช่ข้อมูลผู้ป่วยจริง';
export const CLINICAL_DISCLAIMER = 'ข้อมูลนี้ใช้ประกอบการพิจารณา ไม่ใช่คำสั่งการรักษา';

export const ORG_GROUPS: OrgGroup[] = ['ENTEROBACTERALES', 'PSEUDOMONAS', 'ACINETOBACTER', 'STAPH', 'ENTEROCOCCUS', 'OTHER'];
export const ORG_GROUP_LABELS: Record<OrgGroup, string> = {
  ENTEROBACTERALES: 'Enterobacterales',
  PSEUDOMONAS: 'Pseudomonas',
  ACINETOBACTER: 'Acinetobacter',
  STAPH: 'Staphylococcus',
  ENTEROCOCCUS: 'Enterococcus',
  OTHER: 'อื่น ๆ',
};
export const SPECIMEN_TYPES: SpecimenType[] = ['BLOOD', 'RESPIRATORY', 'URINE', 'WOUND', 'OTHER'];
export const SPECIMEN_LABELS: Record<SpecimenType, string> = {
  BLOOD: 'เลือด (Blood)',
  RESPIRATORY: 'ทางเดินหายใจ (Respiratory)',
  URINE: 'ปัสสาวะ (Urine)',
  WOUND: 'แผล/หนอง (Wound)',
  OTHER: 'อื่น ๆ',
};
export const PHENOTYPE_CODES: PhenotypeCode[] = ['CRE', 'ESBL_SCREEN', 'CRAB', 'CRPA', 'MRSA', 'VRE'];
export const PHENOTYPE_LABELS: Record<PhenotypeCode, string> = {
  CRE: 'CRE',
  ESBL_SCREEN: 'ESBL-screen',
  CRAB: 'CRAB',
  CRPA: 'CRPA',
  MRSA: 'MRSA',
  VRE: 'VRE',
};

export interface WardConfig { code: string; name: string; wardType: 'ICU' | 'NON_ICU'; aliases: string[] }
export interface OrganismConfig { name: string; orgClass: OrgClass; group: OrgGroup; aliases: string[] }
export interface DrugConfig { name: string; drugClass: string; displayOrder: number; aliases: string[] }

/** Shape of config/phenotype_rules.json (evaluated by lib/domain/phenotype.ts). */
export interface PhenotypeRuleConfig {
  code: PhenotypeCode;
  label: string;
  labelTh: string;
  /** Rule applies when organism.group ∈ groups OR organism.name ∈ organisms. */
  appliesTo: { groups: OrgGroup[]; organisms: string[] };
  /** POSITIVE if ANY of these drugs = R. */
  anyR?: string[];
  /** Requires ALL of these drugs = R. */
  allR?: string[];
  /** Requires every TESTED drug in this list = S (at least one tested). */
  allTestedS?: string[];
  note: string;
}

export interface AppConfig {
  panels: Record<OrgGroup, string[]>;
  sddAllowed: { drug: string; group: OrgGroup }[];
  intrinsic: { organism: string; drug: string }[];
  aliases: {
    organism: Record<string, string>;
    drug: Record<string, string>;
    ward: Record<string, string>;
    specimen: Record<string, SpecimenType>;
  };
  phenotypeRules: PhenotypeRuleConfig[];
  wards: WardConfig[];
  organisms: OrganismConfig[];
  drugs: DrugConfig[];
}

const CONFIG: AppConfig = {
  panels: panelsJson as Record<OrgGroup, string[]>,
  sddAllowed: sddJson as { drug: string; group: OrgGroup }[],
  intrinsic: intrinsicJson as { organism: string; drug: string }[],
  aliases: aliasesJson as AppConfig['aliases'],
  phenotypeRules: phenotypeRulesJson as PhenotypeRuleConfig[],
  wards: wardsJson as WardConfig[],
  organisms: organismsJson as OrganismConfig[],
  drugs: [...(drugsJson as DrugConfig[])].sort((a, b) => a.displayOrder - b.displayOrder),
};

export function getConfig(): AppConfig {
  return CONFIG;
}

/** Canonical drug names in display order. */
export function drugOrder(): string[] {
  return CONFIG.drugs.map((d) => d.name);
}

/** Standard panel for an organism (by name) — empty if unknown. */
export function panelForOrganism(organismName: string): string[] {
  const org = CONFIG.organisms.find((o) => o.name === organismName);
  return org ? CONFIG.panels[org.group] ?? [] : [];
}

export function isSddAllowed(drug: string, group: OrgGroup): boolean {
  return CONFIG.sddAllowed.some((p) => p.drug === drug && p.group === group);
}

export function isIntrinsic(organism: string, drug: string): boolean {
  return CONFIG.intrinsic.some((p) => p.organism === organism && p.drug === drug);
}

const norm = (s: string) => s.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Map a raw printed name to the canonical master name (case/whitespace-insensitive).
 * Checks canonical names, aliases.json and per-master `aliases`. Returns null when no match (→ flag, never guess).
 */
export function resolveAlias(kind: 'organism' | 'drug' | 'ward', raw: string | null | undefined): string | null;
export function resolveAlias(kind: 'specimen', raw: string | null | undefined): SpecimenType | null;
export function resolveAlias(kind: 'organism' | 'drug' | 'ward' | 'specimen', raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = norm(raw);
  if (!key) return null;
  if (kind === 'specimen') {
    if ((SPECIMEN_TYPES as string[]).includes(raw.trim().toUpperCase())) return raw.trim().toUpperCase();
    for (const [alias, type] of Object.entries(CONFIG.aliases.specimen)) if (norm(alias) === key) return type;
    return null;
  }
  const masters: { name: string; aliases: string[] }[] =
    kind === 'organism' ? CONFIG.organisms : kind === 'drug' ? CONFIG.drugs : CONFIG.wards;
  for (const m of masters) {
    if (norm(m.name) === key) return m.name;
  }
  for (const [alias, canonical] of Object.entries(CONFIG.aliases[kind])) {
    if (norm(alias) === key) return canonical;
  }
  for (const m of masters) {
    if (m.aliases.some((a) => norm(a) === key)) return m.name;
  }
  return null;
}
