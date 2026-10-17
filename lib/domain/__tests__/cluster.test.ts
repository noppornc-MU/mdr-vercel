import { describe, expect, it } from 'vitest';
import { detectClusters } from '../cluster';
import type { DomainIsolate } from '../types';
import { AB, day, iso } from './helpers';

const byOrganism = (x: DomainIsolate) => x.organism.name;
const ward = { wardId: 7, wardName: 'Ward X' };

describe('cluster detection', () => {
  it('test vector 2: P1 d1, P2 d5, P1 d8, P3 d13 → 4 rows, 3 patients → cluster', () => {
    const rows = [
      iso({ ...ward, hn: 'P1', organism: AB, specimenDate: day(1) }),
      iso({ ...ward, hn: 'P2', organism: AB, specimenDate: day(5) }),
      iso({ ...ward, hn: 'P1', organism: AB, specimenDate: day(8) }),
      iso({ ...ward, hn: 'P3', organism: AB, specimenDate: day(13) }),
    ];
    const eps = detectClusters(rows, { watchKey: byOrganism });
    expect(eps).toHaveLength(1);
    expect(eps[0]).toMatchObject({ patientCount: 3, patients: ['P1', 'P2', 'P3'], firstDate: day(1), lastDate: day(13), wardId: 7, wardName: 'Ward X', phenotype: null });
    expect(eps[0].isolateIds).toHaveLength(4);
  });

  it('test vector 3: P1 d1, P1 d3, P2 d5 → 3 rows, 2 patients → not a cluster', () => {
    const rows = [
      iso({ ...ward, hn: 'P1', organism: AB, specimenDate: day(1) }),
      iso({ ...ward, hn: 'P1', organism: AB, specimenDate: day(3) }),
      iso({ ...ward, hn: 'P2', organism: AB, specimenDate: day(5) }),
    ];
    expect(detectClusters(rows, { watchKey: byOrganism })).toEqual([]);
  });

  it('14-day window: day 1 + day 14 inside, day 15 outside', () => {
    const mk = (d3: number) => [
      iso({ ...ward, hn: 'A', organism: AB, specimenDate: day(1) }),
      iso({ ...ward, hn: 'B', organism: AB, specimenDate: day(5) }),
      iso({ ...ward, hn: 'C', organism: AB, specimenDate: day(d3) }),
    ];
    expect(detectClusters(mk(14), { watchKey: byOrganism })).toHaveLength(1);
    expect(detectClusters(mk(15), { watchKey: byOrganism })).toHaveLength(0);
  });

  it('skips unknown ward, separates wards, merges overlapping windows', () => {
    const noWard = ['A', 'B', 'C'].map((hn, i) => iso({ wardId: null, wardName: null, hn, organism: AB, specimenDate: day(1 + i) }));
    expect(detectClusters(noWard, { watchKey: byOrganism })).toEqual([]);
    const split = ['A', 'B', 'C'].map((hn, i) => iso({ wardId: i + 1, hn, organism: AB, specimenDate: day(1 + i) }));
    expect(detectClusters(split, { watchKey: byOrganism })).toEqual([]);
    const chain = ['A', 'B', 'C', 'D', 'E'].map((hn, i) => iso({ ...ward, hn, organism: AB, specimenDate: day(1 + i * 6) })); // d1,7,13,19,25
    const eps = detectClusters(chain, { watchKey: byOrganism });
    expect(eps).toHaveLength(1);
    expect(eps[0]).toMatchObject({ firstDate: day(1), lastDate: day(25), patientCount: 5 });
  });

  it('phenotype keys set episode.phenotype; null key = not watched', () => {
    const rows = ['A', 'B', 'C'].map((hn, i) => iso({ ...ward, hn, organism: AB, specimenDate: day(1 + i) }));
    expect(detectClusters(rows, { watchKey: (x) => `CRAB:${x.organism.name}` })[0].phenotype).toBe('CRAB');
    expect(detectClusters(rows, { watchKey: () => null })).toEqual([]);
  });
});
