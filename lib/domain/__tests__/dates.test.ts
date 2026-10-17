import { describe, expect, it } from 'vitest';
import { addDays, addMonths, diffDays, formatThaiDate, monthsBetween, parseThaiOrCeDate, toIsoDateInTz } from '../dates';

describe('parseThaiOrCeDate', () => {
  it('BE and CE DD/MM/YYYY give the same CE date and keep raw', () => {
    expect(parseThaiOrCeDate('13/05/2566')).toEqual({ iso: '2023-05-13', raw: '13/05/2566' });
    expect(parseThaiOrCeDate('13/05/2023')).toEqual({ iso: '2023-05-13', raw: '13/05/2023' });
  });
  it('accepts time suffix, other separators, ISO and Thai month names', () => {
    expect(parseThaiOrCeDate('16/05/2023 10:42').iso).toBe('2023-05-16');
    expect(parseThaiOrCeDate('1-2-2567').iso).toBe('2024-02-01');
    expect(parseThaiOrCeDate('2023-05-13').iso).toBe('2023-05-13');
    expect(parseThaiOrCeDate('13 พ.ค. 2566').iso).toBe('2023-05-13');
    expect(parseThaiOrCeDate('13 พฤษภาคม 2566').iso).toBe('2023-05-13');
  });
  it('does not guess: invalid or ambiguous → null', () => {
    expect(parseThaiOrCeDate('31/02/2566').iso).toBeNull();
    expect(parseThaiOrCeDate('13/05/66').iso).toBeNull();
    expect(parseThaiOrCeDate('').iso).toBeNull();
    expect(parseThaiOrCeDate(null)).toEqual({ iso: null, raw: '' });
  });
});

describe('date arithmetic', () => {
  it('addDays / diffDays / addMonths / monthsBetween', () => {
    expect(addDays('2026-10-16', -89)).toBe('2026-07-19');
    expect(diffDays('2026-01-01', '2026-01-14')).toBe(13);
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonths('2026-10-16', -12)).toBe('2025-10-16');
    expect(monthsBetween('2025-11-20', '2026-02-01')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
  it('Bangkok calendar date and Thai display', () => {
    expect(toIsoDateInTz(new Date('2026-05-12T17:00:00.000Z'))).toBe('2026-05-13');
    expect(toIsoDateInTz(new Date('2026-05-13T00:00:00.000Z'))).toBe('2026-05-13');
    expect(formatThaiDate('2023-05-13')).toBe('13 พ.ค. 2566');
  });
});
