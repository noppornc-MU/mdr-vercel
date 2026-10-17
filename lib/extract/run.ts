// Server-side extraction pipeline (MR1): validate file → save to UPLOAD_DIR → cached fixture or live LLM
// → Zod → normalize (aliases, BE/CE, validators) → {input, flags}.
import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { prisma } from '@/lib/db';
import { MAX_UPLOAD_BYTES } from '@/lib/security/limits';
import { getConfig } from '@/lib/config';
import { toIsoDateInTz } from '@/lib/domain/dates';
import type { DomainOrganism, Flag, IsolateInput } from '@/lib/domain/types';
import { generateJsonWithMeta, LlmError, resolveProvider } from '@/lib/llm';
import { lookupCachedExtraction, readSampleFile, SAMPLE_FILE, sha256 } from './cached';
import { normalizeExtraction, type NormalizeContext } from './normalize';
import { EXTRACTION_SYSTEM_PROMPT, EXTRACTION_USER_PROMPT } from './prompt';
import { ExtractionSchema, type Extraction } from './schema';

export { MAX_UPLOAD_BYTES };
/**
 * Where uploaded reports are written (and served from by /api/extract/file).
 * `UPLOAD_DIR` env overrides; on Vercel (read-only filesystem except /tmp) the default is a folder in
 * os.tmpdir() — ephemeral, per function instance; locally the default stays ./uploads.
 */
export const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : process.env.VERCEL
    ? path.join(os.tmpdir(), 'mdr-uploads')
    : path.join(process.cwd(), 'uploads');

export class ExtractError extends Error {
  status: number;
  code: string;
  fileUrl: string | null;
  constructor(status: number, code: string, message: string, fileUrl: string | null = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.fileUrl = fileUrl;
  }
}

/** Detect file type from magic bytes (do not trust the client's MIME type). */
export function sniffType(buf: Uint8Array): { mimeType: string; ext: string } | null {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { mimeType: 'image/png', ext: 'png' };
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mimeType: 'image/jpeg', ext: 'jpg' };
  if (buf.length >= 5 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46 && buf[4] === 0x2d) return { mimeType: 'application/pdf', ext: 'pdf' };
  return null;
}

export const fileUrlFor = (name: string) => `/api/extract/file?name=${encodeURIComponent(name)}`;

const parseList = (s: string | null | undefined): string[] => {
  try {
    const v = JSON.parse(s ?? '[]');
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
};

export async function loadNormalizeContext(sourceFile: string | null): Promise<NormalizeContext> {
  const [organisms, drugs, wards] = await Promise.all([
    prisma.organism.findMany(),
    prisma.drug.findMany(),
    prisma.ward.findMany(),
  ]);
  const cfg = getConfig();
  return {
    organisms: organisms.map((o) => ({
      id: o.id,
      name: o.name,
      orgClass: o.orgClass as DomainOrganism['orgClass'],
      group: o.group as DomainOrganism['group'],
      aliases: parseList(o.aliases),
    })),
    drugs: drugs.map((d) => ({ id: d.id, name: d.name, aliases: parseList(d.aliases) })),
    wardIds: wards.map((w) => w.id),
    sddAllowed: cfg.sddAllowed,
    aliases: cfg.aliases,
    today: toIsoDateInTz(new Date()),
    sourceFile,
  };
}

export interface ExtractResponse {
  mode: 'live' | 'cached';
  provider: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  sha256: string;
  input: IsolateInput;
  flags: Flag[];
  raw: Extraction;
}

export async function extractFile(args: { buf: Uint8Array; useSample?: boolean }): Promise<ExtractResponse> {
  const buf = args.buf;
  if (buf.length === 0) throw new ExtractError(400, 'EMPTY', 'ไฟล์ว่าง');
  if (buf.length > MAX_UPLOAD_BYTES) throw new ExtractError(413, 'TOO_LARGE', 'ไฟล์ใหญ่เกิน 10 MB');
  const type = sniffType(buf);
  if (!type) throw new ExtractError(415, 'BAD_TYPE', 'รองรับเฉพาะไฟล์ .png .jpg .jpeg .pdf');

  const hash = sha256(buf);
  let fileName: string;
  if (args.useSample) {
    fileName = SAMPLE_FILE; // served from fixtures/
  } else {
    // Random server-side name (never the client's file name; not derivable from the content either).
    // The extension comes from the sniffed magic bytes, not from the upload.
    fileName = `${randomBytes(12).toString('hex')}.${type.ext}`;
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.writeFile(path.join(UPLOAD_DIR, fileName), buf, { flag: 'wx' });
  }
  const fileUrl = fileUrlFor(fileName);

  const resolved = resolveProvider('extract');
  let raw: Extraction;
  let provider: string = resolved.name;
  try {
    const gen = await generateJsonWithMeta<Extraction>({
      task: 'extract',
      system: EXTRACTION_SYSTEM_PROMPT,
      user: EXTRACTION_USER_PROMPT,
      image: { data: buf, mimeType: type.mimeType },
      schema: ExtractionSchema,
      cached: () => lookupCachedExtraction(hash),
    });
    raw = gen.data;
    provider = `${gen.provider}:${gen.model}`;
  } catch (e) {
    if (e instanceof LlmError && e.code === 'CACHED_MISS') {
      throw new ExtractError(
        422,
        'CACHED_NO_MATCH',
        'โหมดสาธิต (cached) อ่านได้เฉพาะใบตัวอย่าง — กรุณากด “ใช้ใบตัวอย่าง” หรือกรอกเอง',
        fileUrl,
      );
    }
    const msg = e instanceof LlmError ? e.message : 'อ่านใบผลไม่สำเร็จ';
    throw new ExtractError(502, 'LLM_FAILED', `${msg} — กรุณากรอกเอง`, fileUrl);
  }

  const ctx = await loadNormalizeContext(fileName);
  const { input, flags } = normalizeExtraction(raw, ctx);
  return { mode: resolved.mode, provider, fileUrl, fileName, mimeType: type.mimeType, sha256: hash, input, flags, raw };
}

export async function extractSample(): Promise<ExtractResponse> {
  const buf = await readSampleFile();
  return extractFile({ buf: new Uint8Array(buf), useSample: true });
}
