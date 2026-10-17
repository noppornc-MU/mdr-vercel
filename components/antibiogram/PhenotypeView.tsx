// Phenotype tab (MR10.3 + MR11): counts per phenotype, then drug cards sorted by %S with 4-tier labels.
import Link from 'next/link';
import type { AbgCell, PhenotypeCode } from '@/lib/domain/types';
import { PHENOTYPE_LABEL, TIER_CLASS, TIER_LABEL, fmtInt, fmtPct } from '@/components/dashboard/format';

export interface PhenotypeCount { code: PhenotypeCode; positive: number; negative: number; unclassifiable: number }

export function PhenotypeView({
  organism, phenotype, counts, drugs, minN, consultHref,
}: {
  organism: string; phenotype?: PhenotypeCode; counts: PhenotypeCount[]; drugs: AbgCell[]; minN: number; consultHref: string;
}) {
  // Only phenotypes whose rule applies to this organism produce results.
  const applicable = counts.filter((c) => c.positive + c.negative + c.unclassifiable > 0);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <div>
          <h2 className="text-lg font-semibold">
            <i>{organism}</i>{phenotype ? ` – ${PHENOTYPE_LABEL[phenotype]}` : ' (ทุก isolate)'}
          </h2>
          {applicable.length > 0 && (
            <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700">
              {applicable.map((c) => (
                <li key={c.code}>
                  <b>{PHENOTYPE_LABEL[c.code]}</b>: ใช่ {fmtInt(c.positive)} · ไม่ใช่ {fmtInt(c.negative)} · ไม่สามารถจัดกลุ่มได้ {fmtInt(c.unclassifiable)}
                </li>
              ))}
            </ul>
          )}
        </div>
        <Link href={consultHref}
          className="inline-flex min-h-11 items-center rounded-md bg-indigo-700 px-4 font-semibold text-white hover:bg-indigo-800 print:hidden">
          ปรึกษา AI ด้วยบริบทนี้ →
        </Link>
      </div>

      {drugs.length === 0 ? (
        <p className="rounded-md border border-slate-200 bg-white p-6 text-center text-slate-600">ไม่มีข้อมูลยาในขอบเขตนี้</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {drugs.map((c) => (
            <li key={c.drug} className={`flex flex-col gap-1 rounded-lg border-l-4 border p-3 ${TIER_CLASS[c.tier]}`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">{c.drug}</span>
                <span className="text-xl font-bold">
                  {c.intrinsic ? 'IR' : c.insufficient ? `n<${minN}` : fmtPct(c.pctS)}
                </span>
              </div>
              <span className="text-sm font-medium">{TIER_LABEL[c.tier]}</span>
              <span className="text-xs">
                n tested = {fmtInt(c.nTested)} · S {c.s} · I {c.i} · R {c.r}{c.sddApplicable ? ` · D ${c.d}` : ''}
                {c.sddApplicable && c.pctSDD !== null ? ` · %SDD ${fmtPct(c.pctSDD)}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-slate-600">
        เกณฑ์: ≥ 90% ข้อมูลท้องถิ่นสนับสนุน · 70–89% พิจารณาประกอบดุลยพินิจ · &lt; 70% ข้อมูลท้องถิ่นไม่สนับสนุน · n &lt; {minN} ข้อมูลน้อย ·
        ไม่แสดงขนาดยา
      </p>
    </div>
  );
}
