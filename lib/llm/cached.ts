// "cached" provider: deterministic responder supplied by the caller.
// - extraction: returns the fixture JSON when the upload's SHA-256 matches a known sample
// - consult: composes the answer from the CURRENT toolResults using text templates
// The result still goes through the same Zod schema (and, for consult, verify()).
import { LlmError } from './types';

export type CachedResponder = () => unknown | Promise<unknown>;

export async function runCached(responder: CachedResponder | undefined): Promise<unknown> {
  if (!responder) throw new LlmError('CACHED_MISS', 'ไม่มีคำตอบสำรอง (cached) สำหรับคำขอนี้');
  const out = await responder();
  if (out === null || out === undefined) {
    throw new LlmError('CACHED_MISS', 'ไม่มีคำตอบสำรอง (cached) สำหรับคำขอนี้');
  }
  return out;
}
