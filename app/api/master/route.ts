// GET /api/master — master lists (with DB ids) + config tables for forms and filters.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getConfig, SPECIMEN_TYPES, SPECIMEN_LABELS, PHENOTYPE_CODES, PHENOTYPE_LABELS, CLINICAL_DRAFT_LABEL } from '@/lib/config';
import { errorSummary } from '@/lib/security/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const cfg = getConfig();
  let wards, organisms, drugs;
  try {
    [wards, organisms, drugs] = await Promise.all([
      prisma.ward.findMany({ orderBy: { id: 'asc' }, select: { id: true, code: true, name: true, wardType: true } }),
      prisma.organism.findMany({ orderBy: { id: 'asc' }, select: { id: true, name: true, orgClass: true, group: true } }),
      prisma.drug.findMany({ orderBy: { displayOrder: 'asc' }, select: { id: true, name: true, drugClass: true, displayOrder: true } }),
    ]);
  } catch (err) {
    console.error('[api/master] failed:', errorSummary(err));
    return NextResponse.json({ error: 'โหลดข้อมูลหลักไม่สำเร็จ' }, { status: 500 });
  }
  return NextResponse.json({
    wards,
    organisms,
    drugs,
    panels: cfg.panels,
    sddAllowed: cfg.sddAllowed,
    intrinsic: cfg.intrinsic,
    phenotypeRules: cfg.phenotypeRules,
    specimenTypes: SPECIMEN_TYPES.map((v) => ({ value: v, label: SPECIMEN_LABELS[v] })),
    phenotypes: PHENOTYPE_CODES.map((v) => ({ value: v, label: PHENOTYPE_LABELS[v] })),
    draftLabel: CLINICAL_DRAFT_LABEL,
  });
}
