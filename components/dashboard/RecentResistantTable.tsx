// MR7.2 "เชื้อดื้อยาล่าสุด" (newest first). HN column only rendered when the API returned HN
// (EXECUTIVE responses have no hn field at all).
import { PHENOTYPE_LABEL, thaiDate } from './format';
import type { DashboardStatsView } from './types';

export function RecentResistantTable({ rows }: { rows: DashboardStatsView['recentResistant'] }) {
  const showHn = rows.some((r) => r.hn);
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <h3 className="font-semibold text-slate-800">เชื้อดื้อยาล่าสุด</h3>
      <p className="text-xs text-slate-500">เรียงใหม่ → เก่า · phenotype คำนวณจากกฎฉบับร่าง [J]</p>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-slate-500">ไม่มีเชื้อดื้อยาในช่วงนี้</p>
      ) : (
        <div className="mt-2 max-h-96 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-100 text-left text-slate-700">
              <tr>
                <th className="px-2 py-2">วันที่</th>
                <th className="px-2 py-2">รหัส</th>
                {showHn && <th className="px-2 py-2">HN</th>}
                <th className="px-2 py-2">หอผู้ป่วย</th>
                <th className="px-2 py-2">เชื้อ</th>
                <th className="px-2 py-2">Phenotype</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="whitespace-nowrap px-2 py-2">{thaiDate(r.date)}</td>
                  <td className="whitespace-nowrap px-2 py-2 font-mono text-xs">{r.code}</td>
                  {showHn && <td className="px-2 py-2 font-mono">{r.hn ?? '—'}</td>}
                  <td className="px-2 py-2">{r.ward ?? 'ไม่ทราบหอ'}</td>
                  <td className="px-2 py-2 italic">{r.organism}</td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-1">
                      {r.phenotypes.map((p) => (
                        <span key={p} className="rounded border border-red-300 bg-red-50 px-1.5 py-0.5 text-xs font-semibold text-red-800">
                          {PHENOTYPE_LABEL[p] ?? p}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
