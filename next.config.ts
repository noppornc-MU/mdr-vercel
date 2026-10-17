import type { NextConfig } from 'next';
import { SECURITY_HEADERS } from './lib/security/headers';

// Files read at runtime with fs + process.cwd() must be copied into the serverless bundle on Vercel.
// lib/extract/cached.ts reads fixtures/ (sample report PNG + expected extraction JSON) with fs.
// config/*.json and fixtures/consult_cached.json are JSON imports (bundled), but are traced as well
// so a future switch to fs reads cannot silently break the deployed functions.
const RUNTIME_FILES = ['./fixtures/**/*', './config/**/*'];

const nextConfig: NextConfig = {
  // Do not advertise the framework (X-Powered-By: Next.js).
  poweredByHeader: false,
  // Native / server-only packages stay external to the server bundle.
  serverExternalPackages: ['@prisma/client', 'sharp'],
  outputFileTracingIncludes: {
    '/api/extract': RUNTIME_FILES,
    '/api/extract/file': RUNTIME_FILES,
    '/api/consult': RUNTIME_FILES,
  },
  experimental: {
    // proxy.ts makes Next buffer request bodies; the default 10 MB cap would truncate a 10 MB upload
    // plus multipart overhead. proxy.ts rejects Content-Length above 10.5 MB for /api/extract.
    proxyClientMaxBodySize: '11mb',
  },
  // Security headers for every response, including static assets the proxy matcher skips.
  // CSP is set per request in proxy.ts (nonce for pages, API policy for /api/*).
  async headers() {
    return [
      {
        source: '/:path*',
        headers: Object.entries(SECURITY_HEADERS).map(([key, value]) => ({ key, value })),
      },
    ];
  },
};

export default nextConfig;
