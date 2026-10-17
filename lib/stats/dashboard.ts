// Server: dashboard KPIs, charts, recent resistant isolates and suspected clusters (MR5–MR8).
// Approved FINAL data only. EXECUTIVE never receives HN (no `hn`, no `patients`).
import { detectClusters } from '@/lib/domain/cluster';
import { addDays, diffDays, monthKey, monthsBetween } from '@/lib/domain/dates';
import { inPeriod } from '@/lib/domain/firstIsolate';
import { SPECIMEN_LABEL_TH } from '@/lib/domain/labels';
import { PHENOTYPE_CODES, WATCH_PHENOTYPES } from '@/lib/domain/phenotype';
import type { ClusterEpisode, PhenotypeCode, SpecimenType } from '@/lib/domain/types';
import { getDataAsOf, getPendingCount, loadIsolates, type LoadedIsolate } from './load';
import { applyScope, type ScopeFilter } from './scope';

export type DashboardRole = 'ICN' | 'DOCTOR' | 'EXECUTIVE';

export interface DashboardFilters extends ScopeFilter {
  from?: string | null;
  to?: string | null;
}

export interface DashboardStats {
  meta: { from: string; to: string; prevFrom: string; prevTo: string; dataAsOf: string; pendingCount: number };
  kpis: {
    isolates: { value: number; prev: number };
    patients: { value: number; prev: number };
    resistantPatients: { value: number; prev: number };
    icuShare: { icu: number; nonIcu: number; unknownWard: number };
    phenotypeCounts: Record<PhenotypeCode, number>;
    clusters: number;
  };
  charts: {
    icuVsNonIcu: { label: string; value: number }[];
    byWard: { ward: string; value: number }[];
    bySpecimen: { label: string; value: number }[];
    monthlyResistant: { month: string; value: number }[];
    topOrganisms: { label: string; value: number }[];
  };
  recentResistant: { id: string; code: string; date: string; hn?: string; ward: string; organism: string; phenotypes: PhenotypeCode[] }[];
  clusters: ClusterEpisode[];
}

const positives = (iso: LoadedIsolate) => iso.phenotypes.filter((p) => p.result === 'POSITIVE').map((p) => p.code);
const watched = (iso: LoadedIsolate) => positives(iso).filter((c) => WATCH_PHENOTYPES.includes(c));
const distinctHn = (rows: LoadedIsolate[]) => new Set(rows.map((r) => r.hn)).size;
const resistantPatients = (rows: LoadedIsolate[]) => distinctHn(rows.filter((r) => watched(r).length > 0));

function countBy<T>(rows: T[], key: (r: T) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) { const k = key(r); m.set(k, (m.get(k) ?? 0) + 1); }
  return m;
}

export async function getDashboardStats(filters: DashboardFilters = {}, role: DashboardRole | string = 'ICN'): Promise<DashboardStats> {
  const showHn = role !== 'EXECUTIVE';
  const [dataAsOf, pendingCount] = await Promise.all([getDataAsOf(), getPendingCount()]);
  const to = filters.to || dataAsOf;
  const from = filters.from || addDays(to, -89); // default: last 90 days of data (MR6)
  const len = Math.max(1, diffDays(from, to) + 1);
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(len - 1));

  const loaded = applyScope(await loadIsolates({ from: prevFrom, to, countableOnly: true }), filters);
  const cur = loaded.filter((i) => inPeriod(i.specimenDate, { from, to }));
  const prev = loaded.filter((i) => inPeriod(i.specimenDate, { from: prevFrom, to: prevTo }));

  // Phenotype counts = distinct patients (HN) per phenotype, so repeat isolates are not double counted.
  const phenotypeCounts = Object.fromEntries(PHENOTYPE_CODES.map((c) => [c, 0])) as Record<PhenotypeCode, number>;
  for (const code of PHENOTYPE_CODES) {
    phenotypeCounts[code] = new Set(cur.filter((i) => positives(i).includes(code)).map((i) => i.hn)).size;
  }

  const icu = cur.filter((i) => i.wardType === 'ICU').length;
  const nonIcu = cur.filter((i) => i.wardType === 'NON_ICU').length;
  const unknownWard = cur.length - icu - nonIcu;

  const clustersRaw = detectClusters(cur, {
    watchKey: (iso) => { const w = watched(iso as LoadedIsolate); return w.length ? `${w[0]}:${iso.organism.name}` : null; },
  });
  const clusters = clustersRaw.map(({ patients, ...rest }) => (showHn ? { ...rest, patients } : rest));

  const byWard = [...countBy(cur, (i) => i.wardName ?? 'ไม่ทราบ ward')].map(([ward, value]) => ({ ward, value })).sort((a, b) => b.value - a.value || a.ward.localeCompare(b.ward));
  const bySpecimen = [...countBy(cur, (i) => i.specimenType)].map(([k, value]) => ({ label: SPECIMEN_LABEL_TH[k as SpecimenType] ?? k, value })).sort((a, b) => b.value - a.value);
  const topOrganisms = [...countBy(cur, (i) => i.organism.name)].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)).slice(0, 10);

  const resistantRows = cur.filter((i) => watched(i).length > 0);
  const byMonth = new Map<string, Set<string>>();
  for (const r of resistantRows) { const k = monthKey(r.specimenDate); const s = byMonth.get(k) ?? new Set<string>(); s.add(r.hn); byMonth.set(k, s); }
  const monthlyResistant = monthsBetween(from, to).map((month) => ({ month, value: byMonth.get(month)?.size ?? 0 }));

  const recentResistant = cur
    .filter((i) => positives(i).length > 0)
    .sort((a, b) => (a.specimenDate < b.specimenDate ? 1 : a.specimenDate > b.specimenDate ? -1 : a.code < b.code ? 1 : -1))
    .slice(0, 20)
    .map((i) => ({
      id: i.id, code: i.code, date: i.specimenDate,
      ...(showHn ? { hn: i.hn } : {}),
      ward: i.wardName ?? 'ไม่ทราบ ward', organism: i.organism.name, phenotypes: positives(i),
    }));

  return {
    meta: { from, to, prevFrom, prevTo, dataAsOf, pendingCount },
    kpis: {
      isolates: { value: cur.length, prev: prev.length },
      patients: { value: distinctHn(cur), prev: distinctHn(prev) },
      resistantPatients: { value: resistantPatients(cur), prev: resistantPatients(prev) },
      icuShare: { icu, nonIcu, unknownWard },
      phenotypeCounts,
      clusters: clusters.length,
    },
    charts: {
      icuVsNonIcu: [{ label: 'ICU', value: icu }, { label: 'Non-ICU', value: nonIcu }, ...(unknownWard ? [{ label: 'ไม่ทราบ ward', value: unknownWard }] : [])],
      byWard,
      bySpecimen,
      monthlyResistant,
      topOrganisms,
    },
    recentResistant,
    clusters,
  };
}
