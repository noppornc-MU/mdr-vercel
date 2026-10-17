import Link from 'next/link';
import { getAntibiogram } from '@/lib/stats/antibiogram';
import { getPhenotypeBreakdown } from '@/lib/stats/phenotype';
import { parseAbgParams, type AbgScopeInput, type AbgView } from '@/components/antibiogram/params';
import { AbgControls, type AbgControlValues } from '@/components/antibiogram/AbgControls';
import { AbgLegend, AbgMatrix } from '@/components/antibiogram/AbgMatrix';
import { PhenotypeView } from '@/components/antibiogram/PhenotypeView';
import { loadMasterOptions } from '@/components/dashboard/master';
import { ClinicalDisclaimer, DataMeta, DraftRulesLabel, ErrorPanel } from '@/components/dashboard/Notices';
import { ORG_GROUP_LABEL, PHENOTYPE_LABEL, firstParam, specimenLabel, type SearchParams } from '@/components/dashboard/format';

import { errorSummary, publicErrorMessage } from '@/lib/security/log';
export const dynamic = 'force-dynamic';

function scopeQuery(view: AbgView, s: AbgScopeInput, extra: Record<string, string | undefined> = {}): string {
  const qs = new URLSearchParams({ view });
  if (s.from) qs.set('from', s.from);
  if (s.to) qs.set('to', s.to);
  if (s.wardType) qs.set('wardType', s.wardType);
  if (s.wardId !== undefined) qs.set('wardId', String(s.wardId));
  if (s.specimenType) qs.set('specimenType', s.specimenType);
  qs.set('minN', String(s.minN));
  qs.set('formula', s.formula);
  for (const [k, v] of Object.entries(extra)) if (v) qs.set(k, v);
  return qs.toString();
}

export default async function AntibiogramPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const { view, scope, group } = parseAbgParams((k) => firstParam(sp[k]));

  try {
    const master = await loadMasterOptions();

    // Phenotype tab: default to K. pneumoniae – CRE (DoD 3) when no organism chosen.
    let phenoScope = scope;
    if (view === 'phenotype' && !scope.organism) {
      const kp = master.organisms.find((o) => /klebsiella pneumoniae/i.test(o.name));
      if (kp) phenoScope = { ...scope, organism: kp.name, phenotype: scope.phenotype ?? 'CRE' };
    }

    const overview = view === 'overview' ? await getAntibiogram({ ...scope, organism: undefined, phenotype: undefined }) : null;
    const pheno = view === 'phenotype' && phenoScope.organism ? await getPhenotypeBreakdown(phenoScope) : null;
    const meta = overview?.meta ?? pheno?.meta ?? (await getAntibiogram(scope)).meta;

    const shownOrganisms = overview
      ? overview.organisms.filter((o) => !group || o.group === group)
      : [];

    const wardName = scope.wardId !== undefined ? master.wards.find((w) => w.id === scope.wardId)?.name : undefined;
    const scopeText = [
      wardName ?? (scope.wardType === 'ICU' ? 'ICU รวม' : scope.wardType === 'NON_ICU' ? 'Non-ICU รวม' : 'ทั้งโรงพยาบาล'),
      scope.specimenType ? specimenLabel(scope.specimenType) : 'ทุกสิ่งส่งตรวจ',
      view === 'overview' && group ? `กลุ่มเชื้อ ${ORG_GROUP_LABEL[group] ?? group}` : null,
    ].filter(Boolean).join(' · ');

    const initial: AbgControlValues = {
      view,
      from: scope.from ?? meta.from ?? '',
      to: scope.to ?? meta.to ?? '',
      wardType: scope.wardType ?? '',
      wardId: scope.wardId !== undefined ? String(scope.wardId) : '',
      specimenType: scope.specimenType ?? '',
      group: group ?? '',
      organism: phenoScope.organism ?? '',
      phenotype: phenoScope.phenotype ?? '',
      minN: String(scope.minN),
      formula: scope.formula,
    };

    const consultQs = new URLSearchParams();
    if (phenoScope.organism) consultQs.set('organism', phenoScope.organism);
    if (phenoScope.phenotype) consultQs.set('phenotype', phenoScope.phenotype);
    if (scope.wardId !== undefined) consultQs.set('wardId', String(scope.wardId));
    if (scope.specimenType) consultQs.set('specimenType', scope.specimenType);

    const tabCls = (active: boolean) =>
      `min-h-11 inline-flex items-center rounded-t-md border border-b-0 px-4 font-medium ${active ? 'bg-white text-teal-800 border-slate-300' : 'bg-slate-100 text-slate-600 border-transparent hover:text-slate-900'}`;

    return (
      <div className="flex flex-col gap-3">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-slate-900">Antibiogram (%Susceptibility)</h1>
          <DataMeta dataAsOf={meta.dataAsOf} pendingCount={meta.pendingCount} from={meta.from} to={meta.to}
            extra={<>
              <span>ขอบเขต: <b>{scopeText}</b></span>
              <span>สูตร %S: <b>{meta.formula === 'S_PLUS_SDD' ? 'รวม SDD (S+D)/n' : 'S เท่านั้น S/n'}</b></span>
              <span>min N: <b>{meta.minN}</b></span>
            </>} />
          <p className="text-xs text-slate-600">
            นับ first isolate ต่อผู้ป่วยต่อชนิดเชื้อในช่วงเวลา · เฉพาะแบคทีเรีย · ยาที่ไม่ได้ทดสอบไม่นับในตัวหาร · I และ R ไม่รวมใน %S
          </p>
        </header>

        <AbgControls initial={initial} wards={master.wards} organisms={master.organisms} />

        {scope.minN < 30 && (
          <p role="status" className="rounded-md border border-orange-400 bg-orange-50 px-3 py-2 font-semibold text-orange-900">
            ข้อมูลน้อย — ใช้ประกอบเท่านั้น (min N = {scope.minN} ต่ำกว่าค่ามาตรฐาน 30)
          </p>
        )}

        <DraftRulesLabel what="กฎ phenotype ตาราง SDD (sdd_allowed) และตาราง intrinsic resistance" />

        <nav className="flex gap-1 border-b border-slate-300 print:hidden" aria-label="มุมมอง">
          <Link href={`/antibiogram?${scopeQuery('overview', scope, { group })}`} className={tabCls(view === 'overview')}
            aria-current={view === 'overview' ? 'page' : undefined}>
            ภาพรวมเชื้อ × ยา
          </Link>
          <Link href={`/antibiogram?${scopeQuery('phenotype', scope, { organism: phenoScope.organism, phenotype: phenoScope.phenotype })}`}
            className={tabCls(view === 'phenotype')} aria-current={view === 'phenotype' ? 'page' : undefined}>
            แยกตามกลุ่มเชื้อดื้อยา
          </Link>
        </nav>

        {overview && (
          <>
            <AbgMatrix organisms={shownOrganisms} drugs={overview.drugs} cells={overview.cells} minN={meta.minN} />
            <AbgLegend minN={meta.minN} />
          </>
        )}

        {view === 'phenotype' && (pheno && phenoScope.organism ? (
          <PhenotypeView
            organism={phenoScope.organism}
            phenotype={phenoScope.phenotype}
            counts={pheno.counts}
            drugs={pheno.drugs}
            minN={meta.minN}
            consultHref={`/consult?${consultQs.toString()}`}
          />
        ) : (
          <p className="rounded-md border border-slate-200 bg-white p-6 text-center text-slate-600">เลือกเชื้อเพื่อดู %S แยกตามกลุ่มเชื้อดื้อยา</p>
        ))}

        <ClinicalDisclaimer />
        {phenoScope.phenotype && view === 'phenotype' && (
          <p className="text-xs text-slate-500">กลุ่ม {PHENOTYPE_LABEL[phenoScope.phenotype]} จัดโดยระบบจากตารางกฎ ไม่ได้ให้ผู้ใช้เลือกเอง</p>
        )}
      </div>
    );
  } catch (err) {
    console.error('[antibiogram] load failed:', errorSummary(err));
    return (
      <div>
        <h1 className="mb-3 text-2xl font-bold">Antibiogram</h1>
        <ErrorPanel message={publicErrorMessage(err)} />
      </div>
    );
  }
}
