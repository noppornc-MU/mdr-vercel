// Overview tab (MR9): rows = drugs, columns = organisms, cell = "%S (n)" + %SDD where applicable.
// Colour is never the only signal: every cell shows its number or "n<N" / "IR".
import type { AbgCell } from '@/lib/domain/types';
import { fmtPct, pctCellClass } from '@/components/dashboard/format';

export function AbgMatrix({
  organisms, drugs, cells, minN,
}: { organisms: { name: string; n: number }[]; drugs: string[]; cells: AbgCell[]; minN: number }) {
  const byKey = new Map(cells.map((c) => [`${c.organism}|${c.drug}`, c]));
  const rows = drugs.filter((d) => organisms.some((o) => byKey.has(`${o.name}|${d}`)));

  if (organisms.length === 0) {
    return <p className="rounded-md border border-slate-200 bg-white p-6 text-center text-slate-600">ไม่มีข้อมูลในขอบเขตนี้</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-100">
            <th className="sticky left-0 z-10 bg-slate-100 px-2 py-2 text-left">ยา \ เชื้อ</th>
            {organisms.map((o) => (
              <th key={o.name} className="min-w-28 px-2 py-2 text-center align-bottom">
                <span className="block italic">{o.name}</span>
                <span className="block text-xs font-normal text-slate-600">(ผู้ป่วย n={o.n})</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((drug) => (
            <tr key={drug} className="border-t border-slate-200">
              <th scope="row" className="sticky left-0 z-10 whitespace-nowrap bg-white px-2 py-1.5 text-left font-medium">{drug}</th>
              {organisms.map((o) => {
                const c = byKey.get(`${o.name}|${drug}`);
                if (!c) return <td key={o.name} className="px-2 py-1.5 text-center text-slate-400">—</td>;
                const title = `${o.name} × ${drug}: S=${c.s} I=${c.i} R=${c.r} D=${c.d} (tested ${c.nTested})`;
                return (
                  <td key={o.name} title={title} className={`px-2 py-1.5 text-center ${pctCellClass(c.pctS, c.insufficient, c.intrinsic)}`}>
                    {c.intrinsic ? (
                      <span className="font-semibold">IR</span>
                    ) : c.insufficient ? (
                      <span><span className="font-semibold">n&lt;{minN}</span> <span className="text-xs">(n={c.nTested})</span></span>
                    ) : (
                      <span><span className="font-semibold">{fmtPct(c.pctS)}</span> <span className="text-xs">({c.nTested})</span></span>
                    )}
                    {c.sddApplicable && !c.intrinsic && !c.insufficient && c.pctSDD !== null && (
                      <span className="block text-xs">SDD {fmtPct(c.pctSDD)}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AbgLegend({ minN }: { minN: number }) {
  const items: [string, string][] = [
    ['bg-green-100 text-green-900', '≥ 90%'],
    ['bg-yellow-100 text-yellow-900', '70–89%'],
    ['bg-orange-100 text-orange-900', '50–69%'],
    ['bg-red-100 text-red-900', '< 50%'],
    ['bg-slate-100 text-slate-600', `n<${minN} ข้อมูลไม่พอ`],
    ['bg-slate-200 text-slate-600', 'IR = ดื้อโดยธรรมชาติ [J]'],
  ];
  return (
    <ul className="flex flex-wrap gap-2 text-xs" aria-label="คำอธิบายสี">
      {items.map(([cls, label]) => (
        <li key={label} className={`rounded px-2 py-1 ${cls}`}>{label}</li>
      ))}
      <li className="px-2 py-1 text-slate-600">ช่อง = %S (n tested) · SDD = %SDD เฉพาะคู่ใน sdd_allowed [J] · — = ไม่ได้ทดสอบ</li>
    </ul>
  );
}
