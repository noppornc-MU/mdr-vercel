// POST /api/isolates/[id]/approve — ICN only; blocked while flags / required fields remain
import { NextResponse } from 'next/server';
import { getRole } from '@/lib/role';
import { approveIsolate, isolateErrorResponse } from '@/lib/isolates';
import { badRequest, isolateIdSchema } from '@/lib/security/validate';

export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const parsed = isolateIdSchema.safeParse((await params).id);
    if (!parsed.success) return badRequest('รหัส isolate ไม่ถูกต้อง');
    const role = await getRole();
    return NextResponse.json(await approveIsolate(parsed.data, role));
  } catch (e) {
    return isolateErrorResponse(e);
  }
}
