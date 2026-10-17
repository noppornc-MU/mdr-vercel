'use client';
// ปุ่ม "โหลดข้อมูลสาธิต" (MR4.1) — รีเซ็ต isolate สังเคราะห์ผ่าน POST /api/seed (ICN เท่านั้น)
import { useState } from 'react';

export default function SeedButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    if (!window.confirm('รีเซ็ตเป็นข้อมูลสาธิต? ข้อมูลที่บันทึกเพิ่มจะถูกลบทั้งหมด')) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setMsg(`โหลดข้อมูลสาธิตแล้ว ${body.isolates ?? ''} isolates (${body.ms ?? '?'} ms)`);
      window.location.reload();
    } catch (e) {
      setMsg(`โหลดข้อมูลสาธิตไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {msg && (
        <span role="status" className="text-sm text-slate-600">
          {msg}
        </span>
      )}
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="min-h-11 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {busy ? 'กำลังโหลด…' : 'โหลดข้อมูลสาธิต'}
      </button>
    </div>
  );
}
