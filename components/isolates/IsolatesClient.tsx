'use client';
// /isolates client: filters (HN, organism, ward, status, date) + table + approve/delete (ICN) + ปรึกษา AI (APPROVED, DOCTOR/ICN).
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { Flag } from '@/lib/domain/types';
import type { Role } from '@/lib/role-shared';
import type { IsolateListItem, IsolateListResponse } from '@/lib/isolates';
import { PHENOTYPE_LABEL, REPORT_STATUS_LABEL, SPECIMEN_LABEL, STATUS_LABEL, thaiDate } from './format';
import { EMPTY_FILTERS, type IsolateFilters } from './filters';

interface Props {
  role: Role;
  organisms: { id: number; name: string }[];
  wards: { id: number; name: string; wardType: string }[];
  initialFilters: IsolateFilters;
}

const ctl = 'h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base';

export default function IsolatesClient({ role, organisms, wards, initialFilters }: Props) {
  const [filters, setFilters] = useState<IsolateFilters>(initialFilters);
  const [applied, setApplied] = useState<IsolateFilters>(initialFilters);
  const [data, setData] = useState<IsolateListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string; flags?: Flag[] } | null>(null);
  const hideHn = role === 'EXECUTIVE';

  const load = useCallback(async (f: IsolateFilters) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(f)) if (v) qs.set(k, v);
      const res = await fetch(`/api/isolates?${qs.toString()}`, { cache: 'no-store' });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j) throw new Error(j?.error ?? `HTTP ${res.status}`);
      setData(j as IsolateListResponse);
    } catch (e) {
      setMessage({ kind: 'error', text: `โหลดรายการไม่สำเร็จ: ${e instanceof Error ? e.message : ''}` });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(applied);
  }, [applied, load]);

  async function approve(it: IsolateListItem) {
    setBusyId(it.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/isolates/${encodeURIComponent(it.id)}/approve`, { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setMessage({ kind: 'error', text: `ยืนยัน ${it.code} ไม่สำเร็จ: ${j.error ?? res.status}`, flags: j.flags });
      else setMessage({ kind: 'ok', text: `ยืนยัน ${it.code} แล้ว — สถิติทุกหน้าอัปเดต` });
      await load(applied);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(it: IsolateListItem) {
    if (!window.confirm(`ลบ ${it.code}? การลบย้อนกลับไม่ได้`)) return;
    setBusyId(it.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/isolates/${encodeURIComponent(it.id)}`, { method: 'DELETE' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setMessage({ kind: 'error', text: `ลบ ${it.code} ไม่สำเร็จ: ${j.error ?? res.status}` });
      else setMessage({ kind: 'ok', text: `ลบ ${it.code} แล้ว` });
      await load(applied);
    } finally {
      setBusyId(null);
    }
  }

  const set = (k: keyof IsolateFilters) => (e: { target: { value: string } }) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      {hideHn && (
        <div role="note" className="rounded-md border border-slate-300 bg-slate-100 p-3 text-sm">
          บทบาทผู้บริหาร: ระบบไม่ส่ง HN / Lab No มาจากเซิร์ฟเวอร์
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setApplied({ ...filters });
        }}
        className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="ตัวกรองรายการ isolate"
      >
        {!hideHn && (
          <div>
            <label htmlFor="f-hn" className="mb-1 block text-sm font-medium">HN</label>
            <input id="f-hn" inputMode="numeric" value={filters.hn} onChange={set('hn')} className={ctl} />
          </div>
        )}
        <div>
          <label htmlFor="f-org" className="mb-1 block text-sm font-medium">เชื้อ</label>
          <select id="f-org" value={filters.organismId} onChange={set('organismId')} className={ctl}>
            <option value="">ทั้งหมด</option>
            {organisms.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-ward" className="mb-1 block text-sm font-medium">Ward</label>
          <select id="f-ward" value={filters.wardId} onChange={set('wardId')} className={ctl}>
            <option value="">ทั้งหมด</option>
            {wards.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-status" className="mb-1 block text-sm font-medium">สถานะ</label>
          <select id="f-status" value={filters.status} onChange={set('status')} className={ctl}>
            <option value="">ทั้งหมด</option>
            <option value="DRAFT">DRAFT รอยืนยัน</option>
            <option value="APPROVED">ยืนยันแล้ว</option>
          </select>
        </div>
        <div>
          <label htmlFor="f-rs" className="mb-1 block text-sm font-medium">สถานะรายงาน</label>
          <select id="f-rs" value={filters.reportStatus} onChange={set('reportStatus')} className={ctl}>
            <option value="">ทั้งหมด</option>
            <option value="FINAL">Final</option>
            <option value="PRELIMINARY">Preliminary</option>
            <option value="UNKNOWN">ไม่ทราบสถานะ</option>
          </select>
        </div>
        <div>
          <label htmlFor="f-from" className="mb-1 block text-sm font-medium">วันที่รับตรวจ ตั้งแต่</label>
          <input id="f-from" type="date" value={filters.from} onChange={set('from')} className={ctl} />
        </div>
        <div>
          <label htmlFor="f-to" className="mb-1 block text-sm font-medium">ถึง</label>
          <input id="f-to" type="date" value={filters.to} onChange={set('to')} className={ctl} />
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="min-h-11 flex-1 rounded-md bg-sky-700 px-4 font-semibold text-white">ค้นหา</button>
          <button
            type="button"
            onClick={() => {
              setFilters(EMPTY_FILTERS);
              setApplied(EMPTY_FILTERS);
            }}
            className="min-h-11 rounded-md border border-slate-300 bg-white px-4"
          >
            ล้าง
          </button>
        </div>
      </form>

      <div aria-live="polite">
        {message && (
          <div className={`rounded-md border p-3 text-sm ${message.kind === 'ok' ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-red-300 bg-red-50 text-red-800'}`}>
            <p>{message.text}</p>
            {message.flags && message.flags.length > 0 && (
              <ul className="mt-1">
                {message.flags.map((f, i) => (
                  <li key={i}>⚑ {f.path}: {f.reason}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <p className="mt-2 text-sm text-slate-600">
          {loading ? 'กำลังโหลด…' : data ? `แสดง ${data.items.length} จาก ${data.total} รายการ (เรียงตามเวลาบันทึกล่าสุด)` : ''}
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <caption className="sr-only">รายการ isolate</caption>
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th scope="col" className="px-3 py-2">รหัส</th>
              <th scope="col" className="px-3 py-2">วันที่รับตรวจ</th>
              {!hideHn && <th scope="col" className="px-3 py-2">HN</th>}
              <th scope="col" className="px-3 py-2">เชื้อ</th>
              <th scope="col" className="px-3 py-2">Specimen</th>
              <th scope="col" className="px-3 py-2">Ward</th>
              <th scope="col" className="px-3 py-2">กลุ่มเชื้อดื้อยา</th>
              <th scope="col" className="px-3 py-2">สถานะ</th>
              <th scope="col" className="px-3 py-2">การดำเนินการ</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((it) => {
              const blocked = it.flagCount > 0 || it.wardId == null || !it.patientType;
              return (
                <tr key={it.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2 font-mono text-xs">{it.code}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{thaiDate(it.specimenDate)}</td>
                  {!hideHn && <td className="px-3 py-2 font-mono">{it.hn}</td>}
                  <td className="px-3 py-2 italic">{it.organismName}</td>
                  <td className="px-3 py-2">{SPECIMEN_LABEL[it.specimenType] ?? it.specimenType}</td>
                  <td className="px-3 py-2">{it.wardName ?? <span className="text-amber-700">ไม่ระบุ</span>}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {it.phenotypes.length === 0 && <span className="text-slate-400">—</span>}
                      {it.phenotypes.map((p) => (
                        <span key={p} className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-800">{PHENOTYPE_LABEL[p] ?? p}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${it.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-800'}`}>
                        {STATUS_LABEL[it.status] ?? it.status}
                      </span>
                      {it.reportStatus !== 'FINAL' && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800">{REPORT_STATUS_LABEL[it.reportStatus] ?? it.reportStatus}</span>
                      )}
                      {it.flagCount > 0 && (
                        <span
                          className="rounded bg-amber-200 px-1.5 py-0.5 text-xs font-semibold text-amber-900"
                          title={it.flags.map((f) => `${f.path}: ${f.reason}`).join('\n') || undefined}
                        >
                          ธง {it.flagCount}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      {role === 'ICN' && it.status === 'DRAFT' && (
                        <button
                          type="button"
                          disabled={busyId === it.id || blocked}
                          title={blocked ? 'มีธงค้าง หรือยังไม่ระบุ Ward/Patient Type' : undefined}
                          onClick={() => void approve(it)}
                          className="min-h-10 rounded-md bg-emerald-700 px-3 text-white disabled:opacity-40"
                        >
                          ยืนยัน
                        </button>
                      )}
                      {role === 'ICN' && (
                        <button
                          type="button"
                          disabled={busyId === it.id}
                          onClick={() => void remove(it)}
                          className="min-h-10 rounded-md border border-red-300 bg-white px-3 text-red-700 disabled:opacity-40"
                        >
                          ลบ
                        </button>
                      )}
                      {it.status === 'APPROVED' && (role === 'ICN' || role === 'DOCTOR') && (
                        <Link
                          href={`/consult?isolateId=${encodeURIComponent(it.id)}`}
                          className="inline-flex min-h-10 items-center rounded-md bg-violet-700 px-3 text-white"
                        >
                          ปรึกษา AI
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {data && data.items.length === 0 && !loading && (
              <tr>
                <td colSpan={hideHn ? 8 : 9} className="px-3 py-6 text-center text-slate-500">ไม่พบรายการ</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
