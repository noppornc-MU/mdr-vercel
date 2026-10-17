// POST /api/consult — AI Consult (MR13–MR15). Body:
// { organism?, phenotype?, wardId?, wardType?, specimenType?, site?, question?, isolateId?, minN?, formula? }
// → { ok, answer|null, verify: {passed, errors[]}, toolResults, retried, mode, model, context, widen, error? }
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getRole } from '@/lib/role';
import { ConsultError, runConsult } from '@/lib/consult/run';
import { errorSummary } from '@/lib/security/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'รูปแบบคำขอไม่ถูกต้อง (ต้องเป็น JSON)' }, { status: 400 });
  }
  try {
    const role = await getRole();
    const res = await runConsult(body, role);
    return NextResponse.json(res, { status: 200 });
  } catch (e) {
    if (e instanceof ConsultError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    if (e instanceof ZodError) return NextResponse.json({ ok: false, error: 'ข้อมูลบริบทไม่ถูกต้อง' }, { status: 400 });
    console.error('consult failed:', errorSummary(e));
    return NextResponse.json({ ok: false, error: 'ระบบ AI Consult ขัดข้อง — ส่วนอื่นของระบบยังใช้งานได้' }, { status: 500 });
  }
}
