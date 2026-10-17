// Deterministic synthetic demo data (design §8). NO real patient data — every HN / Lab No is fictional.
// Pure: no Prisma / fs. Used by prisma/seed.ts and POST /api/seed via lib/seed/apply.ts.
import type { AstCode, OrgGroup, ReportStatus, SpecimenType } from '@/lib/domain/types';
import { getConfig, isIntrinsic, isSddAllowed } from '@/lib/config';

/** Fixed anchor so the data set is identical on every run (demo "today"). */
export const SEED_TODAY = '2026-10-16';
export const SEED_NUMBER = 20261016;
/** Demo CRAB cluster in ICU B (4 distinct patients within 10 days; patient 1 has 2 rows within 3 days). */
export const CRAB_CLUSTER_START = '2026-09-24';

export interface SeedIsolate {
  id: string;
  code: string;
  hn: string;
  sex: 'M' | 'F';
  patientType: 'OPD' | 'IPD';
  wardCode: string | null;
  labNo: string;
  orderNo: string | null;
  specimenDate: string; // YYYY-MM-DD (CE)
  specimenType: SpecimenType;
  specimenDetail: string;
  organism: string; // canonical name
  reportStatus: ReportStatus;
  status: 'DRAFT' | 'APPROVED';
  createdAt: string; // ISO timestamp
  approvedAt: string | null;
  approvedBy: string | null;
  ast: Record<string, AstCode>; // canonical drug name → result
  /** Demo slice marker (not stored). */
  tag: 'RANDOM' | 'KPN_ICUB_BLOOD' | 'KPN_ICUB_REPEAT' | 'CRAB_CLUSTER' | 'LOW_N' | 'PENDING' | 'NO_WARD';
}

// ---------- PRNG (mulberry32) ----------
class Rng {
  private a: number;
  constructor(seed: number) {
    this.a = seed >>> 0;
  }
  next(): number {
    this.a = (this.a + 0x6d2b79f5) | 0;
    let t = Math.imul(this.a ^ (this.a >>> 15), 1 | this.a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  weighted<T>(entries: readonly (readonly [T, number])[]): T {
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let r = this.next() * total;
    for (const [v, w] of entries) {
      r -= w;
      if (r < 0) return v;
    }
    return entries[entries.length - 1][0];
  }
  hex(n: number): string {
    let s = '';
    for (let i = 0; i < n; i++) s += Math.floor(this.next() * 16).toString(16);
    return s;
  }
}

// ---------- dates ----------
const DAY = 86_400_000;
const toDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
export function addDays(iso: string, n: number): string {
  return new Date(toDate(iso).getTime() + n * DAY).toISOString().slice(0, 10);
}
const FIRST_DAY = addDays(SEED_TODAY, -364); // 2025-10-17
const LAST_DAY = addDays(SEED_TODAY, -2); // 2026-10-14 (latest specimen in the seed)
const SPAN = 362; // day index 0..SPAN

// ---------- resistance profiles ----------
type P = readonly [number, number, number, number?]; // S, I, R, D
type Profile = Record<string, P>;
const S1: P = [1, 0, 0];
const R1: P = [0, 0, 1];

const WT_ENT: Profile = {
  Amikacin: [0.97, 0.01, 0.02],
  'Amoxicillin/clavulanate': [0.82, 0.06, 0.12],
  Ampicillin: [0.4, 0.02, 0.58],
  Cefepime: [0.93, 0, 0.03, 0.04],
  Cefoxitin: [0.9, 0.03, 0.07],
  Ceftriaxone: [0.96, 0.01, 0.03],
  Cefuroxime: [0.88, 0.02, 0.1],
  Ciprofloxacin: [0.72, 0.05, 0.23],
  Ertapenem: S1,
  Gentamicin: [0.88, 0.01, 0.11],
  Imipenem: S1,
  Meropenem: S1,
  'Piperacillin/tazobactam': [0.92, 0, 0.04, 0.04],
  Tetracycline: [0.55, 0.03, 0.42],
  'Trimethoprim/sulfamethoxazole': [0.6, 0, 0.4],
};
const ESBL_ENT: Profile = {
  Amikacin: [0.92, 0.03, 0.05],
  'Amoxicillin/clavulanate': [0.4, 0.15, 0.45],
  Ampicillin: R1,
  Cefepime: [0.25, 0, 0.5, 0.25],
  Cefoxitin: [0.8, 0.05, 0.15],
  Ceftriaxone: R1,
  Cefuroxime: R1,
  Ciprofloxacin: [0.3, 0.05, 0.65],
  Gentamicin: [0.6, 0.02, 0.38],
  'Piperacillin/tazobactam': [0.65, 0, 0.2, 0.15],
  'Trimethoprim/sulfamethoxazole': [0.35, 0, 0.65],
};
const CRE_ENT: Profile = {
  ...ESBL_ENT,
  Amikacin: [0.65, 0.05, 0.3],
  'Amoxicillin/clavulanate': R1,
  Cefepime: [0.05, 0, 0.9, 0.05],
  Cefoxitin: [0.2, 0, 0.8],
  Ciprofloxacin: [0.1, 0, 0.9],
  Ertapenem: R1,
  Gentamicin: [0.45, 0.05, 0.5],
  Imipenem: [0.2, 0.1, 0.7],
  Meropenem: [0.15, 0.05, 0.8],
  'Piperacillin/tazobactam': [0.03, 0, 0.97],
  Tetracycline: [0.4, 0.05, 0.55],
  'Trimethoprim/sulfamethoxazole': [0.3, 0, 0.7],
};
const AMPC_ENT: Profile = { Ceftriaxone: [0.3, 0.05, 0.65], Cefepime: [0.75, 0, 0.15, 0.1] };

const WT_PSA: Profile = {
  Amikacin: [0.95, 0.01, 0.04],
  Cefepime: [0.88, 0.04, 0.08],
  Ceftazidime: [0.86, 0.04, 0.1],
  Ciprofloxacin: [0.82, 0.04, 0.14],
  Levofloxacin: [0.78, 0.06, 0.16],
  Gentamicin: [0.88, 0.02, 0.1],
  Imipenem: [0.97, 0.03, 0],
  Meropenem: [0.97, 0.03, 0],
  'Piperacillin/tazobactam': [0.88, 0.04, 0.08],
  Colistin: [0.99, 0, 0.01],
};
const CRPA: Profile = {
  Amikacin: [0.8, 0.05, 0.15],
  Cefepime: [0.5, 0.1, 0.4],
  Ceftazidime: [0.45, 0.1, 0.45],
  Ciprofloxacin: [0.5, 0.05, 0.45],
  Levofloxacin: [0.45, 0.05, 0.5],
  Gentamicin: [0.65, 0.05, 0.3],
  Imipenem: R1,
  Meropenem: [0.15, 0.05, 0.8],
  'Piperacillin/tazobactam': [0.45, 0.1, 0.45],
  Colistin: [0.97, 0, 0.03],
};
const WT_ACB: Profile = {
  Amikacin: [0.9, 0.02, 0.08],
  Cefepime: [0.8, 0.05, 0.15],
  Ceftazidime: [0.78, 0.05, 0.17],
  Ciprofloxacin: [0.8, 0.02, 0.18],
  Levofloxacin: [0.82, 0.03, 0.15],
  Gentamicin: [0.85, 0.02, 0.13],
  Imipenem: [0.98, 0.02, 0],
  Meropenem: [0.98, 0.02, 0],
  'Piperacillin/tazobactam': [0.75, 0.05, 0.2],
  'Trimethoprim/sulfamethoxazole': [0.8, 0, 0.2],
  Colistin: [0.98, 0, 0.02],
};
const CRAB: Profile = {
  Amikacin: [0.4, 0.05, 0.55],
  Cefepime: [0.05, 0.03, 0.92],
  Ceftazidime: [0.06, 0.04, 0.9],
  Ciprofloxacin: [0.05, 0, 0.95],
  Levofloxacin: [0.1, 0.05, 0.85],
  Gentamicin: [0.3, 0.03, 0.67],
  Imipenem: R1,
  Meropenem: [0.03, 0.02, 0.95],
  'Piperacillin/tazobactam': [0.03, 0.02, 0.95],
  'Trimethoprim/sulfamethoxazole': [0.4, 0, 0.6],
  Colistin: [0.95, 0, 0.05],
};
const MSSA: Profile = {
  Cefoxitin: S1,
  Oxacillin: S1,
  Clindamycin: [0.85, 0.02, 0.13],
  Erythromycin: [0.75, 0.03, 0.22],
  Gentamicin: [0.95, 0, 0.05],
  Levofloxacin: [0.9, 0.02, 0.08],
  Linezolid: S1,
  Tetracycline: [0.9, 0.02, 0.08],
  'Trimethoprim/sulfamethoxazole': [0.96, 0, 0.04],
  Vancomycin: S1,
};
const MRSA: Profile = {
  ...MSSA,
  Cefoxitin: R1,
  Oxacillin: R1,
  Clindamycin: [0.5, 0.02, 0.48],
  Erythromycin: [0.3, 0.02, 0.68],
  Gentamicin: [0.7, 0.02, 0.28],
  Levofloxacin: [0.4, 0.05, 0.55],
  Tetracycline: [0.7, 0.03, 0.27],
  'Trimethoprim/sulfamethoxazole': [0.85, 0, 0.15],
};
const EFS: Profile = { Ampicillin: [0.95, 0, 0.05], Vancomycin: S1, Linezolid: [0.99, 0.01, 0], Levofloxacin: [0.7, 0.05, 0.25], Tetracycline: [0.3, 0.02, 0.68] };
const EFM: Profile = { Ampicillin: [0.1, 0, 0.9], Vancomycin: S1, Linezolid: [0.97, 0.02, 0.01], Levofloxacin: [0.1, 0.05, 0.85], Tetracycline: [0.4, 0.05, 0.55] };
const STM: Profile = { 'Trimethoprim/sulfamethoxazole': [0.95, 0, 0.05], Levofloxacin: [0.85, 0.05, 0.1], Ceftazidime: [0.4, 0.15, 0.45] };

type Latent = 'WT' | 'ESBL' | 'CRE' | 'AMPC' | 'CRPA' | 'CRAB' | 'MRSA' | 'VRE';

interface OrgSpec {
  latents: readonly (readonly [Latent, number])[];
  profiles: Partial<Record<Latent, Profile[]>>; // layered: later overrides earlier
  specimens: readonly (readonly [SpecimenType, number])[];
  icuBoost: number;
}

const ENT_SPEC = (latents: OrgSpec['latents'], specimens: OrgSpec['specimens'], icuBoost: number): OrgSpec => ({
  latents,
  profiles: { WT: [WT_ENT], ESBL: [WT_ENT, ESBL_ENT], CRE: [WT_ENT, CRE_ENT], AMPC: [WT_ENT, AMPC_ENT] },
  specimens,
  icuBoost,
});

const ORG_SPECS: Record<string, OrgSpec> = {
  'Escherichia coli': ENT_SPEC([['WT', 62], ['ESBL', 35], ['CRE', 3]], [['URINE', 50], ['BLOOD', 20], ['WOUND', 15], ['RESPIRATORY', 10], ['OTHER', 5]], 1),
  'Klebsiella pneumoniae': ENT_SPEC([['WT', 50], ['ESBL', 40], ['CRE', 10]], [['RESPIRATORY', 30], ['URINE', 30], ['BLOOD', 25], ['WOUND', 10], ['OTHER', 5]], 2),
  'Proteus mirabilis': ENT_SPEC([['WT', 83], ['ESBL', 15], ['CRE', 2]], [['URINE', 55], ['WOUND', 35], ['BLOOD', 5], ['OTHER', 5]], 1),
  'Enterobacter cloacae complex': ENT_SPEC([['WT', 65], ['AMPC', 30], ['CRE', 5]], [['RESPIRATORY', 35], ['URINE', 25], ['BLOOD', 20], ['WOUND', 20]], 1.5),
  'Pseudomonas aeruginosa': {
    latents: [['WT', 75], ['CRPA', 25]],
    profiles: { WT: [WT_PSA], CRPA: [WT_PSA, CRPA] },
    specimens: [['RESPIRATORY', 50], ['WOUND', 20], ['URINE', 15], ['BLOOD', 10], ['OTHER', 5]],
    icuBoost: 2.5,
  },
  'Acinetobacter baumannii': {
    latents: [['WT', 35], ['CRAB', 65]],
    profiles: { WT: [WT_ACB], CRAB: [WT_ACB, CRAB] },
    specimens: [['RESPIRATORY', 60], ['BLOOD', 15], ['WOUND', 15], ['URINE', 5], ['OTHER', 5]],
    icuBoost: 3,
  },
  'Staphylococcus aureus': {
    latents: [['WT', 70], ['MRSA', 30]],
    profiles: { WT: [MSSA], MRSA: [MRSA] },
    specimens: [['WOUND', 45], ['BLOOD', 25], ['RESPIRATORY', 20], ['OTHER', 10]],
    icuBoost: 1,
  },
  'Enterococcus faecalis': {
    latents: [['WT', 98], ['VRE', 2]],
    profiles: { WT: [EFS], VRE: [EFS, { Vancomycin: R1 }] },
    specimens: [['URINE', 50], ['WOUND', 25], ['BLOOD', 20], ['OTHER', 5]],
    icuBoost: 1,
  },
  'Enterococcus faecium': {
    latents: [['WT', 85], ['VRE', 15]],
    profiles: { WT: [EFM], VRE: [EFM, { Vancomycin: R1 }] },
    specimens: [['URINE', 45], ['BLOOD', 30], ['WOUND', 20], ['OTHER', 5]],
    icuBoost: 1.5,
  },
  'Stenotrophomonas maltophilia': {
    latents: [['WT', 100]],
    profiles: { WT: [STM] },
    specimens: [['RESPIRATORY', 80], ['OTHER', 20]],
    icuBoost: 2,
  },
  'Candida albicans': { latents: [['WT', 100]], profiles: { WT: [] }, specimens: [['URINE', 40], ['BLOOD', 30], ['RESPIRATORY', 30]], icuBoost: 1.5 },
  'Candida tropicalis': { latents: [['WT', 100]], profiles: { WT: [] }, specimens: [['URINE', 40], ['BLOOD', 30], ['RESPIRATORY', 30]], icuBoost: 1.5 },
};

// Random-pool organism mix (≈ design §8; K. pneumoniae lowered because the ICU B blood cohort adds ~45).
const ORG_MIX: readonly (readonly [string, number])[] = [
  ['Escherichia coli', 28],
  ['Klebsiella pneumoniae', 16],
  ['Pseudomonas aeruginosa', 12],
  ['Acinetobacter baumannii', 12],
  ['Staphylococcus aureus', 12],
  ['Enterococcus faecalis', 4],
  ['Enterococcus faecium', 2],
  ['Proteus mirabilis', 3],
  ['Enterobacter cloacae complex', 3],
  ['Stenotrophomonas maltophilia', 1.5],
  ['Candida albicans', 1.7],
  ['Candida tropicalis', 0.8],
];

const WARD_WEIGHTS: readonly (readonly [string, number])[] = [
  ['ICU-A', 11],
  ['ICU-B', 11],
  ['ICU-PED', 4],
  ['MED-1', 12],
  ['MED-2', 11],
  ['MED-3', 9],
  ['SUR-1', 9],
  ['SUR-2', 8],
  ['ORTHO', 7],
  ['OBGYN', 6],
  ['PED', 6],
];

const SPECIMEN_DETAIL: Record<SpecimenType, readonly string[]> = {
  BLOOD: ['Hemoculture'],
  RESPIRATORY: ['Sputum', 'Tracheal aspirate'],
  URINE: ['Urine', 'Catheter urine'],
  WOUND: ['Pus', 'Wound swab'],
  OTHER: ['Body fluid', 'Pleural fluid'],
};

const CARBAPENEMS = ['Ertapenem', 'Imipenem', 'Meropenem'];

function drawCode(rng: Rng, p: P): AstCode {
  const [s, i, r, d = 0] = p;
  return rng.weighted<AstCode>([
    ['S', s],
    ['I', i],
    ['R', r],
    ['D', d],
  ]);
}

export function generateSeed(seed: number = SEED_NUMBER): SeedIsolate[] {
  const cfg = getConfig();
  const rng = new Rng(seed);
  const idRng = new Rng(seed ^ 0x5eed);
  const orgGroup = new Map<string, OrgGroup>(cfg.organisms.map((o) => [o.name, o.group]));
  const icuWards = new Set(cfg.wards.filter((w) => w.wardType === 'ICU').map((w) => w.code));
  const usedHn = new Set<string>(['0000123', '00000123']); // fixture HN reserved
  const out: Omit<SeedIsolate, 'code' | 'labNo'>[] = [];

  const newHn = (): string => {
    for (;;) {
      const hn = `0${rng.int(1_000_000, 9_999_999)}`;
      if (!usedHn.has(hn)) {
        usedHn.add(hn);
        return hn;
      }
    }
  };
  const uuid = (): string => {
    const h = idRng.hex(32);
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
  };
  const latentFor = (org: string): Latent => rng.weighted(ORG_SPECS[org].latents);
  const drawAst = (org: string, latent: Latent): Record<string, AstCode> => {
    const group = orgGroup.get(org) ?? 'OTHER';
    const spec = ORG_SPECS[org];
    const layers = spec.profiles[latent] ?? spec.profiles.WT ?? [];
    if (!layers.length) return {}; // yeast: no AST
    const panel = cfg.panels[group] ?? [];
    const ast: Record<string, AstCode> = {};
    for (const drug of panel) {
      let p: P | undefined;
      for (const layer of layers) if (layer[drug]) p = layer[drug];
      let code: AstCode = isIntrinsic(org, drug) ? 'R' : drawCode(rng, p ?? [0.85, 0.03, 0.12]);
      if (code === 'D' && !isSddAllowed(drug, group)) code = 'I';
      ast[drug] = code;
    }
    return ast;
  };
  const pickWard = (org: string, date: string): string => {
    const boost = ORG_SPECS[org].icuBoost;
    let ward = rng.weighted(WARD_WEIGHTS.map(([w, wt]) => [w, icuWards.has(w) ? wt * boost : wt] as const));
    ward = fixWard(org, ward, date);
    return ward;
  };
  // Keep demo slices clean: Enterococcus in หอเด็ก stays low-n; no random A. baumannii in ICU B around the demo cluster.
  const clusterLo = addDays(CRAB_CLUSTER_START, -30);
  const clusterHi = addDays(CRAB_CLUSTER_START, 40);
  const nonIcuWards = WARD_WEIGHTS.filter(([w]) => !icuWards.has(w) && w !== 'PED');
  const fixWard = (org: string, ward: string, date: string): string => {
    if (ward === 'PED' && org.startsWith('Enterococcus')) return 'MED-1';
    if (ward === 'ICU-B' && org === 'Acinetobacter baumannii' && date >= clusterLo && date <= clusterHi) return rng.weighted(nonIcuWards);
    return ward;
  };
  const push = (r: Omit<SeedIsolate, 'id' | 'createdAt' | 'approvedAt' | 'approvedBy' | 'code' | 'labNo' | 'orderNo' | 'specimenDetail'> & { specimenDetail?: string }) => {
    const created = new Date(Math.min(toDate(r.specimenDate).getTime() + 2 * DAY + 3 * 3_600_000, toDate(SEED_TODAY).getTime() + 3_600_000) + out.length * 1000);
    const approved = r.status === 'APPROVED' ? new Date(created.getTime() + 2 * 3_600_000) : null;
    out.push({
      ...r,
      id: uuid(),
      orderNo: null,
      specimenDetail: r.specimenDetail ?? rng.pick(SPECIMEN_DETAIL[r.specimenType]),
      createdAt: created.toISOString(),
      approvedAt: approved ? approved.toISOString() : null,
      approvedBy: approved ? 'ICN (seed)' : null,
    });
  };

  // ---- 1. K. pneumoniae BLOOD in ICU B: 45 distinct patients, full 15-drug panel (DoD 4: n ≥ 30 at ward scope) ----
  const KPN = 'Klebsiella pneumoniae';
  for (let i = 0; i < 45; i++) {
    // 5 CRE (i % 9 === 0), 20 ESBL-screen, 20 wild type
    const m = i % 9;
    const latent: Latent = m === 0 ? 'CRE' : [1, 3, 5, 7].includes(m) ? 'ESBL' : 'WT';
    const ast = drawAst(KPN, latent);
    // Pin key drugs so the ward-level story is stable: Amikacin 42/45, Meropenem 41/45, Imipenem 40/45, Ertapenem 40/45 S.
    ast.Amikacin = i === 0 || i === 18 ? 'R' : i === 1 ? 'I' : 'S';
    ast.Meropenem = [0, 9, 18, 27].includes(i) ? 'R' : 'S';
    ast.Imipenem = [0, 9, 18, 36].includes(i) ? 'R' : i === 27 ? 'I' : 'S';
    ast.Ertapenem = latent === 'CRE' ? 'R' : 'S';
    if (latent === 'ESBL') ast.Ceftriaxone = 'R';
    const date = addDays(FIRST_DAY, Math.min(SPAN, 4 + Math.floor((i * 355) / 45) + rng.int(0, 5)));
    const hn = newHn();
    const base = { hn, sex: rng.pick(['M', 'F'] as const), patientType: 'IPD' as const, wardCode: 'ICU-B', specimenType: 'BLOOD' as SpecimenType, specimenDetail: 'Hemoculture', organism: KPN, reportStatus: 'FINAL' as ReportStatus, status: 'APPROVED' as const };
    push({ ...base, specimenDate: date, ast, tag: 'KPN_ICUB_BLOOD' });
    if (i % 4 === 2) {
      // repeat culture of the same patient a few days later — must NOT be counted again (first-isolate rule)
      const d2 = addDays(date, rng.int(2, 5));
      if (d2 <= LAST_DAY) push({ ...base, specimenDate: d2, ast: { ...ast }, tag: 'KPN_ICUB_REPEAT' });
    }
  }

  // ---- 2. CRAB cluster in ICU B: 4 distinct patients within 10 days; patient C1 has 2 rows within 3 days ----
  const ACB = 'Acinetobacter baumannii';
  const crabHns = [newHn(), newHn(), newHn(), newHn()];
  const crabRows: [number, number, SpecimenType][] = [
    [0, 0, 'RESPIRATORY'],
    [0, 2, 'RESPIRATORY'],
    [1, 3, 'RESPIRATORY'],
    [2, 6, 'BLOOD'],
    [3, 9, 'RESPIRATORY'],
  ];
  for (const [p, d, sp] of crabRows) {
    const ast = drawAst(ACB, 'CRAB');
    ast.Imipenem = 'R';
    ast.Meropenem = 'R';
    push({ hn: crabHns[p], sex: p % 2 ? 'F' : 'M', patientType: 'IPD', wardCode: 'ICU-B', specimenDate: addDays(CRAB_CLUSTER_START, d), specimenType: sp, organism: ACB, reportStatus: 'FINAL', status: 'APPROVED', ast, tag: 'CRAB_CLUSTER' });
  }

  // ---- 3. Low-n slice: Enterococcus in หอเด็ก (n = 5 < 10) ----
  const lowN: [string, Latent, SpecimenType, number][] = [
    ['Enterococcus faecium', 'WT', 'BLOOD', 60],
    ['Enterococcus faecium', 'VRE', 'URINE', 75],
    ['Enterococcus faecium', 'WT', 'URINE', 102],
    ['Enterococcus faecalis', 'WT', 'URINE', 130],
    ['Enterococcus faecalis', 'WT', 'BLOOD', 200],
  ];
  for (const [org, latent, sp, back] of lowN) {
    const ast = drawAst(org, latent);
    if (latent === 'VRE') ast.Vancomycin = 'R';
    push({ hn: newHn(), sex: rng.pick(['M', 'F'] as const), patientType: 'IPD', wardCode: 'PED', specimenDate: addDays(LAST_DAY, -back), specimenType: sp, organism: org, reportStatus: 'FINAL', status: 'APPROVED', ast, tag: 'LOW_N' });
  }

  // ---- 4. Pending rows (DRAFT / PRELIMINARY) — shown as "not counted" ----
  const pending: [string, string, SpecimenType, ReportStatus, 'DRAFT' | 'APPROVED', number][] = [
    [KPN, 'ICU-B', 'BLOOD', 'FINAL', 'DRAFT', 3],
    ['Escherichia coli', 'MED-1', 'URINE', 'FINAL', 'DRAFT', 5],
    [ACB, 'ICU-A', 'RESPIRATORY', 'PRELIMINARY', 'DRAFT', 2],
    ['Staphylococcus aureus', 'SUR-1', 'WOUND', 'PRELIMINARY', 'APPROVED', 8],
    ['Pseudomonas aeruginosa', 'ICU-A', 'RESPIRATORY', 'PRELIMINARY', 'APPROVED', 11],
  ];
  for (const [org, ward, sp, rs, st, back] of pending) {
    push({ hn: newHn(), sex: rng.pick(['M', 'F'] as const), patientType: 'IPD', wardCode: ward, specimenDate: addDays(LAST_DAY, -back), specimenType: sp, organism: org, reportStatus: rs, status: st, ast: drawAst(org, latentFor(org)), tag: 'PENDING' });
  }

  // ---- 5. OPD rows without a ward (counted hospital-wide, excluded from cluster detection) ----
  const noWard: [string, SpecimenType, number][] = [
    ['Escherichia coli', 'URINE', 20],
    ['Staphylococcus aureus', 'WOUND', 47],
    [KPN, 'URINE', 66],
  ];
  for (const [org, sp, back] of noWard) {
    push({ hn: newHn(), sex: rng.pick(['M', 'F'] as const), patientType: 'OPD', wardCode: null, specimenDate: addDays(LAST_DAY, -back), specimenType: sp, organism: org, reportStatus: 'FINAL', status: 'APPROVED', ast: drawAst(org, latentFor(org)), tag: 'NO_WARD' });
  }

  // ---- 6. Random pool: patients with 1–4 isolates over 12 months ----
  const TARGET_TOTAL = 1000;
  const randomStart = out.length;
  while (out.length < TARGET_TOTAL) {
    const hn = newHn();
    const sex = rng.pick(['M', 'F'] as const);
    const k = rng.weighted([
      [1, 62],
      [2, 24],
      [3, 9],
      [4, 5],
    ] as const);
    let org = rng.weighted(ORG_MIX);
    let latent = latentFor(org);
    let date = addDays(FIRST_DAY, rng.int(0, SPAN));
    let ward = pickWard(org, date);
    for (let j = 0; j < k && out.length < TARGET_TOTAL; j++) {
      if (j > 0) {
        date = addDays(date, rng.int(1, 40));
        if (date > LAST_DAY) break;
        if (!rng.chance(0.55)) {
          org = rng.weighted(ORG_MIX);
          latent = latentFor(org);
        } else if (rng.chance(0.1)) {
          latent = latentFor(org); // phenotype may change on repeat
        }
        ward = rng.chance(0.8) ? fixWard(org, ward, date) : pickWard(org, date);
      }
      if (org === 'Acinetobacter baumannii' && date >= clusterLo && date <= clusterHi) {
        // no random A. baumannii around the demo window → the ICU B CRAB episode stays the clear story
        org = rng.weighted(ORG_MIX.filter(([o]) => o !== 'Acinetobacter baumannii'));
        latent = latentFor(org);
        ward = fixWard(org, ward, date);
      }
      const sp = rng.weighted(ORG_SPECS[org].specimens);
      push({ hn, sex, patientType: 'IPD', wardCode: ward, specimenDate: date, specimenType: sp, organism: org, reportStatus: 'FINAL', status: 'APPROVED', ast: drawAst(org, latent), tag: 'RANDOM' });
    }
  }

  // ---- 7. Incomplete panels (12 random rows) → phenotype "ไม่สามารถจัดกลุ่มได้" ----
  let incomplete = 0;
  for (let idx = randomStart; idx < out.length && incomplete < 12; idx += 37) {
    const r = out[idx];
    const g = orgGroup.get(r.organism);
    const drop = g === 'ENTEROBACTERALES' ? CARBAPENEMS : g === 'ACINETOBACTER' || g === 'PSEUDOMONAS' ? ['Imipenem', 'Meropenem'] : g === 'STAPH' ? ['Cefoxitin', 'Oxacillin'] : g === 'ENTEROCOCCUS' ? ['Vancomycin'] : null;
    if (!drop) continue;
    for (const d of drop) delete r.ast[d];
    incomplete++;
  }

  // ---- codes / lab numbers in chronological order ----
  const sorted = out
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (a.r.specimenDate < b.r.specimenDate ? -1 : a.r.specimenDate > b.r.specimenDate ? 1 : a.i - b.i));
  return sorted.map(({ r }, n) => ({
    ...r,
    code: `ISO-2026-${String(n + 1).padStart(6, '0')}`,
    labNo: `68${String(n + 1).padStart(8, '0')}`,
  }));
}

/** Quick summary used by the seed script / API response. */
export function summarizeSeed(rows: readonly SeedIsolate[]) {
  const byTag: Record<string, number> = {};
  for (const r of rows) byTag[r.tag] = (byTag[r.tag] ?? 0) + 1;
  return {
    isolates: rows.length,
    patients: new Set(rows.map((r) => r.hn)).size,
    astResults: rows.reduce((s, r) => s + Object.keys(r.ast).length, 0),
    approvedFinal: rows.filter((r) => r.status === 'APPROVED' && r.reportStatus === 'FINAL').length,
    pending: rows.filter((r) => r.status !== 'APPROVED' || r.reportStatus !== 'FINAL').length,
    from: rows[0]?.specimenDate ?? null,
    to: rows[rows.length - 1]?.specimenDate ?? null,
    byTag,
  };
}
