'use client';
// Success panel after create + approve (MR3.4 → MR14 shortcut).
import Link from 'next/link';
import type { Role } from '@/lib/role-shared';
import type { SavedIsolate } from './IsolateForm';
import { PHENOTYPE_LABEL, thaiDate } from '@/components/isolates/format';
import { bangkokToday } from './shared';

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export default function SuccessPanel({ saved, role, onNew }: { saved: SavedIsolate; role: Role; onNew: () => void }) {
  const old = saved.specimenDate ? daysBetween(saved.specimenDate, bangkokToday()) > 90 : false;
  return (
    <section role="status" aria-labelledby="saved-title" className="rounded-lg border border-emerald-300 bg-emerald-50 p-6">
      <h2 id="saved-title" className="text-xl font-semibold text-emerald-900">
        บันทึกและยืนยันข้อมูลเรียบร้อย
      </h2>
      <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div>
          <dt className="inline text-slate-600">รหัส: </dt>
          <dd className="inline font-semibold">{saved.code}</dd>
        </div>
        <div>
          <dt className="inline text-slate-600">เชื้อ: </dt>
          <dd className="inline italic">{saved.organismName}</dd>
        </div>
        <div>
          <dt className="inline text-slate-600">วันที่รับตรวจ: </dt>
          <dd className="inline">{thaiDate(saved.specimenDate)}</dd>
        </div>
        <div>
          <dt className="inline text-slate-600">Ward: </dt>
          <dd className="inline">{saved.wardName}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="inline text-slate-600">กลุ่มเชื้อดื้อยา: </dt>
          <dd className="inline">
            {saved.phenotypes.length ? saved.phenotypes.map((p) => PHENOTYPE_LABEL[p] ?? p).join(', ') : 'ไม่พบ'}
          </dd>
        </div>
      </dl>
      {saved.reportStatus !== 'FINAL' ? (
        <p className="mt-3 text-sm text-amber-800">สถานะรายงาน Preliminary/ไม่ทราบ — บันทึกแล้วแต่ไม่นับในสถิติจนกว่าจะเป็น Final</p>
      ) : (
        <p className="mt-3 text-sm text-slate-700">ข้อมูลนี้เข้าสถิติ Dashboard / Antibiogram ทันที (นับเฉพาะ first isolate ในช่วงเวลาที่เลือก)</p>
      )}
      {old && (
        <p className="mt-1 text-sm text-slate-700">
          วันที่รับตรวจเก่ากว่า 90 วัน — ปรับช่วงเวลาบน Dashboard ให้ครอบคลุมวันที่นี้เพื่อดูผล
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <Link href="/dashboard" className="inline-flex min-h-11 items-center rounded-md bg-sky-700 px-5 font-semibold text-white hover:bg-sky-800">
          ดู Dashboard
        </Link>
        {(role === 'ICN' || role === 'DOCTOR') && (
          <Link
            href={`/consult?isolateId=${encodeURIComponent(saved.id)}`}
            className="inline-flex min-h-11 items-center rounded-md bg-violet-700 px-5 font-semibold text-white hover:bg-violet-800"
          >
            ปรึกษา AI สำหรับเชื้อนี้
          </Link>
        )}
        <Link href="/isolates" className="inline-flex min-h-11 items-center rounded-md border border-slate-300 bg-white px-5">
          รายการ isolate
        </Link>
        <button type="button" onClick={onNew} className="min-h-11 rounded-md border border-slate-300 bg-white px-5">
          บันทึกรายการใหม่
        </button>
      </div>
    </section>
  );
}
