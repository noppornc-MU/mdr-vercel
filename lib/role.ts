// Server-side role access (demo only — no real auth). Reads cookie `demo_role`, default ICN.
// The role cookie is a demo device, NOT authentication: access control is Vercel Authentication +
// the Basic Auth gate in proxy.ts (SECURITY.md §1).
// Do NOT import this file from client components; use '@/lib/role-shared' there.
import { cookies } from 'next/headers';
import { ROLE_COOKIE, parseRole, type Role } from '@/lib/role-shared';

export * from '@/lib/role-shared';

export async function getRole(): Promise<Role> {
  const store = await cookies();
  return parseRole(store.get(ROLE_COOKIE)?.value);
}
