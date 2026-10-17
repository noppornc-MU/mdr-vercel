// POST /api/seed — "โหลดข้อมูลสาธิต" (MR4.1): resets ALL isolates and reloads the synthetic data set.
// Demo-only endpoint (no real auth): restricted to the ICN demo role.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getRole } from '@/lib/role';
import { seedDatabase } from '@/lib/seed/apply';
import { errorSummary } from '@/lib/security/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Vercel function limit for this route (seconds). A full reseed is ~1.5–3.5 s against local Postgres
// (~10 s on a cold first request); 60 s stays within every plan's limit (fluid compute: Hobby max 300 s).
export const maxDuration = 60;

export async function POST() {
  const role = await getRole();
  if (role !== 'ICN') {
    return NextResponse.json({ ok: false, error: 'เฉพาะบทบาท ICN เท่านั้นที่โหลดข้อมูลสาธิตได้' }, { status: 403 });
  }
  try {
    const res = await seedDatabase(prisma);
    return NextResponse.json(res);
  } catch (err) {
    console.error('seed failed:', errorSummary(err));
    return NextResponse.json({ ok: false, error: 'โหลดข้อมูลสาธิตไม่สำเร็จ' }, { status: 500 });
  }
}
