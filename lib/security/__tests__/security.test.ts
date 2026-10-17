import { describe, expect, it } from 'vitest';
import { checkBasicAuth, readAccessConfig, safeEqual } from '../basic-auth';
import { API_CSP, pageCsp } from '../headers';
import { errorSummary } from '../log';
import { FixedWindowLimiter, clientIp, isCrossOriginWrite } from '../request-guards';
import { dashboardQuerySchema, fileQuerySchema, isolateIdSchema, parseQuery } from '../validate';

const basic = (u: string, p: string) => `Basic ${Buffer.from(`${u}:${p}`, 'utf8').toString('base64')}`;
const PW = 'correct-horse-battery';

describe('access gate config', () => {
  it('is off locally without credentials and fails closed on Vercel', () => {
    expect(readAccessConfig({}).mode).toBe('off');
    expect(readAccessConfig({ VERCEL: '1' }).mode).toBe('misconfigured');
  });
  it('fails closed on partial, short or malformed credentials', () => {
    expect(readAccessConfig({ SITE_ACCESS_USER: 'demo' }).mode).toBe('misconfigured');
    expect(readAccessConfig({ SITE_ACCESS_PASSWORD: PW }).mode).toBe('misconfigured');
    expect(readAccessConfig({ SITE_ACCESS_USER: 'demo', SITE_ACCESS_PASSWORD: 'short' }).mode).toBe('misconfigured');
    expect(readAccessConfig({ SITE_ACCESS_USER: 'a:b', SITE_ACCESS_PASSWORD: PW }).mode).toBe('misconfigured');
  });
  it('is on with both values', () => {
    expect(readAccessConfig({ VERCEL: '1', SITE_ACCESS_USER: 'demo', SITE_ACCESS_PASSWORD: PW })).toEqual({
      mode: 'on',
      user: 'demo',
      password: PW,
    });
  });
});

describe('basic auth check', () => {
  it('accepts only the exact pair', () => {
    expect(checkBasicAuth(basic('demo', PW), 'demo', PW)).toBe(true);
    expect(checkBasicAuth(basic('demo', `${PW}x`), 'demo', PW)).toBe(false);
    expect(checkBasicAuth(basic('Demo', PW), 'demo', PW)).toBe(false);
    expect(checkBasicAuth(basic('demo', `a:${PW}`), 'demo', PW)).toBe(false);
  });
  it('rejects missing, malformed and oversized headers', () => {
    expect(checkBasicAuth(null, 'demo', PW)).toBe(false);
    expect(checkBasicAuth('Bearer abc', 'demo', PW)).toBe(false);
    expect(checkBasicAuth('Basic !!!', 'demo', PW)).toBe(false);
    expect(checkBasicAuth(`Basic ${Buffer.from('nocolon').toString('base64')}`, 'demo', PW)).toBe(false);
    expect(checkBasicAuth(`Basic ${'A'.repeat(2000)}`, 'demo', PW)).toBe(false);
  });
  it('safeEqual compares different lengths without throwing', () => {
    expect(safeEqual('a', 'a')).toBe(true);
    expect(safeEqual('a', 'abcdef')).toBe(false);
  });
});

describe('CSRF origin check', () => {
  const h = (o: Record<string, string>) => new Headers(o);
  it('allows same-origin writes and all reads', () => {
    expect(isCrossOriginWrite('POST', h({ host: 'app.example', origin: 'https://app.example' }))).toBe(false);
    expect(isCrossOriginWrite('GET', h({ host: 'app.example', origin: 'https://evil.example' }))).toBe(false);
    expect(isCrossOriginWrite('POST', h({ host: 'app.example', 'sec-fetch-site': 'same-origin' }))).toBe(false);
    expect(isCrossOriginWrite('POST', h({ host: 'app.example' }))).toBe(false); // non-browser client
  });
  it('blocks cross-origin, null-origin and cross-site writes', () => {
    expect(isCrossOriginWrite('POST', h({ host: 'app.example', origin: 'https://evil.example' }))).toBe(true);
    expect(isCrossOriginWrite('DELETE', h({ host: 'app.example', origin: 'null' }))).toBe(true);
    expect(isCrossOriginWrite('POST', h({ host: 'app.example', 'sec-fetch-site': 'cross-site' }))).toBe(true);
    expect(isCrossOriginWrite('PATCH', h({ host: 'app.example', origin: 'https://app.example.evil.example' }))).toBe(true);
  });
});

describe('rate limiter', () => {
  it('allows `limit` hits per window, then blocks until the window resets', () => {
    const l = new FixedWindowLimiter();
    const rule = { limit: 3, windowMs: 1000 };
    const results = [0, 1, 2, 3].map(() => l.take('k', rule, 0).ok);
    expect(results).toEqual([true, true, true, false]);
    expect(l.take('other', rule, 0).ok).toBe(true);
    expect(l.take('k', rule, 1000).ok).toBe(true);
  });
  it('takes the first x-forwarded-for entry', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe('203.0.113.7');
    expect(clientIp(new Headers())).toBe('unknown');
  });
});

describe('CSP', () => {
  it('page policy uses a nonce and the required directives', () => {
    const csp = pageCsp('abc123');
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    for (const d of ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'"]) expect(csp).toContain(d);
    expect(csp).not.toContain('unsafe-eval');
    expect(pageCsp('n', { https: true })).toContain('upgrade-insecure-requests');
    expect(API_CSP).toContain("frame-ancestors 'none'");
  });
});

describe('query validation', () => {
  const ok = (qs: string) => parseQuery(new URLSearchParams(qs), fileQuerySchema).ok;
  it('file names: only server-generated names or the sample', () => {
    expect(ok('name=0123456789abcdef01234567.png')).toBe(true);
    expect(ok('name=sample_report.png')).toBe(true);
    for (const bad of ['name=../package.json', 'name=..%5Cpackage.json', 'name=%2e%2e%2fpackage.json', 'name=0123456789abcdef01234567.html', 'name=0123456789abcdef01234567.png%00', '']) {
      expect(ok(bad)).toBe(false);
    }
  });
  it('rejects unknown keys, repeated keys and bad values; ignores empty values', () => {
    const p = (qs: string) => parseQuery(new URLSearchParams(qs), dashboardQuerySchema).ok;
    expect(p('wardType=ICU&from=2026-01-01&organism=')).toBe(true);
    expect(p('wardType=ICU&wardType=NON_ICU')).toBe(false);
    expect(p('wardType=SQL')).toBe(false);
    expect(p('foo=1')).toBe(false);
  });
  it('isolate ids are UUIDs', () => {
    expect(isolateIdSchema.safeParse('1e61dda5-8b65-4cae-a73d-951961fca440').success).toBe(true);
    expect(isolateIdSchema.safeParse("1' OR '1'='1").success).toBe(false);
  });
});

describe('error summaries', () => {
  it('drop Prisma messages (may contain query arguments) and keep only the first line otherwise', () => {
    class PrismaClientValidationError extends Error {
      name = 'PrismaClientValidationError';
    }
    expect(errorSummary(new PrismaClientValidationError('Invalid invocation { hn: "0000123" }'))).toBe('PrismaClientValidationError');
    expect(errorSummary(new Error('first\nsecond'))).toBe('Error: first');
  });
});
