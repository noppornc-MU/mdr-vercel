'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { SPECIMEN_LABEL, SPECIMEN_TYPES } from './format';
import type { OrganismOption, WardOption } from './types';

export interface DashboardFilterValues {
  from: string; to: string; wardType: string; wardId: string; specimenType: string; organism: string;
}

const fieldCls = 'mt-1 block w-full min-h-11 rounded-md border border-slate-300 bg-white px-2 text-base';
const labelCls = 'text-sm font-medium text-slate-700';

export function DashboardFilters({
  initial, wards, organisms,
}: { initial: DashboardFilterValues; wards: WardOption[]; organisms: OrganismOption[] }) {
  const router = useRouter();
  const [v, setV] = useState<DashboardFilterValues>(initial);
  const [pending, startTransition] = useTransition();

  const set = (k: keyof DashboardFilterValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV((prev) => ({ ...prev, [k]: e.target.value, ...(k === 'wardType' ? { wardId: '' } : {}) }));

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    const qs = new URLSearchParams();
    for (const [k, val] of Object.entries(v)) if (val) qs.set(k, val);
    startTransition(() => router.push(`/dashboard?${qs.toString()}`));
  };

  const reset = () => startTransition(() => router.push('/dashboard'));

  const wardChoices = v.wardType ? wards.filter((w) => w.wardType === v.wardType) : wards;
  const bacteria = organisms.filter((o) => o.orgClass === 'BACTERIA');

  return (
    <form onSubmit={apply} className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-4 xl:grid-cols-7">
      <label className={labelCls}>ตั้งแต่วันที่
        <input type="date" className={fieldCls} value={v.from} onChange={set('from')} />
      </label>
      <label className={labelCls}>ถึงวันที่
        <input type="date" className={fieldCls} value={v.to} onChange={set('to')} />
      </label>
      <label className={labelCls}>ประเภทหอ
        <select className={fieldCls} value={v.wardType} onChange={set('wardType')}>
          <option value="">ทั้งหมด</option>
          <option value="ICU">ICU</option>
          <option value="NON_ICU">Non-ICU</option>
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
      <label className={labelCls}>เชื้อ
        <select className={fieldCls} value={v.organism} onChange={set('organism')}>
          <option value="">ทั้งหมด</option>
          {bacteria.map((o) => <option key={o.id} value={o.name}>{o.name}</option>)}
        </select>
      </label>
      <div className="col-span-2 flex items-end gap-2 md:col-span-1">
        <button type="submit" disabled={pending}
          className="min-h-11 flex-1 rounded-md bg-teal-700 px-3 font-semibold text-white hover:bg-teal-800 disabled:opacity-60">
          {pending ? 'กำลังโหลด…' : 'ใช้ตัวกรอง'}
        </button>
        <button type="button" onClick={reset} disabled={pending}
          className="min-h-11 rounded-md border border-slate-300 px-3 text-slate-700 hover:bg-slate-50">
          ล้าง
        </button>
      </div>
    </form>
  );
}
