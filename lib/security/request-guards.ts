// Request guards used by proxy.ts: CSRF origin check, body-size limits, per-IP rate limit.
import { MAX_UPLOAD_BYTES } from '@/lib/security/limits';

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const firstValue = (v: string | null) => v?.split(',')[0]?.trim().toLowerCase() || null;

/**
 * CSRF defence for state-changing requests: the browser-set Origin must be this host. Without Origin,
 * Fetch Metadata (Sec-Fetch-Site) must not say cross-site / same-site. Requests carrying neither header
 * are not from a modern browser (curl, scripts) and cannot ride a victim's cookies or Basic Auth.
 */
export function isCrossOriginWrite(method: string, headers: Headers): boolean {
  if (!STATE_CHANGING.has(method.toUpperCase())) return false;
  const host = firstValue(headers.get('x-forwarded-host')) ?? firstValue(headers.get('host'));
  const origin = headers.get('origin');
  if (origin !== null) {
    if (!host) return true;
    try {
      return new URL(origin).host.toLowerCase() !== host;
    } catch {
      return true; // "null" (sandboxed / opaque origins) or garbage
    }
  }
  const site = headers.get('sec-fetch-site');
  return site !== null && site !== 'same-origin' && site !== 'none';
}

/** Largest accepted request body: uploads get the 10 MB file limit + multipart overhead, everything else 1 MB. */
export function maxBodyBytes(pathname: string): number {
  return pathname === '/api/extract' ? MAX_UPLOAD_BYTES + 512 * 1024 : 1024 * 1024;
}

// ---------- rate limit ----------
export interface RateRule {
  limit: number;
  windowMs: number;
}

/** Per-IP limits for the expensive endpoints (POST only). */
export const RATE_RULES: Readonly<Record<string, RateRule>> = {
  '/api/seed': { limit: 5, windowMs: 60_000 },
  '/api/extract': { limit: 20, windowMs: 60_000 },
  '/api/consult': { limit: 20, windowMs: 60_000 },
};

/**
 * Fixed-window counter kept in process memory. Weak on serverless: every Vercel function instance has its
 * own counters and they reset on cold start, so this only slows down a single client hammering one
 * instance. A shared store (e.g. Upstash Redis) or Vercel Firewall rate-limit rules are needed for more.
 */
export class FixedWindowLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();
  constructor(private readonly maxKeys = 10_000) {}

  take(key: string, rule: RateRule, now = Date.now()): { ok: boolean; retryAfterSec: number } {
    let entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      if (this.hits.size >= this.maxKeys) this.prune(now);
      entry = { count: 0, resetAt: now + rule.windowMs };
      this.hits.set(key, entry);
    }
    entry.count += 1;
    return { ok: entry.count <= rule.limit, retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
  }

  private prune(now: number) {
    for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
    if (this.hits.size >= this.maxKeys) this.hits.clear();
  }
}

/** Client IP for rate limiting. On Vercel x-forwarded-for is overwritten by the platform (not spoofable). */
export function clientIp(headers: Headers): string {
  const ip = firstValue(headers.get('x-forwarded-for')) ?? firstValue(headers.get('x-real-ip'));
  return ip ? ip.slice(0, 64) : 'unknown';
}
