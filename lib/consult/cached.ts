// AI_MODE=cached: deterministic composer. Builds the consult JSON from the CURRENT toolResults
// using the text templates in fixtures/consult_cached.json (no frozen numbers). Output goes
// through the same Zod schema + verify() as a live model answer.
import templatesJson from '@/fixtures/consult_cached.json';
import { formatThaiDate } from '@/lib/domain/dates';
import { organismMatches } from '@/lib/domain/names';
import type { AbgCell } from '@/lib/domain/types';
import type { AbgToolCall, ConsultFact, ConsultOutput, ConsultToolResults, IsolateToolCall } from './schema';

type Templates = typeof templatesJson;
const T: Templates = templatesJson;

const DOSE_QUESTION_RE =
  /ขนาดยา|ขนาดของยา|\bdos(e|es|ing|age)\b|\bmg\b|มิลลิกรัม|กี่กรัม|ให้ยา.*(เท่าไร|เท่าไหร่|กี่)|ความถี่|ระยะเวลา.*ยา|ให้.*กี่วัน|loading/i;

export function isDoseQuestion(q: string | null | undefined): boolean {
  return DOSE_QUESTION_RE.test(String(q ?? ''));
}

const fill = (tpl: string, vars: Record<string, string | number>) =>
  tpl.replace(/\{(\w+)\}/g, (_, k: string) => (vars[k] === undefined ? `{${k}}` : String(vars[k])));
const pct = (n: number) => n.toFixed(1);

export function scopeLabels(tr: ConsultToolResults) {
  const s = tr.scope;
  const iso = tr.calls.find((c): c is IsolateToolCall => c.tool === 'isolate');
  const organism =
    s.organism ?? iso?.organism ?? (s.phenotype ? T.labels.phenotype[s.phenotype] : T.labels.none);
  const organismWithPheno = s.phenotype && s.organism ? `${s.organism} (${T.labels.phenotype[s.phenotype]})` : organism;
  const ward =
    s.wardName ?? (s.wardType === 'ICU' ? T.labels.ward_icu : s.wardType === 'NON_ICU' ? T.labels.ward_non_icu : T.labels.ward_all);
  const specimen = s.specimenType ? T.labels.specimen[s.specimenType] : T.labels.specimen.ALL;
  const period = `${formatThaiDate(tr.meta.from)} ถึง ${formatThaiDate(tr.meta.to)}`;
  return { organism: organismWithPheno, organismPlain: organism, ward, specimen, period, dataAsOf: formatThaiDate(tr.meta.dataAsOf) };
}

/** The cells the answer is about: phenotype subset if requested, else the organism's overall cells. */
export function mainCall(tr: ConsultToolResults): { call: AbgToolCall; cells: AbgCell[] } | null {
  const abgCalls = tr.calls.filter((c): c is AbgToolCall => c.tool !== 'isolate');
  const call = abgCalls.find((c) => c.tool === 'getPhenotypeBreakdown') ?? abgCalls[0];
  if (!call) return null;
  const org = tr.scope.organism ?? tr.calls.find((c): c is IsolateToolCall => c.tool === 'isolate')?.organism ?? null;
  let cells = call.cells;
  if (org) {
    const filtered = cells.filter((c) => organismMatches(c.organism, org));
    if (filtered.length > 0 || call.tool === 'getAntibiogram') cells = filtered;
  }
  return { call, cells: cells.filter((c) => !c.intrinsic) };
}

export function composeCachedConsult(args: { question: string; toolResults: ConsultToolResults }): ConsultOutput {
  const tr = args.toolResults;
  const minN = tr.meta.minN;
  const L = scopeLabels(tr);
  const out: ConsultOutput = {
    scope: {
      organism: L.organism,
      ward: L.ward,
      specimen_category: L.specimen,
      period: L.period,
      data_as_of: L.dataAsOf,
      min_n: minN,
    },
    facts: [],
    reasoning: [],
    needs_clinician_judgment: [],
    abstentions: [],
    disclaimer_shown: true,
  };
  const vars = { organism: L.organism, ward: L.ward, specimen: L.specimen, period: L.period, min_n: minN };

  // 1) Dose / frequency / duration requests → refuse, point to hospital guideline (MR13.5, DoD 6).
  if (isDoseQuestion(args.question)) {
    out.abstentions.push({ reason: 'dose_requested', detail: T.dose.detail });
    out.needs_clinician_judgment = [...T.dose.judgment];
    return out;
  }

  const iso = tr.calls.find((c): c is IsolateToolCall => c.tool === 'isolate') ?? null;
  const main = mainCall(tr);
  if (!main && !iso) {
    out.abstentions.push({ reason: 'out_of_scope', detail: T.out_of_scope.detail });
    out.needs_clinician_judgment = [...T.out_of_scope.judgment];
    return out;
  }

  let seq = 0;
  const nextId = () => `f${++seq}`;
  const cells = main?.cells ?? [];
  const tested = cells.filter((c) => c.nTested > 0);
  const sufficient = tested
    .filter((c) => !c.insufficient && c.pctS !== null)
    .sort((a, b) => (b.pctS ?? 0) - (a.pctS ?? 0) || b.nTested - a.nTested);
  const lowData = tested.filter((c) => c.insufficient || c.pctS === null).sort((a, b) => b.nTested - a.nTested);

  // 2) Isolate's own lab result facts (MR14.3) — kept separate from local-data facts.
  const isoFacts: ConsultFact[] = [];
  if (iso) {
    for (const a of iso.ast.filter((x) => x.result === 'S')) {
      isoFacts.push({
        id: nextId(),
        statement: fill(T.fact.isolate, { drug: a.drug, result: a.result }),
        organism: iso.organism,
        drug: a.drug,
        pct_s: null,
        n_tested: null,
        call_id: iso.call_id,
        tier: null,
        result: a.result,
      });
    }
  }

  // 3) No data at all.
  if (main && tested.length === 0) {
    out.facts = isoFacts;
    out.abstentions.push({ reason: 'no_data', detail: fill(T.no_data.detail, vars) });
    out.needs_clinician_judgment = [...T.no_data.judgment];
    return out;
  }

  const lowFacts: ConsultFact[] = lowData.map((c) => ({
    id: nextId(),
    statement: fill(T.fact.low_n, { organism: c.organism, drug: c.drug, n_tested: c.nTested, min_n: minN }),
    organism: c.organism,
    drug: c.drug,
    pct_s: null,
    n_tested: c.nTested,
    call_id: main!.call.call_id,
    tier: 'LOW_DATA',
  }));

  // 4) Every drug below min N → abstain, offer widening (no automatic widening).
  if (main && sufficient.length === 0) {
    const maxN = Math.max(...tested.map((c) => c.nTested));
    out.facts = [...isoFacts, ...lowFacts];
    out.abstentions.push({ reason: 'n_below_minimum', detail: fill(T.low_n.detail, { ...vars, max_n: maxN }) });
    out.needs_clinician_judgment = [...T.low_n.judgment];
    return out;
  }

  // 5) Normal answer: facts sorted by %S with tier labels.
  const abgFacts: ConsultFact[] = sufficient.map((c) => {
    let statement = fill(T.fact.abg, {
      organism: c.organism,
      drug: c.drug,
      pct_s: pct(c.pctS as number),
      n_tested: c.nTested,
      tier_label: T.labels.tier[c.tier],
    });
    if (c.sddApplicable && c.pctSDD !== null && c.d > 0) statement += fill(T.fact.abg_sdd, { pct_sdd: pct(c.pctSDD) });
    return {
      id: nextId(),
      statement,
      organism: c.organism,
      drug: c.drug,
      pct_s: c.pctS,
      n_tested: c.nTested,
      call_id: main!.call.call_id,
      tier: c.tier,
    };
  });
  out.facts = [...isoFacts, ...abgFacts, ...lowFacts];

  const R = T.supported_drugs.reasoning;
  const byTier = (tier: string) => abgFacts.filter((f) => f.tier === tier);
  const list = (fs: ConsultFact[]) => fs.map((f) => f.drug).join(', ');
  const sup = byTier('SUPPORTED');
  const con = byTier('CONSIDER');
  const nsup = byTier('NOT_SUPPORTED');
  if (sup.length) out.reasoning.push({ statement: fill(R.supported, { drugs: list(sup) }), depends_on: sup.map((f) => f.id) });
  else out.reasoning.push({ statement: R.none_supported, depends_on: abgFacts.map((f) => f.id) });
  if (con.length) out.reasoning.push({ statement: fill(R.consider, { drugs: list(con) }), depends_on: con.map((f) => f.id) });
  if (nsup.length) out.reasoning.push({ statement: fill(R.not_supported, { drugs: list(nsup) }), depends_on: nsup.map((f) => f.id) });
  if (lowFacts.length) out.reasoning.push({ statement: fill(R.low_data_some, { drugs: list(lowFacts) }), depends_on: lowFacts.map((f) => f.id) });
  if (tr.scope.phenotype && main?.call.tool === 'getPhenotypeBreakdown') {
    out.reasoning.push({
      statement: fill(R.phenotype, { phenotype: T.labels.phenotype[tr.scope.phenotype] }),
      depends_on: abgFacts.map((f) => f.id),
    });
  }
  if (iso && isoFacts.length) {
    const supDrugs = new Set(sup.map((f) => f.drug.toLowerCase()));
    const both = isoFacts.filter((f) => supDrugs.has(f.drug.toLowerCase()));
    const labOnly = isoFacts.filter((f) => !supDrugs.has(f.drug.toLowerCase()));
    if (both.length) {
      const deps = [...both.map((f) => f.id), ...sup.filter((f) => both.some((b) => b.drug.toLowerCase() === f.drug.toLowerCase())).map((f) => f.id)];
      out.reasoning.push({ statement: fill(R.isolate_both, { drugs: list(both) }), depends_on: deps });
    }
    if (labOnly.length) out.reasoning.push({ statement: fill(R.isolate_lab_only, { drugs: list(labOnly) }), depends_on: labOnly.map((f) => f.id) });
  }
  out.needs_clinician_judgment = [...T.supported_drugs.judgment];
  return out;
}
