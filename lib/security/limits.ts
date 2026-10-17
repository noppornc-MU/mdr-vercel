// Shared size limits (dependency-free so proxy.ts can import it without pulling in Prisma).

/** Maximum upload size for lab reports (MR1.1). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
