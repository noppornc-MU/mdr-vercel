'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { ROLES, ROLE_COOKIE, ROLE_LABELS, type Role } from '@/lib/role-shared';

/**
 * Demo role switcher: writes cookie `demo_role` and refreshes server components.
 * NOT authentication — anyone past the access gate can pick any role (SECURITY.md §1).
 * Cookie: Path=/, SameSite=Lax, Secure whenever the page is served over HTTPS (Vercel).
 */
export function RoleSwitcher({ role }: { role: Role }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onChange = (next: Role) => {
    const secure = window.location.protocol === 'https:' ? '; secure' : '';
    document.cookie = `${ROLE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax${secure}`;
    startTransition(() => router.refresh());
  };

  return (
    <label className="flex items-center gap-2 text-sm text-white">
      <span className="hidden sm:inline">บทบาท</span>
      <select
        aria-label="สลับบทบาท (สาธิต)"
        value={role}
        disabled={pending}
        onChange={(e) => onChange(e.target.value as Role)}
        className="h-8 rounded-md border border-white/30 bg-teal-900 px-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>
    </label>
  );
}

export default RoleSwitcher;
