import { getDashboardStats } from '@/lib/stats';
import { getRole } from '@/lib/role';
import { parseDashboardFilters } from '@/components/dashboard/params';
import { firstParam, specimenLabel, thaiDate, thaiMonth, type SearchParams } from '@/components/dashboard/format';
import { loadMasterOptions } from '@/components/dashboard/master';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { KpiCards } from '@/components/dashboard/KpiCards';
import { DashboardCharts } from '@/components/dashboard/DashboardCharts';
import { RecentResistantTable } from '@/components/dashboard/RecentResistantTable';
import { ClusterCard, type ClusterRow } from '@/components/dashboard/ClusterCard';
import { ClinicalDisclaimer, DataMeta, DraftRulesLabel, ErrorPanel } from '@/components/dashboard/Notices';
import type { DashboardStatsView } from '@/components/dashboard/types';

import { errorSummary, publicErrorMessage } from '@/lib/security/log';
export const dynamic = 'force-dynamic';

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filters = parseDashboardFilters((k) => firstParam(sp[k]));

  let stats: DashboardStatsView;
  let master: Awaited<ReturnType<typeof loadMasterOptions>>;
  try {
    const role = await getRole();
    [stats, master] = await Promise.all([getDashboardStats(filters, role), loadMasterOptions()]);
  } catch (err) {
    console.error('[dashboard] load failed:', errorSummary(err));
    return (
      <div>
        <h1 className="mb-3 text-2xl font-bold">แดชบอร์ด</h1>
        <ErrorPanel message={publicErrorMessage(err)} />
      </div>
    );
  }

  const { meta, kpis, charts } = stats;
  const clusterRows: ClusterRow[] = stats.clusters.map((c) => ({
    key: c.key, organism: c.organism, phenotype: c.phenotype, wardName: c.wardName,
    firstDateTh: thaiDate(c.firstDate), lastDateTh: thaiDate(c.lastDate),
    patientCount: c.patientCount, isolateCount: c.isolateIds.length,
    ...(c.patients ? { patients: c.patients } : {}),
  }));

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-slate-900">แดชบอร์ดเชื้อดื้อยา</h1>
        <DataMeta dataAsOf={meta.dataAsOf} pendingCount={meta.pendingCount} from={meta.from} to={meta.to}
          extra={<span>เทียบกับช่วงก่อน: {thaiDate(meta.prevFrom)} – {thaiDate(meta.prevTo)}</span>} />
      </header>

      <DashboardFilters
        initial={{
          from: filters.from ?? meta.from ?? '',
          to: filters.to ?? meta.to ?? '',
          wardType: filters.wardType ?? '',
          wardId: filters.wardId !== undefined ? String(filters.wardId) : '',
          specimenType: filters.specimenType ?? '',
          organism: filters.organism ?? '',
        }}
        wards={master.wards}
        organisms={master.organisms}
      />

      <KpiCards kpis={kpis} />

      <DashboardCharts
        icuVsNonIcu={charts.icuVsNonIcu}
        byWard={charts.byWard.map((w) => ({ label: w.ward, value: w.value }))}
        bySpecimen={charts.bySpecimen.map((s) => ({ label: specimenLabel(s.label), value: s.value }))}
        monthlyResistant={charts.monthlyResistant.map((m) => ({ label: thaiMonth(m.month), value: m.value }))}
        topOrganisms={charts.topOrganisms}
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <RecentResistantTable rows={stats.recentResistant} />
        <ClusterCard clusters={clusterRows} />
      </div>

      <DraftRulesLabel what="กฎ phenotype (CRE/ESBL-screen/CRAB/CRPA/MRSA/VRE)" />
      <ClinicalDisclaimer />
    </div>
  );
}
