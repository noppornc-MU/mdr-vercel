// In-app HTTP Basic Auth gate (defence in depth behind Vercel Authentication). Used by proxy.ts.
// Credentials come only from env vars SITE_ACCESS_USER / SITE_ACCESS_PASSWORD (Vercel: mark them Sensitive).
import { createHash, timingSafeEqual } from 'node:crypto';

export const MIN_PASSWORD_LENGTH = 12;
const MAX_AUTH_HEADER = 1024;

export type AccessConfig =
  | { mode: 'off' } // local run without credentials: gate disabled
  | { mode: 'on'; user: string; password: string }
  | { mode: 'misconfigured'; reason: string }; // fail closed → 503

/** Decide how the gate behaves from the environment. On Vercel (`VERCEL` set) missing credentials fail closed. */
export function readAccessConfig(env: Record<string, string | undefined>): AccessConfig {
  const user = env.SITE_ACCESS_USER ?? '';
  const password = env.SITE_ACCESS_PASSWORD ?? '';
  if (!user && !password) {
    return env.VERCEL
      ? { mode: 'misconfigured', reason: 'SITE_ACCESS_USER / SITE_ACCESS_PASSWORD are not set on Vercel' }
      : { mode: 'off' };
  }
  if (!user || !password) return { mode: 'misconfigured', reason: 'only one of SITE_ACCESS_USER / SITE_ACCESS_PASSWORD is set' };
  if (user.includes(':')) return { mode: 'misconfigured', reason: 'SITE_ACCESS_USER must not contain ":"' };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { mode: 'misconfigured', reason: `SITE_ACCESS_PASSWORD is shorter than ${MIN_PASSWORD_LENGTH} characters` };
  }
  return { mode: 'on', user, password };
}

const digest = (s: string) => createHash('sha256').update(s, 'utf8').digest();

/** Constant-time string comparison (fixed-length SHA-256 digests, so length differences do not leak). */
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(digest(a), digest(b));
}

/** True only for `Authorization: Basic base64(user:password)` matching the configured pair. */
export function checkBasicAuth(header: string | null | undefined, user: string, password: string): boolean {
  if (!header || header.length > MAX_AUTH_HEADER) return false;
  const m = /^Basic[ \t]+([A-Za-z0-9+/]+={0,2})[ \t]*$/i.exec(header);
  if (!m) return false;
  const decoded = Buffer.from(m[1], 'base64').toString('utf8');
  const i = decoded.indexOf(':');
  if (i < 0) return false;
  // Evaluate both comparisons before combining so timing does not reveal which part was wrong.
  const userOk = safeEqual(decoded.slice(0, i), user);
  const passOk = safeEqual(decoded.slice(i + 1), password);
  return userOk && passOk;
}

export const BASIC_AUTH_CHALLENGE = 'Basic realm="IC MDR Demo", charset="UTF-8"';
