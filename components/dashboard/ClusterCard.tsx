'use client';

// MR8 suspected cluster episodes; tap to show the patient list (HN absent for EXECUTIVE).
import { useState } from 'react';
import { PHENOTYPE_LABEL } from './format';
import type { PhenotypeCode } from '@/lib/domain/types';

export interface ClusterRow {
  key: string; organism: string; phenotype: PhenotypeCode | null; wardName: string;
  firstDateTh: string; lastDateTh: string; patientCount: number; isolateCount: number; patients?: string[];
}

export function ClusterCard({ clusters }: { clusters: ClusterRow[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className="rounded-lg border border-amber-300 bg-amber-50 p-3 shadow-sm">
      <h3 className="font-semibold text-amber-900">Suspected cluster (สงสัยกลุ่มก้อน)</h3>
      <p className="text-xs text-amber-800">
        เชื้อ/phenotype เดียวกัน หอเดียวกัน ผู้ป่วยไม่ซ้ำ ≥ 3 ราย ภายใน 14 วัน · ไม่นับ isolate ที่ไม่ทราบหอ · ยังไม่ใช่การประกาศการระบาด
      </p>
      {clusters.length === 0 ? (
        <p className="py-4 text-center text-slate-600">ไม่พบ suspected cluster ในช่วงนี้</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {clusters.map((c) => {
            const isOpen = open === c.key;
            return (
              <li key={c.key} className="rounded-md border border-amber-200 bg-white p-2">
                <button type="button" onClick={() => setOpen(isOpen ? null : c.key)} aria-expanded={isOpen}
                  className="flex min-h-11 w-full flex-wrap items-center gap-x-3 gap-y-1 text-left">
                  <span className="rounded bg-amber-200 px-1.5 py-0.5 text-xs font-bold text-amber-900">suspected</span>
                  <span className="font-semibold">
                    {c.phenotype ? PHENOTYPE_LABEL[c.phenotype] : <i>{c.organism}</i>}
                  </span>
                  <span>· {c.wardName}</span>
                  <span>· ผู้ป่วย <b>{c.patientCount}</b> ราย ({c.isolateCount} isolate)</span>
                  <span className="text-sm text-slate-600">{c.firstDateTh} – {c.lastDateTh}</span>
                  <span className="ml-auto text-sm text-teal-700">{isOpen ? 'ซ่อนรายชื่อ ▲' : 'ดูรายชื่อผู้ป่วย ▼'}</span>
                </button>
                {isOpen && (
                  <div className="mt-2 border-t border-slate-100 pt-2 text-sm">
                    {c.patients && c.patients.length > 0 ? (
                      <ul className="flex flex-wrap gap-2">
                        {c.patients.map((hn) => (
                          <li key={hn} className="rounded bg-slate-100 px-2 py-1 font-mono">HN {hn}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-slate-600">บทบาทนี้ไม่แสดง HN (ตัดที่ชั้น API)</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
