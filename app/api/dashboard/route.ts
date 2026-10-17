import { NextResponse, type NextRequest } from 'next/server';
import { getDashboardStats } from '@/lib/stats';
import { getRole } from '@/lib/role';
import { parseDashboardFilters } from '@/components/dashboard/params';
import { errorSummary } from '@/lib/security/log';
import { dashboardQuerySchema, parseQuery } from '@/lib/security/validate';

export const dynamic = 'force-dynamic';

// GET /api/dashboard?from&to&wardType&wardId&specimenType&organism
// EXECUTIVE role: HN is stripped inside getDashboardStats (API layer, not just UI).
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = parseQuery(sp, dashboardQuerySchema);
  if (!q.ok) return q.response;
  const filters = parseDashboardFilters((k) => sp.get(k));
  try {
    const role = await getRole();
    const stats = await getDashboardStats(filters, role);
    return NextResponse.json(stats);
  } catch (err) {
    console.error('[api/dashboard] failed:', errorSummary(err));
    return NextResponse.json({ error: 'ไม่สามารถคำนวณสถิติ Dashboard ได้' }, { status: 500 });
  }
}
