// /consult — AI Consult (MR13–MR14). Query: ?organism=&phenotype=&wardId=&specimenType=&isolateId=
import { prisma } from '@/lib/db';
import { getRole } from '@/lib/role';
import ConsultClient, { type ConsultInitial } from './ConsultClient';

export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export default async function ConsultPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const role = await getRole();
  const [organisms, wards] = await Promise.all([
    prisma.organism.findMany({ where: { orgClass: 'BACTERIA' }, orderBy: { name: 'asc' } }),
    prisma.ward.findMany({ orderBy: { id: 'asc' } }),
  ]);

  const isolateId = one(sp.isolateId);
  let isolate: ConsultInitial['isolate'] = null;
  if (isolateId) {
    const iso = await prisma.isolate.findUnique({
      where: { id: isolateId },
      include: { organism: true, ward: true },
    });
    if (iso) {
      isolate = {
        id: iso.id,
        code: iso.code,
        organism: iso.organism.name,
        ward: iso.ward?.name ?? null,
        specimenType: iso.specimenType,
        status: iso.status,
      };
    }
  }

  // organism may arrive as a name or an id
  const orgParam = one(sp.organism);
  const org =
    organisms.find((o) => String(o.id) === orgParam) ??
    organisms.find((o) => o.name.toLowerCase() === orgParam.toLowerCase()) ??
    null;

  const initial: ConsultInitial = {
    organism: org?.name ?? (isolate?.organism ?? ''),
    phenotype: one(sp.phenotype),
    wardId: one(sp.wardId),
    wardType: one(sp.wardType),
    specimenType: one(sp.specimenType),
    question: '',
    isolate,
  };

  return (
    <ConsultClient
      role={role}
      initial={initial}
      organisms={organisms.map((o) => ({ id: o.id, name: o.name }))}
      wards={wards.map((w) => ({ id: w.id, name: w.name, wardType: w.wardType }))}
    />
  );
}
