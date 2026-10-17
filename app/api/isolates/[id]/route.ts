// DELETE /api/isolates/[id] — ICN only
import { NextResponse } from 'next/server';
import { getRole } from '@/lib/role';
import { deleteIsolate, isolateErrorResponse } from '@/lib/isolates';
import { badRequest, isolateIdSchema } from '@/lib/security/validate';

export const dynamic = 'force-dynamic';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const parsed = isolateIdSchema.safeParse((await params).id);
    if (!parsed.success) return badRequest('รหัส isolate ไม่ถูกต้อง');
    const role = await getRole();
    return NextResponse.json(await deleteIsolate(parsed.data, role));
  } catch (e) {
    return isolateErrorResponse(e);
  }
}
