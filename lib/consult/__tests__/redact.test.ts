import { describe, expect, it } from 'vitest';
import { REDACTED, redact } from '@/lib/consult/redact';

describe('redact (MR13.8)', () => {
  it('removes HN patterns and long digit runs', () => {
    const r = redact('ผู้ป่วย HN 0000123 lab no 9900000001 โทร 081-234-5678 ICU B');
    expect(r.text).not.toMatch(/0000123|9900000001|081-234-5678/);
    expect(r.text).toContain(REDACTED);
    expect(r.text).toContain('ICU B');
    expect(r.redacted).toBe(true);
  });

  it('removes Thai titled names and e-mails', () => {
    const r = redact('นายสมชาย ใจดี ติดต่อ demo@example.com');
    expect(r.text).not.toContain('สมชาย');
    expect(r.text).not.toContain('demo@example.com');
  });

  it('keeps clinical text and short numbers', () => {
    const q = 'K. pneumoniae จาก blood culture ใน ICU B ยาตัวไหนข้อมูลท้องถิ่นสนับสนุน min 30';
    const r = redact(q);
    expect(r.text).toBe(q);
    expect(r.redacted).toBe(false);
  });

  it('handles empty input', () => {
    expect(redact(null)).toEqual({ text: '', redacted: false, count: 0 });
  });
});
