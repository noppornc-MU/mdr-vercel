// First-isolate rule (design §4.3, CLSI M39 style). Pure.
import type { DomainIsolate } from './types';

export interface PeriodFilter { from?: string | null; to?: string | null }

/** Approved data = status APPROVED and report FINAL (only these enter statistics). */
export function isCountable(iso: Pick<DomainIsolate, 'status' | 'reportStatus'>): boolean {
  return iso.status === 'APPROVED' && iso.reportStatus === 'FINAL';
}

/** Inclusive period check on 'YYYY-MM-DD' strings; missing bounds are open. */
export function inPeriod(date: string, period: PeriodFilter = {}): boolean {
  const d = date.slice(0, 10);
  if (period.from && d < period.from.slice(0, 10)) return false;
  if (period.to && d > period.to.slice(0, 10)) return false;
  return true;
}

/** Deterministic ordering: (specimenDate, createdAt, code). */
export function compareIsolates(a: DomainIsolate, b: DomainIsolate): number {
  if (a.specimenDate !== b.specimenDate) return a.specimenDate < b.specimenDate ? -1 : 1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  if (a.code !== b.code) return a.code < b.code ? -1 : 1;
  return 0;
}

/**
 * First isolate per patient (HN) per organism within the period.
 * Scope: APPROVED + FINAL + orgClass BACTERIA + specimenDate in [from, to].
 * Returned sorted by (specimenDate, createdAt, code); never more rows than the input.
 */
export function firstIsolates<T extends DomainIsolate>(isolates: readonly T[], period: PeriodFilter = {}): T[] {
  const best = new Map<string, T>();
  for (const iso of isolates) {
    if (!isCountable(iso) || iso.organism.orgClass !== 'BACTERIA' || !inPeriod(iso.specimenDate, period)) continue;
    const key = `${iso.hn}\u0000${iso.organism.id}`;
    const cur = best.get(key);
    if (!cur || compareIsolates(iso, cur) < 0) best.set(key, iso);
  }
  return [...best.values()].sort(compareIsolates);
}
