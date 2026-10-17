// /entry — บันทึกข้อมูล (MR1–MR3): Upload ใบผล (AI อ่าน) | Key in
import { getRole } from '@/lib/role';
import { getEntryConfig, getEntryMaster } from '@/lib/isolates';
import EntryClient from '@/components/entry/EntryClient';

export const dynamic = 'force-dynamic';

export default async function EntryPage() {
  const [role, master] = await Promise.all([getRole(), getEntryMaster()]);
  const config = getEntryConfig();
  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">
      <h1 className="text-2xl font-bold">บันทึกข้อมูล</h1>
      <EntryClient role={role} master={master} config={config} />
    </div>
  );
}
