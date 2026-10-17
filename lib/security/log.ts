// PHI-free error summaries for server logs.
// Prisma error messages can embed the failing query's arguments (e.g. HN values) and source paths,
// so for Prisma errors only the class name and error code are logged. Never log request bodies.

export function errorSummary(e: unknown): string {
  if (!(e instanceof Error)) return 'non-Error value thrown';
  const rawCode = (e as { code?: unknown }).code;
  const code = typeof rawCode === 'string' ? ` ${rawCode}` : '';
  if (e.name.startsWith('PrismaClient') || e.constructor?.name?.startsWith('PrismaClient')) {
    return `${e.name}${code}`;
  }
  const firstLine = (e.message ?? '').split('\n')[0].slice(0, 200);
  return `${e.name}${code}: ${firstLine}`;
}

/** Text safe to show in a page: generic in production (no SQL, paths or stack), a short summary in dev. */
export function publicErrorMessage(e: unknown): string {
  return process.env.NODE_ENV === 'production' ? 'ระบบขัดข้องชั่วคราว (รายละเอียดอยู่ใน log ของ server)' : errorSummary(e);
}
