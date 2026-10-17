'use client';
// /entry client shell: tabs Upload | Key in, extraction → review form, success panel.
import { useState } from 'react';
import type { Role } from '@/lib/role-shared';
import type { EntryConfig, EntryMaster } from './shared';
import UploadPanel, { type Extraction } from './UploadPanel';
import OriginalViewer from './OriginalViewer';
import IsolateForm, { type SavedIsolate } from './IsolateForm';
import SuccessPanel from './SuccessPanel';

type Tab = 'upload' | 'keyin';
const TABS: { id: Tab; label: string }[] = [
  { id: 'upload', label: 'Upload ใบผล (AI อ่าน)' },
  { id: 'keyin', label: 'Key in (กรอกเอง)' },
];

export default function EntryClient({ role, master, config }: { role: Role; master: EntryMaster; config: EntryConfig }) {
  const [tab, setTab] = useState<Tab>('upload');
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedIsolate | null>(null);
  const [version, setVersion] = useState(0);

  function reset() {
    setSaved(null);
    setExtraction(null);
    setNotice(null);
    setVersion((v) => v + 1);
  }

  if (saved) return <SuccessPanel saved={saved} role={role} onNew={reset} />;

  return (
    <div className="space-y-4">
      {role !== 'ICN' && (
        <div role="note" className="rounded-md border border-slate-300 bg-slate-100 p-3 text-sm text-slate-700">
          บทบาทปัจจุบัน: {role} — ดูฟอร์มได้ แต่บันทึก/ยืนยันข้อมูลได้เฉพาะ ICN
        </div>
      )}
      {notice && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-red-800">
          <span>อ่านใบผลไม่สำเร็จ: {notice} — กรุณากรอกเอง (Key in)</span>
          <button type="button" onClick={() => setNotice(null)} className="min-h-9 rounded border border-red-300 bg-white px-3 text-sm">
            ปิด
          </button>
        </div>
      )}

      <div role="tablist" aria-label="วิธีบันทึกข้อมูล" className="flex gap-2 border-b border-slate-200">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
                setTab(next.id);
                document.getElementById(`tab-${next.id}`)?.focus();
              }
            }}
            className={`-mb-px min-h-12 rounded-t-md border px-5 font-semibold ${
              tab === t.id ? 'border-slate-200 border-b-white bg-white text-sky-800' : 'border-transparent text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div id="panel-upload" role="tabpanel" aria-labelledby="tab-upload" hidden={tab !== 'upload'}>
        {!extraction ? (
          <UploadPanel
            onExtracted={(x) => {
              setNotice(null);
              setExtraction(x);
            }}
            onFailed={(msg) => {
              setNotice(msg);
              setTab('keyin');
            }}
          />
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-600">ตรวจข้อมูลที่ AI อ่านได้เทียบกับภาพต้นฉบับ แก้ไขฟิลด์ที่ไฮไลต์ แล้วกด “ยืนยันข้อมูล”</p>
              <button
                type="button"
                onClick={() => {
                  setExtraction(null);
                  setVersion((v) => v + 1);
                }}
                className="min-h-11 rounded-md border border-slate-300 bg-white px-4 text-sm"
              >
                อัปโหลดไฟล์อื่น
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <OriginalViewer fileUrl={extraction.fileUrl} mimeType={extraction.mimeType} mode={extraction.mode} />
              <IsolateForm
                key={`ocr-${version}`}
                mode="ocr"
                master={master}
                config={config}
                role={role}
                initialInput={{ ...extraction.input, sourceFile: extraction.input.sourceFile ?? extraction.fileUrl }}
                initialFlags={extraction.flags}
                onSaved={setSaved}
              />
            </div>
          </div>
        )}
      </div>

      <div id="panel-keyin" role="tabpanel" aria-labelledby="tab-keyin" hidden={tab !== 'keyin'}>
        <IsolateForm
          key={`manual-${version}`}
          mode="manual"
          master={master}
          config={config}
          role={role}
          initialInput={null}
          initialFlags={[]}
          onSaved={setSaved}
        />
      </div>
    </div>
  );
}
