// Deterministic check of an AI Consult answer against the toolResults of the same request (design §6.4, MR15).
import type { ConsultOutput, ConsultToolResults, ToolCall } from './schema';

export interface VerifyResult {
  passed: boolean;
  errors: string[];
}

const TOL = 0.1;
const NUM_RE = /\d+(?:[.,]\d+)?/g;
/** Dose / frequency / duration patterns (MR13.5). */
const DOSE_RE =
  /\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|ug|g|gm|gram|grams|ml|mL|unit|units|iu|IU|มก\.?|มิลลิกรัม|กรัม|ยูนิต)\b|mg\s*\/\s*kg|g\s*\/\s*kg|\bq\s*\d+\s*h\b|\bq\d+h\b|\b(?:bid|tid|qid|od|prn)\b|วันละ|ครั้งละ|ทุก\s*\S*\s*ชั่วโมง|ชั่วโมงละ|loading\s+dose|ขนาดยา\s*\d/i;

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const numbersIn = (s: string): number[] => (s.match(NUM_RE) ?? []).map((x) => Number(x.replace(',', '.')));
const near = (a: number, b: number) => Math.abs(a - b) <= TOL + 1e-9;

function callById(tr: ConsultToolResults, id: string): ToolCall | undefined {
  return tr.calls.find((c) => c.call_id === id);
}

export function verify(out: ConsultOutput, toolResults: ConsultToolResults): VerifyResult {
  const errors: string[] = [];
  const minN = toolResults.meta.minN;

  // Numbers that may legitimately appear anywhere: min N + numbers inside scope strings (ward names, period).
  const scopeNumbers = [
    minN,
    ...numbersIn(
      [out.scope.organism, out.scope.ward, out.scope.specimen_category, out.scope.period, out.scope.data_as_of].join(' '),
    ),
  ];

  if (out.scope.min_n !== minN) errors.push(`scope.min_n (${out.scope.min_n}) ไม่ตรงกับ minN ของระบบ (${minN})`);
  if (out.disclaimer_shown !== true) errors.push('ไม่มี disclaimer');

  // Rule 1 — every fact must match its call_id result.
  const factNumbers: number[] = [];
  const factIds = new Set<string>();
  for (const f of out.facts) {
    if (factIds.has(f.id)) errors.push(`fact id ซ้ำ: ${f.id}`);
    factIds.add(f.id);
    const call = callById(toolResults, f.call_id);
    if (!call) {
      errors.push(`${f.id}: ไม่พบ call_id "${f.call_id}" ใน toolResults`);
      continue;
    }
    const allowed: number[] = [...scopeNumbers];
    if (call.tool === 'isolate') {
      const row = call.ast.find((a) => norm(a.drug) === norm(f.drug));
      if (norm(call.organism) !== norm(f.organism)) errors.push(`${f.id}: เชื้อ "${f.organism}" ไม่ตรงกับ isolate`);
      if (!row) errors.push(`${f.id}: ยา "${f.drug}" ไม่อยู่ในผล AST ของ isolate`);
      else if (f.result && f.result !== row.result) errors.push(`${f.id}: ผล ${f.drug} ไม่ตรงกับผลแล็บ (${row.result})`);
      if (f.pct_s !== null || f.n_tested !== null) errors.push(`${f.id}: fact จาก isolate ต้องไม่มี pct_s/n_tested`);
    } else {
      const cell = call.cells.find((c) => norm(c.drug) === norm(f.drug) && norm(c.organism) === norm(f.organism));
      if (!cell) {
        errors.push(`${f.id}: ไม่พบคู่ ${f.organism} × ${f.drug} ใน ${f.call_id}`);
        continue;
      }
      if (f.n_tested === null || f.n_tested !== cell.nTested) {
        errors.push(`${f.id}: n_tested ${f.n_tested} ≠ ${cell.nTested}`);
      }
      if (cell.pctS === null) {
        if (f.pct_s !== null) errors.push(`${f.id}: ${f.drug} ไม่มี %S ที่ใช้ได้ (n<${minN} หรือ intrinsic) แต่ fact ระบุ ${f.pct_s}`);
      } else if (f.pct_s === null || !near(f.pct_s, cell.pctS)) {
        errors.push(`${f.id}: pct_s ${f.pct_s} ≠ ${cell.pctS}`);
      }
      if (f.tier && f.tier !== cell.tier) errors.push(`${f.id}: tier ${f.tier} ≠ ${cell.tier}`);
      allowed.push(cell.nTested, cell.s, cell.i, cell.r, cell.d);
      if (cell.pctS !== null) allowed.push(cell.pctS);
      if (cell.pctSDD !== null) allowed.push(cell.pctSDD);
    }
    for (const n of numbersIn(f.statement)) {
      if (!allowed.some((a) => near(a, n))) errors.push(`${f.id}: ข้อความมีตัวเลข ${n} ที่ไม่อยู่ในผลคำนวณ`);
    }
    if (f.pct_s !== null) factNumbers.push(f.pct_s);
    if (f.n_tested !== null) factNumbers.push(f.n_tested);
    for (const n of numbersIn(f.statement)) factNumbers.push(n);
  }

  // Rules 2 + 3 — reasoning has no new numbers; depends_on points to real facts.
  const reasoningAllowed = [...scopeNumbers, ...factNumbers];
  out.reasoning.forEach((r, i) => {
    for (const n of numbersIn(r.statement)) {
      if (!reasoningAllowed.some((a) => near(a, n))) errors.push(`reasoning[${i}]: ตัวเลขใหม่ ${n} ที่ไม่อยู่ใน facts`);
    }
    for (const d of r.depends_on) if (!factIds.has(d)) errors.push(`reasoning[${i}]: depends_on "${d}" ไม่มีอยู่จริง`);
  });

  // Rule 4 — abstention ⇒ no fact presented as supporting a drug.
  if (out.abstentions.length > 0) {
    for (const f of out.facts) {
      if (f.tier === 'SUPPORTED' || f.tier === 'CONSIDER') {
        errors.push(`${f.id}: มีการงดตอบ (${out.abstentions.map((a) => a.reason).join(', ')}) แต่ยังแสดง ${f.drug} เป็นยาที่ข้อมูลสนับสนุน`);
      }
    }
  }

  // Rule 5 — no dose / frequency / duration anywhere.
  const texts: [string, string][] = [
    ...out.facts.map((f) => [f.id, f.statement] as [string, string]),
    ...out.reasoning.map((r, i) => [`reasoning[${i}]`, r.statement] as [string, string]),
    ...out.needs_clinician_judgment.map((s, i) => [`needs_clinician_judgment[${i}]`, s] as [string, string]),
    ...out.abstentions.map((a, i) => [`abstentions[${i}]`, a.detail] as [string, string]),
  ];
  for (const [where, s] of texts) {
    if (DOSE_RE.test(s)) errors.push(`${where}: มีขนาดยา/ความถี่/ระยะเวลา`);
  }
  // Wording rule (MR11.2): never "first-line / drug of choice / แนะนำให้ใช้".
  for (const [where, s] of texts) {
    if (/first[\s-]?line|drug of choice|แนะนำให้ใช้/i.test(s)) errors.push(`${where}: ใช้ถ้อยคำสั่งการรักษา`);
  }

  return { passed: errors.length === 0, errors };
}
