// EXTRACT_MODE=cached: map known sample files (by SHA-256) to pre-recorded extraction JSON.
// To swap in a masked real sample: add {file, expected} below (or replace the fixture files);
// the hash is computed from the file at runtime, so no hard-coded hash needs updating.
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const FIXTURES_DIR = path.join(process.cwd(), 'fixtures');
export const SAMPLE_FILE = 'sample_report.png';

const CACHED_SAMPLES: { file: string; expected: string }[] = [
  { file: SAMPLE_FILE, expected: 'sample_report.expected.json' },
];

export function sha256(buf: Uint8Array): string {
  return createHash('sha256').update(buf).digest('hex');
}

let hashCache: Map<string, string> | null = null; // sha256 → expected json file

async function sampleHashes(): Promise<Map<string, string>> {
  if (hashCache) return hashCache;
  const m = new Map<string, string>();
  for (const s of CACHED_SAMPLES) {
    try {
      const buf = await fs.readFile(path.join(FIXTURES_DIR, s.file));
      m.set(sha256(buf), s.expected);
    } catch {
      /* fixture missing — skip */
    }
  }
  hashCache = m;
  return m;
}

/** Returns the recorded raw extraction for a known sample, or null. */
export async function lookupCachedExtraction(hash: string): Promise<unknown | null> {
  const expected = (await sampleHashes()).get(hash);
  if (!expected) return null;
  const text = await fs.readFile(path.join(FIXTURES_DIR, expected), 'utf8');
  return JSON.parse(text);
}

export async function readSampleFile(): Promise<Buffer> {
  return fs.readFile(path.join(FIXTURES_DIR, SAMPLE_FILE));
}
