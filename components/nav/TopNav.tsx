'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Role } from '@/lib/role-shared';
import { RoleSwitcher } from './RoleSwitcher';

export const NAV_LINKS: { href: string; label: string }[] = [
  { href: '/dashboard', label: 'แดชบอร์ด' },
  { href: '/antibiogram', label: 'Antibiogram' },
  { href: '/entry', label: 'บันทึกข้อมูล' },
  { href: '/isolates', label: 'รายการ isolate' },
  { href: '/consult', label: 'ปรึกษา AI' },
];

export function TopNav({ role }: { role: Role }) {
  const pathname = usePathname() ?? '';
  return (
    <header className="no-print bg-teal-800 text-white shadow">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <span aria-hidden className="rounded bg-white px-1.5 py-0.5 text-xs font-bold text-teal-800">IC</span>
          <span>MDR &amp; Antibiogram</span>
        </Link>
        <nav aria-label="เมนูหลัก" className="flex flex-wrap items-center gap-1">
          {NAV_LINKS.map((l) => {
            const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? 'page' : undefined}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  active ? 'bg-white text-teal-900' : 'text-teal-50 hover:bg-teal-700'
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <RoleSwitcher role={role} />
      </div>
    </header>
  );
}

export default TopNav;
