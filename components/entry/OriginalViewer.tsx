'use client';
// Original report image/PDF shown beside the extracted form (MR1.9), zoomable.
import { useState } from 'react';

export default function OriginalViewer({
  fileUrl,
  mimeType,
  mode,
}: {
  fileUrl: string | null;
  mimeType?: string | null;
  mode?: string;
}) {
  const [zoom, setZoom] = useState(1);
  const isPdf = !!fileUrl && (mimeType === 'application/pdf' || /\.pdf($|[?&#])/i.test(fileUrl));
  return (
    <section aria-labelledby="original-title" className="rounded-lg border border-slate-200 bg-white p-3 md:sticky md:top-4 md:self-start">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 id="original-title" className="font-semibold">
          ใบผลต้นฉบับ {mode ? <span className="text-xs font-normal text-slate-500">(โหมดอ่าน: {mode})</span> : null}
        </h3>
        {!isPdf && fileUrl && (
          <div className="flex items-center gap-1" role="group" aria-label="ซูมภาพ">
            <button type="button" aria-label="ซูมออก" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))} className="h-11 w-11 rounded-md border border-slate-300 text-lg">−</button>
            <button type="button" onClick={() => setZoom(1)} className="h-11 min-w-16 rounded-md border border-slate-300 px-2 text-sm">{Math.round(zoom * 100)}%</button>
            <button type="button" aria-label="ซูมเข้า" onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} className="h-11 w-11 rounded-md border border-slate-300 text-lg">+</button>
          </div>
        )}
      </div>
      {!fileUrl ? (
        <p className="text-sm text-slate-600">ไม่มีภาพต้นฉบับ</p>
      ) : isPdf ? (
        <iframe title="ใบผลต้นฉบับ (PDF)" src={fileUrl} className="h-[75vh] w-full rounded border border-slate-200" />
      ) : (
        <div className="max-h-[75vh] overflow-auto rounded border border-slate-200 bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fileUrl} alt="ภาพใบรายงานผลเพาะเชื้อต้นฉบับ" style={{ width: `${zoom * 100}%`, maxWidth: 'none' }} />
        </div>
      )}
    </section>
  );
}
