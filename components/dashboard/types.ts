// View-model types mirroring agent B's getDashboardStats contract (parallel.md).
// Kept permissive (nullable) so B's concrete return types are assignable.
import type { ClusterEpisode, PhenotypeCode } from '@/lib/domain/types';

export interface KpiPair { value: number; prev: number }
export interface LabelValue { label: string; value: number }

export interface DashboardStatsView {
  meta: { from: string; to: string; prevFrom: string; prevTo: string; dataAsOf: string | null; pendingCount: number };
  kpis: {
    isolates: KpiPair;
    patients: KpiPair;
    resistantPatients: KpiPair;
    icuShare: { icu: number; nonIcu: number; unknownWard: number };
    phenotypeCounts: Partial<Record<PhenotypeCode, number>>;
    clusters: number;
  };
  charts: {
    icuVsNonIcu: LabelValue[];
    byWard: { ward: string; value: number }[];
    bySpecimen: LabelValue[];
    monthlyResistant: { month: string; value: number }[];
    topOrganisms: LabelValue[];
  };
  recentResistant: {
    id: string; code: string; date: string; hn?: string | null; ward: string | null; organism: string; phenotypes: PhenotypeCode[];
  }[];
  clusters: ClusterEpisode[];
}

export interface WardOption { id: number; name: string; wardType: string }
export interface OrganismOption { id: number; name: string; group: string; orgClass: string }
