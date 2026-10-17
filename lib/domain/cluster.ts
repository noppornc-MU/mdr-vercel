// Suspected cluster detection (design §4.3, MR8). Pure.
// Same watch key (organism or phenotype) + same ward + ≥ minPatients DISTINCT HN within windowDays;
// overlapping windows are merged into one episode; isolates without a ward are skipped.
import type { ClusterEpisode, DomainIsolate, PhenotypeCode } from './types';
import { diffDays } from './dates';
import { PHENOTYPE_CODES } from './phenotype';

export interface ClusterOptions {
  windowDays?: number;
  minPatients?: number;
  /** Returns the grouping key for a watched isolate, or null to ignore it.
   *  If the key is a PhenotypeCode or starts with "<PhenotypeCode>:" the episode's `phenotype` is set. */
  watchKey: (iso: DomainIsolate) => string | null;
}

function phenotypeOfKey(key: string): PhenotypeCode | null {
  const head = key.split(':')[0];
  return (PHENOTYPE_CODES as string[]).includes(head) ? (head as PhenotypeCode) : null;
}

export function detectClusters(isolates: readonly DomainIsolate[], opts: ClusterOptions): ClusterEpisode[] {
  const windowDays = opts.windowDays ?? 14;
  const minPatients = opts.minPatients ?? 3;
  const groups = new Map<string, { key: string; wardId: number; items: DomainIsolate[] }>();

  for (const iso of isolates) {
    if (iso.wardId === null || iso.wardId === undefined) continue; // MR8.3
    const key = opts.watchKey(iso);
    if (!key) continue;
    const gk = `${key}\u0000${iso.wardId}`;
    const g = groups.get(gk) ?? { key, wardId: iso.wardId, items: [] };
    g.items.push(iso);
    groups.set(gk, g);
  }

  const episodes: ClusterEpisode[] = [];
  for (const g of groups.values()) {
    const items = [...g.items].sort((a, b) => (a.specimenDate < b.specimenDate ? -1 : a.specimenDate > b.specimenDate ? 1 : a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
    // candidate windows [i, end] starting at each isolate
    const ranges: [number, number][] = [];
    for (let i = 0; i < items.length; i++) {
      const hns = new Set<string>();
      let j = i;
      while (j < items.length && diffDays(items[i].specimenDate, items[j].specimenDate) < windowDays) { hns.add(items[j].hn); j++; }
      if (hns.size >= minPatients) ranges.push([i, j - 1]);
    }
    // merge overlapping candidates into episodes
    const merged: [number, number][] = [];
    for (const r of ranges) {
      const last = merged[merged.length - 1];
      if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
      else merged.push([r[0], r[1]]);
    }
    for (const [s, e] of merged) {
      const part = items.slice(s, e + 1);
      const patients = [...new Set(part.map((x) => x.hn))].sort();
      const organisms = [...new Set(part.map((x) => x.organism.name))].sort();
      episodes.push({
        key: `${g.key}|${g.wardId}|${part[0].specimenDate}`,
        organism: organisms.join(', '),
        phenotype: phenotypeOfKey(g.key),
        wardId: g.wardId,
        wardName: part[0].wardName ?? '',
        firstDate: part[0].specimenDate,
        lastDate: part[part.length - 1].specimenDate,
        patientCount: patients.length,
        patients,
        isolateIds: part.map((x) => x.id),
      });
    }
  }
  return episodes.sort((a, b) => (a.lastDate < b.lastDate ? 1 : a.lastDate > b.lastDate ? -1 : a.key.localeCompare(b.key)));
}
