// /isolates — รายการ isolate (MR3.5)
import { getRole } from '@/lib/role';
import { prisma } from '@/lib/db';
import IsolatesClient from '@/components/isolates/IsolatesClient';
import SeedButton from '@/components/isolates/SeedButton';
import { EMPTY_FILTERS, type IsolateFilters } from '@/components/isolates/filters';

export const dynamic = 'force-dynamic';

export default async function IsolatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const pick = (k: keyof IsolateFilters) => (typeof sp[k] === 'string' ? (sp[k] as string) : '');
  const initialFilters: IsolateFilters = {
    ...EMPTY_FILTERS,
    hn: pick('hn'),
    organismId: pick('organismId'),
    wardId: pick('wardId'),
    status: pick('status'),
    reportStatus: pick('reportStatus'),
    from: pick('from'),
    to: pick('to'),
  };
  const [role, organisms, wards] = await Promise.all([
    getRole(),
    prisma.organism.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.ward.findMany({ orderBy: { id: 'asc' }, select: { id: true, name: true, wardType: true } }),
  ]);
  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">รายการ isolate</h1>
        {role === 'ICN' && <SeedButton />}
      </div>
      <IsolatesClient role={role} organisms={organisms} wards={wards} initialFilters={initialFilters} />
    </div>
  );
}
