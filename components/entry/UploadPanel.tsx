'use client';
// Upload step (MR1.1–MR1.3, MR1.10–11): demo banner, dropzone, "ใช้ใบตัวอย่าง" → POST /api/extract.
import { useRef, useState } from 'react';
import type { Flag, IsolateInput } from '@/lib/domain/types';

export interface Extraction {
  mode: string;
  fileUrl: string | null;
  mimeType: string | null;
  input: IsolateInput;
  flags: Flag[];
}

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXT = /\.(png|jpe?g|pdf)$/i;

export default function UploadPanel({
  onExtracted,
  onFailed,
}: {
  onExtracted: (x: Extraction) => void;
  onFailed: (message: string) => void;
}) {
  const [busy, setBusy] = useState<null | 'sample' | 'file'>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function run(init: RequestInit, kind: 'sample' | 'file') {
    setBusy(kind);
    setFileError(null);
    try {
      const res = await fetch('/api/extract', { method: 'POST', ...init });
      const j = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      const input = j?.input as IsolateInput | undefined;
      if (!res.ok || !input || !Array.isArray(input.ast)) {
        const msg = typeof j?.error === 'string' ? j.error : typeof j?.message === 'string' ? j.message : `อ่านใบผลไม่สำเร็จ (HTTP ${res.status})`;
        onFailed(msg);
        return;
      }
      onExtracted({
        mode: typeof j?.mode === 'string' ? j.mode : '',
        fileUrl: typeof j?.fileUrl === 'string' ? j.fileUrl : null,
        mimeType: typeof j?.mimeType === 'string' ? j.mimeType : null,
        input,
        flags: Array.isArray(j?.flags) ? (j.flags as Flag[]) : [],
      });
    } catch {
      onFailed('เชื่อมต่อบริการอ่านใบผลไม่สำเร็จ');
    } finally {
      setBusy(null);
    }
  }

  function handleFile(f: File | undefined | null) {
    if (!f) return;
    if (!ALLOWED_EXT.test(f.name)) {
      setFileError('รองรับเฉพาะไฟล์ .png .jpg .jpeg .pdf');
      return;
    }
    if (f.size > MAX_BYTES) {
      setFileError('ไฟล์ใหญ่เกิน 10 MB');
      return;
    }
    const fd = new FormData();
    fd.append('file', f);
    void run({ body: fd }, 'file');
  }

  return (
    <div className="space-y-4">
      <div role="note" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900">
        โหมดสาธิต — อัปโหลดเฉพาะใบตัวอย่าง/ที่ปกปิดข้อมูลผู้ป่วยแล้ว
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 text-center ${
          drag ? 'border-sky-500 bg-sky-50' : 'border-slate-300 bg-white'
        }`}
      >
        <p className="text-base">ลากไฟล์ใบรายงานผลเพาะเชื้อมาวางที่นี่ หรือ</p>
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-md border border-slate-300 bg-white px-4 font-medium hover:bg-slate-50">
          เลือกไฟล์
          <input
            ref={inputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
            className="sr-only"
            disabled={busy !== null}
            onChange={(e) => {
              handleFile(e.target.files?.[0]);
              if (inputRef.current) inputRef.current.value = '';
            }}
          />
        </label>
        <p className="text-sm text-slate-500">รองรับ .png .jpg .jpeg .pdf ขนาดไม่เกิน 10 MB</p>
        {fileError && (
          <p role="alert" className="text-sm text-red-700">
            {fileError}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() =>
            void run({ body: JSON.stringify({ useSample: true }), headers: { 'Content-Type': 'application/json' } }, 'sample')
          }
          className="min-h-11 rounded-md bg-sky-700 px-5 font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
        >
          ใช้ใบตัวอย่าง
        </button>
        {busy && (
          <span role="status" className="text-sm text-slate-600">
            AI กำลังอ่านใบผล…
          </span>
        )}
      </div>
    </div>
  );
}
