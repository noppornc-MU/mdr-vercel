'use client';
// Read-only phenotype preview computed by lib/domain (MR2.4 — user cannot pick a phenotype).
import type { PhenotypeResult } from '@/lib/domain/types';
import { J_LABEL, PHENOTYPE_DESC, PHENOTYPE_LABEL } from '@/components/isolates/format';

const RESULT_STYLE: Record<PhenotypeResult['result'], string> = {
  POSITIVE: 'border-red-300 bg-red-50 text-red-800',
  NEGATIVE: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  UNCLASSIFIABLE: 'border-slate-300 bg-slate-100 text-slate-700',
};
const RESULT_TEXT: Record<PhenotypeResult['result'], string> = {
  POSITIVE: 'พบ',
  NEGATIVE: 'ไม่พบ',
  UNCLASSIFIABLE: 'ไม่สามารถจัดกลุ่มได้',
};

export default function PhenotypePreview({ results, ready, error }: { results: PhenotypeResult[]; ready: boolean; error?: boolean }) {
  return (
    <section aria-labelledby="phenotype-preview-title" className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h3 id="phenotype-preview-title" className="font-semibold">
        กลุ่มเชื้อดื้อยา (ระบบคำนวณอัตโนมัติ · อ่านอย่างเดียว)
      </h3>
      <div aria-live="polite" className="mt-2">
        {error ? (
          <p className="text-sm text-red-700">คำนวณกลุ่มเชื้อดื้อยาไม่ได้</p>
        ) : !ready ? (
          <p className="text-sm text-slate-600">เลือกเชื้อและกรอกผล AST เพื่อดูผลการจัดกลุ่ม</p>
        ) : results.length === 0 ? (
          <p className="text-sm text-slate-600">ไม่มีกฎ phenotype สำหรับเชื้อนี้</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {results.map((r) => (
              <li key={r.code} className={`rounded-md border px-3 py-2 text-sm ${RESULT_STYLE[r.result]}`}>
                <span className="font-semibold">{PHENOTYPE_LABEL[r.code] ?? r.code}</span>: {RESULT_TEXT[r.result]}
                <span className="block text-xs opacity-80">{PHENOTYPE_DESC[r.code]}</span>
                {r.result === 'UNCLASSIFIABLE' && r.missingDrugs.length > 0 && (
                  <span className="block text-xs">ขาดผล: {r.missingDrugs.join(', ')}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-600">{J_LABEL} · ผู้ใช้ไม่สามารถเลือก phenotype เองได้</p>
    </section>
  );
}
