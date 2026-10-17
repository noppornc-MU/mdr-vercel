// Next.js 16 request interceptor (formerly middleware.ts; runs on the Node.js runtime). SECURITY.md §1–§4.
// Order: access gate (Basic Auth, fail closed on Vercel) → CSRF origin check → body-size limit
// → per-IP rate limit → pass through with a per-request CSP nonce (pages) or the API CSP.
// Static build assets (_next/static, _next/image, favicon) are excluded by the matcher; they contain no data
// and are still behind Vercel Authentication.
import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { BASIC_AUTH_CHALLENGE, checkBasicAuth, readAccessConfig } from '@/lib/security/basic-auth';
import { API_CSP, SECURITY_HEADERS, pageCsp } from '@/lib/security/headers';
import { FixedWindowLimiter, RATE_RULES, clientIp, isCrossOriginWrite, maxBodyBytes } from '@/lib/security/request-guards';

const limiter = new FixedWindowLimiter();
let warnedMisconfig = false;

function safeDecode(p: string): string {
  try {
    return decodeURIComponent(p);
  } catch {
    return p;
  }
}

/** Plain responses produced by the proxy itself carry the full header set and are never cached. */
function deny(status: number, body: string, extra: Record<string, string> = {}): NextResponse {
  const res = new NextResponse(body, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', ...extra },
  });
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.headers.set(k, v);
  res.headers.set('content-security-policy', API_CSP);
  return res;
}

export function proxy(request: NextRequest) {
  const pathname = safeDecode(request.nextUrl.pathname).replace(/\/+$/, '') || '/';
  const isApi = pathname === '/api' || pathname.startsWith('/api/');
  const method = request.method.toUpperCase();

  // 1. Access gate.
  const access = readAccessConfig(process.env);
  if (access.mode === 'misconfigured') {
    if (!warnedMisconfig) {
      console.error(`[proxy] access gate misconfigured (${access.reason}); every request gets 503`);
      warnedMisconfig = true;
    }
    return deny(503, 'access not configured');
  }
  if (access.mode === 'on' && !checkBasicAuth(request.headers.get('authorization'), access.user, access.password)) {
    return deny(401, 'authentication required', { 'www-authenticate': BASIC_AUTH_CHALLENGE });
  }

  // 2. CSRF: browsers attach cookies and cached Basic Auth credentials to cross-site requests.
  if (isCrossOriginWrite(method, request.headers)) {
    return deny(403, 'cross-origin request blocked');
  }

  // 3. Body size (Content-Length; chunked bodies are capped by proxyClientMaxBodySize + handler checks).
  const len = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(len) && len > maxBodyBytes(pathname)) {
    return deny(413, 'request body too large');
  }

  // 4. Rate limit (POST to the expensive endpoints).
  const rule = method === 'POST' ? RATE_RULES[pathname] : undefined;
  if (rule) {
    const r = limiter.take(`${pathname}|${clientIp(request.headers)}`, rule);
    if (!r.ok) return deny(429, 'too many requests', { 'retry-after': String(r.retryAfterSec) });
  }

  // 5. Pass through.
  if (isApi) {
    const res = NextResponse.next();
    // /api/extract/file sets its own sandbox CSP for served files.
    if (pathname !== '/api/extract/file') res.headers.set('content-security-policy', API_CSP);
    return res;
  }
  const nonce = randomBytes(16).toString('base64');
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ?? request.nextUrl.protocol.replace(':', '');
  const csp = pageCsp(nonce, { dev: process.env.NODE_ENV === 'development', https: proto === 'https' });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp); // Next.js reads the nonce from here during SSR
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set('content-security-policy', csp);
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};
