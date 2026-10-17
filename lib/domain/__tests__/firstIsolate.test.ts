import { describe, expect, it } from 'vitest';
import { firstIsolates } from '../firstIsolate';
import type { DomainIsolate } from '../types';
import { AB, CA, EC, KP, iso } from './helpers';

/** Deterministic PRNG (mulberry32). */
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomIsolates(n: number, seed = 42): DomainIsolate[] {
  const r = rng(seed);
  const orgs = [KP, EC, AB, CA];
  return Array.from({ length: n }, (_, i) => iso({
    code: `ISO-${String(i).padStart(5, '0')}`,
    hn: String(Math.floor(r() * 40)).padStart(7, '0'),
    organism: orgs[Math.floor(r() * orgs.length)],
    specimenDate: `2026-0${1 + Math.floor(r() * 6)}-1${Math.floor(r() * 9)}`,
    createdAt: `2026-07-01T00:00:0${Math.floor(r() * 9)}.000Z`,
    status: r() < 0.9 ? 'APPROVED' : 'DRAFT',
    reportStatus: r() < 0.9 ? 'FINAL' : 'PRELIMINARY',
  }));
}

describe('firstIsolates', () => {
  it('keeps the earliest per (HN, organism) with tie-break createdAt then code', () => {
    const a = iso({ hn: '0001', organism: KP, specimenDate: '2026-02-01', code: 'ISO-3' });
    const b = iso({ hn: '0001', organism: KP, specimenDate: '2026-01-15', createdAt: '2026-01-15T05:00:00.000Z', code: 'ISO-9' });
    const c = iso({ hn: '0001', organism: KP, specimenDate: '2026-01-15', createdAt: '2026-01-15T05:00:00.000Z', code: 'ISO-2' });
    const d = iso({ hn: '0001', organism: EC, specimenDate: '2026-03-01' });
    const out = firstIsolates([a, b, c, d]);
    expect(out.map((x) => x.id)).toEqual([c.id, d.id]);
  });

  it('excludes DRAFT, non-FINAL, yeast and out-of-period rows; HN keeps leading zeros', () => {
    const rows = [
      iso({ hn: '0000123', status: 'DRAFT' }),
      iso({ hn: '0000124', reportStatus: 'PRELIMINARY' }),
      iso({ hn: '0000125', organism: CA }),
      iso({ hn: '0000126', specimenDate: '2025-12-31' }),
      iso({ hn: '0000127', specimenDate: '2026-01-31' }),
    ];
    const out = firstIsolates(rows, { from: '2026-01-01', to: '2026-01-31' });
    expect(out.map((x) => x.hn)).toEqual(['0000127']);
    expect(iso({ hn: '0000123' }).hn).not.toBe('123');
  });

  it('property: never more rows, one per (HN, organism), idempotent, order-independent', () => {
    const rows = randomIsolates(400);
    const out = firstIsolates(rows);
    expect(out.length).toBeLessThanOrEqual(rows.length);
    const keys = out.map((x) => `${x.hn}|${x.organism.id}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(firstIsolates(out)).toEqual(out);
    expect(firstIsolates([...rows].reverse())).toEqual(out);
    expect(firstIsolates(rows)).toEqual(out);
    // each selected row is the minimum of its group among countable bacterial rows
    for (const f of out) {
      const group = rows.filter((x) => x.hn === f.hn && x.organism.id === f.organism.id && x.status === 'APPROVED' && x.reportStatus === 'FINAL');
      expect(group.every((x) => x.specimenDate >= f.specimenDate)).toBe(true);
    }
    expect(out.some((x) => x.organism.orgClass !== 'BACTERIA')).toBe(false);
  });
});
