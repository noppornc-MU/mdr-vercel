// POST /api/extract — multipart `file` (png/jpg/pdf ≤ 10 MB) or JSON {useSample: true}
// → 200 {mode, provider, fileUrl, fileName, mimeType, sha256, input: IsolateInput, flags: Flag[], raw}
// → 4xx/5xx {error, code, fallback: 'MANUAL', fileUrl?}  (UI shows the message and offers "กรอกเอง")
// File type is decided by magic bytes in lib/extract/run.ts (extension/MIME from the client are not trusted).
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ExtractError, MAX_UPLOAD_BYTES, extractFile, extractSample } from '@/lib/extract/run';
import { errorSummary } from '@/lib/security/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SampleBodySchema = z.object({ useSample: z.literal(true) }).strict();
const UploadFormSchema = z
  .object({
    file: z.custom<File>(
      (v) => typeof v === 'object' && v !== null && typeof (v as File).arrayBuffer === 'function' && typeof (v as File).size === 'number',
    ),
  })
  .strict();

function fail(status: number, code: string, error: string, fileUrl: string | null = null) {
  return NextResponse.json({ error, code, fallback: 'MANUAL', fileUrl }, { status });
}

export async function POST(request: Request) {
  try {
    const ctype = request.headers.get('content-type') ?? '';
    if (ctype.includes('application/json')) {
      const body = await request.json().catch(() => null);
      if (!SampleBodySchema.safeParse(body).success) return fail(400, 'BAD_REQUEST', 'ต้องส่งไฟล์ หรือ {useSample: true}');
      return NextResponse.json(await extractSample());
    }
    if (!ctype.includes('multipart/form-data')) return fail(415, 'BAD_REQUEST', 'ต้องส่งเป็น multipart/form-data');
    const declared = Number(request.headers.get('content-length') ?? '0');
    if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES + 512 * 1024) return fail(413, 'TOO_LARGE', 'ไฟล์ใหญ่เกิน 10 MB');
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return fail(400, 'BAD_REQUEST', 'อ่านข้อมูลที่อัปโหลดไม่ได้ (multipart ไม่ถูกต้องหรือไฟล์ใหญ่เกิน 10 MB)');
    }
    const parsed = UploadFormSchema.safeParse(Object.fromEntries(form.entries()));
    if (!parsed.success || [...form.keys()].length !== 1) return fail(400, 'NO_FILE', 'ไม่พบไฟล์ (field "file")');
    const file = parsed.data.file;
    const name = file.name?.toLowerCase() ?? '';
    if (name && !/\.(png|jpe?g|pdf)$/.test(name)) return fail(415, 'BAD_TYPE', 'รองรับเฉพาะไฟล์ .png .jpg .jpeg .pdf');
    if (file.size > MAX_UPLOAD_BYTES) return fail(413, 'TOO_LARGE', 'ไฟล์ใหญ่เกิน 10 MB');
    const buf = new Uint8Array(await file.arrayBuffer());
    return NextResponse.json(await extractFile({ buf }));
  } catch (e) {
    if (e instanceof ExtractError) return fail(e.status, e.code, e.message, e.fileUrl);
    console.error('extract failed:', errorSummary(e));
    return fail(500, 'INTERNAL', 'อ่านใบผลไม่สำเร็จ — กรุณากรอกเอง');
  }
}
