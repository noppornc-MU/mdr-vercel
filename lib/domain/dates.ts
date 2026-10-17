// Date helpers (pure). All domain dates are CE calendar dates as 'YYYY-MM-DD' strings.

const THAI_MONTHS: { full: string; short: string }[] = [
  { full: 'มกราคม', short: 'ม.ค.' },
  { full: 'กุมภาพันธ์', short: 'ก.พ.' },
  { full: 'มีนาคม', short: 'มี.ค.' },
  { full: 'เมษายน', short: 'เม.ย.' },
  { full: 'พฤษภาคม', short: 'พ.ค.' },
  { full: 'มิถุนายน', short: 'มิ.ย.' },
  { full: 'กรกฎาคม', short: 'ก.ค.' },
  { full: 'สิงหาคม', short: 'ส.ค.' },
  { full: 'กันยายน', short: 'ก.ย.' },
  { full: 'ตุลาคม', short: 'ต.ค.' },
  { full: 'พฤศจิกายน', short: 'พ.ย.' },
  { full: 'ธันวาคม', short: 'ธ.ค.' },
];

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Build 'YYYY-MM-DD' from parts if it is a real calendar date, else null. */
function makeIso(y: number, m: number, d: number): string | null {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (y > 2400) y -= 543; // Buddhist Era → CE
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, '0')}-${pad2(m)}-${pad2(d)}`;
}

/**
 * Parse a report date written as DD/MM/YYYY (BE or CE; BE when year > 2400),
 * also accepting '-' or '.' separators, a trailing time, ISO 'YYYY-MM-DD',
 * and Thai month names ("13 พ.ค. 2566"). Two-digit years are not guessed.
 * Returns the CE ISO date (or null) and the original text.
 */
export function parseThaiOrCeDate(raw: string | null | undefined): { iso: string | null; raw: string } {
  const text = String(raw ?? '');
  const s = text.trim();
  if (!s) return { iso: null, raw: text };

  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/.exec(s);
  if (m) return { iso: makeIso(+m[1], +m[2], +m[3]), raw: text };

  m = /^(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{4})(?:[\sT,].*)?$/.exec(s);
  if (m) return { iso: makeIso(+m[3], +m[2], +m[1]), raw: text };

  m = /^(\d{1,2})\s*([\u0E00-\u0E7F.]+)\s*(\d{4})(?:\s.*)?$/.exec(s);
  if (m) {
    const name = m[2].replace(/\s+/g, '');
    const idx = THAI_MONTHS.findIndex((t) => t.full === name || t.short === name || t.short.replace(/\./g, '') === name.replace(/\./g, ''));
    if (idx >= 0) return { iso: makeIso(+m[3], idx + 1, +m[1]), raw: text };
  }
  return { iso: null, raw: text };
}

/** True for a real calendar date in 'YYYY-MM-DD' form. */
export function isValidIsoDate(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return !!m && makeIso(+m[1], +m[2], +m[3]) === s;
}

function toUtc(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(t: number): string {
  const d = new Date(t);
  return `${String(d.getUTCFullYear()).padStart(4, '0')}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** iso + n days. */
export function addDays(iso: string, n: number): string {
  return fromUtc(toUtc(iso) + n * 86_400_000);
}

/** Whole days from a to b (b − a). */
export function diffDays(a: string, b: string): number {
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

/** iso + n months, day clamped to the end of the target month. */
export function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ty = Math.floor(total / 12);
  const tm = total - ty * 12; // 0-based
  const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return `${String(ty).padStart(4, '0')}-${pad2(tm + 1)}-${pad2(Math.min(d, last))}`;
}

/** 'YYYY-MM' of a date. */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/** Every 'YYYY-MM' from the month of `from` to the month of `to`, inclusive. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = `${monthKey(from)}-01`;
  const end = monthKey(to);
  for (let guard = 0; monthKey(cur) <= end && guard < 600; guard++) {
    out.push(monthKey(cur));
    cur = addMonths(cur, 1);
  }
  return out;
}

/** Calendar date of a Date instant in the given IANA time zone (default Asia/Bangkok). */
export function toIsoDateInTz(d: Date, timeZone = 'Asia/Bangkok'): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Thai display date: "13 พ.ค. 2566" (short, default) or "13 พฤษภาคม 2566"; era 'BE' (default) or 'CE'. */
export function formatThaiDate(iso: string | null | undefined, opts: { long?: boolean; era?: 'BE' | 'CE' } = {}): string {
  if (!iso || !isValidIsoDate(iso.slice(0, 10))) return '-';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const month = opts.long ? THAI_MONTHS[m - 1].full : THAI_MONTHS[m - 1].short;
  const year = opts.era === 'CE' ? y : y + 543;
  return `${d} ${month} ${year}`;
}

/** Thai month label for 'YYYY-MM': "พ.ค. 66". */
export function formatThaiMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return month;
  return `${THAI_MONTHS[m - 1].short} ${String(y + 543).slice(-2)}`;
}
