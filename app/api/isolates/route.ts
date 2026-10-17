// GET /api/isolates — list (HN stripped for EXECUTIVE) · POST /api/isolates — create DRAFT (ICN only)
import { NextResponse } from 'next/server';
import { getRole } from '@/lib/role';
import type { IsolateInput } from '@/lib/domain/types';
import {
  createBodySchema,
  createIsolate,
  isolateErrorResponse,
  listIsolates,
  parseListFilter,
} from '@/lib/isolates';
import { isolatesQuerySchema, parseQuery } from '@/lib/security/validate';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const q = parseQuery(sp, isolatesQuerySchema);
  if (!q.ok) return q.response;
  try {
    const role = await getRole();
    const filter = parseListFilter(sp);
    return NextResponse.json(await listIsolates(filter, role));
  } catch (e) {
    return isolateErrorResponse(e);
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'รูปแบบข้อมูลไม่ถูกต้อง (ต้องเป็น JSON)' }, { status: 400 });
  }
  const parsed = createBodySchema.safeParse(body);
  if (!parsed.success) {
    const flags = parsed.error.issues.map((i) => ({ path: i.path.join('.'), reason: i.message }));
    return NextResponse.json({ error: 'รูปแบบข้อมูลไม่ถูกต้อง', flags }, { status: 400 });
  }
  try {
    const role = await getRole();
    const result = await createIsolate(parsed.data.input as IsolateInput, role, {
      confirmDuplicate: parsed.data.confirmDuplicate,
    });
    if ('duplicate' in result) {
      return NextResponse.json({ error: 'พบข้อมูลที่อาจซ้ำ', duplicate: result.duplicate }, { status: 409 });
    }
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return isolateErrorResponse(e);
  }
}
