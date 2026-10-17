// KPI cards (MR5): value + % change vs previous equal-length period + what is counted.
import { PHENOTYPE_LABEL, PHENOTYPE_ORDER, fmtInt, pctChange } from './format';
import type { DashboardStatsView, KpiPair } from './types';

function Change({ pair }: { pair: KpiPair }) {
  const c = pctChange(pair.value, pair.prev);
  const text = c === null ? 'ไม่มีข้อมูลช่วงก่อน' : `${c > 0 ? '▲ +' : c < 0 ? '▼ ' : '■ '}${c.toFixed(1)}%`;
  return (
    <p className="text-sm text-slate-600">
      {text} <span className="text-slate-500">(ช่วงก่อน {fmtInt(pair.prev)})</span>
    </p>
  );
}

function Card({ title, counts, children }: { title: string; counts: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-3 shadow-sm" title={counts}>
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      {children}
      <p className="mt-auto text-xs text-slate-500">ⓘ {counts}</p>
    </div>
  );
}

export function KpiCards({ kpis }: { kpis: DashboardStatsView['kpis'] }) {
  const { icu, nonIcu, unknownWard } = kpis.icuShare;
  const known = icu + nonIcu;
  const icuPct = known ? Math.round((icu / known) * 1000) / 10 : null;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Card title="จำนวน isolate" counts="นับ isolate (ยืนยันแล้ว + รายงาน Final)">
        <p className="text-3xl font-bold text-slate-900">{fmtInt(kpis.isolates.value)}</p>
        <Change pair={kpis.isolates} />
      </Card>
      <Card title="จำนวนผู้ป่วย" counts="นับผู้ป่วย (HN ไม่ซ้ำ)">
        <p className="text-3xl font-bold text-slate-900">{fmtInt(kpis.patients.value)}</p>
        <Change pair={kpis.patients} />
      </Card>
      <Card title="ผู้ป่วยเชื้อดื้อยากลุ่มเฝ้าระวัง" counts="นับผู้ป่วยไม่ซ้ำ (HN) ที่พบเชื้อกลุ่มเฝ้าระวัง [J]">
        <p className="text-3xl font-bold text-red-800">{fmtInt(kpis.resistantPatients.value)}</p>
        <Change pair={kpis.resistantPatients} />
      </Card>
      <Card title="ICU : Non-ICU" counts="นับ isolate แยกตามประเภทหอ">
        <p className="text-2xl font-bold text-slate-900">{fmtInt(icu)} : {fmtInt(nonIcu)}</p>
        <p className="text-sm text-slate-600">
          ICU {icuPct === null ? '—' : `${icuPct.toFixed(1)}%`} · Non-ICU {icuPct === null ? '—' : `${(100 - icuPct).toFixed(1)}%`}
        </p>
        {unknownWard > 0 && <p className="text-xs text-slate-500">ไม่ทราบหอ {fmtInt(unknownWard)}</p>}
      </Card>
      <Card title="กลุ่มเชื้อดื้อยา" counts="นับผู้ป่วยไม่ซ้ำ (HN) ต่อกลุ่ม ตามกฎ phenotype ฉบับร่าง [J]">
        <ul className="grid grid-cols-2 gap-x-2 text-sm">
          {PHENOTYPE_ORDER.map((p) => (
            <li key={p} className="flex justify-between">
              <span>{PHENOTYPE_LABEL[p]}</span><b>{fmtInt(kpis.phenotypeCounts[p] ?? 0)}</b>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Suspected cluster" counts="เชื้อเดียวกัน หอเดียวกัน ผู้ป่วยไม่ซ้ำ ≥ 3 ราย ใน 14 วัน">
        <p className="text-3xl font-bold text-amber-800">{fmtInt(kpis.clusters)}</p>
        <p className="text-sm text-slate-600">สงสัย (suspected) — ไม่ใช่การยืนยันการระบาด</p>
      </Card>
    </div>
  );
}
