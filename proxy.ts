import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { API_CSP, SECURITY_HEADERS, pageCsp } from '@/lib/security/headers';
import { FixedWindowLimiter, RATE_RULES, clientIp, isCrossOriginWrite, maxBodyBytes } from '@/lib/security/request-guards';

const limiter = new FixedWindowLimiter();

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

  // 2. CSRF: browsers attach cookies and cached Basic Auth credentials to cross-site requests.
  if (isCrossOriginWrite(method, request.headers)) {
    return deny(403, 'cross-origin request blocked');
  }

  // 3. Body size (Content-Length)
  const len = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(len) && len > maxBodyBytes(pathname)) {
    return deny(413, 'request body too large');
  }

  // 4. Rate limit
  const rule = method === 'POST' ? RATE_RULES[pathname] : undefined;
  if (rule) {
    const r = limiter.take(`${pathname}|${clientIp(request.headers)}`, rule);
    if (!r.ok) return deny(429, 'too many requests', { 'retry-after': String(r.retryAfterSec) });
  }

  // 5. Pass through.
  if (isApi) {
    const res = NextResponse.next();
    if (pathname !== '/api/extract/file') res.headers.set('content-security-policy', API_CSP);
    return res;
  }
  const nonce = randomBytes(16).toString('base64');
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ?? request.nextUrl.protocol.replace(':', '');
  const csp = pageCsp(nonce, { dev: process.env.NODE_ENV === 'development', https: proto === 'https' });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set('content-security-policy', csp);
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};
