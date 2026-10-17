// Server-only: ward / organism option lists for filter dropdowns.
import { prisma } from '@/lib/db';
import type { OrganismOption, WardOption } from './types';

export async function loadMasterOptions(): Promise<{ wards: WardOption[]; organisms: OrganismOption[] }> {
  const [wards, organisms] = await Promise.all([
    prisma.ward.findMany({ orderBy: { id: 'asc' }, select: { id: true, name: true, wardType: true } }),
    prisma.organism.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, group: true, orgClass: true } }),
  ]);
  return { wards, organisms };
}
