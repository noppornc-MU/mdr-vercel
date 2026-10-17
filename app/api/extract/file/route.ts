// GET /api/extract/file?name=<file> — serves an uploaded report (UPLOAD_DIR, same place /api/extract writes)
// or the synthetic sample (fixtures/).
// Only file names produced by /api/extract are accepted (Zod allow-list → no path traversal).
// Served with an explicit Content-Type, nosniff and a sandbox CSP; PDFs are sent as attachments.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { FIXTURES_DIR, SAMPLE_FILE } from '@/lib/extract/cached';
import { UPLOAD_DIR } from '@/lib/extract/run';
import { FILE_CSP } from '@/lib/security/headers';
import { fileQuerySchema, parseQuery } from '@/lib/security/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', pdf: 'application/pdf' };

export async function GET(request: Request) {
  const q = parseQuery(new URL(request.url).searchParams, fileQuerySchema);
  if (!q.ok) return q.response;
  const name = q.data.name;
  const full = name === SAMPLE_FILE ? path.join(FIXTURES_DIR, SAMPLE_FILE) : path.join(UPLOAD_DIR, name);
  const ext = name.slice(name.lastIndexOf('.') + 1);
  try {
    const buf = await fs.readFile(full);
    return new Response(new Uint8Array(buf), {
      headers: {
        'content-type': TYPES[ext],
        'cache-control': 'private, max-age=300',
        'x-content-type-options': 'nosniff',
        'content-security-policy': FILE_CSP,
        // Server-generated name only (never the uploader's file name).
        'content-disposition': ext === 'pdf' ? `attachment; filename="${name}"` : 'inline',
      },
    });
  } catch {
    return new Response('not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
}
