// Shared domain contracts (see .agents/tasks/mvp-build/parallel.md "Shared contracts").
// Pure types only — safe to import from client and server code.

export type AstCode = 'S'|'I'|'R'|'D';
export type OrgClass = 'BACTERIA'|'YEAST'|'OTHER';
export type OrgGroup = 'ENTEROBACTERALES'|'PSEUDOMONAS'|'ACINETOBACTER'|'STAPH'|'ENTEROCOCCUS'|'OTHER';
export type SpecimenType = 'BLOOD'|'RESPIRATORY'|'URINE'|'WOUND'|'OTHER';
export type ReportStatus = 'FINAL'|'PRELIMINARY'|'UNKNOWN';
export type Formula = 'S_ONLY'|'S_PLUS_SDD';
export type PhenotypeCode = 'CRE'|'ESBL_SCREEN'|'CRAB'|'CRPA'|'MRSA'|'VRE';
export type Tier = 'SUPPORTED'|'CONSIDER'|'NOT_SUPPORTED'|'LOW_DATA'|'INTRINSIC';
export interface Flag { path: string; reason: string }
export interface DomainOrganism { id: number; name: string; orgClass: OrgClass; group: OrgGroup }
export interface DomainIsolate {
  id: string; code: string; hn: string; wardId: number|null; wardName: string|null; wardType: 'ICU'|'NON_ICU'|null;
  specimenDate: string; /* YYYY-MM-DD */ specimenType: SpecimenType; organism: DomainOrganism;
  status: 'DRAFT'|'APPROVED'; reportStatus: ReportStatus; createdAt: string;
  ast: Record<string, AstCode>; /* key = canonical drug name */
}
export interface PhenotypeResult { code: PhenotypeCode; result: 'POSITIVE'|'NEGATIVE'|'UNCLASSIFIABLE'; missingDrugs: string[] }
export interface AbgCell { organism: string; drug: string; nTested: number; s: number; i: number; r: number; d: number;
  pctS: number|null; /* per active formula, 0–100, 1 decimal; null if insufficient or intrinsic */
  pctSDD: number|null; sddApplicable: boolean; insufficient: boolean; intrinsic: boolean; label: string; /* "97.1%" | "n<30" | "IR" */ tier: Tier }
export interface ClusterEpisode { key: string; organism: string; phenotype: PhenotypeCode|null; wardId: number; wardName: string;
  firstDate: string; lastDate: string; patientCount: number; patients?: string[]; /* HN list, omitted for EXECUTIVE */ isolateIds: string[] }
export interface IsolateInput {
  hn: string; sex?: 'M'|'F'|null; patientType: 'OPD'|'IPD'|null; wardId: number|null;
  labNo?: string|null; orderNo?: string|null; specimenDate: string|null; specimenType: SpecimenType|null; specimenDetail?: string|null;
  organismId: number|null; reportStatus: ReportStatus; labComments?: string|null;
  ast: { drugId: number|null; drugRaw?: string|null; result: AstCode|null }[];
  source: 'OCR'|'MANUAL'|'CSV'; sourceFile?: string|null;
}
