'use client';

// MR9.8 controls: period, ward/ward type, specimen, organism group (overview) or organism+phenotype
// (phenotype tab), min N, %S formula switch, print button. State lives in the URL query string.
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  ORG_GROUP_LABEL, PHENOTYPE_LABEL, PHENOTYPES_BY_GROUP, SPECIMEN_LABEL, SPECIMEN_TYPES,
} from '@/components/dashboard/format';
import type { OrganismOption, WardOption } from '@/components/dashboard/types';

export interface AbgControlValues {
  view: 'overview' | 'phenotype';
  from: string; to: string; wardType: string; wardId: string; specimenType: string;
  group: string; organism: string; phenotype: string; minN: string; formula: 'S_ONLY' | 'S_PLUS_SDD';
}

const fieldCls = 'mt-1 block w-full min-h-11 rounded-md border border-slate-300 bg-white px-2 text-base';
const labelCls = 'text-sm font-medium text-slate-700';

export function toQuery(v: AbgControlValues): string {
  const qs = new URLSearchParams();
  qs.set('view', v.view);
  const keys: (keyof AbgControlValues)[] = ['from', 'to', 'wardType', 'wardId', 'specimenType', 'minN', 'formula'];
  if (v.view === 'overview') keys.push('group');
  else keys.push('organism', 'phenotype');
  for (const k of keys) if (v[k]) qs.set(k, String(v[k]));
  return qs.toString();
}

export function AbgControls({
  initial, wards, organisms,
}: { initial: AbgControlValues; wards: WardOption[]; organisms: OrganismOption[] }) {
  const router = useRouter();
  const [v, setV] = useState<AbgControlValues>(initial);
  const [pending, startTransition] = useTransition();

  const go = (next: AbgControlValues) => startTransition(() => router.push(`/antibiogram?${toQuery(next)}`));

  const set = (k: keyof AbgControlValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV((prev) => {
      const next = { ...prev, [k]: e.target.value } as AbgControlValues;
      if (k === 'wardType') next.wardId = '';
      if (k === 'organism') next.phenotype = '';
      return next;
    });

  const setFormula = (formula: AbgControlValues['formula']) => {
    const next = { ...v, formula };
    setV(next);
    go(next);
  };

  const bacteria = organisms.filter((o) => o.orgClass === 'BACTERIA');
  const groups = Array.from(new Set(bacteria.map((o) => o.group)));
  const wardChoices = v.wardType ? wards.filter((w) => w.wardType === v.wardType) : wards;
  const selectedOrg = bacteria.find((o) => o.name === v.organism);
  const phenotypeChoices = selectedOrg ? (PHENOTYPES_BY_GROUP[selectedOrg.group] ?? []) : [];
  const minN = Number(v.minN);

  return (
    <form onSubmit={(e) => { e.preventDefault(); go(v); }}
      className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 print:hidden">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <label className={labelCls}>ตั้งแต่วันที่
          <input type="date" className={fieldCls} value={v.from} onChange={set('from')} />
        </label>
        <label className={labelCls}>ถึงวันที่
          <input type="date" className={fieldCls} value={v.to} onChange={set('to')} />
        </label>
        <label className={labelCls}>กลุ่มหอ
          <select className={fieldCls} value={v.wardType} onChange={set('wardType')}>
            <option value="">ทั้งโรงพยาบาล</option>
            <option value="ICU">ICU รวม</option>
            <option value="NON_ICU">Non-ICU รวม</option>
          </select>
        </label>
        <label className={labelCls}>หอผู้ป่วย
          <select className={fieldCls} value={v.wardId} onChange={set('wardId')}>
            <option value="">ทั้งหมด</option>
            {wardChoices.map((w) => <option key={w.id} value={String(w.id)}>{w.name}</option>)}
          </select>
        </label>
        <label className={labelCls}>สิ่งส่งตรวจ
          <select className={fieldCls} value={v.specimenType} onChange={set('specimenType')}>
            <option value="">ทั้งหมด</option>
            {SPECIMEN_TYPES.map((s) => <option key={s} value={s}>{SPECIMEN_LABEL[s]}</option>)}
          </select>
        </label>
        {v.view === 'overview' ? (
          <label className={labelCls}>กลุ่มเชื้อ
            <select className={fieldCls} value={v.group} onChange={set('group')}>
              <option value="">ทั้งหมด</option>
              {groups.map((g) => <option key={g} value={g}>{ORG_GROUP_LABEL[g] ?? g}</option>)}
            </select>
          </label>
        ) : (
          <>
            <label className={labelCls}>เชื้อ
              <select className={fieldCls} value={v.organism} onChange={set('organism')}>
                <option value="">— เลือกเชื้อ —</option>
                {bacteria.map((o) => <option key={o.id} value={o.name}>{o.name}</option>)}
              </select>
            </label>
            <label className={labelCls}>กลุ่มเชื้อดื้อยา
              <select className={fieldCls} value={v.phenotype} onChange={set('phenotype')}>
                <option value="">ทุก isolate ของเชื้อนี้</option>
                {phenotypeChoices.map((p) => <option key={p} value={p}>{PHENOTYPE_LABEL[p]}</option>)}
              </select>
            </label>
          </>
        )}
        <label className={labelCls}>min N
          <input type="number" min={1} max={999} inputMode="numeric" className={fieldCls} value={v.minN} onChange={set('minN')} />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div role="radiogroup" aria-label="สูตร %S" className="flex overflow-hidden rounded-md border border-slate-300">
          {(['S_ONLY', 'S_PLUS_SDD'] as const).map((f) => (
            <button key={f} type="button" role="radio" aria-checked={v.formula === f} onClick={() => setFormula(f)}
              className={`min-h-11 px-3 text-sm font-medium ${v.formula === f ? 'bg-teal-700 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>
              {f === 'S_ONLY' ? '%S = S เท่านั้น' : '%S รวม SDD (S+D)'}
            </button>
          ))}
        </div>
        <button type="submit" disabled={pending || !(minN >= 1)}
          className="min-h-11 rounded-md bg-teal-700 px-4 font-semibold text-white hover:bg-teal-800 disabled:opacity-60">
          {pending ? 'กำลังคำนวณ…' : 'แสดงผล'}
        </button>
        <button type="button" onClick={() => window.print()}
          className="min-h-11 rounded-md border border-slate-300 px-4 text-slate-700 hover:bg-slate-50">
          พิมพ์ / บันทึก PDF
        </button>
      </div>
    </form>
  );
}
