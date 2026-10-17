'use client';

// MR7 charts (Recharts). Every bar/slice/point shows its number as a label (not colour only).
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { LabelValue } from './types';

const COLORS = ['#0f766e', '#2563eb', '#d97706', '#7c3aed', '#dc2626', '#64748b', '#059669', '#db2777'];

function ChartCard({ title, unit, empty, children, tall }: {
  title: string; unit: string; empty: boolean; children: React.ReactNode; tall?: boolean;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <h3 className="font-semibold text-slate-800">{title}</h3>
      <p className="text-xs text-slate-500">{unit}</p>
      <div style={{ height: tall ? 340 : 260 }} className="mt-2">
        {empty ? <p className="pt-10 text-center text-slate-500">ไม่มีข้อมูลในช่วงนี้</p> : children}
      </div>
    </section>
  );
}

function HBar({ data, color }: { data: LabelValue[]; color: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" allowDecimals={false} />
        <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 12 }} interval={0} />
        <Tooltip />
        <Bar dataKey="value" name="จำนวน" fill={color} isAnimationActive={false}>
          <LabelList dataKey="value" position="right" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DashboardCharts({
  icuVsNonIcu, byWard, bySpecimen, monthlyResistant, topOrganisms,
}: {
  icuVsNonIcu: LabelValue[]; byWard: LabelValue[]; bySpecimen: LabelValue[]; monthlyResistant: LabelValue[]; topOrganisms: LabelValue[];
}) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
      <ChartCard title="ICU vs Non-ICU" unit="นับ isolate" empty={icuVsNonIcu.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={icuVsNonIcu} margin={{ top: 24, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value" name="จำนวน" isAnimationActive={false}>
              {icuVsNonIcu.map((d, i) => <Cell key={d.label} fill={COLORS[i % COLORS.length]} />)}
              <LabelList dataKey="value" position="top" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="สัดส่วนสิ่งส่งตรวจ" unit="นับ isolate" empty={bySpecimen.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={bySpecimen} dataKey="value" nameKey="label" outerRadius="70%" isAnimationActive={false}
              label={(p: { name?: unknown; value?: unknown }) => `${String(p.name ?? '')} ${String(p.value ?? '')}`}>
              {bySpecimen.map((d, i) => <Cell key={d.label} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="แนวโน้มรายเดือน: ผู้ป่วยเชื้อดื้อยา" unit="นับผู้ป่วยไม่ซ้ำ (HN) ต่อเดือนของวันรับสิ่งส่งตรวจ [J]" empty={monthlyResistant.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={monthlyResistant} margin={{ top: 24, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="value" name="จำนวน" stroke="#dc2626" strokeWidth={2} isAnimationActive={false}>
              <LabelList dataKey="value" position="top" />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="รายหอผู้ป่วย" unit="นับ isolate" empty={byWard.length === 0} tall>
        <HBar data={byWard} color="#0f766e" />
      </ChartCard>

      <ChartCard title="Top 10 เชื้อ" unit="นับ isolate" empty={topOrganisms.length === 0} tall>
        <HBar data={topOrganisms.slice(0, 10)} color="#2563eb" />
      </ChartCard>
    </div>
  );
}
