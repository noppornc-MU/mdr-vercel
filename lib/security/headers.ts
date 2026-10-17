// Security response headers + Content-Security-Policy builders (SECURITY.md §2).
// Pure module (no Next/Node imports) so next.config.ts, proxy.ts and tests can all use it.

/** Sent on every response (pages, API, static assets) via next.config.ts headers() and proxy.ts. */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  // Browsers ignore HSTS over plain http, so this is safe for localhost; *.vercel.app is HTTPS-only anyway.
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  // Legacy clickjacking header for old browsers; CSP frame-ancestors is authoritative.
  'X-Frame-Options': 'DENY',
};

/**
 * CSP for HTML pages. Scripts: per-request nonce + 'strict-dynamic' (Next.js reads the nonce from the
 * request's CSP header and stamps it on its own <script> tags). Styles need 'unsafe-inline' because React
 * renders style={{…}} props (Recharts, DashboardCharts, OriginalViewer zoom) as inline style attributes,
 * which a nonce cannot cover; a nonce in style-src would also make browsers ignore 'unsafe-inline'.
 */
export function pageCsp(nonce: string, opts: { dev?: boolean; https?: boolean } = {}): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${opts.dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // Only over HTTPS: on http://localhost it would rewrite same-origin asset URLs to https and break the page.
    ...(opts.https ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

/** CSP for JSON / plain-text API responses: nothing may load, nothing may frame them. */
export const API_CSP = "default-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

/**
 * CSP for uploaded files served by /api/extract/file: sandboxed (no script, no same-origin access) and
 * framable only by this site. PDFs are additionally sent as attachments (Chrome does not render PDFs
 * under a sandbox CSP, so inline display would be blank anyway).
 */
export const FILE_CSP = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'self'; sandbox";
