'use client';
// Shared review/key-in form (MR1.7–1.9, MR2, MR3.1): 3 sections, flagged fields highlighted,
// read-only phenotype preview, "ยืนยันข้อมูล" → POST /api/isolates then POST /api/isolates/[id]/approve.
import { useMemo, useRef, useState, type ReactNode } from 'react';
import type { AstCode, Flag, IsolateInput, PhenotypeCode, ReportStatus, SpecimenType } from '@/lib/domain/types';
import type { Role } from '@/lib/role-shared';
import { validateIsolateInput } from '@/lib/domain/validators';
import {
  astRowIndex,
  bangkokToday,
  buildValidationCtx,
  computePhenotypes,
  normalizeFlagPath,
  panelDrugIds,
  type EntryConfig,
  type EntryMaster,
} from './shared';
import OrganismPicker from './OrganismPicker';
import PhenotypePreview from './PhenotypePreview';
import { FIELD_LABEL, REPORT_STATUS_LABEL, SPECIMEN_LABEL, thaiDate } from '@/components/isolates/format';

export interface SavedIsolate {
  id: string;
  code: string;
  organismName: string;
  specimenDate: string;
  wardName: string;
  reportStatus: ReportStatus;
  phenotypes: PhenotypeCode[];
}

type FieldKey =
  | 'hn' | 'sex' | 'patientType' | 'wardId' | 'labNo' | 'orderNo' | 'specimenDate'
  | 'specimenType' | 'specimenDetail' | 'organismId' | 'reportStatus' | 'labComments';
type FlagField = FieldKey | 'ast' | 'other';

interface Fields {
  hn: string;
  sex: '' | 'M' | 'F';
  patientType: '' | 'OPD' | 'IPD';
  wardId: string;
  labNo: string;
  orderNo: string;
  specimenDate: string;
  specimenType: '' | SpecimenType;
  specimenDetail: string;
  organismId: number | null;
  reportStatus: ReportStatus;
  labComments: string;
}
interface AstRow {
  key: string;
  drugId: number | null;
  drugRaw: string | null;
  result: AstCode | null;
  fixed: boolean; // panel row (Key in): drug shown as text
  extFlags: string[]; // extraction flags not yet reviewed
}
interface ExtFlag {
  id: string;
  field: FlagField;
  reason: string;
}
interface DuplicateInfo {
  id: string;
  code: string;
  hn: string;
  labNo: string | null;
  specimenDate: string;
  organismName: string;
  wardName: string | null;
  status: string;
  matchedBy: string;
}

const FIELD_ALIASES: Record<string, FieldKey> = {
  hn: 'hn', sex: 'sex', patienttype: 'patientType', patient_type: 'patientType', wardid: 'wardId', ward: 'wardId',
  labno: 'labNo', lab_no: 'labNo', orderno: 'orderNo', order_no: 'orderNo', specimendate: 'specimenDate',
  lab_received_at: 'specimenDate', lab_received_raw: 'specimenDate', specimentype: 'specimenType',
  specimen_raw: 'specimenType', specimen: 'specimenType', specimendetail: 'specimenDetail', organismid: 'organismId',
  organism: 'organismId', organism_raw: 'organismId', reportstatus: 'reportStatus', report_status: 'reportStatus',
  labcomments: 'labComments', lab_comments: 'labComments',
};
function fieldOfPath(path: string): FlagField {
  const root = normalizeFlagPath(path).split(/[.[]/)[0].toLowerCase();
  if (root === 'ast') return 'ast';
  return FIELD_ALIASES[root] ?? 'other';
}

const RESULT_BTN: Record<AstCode, string> = {
  S: 'bg-emerald-600 text-white border-emerald-700',
  I: 'bg-amber-500 text-white border-amber-600',
  R: 'bg-red-600 text-white border-red-700',
  D: 'bg-sky-600 text-white border-sky-700',
};
const CODES: AstCode[] = ['S', 'I', 'R', 'D'];
const SPECIMENS: SpecimenType[] = ['BLOOD', 'RESPIRATORY', 'URINE', 'WOUND', 'OTHER'];

function initFields(inp: IsolateInput | null): Fields {
  return {
    hn: inp?.hn ?? '',
    sex: inp?.sex ?? '',
    patientType: inp?.patientType ?? '',
    wardId: inp?.wardId != null ? String(inp.wardId) : '',
    labNo: inp?.labNo ?? '',
    orderNo: inp?.orderNo ?? '',
    specimenDate: inp?.specimenDate ?? '',
    specimenType: inp?.specimenType ?? '',
    specimenDetail: inp?.specimenDetail ?? '',
    organismId: inp?.organismId ?? null,
    reportStatus: inp?.reportStatus ?? 'FINAL',
    labComments: inp?.labComments ?? '',
  };
}

function inputCls(flagged: boolean) {
  return `h-11 w-full rounded-md border px-3 text-base ${flagged ? 'border-amber-500 bg-amber-50' : 'border-slate-300 bg-white'}`;
}

function Field({
  id,
  label,
  required,
  reasons,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  reasons: string[];
  children: ReactNode;
}) {
  return (
    <div className={reasons.length ? 'rounded-md ring-2 ring-amber-400 ring-offset-2' : ''}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-600"> * (จำเป็น)</span>}
      </label>
      {children}
      {reasons.length > 0 && (
        <ul id={`${id}-flags`} className="mt-1 space-y-0.5 text-sm text-amber-800">
          {reasons.map((r, i) => (
            <li key={i}>⚑ {r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function IsolateForm({
  mode,
  master,
  config,
  role,
  initialInput,
  initialFlags,
  onSaved,
}: {
  mode: 'ocr' | 'manual';
  master: EntryMaster;
  config: EntryConfig;
  role: Role;
  initialInput: IsolateInput | null;
  initialFlags: Flag[];
  onSaved: (s: SavedIsolate) => void;
}) {
  const idp = mode; // id prefix: both forms may be mounted at once
  const keySeq = useRef(0);
  const [today] = useState(() => bangkokToday());
  const [fields, setFields] = useState<Fields>(() => initFields(initialInput));
  const [rows, setRows] = useState<AstRow[]>(() =>
    (initialInput?.ast ?? []).map((a, i) => ({
      key: `init-${i}`,
      drugId: a.drugId,
      drugRaw: a.drugRaw ?? null,
      result: a.result,
      fixed: false,
      extFlags: initialFlags.filter((f) => astRowIndex(f.path) === i).map((f) => f.reason),
    })),
  );
  const [extFlags, setExtFlags] = useState<ExtFlag[]>(() =>
    initialFlags
      .filter((f) => astRowIndex(f.path) == null)
      .map((f, i) => ({ id: `ext-${i}`, field: fieldOfPath(f.path), reason: f.reason })),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ text: string; flags: Flag[] } | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateInfo | null>(null);
  const [draft, setDraft] = useState<{ id: string; code: string } | null>(null);
  const source: IsolateInput['source'] = mode === 'ocr' ? 'OCR' : 'MANUAL';
  const sourceFile = initialInput?.sourceFile ?? null;

  function newKey() {
    keySeq.current += 1;
    return `row-${keySeq.current}`;
  }

  function touched() {
    setError(null);
    setDuplicate(null);
  }

  function setField<K extends FieldKey>(k: K, v: Fields[K]) {
    setFields((f) => ({ ...f, [k]: v }));
    setExtFlags((fl) => fl.filter((x) => x.field !== k));
    touched();
  }

  function changeOrganism(id: number | null) {
    setField('organismId', id);
    if (mode !== 'manual') return;
    const ids = panelDrugIds(id, master, config);
    setRows((prev) => {
      const keep = new Map(prev.filter((r) => r.drugId != null && r.result).map((r) => [r.drugId as number, r.result]));
      const panel: AstRow[] = ids.map((drugId) => ({
        key: `p-${drugId}`,
        drugId,
        drugRaw: null,
        result: keep.get(drugId) ?? null,
        fixed: true,
        extFlags: [],
      }));
      const extras = prev.filter((r) => !r.fixed && (r.drugId == null || !ids.includes(r.drugId)));
      return [...panel, ...extras];
    });
  }

  function updateRow(key: string, patch: Partial<AstRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch, extFlags: [] } : r)));
    setExtFlags((fl) => fl.filter((x) => x.field !== 'ast'));
    touched();
  }
  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
    setExtFlags((fl) => fl.filter((x) => x.field !== 'ast'));
    touched();
  }
  function addRow() {
    setRows((prev) => [...prev, { key: newKey(), drugId: null, drugRaw: null, result: null, fixed: false, extFlags: [] }]);
  }

  // ----- build input + live validation (same validators as the server) -----
  const built = useMemo(() => {
    const astRows = mode === 'manual' ? rows.filter((r) => r.result != null) : rows; // Key in: blank = not tested
    const rowKeyOf = astRows.map((r) => r.key);
    const input: IsolateInput = {
      hn: fields.hn.trim(),
      sex: fields.sex || null,
      patientType: fields.patientType || null,
      wardId: fields.wardId ? Number(fields.wardId) : null,
      labNo: fields.labNo.trim() || null,
      orderNo: fields.orderNo.trim() || null,
      specimenDate: fields.specimenDate || null,
      specimenType: fields.specimenType || null,
      specimenDetail: fields.specimenDetail.trim() || null,
      organismId: fields.organismId,
      reportStatus: fields.reportStatus,
      labComments: fields.labComments.trim() || null,
      ast: astRows.map((r) => ({ drugId: r.drugId, drugRaw: r.drugRaw, result: r.result })),
      source,
      sourceFile,
    };
    return { input, rowKeyOf };
  }, [fields, rows, mode, source, sourceFile]);

  const ctx = useMemo(() => buildValidationCtx(master, config.sddAllowed, today), [master, config.sddAllowed, today]);
  const liveFlags = useMemo<Flag[]>(() => {
    try {
      return validateIsolateInput(built.input, ctx);
    } catch {
      return [];
    }
  }, [built.input, ctx]);

  const { fieldReasons, rowReasons, generalAst, total } = useMemo(() => {
    const fieldReasons: Partial<Record<FlagField, string[]>> = {};
    const rowReasons: Record<string, string[]> = {};
    const generalAst: string[] = [];
    let total = 0;
    const pushField = (f: FlagField, r: string) => {
      (fieldReasons[f] ??= []).includes(r) || fieldReasons[f]!.push(r);
    };
    for (const fl of liveFlags) {
      total++;
      const idx = astRowIndex(fl.path);
      if (idx != null) {
        const key = built.rowKeyOf[idx];
        if (key) (rowReasons[key] ??= []).push(fl.reason);
        else generalAst.push(fl.reason);
      } else {
        const f = fieldOfPath(fl.path);
        if (f === 'ast') generalAst.push(fl.reason);
        else pushField(f, fl.reason);
      }
    }
    for (const r of rows) {
      if (r.extFlags.length) {
        total += r.extFlags.length;
        (rowReasons[r.key] ??= []).push(...r.extFlags.filter((x) => !(rowReasons[r.key] ?? []).includes(x)));
      }
    }
    for (const x of extFlags) {
      total++;
      if (x.field === 'ast') generalAst.push(x.reason);
      else pushField(x.field, x.reason);
    }
    return { fieldReasons, rowReasons, generalAst: [...new Set(generalAst)], total };
  }, [liveFlags, extFlags, rows, built.rowKeyOf]);

  const reasonsOf = (f: FlagField) => fieldReasons[f] ?? [];
  const describedBy = (id: string, f: FlagField) => (reasonsOf(f).length ? `${id}-flags` : undefined);

  const missing: string[] = [];
  if (!built.input.hn) missing.push('HN');
  if (!built.input.patientType) missing.push('Patient Type');
  if (built.input.wardId == null) missing.push('Ward');
  if (!built.input.specimenDate) missing.push('วันที่รับตรวจ');
  if (!built.input.specimenType) missing.push('ชนิด specimen');
  if (built.input.organismId == null) missing.push('เชื้อ');
  if (!built.input.ast.some((a) => a.result != null)) missing.push('ผล AST อย่างน้อย 1 รายการ');

  const phen = useMemo(() => {
    try {
      return { results: computePhenotypes(built.input, master, config.phenotypeRules, config.intrinsic), error: false };
    } catch {
      return { results: [], error: true };
    }
  }, [built.input, master, config.phenotypeRules, config.intrinsic]);
  const phenReady = built.input.organismId != null && built.input.ast.some((a) => a.result != null);

  const canConfirm = role === 'ICN' && total === 0 && missing.length === 0 && !submitting;

  // ----- submit: create (DRAFT) → approve -----
  async function submit(confirmDuplicate = false) {
    setSubmitting(true);
    setError(null);
    setDuplicate(null);
    try {
      if (draft) {
        // Draft from a previous attempt that could not be approved: replace it with the edited data.
        await fetch(`/api/isolates/${encodeURIComponent(draft.id)}`, { method: 'DELETE' }).catch(() => undefined);
        setDraft(null);
      }
      const res = await fetch('/api/isolates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: built.input, confirmDuplicate }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 409 && j.duplicate) {
        setDuplicate(j.duplicate as DuplicateInfo);
        return;
      }
      if (!res.ok) {
        setError({ text: j.error ?? `บันทึกไม่สำเร็จ (HTTP ${res.status})`, flags: Array.isArray(j.flags) ? j.flags : [] });
        return;
      }
      const created = { id: String(j.id), code: String(j.code) };
      if (Array.isArray(j.flags) && j.flags.length) {
        setDraft(created);
        setError({ text: `บันทึกเป็น DRAFT (${created.code}) แล้ว แต่การตรวจฝั่ง server พบธง จึงยังไม่ยืนยัน`, flags: j.flags });
        return;
      }
      const ap = await fetch(`/api/isolates/${encodeURIComponent(created.id)}/approve`, { method: 'POST' });
      const aj = await ap.json().catch(() => ({}));
      if (!ap.ok) {
        setDraft(created);
        setError({ text: `บันทึกเป็น DRAFT (${created.code}) แล้ว แต่ยืนยันไม่สำเร็จ: ${aj.error ?? ap.status}`, flags: Array.isArray(aj.flags) ? aj.flags : [] });
        return;
      }
      const org = master.organisms.find((o) => o.id === built.input.organismId);
      const ward = master.wards.find((w) => w.id === built.input.wardId);
      onSaved({
        id: created.id,
        code: created.code,
        organismName: org?.name ?? '',
        specimenDate: built.input.specimenDate ?? '',
        wardName: ward?.name ?? '',
        reportStatus: built.input.reportStatus,
        phenotypes: phen.results.filter((p) => p.result === 'POSITIVE').map((p) => p.code),
      });
    } catch {
      setError({ text: 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ', flags: [] });
    } finally {
      setSubmitting(false);
    }
  }

  const icuWards = master.wards.filter((w) => w.wardType === 'ICU');
  const nonIcuWards = master.wards.filter((w) => w.wardType !== 'ICU');
  const drugName = (id: number | null) => master.drugs.find((d) => d.id === id)?.name ?? '';
  const org = master.organisms.find((o) => o.id === fields.organismId);
  const sddAllowedFor = (drugId: number | null) =>
    !!org && config.sddAllowed.some((s) => s.group === org.group && s.drug.toLowerCase() === drugName(drugId).toLowerCase());

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (canConfirm) void submit(false);
      }}
      className="space-y-5"
      aria-label={mode === 'ocr' ? 'ตรวจข้อมูลที่ AI อ่านได้' : 'กรอกข้อมูล isolate'}
    >
      {/* Flag summary */}
      <div aria-live="polite">
        {total > 0 ? (
          <div className="rounded-md border border-amber-400 bg-amber-50 p-3 text-amber-900">
            <p className="font-semibold">พบ {total} รายการที่ต้องตรวจก่อนยืนยัน (ไฮไลต์สีเหลือง)</p>
            {extFlags.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {extFlags.map((x) => (
                  <li key={x.id} className="flex flex-wrap items-center gap-2">
                    <span>
                      ⚑ {FIELD_LABEL[x.field] ?? x.field}: {x.reason}
                    </span>
                    <button
                      type="button"
                      onClick={() => setExtFlags((fl) => fl.filter((y) => y.id !== x.id))}
                      className="min-h-9 rounded border border-amber-500 bg-white px-2 text-xs"
                    >
                      ตรวจแล้ว
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-emerald-800">ไม่มีธงค้าง</p>
        )}
      </div>

      {/* Section 1: patient */}
      <fieldset className="rounded-lg border border-slate-200 bg-white p-4">
        <legend className="px-1 font-semibold">1. ผู้ป่วย</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${idp}-hn`} label="HN" required reasons={reasonsOf('hn')}>
            <input
              id={`${idp}-hn`}
              inputMode="numeric"
              autoComplete="off"
              value={fields.hn}
              onChange={(e) => setField('hn', e.target.value)}
              aria-invalid={reasonsOf('hn').length > 0 || undefined}
              aria-describedby={describedBy(`${idp}-hn`, 'hn')}
              className={inputCls(reasonsOf('hn').length > 0)}
            />
          </Field>
          <Field id={`${idp}-sex`} label="เพศ" reasons={reasonsOf('sex')}>
            <select
              id={`${idp}-sex`}
              value={fields.sex}
              onChange={(e) => setField('sex', e.target.value as Fields['sex'])}
              className={inputCls(reasonsOf('sex').length > 0)}
            >
              <option value="">ไม่ระบุ</option>
              <option value="M">ชาย</option>
              <option value="F">หญิง</option>
            </select>
          </Field>
          <Field id={`${idp}-pt`} label="Patient Type" required reasons={reasonsOf('patientType')}>
            <div id={`${idp}-pt`} role="radiogroup" aria-label="Patient Type" className="flex gap-2">
              {(['OPD', 'IPD'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={fields.patientType === v}
                  onClick={() => setField('patientType', v)}
                  className={`h-11 flex-1 rounded-md border font-semibold ${
                    fields.patientType === v ? 'border-sky-700 bg-sky-700 text-white' : reasonsOf('patientType').length ? 'border-amber-500 bg-amber-50' : 'border-slate-300 bg-white'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </Field>
          <Field id={`${idp}-ward`} label="Ward" required reasons={reasonsOf('wardId')}>
            <select
              id={`${idp}-ward`}
              value={fields.wardId}
              onChange={(e) => setField('wardId', e.target.value)}
              aria-invalid={reasonsOf('wardId').length > 0 || undefined}
              aria-describedby={describedBy(`${idp}-ward`, 'wardId')}
              className={inputCls(reasonsOf('wardId').length > 0)}
            >
              <option value="">— เลือก Ward —</option>
              <optgroup label="ICU">
                {icuWards.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Non-ICU">
                {nonIcuWards.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </Field>
        </div>
      </fieldset>

      {/* Section 2: specimen */}
      <fieldset className="rounded-lg border border-slate-200 bg-white p-4">
        <legend className="px-1 font-semibold">2. Specimen</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${idp}-date`} label="วันที่รับตรวจ (ค.ศ.)" required reasons={reasonsOf('specimenDate')}>
            <input
              id={`${idp}-date`}
              type="date"
              max={today}
              value={fields.specimenDate}
              onChange={(e) => setField('specimenDate', e.target.value)}
              aria-invalid={reasonsOf('specimenDate').length > 0 || undefined}
              aria-describedby={describedBy(`${idp}-date`, 'specimenDate')}
              className={inputCls(reasonsOf('specimenDate').length > 0)}
            />
            {fields.specimenDate && <p className="mt-1 text-xs text-slate-500">{thaiDate(fields.specimenDate)}</p>}
          </Field>
          <Field id={`${idp}-stype`} label="ชนิด specimen" required reasons={reasonsOf('specimenType')}>
            <select
              id={`${idp}-stype`}
              value={fields.specimenType}
              onChange={(e) => setField('specimenType', e.target.value as Fields['specimenType'])}
              aria-invalid={reasonsOf('specimenType').length > 0 || undefined}
              className={inputCls(reasonsOf('specimenType').length > 0)}
            >
              <option value="">— เลือก —</option>
              {SPECIMENS.map((s) => (
                <option key={s} value={s}>
                  {SPECIMEN_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field id={`${idp}-sdetail`} label="รายละเอียด specimen" reasons={reasonsOf('specimenDetail')}>
            <input
              id={`${idp}-sdetail`}
              value={fields.specimenDetail}
              onChange={(e) => setField('specimenDetail', e.target.value)}
              placeholder="เช่น Hemoculture"
              className={inputCls(reasonsOf('specimenDetail').length > 0)}
            />
          </Field>
          <Field id={`${idp}-labno`} label="Lab No" reasons={reasonsOf('labNo')}>
            <input
              id={`${idp}-labno`}
              value={fields.labNo}
              onChange={(e) => setField('labNo', e.target.value)}
              className={inputCls(reasonsOf('labNo').length > 0)}
            />
          </Field>
          <Field id={`${idp}-orderno`} label="Order No" reasons={reasonsOf('orderNo')}>
            <input
              id={`${idp}-orderno`}
              value={fields.orderNo}
              onChange={(e) => setField('orderNo', e.target.value)}
              className={inputCls(reasonsOf('orderNo').length > 0)}
            />
          </Field>
          <Field id={`${idp}-rs`} label="สถานะรายงาน" required reasons={reasonsOf('reportStatus')}>
            <select
              id={`${idp}-rs`}
              value={fields.reportStatus}
              onChange={(e) => setField('reportStatus', e.target.value as ReportStatus)}
              className={inputCls(reasonsOf('reportStatus').length > 0)}
            >
              {(['FINAL', 'PRELIMINARY', 'UNKNOWN'] as const).map((s) => (
                <option key={s} value={s}>
                  {REPORT_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            {fields.reportStatus !== 'FINAL' && (
              <p className="mt-1 text-xs text-slate-600">บันทึกได้ แต่ไม่นับในสถิติจนกว่าจะเป็น Final</p>
            )}
          </Field>
        </div>
      </fieldset>

      {/* Section 3: organism + AST */}
      <fieldset className="rounded-lg border border-slate-200 bg-white p-4">
        <legend className="px-1 font-semibold">3. เชื้อและผล AST</legend>
        <Field id={`${idp}-org`} label="เชื้อ" required reasons={reasonsOf('organismId')}>
          <OrganismPicker
            inputId={`${idp}-org`}
            organisms={master.organisms}
            value={fields.organismId}
            onChange={changeOrganism}
            invalid={reasonsOf('organismId').length > 0}
            describedBy={describedBy(`${idp}-org`, 'organismId')}
          />
          {mode === 'manual' && <p className="mt-1 text-xs text-slate-500">เลือกเชื้อแล้วระบบจะแสดงชุดยามาตรฐานของกลุ่มเชื้อ</p>}
        </Field>

        {generalAst.length > 0 && (
          <ul className="mt-3 space-y-0.5 rounded-md border border-amber-400 bg-amber-50 p-2 text-sm text-amber-800">
            {generalAst.map((r, i) => (
              <li key={i}>⚑ {r}</li>
            ))}
          </ul>
        )}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left">
            <caption className="sr-only">ผล AST ต่อยา</caption>
            <thead>
              <tr className="border-b border-slate-200 text-sm text-slate-600">
                <th scope="col" className="py-2 pr-2">ยา</th>
                <th scope="col" className="py-2 pr-2">ผล (แตะซ้ำเพื่อล้าง)</th>
                <th scope="col" className="py-2"><span className="sr-only">ลบ</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const reasons = rowReasons[r.key] ?? [];
                const name = drugName(r.drugId);
                return (
                  <tr key={r.key} className={`border-b border-slate-100 align-top ${reasons.length ? 'bg-amber-50' : ''}`}>
                    <td className="py-2 pr-2">
                      {r.fixed ? (
                        <span className="font-medium">{name}</span>
                      ) : (
                        <select
                          aria-label="ยา"
                          value={r.drugId ?? ''}
                          onChange={(e) => updateRow(r.key, { drugId: e.target.value ? Number(e.target.value) : null })}
                          className={inputCls(reasons.length > 0)}
                        >
                          <option value="">— เลือกยา —</option>
                          {master.drugs.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      )}
                      {r.drugRaw && r.drugRaw !== name && (
                        <span className="mt-0.5 block text-xs text-slate-500">อ่านได้: {r.drugRaw}</span>
                      )}
                      {reasons.length > 0 && (
                        <ul className="mt-1 text-sm text-amber-800">
                          {reasons.map((x, i) => (
                            <li key={i}>⚑ {x}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="py-2 pr-2">
                      <div role="group" aria-label={`ผลของ ${name || 'ยา'}`} className="flex gap-1">
                        {CODES.map((c) => {
                          const on = r.result === c;
                          const dDisabled = c === 'D' && !on && !sddAllowedFor(r.drugId);
                          return (
                            <button
                              key={c}
                              type="button"
                              aria-pressed={on}
                              disabled={dDisabled}
                              title={dDisabled ? 'D (SDD) ใช้ได้เฉพาะคู่ในตาราง sdd_allowed [J]' : undefined}
                              onClick={() => updateRow(r.key, { result: on ? null : c })}
                              className={`h-11 w-11 rounded-md border text-base font-bold ${
                                on ? RESULT_BTN[c] : 'border-slate-300 bg-white text-slate-700'
                              } disabled:opacity-30`}
                            >
                              {c}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeRow(r.key)}
                        aria-label={`ลบแถว ${name || 'ยา'}`}
                        className="h-11 rounded-md border border-slate-300 px-3 text-sm text-slate-600"
                      >
                        ลบ
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-3 text-sm text-slate-500">
                    {mode === 'manual' ? 'เลือกเชื้อเพื่อแสดงชุดยามาตรฐาน' : 'ไม่มีผล AST'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={addRow} className="min-h-11 rounded-md border border-slate-300 bg-white px-4 text-sm">
            + เพิ่มยา
          </button>
          <span className="text-xs text-slate-500">ผล D (SDD) ใช้ได้เฉพาะคู่ยา–กลุ่มเชื้อในตาราง sdd_allowed · [J] ฉบับร่าง</span>
        </div>
        <div className="mt-4">
          <Field id={`${idp}-comments`} label="หมายเหตุแล็บ" reasons={reasonsOf('labComments')}>
            <textarea
              id={`${idp}-comments`}
              rows={2}
              value={fields.labComments}
              onChange={(e) => setField('labComments', e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-base"
            />
          </Field>
        </div>
        {reasonsOf('other').length > 0 && (
          <ul className="mt-3 text-sm text-amber-800">
            {reasonsOf('other').map((r, i) => (
              <li key={i}>⚑ {r}</li>
            ))}
          </ul>
        )}
      </fieldset>

      <PhenotypePreview results={phen.results} ready={phenReady} error={phen.error} />

      {/* Duplicate warning (MR2.5) */}
      {duplicate && (
        <div role="alert" className="rounded-md border border-orange-400 bg-orange-50 p-4 text-orange-900">
          <p className="font-semibold">พบข้อมูลที่อาจซ้ำ ({duplicate.matchedBy === 'LAB_NO' ? 'Lab No เดียวกัน' : 'HN + เชื้อ + specimen + วันที่ เดียวกัน'})</p>
          <p className="mt-1 text-sm">
            {duplicate.code} · HN {duplicate.hn} · Lab No {duplicate.labNo ?? '—'} · {thaiDate(duplicate.specimenDate)} ·{' '}
            <span className="italic">{duplicate.organismName}</span> · {duplicate.wardName ?? 'ไม่ระบุ ward'} · {duplicate.status}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void submit(true)} disabled={submitting} className="min-h-11 rounded-md bg-orange-600 px-4 font-semibold text-white disabled:opacity-50">
              ยืนยันว่าไม่ซ้ำ และบันทึกต่อ
            </button>
            <button type="button" onClick={() => setDuplicate(null)} className="min-h-11 rounded-md border border-slate-300 bg-white px-4">
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-red-800">
          <p className="font-semibold">{error.text}</p>
          {error.flags.length > 0 && (
            <ul className="mt-1 text-sm">
              {error.flags.map((f, i) => (
                <li key={i}>
                  ⚑ {f.path}: {f.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
        <button
          type="submit"
          disabled={!canConfirm}
          className="min-h-12 rounded-md bg-emerald-700 px-6 text-lg font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? 'กำลังบันทึก…' : 'ยืนยันข้อมูล'}
        </button>
        <div className="text-sm text-slate-600" aria-live="polite">
          {role !== 'ICN' && <p>เฉพาะบทบาท ICN เท่านั้นที่ยืนยันข้อมูลได้ (สลับบทบาทที่มุมขวาบน)</p>}
          {missing.length > 0 && <p>ยังขาด: {missing.join(', ')}</p>}
          {total > 0 && <p>ยังมีธงค้าง {total} รายการ</p>}
        </div>
      </div>
    </form>
  );
}
