import type { Metadata } from 'next';
import './globals.css';
import { TopNav } from '@/components/nav/TopNav';
import { getRole } from '@/lib/role';
import { DEMO_BANNER } from '@/lib/config';

export const metadata: Metadata = {
  title: 'IC — MDR & Antibiogram (Demo)',
  description: 'ระบบสาธิตเฝ้าระวังเชื้อดื้อยาและ antibiogram — ข้อมูลสังเคราะห์',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const role = await getRole();
  return (
    <html lang="th">
      <body className="min-h-screen antialiased">
        <TopNav role={role} />
        <div role="note" className="no-print border-b border-amber-300 bg-amber-100 px-4 py-1 text-center text-xs font-medium text-amber-900">
          {DEMO_BANNER}
        </div>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
