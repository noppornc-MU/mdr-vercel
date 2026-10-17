// Shared notice blocks (server-compatible, no hooks).
import { fmtInt, thaiDate } from './format';

export function DraftRulesLabel({ what = 'กฎ phenotype' }: { what?: string }) {
  return (
    <p className="rounded-md border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <span className="font-bold">[J]</span> {what} เป็นกฎฉบับร่าง รอ ICN/จุลชีววิทยารับรอง
    </p>
  );
}

export function ClinicalDisclaimer() {
  return (
    <p className="rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-900">
      ข้อมูลนี้ใช้ประกอบการพิจารณา ไม่ใช่คำสั่งการรักษา · นับเฉพาะข้อมูลที่ยืนยันแล้ว (APPROVED) และรายงาน Final
    </p>
  );
}

export function DataMeta({
  dataAsOf, pendingCount, from, to, extra,
}: { dataAsOf: string | null; pendingCount: number; from: string; to: string; extra?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-700">
      <span>ช่วงข้อมูล: <b>{thaiDate(from)}</b> – <b>{thaiDate(to)}</b></span>
      <span>ข้อมูลถึงวันที่: <b>{thaiDate(dataAsOf)}</b></span>
      <span>
        รายการที่ยังไม่ยืนยัน/Preliminary (ไม่ถูกนับ): <b>{fmtInt(pendingCount)}</b> รายการ
      </span>
      {extra}
    </div>
  );
}

export function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-red-300 bg-red-50 p-4 text-red-900" role="alert">
      <p className="font-semibold">ไม่สามารถโหลดข้อมูลได้</p>
      <p className="text-sm">{message}</p>
      <p className="mt-1 text-sm">ลองโหลดข้อมูลสาธิตใหม่ (npm run seed หรือ POST /api/seed) แล้วรีเฟรชหน้า</p>
    </div>
  );
}
