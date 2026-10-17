'use client';
// AI Consult UI: context selectors + question chips (left), 3 result cards + disclaimer (right).
// LLM text is rendered as plain text only.
import Link from 'next/link';
import { useState } from 'react';

type Tier = 'SUPPORTED' | 'CONSIDER' | 'NOT_SUPPORTED' | 'LOW_DATA' | 'INTRINSIC';

export interface ConsultInitial {
  organism: string;
  phenotype: string;
  wardId: string;
  wardType: string;
  specimenType: string;
  question: string;
  isolate: { id: string; code: string; organism: string; ward: string | null; specimenType: string; status: string } | null;
}

interface Fact {
  id: string;
  statement: string;
  organism: string;
  drug: string;
  pct_s: number | null;
  n_tested: number | null;
  call_id: string;
  tier?: Tier | null;
  result?: string | null;
}
interface Answer {
  scope: { organism: string; ward: string; specimen_category: string; period: string; data_as_of: string; min_n: number };
  facts: Fact[];
  reasoning: { statement: string; depends_on: string[] }[];
  needs_clinician_judgment: string[];
  abstentions: { reason: string; detail: string }[];
  disclaimer_shown: boolean;
}
interface WidenOption {
  label: string;
  wardId: number | null;
  wardType: 'ICU' | 'NON_ICU' | null;
  specimenType: string | null;
}
interface ConsultResponse {
  ok: boolean;
  answer: Answer | null;
  verify: { passed: boolean; errors: string[] };
  retried: boolean;
  mode: 'live' | 'cached';
  model: string;
  redacted: boolean;
  context: {
    organism: string | null;
    phenotype: string | null;
    wardId: number | null;
    wardName: string | null;
    wardType: string | null;
    specimenType: string | null;
    isolateCode: string | null;
  };
  toolResults: { meta: { formula: string; pendingCount: number } } | null;
  widen: WidenOption[];
  error?: string;
}

const PHENOTYPES = [
  { v: '', label: '— ไม่ระบุ —' },
  { v: 'CRE', label: 'CRE' },
  { v: 'ESBL_SCREEN', label: 'ESBL (screen)' },
  { v: 'CRAB', label: 'CRAB' },
  { v: 'CRPA', label: 'CRPA' },
  { v: 'MRSA', label: 'MRSA' },
  { v: 'VRE', label: 'VRE' },
];
const SPECIMENS = [
  { v: '', label: 'ทุกชนิด' },
  { v: 'BLOOD', label: 'เลือด (blood culture)' },
  { v: 'RESPIRATORY', label: 'ทางเดินหายใจ' },
  { v: 'URINE', label: 'ปัสสาวะ' },
  { v: 'WOUND', label: 'แผล/หนอง' },
  { v: 'OTHER', label: 'อื่น ๆ' },
];
const TIER_STYLE: Record<Tier, { label: string; cls: string }> = {
  SUPPORTED: { label: 'ข้อมูลท้องถิ่นสนับสนุน', cls: 'bg-green-100 text-green-900 border-green-300' },
  CONSIDER: { label: 'พิจารณาประกอบดุลยพินิจ', cls: 'bg-yellow-100 text-yellow-900 border-yellow-300' },
  NOT_SUPPORTED: { label: 'ข้อมูลท้องถิ่นไม่สนับสนุน', cls: 'bg-red-100 text-red-900 border-red-300' },
  LOW_DATA: { label: 'ข้อมูลน้อย', cls: 'bg-gray-100 text-gray-800 border-gray-300' },
  INTRINSIC: { label: 'ดื้อโดยธรรมชาติ', cls: 'bg-gray-100 text-gray-800 border-gray-300' },
};
const ABSTAIN_LABEL: Record<string, string> = {
  n_below_minimum: 'งดอนุมาน: ข้อมูลไม่เพียงพอ (n น้อย)',
  no_data: 'งดตอบ: ไม่มีข้อมูล',
  out_of_scope: 'นอกขอบเขต',
  dose_requested: 'ไม่ให้ขนาดยา / ความถี่ / ระยะเวลา',
};

interface Chip {
  label: string;
  question: string;
  organism: string;
  ward?: string;
  wardType?: string;
  specimenType?: string;
}
const CHIPS: Chip[] = [
  {
    label: 'K. pneumoniae · blood · ICU B',
    question: 'K. pneumoniae จาก blood culture ใน ICU B ยาตัวไหนข้อมูลท้องถิ่นสนับสนุน',
    organism: 'Klebsiella pneumoniae',
    ward: 'ICU B',
    specimenType: 'BLOOD',
  },
  {
    label: 'A. baumannii · ICU รวม',
    question: 'A. baumannii ใน ICU ยาตัวไหนข้อมูลท้องถิ่นสนับสนุน',
    organism: 'Acinetobacter baumannii',
    wardType: 'ICU',
  },
  {
    label: 'ข้อมูลน้อย: Enterococcus · หอเด็ก',
    question: 'Enterococcus faecalis ในหอเด็ก ยาตัวไหนข้อมูลท้องถิ่นสนับสนุน',
    organism: 'Enterococcus faecalis',
    ward: 'หอเด็ก',
  },
  {
    label: 'ขอขนาดยา Meropenem',
    question: 'ขอขนาดยา Meropenem สำหรับ K. pneumoniae ใน ICU B',
    organism: 'Klebsiella pneumoniae',
    ward: 'ICU B',
  },
];

export default function ConsultClient(props: {
  role: string;
  initial: ConsultInitial;
  organisms: { id: number; name: string }[];
  wards: { id: number; name: string; wardType: string }[];
}) {
  const { initial, organisms, wards } = props;
  const initWard = initial.wardId ? initial.wardId : initial.wardType ? `type:${initial.wardType}` : '';
  const [organism, setOrganism] = useState(initial.organism);
  const [phenotype, setPhenotype] = useState(initial.phenotype);
  const [wardSel, setWardSel] = useState(initWard);
  const [specimenType, setSpecimenType] = useState(initial.specimenType);
  const [site, setSite] = useState('');
  const [question, setQuestion] = useState(initial.question);
  const [isolate, setIsolate] = useState(initial.isolate);
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<ConsultResponse | null>(null);
  const [netError, setNetError] = useState<string | null>(null);

  const canIsolate = props.role === 'ICN' || props.role === 'DOCTOR';

  async function submit(over?: Partial<{ organism: string; phenotype: string; wardSel: string; specimenType: string; question: string; isolateId: string | null }>) {
    const o = over?.organism ?? organism;
    const p = over?.phenotype ?? phenotype;
    const w = over?.wardSel ?? wardSel;
    const s = over?.specimenType ?? specimenType;
    const q = over?.question ?? question;
    const isoId = over && 'isolateId' in over ? over.isolateId : isolate?.id ?? null;
    const body: Record<string, unknown> = {
      organism: o || null,
      phenotype: p || null,
      wardId: w && !w.startsWith('type:') ? Number(w) : null,
      wardType: w.startsWith('type:') ? w.slice(5) : null,
      specimenType: s || null,
      site: site || null,
      question: q || null,
      isolateId: isoId,
    };
    setLoading(true);
    setNetError(null);
    try {
      const r = await fetch('/api/consult', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = (await r.json()) as ConsultResponse;
      if (!r.ok && !j.answer) {
        setRes(null);
        setNetError(j.error ?? 'ระบบ AI Consult ขัดข้อง');
      } else {
        setRes(j);
      }
    } catch {
      setNetError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ส่วนอื่นของระบบยังใช้งานได้');
    } finally {
      setLoading(false);
    }
  }

  function applyChip(c: Chip) {
    const ward = c.ward ? wards.find((x) => x.name === c.ward) : undefined;
    const w = ward ? String(ward.id) : c.wardType ? `type:${c.wardType}` : '';
    const org = organisms.find((x) => x.name === c.organism)?.name ?? c.organism;
    setOrganism(org);
    setPhenotype('');
    setWardSel(w);
    setSpecimenType(c.specimenType ?? '');
    setQuestion(c.question);
    setIsolate(null);
    void submit({ organism: org, phenotype: '', wardSel: w, specimenType: c.specimenType ?? '', question: c.question, isolateId: null });
  }

  function applyWiden(opt: WidenOption) {
    const w = opt.wardId !== null ? String(opt.wardId) : opt.wardType ? `type:${opt.wardType}` : '';
    const s = opt.specimenType ?? '';
    setWardSel(w);
    setSpecimenType(s);
    setIsolate(null);
    void submit({ wardSel: w, specimenType: s, isolateId: null });
  }

  const ctx = res?.context;
  const abgHref = (() => {
    const p = new URLSearchParams();
    const org = ctx?.organism ?? organism;
    if (org) p.set('organism', org);
    if (ctx?.phenotype) p.set('phenotype', ctx.phenotype);
    if (ctx?.wardId) p.set('wardId', String(ctx.wardId));
    else if (ctx?.wardType) p.set('wardType', ctx.wardType);
    if (ctx?.specimenType) p.set('specimenType', ctx.specimenType);
    return `/antibiogram?${p.toString()}`;
  })();

  const answer = res?.answer ?? null;
  const isoFacts = answer?.facts.filter((f) => f.call_id.startsWith('iso')) ?? [];
  const dataFacts = answer?.facts.filter((f) => !f.call_id.startsWith('iso')) ?? [];

  return (
    <div className="mx-auto max-w-7xl p-4">
      <h1 className="mb-1 text-2xl font-bold">ปรึกษา AI (AI Consult)</h1>
      <p className="mb-4 text-sm text-gray-600">
        สรุปตัวเลือกยาจากข้อมูล antibiogram ท้องถิ่น — ตัวเลขทั้งหมดคำนวณโดยระบบ (ฟังก์ชันเดียวกับหน้า Antibiogram) แล้วตรวจสอบก่อนแสดง
      </p>

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        {/* Left: context + chips */}
        <section className="space-y-3 rounded-lg border bg-white p-4 shadow-sm" aria-label="บริบทคำถาม">
          {isolate && (
            <div className="rounded border border-blue-300 bg-blue-50 p-2 text-sm">
              <div className="font-semibold">ปรึกษาจาก isolate {isolate.code}</div>
              <div>
                {isolate.organism} · {isolate.ward ?? 'ไม่ทราบ ward'} · {isolate.specimenType}
                {isolate.status !== 'APPROVED' && <span className="ml-1 text-amber-700">(ยังไม่ยืนยัน)</span>}
              </div>
              {!canIsolate && <div className="text-red-700">บทบาทนี้ไม่สามารถปรึกษาจาก isolate ได้</div>}
              <button type="button" className="mt-1 text-xs text-blue-700 underline" onClick={() => setIsolate(null)}>
                ยกเลิกบริบท isolate
              </button>
            </div>
          )}
          <label className="block text-sm">
            <span className="font-medium">เชื้อ</span>
            <select className="mt-1 w-full rounded border p-2" value={organism} onChange={(e) => setOrganism(e.target.value)} disabled={!!isolate}>
              <option value="">— เลือกเชื้อ —</option>
              {organisms.map((o) => (
                <option key={o.id} value={o.name}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">กลุ่มเชื้อดื้อยา (phenotype) <span className="text-xs text-gray-500">[J]</span></span>
            <select className="mt-1 w-full rounded border p-2" value={phenotype} onChange={(e) => setPhenotype(e.target.value)} disabled={!!isolate}>
              {PHENOTYPES.map((p) => (
                <option key={p.v} value={p.v}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Ward</span>
            <select className="mt-1 w-full rounded border p-2" value={wardSel} onChange={(e) => setWardSel(e.target.value)} disabled={!!isolate}>
              <option value="">ทั้งโรงพยาบาล</option>
              <option value="type:ICU">ICU รวม</option>
              <option value="type:NON_ICU">Non-ICU รวม</option>
              {wards.map((w) => (
                <option key={w.id} value={String(w.id)}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Specimen</span>
            <select className="mt-1 w-full rounded border p-2" value={specimenType} onChange={(e) => setSpecimenType(e.target.value)} disabled={!!isolate}>
              {SPECIMENS.map((s) => (
                <option key={s.v} value={s.v}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">ตำแหน่งติดเชื้อ (ไม่บังคับ)</span>
            <input className="mt-1 w-full rounded border p-2" value={site} maxLength={200} onChange={(e) => setSite(e.target.value)} placeholder="เช่น bloodstream infection" />
          </label>
          <label className="block text-sm">
            <span className="font-medium">คำถาม (ไม่บังคับ)</span>
            <textarea className="mt-1 w-full rounded border p-2" rows={3} maxLength={1000} value={question} onChange={(e) => setQuestion(e.target.value)} />
          </label>
          <p className="rounded bg-amber-50 p-2 text-xs text-amber-900" role="note">
            ห้ามพิมพ์ชื่อ HN หรือข้อมูลระบุตัวผู้ป่วย — ระบบจะลบตัวเลขยาวและรูปแบบ HN ออกก่อนส่งให้โมเดล
          </p>
          <button
            type="button"
            className="w-full rounded bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
            disabled={loading || (!organism && !phenotype && !isolate && !question)}
            onClick={() => void submit()}
          >
            {loading ? 'กำลังประมวลผล…' : 'ปรึกษา AI'}
          </button>
          <div>
            <div className="mb-1 text-sm font-medium">คำถามตัวอย่าง</div>
            <div className="flex flex-wrap gap-2">
              {CHIPS.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  className="rounded-full border border-blue-300 bg-blue-50 px-3 py-1 text-xs text-blue-900 hover:bg-blue-100 disabled:opacity-50"
                  disabled={loading}
                  title={c.question}
                  onClick={() => applyChip(c)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Right: result */}
        <section className="space-y-3" aria-live="polite" aria-label="ผลการปรึกษา">
          {netError && <div className="rounded border border-red-300 bg-red-50 p-3 text-red-900">{netError}</div>}
          {!res && !netError && (
            <div className="rounded-lg border border-dashed bg-white p-8 text-center text-gray-500">
              เลือกบริบทหรือกดคำถามตัวอย่างเพื่อเริ่ม
            </div>
          )}
          {res && !res.ok && (
            <div className="rounded border border-red-300 bg-red-50 p-3 text-red-900">
              <div className="font-semibold">{res.error ?? 'ไม่สามารถสร้างคำตอบที่ตรวจสอบได้'}</div>
              {res.verify.errors.length > 0 && (
                <details className="mt-1 text-xs">
                  <summary>รายละเอียดการตรวจสอบ</summary>
                  <ul className="list-disc pl-5">
                    {res.verify.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
          {res && answer && (
            <>
              <div className="rounded-lg border bg-white p-3 text-sm shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded border border-green-300 bg-green-50 px-2 py-0.5 text-xs text-green-900">
                    ✓ ผ่านการตรวจสอบตัวเลขกับผลคำนวณ{res.retried ? ' (สร้างใหม่ 1 ครั้ง)' : ''}
                  </span>
                  <span className="rounded border px-2 py-0.5 text-xs text-gray-700">
                    โหมด: {res.mode === 'cached' ? 'สำรอง (cached template)' : 'live'} · {res.model}
                  </span>
                  {res.redacted && (
                    <span className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-900">ลบตัวระบุออกจากข้อความแล้ว</span>
                  )}
                </div>
                <div className="mt-2 text-gray-800">
                  <b>ขอบเขต:</b> {answer.scope.organism} · {answer.scope.ward} · {answer.scope.specimen_category}
                  <br />
                  <b>ช่วงข้อมูล:</b> {answer.scope.period} · ข้อมูลถึงวันที่ {answer.scope.data_as_of} · min N = {answer.scope.min_n}
                  {res.toolResults && (
                    <>
                      {' '}· สูตร %S: {res.toolResults.meta.formula === 'S_PLUS_SDD' ? 'รวม SDD' : 'S เท่านั้น'}
                      {res.toolResults.meta.pendingCount > 0 && <> · ยังไม่ยืนยัน {res.toolResults.meta.pendingCount} รายการ (ไม่ถูกนับ)</>}
                    </>
                  )}
                </div>
              </div>

              {answer.abstentions.map((a, i) => (
                <div key={i} className="rounded border border-amber-400 bg-amber-50 p-3 text-amber-950" role="status">
                  <div className="font-semibold">{ABSTAIN_LABEL[a.reason] ?? a.reason}</div>
                  <div className="text-sm">{a.detail}</div>
                </div>
              ))}
              {res.widen.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {res.widen.map((w) => (
                    <button
                      key={w.label}
                      type="button"
                      className="rounded border border-blue-400 bg-white px-3 py-1 text-sm text-blue-800 hover:bg-blue-50"
                      onClick={() => applyWiden(w)}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              )}

              <article className="rounded-lg border bg-white p-4 shadow-sm">
                <h2 className="mb-2 text-lg font-semibold">1. ข้อเท็จจริงจากข้อมูล</h2>
                {isoFacts.length > 0 && (
                  <>
                    <h3 className="text-sm font-semibold text-gray-700">ยาที่ isolate นี้ไวตามผลแล็บ</h3>
                    <ul className="mb-2 list-disc pl-5 text-sm">
                      {isoFacts.map((f) => (
                        <li key={f.id}>{f.statement}</li>
                      ))}
                    </ul>
                    <h3 className="text-sm font-semibold text-gray-700">ข้อมูลท้องถิ่นของเชื้อชนิดนี้</h3>
                  </>
                )}
                {dataFacts.length === 0 ? (
                  <p className="text-sm text-gray-500">ไม่มีข้อเท็จจริงที่แสดงได้</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {dataFacts.map((f) => (
                      <li key={f.id} className="flex flex-wrap items-center gap-2">
                        {f.tier && (
                          <span className={`rounded border px-2 py-0.5 text-xs ${TIER_STYLE[f.tier].cls}`}>{TIER_STYLE[f.tier].label}</span>
                        )}
                        <span>{f.statement}</span>
                        <span className="text-xs text-gray-400">[{f.id} · {f.call_id}]</span>
                      </li>
                    ))}
                  </ul>
                )}
              </article>

              <article className="rounded-lg border bg-white p-4 shadow-sm">
                <h2 className="mb-2 text-lg font-semibold">2. การวิเคราะห์ (อนุมาน)</h2>
                {answer.reasoning.length === 0 ? (
                  <p className="text-sm text-gray-500">งดการอนุมาน</p>
                ) : (
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {answer.reasoning.map((r, i) => (
                      <li key={i}>
                        {r.statement}
                        {r.depends_on.length > 0 && <span className="ml-1 text-xs text-gray-400">(อ้างอิง {r.depends_on.join(', ')})</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </article>

              <article className="rounded-lg border bg-white p-4 shadow-sm">
                <h2 className="mb-2 text-lg font-semibold">3. ประเด็นที่ต้องใช้ดุลยพินิจแพทย์/เภสัชกร</h2>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {answer.needs_clinician_judgment.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </article>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={abgHref} className="text-sm font-medium text-blue-700 underline">
                  ดูตัวเลขที่ใช้ (Antibiogram) →
                </Link>
                <span className="text-xs text-gray-500">[J] กฎ phenotype และตาราง SDD/intrinsic เป็นฉบับร่าง รอ ICN/จุลชีววิทยารับรอง</span>
              </div>
            </>
          )}
          <div className="rounded border-l-4 border-red-500 bg-red-50 p-3 text-sm font-medium text-red-900" role="note">
            ข้อมูลนี้เป็นข้อมูลสนับสนุนการตัดสินใจ ไม่ใช่คำสั่งการรักษา
          </div>
        </section>
      </div>
    </div>
  );
}
