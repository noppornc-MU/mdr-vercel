import { NextResponse, type NextRequest } from 'next/server';
import { getAntibiogram } from '@/lib/stats/antibiogram';
import { getPhenotypeBreakdown } from '@/lib/stats/phenotype';
import { parseAbgParams } from '@/components/antibiogram/params';
import { errorSummary } from '@/lib/security/log';
import { antibiogramQuerySchema, parseQuery } from '@/lib/security/validate';

export const dynamic = 'force-dynamic';

// GET /api/antibiogram?from&to&wardId&wardType&specimenType&organism&phenotype&minN&formula&view=overview|phenotype
// Numbers come only from lib/stats → lib/domain (same functions used by AI Consult).
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = parseQuery(sp, antibiogramQuerySchema);
  if (!q.ok) return q.response;
  const { view, scope } = parseAbgParams((k) => sp.get(k));
  try {
    const result = view === 'phenotype' ? await getPhenotypeBreakdown(scope) : await getAntibiogram(scope);
    return NextResponse.json({ view, ...result });
  } catch (err) {
    console.error('[api/antibiogram] failed:', errorSummary(err));
    return NextResponse.json({ error: 'ไม่สามารถคำนวณ Antibiogram ได้' }, { status: 500 });
  }
}
